/**
 * Tags docker images
 */

const { exec } = require('shelljs');

exports.command = 'tag';
exports.desc = 'tags built docker image';
exports.handler = (argv) => {
  require('../docker').handler(argv);

  const { mainTag, tags } = argv;

  tags.forEach(tag => (
    exec(`docker tag ${mainTag} ${tag}`)
  ));
};
