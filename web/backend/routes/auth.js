const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { protect } = require('../middleware/authMiddleware');
const { validate, registerValidation, loginValidation, updateProfileValidation } = require('../middleware/validationMiddleware');
const { registerLimiter, loginProgressiveLimiter } = require('../middleware/rateLimiterMiddleware');

const Student = require('../models/Users/Student');
const Alumni = require('../models/Users/Alumni');
const SuperAdmin = require('../models/Users/SuperAdmin');
const Registrar = require('../models/Registrar');
const Admin = require('../models/Users/Admin');
const ActivityLog = require('../models/ActivityLog');
const AuthChallenge = require('../models/AuthChallenge');
const { sendOtpEmail } = require('../services/mailService');
const {
  findUserByEmail,
  invalidateSessions,
  issueSession,
  jwtSecret,
  normalizeEmail,
  revokeSession,
  rotateSession,
  serializeUser,
} = require('../services/sessionService');

// In-memory OTP store: { email: { otp, expiresAt, modelName } }
const otpStore = {};

const otpTtlMs = 10 * 60 * 1000;
const strongPassword = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9])\S{8,72}$/;

function challengeHash(kind, ...parts) {
  return crypto
    .createHmac('sha256', jwtSecret())
    .update([kind, ...parts].join(':'))
    .digest('hex');
}

async function sendOtp(email, otp, purpose) {
  return sendOtpEmail({ email, otp, purpose });
}

function otpDeliveryFailure(error) {
  if (error?.code === 'SMTP_NOT_CONFIGURED') {
    return {
      status: 503,
      message: 'Email verification is temporarily unavailable. Please contact support.',
    };
  }
  return {
    status: 502,
    message: 'Unable to send the verification email. Please try again later.',
  };
}

async function syncOwnedRecordIdentity(user) {
  const userId = String(user?._id || '');
  const email = normalizeEmail(user?.email);
  if (!userId || !email) return;
  const Request = require('../models/Request');
  const Transaction = require('../models/Transaction');
  const Notification = require('../models/Notification');
  const Refund = require('../models/Refund');
  const { ownerQuery } = require('../utils/ownership');
  const results = await Promise.allSettled([
    Request.updateMany(
      ownerQuery({ id: userId, email }),
      { $set: { userId, email } },
    ),
    Transaction.updateMany(
      ownerQuery(
        { id: userId, email },
        { emailField: 'payerEmail' },
      ),
      { $set: { userId, payerEmail: email } },
    ),
    Notification.updateMany(
      ownerQuery({ id: userId, email }),
      { $set: { userId, email } },
    ),
    Refund.updateMany(
      ownerQuery(
        { id: userId, email },
        { emailField: 'studentEmail' },
      ),
      { $set: { userId, studentEmail: email } },
    ),
  ]);
  if (results.some((result) => result.status === 'rejected')) {
    console.warn('Some legacy records could not be linked to the stable user ID.');
  }
}

// Direct registration cannot prove control of the submitted email. Clients
// must use request-otp followed by verify-otp.
router.post('/register', registerLimiter, (_req, res) => res.status(409).json({
  success: false,
  message: 'Use the verified registration flow.',
}));

