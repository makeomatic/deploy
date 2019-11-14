const { echo } = require('shelljs');
const { get } = require('lodash');

exports.command = 'get-config';
exports.desc = 'return mdeprc properties';
exports.builder = async (yargs) => {
  yargs
    .option('paths', {
      describe: 'path in config',
      type: 'string',
      array: true,
      default: [],
    })
    .strict(false)
    .help();
};
exports.handler = (argv) => {
  echo(get(argv, argv.paths));
};
