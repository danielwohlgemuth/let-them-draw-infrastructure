#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { AwsPipelineStack } from '../lib/aws-pipeline-stack';
import { ReceptionistStack } from '../lib/receptionist-stack';

const app = new cdk.App();

cdk.Tags.of(app).add('Project', 'Let Them Draw');

const databaseStack = new DatabaseStack(app, 'DatabaseStack3', {});
new AwsPipelineStack(app, 'AwsPipelineStack', {});
new ReceptionistStack(app, 'ReceptionistStack', { table: databaseStack.table });