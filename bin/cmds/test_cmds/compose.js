const npmPath = require('npm-path');
const onDeath = require('death')({ SIGHUP: true, exit: true });
const { exec, echo, which } = require('shelljs');
const execa = require('execa');
const fs = require('fs');
const { resolve } = require('path');

const isWin = process.platform === 'win32';

exports.command = 'compose';
exports.desc = 'installs compose on the system';
exports.handler = async (argv) => {
  npmPath.set();

  // verify if we have compose or not
  const docker = which('docker');
  const dockerComposeBin = which('docker-compose');
  const mutagen = which('mutagen-compose');
  const compose = mutagen || dockerComposeBin || docker;
  const composeArgs = compose === docker ? ['compose'] : [];
  const originalDockerCompose = argv.docker_compose;
  const dockerComposeFiles = [];

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
    await require('./auto-compose').handler(argv);
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
      exec(argv.on_fail);
    }

    const cleanup = argv.mutagenVolumeExternal ? 'down' : 'down -v';
    if (argv.no_cleanup !== true) {
      echo(`\nAutomatically cleaning up after ${signal}\n`);
      exec(`${dockerCompose} ${cleanup} --remove-orphans; true`);

      if (argv.auto_compose) {
        const deleteCmd = (isWin ? 'del ' : 'rm ') + argv.docker_compose;
        echo(deleteCmd);
        exec(deleteCmd);
      }

      // force exit now
      if (signal === 'exit') process.exit(code || 0);
    } else {
      echo(`\nLocal environment detected.\nTo stop containers write:\n\n${dockerCompose} ${cleanup} --remove-orphans;\n`);
    }
  }

  // put docker-compose up
  onDeath(stopDocker);
};
