const { get } = require('lodash');

exports.command = 'get-config';
exports.desc = 'return mdeprc properties';
exports.builder = async (yargs) => {
  yargs
    .option('path', {
      describe: 'path in config',
      type: 'string',
    })
    .strict(false)
    .help();
};
exports.handler = (argv) => {
  console.info(get(argv, argv.path));
};
