import consola from 'consola';
import { FieldPacket, Pool } from 'mysql2/promise';
import { connect } from '../db/mysql';

export const insertBrokenLinks = async (data: any) => {
  try {
    const {
      entityId, entityType, details, errors,
    } = data;
    const date = new Date();
    // eslint-disable-next-line no-bitwise
    const dateAdd = ~~(date.getTime() / 1000);

    const conn: Pool = await connect();

    const sql = `
        INSERT INTO sfl_traffic_links_test (entity_id, entity_type, details, errors, date_added)
        VALUES (?, ?, ?, ?,?) 
    `;
    const [response]: [any[], FieldPacket[]] = await conn.query(sql, [entityId, entityType, details, errors, dateAdd]);
    consola.info('responseInsert:', response);
    await conn.end();
  } catch (e) {
    consola.info('insertBrokenLinksErrors:', e);
  }
};
