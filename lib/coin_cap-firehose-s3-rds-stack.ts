import * as cdk from '@aws-cdk/core'
import * as s3 from '@aws-cdk/aws-s3'
import * as lambdanodejs from '@aws-cdk/aws-lambda-nodejs'
import * as lambda from '@aws-cdk/aws-lambda'
import { CfnDeliveryStream } from '@aws-cdk/aws-kinesisfirehose'
import * as iam from '@aws-cdk/aws-iam'
import * as targets from '@aws-cdk/aws-events-targets'
import * as events from '@aws-cdk/aws-events'
import * as glue from '@aws-cdk/aws-glue'

export class CoinCapFirehoseS3RdsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props)

    const coinCapBucket = new s3.Bucket(this, 'coinCapBucket')

    const deliveryStreamRole = new iam.Role(this, 'deliveryStreamRole', {
      assumedBy: new iam.ServicePrincipal('firehose.amazonaws.com'),
    })

    const deliveryStreamPolicy = new iam.Policy(this, 'deliveryStreamPolicy', {
      statements: [
        new iam.PolicyStatement({
          actions: [
            's3:PutObject',
          ],
          resources: [
            coinCapBucket.bucketArn + '/*',
          ],
        }),
        new iam.PolicyStatement({
          actions: [
            's3:ListBucket',
          ],
          resources: [
            coinCapBucket.bucketArn,
          ],
        }),
      ],
    })
    
    deliveryStreamPolicy.attachToRole(deliveryStreamRole)

    const coinCapDeliveryStream = new CfnDeliveryStream(this, 'coinCapDeliveryStream', {
      deliveryStreamName: 'coinCapDeliveryStream',
      extendedS3DestinationConfiguration: {
        bucketArn: coinCapBucket.bucketArn,
        roleArn: deliveryStreamRole.roleArn,
        prefix: 'exchange=!{partitionKeyFromQuery:exchange}/!{timestamp:yyyy/MM/dd}/',
        errorOutputPrefix: 'error/!{firehose:error-output-type}/',
        bufferingHints: {
          intervalInSeconds: 900,
        },
        dynamicPartitioningConfiguration: {
          enabled: true,
        },
        processingConfiguration: {
          enabled: true,
          processors: [
            {
              type: 'MetadataExtraction',
              parameters: [
                {
                  parameterName: 'MetadataExtractionQuery',
                  parameterValue: '{exchange: .exchangeId}',
                },
                {
                  parameterName: 'JsonParsingEngine',
                  parameterValue: 'JQ-1.6',
                },
              ],
            },
            {
              type: 'AppendDelimiterToRecord',
              parameters: [
                {
                  parameterName: 'Delimiter',
                  parameterValue: '\\n',
                },
              ],
            },
          ],
        },
      },
    })

    const lambdaToFirehoseRole = new iam.Role(this, 'lambdaToFirehoseRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
      ],
    })

    // verbose role which allows iot-core to write to kinesis firehose delivery stream
    const lambdaToFirehosePolicy = new iam.Policy(this, 'lambdaToFirehosePolicy', {
      statements: [new iam.PolicyStatement({
        actions: [
          'firehose:PutRecord',
        ],
        resources: [coinCapDeliveryStream.attrArn],
      })], 
    })
  
    lambdaToFirehosePolicy.attachToRole(lambdaToFirehoseRole)
  

    const fetchData = new lambdanodejs.NodejsFunction(this, 'fetchData', {
      runtime: lambda.Runtime.NODEJS_14_X,
      environment: {
        DELIVERYSTREAM_NAME: coinCapDeliveryStream.deliveryStreamName!,
      },
      role: lambdaToFirehoseRole,
    })

    const eventRule = new events.Rule(this, 'fetchDataScheduleRule', {
      schedule: events.Schedule.cron({ minute: '/1' }),
    })
    eventRule.addTarget(new targets.LambdaFunction(fetchData))

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
