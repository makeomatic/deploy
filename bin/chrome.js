import chrome from 'chrome-remote-interface';
import fs from 'node:fs/promises';
import is from 'is';
import assert from 'node:assert/strict';
import { Launcher } from 'chrome-launcher';
import EventEmitter from 'events';
import { rimraf } from 'rimraf';
import Pino from 'pino';
import { once } from 'node:events';
import { setTimeout } from 'node:timers/promises';

const pino = Pino();
const _SIGINT = 'SIGINT';
const _SIGINT_EXIT_CODE = 130;

/**
 * Launches a debugging instance of Chrome on port 9222.
 * @return {Promise<{ chrome: ChromeLauncher, protocol: ChromeDebugProtocol, close: Function }>}
 */
async function launchChrome(opts = {}, moduleOverrides = { rimraf }) {
  const settings = {
    rimraf,
    logLevel: 'silent',
    chromeFlags: [
      '--window-size=1024,768',
      '--disable-gpu',
      '--no-sandbox',
      '--headless',
    ],
    handleSIGINT: true,
    ...opts,
  };

  // use actual log level
  pino.level = settings.logLevel;

  /* rewrite for lighthouse logger */
  settings.logLevel = 'error';

  const initChrome = async () => {
    const instance = new Launcher(settings, moduleOverrides);

    // Kill spawned Chrome process in case of ctrl-C.
    if (settings.handleSIGINT) {
      process.on(_SIGINT, async () => {
        instance.kill();
        process.exit(_SIGINT_EXIT_CODE);
      });
    }

    await instance.launch(settings);

    return {
      pid: instance.pid,
      port: instance.port,
      kill: async () => instance.kill(),
    };
  };

  const launcher = await initChrome();
  const protocol = await chrome({ port: launcher.port });
  const { Page, Network, Runtime, DOM, Console } = protocol;

  protocol.idleDelay = 500;
  protocol.evictionDelay = 5000;
  protocol.ee = new EventEmitter();
  protocol.pending = new Map();
  protocol.timeouts = new Map();

  let isIdleTimer;
  const verifyIsIdle = () => {
    if (protocol.pending.size === 0) {
      pino.debug('idle', 'completed');
      protocol.ee.emit('idle');
    } else {
      const requests = [];
      // eslint-disable-next-line no-restricted-syntax
      for (const v of protocol.pending.values()) {
        requests.push(v.request.url);
      }

      pino.debug('pendingRequest', `[${requests.length}]`, requests.join(', '));
    }
  };

  const onLoad = (params, evicted) => {
    const originalRequest = protocol.pending.get(params.requestId);

    // might fire twice with failed/finished handlers
    pino.debug(
      evicted ? 'evicted' : 'responseReceived',
      `[pending=${protocol.pending.size}]`,
      originalRequest && originalRequest.request.url
    );

    // remove request from pending
    protocol.pending.delete(params.requestId);

    // clear timeouts
    if (protocol.timeouts.has(params.requestId)) {
      clearTimeout(protocol.timeouts.get(params.requestId));
      protocol.timeouts.delete(params.requestId);
    }

    clearTimeout(isIdleTimer);
    isIdleTimer = setTimeout(verifyIsIdle, protocol.idleDelay);
  };

  Network.requestWillBeSent((params) => {
    pino.debug('requestWillBeSent', `[pending=${protocol.pending.size}]`, params.request.url);

    protocol.pending.set(params.requestId, params);
    protocol.timeouts.set(params.requestId, setTimeout(onLoad, protocol.evictionDelay, params, true));

    clearTimeout(isIdleTimer);
    isIdleTimer = setTimeout(verifyIsIdle, protocol.idleDelay);
  });

  Network.loadingFailed(onLoad);
  Network.loadingFinished(onLoad);

  Console.messageAdded((params) => {
    pino.debug('console', params.message.text);
  });

  await Promise.all([
    Page.enable(),
    Network.enable(),
    Runtime.enable(),
    DOM.enable(),
    Console.enable(),
  ]);

  return {
    launcher,
    protocol,
    close() {
      for (const t of protocol.timeouts.values()) {
        clearTimeout(t);
      }

      clearTimeout(isIdleTimer);
      isIdleTimer = null;

      return Promise.all([protocol.close(), launcher.kill()]);
    },
  };
}

