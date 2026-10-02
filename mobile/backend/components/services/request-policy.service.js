// Optional institutional configuration. Missing/incomplete policy fails closed.
export function requestPolicy() {
  let express = null;
  try {
    const value = JSON.parse(process.env.EXPRESS_REQUEST_POLICY || 'null');
    if (value && Array.isArray(value.documents) && value.documents.length &&
        value.documents.every(d => typeof d === 'string' && d.trim()) &&
        typeof value.additionalFee === 'number' && Number.isFinite(value.additionalFee) && value.additionalFee >= 0 &&
        typeof value.processingTime === 'string' && value.processingTime.trim() &&
        typeof value.startsWhen === 'string' && value.startsWhen.trim()) express = value;
  } catch (_) { /* Invalid policy cannot enable Express. */ }
  return { express };
}
export function processingForRequest(docName, option = 'standard') {
  if (option === 'standard') return { processingOption: 'standard', processingFee: 0, priority: 0 };
  const policy = requestPolicy().express;
  if (option !== 'express' || !policy || !policy.documents.some(d => d.trim().toLowerCase() === docName.trim().toLowerCase())) {
    throw Object.assign(new Error('Express processing is not available for this document.'), { status: 400 });
  }
  return { processingOption: 'express', processingFee: policy.additionalFee, priority: 1,
    processingTime: policy.processingTime, processingStartsWhen: policy.startsWhen };
}
