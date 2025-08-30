import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class DatabaseStack extends cdk.Stack {
  public readonly table: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const environment = ssm.StringParameter.fromStringParameterName(this, 'Param', '/let-them-draw/environment');
    cdk.Tags.of(this).add('Environment', environment.stringValue);

    const table = new dynamodb.TableV2(this, 'Database', {
      partitionKey: { name: 'requestId', type: dynamodb.AttributeType.STRING },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billing: dynamodb.Billing.provisioned({
        readCapacity: dynamodb.Capacity.fixed(5),
        writeCapacity: dynamodb.Capacity.autoscaled({ maxCapacity: 5 }),
      }),
    });
    this.table = table;

    table.addGlobalSecondaryIndex({
      indexName: 'UserIdIndex',
      partitionKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'requestDate', type: dynamodb.AttributeType.STRING },
      readCapacity: dynamodb.Capacity.fixed(5),
      writeCapacity: dynamodb.Capacity.autoscaled({ maxCapacity: 5 }),
    });
  }
}
