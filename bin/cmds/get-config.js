const get = require('lodash.get');

exports.command = 'get-config [path]';
exports.desc = 'return mdeprc properties';
exports.builder = async (yargs) => {
  yargs
    .positional('path', {
      describe: 'path in config',
      type: 'string',
    })
    .option('path', {
      describe: 'path in config',
      type: 'string',
    })
    .strict(false)
    .help();
};
exports.handler = (argv) => {
  console.info(get(argv, argv.path)); // eslint-disable-line no-console
};
