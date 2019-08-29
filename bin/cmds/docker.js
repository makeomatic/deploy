/**
 * Contains docker lifecycle commands
 * @type {String}
 */

const assert = require('assert');

exports.called = false;
exports.command = 'docker';
exports.desc = 'manages docker lifecycle';
exports.builder = (yargs) => (
  yargs.commandDir('docker_cmds')
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
    .help()
);
exports.handler = (argv) => {
  if (exports.called) return;

  assert.ok(typeof argv.version === 'string', `version is ${argv.version}`);

  // prepares variables
  argv.base = `${argv.repository}/${argv.project}`;
  argv.baseTag = argv.include_node ? `${argv.node}-${argv.version}` : argv.version;
  argv.mainTag = `${argv.base}:${argv.baseTag}`;
  argv.tags = [`${argv.base}:latest`];

  // adds extra tag
  if (argv.include_node) {
    argv.tags.push(`${argv.base}:${argv.node}`);
  }

  // a little bit hacky
  exports.called = true;
};
