import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createServer } from 'node:net';
const reservation = createServer();
await new Promise((resolve) => reservation.listen(0, '127.0.0.1', resolve));
const port = reservation.address().port;
await new Promise((resolve) => reservation.close(resolve));
await mkdir('.data', { recursive: true });
const dir = await mkdtemp(path.resolve('.data/postgres-test-'));
const password = randomBytes(24).toString('hex');
let clusterLog = '';
const pg = new EmbeddedPostgres({
  databaseDir: path.join(dir, 'cluster'),
  user: 'postgres',
  password,
  port,
  persistent: true,
  authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: (message) => {
    clusterLog += message;
  },
  onError: () => {},
});
let exitCode = 1;
let completed = false;
process.on('exit', () => {
  if (!completed) process.exitCode = 1;
});
try {
  console.log('Starting disposable PostgreSQL cluster.');
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('nbc_security_test');
  const child = spawn(process.execPath, ['--import', 'tsx', '--test', 'tests/otp.test.ts'], {
    windowsHide: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      NBC_TEST_DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/nbc_security_test`,
    },
  });
  exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
  if (exitCode === 0) {
    await pg.createDatabase('nbc_engine_test');
    const engine = spawn(
      process.execPath,
      ['--import', 'tsx', '--test', 'tests/competition.test.ts', 'tests/migrations.test.ts'],
      {
        windowsHide: true,
        stdio: 'inherit',
        env: {
          ...process.env,
          NBC_TEST_DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/nbc_engine_test`,
        },
      },
    );
    exitCode = await new Promise((resolve, reject) => {
      engine.on('error', reject);
      engine.on('exit', (code) => resolve(code ?? 1));
    });
  }
  if (exitCode === 0) {
    await pg.createDatabase('nbc_storage_test');
    const storage = spawn(process.execPath, ['--import', 'tsx', 'tests/private-storage.mjs'], {
      windowsHide: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        NBC_TEST_DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/nbc_storage_test`,
      },
    });
    exitCode = await new Promise((resolve, reject) => {
      storage.on('error', reject);
      storage.on('exit', (code) => resolve(code ?? 1));
    });
  }
  if (exitCode === 0) {
    const http = spawn(process.execPath, ['tests/production-integration.mjs'], {
      windowsHide: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        NBC_TEST_DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:${port}/nbc_security_test`,
      },
    });
    exitCode = await new Promise((resolve, reject) => {
      http.on('error', reject);
      http.on('exit', (code) => resolve(code ?? 1));
    });
  }
  completed = exitCode === 0;
  if (completed)
    console.log(
      'PostgreSQL verification completed: OTP, competition/migrations, private grants and production HTTP phases passed.',
    );
} catch {
  exitCode = 1;
  console.error('PostgreSQL verification failed before all phases completed.');
  // Cluster logs contain only local database startup diagnostics, never connection URLs.
  console.error(clusterLog.replaceAll(password, '[redacted]').slice(-2500));
} finally {
  await pg.stop();
}
process.exit(exitCode);
