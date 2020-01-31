/**
 * Builds docker images
 */

const Promise = require('bluebird');
const path = require('path');
const glob = require('glob');
const { exec, echo, exit } = require('shelljs');

// to lower CPU usage
async function execAsync(cmd) {
  return Promise.fromCallback((next) => (
    exec(cmd, (code, stdout, stderr) => next(null, { code, stdout, stderr }))
  ));
}

async function echoAndExec(cmd) {
  echo(cmd);
  return execAsync(cmd);
}

async function runCommand(cmd) {
  const results = await echoAndExec(cmd);
  if (!results || results.code !== 0) {
    echo(`failed to run ${cmd}, exiting 128...`);
    exit(128);
  }
}

function removeCommonPrefix(from, compareWith) {
  let i = 0;
  const normalizedFrom = path.normalize(from);
  const normalizedCompare = path.normalize(compareWith);

  while (normalizedFrom.charAt(i) === normalizedCompare.charAt(i)
         && i < normalizedFrom.length) {
    i += 1;
  }

  return normalizedFrom.substring(i);
}

exports.command = 'run';
exports.desc = 'performs testing';
exports.handler = async (argv) => {
  require('./compose').handler(argv);

  // now that we have compose get tests
  const testFiles = glob.sync(argv.tests).sort();
  if (testFiles.length === 0) {
    echo('No test files found. Exit 1');
    exit(1);
  } else {
    echo('Found %d test files', testFiles.length);
  }

  const { compose } = argv;

  if (argv.pull) {
    if (await echoAndExec(`${compose} pull`).code !== 0) {
      echo('failed pull docker containers. Exit 128');
      exit(128);
    }
  }

  // start containers
  if ((await echoAndExec(`${compose} up -d`)).code !== 0) {
    echo('failed to start docker containers. Exit 128');
    exit(128);
  }

  const containerData = await echoAndExec(`${compose} ps -q tester`);
  if (containerData.code !== 0) {
    echo('failed to get container id. Exit 128');
    exit(128);
  }
  const container = containerData.stdout.trim();

  // easy way to wait for containers, can do improved detection, but it's not generic
  if (argv.rebuild.length > 0) {
    echo('rebuilding modules');
    for (const mod of argv.rebuild) {
      // eslint-disable-next-line no-await-in-loop
      await execAsync(`docker exec ${container} npm rebuild ${mod}`);
    }
  }

  if (argv.gyp) {
    await execAsync(`docker exec ${container} node-gyp configure`);
    await execAsync(`docker exec ${container} node-gyp build`);
  }

  if (argv.sleep) {
    await echoAndExec(`sleep ${argv.sleep}`);
  }

  // support argv.test_args and passed '--' args
  const testArgs = argv._.slice(2);

  // default set to ''
  if (argv.test_args !== '') {
    testArgs.push(argv.test_args);
  }

  // now determine what we need
  const crossEnv = `${argv.root}/cross-env`;
  const nyc = `${argv.root}/nyc`;
  const testFramework = `${argv.root}/${argv.test_framework}`;
  const customRun = argv.custom_run ? `${argv.custom_run} ` : '';
  const runner = `docker exec ${container} /bin/sh`;
  const testCommands = testFiles.map((test) => {
    const testName = removeCommonPrefix(test, argv.tests);
    const coverageDir = `${argv.report_dir}/${testName.substring(0, testName.lastIndexOf('.'))}`;
    const nycReportDir = argv.nycReport ? ` --report-dir ${coverageDir}` : '';
    const cov = argv.nycCoverage ? `${nyc}${nycReportDir}` : '';
    // somewhat of a hack for jest test coverage
    const testBin = testFramework
      .replace('<coverageDirectory>', coverageDir);

    return `${runner} -c "${customRun}${crossEnv} NODE_ENV=test ${cov} ${testBin} ${testArgs.join(' ')} ${test}"`;
  });

  await Promise.map(argv.pre, runCommand);
  await Promise.map(argv.arbitrary_exec.map((cmd) => `docker exec ${container} ${cmd}`), runCommand);

  const testCmds = argv.sort
    ? Promise.each(testCommands, runCommand)
    : Promise.map(testCommands, runCommand, { concurrency: argv.parallel || 1 });
  await testCmds;

  await Promise.map(argv.post_exec.map((cmd) => `docker exec ${container} ${cmd}`), runCommand);

  // upload codecoverage report
  if (argv.coverage) {
    // this is to avoid exposing token
    await echoAndExec(`${argv.coverage} > /dev/null 2>1`);
  }
};
