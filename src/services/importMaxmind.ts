import fs from "fs";
import {parse} from "csv-parse"
import consola from "consola";
import {insertMaxmind} from "../models/maxmindModel";

const maxmindReadyFOrInsert: [] = []

export const importMaxmind = async () => {
  try {
    const filepath = '/home/miroshnykov/Documents/GeoIP-legacy.csv'
    //const filepath = '/home/miroshnykov/Documents/GeoIP-legacy-test.csv'
    let count = 0
    // @ts-ignore
    fs.createReadStream(filepath)
      .on('error', (e: any) => {
        consola.error('error:', e)
      })
      .pipe(parse())
      .on('data', (row: any) => {
        let ip_start: string = row[0].trim() || ''
        let ip_end = row[1].trim()
        let ip_int_start = row[2].trim()
        let ip_int_end = row[3].trim()
        let country_code = row[4].trim()
        let country = row[5].trim()


        let obj = {
          ip_start,
          ip_end,
          ip_int_start,
          ip_int_end,
          country_code,
          country,
        }
        // console.log('obj:',obj)
        count++
        consola.info(count)
        // @ts-ignore
        maxmindReadyFOrInsert.push(obj)
      })

      .on('end', () => {
        console.info('finnish count:', maxmindReadyFOrInsert.length)
        setTimeout(processData,3000, maxmindReadyFOrInsert)

      })

    return {
      success: true,
      maxmindReadyFOrInsert: maxmindReadyFOrInsert
    }
  } catch (e) {
    return {
      success: false
    }
  }
}

const processData = async (items: any) => {

  console.info('start insert records to DB ')
  let count = 0
  for (const item of items) {
    let res = await insertDBIpAddress(item)
    if (res) {
      count++
    }
  }
  consola.info('Insert records:', count)

}
const insertDBIpAddress = async (record: any) => {
  return await insertMaxmind(record)
}

// DELETE FROM maxmind_geo_IP