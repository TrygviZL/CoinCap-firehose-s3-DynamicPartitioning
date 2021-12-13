import * as cdk from '@aws-cdk/core'
import * as s3 from '@aws-cdk/aws-s3'
import * as lambdanodejs from '@aws-cdk/aws-lambda-nodejs'
import * as destinations from '@aws-cdk/aws-kinesisfirehose-destinations'
import * as lambda from '@aws-cdk/aws-lambda'
import * as kinesis from '@aws-cdk/aws-kinesisfirehose';

export class CoinCapFirehoseS3RdsStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    const coinCapBucket = new s3.Bucket(this, 'coinCapBucket')

    const s3destination = new destinations.S3Bucket(coinCapBucket, {
      dataOutputPrefix: `${id}` + 'data/year=!{timestamp:yyyy}/month=!{timestamp:MM}/day=!{timestamp:dd}/',
      errorOutputPrefix: `${id}` + 'dataError/!{firehose:error-output-type}/year=!{timestamp:yyyy}/month=!{timestamp:mm}/day=!{timestamp:dd}/',
      bufferingInterval: cdk.Duration.minutes(5),
      /*compression: destinations.Compression.SNAPPY*/   
    })

    const DeliveryStream = new kinesis.DeliveryStream(this, 'coinCapStream', {
      destinations: [s3destination],
    })

    const fetchProcessData = new lambdanodejs.NodejsFunction(this, 'DataLambda',{
      runtime: lambda.Runtime.NODEJS_14_X,
      environment: {
        DELIVERYSTREAM_NAME: DeliveryStream.deliveryStreamName
      }
    })

  }
}
