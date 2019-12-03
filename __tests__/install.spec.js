/* eslint-disable no-console */

const { directory } = require('tempy');
const { resolve } = require('path');
const { promisify } = require('util');
const stripEOF = require('strip-final-newline');
const execFile = promisify(require('child_process').execFile);
const rm = promisify(require('fs').unlink);
const stat = promisify(require('fs').stat);

describe('test installing the package', () => {
  const kFilename = 'deploy.tgz';
  const cwd = process.cwd();
  const tarball = resolve(cwd, kFilename);
  const tmpDir = directory();

  beforeAll(async () => {
    await execFile('yarn', ['cache', 'clean']);
    const { stdout } = await execFile('yarn', ['pack', '--filename', kFilename]);
    console.info(stdout);
  });

  describe('local install', () => {
    beforeAll(async () => {
      console.info('changing to %s', tmpDir);
      process.chdir(tmpDir);
      await execFile('yarn', ['init', '-yp']);
    });

    test('is able to install package locally', async () => {
      await execFile('yarn', ['add', tarball]);
    }, 240000);

    test('returns node version', async () => {
      const { stdout } = await execFile('node_modules/.bin/mdep', ['get-config', 'node', '--node', '99.0.0']);
      expect(stripEOF(stdout)).toBe('99.0.0');
    });

    test('package.json enhanced', async () => {
      const pkg = require(`${tmpDir}/package.json`); // eslint-disable-line import/no-dynamic-require
      expect(pkg.scripts['semantic-release']).toBeDefined();
      expect(pkg.husky.hooks['commit-msg']).toBeDefined();
      expect(pkg.husky.hooks['prepare-commit-msg']).toBeDefined();
    });

    test('releaserc & commitlint copied over', async () => {
      expect((await stat('.releaserc.json')).isFile()).toBe(true);
      expect((await stat('.commitlintrc.js')).isFile()).toBe(true);
    });
  });

  describe('installs globally', () => {
    test('is able to install package globally', async () => {
      await execFile('yarn', ['global', 'add', tarball]);
    }, 240000);

    test('returns current node version in module', async () => {
      process.chdir(cwd);
      const { stdout } = await execFile('mdep', ['get-config', '--path', 'node']);
      expect(stripEOF(stdout)).toBe('12.13.0');
    });
  });

  afterAll(async () => {
    try {
      await rm(kFilename);
    } catch (e) {
      process.stderr.write(`nothing to cleanup ~ ${kFilename}\n`);
    }
  });
});
