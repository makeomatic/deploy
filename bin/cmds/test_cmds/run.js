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

async function loopThroughCmds(arr, makeCmd = (it) => it, concurrency = 1) {
  const instructionProcessFn = async (instructions) => {
    const command = makeCmd(instructions);
    const results = await echoAndExec(command);
    if (!results || results.code !== 0) {
      echo(`failed to run ${command}, exiting 128...`);
      exit(128);
    }
  };

  if (concurrency > 1) {
    await Promise.map(arr, instructionProcessFn , { concurrency });
  } else {
    await Promise.mapSeries(arr, instructionProcessFn);
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
    // eslint-disable-next-line no-restricted-syntax
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

  // now determine what we need
  const crossEnv = `${argv.root}/cross-env`;
  const nyc = `${argv.root}/nyc`;
  const testFramework = `${argv.root}/${argv.test_framework}`;
  const customRun = argv.custom_run ? `${argv.custom_run} ` : '';
  const runner = `docker exec ${container} /bin/sh`;

  // support argv.test_args and passed '--' args
  const [,, ...passedArgs ] = argv._;
  const testArgs = [...passedArgs];

  // default set to ''
  if (argv.test_args !== '') {
    testArgs.push(argv.test_args);
  }

  await loopThroughCmds(argv.pre);
  await loopThroughCmds(argv.arbitrary_exec, (cmd) => `docker exec ${container} ${cmd}`);
  await loopThroughCmds(testFiles, (test) => {
    const testName = removeCommonPrefix(test, argv.tests);
    const coverageDir = `${argv.report_dir}/${testName.substring(0, testName.lastIndexOf('.'))}`;
    const cov = argv.nycCoverage ? `${nyc} --report-dir ${coverageDir}` : '';

    // somewhat of a hack for jest test coverage
    const testBin = testFramework
      .replace('<coverageDirectory>', coverageDir);

    return `${runner} -c "${customRun}${crossEnv} NODE_ENV=test ${cov} ${testBin} ${testArgs.join(' ')} ${test}"`;
  }, argv.parallel);

  // upload codecoverage report
  if (argv.coverage) {
    // this is to avoid exposing token
    await echoAndExec(`${argv.coverage} > /dev/null 2>1`);
  }
};
