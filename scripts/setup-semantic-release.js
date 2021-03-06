#!/usr/bin/env node

/* eslint-disable no-console, no-await-in-loop */

const Promise = require('bluebird');
const util = require('util');
const debug = require('debug')('makeomatic:deploy');
const path = require('path');
const get = require('lodash.get');
const set = require('lodash.set');
const fs = require('fs');
const childProcess = require('child_process');
const stripEOF = require('strip-final-newline');

const exec = util.promisify(childProcess.execFile);
const stat = util.promisify(fs.stat);
const readFile = util.promisify(fs.readFile);
const copyFile = util.promisify(fs.copyFile);
const writeFile = util.promisify(fs.writeFile);
const isForced = process.argv.some((a) => a === '--force');

function amIaDependency() {
  const cwd = typeof __dirname !== 'undefined' && __dirname
    ? path.resolve(__dirname, '..')
    : process.cwd();
  const parts = cwd.split(path.sep);
  const parentFolder = parts[parts.length - 2];
  const scopedParentFodler = parts[parts.length - 3];
  return parentFolder === 'node_modules' || scopedParentFodler === 'node_modules';
}

function rootDir() {
  return path.resolve(process.cwd(), '../../..');
}

function clientPackageJsonFilename() {
  return path.resolve(rootDir(), 'package.json');
}

async function yarnGlobalDir() {
  try {
    const { stdout } = await exec('yarn', ['global', 'dir']);
    return stripEOF(stdout);
  } catch (e) {
    return null;
  }
}

async function npmGlobalDir() {
  try {
    const { stdout } = await exec('npm', ['-g', 'root']);
    return path.resolve(stripEOF(stdout), '../');
  } catch (e) {
    return null;
  }
}

async function isInstallingGlobally() {
  const globalDirs = await Promise.all([
    yarnGlobalDir(),
    npmGlobalDir(),
  ]);

  debug('looking in %o for %o', globalDirs, rootDir());

  return globalDirs.includes(rootDir());
}

async function copyConfiguration(filename, _fallback = []) {
  const names = Array.isArray(_fallback) ? [filename].concat(_fallback) : [filename];
  const prefix = rootDir();
  const rcpath = path.join(prefix, filename);

  for (const name of names) {
    try {
      const datum = await stat(path.join(prefix, name));
      if (datum.isFile() === true) return; // do not overwrite
    } catch (e) {
      debug('failed to stat', e);
      // no file - write a new one down
    }
  }

  // copy over
  await copyFile(path.join(__dirname, '..', filename), rcpath);
}

async function alreadyInstalled(scriptName, script, holder) {
  const filename = clientPackageJsonFilename();
  const pkg = JSON.parse(await readFile(filename));
  if (!get(pkg, holder) || !get(pkg, holder)[scriptName]) {
    return false;
  }

  return true;
}

async function addPlugin(scriptName, script, holder) {
  const filename = clientPackageJsonFilename();
  const pkg = JSON.parse(await readFile(filename));

  set(pkg, `${holder}.${scriptName}`, script);
  const text = `${JSON.stringify(pkg, null, 2)}\n`;
  await writeFile(filename, text, 'utf8');
  console.log(`✅  set ${holder}.${scriptName} to "${script}" in`, filename);
}


async function main() {
  if ((!amIaDependency() || await isInstallingGlobally()) && !isForced) {
    // top level install (we are running `npm i` in this project)
    debug('we are installing own dependencies');
    process.exit(0);
  }

  debug('installing this module as a dependency');

  const scripts = [
    ['semantic-release', 'semantic-release', 'scripts'],
    ['commit-msg', 'commitlint -e $HUSKY_GIT_PARAMS', 'husky.hooks'],
    ['prepare-commit-msg', './node_modules/@makeomatic/deploy/git-hooks/prepare-commit-msg $HUSKY_GIT_PARAMS', 'husky.hooks'],
  ];

  for (const [scriptName, name, holder] of scripts) {
    if (!await alreadyInstalled(scriptName, name, holder)) {
      console.log(`⚠️  Installing ${holder}.${scriptName} plugin ${name}`);
      await addPlugin(scriptName, name, holder);
    }
  }

  await copyConfiguration('.releaserc.json', ['.releaserc.js']);
  await copyConfiguration('.commitlintrc.js');

  console.log('⚠️ Use "semantic-release-cli setup" to complete setting up semantic-release');
  console.log('⚠️ For scoped packages add {"publishConfig":{"access": "public"}} to package.json');
}

(async () => {
  try {
    await main();
  } catch (e) {
    console.error(e);
    process.exit(128);
  }
})();
