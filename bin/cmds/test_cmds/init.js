/**
 * Initializes testing stuff
 * @type {String}
 */

const path = require('path');
const fs = require('fs');
const get = require('lodash.get');
const set = require('lodash.set');
const { cp, test } = require('shelljs');

exports.command = 'init';
exports.desc = 'adds basic files for testing';
exports.handler = (argv) => {
  const templates = path.resolve(__dirname, '../../../templates');

  if (!test('-e', '.nycrc')) cp(`${templates}/.nycrc`, '.nycrc');
  if (!test('-e', argv.docker_compose)) cp(`${templates}/docker-compose.yml`, argv.docker_compose);
  if (!test('-e', 'test/mocha.opts')) cp(`${templates}/mocha.opts`, 'test/mocha.opts');

  // babelrc
  if (!test('-e', '.babelrc')) {
    cp(`${templates}/.babelrc`, '.babelrc');
  } else {
    const babelrc = JSON.parse(fs.readFileSync('.babelrc', 'utf8'));
    const plugins = get(babelrc, 'env.test.plugins', []);
    if (!plugins.includes('istanbul')) {
      plugins.push('istanbul');
      set(babelrc, 'env.test.plugins', plugins);
      fs.writeFileSync('.babelrc', JSON.stringify(babelrc, null, 2), 'utf8');
    }
  }
};
