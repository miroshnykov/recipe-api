import {getFileSize} from "../utils";
import {redis} from "../redis";
import consola from "consola";
import * as dotenv from "dotenv";

dotenv.config();

const offersFileRecipePath = process.env.OFFERS_RECIPE_PATH + '.gz'

export const setFileSizeOffers = async () => {
  try {
    let offersSize = await getFileSize(offersFileRecipePath!)
    consola.info(`setOffersSizeFile:${offersSize}`)
    await redis.set(`offersSize`, offersSize!)
  } catch (e) {
    consola.error('setFileSizeOffers:', e)
  }

}