/**
 * Runs tests in the repo
 */

import * as autoComposeCommand from './test_cmds/auto-compose.js';
import * as composeCommand from './test_cmds/compose.js';
import * as runCommand from './test_cmds/run.js';

export const command = 'test <command>';
export const desc = 'performs tests in docker';
export const builder = (yargs) => (
  yargs
    .command(autoComposeCommand)
    .command(composeCommand)
    .command(runCommand)
    .option('docker_compose', {
      describe: 'docker-compose file for testing',
      default: './test/docker-compose.yml',
      normalize: true,
    })
    .option('docker_compose_multi', {
      alias: 'dcm',
      describe: 'docker-compose files that will be started in provided order',
      type: 'string',
      array: true,
      default: [],
    })
    .option('parallel', {
      type: 'number',
      description: 'run test suites in parallel',
      default: 1,
    })
    .option('sort', {
      alias: 's',
      describe: 'sort tests in alphabetical order and run sequentially. disables `parallel` mode',
      boolean: true,
      default: false,
    })
    .option('auto_compose', {
      type: 'boolean',
      default: false,
    })
    .option('auto_compose_version', {
      type: 'string',
      default: '3',
      alias: 'acv',
    })
    .option('with_local_compose', {
      type: 'boolean',
      default: false,
      description: 'also include services defined in the docker_compose file. Senseless w/o auto_compose=true',
    })
    .option('tester_flavour', {
      type: 'string',
      default: 'tester',
    })
    .option('extras', {
      description: 'any extras for tester docker container, will be merged',
      type: 'string',
      default: {},
      coerce(argv) {
        return typeof argv === 'string' ? JSON.parse(argv) : argv;
      },
    })
    .option('services', {
      type: 'array',
      description: 'enable listed services',
      choices: Object.keys(autoComposeCommand.SERVICE_MAP),
    })
    .option('docker_compose_version', {
      alias: 'dcv',
      describe: 'docker-compose version to use',
      default: '1.11.2',
    })
    .option('docker_compose_force', {
      alias: 'dcf',
      describe: 'forces to install local copy of docker-compose in case of version mismatch',
      boolean: true,
      default: false,
    })
    .option('tests', {
      alias: 't',
      describe: 'glob for test files',
      string: true,
      default: './test/suites/**/*.js',
    })
    .option('no_cleanup', {
      alias: 'C',
      describe: 'cleanup automatically',
      default: false,
      boolean: true,
    })
    .option('wait_before_tests', {
      alias: 'sleep',
      describe: 'how much time to wait after docker-compose up',
      default: 0,
      number: true,
    })
    .option('report_dir', {
      describe: 'report dir for coverage',
      default: './coverage',
    })
    .option('test_framework', {
      describe: 'test framework to use',
      default: 'mocha',
    })
    .option('root', {
      describe: 'binary root path on the tester',
      default: '/src/node_modules/.bin',
    })
    .option('rebuild', {
      alias: 'r',
      describe: 'list modules to rebuild during testing',
      default: [],
      array: true,
    })
    .option('on_fail', {
      alias: 'fail',
      describe: 'arbitrary code to execute on test failure',
    })
    .option('custom_run', {
      describe: 'custom run command for the tests',
    })
    .option('gyp', {
      description: 'run nody-gyp-rebuild before tests',
      boolean: true,
      default: false,
    })
    .option('arbitrary_exec', {
      describe: 'arbitrary commands to exec in docker tester',
      default: [],
      array: true,
    })
    .option('pre', {
      describe: 'pre commands to run',
      default: [],
      array: true,
    })
    .option('test_args', {
      describe: 'extra arguments for test framework',
      string: true,
      default: '',
    })
    .option('pull', {
      describe: 'force pull docker containers',
      type: 'boolean',
      default: false,
    })
    .option('post_exec', {
      describe: 'commands to exec in docker tester after all tests finished',
      default: [],
      array: true,
    })
    .option('http', {
      describe: 'uses http exec instead of docker exec to run tests',
      type: 'boolean',
      default: false,
    })
    .option('mutagen-dir', {
      describe: 'custom mutagen dir',
      default: process.cwd(),
    })
    .option('mutagen-working-dir', {
      describe: 'custom mutagen working dir',
    })
    .option('mutagen-volume-name', {
      describe: 'shared mutagen volume name',
      type: 'string',
      default: 'makeomatic-deploy-code',
    })
    .option('mutagen-volume-external', {
      describe: 'set as external to avoid recreating each time',
      type: 'boolean',
      default: false,
    })
    .option('exec-user', {
      alias: 'euser',
      describe: 'user to run setup commands with',
      type: 'string',
    })
    .option('test-user', {
      alias: 'tuser',
      describe: 'user to run test commands with',
      type: 'string',
    })
    .option('in-one', {
      alias: 'in_one',
      describe: 'runs all tests in 1 test runner',
      type: 'boolean',
      default: false,
    })
    .option('env-file', {
      alias: 'env_file',
      describe: '.env file for docker-compose',
      type: 'string',
    })
    .option('only-prepare', {
      describe: 'creates containers but doesn\'t run the tests',
      type: 'boolean',
      default: false,
    })
    .help()
);

export const handler = () => {};
