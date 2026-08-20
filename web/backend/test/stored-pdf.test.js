const assert = require('node:assert/strict');
const test = require('node:test');
const mongoose = require('mongoose');

const {
  applyStoredPdfProtection,
  decodePdf,
  encodePdf,
  storedPdfMarker,
} = require('../utils/storedPdf');

test('stored PDF helpers round-trip valid PDF bytes and reject invalid data', () => {
  const original = Buffer.from('%PDF-1.7\nexample');
  const encoded = encodePdf(original);
  assert.deepEqual(decodePdf(encoded), original);
  assert.equal(decodePdf('data:application/pdf;base64,bm90IGEgcGRm'), null);
  assert.equal(decodePdf('stored:document.pdf'), null);
});

test('stored PDF markers sanitize untrusted filenames', () => {
  assert.equal(
    storedPdfMarker('../../student transcript?.pdf'),
    'stored:..-..-student-transcript-.pdf',
  );
});

test('stored PDF model serialization never returns embedded PDF data', () => {
  const schema = new mongoose.Schema({
    pdfPath: String,
    pdfData: { type: String, select: false },
  });
  applyStoredPdfProtection(schema);
  const StoredPdfFixture = mongoose.models.StoredPdfFixture ||
    mongoose.model('StoredPdfFixture', schema);
  const record = new StoredPdfFixture({
    pdfPath: encodePdf(Buffer.from('%PDF-1.7\nsecret')),
    pdfData: encodePdf(Buffer.from('%PDF-1.7\nsecret')),
  });
  const serialized = record.toJSON();
  assert.equal(serialized.pdfData, undefined);
  assert.equal(serialized.pdfPath, 'stored:legacy-document.pdf');
});
