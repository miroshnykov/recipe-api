import { FieldPacket, Pool } from 'mysql2/promise';
import consola from 'consola';
import { connect } from '../db/mysql';
import { influxdb } from '../metrics';

// eslint-disable-next-line consistent-return
export const getAffiliates = async () => {
  try {
    const conn: Pool = await connect();

    const sql = `
        SELECT a.id as affiliate_id, 
               a.name, 
               a.email, 
               a.status, 
               COALESCE(a.affiliate_type,'') as affiliate_type,
               DATE_FORMAT(a.date_added, '%Y-%m-%d') AS date_added
        FROM sfl_affiliates a
    `;
    const [affiliates]: [any[], FieldPacket[]] = await conn.query(sql);
    await conn.end();

    return affiliates;
  } catch (e) {
    consola.error('getAffiliatesError:', e);
    influxdb(500, 'get_affiliates_error');
  }
};
