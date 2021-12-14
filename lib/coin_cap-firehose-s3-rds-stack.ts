import * as cdk from '@aws-cdk/core'
import * as s3 from '@aws-cdk/aws-s3'
import * as iam from '@aws-cdk/aws-iam'
import * as glue from '@aws-cdk/aws-glue'
import { lamdbaFirehose } from './lambdaFirehose'
import * as path from 'path'

export class CoinCapFirehoseS3RdsStack extends cdk.Stack {
  public readonly LamdbaFirehose: lamdbaFirehose

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const coinCapBucket = new s3.Bucket(this, 'coinCapBucket')

    // Construct which contains lambda, firehose and all permissions for these
    new lamdbaFirehose(this, 'LamdbaFirehoseExchange', {
      rawBucket: coinCapBucket,
      endpoint: 'exchange',
      lambda: 'fetchDataExchange',
    })

    new lamdbaFirehose(this, 'LamdbaFirehoseAssets', {
      rawBucket: coinCapBucket,
      endpoint: 'assets',
      lambda: 'fetchDataAssets',
    })

    const rawdb = new glue.Database(this, 'coinCapRaw', {
      databaseName: 'coincapraw',
    })
    
    const crawlerRole = new iam.Role(this, 'crawlerRole', {
      assumedBy: new iam.ServicePrincipal('glue.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSGlueServiceRole'),
        iam.ManagedPolicy.fromAwsManagedPolicyName('AmazonS3FullAccess'),
      ],
    })

    const rawCrawlerExchanges = new glue.CfnCrawler(this, 'rawCrawlerExchanges', {
      targets: {
        s3Targets: [{ path: 's3://' + coinCapBucket.bucketName + '/exchange' }],
      },
      role: crawlerRole.roleArn,
      databaseName: 'coincapraw',
      name: 'rawCrawlerExchanges',
    })
    new glue.CfnTrigger(this, 'glueTriggerExchanges', {
      name: 'glueCrawlerTriggerExchanges',
      schedule: 'cron(*/15 * * * ? *)',
      type: 'SCHEDULED',
      actions: [{
        crawlerName: rawCrawlerExchanges.name,
      }],
      startOnCreation: true,
    })
    
    const rawCrawlerAssets = new glue.CfnCrawler(this, 'rawCrawlerAssets', {
      targets: {
        s3Targets: [{ path: 's3://' + coinCapBucket.bucketName + '/assets' }],
      },
      role: crawlerRole.roleArn,
      databaseName: 'coincapraw',
      name: 'rawCrawlerAssets',
    })
    new glue.CfnTrigger(this, 'glueTriggerAssets', {
      name: 'glueCrawlerTriggerAssets',
      schedule: 'cron(*/15 * * * ? *)',
      type: 'SCHEDULED',
      actions: [{
        crawlerName: rawCrawlerAssets.name,
      }],
      startOnCreation: true,
    })
  }
}
