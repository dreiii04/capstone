const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

process.env.NODE_ENV = 'production';
process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-hs256';
process.env.ALLOWED_ORIGINS = 'https://cp-three-lemon.vercel.app/';
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

test('CORS accepts an approved origin even when configuration has a trailing slash', async () => {
  const response = await fetch(`${baseUrl}/api/health`, {
    method: 'OPTIONS',
    headers: {
      Origin: 'https://cp-three-lemon.vercel.app',
      'Access-Control-Request-Method': 'GET',
      'Access-Control-Request-Headers': 'authorization,content-type',
    },
  });
  assert.equal(response.status, 204);
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'https://cp-three-lemon.vercel.app',
  );
  assert.match(
    response.headers.get('access-control-allow-headers') || '',
    /Authorization/i,
  );
});

test('root endpoint identifies the deployed API', async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    name: 'VeriFitor Web API',
    health: '/api/health',
  });
});
