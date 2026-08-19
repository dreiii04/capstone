const express = require('express');
const router = express.Router();
const StudentController = require('../controllers/studentController');
const { protect, superAdminOnly } = require('../middleware/authMiddleware');

// Route to get all students (Super Admin only)
router.get('/', protect, superAdminOnly, StudentController.getAllStudents);

// Route to add a new student (Super Admin only)
router.post('/', protect, superAdminOnly, StudentController.addStudent);

// Route to delete a student (Super Admin only)
router.delete('/:id', protect, superAdminOnly, StudentController.deleteStudent);

// Route to update student status (Super Admin only)
router.put('/:id/status', protect, superAdminOnly, StudentController.updateStudentStatus);

// Route for a student to update their own profile (Ownership check inside controller)
router.put('/:id/profile', protect, StudentController.updateStudentProfile);

module.exports = router;
