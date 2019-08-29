/**
 * Builds docker images
 */

const assert = require('assert');
const { exec } = require('shelljs');

exports.command = 'push';
exports.desc = 'pushes previously build docker images';
exports.handler = (argv) => {
  require('../docker').handler(argv);

  const { mainTag, tags } = argv;

  [mainTag, ...tags].forEach((tag) => (
    assert.equal(exec(`docker push ${tag}`).code, 0, 'failed to push')
  ));
};
