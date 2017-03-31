# Makeomatic deploy tools

Provides convenient deploy tools, which automate publishing of docker images, documentation & testing

```bash
Commands:
  docker <command>  manages docker lifecycle

Options:
  --node, -n     node version to use when building            [default: "7.8.0"]
  --env, -E      node environment to build for           [default: "production"]
  --project, -p  project name where this is used  [default: "makeomatic-deploy"]
  --version, -v  version of the project to build              [default: "1.0.0"]
  --help         Show help                                             [boolean]
```

## Docker

```bash
bin/cli.js docker <command>

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
  --version, -v         version of the project to build       [default: "1.0.0"]
  --help                Show help                                      [boolean]
  --repository, --repo  docker repository to use         [default: "makeomatic"]
  --include_node, --in  includes node version in the tag
                                                       [boolean] [default: true]
  --docker_file, -f     path to docker file   [string] [default: "./Dockerfile"]
```
