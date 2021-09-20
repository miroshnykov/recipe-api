import {promises as fs} from "fs";
import consola from "consola";
import zlib from "zlib";
import file from "fs";
import crypto from "crypto";
import * as dotenv from "dotenv";

dotenv.config();
const encLength: number = Number(process.env.ENCRIPTION_IV_LENGTH)
const encKey: string = process.env.ENCRIPTION_KEY || ''
export const encrypt = (text: string) => {
  let iv = crypto.randomBytes(encLength)
  let cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encKey), iv)
  let encrypted = cipher.update(text)
  encrypted = Buffer.concat([encrypted, cipher.final()])
  return iv.toString('hex') + ':' + encrypted.toString('hex')
}

export const decrypt = (text: string) => {
  let textParts = text.split(':')
  // @ts-ignore
  let iv = Buffer.from(textParts.shift(), 'hex')
  let encryptedText = Buffer.from(textParts.join(':'), 'hex')
  let decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encKey), iv)
  let decrypted = decipher.update(encryptedText)

  decrypted = Buffer.concat([decrypted, decipher.final()])

  return decrypted.toString()
}


export const getFileSize = async (filename: string) => {
  try {
    let stats = await fs.stat(filename)
    return stats?.size | 0
  } catch (e) {
    consola.error('File Size:', e);
  }
}

export const compressFile = (fileName: string) => {

  return new Promise((resolve) => {
    let read = file.createReadStream(fileName)
    let write = file.createWriteStream(fileName + '.gz')
    let compress = zlib.createGzip()
    read.pipe(compress).pipe(write)
    compress.on('unpipe', (compression) => {
      if (compression._readableState.ended === true) {
        return new Promise((resolve) => {
          write.on('finish', () => {
            resolve(write);
          })
        }).then(() => {
          resolve(fileName)
        }).catch((err) => {
          consola.error(`compressFile unpipe error fileName:${fileName}`, err)
        })
      }
    })
    compress.on('errors', (err) => {
      consola.error(`compressFile compress error: fileName:${fileName}`, err)
    })
    write.on('error', (err) => {
      consola.error(`compressFile write error: fileName:${fileName}`, err)
    })
  }).catch((err) => {
    consola.error(`compressFile fileName:${fileName}`, err)
  })
}

export const deleteFile = (filePath: string) => {

  return new Promise((resolve, reject) => {

    file.unlink(filePath, (err) => {
      if (err) {
        consola.error(err)
        reject(filePath)
      } else {
        consola.success(`delete file:${filePath}`)
        resolve(filePath)
      }
    });
  })
};


export const getLocalFiles = (localFolder: string):Promise<string[]> => {

  return new Promise((resolve, reject) => {
    file.readdir(localFolder, (err, files: string[]) => {
      if (err) {
        return reject([])
      }
      return resolve(files);
    });
  })

};
