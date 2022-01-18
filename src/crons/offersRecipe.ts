import JSONStream from 'JSONStream';
import consola from 'consola';
import fileSystem from 'fs';
import os from 'os';
import { compressFile, deleteFile, memorySizeOfBite } from '../utils';
import { getOffers } from '../models/offersModel';
import { reCalculateOffer } from '../services/offersReCalculations';
import { influxdb } from '../metrics';
import { setFileSize } from './setFileSize';
import { IRecipeType } from '../interfaces/recipeTypes';
import { IOffer } from '../interfaces/offers';
import { uploadFileToS3Bucket } from './recipeSendToS3';
import { getFileSize } from './getFileSize';

const computerName = os.hostname();

export const setOffersRecipe = async () => {
  try {
    const startTime: number = new Date().getTime();
    consola.info('\nStart create offer recipe');
    const offers: IOffer[] | undefined = await getOffers();
    if (!offers) {
      consola.error('recipe offers created errors');
      influxdb(500, 'recipe_offers_created_error');
      return;
    }
    const promises = [];
    for (const offer of offers) {
      const reCalcOffer = reCalculateOffer(offer);
      promises.push(reCalcOffer);
    }
    const offerFormat = await Promise.all(promises);
    const endTime: number = new Date().getTime();
    const speedTime: number = endTime - startTime;
    consola.info(`Recalculate offers done speedTime: { ${speedTime}ms }`);
    const sizeOfOffersDB: number = memorySizeOfBite(offerFormat);
    // consola.info(`Identify Size of Offers Object:${sizeOfOffersDB} count: { ${offerFormat.length} }`)
    influxdb(200, `generate_recipe_offers_${computerName}`);

    const sizeOfOffersRedis: number = await getFileSize(IRecipeType.OFFERS);
    consola.info(`Identify Size of Offers Redis: { ${sizeOfOffersRedis} } DB { ${sizeOfOffersDB} } count: { ${offerFormat.length} }`);

    if (sizeOfOffersDB === sizeOfOffersRedis) {
      consola.info(`Size of Offers in Redis the same like in DB :${sizeOfOffersDB}, don't need create recipe`);
      return;
    }
    consola.info(`Size of Offers from Redis and DB is different, lets create the recipe, sizeOfOffersDB:${sizeOfOffersDB}, sizeOfOffersRedis:${sizeOfOffersRedis}`);

    const filePath: string = process.env.OFFERS_RECIPE_PATH || '';

    const transformStream = JSONStream.stringify();
    const outputStream = fileSystem.createWriteStream(filePath!);

    transformStream.pipe(outputStream);

    offerFormat?.forEach(transformStream.write);

    transformStream.end();

    outputStream.on(
      'finish',
      async () => {
        await compressFile(filePath!);
        await deleteFile(filePath!);
        influxdb(200, `recipe_offers_created_${computerName}`);
        consola.success(`File Offers(count:${offerFormat?.length}) created path:${filePath} `);
      },
    );
    // setTimeout(uploadFileToS3Bucket, 6000, IRecipeType.OFFERS)
    // setTimeout(setFileSize, 10000, IRecipeType.OFFERS, sizeOfOffersDB)
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    setTimeout(uploadS3SetSize, 6000, sizeOfOffersDB);
  } catch (e) {
    influxdb(500, `recipe_offers_create_error_${computerName}`);
    consola.error('create offers recipe Error:', e);
  }
};

const uploadS3SetSize = async (sizeOfOffersDB: number) => {
  const response: boolean | undefined = await uploadFileToS3Bucket(IRecipeType.OFFERS);
  if (response) {
    setTimeout(setFileSize, 10000, IRecipeType.OFFERS, sizeOfOffersDB);
  }
};
