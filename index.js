    const pulumi = require("@pulumi/pulumi");
    const aws = require("@pulumi/aws");

    const config = new pulumi.Config();


    const availabilityZoneCount = config.getNumber("availabilityZoneCount");
    const vpcCidrBlock = config.require("vpcCidrBlock");
    const cidrBlock = config.require("cidrBlock");
    const instanceKey = config.require("instanceKey");
    const amiId = config.require("amiId");
    const SecurityGroup_Cidr=config.require("Sec_Cidr");
    const Pass=config.require("password")



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


    const availabilityZoneNames = []; 

    aws.getAvailabilityZones({ state: `${state}` }).then(data => {
        const availabilityZones = getFirstNAvailabilityZones(data, availabilityZoneCount); 
        const vpc = new aws.ec2.Vpc(`${vpcName}`, {
            cidrBlock: `${vpcCidrBlock}`,
            availabilityZones: availabilityZones,
        });
        const internetGateway = new aws.ec2.InternetGateway(`${igwName}`, {
            vpcId: vpc.id, 
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

        function getFirstNAvailabilityZones(data, n) {
            const availableAZCount = data.names.length;
        
            if (availableAZCount >= n) {
                return data.names.slice(0, n);
            }
            else {
        
                return data.names;
            }
        }

        const privateRouteTable = new aws.ec2.RouteTable(`${private_rt}`, {
            vpcId: vpc.id,
            tags: {
                Name: `${private_rt}`,
            },
        });
        const publicRoute = new aws.ec2.Route(`public_Route`, {
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
        // console.log("This is my vpc which",vpc.id);
        const applicationSecurityGroup = new aws.ec2.SecurityGroup("applicationSecurityGroup", {
            description: "Application Security Group for web applications",
            
            vpcId: vpc.id, // Replace with your VPC ID
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: 22,  // SSH
                    toPort: 22,
                    cidrBlocks: [SecurityGroup_Cidr], // Allow SSH from anywhere
                },
                {
                    protocol: "tcp",
                    fromPort: 80,  // HTTP
                    toPort: 80,
                    cidrBlocks: [SecurityGroup_Cidr], // Allow HTTP from anywhere
                },
                {
                    protocol: "tcp",
                    fromPort: 443, // HTTPS
                    toPort: 443,
                    cidrBlocks: [SecurityGroup_Cidr], // Allow HTTPS from anywhere
                },
                {
                    protocol: "tcp",
                    fromPort: 3000, // Replace with your application port
                    toPort: 3000,
                    cidrBlocks: [SecurityGroup_Cidr], // Allow your application traffic from anywhere
                },
            ],egress: [
                {
                fromPort: 3306,      // Allow outbound traffic on port 3306
                toPort: 3306,        // Allow outbound traffic on port 3306
                protocol: "tcp",     // TCP protocol
                cidrBlocks: ["0.0.0.0/0"],  // Allow all destinations
                },
                {
                    fromPort: 443,      // Allow outbound traffic on port 3306
                    toPort: 443,        // Allow outbound traffic on port 3306
                    protocol: "tcp",     // TCP protocol
                    cidrBlocks: ["0.0.0.0/0"],  // Allow all destinations
                    },
            
            ],
        });

        const dbSecurityGroup = new aws.ec2.SecurityGroup("dbSecurityGroup", {
            description: "RDS security group",
            vpcId: vpc.id,
            egress: [{
                protocol: "-1",
                fromPort: 0,
                toPort: 0,
                cidrBlocks: [SecurityGroup_Cidr],
                // securityGroups: [applicationSecurityGroup.id]
            }],
            ingress: [{
                protocol: "tcp",
                fromPort: 3306,
                toPort: 3306,
                securityGroups: [applicationSecurityGroup.id], // Only allow the application servers in this security group
            }],
        }, { dependsOn: applicationSecurityGroup });

        const instanceType = "t2.micro"; 
        const ami = pulumi.output(aws.ec2.getAmi({
            owners: [ amiId ],
            mostRecent: true,
        })).apply(result => result.id); 
        
        const cloudwatchAgentPolicy = new aws.iam.Policy("cloudwatchAgentPolicy", {
            description: "Policy for CloudWatch Agent",
            policy: {
                Version: "2012-10-17",
                Statement: [
                    {
                        Action: [
                            "cloudwatch:PutMetricData",
                            "ec2:DescribeVolumes",
                            "ec2:DescribeTags",
                            "logs:DescribeLogStream",
                            "logs:DescribeLogGroups",
                            "logs:CreateLogGroup",
                            "logs:CreateLogStream",
                            "logs:PutLogEvents",
                        ],
                        Effect: "Allow",
                        Resource: "*",
                    },
                ],
            },
        });

        const iamRole = new aws.iam.Role("CloudWatchAgentRole", {
            assumeRolePolicy: JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Action: "sts:AssumeRole",
                        Effect: "Allow",
                        Principal: {
                            Service: "ec2.amazonaws.com",
                        },
                    },
                ],
            }),
        });
     
     
        const testAttach = new aws.iam.RolePolicyAttachment("testAttach", {
            role: iamRole.name,
            policyArn: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
        },{ dependsOn: [iamRole] });
       
     
        const ec2InstanceProfile = new aws.iam.InstanceProfile("ec2InstanceProfile", {
            name: "ec2InstanceProfile", // You can choose a different name
            role: iamRole.name, // Use the IAM role you've defined
        },{ dependsOn: [testAttach] });
     

        const dbparametergroup = new aws.rds.ParameterGroup('dbparametergroup', {
            family: 'mysql8.0', 
            parameters: [
                {
                    name: 'max_connections',
                    value: '100',
                },
            ],
        });
        
        
        const privateSubnetIds = privateSubnets.map(subnet => subnet.id);
        const privateSubnetGroup = new aws.rds.SubnetGroup("privateSubnetGroup", {
            subnetIds: privateSubnetIds, 
            name: "my-private-subnet-group", 
            //description: "Private subnet group for RDS",
        });

        const dbInstance = new aws.rds.Instance("web-app-rds-instance", {
            engine: "mysql",
            instanceClass: "db.t2.micro",
            allocatedStorage: 20,
            name: "csye6225",
            username: "csye6225",
            //skipFinalSnapshot: true,
            password: Pass,
            zone: "us-east-1",
            //parameterGroupName: "default.mysqls8.0",
            skipFinalSnapshot: true,
            vpcSecurityGroupIds: [dbSecurityGroup.id],
            // publiclyAccessible: false,
            multiAz: false,
            vpcId: vpc.id,
            dbSubnetGroupName: privateSubnetGroup.name,
            parameterGroupName: dbparametergroup
            
        },{ dependsOn: [privateSubnetGroup, dbSecurityGroup, dbparametergroup] });
        
        const ec2Instance = new aws.ec2.Instance("myEC2Instance", {
            instanceType: instanceType,
            ami: ami,
            iamInstanceProfile:ec2InstanceProfile.name,
            keyName: instanceKey,
            vpcSecurityGroupIds: [applicationSecurityGroup.id], 
            subnetId: publicSubnets[0].id, 
            dependsOn:[dbInstance],
            rootBlockDevice: {
                volumeSize: 25,     
                deleteOnTermination: true
            },
            userData: pulumi.interpolate`#!/bin/bash
                sudo touch /home/admin/webapp/pushkar.txt
                sudo rm -f /home/admin/webapp/.env
                sudo touch /home/admin/webapp/.env
                echo "MYSQL_HOST=${dbInstance.address}" | sudo tee -a /home/admin/webapp/.env 
                echo "MYSQL_PORT=${dbInstance.port}" | sudo tee -a /home/admin/webapp/.env 
                echo "MYSQL_DATABASE=${dbInstance.dbName}" | sudo tee -a /home/admin/webapp/.env 
                echo "MYSQL_USER=${dbInstance.username}" | sudo tee -a /home/admin/webapp/.env 
                echo "MYSQL_PASSWORD=${dbInstance.password}" | sudo tee -a /home/admin/webapp/.env 
                echo "DB_DIALECT=${dbInstance.engine}" | sudo tee -a /home/admin/webapp/.env 
                echo "awsAccessKeyId=${config.require("awsAccessKeyId")}" | sudo tee -a /home/admin/webapp/.env 
                echo "awsSecretAccessKey=${config.require("awsSecretAccessKey")}" | sudo tee -a /home/admin/webapp/.env 
                echo "awsRegion= us-east-1" | sudo tee -a /home/admin/webapp/.env
                echo "CLOUDWATCH_LOG_GROUP_NAME=${config.require("CLOUDWATCH_LOG_GROUP_NAME")}" |  sudo tee -a /home/admin/webapp/.env
                echo "CLOUDWATCH_LOG_GROUP_NAME=${config.require("CLOUDWATCH_LOG_STREAM_NAME")}" |  sudo tee -a /home/admin/webapp/.env
                cat .env
                sudo chown -R csye6225:csye6225 /home/admin/webapp
                sudo chmod -R 750 /home/admin/webapp
                sudo systemctl daemon-reload
                sudo systemctl enable csye6225
                sudo systemctl start csye6225
                sudo /opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
                -a fetch-config \
                -m ec2 \
                -c file:/opt/aws/amazon-cloudwatch-agent/bin/cloudwatch-agent-config.json \
                -s
                sudo systemctl enable amazon-cloudwatch-agent
                sudo systemctl start amazon-cloudwatch-agent`,
            tags: {
                Name: "MyEC2Instance", 
            },
        }, { dependsOn: applicationSecurityGroup });

        const baseDomainName = config.require("basedomain"); 
        const zonePromise = aws.route53.getZone({ name: baseDomainName }, { async: true });

        zonePromise.then(zone => {
    
        const record = new aws.route53.Record("myRecord", {
        zoneId: zone.zoneId, 
        name: "",
        type: "A",
        ttl: 60,
        records: [ec2Instance.publicIp],
    }, { dependsOn: [ec2Instance] });   
});
        
    });