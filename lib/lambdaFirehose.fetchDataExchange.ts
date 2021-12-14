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

interface coinCapResponseSigleExchange {
  exchangeId: string
  name: string
  rank: string
  percentTotalVolume: string
  volumeUsd: string
  traidingPairs: string
  socket: string
  exchangeUrl: string
  updated: string
}

interface coinCapResponseExchanges {
  data: coinCapResponseSigleExchange[]
}

const deliveryStream = new aws.Firehose()

const getApiData = async(options: httpsoptions): Promise<coinCapResponseExchanges> => {
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
  path: '/v2/exchanges/',
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

  response.data.forEach(exchange => {
    const params = {
      // eslint-disable-next-line  @typescript-eslint/no-non-null-assertion
      DeliveryStreamName: process.env.DELIVERYSTREAM_NAME!,
      Record: {
        Data: JSON.stringify(exchange),
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
