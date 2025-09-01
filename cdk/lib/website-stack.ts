import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as apigwv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';
import * as codepipeline_actions from 'aws-cdk-lib/aws-codepipeline-actions';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';
import * as ssm from 'aws-cdk-lib/aws-ssm';

interface WebsiteStackProps extends cdk.StackProps {
  httpApi: apigwv2.HttpApi;
}

export class WebsiteStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: WebsiteStackProps) {
    super(scope, id, props);

    const bucket = new s3.Bucket(this, 'Bucket', {
        websiteIndexDocument: 'index.html',
        websiteErrorDocument: 'index.html',
        removalPolicy: cdk.RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
    });

    const distribution = new cloudfront.Distribution(this, 'Distribution', {
        defaultBehavior: {
            origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
            viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
            allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD,
            cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
            originRequestPolicy: cloudfront.OriginRequestPolicy.CORS_S3_ORIGIN,
        },
        additionalBehaviors: {
            '/api/*': {
                origin: new origins.HttpOrigin(
                  props.httpApi.url
                    ?.replace(/^https?:\/\//, '')
                    .replace(/\/$/, '')!
                ),
                viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowedMethods: cloudfront.AllowedMethods.ALLOW_ALL,
                cachePolicy: cloudfront.CachePolicy.CACHING_DISABLED,
                originRequestPolicy: cloudfront.OriginRequestPolicy.ALL_VIEWER_EXCEPT_HOST_HEADER
            }
        },
        errorResponses: [
            {
                httpStatus: 403,
                responseHttpStatus: 200,
                responsePagePath: '/index.html'
            },
            {
                httpStatus: 404,
                responseHttpStatus: 200,
                responsePagePath: '/index.html'
            }
        ],
        defaultRootObject: 'index.html',
        priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
    });

    const pipeline = new codepipeline.Pipeline(this, 'Pipeline', {
        pipelineType: codepipeline.PipelineType.V2,
    });

    const infrastructureBranch = ssm.StringParameter.fromStringParameterName(this, 'ParamInfrastructureBranch', '/let-them-draw/infrastructure-branch');
    const githubConnectionArn = ssm.StringParameter.fromStringParameterName(this, 'ParamGithubConnectionArn', '/let-them-draw/github-connection-arn');
    const sourceOutput = new codepipeline.Artifact();
    const sourceAction = new codepipeline_actions.CodeStarConnectionsSourceAction({
      actionName: 'GitHub_Source',
      owner: 'danielwohlgemuth',
      repo: 'let-them-draw-website',
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
        }]
      }
    });

    const buildOutput = new codepipeline.Artifact();
    pipeline.addStage({
        stageName: 'Build',
        actions: [
            new codepipeline_actions.CodeBuildAction({
                actionName: 'Build',
                input: sourceOutput,
                outputs: [buildOutput],
                project: new  codebuild.Project(this, 'Project', {
                    buildSpec: codebuild.BuildSpec.fromObject({
                        'version': '0.2',
                        'phases': {
                            'install': {
                                'commands': [
                                    'npm install'
                                ]
                            },
                            'build': {
                                'commands': [
                                    'npm run build'
                                ]
                            }
                        },
                        'artifacts': {
                            'base-directory': 'out',
                            'files': ['**/*']
                        }
                    })
                })
            }),
        ]
    });

    pipeline.addStage({
        stageName: 'Deploy',
        actions: [
            new codepipeline_actions.S3DeployAction({
                actionName: 'Deploy',
                input: buildOutput,
                bucket: bucket
            })
        ]
    });
  }
}
