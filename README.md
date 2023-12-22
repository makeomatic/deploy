# Makeomatic deploy tools

Provides convenient deploy tools, which automate publishing of docker images, documentation & testing
ESM-only now

## Install

`npm i @makeomatic/deploy -D`

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

manages docker lifecycle

Commands:
  cli.mjs docker build    builds docker image for a project
  cli.mjs docker push     pushes previously build docker images
  cli.mjs docker release  performs build, tagging and push in one operation
  cli.mjs docker tag      tags built docker image

Options:
  -n, --node                      node version to use when building
                                                        [string] [default: "20"]
  -E, --env                       node environment to build for
                                                         [default: "production"]
  -p, --project                   project name where this is used
                                                             [default: "deploy"]
      --docker_build_args, --dba  docker build args
      --docker_flags, --df        docker build flags                     [array]
      --repository, --repo        docker repository to use
                                                         [default: "makeomatic"]
  -v, --version                   version of the project to build
                                                  [default: "0.0.0-development"]
      --pkg                       package json path
             [default: "/Users/vitaly/projects/@makeomatic/deploy/package.json"]
      --include_node, --in        includes node version in the tag
                                                       [boolean] [default: true]
      --tag_latest, --tl          adds :latest tag to the image
                                                      [boolean] [default: false]
  -f, --docker_file               path to docker file
                                              [string] [default: "./Dockerfile"]
  -T, --extra_tags                list of additional tags for the image
                                                           [array] [default: []]
  -c, --docker_context            docker build context path       [default: "."]
      --help                      Show help                            [boolean]
```

## Test

```bash
cli.js test <command>

performs tests in docker

Commands:
  cli.mjs test compose  prepares docker-compose file based on config
  cli.mjs test compose  installs compose on the system
  cli.mjs test run      performs testing

Options:
  -n, --node                           node version to use when building
                                                        [string] [default: "20"]
  -E, --env                            node environment to build for
                                                         [default: "production"]
  -p, --project                        project name where this is used
                                                             [default: "deploy"]
      --docker_build_args, --dba       docker build args
      --docker_flags, --df             docker build flags                [array]
      --repository, --repo             docker repository to use
                                                         [default: "makeomatic"]
  -v, --version                        version of the project to build
                                                  [default: "0.0.0-development"]
      --pkg                            package json path
             [default: "/Users/vitaly/projects/@makeomatic/deploy/package.json"]
      --docker_compose                 docker-compose file for testing
                                 [string] [default: "./test/docker-compose.yml"]
      --docker_compose_multi, --dcm    docker-compose files that will be started
                                        in provided order  [array] [default: []]
      --parallel                       run test suites in parallel
                                                           [number] [default: 1]
  -s, --sort                           sort tests in alphabetical order and run
                                       sequentially. disables `parallel` mode
                                                      [boolean] [default: false]
      --auto_compose                                  [boolean] [default: false]
      --auto_compose_version, --acv                      [string] [default: "3"]
      --with_local_compose             also include services defined in the dock
                                       er_compose file. Senseless w/o auto_compo
                                       se=true        [boolean] [default: false]
      --tester_flavour                              [string] [default: "tester"]
      --extras                         any extras for tester docker container, w
                                       ill be merged      [string] [default: {}]
      --services                       enable listed services
  [array] [choices: "redis", "redisCluster", "redisSentinel", "postgres", "rabbi
                                  tmq", "elasticsearch", "cassandra", "couchdb"]
      --docker_compose_version, --dcv  docker-compose version to use
                                                             [default: "1.11.2"]
      --docker_compose_force, --dcf    forces to install local copy of docker-co
                                       mpose in case of version mismatch
                                                      [boolean] [default: false]
  -t, --tests                          glob for test files
                                     [string] [default: "./test/suites/**/*.js"]
  -C, --no_cleanup                     cleanup automatically
                                                      [boolean] [default: false]
      --wait_before_tests, --sleep     how much time to wait after docker-compos
                                       e up                [number] [default: 0]
      --report_dir                     report dir for coverage
                                                         [default: "./coverage"]
      --test_framework                 test framework to use  [default: "mocha"]
      --mirror-npm, --mirror           enables local npm mirror to speed up inst
                                       alling packages                 [boolean]
      --root                           binary root path on the tester
                                             [default: "/src/node_modules/.bin"]
  -r, --rebuild                        list modules to rebuild during testing
                                                           [array] [default: []]
      --on_fail, --fail                arbitrary code to execute on test failure
      --custom_run                     custom run command for the tests
      --gyp                            run nody-gyp-rebuild before tests
                                                      [boolean] [default: false]
      --arbitrary_exec                 arbitrary commands to exec in docker test
                                       er                  [array] [default: []]
      --pre                            pre commands to run [array] [default: []]
      --test_args                      extra arguments for test framework
                                                          [string] [default: ""]
      --pull                           force pull docker containers
                                                      [boolean] [default: false]
      --post_exec                      commands to exec in docker tester after a
                                       ll tests finished   [array] [default: []]
      --http                           uses http exec instead of docker exec to
                                       run tests      [boolean] [default: false]
      --mutagen-dir                    custom mutagen dir
                          [default: "/Users/vitaly/projects/@makeomatic/deploy"]
      --mutagen-working-dir            custom mutagen working dir
      --mutagen-volume-name            shared mutagen volume name
                                    [string] [default: "makeomatic-deploy-code"]
      --mutagen-volume-external        set as external to avoid recreating each
                                       time           [boolean] [default: false]
      --exec-user, --euser             user to run setup commands with  [string]
      --test-user, --tuser             user to run test commands with   [string]
      --in-one, --in_one               runs all tests in 1 test runner
                                                      [boolean] [default: false]
      --env-file, --env_file           .env file for docker-compose     [string]
      --only-prepare                   creates containers but doesn't run the te
                                       sts            [boolean] [default: false]
      --help                           Show help                       [boolean]
```
