const express = require('express');
const router = express.Router();
const multer = require('multer');
const crypto = require('crypto');
const QRCode = require('qrcode');
const { PDFDocument } = require('pdf-lib');
const {
    protect,
    registrarOrSuperAdmin,
} = require('../middleware/authMiddleware');
const Request = require('../models/Request');
const { isEndUser } = require('../services/sessionService');
const { ownerQuery } = require('../utils/ownership');

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
    limits: { fileSize: 4 * 1024 * 1024 }
});

router.post(
    '/:id/upload',
    protect,
    registrarOrSuperAdmin,
    upload.single('document'),
    async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const requestId = req.params.id;
        const request = await Request.findOne({ requestId: requestId })
            .select('+documentFile');

        if (!request) {
            return res.status(404).json({ message: 'Request not found' });
        }

        if (request.status !== 'In Process') {
            return res.status(409).json({
                message: 'Documents can only be uploaded for requests that are in process.'
            });
        }
        if (request.documentFile) {
            return res.status(409).json({
                message: 'A completed document is already attached to this request.'
            });
        }
        if (req.file.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
            return res.status(400).json({ message: 'Uploaded file is not a valid PDF.' });
        }

        const docType = (request.documentType || request.document_type || '').toLowerCase();
        const isBlockchainEligible = docType.includes('transcript') || docType.includes('tor') || docType.includes('diploma');

        let finalPdfBuffer = req.file.buffer;
        let verificationCode = '';

        if (isBlockchainEligible) {
            verificationCode = crypto.randomBytes(24).toString('hex');

            // Generate QR Code
            const validationUrl =
                `${FRONTEND_URL.replace(/\/+$/, '')}/verify/results?code=${verificationCode}`;
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
            finalPdfBuffer = Buffer.from(await pdfDoc.save());
        }

        // Hash the exact bytes that are stored and delivered. This is done
        // after QR stamping so the published fingerprint matches the artifact.
        const documentHash = crypto.createHash('sha256')
            .update(finalPdfBuffer)
            .digest('hex');

        request.documentFile =
            `data:application/pdf;base64,${finalPdfBuffer.toString('base64')}`;
        request.documentHash = documentHash;
        request.verificationCode = verificationCode || undefined;
        request.hasDocument = true;
        request.blockchainStatus = '';
        request.blockchainTxHash = '';
        request.blockchainBlockNumber = null;
        await request.save();

        res.json({
            message: 'Document uploaded and processed successfully',
            hasDocument: true,
            documentFile: `/api/requests/${encodeURIComponent(requestId)}/document`,
            documentHash: documentHash,
            isBlockchainEligible
        });

    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ message: 'Error processing document upload' });
    }
    },
);

router.get('/:id/document', protect, async (req, res) => {
    try {
        const request = await Request.findOne({
            requestId: req.params.id,
            ...(isEndUser(req.user)
                ? { ...ownerQuery(req.user), status: 'Released' }
                : {}),
        }).select('+documentFile');
        if (!request?.documentFile) {
            return res.status(404).json({ message: 'Document not found.' });
        }
        const prefix = 'data:application/pdf;base64,';
        if (!request.documentFile.startsWith(prefix)) {
            return res.status(404).json({ message: 'Document not found.' });
        }
        const pdf = Buffer.from(request.documentFile.slice(prefix.length), 'base64');
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader(
            'Content-Disposition',
            `attachment; filename="document-${request.requestId}.pdf"`,
        );
        return res.send(pdf);
    } catch (error) {
        return res.status(500).json({ message: 'Error downloading document.' });
    }
});

module.exports = router;
