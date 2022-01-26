const execa = require('execa');
const fs = require('fs/promises');
const { resolve } = require('path');

exports.command = 'bin [binary]';
exports.desc = 'return absolute path to bundled bin';
exports.builder = (yargs) => {
  return yargs
    .positional('binary', {
      describe: 'path to binary dep',
      type: 'string',
    })
    .strict(false)
    .help();
};
exports.handler = async (argv) => {
  const bin = (await execa('npm', ['bin'], { cwd: resolve(__dirname, '../..') })).stdout;
  const path = resolve(bin, argv.binary);

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
