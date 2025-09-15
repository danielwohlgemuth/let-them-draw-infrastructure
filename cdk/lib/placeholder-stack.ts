import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';

interface PlaceholderStackProps extends cdk.StackProps {
  httpApi: apigwv2.HttpApi;
}
export class PlaceholderStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: PlaceholderStackProps) {
    super(scope, id, props);

    new cdk.CfnOutput(this, 'HttpApiUrl', {
      value: props.httpApi.url!,
      description: 'The URL of the placeholder API',
    });
  }
}
