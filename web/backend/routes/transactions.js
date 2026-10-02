const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const mongoose = require('mongoose');
const Transaction = require('../models/Transaction');
const Request = require('../models/Request');
const ActivityLog = require('../models/ActivityLog');
const Notification = require('../models/Notification');
const { protect, registrarOrSuperAdmin } = require('../middleware/authMiddleware');
const { isEndUser } = require('../services/sessionService');
const { uploadStream, cloudinary } = require('../utils/cloudinary');
const { isSupportedImage } = require('../utils/imageValidation');
const { ownerQuery } = require('../utils/ownership');
const { createProcessingEstimate } = require('../services/processingEstimate');
const {
  resolveRequestPricing,
  resolveTransactionAmount,
  requestAcceptsPayment,
} = require('../services/documentPricingService');

async function enrichTransactionAmounts(transactions) {
  const records = transactions.map((transaction) =>
    typeof transaction.toObject === 'function' ? transaction.toObject() : transaction);
  const recordsMissingAmount = records.filter((record) => {
      const storedAmount = Number.parseFloat(record.totalAmount ?? record.amount);
      return !Number.isFinite(storedAmount) || storedAmount <= 0;
    });
  if (recordsMissingAmount.length === 0) return records;
  const missingRequestIds = recordsMissingAmount
    .map((record) => String(record.requestId || '').trim())
    .filter(Boolean);
  const linkedRequests = missingRequestIds.length === 0
    ? []
    : await Request.find({
        requestId: { $in: [...new Set(missingRequestIds)] },
      });
  const requestsById = new Map(
    linkedRequests.map((request) => [request.requestId, request.toObject()]),
  );
  return records.map((record) => {
    const amount = resolveTransactionAmount(
      record,
      requestsById.get(record.requestId),
    );
    return amount > 0
      ? { ...record, amount: amount.toFixed(2), totalAmount: amount }
      : record;
  });
}

// --- Multer Configuration for Receipt Uploads ---
const storage = multer.memoryStorage();

const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/png', 'image/jpg', 'image/jpeg'];
  if (allowedTypes.includes(file.mimetype) ||
      file.mimetype === 'application/octet-stream') {
    cb(null, true);
  } else {
    cb(new Error('Only PNG, JPG and JPEG image files are allowed.'), false);
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 4 * 1024 * 1024 }
});

// Get all transactions
router.get('/', protect, async (req, res) => {
  try {
    const query = isEndUser(req.user)
      ? ownerQuery(req.user, { emailField: 'payerEmail' })
      : {};
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '100', 10) || 100, 1), 200);
    const transactions = await Transaction.aggregate([
      { $match: query },
      { $addFields: { reviewAt: { $ifNull: ['$lastSubmittedAt', '$date'] } } },
      { $sort: { reviewAt: -1, date: -1 } },
      { $limit: limit },
      { $project: { reviewAt: 0 } },
    ]);
    res.json(await enrichTransactionAmounts(transactions));
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transactions' });
  }
});

// Get a receipt for a specific request
router.get('/receipt', protect, async (req, res) => {
  try {
    const { docName, purpose } = req.query;
    if (!docName || !purpose) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    const transaction = await Transaction.findOne({
      documentType: docName,
      requestId: purpose,
      ...(isEndUser(req.user)
        ? ownerQuery(req.user, { emailField: 'payerEmail' })
        : {}),
    }).sort({ date: -1 });

    if (!transaction) {
      return res.json({ success: true, receipt: null });
    }

    const [receipt] = await enrichTransactionAmounts([transaction]);
    res.json({ success: true, receipt });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Error fetching receipt' });
  }
});

// ====== REFUND REQUEST ENDPOINTS ======
const Refund = require('../models/Refund');

