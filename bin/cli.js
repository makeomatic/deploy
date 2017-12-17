#!/usr/bin/env node

const path = require('path');
const fs = require('fs');
const findUp = require('find-up');

let parentProject;
try {
  // eslint-disable-next-line import/no-dynamic-require
  parentProject = require(`${process.cwd()}/package.json`);
  if (!parentProject.version) {
    throw new Error('package.json missing version');
  }
} catch (e) {
  throw new Error(`Must contain package.json in the current dir: ${e.message}`);
}

// get configPath if it's there
const configPath = findUp.sync(['.mdeprc', '.mdeprc.js', '.mdeprc.json']);
// eslint-disable-next-line import/no-dynamic-require
const config = configPath ? JSON.parse(fs.readFileSync(configPath)) : {};

require('yargs')
  .version(false)
  .commandDir('cmds')
  .demandCommand()
  .option('node', {
    alias: 'n',
    describe: 'node version to use when building',
    default: '9.2.0',
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
      .replace(/^@[^/]\//, ''),
  })
  .option('repository', {
    alias: 'repo',
    describe: 'docker repository to use',
    default: parentProject.name
      .replace(/^(?:@([^/]+)?\/)?.*$/, '$1') || 'makeomatic',
  })
  .option('version', {
    alias: 'v',
    describe: 'version of the project to build',
    default: parentProject.version,
  })
  .option('pkg', {
    describe: 'package json path',
    default: `${process.cwd()}/package.json`,
  })
  .coerce({
    pkg: arg => JSON.parse(fs.readFileSync(path.resolve(arg))),
  })
  .config(config)
  .help()
  .argv;
