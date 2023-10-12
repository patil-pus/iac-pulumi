# iac-pulumiWebApp AWS Infrastructure Setup with Pulumi
This code deploys an AWS VPC (Virtual Private Cloud) setup using Pulumi. It creates a VPC, Internet Gateway, six subnets (three public and three private), public and private route tables, and a public route. This setup aims to provide an infrastructure foundation for deploying web applications in AWS.

Prerequisites
Install Pulumi.
Configure AWS Credentials.
Install necessary npm packages:
bash
Copy code
npm install @pulumi/aws @pulumi/pulumi
Configuration
To use this code, ensure you have the following configuration set in your Pulumi.dev.yaml or any other Pulumi stack file:

yaml
Copy code
config:
  webApp:cidrBlock: "YOUR_CIDR_BLOCK_FOR_VPC"
  webApp:destinationCidrBlock: "YOUR_DESTINATION_CIDR_BLOCK_FOR_PUBLIC_ROUTE"
Replace the placeholders with appropriate CIDR block values.

Code Breakdown
Configuration Retrieval:
Fetching configurations like CIDR blocks from the Pulumi.dev.yaml file.

VPC Creation:
A new VPC is created with the specified CIDR block.

Availability Zones:
Retrieve available AWS availability zones and select the first three.

Subnets Creation:
Create six subnets (three public and three private) alternating between public and private. These are spread across the selected availability zones.

Internet Gateway:
An internet gateway is created and attached to the VPC to provide internet access to resources within the VPC.

Route Tables:
Two route tables are created - one for public subnets and another for private subnets.

Route Table Association:
Each subnet is associated with either the public or private route table based on its type.

Public Route:
A public route is created to enable resources in the public subnets to access the internet.

Output:
The VPC ID is exported as an output named vpcId.
