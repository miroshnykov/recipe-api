import {getFileSize} from "../utils";
import {redis} from "../redis";
import consola from "consola";
import * as dotenv from "dotenv";
import {influxdb} from "../metrics";
import {checkSizeOfferFileFromS3Bucket} from "./offersRecipeSendToS3";

dotenv.config();

const offersFileRecipePath = process.env.OFFERS_RECIPE_PATH + '.gz'

export const setFileSizeOffers = async () => {
  try {
    let offersSize: number = await getFileSize(offersFileRecipePath!) || 0
    let s3SizeOffer = await checkSizeOfferFileFromS3Bucket()
    consola.info(`setOffersSizeFile:${offersSize}`)
    consola.info(`setOffersSizeBucket:${s3SizeOffer}`)
    influxdb(200, `recipe_size_offers_${offersSize}`)
    influxdb(200, `recipe_size_offers_bucket_${s3SizeOffer}`)
    await redis.set(`offersSize`, offersSize!)
  } catch (e) {
    consola.error('setFileSizeOffers:', e)
  }

}