# Test Run additional ARGS and Parallel execution

## Overview and Motivation
`@makeomatic/deploy` `test run` command does not provide an option to pass additional parameters to test runners.
In some cases, when running tests, you may need to filter tests or provide some args, ENV vars cannot cover all possible conditions.

Also when running tests without `--parallel` ARG, tests executed in random order.

## Tests `parallel` execution
A bit changed test exectuion logic. If `mdep` executed without `parallel` parameter, tests will run in sorted order and without any concurrency using `Bluebird.mapSeries`.
If `parallel` parameter, tests will run unsorted using `Bluebird.map`.


## Test Arguments
#### `--test_args` param
New `--test_args` argument for `mdep test run` command, used to pass additional arguments to the test framework.

```console
~@: mdep test run --test_args='-v -g foo'
```

#### Arguments forwarding
You also able to pass arguments in `-- -v foo` style to the test framework, but don't try to use the command
in format:
```console
~@: yarn mdep test run -- -g foo
```

Use `--test_args` argument instead.

### Example:
Sometimes you need to run one test from all suites, now it's possible to use 'hack' and pass additional parameters with `--test_framework` argument:
```console
~@: mdep test run --test_framework 'mocha -v --myparam'
```

But this seems a bit dirty.
With `--args` argument:
###### Run all test matching `test_name`
Yarn:
```console
~@: yarn mdep test run --test_args='-g test_name'
```

Command with argument:
```console
~@: mdep test run --test_args='-g test_name'
```

Command with forwarded arguments:
```console
~@: mdep test run -- -g test_name
```

###### Check memory leaks or bail
```console
~@: yarn mdep test run --test_args='--bail --check-leaks'
```





