const DEFAULT_DOCUMENT_PRICE = 100;
const DEFAULT_PROCESSING_FEE = 0;

const DOCUMENT_PRICES = Object.freeze({
  'f-137 (sh)': 400,
  'f-137 (gs/jh)': 250,
  tor: 600,
  'transcript of records': 600,
  'transcript of records (tor)': 600,
  gwa: 250,
  'general weighted average (gwa)': 250,
  'gmc/esc': 200,
  'good moral character/esc (gmc/esc)': 200,
  'certificate of good moral': 200,
  'card (re-print)': 200,
  moi: 250,
  'moi (memorandum of inclusion)': 250,
  'student verification': 250,
  'request form (lost)': 200,
  ctc: 200,
  'certified true copy (ctc)': 200,
  'ctc of certificate of matriculation': 200,
  'ctc of diploma': 200,
  'ctc of curriculum': 200,
  'diploma (2nd copy)': 300,
  'application for grad': 200,
  'application for graduation': 200,
  'certificate of candidacy for graduation': 200,
  prospectus: 200,
  'cert. of grades': 250,
  'certificate of grades': 250,
  'grade certification': 250,
  'transfer credential': 300,
  'cert. of enrollment': 250,
  'certificate of enrollment': 250,
  clearance: 200,
  'certificate of units earned': 200,
  'certificate of assessment': 200,
  'certificate of registration': 200,
  others: 0,
});

function toNonNegativeNumber(value, fallback) {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function getDocumentPrice(documentType) {
  const key = String(documentType || '').trim().toLowerCase();
  if (!key) return DEFAULT_DOCUMENT_PRICE;
  if (DOCUMENT_PRICES[key] != null) return DOCUMENT_PRICES[key];
  if (key.includes('ctc')) return 200;
  return DEFAULT_DOCUMENT_PRICE;
}

function resolveRequestPricing(request = {}) {
  const catalogPrice = getDocumentPrice(request.documentType || request.docName);
  const storedDocumentPrice = toNonNegativeNumber(request.documentPrice, catalogPrice);
  // Old records commonly contain a placeholder zero. Do not let that hide a
  // known catalog price, while preserving zero for the intentionally unpriced
  // "Others" option.
  const documentPrice = storedDocumentPrice === 0 && catalogPrice > 0
    ? catalogPrice
    : storedDocumentPrice;
  const processingFee = toNonNegativeNumber(
    request.processingFee,
    DEFAULT_PROCESSING_FEE,
  );
  const fallbackTotal = documentPrice + processingFee;
  const storedTotal = toNonNegativeNumber(request.totalAmount, fallbackTotal);
  const totalAmount = storedTotal === 0 && fallbackTotal > 0
    ? fallbackTotal
    : storedTotal;

  return { documentPrice, processingFee, totalAmount };
}

function requestAcceptsPayment(status) {
  const normalized = String(status || '')
    .trim()
    .toLowerCase()
    .replace(/[\s-]+/g, '_');
  return ['', 'pending', 'pending_payment', 'pending_for_payment'].includes(normalized);
}

function resolveTransactionAmount(transaction = {}, linkedRequest = {}) {
  const storedAmount = toNonNegativeNumber(
    transaction.totalAmount ?? transaction.amount,
    0,
  );
  if (storedAmount > 0) return storedAmount;
  if (!linkedRequest.documentType && !linkedRequest.docName) return 0;
  return resolveRequestPricing(linkedRequest).totalAmount;
}

module.exports = {
  DEFAULT_DOCUMENT_PRICE,
  DEFAULT_PROCESSING_FEE,
  getDocumentPrice,
  resolveRequestPricing,
  resolveTransactionAmount,
  requestAcceptsPayment,
};
