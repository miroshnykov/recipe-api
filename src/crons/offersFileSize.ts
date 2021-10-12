import {getFileSize} from "../utils";
import {redis} from "../redis";
import consola from "consola";
import * as dotenv from "dotenv";
import {influxdb} from "../metrics";

dotenv.config();

const offersFileRecipePath = process.env.OFFERS_RECIPE_PATH + '.gz'

export const setFileSizeOffers = async () => {
  try {
    let offersSize: number = await getFileSize(offersFileRecipePath!) || 0
    consola.info(`setOffersSizeFile:${offersSize}`)
    influxdb(200, `recipe_size_offers_${offersSize}`)
    await redis.set(`offersSize`, offersSize!)
  } catch (e) {
    consola.error('setFileSizeOffers:', e)
  }

}