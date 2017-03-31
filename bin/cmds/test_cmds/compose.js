/**
 * Installs compose
 * @type {String}
 */

const path = require('path');
const { exec, echo, which, exit, mkdir, chmod, ShellString } = require('shelljs');

exports.command = 'compose';
exports.desc = 'installs compose on the system';
exports.handler = (argv) => {
  // verify if we have compose or not
  let compose = which('docker-compose');
  const version = compose && exec(`${compose} --version`).stdout.match(/\d+\.\d+\.\d+/)[0];

  // compose not found - install
  if (compose === null || (argv.dcf && version !== argv.dcv)) {
    if (compose === null) {
      echo(`docker-compose was not found on the system, installing v${argv.dcv} into ./node_modules/.bin`);
    } else {
      echo(`docker-compose of ${version} was found at ${compose}, but force install provided, updating`);
    }

    // creating dir to make sure it exists
    mkdir('./node_modules/.bin');

    const distribution = exec('uname -s').stdout;
    const arch = exec('uname -m').stdout;
    const link = `https://github.com/docker/compose/releases/download/${argv.dcv}/docker-compose-${distribution}-${arch}`;
    const curl = exec(`curl -L "${link}" -o ./node_modules/.bin/docker-compose`);

    if (curl.code !== 0) {
      echo(`failed to install docker-compose: ${curl.stderr}`);
      exit(1);
    }

    compose = ShellString(path.resolve(process.cwd(), './node_modules/.bin/docker-compose'));
    chmod('+x', compose);
  }

  // add link to compose file
  argv.compose = ShellString(`${compose} -f ${argv.docker_compose}`);

  function stopDocker() {
    if (argv.no_cleanup !== true) {
      echo('\nAutomatically cleaning up\n');
      exec(`${compose} stop`);
      exec(`${compose} rm -f -v`);
    } else {
      echo(`\nLocal environment detected.\nTo stop containers write:\n\n${compose} stop;\n${compose} rm -f -v;\n`);
    }
  }

  // put docker-compose up
  process.on('exit', stopDocker);
};
