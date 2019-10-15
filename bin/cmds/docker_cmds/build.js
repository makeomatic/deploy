/**
 * Builds docker images
 */

const fs = require('fs');
const {
  exec,
  echo,
  exit,
  ShellString,
  rm,
} = require('shelljs');

exports.command = 'build';
exports.desc = 'builds docker image for a project';
exports.handler = (argv) => {
  require('../docker').handler(argv);

  const { project, mainTag } = argv;

  // prepare variables
  const tmpDockerfile = `${process.cwd()}/Dockerfile.${project}`;
  const dockerfile = fs
    .readFileSync(argv.docker_file, 'utf8')
    .replace(/\$NODE_VERSION/g, argv.node)
    .replace(/\$NODE_ENV/g, argv.env);

  // write temporary dockerfile
  ShellString(dockerfile).to(tmpDockerfile);

  // try running compile before hand
  if (argv.pkg.scripts.compile && exec('npm run compile').code !== 0) {
    echo('Error: failed to run compile');
    exit(1);
  }
  let dockerBuildArgs = '';
  if (argv.docker_build_args.length > 0) {
    dockerBuildArgs = ` --build-arg ${argv.docker_build_args.map((arg) => `${arg}=\${${arg}}`).join(' --build-arg ')}`;
    //  NPM_TOKEN=${NPM_TOKEN}
  }
  console.log(dockerBuildArgs, 'dockerBuildArgs');
  // start builder
  const command = `docker build --squash -t ${mainTag} -f ${tmpDockerfile}${dockerBuildArgs} .`;
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
