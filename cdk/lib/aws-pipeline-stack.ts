import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as ssm from 'aws-cdk-lib/aws-ssm';

export class AwsPipelineStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const environment = ssm.StringParameter.fromStringParameterName(this, 'Param', '/let-them-draw/environment');
    cdk.Tags.of(this).add('Environment', environment.stringValue);

    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
      pipelineType: codepipeline.PipelineType.V2
    });

    const infrastructureBranch = ssm.StringParameter.fromStringParameterName(this, 'ParamInfrastructureBranch', '/let-them-draw/infrastructure-branch');
    const githubConnectionArn = ssm.StringParameter.fromStringParameterName(this, 'ParamGithubConnectionArn', '/let-them-draw/github-connection-arn');
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: 'GitHub_Source',
      owner: 'danielwohlgemuth',
      repo: 'let-them-draw-infrastructure',
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
            'cdk/*',
            'cdk/**/*',
          ]
        }]
      }
    });

    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('codebuild.amazonaws.com')
    });
    role.addManagedPolicy(iam.ManagedPolicy.fromAwsManagedPolicyName('AWSCloudFormationFullAccess'));

    const deployAction = new codepipeline_actions.CodeBuildAction({
      actionName: 'DeployStacks',
      project: new codebuild.PipelineProject(this, 'DeployProject', {
        buildSpec: codebuild.BuildSpec.fromObject({
          version: '0.2',
          phases: {
            install: {
              commands: [
                'cd cdk',
                'npm install'
              ]
            },
            build: {
              commands: [
                'npx cdk deploy --all --require-approval never'
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
