/**
 * Builds docker images
 */

import { $ } from 'execa';
import { handler as dockerHandler } from './_handler.js';

export const command = 'push';
export const desc = 'pushes previously build docker images';
export const handler = async (argv) => {
  dockerHandler(argv);
  const { mainTag, tags } = argv;

  for (const tag of [mainTag, ...tags]) {
    // eslint-disable-next-line no-await-in-loop
    await $({ stdio: 'inherit' })`docker push ${tag}`;
  }
};
