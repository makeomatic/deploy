/**
 * Builds docker images
 */
const os = require('os');
const Promise = require('bluebird');
const path = require('path');
const _glob = require('glob');
const execa = require('execa');
const { echo, exit } = require('shelljs');
const { Client } = require('undici');
const split = require('split2');
const { pipeline: _pipeline, Writable } = require('stream');
const { promisify } = require('util');
const { deserializeError } = require('serialize-error');
const assert = require('assert');

const glob = promisify(_glob);
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
  if (argv.http && os.platform() === 'darwin') {
    process.emitWarning('http is not supported on os x because we cant share unix sockets', {
      code: 'E_DEP_0001',
      type: 'MakeomaticDeploy',
    });
    argv.http = false;
  }

  await require('./compose').handler(argv);

  // now that we have compose get tests
  const testFiles = (await glob(argv.tests)).sort();
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

  if (argv.envFile) {
    composeArgs.unshift('--env-file', argv.envFile);
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

  const getField = async (field, attempt = 0) => {
    const { stdout } = await execAsync('docker', ['logs', container]);
    const lines = stdout.split('\n');

    let line;
    // eslint-disable-next-line no-cond-assign
    while ((line = lines.pop()) !== undefined) {
      try {
        debug('assessing line - `%s`', line);
        const data = JSON.parse(line)[field];
        assert(data);
        return data;
      } catch (e) {
        debug('line %s', line, e.message);
        // ignore line, check previous
      }
    }

    if (attempt > 20) throw new Error(`cant get "${field}" id after 20s`);

    await new Promise((resolve) => setTimeout(resolve, 1000));

    return getField(field, attempt + 1);
  };

  /**
   * @type {Client}
   */
  let client;
  let dockerExec;
  if (argv.auto_compose && argv.http) {
    const socketId = await getField('socketId');

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

    dockerExec = async (cmd, args, { stream = true, timeout = 0, assertCode = true, user } = {}) => {
      const body = JSON.stringify({ file: cmd, args, timeout, user });
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
    if (argv.auto_compose) {
      await getField('ready');
    }

    dockerExec = async (cmd, args = [], { stream = true, user } = {}) => {
      const command = `${cmd} ${args.join(' ')}`.trim();
      const argOpts = user ? ['--user', user] : [];
      debug(command);
      const ex = execAsync('docker', ['exec', ...argOpts, container, '/bin/sh', '-c', command], { buffer: !stream });

      if (stream) {
        ex.stdout.pipe(process.stdout);
        ex.stderr.pipe(process.stderr);
      }

      return ex;
    };
  }

  async function checkUser(name) {
    echo(`checking container user ${name}`);

    try {
      await dockerExec('getent', ['passwd', name], { user: 'root' });
      return true;
    } catch (e) {
      return false;
    }
  }

  async function createUser(name, uid) {
    echo(`create user "${name}"`);

    const userExtraArgs = uid ? ['-u', uid, '-g', uid] : [];
    await dockerExec('adduser', ['-D', ...userExtraArgs, name], { user: 'root' });
  }

  if (!argv.isRootless) {
    const uid = process.getuid();

    if (!(await checkUser(uid))) {
      await createUser('tester', uid);
    }

    if (argv.ruser && !(await checkUser(argv.ruser))) {
      await createUser(argv.ruser);
    }

    if (argv.tuser && !(await checkUser(argv.tuser))) {
      await createUser(argv.tuser);
    }
  }

  // easy way to wait for containers, can do improved detection, but it's not generic
  if (argv.rebuild.length > 0) {
    echo('rebuilding modules');
    for (const mod of argv.rebuild) {
      // eslint-disable-next-line no-await-in-loop
      await dockerExec('npm', ['rebuild', mod], { user: argv.euser });
    }
  }

  if (argv.gyp) {
    await dockerExec('node-gyp', ['configure'], { user: argv.euser });
    await dockerExec('node-gyp', ['build'], { user: argv.euser });
  }

  if (argv.onlyPrepare) {
    if (client) await client.close();
    return;
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
  await Promise.map(argv.arbitrary_exec, (cmd) => dockerExec(cmd, undefined, { user: argv.euser }));

  const testCmds = argv.sort
    ? Promise.each(testCommands, ([cmd, ...args]) => dockerExec(cmd, args, { user: argv.tuser }))
    : Promise.map(testCommands, ([cmd, ...args]) => dockerExec(cmd, args), { user: argv.tuser, concurrency: argv.parallel || 1 });
  await testCmds;

  await Promise.map(argv.post_exec, (cmd) => dockerExec(cmd, undefined, { user: argv.euser }));

  if (client) await client.close();
};
