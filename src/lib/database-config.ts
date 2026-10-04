import type { PoolConfig } from 'pg';
import { AppError } from './domain';

export function postgresPoolConfig(connectionString: string, ca?: string): PoolConfig {
  if (ca) {
    // pg URL SSL parameters replace the ssl object, including its trusted CA.
    const url = new URL(connectionString);
    if (['sslmode', 'sslcert', 'sslkey', 'sslrootcert'].some((key) => url.searchParams.has(key)))
      throw new AppError('أزل خيارات SSL من DATABASE_URL عند استخدام DATABASE_SSL_CA.', 503);
  }
  return {
    connectionString,
    ...(ca ? { ssl: { ca, rejectUnauthorized: true } } : {}),
    max: 3,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
    query_timeout: 20000,
    maxLifetimeSeconds: 300,
  };
}
