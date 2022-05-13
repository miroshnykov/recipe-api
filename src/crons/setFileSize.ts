import consola from 'consola';
import { redis } from '../redis';
import { IRecipeType } from '../interfaces/recipeTypes';
import { influxdb } from '../metrics';

export const setFileSize = async (type: IRecipeType, sizeDB: number) => {
  try {
    consola.info(`set ${type}Size:${sizeDB} to Redis`);
    influxdb(200, `set_file_size_redis_${type}_${sizeDB}`);
    await redis.set(`${type}SizeRecipe`, sizeDB!);
  } catch (e) {
    consola.error(`setFileSize${type}:`, e);
    influxdb(500, `set_file_size_redis_${type}_error`);
  }
};
