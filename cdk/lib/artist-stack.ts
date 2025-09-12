import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as sources from 'aws-cdk-lib/aws-lambda-event-sources';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as ses from 'aws-cdk-lib/aws-ses';
import * as cognito from 'aws-cdk-lib/aws-cognito';

interface ArtistStackProps extends cdk.StackProps {
  table: dynamodb.TableV2;
  queue: sqs.Queue;
  userPool: cognito.UserPool;
}

export class ArtistStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: ArtistStackProps) {
    super(scope, id, props);

    const environment = ssm.StringParameter.fromStringParameterName(this, 'EnvironmentParam', '/let-them-draw/environment');
    cdk.Tags.of(this).add('Environment', environment.stringValue);

    const configurationSet = new ses.ConfigurationSet(this, 'EmailConfigurationSet', {
      reputationMetrics: true,
      suppressionReasons: ses.SuppressionReasons.BOUNCES_AND_COMPLAINTS,
    });

    const fromEmail = ssm.StringParameter.fromStringParameterName(this, 'FromEmailParam', '/let-them-draw/from-email');
    new ses.EmailIdentity(this, 'VerifiedIdentity', {
      identity: ses.Identity.email(fromEmail.stringValue),
      configurationSet: configurationSet,
    });

    new ses.CfnTemplate(this, 'CfnTemplate', {
      template: {
        templateName: 'ArtworkNotification',
        subjectPart: 'Your Art is Ready!',
        htmlPart: '<h1>Hello,</h1><p>Your artwork is ready!</p><p>You can see it at {{artworkUrl}}</p>',
        textPart: 'Hello,\n\nYour artwork is ready!\nYou can see it at {{artworkUrl}}'
      },
    });

    const artBucket = new s3.Bucket(this, 'ArtBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      versioned: true,
      lifecycleRules: [{
        abortIncompleteMultipartUploadAfter: cdk.Duration.days(1),
        noncurrentVersionExpiration: cdk.Duration.days(1),
      }]
    });

    const fn = new lambda.Function(this, 'Function', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'lambda_function.lambda_handler',
      code: lambda.Code.fromInline('print("placeholder")'),
      environment: {
        "TABLE_NAME": props.table.tableName,
        "BUCKET_NAME": artBucket.bucketName,
        "USER_POOL_ID": props.userPool.userPoolId,
        "SES_CONFIGURATION_SET": configurationSet.configurationSetName,
        "SES_FROM_EMAIL": fromEmail.stringValue,
      },
    });
    fn.addEventSource(new sources.SqsEventSource(props.queue, {
      maxBatchingWindow: cdk.Duration.seconds(5),
      reportBatchItemFailures: true,
      maxConcurrency: 2,
    }));
    props.queue.grantConsumeMessages(fn);
    props.table.grantReadWriteData(fn);
    artBucket.grantRead(fn);
    artBucket.grantPut(fn);
    fn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminGetUser',
        // 'cognito-idp:ListUsers',
      ],
      resources: [props.userPool.userPoolArn],
    }));
    fn.addToRolePolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'ses:SendEmail',
        'ses:SendRawEmail',
      ],
      resources: ['*'], // TODO: Figure out how this can be made more restrictive
    }));

    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineType: codepipeline.PipelineType.V2
    });

    const infrastructureBranch = ssm.StringParameter.fromStringParameterName(this, 'ParamInfrastructureBranch', '/let-them-draw/infrastructure-branch');
    const githubConnectionArn = ssm.StringParameter.fromStringParameterName(this, 'ParamGithubConnectionArn', '/let-them-draw/github-connection-arn');
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: 'GitHub_Source',
      owner: 'danielwohlgemuth',
      repo: 'let-them-draw-artist',
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
      actions: ['lambda:UpdateFunctionCode'],
      resources: [fn.functionArn]
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
                `aws lambda update-function-code --function-name ${fn.functionName} --zip-file fileb://lambda.zip`,
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
  }
}
