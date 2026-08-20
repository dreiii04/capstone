const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const {
    protect,
    registrarOrSuperAdmin,
} = require('../middleware/authMiddleware');
const ActivityLog = require('../models/ActivityLog');
const { resolveSmtpConfig } = require('../services/mailService');

// @route   POST /api/email/send
// @desc    Send a custom email (SMTP)
// @access  Private
router.post('/send', protect, registrarOrSuperAdmin, async (req, res) => {
    try {
        const { to, subject, html, text } = req.body;

        if (!to || !subject || (!html && !text)) {
            return res.status(400).json({ success: false, message: 'Missing required fields: to, subject, and html/text' });
        }

        const smtp = resolveSmtpConfig(process.env);
        if (!smtp) {
            return res.status(503).json({
                success: false,
                message: 'Email delivery is not configured.'
            });
        }
        const transporter = nodemailer.createTransport(smtp.transport);

        const mailOptions = {
            from: smtp.from,
            to,
            subject,
            html,
            text,
        };

        const info = await transporter.sendMail(mailOptions);

        // Optional: log this email action
        try {
            await ActivityLog.create({
                userEmail: req.user.email,
                userName: req.user.name || 'User',
                action: 'Send Email',
                type: 'Email',
                status: 'Successful',
                details: `Sent custom email to ${to} with subject "${subject}"`
            });
        } catch (err) {
            console.error('Failed to log email action:', err);
        }

        res.status(200).json({
            success: true,
            message: 'Email sent successfully',
            messageId: info.messageId
        });
    } catch (error) {
        console.error('Email sending error:', error);
        res.status(500).json({ success: false, message: 'Server error during email sending' });
    }
});

module.exports = router;
