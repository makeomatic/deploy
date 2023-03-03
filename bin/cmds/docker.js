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
    .option('tag_latest', {
      alias: 'tl',
      describe: 'adds :latest tag to the image',
      boolean: true,
      default: false,
    })
    .option('docker_file', {
      alias: 'f',
      describe: 'path to docker file',
      default: './Dockerfile',
      normalize: true,
    })
    .option('extra_tags', {
      alias: 'T',
      describe: 'list of additional tags for the image',
      default: [],
      array: true,
    })
    .option('docker_context', {
      alias: 'c',
      default: '.',
      describe: 'docker build context path'
    })
    .strict(false)
    .help()
);
exports.handler = (argv) => {
  if (exports.called) return;

  assert.ok(typeof argv.version === 'string', `version is ${argv.version}`);

  // prepares variables
  argv.base = `${argv.repository}/${argv.project}`;
  argv.baseTag = argv.include_node ? `${argv.node}-${argv.version}` : argv.version;
  argv.mainTag = `${argv.base}:${argv.baseTag}`;
  argv.tags = argv.extra_tags.map((tag) => (
    `${argv.base}:${tag}`
  ));

  // adds extra tag
  if (argv.include_node) {
    argv.tags.push(`${argv.base}:${argv.node}`);
  }

  // adds :latest tag
  if (argv.tag_latest) {
    argv.tags.push(`${argv.base}:latest`);
  }

  // a little bit hacky
  exports.called = true;
};
