const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const Document = require('../models/Document');
const ActivityLog = require('../models/ActivityLog');
const Request = require('../models/Request');
const blockchainService = require('../services/blockchainService');
const { protect, superAdminOnly, registrarOrSuperAdmin } = require('../middleware/authMiddleware');
const {
  decodePdf,
  encodePdf,
  storedPdfMarker,
} = require('../utils/storedPdf');

// Configure multer for memory storage
const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'application/pdf') {
      cb(null, true);
    } else {
      cb(new Error('Only PDF files are allowed'), false);
    }
  },
  limits: { fileSize: 4 * 1024 * 1024 }
});

// @route   GET /api/documents
// @desc    Get all documents (with optional category filter)
router.get('/', protect, registrarOrSuperAdmin, async (req, res) => {
  try {
    const filter = {};
    if (req.query.category && req.query.category !== 'All') {
      filter.category = req.query.category;
    }
    const documents = await Document.find(filter).sort({ createdAt: 1 });
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ message: 'Error fetching documents' });
  }
});

// @route   GET /api/documents/:id
// @desc    Get a single document by documentId
router.get('/:id', protect, registrarOrSuperAdmin, async (req, res) => {
  try {
    const doc = await Document.findOne({ documentId: req.params.id });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    res.json(doc);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching document' });
  }
});

// @route   POST /api/documents
// @desc    Create a new document record (with optional PDF upload)
router.post('/', protect, registrarOrSuperAdmin, upload.single('pdfFile'), async (req, res) => {
  try {
    const { category, documentType, studentName, studentId, course, yearLevel, purpose, linkedRequestId, notes } = req.body;

    if (!category || !documentType || !studentName || !studentId) {
      return res.status(400).json({ message: 'Category, document type, student name, and student ID are required' });
    }

    const documentId = 'DOC-' + Date.now();
    if (req.file && req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      return res.status(400).json({ message: 'Uploaded file is not a valid PDF.' });
    }
    const pdfPath = req.file
      ? storedPdfMarker(req.file.originalname || `${documentId}.pdf`)
      : '';
    const pdfData = req.file ? encodePdf(req.file.buffer) : '';

    const newDoc = await Document.create({
      documentId,
      category,
      documentType,
      studentName,
      studentId,
      course: course || '',
      yearLevel: yearLevel || '',
      purpose: purpose || '',
      linkedRequestId: linkedRequestId || '',
      status: 'Draft',
      pdfPath,
      pdfData,
      notes: notes || '',
      generatedBy: req.user.name || req.user.email || ''
    });

    // Log activity
    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'User',
      action: 'Create Document',
      type: documentType,
      status: 'Successful',
      details: `Created ${documentType} for ${studentName} (${studentId})`
    });

    res.status(201).json(newDoc);
  } catch (error) {
    console.error('Error creating document:', error);
    res.status(500).json({ message: 'Error creating document' });
  }
});

// @route   PUT /api/documents/:id
// @desc    Update a document (status, details, upload PDF)
router.put('/:id', protect, registrarOrSuperAdmin, upload.single('pdfFile'), async (req, res) => {
  try {
    const doc = await Document.findOne({ documentId: req.params.id });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (doc.status !== 'Draft') {
      return res.status(409).json({
        message: 'Finalized documents are immutable. Create a new issuance instead.',
      });
    }

    const { notes, studentName, studentId, course, yearLevel, purpose } = req.body;

    if (notes !== undefined) doc.notes = notes;
    if (studentName) doc.studentName = studentName;
    if (studentId) doc.studentId = studentId;
    if (course !== undefined) doc.course = course;
    if (yearLevel !== undefined) doc.yearLevel = yearLevel;
    if (purpose !== undefined) doc.purpose = purpose;
    if (req.file) {
      if (req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
        return res.status(400).json({ message: 'Uploaded file is not a valid PDF.' });
      }
      doc.pdfPath = storedPdfMarker(
        req.file.originalname || `${doc.documentId}.pdf`,
      );
      doc.pdfData = encodePdf(req.file.buffer);
    }

    await doc.save();

    // Log activity
    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'User',
      action: 'Update Document',
      type: doc.documentType,
      status: 'Successful',
      details: `Updated ${doc.documentType} (${doc.documentId}) - Status: ${doc.status}`
    });

    res.json(doc);
  } catch (error) {
    console.error('Error updating document:', error);
    res.status(500).json({ message: 'Error updating document' });
  }
});

// @route   POST /api/documents/:id/finalize
// @desc    Finalize a document (Document Management only — no hash/blockchain)
router.post('/:id/finalize', protect, registrarOrSuperAdmin, (_req, res) => {
  return res.status(410).json({
    message: 'Use secure issuance so the final PDF is hashed before finalization.',
  });
});

