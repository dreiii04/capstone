const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  getDocumentPrice,
  resolveRequestPricing,
  resolveTransactionAmount,
  requestAcceptsPayment,
} = require('../services/documentPricingService');

test('catalog pricing recognizes canonical names and aliases', () => {
  assert.equal(getDocumentPrice('Transcript of Records (TOR)'), 600);
  assert.equal(getDocumentPrice('TOR'), 600);
  assert.equal(getDocumentPrice('CTC of Diploma'), 200);
});

test('old zero and missing amounts are repaired from the catalog', () => {
  assert.deepEqual(
    resolveRequestPricing({
      documentType: 'Certificate of Enrollment',
      documentPrice: 0,
      totalAmount: '0.00',
    }),
    { documentPrice: 250, processingFee: 0, totalAmount: 250 },
  );
});

test('payment is accepted only while a request is awaiting payment', () => {
  assert.equal(requestAcceptsPayment('Pending'), true);
  assert.equal(requestAcceptsPayment('pending-payment'), true);
  assert.equal(requestAcceptsPayment('In Process'), false);
  assert.equal(requestAcceptsPayment('Released'), false);
  assert.equal(requestAcceptsPayment('Rejected'), false);
});

test('old zero-value transactions inherit the linked request amount', () => {
  assert.equal(
    resolveTransactionAmount(
      { amount: '0.00' },
      { documentType: 'Transcript of Records (TOR)' },
    ),
    600,
  );
  assert.equal(
    resolveTransactionAmount(
      { amount: '250.00' },
      { documentType: 'Transcript of Records (TOR)' },
    ),
    250,
  );
});
