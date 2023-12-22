import test, { describe, after } from 'node:test';
import assert from 'node:assert/strict';
import Chrome, { captureScreenshot } from '../bin/chrome.js';

describe('chrome helpers', () => {
  let chrome;

  test('launches chrome', async () => {
    const connection = await Chrome();
    assert(connection.launcher);
    assert(connection.protocol);
    assert(connection.close);
    chrome = connection;
  });

  test('renders facebook', async () => {
    const context = chrome;
    const { Page } = context.protocol;

    Page.navigate({ url: 'https://facebook.com' });
    await Page.loadEventFired();
    await captureScreenshot.call(context);
  }, 10000);

  after(async () => (
    chrome ? chrome.close() : null
  ));
});
