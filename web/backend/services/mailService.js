const nodemailer = require('nodemailer');

function resolveSmtpConfig(env = process.env) {
  const host = String(env.SMTP_HOST || '').trim();
  const user = String(env.SMTP_USER || env.SMTP_EMAIL || '').trim();
  const pass = String(env.SMTP_PASS || env.SMTP_PASSWORD || '');
  const from = String(
    env.SMTP_FROM || (user ? `"VeriFitor System" <${user}>` : ''),
  ).trim();
  const port = Number.parseInt(String(env.SMTP_PORT || '587'), 10);
  const secure = env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass && from && Number.isInteger(port) && port > 0) {
    return {
      from,
      transport: {
        host,
        port,
        secure,
        requireTLS: !secure,
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
        auth: { user, pass },
        tls: { rejectUnauthorized: true, minVersion: 'TLSv1.2' },
      },
    };
  }

  // Backwards-compatible support for existing Gmail deployments.
  if (!host && user && pass && from) {
    return {
      from,
      transport: {
        service: 'gmail',
        auth: { user, pass },
        connectionTimeout: 10000,
        greetingTimeout: 10000,
        socketTimeout: 15000,
      },
    };
  }

  return null;
}

async function sendOtpEmail({ email, otp, purpose, env = process.env }) {
  if (env.NODE_ENV !== 'production' && env.OTP_DEV_MODE === 'true') {
    return { delivered: false, developmentMode: true };
  }

  const smtp = resolveSmtpConfig(env);
  if (!smtp) {
    const error = new Error('SMTP is not configured.');
    error.code = 'SMTP_NOT_CONFIGURED';
    throw error;
  }

  const transporter = nodemailer.createTransport(smtp.transport);
  await transporter.sendMail({
    from: smtp.from,
    to: email,
    subject: purpose === 'registration'
      ? 'VeriFitor - Registration OTP'
      : 'VeriFitor - Password Reset OTP',
    text: `Your VeriFitor verification code is ${otp}. It expires in 10 minutes.`,
  });
  return { delivered: true, developmentMode: false };
}

module.exports = { resolveSmtpConfig, sendOtpEmail };
