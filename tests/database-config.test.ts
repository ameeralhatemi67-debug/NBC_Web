import assert from 'node:assert/strict';
import { test } from 'node:test';
import { postgresPoolConfig } from '../src/lib/database-config';

test('a custom database CA requires certificate verification', () => {
  const config = postgresPoolConfig(
    'postgresql://app:example@db.example:6543/postgres',
    'trusted-ca',
  );
  assert.deepEqual(config.ssl, { ca: 'trusted-ca', rejectUnauthorized: true });
});

test('URL SSL options cannot override a configured trusted CA', () => {
  for (const option of [
    'sslmode=disable',
    'sslmode=require',
    'sslrootcert=other.crt',
    'sslcert=other.crt',
    'sslkey=other.key',
  ])
    assert.throws(() =>
      postgresPoolConfig(`postgresql://db.example/postgres?${option}`, 'trusted-ca'),
    );
});

test('existing database URL SSL configuration is preserved without a custom CA', () => {
  const url = 'postgresql://db.example/postgres?sslmode=verify-full';
  const config = postgresPoolConfig(url);
  assert.equal(config.connectionString, url);
  assert.equal(config.ssl, undefined);
});
