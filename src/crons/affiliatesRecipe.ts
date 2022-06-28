import consola from 'consola';
import fileSystem from 'node:fs';
import os from 'node:os';
import { compressFile, deleteFile, memorySizeOfBite } from '../utils';
import { influxdb } from '../metrics';
import { setFileSize } from './setFileSize';
import { IRecipeType } from '../interfaces/recipeTypes';
import { uploadFileToS3Bucket } from './recipeSendToS3';
import { getFileSize } from './getFileSize';
import { IAffiliate } from '../interfaces/affiliates';
import { getAffiliates } from '../models/affiliates';
import { pool } from '../db/redshift';

const computerName = os.hostname();

export const appendToLocalFile = (filePath: string, data: any) => new Promise((resolve, reject) => {
  fileSystem.appendFile(filePath, data, (err: any) => {
    if (err) {
      influxdb(500, 'append_to_local_file_error');
      consola.error(`appendToLocalFileError ${filePath}:`, err);
      reject(err);
    }
    resolve(filePath);
  });
});

export const deleteAffiliates = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const query = `delete ${process.env.REDSHIFT_SCHEMA}.affiliates`;
    await client.query(query);
    client.release();
    consola.info(`all records from table  ${process.env.REDSHIFT_SCHEMA}.affiliates was deleted`);
    return true;
  } catch (e) {
    return false;
  }
};

export const copyS3ToRedshift = async (destPath: string): Promise<boolean> => {
  const client = await pool.connect();

  const awsKey = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const dbRedshift = `${process.env.REDSHIFT_SCHEMA}.${process.env.REDSHIFT_TABLE}`;
  const bucket = process.env.S3_BUCKET_NAME;
  const queryCopy = `COPY ${dbRedshift} FROM 's3://${bucket}/${destPath}' CREDENTIALS 'aws_access_key_id=${awsKey};aws_secret_access_key=${awsSecretKey}' format as json 'auto' gzip MAXERROR 5 ACCEPTINVCHARS TRUNCATECOLUMNS TRIMBLANKS`;
  // consola.info(`REDSHIFT_HOST: { ${process.env.REDSHIFT_HOST} } REDSHIFT_USER: { ${process.env.REDSHIFT_USER} }  REDSHIFT_PORT: { ${process.env.REDSHIFT_PORT} } REDSHIFT_TABLE: { ${process.env.REDSHIFT_TABLE} } REDSHIFT_DATABASE: { ${process.env.REDSHIFT_DATABASE} } REDSHIFT_SCHEMA: { ${process.env.REDSHIFT_SCHEMA} }`);
  // consola.info('queryCopy:', queryCopy);
  try {
    await client.query(queryCopy);
    // consola.info(`File ${destPath} added to redshift successfully`);
    influxdb(200, `copy_file_s3_to_redshift_success_${computerName}`);
    client.release();
    return true;
  } catch (e) {
    influxdb(500, `copy_file_s3_to_redshift_error_${computerName}`);
    consola.error('copyS3ToRedshiftError:', e);
    return false;
  }
};

const uploadS3SetSize = async (sizeOfAffiliatesDB: number, count: number) => {
  const response: boolean | undefined = await uploadFileToS3Bucket(IRecipeType.AFFILIATES);
  if (response) {
    const deleteRecords: boolean = await deleteAffiliates();
    if (deleteRecords) {
      const path = `${process.env.S3_AFFILIATES_RECIPE_PATH}`;
      const redshiftResponse = await copyS3ToRedshift(path);
      if (redshiftResponse) {
        consola.info(`File ${path} added to redshift successfully count of records  { ${count} }`);
        await setFileSize(IRecipeType.AFFILIATES, sizeOfAffiliatesDB);
      }
    }
  }
};

export const setAffiliatesRecipe = async () => {
  try {
    const startTime: number = new Date().getTime();
    consola.info(`Start create { affiliates } recipe  for DB name - { ${process.env.DB_NAME} } DB port - { ${process.env.DB_PORT} }`);
    const affiliates: IAffiliate[] | undefined = await getAffiliates();
    if (!affiliates) {
      consola.error('recipe affiliates created errors');
      influxdb(500, 'recipe_affiliates_created_error');
      return;
    }
    // const promises = [];
    const affiliatesFormat: IAffiliate[] = [];
    let records = '';
    for (const affiliate of affiliates) {
      affiliatesFormat.push(affiliate);
      records += `${JSON.stringify(affiliate)}\n`;
    }
    const recordsReady = records.slice(0, -1);
    // const campaignsFormat = await Promise.all(promises);
    const endTime: number = new Date().getTime();
    const speedTime: number = endTime - startTime;

    consola.info(`Recalculate { affiliates } done speedTime: { ${speedTime}ms }  for DB name - { ${process.env.DB_NAME} } `);
    const sizeOfAffiliatesDB: number = memorySizeOfBite(affiliatesFormat);
    // consola.info(`Identify Size of Campaigns from DB Object:${sizeOfCampaignsDB} count: { ${campaignsFormat.length} }`)
    influxdb(200, `generate_recipe_affiliates_${computerName}`);

    const sizeOfAffiliatesRedis: number = await getFileSize(IRecipeType.AFFILIATES);
    consola.info(`Identify Size of { Campaigns } Redis: { ${sizeOfAffiliatesRedis} } DB: { ${sizeOfAffiliatesDB} } count: { ${affiliatesFormat.length} }  for DB name - { ${process.env.DB_NAME} }`);

    if (sizeOfAffiliatesDB === sizeOfAffiliatesRedis) {
      consola.info(`Size of { Affiliates } in Redis the same like in DB :${sizeOfAffiliatesDB}, don't need create recipe  for DB name - { ${process.env.DB_NAME} } `);
      return;
    }
    consola.info(`Size of { Affiliates } from Redis and DB is different, lets create the recipe, sizeOfAffiliatesDB:${sizeOfAffiliatesDB}, sizeOfAffiliatesRedis:${sizeOfAffiliatesRedis}  for DB name - { ${process.env.DB_NAME} } `);
    const filePath: string = process.env.AFFILIATES_RECIPE_PATH || '';
    await appendToLocalFile(filePath, recordsReady);
    await compressFile(filePath!);
    await deleteFile(filePath!);
    influxdb(200, `recipe_affiliates_created_${computerName}`);
    consola.success(`File Affiliates (count:${affiliates?.length}) created path:${filePath}  for DB name - { ${process.env.DB_NAME} }  `);
    setTimeout(uploadS3SetSize, 2000, sizeOfAffiliatesDB, affiliates?.length);
  } catch (e) {
    influxdb(500, `recipe_affiliates_create_error_${computerName}`);
    consola.error('create affiliates recipe Error:', e);
  }
};
