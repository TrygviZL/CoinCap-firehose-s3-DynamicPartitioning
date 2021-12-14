# CoinCap data meets aws
Cryptocurrency has been the hot topic of conversation the last few years, especially with the popularity and value of Bitcoin. In this project, I am combining my growing interest in cryptocurrency with aws by creating a small CDK centered around the public data source coincap.io.

## CoinCap data
[CoinCap](https://docs.coincap.io/) is a tool for real-time pricing and general availability for cryptocurrencies. The REST api offers accurate data on various asset prices and availabilities. The cap for requesting data is 500 requests per minute of one signs up for an API key which is fast and straight forward.

## Infrastructure overview

![AWS architecture](https://github.com/TrygviZL/CoinCap-firehose-s3-rds/blob/main/static/infrastructure_transparent.png?raw=true)

## Prerequisites
* AWS account
* AWS CDK 
* AWS CLI installed and configured
* Docker

## Useful commands

 * `npm run build`   compile typescript to js
 * `npm run watch`   watch for changes and compile
 * `npm run test`    perform the jest unit tests
 * `cdk deploy`      deploy this stack to your default AWS account/region
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
