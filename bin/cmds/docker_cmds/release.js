/**
 * Builds docker images
 */

exports.command = 'release';
exports.desc = 'performs build, tagging and push in one operation';
exports.handler = (argv) => {
  require('../docker').handler(argv);
  require('./build').handler(argv);
  require('./tag').handler(argv);
  require('./push').handler(argv);
};
