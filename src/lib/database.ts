import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from './domain';
import { isProduction, requireLocalMode } from './runtime';

export interface Queryable {
  query<T = Record<string, unknown>>(sql: string, params?: unknown[]): Promise<{ rows: T[] }>;
  exec(sql: string): Promise<unknown>;
}
export interface Database extends Queryable {
  kind: 'postgres' | 'pglite';
  transaction<T>(run: (tx: Queryable) => Promise<T>): Promise<T>;
  close(): Promise<void>;
  dumpDataDir(format: 'gzip'): Promise<Blob>;
}
export async function connectDatabase(): Promise<Database> {
  if (process.env.DATABASE_URL) {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: 10,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 30000,
    });
    pool.on('error', () => console.error('NBC database connection failure'));
    const query: Queryable['query'] = async (sql, params) => ({
      rows: (await pool.query(sql, params)).rows,
    });
    return {
      kind: 'postgres',
      query,
      exec: (sql) => pool.query(sql),
      close: () => pool.end(),
      async dumpDataDir() {
        throw new AppError('استخدم النسخ الاحتياطي المدار لقاعدة PostgreSQL.', 409);
      },
      async transaction(run) {
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          await client.query("SET LOCAL statement_timeout = '15000ms'");
          await client.query("SET LOCAL lock_timeout = '10000ms'");
          const result = await run({
            query: async (sql, params) => ({ rows: (await client.query(sql, params)).rows }),
            exec: (sql) => client.query(sql),
          });
          await client.query('COMMIT');
          return result;
        } catch (error) {
          await client.query('ROLLBACK');
          throw error;
        } finally {
          client.release();
        }
      },
    };
  }
  if (isProduction()) throw new AppError('قاعدة بيانات الإنتاج غير مهيأة.', 503);
  requireLocalMode();
  const dir = path.resolve(/* turbopackIgnore: true */ process.env.NBC_DATA_DIR || '.data/nbc');
  await mkdir(dir, { recursive: true });
  const db = new PGlite(dir);
  return {
    kind: 'pglite',
    query: (sql, params) => db.query(sql, params),
    exec: (sql) => db.exec(sql),
    transaction: (run) => db.transaction((tx) => run(tx)),
    close: () => db.close(),
    dumpDataDir: (format) => db.dumpDataDir(format),
  };
}
