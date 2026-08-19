const assert = require('node:assert/strict');
const { test } = require('node:test');

const { resolveSmtpConfig } = require('../services/mailService');

test('generic SMTP configuration supports relay providers', () => {
  const config = resolveSmtpConfig({
    SMTP_HOST: 'smtp-relay.example.com',
    SMTP_PORT: '587',
    SMTP_SECURE: 'false',
    SMTP_USER: 'relay-user',
    SMTP_PASS: 'relay-password',
    SMTP_FROM: 'VeriFitor <no-reply@example.com>',
  });
  assert.equal(config.transport.host, 'smtp-relay.example.com');
  assert.equal(config.transport.port, 587);
  assert.equal(config.transport.secure, false);
  assert.equal(config.transport.auth.user, 'relay-user');
});

test('legacy Gmail variables remain supported', () => {
  const config = resolveSmtpConfig({
    SMTP_EMAIL: 'mailer@example.com',
    SMTP_PASSWORD: 'app-password',
  });
  assert.equal(config.transport.service, 'gmail');
  assert.equal(config.transport.auth.user, 'mailer@example.com');
});

test('incomplete SMTP configuration fails closed', () => {
  assert.equal(resolveSmtpConfig({ SMTP_HOST: 'smtp.example.com' }), null);
});
