/**
 * Contains docker lifecycle commands
 * @type {String}
 */

import * as buildCommand from './docker_cmds/build.js';
import * as pushCommand from './docker_cmds/push.js';
import * as releaseCommand from './docker_cmds/release.js';
import * as tagCommand from './docker_cmds/tag.js';

export const command = 'docker';
export const desc = 'manages docker lifecycle';
export const builder = (yargs) => (
  yargs
    .command(buildCommand)
    .command(pushCommand)
    .command(releaseCommand)
    .command(tagCommand)
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
      describe: 'docker build context path',
    })
    .strict(false)
    .help()
);
