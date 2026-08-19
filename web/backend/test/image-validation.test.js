const assert = require('node:assert/strict');
const { test } = require('node:test');

const { isSupportedImage } = require('../utils/imageValidation');

test('receipt/profile uploads validate file bytes, not only MIME metadata', () => {
  assert.equal(isSupportedImage(Buffer.from('not really a jpeg')), false);
  assert.equal(isSupportedImage(Buffer.from([0xff, 0xd8, 0xff, 0xe0])), true);
  assert.equal(
    isSupportedImage(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])),
    true
  );
});
