#!/usr/bin/env node

/* eslint-disable import/no-dynamic-require, no-console */

const debug = require('debug')('makeomatic:deploy');
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

function equal(a, b) {
  if (a === b) return true;

  const arrA = Array.isArray(a);
  const arrB = Array.isArray(b);
  let i;

  if (arrA && arrB) {
    if (a.length !== b.length) return false;
    for (i = 0; i < a.length; i += 1) { if (!equal(a[i], b[i])) return false; }
    return true;
  }

  if (arrA !== arrB) return false;

  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = Object.keys(a);
    if (keys.length !== Object.keys(b).length) return false;

    const dateA = a instanceof Date;
    const dateB = b instanceof Date;
    if (dateA && dateB) return a.getTime() === b.getTime();
    if (dateA !== dateB) return false;

    const regexpA = a instanceof RegExp;
    const regexpB = b instanceof RegExp;
    if (regexpA && regexpB) return a.toString() === b.toString();
    if (regexpA !== regexpB) return false;

    for (i = 0; i < keys.length; i += 1) { if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false; }

    for (i = 0; i < keys.length; i += 1) { if (!equal(a[keys[i]], b[keys[i]])) return false; }

    return true;
  }

  return false;
}

function alreadyInstalled(scriptName, script, holder) {
  const filename = clientPackageJsonFilename();
  const pkg = JSON.parse(fs.readFileSync(filename));
  if (!pkg[holder] || !pkg[holder][scriptName] || equal(pkg[holder][scriptName], script) !== true) {
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
  ['analyzeCommits', {
    preset: 'angular',
    releaseRules: [
      { type: 'docs', release: 'patch' },
      { type: 'refactor', release: 'patch' },
      { type: 'style', release: 'patch' },
      { type: 'minor', release: 'minor' },
      { type: 'patch', release: 'patch' },
      { type: 'major', release: 'major' },
      { type: 'breaking', release: 'major' },
    ],
  }, 'release'],
  ['verifyConditions', ['@semantic-release/npm', '@semantic-release/github'], 'release'],
  ['branch', 'master', 'release'],
  ['semantic-release', 'semantic-release', 'scripts'],
].forEach((input) => {
  const [scriptName, name, holder] = input;
  if (!alreadyInstalled(scriptName, name, holder)) {
    console.log(`⚠️  Installing ${holder}.${scriptName} plugin ${name}`);
    addPlugin(scriptName, name, holder);
  }
});

console.log('⚠️ Use "semantic-release-cli setup" to complete setting up semantic-release');
console.log('⚠️ For scoped packages add {"publishConfig":{"access": "public"}} to package.json');
