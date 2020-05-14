# Additional tags for built images

## Overview

Current set of tags and options to modify it is limited by the following cases:
- `<node>-<version>`
- `<version>`
- `<node>`
- `<custom_version>`
- `:latest`

We need an option that allows extension of the list without complete override to stay
backward compatible.

## Solution
Add the `--extra_tags` option with the alias `-T`

## Why not `--tags` / `-t`?

This could confuse Docker users since that option implies the complete redefinition of the list.

## Usage

```
##
$ mdep docker release --extra_tags a b c

## Result:
image:<node>-<version>
image:<node>
image:a
image:b
image:c

##
$ mdep docker release -T a -T b

## Result:
image:<node>-<version>
image:<node>
image:a
image:b
```


