/**
 * Tags docker images
 */
import { $ } from 'execa';
import { handler as dockerHandler } from './_handler.js';

export const command = 'tag';
export const desc = 'tags built docker image';
export const handler = async (argv) => {
  dockerHandler(argv);

  const { mainTag, tags } = argv;

  for (const tag of tags) {
    // eslint-disable-next-line no-await-in-loop
    await $`docker tag ${mainTag} ${tag}`;
  }
};
