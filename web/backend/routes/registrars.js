const express = require('express');
const router = express.Router();
const Registrar = require('../models/Registrar');
const Admin = require('../models/Users/Admin');
const ActivityLog = require('../models/ActivityLog');
const { protect, superAdminOnly } = require('../middleware/authMiddleware');

router.use(protect);
router.use(superAdminOnly);

// @route   GET /api/registrars
router.get('/', async (req, res) => {
  try {
    const registrars = await Registrar.find();
    const admins = await Admin.find();

    // Combine results for frontend compatibility
    const combined = [
        ...registrars,
        ...admins.map(a => ({
            ...a.toObject(),
            registrarId: 'ADMIN-' + a._id.toString().substring(0, 4),
            status: 'Active'
        }))
    ];

    res.json(combined);
  } catch (error) {
    console.error('Error fetching registrars:', error);
    res.status(500).json({ message: 'Error fetching registrars' });
  }
});

// @route   POST /api/registrars
router.post('/', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    // Check if email exists
    const existingReg = await Registrar.findOne({ email });
    const existingAdmin = await Admin.findOne({ email });
    
    if (existingReg || existingAdmin) {
      return res.status(400).json({ message: 'User with this email already exists' });
    }

    const registrarId = 'REG-' + Math.floor(100000 + Math.random() * 900000);
    const newRegistrar = await Registrar.create({
      registrarId,
      name,
      email,
      password, // Model handles hashing
      role: role || 'registrar'
    });

    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'Super Admin',
      action: 'User Created',
      type: '------',
      status: 'Successful',
      details: `Created new staff account: ${name} (${email})`
    });

    res.status(201).json({ message: 'Staff created successfully', registrar: newRegistrar });
  } catch (error) {
    console.error('Error creating staff:', error);
    res.status(500).json({ message: 'Error creating staff' });
  }
});

// @route   PUT /api/registrars/:id
router.put('/:id', async (req, res) => {
  try {
    const { name, email, role, status } = req.body;

    let staff = await Registrar.findById(req.params.id);
    let model = Registrar;

    if (!staff) {
        staff = await Admin.findById(req.params.id);
        model = Admin;
    }

    if (!staff) return res.status(404).json({ message: 'User not found' });

    const updateData = {};
    if (name) updateData.name = name;
    if (email) updateData.email = email;
    if (role) updateData.role = role;
    if (status) updateData.status = status;

    const updated = await model.findByIdAndUpdate(req.params.id, updateData, { new: true });

    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'Super Admin',
      action: 'User Updated',
      type: '------',
      status: 'Successful',
      details: `Updated staff: ${updated.name}`
    });

    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: 'Error updating staff' });
  }
});

// @route   DELETE /api/registrars/:id
router.delete('/:id', async (req, res) => {
  try {
    let staff = await Registrar.findById(req.params.id);
    let model = Registrar;

    if (!staff) {
        staff = await Admin.findById(req.params.id);
        model = Admin;
    }

    if (!staff) return res.status(404).json({ message: 'User not found' });

    const name = staff.name;
    await model.findByIdAndDelete(req.params.id);

    await ActivityLog.create({
      userEmail: req.user.email,
      userName: req.user.name || 'Super Admin',
      action: 'User Deleted',
      type: '------',
      status: 'Successful',
      details: `Deleted staff account: ${name}`
    });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: 'Error deleting user' });
  }
});

module.exports = router;
