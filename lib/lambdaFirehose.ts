import * as cdk from '@aws-cdk/core'
import * as s3 from '@aws-cdk/aws-s3'
import * as iam from '@aws-cdk/aws-iam'
import * as lambdanodejs from '@aws-cdk/aws-lambda-nodejs'
import * as lambda from '@aws-cdk/aws-lambda'
import { CfnDeliveryStream } from '@aws-cdk/aws-kinesisfirehose'
import * as targets from '@aws-cdk/aws-events-targets'
import * as events from '@aws-cdk/aws-events'

export interface lambdaFirehoseProps {
  readonly rawBucket: s3.IBucket
  readonly endpoint: string
  readonly lambda: string
}

export class lamdbaFirehose extends cdk.Construct {
  private props: lambdaFirehoseProps

  constructor(scope: cdk.Construct, id: string, props: lambdaFirehoseProps) {
    super(scope, id)

    this.props = props

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
            props.rawBucket.bucketArn + '/*',
          ],
        }),
        new iam.PolicyStatement({
          actions: [
            's3:ListBucket',
          ],
          resources: [
            props.rawBucket.bucketArn,
          ],
        }),
      ],
    })
    
    deliveryStreamPolicy.attachToRole(deliveryStreamRole)

    // set jq statement which partitions data on s3
    let JQ = ''
    if (props.endpoint == 'assets') {
      JQ = '{partition: .id}'
    } else {
      JQ = '{partition: .exchangeId}'
    }

    const coinCapDeliveryStream = new CfnDeliveryStream(this, 'coinCapDeliveryStream' + props.endpoint, {
      deliveryStreamName: 'coinCapDelivery' + props.endpoint,
      extendedS3DestinationConfiguration: {
        bucketArn: props.rawBucket.bucketArn,
        roleArn: deliveryStreamRole.roleArn,
        prefix: props.endpoint + '/partition=!{partitionKeyFromQuery:partition}/!{timestamp:yyyy/MM/dd}/',
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
                  parameterValue: JQ,
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

    const fetchData = new lambdanodejs.NodejsFunction(this, props.lambda, {
      runtime: lambda.Runtime.NODEJS_14_X,
      environment: {
        // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
        DELIVERYSTREAM_NAME: coinCapDeliveryStream.deliveryStreamName!,
      },
      role: lambdaToFirehoseRole,
    })

    const eventRule = new events.Rule(this, 'fetchDataScheduleRule', {
      schedule: events.Schedule.cron({ minute: '/1' }),
    })
    eventRule.addTarget(new targets.LambdaFunction(fetchData))

  }
}
