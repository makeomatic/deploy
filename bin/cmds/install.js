import { execa } from 'execa';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

export const command = 'install';
export const desc = 'install husky, performs auto migration';
export const handler = async () => {
  const proc = execa('node', [resolve(__dirname, '../../scripts/setup-semantic-release.mjs')], { all: true, buffer: false });
  proc.all.pipe(process.stdout);
  await proc;
};
export const builder = (yargs) => {
  return yargs
    .strict(false)
    .help();
};
