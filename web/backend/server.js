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

const configuredOrigins = String(
  process.env.ALLOWED_ORIGINS || process.env.FRONTEND_URL || ''
).split(',').map((value) => value.trim()).filter(Boolean);
if (process.env.NODE_ENV !== 'production') {
  configuredOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173');
}
const allowedOrigins = new Set(configuredOrigins);

const corsOptions = {
  origin(origin, callback) {
    // Native apps and server-to-server requests do not send Origin.
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
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

// Serve uploaded files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

const connectDB = async () => {
    const uri = String(process.env.MONGODB_URI || '').trim();
    if (!uri) throw new Error('MONGODB_URI is not configured');
    const dbName = resolveMongoDatabaseName(process.env);
    await mongoose.connect(uri, {
      dbName,
      serverSelectionTimeoutMS: 5000,
    });
    console.log(`MongoDB connected successfully (${mongoose.connection.name})`);
    if (process.env.NODE_ENV !== 'production' && process.env.SEED_DEFAULT_USERS === 'true') {
        await seedUsers();
    }
};

// Initial seed function for MongoDB
async function seedUsers() {
    const SuperAdmin = require('./models/Users/SuperAdmin');
    const Registrar = require('./models/Registrar');
    
    try {
        // 1. Seed Super Admin
        const existingSuperAdmin = await SuperAdmin.findOne({ email: 'sysadmin@verifitor.com' });
        if (!existingSuperAdmin) {
            await SuperAdmin.create({
                email: 'sysadmin@verifitor.com',
                password: 'sysadmin123', // Model handles hashing
                role: 'super admin',
                name: 'Super Admin'
            });
            console.log('Default Super Admin created (sysadmin@verifitor.com / sysadmin123)');
        }

        // 2. Seed Standard Registrars
        const registrarsToSeed = [
            { email: 'admin@verifitor.com', password: 'admin123', name: 'Admin', registrarId: 'REG-001' },
            { email: 'saetsmurf1@gmail.com', password: 'admin123', name: 'Primary Admin', registrarId: 'REG-002' }
        ];

        for (const reg of registrarsToSeed) {
            const existingReg = await Registrar.findOne({ email: reg.email });
            if (!existingReg) {
                await Registrar.create({
                    email: reg.email,
                    password: reg.password,
                    role: 'registrar',
                    name: reg.name,
                    registrarId: reg.registrarId
                });
                console.log(`Default Registrar created (${reg.email} / ${reg.password})`);
            }
        }
    } catch (error) {
        console.error('Error seeding users:', error);
    }
}

let databaseError = null;
const databaseReady = connectDB().catch((error) => {
    databaseError = error;
    console.error(
        process.env.NODE_ENV === 'production'
            ? 'Database initialization failed.'
            : `Database initialization failed: ${error.message}`
    );
    return null;
});

// Do not let requests hang in Mongoose's operation buffer while the database
// is unavailable. Health remains reachable for deployment diagnostics.
app.use('/api', async (req, res, next) => {
    if (req.path === '/health' || req.path === '/test') return next();
    const connection = await databaseReady;
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
    const ready = mongoose.connection.readyState === 1 && !databaseError;
    res.status(ready ? 200 : 503).json({
        status: ready ? 'ready' : 'unavailable',
        database: ready ? 'connected' : 'disconnected'
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
    const isUploadValidationError =
        err?.message === 'Only PNG, JPG and JPEG image files are allowed.' ||
        err?.message === 'Only image files are allowed!';
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
                        : 'Invalid request.'
                    : 'Internal server error.'
        });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

module.exports = app;
module.exports.databaseReady = databaseReady;
