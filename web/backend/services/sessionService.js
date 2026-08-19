const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const Student = require('../models/Users/Student');
const Alumni = require('../models/Users/Alumni');
const SuperAdmin = require('../models/Users/SuperAdmin');
const Registrar = require('../models/Registrar');

const ACCESS_TOKEN_TTL_SECONDS = Number.parseInt(
  process.env.JWT_ACCESS_TTL_SECONDS || '86400',
  10
);
const REFRESH_TOKEN_TTL_DAYS = Number.parseInt(
  process.env.JWT_REFRESH_TTL_DAYS || '30',
  10
);

const allUserModels = [Student, Alumni, SuperAdmin, Registrar];

function jwtSecret() {
  const secret = String(process.env.JWT_SECRET || '').trim();
  if (!secret) throw new Error('JWT_SECRET is not configured');
  return secret;
}

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function normalizedRole(value) {
  return String(value || '').trim().toLowerCase();
}

function isEndUser(userOrPayload) {
  const role = normalizedRole(userOrPayload?.role);
  return role === 'student' || role === 'alumni';
}

function isStaff(userOrPayload) {
  const role = normalizedRole(userOrPayload?.role);
  return role === 'super admin' || role.includes('registrar');
}

function isInactive(user) {
  const status = String(user?.status || '').trim().toLowerCase();
  return ['inactive', 'stopped', 'disabled', 'suspended'].includes(status);
}

function modelForRole(role) {
  const normalized = normalizedRole(role);
  if (normalized === 'student') return Student;
  if (normalized === 'alumni') return Alumni;
  if (normalized === 'super admin') return SuperAdmin;
  if (normalized.includes('registrar')) return Registrar;
  return null;
}

async function findUserByEmail(email) {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  for (const Model of allUserModels) {
    const user = await Model.findOne({ email: normalized });
    if (user) return user;
  }
  return null;
}

async function findUserById(id, role) {
  if (!id) return null;
  const preferred = modelForRole(role);
  if (preferred) {
    const user = await preferred.findById(id);
    if (user) return user;
  }
  for (const Model of allUserModels) {
    if (Model === preferred) continue;
    const user = await Model.findById(id);
    if (user) return user;
  }
  return null;
}

function displayName(user) {
  return user?.name ||
    `${user?.firstName || ''} ${user?.lastName || ''}`.trim() ||
    'User';
}

function serializeUser(user) {
  return {
    id: String(user?._id || ''),
    email: normalizeEmail(user?.email),
    role: user?.role || '',
    name: displayName(user),
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    profilePic: user?.profilePic || '',
    studentId: user?.studentId || '',
    course: user?.course || user?.program || '',
    yearLevel: user?.yearLevel || '',
    phoneNumber: user?.phoneNumber || '',
    studentStatus: user?.studentStatus || '',
    educationalLevel: user?.educationalLevel || '',
    yearGraduated: user?.yearGraduated || '',
    lastYearAttended: user?.lastYearAttended || '',
    lastGradeLevelCompleted: user?.lastGradeLevelCompleted || '',
    lastYearLevelCompleted: user?.lastYearLevelCompleted || '',
  };
}

function hashRefreshToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signAccessToken(user) {
  const sessionVersion = Number(user?.sessionVersion || 0);
  const id = String(user?._id || '');
  return jwt.sign(
    {
      sub: id,
      id,
      email: normalizeEmail(user?.email),
      role: user?.role,
      name: displayName(user),
      sv: sessionVersion,
    },
    jwtSecret(),
    {
      algorithm: 'HS256',
      expiresIn: ACCESS_TOKEN_TTL_SECONDS,
      jwtid: crypto.randomBytes(16).toString('hex'),
    }
  );
}

async function issueSession(user) {
  const refreshToken = crypto.randomBytes(48).toString('hex');
  const record = {
    tokenHash: hashRefreshToken(refreshToken),
    sessionVersion: Number(user?.sessionVersion || 0),
    createdAt: new Date(),
    expiresAt: new Date(
      Date.now() + REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000
    ),
  };
  await user.constructor.updateOne(
    { _id: user._id },
    { $push: { refreshTokens: { $each: [record], $slice: -5 } } }
  );
  const accessToken = signAccessToken(user);
  return {
    // Keep `token` until the existing web client migrates to accessToken.
    token: accessToken,
    accessToken,
    refreshToken,
    expiresInSeconds: ACCESS_TOKEN_TTL_SECONDS,
  };
}

async function rotateSession(email, refreshToken) {
  const tokenHash = hashRefreshToken(refreshToken);
  const now = new Date();
  for (const Model of allUserModels) {
    const candidate = await Model.findOne({
      email: normalizeEmail(email),
      'refreshTokens.tokenHash': tokenHash,
    });
    if (!candidate) continue;
    const sessionVersion = Number(candidate.sessionVersion || 0);
    const user = await Model.findOneAndUpdate(
      {
        _id: candidate._id,
        refreshTokens: {
          $elemMatch: {
            tokenHash,
            sessionVersion,
            expiresAt: { $gt: now },
          },
        },
      },
      { $pull: { refreshTokens: { tokenHash } } },
      { new: true }
    );
    if (!user) continue;
    if (isInactive(user)) return null;
    return { user, session: await issueSession(user) };
  }
  return null;
}

async function revokeSession(email, refreshToken) {
  const tokenHash = hashRefreshToken(refreshToken);
  for (const Model of allUserModels) {
    const result = await Model.updateOne(
      { email: normalizeEmail(email) },
      { $pull: { refreshTokens: { tokenHash } } }
    );
    if (result.matchedCount) return;
  }
}

async function invalidateSessions(user) {
  user.sessionVersion = Number(user.sessionVersion || 0) + 1;
  user.refreshTokens = [];
  user.tokensValidAfter = new Date();
}

module.exports = {
  findUserByEmail,
  findUserById,
  invalidateSessions,
  isEndUser,
  isInactive,
  isStaff,
  issueSession,
  jwtSecret,
  normalizeEmail,
  revokeSession,
  rotateSession,
  serializeUser,
};
