import { PGlite } from '@electric-sql/pglite';
import { Pool } from 'pg';
import { randomUUID } from 'node:crypto';
import type { Database, Queryable } from '../src/lib/database';

export async function disposableDatabase(): Promise<Database> {
  const url = process.env.NBC_TEST_DATABASE_URL;
  if (!url) {
    const engine = new PGlite();
    return {
      kind: 'pglite',
      query: (s, a) => engine.query(s, a),
      exec: (s) => engine.exec(s),
      transaction: (run) => engine.transaction(run),
      close: () => engine.close(),
      dumpDataDir: (f) => engine.dumpDataDir(f),
    };
  }
  const target = new URL(url);
  if (
    target.hostname !== '127.0.0.1' ||
    !['/nbc_security_test', '/nbc_engine_test'].includes(target.pathname)
  )
    throw new Error('Tests require the disposable loopback PostgreSQL cluster.');
  const pool = new Pool({ connectionString: url, max: 8 });
  const schema = 'test_' + randomUUID().replaceAll('-', '');
  await pool.query(`CREATE SCHEMA ${schema}`);
  const transaction: Database['transaction'] = async (run) => {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query(`SET LOCAL search_path TO ${schema},pg_catalog`);
      await client.query("SET LOCAL lock_timeout='10s'");
      const tx: Queryable = {
        query: async (s, a) => ({ rows: (await client.query(s, a)).rows }),
        exec: (s) => client.query(s),
      };
      const r = await run(tx);
      await client.query('COMMIT');
      return r;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  };
  return {
    kind: 'postgres',
    query: (s, a) => transaction((tx) => tx.query(s, a)),
    exec: (s) => transaction((tx) => tx.exec(s)),
    transaction,
    close: async () => {
      await pool.query(`DROP SCHEMA ${schema} CASCADE`);
      await pool.end();
    },
    dumpDataDir: async () => {
      throw new Error('Use managed backups');
    },
  };
}
