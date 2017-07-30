#!/usr/bin/env node

/* eslint-disable import/no-dynamic-require, no-console */

const debug = require('debug')('github-post-release');
const path = require('path');
const fs = require('fs');

const isForced = process.argv.some(a => a === '--force');

function amIaDependency() {
  const cwd = typeof __dirname !== 'undefined' && __dirname
    ? path.resolve(__dirname, '..')
    : process.cwd();
  const parts = cwd.split(path.sep);
  const parentFolder = parts[parts.length - 2];
  const scopedParentFodler = parts[parts.length - 3];
  return parentFolder === 'node_modules' || scopedParentFodler === 'node_modules';
}

if (!amIaDependency() && !isForced) {
  // top level install (we are running `npm i` in this project)
  debug('we are installing own dependencies');
  process.exit(0);
}

debug('installing this module as a dependency');

function clientPackageJsonFilename() {
  return path.join(process.cwd(), '..', '..', '..', 'package.json');
}

function gitItOldModules(name) {
  return path.join(process.cwd(), '..', '..', '..', 'node_modules', 'git-it', 'node_modules', name);
}

function alreadyInstalled(scriptName, script, holder) {
  const filename = clientPackageJsonFilename();
  const pkg = JSON.parse(fs.readFileSync(filename));
  if (!pkg[holder] || !pkg[holder][scriptName] || pkg[holder][scriptName] !== script) {
    return false;
  }

  return true;
}

function addPlugin(scriptName, script, holder) {
  const filename = clientPackageJsonFilename();
  const pkg = JSON.parse(fs.readFileSync(filename));

  // default this to {}
  if (!pkg[holder]) pkg[holder] = {};

  pkg[holder][scriptName] = script;
  const text = `${JSON.stringify(pkg, null, 2)}\n`;
  fs.writeFileSync(filename, text, 'utf8');
  console.log(`✅  set ${holder}.${scriptName} to "${script}" in`, filename);
}

[
  ['analyzeCommits', 'simple-commit-message', 'release'],
  ['generateNotes', 'github-post-release', 'release'],
  ['verifyConditions', '@makeomatic/condition-semaphore', 'release'],
  ['getLastRelease', '@makeomatic/last-release-npm', 'release'],
  ['branch', 'master', 'release'],
  ['semantic-release', 'semantic-release pre && npm publish && semantic-release post', 'scripts'],
  ['commit', 'simple-commit-message', 'scripts'],
].forEach((input) => {
  const [scriptName, name, holder] = input;
  if (!alreadyInstalled(scriptName, name, holder)) {
    console.log(`⚠️  Installing ${holder}.${scriptName} plugin ${name}`);
    addPlugin(scriptName, name, holder);
  }
});

console.log('⚠️ Use "semantic-release-cli setup" to complete setting up semantic-release');
console.log('⚠️ For scoped packages add {"publishConfig":{"access": "public"}} to package.json');

if (fs.existsSync(gitItOldModules('simple-commit-message'))) {
  console.log('⚠️ Removed "simple-commit-message" from git-it dependencies');
  fs.rmdirSync(gitItOldModules('simple-commit-message'));
}
