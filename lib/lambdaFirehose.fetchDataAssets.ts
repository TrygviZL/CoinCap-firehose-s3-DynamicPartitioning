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

interface coinCapResponseSigleAsset {
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

interface coinCapResponseAsset {
  data: coinCapResponseSigleAsset[]
  timestamp: string
}

const deliveryStream = new aws.Firehose()

const getApiData = async(options: httpsoptions): Promise<coinCapResponseAsset> => {
  return new Promise((resolve) => {
    https.request(options, res => {
      // eslint-disable-next-line  @typescript-eslint/no-explicit-any
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
  path: '/v2/assets/',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer 84688cf4-660a-4e90-8901-9a19dbee2621',
  },
}

// eslint-disable-next-line  @typescript-eslint/no-explicit-any
export const handler = async(event: any) => {
  console.log('request:', JSON.stringify(event, undefined, 2))
  
  let response
  try {
    response = await getApiData(options)
    console.log('response:', response)
  } catch (error) {
    console.error('Could not get data from API: ' + error)
    return
  }

  const timestamp = response.timestamp

  response.data.forEach(asset => {

    const data = { ...asset, timestamp }
    const params = {
      // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
      DeliveryStreamName: process.env.DELIVERYSTREAM_NAME!,
      Record: {
        Data: JSON.stringify(data),
      },
    }

    return deliveryStream.putRecord(params).promise()
      .then(() => {
        console.log('Record written to stream')
      })
      .catch((err) => {
        console.log(err)
      })
  })
}
