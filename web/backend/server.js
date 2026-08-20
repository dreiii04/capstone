require('dotenv').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const mongoose = require('mongoose');
const helmet = require('helmet');
const auditLoggerMiddleware = require('./middleware/auditLoggerMiddleware');
const { resolveMongoDatabaseName } = require('./utils/mongoConfig');

const app = express();
const PORT = process.env.PORT || 5000;
const trustProxyHops = Number.parseInt(
  process.env.TRUST_PROXY_HOPS || (process.env.NODE_ENV === 'production' ? '1' : '0'),
  10
);
if (trustProxyHops > 0) app.set('trust proxy', trustProxyHops);

// Apply Helmet Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://apis.google.com", "https://vercel.live"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
      imgSrc: ["'self'", "data:", "https://res.cloudinary.com"],
      connectSrc: ["'self'", "http://localhost:5000", "https://*.vercel.app", "https://vercel.live", "wss://ws-us3.pusher.com"],
      fontSrc: ["'self'", "data:", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      frameAncestors: ["'none'"],
      objectSrc: ["'none'"],
      baseUri: ["'self'"],
      formAction: ["'self'"]
    },
  },
  crossOriginEmbedderPolicy: false, 
  crossOriginOpenerPolicy: { policy: "same-origin" },
  frameguard: { action: 'sameorigin' },
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' }
}));

function normalizeOrigin(value) {
  const candidate = String(value || '').trim();
  if (!candidate) return '';
  try {
    return new URL(candidate).origin;
  } catch (_error) {
    return candidate.replace(/\/+$/, '');
  }
}

const configuredOrigins = String(
  process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || ''
).split(',').map(normalizeOrigin).filter(Boolean);
if (process.env.NODE_ENV !== 'production') {
  configuredOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
}
const allowedOrigins = new Set(configuredOrigins.map(normalizeOrigin));

function validateProductionConfiguration() {
  if (process.env.NODE_ENV !== 'production') return null;
  const jwtSecret = String(process.env.JWT_SECRET || '');
  if (!String(process.env.MONGODB_URI || '').trim()) {
    return 'MONGODB_URI is required in production.';
  }
  if (!String(process.env.MONGODB_DB_NAME || '').trim()) {
    return 'MONGODB_DB_NAME is required in production.';
  }
  if (Buffer.byteLength(jwtSecret, 'utf8') < 32 ||
      /change[_-]?me|replace|example/i.test(jwtSecret)) {
    return 'JWT_SECRET must be a non-placeholder value of at least 32 bytes.';
  }
  if (allowedOrigins.size === 0 || [...allowedOrigins].some((origin) => {
    try {
      return new URL(origin).protocol !== 'https:';
    } catch (_error) {
      return true;
    }
  })) {
    return 'Production requires an explicit HTTPS frontend origin.';
  }
  const hasCloudinary = Boolean(
    String(process.env.CLOUDINARY_URL || '').trim() ||
    (String(process.env.CLOUDINARY_CLOUD_NAME || '').trim() &&
      String(process.env.CLOUDINARY_API_KEY || '').trim() &&
      String(process.env.CLOUDINARY_API_SECRET || '').trim()),
  );
  if (!hasCloudinary) {
    return 'Cloudinary media storage is required in production.';
  }
  const hasGenericSmtp = Boolean(
    String(process.env.SMTP_HOST || '').trim() &&
    String(process.env.SMTP_USER || '').trim() &&
    String(process.env.SMTP_PASS || '') &&
    String(process.env.SMTP_FROM || '').trim(),
  );
  const hasLegacySmtp = Boolean(
    String(process.env.SMTP_EMAIL || '').trim() &&
    String(process.env.SMTP_PASSWORD || ''),
  );
  if (!hasGenericSmtp && !hasLegacySmtp) {
    return 'SMTP email delivery is required in production.';
  }
  if (process.env.OTP_DEV_MODE === 'true') {
    return 'OTP_DEV_MODE must be disabled in production.';
  }
  return null;
}

const configurationError = validateProductionConfiguration();
if (configurationError) {
  console.error(`Production configuration error: ${configurationError}`);
}

