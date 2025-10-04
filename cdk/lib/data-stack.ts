import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';

export class DataStack extends cdk.Stack {
  public readonly table: dynamodb.TableV2;
  public readonly queue: sqs.Queue;
  public readonly artBucket: s3.Bucket;
  public readonly deadLetterQueue: sqs.Queue;
  public readonly shapesTable: dynamodb.TableV2;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const environment = ssm.StringParameter.fromStringParameterName(this, 'Param', '/let-them-draw/environment');
    cdk.Tags.of(this).add('Environment', environment.stringValue);

    const table = new dynamodb.TableV2(this, 'Database', {
      partitionKey: { name: 'requestId', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'userId', type: dynamodb.AttributeType.STRING },
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

    table.addGlobalSecondaryIndex({
      indexName: 'CheckoutSessionIdIndex',
      partitionKey: { name: 'checkoutSessionId', type: dynamodb.AttributeType.STRING },
      readCapacity: dynamodb.Capacity.fixed(5),
      writeCapacity: dynamodb.Capacity.autoscaled({ maxCapacity: 5 }),
    });

    const shapesTable = new dynamodb.TableV2(this, 'ShapesTable2', {
      partitionKey: { name: 'shapeName', type: dynamodb.AttributeType.STRING },
      sortKey: { name: 'order', type: dynamodb.AttributeType.NUMBER },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      billing: dynamodb.Billing.onDemand(),
    });
    this.shapesTable = shapesTable;

    const deadLetterQueue = new sqs.Queue(this, 'DeadLetterQueue', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.deadLetterQueue = deadLetterQueue;

    const queue = new sqs.Queue(this, 'Queue', {
      deadLetterQueue: {
        queue: deadLetterQueue,
        maxReceiveCount: 1,
      },
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });
    this.queue = queue;

    const artBucket = new s3.Bucket(this, 'ArtBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      lifecycleRules: [{
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        noncurrentVersionExpiration: cdk.Duration.days(1),
      }]
    });
    this.artBucket = artBucket;

    new cdk.CfnOutput(this, 'ShapesTableName', {
      value: shapesTable.tableName,
    });
  }
}
