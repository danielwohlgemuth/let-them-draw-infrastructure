import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';

interface DataStackProps extends cdk.StackProps {
  table: dynamodb.TableV2;
}

export class DataStack extends cdk.Stack {
  public readonly table: dynamodb.TableV2;
  public readonly queue: sqs.Queue;
  public readonly artBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataStackProps) {
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

    const queue = new sqs.Queue(this, 'Queue');
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

    const migrationFunction = new lambda.Function(this, 'DynamoMigrationFunction', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'index.lambda_handler',
      code: lambda.Code.fromInline(`
import boto3
import json
from decimal import Decimal

def lambda_handler(event, context):
    dynamodb = boto3.resource('dynamodb')
    old_table = dynamodb.Table('${props.table.tableName}')
    new_table = dynamodb.Table('${table.tableName}')

    # Scan old table with pagination
    response = old_table.scan()

    with new_table.batch_writer() as batch:
        for item in response['Items']:
            # Convert Decimal to int/float for JSON serialization
            clean_item = json.loads(json.dumps(item, default=decimal_default))
            batch.put_item(Item=clean_item)

    # Handle pagination if there are more items
    while 'LastEvaluatedKey' in response:
        response = old_table.scan(ExclusiveStartKey=response['LastEvaluatedKey'])
        with new_table.batch_writer() as batch:
            for item in response['Items']:
                clean_item = json.loads(json.dumps(item, default=decimal_default))
                batch.put_item(Item=clean_item)

    return {'statusCode': 200, 'body': 'Migration completed'}

def decimal_default(obj):
    if isinstance(obj, Decimal):
        return int(obj) if obj % 1 == 0 else float(obj)
    raise TypeError
  `),
      timeout: cdk.Duration.minutes(15),
      memorySize: 1024
    });

    // Grant permissions
    props.table.grantReadData(migrationFunction);
    table.grantWriteData(migrationFunction);
  }
}
