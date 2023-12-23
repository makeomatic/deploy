import get from 'lodash.get';

export const command = 'get-config [path]';
export const desc = 'return mdeprc properties';
export const builder = (yargs) => {
  return yargs
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
export const handler = (argv) => {
  console.info(get(argv, argv.path)); // eslint-disable-line no-console
};
