const Promise = require('bluebird');
const assert = require('assert');

/**
 * Conventional utility to do .reflect().then(inspectPromise(true/false))
 * Helps to ensure that promise was resolved/rejected in the test runner and extract the params
 *
 * @param  {Boolean} [mustBeFulfilled=true]
 * @return {Promise}
 */
exports.inspectPromise = function inspectPromise(mustBeFulfilled = true) {
  return function inspection(promise) {
    const isFulfilled = promise.isFulfilled();
    const isRejected = promise.isRejected();

    try {
      assert.equal(isFulfilled, mustBeFulfilled);
    } catch (e) {
      if (isFulfilled) {
        return Promise.reject(new Error(JSON.stringify(promise.value())));
      }

      throw promise.reason();
    }

    assert.equal(isRejected, !mustBeFulfilled);
    return mustBeFulfilled ? promise.value() : promise.reason();
  };
};
