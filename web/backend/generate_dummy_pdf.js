const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');

const doc = new PDFDocument();
const outputPath = path.join(__dirname, 'dummy_test_document.pdf');
const stream = fs.createWriteStream(outputPath);

doc.pipe(stream);

doc.fontSize(25).text('VeriFitor University - Fake Document', 100, 100);
doc.fontSize(15).text('This is a dummy PDF file for testing the Document Upload and QR embedding feature.', 100, 150);
doc.text('If you upload this for a TOR or Diploma request, a QR code should appear in the bottom right corner.', 100, 200);

doc.end();

stream.on('finish', () => {
    console.log(`Dummy PDF created at: ${outputPath}`);
});
