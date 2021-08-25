import zlib from "zlib";
import fs from "fs";
import JSONStream from "JSONStream";
import consola from "consola";
import fileSystem from "fs";
import {getCampaigns} from "../models/campaignsModel";
import {compressFile, deleteFile} from "../utils";
import {uploadCampaignsFileToS3Bucket} from "./campaignsRecipeSendToS3";
import {setOffersRecipe} from "./offersRecipe";
import {setFileSizeOffers} from "./offersFileSize";
import {setFileSizeCampaigns} from "./campaignsFileSize";

export const setCampaignsRecipe = async () => {

  try {
    let campaigns = await getCampaigns()

    const filePath: string | undefined = process.env.CAMPAIGNS_RECIPE_PATH

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
        consola.success(`File Campaigns (count:${campaigns?.length}) created path:${filePath} `)
      }
    )
    setTimeout(uploadCampaignsFileToS3Bucket, 6000) // 6000 -> 6 sec
    setTimeout(setFileSizeCampaigns, 20000)  // 20000 -> 2 sec

  } catch (e) {
    consola.error('create campaign recipe Error:', e)
  }

}

