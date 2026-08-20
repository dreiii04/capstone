import assert from 'node:assert/strict';
import test from 'node:test';

test('authenticated receipt delivery URLs are signed without exposing secrets', async () => {
  const [{ v2: cloudinary }, { buildAuthenticatedReceiptDeliveryUrl }] =
    await Promise.all([
      import('cloudinary'),
      import('../components/services/media.service.js'),
    ]);

  cloudinary.config({
    cloud_name: 'receipt-delivery-test',
    api_key: 'receipt-test-key',
    api_secret: 'receipt-test-secret',
  });
  const url = buildAuthenticatedReceiptDeliveryUrl({
    public_id: 'capstone/receipts/private-receipt',
    resource_type: 'image',
    version: 123,
    format: 'png',
  });

  assert.match(
    url,
    /^https:\/\/res\.cloudinary\.com\/receipt-delivery-test\/image\/authenticated\/s--[A-Za-z0-9_-]+--\/v123\/capstone\/receipts\/private-receipt\.png/,
  );
  assert.doesNotMatch(url, /receipt-test-secret|receipt-test-key/);
});
