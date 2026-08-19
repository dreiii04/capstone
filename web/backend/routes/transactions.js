const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const Transaction = require('../models/Transaction');
const Request = require('../models/Request');
const ActivityLog = require('../models/ActivityLog');
const { protect, registrarOrSuperAdmin } = require('../middleware/authMiddleware');
const { isEndUser } = require('../services/sessionService');
const { uploadStream } = require('../utils/cloudinary');
const { isSupportedImage } = require('../utils/imageValidation');
const { ownerQuery } = require('../utils/ownership');
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
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Get all transactions
router.get('/', protect, async (req, res) => {
  try {
    const query = isEndUser(req.user)
      ? ownerQuery(req.user, { emailField: 'payerEmail' })
      : {};
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '100', 10) || 100, 1), 200);
    const transactions = await Transaction.find(query).sort({ date: -1 }).limit(limit);
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

    const uploadResult = await uploadStream(req.file.buffer, 'receipts');
    const receiptImage = uploadResult.secure_url;

    const newTx = await Transaction.create({
      userId: String(req.user.id || ''),
      transactionId,
      requestId: requestId || 'N/A',
      name: linkedRequest.name || req.user.name || 'User',
      documentType: linkedRequest.documentType || documentType || 'General',
      paymentMode: paymentMode || 'GCash',
      amount: totalAmount.toFixed(2),
      receiptImage,
      payerName: linkedRequest.name || req.user.name || 'User',
      payerEmail: String(req.user.email || '').trim().toLowerCase(),
      payerType: String(req.user.role || '').toLowerCase() === 'alumni' ? 'Alumni' : 'Student',
      status: 'Pending Verification'
    });

    res.status(201).json(newTx);
  } catch (error) {
    console.error('Receipt upload error:', error);
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

// Admin: Verify / Approve / Request Update on a receipt
router.put('/:id/verify', protect, registrarOrSuperAdmin, async (req, res) => {
  try {
    const { status, adminRemarks } = req.body;
    const allowedStatuses = ['Completed', 'Needs Update', 'Rejected', 'Pending Verification', 'Refunded'];
    if (!allowedStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status. Allowed: Completed, Needs Update, Rejected, Pending Verification, Refunded' });
    }

    const transaction = await Transaction.findOneAndUpdate(
      { transactionId: req.params.id },
      {
        status,
        adminRemarks: adminRemarks || '',
        verifiedBy: req.user.email || req.user.name || 'Admin',
        verifiedAt: new Date()
      },
      { new: true }
    );

    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });

    const Notification = require('../models/Notification');

    // Sync to Request Collection
    if (status === 'Completed') {
      const updatedReq = await Request.findOneAndUpdate(
        { requestId: transaction.requestId },
        { status: 'In Process' },
        { new: true }
      );
      
      if (updatedReq) {
        await Notification.create({
          userId: updatedReq.userId || '',
          message: `Your request #${updatedReq.requestId} for ${updatedReq.documentType} is now In Process!`,
          isRead: false,
          email: updatedReq.email || ''
        });
      }
    }

    // Bug 2 fix: Cascade payment rejection to linked Request
    if (status === 'Rejected') {
      const updatedReq = await Request.findOneAndUpdate(
        { requestId: transaction.requestId, status: 'Pending' },
        { status: 'Rejected', rejectionReason: 'Payment Issue' },
        { new: true }
      );

      if (updatedReq) {
        await Notification.create({
          userId: updatedReq.userId || '',
          message: `Your request #${updatedReq.requestId} for ${updatedReq.documentType} was rejected. Reason: Payment Issue`,
          isRead: false,
          email: updatedReq.email || ''
        });
      }
    }

    // Log the verification activity
    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'Admin',
      action: `Payment ${status}`,
      type: transaction.documentType || '------',
      status: 'Successful',
      details: `${status} receipt for Transaction: ${transaction.transactionId}. Remarks: ${adminRemarks || 'None'}`
    });

    res.json(transaction);
  } catch (error) {
    console.error('Verify error:', error);
    res.status(500).json({ message: 'Error verifying transaction' });
  }
});

// Admin: Re-upload receipt
router.put('/:id/reupload', protect, upload.single('receiptImage'), async (req, res) => {
  try {
    if (!req.file || !isSupportedImage(req.file.buffer)) {
      return res.status(400).json({ success: false, message: 'A valid PNG or JPEG receipt is required.' });
    }
    const updateData = { status: 'Pending Verification', adminRemarks: '' };
    if (req.file) {
      const uploadResult = await uploadStream(req.file.buffer, 'receipts');
      updateData.receiptImage = uploadResult.secure_url;
    }

    const transaction = await Transaction.findOneAndUpdate(
      {
        transactionId: req.params.id,
        ...(isEndUser(req.user)
          ? ownerQuery(req.user, { emailField: 'payerEmail' })
          : {}),
      },
      updateData,
      { new: true }
    );

    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    res.json(transaction);
  } catch (error) {
    res.status(500).json({ message: 'Error re-uploading receipt' });
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

    // Prevent duplicate refund requests for the same transaction
    const existingRefund = await Refund.findOne({ transactionId, status: 'Pending' });
    if (existingRefund) {
      return res.status(400).json({ success: false, message: 'A pending refund request already exists for this transaction' });
    }

    const count = await Refund.countDocuments();
    const refundId = `RFD-${Date.now().toString(36).toUpperCase()}-${(count + 1).toString().padStart(4, '0')}`;

    const linkedRequest = await Request.findOne({ requestId: transaction.requestId });
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
      userId: refund.userId || '',
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

    const refund = await Refund.findOneAndUpdate(
      query,
      {
        status,
        adminRemarks: adminRemarks || '',
        processedBy: req.user.email || req.user.name || 'Admin',
        processedAt: new Date()
      },
      { new: true }
    );

    if (!refund) return res.status(404).json({ message: 'Refund request not found' });

    // If approved, mark the original transaction as Refunded
    if (status === 'Approved') {
      await Transaction.findOneAndUpdate(
        { transactionId: refund.transactionId },
        { status: 'Refunded', adminRemarks: `Refund approved (${refund.refundId || refund._id}). ${adminRemarks || ''}`.trim() }
      );
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
      : `Your refund request was rejected. ${adminRemarks ? 'Reason: ' + adminRemarks : ''}`;

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
