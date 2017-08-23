/**
 * Tags docker images
 */
const assert = require('assert');
const { exec } = require('shelljs');

exports.command = 'tag';
exports.desc = 'tags built docker image';
exports.handler = (argv) => {
  require('../docker').handler(argv);

  const { mainTag, tags } = argv;

  tags.forEach(tag => (
    assert.equal(exec(`docker tag ${mainTag} ${tag}`).code, 0, 'failed to tag')
  ));
};
