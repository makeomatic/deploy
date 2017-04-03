/**
 * Builds docker images
 */

const { exec } = require('shelljs');

exports.command = 'push';
exports.desc = 'pushes previously build docker images';
exports.handler = (argv) => {
  require('../docker').handler(argv);

  const { mainTag, tags } = argv;

  [mainTag, ...tags].forEach(tag => (
    exec(`docker push ${tag}`)
  ));
};
