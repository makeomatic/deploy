const execa = require('execa');
const { resolve } = require('path');

exports.command = 'install';
exports.desc = 'install husky, performs auto migration';
exports.handler = async () => {
  const proc = execa('node', [resolve(__dirname, '../../scripts/setup-semantic-release.js')], { all: true, buffer: false });
  proc.all.pipe(process.stdout);
  await proc;
};
exports.builder = (yargs) => {
  return yargs
    .strict(false)
    .help();
};
