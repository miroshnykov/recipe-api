import consola from 'consola';
import os from 'node:os';
import { influxdb } from '../../metrics';
import {
  compressFile, deleteFile, memorySizeOfBite, millisToMinutesAndSeconds,
} from '../../utils';
import { getFileSize } from '../getFileSize';
import { IRecipeType, IRedshiftTables } from '../../interfaces/recipeTypes';
import { IOffersName } from '../../interfaces/offers';
import { getOffersName } from '../../models/offersModel';
import { appendToLocalFile } from './common/appendToLocalFile';
import { uploadS3SetSize } from './common/uploadS3SetSize';
import { IUploadS3 } from '../../interfaces/syncToRedshift/uploadS3';

const computerName = os.hostname();

export const syncOffers = async () => {
  try {
    const startTime: number = new Date().getTime();
    consola.info(`[OFFERS_NAMES] Start create { offersNames } recipe  for DB name - { ${process.env.DB_NAME} } DB port - { ${process.env.DB_PORT} }`);
    const offersName: IOffersName[] | undefined = await getOffersName();
    if (!offersName) {
      consola.error('[OFFERS_NAMES] recipe offersNames created errors');
      influxdb(500, 'recipe_offers_name_created_error');
      return;
    }
    const offersNameFormat: IOffersName[] = [];
    let records = '';
    for (const offerName of offersName) {
      offersNameFormat.push(offerName);
      records += `${JSON.stringify(offerName)}\n`;
    }
    const recordsReady = records.slice(0, -1);
    // const campaignsFormat = await Promise.all(promises);
    const endTime: number = new Date().getTime();
    const speedTime: number = endTime - startTime;

    consola.info(`[OFFERS_NAMES] Recalculate { offersNames } done speedTime: { ${speedTime}ms } { ${millisToMinutesAndSeconds(speedTime)} time }  for DB name - { ${process.env.DB_NAME} } `);
    const sizeOfOffersNameDB: number = memorySizeOfBite(offersNameFormat);
    // consola.info(`Identify Size of Campaigns from DB Object:${sizeOfCampaignsDB} count: { ${campaignsFormat.length} }`)
    influxdb(200, `generate_recipe_offers_name_${computerName}`);

    const sizeOfOffersNameRedis: number = await getFileSize(IRecipeType.OFFERS_NAME);
    consola.info(`[OFFERS_NAMES] Identify Size of { offersNames } Redis: { ${sizeOfOffersNameRedis} } DB: { ${sizeOfOffersNameDB} } count: { ${offersNameFormat.length} }  for DB name - { ${process.env.DB_NAME} }`);

    if (sizeOfOffersNameDB === sizeOfOffersNameRedis) {
      consola.info(`[OFFERS_NAMES] Size of { offersNames } in Redis the same like in DB :${sizeOfOffersNameRedis}, don't need create recipe  for DB name - { ${process.env.DB_NAME} } `);
      return;
    }
    consola.info(`[OFFERS_NAMES] Size of { offersNames } from Redis and DB is different, lets create the recipe, sizeOfAffiliatesDB:${sizeOfOffersNameDB}, sizeOfAffiliatesRedis:${sizeOfOffersNameRedis}  for DB name - { ${process.env.DB_NAME} } `);
    const filePath: string = process.env.OFFERS_NAME_RECIPE_PATH || '';
    await appendToLocalFile(filePath, recordsReady);
    await compressFile(filePath!);
    await deleteFile(filePath!);
    influxdb(200, `recipe_offers_name_created_${computerName}`);
    consola.success(`[OFFERS_NAMES] File offersNames (count:${offersName?.length}) created path:${filePath}  for DB name - { ${process.env.DB_NAME} }  `);
    const params: IUploadS3 = {
      sizeDB: sizeOfOffersNameDB,
      count: offersName?.length,
      type: IRecipeType.OFFERS_NAME,
      table: IRedshiftTables.OFFERS,
      pathS3: `${process.env.S3_OFFERS_NAME_RECIPE_PATH}`,
    };

    setTimeout(uploadS3SetSize, 2000, params);
  } catch (e) {
    influxdb(500, `recipe_offers_name_create_error_${computerName}`);
    consola.error('[OFFERS_NAMES] create offersName recipe Error:', e);
  }
};
