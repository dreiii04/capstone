const express = require('express');
const router = express.Router();
const Request = require('../models/Request');
const Transaction = require('../models/Transaction');
const BlockchainTransaction = require('../blockchain_essentials/modelBC/blockchainTransactionModel');
const TOR = require('../models/TOR');
const Diploma = require('../models/Diploma');
const Document = require('../models/Document');
const Student = require('../models/Users/Student');

// @route   GET /api/verify/:hash
// @desc    Verify a document by its hash
router.get('/:hash', async (req, res) => {
    try {
        const hash = req.params.hash;

        // 1. Try to find in Request
        const request = await Request.findOne({ 
            $or: [
                { documentHash: hash },
                { requestId: hash }
            ]
        });
        
        if (request) {
            // Check for blockchain record
            const blockchainTx = await BlockchainTransaction.findOne({ 
                $or: [
                    { studentIDNumber: request.studentId },
                    { 
                        nameOfStudent: request.name,
                        typeOfDocument: request.documentType || request.document_type || 'Document'
                    }
                ]
            }).sort({ createdAt: -1 });

            let ownerType = 'Student';
            if (request.studentId) {
                const student = await Student.findOne({ studentId: request.studentId });
                if (student && student.role === 'alumni') ownerType = 'Alumni';
            }

            return res.json({
                success: true,
                data: {
                    requestId: request.requestId,
                    ownerName: request.name,
                    ownerType: ownerType,
                    status: request.status,
                    documentType: request.documentType || 'Document',
                    issuedDate: request.updatedAt,
                    blockchainRecord: blockchainTx ? {
                        txID: blockchainTx.referenceNumber,
                        date: blockchainTx.createdAt,
                        status: blockchainTx.blockchainStatus,
                        txHash: blockchainTx.blockchainTxHash,
                        blockNumber: blockchainTx.blockchainBlockNumber,
                        idNumber: blockchainTx.studentIDNumber,
                        yearGraduated: blockchainTx.yearGraduated,
                        ownerType: blockchainTx.ownerType,
                        course: blockchainTx.course,
                        yearLevel: blockchainTx.yearLevel
                    } : null
                }
            });
        }

        // 2. Try to find in TOR
        const tor = await TOR.findOne({ torId: hash });
        if (tor) {
            const blockchainTx = await BlockchainTransaction.findOne({ 
                $or: [
                    { studentIDNumber: tor.studentId },
                    { 
                        nameOfStudent: tor.studentName,
                        typeOfDocument: 'Transcript of Records'
                    }
                ]
            }).sort({ createdAt: -1 });

            let ownerType = 'Student';
            if (tor.studentId) {
                const student = await Student.findOne({ studentId: tor.studentId });
                if (student && student.role === 'alumni') ownerType = 'Alumni';
            }

            return res.json({
                success: true,
                data: {
                    requestId: tor.torId,
                    ownerName: tor.studentName,
                    ownerType: ownerType,
                    status: tor.status === 'Finalized' ? 'Released' : tor.status,
                    documentType: 'Transcript of Records',
                    issuedDate: tor.updatedAt,
                    blockchainRecord: blockchainTx ? {
                        txID: blockchainTx.referenceNumber,
                        date: blockchainTx.createdAt,
                        status: blockchainTx.blockchainStatus,
                        txHash: blockchainTx.blockchainTxHash,
                        blockNumber: blockchainTx.blockchainBlockNumber,
                        idNumber: blockchainTx.studentIDNumber,
                        yearGraduated: blockchainTx.yearGraduated,
                        ownerType: blockchainTx.ownerType,
                        course: blockchainTx.course,
                        yearLevel: blockchainTx.yearLevel
                    } : null
                }
            });
        }

        // 3. Try to find in Diploma
        const diploma = await Diploma.findOne({ diplomaId: hash });
        if (diploma) {
            const blockchainTx = await BlockchainTransaction.findOne({ 
                $or: [
                    { studentIDNumber: diploma.studentId },
                    { 
                        nameOfStudent: diploma.studentName,
                        typeOfDocument: 'Diploma'
                    }
                ]
            }).sort({ createdAt: -1 });

            let ownerType = 'Student';
            if (diploma.studentId) {
                const student = await Student.findOne({ studentId: diploma.studentId });
                if (student && student.role === 'alumni') ownerType = 'Alumni';
            }

            return res.json({
                success: true,
                data: {
                    requestId: diploma.diplomaId,
                    ownerName: diploma.studentName,
                    ownerType: ownerType,
                    status: diploma.status === 'Finalized' ? 'Released' : diploma.status,
                    documentType: 'Diploma',
                    issuedDate: diploma.updatedAt,
                    blockchainRecord: blockchainTx ? {
                        txID: blockchainTx.referenceNumber,
                        date: blockchainTx.createdAt,
                        status: blockchainTx.blockchainStatus,
                        txHash: blockchainTx.blockchainTxHash,
                        blockNumber: blockchainTx.blockchainBlockNumber,
                        idNumber: blockchainTx.studentIDNumber,
                        yearGraduated: blockchainTx.yearGraduated,
                        ownerType: blockchainTx.ownerType,
                        course: blockchainTx.course,
                        yearLevel: blockchainTx.yearLevel
                    } : null
                }
            });
        }

        // 4. Try to find in Document (generic/fallback)
        const doc = await Document.findOne({
            $or: [
                { documentId: hash },
                { documentHash: hash }
            ]
        });
        if (doc) {
            const blockchainTx = await BlockchainTransaction.findOne({ 
                $or: [
                    { studentIDNumber: doc.studentId },
                    { 
                        nameOfStudent: doc.studentName,
                        typeOfDocument: doc.documentType
                    }
                ]
            }).sort({ createdAt: -1 });

            let ownerType = 'Student';
            if (doc.studentId) {
                const student = await Student.findOne({ studentId: doc.studentId });
                if (student && student.role === 'alumni') ownerType = 'Alumni';
            }

            return res.json({
                success: true,
                data: {
                    requestId: doc.documentId,
                    ownerName: doc.studentName,
                    ownerType: ownerType,
                    status: doc.status === 'Finalized' ? 'Released' : doc.status,
                    documentType: doc.documentType,
                    issuedDate: doc.updatedAt,
                    blockchainRecord: blockchainTx ? {
                        txID: blockchainTx.referenceNumber,
                        date: blockchainTx.createdAt,
                        status: blockchainTx.blockchainStatus,
                        txHash: blockchainTx.blockchainTxHash,
                        blockNumber: blockchainTx.blockchainBlockNumber,
                        idNumber: blockchainTx.studentIDNumber,
                        yearGraduated: blockchainTx.yearGraduated,
                        ownerType: blockchainTx.ownerType,
                        course: blockchainTx.course,
                        yearLevel: blockchainTx.yearLevel
                    } : null
                }
            });
        }

        // If none found
        return res.status(404).json({ 
            success: false, 
            message: 'Invalid Document Hash. This document was not issued by our system.' 
        });
    } catch (error) {
        console.error('Verification error:', error);
        res.status(500).json({ success: false, message: 'Server error during verification' });
    }
});

module.exports = router;

