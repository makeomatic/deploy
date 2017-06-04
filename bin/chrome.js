const Promise = require('bluebird');
const chrome = require('chrome-remote-interface');
const fs = require('fs');
const is = require('is');
const { ChromeLauncher } = require('lighthouse/lighthouse-cli/chrome-launcher');
const Log = require('lighthouse/lighthouse-core/lib/log');
const EventEmitter = require('events');

/**
 * Launches a debugging instance of Chrome on port 9222.
 * @param {boolean} [headless] True (default) to launch Chrome in headless mode.
 *     Set to false to launch Chrome normally.
 * @return {Promise<{ chrome: ChromeLauncher, protocol: ChromeDebugProtocol, close: Function }>}
 */
function launchChrome(headless = true) {
  Log.setLevel('verbose');

  const launcher = new ChromeLauncher({
    port: 9222,
    autoSelectChrome: true, // False to manually select which Chrome install.
    additionalFlags: [
      '--window-size=1024,768',
      '--disable-gpu',
      '--no-sandbox',
      headless ? '--headless' : '',
    ],
  });

  return launcher.run()
    // Kill Chrome if there's an error.
    .catch(err => Promise
      .resolve(launcher.kill())
      .timeout(60000)
      .catch(() => { throw err; })
      .then(() => { throw err; })
    )
    .then(() => chrome())
    .then((_protocol) => {
      // NOTE: https://chromedevtools.github.io/devtools-protocol/tot/Page/
      let protocol = _protocol;

      const { Page, Network, Runtime, DOM, Console } = protocol;

      protocol.pendingRequests = 0;
      protocol.isIdle = true;
      protocol.idleDelay = 500;
      protocol.ee = new EventEmitter();
      protocol.pending = new Map();

      let isIdle;
      const verifyIsIdle = () => {
        protocol.isIdle = protocol.pendingRequests === 0;
        if (protocol.isIdle) {
          protocol.ee.emit('idle');
        } else {
          protocol.pending.forEach((params) => {
            Log.verbose('pendingRequest', params.request.url);
          });
        }
      };

      Network.requestWillBeSent((params) => {
        Log.verbose('requestWillBeSent', `[pending=${protocol.pendingRequests}]`, params.request.url);

        protocol.pendingRequests += 1;
        protocol.isIdle = false;
        protocol.pending.set(params.requestId, params);

        clearTimeout(isIdle);
        isIdle = setTimeout(verifyIsIdle, protocol.idleDelay);
      });

      const onLoad = (params) => {
        Log.verbose('responseReceived', `[pending=${protocol.pendingRequests}]`, protocol.pending.get(params.requestId).request.url);

        protocol.pendingRequests -= 1;
        protocol.pending.delete(params.requestId);

        clearTimeout(isIdle);
        isIdle = setTimeout(verifyIsIdle, protocol.idleDelay);
      };

      Network.loadingFailed(onLoad);
      Network.loadingFinished(onLoad);

      Console.messageAdded((params) => {
        Log.verbose('console', params.message.text);
      });

      return Promise
        .join(Page.enable(), Network.enable(), Runtime.enable(), DOM.enable(), Console.enable())
        .return({
          launcher,
          protocol,
          close() {
            return Promise.join(launcher.kill(), protocol.close(), () => {
              protocol = null;
            });
          },
        });
    });
}

module.exports = launchChrome;

/**
 * Inits Chrome for tests
 * @return {Promise<Void>}
 */
module.exports.init = function initForTests() {
  return launchChrome().then((params) => {
    Object.assign(this, params);
    return null;
  });
};

/**
 * Cleans up chrome & launcher connection
 * @return {Promise<Void>}
 */
module.exports.clean = function cleanupAfterTests() {
  const close = this.close();
  this.launcher = null;
  this.protocol = null;
  this.close = null;
  return close;
};

/**
 * Captures screenshot
 */
module.exports.captureScreenshot = function captureScreenshot(any) {
  const { Page } = this.protocol;
  return Promise
    .resolve()
    .then(() => Page.captureScreenshot({ format: 'jpeg', quality: 70 }))
    .then((screenshot) => {
      const filepath = `/src/ss/${Date.now()}.jpeg`;
      return Promise.fromCallback(next => fs.writeFile(filepath, Buffer.from(screenshot.data, 'base64'), next));
    })
    .tap(() => {
      if (any instanceof Error) throw any;
    });
};

/**
 * Retries fn during timeout
 * @param  {Function} fn
 * @param  {String}   name
 * @param  {Number}   [timeout=20000]
 * @return {Promise}
 */
module.exports.retry = function retry(timeout, name, fn) {
  const repeat = () => (
    fn().catch((err) => {
      Log.verbose(name, 'failed to find node', err.message);
      return Promise.delay(500).then(repeat);
    })
  );

  return repeat().timeout(timeout);
};

/**
 * Resolves promise whenever current window is idle of any requests
 * @param  {Number}  [timeout=20000]
 * @return {Boolean}
 */
module.exports.isIdle = function isIdle(timeout = 20000) {
  if (this.protocol.isIdle === true) return Promise.resolve();

  return Promise.fromCallback((next) => {
    this.protocol.ee.once('idle', next);
    setTimeout(next, timeout, new Error(`idle event not fired in ${timeout}`));
  });
};

/**
 * Waits for selector to become available
 * @param  {String} selector
 * @param  {Number} [timeout=20000]
 * @return {Promise}
 */
