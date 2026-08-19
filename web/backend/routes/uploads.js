const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/authMiddleware');
const { uploadStream } = require('../utils/cloudinary');
const ActivityLog = require('../models/ActivityLog');
const { isSupportedImage } = require('../utils/imageValidation');

// Configure multer for memory storage (Serverless/Vercel compatible)
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        // Accept images only
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    },
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// @route   POST /api/upload/image
// @desc    Upload an image to Cloudinary (e.g. for profile pictures)
router.post('/image', protect, upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No image file uploaded. Field name must be "image".' });
        }
        if (!isSupportedImage(req.file.buffer)) {
            return res.status(400).json({ success: false, message: 'Uploaded file is not a valid PNG or JPEG image.' });
        }

        // Upload to Cloudinary using the existing utility
        const folder = req.body.folder === 'verifitor/profiles'
            ? 'verifitor/profiles'
            : 'verifitor/uploads';
        const result = await uploadStream(req.file.buffer, folder);

        // Optional: log this upload action
        try {
            await ActivityLog.create({
                userEmail: req.user.email,
                userName: req.user.name || 'User',
                action: 'Image Upload',
                type: 'Upload',
                status: 'Successful',
                details: `Uploaded image to ${folder}`
            });
        } catch (err) {
            console.error('Failed to log image upload:', err);
        }

        res.status(200).json({
            success: true,
            message: 'Image uploaded successfully',
            url: result.secure_url,
            public_id: result.public_id,
            format: result.format
        });
    } catch (error) {
        console.error('Image upload error:', error);
        res.status(500).json({ success: false, message: 'Server error during image upload' });
    }
});

module.exports = router;
