/* eslint-disable no-use-before-define, no-template-curly-in-string */
const jsYaml = require('js-yaml');
const os = require('os');
const fs = require('fs');
const hyperid = require('hyperid');
const merge = require('lodash.merge');
const path = require('path');
const { mkdir } = require('shelljs');

const SERVICE_MAP = {
  redis,
  redisCluster,
  redisSentinel,
  postgres,
  rabbitmq,
  elasticsearch,
  cassandra,
};

exports.SERVICE_MAP = SERVICE_MAP;
exports.command = 'compose';
exports.desc = 'prepares docker-compose file based on config';
exports.handler = (argv) => {
  const getId = hyperid({ fixedLength: true, urlSafe: true });

  // Header of the file
  const compose = {};
  compose.version = '3';
  compose.networks = {};
  compose.services = {};

  // Identification
  if (Array.isArray(argv.services) && argv.services.length) {
    for (const service of argv.services) {
      const ctor = SERVICE_MAP[service];
      if (ctor === undefined) {
        throw new Error(`no support for ${service}, please add it to @makeomatic/deploy`);
      }

      ctor(compose, argv);
    }
  }

  // add default tester service
  tester(compose, argv);

  // finalize and push out to tmp
  const dir = os.tmpdir();
  const filename = `docker-compose.${getId()}.yml`;
  const location = `${dir}/${argv.project}/${filename}`;

  // write out the file, ensure dir exists
  mkdir(`${dir}/${argv.project}`);
  fs.writeFileSync(location, jsYaml.safeDump(compose));

  // rewrite location of docker-compose
  argv.docker_compose = location;
};

/**
 * Prepares tester declaration
 */
function tester(compose, argv) {
  compose.services.tester = merge({
    image: argv.tester_image || `makeomatic/node:${argv.node}-${argv.tester_flavour}`,
    hostname: 'tester',
    working_dir: '/src',
    volumes: ['${PWD}:/src'],
    environment: {
      NODE_ENV: 'test',
    },
    command: 'tail -f /dev/null',
  }, argv.extras.tester);
}

function redisCluster(compose, argv) {
  compose.services['redis-cluster'] = merge({
    image: 'makeomatic/redis-cluster:3.2.9',
    hostname: 'redis-cluster',
  }, argv.extras.redisCluster);
}

function redis(compose, argv) {
  compose.services.redis = merge({
    image: 'redis:4.0.11-alpine',
    hostname: 'redis',
    expose: ['6379'],
  }, argv.extras.redis);
}

function redisSentinel(compose, argv) {
  redis(compose, argv);

  const entrypoint = path.resolve(__dirname, '../../../templates/redis-sentinel.sh');
  compose.services['redis-sentinel'] = merge({
    image: 'redis:4.0.11-alpine',
    hostname: 'redis-sentinel',
    expose: ['26379'],
    depends_on: ['redis'],
    volumes: [`${entrypoint}:/entrypoint.sh:ro`],
    command: '/bin/sh /entrypoint.sh redis',
  }, argv.extras.redisSentinel);
}

function postgres(compose, argv) {
  compose.services.postgres = merge({
    image: 'postgres:10.4-alpine',
    hostname: 'postgres',
  }, argv.extras.postgres);
}

function rabbitmq(compose, argv) {
  compose.services.rabbitmq = merge({
    image: 'rabbitmq:3.7.8-management-alpine',
    hostname: 'rabbitmq',
  }, argv.extras.rabbitmq);
}

function elasticsearch(compose, argv) {
  compose.services.elasticsearch = merge({
    image: 'docker.elastic.co/elasticsearch/elasticsearch:6.4.1',
    hostname: 'elasticsearch',
    expose: [
      '9200',
      '9300',
    ],
    environment: {
      ES_JAVA_OPTS: '"-Xms128m -Xmx128m"',
      'discovery.type': 'single-node',
      'http.host': '0.0.0.0',
      'transport.host': '127.0.0.1',
      'xpack.security.enabled': 'false',
    },
    ulimits: {
      memlock: {
        soft: -1,
        hard: -1,
      },
      nofile: {
        soft: 65536,
        hard: 65536,
      },
    },
    cap_add: ['IPC_LOCK'],
  }, argv.extras.elasticsearch);
}

function cassandra(composer, argv) {
  composer.services.cassandra = merge({
    image: 'cassandra:3.11',
    hostname: 'cassandra',
    environment: {
      MAX_HEAP_SIZE: '128m',
      HEAP_NEWSIZE: '24m',
    },
  }, argv.extras.cassandra);
}
