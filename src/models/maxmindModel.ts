import consola from 'consola';
import { FieldPacket, Pool } from 'mysql2/promise';
import { connect } from '../db/mysql';

// eslint-disable-next-line consistent-return
export const insertMaxmind = async (data: any) => {
  try {
    const {
      // eslint-disable-next-line @typescript-eslint/naming-convention
      ip_start, ip_end, ip_int_start, ip_int_end, country_code, country,
    } = data;

    const conn: Pool = await connect();

    const sql = `
        INSERT INTO maxmind_geo_IP (ip_start, ip_end, ip_int_start, ip_int_end, country_code, country)
        VALUES (?, ?, ?, ?, ?, ?)
    `;
    const [response]: [any[], FieldPacket[]] = await conn.query(sql, [ip_start, ip_end, ip_int_start, ip_int_end, country_code, country]);
    consola.info('responseInsert:', response);
    await conn.end();
    return true;
  } catch (e) {
    consola.info('insertMaxmindErrors:', e);
  }
};

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
