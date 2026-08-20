const cloudinary = require('cloudinary').v2;
const streamifier = require('streamifier');
require('dotenv').config();

if (String(process.env.CLOUDINARY_URL || '').trim()) {
  cloudinary.config(true);
} else {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function hasCloudinaryConfig() {
  const config = cloudinary.config();
  return Boolean(config.cloud_name && config.api_key && config.api_secret);
}

function buildAuthenticatedDeliveryUrl(uploadResult) {
  const publicId = String(uploadResult?.public_id || '').trim();
  if (!publicId) return '';
  return cloudinary.url(publicId, {
    resource_type: uploadResult?.resource_type || 'image',
    type: 'authenticated',
    secure: true,
    sign_url: true,
    ...(uploadResult?.version ? { version: uploadResult.version } : {}),
    ...(uploadResult?.format ? { format: uploadResult.format } : {}),
  });
}

const uploadStream = (buffer, folder, { authenticated = folder === 'receipts' } = {}) => {
  if (!hasCloudinaryConfig()) {
    const error = new Error('Receipt media storage is not configured.');
    error.code = 'MEDIA_STORAGE_UNAVAILABLE';
    throw error;
  }
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        ...(authenticated ? { type: 'authenticated' } : {}),
      },
      (error, result) => {
        if (result) {
          resolve(authenticated
            ? { ...result, secure_url: buildAuthenticatedDeliveryUrl(result) }
            : result);
        } else {
          reject(error);
        }
      }
    );
    streamifier.createReadStream(buffer).pipe(stream);
  });
};

module.exports = {
  buildAuthenticatedDeliveryUrl,
  cloudinary,
  hasCloudinaryConfig,
  uploadStream,
};
