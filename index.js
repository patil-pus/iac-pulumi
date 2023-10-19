const pulumi = require("@pulumi/pulumi");
const aws = require("@pulumi/aws");

const config = new pulumi.Config();


const availabilityZoneCount = config.getNumber("availabilityZoneCount");
const vpcCidrBlock = config.require("vpcCidrBlock");
const cidrBlock = config.require("cidrBlock");
const instanceKey = config.require("instanceKey");
const amiId = config.require("amiId");

amiId
const publicSubnets = [];
const privateSubnets = [];


const subnetSuffix = config.require("subnetSuffix");

const state = config.require("state");
const vpcName = config.require("vpcName");
const igwName = config.require("igwName");
const publicSta = config.require("public");


const destinationCidr = config.require("destinationCidr");
const public_route_association = config.require("public-route-association");
const private_route_association = config.require("private-route-association");
const privateSta = config.require("private");

const public_Subnet = config.require("publicsubnet");
const private_Subnet = config.require("privatesubnet");

const public_rt = config.require("public-rt");
const private_rt = config.require("private-rt");
const public_Route = config.require("publicRoute");




// Define a function to get the first N availability zones
function getFirstNAvailabilityZones(data, n) {
    const availableAZCount = data.names.length;

    if (availableAZCount >= n) {
        return data.names.slice(0, n);
    }
    else {

        return data.names;
    }
}

const availabilityZoneNames = []; // Initialize an array to store availability zone names

