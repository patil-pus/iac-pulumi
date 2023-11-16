    const pulumi = require("@pulumi/pulumi");
    const aws = require("@pulumi/aws");
    const { RdsDbInstance } = require("@pulumi/aws/opsworks");
const { Script } = require("@pulumi/aws/gamelift");
const { LoadBalancer } = require("@pulumi/aws/alb");

    const { RdsDbInstance } = require("@pulumi/aws/opsworks");
const { Script } = require("@pulumi/aws/gamelift");
const { LoadBalancer } = require("@pulumi/aws/alb");


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

        
        for (let i = 0; i < availabilityZoneNames.length; i++) {
            const az = availabilityZoneNames[i];

            

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
        

        publicSubnets.forEach((subnet, i) => {
            new aws.ec2.RouteTableAssociation(`${public_route_association}-${subnet.availabilityZone}-${i}`, {
                subnetId: subnet.id,
                routeTableId: publicRouteTable.id,
                tags: {
                    Name: `${public_route_association}`,
                },
            });

        });

        
        privateSubnets.forEach((subnet, i) => {
            new aws.ec2.RouteTableAssociation(`${private_route_association}-${subnet.availabilityZone}-${i}`, {
                subnetId: subnet.id,
                routeTableId: privateRouteTable.id,
                tags: {
                    Name: `${private_route_association}`,
                },
            });

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
     


        // console.log("This is my vpc which",vpc.id);
        const loadBalancerSecurityGroup = new aws.ec2.SecurityGroup("loadBalancerSecurityGroup", {
            description: "Load Balancer Security Group for web application",
            vpcId: vpc.id, 
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: 80,
                    toPort: 80,
                    cidrBlocks: ["0.0.0.0/0"], 
                },
                {
                    protocol: "tcp",
                    fromPort: 443,
                    toPort: 443,
                    cidrBlocks: ["0.0.0.0/0"], 

                },
            ],
            egress: [
                {
                    fromPort: 0,
                    toPort: 0,
                    protocol: "-1",
                    cidrBlocks: ["0.0.0.0/0"], 
                },
            ],

        });
        


        const applicationSecurityGroup = new aws.ec2.SecurityGroup("applicationSecurityGroup", {
            description: "Application Security Group for web applications",
            
            vpcId: vpc.id, 
            ingress: [
                {
                    protocol: "tcp",
                    fromPort: 22,  
                    toPort: 22,
                    securityGroups: [loadBalancerSecurityGroup.id], 
                },
                {
                    protocol: "tcp",
                    fromPort: 3000, 
                    toPort: 3000,
                    securityGroups: [loadBalancerSecurityGroup.id], 
                },
                // {
                //     protocol: "tcp",
                //     fromPort: 80,  // HTTP
                //     toPort: 80,
                //     cidrBlocks: [SecurityGroup_Cidr], // Allow HTTP from anywhere
                // },
                // {
                //     protocol: "tcp",
                //     fromPort: 443, // HTTPS
                //     toPort: 443,
                //     cidrBlocks: [SecurityGroup_Cidr], // Allow HTTPS from anywhere
                // },
            ],
            egress: [
                {
                    fromPort: 0,      
                    toPort: 0,        
                    protocol: "-1",     
                    cidrBlocks: ["0.0.0.0/0"], 
                }   
                
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
                securityGroups: [applicationSecurityGroup.id], 
            }],
        }, { dependsOn: applicationSecurityGroup });
         
        const privateSubnetIds = privateSubnets.map(subnet => subnet.id);
        const privateSubnetGroup = new aws.rds.SubnetGroup("privateSubnetGroup", {
            subnetIds: privateSubnetIds, 
            name: "my-private-subnet-group", 
            
        });
        

        const instanceType = "t2.micro"; 
        const ami = pulumi.output(aws.ec2.getAmi({
            owners: [ amiId ],
            mostRecent: true,
        })).apply(result => result.id); 

        const dbparametergroup = new aws.rds.ParameterGroup('dbparametergroup', {
            family: 'mysql8.0', 
            parameters: [
                {
                    name: 'max_connections',
                    value: '100',
                },
            ],
        });

        
       
        

        const iamRole = new aws.iam.Role("CloudWatchAgentRole", {
        assumeRolePolicy: JSON.stringify({
        Version: "2012-10-17",
        Statement: [{
            Action: "sts:AssumeRole",
            Effect: "Allow",
            Principal: {
                Service: "ec2.amazonaws.com",
            },
        }],
    }),
});
    
