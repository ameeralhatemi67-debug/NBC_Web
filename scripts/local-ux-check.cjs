const { spawn } = require('node:child_process');
const { mkdtemp } = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
(async () => {
  const data = await mkdtemp(path.join(os.tmpdir(), 'nbc-ux-local-'));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([key]) =>
      /^(PATH|SystemRoot|WINDIR|ComSpec|PATHEXT|TEMP|TMP|USERPROFILE|APPDATA|LOCALAPPDATA|ProgramFiles|ProgramFiles\(x86\)|SystemDrive)$/i.test(
        key,
      ),
    ),
  );
  Object.assign(env, {
    NBC_RUNTIME_MODE: 'demo',
    OTP_PROVIDER: 'fake',
    NBC_DEMO_OTP: '739281',
    NBC_DATA_DIR: data,
    DATABASE_URL: '',
    VERCEL: '',
    NEXT_TELEMETRY_DISABLED: '1',
    NODE_OPTIONS: `--require "${path.join(__dirname, 'local-ux-no-env.cjs').replaceAll('\\', '/')}"`,
    PLAYWRIGHT_MODULE: 'D:/Agents/main/projects/ideas/BookQuest/node_modules/playwright',
    NBC_PREVIEW_URL: 'http://127.0.0.1:3101',
  });
  const args = process.argv.slice(2);
  const script =
    args[0] === 'node'
      ? args.slice(1)
      : [path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js'), ...args];
  console.log(
    `Local UX verification in ${root}; disposable data only; environment-file loading blocked.`,
  );
  const child = spawn(process.execPath, script, {
    cwd: root,
    env,
    windowsHide: true,
    stdio: 'inherit',
  });
  child.on('exit', (code) => (process.exitCode = code ?? 1));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
