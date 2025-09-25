import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

interface PlaceholderStackProps extends cdk.StackProps {
    table: dynamodb.TableV2;
}

// This stack is used to resolve deploy dependency issues
export class PlaceholderStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: PlaceholderStackProps) {
    super(scope, id, props);

    new cdk.CfnOutput(this, 'TableName', {
      value: props.table.tableName,
      description: 'The name of the placeholder table',
    });
  }
}
