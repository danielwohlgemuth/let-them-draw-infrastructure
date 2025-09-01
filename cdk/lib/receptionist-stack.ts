import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';

interface ReceptionistStackProps extends cdk.StackProps {
  table: dynamodb.TableV2;
}

export class ReceptionistStack extends cdk.Stack {
  public readonly httpApi: apigwv2.HttpApi;

  constructor(scope: Construct, id: string, props: ReceptionistStackProps) {
    super(scope, id, props);

    const environment = ssm.StringParameter.fromStringParameterName(this, 'EnvironmentParam', '/let-them-draw/environment');
    cdk.Tags.of(this).add('Environment', environment.stringValue);

    const bucket = new s3.Bucket(this, 'Bucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      lifecycleRules: [{
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        noncurrentVersionExpiration: cdk.Duration.days(1),
      }]
    });

    const queue = new sqs.Queue(this, 'Queue');
    const lambdaVersion = ssm.StringParameter.fromStringParameterName(this, 'LambdaVersionParam', '/let-them-draw/receptionist-lambda-version');
    const fn = new lambda.Function(this, 'Function', {
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: 'lambda_function.lambda_handler',
        code: lambda.Code.fromInline('print("placeholder")'),
        environment: {
          "TABLE_NAME": props.table.tableName,
          "QUEUE_NAME": queue.queueName,
        },
    });
    queue.grantSendMessages(fn);
    props.table.grantReadWriteData(fn);

    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineType: codepipeline.PipelineType.V2
    });

    const infrastructureBranch = ssm.StringParameter.fromStringParameterName(this, 'ParamInfrastructureBranch', '/let-them-draw/infrastructure-branch');
    const githubConnectionArn = ssm.StringParameter.fromStringParameterName(this, 'ParamGithubConnectionArn', '/let-them-draw/github-connection-arn');
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: 'GitHub_Source',
      owner: 'danielwohlgemuth',
      repo: 'let-them-draw-receptionist',
      branch: infrastructureBranch.stringValue,
      output: sourceOutput,
      connectionArn: githubConnectionArn.stringValue,
    });

    pipeline.addStage({
      stageName: 'Source',
      actions: [sourceAction],
    });

    pipeline.addTrigger({
      providerType: codepipeline.ProviderType.CODE_STAR_SOURCE_CONNECTION,
      gitConfiguration: {
        sourceAction: sourceAction,
        pushFilter: [{
          branchesIncludes: [infrastructureBranch.stringValue],
          filePathsIncludes: [
            'src/*',
            'src/**/*',
          ]
        }]
      }
    });

    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com')
    });
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCloudFormationFullAccess'));
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:PutObject'],
      resources: [`${bucket.bucketArn}/*`]
    }));
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['s3:ListBucketVersions'],
      resources: [bucket.bucketArn]
    }));
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['lambda:UpdateFunctionCode'],
      resources: [fn.functionArn]
    }));
    role.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: ['ssm:PutParameter'],
      resources: [lambdaVersion.parameterArn]
    }));

    const deployAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'DeployStacks',
      project: new codebuild.PipelineProject(this, 'DeployProject', {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            build: {
              commands: [
                'echo "Packaging Lambda code..."',
                'mkdir package',
                'pip install -r requirements.txt --python-version 3.13 --platform manylinux2014_x86_64 --target package/ --only-binary=:all:',
                'cp -r src/* ./package/',
                'cd package',
                'zip -r ../lambda.zip .',
                'cd ..',
                `aws s3 cp lambda.zip s3://${bucket.bucketName}/lambda.zip`,
                `VERSION_ID=$(aws s3api list-object-versions --bucket ${bucket.bucketName} --prefix lambda.zip --query "Versions[?IsLatest].VersionId" --output text)`,
                `aws lambda update-function-code --function-name ${fn.functionName} --zip-file fileb://lambda.zip`,
                'aws ssm put-parameter --name "/let-them-draw/receptionist-lambda-version" --value "$VERSION_ID" --type "String" --overwrite'
              ]
            }
          },
        }),
        role: role
      }),
      input: sourceOutput,
    });

    pipeline.addStage({
      stageName: 'Deploy',
      actions: [deployAction],
    });

    const receptionistIntegration = new integrations.HttpLambdaIntegration('ReceptionistIntegration', fn);
    const httpApi = new apigwv2.HttpApi(this, 'HttpApi', {
      defaultIntegration: receptionistIntegration,
    });
    this.httpApi = httpApi;
    httpApi.addRoutes({
        path: '/',
        methods: [apigwv2.HttpMethod.ANY],
        integration: receptionistIntegration,
    });

    new cdk.CfnOutput(this, 'FunctionName', {
      value: fn.functionName,
      description: 'The name of the Receptionist Lambda function',
    });
  }
}