aws.getAvailabilityZones({ state: `${state}` }).then(data => {
    const availabilityZones = getFirstNAvailabilityZones(data, availabilityZoneCount); // Choose the first 3 AZs if available AZs are greater than 3
    const vpc = new aws.ec2.Vpc(`${vpcName}`, {
        cidrBlock: `${vpcCidrBlock}`,
        availabilityZones: availabilityZones,
    });
    const internetGateway = new aws.ec2.InternetGateway(`${igwName}`, {
        vpcId: vpc.id, // Associate the Internet Gateway with the VPC
    });

    for (let i = 0; i < availabilityZones.length; i++) {
        const az = availabilityZones[i];
        availabilityZoneNames.push(az);
    }
    const calculateCidrBlock = (index, subnetType) => {
        const subnetNumber = subnetType === `${publicSta}` ? index : index + availabilityZoneCount;
        return `${cidrBlock}.${subnetNumber}${subnetSuffix}`;
    };

    // Create subnets within each availability zone
    for (let i = 0; i < availabilityZoneNames.length; i++) {
        const az = availabilityZoneNames[i];

        // Create public and private subnets using aws.ec2.Subnet
        const publicSubnet = new aws.ec2.Subnet(`${public_Subnet}-${az}-${i}`, {
            vpcId: vpc.id,
            cidrBlock: calculateCidrBlock(i, `${publicSta}`),
            availabilityZone: az,
            mapPublicIpOnLaunch: true,
            tags: {
                Name: `${public_Subnet}`,
            },
        });

        const privateSubnet = new aws.ec2.Subnet(`${private_Subnet}-${az}-${i}`, {
            vpcId: vpc.id,
            cidrBlock: calculateCidrBlock(i, `${privateSta}`),
            availabilityZone: az,
            tags: {
                Name: `${private_Subnet}`,
            },
        });

        publicSubnets.push(publicSubnet);
        privateSubnets.push(privateSubnet);
    }

    const publicRouteTable = new aws.ec2.RouteTable(`${public_rt}`, {
        vpcId: vpc.id,
        tags: {
            Name: `${public_rt}`,
        },
    });

    const privateRouteTable = new aws.ec2.RouteTable(`${private_rt}`, {
        vpcId: vpc.id,
        tags: {
            Name: `${private_rt}`,
        },
    });
    const publicRoute = new aws.ec2.Route(`${public_Route}`, {
        routeTableId: publicRouteTable.id,
        destinationCidrBlock: `${destinationCidr}`,
        gatewayId: internetGateway.id,
    });

    // Associate the public subnets with the public route table
    publicSubnets.forEach((subnet, i) => {
        new aws.ec2.RouteTableAssociation(`${public_route_association}-${subnet.availabilityZone}-${i}`, {
            subnetId: subnet.id,
            routeTableId: publicRouteTable.id,
            tags: {
                Name: `${public_route_association}`,
            },
        });
    });

    // Associate the private subnets with the private route table
    privateSubnets.forEach((subnet, i) => {
        new aws.ec2.RouteTableAssociation(`${private_route_association}-${subnet.availabilityZone}-${i}`, {
            subnetId: subnet.id,
            routeTableId: privateRouteTable.id,
            tags: {
                Name: `${private_route_association}`,
            },
        });
    });


    // Create an Application Security Group
    const applicationSecurityGroup = new aws.ec2.SecurityGroup("applicationSecurityGroup", {
        description: "Application Security Group for web applications",
        vpcId: vpc.id, // Replace with your VPC ID
        ingress: [
            {
                protocol: "tcp",
                fromPort: 22,  // SSH
                toPort: 22,
                cidrBlocks: ["0.0.0.0/0"], // Allow SSH from anywhere
            },
            {
                protocol: "tcp",
                fromPort: 80,  // HTTP
                toPort: 80,
                cidrBlocks: ["0.0.0.0/0"], // Allow HTTP from anywhere
            },
            {
                protocol: "tcp",
                fromPort: 443, // HTTPS
                toPort: 443,
                cidrBlocks: ["0.0.0.0/0"], // Allow HTTPS from anywhere
            },
            {
                protocol: "tcp",
                fromPort: 3000, // Replace with your application port
                toPort: 3000,
                cidrBlocks: ["0.0.0.0/0"], // Allow your application traffic from anywhere
            },
        ],
    });


    const instanceType = "t2.micro"; // Replace with your desired instance type
    const ami = pulumi.output(aws.ec2.getAmi({
        owners: [ amiId ],
        mostRecent: true,
    })).apply(result => result.id); 
    


    const keyName = "ec2-key"; // Replace with your EC2 key pair name
    const sshKey = new aws.ec2.KeyPair("mySshKey", {
        keyName: keyName,
        publicKey: "ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABgQCwEm729yoTeex/elW5Aj41W9r4jYN3uNj83mHEieGY0HYAXBHRwjZDZIkiU6afeinvwrSUfA5/PgSgKn0YV1EB6uySi5Ej4a75ZA37KS0gDGGRGObzlHIFuNVpYHlQk+3AZ4UaDqKqLASLdrJM3J6rJZDZBITKx4jyBN+c8r8zFJa2M7rLNDxIYL9cMlfd1aKZ/E1mKwqRHmHkWEH3eOsw4fZYsqZ5HewjfJ7iXT0RLfSkGlMdJS3t/4KPR2Zja7lDtn5P+yZIG01TtxmljuC0Bk6THlNjLIfXUW7VkVM9YqzLMXYeg1Q1yyzJadKKabDhKkQ5+uUDBX8tEBA1/jQRcCqvryBVdibp6XPjsLUwohO+PuAjHv0yhqipId2XK8+0ebQMW3Q7bvyqFwU7cOKPo/OWpNE0wl13aAgXN1X8BjneXOmxQ26PIeaXRwM6BpXPTme4v3UdV7ncCSf6pJYshazHMGBMGHtOdZ7LLIF0731NHnD0J9+3b8crfibkYgE= pushk@Pushkars_Laptop        ", // Replace with your public SSH key content
        userData: `
        #!/bin/bash
        sudo apt-get update -y
        sudo apt-get install -y nodejs
        sudo DEBIAN_FRONTEND=noninteractive apt update -q
        sudo DEBIAN_FRONTEND=noninteractive apt -q --assume-yes install mariadb-client mariadb-server
        sudo systemctl enable mariadb
        systemctl start mariadb
        sudo apt install unzip
        sudo npm install -g pm2
        sudo apt install unzip
        `,
    });
    // Define the EC2 instance

   
    const ec2Instance = new aws.ec2.Instance("myEC2Instance", {
        instanceType: instanceType,
        ami: ami,
        keyName: instanceKey,
        vpcSecurityGroupIds: [applicationSecurityGroup.id], // Attach the Application Security Group created in the previous step
        subnetId: publicSubnets[0].id, // Replace with the subnet ID where you want to launch the EC2 instance
        rootBlockDevice: {
            volumeSize: 30, // Size of the root EBS volume (in GB)
            deleteOnTermination: true, // Automatically delete the root EBS volume when the EC2 instance is terminated
        },
        tags: {
            Name: "MyEC2Instance", // Replace with a suitable name
        },
    });





});