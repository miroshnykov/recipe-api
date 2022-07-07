import consola from 'consola';
import { uploadFileToS3Bucket } from '../../recipeSendToS3';
import { deleteRedshift } from './deleteRedshiftRecords';
import { copyS3ToRedshift } from './copyS3ToRedshif';
import { setFileSize } from '../../setFileSize';
import { IUploadS3 } from '../../../interfaces/syncToRedshift/uploadS3';

export const uploadS3SetSize = async (
  params: IUploadS3,
) => {
  const s3Success: boolean | undefined = await uploadFileToS3Bucket(params.type);
  if (s3Success) {
    const deleteSuccess: boolean = await deleteRedshift(params.table);
    if (deleteSuccess) {
      const redshiftSuccess: boolean = await copyS3ToRedshift(params.pathS3, params.type, params.table);
      if (redshiftSuccess) {
        consola.info(`[${params.type}] File ${params.pathS3} added to redshift table ${params.table}  successfully count of records  { ${params.count} }`);
        await setFileSize(params.type, params.sizeDB);
      }
    }
  }
};
