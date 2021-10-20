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

export const setOffersRecipe = async () => {
  try {
    let offers: object | any = await getOffers()

    let offerFormat: any = []
    for (const offer of offers) {
      let reCalcOffer:IOffer | any[] = await reCalculateOffer(offer)
      offerFormat.push(reCalcOffer)
    }

    let sizeOfOffersDB: number = memorySizeOfBite(offerFormat)
    consola.info(`Identify Size of Offers Object:${sizeOfOffersDB}`)
    influxdb(200, `size_of_offers_db_${sizeOfOffersDB}`)

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
