#!/usr/bin/env node

const latestVersion = require('latest-version');

let parentProject;
try {
  // eslint-disable-next-line import/no-dynamic-require
  parentProject = require(`${process.cwd()}/package.json`);
} catch (e) {
  throw new Error(`Must contain package.json in the current dir: ${e.message}`);
}

return latestVersion(parentProject.name)
  .catch(() => parentProject.version)
  .then(version => (
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
        default: parentProject.version || version,
      })
      .help()
      .argv
  ));
