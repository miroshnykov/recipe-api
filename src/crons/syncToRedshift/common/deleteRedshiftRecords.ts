import consola from 'consola';
import { pool } from '../../../db/redshift';
import { influxdb } from '../../../metrics';
import { IRedshiftTables } from '../../../interfaces/recipeTypes';

export const deleteRedshift = async (table: IRedshiftTables): Promise<boolean> => {
  try {
    const client = await pool.connect();
    const query = `delete ${process.env.REDSHIFT_SCHEMA}.${table}`;
    await client.query(query);
    client.release();
    consola.info(`[${table.toUpperCase()}] All records from table  ${process.env.REDSHIFT_SCHEMA}.${table} was deleted`);
    influxdb(200, `delete_redshift_${table}`);
    return true;
  } catch (e: any) {
    consola.error(`[${table.toUpperCase()}] delete${table.toUpperCase()}Error:`, e.toString());
    influxdb(500, `delete_redshift_${table}_error`);
    return false;
  }
};
