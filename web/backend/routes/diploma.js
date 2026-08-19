const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const qrcode = require('qrcode');
const Diploma = require('../models/Diploma');
const ActivityLog = require('../models/ActivityLog');
const { protect, superAdminOnly, registrarOrSuperAdmin } = require('../middleware/authMiddleware');

// Configure multer for CSV uploads
const csvStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'diploma');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        cb(null, `csv-${Date.now()}-${file.originalname}`);
    }
});

const uploadCSV = multer({
    storage: csvStorage,
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    },
    limits: { fileSize: 5 * 1024 * 1024 }
});

// @route   POST /api/diploma/upload-csv
router.post('/upload-csv', protect, registrarOrSuperAdmin, uploadCSV.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No CSV file uploaded' });
        }

        const diplomas = [];

        await new Promise((resolve, reject) => {
            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('data', (row) => {
                    diplomas.push({
                        studentId: (row['Student ID'] || '').trim(),
                        studentName: (row['Student Name'] || '').trim(),
                        course: (row['Course'] || '').trim(),
                        honors: (row['Honors'] || '').trim(),
                        dateOfGraduation: (row['Date of Graduation'] || '').trim(),
                    });
                })
                .on('end', resolve)
                .on('error', reject);
        });

        fs.unlinkSync(req.file.path);

        if (diplomas.length === 0) {
            return res.status(400).json({ message: 'CSV contains no records' });
        }

        const createdDiplomas = [];

        for (const info of diplomas) {
            if (!info.studentId || !info.studentName) continue;

            const diplomaId = 'DIP-' + Date.now() + Math.floor(Math.random() * 1000);

            const diploma = await Diploma.create({
                diplomaId,
                studentId: info.studentId,
                studentName: info.studentName,
                course: info.course,
                honors: info.honors,
                dateOfGraduation: info.dateOfGraduation,
                status: 'Draft',
                generatedBy: req.user.email
            });
            createdDiplomas.push(diploma);
        }

        await ActivityLog.create({
            userEmail: req.user.email,
            userName: req.user.name || 'User',
            action: 'CSV Import',
            type: 'Diploma',
            status: 'Successful',
            details: `Imported ${createdDiplomas.length} diploma records`
        });

        res.json({ message: 'CSV imported successfully', count: createdDiplomas.length });
    } catch (error) {
        console.error('Error uploading CSV:', error);
        res.status(500).json({ message: 'Error processing CSV file' });
    }
});

// @route   GET /api/diploma
router.get('/', protect, registrarOrSuperAdmin, async (req, res) => {
    try {
        const diplomas = await Diploma.find().sort({ createdAt: 1 });
        res.json(diplomas);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching Diploma records' });
    }
});

// @route   GET /api/diploma/:id
router.get('/:id', protect, registrarOrSuperAdmin, async (req, res) => {
    try {
        const diploma = await Diploma.findOne({ diplomaId: req.params.id });
        if (!diploma) return res.status(404).json({ message: 'Diploma not found' });
        res.json(diploma);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching Diploma' });
    }
});

