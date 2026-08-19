const Alumni = require('../models/Users/Alumni');
const mongoose = require('mongoose');
const { HttpStatus } = require('../config/constants');

const AlumniController = {
    // Get all alumni
    getAllAlumni: async (req, res) => {
        try {
            const alumni = await Alumni.find().sort({ createdAt: -1 });
            res.status(HttpStatus.OK).json({
                success: true,
                message: 'Alumni retrieved successfully',
                data: alumni
            });
        } catch (error) {
            console.error('Error fetching alumni:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: 'Failed to fetch alumni', 
                data: error.message 
            });
        }
    },

    // Add a new alumni
    addAlumni: async (req, res) => {
        try {
            const { firstName, lastName, email, password, studentId } = req.body;

            if (!firstName || !lastName || !email || !password) {
                return res.status(HttpStatus.BAD_REQUEST).json({ 
                    success: false, 
                    message: 'Please provide all required fields (firstName, lastName, email, password)',
                    data: null
                });
            }

            const existingAlumni = await Alumni.findOne({ email });
            if (existingAlumni) {
                return res.status(HttpStatus.BAD_REQUEST).json({ 
                    success: false, 
                    message: 'A user with this email already exists',
                    data: null
                });
            }

            const finalStudentId = studentId || `ALU-${Date.now().toString().slice(-6)}`;

            const newAlumni = new Alumni({
                firstName,
                lastName,
                email,
                password,
                studentId: finalStudentId,
                role: 'alumni'
            });

            await newAlumni.save();

            const alumniResponse = newAlumni.toObject();
            delete alumniResponse.password;

            res.status(HttpStatus.CREATED).json({ 
                success: true, 
                message: 'Alumni successfully added', 
                data: alumniResponse 
            });
        } catch (error) {
            console.error('Error adding alumni:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: 'Failed to add alumni', 
                data: error.message 
            });
        }
    },

    // Delete an alumni by ID
    deleteAlumni: async (req, res) => {
        try {
            const { id } = req.params;
            
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(HttpStatus.BAD_REQUEST).json({ 
                    success: false, 
                    message: 'Invalid alumni ID', 
                    data: null 
                });
            }

            const deletedAlumni = await Alumni.findByIdAndDelete(id);

            if (!deletedAlumni) {
                return res.status(HttpStatus.NOT_FOUND).json({ 
                    success: false, 
                    message: 'Alumni not found', 
                    data: null 
                });
            }

            res.status(HttpStatus.OK).json({ 
                success: true, 
                message: 'Alumni successfully deleted', 
                data: deletedAlumni 
            });
        } catch (error) {
            console.error('Error deleting alumni:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: 'Failed to delete alumni', 
                data: error.message 
            });
        }
    },

    // Update alumni status
    updateAlumniStatus: async (req, res) => {
        try {
            const { id } = req.params;
            const { status } = req.body;

            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.status(HttpStatus.BAD_REQUEST).json({ 
                    success: false, 
                    message: 'Invalid alumni ID', 
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

            const updatedAlumni = await Alumni.findByIdAndUpdate(
                id,
                { status },
                { new: true }
            );

            if (!updatedAlumni) {
                return res.status(HttpStatus.NOT_FOUND).json({ 
                    success: false, 
                    message: 'Alumni not found', 
                    data: null 
                });
            }

            res.status(HttpStatus.OK).json({ 
                success: true, 
                message: 'Alumni status updated successfully', 
                data: updatedAlumni 
            });
        } catch (error) {
            console.error('Error updating alumni status:', error);
            res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ 
                success: false, 
                message: 'Failed to update alumni status', 
                data: error.message 
            });
        }
    },

    // Update alumni profile (Ownership check applied)
    updateAlumniProfile: async (req, res) => {
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

            const { firstName, lastName, email } = req.body;

            const updatedAlumni = await Alumni.findByIdAndUpdate(
                id,
                { firstName, lastName, email },
                { new: true, runValidators: true }
            );

            if (!updatedAlumni) {
                return res.status(HttpStatus.NOT_FOUND).json({ 
                    success: false, 
                    message: 'Alumni not found', 
                    data: null 
                });
            }

            const alumniResponse = updatedAlumni.toObject();
            delete alumniResponse.password;

            res.status(HttpStatus.OK).json({ 
                success: true, 
                message: 'Profile updated successfully', 
                data: alumniResponse 
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

module.exports = AlumniController;
