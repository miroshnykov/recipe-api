import fs from 'fs';
import { parse } from 'csv-parse';
import consola from 'consola';
import { insertMaxmind } from '../models/maxmindModel';

const maxmindReadyFOrInsert: [] = [];

export const importMaxmind = async () => {
  try {
    const filepath = '/home/miroshnykov/Documents/GeoIP-legacy.csv';
    // const filepath = '/home/miroshnykov/Documents/GeoIP-legacy-test.csv'
    let count = 0;
    // @ts-ignore
    fs.createReadStream(filepath)
      .on('error', (e: any) => {
        consola.error('error:', e);
      })
      .pipe(parse())
      .on('data', (row: any) => {
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const ip_start: string = row[0].trim() || '';
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const ip_end = row[1].trim();
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const ip_int_start = row[2].trim();
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const ip_int_end = row[3].trim();
        // eslint-disable-next-line @typescript-eslint/naming-convention
        const country_code = row[4].trim();
        const country = row[5].trim();

        const obj = {
          ip_start,
          ip_end,
          ip_int_start,
          ip_int_end,
          country_code,
          country,
        };
        // console.log('obj:',obj)
        count++;
        consola.info(count);
        // @ts-ignore
        maxmindReadyFOrInsert.push(obj);
      })

      .on('end', () => {
        consola.info('finnish count:', maxmindReadyFOrInsert.length);
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        setTimeout(processData, 3000, maxmindReadyFOrInsert);
      });

    return {
      success: true,
      maxmindReadyFOrInsert,
    };
  } catch (e) {
    return {
      success: false,
    };
  }
};

const insertDBIpAddress = async (record: any) => insertMaxmind(record);

const processData = async (items: any) => {
  consola.info('start insert records to DB ');
  let count = 0;
  await Promise.all(items.map(async (item:any) => {
    const res = await insertDBIpAddress(item);
    if (res) {
      count++;
    }
  }));
  consola.info('Insert records:', count);
};

// DELETE FROM maxmind_geo_IP
