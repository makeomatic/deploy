describe('chrome helpers', () => {
  const Chrome = require('../bin/chrome');

  it('launches chrome', async () => {
    const connection = await Chrome();
    expect(connection.launcher).toBeDefined();
    expect(connection.protocol).toBeDefined();
    expect(connection.close).toBeDefined();
    this.chrome = connection;
  });

  afterAll(async () => (
    this.chrome ? this.chrome.close() : null
  ));
});
