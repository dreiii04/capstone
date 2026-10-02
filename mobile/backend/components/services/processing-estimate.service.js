// The mobile API repairs legacy records once; all clients then read the saved
// estimate. New transitions are written by the registrar backend.
function processingDaysFor(documentType, config = process.env) {
  const fallback = Number(config.DEFAULT_DOCUMENT_PROCESSING_DAYS || 5);
  const overrides = config.DOCUMENT_PROCESSING_DAYS
    ? JSON.parse(config.DOCUMENT_PROCESSING_DAYS) : {};
  const match = Object.entries(overrides).find(([name]) =>
    name.trim().toLowerCase() === String(documentType || '').trim().toLowerCase());
  const days = match ? Number(match[1]) : fallback;
  if (!Number.isSafeInteger(days) || days < 1) {
    throw new Error('Document processing days must be a positive whole number.');
  }
  return days;
}

function addBusinessDays(startedAt, days) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(startedAt);
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  const cursor = new Date(Date.UTC(Number(date.year), Number(date.month) - 1,
    Number(date.day)));
  let remaining = days;
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) remaining -= 1;
  }
  return cursor.toISOString().slice(0, 10);
}

export function createProcessingEstimate(documentType, startedAt, config = process.env) {
  const processingDays = processingDaysFor(documentType, config);
  return {
    processingStartedAt: startedAt,
    processingDays,
    estimatedCompletionDate: addBusinessDays(startedAt, processingDays),
  };
}

export function recordedProcessingStart(record) {
  const event = (record.statusHistory || []).find((item) =>
    ['in process', 'processing'].includes(String(item.status || '').toLowerCase()) &&
    !Number.isNaN(new Date(item.at).getTime()));
  return event ? new Date(event.at) : null;
}
