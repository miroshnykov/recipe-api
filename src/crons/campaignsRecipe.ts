import JSONStream from 'JSONStream';
import consola from 'consola';
import fileSystem from 'node:fs';
import os from 'node:os';
import { getCampaigns } from '../models/campaignsModel';
import { reCalculateCampaignCaps } from '../services/campaignsCaps';
import {
  compressFile, deleteFile, memorySizeOfBite, millisToMinutesAndSeconds, rangeSpeed,
} from '../utils';
import { influxdb } from '../metrics';
import { setFileSize } from './setFileSize';
import { IRecipeType } from '../interfaces/recipeTypes';
import { ICampaign } from '../interfaces/campaigns';
import { uploadFileToS3Bucket } from './recipeSendToS3';
import { getFileSize } from './getFileSize';

const computerName = os.hostname();

const uploadS3SetSize = async (sizeOfCampaignsDB: number) => {
  const response: boolean | undefined = await uploadFileToS3Bucket(IRecipeType.CAMPAIGNS);
  if (response) {
    setTimeout(setFileSize, 10000, IRecipeType.CAMPAIGNS, sizeOfCampaignsDB);
  }
};

export const setCampaignsRecipe = async () => {
  try {
    const startTime: number = new Date().getTime();
    consola.info(`[CAMPAIGNS] Start create { campaigns } recipe  for DB name - { ${process.env.DB_NAME} } DB port - { ${process.env.DB_PORT} }`);
    const campaigns: ICampaign[] | undefined = await getCampaigns();
    if (!campaigns) {
      consola.error('[CAMPAIGNS] recipe campaigns created errors');
      influxdb(500, 'recipe_campaigns_created_error');
      return;
    }
    // const promises = [];
    const campaignsFormat: ICampaign[] = [];
    for (const campaign of campaigns) {
      if (campaign.capsEnabled) {
        // eslint-disable-next-line no-await-in-loop
        const reCalcCampaign: ICampaign = <ICampaign> await reCalculateCampaignCaps(campaign.campaignId);
        campaignsFormat.push(reCalcCampaign);
      } else {
        campaignsFormat.push(campaign);
      }
    }
    // const campaignsFormat = await Promise.all(promises);
    const endTime: number = new Date().getTime();
    const speedTime: number = endTime - startTime;
    if (rangeSpeed(speedTime) > 120000) {
      influxdb(500, `generate_recipe_campaigns_speed_${rangeSpeed(speedTime)}_${computerName}`);
    }
    consola.info(`[CAMPAIGNS] Recalculate campaigns speedTime: { ${speedTime}ms }  { ${millisToMinutesAndSeconds(speedTime)} time } for DB name - { ${process.env.DB_NAME} } `);
    const sizeOfCampaignsDB: number = memorySizeOfBite(campaignsFormat);
    // consola.info(`Identify Size of Campaigns from DB Object:${sizeOfCampaignsDB} count: { ${campaignsFormat.length} }`)
    influxdb(200, `generate_recipe_campaigns_${computerName}`);

    const sizeOfCampaignsRedis: number = await getFileSize(IRecipeType.CAMPAIGNS);
    consola.info(`[CAMPAIGNS] Identify Size of { Campaigns } Redis: { ${sizeOfCampaignsRedis} } DB: { ${sizeOfCampaignsDB} } count: { ${campaignsFormat.length} }  for DB name - { ${process.env.DB_NAME} }`);

    if (sizeOfCampaignsDB === sizeOfCampaignsRedis) {
      consola.info(`[CAMPAIGNS] Size of { Campaigns } in Redis the same like in DB :${sizeOfCampaignsDB}, don't need create recipe  for DB name - { ${process.env.DB_NAME} } `);
      return;
    }
    consola.info(`[CAMPAIGNS] Size of { Campaigns } from Redis and DB is different, lets create the recipe, sizeOfCampaignsDB:${sizeOfCampaignsDB}, sizeOfCampaignsRedis:${sizeOfCampaignsRedis}  for DB name - { ${process.env.DB_NAME} } `);
    const filePath: string = process.env.CAMPAIGNS_RECIPE_PATH || '';

    const transformStream = JSONStream.stringify();
    const outputStream = fileSystem.createWriteStream(filePath!);

    transformStream.pipe(outputStream);

    campaignsFormat?.forEach(transformStream.write);

    transformStream.end();

    outputStream.on(
      'finish',
      async () => {
        await compressFile(filePath!);
        await deleteFile(filePath!);
        influxdb(200, `recipe_campaigns_created_${computerName}`);
        consola.success(`[CAMPAIGNS] File Campaigns (count:${campaigns?.length}) created path:${filePath}  for DB name - { ${process.env.DB_NAME} }  `);
        setTimeout(uploadS3SetSize, 2000, sizeOfCampaignsDB);
      },
    );

    outputStream.on('error', (err: any) => {
      consola.error('[CAMPAIGNS] Campaign qz file recipe creating got error:', err);
      influxdb(500, `recipe_campaigns_create_qz_error_${computerName}`);
    });
    // setTimeout(uploadFileToS3Bucket, 6000, IRecipeType.CAMPAIGNS) // 6000 -> 6 sec
    // setTimeout(setFileSize, 20000, IRecipeType.CAMPAIGNS, sizeOfCampaignsDB)  // 20000 -> 20 sec
  } catch (e) {
    influxdb(500, `recipe_campaigns_create_error_${computerName}`);
    consola.error('create campaign recipe Error:', e);
  }
};