// Admin: Get all refund requests (with optional status filter)
// IMPORTANT: This must be defined BEFORE the /:id route below,
// otherwise Express treats "refunds" as a transaction ID.
router.get('/refunds', protect, registrarOrSuperAdmin, async (req, res) => {
  try {
    const query = {};
    if (req.query.status && req.query.status !== 'All') {
      query.status = req.query.status;
    }
    const refunds = await Refund.find(query).sort({ createdAt: -1 });
    res.json(refunds);
  } catch (error) {
    console.error('Error fetching refunds:', error);
    res.status(500).json({ message: 'Error fetching refund requests' });
  }
});

// Get a single transaction by transactionId
router.get('/:id', protect, async (req, res) => {
  try {
    const transaction = await Transaction.findOne({
      transactionId: req.params.id,
      ...(isEndUser(req.user)
        ? ownerQuery(req.user, { emailField: 'payerEmail' })
        : {}),
    });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    const [enriched] = await enrichTransactionAmounts([transaction]);
    res.json(enriched);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching transaction' });
  }
});

// Upload receipt and create a new transaction
router.post('/upload-receipt', protect, upload.single('receiptImage'), async (req, res) => {
  let uploadResult;
  try {
    const { requestId, documentType, paymentMode } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'A receipt image is required.' });
    }
    if (!isSupportedImage(req.file.buffer)) {
      return res.status(400).json({ success: false, message: 'Uploaded receipt is not a valid PNG or JPEG image.' });
    }
    const allowedPaymentModes = ['GCash', 'Maya', 'GoThyme', 'Other Online Payment'];
    if (paymentMode && !allowedPaymentModes.includes(paymentMode)) {
      return res.status(400).json({ success: false, message: 'Invalid payment mode.' });
    }
    const linkedRequest = await Request.findOne({
      requestId,
      ...(isEndUser(req.user) ? ownerQuery(req.user) : {}),
    });
    if (!linkedRequest) {
      return res.status(404).json({ success: false, message: 'Request not found.' });
    }
    if (!requestAcceptsPayment(linkedRequest.status)) {
      return res.status(409).json({
        success: false,
        message: 'This request is no longer awaiting payment.',
      });
    }
    const duplicate = await Transaction.findOne({ requestId });
    if (duplicate) {
      return res.status(409).json({ success: false, message: 'A receipt already exists for this request.' });
    }

    // Auto-generate transactionId
    const transactionId =
      `TXN-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const { totalAmount } = resolveRequestPricing(linkedRequest.toObject());
    if (totalAmount <= 0) {
      return res.status(409).json({
        success: false,
        message: 'The payment amount has not been set for this request.',
      });
    }

    uploadResult = await uploadStream(req.file.buffer, 'receipts');
    const receiptImage = uploadResult.secure_url;
    const now = new Date();
    const session = await mongoose.startSession();
    let newTx;
    try {
      await session.withTransaction(async () => {
        [newTx] = await Transaction.create([{
          userId: String(req.user.id || ''),
          transactionId,
          requestId,
          name: linkedRequest.name || req.user.name || 'User',
          documentType: linkedRequest.documentType || documentType || 'General',
          paymentMode: paymentMode || 'GCash',
          amount: totalAmount.toFixed(2),
          receiptImage,
          imageUrl: receiptImage,
          publicId: uploadResult.public_id,
          receiptImagePublicId: uploadResult.public_id,
          lastSubmittedAt: now,
          payerName: linkedRequest.name || req.user.name || 'User',
          payerEmail: String(req.user.email || '').trim().toLowerCase(),
          payerType: String(req.user.role || '').toLowerCase() === 'alumni' ? 'Alumni' : 'Student',
          status: 'Pending Verification',
        }], { session });
        const updatedRequest = await Request.findOneAndUpdate(
          { _id: linkedRequest._id, status: linkedRequest.status,
            $or: [{ paymentReceiptId: { $exists: false } },
              { paymentReceiptId: null }, { paymentReceiptId: '' }] },
          { $set: { status: 'Pending', mobileStatus: 'pending',
            paymentReceiptId: String(newTx._id) },
            $push: { statusHistory: { status: 'Pending', at: now,
              remarks: 'Receipt submitted for review.' } } },
          { new: true, session },
        );
        if (!updatedRequest) {
          throw Object.assign(new Error('A receipt already exists for this request.'), { httpStatus: 409 });
        }
      });
    } finally {
      await session.endSession();
    }

    res.status(201).json(newTx);
  } catch (error) {
    if (uploadResult?.public_id) {
      await cloudinary.uploader.destroy(uploadResult.public_id, { type: 'authenticated' }).catch(() => {});
    }
    console.error('Receipt upload error:', error);
    if (error?.httpStatus || error?.code === 11000 || error?.code === 112) {
      return res.status(409).json({ success: false,
        message: 'A receipt already exists for this request.' });
    }
    if (error?.code === 'MEDIA_STORAGE_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        message: 'Receipt storage is temporarily unavailable. Please try again later.',
      });
    }
    if (error?.http_code >= 400 && error?.http_code < 500) {
      return res.status(502).json({
        success: false,
        message: 'The receipt could not be stored. Please choose the image again.',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Payment could not be submitted. Please try again.',
    });
  }
});

// Create a new transaction (Legacy - Logged)
router.post('/', protect, registrarOrSuperAdmin, async (req, res) => {
    try {
        const newTx = await Transaction.create({
          userId: String(req.user.id || ''),
          transactionId: req.body.transactionId || 'TXN-' + Date.now(),
          requestId: req.body.requestId || 'N/A',
          name: req.body.name || 'Unknown',
          documentType: req.body.documentType || 'General',
          paymentMode: req.body.paymentMode || 'GCash',
          amount: req.body.amount || '0.00',
          receiptImage: req.body.receiptImage || '',
          payerName: req.body.payerName || '',
          payerEmail: req.body.payerEmail || '',
          payerType: req.body.payerType || 'Student',
          adminRemarks: req.body.adminRemarks || '',
          status: req.body.status || 'Pending Verification',
        });

        // Log activity
        await ActivityLog.create({
            userEmail: req.user.email,
            userName: req.user.name || 'User',
            action: 'Blockchain Transaction',
            type: req.body.documentType || '------',
            status: 'Successful',
            details: `Submitted transaction to blockchain for Request: ${req.body.requestId || 'Unknown'}`
        });

        res.json(newTx);
    } catch (error) {
        res.status(500).json({ message: 'Error recording transaction' });
    }
});

// Admin: decide the current receipt without closing its document request.
router.put('/:id/verify', protect, registrarOrSuperAdmin, async (req, res) => {
  const { status } = req.body;
  const adminRemarks = typeof req.body.adminRemarks === 'string'
    ? req.body.adminRemarks.trim() : '';
  if (!['Completed', 'Needs Update', 'Rejected'].includes(status)) {
    return res.status(400).json({ message: 'Invalid verification decision.' });
  }
  if (adminRemarks.length > 500 || (status !== 'Completed' && !adminRemarks)) {
    return res.status(400).json({ message: 'A rejection reason of up to 500 characters is required.' });
  }

  const session = await mongoose.startSession();
  try {
    const now = new Date();
    const accepted = status === 'Completed';
    // Older clients still send Rejected for an invalid receipt. Store the
    // receipt decision separately from document-request rejection.
    const receiptStatus = accepted ? 'Completed' : 'Needs Update';
    let transaction;
    await session.withTransaction(async () => {
      transaction = await Transaction.findOneAndUpdate(
        { transactionId: req.params.id, status: 'Pending Verification' },
        { $set: {
          status: receiptStatus,
          adminRemarks: accepted ? '' : adminRemarks,
          rejectionReason: accepted ? '' : adminRemarks,
          verifiedBy: req.user.email || req.user.name || 'Admin',
          verifiedAt: now,
        } },
        { new: true, session },
      );
      if (!transaction) {
        const exists = await Transaction.exists({ transactionId: req.params.id }).session(session);
        throw Object.assign(new Error(exists ? 'This receipt has already been reviewed.' : 'Transaction not found.'),
          { httpStatus: exists ? 409 : 404 });
      }

      const requestStatus = accepted ? 'In Process' : 'Pending';
      const linkedRequest = accepted
        ? await Request.findOne({ requestId: transaction.requestId }).session(session)
        : null;
      const estimate = accepted && linkedRequest && !linkedRequest.processingStartedAt
        ? linkedRequest.estimatedProcessingEnd
          ? { processingStartedAt: now }
          : createProcessingEstimate(linkedRequest.documentType, now)
        : {};
      const updatedReq = await Request.findOneAndUpdate(
        { requestId: transaction.requestId, status: { $in: ['Pending for Payment', 'Pending'] } },
        { $set: {
          status: requestStatus,
          mobileStatus: accepted ? 'in_process' : 'pending',
          correctionType: accepted ? '' : 'receipt',
          remarks: accepted ? '' : adminRemarks,
          rejectionReason: '',
          ...estimate,
        }, $push: { statusHistory: {
          status: requestStatus, at: now,
          remarks: accepted ? 'Receipt approved.' : adminRemarks,
        } } },
        { new: true, session },
      );
      if (!updatedReq) {
        throw Object.assign(new Error('The linked request is no longer awaiting receipt verification.'),
          { httpStatus: 409 });
      }
      await Notification.create([{
        userId: updatedReq.userId || '',
        message: accepted
          ? `Your payment for request #${updatedReq.requestId} (${updatedReq.documentType}) has been confirmed. Your request is now In Process.`
          : `Receipt needs update for request #${updatedReq.requestId}. Reason: ${adminRemarks}. Please resubmit a clearer receipt.`,
        isRead: false,
        email: updatedReq.email || '',
      }], { session });
    });

    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'Admin',
      action: `Payment ${receiptStatus}`,
      type: transaction.documentType || '------',
      status: 'Successful',
      details: `${receiptStatus} receipt for Transaction: ${transaction.transactionId}. Remarks: ${adminRemarks || 'None'}`
    }).catch((error) => console.error('Could not log receipt decision:', error));

    res.json(transaction);
  } catch (error) {
    console.error('Verify error:', error);
    res.status(error.httpStatus || 500).json({ message: error.httpStatus
      ? error.message : 'Error verifying transaction' });
  } finally {
    await session.endSession();
  }
});

