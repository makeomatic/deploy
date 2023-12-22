#!/usr/bin/env node

import path from 'node:path';
import fs from 'node:fs';
import { readPackage } from 'read-pkg';
import assert from 'node:assert/strict';
import { cosmiconfig } from 'cosmiconfig';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';

import * as binCommand from './cmds/bin.js';
import * as dockerCommand from './cmds/docker.js';
import * as getConfigCommand from './cmds/get-config.js';
import * as installCommand from './cmds/install.js';
import * as testCommand from './cmds/test.js';

const parentProject = await readPackage();
assert(parentProject && parentProject.version, 'Must contain package.json in the current dir');

// get configPath if it's there
const configExplorer = cosmiconfig('mdep', { searchStrategy: 'project' });
const configResult = await configExplorer.search();
const config = configResult !== null && !configResult.isEmpty ? configResult.config : {};

yargs(hideBin(process.argv))
  .version(false)
  .command(binCommand)
  .command(dockerCommand)
  .command(getConfigCommand)
  .command(installCommand)
  .command(testCommand)
  .demandCommand()
  .option('node', {
    alias: 'n',
    describe: 'node version to use when building',
    default: '20',
    type: 'string',
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
  .parse();
