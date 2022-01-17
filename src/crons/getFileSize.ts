import consola from 'consola';
import { redis } from '../redis';
import { IRecipeType } from '../interfaces/recipeTypes';
import { influxdb } from '../metrics';

export const getFileSize = async (type: IRecipeType) => {
  try {
    const size = await redis.get(`${type}SizeRecipe`);
    return Number(size) || 0;
  } catch (e) {
    consola.error(`getFileSizeRedis${type}:`, e);
    influxdb(500, `get_file_size_redis_${type}_error`);
    return 0;
  }
};