const corsOptions = {
  origin(origin, callback) {
    // Native apps and server-to-server requests do not send Origin.
    if (!origin || allowedOrigins.has(normalizeOrigin(origin))) {
      return callback(null, true);
    }
    return callback(new Error('Origin is not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Origin', 'X-Requested-With', 'Accept', 'Content-Type', 'Authorization']
};

app.use(cors(corsOptions));
app.options(/.*/, cors(corsOptions)); // Handle preflight requests natively (Express 5 safe)
app.use(express.json());

// Request logger
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
    next();
});

// Custom Audit Logger (saves to MongoDB)
app.use(auditLoggerMiddleware);

// Only legacy public profile images may be served directly. Academic
// documents, receipts, and generated credentials must remain behind
// authenticated download routes.
app.use('/uploads/profiles', express.static(
    path.join(__dirname, 'uploads', 'profiles'),
    { dotfiles: 'deny', index: false }
));

const connectDB = async () => {
    const uri = String(process.env.MONGODB_URI || '').trim();
    if (!uri) throw new Error('MONGODB_URI is not configured');
    const dbName = resolveMongoDatabaseName(process.env);
    await mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 5000,
    });
    const Request = require('./models/Request');
    await Request.updateMany(
      {
        hasDocument: { $ne: true },
        documentFile: { $exists: true, $type: 'string', $ne: '' },
      },
      { $set: { hasDocument: true } },
    );
    console.log(`MongoDB connected successfully (${mongoose.connection.name})`);
    if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEFAULT_USERS === 'true') {
        await seedUsers();
    }
    return mongoose.connection;
};

// Initial seed function for MongoDB
async function seedUsers() {
    const SuperAdmin = require('./models/Users/SuperAdmin');

    try {
        const email = String(process.env.SEED_SUPER_ADMIN_EMAIL || '')
            .trim()
            .toLowerCase();
        const password = String(process.env.SEED_SUPER_ADMIN_PASSWORD || '');
        if (!email || !password) {
            console.warn(
                'SEED_DEFAULT_USERS is enabled, but no seed administrator ' +
                'credentials were supplied. Skipping account creation.'
            );
            return;
        }
        if (password.length < 12 ||
            !/[a-z]/.test(password) ||
            !/[A-Z]/.test(password) ||
            !/\d/.test(password) ||
            !/[^A-Za-z0-9]/.test(password)) {
            throw new Error(
                'SEED_SUPER_ADMIN_PASSWORD must be at least 12 characters ' +
                'and contain uppercase, lowercase, number, and symbol characters.'
            );
        }

        const existingSuperAdmin = await SuperAdmin.findOne({ email });
        if (!existingSuperAdmin) {
            await SuperAdmin.create({
                email,
                password,
                role: 'super admin',
                name: 'Super Admin'
            });
            console.log(`Development super administrator created (${email}).`);
        }
    } catch (error) {
        console.error(`Error seeding users: ${error.message}`);
    }
}

let databaseError = null;
let databaseReady;

function startDatabaseConnection() {
    databaseReady = connectDB()
        .then((connection) => {
            databaseError = null;
            return connection;
        })
        .catch((error) => {
            databaseError = error;
            console.error(
                process.env.NODE_ENV === 'production'
                    ? 'Database initialization failed.'
                    : `Database initialization failed: ${error.message}`
            );
            return null;
        });
    return databaseReady;
}

async function ensureDatabaseReady() {
    if (mongoose.connection.readyState === 1 && !databaseError) {
        return mongoose.connection;
    }
    if (mongoose.connection.readyState === 2 && databaseReady) {
        return databaseReady;
    }
    return startDatabaseConnection();
}

startDatabaseConnection();

// Do not let requests hang in Mongoose's operation buffer while the database
// is unavailable. Health remains reachable for deployment diagnostics.
app.use('/api', async (req, res, next) => {
    if (req.path === '/health' || req.path === '/test') return next();
    if (configurationError) {
        return res.status(503).json({
            success: false,
            message: 'Service configuration is unavailable.',
        });
    }
    const connection = await ensureDatabaseReady();
    if (!connection || databaseError) {
        return res.status(503).json({ success: false, message: 'Service temporarily unavailable.' });
    }
    return next();
});

