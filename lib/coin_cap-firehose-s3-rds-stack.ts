import * as cdk from '@aws-cdk/core'
import * as s3 from '@aws-cdk/aws-s3'
import * as lambdanodejs from '@aws-cdk/aws-lambda-nodejs'
import * as lambda from '@aws-cdk/aws-lambda'
import { CfnDeliveryStream } from '@aws-cdk/aws-kinesisfirehose'
import * as iam from '@aws-cdk/aws-iam'
import * as targets from '@aws-cdk/aws-events-targets'
import * as events from '@aws-cdk/aws-events'
import * as glue from '@aws-cdk/aws-glue'
import { lamdbaFirehoseCoin } from './lambdaFirehoseExchange'

export class CoinCapFirehoseS3RdsStack extends cdk.Stack {
  public readonly LamdbaFirehoseCoin: lamdbaFirehoseCoin

  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const coinCapBucket = new s3.Bucket(this, 'coinCapBucket')

    new LamdbaFirehoseCoin(this, 'LamdbaFirehoseCoin', {
      rawBucket: coinCapBucket,
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

    const rawCrawler = new glue.CfnCrawler(this, 'rawCrawler', {
      targets: {
        s3Targets: [{ path: 's3://' + coinCapBucket.bucketName }],
      },
      role: crawlerRole.roleArn,
      databaseName: 'coincapraw',
    })

    new glue.CfnTrigger(this, 'glueTrigger', {
      name: 'glueCrawlerTrigger',
      schedule: 'cron(*/15 * * * ? *)',
      type: 'SCHEDULED',
      actions: [{
        crawlerName: 'rawCrawler-HfQuVh9toKnP',
      }],
      startOnCreation: true,
    })
  }
}
