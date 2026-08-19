const express = require('express');
const router = express.Router();
const AlumniController = require('../controllers/alumniController');
const { protect, superAdminOnly } = require('../middleware/authMiddleware');

// Route to get all alumni (Super Admin only)
router.get('/', protect, superAdminOnly, AlumniController.getAllAlumni);

// Route to add a new alumni (Super Admin only)
router.post('/', protect, superAdminOnly, AlumniController.addAlumni);

// Route to delete an alumni (Super Admin only)
router.delete('/:id', protect, superAdminOnly, AlumniController.deleteAlumni);

// Route to update alumni status (Super Admin only)
router.put('/:id/status', protect, superAdminOnly, AlumniController.updateAlumniStatus);

// Route for an alumni to update their own profile (Ownership check inside controller)
router.put('/:id/profile', protect, AlumniController.updateAlumniProfile);

module.exports = router;
