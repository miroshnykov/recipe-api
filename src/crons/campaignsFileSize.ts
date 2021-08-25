import {getFileSize} from "../utils";
import {redis} from "../redis";
import consola from "consola";
import * as dotenv from "dotenv";

dotenv.config();

const campaignsFileRecipePath = process.env.CAMPAIGNS_RECIPE_PATH + '.gz'

export const setFileSizeCampaigns = async () => {
  try {
    let campaignsSize = await getFileSize(campaignsFileRecipePath!)
    consola.info(`setCampaignsSizeFile:${campaignsSize}`)
    await redis.set(`campaignsSize`, campaignsSize!)
  } catch (e) {
    consola.error('setFileSizeCampaigns:', e)
  }

}