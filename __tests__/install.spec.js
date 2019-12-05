/* eslint-disable no-console */

const { directory } = require('tempy');
const { resolve } = require('path');
const { promisify } = require('util');
const stripEOF = require('strip-final-newline');
const fs = require('fs');
const execFile = promisify(require('child_process').execFile);

const rm = promisify(fs.unlink);
const stat = promisify(fs.stat);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);

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

    test('on reinstall doesnt overwrite existing .releaserc.js(on)', async () => {
      expect.assertions(1);

      await writeFile('.releaserc.json', 'overwrite');
      const { stderr } = await execFile('yarn', ['add', tarball]);
      console.info(stderr);
      await expect(readFile('.releaserc.json', 'utf8')).resolves.toBe('overwrite');
    }, 240000);

    test('on reinstall doesnt overwrite existing .commitlintrc.js', async () => {
      expect.assertions(1);

      await writeFile('.commitlintrc.js', 'overwrite');
      await execFile('yarn', ['add', tarball]);
      await expect(readFile('.commitlintrc.js', 'utf8')).resolves.toBe('overwrite');
    }, 240000);
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
