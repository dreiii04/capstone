const express = require('express');
const router = express.Router();
const Admin = require('../models/Users/Admin');
const ActivityLog = require('../models/ActivityLog');
const { protect, superAdminOnly } = require('../middleware/authMiddleware');
const { findUserByEmail } = require('../services/sessionService');

router.use(protect);
router.use(superAdminOnly);

// @route   GET /api/admins
router.get('/', async (req, res) => {
  try {
    const admins = await Admin.find().select('-password');
    res.json(admins);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching admins' });
  }
});

// @route   POST /api/admins
router.post('/', async (req, res) => {
  try {
    const { email, password, name } = req.body;

    if (await findUserByEmail(email)) {
      return res.status(400).json({ message: 'Admin with this email already exists' });
    }

    const newAdmin = await Admin.create({
      email,
      password, // Model handles hashing
      name,
      role: 'admin',
      status: 'Active'
    });

    // Log the action
    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'Super Admin',
      action: 'Create Admin',
      type: '------',
      status: 'Successful',
      details: `Created new admin account: ${email}`
    });

    res.status(201).json({ message: 'Admin created successfully', admin: newAdmin });
  } catch (error) {
    res.status(500).json({ message: 'Error creating admin' });
  }
});

// @route   POST /api/admins/:id/reset-password
router.post('/:id/reset-password', async (req, res) => {
  try {
    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'Super Admin',
      action: 'Force Reset Password',
      type: '------',
      status: 'Successful',
      details: `Triggered password reset for admin: ${admin.email}`
    });

    res.json({ message: 'Password reset triggered successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error resetting password' });
  }
});

// @route   PUT /api/admins/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, email } = req.body;

    const admin = await Admin.findById(req.params.id);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });

    const updateData = {};
    if (name) updateData.name = name;
    if (email && String(email).trim().toLowerCase() !== admin.email) {
      const existing = await findUserByEmail(email);
      if (existing) {
        return res.status(409).json({ message: 'That email is already in use.' });
      }
      updateData.email = String(email).trim().toLowerCase();
    }

    const updatedAdmin = await Admin.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true },
    );

    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'Super Admin',
      action: 'Update Admin',
      type: '------',
      status: 'Successful',
      details: `Updated admin account: ${admin.email}`
    });

    res.json(updatedAdmin);
  } catch (error) {
    res.status(500).json({ message: 'Error updating admin' });
  }
});

// @route   DELETE /api/admins/:id
router.delete('/:id', async (req, res) => {
  try {
    const adminToDelete = await Admin.findById(req.params.id);
    if (!adminToDelete) return res.status(404).json({ message: 'Admin not found' });

    const email = adminToDelete.email;
    await Admin.findByIdAndDelete(req.params.id);

    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'Super Admin',
      action: 'Delete Admin',
      type: '------',
      status: 'Successful',
      details: `Deleted admin account: ${email}`
    });

    res.json({ message: 'Admin deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting admin' });
  }
});

module.exports = router;
