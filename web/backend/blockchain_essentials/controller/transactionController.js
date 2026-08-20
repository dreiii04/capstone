const crypto = require('crypto');
const mongoose = require('mongoose');

const BlockchainTransaction = require('../modelBC/blockchainTransactionModel');
const Request = require('../../models/Request');
const Notification = require('../../models/Notification');
const ActivityLog = require('../../models/ActivityLog');
const blockchainService = require('../../services/blockchainService');
const { findUserById } = require('../../services/sessionService');

const createReferenceNumber = () =>
  `TXN-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const getUserIdentifier = (reqUser) =>
  reqUser?.id || reqUser?._id || reqUser?.userId || null;

const isBlockchainDocument = (value) => {
  const type = String(value || '').toLowerCase();
  return type.includes('transcript') || type.includes('tor') ||
    type.includes('diploma');
};

async function respondWithVerification(transaction, res) {
  if (transaction.blockchainStatus !== 'Recorded' || !transaction.documentHash) {
    return res.status(409).json({
      verified: false,
      message: 'This document does not have a confirmed blockchain record.',
    });
  }

  const ledgerRecord = await blockchainService.verifyDocumentHash(
    transaction.documentHash,
  );
  if (ledgerRecord?.error || ledgerRecord?.status === 'LEDGER UNAVAILABLE') {
    return res.status(503).json({
      verified: false,
      message: 'Live blockchain verification is temporarily unavailable.',
    });
  }

  const requestMatches = !ledgerRecord.documentId ||
    ledgerRecord.documentId === transaction.requestId;
  const verified = Boolean(ledgerRecord.isVerified && requestMatches);
  return res.status(verified ? 200 : 404).json({
    databaseRecord: transaction,
    blockchainRecord: {
      ...ledgerRecord,
      referenceNumber: transaction.referenceNumber,
      typeOfDocument: transaction.typeOfDocument,
      nameOfStudent: transaction.nameOfStudent,
      studentIDNumber: transaction.studentIDNumber,
      nameOfSchool: transaction.nameOfSchool,
      yearGraduated: String(transaction.yearGraduated),
      ownerType: transaction.ownerType,
      course: transaction.course,
      yearLevel: transaction.yearLevel,
      exists: verified,
    },
    verified,
    message: verified
      ? 'Document hash confirmed on the live ledger.'
      : 'The stored document hash was not found on the live ledger.',
  });
}

const TransactionController = {
  createTransaction: async (req, res) => {
    try {
      const userId = getUserIdentifier(req.user);
      if (!userId || !mongoose.isValidObjectId(userId)) {
        return res.status(401).json({ message: 'User session is invalid' });
      }

      const requestId = String(req.body?.requestId || '').trim();
      if (!requestId || requestId.length > 150) {
        return res.status(400).json({
          message: 'A valid issued request ID is required.',
        });
      }

      const request = await Request.findOne({ requestId }).select('+documentFile');
      if (!request) return res.status(404).json({ message: 'Request not found.' });
      if (!isBlockchainDocument(request.documentType)) {
        return res.status(409).json({
          message: 'This document type is not eligible for blockchain issuance.',
        });
      }
      if (!request.hasDocument || !request.documentFile || !request.documentHash) {
        return res.status(409).json({
          message: 'Attach the final PDF before recording it on the blockchain.',
        });
      }

      const existing = await BlockchainTransaction.findOne({
        requestId,
        documentHash: request.documentHash,
        blockchainStatus: 'Recorded',
      }).sort({ createdAt: -1 });
      if (existing) {
        if (request.status === 'In Process') {
          request.status = 'Released';
          request.blockchainStatus = 'Recorded';
          request.blockchainTxHash = existing.blockchainTxHash;
          request.blockchainBlockNumber = existing.blockchainBlockNumber;
          await request.save();
        } else if (request.status !== 'Released') {
          return res.status(409).json({
            message: 'The blockchain record exists, but this request is not releasable.',
          });
        }
        return res.status(200).json({
          message: 'Document was already recorded successfully.',
          transaction: existing,
        });
      }

      if (request.status !== 'In Process') {
        return res.status(409).json({
          message: 'Only an in-process request can be issued.',
        });
      }

      const owner = mongoose.isValidObjectId(request.userId)
        ? await findUserById(request.userId)
        : null;
      const studentIDNumber = String(
        request.studentId || owner?.studentId || '',
      ).trim();
      if (!studentIDNumber) {
        return res.status(409).json({
          message: 'The request is missing its official student identifier.',
        });
      }

      const ownerType = String(owner?.role || '').toLowerCase() === 'alumni'
        ? 'Alumni'
        : 'Student';
      const yearGraduated = Number.parseInt(
        owner?.yearGraduated || owner?.lastYearAttended || '0',
        10,
      ) || 0;
      const transaction = await BlockchainTransaction.create({
        user: new mongoose.Types.ObjectId(userId),
        requestId,
        documentHash: request.documentHash,
        referenceNumber: createReferenceNumber(),
        typeOfDocument: request.documentType,
        nameOfStudent: request.name,
        studentIDNumber,
        nameOfSchool: String(
          process.env.INSTITUTION_NAME || 'VeriFitor University',
        ).trim(),
        yearGraduated,
        ownerType,
        course: request.course || owner?.course || owner?.program || '',
        yearLevel: request.yearLevel || owner?.yearLevel || '',
        blockchainTxHash: '',
        blockchainBlockNumber: null,
        blockchainStatus: 'Pending',
        createdByEmail: req.user.email,
      });

      try {
        const blockchainResult = await blockchainService.anchorDocumentHash(
          requestId,
          studentIDNumber,
          request.name,
          request.documentHash,
        );
        if (!blockchainResult?.success) {
          throw new Error('Blockchain transaction was not confirmed.');
        }

        transaction.blockchainTxHash = blockchainResult.txID;
        transaction.blockchainBlockNumber = blockchainResult.blockNumber;
        transaction.blockchainStatus = 'Recorded';
        await transaction.save();

        const releasedRequest = await Request.findOneAndUpdate(
          {
            _id: request._id,
            requestId,
            status: 'In Process',
            documentHash: request.documentHash,
          },
          {
            $set: {
              status: 'Released',
              blockchainStatus: 'Recorded',
              blockchainTxHash: blockchainResult.txID,
              blockchainBlockNumber: blockchainResult.blockNumber,
            },
          },
          { new: true },
        );
        if (!releasedRequest) {
          return res.status(409).json({
            success: false,
            message: 'The hash was recorded, but the request state changed before release. Retry to reconcile it.',
            referenceNumber: transaction.referenceNumber,
          });
        }

        await Promise.allSettled([
          Notification.create({
            userId: releasedRequest.userId || '',
            email: releasedRequest.email || '',
            message: `Your request #${requestId} was securely recorded and released.`,
            isRead: false,
          }),
          ActivityLog.create({
            userEmail: req.user.email,
            userName: req.user.name || 'Staff',
            action: 'Blockchain Issuance',
            type: request.documentType,
            status: 'Successful',
            details: `Recorded final document hash for request ${requestId}.`,
          }),
        ]);

        return res.status(201).json({
          message: 'Document recorded and request released successfully',
          transaction,
        });
      } catch (blockchainError) {
        console.error('Blockchain recording failed:', blockchainError.message);
        transaction.blockchainStatus = 'Failed';
        await transaction.save();
        await Request.updateOne(
          { _id: request._id, documentHash: request.documentHash },
          { $set: { blockchainStatus: 'Failed' } },
        );
        return res.status(502).json({
          message: 'Blockchain recording failed; the request was not released',
          success: false,
          referenceNumber: transaction.referenceNumber,
        });
      }
    } catch (error) {
      console.error('Transaction creation failed:', error.message);
      return res.status(500).json({ message: 'Transaction creation failed' });
    }
  },

  getMyTransactions: async (req, res) => {
    try {
      const userId = getUserIdentifier(req.user);
      if (!userId) return res.status(401).json({ message: 'User session is invalid' });
      if (!mongoose.isValidObjectId(userId)) return res.json([]);
      const transactions = await BlockchainTransaction.find({
        user: new mongoose.Types.ObjectId(userId),
      }).sort({ createdAt: -1 });
      return res.json(transactions);
    } catch (_error) {
      return res.status(500).json({ message: 'Failed to fetch transactions' });
    }
  },

  verifyTransaction: async (req, res) => {
    try {
      const transaction = await BlockchainTransaction.findOne({
        referenceNumber: req.params.referenceNumber,
      });
      if (!transaction) {
        return res.status(404).json({
          verified: false,
          message: 'No transaction found in database',
        });
      }
      return await respondWithVerification(transaction, res);
    } catch (_error) {
      return res.status(500).json({
        verified: false,
        message: 'Verification failed',
      });
    }
  },

  verifyTransactionByStudentID: async (req, res) => {
    try {
      const studentIDNumber = String(req.params.studentIDNumber || '').trim();
      if (!studentIDNumber) {
        return res.status(400).json({
          verified: false,
          message: 'Student ID number is required',
        });
      }
      const normalizedStudentId = escapeRegex(studentIDNumber);
      const transaction = await BlockchainTransaction.findOne({
        blockchainStatus: 'Recorded',
        $or: [
          { studentIDNumber },
          { studentIDNumber: new RegExp(`^${normalizedStudentId}$`, 'i') },
          { studentSONumber: studentIDNumber },
          { studentSONumber: new RegExp(`^${normalizedStudentId}$`, 'i') },
        ],
      }).sort({ createdAt: -1 });
      if (!transaction) {
        return res.status(404).json({
          verified: false,
          message: 'No confirmed transaction found for this student ID number',
        });
      }
      return await respondWithVerification(transaction, res);
    } catch (_error) {
      return res.status(500).json({
        verified: false,
        message: 'Verification failed',
      });
    }
  },
};

module.exports = TransactionController;
