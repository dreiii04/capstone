const assert = require('node:assert/strict');
const { test } = require('node:test');

const { isSupportedImage } = require('../utils/imageValidation');

test('receipt/profile uploads validate file bytes, not only MIME metadata', () => {
  const validPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN3sAAAAASUVORK5CYII=', 'base64');
  assert.equal(isSupportedImage(Buffer.from('not really a jpeg')), false);
  assert.equal(isSupportedImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), false);
  assert.equal(isSupportedImage(validPng), true);
  assert.equal(isSupportedImage(validPng.subarray(0, 20)), false);
});
