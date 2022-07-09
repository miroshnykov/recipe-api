import consola from 'consola';
import os from 'node:os';
import {
  compressFile, deleteFile, memorySizeOfBite, millisToMinutesAndSeconds,
} from '../../utils';
import { influxdb } from '../../metrics';
import { IRecipeType, IRedshiftTables } from '../../interfaces/recipeTypes';
import { getFileSize } from '../getFileSize';
import { IAffiliate } from '../../interfaces/affiliates';
import { getAffiliates } from '../../models/affiliates';
import { appendToLocalFile } from './common/appendToLocalFile';
import { IUploadS3 } from '../../interfaces/syncToRedshift/uploadS3';
import { uploadS3SetSize } from './common/uploadS3SetSize';

const computerName = os.hostname();

export const syncAffiliates = async () => {
  try {
    const startTime: number = new Date().getTime();
    consola.info(`[AFFILIATES] Start create { affiliates } recipe  for DB name - { ${process.env.DB_NAME} } DB port - { ${process.env.DB_PORT} }`);
    const affiliates: IAffiliate[] | undefined = await getAffiliates();
    if (!affiliates) {
      consola.error('[AFFILIATES] recipe affiliates created errors');
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

    consola.info(`[AFFILIATES] Recalculate { affiliates } done speedTime: { ${speedTime}ms } { ${millisToMinutesAndSeconds(speedTime)} time }  for DB name - { ${process.env.DB_NAME} } `);
    const sizeOfAffiliatesDB: number = memorySizeOfBite(affiliatesFormat);
    // consola.info(`Identify Size of Campaigns from DB Object:${sizeOfCampaignsDB} count: { ${campaignsFormat.length} }`)
    influxdb(200, `generate_recipe_affiliates_${computerName}`);

    const sizeOfAffiliatesRedis: number = await getFileSize(IRecipeType.AFFILIATES);
    consola.info(`[AFFILIATES] Identify Size of { Affiliates } Redis: { ${sizeOfAffiliatesRedis} } DB: { ${sizeOfAffiliatesDB} } count: { ${affiliatesFormat.length} }  for DB name - { ${process.env.DB_NAME} }`);

    if (sizeOfAffiliatesDB === sizeOfAffiliatesRedis) {
      consola.info(`[AFFILIATES] Size of { Affiliates } in Redis the same like in DB :${sizeOfAffiliatesDB}, don't need create recipe  for DB name - { ${process.env.DB_NAME} } `);
      return;
    }
    consola.info(`[AFFILIATES] Size of { Affiliates } from Redis and DB is different, lets create the recipe, sizeOfAffiliatesDB:${sizeOfAffiliatesDB}, sizeOfAffiliatesRedis:${sizeOfAffiliatesRedis}  for DB name - { ${process.env.DB_NAME} } `);
    const filePath: string = process.env.AFFILIATES_RECIPE_PATH || '';
    await appendToLocalFile(filePath, recordsReady);
    await compressFile(filePath!);
    await deleteFile(filePath!);
    influxdb(200, `recipe_affiliates_created_${computerName}`);
    consola.success(`[AFFILIATES] File Affiliates (count:${affiliates?.length}) created path:${filePath}  for DB name - { ${process.env.DB_NAME} }  `);
    const params: IUploadS3 = {
      sizeDB: sizeOfAffiliatesDB,
      count: affiliates?.length,
      type: IRecipeType.AFFILIATES,
      table: IRedshiftTables.AFFILIATES,
      pathS3: `${process.env.S3_AFFILIATES_RECIPE_PATH}`,
    };

    setTimeout(uploadS3SetSize, 2000, params);
  } catch (e) {
    influxdb(500, `recipe_affiliates_create_error_${computerName}`);
    consola.error('[AFFILIATES] create affiliates recipe Error:', e);
  }
};
