#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DatabaseStack } from '../lib/database-stack';
import { QueueStack } from '../lib/queue-stack';
import { AwsPipelineStack } from '../lib/aws-pipeline-stack';
import { ReceptionistStack } from '../lib/receptionist-stack';
import { WebsiteStack } from '../lib/website-stack';
import { ArtistStack } from '../lib/artist-stack';

const app = new cdk.App();

cdk.Tags.of(app).add('Project', 'Let Them Draw');

const databaseStack = new DatabaseStack(app, 'DatabaseStack3', {});
const queueStack = new QueueStack(app, 'QueueStack', {});
new AwsPipelineStack(app, 'AwsPipelineStack', {});
const receptionistStack = new ReceptionistStack(app, 'ReceptionistStack', { table: databaseStack.table, queue: queueStack.queue });
const websiteStack = new WebsiteStack(app, 'WebsiteStack', { httpApi: receptionistStack.httpApi });
new ArtistStack(app, 'ArtistStack', {
    table: databaseStack.table,
    queue: queueStack.queue,
    userPool: websiteStack.userPool
});