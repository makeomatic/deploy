const Promise = require('bluebird');

describe('chrome helpers', () => {
  const Chrome = require('../bin/chrome');

  it('launches chrome', async () => {
    const connection = await Chrome();
    expect(connection.launcher).toBeDefined();
    expect(connection.protocol).toBeDefined();
    expect(connection.close).toBeDefined();
    this.chrome = connection;
  });

  it('renders facebook', async () => {
    const context = this.chrome;
    const { Page } = context.protocol;

    Page.navigate({ url: 'https://facebook.com' });
    await Page.loadEventFired();
    await Promise.bind(context).then(Chrome.captureScreenshot);
  });

  afterAll(async () => (
    this.chrome ? this.chrome.close() : null
  ));
});