router.post('/legacy/register', (_req, res) => res.status(410).json({
  success: false,
  message: 'This registration flow is no longer available.',
}), registerLimiter, registerValidation, validate, async (req, res) => {
  try {
    const { firstName, lastName, password, role, studentId, course, yearLevel, phoneNumber } = req.body;
    const email = normalizeEmail(req.body.email);

    // Check if user already exists
    const existingStudent = await Student.findOne({ email });
    if (existingStudent) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }

    if (studentId) {
      const existingIdStudent = await Student.findOne({ studentId });
      const existingIdAlumni = await Alumni.findOne({ studentId });
      if (existingIdStudent || existingIdAlumni) {
        return res.status(400).json({ success: false, message: 'Student ID already registered' });
      }
    }

    const isAlumni = role === 'alumni';
    const UserModel = isAlumni ? Alumni : Student;

    // Create new user
    const user = await UserModel.create({
      firstName,
      lastName,
      email,
      password, // Model pre-save hook hashes this
      role: role || 'student',
      studentId: studentId || null,
      course: course || '',
      yearLevel: yearLevel || '',
      phoneNumber: phoneNumber || ''
    });

    const session = await issueSession(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      ...session,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Mobile registration uses a verified two-step flow. Challenges are stored in
// MongoDB so verification still works after a serverless cold start.
router.post('/register/request-otp', registerLimiter, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const firstName = String(req.body.firstName || '').trim();
    const lastName = String(req.body.lastName || '').trim();
    const password = String(req.body.password || '');
    const studentStatus = String(req.body.studentStatus || '').trim().toLowerCase();
    const educationalLevel = String(req.body.educationalLevel || '').trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(email) || firstName.length < 2 ||
        lastName.length < 2 || !strongPassword.test(password) ||
        !['student', 'alumni', 'former_student'].includes(studentStatus) ||
        !educationalLevel) {
      return res.status(400).json({ success: false, message: 'Invalid registration details.' });
    }
    if (await findUserByEmail(email)) {
      return res.status(409).json({ success: false, message: 'Email already registered.' });
    }

    const challengeToken = crypto.randomBytes(32).toString('hex');
    const otp = crypto.randomInt(100000, 1000000).toString();
    const passwordHash = await bcrypt.hash(password, 12);
    const payload = {
      firstName,
      lastName,
      passwordHash,
      role: studentStatus === 'student' ? 'student' : 'alumni',
      studentStatus,
      educationalLevel,
      course: String(req.body.program || '').trim(),
      program: String(req.body.program || '').trim(),
      yearGraduated: String(req.body.yearGraduated || '').trim(),
      lastYearAttended: String(req.body.lastYearAttended || '').trim(),
      lastGradeLevelCompleted: String(req.body.lastGradeLevelCompleted || '').trim(),
      lastYearLevelCompleted: String(req.body.lastYearLevelCompleted || '').trim(),
      status: 'Inactive',
    };
    await AuthChallenge.findOneAndUpdate(
      { purpose: 'registration', email },
      {
        challengeTokenHash: challengeHash('registration-token', challengeToken),
        otpHash: challengeHash('registration-otp', email, otp),
        payload,
        attempts: 0,
        expiresAt: new Date(Date.now() + otpTtlMs),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    try {
      await sendOtp(email, otp, 'registration');
    } catch (deliveryError) {
      await AuthChallenge.deleteOne({
        purpose: 'registration',
        email,
        challengeTokenHash: challengeHash('registration-token', challengeToken),
      }).catch(() => {});
      const failure = otpDeliveryFailure(deliveryError);
      console.error('Registration OTP email delivery failed.');
      return res.status(failure.status).json({
        success: false,
        message: failure.message,
      });
    }
    return res.json({
      success: true,
      message: 'Verification code sent.',
      challengeToken,
      expiresInSeconds: otpTtlMs / 1000,
      ...(process.env.NODE_ENV !== 'production' && process.env.OTP_DEV_MODE === 'true'
        ? { otp }
        : {}),
    });
  } catch (error) {
    console.error('Registration OTP request failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to start registration.' });
  }
});

router.post('/register/verify-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    const challengeToken = String(req.body.challengeToken || '').trim();
    if (!/^\d{6}$/.test(otp) || !/^[a-f0-9]{64}$/.test(challengeToken)) {
      return res.status(400).json({ success: false, message: 'Invalid verification request.' });
    }
    const challenge = await AuthChallenge.findOne({
      purpose: 'registration',
      email,
      expiresAt: { $gt: new Date() },
    });
    const valid = challenge && challenge.attempts < 5 &&
      challenge.challengeTokenHash === challengeHash('registration-token', challengeToken) &&
      challenge.otpHash === challengeHash('registration-otp', email, otp);
    if (!valid) {
      if (challenge) {
        challenge.attempts += 1;
        if (challenge.attempts >= 5) await challenge.deleteOne();
        else await challenge.save();
      }
      return res.status(401).json({ success: false, message: 'Invalid or expired verification code.' });
    }
    const consumed = await AuthChallenge.findOneAndDelete({
      _id: challenge._id,
      otpHash: challenge.otpHash,
    });
    if (!consumed || await findUserByEmail(email)) {
      return res.status(409).json({ success: false, message: 'Registration is no longer available.' });
    }
    const UserModel = consumed.payload.role === 'student' ? Student : Alumni;
    const now = new Date();
    const { passwordHash, ...registrationData } = consumed.payload;
    const result = await UserModel.collection.insertOne({
      ...registrationData,
      email,
      password: passwordHash,
      sessionVersion: 0,
      refreshTokens: [],
      createdAt: now,
      updatedAt: now,
    });
    return res.status(201).json({
      success: true,
      userId: String(result.insertedId),
      message: 'Account created successfully.',
    });
  } catch (error) {
    console.error('Registration verification failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to complete registration.' });
  }
});

