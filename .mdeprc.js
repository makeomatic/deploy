/* eslint-disable no-template-curly-in-string */

module.exports = {
  nycCoverage: false,
  test_framework: 'jest --coverage --coverageDirectory <coverageDirectory> --runTestsByPath --maxWorkers=50% --colors',
  tests: '__tests__/*.js',
  auto_compose: true,
  node: '16',
  tester_flavour: 'chrome-tester',
  mirror: process.platform !== 'darwin',
  services: [
    'redisSentinel',
    'redisCluster',
    'rabbitmq',
    'postgres',
    'elasticsearch',
    'cassandra',
    'couchdb',
  ],
  mutagenVolumeExternal: true,
  mutagenVolumeName: 'mdep-src  ',
  in_one: true,
  extras: {
    tester: {
      shm_size: '256m',
      environment: {
        CHROME_PATH: '/usr/bin/chromium-browser',
        DEBUG: "${DEBUG:-''}",
      },
    },
  },
  euser: 'root',
  tuser: 'node',
  arbitrary_exec: ['apk add git'],
};
