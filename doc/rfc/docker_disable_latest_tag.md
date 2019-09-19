# Disable push using `:latest` tag

## Overview and Motivation
`docker deploy/release/` command pushes images with `baseTag:latest` tag into Docker Hub.
This happens even if we built a beta or alpha version of the image. If the project has docker image dependency without version tag,
this beta image will be used.

## `--tag_latest [false]` param
New `--tag_latest` param(defaults to false) instruct `deploy` command to add `${baseTag}:latest` tag to the image.
Otherwise `:latest` tag not assigned to the image.
