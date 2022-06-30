/**
 * port used to launch test runner
 */
const { PassThrough, compose } = require('stream');
const Fastify = require('fastify').default;
const { Type } = require('@sinclair/typebox');
const execa = require('execa');
const { serializeError } = require('serialize-error');
const id = require('hyperid')({ urlSafe: true });
const logger = require('pino')();

const Command = Type.Object({
  file: Type.String(),
  args: Type.Optional(Type.Array(Type.String({ minLength: 1 }))),
  timeout: Type.Optional(Type.Number({ default: 0 })),
  user: Type.Optional(Type.String()),
});

const fastify = Fastify({
  logger: false,
});

fastify.register(require('@fastify/compress'));

const uidCache = Object.create(null);
const hasOwnProperty = Object.prototype.hasOwnProperty.bind(uidCache);

fastify.post('/exec', { schema: { body: Command } }, async (request, reply) => {
  const { file, args, timeout, user } = request.body;
  const opts = { all: true, buffer: false, timeout };

  if (user) {
    if (!hasOwnProperty(user)) {
      uidCache[user] = (await execa('id', ['-u', user])).stdout;
    }
    opts.user = uidCache[user];
  }

  const subprocess = args
    ? execa(file, args, opts)
    : execa.command(file, opts);

  reply.type('text/plain');

  return compose(
    subprocess.all,
    new PassThrough({
      objectMode: false,
      async flush(next) {
        let p;
        try {
          p = await subprocess;
        } catch (e) {
          p = serializeError(e);
        }
        fastify.log.info({ data: p });
        this.push('\n');
        this.push(JSON.stringify(p));
        next();
      },
    })
  );
});

// Run the server!
const sockId = id();
const opts = {
  path: `/var/run/fastify.${sockId}.sock`,
  readableAll: true,
  writableAll: true,
};

fastify.listen(opts, (err) => {
  if (err) {
    logger.error({ err }, 'failed to start fastify');
    process.exit(1);
  }

  logger.info({ socketId: `fastify.${sockId}.sock` }, 'socket');
});