// Admin: Re-upload receipt
router.put('/:id/reupload', protect, upload.single('receiptImage'), async (req, res) => {
  let uploadResult;
  try {
    if (!req.file || !isSupportedImage(req.file.buffer)) {
      return res.status(400).json({ success: false, message: 'A valid PNG or JPEG receipt is required.' });
    }
    const transaction = await Transaction.findOne({
      transactionId: req.params.id,
      ...(isEndUser(req.user)
        ? ownerQuery(req.user, { emailField: 'payerEmail' })
        : {}),
    });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    if (!['Needs Update', 'Rejected'].includes(transaction.status)) {
      return res.status(409).json({
        success: false,
        message: 'A receipt can only be replaced after it has been rejected.',
      });
    }
    const linkedRequest = await Request.findOne({ requestId: transaction.requestId,
      ...(isEndUser(req.user) ? ownerQuery(req.user) : {}) });
    if (!linkedRequest || !['Needs Update', 'Pending'].includes(linkedRequest.status) ||
        (linkedRequest.correctionType && linkedRequest.correctionType !== 'receipt')) {
      return res.status(409).json({ success: false, message: 'This request is not awaiting a replacement receipt.' });
    }

    uploadResult = await uploadStream(req.file.buffer, 'receipts');
    const now = new Date();
    const session = await mongoose.startSession();
    let updated;
    try {
      await session.withTransaction(async () => {
        updated = await Transaction.findOneAndUpdate(
          { _id: transaction._id, status: transaction.status },
          { $set: {
            receiptImage: uploadResult.secure_url,
            imageUrl: uploadResult.secure_url,
            publicId: uploadResult.public_id,
            receiptImagePublicId: uploadResult.public_id,
            status: 'Pending Verification',
            adminRemarks: '', rejectionReason: '', verifiedAt: null, verifiedBy: '',
            lastSubmittedAt: now,
          }, $push: { receiptHistory: {
            receiptImage: transaction.receiptImage || transaction.imageUrl,
            publicId: transaction.publicId || transaction.receiptImagePublicId || '',
            submittedAt: transaction.lastSubmittedAt || transaction.updatedAt || transaction.date,
            status: transaction.status,
            remarks: transaction.rejectionReason || transaction.adminRemarks || '',
            replacedAt: now,
          } } },
          { new: true, session },
        );
        if (!updated) throw Object.assign(new Error('Receipt was already resubmitted.'), { httpStatus: 409 });
        const request = await Request.findOneAndUpdate(
          { _id: linkedRequest._id, status: linkedRequest.status,
            ...(linkedRequest.correctionType
              ? { correctionType: linkedRequest.correctionType }
              : { $or: [{ correctionType: '' }, { correctionType: { $exists: false } }] }) },
          { $set: { status: 'Pending', mobileStatus: 'pending', correctionType: '', remarks: '' },
            $push: { statusHistory: { status: 'Pending', at: now,
              remarks: 'Replacement receipt submitted for review.' } } },
          { new: true, session },
        );
        if (!request) throw Object.assign(new Error('Request was already updated.'), { httpStatus: 409 });
        await Notification.create([{ userId: request.userId || '',
          message: `Replacement receipt submitted for request #${request.requestId}`,
          isRead: false, email: request.email || '' }], { session });
      });
    } finally {
      await session.endSession();
    }
    res.json(updated);
  } catch (error) {
    if (uploadResult?.public_id) {
      await cloudinary.uploader.destroy(uploadResult.public_id, { type: 'authenticated' }).catch(() => {});
    }
    const unavailable = error?.code === 'MEDIA_STORAGE_UNAVAILABLE';
    res.status(error?.httpStatus || (unavailable ? 503 : 500)).json({
      success: false,
      message: error?.httpStatus ? error.message : unavailable
        ? 'Receipt storage is temporarily unavailable. Please try again later.'
        : 'Error re-uploading receipt',
    });
  }
});


