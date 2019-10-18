/**
 * Installs compose
 * @type {String}
 */

const npmPath = require('npm-path');
const path = require('path');
const onDeath = require('death')({ SIGHUP: true, exit: true });
const {
  exec, echo, which, exit, mkdir, chmod, ShellString,
} = require('shelljs');

const isWin = process.platform === 'win32';

exports.command = 'compose';
exports.desc = 'installs compose on the system';
exports.handler = (argv) => {
  npmPath.set();

  // verify if we have compose or not
  let compose = which('docker-compose');
  const version = compose && exec(`"${compose}" --version`).stdout.match(/\d+\.\d+\.\d+/)[0];

  // compose not found - install
  if (compose === null || (argv.dcf && version !== argv.dcv)) {
    if (compose === null) {
      echo(`docker-compose was not found on the system, installing v${argv.dcv} into ./node_modules/.bin`);
    } else {
      echo(`docker-compose of ${version} was found at ${compose}, but force install provided, updating`);
    }

    // creating dir to make sure it exists
    mkdir('./node_modules/.bin');

    const distribution = exec('uname -s').stdout.trim();
    const arch = exec('uname -m').stdout.trim();
    const link = `https://github.com/docker/compose/releases/download/${argv.dcv}/docker-compose-${distribution}-${arch}`;
    const curl = exec(`curl -L "${link}" -o ./node_modules/.bin/docker-compose`);

    if (curl.code !== 0) {
      echo(`failed to install docker-compose: ${curl.stderr}`);
      exit(1);
    }

    compose = ShellString(path.resolve(process.cwd(), './node_modules/.bin/docker-compose'));
    chmod('+x', compose);
  }

  const originalDockerCompose = argv.docker_compose;
  const dockerComposeFiles = [];

  if (argv.docker_compose_multi.length > 0) {
    dockerComposeFiles.push(...argv.docker_compose_multi);
  }

  /**
   * Generates dynamic docker-compose file based on the presets
   */
  if (argv.auto_compose) {
    require('./auto_compose').handler(argv);
    const autoComposeFile = argv.docker_compose;

    dockerComposeFiles.unshift(autoComposeFile);
    if (argv.with_local_compose) {
      dockerComposeFiles.push(originalDockerCompose);
    }
  } else {
    dockerComposeFiles.push(originalDockerCompose);
  }

  const composeFiles = dockerComposeFiles.map((x) => `-f ${x}`).join(' ');

  // add link to compose file
  argv.compose = ShellString(`"${compose}" ${composeFiles}`);

  function stopDocker(signal, code) {
    const dockerCompose = argv.compose;

    // allows to exec arbitrary code on exit
    if (argv.on_fail && signal === 'exit' && code !== 0) {
      exec(argv.on_fail);
    }

    if (argv.no_cleanup !== true) {
      echo(`\nAutomatically cleaning up after ${signal}\n`);
      exec(`${dockerCompose} down; true`);

      if (argv.auto_compose) {
        const deleteCmd = (isWin ? 'del ' : 'rm ') + argv.docker_compose;
        echo(deleteCmd);
        exec(deleteCmd);
      }

      // force exit now
      if (signal === 'exit') process.exit(code || 0);
    } else {
      echo(`\nLocal environment detected.\nTo stop containers write:\n\n${dockerCompose} down;\n`);
    }
  }

  // put docker-compose up
  onDeath(stopDocker);
};
