#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { CoinCapFirehoseS3RdsStack } from '../lib/coin_cap-firehose-s3-rds-stack';

const app = new cdk.App();
new CoinCapFirehoseS3RdsStack(app, 'CoinCapFirehoseS3RdsStack');
