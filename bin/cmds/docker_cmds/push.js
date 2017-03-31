/**
 * Builds docker images
 */

const { exec } = require('shelljs');

exports.command = 'push';
exports.desc = 'pushes previously build docker images';
exports.handler = (argv) => {
  const { project, tags } = argv;

  [project, ...tags].forEach(tag => (
    exec(`docker push ${tag}`)
  ));
};
