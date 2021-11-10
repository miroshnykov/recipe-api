import {FieldPacket, Pool} from "mysql2/promise";
import {connect} from "../db/mysql";

export const insertBrokenLinks = async (data: any) => {
  try {
    const {entityId, entityType, details, errors} = data
    let date = new Date()
    let dateAdd = ~~(date.getTime() / 1000)

    const conn: Pool = await connect();

    let sql = `
        INSERT INTO sfl_traffic_links_test (entity_id, entity_type, details, errors, date_added)
        VALUES (?, ?, ?, ?,?) 
    `
    const [response]: [any[], FieldPacket[]] = await conn.query(sql, [entityId, entityType, details, errors, dateAdd]);
    // console.info('responseInsert:', response)
    await conn.end();
  } catch (e) {
    console.info(`insertBrokenLinksErrors:`, e)
  }
}