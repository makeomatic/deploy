#!/usr/bin/env node

/* eslint-disable import/no-dynamic-require, no-nested-ternary */
const path = require('path');
const fs = require('fs');
const findUp = require('find-up');
const readPkg = require('read-pkg');
const assert = require('assert');

const parentProject = readPkg.sync();
assert(parentProject && parentProject.version, 'Must contain package.json in the current dir');

// get configPath if it's there
const configPath = findUp.sync(['.mdeprc', '.mdeprc.js', '.mdeprc.json']);
const config = configPath
  ? configPath.endsWith('.js')
    ? require(configPath)
    : JSON.parse(fs.readFileSync(configPath))
  : {};

require('yargs')
  .version(false)
  .commandDir('cmds')
  .demandCommand()
  .option('node', {
    alias: 'n',
    describe: 'node version to use when building',
    default: '18',
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
      .replace(/^@[^/]+\//, ''),
  })
  .option('docker_build_args', {
    alias: 'dba',
    describe: 'docker build args',
  })
  .option('docker_flags', {
    alias: 'df',
    describe: 'docker build flags',
    type: 'array',
    string: true,
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
    coerce: (arg) => JSON.parse(fs.readFileSync(path.resolve(arg))),
  })
  .config(config)
  .help()
  .strict()
  .argv;
