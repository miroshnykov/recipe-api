import JSONStream from "JSONStream";
import consola from "consola";
import fileSystem from "fs";
import {getCampaigns} from "../models/campaignsModel";
import {reCalculateCampaignCaps} from "../services/campaignsCaps";
import {compressFile, deleteFile, memorySizeOfBite} from "../utils";
import {influxdb} from "../metrics";
import {setFileSize} from "./setFileSize";
import {IRecipeType} from "../interfaces/recipeTypes";
import {ICampaign} from "../interfaces/campaigns";
import {uploadFileToS3Bucket} from "./recipeSendToS3";
import {getFileSize} from "./getFileSize";

export const setCampaignsRecipe = async () => {
  try {
    const campaigns: ICampaign[] = await getCampaigns()
    let campaignsFormat: ICampaign[] = []
    for (const campaign of campaigns) {
      if (campaign.capsEnabled) {
        const reCalcCampaign: ICampaign = <ICampaign>await reCalculateCampaignCaps(campaign.campaignId)
        campaignsFormat.push(reCalcCampaign)
      } else {
        campaignsFormat.push(campaign)
      }
    }

    const sizeOfCampaignsDB: number = memorySizeOfBite(campaignsFormat)
    consola.info(`Identify Size of Campaigns from DB Object:${sizeOfCampaignsDB}`)
    influxdb(200, `size_of_campaigns_db_${sizeOfCampaignsDB}`)

    const sizeOfCampaignsRedis: number = await getFileSize(IRecipeType.CAMPAIGNS)
    consola.info(`Identify Size of Campaigns from Redis:${sizeOfCampaignsRedis}`)

    if (sizeOfCampaignsDB === sizeOfCampaignsRedis) {
      consola.info(`Size of Campaigns in Redis the same like in DB :${sizeOfCampaignsDB}, don't need create recipe`)
      return
    }
    consola.info(`Size of Campaigns from Redis and DB is different, lets create the recipe, sizeOfCampaignsDB:${sizeOfCampaignsDB}, sizeOfCampaignsRedis:${sizeOfCampaignsRedis}`)
    const filePath: string = process.env.CAMPAIGNS_RECIPE_PATH || ''

    let transformStream = JSONStream.stringify();
    let outputStream = fileSystem.createWriteStream(filePath!);

    transformStream.pipe(outputStream);

    campaignsFormat?.forEach(transformStream.write);

    transformStream.end();

    outputStream.on(
      "finish",
      async function handleFinish() {

        await compressFile(filePath!)
        await deleteFile(filePath!)
        influxdb(200, `recipe_campaigns_created`)
        consola.success(`File Campaigns (count:${campaigns?.length}) created path:${filePath} `)
      }
    )
    setTimeout(uploadFileToS3Bucket, 6000, IRecipeType.CAMPAIGNS) // 6000 -> 6 sec
    setTimeout(setFileSize, 20000, IRecipeType.CAMPAIGNS, sizeOfCampaignsDB)  // 20000 -> 20 sec

  } catch (e) {
    influxdb(500, `recipe_campaigns_create_error`)
    consola.error('create campaign recipe Error:', e)
  }
}

