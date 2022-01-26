/* eslint-disable no-console */

const { directory } = require('tempy');
const { resolve } = require('path');
const set = require('lodash.set');
const fs = require('fs/promises');
const debug = require('debug')('test');
const execa = require('execa');

describe('(yarn) test installing the package', () => {
  const kFilename = 'deploy-yarn.tgz';
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
    await execa('yarn', ['config', 'set', 'preferred-cache-folder', '/tmp/yarn-cache']);
    await execa('yarn', ['config', 'set', 'cache-folder', '/tmp/yarn-cache-internal']);
    await execa('yarn', ['config', 'set', 'prefer-offline', 'true']);
    await execa('yarn', ['pack', '--filename', kFilename]);
  });

  describe('local install', () => {
    const tmpDir = directory();

    beforeAll(async () => {
      debug('changing to %s', tmpDir);
      process.chdir(tmpDir);
      await execa('yarn', ['init', '-yp']);
      await execa('git', ['init']);
    });

    test('is able to install package locally', async () => {
      await execa('yarn', ['add', tarball, '--no-lockfile']);
      await execa('yarn', ['mdep', 'install']);
    }, 240000);

    test('returns node version', async () => {
      const { stdout } = await execa('node_modules/.bin/mdep', ['get-config', 'node', '--node', '99.0.0']);
      expect(stdout).toBe('99.0.0');
    });

    test('package.json enhanced', async () => {
      const pkg = JSON.parse(await fs.readFile(`${tmpDir}/package.json`));
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
      const { stderr } = await execa('yarn', ['add', tarball, '--no-lockfile']);
      debug(stderr);
      await expect(fs.readFile('.releaserc.json', 'utf8')).resolves.toBe('overwrite');
    }, 240000);

    test('on reinstall doesnt overwrite existing .commitlintrc.js', async () => {
      expect.assertions(1);

      await fs.writeFile('.commitlintrc.js', 'overwrite');
      await execa('yarn', ['add', tarball, '--no-lockfile']);
      await expect(fs.readFile('.commitlintrc.js', 'utf8')).resolves.toBe('overwrite');
    }, 240000);
  });

  describe('local install (husky migration)', () => {
    const tmpDir = directory();

    beforeAll(async () => {
      debug('changing to %s', tmpDir);
      process.chdir(tmpDir);
      await execa('yarn', ['init', '-yp']);
      await execa('git', ['init']);

      const pkgName = `${tmpDir}/package.json`;
      const pkg = JSON.parse(await fs.readFile(pkgName));
      set(pkg, 'husky.hooks.commit-msg', 'commitlint -e $HUSKY_GIT_PARAMS');
      await fs.writeFile(pkgName, JSON.stringify(pkg, null, 2));
    });

    test('is able to install package locally', async () => {
      await execa('yarn', ['add', tarball, '--no-lockfile']);
      await execa('yarn', ['mdep', 'install']);
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
      await execa('yarn', ['global', 'add', tarball, '--no-lockfile']);
    }, 240000);

    test('returns current node version in module', async () => {
      process.chdir(cwd);
      const { stdout } = await execa('mdep', ['get-config', '--path', 'node']);
      expect(stdout).toBe('16');
    });
  });

  afterAll(clean);
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

  beforeAll(async () => {
    await clean();
    await execa('pnpm', ['pack']);
  });

  describe('local install', () => {
    const tmpDir = directory();

    beforeAll(async () => {
      debug('changing to %s', tmpDir);
      process.chdir(tmpDir);
      await execa('pnpm', ['init', '-yp']);
      await execa('git', ['init']);
    });

    test('is able to install package locally', async () => {
      const proc = execa('pnpm', ['add', tarball], {
        buffer: false,
        cwd: tmpDir,
        all: true,
        env: {
          DEBUG: 'makeomatic:deploy',
        },
      });
      proc.all.pipe(process.stdout);
      await proc;
      await execa('pnpm', ['mdep', 'install']);
    }, 240000);

    test('returns node version', async () => {
      const { stdout } = await execa('node_modules/.bin/mdep', ['get-config', 'node', '--node', '99.0.0']);
      expect(stdout).toBe('99.0.0');
    });

    test('package.json enhanced', async () => {
      const pkg = JSON.parse(await fs.readFile(`${tmpDir}/package.json`));
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
      const { stderr } = await execa('pnpm', ['add', tarball]);
      debug(stderr);
      await expect(fs.readFile('.releaserc.json', 'utf8')).resolves.toBe('overwrite');
    }, 240000);

    test('on reinstall doesnt overwrite existing .commitlintrc.js', async () => {
      expect.assertions(1);

      await fs.writeFile('.commitlintrc.js', 'overwrite');
      await execa('pnpm', ['add', tarball]);
      await expect(fs.readFile('.commitlintrc.js', 'utf8')).resolves.toBe('overwrite');
    }, 240000);
  });

  describe('local install (husky migration)', () => {
    const tmpDir = directory();

    beforeAll(async () => {
      debug('changing to %s', tmpDir);
      process.chdir(tmpDir);
      await execa('pnpm', ['init', '-yp']);
      await execa('git', ['init']);

      const pkgName = `${tmpDir}/package.json`;
      const pkg = JSON.parse(await fs.readFile(pkgName));
      set(pkg, 'husky.hooks.commit-msg', 'commitlint -e $HUSKY_GIT_PARAMS');
      await fs.writeFile(pkgName, JSON.stringify(pkg, null, 2));
    });

    test('is able to install package locally', async () => {
      const proc = execa('pnpm', ['add', tarball], {
        buffer: false,
        cwd: tmpDir,
        all: true,
        env: {
          DEBUG: 'makeomatic:deploy',
        },
      });
      proc.all.pipe(process.stdout);
      await proc;
      await execa('pnpm', ['mdep', 'install']);
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
      await execa('pnpm', ['-g', 'add', tarball]);
    }, 240000);

    test('returns current node version in module', async () => {
      process.chdir(cwd);
      const { stdout } = await execa('mdep', ['get-config', '--path', 'node']);
      expect(stdout).toBe('16');
    });
  });

  afterAll(clean);
});
