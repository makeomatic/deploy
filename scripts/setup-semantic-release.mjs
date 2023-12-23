#!/usr/bin/env node

import path, { dirname, resolve, sep } from 'node:path';
import get from 'lodash.get';
import set from 'lodash.set';
import fs from 'node:fs/promises';
import { execa } from 'execa';
import { temporaryDirectoryTask } from 'tempy';
import _debug from 'debug';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const debug = _debug('makeomatic:deploy');
const isForced = process.argv.some((a) => a === '--force');

function amIaDependency() {
  const cwd = typeof __dirname !== 'undefined' && __dirname
    ? resolve(__dirname, '..')
    : process.cwd();
  const parts = cwd.split(sep);
  const parentFolder = parts[parts.length - 2];
  const scopedParentFodler = parts[parts.length - 3];
  return parentFolder === 'node_modules' || scopedParentFodler === 'node_modules';
}

function rootDir() {
  return process.env.INIT_CWD || process.env.PWD;
}

function clientPackageJsonFilename() {
  return resolve(rootDir(), 'package.json');
}

async function npmGlobalDir() {
  try {
    const { stdout } = await execa('npm', ['-g', 'root']);
    return resolve(stdout, '../');
  } catch (e) {
    return null;
  }
}

async function pnpmGlobalDir() {
  try {
    const { stdout } = await execa('pnpm', ['-g', 'root']);
    return resolve(stdout, '../');
  } catch (e) {
    return null;
  }
}

async function isInstallingGlobally() {
  const globalDirs = await Promise.all([
    npmGlobalDir(),
    pnpmGlobalDir(),
  ]);

  debug('looking in %o for %o', globalDirs, rootDir());

  return globalDirs.includes(rootDir());
}

async function copyConfiguration(filename, _fallback = [], renameTo = filename) {
  const names = Array.isArray(_fallback) ? [filename].concat(_fallback) : [filename];
  const prefix = rootDir();
  const rcpath = path.join(prefix, renameTo);

  for (const name of names) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const datum = await fs.stat(path.join(prefix, name));
      if (datum.isFile() === true) return; // do not overwrite
    } catch (e) {
      debug('failed to stat', e);
      // no file - write a new one down
    }
  }

  // copy over
  try {
    await fs.copyFile(path.join(__dirname, '..', filename), rcpath);
    console.log(`✅  ${rcpath} created`);
  } catch (e) {
    console.warn(`❌ ${rcpath} failed to copy`);
  }
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

// if there is no directory .git it is a monorepo package
async function isMonorepoPackage() {
  return await hasDir('.git') === false;
}

if ((!amIaDependency() || await isInstallingGlobally() || await isMonorepoPackage()) && !isForced) {
  // top level install (we are running `npm i` in this project)
  debug('we are installing own dependencies');
  process.exit(0);
}

debug('installing this module as a dependency');

const scripts = [
  ['semantic-release', 'semantic-release', 'scripts'],
];

for (const [scriptName, name, holder] of scripts) {
  // eslint-disable-next-line no-await-in-loop
  if (!await alreadyInstalled(scriptName, name, holder)) {
    console.log(`⚠️  Installing ${holder}.${scriptName} plugin ${name}`);
    // eslint-disable-next-line no-await-in-loop
    await addPlugin(scriptName, name, holder);
  }
}

await copyConfiguration('.releaserc.json', ['.releaserc.js']);
await copyConfiguration('.commitlintrc.cjs', ['.commitlintrc.cjs', '.commitlintrc.json', '.commitlintrc.mjs']);

if (!(await hasDir('.husky/_'))) {
  console.log('⚠️ husky not initialized yet');
  const { stdout } = await execa(path.resolve(__dirname, '../node_modules/.bin/husky'), ['install'], { cwd: rootDir() });
  console.log('✅  husky initialized:');
  console.log(stdout);
}

const pkg = await getPkg();
if (pkg.husky) {
  console.log('⚠️ current husky config');
  console.log(pkg.husky);
  const tmpCopy = JSON.stringify(pkg.husky);

  if (pkg.husky.hooks) {
    for (const entry of Object.entries(pkg.husky.hooks)) {
      const [key] = entry;
      let [, script] = entry;

      console.log('working on [%s]: %s', key, script);

      if (key === 'prepare-commit-msg'
          && script === './node_modules/@makeomatic/deploy/git-hooks/prepare-commit-msg $HUSKY_GIT_PARAMS') {
        delete pkg.husky.hooks[key];
        // eslint-disable-next-line no-continue
        continue;
      }

      if (key === 'commit-msg'
          && script === 'commitlint -e $HUSKY_GIT_PARAMS') {
        delete pkg.husky.hooks[key];
        // eslint-disable-next-line no-continue
        continue;
      }

      if (!/^(np[mx]) /.test(script)) {
        script = `npx --no-install ${script}`;
      }
      pkg.husky.hooks[key] = script.replace(/\$?HUSKY_GIT_PARAMS/g, '$1');
    }
  }

  console.log('⚠️ final config:');
  console.log(pkg.husky);
  console.log('⚠️ migrating husky config');
  try {
    await savePackage(pkg);
    await temporaryDirectoryTask(async (tempPath) => {
      await execa('npm', ['i', '--no-save', 'github:typicode/husky-4-to-8#07a954ec6082bd56eb35b79ebb300a171f60496a'], { cwd: tempPath });
      const { stdout } = await execa(path.resolve(tempPath, 'node_modules/.bin/husky-4-to-8'), [
        '--remove-v4-config',
      ], { cwd: rootDir() });
      console.log('✅  husky 4-to-8 migrated:');
      console.log(stdout);
    });
  } catch (e) {
    pkg.husky = JSON.parse(tmpCopy);
    await savePackage(pkg);
    throw e;
  }
}

await copyConfiguration('.husky/commit-msg.sample', [], '.husky/commit-msg');
await copyConfiguration('.husky/prepare-commit-msg');

console.log('⚠️ Use "semantic-release-cli setup" to complete setting up semantic-release');
console.log('⚠️ For scoped packages add {"publishConfig":{"access": "public"}} to package.json');
