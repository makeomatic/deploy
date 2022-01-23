/* eslint-disable no-template-curly-in-string */
const execa = require('execa');

const yarnCache = execa.commandSync('yarn cache dir').stdout;

module.exports = {
  nycCoverage: false,
  test_framework: 'jest --coverage --coverageDirectory <coverageDirectory> --runTestsByPath --maxWorkers=50% --verbose --colors',
  tests: '__tests__/*.js',
  auto_compose: true,
  node: '16',
  tester_flavour: 'chrome-tester',
  services: [
    'redisSentinel',
    'redisCluster',
    'rabbitmq',
    'postgres',
    'elasticsearch',
    'cassandra',
    'couchdb',
  ],
  in_one: true,
  extras: {
    tester: {
      shm_size: '128m',
      environment: {
        CHROME_PATH: '/usr/bin/chromium-browser',
        DEBUG: "${DEBUG:-''}",
      },
      volumes: [
        `${yarnCache}:/tmp/yarn-cache/v6:ro`,
      ],
    },
  },
  arbitrary_exec: [
    'apk add git',
  ],
};
