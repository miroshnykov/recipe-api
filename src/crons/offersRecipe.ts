import JSONStream from 'JSONStream';
import consola from 'consola';
import fileSystem from 'node:fs';
import os from 'node:os';
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

const uploadS3SetSize = async (sizeOfOffersDB: number) => {
  const response: boolean | undefined = await uploadFileToS3Bucket(IRecipeType.OFFERS);
  if (response) {
    setTimeout(setFileSize, 10000, IRecipeType.OFFERS, sizeOfOffersDB);
  }
};

export const setOffersRecipe = async () => {
  try {
    const startTime: number = new Date().getTime();
    consola.info(`Start create { offers } recipe for DB name - { ${process.env.DB_NAME} } DB port - { ${process.env.DB_PORT} }`);
    const offers: IOffer[] | undefined = await getOffers();
    if (!offers) {
      consola.error('recipe offers created errors');
      influxdb(500, 'recipe_offers_created_error');
      return;
    }
    // const promises = [];
    // for (const offer of offers) {
    //   const reCalcOffer = reCalculateOffer(offer);
    //   promises.push(reCalcOffer);
    // }
    // const offerFormat = await Promise.all(promises);

    // await Promise.all(offers.map(async (offer) => {
    //   const reCalcOffer: IOffer = <IOffer> await reCalculateOffer(offer);
    //   offerFormat.push(reCalcOffer);
    // }));

    const offerFormat: IOffer[] = [];
    for await (const offer of offers) {
      const reCalcOffer: IOffer = <IOffer> await reCalculateOffer(offer);
      offerFormat.push(reCalcOffer);
    }

    const endTime: number = new Date().getTime();
    const speedTime: number = endTime - startTime;
    consola.info(`Recalculate { offers } done speedTime: { ${speedTime}ms } for DB name - { ${process.env.DB_NAME} } `);
    const sizeOfOffersDB: number = memorySizeOfBite(offerFormat);
    // consola.info(`Identify Size of Offers Object:${sizeOfOffersDB} count: { ${offerFormat.length} }`)
    influxdb(200, `generate_recipe_offers_${computerName}`);

    const sizeOfOffersRedis: number = await getFileSize(IRecipeType.OFFERS);
    consola.info(`Identify Size of { Offers } Redis: { ${sizeOfOffersRedis} } DB { ${sizeOfOffersDB} } count: { ${offerFormat.length} }  for DB name - { ${process.env.DB_NAME} } `);

    if (sizeOfOffersDB === sizeOfOffersRedis) {
      consola.info(`Size of { Offers } in Redis the same like in DB :${sizeOfOffersDB}, don't need create recipe  for DB name - { ${process.env.DB_NAME} } `);
      return;
    }
    consola.info(`Size of { Offers } from Redis and DB is different, lets create the recipe, sizeOfOffersDB:${sizeOfOffersDB}, sizeOfOffersRedis:${sizeOfOffersRedis}  for DB name - { ${process.env.DB_NAME} } `);

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
        consola.success(`File Offers(count:${offerFormat?.length}) created path:${filePath}  for DB name - { ${process.env.DB_NAME} } `);
        setTimeout(uploadS3SetSize, 6000, sizeOfOffersDB);
      },
    );

    outputStream.on('error', (err: any) => {
      consola.error('Offer qz file recipe creating got error:', err);
      influxdb(500, `recipe_offers_create_qz_error_${computerName}`);
    });
    // setTimeout(uploadS3SetSize, 6000, sizeOfOffersDB);
    // setTimeout(uploadFileToS3Bucket, 6000, IRecipeType.OFFERS)
    // setTimeout(setFileSize, 10000, IRecipeType.OFFERS, sizeOfOffersDB)
  } catch (e) {
    influxdb(500, `recipe_offers_create_error_${computerName}`);
    consola.error('create offers recipe Error:', e);
  }
};
