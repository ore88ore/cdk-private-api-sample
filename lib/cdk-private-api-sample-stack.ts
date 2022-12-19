import {
  aws_ec2 as ec2,
  aws_apigateway as apigateway,
  aws_lambda as lambda,
  aws_lambda_nodejs as nodejs,
  aws_iam as iam,
  Stack,
  StackProps
} from 'aws-cdk-lib';
import {Construct} from 'constructs';

export class CdkPrivateApiSampleStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // VPC
    const vpc = new ec2.Vpc(this, "Vpc", {
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "public-subnet",
          subnetType: ec2.SubnetType.PUBLIC,
        }
      ],
    });

    // セキュリティグループ
    const ec2SecurityGroup = new ec2.SecurityGroup(this, "ec2SecurityGroup", {
      vpc,
    });
    const vpcEndpointSecurityGroup = new ec2.SecurityGroup(this, "vpcEndpointSecurityGroup", {
      vpc,
    });
    vpcEndpointSecurityGroup.addIngressRule(ec2SecurityGroup, ec2.Port.allTraffic());

    // VPC エンドポイント
    const privateApiVpcEndpoint = new ec2.InterfaceVpcEndpoint(this, "privateApiVpcEndpoint", {
      vpc,
      service: ec2.InterfaceVpcEndpointAwsService.APIGATEWAY,
      subnets: {subnets: vpc.publicSubnets},
      securityGroups: [vpcEndpointSecurityGroup],
      open: false,
    });

    const ec2Instance = new ec2.Instance(this, "ec2Instance", {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T4G,
        ec2.InstanceSize.NANO
      ),
      machineImage: new ec2.AmazonLinuxImage({
        generation: ec2.AmazonLinuxGeneration.AMAZON_LINUX_2,
        cpuType: ec2.AmazonLinuxCpuType.ARM_64,
      }),
      securityGroup: ec2SecurityGroup,
      role: new iam.Role(this, "ec2Role", {
        managedPolicies: [iam.ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore")],
        assumedBy: new iam.ServicePrincipal("ec2.amazonaws.com"),
      }),
    });

    // Lambda
    const lambdaFunction = new nodejs.NodejsFunction(this, "lambdaFunction", {
      runtime: lambda.Runtime.NODEJS_16_X,
      entry: "lib/lambda.ts",
      architecture: lambda.Architecture.ARM_64,
      memorySize: 256,
    });

    // API Gateway
    const privateApi = new apigateway.LambdaRestApi(this, 'privateApi', {
      endpointTypes: [apigateway.EndpointType.PRIVATE],
      handler: lambdaFunction,
      policy: new iam.PolicyDocument({
        statements: [
          new iam.PolicyStatement({
            principals: [new iam.AnyPrincipal],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*'],
            effect: iam.Effect.DENY,
            conditions: {
              StringNotEquals: {
                "aws:SourceVpce": privateApiVpcEndpoint.vpcEndpointId
              }
            }
          }),
          new iam.PolicyStatement({
            principals: [new iam.AnyPrincipal],
            actions: ['execute-api:Invoke'],
            resources: ['execute-api:/*'],
            effect: iam.Effect.ALLOW
          })
        ]
      })
    });
  }
}
