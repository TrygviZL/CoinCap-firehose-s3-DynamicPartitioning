import * as cdk from '@aws-cdk/core'
import * as s3 from '@aws-cdk/aws-s3'
import * as lambdanodejs from '@aws-cdk/aws-lambda-nodejs'
import * as lambda from '@aws-cdk/aws-lambda'
import { CfnDeliveryStream } from '@aws-cdk/aws-kinesisfirehose'
import * as iam from '@aws-cdk/aws-iam'
import * as targets from '@aws-cdk/aws-events-targets'
import * as events from '@aws-cdk/aws-events'

export class CoinCapFirehoseS3RdsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const coinCapBucket = new s3.Bucket(this, 'coinCapBucket')

    // We are using Cfn L1 construct for delivery stream, so we need to explicitly define the 
    // policy and role that firehose can assume to write s3
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
        prefix: 'Topic=!{partitionKeyFromQuery:Topic}/!{timestamp:yyyy/MM/dd}/',
        errorOutputPrefix: 'error/!{firehose:error-output-type}/',
        bufferingHints: {
          intervalInSeconds: 60,
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
                  parameterValue: '{Topic: .data.id}',
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

    const fetchData = new lambdanodejs.NodejsFunction(this, 'fetchData',{
      runtime: lambda.Runtime.NODEJS_14_X,
      environment: {
        DELIVERYSTREAM_NAME: coinCapDeliveryStream.deliveryStreamName!
      },
      role: lambdaToFirehoseRole
    })

    const eventRule = new events.Rule(this, 'fetchDataScheduleRule', {
      schedule: events.Schedule.cron({ minute: '/1'}),
    });
    eventRule.addTarget(new targets.LambdaFunction(fetchData))

  }
}