export default launchChrome;

export { launchChrome };

/**
 * Inits Chrome for tests
 * @return {Promise<Void>}
 */
export async function init() {
  const params = await launchChrome();
  Object.assign(this, params);
}

/**
 * Cleans up chrome & launcher connection
 * @return {Promise<Void>}
 */
export function clean() {
  const close = this.close();
  this.launcher = null;
  this.protocol = null;
  this.close = null;
  return close;
}

/**
 * Captures screenshot
 */
export async function captureScreenshot(err) {
  const { Page } = this.protocol;
  const screenshot = await Page.captureScreenshot({ format: 'jpeg', quality: 70 });

  const filepath = `/src/ss/${Date.now()}.jpeg`;
  await fs.writeFile(filepath, Buffer.from(screenshot.data, 'base64'));

  if (err instanceof Error) {
    throw err;
  }
}

/**
 * Retries fn during timeout
 * @param  {Function} fn
 * @param  {String}   name
 * @param  {Number}   [timeout=30000]
 * @return {Promise}
 */
export async function retry(timeout, name, fn) {
  const start = Date.now();

  while (start + timeout > Date.now()) {
    try {
      // eslint-disable-next-line no-await-in-loop
      return await fn();
    } catch (err) {
      pino.debug({ name, err: err.message }, 'failed to find node');
      // eslint-disable-next-line no-await-in-loop
      await setTimeout(500);
    }
  }

  throw new Error(`${name} - retry faileda after ${timeout}ms`);
}

/**
 * Resolves promise whenever current window is idle of any requests
 * @param  {Number}  [timeout=30000]
 * @return {Boolean}
 */
export async function isIdle(timeout = 30000) {
  if (this.protocol.pending.size === 0) {
    return;
  }

  await Promise.race([
    once(this.protocol.ee, 'idle'),
    setTimeout(timeout, null, { ref: false }).then(() => {
      throw new Error(`idle event not fired in ${timeout}`);
    }),
  ]);
}

/**
 * Waits for selector to become available
 * @param  {String} selector
 * @param  {Number} [timeout=30000]
 * @return {Promise}
 */
export function wait(_selector, timeout = 30000) {
  const { Runtime } = this.protocol;

  const selector = is.string(_selector)
    ? `document.querySelector("${_selector}")`
    : `document.querySelector("${_selector.iframe}").contentWindow.document.querySelector("${_selector.el}")`;

  return retry(timeout, `Find Node: ${_selector.el || _selector}`, async () => {
    const { result, exceptionDetails } = await Runtime.evaluate({
      includeCommandLineAPI: true,
      expression: selector,
    });

    if (exceptionDetails) throw new Error(exceptionDetails.exception.description);
    if (!result.objectId) throw new Error('couldnt find node');

    await isIdle.call(this);
    pino.debug('wait completed');

    return selector;
  });
}

/**
 * Types text into input
 * @param  {Object|String} selector
 * @param  {String} text
 * @param  {Number} [timeout=30000]
 * @return {Promise}
 */
export async function type(selector, text, timeout = 30000) {
  const { Runtime, Input } = this.protocol;
  const chars = String(text).split('');

  async function simulateTyping() {
    const ch = chars.shift();
    if (ch === undefined) {
      return;
    }

    pino.debug('typing, Sending %s of %s', ch, text);

    for (const op of ['rawKeyDown', 'char', 'keyUp']) {
      // eslint-disable-next-line no-await-in-loop
      await Input.dispatchKeyEvent({
        type: op,
        text: ch,
        key: ch,
      });
    }
    await setTimeout(100);
    await simulateTyping();
  }

  const nodeSelector = await wait.call(this, selector, timeout);
  await retry(timeout, 'setNodeValue', async () => {
    try {
      const { result, exceptionDetails } = await Runtime.evaluate({
        includeCommandLineAPI: true,
        expression: `${nodeSelector}.value = ''; ${nodeSelector}.focus();`,
      });

      pino.debug('Completed evaluate', result.description);
      if (exceptionDetails) throw new Error(exceptionDetails.exception.description);

      await simulateTyping();
    } catch (err) {
      await captureScreenshot(err);
    }
  });
}

