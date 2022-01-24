/**
 * Builds docker images
 */
const os = require('os');
const Promise = require('bluebird');
const path = require('path');
const glob = require('glob');
const execa = require('execa');
const { echo, exit } = require('shelljs');
const { Client } = require('undici');
// const { resolve } = require('path');
const split = require('split2');
const { pipeline: _pipeline, Writable } = require('stream');
const { promisify } = require('util');
const { deserializeError } = require('serialize-error');

const pipeline = promisify(_pipeline);
const debug = require('debug')('test');

const execAsync = (cmd, args, opts) => execa(cmd, args, opts);
const echoAndExec = (cmd, args = [], { buffer = false, all = true, ...rest } = {}) => {
  echo(cmd, ...args);
  const exe = execAsync(cmd, args, { buffer, all, ...rest });
  if (!buffer && all) {
    exe.all.pipe(process.stdout);
  }
  return exe;
};

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

  const { compose, composeArgs } = argv;

  if (argv.pull) {
    if ((await echoAndExec(compose, [...composeArgs, 'pull'])).exitCode !== 0) {
      echo('failed pull docker containers. Exit 128');
      exit(128);
    }
  }

  // start containers
  if ((await echoAndExec(compose, [...composeArgs, 'up', '-d'])).exitCode !== 0) {
    echo('failed to start docker containers. Exit 128');
    exit(128);
  }

  const containerData = await echoAndExec(compose, [...composeArgs, 'ps', '-q', 'tester'], { buffer: true });
  if (containerData.exitCode !== 0) {
    echo('failed to get container id. Exit 128');
    exit(128);
  }
  const container = containerData.stdout.split('\n').pop();
  echo(`found container ${container}`);

  /**
   * @type {Client}
   */
  let client;
  let dockerExec;
  if (argv.http) {
    const getSocketId = async (attempt = 0) => {
      try {
        const { stdout } = await execAsync('docker', ['logs', container]);
        return JSON.parse(stdout.split('\n').pop()).socketId;
      } catch (e) {
        if (attempt > 10) throw e;
        await new Promise((resolve) => setTimeout(resolve, 500));
        return getSocketId(attempt + 1);
      }
    };

    const socketId = await getSocketId();

    client = new Client({
      hostname: 'localhost',
      protocol: 'http:',
    }, {

      socketPath: `${os.homedir()}/.local/share/mdep-runner/${socketId}`,
      keepAliveTimeout: 10, // milliseconds
      keepAliveMaxTimeout: 10, // milliseconds
      headersTimeout: 0,
      bodyTimeout: 0,
    });

    dockerExec = async (cmd, args, { stream = true, timeout = 0, assertCode = true } = {}) => {
      const body = JSON.stringify({ file: cmd, args, timeout });
      debug(body);
      const res = await client.request({
        method: 'POST',
        path: '/exec',
        headers: {
          'content-type': 'application/json',
        },
        body,
      });

      if (res.statusCode !== 200) {
        const resp = await res.body.text();
        echo('failed to exec query');
        echo(resp);
        exit(128);
      }

      const all = [];
      let result;
      await pipeline(res.body, split(), new Writable({
        write(chunk, enc, next) {
          if (this.$chunk) {
            if (stream) {
              process.stdout.write(this.$chunk);
              process.stdout.write('\n');
            } else {
              all.push(this.$chunk);
            }
          }

          this.$chunk = chunk;
          next();
        },
        final(next) {
          result = JSON.parse(this.$chunk);
          next();
        },
      }));

      if (assertCode && result.exitCode !== 0) {
        throw deserializeError(result);
      }

      result.all = all.join('\n');
      return result;
    };
  } else {
    dockerExec = async (cmd, args = [], { stream = true } = {}) => {
      const command = `${cmd} ${args.join(' ')}`.trim();
      const ex = execAsync('docker', ['exec', container, '/bin/sh', '-c', command], { buffer: !stream });

      if (stream) {
        ex.stdout.pipe(process.stdout);
        ex.stderr.pipe(process.stderr);
      }

      return ex;
    };
  }

  // easy way to wait for containers, can do improved detection, but it's not generic
  if (argv.rebuild.length > 0) {
    echo('rebuilding modules');
    for (const mod of argv.rebuild) {
      // eslint-disable-next-line no-await-in-loop
      await dockerExec('npm', ['rebuild', mod]);
    }
  }

  if (argv.gyp) {
    await dockerExec('node-gyp', ['configure']);
    await dockerExec('node-gyp', ['build']);
  }

  if (argv.sleep) {
    await echoAndExec('sleep', [argv.sleep]);
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
  const customRun = argv.custom_run ? [argv.custom_run] : [];

  let testCommands;
  if (argv.in_one) {
    const coverageDir = argv.report_dir;
    const nycReportDir = argv.nycReport ? ['--report-dir', coverageDir] : [];
    const cov = argv.nycCoverage ? [nyc, ...nycReportDir] : [];
    // somewhat of a hack for jest test coverage
    const testBin = testFramework
      .replace('<coverageDirectory>', coverageDir)
      .split(' ');

    testCommands = [[...customRun, crossEnv, 'NODE_ENV=test', ...cov, ...testBin, ...testArgs, ...testFiles]];
  } else {
    testCommands = testFiles.map((test) => {
      const testName = removeCommonPrefix(test, argv.tests);
      const coverageDir = `${argv.report_dir}/${testName.substring(0, testName.lastIndexOf('.'))}`;
      const nycReportDir = argv.nycReport ? ['--report-dir', coverageDir] : [];
      const cov = argv.nycCoverage ? [nyc, ...nycReportDir] : [];
      // somewhat of a hack for jest test coverage
      const testBin = testFramework
        .replace('<coverageDirectory>', coverageDir)
        .split(' ');

      return [...customRun, crossEnv, 'NODE_ENV=test', ...cov, ...testBin, ...testArgs, test];
    });
  }

  await Promise.map(argv.pre, (cmd) => execa.command(cmd));
  await Promise.map(argv.arbitrary_exec, (cmd) => dockerExec(cmd, undefined));

  const testCmds = argv.sort
    ? Promise.each(testCommands, ([cmd, ...args]) => dockerExec(cmd, args))
    : Promise.map(testCommands, ([cmd, ...args]) => dockerExec(cmd, args), { concurrency: argv.parallel || 1 });
  await testCmds;

  await Promise.map(argv.post_exec, (cmd) => dockerExec(cmd));

  // upload codecoverage report
  if (argv.coverage) {
    // this is to avoid exposing token
    await echoAndExec(argv.coverage, ['>', '/dev/null', '2>1']);
  }

  if (client) await client.close();
};
