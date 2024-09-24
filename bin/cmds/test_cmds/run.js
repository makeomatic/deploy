/**
 * Builds docker images
 */
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { promisify } from 'node:util';

import { glob } from 'glob';
import { $, execaCommand } from 'execa';
import { Client } from 'undici';
import split from 'split2';
import { pipeline as _pipeline, Writable } from 'stream';
import { deserializeError } from 'serialize-error';
import _debug from 'debug';
import { setTimeout } from 'node:timers/promises';
import pLimit from 'p-limit';
import { handler as handlerCompose } from './compose.js';

const pipeline = promisify(_pipeline);
const debug = _debug('test');

const execAsync = (cmd, args, opts = {}) => $(opts)`${cmd} ${args}`;
const echoAndExec = (cmd, args = [], { buffer = false, all = true, ...rest } = {}) => {
  console.log(cmd, ...args);
  if (!buffer && all) {
    rest.stdio = 'inherit';
  }
  const exe = execAsync(cmd, args, { buffer, all, ...rest });
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

export const command = 'run';
export const desc = 'performs testing';
export const handler = async (argv) => {
  if (argv.http && os.platform() === 'darwin') {
    process.emitWarning('http is not supported on os x because we cant share unix sockets', {
      code: 'E_DEP_0001',
      type: 'MakeomaticDeploy',
    });
    argv.http = false;
  }

  await handlerCompose(argv);

  // now that we have compose get tests
  const testFiles = (await glob(argv.tests)).sort();
  if (testFiles.length === 0) {
    console.log('No test files found. Exit 1');
    process.exit(1);
  } else {
    console.log('Found %d test files', testFiles.length);
  }

  const { compose, composeArgs } = argv;

  if (argv.pull) {
    if ((await echoAndExec(compose, [...composeArgs, 'pull'])).exitCode !== 0) {
      console.log('failed pull docker containers. Exit 128');
      process.exit(128);
    }
  }

  if (argv.envFile) {
    composeArgs.unshift('--env-file', argv.envFile);
  }

  // start containers
  if ((await echoAndExec(compose, [...composeArgs, 'up', '-d'])).exitCode !== 0) {
    console.log('failed to start docker containers. Exit 128');
    process.exit(128);
  }

  const containerData = await echoAndExec(compose, [...composeArgs, 'ps', '-q', 'tester'], { buffer: true });
  if (containerData.exitCode !== 0) {
    console.log('failed to get container id. Exit 128');
    process.exit(128);
  }
  const container = containerData.stdout.split('\n').pop();
  console.log(`found container ${container}`);

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

    await setTimeout(1000);

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
        console.log(`failed to exec query: ${body}`);
        console.log(resp);
        process.exit(128);
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
      const execCmd = `${cmd} ${args.join(' ')}`.trim();
      const argOpts = user ? ['--user', user] : [];
      debug(execCmd);
      const ex = execAsync('docker', ['exec', ...argOpts, container, '/bin/sh', '-c', execCmd], { buffer: !stream, all: !stream });

      if (stream) {
        ex.stdout.pipe(process.stdout);
        ex.stderr.pipe(process.stderr);
      }

      return ex;
    };
  }

  async function checkUser(uid) {
    console.log(`checking container user ${uid}`);

    try {
      const { all } = await dockerExec('getent', ['passwd', uid], { user: 'root', stream: false });
      return all.split(':', 1)[0];
    } catch (e) {
      return false;
    }
  }

  async function createUser(name, uid) {
    console.log(`create user "${name}"`);

    const userExtraArgs = uid ? ['-u', uid, '-g', uid] : [];
    await dockerExec('adduser', ['-D', ...userExtraArgs, name], { user: 'root', stream: false });
  }

  async function checkOrCreate(uid) {
    let username = await checkUser(uid);

    if (!username) {
      username = `tester-${uid}`;
      await createUser(username, uid);
    }

    return username;
  }

  if (!argv.isRootless) {
    const uid = process.getuid();

    // ensure same user exists in container
    await checkOrCreate(uid);

    // because 0 is falsy :(
    if (argv.euser != null) {
      argv.euser = await checkOrCreate(argv.euser);
    }

    // because 0 is falsy :(
    if (argv.tuser != null) {
      argv.tuser = await checkOrCreate(argv.tuser);
    }
  }

  // easy way to wait for containers, can do improved detection, but it's not generic
  if (argv.rebuild.length > 0) {
    console.log('rebuilding modules');
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
  const testFramework = `${argv.root}/${argv.test_framework}`;
  const customRun = argv.custom_run ? [argv.custom_run] : [];

  let testCommands;
  if (argv.in_one) {
    const coverageDir = argv.report_dir;

    // somewhat of a hack for jest test coverage
    const testBin = testFramework
      .replace('<coverageDirectory>', coverageDir)
      .split(' ');

    testCommands = [[...customRun, ...testBin, ...testArgs, ...testFiles]];
  } else {
    testCommands = testFiles.map((test) => {
      const testName = removeCommonPrefix(test, argv.tests);
      const coverageDir = `${argv.report_dir}/${testName.substring(0, testName.lastIndexOf('.'))}`;

      // somewhat of a hack for jest test coverage
      const testBin = testFramework
        .replace('<coverageDirectory>', coverageDir)
        .split(' ');

      return [...customRun, ...testBin, ...testArgs, test];
    });
  }

  for (const cmd of argv.pre) {
    // eslint-disable-next-line no-await-in-loop
    await execaCommand(cmd, { stdio: 'inherit' });
  }

  for (const cmd of argv.arbitrary_exec) {
    let args;
    let file;

    if (typeof cmd === 'string') {
      file = cmd;
      args = undefined;
    } else if (Array.isArray(cmd)) {
      [file, ...args] = cmd;
    } else {
      throw new Error('cmd must be array or string');
    }

    // eslint-disable-next-line no-await-in-loop
    await dockerExec(file, args, { user: argv.euser, stdio: 'inherit' });
  }

  const limit = pLimit(argv.sort ? 1 : (argv.parallel || 1));

  await Promise.all(testCommands.map(([cmd, ...args]) => {
    return limit(dockerExec, cmd, args, { user: argv.tuser });
  }));

  for (const cmd of argv.post_exec) {
    // eslint-disable-next-line no-await-in-loop
    await dockerExec(cmd, undefined, { user: argv.euser });
  }

  if (client) await client.close();
};