// Mobile: Submit a refund request
router.post('/refund-request', protect, async (req, res) => {
  try {
    const { transactionId, requestId, studentName, studentEmail, amount, reason, otherReason } = req.body;

    if (!transactionId || !reason) {
      return res.status(400).json({ success: false, message: 'Transaction ID and reason are required' });
    }

    // Verify the transaction exists
    const transaction = await Transaction.findOne({
      transactionId,
      ...(isEndUser(req.user)
        ? ownerQuery(req.user, { emailField: 'payerEmail' })
        : {}),
    });
    if (!transaction) {
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    const linkedRequest = await Request.findOne({ requestId: transaction.requestId });
    if (transaction.status !== 'Completed' || linkedRequest?.status !== 'Rejected') {
      return res.status(409).json({
        success: false,
        message: 'Only a paid request that was later rejected is eligible for a refund.',
      });
    }

    // A decision is final for a payment. Rejected refund requests must be
    // corrected by staff rather than duplicated under a new identifier.
    const existingRefund = await Refund.findOne({ transactionId });
    if (existingRefund) {
      return res.status(409).json({
        success: false,
        message: 'A refund request already exists for this transaction',
      });
    }

    const refundId =
      `RFD-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const refundAmount = resolveTransactionAmount(
      transaction.toObject(),
      linkedRequest?.toObject() || {},
    );
    const refund = await Refund.create({
      userId: String(req.user.id || transaction.userId || ''),
      refundId,
      transactionId,
      requestId: requestId || transaction.requestId || '',
      studentName: transaction.payerName || transaction.name || req.user.name || 'User',
      studentEmail: transaction.payerEmail || req.user.email || '',
      amount: refundAmount.toFixed(2),
      reason,
      otherReason: reason === 'Other' ? (otherReason || '') : ''
    });

    // Notify registrar staff about the refund request
    const Notification = require('../models/Notification');
    await Notification.create({
      userId: '',
      email: '',
      message: `New refund request (${refundId}) from ${refund.studentName} for ₱${refund.amount} — Reason: ${reason === 'Other' ? otherReason : reason}`,
      isRead: false
    });

    res.status(201).json({ success: true, message: 'Refund request submitted', refund });
  } catch (error) {
    console.error('Refund request error:', error);
    res.status(500).json({ success: false, message: 'Error submitting refund request' });
  }
});
// Admin: Process (approve/reject) a refund request
router.put('/refunds/:id/process', protect, registrarOrSuperAdmin, async (req, res) => {
  try {
    const { status, adminRemarks } = req.body;
    if (!['Approved', 'Rejected', 'Pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Must be Approved, Rejected, or Pending.' });
    }

    const mongoose = require('mongoose');
    let query = { refundId: req.params.id };
    if (mongoose.Types.ObjectId.isValid(req.params.id)) {
      query = { $or: [{ refundId: req.params.id }, { _id: req.params.id }] };
    }

    const permittedPreviousStatuses = status === 'Pending'
      ? ['Rejected', 'rejected']
      : ['Pending', 'pending'];
    const refund = await Refund.findOneAndUpdate(
      { $and: [query, { status: { $in: permittedPreviousStatuses } }] },
      {
        status,
        adminRemarks: adminRemarks || '',
        processedBy: req.user.email || req.user.name || 'Admin',
        processedAt: new Date()
      },
      { new: true }
    );

    if (!refund) {
      const exists = await Refund.exists(query);
      return res.status(exists ? 409 : 404).json({
        message: exists
          ? 'This refund has already been processed and cannot make that transition.'
          : 'Refund request not found',
      });
    }

    // Keep the approved receipt decision separate from the refund decision.
    if (status === 'Approved') {
      await Transaction.findOneAndUpdate(
        { transactionId: refund.transactionId },
        { refundStatus: 'Approved' }
      );
      if (refund.requestId || refund.transactionId) {
        await Request.findOneAndUpdate(
          {
            $or: [
              ...(refund.requestId ? [{ requestId: refund.requestId }] : []),
              ...(refund.transactionId ? [{ transactionId: refund.transactionId }] : []),
            ],
          },
          {
            refundStatus: 'Approved',
          }
        );
      }
    } else if (status === 'Pending') {
      await Transaction.findOneAndUpdate(
        { transactionId: refund.transactionId },
        { status: 'Completed', adminRemarks: `Refund reverted to pending. ${adminRemarks || ''}`.trim() }
      );
    }

    // Notify the student
    const Notification = require('../models/Notification');
    const statusMessage = status === 'Approved'
      ? `Your refund request for ₱${refund.amount} has been approved!`
      : status === 'Rejected'
        ? `Your refund request was rejected. ${adminRemarks ? 'Reason: ' + adminRemarks : ''}`
        : 'Your refund request was reopened for staff review.';

    await Notification.create({
      message: statusMessage,
      isRead: false,
      email: refund.email || refund.studentEmail || ''
    });

    // Log the activity
    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'Admin',
      action: `Refund ${status}`,
      type: 'Refund',
      status: 'Successful',
      details: `${status} refund ${refund.refundId} for transaction ${refund.transactionId}. Amount: ₱${refund.amount}. Remarks: ${adminRemarks || 'None'}`
    });

    res.json({ success: true, refund });
  } catch (error) {
    console.error('Process refund error:', error);
    res.status(500).json({ message: 'Error processing refund request' });
  }
});

module.exports = router;
