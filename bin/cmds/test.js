/**
 * Runs tests in the repo
 * @type {String}
 */

exports.command = 'test <command>';
exports.desc = 'performs tests in docker';
exports.builder = yargs => (
  yargs
    .commandDir('test_cmds')
    .option('docker_compose', {
      describe: 'docker-compose file for testing',
      default: './test/docker-compose.yml',
      normalize: true,
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
    .option('coverage', {
      describe: 'whether to upload coverage or not',
      boolean: true,
      default: !!process.env.CI,
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
);
exports.handler = () => {};
