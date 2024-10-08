import jsYaml from 'js-yaml';
import os from 'node:os';
import fs from 'node:fs/promises';
import hyperid from 'hyperid';
import merge from 'lodash.merge';
import path, { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Prepares tester declaration
 */
async function tester(compose, argv) {
  const socketDir = resolve(process.env.HOME, '.local/share/mdep-runner');
  // eslint-disable-next-line quotes
  const defaultCmd = `/bin/sh -c 'echo {\\"ready\\":true} && exec tail -f /dev/null'`;
  const testerConfig = merge({
    image: argv.tester_image || `makeomatic/node:${argv.node}-${argv.tester_flavour}`,
    hostname: 'tester',
    working_dir: '/src',
    volumes: [],
    depends_on: Object.keys(compose.services),
    environment: {
      NODE_ENV: 'test',
    },
    ports: [],
    command: defaultCmd,
  }, argv.extras.tester);

  const workingDir = testerConfig.working_dir;
  // eslint-disable-next-line no-template-curly-in-string
  const sourceDir = argv.mutagenDir || '${PWD}';
  const mutagenWorkingDir = argv.mutagenWorkingDir || workingDir;
  const workingVolume = `${sourceDir}:${mutagenWorkingDir}`;

  /**
   * @type {string[]}
   */
  const volumes = testerConfig.volumes.filter((volume) => volume !== workingVolume);

  // this will allow one to "override" folders inside
  volumes.unshift(
    argv.isMutagen ? `${argv.mutagenVolumeName}:${mutagenWorkingDir}` : workingVolume
  );

  if (argv.isRootless && testerConfig.user) {
    delete testerConfig.user;
  }

  if (argv.http) {
    await fs.mkdir(socketDir, { recursive: true, mode: 0o0755 });
    volumes.push(`${socketDir}:/var/run`);
    volumes.push(`${resolve(__dirname, '../../..')}:${workingDir}/node_modules/@makeomatic/deploy`);
    if (testerConfig.command === defaultCmd) {
      testerConfig.command = `node ${workingDir}/node_modules/@makeomatic/deploy/bin/runner.mjs`;
    }
  }

  if (argv.services && argv.services.includes('redisCluster')) {
    const cmdWait = process.env.DEPLOY_CLUSTER_SCRIPT || '/deploy-scripts/wait-for-cluster.sh';
    volumes.push(
      `${resolve(__dirname, '../../../scripts/wait-for-cluster.sh')}:${cmdWait}`
    );
    testerConfig.command = `${cmdWait} ${testerConfig.command}`;
  }

  testerConfig.volumes = volumes;

  compose.services.tester = testerConfig;
}

function redisCluster(compose, argv) {
  compose.services['redis-cluster'] = merge({
    image: 'makeomatic/redis-stack-cluster:6',
    hostname: 'redis-cluster',
  }, argv.extras.redisCluster);
}

function redis(compose, argv) {
  compose.services.redis = merge({
    image: 'redis/redis-stack-server:6.2.6-v10',
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
    image: 'cassandra:4',
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

export const SERVICE_MAP = {
  redis,
  redisCluster,
  redisSentinel,
  postgres,
  rabbitmq,
  elasticsearch,
  cassandra,
  couchdb,
};

export const command = 'compose';
export const desc = 'prepares docker-compose file based on config';
export const handler = async (argv) => {
  const getId = hyperid({ fixedLength: true, urlSafe: true });

  // Header of the file
  const compose = {};
  compose.networks = {};
  compose.services = {};
  compose.volumes = {};

  if (argv.isMutagen) {
    compose.volumes[argv.mutagenVolumeName] = {};
    if (argv.mutagenVolumeExternal) {
      compose.volumes[argv.mutagenVolumeName].name = argv.mutagenVolumeName;
    }

    compose['x-mutagen'] = {
      sync: {
        defaults: {
          ignore: { vcs: true },
          mode: 'two-way-resolved',
        },
        code: {
          alpha: argv.mutagenDir,
          beta: `volume://${argv.mutagenVolumeName}`,
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
  await tester(compose, argv);

  // finalize and push out to tmp
  const dir = os.tmpdir();
  const filename = `docker-compose.${getId()}.yml`;
  const location = [dir, argv.project, filename].join(path.sep);

  // write out the file, ensure dir exists
  await fs.mkdir(`${dir}/${argv.project}`, { recursive: true, mode: 0o0770 });
  await fs.writeFile(location, jsYaml.dump(compose));

  // rewrite location of docker-compose
  argv.docker_compose = location;
};
