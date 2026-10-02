import multer from 'multer';
import path from 'path';

import {
  allowedImageExtensions,
  allowedReceiptMimeTypes,
  commonUploadLimits,
} from '../config/constants.js';

function imageFileFilter(req, file, callback) {
  const extension = path.extname(file.originalname || '').toLowerCase();
  const acceptedOctetStream =
    file.mimetype === 'application/octet-stream' &&
    allowedImageExtensions.has(extension);

  if (!allowedReceiptMimeTypes.has(file.mimetype) && !acceptedOctetStream) {
    req.fileValidationError =
      'Only JPG, PNG, WEBP, or HEIC images are allowed.';
    return callback(null, false);
  }
  return callback(null, true);
}

function validPng(buffer) {
  if (buffer.length < 45 || buffer.readUInt32BE(8) !== 13 ||
      buffer.toString('ascii', 12, 16) !== 'IHDR' ||
      !buffer.readUInt32BE(16) || !buffer.readUInt32BE(20)) return false;
  let offset = 8;
  let hasImageData = false;
  while (offset + 12 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > buffer.length) return false;
    const type = buffer.toString('ascii', offset + 4, offset + 8);
    if (type === 'IDAT') hasImageData = true;
    if (type === 'IEND') return length === 0 && hasImageData && end === buffer.length;
    offset = end;
  }
  return false;
}

function detectImageFormat(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return buffer.length > 16 && buffer.subarray(-2).equals(Buffer.from([0xff, 0xd9]))
      ? { extension: '.jpg', mimeType: 'image/jpeg' } : null;
  }

  const pngSignature = Buffer.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  ]);
  if (buffer.subarray(0, 8).equals(pngSignature)) {
    return validPng(buffer) ? { extension: '.png', mimeType: 'image/png' } : null;
  }
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
      buffer.subarray(8, 12).toString('ascii') === 'WEBP') {
    return buffer.length >= 20 && buffer.readUInt32LE(4) + 8 === buffer.length &&
      ['VP8 ', 'VP8L', 'VP8X'].includes(buffer.toString('ascii', 12, 16))
      ? { extension: '.webp', mimeType: 'image/webp' } : null;
  }
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii').toLowerCase();
    if (buffer.length >= 24 && buffer.readUInt32BE(0) >= 16 &&
        buffer.readUInt32BE(0) <= buffer.length &&
        new Set(['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1']).has(brand)) {
      return { extension: '.heic', mimeType: 'image/heic' };
    }
  }
  return null;
}

export function validateUploadedImage(file) {
  const detected = detectImageFormat(file?.buffer);
  if (!detected) return null;
  return {
    ...detected,
    originalName: path.basename(String(file.originalname || 'image')).slice(0, 120),
  };
}

function imageUpload(fileSize) {
  return multer({
    storage: multer.memoryStorage(),
    fileFilter: imageFileFilter,
    limits: {
      ...commonUploadLimits,
      fileSize,
    },
  });
}

// Vercel Functions reject an entire request body above 4.5 MB before it reaches
// Express. Keep the file below that ceiling so multipart headers still fit.
export const maximumServerlessUploadBytes = 4 * 1024 * 1024;
export const receiptUpload = imageUpload(maximumServerlessUploadBytes);
export const profileUpload = imageUpload(maximumServerlessUploadBytes);
