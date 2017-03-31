/**
 * Builds docker images
 */

const path = require('path');
const glob = require('glob');
const { exec, echo, exit } = require('shelljs');

exports.command = 'run';
exports.desc = 'performs testing';
exports.handler = (argv) => {
  require('./compose').handler(argv);

  // now that we have compose get tests
  const testFiles = glob.sync(argv.tests);
  if (testFiles.length === 0) {
    echo('No test files found. Exit 1');
    exit(1);
  } else {
    echo('Found %d test files', testFiles.length);
  }

  const { compose } = argv;

  // start containers
  echo('bringing up containers');
  if (exec(`${compose} up -d`).code !== 0) {
    echo('failed to start docker containers. Exit 128');
    exit(128);
  }

  // easy way to wait for containers, can do improved detection, but it's not generic
  if (argv.sleep) exec(`sleep ${argv.sleep}`);

  // now determine what we need
  const crossEnv = `${argv.root}/cross-env`;
  const nyc = `${argv.root}/nyc`;
  const mocha = `${argv.root}/mocha`;
  const codecov = `${argv.root}/codecov`;

  // eslint-disable-next-line no-restricted-syntax
  for (const test of testFiles) {
    const basename = path.basename(test, '.js');
    exec(`docker exec tester /bin/sh -c "${crossEnv} NODE_ENV=test ${nyc} --report-dir ${argv.report_dir}/${basename} ${mocha} ${test}"`);
    if (exec.code !== 0) {
      echo(`failed to run ${test}, exiting 128...`);
      exit(128);
    }
  }

  // upload codecoverage report
  if (argv.coverage) {
    echo('uploading coverage');
    exec(codecov);
  }
};