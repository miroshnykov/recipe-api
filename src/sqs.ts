import consola from 'consola';

import AWS from 'aws-sdk';
import * as dotenv from 'dotenv';

import { influxdb } from './metrics';
import { ISqsMessage } from './interfaces/sqsMessage';
// eslint-disable-next-line import/no-cycle
import { recalculateRecipe } from './services/recalculateRecipe';

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const sqs = new AWS.SQS();

const queueUrl: string = process.env.AWS_SQS_QUEUE_URL || '';
// consola.info(`queueUrl:${queueUrl}`)
const receiveMessage = async () => sqs.receiveMessage({
  QueueUrl: queueUrl,
  AttributeNames: ['All'],
  MaxNumberOfMessages: 10,
  VisibilityTimeout: 10,
  WaitTimeSeconds: 20,
}).promise()
  .then((data) => data)
  .catch((err) => {
    influxdb(500, 'sqs_receive_message_error');
    consola.error(`Error while fetching messages from the sqs queue:${queueUrl}`, err);
  });

export const sqsProcess = async () => {
  try {
    const dataQueue = await receiveMessage();
    if (!dataQueue?.Messages) {
      return [];
    }
    const messages: any = [];

    // await Promise.all(dataQueue.Messages.map(async (message) => {
    //   const messagesUpd: ISqsMessage[] = await recalculateRecipe(message);
    //   for (const messageUpd of messagesUpd) {
    //     messages.push(messageUpd);
    //   }
    // }));
    for (const message of dataQueue.Messages) {
      // eslint-disable-next-line no-await-in-loop
      const messagesUpd: ISqsMessage[] = await recalculateRecipe(message);
      for (const messageUpd of messagesUpd) {
        messages.push(messageUpd);
      }
    }

    return messages;
  } catch (e) {
    influxdb(500, 'sqs_receive_message_error');
    consola.error('receiveMessageError:', e);
    return [];
  }
};

export const deleteMessage = async (messageId: string) => {
  const params = {
    QueueUrl: queueUrl,
    ReceiptHandle: messageId,
  };
  return sqs.deleteMessage(params)
    .promise()
    .then((data) =>
      // consola.info(' \n Successfully deleted message with ReceiptHandle', data)
      // eslint-disable-next-line implicit-arrow-linebreak
      data)
    .catch((err) => {
      influxdb(500, 'sqs_delete_message_error');
      consola.error(`Error delete messages from the sqs queue:${queueUrl}`, err);
    });
};
