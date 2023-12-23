/* eslint-disable no-template-curly-in-string */
import { userInfo } from 'node:os';

const { uid } = userInfo();

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
  euser: 0,
  tuser: uid,
  arbitrary_exec: [
    'apk add git',
    process.env.flavour === 'http'
      ? ['/bin/sh', '-c', `addgroup $(getent passwd ${uid} | cut -d: -f1) node`] // child_process.exec
      : ['addgroup', `$(getent passwd ${uid} | cut -d: -f1)`, 'node'], // docker exec /bin/sh -c "<command>"
  ],
};