// Import Routes
const authRoutes = require('./routes/auth');
const dashboardRoutes = require('./routes/dashboard');
const requestRoutes = require('./routes/requests');
const transactionRoutes = require('./routes/transactions');
const blockchainTransactionRoutes = require('./blockchain_essentials/router/transactionRoutes');
const notificationRoutes = require('./routes/notifications');
const adminRoutes = require('./routes/adminManagement');
const activityLogRoutes = require('./routes/activityLogs');
const registrarRoutes = require('./routes/registrars');
const verifyRoutes = require('./routes/verify');
const torRoutes = require('./routes/tor');
const documentRoutes = require('./routes/documents');
const studentRoutes = require('./routes/students');
const diplomaRoutes = require('./routes/diploma');
const documentUploadRoutes = require('./routes/documentUploads');
const alumniRoutes = require('./routes/alumni');
const uploadRoutes = require('./routes/uploads');
const emailRoutes = require('./routes/email');

console.log('Routes imported successfully');

app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/requests', requestRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/blockchain/transactions', blockchainTransactionRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/admins', adminRoutes);
app.use('/api/activity-logs', activityLogRoutes);
app.use('/api/registrars', registrarRoutes);
app.use('/api/verify', verifyRoutes);
app.use('/api/tor', torRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/v1/students', studentRoutes); // V1 Migration
app.use('/api/diploma', diplomaRoutes);
app.use('/api/requests', documentUploadRoutes);
app.use('/api/v1/alumni', alumniRoutes); // V1 Migration
app.use('/api/upload', uploadRoutes);
app.use('/api/email', emailRoutes);

console.log('Routes mounted successfully');

app.get('/api/health', (req, res) => {
    const ready = mongoose.connection.readyState === 1 &&
        !databaseError && !configurationError;
    res.status(ready ? 200 : 503).json({
        status: ready ? 'ready' : 'unavailable',
        database: ready ? 'connected' : 'disconnected',
        ...(process.env.VERCEL_GIT_COMMIT_SHA
            ? { commit: process.env.VERCEL_GIT_COMMIT_SHA }
            : {})
    });
});

app.get('/', (_req, res) => {
    res.json({
        name: 'VeriFitor Web API',
        health: '/api/health',
        ...(process.env.VERCEL_GIT_COMMIT_SHA
            ? { commit: process.env.VERCEL_GIT_COMMIT_SHA }
            : {})
    });
});

if (process.env.NODE_ENV !== 'production') {
    app.get('/api/test', (req, res) => {
        res.json({ message: 'Test route working' });
    });
}

app.use('/api', (req, res) => {
    res.status(404).json({ success: false, message: 'API route not found.' });
});

// Global error handler for Express 5 async errors
app.use((err, req, res, next) => {
    const isCorsError = err?.message === 'Origin is not allowed by CORS';
    const isUploadValidationError = [
        'Only PNG, JPG and JPEG image files are allowed.',
        'Only image files are allowed!',
        'Only PDF files are allowed',
        'Only CSV files are allowed',
    ].includes(err?.message);
    const isBadRequest = err?.type === 'entity.parse.failed' ||
        err?.name === 'MulterError' || isUploadValidationError;
    const status = isCorsError ? 403 : isBadRequest ? 400 : 500;
    if (process.env.NODE_ENV === 'production') {
        console.error(`Request failed: ${req.method} ${req.originalUrl} (${status})`);
    } else {
        console.error(err);
    }
    if (!res.headersSent) {
        res.status(status).json({
            success: false,
            message: status === 403
                ? 'Origin is not allowed.'
                : status === 400
                    ? isUploadValidationError
                        ? err.message
                        : err?.code === 'LIMIT_FILE_SIZE'
                            ? 'Uploaded file is too large.'
                            : 'Invalid request.'
                    : 'Internal server error.'
        });
    }
});

if (!process.env.VERCEL && require.main === module) {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
module.exports.databaseReady = databaseReady;
