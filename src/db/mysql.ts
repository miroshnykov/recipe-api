import { createPool, Pool } from 'mysql2/promise';
import * as dotenv from 'dotenv';

dotenv.config();
export async function connect(): Promise<any> {
  const connection: Pool = await createPool({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || '3306'),
    user: process.env.DB_USERNAME,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    connectionLimit: 10,
  });
  return connection;
}
