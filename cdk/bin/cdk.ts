#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { AwsPipelineStack } from '../lib/aws-pipeline-stack';
import { ReceptionistPipelineStack } from '../lib/receptionist-pipeline-stack';

const app = new cdk.App();

cdk.Tags.of(app).add('Project', 'Let Them Draw');

new DatabaseStack(app, 'DatabaseStack', {});
new AwsPipelineStack(app, 'AwsPipelineStack', {});
const receptionistPipelineStack = new ReceptionistPipelineStack(app, 'ReceptionistPipelineStack', {});