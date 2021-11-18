import consola from "consola";

import {getOffer} from "./models/offersModel";
import {reCalculateOffer} from "./services/offersCaps";
import {getCampaign} from "./models/campaignsModel";
import {reCalculateCampaignCaps} from "./services/campaignsCaps";

import AWS from 'aws-sdk'
import * as dotenv from "dotenv";
import {influxdb} from "./metrics";
import {IOffer} from "./interfaces/offers";
import {ICampaign} from "./interfaces/campaigns";
import {ISqsMessage} from "./interfaces/sqsMessage";
import {recalculateRecipe} from "./services/recalculateRecipe";

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
      return []
    }
    let messages = []
    for (const message of dataQueue.Messages) {
      const messagesUpd = await recalculateRecipe(message)
      for (const messageUpd of messagesUpd) {
        messages.push(messageUpd)
      }
    }
    return messages
  } catch (e) {
    influxdb(500, `sqs_receive_message_error`)
    consola.error('receiveMessageError:', e)
    return []
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

export const deleteMessage = async (messageId: string) => {

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
