# Makeomatic deploy tools

Provides convenient deploy tools, which automate publishing of docker images, documentation & testing

## Install

`npm i @makeomatic/deploy -D`

## Utility functions

```js
const Promise = require('bluebird');
const { inspectPromise } = require('@makeomatic/deploy');

// simple test cases that illustrate inspectPromise utility
describe('Promise verification', () => {
  it('rejects request', () => {
    return Promise
      .reject(new Error('some great error'))
      .reflect()
      .then(inspectPromise(false))
      .then((err) => {
        assert.equal(err.message, 'some great error');
        return null;
      });
  });

  it('promise does not reject', () => {
    return Promise
      .resolve('banana')
      .reflect()
      .then(inspectPromise())
      .then((response) => {
        assert.equal(response, 'banana');
        return null;
      });
  });
});
```

## Cli

```bash
Commands:
  docker          manages docker lifecycle
  test <command>  performs tests in docker

Options:
  --node, -n     node version to use when building            [default: "7.8.0"]
  --env, -E      node environment to build for           [default: "production"]
  --project, -p  project name where this is used  [default: "makeomatic-deploy"]
  --version, -v  version of the project to build              [default: "1.5.0"]
  --pkg          package json path
              [default: "/Users/vitaly/projects/makeomatic-deploy/package.json"]
  --help         Show help                                             [boolean]
```

## Docker

```bash
bin/cli.js docker

Commands:
  build    builds docker image for a project
  push     pushes previously build docker images
  release  performs build, tagging and push in one operation
  tag      tags built docker image

Options:
  --node, -n            node version to use when building     [default: "7.8.0"]
  --env, -E             node environment to build for    [default: "production"]
  --project, -p         project name where this is used
                                                  [default: "makeomatic-deploy"]
  --version, -v         version of the project to build       [default: "1.5.0"]
  --pkg                 package json path
              [default: "/Users/vitaly/projects/makeomatic-deploy/package.json"]
  --help                Show help                                      [boolean]
  --repository, --repo  docker repository to use         [default: "makeomatic"]
  --include_node, --in  includes node version in the tag
                                                       [boolean] [default: true]
  --docker_file, -f     path to docker file   [string] [default: "./Dockerfile"]
```

## Test

```bash
bin/cli.js test <command>

Commands:
  compose  installs compose on the system
  init     adds basic files for testing
  run      performs testing

Options:
  --node, -n                       node version to use when building
                                                              [default: "7.8.0"]
  --env, -E                        node environment to build for
                                                         [default: "production"]
  --project, -p                    project name where this is used
                                                  [default: "makeomatic-deploy"]
  --version, -v                    version of the project to build
                                                              [default: "1.5.0"]
  --pkg                            package json path
              [default: "/Users/vitaly/projects/makeomatic-deploy/package.json"]
  --help                           Show help                           [boolean]
  --docker_compose                 docker-compose file for testing
                                 [string] [default: "./test/docker-compose.yml"]
  --docker_compose_version, --dcv  docker-compose version to use
                                                             [default: "1.11.2"]
  --docker_compose_force, --dcf    forces to install local copy of
                                   docker-compose in case of version mismatch
                                                      [boolean] [default: false]
  --tests, -t                      glob for test files
                                     [string] [default: "./test/suites/**/*.js"]
  --no_cleanup, -C                 cleanup automatically
                                                      [boolean] [default: false]
  --wait_before_tests, --sleep     how much time to wait after docker-compose up
                                                           [number] [default: 0]
  --report_dir                     report dir for coverage
                                                         [default: "./coverage"]
  --test_framework                 test framework to use      [default: "mocha"]
  --coverage                       whether to upload coverage or not
                                                      [boolean] [default: false]
  --root                           binary root path on the tester
                                             [default: "/src/node_modules/.bin"]
  --rebuild, -r                    list modules to rebuild during testing
                                                           [array] [default: []]
  --on_fail, --fail                arbitrary code to execute on test failure
  --custom_run                     custom run command for the tests
  --gyp                            run nody-gyp-rebuild before tests
                                                      [boolean] [default: false]
  --arbitrary_exec                 arbitrary commands to exec in docker tester
                                                           [array] [default: []]
```
