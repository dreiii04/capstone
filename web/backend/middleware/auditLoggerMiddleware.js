const AuditLog = require('../models/AuditLog');
const mongoose = require('mongoose');

const auditLoggerMiddleware = (req, res, next) => {
  // Capture start time
  const start = process.hrtime();

  res.on('finish', async () => {
    // Calculate duration in milliseconds
    const diff = process.hrtime(start);
    const durationMs = Math.round((diff[0] * 1e9 + diff[1]) / 1e6);

    const method = req.method;
    const path = req.originalUrl;
    const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    const statusCode = res.statusCode;
    
    // Attempt to extract user email/ID if authenticated
    let userEmail = 'Anonymous';
    if (req.user && req.user.email) {
      userEmail = req.user.email;
    } else if (req.user && req.user.id) {
      userEmail = req.user.id;
    }

    try {
      // Save log to MongoDB
      if (mongoose.connection.readyState === 1) {
        await AuditLog.create({
          method,
          path,
          ip,
          userEmail,
          statusCode,
          durationMs
        });
      }
    } catch (err) {
      console.error('Failed to save audit log to database:', err);
    }

    // Console logging for errors
    if (statusCode >= 400 && statusCode < 500) {
      console.warn(`[WARNING] ${method} ${path} - Status: ${statusCode} - ${durationMs}ms`);
    } else if (statusCode >= 500) {
      console.error(`[ERROR] ${method} ${path} - Status: ${statusCode} - ${durationMs}ms`);
    }
  });

  next();
};

module.exports = auditLoggerMiddleware;
