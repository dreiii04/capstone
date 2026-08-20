import { randomBytes } from 'crypto';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const configDirectory = path.dirname(fileURLToPath(import.meta.url));

export const backendRoot = path.resolve(
  configDirectory,
  '..',
  '..',
);

// Local development only.
// Vercel / Render / Railway will use process.env instead.
dotenv.config({
  path: path.join(backendRoot, '.env.local'),
});

function loadOrCreateLocalJwtSecret() {
  const secretPath = path.join(
    backendRoot,
    '.local-jwt-secret',
  );

  try {
    const existing = fs
      .readFileSync(secretPath, 'utf8')
      .trim();

    if (
      Buffer.byteLength(existing, 'utf8') >= 32
    ) {
      return existing;
    }
  } catch (_error) {
    // Generate one below.
  }

  const generated = randomBytes(48).toString(
    'base64url',
  );

  try {
    fs.writeFileSync(
      secretPath,
      generated,
      {
        encoding: 'utf8',
        flag: 'wx',
        mode: 0o600,
      },
    );

    return generated;
  } catch (_error) {
    try {
      const existing = fs
        .readFileSync(secretPath, 'utf8')
        .trim();

      if (
        Buffer.byteLength(existing, 'utf8') >= 32
      ) {
        return existing;
      }
    } catch (_readError) {
      console.warn(
        'Local JWT key could not be persisted; sessions will reset on restart.',
      );
    }

    return generated;
  }
}

