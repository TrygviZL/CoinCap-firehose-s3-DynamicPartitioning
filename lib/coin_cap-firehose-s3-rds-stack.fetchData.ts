import * as aws from 'aws-sdk'
import * as https from 'https'

interface httpsoptions {
  hostname: string
  path: string
  method: string
}

interface coinCapResponseSigleId {
  id: string
  rank: string
  symbol: string
  name: string
  supply: string
  maxSupply: string
  marketCapkUsd: string
  volumeUsd24Hr: string
  priceUsd: string
  changePercent24Hr: string
  vwap24Hr: string
}

interface coinCapResponse {
  data: coinCapResponseSigleId[]
}

const deliveryStream = new aws.Firehose()

const getApiData = async(options:httpsoptions): Promise<coinCapResponse> => {
  return new Promise((resolve) => {
    https.request(options, res => {
      let data:any = []
      res.on("data", chunk => {
        data.push(chunk)
      })
      res.on("end",() => {
        data = Buffer.concat(data).toString()
        resolve(data)
      })
    }).end()
  })
}

const options = {
  hostname: 'https://api.coincap.io',
  path: '/v2/exchanges/',
  method: 'GET',
}

export const handler = async(event:any) => {
  console.log("request:", JSON.stringify(event, undefined, 2));
  
  try {
  const response = await getApiData(options)

  var params = {
    DeliveryStreamName: process.env.DELIVERYSTREAM_NAME!,
    Record: { 
      Data: response.data
    }
  }
  deliveryStream.putRecord(params)

  } catch (error) {
    console.error(error)
  }
}
