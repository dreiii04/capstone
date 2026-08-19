const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const qrcode = require('qrcode');
const TOR = require('../models/TOR');
const ActivityLog = require('../models/ActivityLog');
const { protect, superAdminOnly, registrarOrSuperAdmin } = require('../middleware/authMiddleware');

// Configure multer for CSV uploads
const csvStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'uploads', 'tor');
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

// Helper: compute GWA
function computeGWA(grades) {
    if (!grades || grades.length === 0) return { gwa: 0, totalUnits: 0 };
    let totalWeighted = 0;
    let totalUnits = 0;
    for (const g of grades) {
        totalWeighted += g.grade * g.units;
        totalUnits += g.units;
    }
    const gwa = totalUnits > 0 ? parseFloat((totalWeighted / totalUnits).toFixed(4)) : 0;
    return { gwa, totalUnits };
}

// @route   POST /api/tor/upload-csv
router.post('/upload-csv', protect, registrarOrSuperAdmin, uploadCSV.single('csvFile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No CSV file uploaded' });
        }

        const grades = [];
        let studentInfo = null;

        await new Promise((resolve, reject) => {
            fs.createReadStream(req.file.path)
                .pipe(csv())
                .on('data', (row) => {
                    if (!studentInfo) {
                        studentInfo = {
                            studentId: (row['Student ID'] || '').trim(),
                            studentName: (row['Student Name'] || '').trim(),
                            course: (row['Course'] || '').trim(),
                            yearLevel: (row['Year Level'] || '').trim()
                        };
                    }
                    grades.push({
                        academicYear: (row['Academic Year'] || '').trim(),
                        semester: (row['Semester'] || '').trim(),
                        subjectCode: (row['Subject Code'] || '').trim(),
                        subjectName: (row['Subject Name'] || '').trim(),
                        units: parseFloat(row['Units']) || 0,
                        grade: parseFloat(row['Grade']) || 0
                    });
                })
                .on('end', resolve)
                .on('error', reject);
        });

        if (!studentInfo || !studentInfo.studentId) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'CSV is missing required Student ID column' });
        }

        if (grades.length === 0) {
            fs.unlinkSync(req.file.path);
            return res.status(400).json({ message: 'CSV contains no grade records' });
        }

        const { gwa, totalUnits } = computeGWA(grades);
        const torId = 'TOR-' + Date.now();

        const tor = await TOR.create({
            torId,
            studentId: studentInfo.studentId,
            studentName: studentInfo.studentName,
            course: studentInfo.course,
            yearLevel: studentInfo.yearLevel,
            grades,
            gwa,
            totalUnits,
            status: 'Draft',
            generatedBy: req.user.email
        });

        fs.unlinkSync(req.file.path);

        await ActivityLog.create({
            userEmail: req.user.email,
            userName: req.user.name || 'User',
            action: 'CSV Import',
            type: 'Transcript of Records',
            status: 'Successful',
            details: `Imported grades for ${studentInfo.studentName} (${studentInfo.studentId}) — ${grades.length} subjects`
        });

        res.json({ message: 'CSV imported successfully', tor });
    } catch (error) {
        console.error('Error uploading CSV:', error);
        res.status(500).json({ message: 'Error processing CSV file' });
    }
});

// @route   GET /api/tor
router.get('/', protect, registrarOrSuperAdmin, async (req, res) => {
    try {
        const tors = await TOR.find().sort({ createdAt: 1 });
        res.json(tors);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching TOR records' });
    }
});

// @route   GET /api/tor/:id
router.get('/:id', protect, registrarOrSuperAdmin, async (req, res) => {
    try {
        const tor = await TOR.findOne({ torId: req.params.id });
        if (!tor) return res.status(404).json({ message: 'TOR not found' });
        res.json(tor);
    } catch (error) {
        res.status(500).json({ message: 'Error fetching TOR' });
    }
});

