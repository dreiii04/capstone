const test = require('node:test');
const assert = require('node:assert/strict');
const {
  processingDaysFor, addBusinessDays, createProcessingEstimate,
} = require('../services/processingEstimate');

test('starts on the transition day and skips the weekend', () => {
  const friday = new Date('2026-09-11T08:00:00+08:00');
  const estimate = createProcessingEstimate('F-137 (SH)', friday, {
    DEFAULT_DOCUMENT_PROCESSING_DAYS: '3',
  });
  assert.equal(estimate.processingStartedAt, friday);
  assert.equal(estimate.processingDays, 3);
  assert.equal(estimate.estimatedCompletionDate, '2026-09-16');
  assert.equal(addBusinessDays(friday, 1), '2026-09-14');
});

test('uses configured days for each document type', () => {
  const config = {
    DEFAULT_DOCUMENT_PROCESSING_DAYS: '4',
    DOCUMENT_PROCESSING_DAYS: JSON.stringify({ 'F-137 (SH)': 3, 'Transcript of Records (TOR)': 5 }),
  };
  assert.equal(processingDaysFor('f-137 (sh)', config), 3);
  assert.equal(processingDaysFor('Transcript of Records (TOR)', config), 5);
  assert.equal(processingDaysFor('Clearance', config), 4);
  assert.throws(() => processingDaysFor('Clearance', {
    DEFAULT_DOCUMENT_PROCESSING_DAYS: '0',
  }));
});
