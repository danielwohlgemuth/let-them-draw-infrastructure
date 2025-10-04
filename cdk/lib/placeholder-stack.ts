import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';

interface PlaceholderStackProps extends cdk.StackProps {
  userPool: cognito.UserPool;
}

// This stack is used to resolve deploy dependency issues
export class PlaceholderStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: PlaceholderStackProps) {
    super(scope, id, props);

    new cdk.CfnOutput(this, 'WebsiteStackUserPoolArn', {
      value: props.userPool.userPoolArn,
      exportName: 'WebsiteStack:UserPoolArn',
    });

    new cdk.CfnOutput(this, 'WebsiteStackUserPoolId', {
      value: props.userPool.userPoolId,
      exportName: 'WebsiteStack:UserPoolId',
    });
  }
}
