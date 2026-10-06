// Verification must not read operator environment files. Next treats them as absent.
const fs = require('node:fs');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { syncBuiltinESMExports } = require('node:module');
function isEnvironmentFile(value) {
  const name = value instanceof URL ? fileURLToPath(value) : String(value);
  return path.basename(name).startsWith('.env');
}
function absent() {
  const error = new Error('Environment files are unavailable during local UX verification.');
  error.code = 'ENOENT';
  return error;
}
const exists = fs.existsSync;
fs.existsSync = function (file) {
  return isEnvironmentFile(file) ? false : exists.call(this, file);
};
for (const method of ['statSync', 'lstatSync', 'readFileSync', 'openSync']) {
  const original = fs[method];
  fs[method] = function (file, ...args) {
    if (isEnvironmentFile(file)) throw absent();
    return original.call(this, file, ...args);
  };
}
for (const method of ['stat', 'lstat', 'readFile', 'open']) {
  const original = fs[method];
  fs[method] = function (file, ...args) {
    if (isEnvironmentFile(file)) {
      const callback = args.at(-1);
      queueMicrotask(() => callback(absent()));
      return;
    }
    return original.call(this, file, ...args);
  };
  const promiseOriginal = fs.promises[method];
  fs.promises[method] = async function (file, ...args) {
    if (isEnvironmentFile(file)) throw absent();
    return promiseOriginal.call(this, file, ...args);
  };
}
syncBuiltinESMExports();
