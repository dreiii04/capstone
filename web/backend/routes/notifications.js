const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const Notification = require('../models/Notification');
const { protect } = require('../middleware/authMiddleware');
const { isEndUser } = require('../services/sessionService');
const { ownerQuery } = require('../utils/ownership');

function notificationScope(user) {
  if (isEndUser(user)) return ownerQuery(user);
  // Staff notifications are intentionally created without a recipient. Do not
  // let registrar actions mutate student/alumni inboxes.
  return {
    $and: [
      { $or: [{ userId: '' }, { userId: null }, { userId: { $exists: false } }] },
      { $or: [{ email: '' }, { email: null }, { email: { $exists: false } }] },
    ],
  };
}

// Get all notifications
router.get('/', protect, async (req, res) => {
  try {
    const query = notificationScope(req.user);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '50', 10) || 50, 1), 200);
    const notifications = await Notification.find(query).sort({ date: -1 }).limit(limit);
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching notifications' });
  }
});

// Mark all as read
router.put('/mark-all-read', protect, async (req, res) => {
  try {
    await Notification.updateMany(
      { isRead: false, ...notificationScope(req.user) },
      { isRead: true }
    );
    res.json({ message: 'All notifications marked as read' });
  } catch (error) {
    res.status(500).json({ message: 'Error updating notifications' });
  }
});

// Mark as read
router.put('/:id/read', protect, async (req, res) => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, ...notificationScope(req.user) },
      { isRead: true },
      { new: true }
    );
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    res.json(notification);
  } catch (error) {
    res.status(500).json({ message: 'Error updating notification' });
  }
});

// Dismiss a notification permanently for its owner.
router.delete('/:id', protect, async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      ...notificationScope(req.user),
    });
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    return res.json({ success: true, id: String(notification._id) });
  } catch (error) {
    return res.status(500).json({ message: 'Error dismissing notification' });
  }
});

module.exports = router;