// @route   PUT /api/tor/:id
router.put('/:id', protect, registrarOrSuperAdmin, async (req, res) => {
    try {
        const tor = await TOR.findOne({ torId: req.params.id });
        if (!tor) return res.status(404).json({ message: 'TOR not found' });

        if (tor.status !== 'Draft') {
            return res.status(400).json({ message: 'Can only edit TOR records in Draft status' });
        }

        const updateData = {};
        if (req.body.studentName) updateData.studentName = req.body.studentName;
        if (req.body.course) updateData.course = req.body.course;
        if (req.body.yearLevel) updateData.yearLevel = req.body.yearLevel;
        if (req.body.grades) {
            updateData.grades = req.body.grades;
            const { gwa, totalUnits } = computeGWA(req.body.grades);
            updateData.gwa = gwa;
            updateData.totalUnits = totalUnits;
        }

        const updated = await TOR.findOneAndUpdate({ torId: req.params.id }, updateData, { new: true });

        await ActivityLog.create({
            userEmail: req.user.email,
            userName: req.user.name || 'User',
            action: 'Edit TOR',
            type: 'Transcript of Records',
            status: 'Successful',
            details: `Edited TOR for ${updated.studentName} (${updated.studentId})`
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'Error updating TOR' });
    }
});

// @route   POST /api/tor/:id/generate
router.post('/:id/generate', protect, registrarOrSuperAdmin, async (req, res) => {
    try {
        const tor = await TOR.findOne({ torId: req.params.id });
        if (!tor) return res.status(404).json({ message: 'TOR not found' });

        const pdfDir = path.join(__dirname, '..', 'uploads', 'tor');
        if (!fs.existsSync(pdfDir)) {
            fs.mkdirSync(pdfDir, { recursive: true });
        }
        const pdfFilename = `${tor.torId}-${tor.studentId}.pdf`;
        const pdfPath = path.join(pdfDir, pdfFilename);

        const frontendUrl = process.env.FRONTEND_URL || req.get('origin') || 'http://localhost:5173';
        await generateTORPdf(tor, pdfPath, frontendUrl);

        tor.pdfPath = pdfFilename;
        tor.status = 'Finalized';
        await tor.save();

        await ActivityLog.create({
            userEmail: req.user.email,
            userName: req.user.name || 'User',
            action: 'Generate TOR',
            type: 'Transcript of Records',
            status: 'Successful',
            details: `Generated TOR PDF for ${tor.studentName} (${tor.studentId})`
        });

        res.json({ message: 'TOR generated successfully', tor });
    } catch (error) {
        console.error('Error generating TOR:', error);
        res.status(500).json({ message: 'Error generating TOR' });
    }
});

// @route   GET /api/tor/:id/download
router.get('/:id/download', protect, registrarOrSuperAdmin, async (req, res) => {
    try {
        const tor = await TOR.findOne({ torId: req.params.id });
        if (!tor) return res.status(404).json({ message: 'TOR not found' });
        if (!tor.pdfPath) return res.status(400).json({ message: 'TOR PDF has not been generated yet' });

        const pdfFullPath = path.join(__dirname, '..', 'uploads', 'tor', tor.pdfPath);
        if (!fs.existsSync(pdfFullPath)) {
            return res.status(404).json({ message: 'PDF file not found on server' });
        }

        res.download(pdfFullPath, `TOR-${tor.studentName}-${tor.studentId}.pdf`);
    } catch (error) {
        res.status(500).json({ message: 'Error downloading TOR PDF' });
    }
});

// @route   DELETE /api/tor/:id
router.delete('/:id', protect, superAdminOnly, async (req, res) => {
    try {
        const tor = await TOR.findOne({ torId: req.params.id });
        if (!tor) return res.status(404).json({ message: 'TOR not found' });

        if (tor.pdfPath) {
            const pdfFullPath = path.join(__dirname, '..', 'uploads', 'tor', tor.pdfPath);
            if (fs.existsSync(pdfFullPath)) {
                fs.unlinkSync(pdfFullPath);
            }
        }

        await TOR.deleteOne({ torId: req.params.id });

        await ActivityLog.create({
            userEmail: req.user.email,
            userName: req.user.name || 'User',
            action: 'Delete TOR',
            type: 'Transcript of Records',
            status: 'Successful',
            details: `Deleted TOR for ${tor.studentName} (${tor.studentId})`
        });

        res.json({ message: 'TOR deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting TOR' });
    }
});

