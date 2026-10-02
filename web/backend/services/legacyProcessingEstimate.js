const Request = require('../models/Request');
const ActivityLog = require('../models/ActivityLog');
const Transaction = require('../models/Transaction');
const { createProcessingEstimate } = require('./processingEstimate');

function recordedProcessingStart(request) {
  const historyEvent = (request.statusHistory || []).find((event) =>
    ['in process', 'processing'].includes(String(event.status || '').toLowerCase()) &&
    !Number.isNaN(new Date(event.at).getTime()));
  return historyEvent ? new Date(historyEvent.at) : null;
}

async function ensureLegacyProcessingEstimate(request) {
  if (request.status !== 'In Process' || request.estimatedCompletionDate ||
      request.estimatedProcessingEnd) return request;

  let startedAt = request.processingStartedAt || recordedProcessingStart(request);
  if (!startedAt) {
    const requestId = request.requestId;
    const log = await ActivityLog.findOne({ details: { $in: [
      `Updated request ${requestId} status to In Process`,
      `[SUPER ADMIN] Bypassed verification for request ${requestId}, status set to In Process`,
    ] } }).sort({ timestamp: 1 });
    startedAt = log?.timestamp || null;
  }
  if (!startedAt) {
    const payment = await Transaction.findOne({
      requestId: request.requestId, status: 'Completed', verifiedAt: { $ne: null },
    }).sort({ verifiedAt: 1 });
    startedAt = payment?.verifiedAt || null;
  }
  if (!startedAt) return request;

  const estimate = createProcessingEstimate(request.documentType, new Date(startedAt));
  // Another reader may repair the same record first. Never replace its date.
  const repaired = await Request.findOneAndUpdate(
    { _id: request._id, status: 'In Process', estimatedCompletionDate: { $in: [null, ''] } },
    { $set: estimate },
    { new: true },
  );
  return repaired || await Request.findById(request._id) || request;
}

module.exports = { ensureLegacyProcessingEstimate, recordedProcessingStart };
