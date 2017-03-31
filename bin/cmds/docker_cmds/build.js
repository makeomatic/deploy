/**
 * Builds docker images
 */

const fs = require('fs');
const { exec, echo, exit, ShellString, rm } = require('shelljs');

exports.command = 'build';
exports.desc = 'builds docker image for a project';
exports.handler = (argv) => {
  const { project } = argv;

  // prepare variables
  const tmpDockerfile = `${process.cwd()}/Dockerfile.${project}`;
  const dockerfile = fs
    .readFileSync(argv.docker_file, 'utf8')
    .replace(/\$NODE_VERSION/g, argv.node)
    .replace(/\$NODE_ENV/g, argv.env);

  // write temporary dockerfile
  ShellString(dockerfile).to(tmpDockerfile);

  // start builder
  const command = `docker build -t ${project} -f ${tmpDockerfile} .`;
  echo(command);
  const build = exec(command);

  // cleanup right away
  rm(tmpDockerfile);

  // print error if shit happened
  if (build.code !== 0) {
    echo('Error: failed to build docker image');
    exit(1);
  }
};
