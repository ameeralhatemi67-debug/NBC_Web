import EmbeddedPostgres from 'embedded-postgres';
import { randomBytes } from 'node:crypto';
import { mkdir, mkdtemp } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
await mkdir('.data', { recursive: true });
const dir = await mkdtemp(path.resolve('.data/postgres-test-'));
const password = randomBytes(24).toString('hex');
const pg = new EmbeddedPostgres({
  databaseDir: path.join(dir, 'cluster'),
  user: 'postgres',
  password,
  port: 43189,
  persistent: true,
  authMethod: 'scram-sha-256',
  initdbFlags: ['--encoding=UTF8', '--locale=C'],
  postgresFlags: ['-h', '127.0.0.1'],
  onLog: () => {},
  onError: () => {},
});
let exitCode = 1;
try {
  await pg.initialise();
  await pg.start();
  await pg.createDatabase('nbc_security_test');
  const child = spawn(process.execPath, ['--import', 'tsx', '--test', 'tests/otp.test.ts'], {
    windowsHide: true,
    stdio: 'inherit',
    env: {
      ...process.env,
      NBC_TEST_DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:43189/nbc_security_test`,
    },
  });
  exitCode = await new Promise((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 1));
  });
  if (exitCode === 0) {
    const http = spawn(process.execPath, ['tests/production-integration.mjs'], {
      windowsHide: true,
      stdio: 'inherit',
      env: {
        ...process.env,
        NBC_TEST_DATABASE_URL: `postgresql://postgres:${password}@127.0.0.1:43189/nbc_security_test`,
      },
    });
    exitCode = await new Promise((resolve, reject) => {
      http.on('error', reject);
      http.on('exit', (code) => resolve(code ?? 1));
    });
  }
} finally {
  await pg.stop();
}
process.exit(exitCode);
