import os from 'node:os';
import consola from 'consola';
import { IRecipeType, IRedshiftTables } from '../../../interfaces/recipeTypes';
import { pool } from '../../../db/redshift';
import { influxdb } from '../../../metrics';

const computerName = os.hostname();

export const copyS3ToRedshift = async (
  destPath: string,
  type: IRecipeType,
  table: IRedshiftTables,
): Promise<boolean> => {
  const client = await pool.connect();

  const awsKey = process.env.AWS_ACCESS_KEY_ID;
  const awsSecretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const dbRedshift = `${process.env.REDSHIFT_SCHEMA}.${table}`;
  const bucket = process.env.S3_BUCKET_NAME;
  const queryCopy = `COPY ${dbRedshift} FROM 's3://${bucket}/${destPath}' CREDENTIALS 'aws_access_key_id=${awsKey};aws_secret_access_key=${awsSecretKey}' format as json 'auto' gzip MAXERROR 5 ACCEPTINVCHARS TRUNCATECOLUMNS TRIMBLANKS`;
  // consola.info(`REDSHIFT_HOST: { ${process.env.REDSHIFT_HOST} } REDSHIFT_USER: { ${process.env.REDSHIFT_USER} }  REDSHIFT_PORT: { ${process.env.REDSHIFT_PORT} } REDSHIFT_TABLE: { ${process.env.REDSHIFT_TABLE} } REDSHIFT_DATABASE: { ${process.env.REDSHIFT_DATABASE} } REDSHIFT_SCHEMA: { ${process.env.REDSHIFT_SCHEMA} }`);
  // consola.info('queryCopy:', queryCopy);
  try {
    await client.query(queryCopy);
    // consola.info(`File ${destPath} added to redshift successfully`);
    influxdb(200, `copy_file_s3_${type.toLowerCase()}_to_redshift_success_${computerName}`);
    client.release();
    return true;
  } catch (e) {
    influxdb(500, `copy_file_s3_${type.toLowerCase()}_to_redshift_error_${computerName}`);
    consola.error(`[${type.toUpperCase()}] copyS3ToRedshiftError:`, e);
    return false;
  }
};
