const assert = require('node:assert/strict');
const express = require('express');
const { after, before, test } = require('node:test');

const {
  updateProfileValidation,
  validate,
} = require('../middleware/validationMiddleware');

const app = express();
app.use(express.json());
app.put('/profile', updateProfileValidation, validate, (req, res) => {
  res.json({ success: true, body: req.body });
});

let server;
let baseUrl;

before(async () => {
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

async function updateProfile(body) {
  return fetch(`${baseUrl}/profile`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

test('valid two-letter names are accepted consistently with the mobile form', async () => {
  const response = await updateProfile({ firstName: 'An', lastName: 'Li' });
  assert.equal(response.status, 200);
});

test('names accept real curly apostrophes without accepting mojibake bytes', async () => {
  const valid = await updateProfile({ firstName: 'D’Arcy' });
  assert.equal(valid.status, 200);

  const invalid = await updateProfile({ firstName: 'Dâ€™Arcy' });
  assert.equal(invalid.status, 400);
});

test('profile validation returns an actionable message', async () => {
  const response = await updateProfile({ firstName: '1' });
  assert.equal(response.status, 400);
  const body = await response.json();
  assert.notEqual(body.message, 'Input validation failed');
  assert.match(body.message, /First name/);
});
