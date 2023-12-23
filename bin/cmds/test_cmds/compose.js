import npmPath from 'npm-path';
import death from 'death';
import { execa, $ } from 'execa';
import fs from 'node:fs';
import { resolve } from 'node:path';
import { handler as autoComposeHandler } from './auto-compose.js';

const isWin = process.platform === 'win32';
const onDeath = death({ SIGHUP: true, exit: true });

const which = async (cmd) => {
  try {
    const { stdout = '' } = await $({ stripFinalNewline: true })`which ${cmd}`;
    return stdout;
  } catch (err) {
    return null;
  }
};

export const command = 'compose';
export const desc = 'installs compose on the system';
export const handler = async (argv) => {
  npmPath.set();

  // verify if we have compose or not
  const [docker, dockerComposeBin, mutagen] = await Promise.all([
    which('docker'),
    which('docker-compose'),
    which('mutagen-compose'),
  ]);

  if (!docker) {
    throw new Error('docker must be installed, can\'t find it with `which`');
  }

  const compose = mutagen || dockerComposeBin || docker;
  const composeArgs = compose === docker ? ['compose'] : [];
  const originalDockerCompose = argv.docker_compose;
  const dockerComposeFiles = [];
  const isRootless = (await execa(docker.toString(), ['info', '-f', '{{ json .SecurityOptions }}']))
    .stdout.includes('rootless');

  if (isRootless) {
    argv.isRootless = true;
    delete argv.euser;
    delete argv.tuser;
  }

  if (mutagen) {
    let isMutagen = true;
    if (process.env.PNPM_SCRIPT_SRC_DIR
        || fs.existsSync(resolve(process.cwd(), 'pnpm-lock.yaml'))) {
      const { stdout } = await execa.command('pnpm config get package-import-method');
      if (!['clone', 'copy'].includes(stdout)) {
        process.emitWarning('pnpm + mutagen dont work with hardlinks enabled', {
          code: 'E_DEP_0002',
          type: 'MakeomaticDeploy',
          detail: 'run `pnpm config -g set package-import-method=copy` and pnpm i after',
        });
        isMutagen = false;
      }
    }

    argv.isMutagen = isMutagen;
  }

  if (argv.docker_compose_multi.length > 0) {
    dockerComposeFiles.push(...argv.docker_compose_multi);
  }

  /**
   * Generates dynamic docker-compose file based on the presets
   */
  if (argv.auto_compose) {
    await autoComposeHandler(argv);
    const autoComposeFile = argv.docker_compose;

    dockerComposeFiles.unshift(autoComposeFile);
    if (argv.with_local_compose) {
      dockerComposeFiles.push(originalDockerCompose);
    }
  } else {
    dockerComposeFiles.push(originalDockerCompose);
  }

  // add link to compose file
  argv.compose = compose.toString();
  argv.composeArgs = [...composeArgs, ...dockerComposeFiles.flatMap((x) => ['-f', x])];

  function stopDocker(signal, code) {
    const dockerCompose = `${argv.compose} ${argv.composeArgs.join(' ')}`.trim();

    // allows to exec arbitrary code on exit
    if (argv.on_fail && signal === 'exit' && code !== 0) {
      $({ stdio: 'inherit' }).sync`${argv.on_fail}`;
    }

    const cleanup = argv.mutagenVolumeExternal ? ['down'] : ['down', '-v'];
    if (argv.no_cleanup !== true && argv.onlyPrepare !== true) {
      console.log(`\nAutomatically cleaning up after ${signal}\n`);
      $({ reject: false, stdio: 'inherit' }).sync`${argv.compose} ${argv.composeArgs} ${cleanup} --remove-orphans`;

      if (argv.auto_compose) {
        const deleteCmd = [(isWin ? 'del' : 'rm'), argv.docker_compose];
        console.log(deleteCmd.join(' '));
        $({ reject: false }).sync`${deleteCmd}`;
      }

      // force exit now
      if (signal === 'exit') process.exit(code || 0);
    } else {
      console.log(`\nLocal environment detected.\nTo stop containers write:\n\n${dockerCompose} ${cleanup} --remove-orphans;\n`);
    }
  }

  // put docker-compose up
  onDeath(stopDocker);
};
