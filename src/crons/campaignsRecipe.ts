import JSONStream from 'JSONStream';
import consola from 'consola';
import fileSystem from 'fs';
import os from 'os';
import { getCampaigns } from '../models/campaignsModel';
import { reCalculateCampaignCaps } from '../services/campaignsCaps';
import { compressFile, deleteFile, memorySizeOfBite } from '../utils';
import { influxdb } from '../metrics';
import { setFileSize } from './setFileSize';
import { IRecipeType } from '../interfaces/recipeTypes';
import { ICampaign } from '../interfaces/campaigns';
import { uploadFileToS3Bucket } from './recipeSendToS3';
import { getFileSize } from './getFileSize';

const computerName = os.hostname();

export const setCampaignsRecipe = async () => {
  try {
    const startTime: number = new Date().getTime();
    consola.info('\nStart create campaigns recipe');
    const campaigns: ICampaign[] | undefined = await getCampaigns();
    if (!campaigns) {
      consola.error('recipe campaigns created errors');
      influxdb(500, 'recipe_campaigns_created_error');
      return;
    }
    // const campaignsFormat: ICampaign[] = [];
    const promises = [];
    for (const campaign of campaigns) {
      if (campaign.capsEnabled) {
        const reCalcCampaign = reCalculateCampaignCaps(campaign.campaignId);
        promises.push(reCalcCampaign);
      } else {
        promises.push(campaign);
      }
    }
    const campaignsFormat = await Promise.all(promises);
    const endTime: number = new Date().getTime();
    const speedTime: number = endTime - startTime;

    consola.info(`Recalculate campaigns done speedTime: { ${speedTime}ms }`);
    const sizeOfCampaignsDB: number = memorySizeOfBite(campaignsFormat);
    // consola.info(`Identify Size of Campaigns from DB Object:${sizeOfCampaignsDB} count: { ${campaignsFormat.length} }`)
    influxdb(200, `size_of_campaigns_db_${sizeOfCampaignsDB}_${computerName}`);

    const sizeOfCampaignsRedis: number = await getFileSize(IRecipeType.CAMPAIGNS);
    consola.info(`Identify Size of Campaigns Redis: { ${sizeOfCampaignsRedis} } DB: { ${sizeOfCampaignsDB} } count: { ${campaignsFormat.length} }`);

    if (sizeOfCampaignsDB === sizeOfCampaignsRedis) {
      consola.info(`Size of Campaigns in Redis the same like in DB :${sizeOfCampaignsDB}, don't need create recipe`);
      return;
    }
    consola.info(`Size of Campaigns from Redis and DB is different, lets create the recipe, sizeOfCampaignsDB:${sizeOfCampaignsDB}, sizeOfCampaignsRedis:${sizeOfCampaignsRedis}`);
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
        consola.success(`File Campaigns (count:${campaigns?.length}) created path:${filePath} `);
      },
    );
    // setTimeout(uploadFileToS3Bucket, 6000, IRecipeType.CAMPAIGNS) // 6000 -> 6 sec
    // setTimeout(setFileSize, 20000, IRecipeType.CAMPAIGNS, sizeOfCampaignsDB)  // 20000 -> 20 sec
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    setTimeout(uploadS3SetSize, 6000, sizeOfCampaignsDB);
  } catch (e) {
    influxdb(500, `recipe_campaigns_create_error_${computerName}`);
    consola.error('create campaign recipe Error:', e);
  }
};

const uploadS3SetSize = async (sizeOfCampaignsDB: number) => {
  const response: boolean | undefined = await uploadFileToS3Bucket(IRecipeType.CAMPAIGNS);
  if (response) {
    setTimeout(setFileSize, 10000, IRecipeType.CAMPAIGNS, sizeOfCampaignsDB);
  }
};
