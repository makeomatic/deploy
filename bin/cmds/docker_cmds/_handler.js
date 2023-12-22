import assert from 'node:assert/strict';

const kDockerHandler = Symbol('handler');

// eslint-disable-next-line import/prefer-default-export
export const handler = (argv) => {
  if (argv[kDockerHandler]) {
    return;
  }

  assert.ok(typeof argv.version === 'string', `version is ${argv.version}`);

  // prepares variables
  argv.base = `${argv.repository}/${argv.project}`;
  argv.baseTag = argv.include_node ? `${argv.node}-${argv.version}` : argv.version;
  argv.mainTag = `${argv.base}:${argv.baseTag}`;
  argv.tags = argv.extra_tags.map((tag) => (
    `${argv.base}:${tag}`
  ));

  // adds extra tag
  if (argv.include_node) {
    argv.tags.push(`${argv.base}:${argv.node}`);
  }

  // adds :latest tag
  if (argv.tag_latest) {
    argv.tags.push(`${argv.base}:latest`);
  }

  argv[kDockerHandler] = true;
};