// ============================================================
// PDF Generation Helper
// ============================================================
async function generateTORPdf(tor, outputPath, frontendUrl) {
    const qrUrl = `${frontendUrl}/verify/results?hash=${tor.torId}`;
    const qrDataUri = await qrcode.toDataURL(qrUrl, { width: 100, margin: 1 });

    return new Promise((resolve, reject) => {
        const doc = new PDFDocument({
            size: 'LETTER',
            margins: { top: 50, bottom: 50, left: 60, right: 60 }
        });
        const stream = fs.createWriteStream(outputPath);
        doc.pipe(stream);

        const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

        // === HEADER ===
        doc.fontSize(10).fillColor('#666666')
            .text('REPUBLIC OF THE PHILIPPINES', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(14).fillColor('#1a1a1a').font('Helvetica-Bold')
            .text('UNIVERSITY', { align: 'center' });
        doc.moveDown(0.3);
        doc.fontSize(9).fillColor('#666666').font('Helvetica')
            .text('Office of the University Registrar', { align: 'center' });

        doc.moveDown(0.5);
        doc.moveTo(doc.page.margins.left, doc.y)
            .lineTo(doc.page.width - doc.page.margins.right, doc.y)
            .strokeColor('#2f3947').lineWidth(2).stroke();

        doc.moveDown(0.8);
        doc.fontSize(16).fillColor('#2f3947').font('Helvetica-Bold')
            .text('TRANSCRIPT OF RECORDS', { align: 'center' });
        doc.moveDown(1);

        // === STUDENT INFO ===
        const infoStartY = doc.y;
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#333333');

        const labelX = doc.page.margins.left;
        const valueX = doc.page.margins.left + 120;

        doc.text('Student Name:', labelX, infoStartY);
        doc.font('Helvetica').text(tor.studentName, valueX, infoStartY);

        doc.font('Helvetica-Bold').text('Student ID:', labelX, infoStartY + 18);
        doc.font('Helvetica').text(tor.studentId, valueX, infoStartY + 18);

        doc.font('Helvetica-Bold').text('Program:', labelX, infoStartY + 36);
        doc.font('Helvetica').text(tor.course, valueX, infoStartY + 36);

        doc.font('Helvetica-Bold').text('Year Level:', labelX, infoStartY + 54);
        doc.font('Helvetica').text(tor.yearLevel || 'N/A', valueX, infoStartY + 54);

        doc.y = infoStartY + 80;

        doc.moveTo(doc.page.margins.left, doc.y)
            .lineTo(doc.page.width - doc.page.margins.right, doc.y)
            .strokeColor('#cccccc').lineWidth(0.5).stroke();
        doc.moveDown(0.8);

        // === GROUP GRADES BY SEMESTER ===
        const grouped = {};
        for (const g of tor.grades) {
            const key = `${g.academicYear} — ${g.semester} Semester`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(g);
        }

        const colCode = 80;
        const colName = pageWidth - 80 - 60 - 60;
        const colUnits = 60;
        const colGrade = 60;

        for (const [semLabel, subjects] of Object.entries(grouped)) {
            if (doc.y > doc.page.height - 150) {
                doc.addPage();
            }

            doc.fontSize(10).font('Helvetica-Bold').fillColor('#2f3947')
                .text(semLabel, doc.page.margins.left, doc.y);
            doc.moveDown(0.4);

            const headerY = doc.y;
            doc.rect(doc.page.margins.left, headerY - 2, pageWidth, 18)
                .fillColor('#2f3947').fill();

            doc.fontSize(8).font('Helvetica-Bold').fillColor('#ffffff');
            let x = doc.page.margins.left + 4;
            doc.text('CODE', x, headerY + 2, { width: colCode });
            x += colCode;
            doc.text('SUBJECT', x, headerY + 2, { width: colName });
            x += colName;
            doc.text('UNITS', x, headerY + 2, { width: colUnits, align: 'center' });
            x += colUnits;
            doc.text('GRADE', x, headerY + 2, { width: colGrade, align: 'center' });

            doc.y = headerY + 20;

            let semUnits = 0;
            let semWeighted = 0;
            for (let i = 0; i < subjects.length; i++) {
                const s = subjects[i];
                const rowY = doc.y;

                if (i % 2 === 0) {
                    doc.rect(doc.page.margins.left, rowY - 1, pageWidth, 16)
                        .fillColor('#f8f9fa').fill();
                }

                doc.fontSize(8).font('Helvetica').fillColor('#333333');
                x = doc.page.margins.left + 4;
                doc.text(s.subjectCode, x, rowY + 2, { width: colCode });
                x += colCode;
                doc.text(s.subjectName, x, rowY + 2, { width: colName });
                x += colName;
                doc.text(s.units.toString(), x, rowY + 2, { width: colUnits, align: 'center' });
                x += colUnits;
                doc.text(s.grade.toFixed(2), x, rowY + 2, { width: colGrade, align: 'center' });

                semUnits += s.units;
                semWeighted += s.grade * s.units;
                doc.y = rowY + 16;
            }

            const subtotalY = doc.y;
            doc.rect(doc.page.margins.left, subtotalY - 1, pageWidth, 16)
                .fillColor('#e9ecef').fill();
            doc.fontSize(8).font('Helvetica-Bold').fillColor('#333333');
            x = doc.page.margins.left + 4;
            doc.text('', x, subtotalY + 2, { width: colCode });
            x += colCode;
            doc.text('Semester Total', x, subtotalY + 2, { width: colName });
            x += colName;
            doc.text(semUnits.toString(), x, subtotalY + 2, { width: colUnits, align: 'center' });
            x += colUnits;
            const semGwa = semUnits > 0 ? (semWeighted / semUnits).toFixed(4) : '0.0000';
            doc.text(semGwa, x, subtotalY + 2, { width: colGrade, align: 'center' });
            doc.y = subtotalY + 24;
        }

        // === GWA SUMMARY ===
        doc.moveDown(0.5);
        doc.moveTo(doc.page.margins.left, doc.y)
            .lineTo(doc.page.width - doc.page.margins.right, doc.y)
            .strokeColor('#2f3947').lineWidth(1).stroke();
        doc.moveDown(0.6);

        doc.fontSize(11).font('Helvetica-Bold').fillColor('#2f3947');
        doc.text(`General Weighted Average (GWA): ${Number(tor.gwa).toFixed(4)}`, doc.page.margins.left);
        doc.moveDown(0.3);
        doc.fontSize(10).font('Helvetica').fillColor('#333333');
        doc.text(`Total Units Earned: ${tor.totalUnits}`);

        // === FOOTER ===
        doc.moveDown(2);
        const footerY = doc.y;

        doc.moveTo(doc.page.margins.left, footerY)
            .lineTo(doc.page.width - doc.page.margins.right, footerY)
            .strokeColor('#cccccc').lineWidth(0.5).stroke();
        doc.moveDown(0.5);

        // QR Code on the left
        doc.image(qrDataUri, doc.page.margins.left, footerY + 10, { width: 40 });

        // Text centered
        doc.fontSize(8).fillColor('#999999').font('Helvetica')
            .text(`Generated: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}  |  TOR ID: ${tor.torId}`, { align: 'center' });
        doc.moveDown(0.3);
        doc.text('This document is system-generated by VerifiTOR.', { align: 'center' });


        doc.end();
        stream.on('finish', resolve);
        stream.on('error', reject);
    });
}

module.exports = router;
