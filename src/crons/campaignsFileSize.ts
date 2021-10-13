import {getFileSize} from "../utils";
import {redis} from "../redis";
import consola from "consola";
import * as dotenv from "dotenv";
import {influxdb} from "../metrics";

dotenv.config();

const campaignsFileRecipePath = process.env.CAMPAIGNS_RECIPE_PATH + '.gz'

export const setFileSizeCampaigns = async (sizeOfCampaignsDB: number) => {
  try {
    // let campaignsSize: number = await getFileSize(campaignsFileRecipePath!) || 0
    consola.info(`setCampaignsSizeFile:${sizeOfCampaignsDB}`)
    // influxdb(200, `recipe_size_campaigns_${sizeOfCampaignsDB}`)
    // await redis.set(`campaignsSize`, campaignsSize!)

    await redis.set(`campaignsSize`, sizeOfCampaignsDB!)
  } catch (e) {
    consola.error('setFileSizeCampaigns:', e)
  }

}