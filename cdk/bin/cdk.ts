#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { AwsPipelineStack } from '../lib/aws-pipeline-stack';
import { ReceptionistStack } from '../lib/receptionist-stack';

const app = new cdk.App();

cdk.Tags.of(app).add('Project', 'Let Them Draw');

new DatabaseStack(app, 'DatabaseStack', {});
new AwsPipelineStack(app, 'AwsPipelineStack', {});
new ReceptionistStack(app, 'ReceptionistStack', {});