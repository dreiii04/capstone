const assert = require('node:assert/strict');
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const test = require('node:test');

const mobileRoot = path.resolve(__dirname, '..', '..');

test('Vercel startup reports missing core variables only in runtime logs', () => {
  const script = String.raw`
    const assert = require('node:assert/strict');
    function makeResponse() {
      return {
        headers: {},
        setHeader(name, value) {
          this.headers[String(name).toLowerCase()] = value;
        },
        status(code) {
          this.statusCode = code;
          return this;
        },
        json(body) {
          this.body = body;
          return body;
        },
      };
    }

    (async () => {
      const { default: handler } = await import('./api/index.js');

      for (let attempt = 0; attempt < 2; attempt += 1) {
        const response = makeResponse();
        await handler({ url: '/api/health' }, response);
        assert.equal(response.statusCode, 503);
        assert.equal(response.headers['cache-control'], 'no-store');
        assert.equal(response.body.message, 'Service temporarily unavailable.');
        assert.doesNotMatch(
          JSON.stringify(response.body),
          /MONGODB_URI|JWT_SECRET|stack/i,
        );
      }
    })().catch((error) => {
      console.error(error);
      process.exitCode = 1;
    });
  `;

  const result = spawnSync(
    process.execPath,
    ['--eval', script],
    {
      cwd: mobileRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        VERCEL: '1',
        MONGODB_URI: ' ',
        JWT_SECRET: ' ',
        DISABLE_DB: 'false',
        OTP_DEV_MODE: 'false',
      },
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(
    result.stderr,
    /Missing required environment variable: MONGODB_URI/,
  );
  assert.match(
    result.stderr,
    /Missing required environment variable: JWT_SECRET/,
  );
  assert.match(result.stderr, /\n\s+at /);
  assert.equal(
    (result.stderr.match(/Failed to initialize backend application/g) || [])
      .length,
    2,
    'a failed initialization promise must be retried on the next invocation',
  );
});

test('MongoDB connection failures reject backend initialization', () => {
  const script = String.raw`
    import assert from 'node:assert/strict';
    const backend = await import('./backend/app.js');
    await assert.rejects(
      backend.initializeBackend(),
      /MongoDB connection failed/,
    );
  `;

  const result = spawnSync(
    process.execPath,
    ['--input-type=module', '--eval', script],
    {
      cwd: mobileRoot,
      encoding: 'utf8',
      env: {
        ...process.env,
        NODE_ENV: 'production',
        VERCEL: '1',
        MONGODB_URI: 'mongodb://127.0.0.1:1/verifitor_startup_test',
        JWT_SECRET: 'startup-test-secret-with-more-than-thirty-two-bytes',
        DISABLE_DB: 'false',
        OTP_DEV_MODE: 'false',
      },
    },
  );

  assert.equal(result.status, 0, result.stderr || result.stdout);
});
