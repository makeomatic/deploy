/**
 * Builds docker images
 */

import { handler as dockerHandler } from './_handler.js';
import { handler as buildHandler } from './build.js';
import { handler as tagHandler } from './tag.js';
import { handler as pushHandler } from './push.js';

export const command = 'release';
export const desc = 'performs build, tagging and push in one operation';
export const handler = (argv) => {
  dockerHandler(argv);
  buildHandler(argv);
  tagHandler(argv);
  pushHandler(argv);
};
