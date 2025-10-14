#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../lib/data-stack';
import { AwsPipelineStack } from '../lib/aws-pipeline-stack';
import { AuthStack } from '../lib/auth-stack';
import { ReceptionistStack } from '../lib/receptionist-stack';
import { WebsiteStack } from '../lib/website-stack';
import { ArtistStack } from '../lib/artist-stack';
import { MonitoringStack } from '../lib/monitoring-stack';

const app = new cdk.App();

cdk.Tags.of(app).add('Project', 'Let Them Draw');

const dataStack = new DataStack(app, 'DataStack', {});
const awsPipelineStack = new AwsPipelineStack(app, 'AwsPipelineStack', {});
const authStack = new AuthStack(app, 'AuthStack', {});
const receptionistStack = new ReceptionistStack(app, 'ReceptionistStack', {
    userPool: authStack.userPool,
    table: dataStack.table,
    shapesTable: dataStack.shapesTable,
    queue: dataStack.queue,
    artBucket: dataStack.artBucket,
});
const websiteStack = new WebsiteStack(app, 'WebsiteStack', {
    userPool: authStack.userPool,
    userPoolClient: authStack.userPoolClient,
    receptionistFunction: receptionistStack.function
});
const artistStack = new ArtistStack(app, 'ArtistStack', {
    table: dataStack.table,
    artBucket: dataStack.artBucket,
    queue: dataStack.queue,
    userPool: authStack.userPool,
    distribution: websiteStack.distribution
});
new MonitoringStack(app, 'MonitoringStack', {
    deadLetterQueue: dataStack.deadLetterQueue,
    artistPipeline: artistStack.pipeline,
    receptionistPipeline: receptionistStack.pipeline,
    websitePipeline: websiteStack.pipeline,
    awsPipeline: awsPipelineStack.pipeline,
});