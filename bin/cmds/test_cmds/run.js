/**
 * Builds docker images
 */

const Promise = require('bluebird');
const path = require('path');
const glob = require('glob');
const { exec, echo, exit } = require('shelljs');

// to lower CPU usage
async function execAsync(cmd) {
  return Promise.fromCallback(next => (
    exec(cmd, (code, stdout, stderr) => next(null, { code, stdout, stderr }))
  ));
}

async function loopThroughCmds(arr, makeCmd = it => it) {
  // eslint-disable-next-line no-restricted-syntax
  for (const preCommand of arr) {
    const cmd = makeCmd(preCommand);
    echo(cmd);

    // eslint-disable-next-line no-await-in-loop
    const run = await execAsync(cmd);
    if (!run || run.code !== 0) {
      echo(`failed to run ${cmd}, exiting 128...`);
      exit(128);
    }
  }
}

exports.command = 'run';
exports.desc = 'performs testing';
exports.handler = async (argv) => {
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
  if (argv.rebuild.length > 0) {
    echo('rebuilding modules');
    // eslint-disable-next-line no-restricted-syntax
    for (const mod of argv.rebuild) {
      // eslint-disable-next-line no-await-in-loop
      await execAsync(`docker exec tester npm rebuild ${mod}`);
    }
  }

  if (argv.gyp) {
    await execAsync('docker exec tester node-gyp configure');
    await execAsync('docker exec tester node-gyp build');
  }

  if (argv.sleep) {
    exec(`sleep ${argv.sleep}`);
  }

  // now determine what we need
  const crossEnv = `${argv.root}/cross-env`;
  const nyc = `${argv.root}/nyc`;
  const testFramework = `${argv.root}/${argv.test_framework}`;
  const customRun = argv.custom_run ? `${argv.custom_run} ` : '';
  const runner = 'docker exec tester /bin/sh';

  await loopThroughCmds(argv.pre);
  await loopThroughCmds(argv.arbitrary_exec, cmd => `docker exec tester ${cmd}`);
  await loopThroughCmds(testFiles, (test) => {
    const basename = path.basename(test, '.js');
    return `${runner} -c "${customRun}${crossEnv} NODE_ENV=test ${nyc} --report-dir ${argv.report_dir}/${basename} ${testFramework} ${test}"`;
  });

  // upload codecoverage report
  if (argv.coverage) {
    echo('uploading coverage');
    exec('./node_modules/.bin/codecov');
  }
};
