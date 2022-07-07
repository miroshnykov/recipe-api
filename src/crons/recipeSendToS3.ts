import { promises as fsPromises } from 'node:fs';
import AWS from 'aws-sdk';
import consola from 'consola';
import * as dotenv from 'dotenv';
import { influxdb } from '../metrics';
import { IRecipeType } from '../interfaces/recipeTypes';

dotenv.config();

AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const s3 = new AWS.S3();

// eslint-disable-next-line consistent-return
export const uploadFileToS3Bucket = async (type: IRecipeType): Promise<boolean | undefined> => {
  try {
    let tempFileName: string = '';
    let s3Key: string = '';
    let s3BucketName: string = '';
    switch (type) {
      case IRecipeType.OFFERS:
        tempFileName = `${process.env.OFFERS_RECIPE_PATH}.gz` || '';
        s3Key = process.env.S3_OFFERS_RECIPE_PATH || '';
        s3BucketName = process.env.S3_BUCKET_NAME || '';
        break;
      case IRecipeType.CAMPAIGNS:
        tempFileName = `${process.env.CAMPAIGNS_RECIPE_PATH}.gz` || '';
        s3Key = process.env.S3_CAMPAIGNS_RECIPE_PATH || '';
        s3BucketName = process.env.S3_BUCKET_NAME || '';
        break;
      case IRecipeType.AFFILIATES:
        tempFileName = `${process.env.AFFILIATES_RECIPE_PATH}.gz` || '';
        s3Key = process.env.S3_AFFILIATES_RECIPE_PATH || '';
        s3BucketName = process.env.S3_BUCKET_NAME || '';
        break;
      case IRecipeType.OFFERS_NAME:
        tempFileName = `${process.env.OFFERS_NAME_RECIPE_PATH}.gz` || '';
        s3Key = process.env.S3_OFFERS_NAME_RECIPE_PATH || '';
        s3BucketName = process.env.S3_BUCKET_NAME || '';
        break;
      case IRecipeType.CAMPAIGNS_NAME:
        tempFileName = `${process.env.CAMPAIGNS_NAME_RECIPE_PATH}.gz` || '';
        s3Key = process.env.S3_CAMPAIGNS_NAME_RECIPE_PATH || '';
        s3BucketName = process.env.S3_BUCKET_NAME || '';
        break;
      default:
        throw Error(`${type} not define, not able to get file from s3 `);
    }

    const fileData = await fsPromises.readFile(tempFileName);
    const params = {
      Bucket: s3BucketName,
      Key: s3Key,
      Body: fileData,
    };
    const uploadResponse = await s3.upload(params).promise().catch((e) => {
      consola.error(`[${type.toUpperCase()}] fileS3UploadBucketError:${s3Key} s3BucketName:${s3BucketName} for DB name - { ${process.env.DB_NAME} }`, e);
      influxdb(500, `recipe_${type}_uploaded_to_s3_error`);
    });
    if (uploadResponse) {
      influxdb(200, `recipe_${type}_uploaded_to_s3`);
      consola.info(`[${type.toUpperCase()}] File ${type} uploaded successfully at ${uploadResponse.Location} for DB name - { ${process.env.DB_NAME} } `);
      return true;
    }
  } catch (error) {
    influxdb(500, `recipe_${type}_uploaded_to_s3_error`);
    consola.error('s3 upload error:', error);
  }
};

export const checkSizeOfferFileFromS3Bucket = async () => {
  const s3Key = process.env.S3_OFFERS_RECIPE_PATH || '';
  const s3BucketName = process.env.S3_BUCKET_NAME || '';
  const params = { Bucket: s3BucketName, Key: s3Key };
  return s3.headObject(params!).promise()
    .then((res) => res.ContentLength)
    .catch((e) => {
      consola.error('checkSizeOfferFileFromS3BucketError', e);
    });
};
