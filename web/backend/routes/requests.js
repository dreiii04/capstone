const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const Request = require('../models/Request');
const ActivityLog = require('../models/ActivityLog');
const { protect, registrarOrSuperAdmin } = require('../middleware/authMiddleware');
const { isEndUser } = require('../services/sessionService');
const { ownerQuery } = require('../utils/ownership');
const {
  getDocumentPrice,
  DEFAULT_PROCESSING_FEE,
  resolveRequestPricing,
} = require('../services/documentPricingService');

// Helper to enrich a request with student profile data if missing
const enrichRequestWithStudentData = async (reqObj) => {
  try {
    const Student = require('../models/Users/Student');
    const Alumni = require('../models/Users/Alumni');
    let student = null;
    
    // 1. Try to find by studentId if present
    if (reqObj.studentId) {
      student = await Student.findOne({ studentId: reqObj.studentId });
      if (!student) {
        student = await Alumni.findOne({ studentId: reqObj.studentId });
      }
    }
    
    // 2. We no longer guess by name to maintain data integrity. 
    // If studentId isn't provided, we can't reliably link the profile.
    
    if (student) {
      reqObj.studentId = student.studentId || reqObj.studentId || '';
      reqObj.course = student.course || reqObj.course || '';
      reqObj.yearLevel = student.yearLevel || reqObj.yearLevel || '';
      
      // Upgrade generic "User" names with their real registered name
      if (String(reqObj.name || '').toLowerCase() === 'user' && (student.firstName || student.lastName)) {
        reqObj.name = `${student.firstName || ''} ${student.lastName || ''}`.trim();
      }
    }
  } catch (err) {
    console.error('Error enriching request with student data:', err);
  }
  return reqObj;
};

// Get all requests (Filtered for students/alumni if authenticated, unfiltered for staff/admin)
router.get('/', protect, async (req, res) => {
  try {
    let query = {};
    
    // Apply smart role-based filtering since we now require authentication
    if (isEndUser(req.user)) {
      query = ownerQuery(req.user);
    }

    const requests = await Request.find(query).sort({ dateRequested: 1 });
    
    // Dynamically enrich requests with student profile details (ID, Course, Year) for seamless UX
    const enrichedRequests = await Promise.all(
      requests.map(async (r) => {
        const request = await enrichRequestWithStudentData(r.toObject());
        return {
          ...request,
          documentFile: request.hasDocument &&
            (!isEndUser(req.user) || request.status === 'Released')
            ? `/api/requests/${encodeURIComponent(request.requestId)}/document`
            : '',
          ...resolveRequestPricing(request),
        };
      })
    );
    
    res.json(enrichedRequests);
  } catch (error) {
    res.status(500).json({ message: 'Error fetching requests' });
  }
});

// Update a request (Logged)
router.put('/:id', protect, registrarOrSuperAdmin, async (req, res) => {
    try {
        const { status, forceOverride, rejectionReason } = req.body;

        // Force override (payment bypass) requires super admin role
        if (forceOverride && req.user.role !== 'super admin') {
            return res.status(403).json({ message: 'Only super admins can perform force overrides.' });
        }

        const request = await Request.findOne({ requestId: req.params.id });
        if (!request) return res.status(404).json({ message: 'Request not found' });

        if (status) {
            const allowedStatuses = new Set([
                'Pending',
                'In Process',
                'Released',
                'Rejected',
            ]);
            if (!allowedStatuses.has(status)) {
                return res.status(400).json({ message: 'Invalid request status.' });
            }

            const normalTransitions = {
                Pending: new Set(['Rejected']),
                'In Process': new Set(['Released', 'Rejected']),
                Released: new Set(),
                Rejected: new Set(),
            };
            const statusChanged = status !== request.status;
            const transitionAllowed = normalTransitions[request.status]?.has(status);
            if (statusChanged && !transitionAllowed && !forceOverride) {
                return res.status(409).json({
                    message: `Request cannot move from ${request.status} to ${status}.`,
                });
            }
            if (status === 'Released' && !request.hasDocument) {
                return res.status(409).json({
                    message: 'Attach the completed document before releasing the request.',
                });
            }
            const documentType = String(request.documentType || '').toLowerCase();
            const blockchainRequired = documentType.includes('transcript') ||
                documentType.includes('tor') || documentType.includes('diploma');
            if (status === 'Released' && blockchainRequired &&
                request.blockchainStatus !== 'Recorded') {
                return res.status(409).json({
                    message: 'Record the issued document on the blockchain before releasing it.',
                });
            }
            request.status = status;
            if (status === 'In Process') request.rejectionReason = '';
        }
        if (rejectionReason !== undefined) request.rejectionReason = rejectionReason;
        await request.save();

        // Log activity — distinguish force overrides
        const actionLabel = forceOverride ? 'Force Override' : 'Update Request';
        await ActivityLog.create({
            userEmail: req.user.email,
            userName: req.user.name || 'User',
            action: actionLabel,
            type: '------',
            status: 'Successful',
            details: forceOverride
                ? `[SUPER ADMIN] Bypassed verification for request ${req.params.id}, status set to ${status}`
                : `Updated request ${req.params.id} status to ${status || 'unchanged'}`
        });

        // Auto-notify student about request status update
        if (status) {
            try {
                const Notification = require('../models/Notification');
                let message = `Your request #${request.requestId} for ${request.documentType} is now ${status}!`;
                if (status === 'Released') {
                    message = `Your request #${request.requestId} for ${request.documentType} is ready for pickup!`;
                } else if (status === 'Rejected' && request.rejectionReason) {
                    const readableReason = request.rejectionReason === 'incomplete' ? 'Incomplete Requirements' :
                                           request.rejectionReason === 'invalid' ? 'Invalid Information' :
                                           request.rejectionReason === 'unpaid' ? 'Payment Issue' :
                                           request.rejectionReason;
                    message = `Your request #${request.requestId} for ${request.documentType} was rejected. Reason: ${readableReason}`;
                }
                
                await Notification.create({
                    userId: request.userId || '',
                    message,
                    isRead: false,
                    email: request.email || ''
                });
            } catch (err) {
                console.error('Failed to create request status update notification:', err);
            }
        }

        res.json(request);
    } catch (error) {
        res.status(500).json({ message: 'Error updating request' });
    }
});

