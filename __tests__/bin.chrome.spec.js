const Promise = require('bluebird');

describe('chrome helpers', () => {
  const Chrome = require('../bin/chrome');
  let chrome;

  it('launches chrome', async () => {
    const connection = await Chrome();
    expect(connection.launcher).toBeDefined();
    expect(connection.protocol).toBeDefined();
    expect(connection.close).toBeDefined();
    chrome = connection;
  });

  it('renders facebook', async () => {
    const context = chrome;
    const { Page } = context.protocol;

    Page.navigate({ url: 'https://facebook.com' });
    await Page.loadEventFired();
    await Promise.bind(context).then(Chrome.captureScreenshot);
  });

  afterAll(async () => (
    this.chrome ? this.chrome.close() : null
  ));
});
