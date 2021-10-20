import consola from "consola";

import {getOffer} from "./models/offersModel";
import {reCalculateOffer} from "./models/offersCapsModel";
import {getCampaign} from "./models/campaignsModel";

import AWS from 'aws-sdk'
import * as dotenv from "dotenv";
import {influxdb} from "./metrics";
import {IOffer} from "./interfaces/offers";
import {ICampaign} from "./interfaces/campaigns";
import {ISqsMessage} from "./interfaces/sqsMessage";

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

let sqs = new AWS.SQS()

const queueUrl: string = process.env.AWS_SQS_QUEUE_URL || ''
// consola.info(`queueUrl:${queueUrl}`)
export const sqsProcess = async () => {

  try {
    let dataQueue = await receiveMessage()
    if (!dataQueue?.Messages) {
      return
    }
    let messages = []
    for (const message of dataQueue.Messages) {

      let messageBody = JSON.parse(message.Body!)
      //  TODO move this logic to right place
      const projectName = messageBody?.project || ''
      if (messageBody.type === 'offer' && messageBody.action === 'updateOrCreate') {
        let offer: IOffer = await getOffer(messageBody.id)
        let reCalculatedOffer: IOffer | any[] = await reCalculateOffer(offer)
        let generateOfferBody: ISqsMessage = {
          comments: messageBody.comments,
          type: "offer",
          id: messageBody.id,
          action: messageBody.action,
          timestamp: Date.now(),
          body: `${JSON.stringify(reCalculatedOffer)}`
        }

        // messages.push(JSON.parse(generateOfferBody))
        influxdb(200, `sqs_offer_update_or_create_${projectName}`)
        messages.push(generateOfferBody)
      } else if (messageBody.type === 'campaign' && messageBody.action === 'updateOrCreate') {
        let campaignInfo: ICampaign = await getCampaign(messageBody.id)
        let generateCampaignBody: ISqsMessage = {
          comments: messageBody.comments,
          type: "campaign",
          id: messageBody.id,
          action: messageBody.action,
          timestamp: Date.now(),
          body: `${JSON.stringify(campaignInfo)}`
        }
        influxdb(200, `sqs_campaign_update_or_create_${projectName}`)
        messages.push(generateCampaignBody)
      } else {
        influxdb(200, `sqs_offer_campaign_delete`)
        messages.push(messageBody)
      }

      await deleteMessage(message.ReceiptHandle!)
    }
    return messages
  } catch (e) {
    influxdb(500, `sqs_receive_message_error`)
    consola.error('receiveMessageError:', e)
  }

}

const receiveMessage = async () => {
  return sqs.receiveMessage({
    QueueUrl: queueUrl,
    AttributeNames: ['All'],
    MaxNumberOfMessages: 10,
    VisibilityTimeout: 10,
    WaitTimeSeconds: 20
  }).promise()
    .then(data => {
      return data
    })
    .catch(err => {
      influxdb(500, `sqs_receive_message_error`)
      consola.error(`Error while fetching messages from the sqs queue:${queueUrl}`, err)
    })
}

const deleteMessage = async (messageId: string) => {

  let params = {
    QueueUrl: queueUrl,
    ReceiptHandle: messageId
  }
  return sqs.deleteMessage(params)
    .promise()
    .then(data => {
      // consola.info(' \n Successfully deleted message with ReceiptHandle', data)
      return data
    })
    .catch(err => {
      influxdb(500, `sqs_delete_message_error`)
      consola.error(`Error delete messages from the sqs queue:${queueUrl}`, err)
    })

}
