# Test Run additional ARGS

## Overview and Motivation
`@makeomatic/deploy` `test run` command does not provide an option to pass additional parameters to test runners.
In some cases, when running tests, you may need to filter tests or provide some args, ENV vars cannot cover all possible conditions.

## `--args` param
New '--args' argument for `mdep test run` command, used to pass additional arguments to the test framework.

```console
~@: mdep test run --args='-v -g foo'
```

##### For example:
Sometimes you need to run one test from all suites, now it's possible to use 'hack' and pass additional parameters with `--test_framework` argument:
```console
~@: mdep test run --test_framework 'mocha -v --myparam'
```

But this seems a bit dirty.
With `--args` argument:
###### Run all test matching `test_name`
```console
~@: yarn mdep test run --args='-g test_name'
~@: yarn mdep test run --args '-g \'#mytag\'' -t test/suite/super_test.js
```

###### Check memory leaks or bail
```console
~@: yarn mdep test run --args='--bail --check-leaks'
```





