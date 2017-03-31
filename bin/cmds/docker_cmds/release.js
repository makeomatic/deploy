/**
 * Builds docker images
 */

exports.command = 'release';
exports.desc = 'performs build, tagging and push in one operation';
exports.handler = (argv) => {
  require('./build')(argv);
  require('./tag')(argv);
  require('./push')(argv);
};
