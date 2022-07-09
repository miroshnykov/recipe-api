import fileSystem from 'node:fs';
import consola from 'consola';
import { influxdb } from '../../../metrics';

export const appendToLocalFile = (filePath: string, data: any) => new Promise((resolve, reject) => {
  fileSystem.appendFile(filePath, data, (err: any) => {
    if (err) {
      influxdb(500, 'append_to_local_file_error');
      consola.error(`appendToLocalFileError ${filePath}:`, err);
      reject(err);
    }
    resolve(filePath);
  });
});
