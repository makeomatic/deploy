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
  couchdb,
};

exports.SERVICE_MAP = SERVICE_MAP;
exports.command = 'compose';
exports.desc = 'prepares docker-compose file based on config';
exports.handler = (argv) => {
  const getId = hyperid({ fixedLength: true, urlSafe: true });

  // Header of the file
  const compose = {};
  compose.version = argv.acv;
  compose.networks = {};
  compose.services = {};
  compose.volumes = {};

  if (argv.isMutagen) {
    compose.volumes['makeomatic-deploy-code'] = {};
    compose['x-mutagen'] = {
      sync: {
        defaults: {
          ignore: { vcs: true },
          mode: 'two-way-resolved',
        },
        code: {
          alpha: process.cwd(),
          beta: 'volume://makeomatic-deploy-code',
        },
      },
    };
  }

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
  const location = [dir, argv.project, filename].join(path.sep);

  // write out the file, ensure dir exists
  mkdir(`${dir}/${argv.project}`);
  fs.writeFileSync(location, jsYaml.dump(compose));

  // rewrite location of docker-compose
  argv.docker_compose = location;
};

/**
 * Prepares tester declaration
 */
function tester(compose, argv) {
  const testerConfig = merge({
    image: argv.tester_image || `makeomatic/node:${argv.node}-${argv.tester_flavour}`,
    hostname: 'tester',
    working_dir: '/src',
    volumes: [],
    environment: {
      NODE_ENV: 'test',
    },
    command: 'tail -f /dev/null',
  }, argv.extras.tester);
  const volumes = testerConfig.volumes.filter((volume) => !volume.includes('${PWD}:/src'));

  volumes.push(argv.isMutagen ? 'makeomatic-deploy-code:/src' : '${PWD}:/src');
  testerConfig.volumes = volumes;

  compose.services.tester = testerConfig;
}

function redisCluster(compose, argv) {
  compose.services['redis-cluster'] = merge({
    image: 'makeomatic/redis-cluster:5-alpine',
    hostname: 'redis-cluster',
  }, argv.extras.redisCluster);
}

function redis(compose, argv) {
  compose.services.redis = merge({
    image: 'redis:6-alpine',
    hostname: 'redis',
    expose: ['6379'],
  }, argv.extras.redis);
}

function redisSentinel(compose, argv) {
  redis(compose, argv);

  const entrypoint = path.resolve(__dirname, '../../../templates/redis-sentinel.sh');
  compose.services['redis-sentinel'] = merge({
    image: 'redis:6-alpine',
    hostname: 'redis-sentinel',
    expose: ['26379'],
    depends_on: ['redis'],
    volumes: [`${entrypoint}:/entrypoint.sh:ro`],
    command: '/bin/sh /entrypoint.sh redis',
  }, argv.extras.redisSentinel);
}

function postgres(compose, argv) {
  compose.services.postgres = merge({
    image: 'postgres:14-alpine',
    hostname: 'postgres',
    environment: {
      POSTGRES_HOST_AUTH_METHOD: 'trust',
    },
  }, argv.extras.postgres);
}

function rabbitmq(compose, argv) {
  compose.services.rabbitmq = merge({
    image: 'rabbitmq:3-management-alpine',
    hostname: 'rabbitmq',
  }, argv.extras.rabbitmq);
}

function elasticsearch(compose, argv) {
  compose.services.elasticsearch = merge({
    image: 'elasticsearch:7.14.2',
    hostname: 'elasticsearch',
    expose: [
      '9200',
      '9300',
    ],
    environment: {
      ES_JAVA_OPTS: '-Xms128m -Xmx128m',
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

function couchdb(composer, argv) {
  composer.services.couchdb = merge({
    image: 'couchdb:2',
    hostname: 'couchdb',
    environment: {
      COUCHDB_USER: 'admin',
      COUCHDB_PASSWORD: 'admin',
      COUCHDB_SECRET: 'secret',
      NODENAME: 'docker',
    },
  }, argv.extras.couchdb);
}
