# Makeomatic deploy tools

Provides convenient deploy tools, which automate publishing of docker images, documentation & testing

```bash
Commands:
  docker <command>  manages docker lifecycle
  test <command>    performs tests in docker

Options:
  --node, -n     node version to use when building            [default: "7.8.0"]
  --env, -E      node environment to build for           [default: "production"]
  --project, -p  project name where this is used           [default: "ms-files"]
  --version, -v  version of the project to build              [default: "6.2.0"]
  --help         Show help                                             [boolean]
```

## Docker

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
                                                           [default: "ms-files"]
  --version, -v                    version of the project to build
                                                              [default: "6.2.0"]
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
  --coverage                       whether to upload coverage or not
                                                      [boolean] [default: false]
  --root                           binary root path on the tester
                                             [default: "/src/node_modules/.bin"]
```
