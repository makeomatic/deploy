/* eslint-disable no-console */

const { directory } = require('tempy');
const { resolve } = require('path');
const { promisify } = require('util');
const set = require('lodash.set');
const stripEOF = require('strip-final-newline');
const fs = require('fs/promises');
const debug = require('debug')('test');
const execFile = promisify(require('child_process').execFile);

describe('test installing the package', () => {
  const kFilename = 'deploy.tgz';
  const cwd = process.cwd();
  const tarball = resolve(cwd, kFilename);
  const clean = async () => {
    try {
      await fs.rm(tarball);
    } catch (e) {
      process.stderr.write(`nothing to cleanup ~ ${tarball}\n`);
    }
  };

  beforeAll(async () => {
    await clean();
    await execFile('yarn', ['config', 'set', 'cache-folder', '/tmp/yarn-cache']);
    const { stdout } = await execFile('yarn', ['pack', '--filename', kFilename]);
    console.info(stdout);
  });

  describe('local install', () => {
    const tmpDir = directory();

    beforeAll(async () => {
      debug('changing to %s', tmpDir);
      process.chdir(tmpDir);
      await execFile('yarn', ['init', '-yp']);
      await execFile('git', ['init']);
    });

    test('is able to install package locally', async () => {
      await execFile('yarn', ['add', tarball, '--offline', '--no-lockfile']);
    }, 240000);

    test('returns node version', async () => {
      const { stdout } = await execFile('node_modules/.bin/mdep', ['get-config', 'node', '--node', '99.0.0']);
      expect(stripEOF(stdout)).toBe('99.0.0');
    });

    test('package.json enhanced', async () => {
      const pkg = require(`${tmpDir}/package.json`); // eslint-disable-line import/no-dynamic-require
      expect(pkg.scripts['semantic-release']).toBeDefined();
      expect(pkg.husky).toBeUndefined();
    });

    test('.husky create', async () => {
      expect((await fs.stat('.husky')).isDirectory()).toBe(true);
      expect((await fs.stat('.husky/_/husky.sh')).isFile()).toBe(true);
      expect((await fs.stat('.husky/commit-msg')).isFile()).toBe(true);
      expect((await fs.stat('.husky/prepare-commit-msg')).isFile()).toBe(true);
    });

    test('releaserc & commitlint copied over', async () => {
      expect((await fs.stat('.releaserc.json')).isFile()).toBe(true);
      expect((await fs.stat('.commitlintrc.js')).isFile()).toBe(true);
    });

    test('on reinstall doesnt overwrite existing .releaserc.js(on)', async () => {
      expect.assertions(1);

      await fs.writeFile('.releaserc.json', 'overwrite');
      const { stderr } = await execFile('yarn', ['add', tarball, '--offline', '--no-lockfile']);
      debug(stderr);
      await expect(fs.readFile('.releaserc.json', 'utf8')).resolves.toBe('overwrite');
    }, 240000);

    test('on reinstall doesnt overwrite existing .commitlintrc.js', async () => {
      expect.assertions(1);

      await fs.writeFile('.commitlintrc.js', 'overwrite');
      await execFile('yarn', ['add', tarball, '--offline', '--no-lockfile']);
      await expect(fs.readFile('.commitlintrc.js', 'utf8')).resolves.toBe('overwrite');
    }, 240000);
  });

  describe('local install (husky migration)', () => {
    const tmpDir = directory();

    beforeAll(async () => {
      debug('changing to %s', tmpDir);
      process.chdir(tmpDir);
      await execFile('yarn', ['init', '-yp']);
      await execFile('git', ['init']);

      const pkgName = `${tmpDir}/package.json`;
      const pkg = JSON.parse(await fs.readFile(pkgName));
      set(pkg, 'husky.hooks.commit-msg', 'commitlint -e $HUSKY_GIT_PARAMS');
      await fs.writeFile(pkgName, JSON.stringify(pkg, null, 2));
    });

    test('is able to install package locally', async () => {
      await execFile('yarn', ['add', tarball, '--offline', '--no-lockfile']);
    }, 240000);

    test('package.json enhanced, no husky', async () => {
      const pkg = JSON.parse(await fs.readFile(`${tmpDir}/package.json`));
      expect(pkg.husky).toBeUndefined();
    });

    test('.husky files present', async () => {
      expect((await fs.stat('.husky')).isDirectory()).toBe(true);
      expect((await fs.stat('.husky/_/husky.sh')).isFile()).toBe(true);
      expect((await fs.stat('.husky/commit-msg')).isFile()).toBe(true);
      expect((await fs.stat('.husky/prepare-commit-msg')).isFile()).toBe(true);

      const files = await fs.readdir('.husky');
      expect(files.length).toBe(3);
    });

    test('.husky files content sane', async () => {
      const contents = await fs.readFile('.husky/commit-msg', { encoding: 'utf8' });
      expect(contents).toContain('npx --no-install commitlint -e $1');
    });
  });

  describe('installs globally', () => {
    test('is able to install package globally', async () => {
      await execFile('yarn', ['global', 'add', tarball, '--offline', '--no-lockfile']);
    }, 240000);

    test('returns current node version in module', async () => {
      process.chdir(cwd);
      const { stdout } = await execFile('mdep', ['get-config', '--path', 'node']);
      expect(stripEOF(stdout)).toBe('16');
    });
  });

  afterAll(clean);
});