function parseAllowedOrigins(
  envValue,
  isProduction,
) {
  const rawOrigins = String(envValue || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  // Native Flutter Android/iOS normally does not
  // send an Origin header.
  //
  // Therefore mobile-only deployments do not
  // require ALLOWED_ORIGIN.
  //
  // In production "*" is ignored for security.
  if (isProduction) {
    return rawOrigins.filter(
      (origin) => origin !== '*',
    );
  }

  return rawOrigins;
}

function buildConfig(env) {
  const nodeEnv = String(
    env.NODE_ENV || 'development',
  ).trim();

  const isProduction =
    nodeEnv === 'production';

  // --------------------------------------------------
  // DATABASE
  // --------------------------------------------------

  const databaseEnabled =
    env.DISABLE_DB !== 'true';

  const mongoUri = String(
    env.MONGODB_URI || '',
  ).trim();

  const mongoUriIsValid =
    /^mongodb(?:\+srv)?:\/\//i.test(
      mongoUri,
    );

  // --------------------------------------------------
  // JWT
  // --------------------------------------------------

  const configuredJwtSecret = String(
    env.JWT_SECRET || '',
  ).trim();

  const jwtSecret =
    Buffer.byteLength(
      configuredJwtSecret,
      'utf8',
    ) >= 32
      ? configuredJwtSecret
      : !isProduction
        ? loadOrCreateLocalJwtSecret()
        : configuredJwtSecret;

  // --------------------------------------------------
  // CORS
  // --------------------------------------------------

  const allowedOrigins =
    parseAllowedOrigins(
      env.ALLOWED_ORIGIN,
      isProduction,
    );

  // --------------------------------------------------
  // CLOUDINARY
  // --------------------------------------------------

  const cloudinaryUrl = String(
    env.CLOUDINARY_URL || '',
  ).trim();

  const cloudinaryCloudName = String(
    env.CLOUDINARY_CLOUD_NAME || '',
  ).trim();

  const cloudinaryApiKey = String(
    env.CLOUDINARY_API_KEY || '',
  ).trim();

  const cloudinaryApiSecret = String(
    env.CLOUDINARY_API_SECRET || '',
  ).trim();

  const cloudinaryEnabled = Boolean(
    cloudinaryUrl ||
      (
        cloudinaryCloudName &&
        cloudinaryApiKey &&
        cloudinaryApiSecret
      ),
  );

  // --------------------------------------------------
  // NOTIFICATIONS
  // --------------------------------------------------

  const notificationsApiKey = String(
    env.NOTIFICATIONS_API_KEY || '',
  ).trim();

  // --------------------------------------------------
  // SMTP
  // --------------------------------------------------

  const smtp = Object.freeze({
    host: String(
      env.SMTP_HOST || 'smtp.gmail.com',
    ).trim(),

    port: String(
      env.SMTP_PORT || '465',
    ).trim(),

    secure:
      env.SMTP_SECURE === 'true',

    user: String(
      env.SMTP_USER || '',
    ).trim(),

    pass: String(
      env.SMTP_PASS || '',
    ),

    from: String(
      env.SMTP_FROM || '',
    ).trim(),
  });

  const smtpEnabled = Boolean(
    smtp.host &&
      smtp.port &&
      smtp.user &&
      smtp.pass &&
      smtp.from,
  );

  // --------------------------------------------------
  // AUTH TTL
  // --------------------------------------------------

  const otpTtl = Number(
    env.OTP_TTL_MINUTES || '10',
  );

  const accessTtl = Number(
    env.JWT_ACCESS_TTL_MINUTES || '15',
  );

  const refreshTtl = Number(
    env.JWT_REFRESH_TTL_DAYS || '30',
  );

  // --------------------------------------------------
  // STARTUP VALIDATION
  // --------------------------------------------------

  let startupError = null;

  // Only core configuration should be capable
  // of taking the entire backend offline.

  if (
    databaseEnabled &&
    !mongoUriIsValid
  ) {
    startupError =
      'MONGODB_URI must be configured.';
  }

  if (
    Buffer.byteLength(
      jwtSecret,
      'utf8',
    ) < 32
  ) {
    startupError ||=
      'JWT_SECRET must contain at least 32 bytes.';
  }

  if (
    /change[_-]?me|replace|example/i.test(
      jwtSecret,
    )
  ) {
    startupError ||=
      'JWT_SECRET must not use a placeholder value.';
  }

  // Native mobile apps can leave
  // ALLOWED_ORIGIN empty.
  //
  // But if an origin is configured in production,
  // it must use HTTPS.
  if (
    isProduction &&
    allowedOrigins.some((origin) => {
      try {
        return (
          new URL(origin).protocol !==
          'https:'
        );
      } catch (_error) {
        return true;
      }
    })
  ) {
    startupError ||=
      'Production ALLOWED_ORIGIN entries must be valid HTTPS origins.';
  }

  if (
    isProduction &&
    env.OTP_DEV_MODE === 'true'
  ) {
    startupError ||=
      'OTP_DEV_MODE must be disabled in production.';
  }

  if (
    isProduction &&
    !databaseEnabled
  ) {
    startupError ||=
      'DISABLE_DB cannot be enabled in production.';
  }

  if (
    !Number.isFinite(otpTtl) ||
    otpTtl < 5 ||
    otpTtl > 30 ||
    !Number.isFinite(accessTtl) ||
    accessTtl < 5 ||
    accessTtl > 60 ||
    !Number.isFinite(refreshTtl) ||
    refreshTtl < 1 ||
    refreshTtl > 90
  ) {
    startupError ||=
      'Authentication TTL configuration is invalid.';
  }

  // --------------------------------------------------
  // PROXY / PORT
  // --------------------------------------------------

  const configuredTrustProxy =
    Number.parseInt(
      String(
        env.TRUST_PROXY_HOPS ||
          (env.VERCEL ? '1' : '0'),
      ),
      10,
    );

  const configuredPort =
    Number.parseInt(
      String(env.PORT || '4000'),
      10,
    );

  // --------------------------------------------------
  // RETURN CONFIG
  // --------------------------------------------------

  return {
    nodeEnv,

    isProduction,

    port:
      Number.isInteger(
        configuredPort,
      ) &&
      configuredPort > 0
        ? configuredPort
        : 4000,

    trustProxyHops:
      Number.isInteger(
        configuredTrustProxy,
      ) &&
      configuredTrustProxy > 0
        ? configuredTrustProxy
        : 0,

    runDbMigrations:
      env.RUN_DB_MIGRATIONS === 'true',

    database: Object.freeze({
      enabled: databaseEnabled,

      uri: mongoUri,

      uriIsValid:
        mongoUriIsValid,

      name:
        String(
          env.MONGODB_DB_NAME ||
            'test',
        ).trim() || 'test',

      alumniCollection:
        String(
          env.MONGODB_ALUMNI_COLLECTION ||
            env.MONGODB_USERS_COLLECTION ||
            'alumni',
        ).trim() || 'alumni',

      studentsCollection:
        String(
          env.MONGODB_STUDENTS_COLLECTION ||
            'students',
        ).trim() || 'students',
    }),

    allowedOrigins:
      Object.freeze(
        allowedOrigins,
      ),

    mailboxlayerAccessKey:
      String(
        env.MAILBOXLAYER_ACCESS_KEY ||
          '',
      ).trim(),

    otp: Object.freeze({
      ttlMinutes: String(
        env.OTP_TTL_MINUTES || '10',
      ),

      developmentMode:
        env.OTP_DEV_MODE === 'true',
    }),

    jwt: Object.freeze({
      secret: jwtSecret,

      accessTtlMinutes: String(
        env.JWT_ACCESS_TTL_MINUTES ||
          '15',
      ),

      refreshTtlDays: String(
        env.JWT_REFRESH_TTL_DAYS ||
          '30',
      ),

      issuer:
        String(
          env.JWT_ISSUER ||
            'verifitor',
        ).trim() ||
        'verifitor',

      audience:
        String(
          env.JWT_AUDIENCE ||
            'verifitor-mobile',
        ).trim() ||
        'verifitor-mobile',
    }),

    notificationsApiKey,

    smtp,

    smtpEnabled,

    cloudinary: Object.freeze({
      enabled:
        cloudinaryEnabled,

      url:
        cloudinaryUrl,

      cloudName:
        cloudinaryCloudName,

      apiKey:
        cloudinaryApiKey,

      apiSecret:
        cloudinaryApiSecret,
    }),

    paths: Object.freeze({
      uploads:
        path.join(
          backendRoot,
          'uploads',
        ),

      receipts:
        path.join(
          backendRoot,
          'uploads',
          'receipts',
        ),

      profiles:
        path.join(
          backendRoot,
          'uploads',
          'profiles',
        ),
    }),

    startupError,
  };
}

// Keep the same object identity so imports
// throughout the backend continue to work.
export const config = {
  get isVercel() {
    return Boolean(
      process.env.VERCEL,
    );
  },
};

export function refreshConfig() {
  Object.assign(
    config,
    buildConfig(process.env),
  );

  return config;
}

refreshConfig();

export default config;