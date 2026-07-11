const assert = require('node:assert/strict');
const request = require('supertest');
const { startSandbox } = require('./sandbox');

const extractCsrfToken = (html) => {
  const match = html.match(/name=['"]_csrf['"] value=['"]([^'"]+)['"]/);
  assert.ok(match, 'Expected CSRF token in response body');
  return match[1];
};

(async () => {
  const runtime = await startSandbox({ port: process.env.PORT || '0' });

  try {
    const app = runtime.app;
    const health = await request(app).get('/health').expect(200);
    assert.equal(health.body.status, 'ok');
    assert.equal(health.body.runtime, 'sandbox');
    assert.equal(health.body.database, 'ephemeral');

    const streamer = request.agent(app);
    const streamerLogin = await streamer.get('/login').expect(200);
    const streamerCsrf = extractCsrfToken(streamerLogin.text);
    await streamer
      .post('/login')
      .type('form')
      .send({
        email: runtime.credentials.streamer.email,
        password: runtime.credentials.streamer.password,
        _csrf: streamerCsrf,
      })
      .expect(302);
    await streamer.get('/streamer/browse').expect(200);

    const admin = request.agent(app);
    const adminLogin = await admin.get('/login').expect(200);
    const adminCsrf = extractCsrfToken(adminLogin.text);
    await admin
      .post('/login')
      .type('form')
      .send({
        email: runtime.credentials.admin.email,
        password: runtime.credentials.admin.password,
        _csrf: adminCsrf,
      })
      .expect(302);
    await admin.get('/admin/content').expect(200);

    process.stdout.write('Sandbox smoke passed\n');
  } finally {
    await runtime.shutdown();
  }
})().catch((error) => {
  process.stderr.write(`${error.stack || error}\n`);
  process.exit(1);
});
