#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../lib/data-stack';
import { AwsPipelineStack } from '../lib/aws-pipeline-stack';
import { ReceptionistStack } from '../lib/receptionist-stack';
import { WebsiteStack } from '../lib/website-stack';
import { ArtistStack } from '../lib/artist-stack';
import { MonitoringStack } from '../lib/monitoring-stack';
import { PlaceholderStack } from '../lib/placeholder-stack';

const app = new cdk.App();

cdk.Tags.of(app).add('Project', 'Let Them Draw');

const dataStack = new DataStack(app, 'DataStack', {});
const awsPipelineStack = new AwsPipelineStack(app, 'AwsPipelineStack', {});
const receptionistStack = new ReceptionistStack(app, 'ReceptionistStack', {
    table: dataStack.table,
    shapesTable: dataStack.shapesTable,
    shapesTable2: dataStack.shapesTable2,
    queue: dataStack.queue,
    artBucket: dataStack.artBucket,
});
const websiteStack = new WebsiteStack(app, 'WebsiteStack', {
    receptionistFunction: receptionistStack.function
});
const artistStack = new ArtistStack(app, 'ArtistStack', {
    table: dataStack.table,
    artBucket: dataStack.artBucket,
    queue: dataStack.queue,
    userPool: websiteStack.userPool,
    distribution: websiteStack.distribution
});
new MonitoringStack(app, 'MonitoringStack', {
    deadLetterQueue: dataStack.deadLetterQueue,
    artistPipeline: artistStack.pipeline,
    receptionistPipeline: receptionistStack.pipeline,
    websitePipeline: websiteStack.pipeline,
    awsPipeline: awsPipelineStack.pipeline,
});
new PlaceholderStack(app, 'PlaceholderStack', {
   table: dataStack.shapesTable
});