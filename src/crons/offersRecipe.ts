import JSONStream from "JSONStream";
import consola from "consola";
import fileSystem from "fs";
import {checkSizeOfferFileFromS3Bucket, uploadOffersFileToS3Bucket} from "./offersRecipeSendToS3";
import {compressFile, deleteFile, memorySizeOfBite} from "../utils";
import {getOffers, getAggregatedOffers, getOfferCaps} from "../models/offersModel";
import {setFileSizeOffers} from "./offersFileSize";
import {influxdb} from "../metrics";

export const setOffersRecipe = async () => {

  try {
    let offers: object | any = await getOffers()

    let offerFormat: any = []
    for (const offer of offers) {
      if (offer.type === 'aggregated') {
        offer.offersAggregatedIds = await getAggregatedOffers(offer.offerId)
        offerFormat.push(offer)
        continue
      }

      if (offer.capOfferId || offer.useStartEndDate) {
        let offerWitCaps = await getOfferCaps(offer.offerId)
        offerFormat.push(offerWitCaps)
      } else {
        offerFormat.push(offer)
      }

    }

    let sizeOfOffersDB: number = memorySizeOfBite(offerFormat)
    consola.info(`setSizeOffersObject:${sizeOfOffersDB}`)
    influxdb(200, `size_of_offers_db_${sizeOfOffersDB}`)

    const filePath: string | undefined = process.env.OFFERS_RECIPE_PATH

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
    setTimeout(uploadOffersFileToS3Bucket, 6000)
    setTimeout(setFileSizeOffers, 10000, sizeOfOffersDB)

  } catch (e) {
    influxdb(500, `recipe_offers_create_error`)
    consola.error('create offers recipe Error:', e)
  }

}
