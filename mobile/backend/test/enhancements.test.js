import assert from 'node:assert/strict';
import test from 'node:test';
import bcrypt from 'bcryptjs';
import { hashPassword, verifyPassword } from '../components/services/password.service.js';
import { documentEligibilityByRole, eligibilityRole, isDocumentAllowedForRole } from '../components/services/eligibility.service.js';
import { requestPolicy, processingForRequest } from '../components/services/request-policy.service.js';

test('long UTF-8 passwords use every byte while legacy bcrypt still authenticates', async () => {
  const password = 'Strong1!' + '界'.repeat(100);
  const hash = await hashPassword(password);
  assert.equal(await verifyPassword(password, hash), true);
  assert.equal(await verifyPassword(password.slice(0, -1) + '改', hash), false);
  assert.equal(await verifyPassword(password.slice(0, 72), hash), false);
  await assert.rejects(hashPassword('a'.repeat(1025)));
  assert.equal(await verifyPassword('a'.repeat(1025), hash), false);
  const legacy = await bcrypt.hash('OldPassword1!', 10);
  assert.equal(await verifyPassword('OldPassword1!', legacy), true);
  assert.equal(await verifyPassword('wrong', legacy), false);
});

test('every catalog role/document pair follows the supplied policy', () => {
  const names = new Set(Object.values(documentEligibilityByRole).flatMap(set => [...set]));
  for (const role of ['student', 'former_student', 'alumni']) {
    for (const name of names) {
      const expected = documentEligibilityByRole[role].has(name);
      assert.equal(isDocumentAllowedForRole(name, role), expected, `${role}: ${name}`);
    }
  }
  assert.equal(eligibilityRole({ role: 'student', studentStatus: 'former_student' }), 'former_student');
  assert.equal(isDocumentAllowedForRole('cert. of enrollment', 'alumni'), false);
  assert.equal(isDocumentAllowedForRole('application for grad', 'former_student'), false);
  assert.equal(isDocumentAllowedForRole('CTC', 'alumni'), true);
  assert.equal(isDocumentAllowedForRole('Others', ''), false);
});

test('Express is disabled without a complete policy and ignores client prices', () => {
  const original = process.env.EXPRESS_REQUEST_POLICY;
  try {
    delete process.env.EXPRESS_REQUEST_POLICY;
    assert.equal(requestPolicy().express, null);
    assert.throws(() => processingForRequest('Clearance', 'express'));
    process.env.EXPRESS_REQUEST_POLICY = JSON.stringify({ documents: ['Clearance'], additionalFee: 50 });
    assert.equal(requestPolicy().express, null);
    process.env.EXPRESS_REQUEST_POLICY = JSON.stringify({ documents: ['Clearance'], additionalFee: 50, processingTime: 'Test target', startsWhen: 'Test payment approval' });
    assert.equal(processingForRequest('Clearance', 'express').processingFee, 50);
    assert.throws(() => processingForRequest('Prospectus', 'express'));
    assert.throws(() => processingForRequest('Clearance', 'bypass'));
    assert.equal(processingForRequest('Clearance', 'standard').processingFee, 0);
  } finally {
    if (original == null) delete process.env.EXPRESS_REQUEST_POLICY;
    else process.env.EXPRESS_REQUEST_POLICY = original;
  }
});
