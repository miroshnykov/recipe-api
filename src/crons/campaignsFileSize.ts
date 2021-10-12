import {getFileSize} from "../utils";
import {redis} from "../redis";
import consola from "consola";
import * as dotenv from "dotenv";
import {influxdb} from "../metrics";

dotenv.config();

const campaignsFileRecipePath = process.env.CAMPAIGNS_RECIPE_PATH + '.gz'

export const setFileSizeCampaigns = async () => {
  try {
    let campaignsSize: number = await getFileSize(campaignsFileRecipePath!) || 0
    consola.info(`setCampaignsSizeFile:${campaignsSize}`)
    influxdb(200, `recipe_size_campaigns_${campaignsSize}`)
    await redis.set(`campaignsSize`, campaignsSize!)
  } catch (e) {
    consola.error('setFileSizeCampaigns:', e)
  }

}