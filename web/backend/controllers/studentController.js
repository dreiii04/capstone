const Student = require('../models/Users/Student');
const mongoose = require('mongoose');
const { HttpStatus } = require('../config/constants');

const StudentController = {
    // Get all students
    getAllStudents: async (req, res) => {
        try {
            const students = await Student.find().sort({ createdAt: -1 });
            res.status(HttpStatus.OK).json({
                success: true,
                message: 'Students retrieved successfully',
                data: students
            });
        } catch (error) {
            console.error('Error fetching students:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: 'Failed to fetch students', 
                data: error.message 
            });
        }
    },

    // Add a new student
    addStudent: async (req, res) => {
        try {
            const { firstName, lastName, email, password, programLevel, studentId } = req.body;

            if (!firstName || !lastName || !email || !password) {
                return res.status(HttpStatus.BAD_REQUEST).json({ 
                    success: false, 
                    message: 'Please provide all required fields (firstName, lastName, email, password)',
                    data: null
                });
            }

            const existingStudent = await Student.findOne({ email });
            if (existingStudent) {
                return res.status(HttpStatus.BAD_REQUEST).json({ 
                    success: false, 
                    message: 'A user with this email already exists',
                    data: null
                });
            }

            const finalStudentId = studentId || `STU-${Date.now().toString().slice(-6)}`;

            const newStudent = new Student({
                firstName,
                lastName,
                email,
                password,
                studentId: finalStudentId,
                programLevel: programLevel || 'Bachelors',
                role: 'student'
            });

            await newStudent.save();

            const studentResponse = newStudent.toObject();
            delete studentResponse.password;

            res.status(HttpStatus.CREATED).json({ 
                success: true, 
                message: 'Student successfully added', 
                data: studentResponse 
            });
        } catch (error) {
            console.error('Error adding student:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: 'Failed to add student', 
                data: error.message 
            });
        }
    },

    // Delete a student by ID
    deleteStudent: async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(HttpStatus.BAD_REQUEST).json({ 
                    success: false, 
                    message: 'Invalid student ID', 
                    data: null 
                });
            }

            const deletedStudent = await Student.findByIdAndDelete(id);

            if (!deletedStudent) {
                return res.status(HttpStatus.NOT_FOUND).json({ 
                    success: false, 
                    message: 'Student not found', 
                    data: null 
                });
            }

            res.status(HttpStatus.OK).json({ 
                success: true, 
                message: 'Student successfully deleted', 
                data: deletedStudent 
            });
        } catch (error) {
            console.error('Error deleting student:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: 'Failed to delete student', 
                data: error.message 
            });
        }
    },

    // Update student status
    updateStudentStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(HttpStatus.BAD_REQUEST).json({ 
                    success: false, 
                    message: 'Invalid student ID', 
                    data: null 
                });
            }

            if (!['Active', 'Inactive'].includes(status)) {
                return res.status(HttpStatus.BAD_REQUEST).json({ 
                    success: false, 
                    message: 'Invalid status', 
                    data: null 
                });
            }

            const updatedStudent = await Student.findByIdAndUpdate(
                id,
                { status },
                { new: true }
            );

            if (!updatedStudent) {
                return res.status(HttpStatus.NOT_FOUND).json({ 
                    success: false, 
                    message: 'Student not found', 
                    data: null 
                });
            }

            res.status(HttpStatus.OK).json({ 
                success: true, 
                message: 'Student status updated successfully', 
                data: updatedStudent 
            });
        } catch (error) {
            console.error('Error updating student status:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: 'Failed to update student status', 
                data: error.message 
            });
        }
    },

    // Update student profile (Ownership check applied)
    updateStudentProfile: async (req, res) => {
        try {
            const { id } = req.params;
            
            // SECURITY: Ownership check or Super Admin override
            if (req.user.id !== id && req.user.role !== 'super admin') {
                return res.status(HttpStatus.FORBIDDEN).json({
                    success: false,
                    message: 'Unauthorized: You can only edit your own profile',
                    data: null
                });
            }

            // Only allow safe fields to be updated
            const { firstName, lastName, email } = req.body;

            const updatedStudent = await Student.findByIdAndUpdate(
                id,
                { firstName, lastName, email },
                { new: true, runValidators: true }
            );

            if (!updatedStudent) {
                return res.status(HttpStatus.NOT_FOUND).json({ 
                    success: false, 
                    message: 'Student not found', 
                    data: null 
                });
            }

            // Remove password from response
            const studentResponse = updatedStudent.toObject();
            delete studentResponse.password;

            res.status(HttpStatus.OK).json({ 
                success: true, 
                message: 'Profile updated successfully', 
                data: studentResponse 
            });
        } catch (error) {
            console.error('Error updating profile:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: 'Failed to update profile', 
                data: error.message 
            });
        }
    }
};

module.exports = StudentController;
