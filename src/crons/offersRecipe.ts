import JSONStream from "JSONStream";
import consola from "consola";
import fileSystem from "fs";
import {uploadOffersFileToS3Bucket} from "./offersRecipeSendToS3";
import {compressFile, deleteFile} from "../utils";
import {getOffers} from "../models/offersModel";
import {setFileSizeOffers} from "./offersFileSize";

export const setOffersRecipe = async () => {

  try {
    let offers = await getOffers()

    const filePath: string | undefined = process.env.OFFERS_RECIPE_PATH

    let transformStream = JSONStream.stringify();
    let outputStream = fileSystem.createWriteStream(filePath!);

    transformStream.pipe(outputStream);

    offers?.forEach(transformStream.write);

    transformStream.end();

    outputStream.on(
      "finish",
      async function handleFinish() {

        await compressFile(filePath!)
        await deleteFile(filePath!)
        consola.success(`File Offers(count:${offers?.length}) created path:${filePath} `)
      }
    )
    setTimeout(uploadOffersFileToS3Bucket, 6000)
    setTimeout(setFileSizeOffers, 10000)

  } catch (e) {
    consola.error('create offers recipe Error:', e)
  }

}