// @route   POST /api/auth/login
// @desc    Authenticate user and get token
router.post('/login', loginProgressiveLimiter, loginValidation, validate, async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const { password } = req.body;
    const user = await findUserByEmail(email, { includePassword: true });

    if (!user) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Check account status
    if (user.status && ['inactive', 'stopped'].includes(user.status.toLowerCase())) {
      return res.status(403).json({ success: false, message: 'Account is currently inactive. Please contact an administrator.' });
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Repair legacy records on every successful login. Ownership is based on
    // the immutable account ID/email, never the editable display name.
    await syncOwnedRecordIdentity(user);

    const session = await issueSession(user);

    // Log activity
    await ActivityLog.create({
      userEmail: user.email,
      userName: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'User',
      action: 'Login',
      type: '------',
      status: 'Successful',
      details: `${user.role} logged into the system`
    });

    // Clear the progressive rate limiter on success
    const LoginLockout = require('../models/LoginLockout');
    if (req.clientIp) {
      await LoginLockout.deleteOne({ ip: req.clientIp });
    }

    res.json({
      success: true,
      message: 'Logged in successfully',
      ...session,
      user: serializeUser(user),
    });
  } catch (error) {
    console.error('Login error:', error.message);
    console.error('Login error stack:', error.stack);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const refreshToken = String(req.body.refreshToken || '').trim();
    if (!/^\S+@\S+\.\S+$/.test(email) || !/^[a-f0-9]{96}$/.test(refreshToken)) {
      return res.status(400).json({ success: false, message: 'Invalid refresh request.' });
    }
    const rotated = await rotateSession(email, refreshToken);
    if (!rotated) {
      return res.status(401).json({ success: false, message: 'Refresh session is invalid or expired.' });
    }
    return res.json({
      success: true,
      message: 'Session refreshed.',
      ...rotated.session,
      user: serializeUser(rotated.user),
    });
  } catch (_error) {
    return res.status(401).json({ success: false, message: 'Refresh session is invalid or expired.' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const refreshToken = String(req.body.refreshToken || '').trim();
    if (email && /^[a-f0-9]{96}$/.test(refreshToken)) {
      await revokeSession(email, refreshToken);
    }
    return res.json({ success: true, message: 'Logged out.' });
  } catch (_error) {
    return res.json({ success: true, message: 'Logged out.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'A valid email is required.' });
    }
    const response = {
      success: true,
      message: 'If an account exists, a verification code has been sent.',
    };
    const user = await findUserByEmail(email);
    if (!user) return res.json(response);

    const otp = crypto.randomInt(100000, 1000000).toString();
    await AuthChallenge.findOneAndUpdate(
      { purpose: 'password-reset', email },
      {
        challengeTokenHash: challengeHash('password-reset-user', String(user._id)),
        otpHash: challengeHash('password-reset-otp', email, otp),
        payload: { userId: String(user._id) },
        attempts: 0,
        expiresAt: new Date(Date.now() + otpTtlMs),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    await sendOtp(email, otp, 'password-reset');
    return res.json({
      ...response,
      ...(process.env.NODE_ENV !== 'production' && process.env.OTP_DEV_MODE === 'true'
        ? { otp }
        : {}),
    });
  } catch (error) {
    console.error('Forgot password request failed:', error.message);
    return res.status(500).json({ success: false, message: 'Unable to send a verification code.' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    const otp = String(req.body.otp || '').trim();
    const challenge = await AuthChallenge.findOne({
      purpose: 'password-reset',
      email,
      expiresAt: { $gt: new Date() },
    });
    if (!challenge || challenge.attempts >= 5 || !/^\d{6}$/.test(otp) ||
        challenge.otpHash !== challengeHash('password-reset-otp', email, otp)) {
      if (challenge) {
        challenge.attempts += 1;
        if (challenge.attempts >= 5) await challenge.deleteOne();
        else await challenge.save();
      }
      return res.status(401).json({ success: false, message: 'Invalid or expired verification code.' });
    }
    const consumed = await AuthChallenge.findOneAndDelete({
      _id: challenge._id,
      otpHash: challenge.otpHash,
    });
    if (!consumed) {
      return res.status(401).json({ success: false, message: 'Invalid or expired verification code.' });
    }
    const resetToken = crypto.randomBytes(32).toString('hex');
    const tokenHash = challengeHash('password-reset-token', resetToken);
    await AuthChallenge.create({
      purpose: 'password-reset-token',
      email,
      challengeTokenHash: tokenHash,
      otpHash: tokenHash,
      payload: consumed.payload,
      attempts: 0,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000),
    });
    return res.json({ success: true, message: 'OTP verified successfully.', resetToken });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Unable to verify the code.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const resetToken = String(req.body.resetToken || '').trim();
    const targetPassword = String(req.body.newPassword || req.body.password || '');
    if (!/^[a-f0-9]{64}$/.test(resetToken) || !strongPassword.test(targetPassword)) {
      return res.status(400).json({ success: false, message: 'A valid reset token and strong password are required.' });
    }
    const challenge = await AuthChallenge.findOneAndDelete({
      purpose: 'password-reset-token',
      challengeTokenHash: challengeHash('password-reset-token', resetToken),
      expiresAt: { $gt: new Date() },
    });
    if (!challenge) {
      return res.status(401).json({ success: false, message: 'Reset token is invalid or expired.' });
    }
    const user = await findUserByEmail(challenge.email);
    if (!user || String(user._id) !== String(challenge.payload.userId || '')) {
      return res.status(401).json({ success: false, message: 'Reset token is invalid or expired.' });
    }
    user.password = targetPassword;
    await invalidateSessions(user);
    await user.save();
    await ActivityLog.create({
      userEmail: challenge.email,
      userName: 'User',
      action: 'Password Reset',
      type: '------',
      status: 'Successful',
      details: `Password reset completed for ${challenge.email}`,
    });
    return res.json({ success: true, message: 'Password reset successfully.' });
  } catch (_error) {
    return res.status(500).json({ success: false, message: 'Unable to reset password.' });
  }
});

router.use('/legacy', (_req, res) => res.status(410).json({
  success: false,
  message: 'This authentication flow is no longer available.',
}));

router.post('/legacy/forgot-password', async (req, res) => {
  try {
    const email = normalizeEmail(req.body.email);
    if (!email) return res.status(400).json({ success: false, message: 'Email is required' });

    let user = null;
    let modelName = '';

    user = await Student.findOne({ email });
    if (user) modelName = 'Student';
    
    if (!user) {
      user = await Alumni.findOne({ email });
      if (user) modelName = 'Alumni';
    }

    if (!user) {
      user = await SuperAdmin.findOne({ email });
      if (user) modelName = 'SuperAdmin';
    }

    if (!user) {
      user = await Registrar.findOne({ email });
      if (user) modelName = 'Registrar';
    }

    if (!user) {
      user = await Admin.findOne({ email });
      if (user) modelName = 'Admin';
    }

    if (!user) {
      return res.status(404).json({ success: false, message: 'No account found with that email' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000;

    otpStore[email] = { otp, expiresAt, modelName };

    await sendOtp(email, otp, 'password-reset');
    void ({
      from: `"VeriFitor System" <${process.env.SMTP_EMAIL}>`,
      to: email,
      subject: 'VeriFitor - Password Reset OTP',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2f3947;">Password Reset Request</h2>
          <p>You requested to reset your password. Use the OTP below:</p>
          <div style="background: #f4f4f4; padding: 20px; text-align: center; border-radius: 8px; margin: 20px 0;">
            <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #2f3947;">${otp}</span>
          </div>
          <p style="color: #666;">This OTP expires in <strong>10 minutes</strong>.</p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="color: #999; font-size: 11px; text-align: center;">VeriFitor — Document Verification System</p>
        </div>
      `
    });

    res.json({ success: true, message: 'OTP sent to your email' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ success: false, message: 'Error sending OTP email' });
  }
});

router.post('/legacy/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;
    const stored = otpStore[email];
    if (!stored || Date.now() > stored.expiresAt || stored.otp !== otp) {
      return res.status(400).json({ success: false, message: 'Invalid or expired OTP' });
    }

    const resetToken = jwt.sign(
      { email, modelName: stored.modelName },
      jwtSecret(),
      { algorithm: 'HS256', expiresIn: '15m' }
    );

    delete otpStore[email];
    res.json({ success: true, message: 'OTP verified successfully', resetToken });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

router.post('/legacy/reset-password', async (req, res) => {
  try {
    const { resetToken, newPassword, password } = req.body;
    const decoded = jwt.verify(resetToken, jwtSecret(), { algorithms: ['HS256'] });
    const { email, modelName } = decoded;

    const targetPassword = newPassword || password;
    if (!targetPassword) {
      return res.status(400).json({ success: false, message: 'New password is required' });
    }

    let userModel;
    if (modelName === 'Student') userModel = Student;
    else if (modelName === 'Alumni') userModel = Alumni;
    else if (modelName === 'SuperAdmin') userModel = SuperAdmin;
    else if (modelName === 'Admin') userModel = Admin;
    else userModel = Registrar;

    const user = await userModel.findOne({ email });
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    user.password = targetPassword;
    await invalidateSessions(user);
    await user.save();

    await ActivityLog.create({
      userEmail: email,
      userName: 'User',
      action: 'Password Reset',
      type: '------',
      status: 'Successful',
      details: `Password reset completed for ${email}`
    });

    res.json({ success: true, message: 'Password reset successfully' });
  } catch (error) {
    console.error('Password reset error:', error);
    res.status(500).json({ success: false, message: 'Error resetting password' });
  }
});

router.get('/profile', protect, async (req, res) => {
  try {
    return res.json(serializeUser(req.authUser));
  } catch (error) {
    res.status(500).json({ message: 'Server error' });
  }
});

router.put('/profile', protect, updateProfileValidation, validate, async (req, res) => {
  try {
    const { name, firstName, lastName, profilePic, course, yearLevel, phoneNumber } = req.body;
    
    const userModel = req.authUser.constructor;

    const updateData = {};
    if (name) {
      updateData.name = name;
      if (req.user.role === 'student' || req.user.role === 'alumni') {
        const parts = name.trim().split(' ');
        updateData.firstName = parts[0];
        updateData.lastName = parts.slice(1).join(' ') || ' ';
      }
    }
    if (firstName) updateData.firstName = firstName;
    if (lastName) updateData.lastName = lastName;
    if (profilePic) updateData.profilePic = profilePic;
    if (course) updateData.course = course;
    if (yearLevel) updateData.yearLevel = yearLevel;
    if (phoneNumber) updateData.phoneNumber = phoneNumber;

    const updatedUser = await userModel.findByIdAndUpdate(
      req.user.id,
      updateData,
      { new: true, runValidators: true },
    );
    if (!updatedUser) return res.status(404).json({ success: false, message: 'User not found.' });
    await syncOwnedRecordIdentity(updatedUser);
    return res.json(serializeUser(updatedUser));
  } catch (error) {
    res.status(500).json({ message: 'Error updating profile' });
  }
});

router.put('/change-password', protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    
    const userModel = req.authUser.constructor;

    const user = await userModel.findById(req.user.id).select('+password');
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });
    if (!strongPassword.test(String(newPassword || ''))) {
      return res.status(400).json({
        success: false,
        message: 'Password must be 8-72 characters with uppercase, lowercase, number, symbol, and no spaces.',
      });
    }
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) return res.status(400).json({ success: false, message: 'Current password incorrect' });

    user.password = newPassword;
    await invalidateSessions(user);
    await user.save();
    const session = await issueSession(user);
    res.json({ success: true, message: 'Password updated successfully', ...session });
  } catch (error) {
    res.status(500).json({ message: 'Error updating password' });
  }
});

module.exports = router;
