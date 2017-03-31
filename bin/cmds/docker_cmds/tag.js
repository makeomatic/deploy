/**
 * Tags docker images
 */

const { exec } = require('shelljs');

exports.command = 'tag';
exports.desc = 'tags built docker image';
exports.handler = (argv) => {
  const { project, tags } = argv;

  tags.forEach(tag => (
    exec(`docker tag ${project} ${tag}`)
  ));
};
