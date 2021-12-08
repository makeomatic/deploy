#!/usr/bin/env node

/* eslint-disable no-console, no-await-in-loop */

const Promise = require('bluebird');
const util = require('util');
const debug = require('debug')('makeomatic:deploy');
const path = require('path');
const get = require('lodash.get');
const set = require('lodash.set');
const fs = require('fs/promises');
const childProcess = require('child_process');
const stripEOF = require('strip-final-newline');

const exec = util.promisify(childProcess.execFile);
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
      const datum = await fs.stat(path.join(prefix, name));
      if (datum.isFile() === true) return; // do not overwrite
    } catch (e) {
      debug('failed to stat', e);
      // no file - write a new one down
    }
  }

  // copy over
  await fs.copyFile(path.join(__dirname, '..', filename), rcpath);
  console.log(`✅  ${rcpath} created`);
}

async function getPkg() {
  const filename = clientPackageJsonFilename();
  return JSON.parse(await fs.readFile(filename));
}

async function savePackage(contents) {
  const filename = clientPackageJsonFilename();
  const text = `${JSON.stringify(contents, null, 2)}\n`;
  await fs.writeFile(filename, text, 'utf8');
  return filename;
}

async function alreadyInstalled(scriptName, script, holder) {
  const pkg = await getPkg();
  if (!get(pkg, holder) || !get(pkg, holder)[scriptName]) {
    return false;
  }

  return true;
}

async function addPlugin(scriptName, script, holder) {
  const pkg = await getPkg();
  set(pkg, `${holder}.${scriptName}`, script);
  const filename = await savePackage(pkg);
  console.log(`✅  set ${holder}.${scriptName} to "${script}" in`, filename);
}

async function hasDir(name) {
  try {
    const prefix = rootDir();
    await fs.stat(path.join(prefix, name));
    return true;
  } catch (e) {
    return false;
  }
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
  ];

  for (const [scriptName, name, holder] of scripts) {
    if (!await alreadyInstalled(scriptName, name, holder)) {
      console.log(`⚠️  Installing ${holder}.${scriptName} plugin ${name}`);
      await addPlugin(scriptName, name, holder);
    }
  }

  await copyConfiguration('.releaserc.json', ['.releaserc.js']);
  await copyConfiguration('.commitlintrc.js');

  if (!(await hasDir('.husky'))) {
    console.log('⚠️ husky not initialized yet');
    const { stdout } = await exec('yarn', ['husky', 'install'], { cwd: rootDir() });
    console.log('✅  husky initialized:');
    console.log(stdout);
  }

  const pkg = await getPkg();
  if (pkg.husky) {
    for (const entry of Object.entries(pkg.husky)) {
      const [key] = entry;
      let [, script] = entry;
      if (!/^yarn|np[mx] /.test(script)) {
        script = `npx --no-install ${script}`;
      }
      pkg.husky[key] = script.replace(/\$?HUSKY_GIT_PARAMS/g, '$1');
    }

    console.log('⚠️ migrating husky config');
    await savePackage(pkg);
    const { stdout } = await exec('npm', ['exec', '--', 'github:typicode/husky-4-to-7', '--remove-v4-config'], { cwd: rootDir() });
    console.log('✅  husky 4-to-7 migrated:');
    console.log(stdout);
  }

  await copyConfiguration('.husky/commit-msg');
  await copyConfiguration('.husky/prepare-commit-msg');

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
