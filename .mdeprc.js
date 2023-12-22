/* eslint-disable no-template-curly-in-string */
import { userInfo } from 'node:os';

export default {
  test_framework: 'c8 node --test',
  tests: '__tests__/*.js',
  auto_compose: true,
  node: '20.10',
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
  mutagenVolumeExternal: true,
  mutagenVolumeName: 'mdep-src',
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
  tuser: userInfo().username,
  arbitrary_exec: ['apk add git'],
};
