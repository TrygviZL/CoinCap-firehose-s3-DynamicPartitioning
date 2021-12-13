import * as aws from 'aws-sdk'
import * as https from 'https'
import * as path from 'path'
import * as dotenv from 'dotenv'

dotenv.config({ path: path.join(__dirname, '../.env' ) })

interface httpsoptions {
  hostname: string
  path: string
  method: string
  protocol: string
}

interface coinCapResponseSigleId {
  exchangeId: string
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

const getApiData = async(options: httpsoptions): Promise<coinCapResponse> => {
  return new Promise((resolve) => {
    https.request(options, res => {
      let data: any = []
      res.on('data', chunk => {
        data.push(chunk)
      })
      res.on('end', () => {
        data = Buffer.concat(data).toString()
        resolve(JSON.parse(data))
      })
    }).end()
  })
}

const options = {
  protocol: 'https:',
  hostname: 'api.coincap.io',
  path: '/v2/exchanges/',
  method: 'GET',
  headers: {
    'Authorization': process.env.API_KEY,
  },
}

export const handler = async(event: any) => {
  console.log('request:', JSON.stringify(event, undefined, 2))
  
  try {
    const response = await getApiData(options)
    
    console.log('response:', response)
    console.log(process.env.API_KEY)
    response.data.forEach(exchange => {
      const params = {
        DeliveryStreamName: process.env.DELIVERYSTREAM_NAME!,
        Record: {
          Data: exchange,
        },
      }

      deliveryStream.putRecord(params)
    })

  } catch (error) {
    console.error(error)
  }
}

