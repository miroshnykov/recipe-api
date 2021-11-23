import {FieldPacket, Pool} from "mysql2/promise";
import {connect} from "../db/mysql";

export const insertMaxmind = async (data: any) => {
  try {
    const {ip_start, ip_end, ip_int_start, ip_int_end, country_code, country} = data

    const conn: Pool = await connect();

    let sql = `
        INSERT INTO maxmind_geo_IP (ip_start, ip_end, ip_int_start, ip_int_end, country_code, country)
        VALUES (?, ?, ?, ?, ?, ?)
    `
    const [response]: [any[], FieldPacket[]] = await conn.query(sql, [ip_start, ip_end, ip_int_start, ip_int_end, country_code, country]);
    // console.info('responseInsert:', response)
    await conn.end();
    return true
  } catch (e) {
    console.info(`insertMaxmindErrors:`, e)
  }
}

// CREATE TABLE `maxmind_geo_IP` (
//   `id` INT(1) UNSIGNED ZEROFILL NOT NULL AUTO_INCREMENT,
//   `ip_start` VARCHAR(50) NOT NULL COLLATE 'utf8_general_ci',
//   `ip_end` VARCHAR(50) NOT NULL COLLATE 'utf8_general_ci',
//   `ip_int_start` INT(1) UNSIGNED ZEROFILL NOT NULL,
//   `ip_int_end` INT(1) UNSIGNED ZEROFILL NOT NULL,
//   `country_code` VARCHAR(4) NOT NULL COLLATE 'utf8_general_ci',
//   `country` VARCHAR(100) NOT NULL COLLATE 'utf8_general_ci',
//   PRIMARY KEY (`id`, `ip_start`, `ip_end`, `ip_int_end`, `country`)
// )
// COLLATE='utf8_general_ci'
// ENGINE=InnoDB
// ;
