#!/usr/bin/env node

let parentProject;
try {
  // eslint-disable-next-line import/no-dynamic-require
  parentProject = require(`${process.cwd()}/package.json`);
  if (!parentProject.version) {
    // eslint-disable-next-line no-console
    console.warn('package.json missing version');
  }
} catch (e) {
  throw new Error(`Must contain package.json in the current dir: ${e.message}`);
}

const version = parentProject.version || '1.0.0';

require('yargs')
  .commandDir('cmds')
  .demandCommand()
  .option('node', {
    alias: 'n',
    describe: 'node version to use when building',
    default: '7.8.0',
  })
  .option('env', {
    alias: 'E',
    describe: 'node environment to build for',
    default: 'production',
  })
  .option('project', {
    alias: 'p',
    describe: 'project name where this is used',
    default: parentProject.name
      .replace(/\//g, '-')
      .replace(/@/g, ''),
  })
  .option('version', {
    alias: 'v',
    describe: 'version of the project to build',
    default: version,
  })
  .option('pkg', {
    describe: 'package json contents',
    default: parentProject,
  })
  .coerce({
    pkg: JSON.parse,
  })
  .help()
  .argv;