// @route   PUT /api/diploma/:id
router.put('/:id', protect, registrarOrSuperAdmin, async (req, res) => {
    try {
        const diploma = await Diploma.findOne({ diplomaId: req.params.id });
        if (!diploma) return res.status(404).json({ message: 'Diploma not found' });

        if (diploma.status !== 'Draft') {
            return res.status(400).json({ message: 'Can only edit records in Draft status' });
        }

        if (req.body.studentName) diploma.studentName = req.body.studentName;
        if (req.body.course) diploma.course = req.body.course;
        if (req.body.honors !== undefined) diploma.honors = req.body.honors;
        if (req.body.dateOfGraduation) diploma.dateOfGraduation = req.body.dateOfGraduation;

        const updated = await diploma.save();

        await ActivityLog.create({
            userEmail: req.user.email,
            userName: req.user.name || 'User',
            action: 'Edit Diploma',
            type: 'Diploma',
            status: 'Successful',
            details: `Edited Diploma for ${updated.studentName} (${updated.studentId})`
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating Diploma' });
    }
});

// @route   POST /api/diploma/:id/generate
router.post('/:id/generate', protect, registrarOrSuperAdmin, async (req, res) => {
    try {
        const diploma = await Diploma.findOne({ diplomaId: req.params.id });
        if (!diploma) return res.status(404).json({ message: 'Diploma not found' });

        const pdfDir = path.join(__dirname, '..', 'uploads', 'diploma');
        if (!fs.existsSync(pdfDir)) {
            fs.mkdirSync(pdfDir, { recursive: true });
        }
        const pdfFilename = `${diploma.diplomaId}-${diploma.studentId}.pdf`;
        const pdfPath = path.join(pdfDir, pdfFilename);

        const frontendUrl = process.env.FRONTEND_URL || req.get('origin') || 'http://localhost:5173';
        await generateDiplomaPdf(diploma, pdfPath, frontendUrl);

        diploma.pdfPath = pdfFilename;
        diploma.status = 'Finalized';
        await diploma.save();

        await ActivityLog.create({
            userEmail: req.user.email,
            userName: req.user.name || 'User',
            action: 'Generate Diploma',
            type: 'Diploma',
            status: 'Successful',
            details: `Generated Diploma PDF for ${diploma.studentName} (${diploma.studentId})`
        });

        res.json({ message: 'Diploma generated successfully', diploma });
    } catch (error) {
        console.error('Error generating Diploma:', error);
        res.status(500).json({ message: 'Error generating Diploma' });
    }
});

// @route   GET /api/diploma/:id/download
router.get('/:id/download', protect, registrarOrSuperAdmin, async (req, res) => {
    try {
        const diploma = await Diploma.findOne({ diplomaId: req.params.id });
        if (!diploma) return res.status(404).json({ message: 'Diploma not found' });
        if (!diploma.pdfPath) return res.status(400).json({ message: 'Diploma PDF has not been generated yet' });

        const pdfFullPath = path.join(__dirname, '..', 'uploads', 'diploma', diploma.pdfPath);
        if (!fs.existsSync(pdfFullPath)) {
            return res.status(404).json({ message: 'PDF file not found on server' });
        }

        res.download(pdfFullPath, `Diploma-${diploma.studentName}-${diploma.studentId}.pdf`);
    } catch (error) {
        res.status(500).json({ message: 'Error downloading Diploma PDF' });
    }
});

// @route   DELETE /api/diploma/:id
router.delete('/:id', protect, superAdminOnly, async (req, res) => {
    try {
        const diploma = await Diploma.findOne({ diplomaId: req.params.id });
        if (!diploma) return res.status(404).json({ message: 'Diploma not found' });

        if (diploma.pdfPath) {
            const pdfFullPath = path.join(__dirname, '..', 'uploads', 'diploma', diploma.pdfPath);
            if (fs.existsSync(pdfFullPath)) {
                fs.unlinkSync(pdfFullPath);
            }
        }

        await Diploma.deleteOne({ diplomaId: req.params.id });

        await ActivityLog.create({
            userEmail: req.user.email,
            userName: req.user.name || 'User',
            action: 'Delete Diploma',
            type: 'Diploma',
            status: 'Successful',
            details: `Deleted Diploma for ${diploma.studentName} (${diploma.studentId})`
        });

        res.json({ message: 'Diploma deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting Diploma' });
    }
});

// ============================================================
// PDF Generation Helper
// ============================================================
async function generateDiplomaPdf(diploma, outputPath, frontendUrl) {
    const qrUrl = `${frontendUrl}/verify/results?hash=${diploma.diplomaId}`;
    const qrDataUri = await qrcode.toDataURL(qrUrl, { width: 100, margin: 1 });

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'LETTER',
            layout: 'landscape',
            margins: { top: 50, bottom: 50, left: 60, right: 60 }
        });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        const pageWidth = doc.page.width;
        const pageHeight = doc.page.height;

        // Border
        doc.rect(30, 30, pageWidth - 60, pageHeight - 60).lineWidth(4).strokeColor('#2c3e50').stroke();
        doc.rect(35, 35, pageWidth - 70, pageHeight - 70).lineWidth(1).strokeColor('#2c3e50').stroke();

        // Header
        doc.moveDown(2);
        doc.fontSize(24).fillColor('#1a1a1a').font('Helvetica-Bold')
            .text('VERIFITOR UNIVERSITY', { align: 'center' });
        doc.moveDown(0.5);
        
        doc.fontSize(14).fillColor('#666666').font('Helvetica-Oblique')
            .text('Be it known that', { align: 'center' });
        doc.moveDown(1.5);
        
        // Student Name
        doc.fontSize(36).fillColor('#2c3e50').font('Helvetica-Bold')
            .text(diploma.studentName, { align: 'center' });
        doc.moveDown(1.5);

        // Course
        doc.fontSize(14).fillColor('#666666').font('Helvetica')
            .text('having satisfactorily completed the prescribed course of study, is hereby awarded the degree of', { align: 'center' });
        doc.moveDown(1);
        
        doc.fontSize(20).fillColor('#1a1a1a').font('Helvetica-Bold')
            .text(diploma.course, { align: 'center' });
            
        if (diploma.honors && diploma.honors.trim() !== '') {
            doc.moveDown(0.5);
            doc.fontSize(16).fillColor('#c0392b').font('Helvetica-BoldOblique')
                .text(diploma.honors, { align: 'center' });
        }
        
        doc.moveDown(1.5);
        doc.fontSize(12).fillColor('#333333').font('Helvetica')
            .text(`Given this ${diploma.dateOfGraduation}`, { align: 'center' });

        // Bottom section with signatures and QR code
        const bottomY = pageHeight - 120;
        
        // Signatures
        doc.moveTo(80, bottomY + 30).lineTo(280, bottomY + 30).lineWidth(1).strokeColor('#333333').stroke();
        doc.fontSize(10).fillColor('#333333').font('Helvetica').text('University President', 80, bottomY + 35, { width: 200, align: 'center' });

        doc.moveTo(pageWidth - 280, bottomY + 30).lineTo(pageWidth - 80, bottomY + 30).lineWidth(1).strokeColor('#333333').stroke();
        doc.fontSize(10).fillColor('#333333').font('Helvetica').text('University Registrar', pageWidth - 280, bottomY + 35, { width: 200, align: 'center' });

        // QR Code in the middle
        doc.image(qrDataUri, (pageWidth - 60) / 2, bottomY - 10, { width: 60 });
        doc.fontSize(8).fillColor('#999999').font('Helvetica').text(`ID: ${diploma.diplomaId}`, 0, bottomY + 55, { align: 'center' });

        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
    });
}

module.exports = router;