/**
 * Submits form by clicking on the submit button
 * @param  {Object|String} selector
 * @param  {Number} [timeout=30000]
 * @return {Promise}
 */
export async function submit(selector, timeout = 30000) {
  const { Input, Runtime } = this.protocol;

  const nodeSelector = await wait.call(this, selector, timeout);
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

  return retry(timeout, 'setNodeValue', async () => {
    const { result, exceptionDetails } = await Runtime.evaluate({
      includeCommandLineAPI: true,
      expression,
      returnByValue: true,
    });

    if (exceptionDetails) throw new Error(exceptionDetails.exception.description);
    pino.debug('Completed evaluate', result.value);
    const coordinates = result.value;

    await Input.dispatchMouseEvent({ type: 'mouseMoved', ...coordinates });
    await Input.dispatchMouseEvent({
      type: 'mousePressed', button: 'left', clickCount: 1, ...coordinates,
    });
    await Input.dispatchMouseEvent({
      type: 'mouseReleased', button: 'left', clickCount: 1, ...coordinates,
    });

    return coordinates;
  });
}

/**
 * Captures redirect to URL
 * @param  {Regexp} url
 * @param  {Number} [timeout=30000]
 * @return {Promise<String>}
 */
export function captureRedirect(url, timeout = 30000) {
  const { Network } = this.protocol;

  return new Promise((resolve, reject) => {
    Network.requestWillBeSent((params) => {
      if (url.test(params.request.url)) resolve(params.request.url);
    });

    global.setTimeout(reject, timeout, new Error(`failed to redirect to ${url}`));
  });
}

/**
 * Captures response
 * @param {RegExp} url - Response URL regexp to capture.
 * @param {number} [timeout=30000]
 * @return {Promise<Object>}
 */
export function captureResponse(url, timeout = 30000) {
  const { Network } = this.protocol;
  return new Promise((resolve, reject) => {
    Network.responseReceived((params) => {
      pino.debug('response:', params);
      if (url.test(params.response.url)) {
        const { response, requestId } = params;
        resolve({ ...response, requestId });
      }
    });

    setTimeout(reject, timeout, new Error(`failed to get response: ${url.toString()}`));
  });
}

/**
 * Captures response and returns body
 * @param {string} url - URL of response to capture
 * @param {number} [timeout=30000]
 * @param {number}
 * @return {Promise<string>}
 */
export async function captureResponseBody(url, code = 200, timeout = 30000) {
  const { Network } = this.protocol;

  const { status, requestId } = await captureResponse.call(this, url, timeout);
  const body = await Network.getResponseBody({ requestId }).get('body').catch((err) => err.message);

  assert.equal(status, code, `Response code is ${status}. Body: ${body}`);
  return body;
}

/**
 * Scrolls Browser window to top
 * @return {Promise}
 */
export function scrollTo(x = 0, y = 0) {
  const { Runtime } = this.protocol;
  return Runtime.evaluate({
    expression: `window.scrollTo(${x}, ${y})`,
  });
}

/**
 * Executes expression in current context and returns data by value, unless overwritten by opts.
 * @param  {string} expression - Expression to execute.
 * @param  {Object} [opts={}] - Runtime.evaluate opts.
 * @returns {Promise<mixed>}
 */
export async function exec(expression, opts = {}) {
  const { Runtime } = this.protocol;

  const { result, exceptionDetails } = await Runtime.evaluate({
    returnByValue: true,
    includeCommandLineAPI: true,
    ...opts,
    expression,
  });

  if (exceptionDetails) {
    throw new Error(exceptionDetails.exception.description);
  }

  return result.value;
}
