/* eslint-disable no-console */

import test, { describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { temporaryDirectory } from 'tempy';
import { resolve } from 'node:path';
import set from 'lodash.set';
import fs from 'node:fs/promises';
import _debug from 'debug';
import { $, execaCommand } from 'execa';

const debug = _debug('debug');
const execa = async (cmd, args, _opts = {}) => {
  const opts = { buffer: false, ..._opts };
  if (!opts.buffer) {
    opts.stdio = 'inherit';
  }

  const proc = $(opts)`${cmd} ${args}`;

  return proc;
};

// setup git so that we can try commits
before(async () => {
  await execaCommand('git config --global user.name deploy-tests');
  await execaCommand('git config --global user.email ci@github.com');
});

describe('(pnpm) test installing the package', () => {
  const kFilename = 'makeomatic-deploy-0.0.0-development.tgz';
  const cwd = process.cwd();
  const tarball = resolve(cwd, kFilename);
  const clean = async () => {
    try {
      await fs.rm(tarball);
    } catch (e) {
      process.stderr.write(`nothing to cleanup ~ ${tarball}\n`);
    }
  };

  before(async () => {
    await clean();
    await execa('pnpm', ['config', 'set', 'store-dir', '~/.pnpm-store']);
    await execa('pnpm', ['config', 'set', 'prefer-offline', 'true']);
    await execa('pnpm', ['pack']);
  });

  describe('local install', () => {
    const tmpDir = temporaryDirectory();

    before(async () => {
      debug('changing to %s', tmpDir);
      process.chdir(tmpDir);
      await execa('pnpm', ['init']);
      await execa('git', ['init']);
    });

    test('is able to install package locally', async () => {
      await execa('pnpm', ['add', tarball], {
        cwd: tmpDir,
        env: {
          DEBUG: 'makeomatic:deploy',
        },
      });
      await execa('pnpm', ['mdep', 'install']);
    }, 240000);

    test('returns node version', async () => {
      const { stdout } = await execa('node_modules/.bin/mdep', ['get-config', 'node', '--node', '99.0.0'], { buffer: true });
      assert.equal(stdout, '99.0.0');
    });

    test('package.json enhanced', async () => {
      const pkg = JSON.parse(await fs.readFile(`${tmpDir}/package.json`));
      assert(pkg.scripts['semantic-release']);
      assert.ifError(pkg.husky);
    });

    test('.husky create', async () => {
      assert.equal((await fs.stat('.husky')).isDirectory(), true);
      assert.equal((await fs.stat('.husky/_/husky.sh')).isFile(), true);
      assert.equal((await fs.stat('.husky/commit-msg')).isFile(), true);
      assert.equal((await fs.stat('.husky/prepare-commit-msg')).isFile(), true);
    });

    test('releaserc & commitlint copied over', async () => {
      assert.equal((await fs.stat('.releaserc.json')).isFile(), true);
      assert.equal((await fs.stat('.commitlintrc.cjs')).isFile(), true);
    });

    test('on reinstall doesnt overwrite existing .releaserc.js(on)', async () => {
      await fs.writeFile('.releaserc.json', 'overwrite');
      const { stderr } = await execa('pnpm', ['add', tarball]);
      debug(stderr);
      assert.equal(await fs.readFile('.releaserc.json', 'utf8'), 'overwrite');
    }, 240000);

    test('on reinstall doesnt overwrite existing .commitlintrc.cjs', async () => {
      await fs.writeFile('.commitlintrc.cjs', 'overwrite');
      await execa('pnpm', ['add', tarball]);
      assert.equal(await fs.readFile('.commitlintrc.cjs', 'utf8'), 'overwrite');
    }, 240000);
  });

  describe('local install (husky migration)', () => {
    const tmpDir = temporaryDirectory();

    before(async () => {
      debug('changing to %s', tmpDir);
      process.chdir(tmpDir);
      await execa('pnpm', ['init']);
      await execa('git', ['init']);

      const pkgName = `${tmpDir}/package.json`;
      const pkg = JSON.parse(await fs.readFile(pkgName));
      set(pkg, 'husky.hooks.commit-msg', 'commitlint -e $HUSKY_GIT_PARAMS');
      await fs.writeFile(pkgName, JSON.stringify(pkg, null, 2));
    });

    test('is able to install package locally', async () => {
      await execa('pnpm', ['add', tarball], {
        cwd: tmpDir,
        env: {
          DEBUG: 'makeomatic:deploy',
        },
      });
      await execa('pnpm', ['mdep', 'install']);
    }, 240000);

    test('package.json enhanced, no husky', async () => {
      const pkg = JSON.parse(await fs.readFile(`${tmpDir}/package.json`));
      assert.ifError(pkg.husky);
    });

    test('.husky files present', async () => {
      assert.equal((await fs.stat('.husky')).isDirectory(), true);
      assert.equal((await fs.stat('.husky/_/husky.sh')).isFile(), true);
      assert.equal((await fs.stat('.husky/commit-msg')).isFile(), true);
      assert.equal((await fs.stat('.husky/prepare-commit-msg')).isFile(), true);

      const files = await fs.readdir('.husky');
      assert.equal(files.length, 3);
    });

    test('.husky files content sane', async () => {
      const contents = await fs.readFile('.husky/commit-msg', { encoding: 'utf8' });
      assert(contents.includes('"`npm x -- mdep bin commitlint`" --edit $1'));
    });
  });

  describe('installs globally', () => {
    test('is able to install package globally', async () => {
      await $`pnpm config set global-bin-dir "/usr/local/bin"`;
      await execa('pnpm', ['-g', 'add', tarball]);
    }, 240000);

    test('returns current node version in module', async () => {
      process.chdir(cwd);
      const { stdout } = await execa('mdep', ['get-config', '--path', 'node'], { buffer: true });
      assert.equal(stdout, '20.10');
    });
  });

  after(clean);
});
