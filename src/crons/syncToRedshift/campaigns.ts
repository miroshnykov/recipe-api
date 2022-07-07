import consola from 'consola';
import os from 'node:os';
import { influxdb } from '../../metrics';
import {
  compressFile, deleteFile, memorySizeOfBite, millisToMinutesAndSeconds,
} from '../../utils';
import { getFileSize } from '../getFileSize';
import { IRecipeType, IRedshiftTables } from '../../interfaces/recipeTypes';
import { appendToLocalFile } from './common/appendToLocalFile';
import { uploadS3SetSize } from './common/uploadS3SetSize';
import { IUploadS3 } from '../../interfaces/syncToRedshift/uploadS3';
import { ICampaignsName } from '../../interfaces/campaigns';
import { getCampaignsName } from '../../models/campaignsModel';

const computerName = os.hostname();

export const syncCampaigns = async () => {
  try {
    const startTime: number = new Date().getTime();
    consola.info(`[CAMPAIGNS_NAMES] Start create { campaignsNames } recipe  for DB name - { ${process.env.DB_NAME} } DB port - { ${process.env.DB_PORT} }`);
    const campaignsName: ICampaignsName[] | undefined = await getCampaignsName();
    if (!campaignsName) {
      consola.error('[CAMPAIGNS_NAMES] recipe campaignsNames created errors');
      influxdb(500, 'recipe_offers_name_created_error');
      return;
    }
    const campaignsNameFormat: ICampaignsName[] = [];
    let records = '';
    for (const offerName of campaignsName) {
      campaignsNameFormat.push(offerName);
      records += `${JSON.stringify(offerName)}\n`;
    }
    const recordsReady = records.slice(0, -1);
    // const campaignsFormat = await Promise.all(promises);
    const endTime: number = new Date().getTime();
    const speedTime: number = endTime - startTime;

    consola.info(`[CAMPAIGNS_NAMES] Recalculate { campaignsNames } done speedTime: { ${speedTime}ms } { ${millisToMinutesAndSeconds(speedTime)} time }  for DB name - { ${process.env.DB_NAME} } `);
    const sizeOfCampaignsNameDB: number = memorySizeOfBite(campaignsNameFormat);
    // consola.info(`Identify Size of Campaigns from DB Object:${sizeOfCampaignsDB} count: { ${campaignsFormat.length} }`)
    influxdb(200, `generate_recipe_offers_name_${computerName}`);

    const sizeOfCampaignsNameRedis: number = await getFileSize(IRecipeType.CAMPAIGNS_NAME);
    consola.info(`[CAMPAIGNS_NAMES] Identify Size of { campaignsNames } Redis: { ${sizeOfCampaignsNameRedis} } DB: { ${sizeOfCampaignsNameRedis} } count: { ${campaignsNameFormat.length} }  for DB name - { ${process.env.DB_NAME} }`);

    if (sizeOfCampaignsNameDB === sizeOfCampaignsNameRedis) {
      consola.info(`[CAMPAIGNS_NAMES] Size of { campaignsNames } in Redis the same like in DB :${sizeOfCampaignsNameRedis}, don't need create recipe  for DB name - { ${process.env.DB_NAME} } `);
      return;
    }
    consola.info(`[CAMPAIGNS_NAMES] Size of { campaignsNames } from Redis and DB is different, lets create the recipe, sizeOfAffiliatesDB:${sizeOfCampaignsNameDB}, sizeOfAffiliatesRedis:${sizeOfCampaignsNameRedis}  for DB name - { ${process.env.DB_NAME} } `);
    const filePath: string = process.env.CAMPAIGNS_NAME_RECIPE_PATH || '';
    await appendToLocalFile(filePath, recordsReady);
    await compressFile(filePath!);
    await deleteFile(filePath!);
    influxdb(200, `recipe_campaigns_name_created_${computerName}`);
    consola.success(`[CAMPAIGNS_NAMES] File campaignsNames (count:${campaignsName?.length}) created path:${filePath}  for DB name - { ${process.env.DB_NAME} }  `);
    const params: IUploadS3 = {
      sizeDB: sizeOfCampaignsNameDB,
      count: campaignsName?.length,
      type: IRecipeType.CAMPAIGNS_NAME,
      table: IRedshiftTables.CAMPAIGNS,
      pathS3: `${process.env.S3_CAMPAIGNS_NAME_RECIPE_PATH}`,
    };

    setTimeout(uploadS3SetSize, 2000, params);
  } catch (e) {
    influxdb(500, `recipe_campaigns_name_create_error_${computerName}`);
    consola.error('[CAMPAIGNS_NAMES] create campaignsName recipe Error:', e);
  }
};
