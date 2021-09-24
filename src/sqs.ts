import consola from "consola";

import {getOfferCaps} from "./models/offersModel";
import {getCampaign} from "./models/campaignsModel";

import AWS from 'aws-sdk'
import * as dotenv from "dotenv";

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
      if (messageBody.type === 'offer' && messageBody.action === 'updateOrCreate') {
        let offersCaps = await getOfferCaps(messageBody.id)
        let generateOfferBody = {
          comments: "offer handling updateOrCreate",
          type: "offer",
          id: messageBody.id,
          action:  messageBody.action,
          timestamp: Date.now(),
          body: `${JSON.stringify(offersCaps)}`
        }
        // console.log('generateOfferBody:', generateOfferBody)
        // messages.push(JSON.parse(generateOfferBody))
        messages.push(generateOfferBody)
      } else if (messageBody.type === 'campaign' && messageBody.action === 'updateOrCreate') {
        let campaignInfo = await getCampaign(messageBody.id)
        let generateCampaignBody = {
          comments: "ex# campaign handling updateOrCreate",
          type: "campaign",
          id: messageBody.id,
          action: messageBody.action,
          timestamp: Date.now(),
          body: `${JSON.stringify(campaignInfo)}`
        }
        messages.push(generateCampaignBody)
      } else {
        messages.push(messageBody)
      }

      await deleteMessage(message.ReceiptHandle!)
    }
    return messages
  } catch (e) {
    console.log('receiveMessageError:', e)
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
      console.log("Error while fetching messages from the sqs queue", err)
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
      consola.info(' \n Successfully deleted message with ReceiptHandle', data)
      return data
    })
    .catch(err => {
      consola.info("\n Error while fetching messages from the sqs queue", err)
    })

}
