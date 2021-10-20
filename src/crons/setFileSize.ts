import {redis} from "../redis";
import consola from "consola";
import {IRecipeType} from "../interfaces/recipeTypes";

export const setFileSize = async (type: IRecipeType, sizeDB: number) => {
  try {
    consola.info(`set ${type}Size:${sizeDB} to Redis`)
    await redis.set(`${type}Size`, sizeDB!)
  } catch (e) {
    consola.error(`setFileSize${type}:`, e)
  }
}