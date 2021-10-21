import JSONStream from "JSONStream";
import consola from "consola";
import fileSystem from "fs";
import {compressFile, deleteFile, memorySizeOfBite} from "../utils";
import {getOffers, getAggregatedOffers} from "../models/offersModel";
import {reCalculateOffer} from "../models/offersCapsModel";
import {influxdb} from "../metrics";
import {setFileSize} from "./setFileSize";
import {IRecipeType} from "../interfaces/recipeTypes";
import {IOffer} from "../interfaces/offers";
import {uploadFileToS3Bucket} from "./recipeSendToS3";
import {getFileSize} from "./getFileSize";

export const setOffersRecipe = async () => {
  try {
    const offers: object | any = await getOffers()

    const offerFormat: any = []
    for (const offer of offers) {
      const reCalcOffer: IOffer | any[] = await reCalculateOffer(offer)
      offerFormat.push(reCalcOffer)
    }

    const sizeOfOffersDB: number = memorySizeOfBite(offerFormat)
    consola.info(`Identify Size of Offers Object:${sizeOfOffersDB}`)
    influxdb(200, `size_of_offers_db_${sizeOfOffersDB}`)

    const sizeOfOffersRedis: number = await getFileSize(IRecipeType.OFFERS)
    consola.info(`Identify Size of Offers from Redis:${sizeOfOffersRedis}`)

    if (sizeOfOffersDB === sizeOfOffersRedis) {
      consola.info(`Size of Offers in Redis the same like in DB :${sizeOfOffersDB}, don't need create recipe`)
      return
    }
    consola.info(`Size of Offers from Redis and DB is different, lets create the recipe, sizeOfOffersDB:${sizeOfOffersDB}, sizeOfOffersRedis:${sizeOfOffersRedis}`)

    const filePath: string = process.env.OFFERS_RECIPE_PATH || ''

    let transformStream = JSONStream.stringify();
    let outputStream = fileSystem.createWriteStream(filePath!);

    transformStream.pipe(outputStream);

    offerFormat?.forEach(transformStream.write);

    transformStream.end();

    outputStream.on(
      "finish",
      async function handleFinish() {

        await compressFile(filePath!)
        await deleteFile(filePath!)
        influxdb(200, `recipe_offers_created`)
        consola.success(`File Offers(count:${offerFormat?.length}) created path:${filePath} `)
      }
    )
    setTimeout(uploadFileToS3Bucket, 6000, IRecipeType.OFFERS)
    setTimeout(setFileSize, 10000, IRecipeType.OFFERS, sizeOfOffersDB)

  } catch (e) {
    influxdb(500, `recipe_offers_create_error`)
    consola.error('create offers recipe Error:', e)
  }

}
