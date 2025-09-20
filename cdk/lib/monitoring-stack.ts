import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as subs from 'aws-cdk-lib/aws-sns-subscriptions';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as codepipeline from 'aws-cdk-lib/aws-codepipeline';

interface MonitoringStackProps extends cdk.StackProps {
  deadLetterQueue: sqs.Queue;
  artistPipeline: codepipeline.Pipeline;
  receptionistPipeline: codepipeline.Pipeline;
  websitePipeline: codepipeline.Pipeline;
  awsPipeline: codepipeline.Pipeline;
}

export class MonitoringStack extends cdk.Stack {

  constructor(scope: Construct, id: string, props: MonitoringStackProps) {
    super(scope, id, props);

        const environment = ssm.StringParameter.fromStringParameterName(this, 'EnvironmentParam', '/let-them-draw/environment');
        cdk.Tags.of(this).add('Environment', environment.stringValue);

    const pipelineFailureTopic = new sns.Topic(this, 'PipelineFailureTopic', {
      displayName: 'Pipeline Failure Notifications',
    });

    const fromEmail = ssm.StringParameter.fromStringParameterName(this, 'FromEmailParam', '/let-them-draw/from-email');
    pipelineFailureTopic.addSubscription(
      new subs.EmailSubscription(fromEmail.stringValue),
    );

    const pipelineFailureRule = new events.Rule(this, 'PipelineFailureRule', {
      description: 'Notify on CodePipeline execution failures',
      eventPattern: {
        source: ['aws.codepipeline'],
        detailType: ['CodePipeline Pipeline Execution State Change'],
        detail: {
          pipeline: [
            props.artistPipeline.pipelineName,
            props.receptionistPipeline.pipelineName,
            props.websitePipeline.pipelineName,
            props.awsPipeline.pipelineName,
          ],
          state: ['FAILED']
        },
      },
    });

    pipelineFailureRule.addTarget(new targets.SnsTopic(pipelineFailureTopic));

    const dlqAlertTopic = new sns.Topic(this, 'DlqAlertTopic', {
      displayName: 'DLQ Alert Notifications',
    });

    dlqAlertTopic.addSubscription(
      new subs.EmailSubscription(fromEmail.stringValue),
    );

    const dlqMetric = props.deadLetterQueue.metricApproximateNumberOfMessagesVisible({
      period: cdk.Duration.minutes(15),
    });

    new cloudwatch.Alarm(this, 'DlqAlarm', {
      metric: dlqMetric,
      threshold: 1,
      evaluationPeriods: 1,
      datapointsToAlarm: 1,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
      alarmDescription: 'Triggers if there is at least one message in the DLQ',
    }).addAlarmAction({
      bind: () => ({ alarmActionArn: dlqAlertTopic.topicArn }),
    });
  }
}
