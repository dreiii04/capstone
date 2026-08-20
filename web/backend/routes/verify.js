const express = require('express');

const Request = require('../models/Request');
const TOR = require('../models/TOR');
const Diploma = require('../models/Diploma');
const Document = require('../models/Document');
const BlockchainTransaction = require('../blockchain_essentials/modelBC/blockchainTransactionModel');
const blockchainService = require('../services/blockchainService');

const router = express.Router();

function isBlockchainDocument(value) {
  const type = String(value || '').toLowerCase();
  return type.includes('transcript') || type.includes('tor') ||
    type.includes('diploma');
}

async function buildVerifiedPayload(record) {
  const blockchainRequired = isBlockchainDocument(record.documentType);
  let ledgerRecord = null;
  let storedTransaction = null;

  if (blockchainRequired) {
    ledgerRecord = await blockchainService.verifyDocumentHash(record.documentHash);
    if (ledgerRecord?.error || ledgerRecord?.status === 'LEDGER UNAVAILABLE') {
      const error = new Error('Live blockchain verification is unavailable.');
      error.code = 'LEDGER_UNAVAILABLE';
      throw error;
    }
    if (!ledgerRecord?.isVerified ||
        (ledgerRecord.documentId && ledgerRecord.documentId !== record.requestId)) {
      return null;
    }
    storedTransaction = await BlockchainTransaction.findOne({
      requestId: record.requestId,
      documentHash: record.documentHash,
      blockchainStatus: 'Recorded',
    }).sort({ createdAt: -1 });
  }

  return {
    requestId: record.requestId,
    ownerName: record.ownerName,
    ownerType: storedTransaction?.ownerType || record.ownerType || 'Student',
    status: record.status,
    documentType: record.documentType,
    issuedDate: record.issuedDate,
    verificationMethod: blockchainRequired ? 'blockchain' : 'database',
    blockchainRecord: blockchainRequired ? {
      txID: storedTransaction?.referenceNumber || record.blockchainTxHash || '',
      txHash: storedTransaction?.blockchainTxHash || record.blockchainTxHash || '',
      blockNumber: storedTransaction?.blockchainBlockNumber ||
        record.blockchainBlockNumber || ledgerRecord.blockNumber || null,
      date: storedTransaction?.updatedAt || record.issuedDate,
      status: ledgerRecord.status || 'Secured on Live Ledger',
      contractAddress: ledgerRecord.contractAddress || '',
      idNumber: storedTransaction?.studentIDNumber || record.studentId || '',
      yearGraduated: storedTransaction?.yearGraduated || '',
      course: storedTransaction?.course || record.course || '',
      yearLevel: storedTransaction?.yearLevel || record.yearLevel || '',
    } : null,
  };
}

router.get('/:identifier', async (req, res) => {
  try {
    const identifier = String(req.params.identifier || '').trim();
    if (!identifier || identifier.length > 200) {
      return res.status(400).json({
        success: false,
        message: 'A valid verification code is required.',
      });
    }

    const request = await Request.findOne({
      status: 'Released',
      hasDocument: true,
      $or: [
        { documentHash: identifier },
        { verificationCode: identifier },
      ],
    });
    if (request) {
      if (isBlockchainDocument(request.documentType) &&
          request.blockchainStatus !== 'Recorded') {
        return res.status(404).json({
          success: false,
          message: 'This document does not have a confirmed ledger record.',
        });
      }
      const data = await buildVerifiedPayload({
        requestId: request.requestId,
        ownerName: request.name,
        status: request.status,
        documentType: request.documentType,
        issuedDate: request.updatedAt,
        documentHash: request.documentHash,
        blockchainTxHash: request.blockchainTxHash,
        blockchainBlockNumber: request.blockchainBlockNumber,
        studentId: request.studentId,
        course: request.course,
        yearLevel: request.yearLevel,
      });
      if (data) return res.json({ success: true, data });
    }

    const tor = await TOR.findOne({
      torId: identifier,
      status: 'Released',
      documentHash: { $exists: true, $ne: '' },
    });
    if (tor) {
      const data = await buildVerifiedPayload({
        requestId: tor.torId,
        ownerName: tor.studentName,
        status: 'Released',
        documentType: 'Transcript of Records',
        issuedDate: tor.updatedAt,
        documentHash: tor.documentHash,
        blockchainTxHash: tor.blockchainTxHash,
        blockchainBlockNumber: tor.blockchainBlockNumber,
        studentId: tor.studentId,
        course: tor.course,
        yearLevel: tor.yearLevel,
      });
      if (data) return res.json({ success: true, data });
    }

    const diploma = await Diploma.findOne({
      diplomaId: identifier,
      status: 'Released',
      documentHash: { $exists: true, $ne: '' },
    });
    if (diploma) {
      const data = await buildVerifiedPayload({
        requestId: diploma.diplomaId,
        ownerName: diploma.studentName,
        status: 'Released',
        documentType: 'Diploma',
        issuedDate: diploma.updatedAt,
        documentHash: diploma.documentHash,
        blockchainTxHash: diploma.blockchainTxHash,
        blockchainBlockNumber: diploma.blockchainBlockNumber,
        studentId: diploma.studentId,
        course: diploma.course,
      });
      if (data) return res.json({ success: true, data });
    }

    const document = await Document.findOne({
      documentHash: identifier,
      status: { $in: ['Finalized', 'Released'] },
    });
    if (document) {
      const data = await buildVerifiedPayload({
        requestId: document.documentId,
        ownerName: document.studentName,
        status: document.status === 'Finalized' ? 'Released' : document.status,
        documentType: document.documentType,
        issuedDate: document.updatedAt,
        documentHash: document.documentHash,
        studentId: document.studentId,
        course: document.course,
        yearLevel: document.yearLevel,
      });
      if (data) return res.json({ success: true, data });
    }

    return res.status(404).json({
      success: false,
      message: 'The document is not released or its integrity proof is invalid.',
    });
  } catch (error) {
    if (error?.code === 'LEDGER_UNAVAILABLE') {
      return res.status(503).json({
        success: false,
        indeterminate: true,
        message: 'Live blockchain verification is temporarily unavailable.',
      });
    }
    console.error('Verification error:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Server error during verification',
    });
  }
});

module.exports = router;
