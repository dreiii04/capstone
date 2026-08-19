const assert = require('node:assert/strict');
const { test } = require('node:test');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-hs256';

const { issueSession, serializeUser } = require('../services/sessionService');

test('shared sessions support both web and mobile token contracts', async () => {
  let persistedUpdate;
  const fakeUser = {
    _id: '507f1f77bcf86cd799439011',
    email: 'Student@Example.com',
    role: 'student',
    firstName: 'Test',
    lastName: 'Student',
    sessionVersion: 2,
    constructor: {
      async updateOne(filter, update) {
        persistedUpdate = { filter, update };
      },
    },
  };

  const session = await issueSession(fakeUser);
  assert.equal(session.token, session.accessToken);
  assert.match(session.refreshToken, /^[a-f0-9]{96}$/);
  assert.equal(session.expiresInSeconds, 86400);
  assert.equal(persistedUpdate.filter._id, fakeUser._id);
  assert.equal(persistedUpdate.update.$push.refreshTokens.$each.length, 1);

  const decoded = jwt.verify(session.accessToken, process.env.JWT_SECRET, {
    algorithms: ['HS256'],
  });
  assert.equal(decoded.sub, fakeUser._id);
  assert.equal(decoded.sv, 2);
  assert.equal(decoded.email, 'student@example.com');
});

test('profile serialization never exposes authentication secrets', () => {
  const profile = serializeUser({
    _id: 'user-1',
    email: 'user@example.com',
    role: 'student',
    password: 'password-hash',
    refreshTokens: [{ tokenHash: 'refresh-hash' }],
  });
  assert.equal(profile.password, undefined);
  assert.equal(profile.refreshTokens, undefined);
});