// Generate Hash for request (Logged)
router.post('/:id/generate-hash', protect, registrarOrSuperAdmin, (_req, res) => {
    return res.status(410).json({
        message: 'Hashes are generated only from the final uploaded PDF.',
    });
});

// Create a new request (Logged)
router.post('/', protect, async (req, res) => {
  try {
    const documentType = String(req.body.documentType || req.body.docName || '').trim();
    if (!documentType || documentType.length > 100) {
      return res.status(400).json({ message: 'A valid document type is required.' });
    }
    const requestId = `REQ-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    
    // Support either body-passed fields or JWT payload
    let studentId = req.body.studentId || '';
    let course = req.body.course || '';
    let yearLevel = req.body.yearLevel || '';
    let userName = isEndUser(req.user)
      ? req.user.name || 'User'
      : req.body.name || req.user.name || 'User';
    
    try {
      const Student = require('../models/Users/Student');
      const Alumni = require('../models/Users/Alumni');
      let student = await Student.findById(req.user.id);
      if (!student) student = await Alumni.findById(req.user.id);
      
      // Fallback 1: Resolve by email
      if (!student && req.user.email) {
        student = await Student.findOne({ email: req.user.email });
        if (!student) student = await Alumni.findOne({ email: req.user.email });
      }
      
      // We removed Fallback 2: Name matching to enforce data integrity

      if (student) {
        const currentProfileName =
          `${student.firstName || ''} ${student.lastName || ''}`.trim();
        if (currentProfileName) userName = currentProfileName;
        if (!studentId) studentId = student.studentId || '';
        if (!course) course = student.course || '';
        if (!yearLevel) yearLevel = student.yearLevel || '';
      }
    } catch (err) {
      console.error('Failed to auto-resolve student profile details for request:', err);
    }

    const documentPrice = getDocumentPrice(documentType);
    const processingFee = DEFAULT_PROCESSING_FEE;
    const totalAmount = documentPrice + processingFee;
    const newDoc = new Request({
      requestId,
      userId: String(req.user.id || ''),
      name: userName,
      studentId,
      course,
      yearLevel,
      status: 'Pending',
      documentType,
      subDocumentType: req.body.subDocumentType || '',
      purpose: req.body.purpose || '',
      otherPurpose: req.body.otherPurpose || '',
      quantity: req.body.quantity || 1,
      email: req.user.email || '',
      documentPrice,
      processingFee,
      totalAmount,
    });
    await newDoc.save();

    // A create response is only successful after the record can be read back
    // from MongoDB. This prevents the mobile client from showing a request that
    // was merely constructed in memory or written to a different code path.
    const persistedRequest = await Request.findOne({
      _id: newDoc._id,
      requestId,
      userId: String(req.user.id || ''),
    }).lean();
    if (!persistedRequest) {
      console.error(`Request ${requestId} could not be verified after creation.`);
      return res.status(503).json({
        success: false,
        persisted: false,
        message: 'The request could not be verified in the database. Please try again.',
      });
    }

    // Logging and notifications are secondary to the request itself. Do not
    // return an error after MongoDB already accepted the request, because that
    // encourages users to retry and create duplicates.
    const Notification = require('../models/Notification');
    const sideEffects = await Promise.allSettled([
      ActivityLog.create({
        userEmail: req.user.email || 'Unknown',
        userName,
        action: 'Create Request',
        type: documentType,
        status: 'Successful',
        details: `Created new document request for: ${userName}`
      }),
      Notification.create({
        message: `New document request (${documentType}) from ${userName}`,
        isRead: false
      }),
    ]);
    sideEffects.forEach((result, index) => {
      if (result.status === 'rejected') {
        const label = index === 0 ? 'activity log' : 'registrar notification';
        console.error(`Failed to create ${label} for request ${requestId}:`, result.reason);
      }
    });

    res.status(201).json({
      success: true,
      persisted: true,
      request: {
        ...persistedRequest,
        ...resolveRequestPricing(persistedRequest),
      },
    });
  } catch (error) {
    console.error('Error creating request:', error);
    res.status(500).json({ message: 'Error creating request' });
  }
});

module.exports = router;
