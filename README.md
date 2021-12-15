# CoinCap data meets aws
Cryptocurrency has been the hot topic of conversation the last few years, especially with the popularity and value of Bitcoin. In this project, I am combining my growing interest in cryptocurrency with aws by creating a small CDK centered around the public data source coincap.io.

## CoinCap data
[CoinCap](https://docs.coincap.io/) is a tool for real-time pricing and general availability for cryptocurrencies. The REST api offers accurate data on various asset prices and availabilities. The cap for requesting data is 500 requests per minute of one signs up for an API key which is fast and straight forward.

## Infrastructure overview
The overall infrastructure is build on lambda, kinseis firehose and s3. 
* Lambda functions fetch data from the API and writes it to firehose. A cron trigger is set to collect data every minute.
* Data is buffered in Firehose for 15 minutes before objects are written to s3. In this project, I set Firehose to dynamically partition the data on s3 based on the ID of the incomming messages. This is primarily to improve query price an performance when using tools such as Quicksight and Athena.
* Crawlers are set to crawl the bucket every 15 minutes to keep the metadata fresh

![AWS architecture](/static/dashboard.png)

## Quicksight Dashboard
To visualize the data, I set up an account in the AWS BI tool Quicksight. It is convenient in that it is easy to access data on s3 through athena and supports custom queries to do small transformations on the fly along with typecastings. 
The dashboard consists of an overview table, a barchart and a linechart. The table displays an overview of the various cryptocurrencies with stats such as ranking, supply, price and percent change last 24 hours. The linechart shows the time-series for all the currencies while the barchart shows the distribution of these in the time-span. By clicking on a currency on the table, one can filter by that specific currency which also applies to the line- and barcharts.

![dashboard](/static/dashboard.png)

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
