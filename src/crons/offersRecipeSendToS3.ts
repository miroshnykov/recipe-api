import fs from "fs";
import AWS from 'aws-sdk'
import consola from "consola";
import {ManagedUpload} from "aws-sdk/lib/s3/managed_upload";
import SendData = ManagedUpload.SendData;
import * as dotenv from "dotenv";
import {influxdb} from "../metrics";

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const tempFileName: string = process.env.OFFERS_RECIPE_PATH + '.gz' || ''
export const uploadOffersFileToS3Bucket = async () => {
  try {

    fs.readFile(tempFileName, (err, data) => {
      if (err) throw err;
      let s3Key: string = process.env.S3_OFFERS_RECIPE_PATH || ''
      let s3BucketName: string = process.env.S3_BUCKET_NAME || ''

      const params = {
        Bucket: s3BucketName,
        Key: s3Key,
        Body: data
      };
      // consola.info('uploadOffersFileToS3Bucket:', params)

      s3.upload(params, (err: Error, data: SendData) => {
        if (err) {
          consola.error(err);
        } else {
          influxdb(200, `recipe_offers_uploaded_to_s3`)
          consola.info(`File offers uploaded successfully at ${data.Location}`);
        }

      });
    });

  } catch (error) {
    influxdb(500, `recipe_offers_uploaded_to_s3_error`)
    console.error('s3 upload error:', error)
  } finally {

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
