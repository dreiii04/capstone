const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { PDFDocument } = require('pdf-lib');
const { protect } = require('../middleware/authMiddleware');
const Request = require('../models/Request');

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

// Configure multer for memory storage (Serverless/Vercel compatible)
const storage = multer.memoryStorage();

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'application/pdf') {
            cb(null, true);
        } else {
            cb(new Error('Only PDF files are allowed'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

router.post('/:id/upload', protect, upload.single('document'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const requestId = req.params.id;
        const request = await Request.findOne({ requestId: requestId });

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        const docType = (request.documentType || request.document_type || '').toLowerCase();
        const isBlockchainEligible = docType.includes('transcript') || docType.includes('tor') || docType.includes('diploma');

        let finalBase64String = `data:application/pdf;base64,${req.file.buffer.toString('base64')}`;
        let documentHash = request.documentHash;

        if (isBlockchainEligible) {
            // Generate hash if not exists
            if (!documentHash) {
                documentHash = crypto.createHash('sha256')
                    .update(`${request.requestId}-${request.name}-${Date.now()}`)
                    .digest('hex');
                request.documentHash = documentHash;
            }

            // Generate QR Code
            const validationUrl = `${FRONTEND_URL}/verify/results?hash=${documentHash}`;
            console.log('Generating QR Code with URL:', validationUrl);
            const qrCodeBuffer = await QRCode.toBuffer(validationUrl, {
                errorCorrectionLevel: 'H',
                margin: 1,
                width: 150
            });

            // Read the uploaded PDF from memory buffer
            const existingPdfBytes = req.file.buffer;
            const pdfDoc = await PDFDocument.load(existingPdfBytes);

            // Embed QR Code
            const qrImage = await pdfDoc.embedPng(qrCodeBuffer);
            const qrDims = qrImage.scale(1);

            // Draw on the first page
            const pages = pdfDoc.getPages();
            const firstPage = pages[0];
            const { width, height } = firstPage.getSize();

            // Place in the bottom right corner (with some padding)
            const padding = 30;
            firstPage.drawImage(qrImage, {
                x: width - qrDims.width - padding,
                y: padding,
                width: qrDims.width,
                height: qrDims.height,
            });

            // Save modified PDF back to buffer
            const modifiedPdfBytes = await pdfDoc.save();
            
            // Convert to Base64 data URI
            finalBase64String = `data:application/pdf;base64,${Buffer.from(modifiedPdfBytes).toString('base64')}`;
        }

        request.documentFile = finalBase64String;
        await request.save();

        res.json({
            message: 'Document uploaded and processed successfully',
            documentFile: finalBase64String,
            documentHash: documentHash,
            isBlockchainEligible
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ message: 'Error processing document upload' });
    }
});

module.exports = router;