// @route   POST /api/documents/:id/generate-hash
// @desc    Generate SHA-256 hash for a document
router.post('/:id/generate-hash', protect, registrarOrSuperAdmin, async (req, res) => {
  try {
    const doc = await Document.findOne({ documentId: req.params.id })
      .select('+pdfData');
    if (!doc) return res.status(404).json({ message: 'Document not found' });

    const pdfBuffer = decodePdf(doc.pdfData) || decodePdf(doc.pdfPath);
    if (!pdfBuffer) {
      return res.status(409).json({
        message: 'Attach a valid PDF before generating its verification hash.'
      });
    }

    const hash = crypto.createHash('sha256')
      .update(pdfBuffer)
      .digest('hex');

    if (doc.status === 'Released') {
      return res.status(409).json({ message: 'Released documents are immutable.' });
    }
    if (doc.documentHash) {
      if (doc.documentHash !== hash || doc.status !== 'Finalized') {
        return res.status(409).json({
          message: 'Stored PDF bytes no longer match the finalized fingerprint.',
        });
      }
      return res.json({
        message: 'Document was already finalized with this fingerprint.',
        hash,
        document: doc,
        alreadyFinalized: true,
      });
    }

    // Only allow Transcript of Records and Diploma to be anchored to the blockchain
    const isBlockchainEligible = 
      doc.category === 'Transcript of Records' || 
      doc.documentType.toLowerCase().includes('diploma') || 
      doc.documentType.toLowerCase().includes('transcript');

    let linkedRequest = null;
    if (doc.linkedRequestId) {
      linkedRequest = await Request.findOne({ requestId: doc.linkedRequestId });
      if (!linkedRequest) {
        return res.status(404).json({ message: 'Linked request not found.' });
      }
      if (linkedRequest.status !== 'In Process') {
        return res.status(409).json({
          message: 'The linked request must be in process before issuance.',
        });
      }
    }

    let anchorResult = { 
      isSimulated: false, 
      status: 'Secured on Local Database Index Only',
      txID: 'TXN-' + Date.now(),
      blockNumber: 'N/A',
      nonce: 'N/A',
      miner: 'Local Registry Node',
      contractAddress: 'N/A',
      gasUsed: 'N/A'
    };

    if (isBlockchainEligible) {
      // Anchor the hash to the blockchain ledger (Live RPC or Local Proof-of-Work Fallback)
      anchorResult = await blockchainService.anchorDocumentHash(
        doc.documentId,
        doc.studentId,
        doc.studentName,
        hash
      );
    }

    doc.documentHash = hash;
    doc.blockchainStatus = isBlockchainEligible ? 'Recorded' : '';
    doc.blockchainTxHash = isBlockchainEligible ? anchorResult.txID : '';
    doc.blockchainBlockNumber = isBlockchainEligible
      ? anchorResult.blockNumber
      : null;
    doc.status = 'Finalized';
    await doc.save();

    if (linkedRequest) {
      const releasedRequest = await Request.findOneAndUpdate(
        {
          _id: linkedRequest._id,
          status: 'In Process',
        },
        {
          $set: {
            documentFile: encodePdf(pdfBuffer),
            hasDocument: true,
            documentHash: hash,
            blockchainStatus: isBlockchainEligible ? 'Recorded' : '',
            blockchainTxHash: isBlockchainEligible ? anchorResult.txID : '',
            blockchainBlockNumber: isBlockchainEligible
              ? anchorResult.blockNumber
              : null,
            status: 'Released',
          },
        },
        { new: true },
      );
      if (!releasedRequest) {
        return res.status(409).json({
          message: 'The document was finalized, but the request state changed before release.',
        });
      }
    }

    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'User',
      action: 'Hash Generation',
      type: doc.documentType,
      status: 'Successful',
      details: isBlockchainEligible
        ? `Generated SHA-256 hash & anchored to Blockchain for ${doc.documentType} (${doc.documentId})`
        : `Generated SHA-256 hash & indexed locally for ${doc.documentType} (${doc.documentId})`
    });

    res.json({ 
      message: isBlockchainEligible 
        ? 'Hash generated and anchored to blockchain successfully' 
        : 'Hash generated and secured locally successfully', 
      hash, 
      document: doc,
      blockchainReceipt: anchorResult
    });
  } catch (error) {
    console.error('Error generating hash:', error);
    const unavailable = error?.code === 'BLOCKCHAIN_UNAVAILABLE';
    res.status(unavailable ? 503 : 500).json({
      message: unavailable
        ? 'Blockchain ledger is temporarily unavailable. The document was not finalized.'
        : 'Error generating hash and anchoring to blockchain'
    });
  }
});

// @route   DELETE /api/documents/:id
// @desc    Delete a document - Super Admin only
router.delete('/:id', protect, superAdminOnly, async (req, res) => {
  try {
    const doc = await Document.findOne({ documentId: req.params.id });
    if (!doc) return res.status(404).json({ message: 'Document not found' });
    if (doc.status !== 'Draft') {
      return res.status(409).json({
        message: 'Finalized credentials require an explicit revocation workflow and cannot be deleted.',
      });
    }

    await Document.deleteOne({ documentId: req.params.id });

    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'User',
      action: 'Delete Document',
      type: doc.documentType,
      status: 'Successful',
      details: `Deleted ${doc.documentType} for ${doc.studentName} (${doc.documentId})`
    });

    res.json({ message: 'Document deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting document' });
  }
});

// @route   GET /api/documents/:id/download
// @desc    Download the PDF for a document
router.get('/:id/download', protect, registrarOrSuperAdmin, async (req, res) => {
  try {
    const doc = await Document.findOne({ documentId: req.params.id })
      .select('+pdfData');
    if (!doc || !doc.pdfPath) {
      return res.status(404).json({ message: 'PDF not found for this document' });
    }

    const pdfBuffer = decodePdf(doc.pdfData) || decodePdf(doc.pdfPath);
    if (pdfBuffer) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${doc.documentType}-${doc.studentName}.pdf"`);
      res.send(pdfBuffer);
    } else {
      const filePath = path.join(__dirname, '../uploads/documents', doc.pdfPath);
      res.download(filePath, `${doc.documentType}-${doc.studentName}.pdf`);
    }
  } catch (error) {
    res.status(500).json({ message: 'Error downloading document' });
  }
});

module.exports = router;
