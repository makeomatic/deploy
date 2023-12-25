/**
 * Builds docker images
 */

import fs from 'node:fs/promises';
import { $ } from 'execa';
import { handler as dockerHandler } from './_handler.js';

export const command = 'build';
export const desc = 'builds docker image for a project';
export const handler = async (argv) => {
  dockerHandler(argv);

  const { project, mainTag } = argv;

  // prepare variables
  const tmpDockerfile = `${process.cwd()}/Dockerfile.${project}`;
  const dockerfile = await fs
    .readFile(argv.docker_file, 'utf8')
    .then((file) => (
      file
        .replace(/\$NODE_VERSION/g, argv.node)
        .replace(/\$NODE_ENV/g, argv.env)
    ));

  // write temporary dockerfile
  await fs.writeFile(tmpDockerfile, dockerfile);

  // try running compile before hand
  if (argv.pkg.scripts.compile) { {
    await $({ stdio: 'inherit' })`npm run compile`
  }

  const args = ['-t', mainTag, '-f', tmpDockerfile];

  const {
    docker_build_args: dba,
    docker_context: context,
    docker_flags: df,
  } = argv;

  if (dba && typeof dba === 'object') {
    for (const [prop, value] of Object.entries(dba)) {
      args.push('--build-arg', `${prop}=${value}`);
    }
  }

  if (Array.isArray(df) && df.length > 0) {
    for (const flag of df) {
      // NOTE: no escaping, must be done on the input
      args.push(flag);
    }
  }

  // start builder
  try {
    await $({ stdio: 'inherit' })`docker build ${args} ${context}`;
  } finally {
    // cleanup right away
    await fs.unlink(tmpDockerfile);
  }
};