module.exports.wait = function wait(_selector, timeout = 20000) {
  const { Runtime } = this.protocol;

  const selector = is.string(_selector)
    ? `document.querySelector("${_selector}")`
    : `document.querySelector("${_selector.iframe}").contentWindow.document.querySelector("${_selector.el}")`;

  return module.exports
    .retry(timeout, `Find Node: ${_selector.el || _selector}`, () => (
      Promise
        .bind(this)
        .then(() => Runtime.evaluate({
          includeCommandLineAPI: true,
          expression: selector,
        }))
        .tap(({ result, exceptionDetails }) => {
          if (exceptionDetails) throw new Error(exceptionDetails.exception.description);
          if (!result.objectId) throw new Error('couldnt find node');
        })
        .tap(() => module.exports.isIdle.call(this))
    ))
    .return(selector);
};

/**
 * Types text into input
 * @param  {Object|String} selector
 * @param  {String} text
 * @param  {Number} [timeout=20000]
 * @return {Promise}
 */
module.exports.type = function type(selector, text, timeout = 20000) {
  const { Runtime, Input } = this.protocol;
  const chars = String(text).split('');

  function simulateTyping() {
    const ch = chars.shift();
    if (ch === undefined) {
      return Promise.resolve();
    }

    Log.verbose('typing', 'Sending %s of %s', ch, text);

    return Promise
      .bind(Input)
      .return({
        type: 'rawKeyDown',
        text: ch,
        key: ch,
      })
      .then(Input.dispatchKeyEvent)
      .return({
        type: 'char',
        text: ch,
        key: ch,
      })
      .then(Input.dispatchKeyEvent)
      .return({
        type: 'keyUp',
        text: ch,
        key: ch,
      })
      .then(Input.dispatchKeyEvent)
      .delay(100)
      .then(simulateTyping);
  }

  return Promise
    .bind(this, [selector, timeout])
    .spread(module.exports.wait)
    .tap(nodeSelector => module.exports.retry(timeout, 'setNodeValue', () => (
        Promise
          .bind(this)
          .then(() => Runtime.evaluate({
            includeCommandLineAPI: true,
            expression: `${nodeSelector}.focus()`,
          }))
          .tap(({ result, exceptionDetails }) => {
            Log.verbose('Completed evaluate', result.description);
            if (exceptionDetails) throw new Error(exceptionDetails.exception.description);
          })
          .then(simulateTyping)
          .catch(module.exports.captureScreenshot)
      )
    ));
};

/**
 * Submits form by clicking on the submit button
 * @param  {Object|String} selector
 * @param  {Number} [timeout=20000]
 * @return {Promise}
 */
module.exports.submit = function submit(selector, timeout = 20000) {
  const { Input, Runtime } = this.protocol;

  return Promise
    .bind(this, [selector, timeout])
    .spread(module.exports.wait)
    .then((nodeSelector) => {
      const expression = `
        function getOffset(el) {
          var parentOffset = { x: 0, y: 0 };
          if (${selector.iframe} !== undefined) {
            const offset = document.querySelector("${selector.iframe}").getBoundingClientRect();
            parentOffset.x = offset.left;
            parentOffset.y = offset.top;
          }

          el = el.getBoundingClientRect();
          return {
            x: Math.ceil(el.left + parentOffset.x + el.width / 2 + window.scrollX),
            y: Math.ceil(el.top + parentOffset.y + el.height / 2 + window.scrollY),
          };
        }

        getOffset(${nodeSelector})
      `;

      return module.exports.retry(timeout, 'setNodeValue', () => (
        Promise
          .bind(this)
          .then(() => Runtime.evaluate({
            includeCommandLineAPI: true,
            expression,
            returnByValue: true,
          }))
          .then(({ result, exceptionDetails }) => {
            if (exceptionDetails) throw new Error(exceptionDetails.exception.description);
            Log.verbose('Completed evaluate', result.value);
            return result.value;
          })
          .tap(coordinates => Input.dispatchMouseEvent(Object.assign(
            { type: 'mouseMoved' }, coordinates
          )))
          .tap(coordinates => Input.dispatchMouseEvent(Object.assign(
            { type: 'mousePressed', button: 'left', clickCount: 1 }, coordinates
          )))
          .tap(coordinates => Input.dispatchMouseEvent(Object.assign(
            { type: 'mouseReleased', button: 'left', clickCount: 1 }, coordinates
          )))
      ));
    });
};

/**
 * Captures redirect to URL
 * @param  {Regexp} url
 * @param  {Number} [timeout=20000]
 * @return {Promise<String>}
 */
module.exports.captureRedirect = function captureRedirect(url, timeout = 20000) {
  const { Network } = this.protocol;

  return Promise.fromCallback((next) => {
    Network.requestWillBeSent((params) => {
      if (url.test(params.request.url)) next(null, params.request.url);
    });

    setTimeout(next, timeout, new Error(`failed to redirect to ${url}`));
  });
};

/**
 * Captures response
 * @param {Number} [timeout=20000]
 * @return {Promise<Object>}
 */
module.exports.captureResponse = function captureResponse(url, timeout = 20000) {
  const { Network } = this.protocol;
  return Promise.fromCallback((next) => {
    Network.responseReceived((params) => {
      Log.verbose('response:', params);
      if (url.test(params.response.url)) {
        const { response, requestId } = params;
        next(null, Object.assign({}, response, { requestId }));
      }
    });

    setTimeout(next, timeout, new Error('failed to get response'));
  });
};

/**
 * Scrolls Browser window to top
 * @return {Promise}
 */
module.exports.scrollTo = function scrollTo(x = 0, y = 0) {
  const { Runtime } = this.protocol;
  return Runtime.evaluate({
    expression: `window.scrollTo(${x}, ${y})`,
  });
};
