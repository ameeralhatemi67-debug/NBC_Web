import { Pool } from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { AppError } from './domain';
import { isProduction, requireLocalMode } from './runtime';
import { postgresPoolConfig } from './database-config';

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
export async function connectDatabase(options: { operator?: boolean } = {}): Promise<Database> {
  if (process.env.DATABASE_URL) {
    const schema = process.env.NBC_DATABASE_SCHEMA || 'public';
    if (process.env.NBC_SUPABASE_PROJECT_REF) {
      const url = new URL(process.env.DATABASE_URL);
      const ref = 'eerfhnaduachqluowsdo';
      const username = decodeURIComponent(url.username);
      const directUser = options.operator ? 'postgres' : 'nbc_runtime';
      const pooledUser = `${directUser}.${ref}`;
      if (
        process.env.NBC_SUPABASE_PROJECT_REF !== ref ||
        schema !== 'nbc' ||
        !(
          (url.hostname === `db.${ref}.supabase.co` && username === directUser) ||
          (url.hostname === 'aws-1-eu-central-1.pooler.supabase.com' && username === pooledUser)
        ) ||
        !process.env.DATABASE_SSL_CA
      )
        throw new AppError('اتصال NBC لا يطابق المشروع المعتمد.', 503);
    }
    if (!/^[a-z][a-z0-9_]{0,62}$/.test(schema))
      throw new AppError('مخطط قاعدة البيانات غير صالح.', 503);
    const pool = new Pool(
      postgresPoolConfig(process.env.DATABASE_URL, process.env.DATABASE_SSL_CA),
    );
    pool.on('error', () => console.error('NBC database connection failure'));
    // A transaction pooler may change backend connections after COMMIT. Set the
    // schema inside every transaction, including single-statement operations.
    const transaction: Database['transaction'] = async (run) => {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(`SET LOCAL search_path TO "${schema}", pg_catalog`);
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
    };
    return {
      kind: 'postgres',
      query: (sql, params) => transaction((tx) => tx.query(sql, params)),
      exec: (sql) => transaction((tx) => tx.exec(sql)),
      close: () => pool.end(),
      async dumpDataDir() {
        throw new AppError('استخدم النسخ الاحتياطي المدار لقاعدة PostgreSQL.', 409);
      },
      transaction,
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
