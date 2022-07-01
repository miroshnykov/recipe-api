import file, { promises as fs } from 'node:fs';
import consola from 'consola';
import zlib from 'node:zlib';
import crypto from 'node:crypto';
import * as dotenv from 'dotenv';

dotenv.config();
const encLength: number = Number(process.env.ENCRIPTION_IV_LENGTH);
const encKey: string = process.env.ENCRIPTION_KEY || '';
export const encrypt = (text: string) => {
  const iv = crypto.randomBytes(encLength);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(encKey), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return `${iv.toString('hex')}:${encrypted.toString('hex')}`;
};

export const decrypt = (text: string) => {
  const textParts = text.split(':');
  // @ts-ignore
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(encKey), iv);
  let decrypted = decipher.update(encryptedText);

  decrypted = Buffer.concat([decrypted, decipher.final()]);

  return decrypted.toString();
};

// eslint-disable-next-line consistent-return
export const getFileSize = async (filename: string) => {
  try {
    const stats = await fs.stat(filename);
    return Number(stats?.size) || 0;
  } catch (e) {
    consola.error('File Size:', e);
  }
};

export const compressFile = (fileName: string) => new Promise((resolve) => {
  const read = file.createReadStream(fileName);
  const write = file.createWriteStream(`${fileName}.gz`);
  const compress = zlib.createGzip();
  read.pipe(compress).pipe(write);
  // eslint-disable-next-line consistent-return
  compress.on('unpipe', (compression) => {
    // eslint-disable-next-line no-underscore-dangle
    if (compression._readableState.ended === true) {
      // eslint-disable-next-line @typescript-eslint/no-shadow
      return new Promise((resolve) => {
        write.on('finish', () => {
          resolve(write);
        });
      }).then(() => {
        resolve(fileName);
      }).catch((err) => {
        consola.error(`compressFile unpipe error fileName:${fileName}`, err);
      });
    }
  });
  compress.on('errors', (err) => {
    consola.error(`compressFile compress error: fileName:${fileName}`, err);
  });
  write.on('error', (err) => {
    consola.error(`compressFile write error: fileName:${fileName}`, err);
  });
}).catch((err) => {
  consola.error(`compressFile fileName:${fileName}`, err);
});

export const deleteFile = (filePath: string) => new Promise((resolve, reject) => {
  file.unlink(filePath, (err) => {
    if (err) {
      consola.error(err);
      reject(filePath);
    } else {
      consola.success(`delete file:${filePath}`);
      resolve(filePath);
    }
  });
});

export const getLocalFiles = (localFolder: string): Promise<string[]> => new Promise((resolve, reject) => {
  file.readdir(localFolder, (err, files: string[]) => {
    if (err) {
      // eslint-disable-next-line prefer-promise-reject-errors
      return reject([]);
    }
    return resolve(files);
  });
});
export const memorySizeOfBite = <T extends object>(obj: T): number => {
  let bytes: number = 0;

  // eslint-disable-next-line @typescript-eslint/no-shadow
  const sizeOf = (obj: any) => {
    if (obj !== null && obj !== undefined) {
      // eslint-disable-next-line default-case
      switch (typeof obj) {
        case 'number':
          bytes += 8;
          break;
        case 'string':
          bytes += obj.length * 2;
          break;
        case 'boolean':
          bytes += 4;
          break;
        case 'object':
          // eslint-disable-next-line no-case-declarations
          const objClass = Object.prototype.toString.call(obj).slice(8, -1);
          if (objClass === 'Object' || objClass === 'Array') {
            for (const key in obj) {
              // eslint-disable-next-line no-prototype-builtins,no-continue
              if (!obj.hasOwnProperty(key)) continue;
              sizeOf(obj[key]);
            }
          } else bytes += obj.toString().length * 2;
          break;
      }
    }
    return bytes;
  };

  return sizeOf(obj);
};

export const millisToMinutesAndSeconds = (ms: number) => {
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  // @ts-ignore
  return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
};

export const rangeSpeed = (ms: number): number => {
  switch (true) {
    case ms < 20000:
      return 20000;
    case ms > 20000 && ms < 60000:
      return 60000; // 1m
    case ms > 60001 && ms < 120000:
      return 120000; // 2m
    case ms > 120001 && ms < 180000:
      return 180000; // 3m
    case ms > 180001 && ms < 300000:
      return 300000; // 5m
    default:
      return 300000;
  }
};
