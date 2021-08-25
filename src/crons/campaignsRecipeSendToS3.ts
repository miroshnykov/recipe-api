import fs from "fs";
import AWS from 'aws-sdk'
import consola from "consola";
import {ManagedUpload} from "aws-sdk/lib/s3/managed_upload";
import SendData = ManagedUpload.SendData;
import * as dotenv from "dotenv";

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();
const tempFileName:string = process.env.CAMPAIGNS_RECIPE_PATH + '.gz' || ''
export const uploadCampaignsFileToS3Bucket = async () => {
  try {

    fs.readFile(tempFileName, (err, data) => {
      if (err) throw err;
      let s3Key:string = process.env.S3_CAMPAIGNS_RECIPE_PATH || ''
      let s3BucketName:string = process.env.S3_BUCKET_NAME || ''

      const params = {
        Bucket: s3BucketName,
        Key: s3Key,
        Body: data
      };
      s3.upload(params, (err: Error, data: SendData) => {
        if (err) {
          consola.error(err);
        }
        consola.info(`File campaigns uploaded successfully at ${data.Location}`);
      });
    });

  } catch (error) {
    console.error('s3 upload error:', error)
  } finally {

  }

}