const testAttach = new aws.iam.RolePolicyAttachment("testAttach", {
    role: iamRole.name,
    policyArn: "arn:aws:iam::aws:policy/CloudWatchAgentServerPolicy",
},{ dependsOn: [iamRole] });

    const iamInstanceProfile = new aws.iam.InstanceProfile("webAppInstanceProfile", {
        role: iamRole.name,
    }, { dependsOn: [testAttach] });

    const dbInstance = new aws.rds.Instance("web-app-rds-instance", {
        engine: "mysql",
        instanceClass: "db.t2.micro",
        allocatedStorage: 20,
        dbName: "csye6225",
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
    
    const userdata = pulumi.interpolate`#!/bin/bash
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
    sudo systemctl start amazon-cloudwatch-agent` ;

    const encodedUserData = userdata.apply(Script=>Buffer.from(Script).toString('base64'));
    
    const ec2InstanceProfile = new aws.iam.InstanceProfile("ec2InstanceProfile", {
        name: "ec2InstanceProfile", 
        role: iamRole.name, 
    },{ dependsOn: [testAttach] });
 
    
    
    const webAppLaunchTemplate = new aws.ec2.LaunchTemplate("webAppLaunchTemplate", {
            imageId: ami,
            instanceType: instanceType,
            keyName: instanceKey,
            networkInterfaces: [{
                associatePublicIpAddress: true,
                securityGroups  : [applicationSecurityGroup.id],
                deleteOnTermination: true
            }],
            userData: encodedUserData,
            iamInstanceProfile: {
                name: ec2InstanceProfile.name,
            },
            subnetId:publicSubnets.map(subnet => subnet.id),
        }, { dependsOn: [ec2InstanceProfile,dbInstance] } );
        
        

        
  
            const webAppTargetGroup = new aws.lb.TargetGroup("webAppTargetGroup", {
                port: 3000,
                protocol: "HTTP",
                vpcId: vpc.id,
                targetType: "instance",
                associatePublicIpAddress: true,
                healthCheck: {
                    path: "/healthz",
                    port:3000,
                    protocol: "HTTP",
                    timeout:10,
                    unhealthyThreshold: 2,
                    healthyThreshold: 2,
                },
            });
        const webAppLoadBalancer = new aws.lb.LoadBalancer("webAppLoadBalancer", {
            internal: false,
            loadBalancerType: "application",
            securityGroups: [loadBalancerSecurityGroup.id],
            subnets: publicSubnets.map(subnet => subnet.id),
        });
        
        const httpListener = new aws.lb.Listener("httpListener", {
            loadBalancerArn: webAppLoadBalancer.arn,
            port: 80,
            protocol: "HTTP",
            defaultActions: [{
                type: "forward",
                targetGroupArn: webAppTargetGroup.arn,
            }],
        },{dependsOn:[webAppTargetGroup]});
        

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
        
        
        
        const autoScalingGroup = new aws.autoscaling.Group("myAutoScalingGroup", {
            launchTemplate: {
                id: webAppLaunchTemplate.id,
                version: webAppLaunchTemplate.latestVersion,
             },
            vpcZoneIdentifiers: publicSubnets.map(subnet => subnet.id),
            minSize: 1,
            maxSize: 3,
            desiredCapacity: 1,
            healthCheckType: "EC2",
            healthCheckGracePeriod: 300,
            forceDelete: true,
            associatePublicIpAddress: true,
            tags: [{
                key: "Name",
                value: "MyAutoScalingGroup",
                propagateAtLaunch: true,
            }],
            targetGroupArns: [webAppTargetGroup.arn]
        }, { dependsOn: [webAppLoadBalancer, webAppTargetGroup] }); 
        
        
        const scaleUpPolicy = new aws.autoscaling.Policy("scaleUpPolicy", {
            scalingAdjustment: 1,
            adjustmentType: "ChangeInCapacity",
            cooldown: 60,
            autoscalingGroupName: autoScalingGroup.name,
        });
        
        const scaleDownPolicy = new aws.autoscaling.Policy("scaleDownPolicy", {
            scalingAdjustment: -1,
            adjustmentType: "ChangeInCapacity",
            cooldown: 60,
            autoscalingGroupName: autoScalingGroup.name,
        });
        
        const cpuUtilizationHighAlarm = new aws.cloudwatch.MetricAlarm("cpuUtilizationHighAlarm", {
            alarmName: "cpuUtilizationHighAlarm",
            comparisonOperator: "GreaterThanThreshold",
            evaluationPeriods: 2,
            metricName: "CPUUtilization",
            namespace: "AWS/EC2",
            period: 60,
            statistic: "Average",
            threshold: 5,
            alarmDescription: "Alarm when server CPU exceeds 5%",
            dimensions: {
                AutoScalingGroupName: autoScalingGroup.name,
            },
            alarmActions: [scaleUpPolicy.arn],
        });
        
        const cpuUtilizationLowAlarm = new aws.cloudwatch.MetricAlarm("cpuUtilizationLowAlarm", {
            alarmName: "cpuUtilizationLowAlarm",
            comparisonOperator: "LessThanThreshold",
            evaluationPeriods: 2,
            metricName: "CPUUtilization",
            namespace: "AWS/EC2",
            period: 60,
            statistic: "Average",
            threshold: 3,
            alarmDescription: "Alarm when server CPU falls below 3%",
            dimensions: {
                AutoScalingGroupName: autoScalingGroup.name,
            },
            alarmActions: [scaleDownPolicy.arn],
        });
        
        
        
        
       
     



        
        
        // const ec2Instance = new aws.ec2.Instance("myEC2Instance", {
        //     instanceType: instanceType,
        //     ami: ami,
        //     iamInstanceProfile:ec2InstanceProfile.name,
        //     keyName: instanceKey,
        //     vpcSecurityGroupIds: [applicationSecurityGroup.id], 
        //     subnetId: publicSubnets[0].id, 
        //     dependsOn:[dbInstance],
        //     rootBlockDevice: {
        //         volumeSize: 25,     
        //         deleteOnTermination: true
        //     },
        //     userData: userdata,
        //     tags: {
        //         Name: "MyEC2Instance", 
        //     },
        // }, { dependsOn: applicationSecurityGroup });

        const baseDomainName = config.require("basedomain"); 
        const zonePromise = aws.route53.getZone({ name: baseDomainName }, { async: true });

        zonePromise.then(zone => {
    
        const record = new aws.route53.Record("myRecord", {
        zoneId: zone.zoneId, 
        name: baseDomainName,   
        type: "A",
        aliases: [{
            name: webAppLoadBalancer.dnsName,
            zoneId:  webAppLoadBalancer.zoneId,
            evaluateTargetHealth: true,
        }],
    }, { dependsOn: [webAppLoadBalancer] });   
});

    });