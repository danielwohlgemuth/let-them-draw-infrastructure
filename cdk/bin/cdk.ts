#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { DataStack } from '../lib/data-stack';
import { AwsPipelineStack } from '../lib/aws-pipeline-stack';
import { ReceptionistStack } from '../lib/receptionist-stack';
import { WebsiteStack } from '../lib/website-stack';
import { ArtistStack } from '../lib/artist-stack';

const app = new cdk.App();

cdk.Tags.of(app).add('Project', 'Let Them Draw');

const dataStack = new DataStack(app, 'DataStack', {});
new AwsPipelineStack(app, 'AwsPipelineStack', {});
const receptionistStack = new ReceptionistStack(app, 'ReceptionistStack', {
    table: dataStack.table,
    queue: dataStack.queue,
    artBucket: dataStack.artBucket,
});
const websiteStack = new WebsiteStack(app, 'WebsiteStack', { httpApi: receptionistStack.httpApi });
new ArtistStack(app, 'ArtistStack', {
    table: dataStack.table,
    artBucket: dataStack.artBucket,
    queue: dataStack.queue,
    userPool: websiteStack.userPool,
    distribution: websiteStack.distribution
});