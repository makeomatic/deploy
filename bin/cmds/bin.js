import fs from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const command = 'bin [binary]';
export const desc = 'return absolute path to bundled bin';
export const builder = (yargs) => {
  return yargs
    .positional('binary', {
      describe: 'path to binary dep',
      type: 'string',
    })
    .strict(false)
    .help();
};
export const handler = async (argv) => {
  const path = resolve(__dirname, '../../node_modules/.bin', argv.binary);

  try {
    if ((await fs.stat(path)).isFile()) {
      process.stdout.write(`${path}\n`);
    } else {
      // eslint-disable-next-line no-console
      console.error('path %s isnt a file', path);
      process.exit(128);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('can\'t locate path %s - %o', path, e);
    process.exit(128);
  }
};
