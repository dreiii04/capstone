import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import bcrypt from 'bcryptjs';

const derive = promisify(scrypt);
const options = { N: 131072, r: 8, p: 1, maxmem: 160 * 1024 * 1024 };
const pattern = /^scrypt-v1\$([a-f0-9]{32})\$([a-f0-9]{128})$/;
export const isPasswordHash = (value) => pattern.test(String(value || '')) ||
  /^\$2[aby]\$\d{2}\$/.test(String(value || ''));

export async function hashPassword(password) {
  if (typeof password !== 'string' || !password.length || password.length > 1024) {
    throw new Error('Password must contain 1 to 1024 characters.');
  }
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, options);
  return `scrypt-v1$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, hash) {
  if (typeof password !== 'string' || !password.length || password.length > 1024) return false;
  const match = String(hash || '').match(pattern);
  if (match) {
    const actual = await derive(password, match[1], 64, options);
    return timingSafeEqual(actual, Buffer.from(match[2], 'hex'));
  }
  // Legacy bcrypt accounts remain usable. New credentials never use bcrypt.
  // Do not auto-migrate a truncated legacy credential on login: a password
  // reset/change establishes the full new password through the verified flow.
  return /^\$2[aby]\$\d{2}\$/.test(String(hash || '')) && bcrypt.compare(password, hash);
}
