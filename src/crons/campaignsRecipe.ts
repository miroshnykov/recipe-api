import JSONStream from "JSONStream";
import consola from "consola";
import fileSystem from "fs";
import {getCampaigns} from "../models/campaignsModel";
import {compressFile, deleteFile, memorySizeOfBite} from "../utils";
import {influxdb} from "../metrics";
import {setFileSize} from "./setFileSize";
import {IRecipeType} from "../interfaces/recipeTypes";
import {ICampaign} from "../interfaces/campaigns";
import {uploadFileToS3Bucket} from "./recipeSendToS3";

export const setCampaignsRecipe = async () => {
  try {
    let campaigns:ICampaign[] = await getCampaigns()
    let sizeOfCampaignsDB: number = memorySizeOfBite(campaigns)
    consola.info(`Identify Size of Campaigns Object:${sizeOfCampaignsDB}`)
    influxdb(200, `size_of_campaigns_db_${sizeOfCampaignsDB}`)
    const filePath: string = process.env.CAMPAIGNS_RECIPE_PATH || ''

    let transformStream = JSONStream.stringify();
    let outputStream = fileSystem.createWriteStream(filePath!);

    transformStream.pipe(outputStream);

    campaigns?.forEach(transformStream.write);

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

