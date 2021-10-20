import fs from "fs";
import AWS from 'aws-sdk'
import consola from "consola";
import {ManagedUpload} from "aws-sdk/lib/s3/managed_upload";
import SendData = ManagedUpload.SendData;
import * as dotenv from "dotenv";
import {influxdb} from "../metrics";
import {IRecipeType} from "../interfaces/recipeTypes";

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

export const uploadFileToS3Bucket = async (type: IRecipeType) => {
  try {
    let tempFileName: string = ''
    let s3Key: string = ''
    let s3BucketName: string = ''
    switch (type) {
      case 'offers':
        tempFileName = process.env.OFFERS_RECIPE_PATH + '.gz' || ''
        s3Key = process.env.S3_OFFERS_RECIPE_PATH || ''
        s3BucketName = process.env.S3_BUCKET_NAME || ''
        break;
      case 'campaigns':
        tempFileName = process.env.CAMPAIGNS_RECIPE_PATH + '.gz' || ''
        s3Key = process.env.S3_CAMPAIGNS_RECIPE_PATH || ''
        s3BucketName = process.env.S3_BUCKET_NAME || ''
        break;
      default:
        throw Error(`${type} not define, not able to get file from s3 `)
    }

    fs.readFile(tempFileName, (err, data) => {
      if (err) throw err;

      const params = {
        Bucket: s3BucketName,
        Key: s3Key,
        Body: data
      };
      // consola.info(`upload${type}FileToS3Bucket:${s3BucketName} , s3Key:${s3Key}`)

      s3.upload(params, (err: Error, data: SendData) => {
        if (err) {
          consola.error(err);
        } else {
          influxdb(200, `recipe_${type}_uploaded_to_s3`)
          consola.info(`File ${type} uploaded successfully at ${data.Location}`);
        }

      });
    });

  } catch (error) {
    influxdb(500, `recipe_${type}_uploaded_to_s3_error`)
    console.error('s3 upload error:', error)
  }
}

export const checkSizeOfferFileFromS3Bucket = async () => {
  let s3Key = process.env.S3_OFFERS_RECIPE_PATH || ''
  let s3BucketName = process.env.S3_BUCKET_NAME || ''
  let params = {Bucket: s3BucketName, Key: s3Key}
  return s3.headObject(params!).promise()
    .then(res => res.ContentLength)
    .catch(e => {
      consola.error('checkSizeOfferFileFromS3BucketError', e)
    })
}
