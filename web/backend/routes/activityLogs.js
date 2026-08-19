const express = require('express');
const router = express.Router();
const ActivityLog = require('../models/ActivityLog');
const { protect, superAdminOnly } = require('../middleware/authMiddleware');

// Get all activity logs (export as CSV) - Super Admin Only
router.get('/export', protect, superAdminOnly, async (req, res) => {
    try {
      const logs = await ActivityLog.find().sort({ timestamp: -1 });

      let csv = 'User,Action,Details,Timestamp\n';
      logs.forEach(log => {
        csv += `"${log.userEmail}","${log.action}","${log.details}","${log.timestamp}"\n`;
      });
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=activity_logs.csv');
      res.status(200).send(csv);
    } catch (error) {
      res.status(500).json({ message: 'Error exporting logs' });
    }
  });

// Get all activity logs - Super Admin Only
router.get('/', protect, superAdminOnly, async (req, res) => {
  try {
    const logs = await ActivityLog.find().sort({ timestamp: -1 }).limit(100);
    res.json(logs);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching activity logs' });
  }
});

// Create a log entry
router.post('/', protect, async (req, res) => {
    try {
        const { action, details, type, status } = req.body;
        const newLog = await ActivityLog.create({
            userEmail: req.user.email,
            userName: req.user.name || 'User',
            action,
            type: type || '------',
            status: status || 'Successful',
            details
        });
        res.status(201).json(newLog);
    } catch (error) {
        res.status(500).json({ message: 'Error creating log' });
    }
});

module.exports = router;
