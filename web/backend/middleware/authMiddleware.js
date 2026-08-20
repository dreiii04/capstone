const jwt = require('jsonwebtoken');

const {
  findUserById,
  isInactive,
  isStaff,
  jwtSecret,
} = require('../services/sessionService');

function tokenPredatesSecurityChange(decoded, user) {
  const validAfterMs = user?.tokensValidAfter?.getTime?.() || 0;
  if (!validAfterMs) return false;

  // JWT `iat` is stored in whole seconds while MongoDB dates retain
  // milliseconds. Comparing the raw values rejects a token issued immediately
  // after a password change. Session versions provide the exact invalidation
  // boundary; this remains a compatible secondary guard for legacy records.
  const validAfterSeconds = Math.floor(validAfterMs / 1000);
  return Number(decoded?.iat || 0) < validAfterSeconds;
}

const protect = async (req, res, next) => {
  const authorization = String(req.headers.authorization || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return res.status(401).json({ success: false, message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(match[1], jwtSecret(), { algorithms: ['HS256'] });
    const id = String(decoded.sub || decoded.id || '').trim();
    if (!id) throw new Error('Token subject is missing');

    const user = await findUserById(id, decoded.role);
    if (!user || isInactive(user)) {
      return res.status(401).json({ success: false, message: 'Session is no longer valid.' });
    }
    if (Number(decoded.sv || 0) !== Number(user.sessionVersion || 0)) {
      return res.status(401).json({ success: false, message: 'Session is no longer valid.' });
    }
    if (tokenPredatesSecurityChange(decoded, user)) {
      return res.status(401).json({ success: false, message: 'Session is no longer valid.' });
    }

    req.authUser = user;
    req.user = {
      ...decoded,
      id,
      email: user.email,
      role: user.role,
      name: user.name ||
        `${user.firstName || ''} ${user.lastName || ''}`.trim() ||
        'User',
    };
    return next();
  } catch (_error) {
    return res.status(401).json({ success: false, message: 'Session is invalid or expired.' });
  }
};

const superAdminOnly = (req, res, next) => {
  if (String(req.user?.role || '').toLowerCase() === 'super admin') return next();
  return res.status(403).json({ success: false, message: 'Super Admin access required.' });
};

const registrarOrSuperAdmin = (req, res, next) => {
  if (req.user && isStaff(req.user)) return next();
  return res.status(403).json({ success: false, message: 'Staff access required.' });
};

module.exports = {
  protect,
  registrarOrSuperAdmin,
  superAdminOnly,
  tokenPredatesSecurityChange,
};
