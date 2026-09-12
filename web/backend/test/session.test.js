const assert = require('node:assert/strict');
const { test } = require('node:test');
const jwt = require('jsonwebtoken');

process.env.JWT_SECRET = 'test-only-secret-that-is-long-enough-for-hs256';

const { issueSession, serializeUser } = require('../services/sessionService');
const { tokenPredatesSecurityChange } = require('../middleware/authMiddleware');
const Alumni = require('../models/Users/Alumni');
const Registrar = require('../models/Registrar');

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

test('user model serialization never exposes password or refresh-token hashes', () => {
  const user = new Registrar({
    registrarId: 'REG-TEST',
    name: 'Test Registrar',
    email: 'registrar@example.com',
    password: 'password-hash',
    refreshTokens: [{
      tokenHash: 'refresh-hash',
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 60_000),
    }],
  });

  const json = user.toJSON();
  const object = user.toObject();
  for (const output of [json, object]) {
    assert.equal(output.password, undefined);
    assert.equal(output.refreshTokens, undefined);
  }
});

test('user management serialization strips mobile passwordHash records', () => {
  const mobileCreatedUser = Alumni.hydrate({
    _id: '507f1f77bcf86cd799439011',
    firstName: 'Mobile',
    lastName: 'Alumni',
    email: 'mobile.alumni@example.com',
    role: 'alumni',
    passwordHash: '$2a$12$mobile-generated-bcrypt-hash',
  });

  const json = mobileCreatedUser.toJSON();
  const object = mobileCreatedUser.toObject();
  for (const output of [json, object]) {
    assert.equal(output.passwordHash, undefined);
  }
});

test('a session issued immediately after a password change remains valid', () => {
  const changedAt = new Date('2026-08-20T05:40:01.450Z');
  const issuedAt = Math.floor(changedAt.getTime() / 1000);

  assert.equal(
    tokenPredatesSecurityChange({ iat: issuedAt }, {
      tokensValidAfter: changedAt,
    }),
    false,
  );
  assert.equal(
    tokenPredatesSecurityChange({ iat: issuedAt - 1 }, {
      tokensValidAfter: changedAt,
    }),
    true,
  );
});
