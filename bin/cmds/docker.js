/**
 * Contains docker lifecycle commands
 * @type {String}
 */

exports.command = 'docker <command>';
exports.desc = 'manages docker lifecycle';
exports.builder = yargs => (
  yargs.commandDir('docker_cmds')
    .option('repository', {
      alias: 'repo',
      describe: 'docker repository to use',
      default: 'makeomatic',
    })
    .option('include_node', {
      alias: 'in',
      describe: 'includes node version in the tag',
      boolean: true,
      default: true,
    })
    .option('docker_file', {
      alias: 'f',
      describe: 'path to docker file',
      default: './Dockerfile',
      normalize: true,
    })
);
exports.handler = (argv) => {
  // prepares variables
  argv.base = `${argv.repository}/${argv.project}`;
  argv.baseTag = argv.include_node ? `${argv.node}-${argv.version}` : argv.version;
  argv.project = `${argv.base}:${argv.baseTag}`;
  argv.tags = [`${argv.base}:latest`];

  // adds extra tag
  if (argv.include_node) {
    argv.tags.push(`${argv.project}:${argv.node}`);
  }
};
