const TIME_ZONE = 'Asia/Manila';

function positiveDays(value, label) {
  const days = Number(value);
  if (!Number.isSafeInteger(days) || days < 1) {
    throw new Error(`${label} must be a positive whole number of business days.`);
  }
  return days;
}

function processingDaysFor(documentType, config = process.env) {
  const defaultDays = positiveDays(
    config.DEFAULT_DOCUMENT_PROCESSING_DAYS || 5,
    'DEFAULT_DOCUMENT_PROCESSING_DAYS',
  );
  const configured = config.DOCUMENT_PROCESSING_DAYS
    ? JSON.parse(config.DOCUMENT_PROCESSING_DAYS) : {};
  if (!configured || Array.isArray(configured) || typeof configured !== 'object') {
    throw new Error('DOCUMENT_PROCESSING_DAYS must be a JSON object.');
  }
  const key = String(documentType || '').trim().toLowerCase();
  const match = Object.entries(configured).find(
    ([name]) => name.trim().toLowerCase() === key,
  );
  return match ? positiveDays(match[1], `Processing days for ${match[0]}`) : defaultDays;
}

function manilaDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date);
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return [Number(value.year), Number(value.month), Number(value.day)];
}

function addBusinessDays(startedAt, days) {
  const [year, month, day] = manilaDateParts(startedAt);
  const cursor = new Date(Date.UTC(year, month - 1, day));
  let remaining = positiveDays(days, 'processingDays');
  while (remaining > 0) {
    cursor.setUTCDate(cursor.getUTCDate() + 1);
    if (cursor.getUTCDay() !== 0 && cursor.getUTCDay() !== 6) remaining -= 1;
  }
  return cursor.toISOString().slice(0, 10);
}

function createProcessingEstimate(documentType, startedAt = new Date(), config = process.env) {
  const processingDays = processingDaysFor(documentType, config);
  return {
    processingStartedAt: startedAt,
    processingDays,
    estimatedCompletionDate: addBusinessDays(startedAt, processingDays),
  };
}

module.exports = { processingDaysFor, addBusinessDays, createProcessingEstimate };
