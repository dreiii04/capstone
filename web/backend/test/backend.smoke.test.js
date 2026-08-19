const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-hs256';
delete process.env.MONGODB_URI;

const app = require('../server');
let server;
let baseUrl;

before(async () => {
  await app.databaseReady;
  await new Promise((resolve) => {
    server = app.listen(0, '127.0.0.1', () => {
      baseUrl = `http://127.0.0.1:${server.address().port}`;
      resolve();
    });
  });
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
});

test('health fails fast when MongoDB is unavailable', async () => {
  const response = await fetch(`${baseUrl}/api/health`);
  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: 'unavailable',
    database: 'disconnected',
  });
});

test('database-backed routes return 503 instead of hanging', async () => {
  const response = await fetch(`${baseUrl}/api/auth/profile`);
  assert.equal(response.status, 503);
  assert.equal((await response.json()).success, false);
});

test('CORS does not reflect an unapproved browser origin', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    headers: { Origin: 'https://attacker.example' },
  });
  assert.equal(response.headers.get('access-control-allow-origin'), null);
});
