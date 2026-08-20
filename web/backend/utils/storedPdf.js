const PDF_DATA_PREFIX = 'data:application/pdf;base64,';

function encodePdf(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
    throw new TypeError('A non-empty PDF buffer is required.');
  }
  return `${PDF_DATA_PREFIX}${buffer.toString('base64')}`;
}

function decodePdf(value) {
  if (typeof value !== 'string' || !value.startsWith(PDF_DATA_PREFIX)) {
    return null;
  }
  const pdf = Buffer.from(value.slice(PDF_DATA_PREFIX.length), 'base64');
  return pdf.subarray(0, 5).toString('ascii') === '%PDF-' ? pdf : null;
}

function storedPdfMarker(fileName) {
  const safeName = String(fileName || 'document.pdf')
    .replace(/[^A-Za-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'document.pdf';
  return `stored:${safeName}`;
}

function protectStoredPdf(_document, value) {
  if (!value || typeof value !== 'object') return value;
  delete value.pdfData;
  if (typeof value.pdfPath === 'string' &&
      value.pdfPath.startsWith(PDF_DATA_PREFIX)) {
    value.pdfPath = storedPdfMarker('legacy-document.pdf');
  }
  return value;
}

function applyStoredPdfProtection(schema) {
  for (const outputType of ['toJSON', 'toObject']) {
    const current = schema.get(outputType) || {};
    schema.set(outputType, { ...current, transform: protectStoredPdf });
  }
}

module.exports = {
  applyStoredPdfProtection,
  decodePdf,
  encodePdf,
  storedPdfMarker,
};
