import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { MongoClient, ObjectId } from 'mongodb';

const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const databaseName = `verifitor_mobile_integration_${Date.now()}`;
const jwtSecret = 'isolated-mobile-integration-secret-2026-0123456789';
const notificationKey = 'isolated-notification-sender-key-0123456789';
const password = 'SafeMobile1!';
const alumniEmail = `qa.mobile.${runId}@example.test`;
const expiredRegistrationEmail = `qa.expired.${runId}@example.test`;
const studentEmail = `qa.student.${runId}@example.test`;
const inactiveEmail = `qa.inactive.${runId}@example.test`;
const otherEmail = `qa.other.${runId}@example.test`;

let mongoProcess;
let backendProcess;
let databaseDirectory;
let mongoClient;
let db;
let mongoPort;
let apiPort;
let apiOrigin;
let alumniId;
let alumniToken;
let otherToken;
let trackedRequestId;
const logs = [];

function recordLogs(label, stream) {
  stream.on('data', (chunk) => {
    logs.push(`${label}: ${String(chunk)}`);
    if (logs.length > 300) logs.shift();
  });
}

async function freePort() {
  const server = net.createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const { port } = server.address();
  await new Promise((resolve, reject) => server.close((error) => {
    if (error) reject(error);
    else resolve();
  }));
  return port;
}

async function waitForMongo(uri) {
  const deadline = Date.now() + 20_000;
  let error;
  while (Date.now() < deadline) {
    const candidate = new MongoClient(uri, { serverSelectionTimeoutMS: 300 });
    try {
      await candidate.connect();
      return candidate;
    } catch (candidateError) {
      error = candidateError;
      await candidate.close().catch(() => {});
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }
  throw new Error(`MongoDB did not start: ${error?.message}`);
}

async function waitForApi(url) {
  const deadline = Date.now() + 20_000;
  let error;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status === 200) return response;
      error = new Error(`HTTP ${response.status}`);
    } catch (requestError) {
      error = requestError;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(
    `Mobile API did not start: ${error?.message}\n${logs.join('')}`,
  );
}

async function stopChild(child) {
  if (!child || child.exitCode != null) return;
  child.kill('SIGTERM');
  await Promise.race([
    new Promise((resolve) => child.once('exit', resolve)),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode == null) child.kill('SIGKILL');
}

async function api(route, {
  method = 'GET',
  token,
  notificationSenderKey,
  body,
} = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (notificationSenderKey) {
    headers['x-notification-key'] = notificationSenderKey;
  }
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${apiOrigin}${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  return { status: response.status, data };
}

function registrationPayload(email = alumniEmail) {
  return {
    studentStatus: 'alumni',
    educationalLevel: 'bachelors',
    firstName: 'Mobile',
    lastName: 'Tester',
    email,
    password,
    program: 'BSIT',
    yearGraduated: '2025',
  };
}

async function login(email, submittedPassword = password, extra = {}) {
  return api('/api/auth/login', {
    method: 'POST',
    body: { email, password: submittedPassword, ...extra },
  });
}

test.before(async () => {
  mongoPort = await freePort();
  apiPort = await freePort();
  apiOrigin = `http://127.0.0.1:${apiPort}`;
  databaseDirectory = await mkdtemp(path.join(os.tmpdir(), 'verifitor-mobile-it-'));
  mongoProcess = spawn('mongod', [
    '--dbpath', databaseDirectory,
    '--port', String(mongoPort),
    '--bind_ip', '127.0.0.1',
    '--quiet',
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  recordLogs('mongod', mongoProcess.stdout);
  recordLogs('mongod', mongoProcess.stderr);

  const mongoUri = `mongodb://127.0.0.1:${mongoPort}`;
  mongoClient = await waitForMongo(mongoUri);
  db = mongoClient.db(databaseName);

  const now = new Date().toISOString();
  await db.collection('students').insertOne({
    _id: new ObjectId(),
    firstName: 'QA',
    lastName: 'Student',
    email: studentEmail,
    schoolEmail: studentEmail,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'student',
    status: 'Active',
    studentId: `STU-${runId.slice(-8)}`,
    yearLevel: '3rd Year',
    course: 'BSIT',
    program: 'BSIT',
    sessionVersion: 0,
    refreshTokens: [],
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('alumni').insertMany([
    {
      _id: new ObjectId(),
      firstName: 'QA',
      lastName: 'Inactive',
      email: inactiveEmail,
      personalEmail: inactiveEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'alumni',
      status: 'Inactive',
      yearLevel: '2025',
      course: 'BSIT',
      program: 'BSIT',
      sessionVersion: 0,
      refreshTokens: [],
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      firstName: 'QA',
      lastName: 'Other',
      email: otherEmail,
      personalEmail: otherEmail,
      passwordHash: await bcrypt.hash(password, 12),
      role: 'alumni',
      status: 'Active',
      yearLevel: '2024',
      course: 'BSIT',
      program: 'BSIT',
      sessionVersion: 0,
      refreshTokens: [],
      createdAt: now,
      updatedAt: now,
    },
  ]);

  backendProcess = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(apiPort),
      MONGODB_URI: mongoUri,
      MONGODB_DB_NAME: databaseName,
      MONGODB_ALUMNI_COLLECTION: 'alumni',
      MONGODB_STUDENTS_COLLECTION: 'students',
      DISABLE_DB: 'false',
      RUN_DB_MIGRATIONS: 'true',
      JWT_SECRET: jwtSecret,
      JWT_ISSUER: 'verifitor',
      JWT_AUDIENCE: 'verifitor-mobile',
      JWT_ACCESS_TTL_MINUTES: '15',
      JWT_REFRESH_TTL_DAYS: '30',
      OTP_TTL_MINUTES: '10',
      OTP_DEV_MODE: 'true',
      NOTIFICATIONS_API_KEY: notificationKey,
      MAILBOXLAYER_ACCESS_KEY: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      SMTP_FROM: '',
      CLOUDINARY_URL: '',
      CLOUDINARY_CLOUD_NAME: '',
      CLOUDINARY_API_KEY: '',
      CLOUDINARY_API_SECRET: '',
      ALLOWED_ORIGIN: '',
      TRUST_PROXY_HOPS: '0',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  recordLogs('mobile-api', backendProcess.stdout);
  recordLogs('mobile-api', backendProcess.stderr);
  await waitForApi(`${apiOrigin}/api/health`);
});

test.after(async () => {
  await stopChild(backendProcess);
  if (db) await db.dropDatabase();
  if (mongoClient) await mongoClient.close();
  await stopChild(mongoProcess);
  if (databaseDirectory) {
    await rm(databaseDirectory, { recursive: true, force: true });
  }
});

test('IT-001 Mobile Registration -> API -> Database', async () => {
  const missing = await api('/api/auth/register/request-otp', {
    method: 'POST', body: {},
  });
  assert.equal(missing.status, 400);

  const invalidEmail = await api('/api/auth/register/request-otp', {
    method: 'POST',
    body: registrationPayload(`invalid-${runId}`),
  });
  assert.equal(invalidEmail.status, 400);

  const invalidRole = await api('/api/auth/register/request-otp', {
    method: 'POST',
    body: { ...registrationPayload(`qa.role.${runId}@example.test`), studentStatus: 'admin' },
  });
  assert.equal(invalidRole.status, 400);

  const weakPassword = await api('/api/auth/register/request-otp', {
    method: 'POST',
    body: { ...registrationPayload(`qa.weak.${runId}@example.test`), password: 'weak' },
  });
  assert.equal(weakPassword.status, 400);

  const challenge = await api('/api/auth/register/request-otp', {
    method: 'POST', body: registrationPayload(),
  });
  assert.equal(challenge.status, 200);
  assert.match(challenge.data.otp, /^\d{6}$/);
  assert.match(challenge.data.challengeToken, /^[a-f0-9]{64}$/);

  const invalidOtp = await api('/api/auth/register/verify-otp', {
    method: 'POST',
    body: {
      email: alumniEmail,
      otp: challenge.data.otp === '000000' ? '000001' : '000000',
      challengeToken: challenge.data.challengeToken,
    },
  });
  assert.equal(invalidOtp.status, 401);

  const verified = await api('/api/auth/register/verify-otp', {
    method: 'POST',
    body: {
      email: alumniEmail,
      otp: challenge.data.otp,
      challengeToken: challenge.data.challengeToken,
    },
  });
  assert.equal(verified.status, 201);

  const stored = await db.collection('alumni').findOne({ email: alumniEmail });
  assert.ok(stored);
  alumniId = String(stored._id);
  assert.equal(stored.role, 'alumni');
  assert.equal(stored.program, 'BSIT');
  assert.equal(stored.course, 'BSIT');
  assert.equal(stored.status, undefined);
  assert.equal(stored.password, undefined);
  assert.match(stored.passwordHash, /^\$2[aby]\$12\$/);
  assert.equal(await bcrypt.compare(password, stored.passwordHash), true);

  const duplicate = await api('/api/auth/register/request-otp', {
    method: 'POST', body: registrationPayload(),
  });
  assert.equal(duplicate.status, 409);
  assert.equal(await db.collection('alumni').countDocuments({ email: alumniEmail }), 1);

  const expiringChallenge = await api('/api/auth/register/request-otp', {
    method: 'POST', body: registrationPayload(expiredRegistrationEmail),
  });
  assert.equal(expiringChallenge.status, 200);
  const expiredRecord = await db.collection('auth_challenges').findOneAndUpdate(
    { namespace: 'registration-otp', 'payload.email': expiredRegistrationEmail },
    { $set: { expiresAt: new Date(Date.now() - 1000) } },
    { returnDocument: 'after' },
  );
  assert.ok(expiredRecord);
  const expiredOtp = await api('/api/auth/register/verify-otp', {
    method: 'POST',
    body: {
      email: expiredRegistrationEmail,
      otp: expiringChallenge.data.otp,
      challengeToken: expiringChallenge.data.challengeToken,
    },
  });
  assert.equal(expiredOtp.status, 400);
});

test('IT-002 Mobile Login -> Authentication -> Database -> Role Access', async () => {
  const alumniLogin = await login(alumniEmail);
  assert.equal(alumniLogin.status, 200);
  assert.equal(alumniLogin.data.user.role, 'alumni');
  alumniToken = alumniLogin.data.accessToken;
  assert.match(alumniToken, /^[^.]+\.[^.]+\.[^.]+$/);
  assert.match(alumniLogin.data.refreshToken, /^[a-f0-9]{96}$/);

  const decoded = jwt.verify(alumniToken, jwtSecret, {
    algorithms: ['HS256'],
    issuer: 'verifitor',
    audience: 'verifitor-mobile',
  });
  assert.equal(decoded.sub, alumniId);
  assert.equal(decoded.email, alumniEmail);
  assert.equal(decoded.role, 'alumni');
  assert.ok(decoded.exp > decoded.iat);

  const stored = await db.collection('alumni').findOne({ email: alumniEmail });
  assert.ok(stored.refreshTokens.length > 0);
  assert.notEqual(stored.refreshTokens.at(-1).tokenHash, alumniLogin.data.refreshToken);
  assert.equal(
    stored.refreshTokens.at(-1).tokenHash,
    createHash('sha256').update(alumniLogin.data.refreshToken).digest('hex'),
  );

  const studentLogin = await login(studentEmail);
  assert.equal(studentLogin.status, 200);
  assert.equal(studentLogin.data.user.role, 'student');

  const incorrectSubmittedRole = await login(alumniEmail, password, { role: 'student' });
  assert.equal(incorrectSubmittedRole.status, 200);
  assert.equal(incorrectSubmittedRole.data.user.role, 'alumni');

  assert.equal((await login(alumniEmail, 'WrongMobile1!')).status, 401);
  assert.equal((await login(`qa.missing.${runId}@example.test`)).status, 401);
  assert.equal((await api('/api/auth/login', { method: 'POST', body: {} })).status, 400);
  assert.equal((await login(inactiveEmail)).status, 403);

  assert.equal((await api('/api/profile')).status, 401);
  assert.equal((await api('/api/profile', { token: 'not-a-token' })).status, 401);
  assert.equal((await api('/api/profile', { token: `${alumniToken.slice(0, -1)}x` })).status, 401);

  const expiredToken = jwt.sign(
    { sub: alumniId, email: alumniEmail, role: 'alumni', sv: 0 },
    jwtSecret,
    {
      algorithm: 'HS256', issuer: 'verifitor', audience: 'verifitor-mobile',
      expiresIn: -60,
    },
  );
  assert.equal((await api('/api/profile', { token: expiredToken })).status, 401);
  assert.equal((await api('/api/profile', { token: alumniToken })).status, 200);
});

test('IT-003 Mobile Request Document -> API -> Database -> Notifications -> Logs', async () => {
  assert.equal((await api('/api/requests', {
    method: 'POST', token: alumniToken, body: { purpose: 'Employment' },
  })).status, 400);
  assert.equal((await api('/api/requests', {
    method: 'POST', token: alumniToken, body: { docName: 'Certificate of Enrollment' },
  })).status, 400);
  assert.equal((await api('/api/requests', {
    method: 'POST', body: { docName: 'Certificate of Enrollment', purpose: 'Employment' },
  })).status, 401);
  assert.equal((await api('/api/requests', {
    method: 'POST', token: 'invalid',
    body: { docName: 'Certificate of Enrollment', purpose: 'Employment' },
  })).status, 401);

  const nonexistentUserToken = jwt.sign(
    { sub: new ObjectId().toString(), email: `qa.ghost.${runId}@example.test`, role: 'alumni', sv: 0 },
    jwtSecret,
    {
      algorithm: 'HS256', issuer: 'verifitor', audience: 'verifitor-mobile',
      expiresIn: '15m',
    },
  );
  assert.equal((await api('/api/requests', {
    method: 'POST', token: nonexistentUserToken,
    body: { docName: 'Certificate of Enrollment', purpose: 'Employment' },
  })).status, 404);

  const create = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Certificate of Enrollment', purpose: 'Employment' },
  });
  assert.equal(create.status, 201);
  assert.equal(create.data.persisted, true);
  assert.equal(create.data.request.status, 'pending_payment');
  trackedRequestId = create.data.request.requestId;
  assert.match(trackedRequestId, /^req_\d+_[a-f0-9]{12}$/);

  const stored = await db.collection('requests').findOne({ requestId: trackedRequestId });
  assert.ok(stored);
  assert.equal(String(stored.userId), alumniId);
  assert.equal(stored.documentType, 'Certificate of Enrollment');
  assert.equal(stored.purpose, 'Employment');
  assert.equal(stored.status, 'Pending');
  assert.equal(stored.mobileStatus, 'pending_payment');
  assert.ok(stored.dateRequested);
  assert.ok(stored.createdAt);

  assert.ok(await db.collection('notifications').findOne({
    userId: stored.userId,
    message: /submitted/i,
  }));

  const duplicate = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Certificate of Enrollment', purpose: 'Employment' },
  });
  assert.equal(duplicate.status, 201);
  assert.notEqual(duplicate.data.request.requestId, trackedRequestId);

  const customDocument = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Custom Archive Certification', purpose: 'Personal Use' },
  });
  assert.equal(customDocument.status, 201);
  assert.equal(customDocument.data.request.documentPrice, 100);

  const collectionNames = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((collection) => collection.name.toLowerCase());
  assert.equal(collectionNames.includes('activitylogs'), false);
  assert.equal(collectionNames.includes('auditlogs'), false);
  assert.equal(collectionNames.includes('systemlogs'), false);
});

test('IT-004 Mobile Request Tracking -> API -> Database -> Request History', async () => {
  const otherLogin = await login(otherEmail);
  assert.equal(otherLogin.status, 200);
  otherToken = otherLogin.data.accessToken;

  const emptyOtherList = await api('/api/requests', { token: otherToken });
  assert.equal(emptyOtherList.status, 200);
  assert.deepEqual(emptyOtherList.data.requests, []);

  const otherRequest = await api('/api/requests', {
    method: 'POST', token: otherToken,
    body: { docName: 'Clearance', purpose: 'Transfer' },
  });
  assert.equal(otherRequest.status, 201);

  const pending = await api('/api/requests', { token: alumniToken });
  assert.equal(pending.status, 200);
  const pendingRecord = pending.data.requests.find(
    (request) => request.requestId === trackedRequestId,
  );
  assert.ok(pendingRecord);
  assert.equal(pendingRecord.status, 'pending_payment');
  assert.equal(pendingRecord.docName, 'Certificate of Enrollment');
  assert.equal(pendingRecord.purpose, 'Employment');
  assert.ok(pendingRecord.createdAt);
  assert.equal(
    pending.data.requests.some(
      (request) => request.requestId === otherRequest.data.request.requestId,
    ),
    false,
  );

  assert.equal((await api(`/api/requests/${otherRequest.data.request.requestId}`, {
    token: alumniToken,
  })).status, 404);

  await db.collection('requests').updateOne(
    { requestId: trackedRequestId, userId: new ObjectId(alumniId) },
    { $set: { status: 'In Process', updatedAt: new Date().toISOString() } },
  );
  const inProcess = await api('/api/requests', { token: alumniToken });
  assert.equal(
    inProcess.data.requests.find((request) => request.requestId === trackedRequestId).status,
    'In Process',
  );

  await db.collection('requests').updateOne(
    { requestId: trackedRequestId, userId: new ObjectId(alumniId) },
    { $set: { status: 'Released', updatedAt: new Date().toISOString() } },
  );
  const released = await api('/api/requests', { token: alumniToken });
  assert.equal(
    released.data.requests.find((request) => request.requestId === trackedRequestId).status,
    'Released',
  );

  // Claim the released request
  const claimRes = await api(`/api/requests/${trackedRequestId}/claim`, {
    method: 'POST',
    token: alumniToken,
  });
  assert.equal(claimRes.status, 200);
  assert.equal(claimRes.data.success, true);
  assert.equal(claimRes.data.request.status, 'Claimed');
  assert.ok(claimRes.data.request.claimedAt);

  const claimedList = await api('/api/requests', { token: alumniToken });
  assert.equal(
    claimedList.data.requests.find((request) => request.requestId === trackedRequestId).status,
    'Claimed',
  );

  // Cannot claim again once already claimed
  const alreadyClaimed = await api(`/api/requests/${trackedRequestId}/claim`, {
    method: 'POST',
    token: alumniToken,
  });
  assert.equal(alreadyClaimed.status, 409);

  const statusNotification = await api('/api/notifications', {
    method: 'POST',
    notificationSenderKey: notificationKey,
    body: {
      email: alumniEmail,
      title: 'Request released',
      message: `Your request ${trackedRequestId} is Released.`,
    },
  });
  assert.equal(statusNotification.status, 201);
  const notifications = await api('/api/notifications', { token: alumniToken });
  assert.equal(notifications.status, 200);
  assert.ok(notifications.data.notifications.some(
    (notification) => notification.message.includes(trackedRequestId) &&
      notification.message.includes('Released'),
  ));

  const expiredToken = jwt.sign(
    { sub: alumniId, email: alumniEmail, role: 'alumni', sv: 0 },
    jwtSecret,
    {
      algorithm: 'HS256', issuer: 'verifitor', audience: 'verifitor-mobile',
      expiresIn: -60,
    },
  );
  assert.equal((await api('/api/requests', { token: 'invalid' })).status, 401);
  assert.equal((await api('/api/requests', { token: expiredToken })).status, 401);
});

test('IT-005 Mobile Profile -> API -> Database', async () => {
  const before = await api('/api/profile', { token: alumniToken });
  assert.equal(before.status, 200);
  assert.equal(before.data.user.id, alumniId);
  assert.equal(before.data.user.email, alumniEmail);
  const original = await db.collection('alumni').findOne({ _id: new ObjectId(alumniId) });

  assert.equal((await api('/api/profile', { method: 'PUT', body: {} })).status, 401);
  assert.equal((await api('/api/profile', {
    method: 'PUT', token: 'invalid', body: {},
  })).status, 401);
  assert.equal((await api('/api/profile', {
    method: 'PUT', token: alumniToken, body: {},
  })).status, 400);

  const validShape = {
    firstName: 'Mobile',
    lastName: 'Updated',
    personalEmail: alumniEmail,
    schoolEmail: '',
    studentId: '',
    yearLevel: '2025',
    program: 'BSCS',
  };
  assert.equal((await api('/api/profile', {
    method: 'PUT', token: alumniToken,
    body: { ...validShape, personalEmail: 'invalid-email' },
  })).status, 400);
  assert.equal((await api('/api/profile', {
    method: 'PUT', token: alumniToken,
    body: { ...validShape, personalEmail: `qa.changed.${runId}@example.test` },
  })).status, 400);

  const otherBefore = await db.collection('alumni').findOne({ email: otherEmail });
  const update = await api('/api/profile', {
    method: 'PUT', token: alumniToken,
    body: {
      ...validShape,
      id: String(otherBefore._id),
      role: 'admin',
      status: 'Inactive',
      password: 'InjectedMobile1!',
      passwordHash: 'injected',
    },
  });
  assert.equal(update.status, 200);
  assert.equal(update.data.user.id, alumniId);
  assert.equal(update.data.user.role, 'alumni');
  assert.equal(update.data.user.program, 'BSCS');

  const refreshed = await api('/api/profile', { token: alumniToken });
  assert.equal(refreshed.status, 200);
  assert.equal(refreshed.data.user.id, alumniId);
  assert.equal(refreshed.data.user.email, alumniEmail);
  assert.equal(refreshed.data.user.firstName, 'Mobile');
  assert.equal(refreshed.data.user.lastName, 'Updated');
  assert.equal(refreshed.data.user.program, 'BSCS');
  assert.equal(refreshed.data.user.role, 'alumni');

  const stored = await db.collection('alumni').findOne({ _id: new ObjectId(alumniId) });
  assert.equal(String(stored._id), alumniId);
  assert.equal(stored.email, original.email);
  assert.equal(stored.role, original.role);
  assert.equal(stored.status, original.status);
  assert.equal(stored.passwordHash, original.passwordHash);
  assert.equal(stored.password, undefined);
  assert.equal(stored.program, 'BSCS');
  assert.equal(stored.course, 'BSCS');

  const otherAfter = await db.collection('alumni').findOne({ _id: otherBefore._id });
  assert.equal(otherAfter.firstName, otherBefore.firstName);
  assert.equal(otherAfter.lastName, otherBefore.lastName);

  const expiredToken = jwt.sign(
    { sub: alumniId, email: alumniEmail, role: 'alumni', sv: 0 },
    jwtSecret,
    {
      algorithm: 'HS256', issuer: 'verifitor', audience: 'verifitor-mobile',
      expiresIn: -60,
    },
  );
  assert.equal((await api('/api/profile', { token: expiredToken })).status, 401);
});

test('mobile backend fails closed when MongoDB is unavailable', async () => {
  const unavailablePort = await freePort();
  const serverPort = await freePort();
  const failedServer = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(import.meta.dirname, '..'),
    env: {
      ...process.env,
      NODE_ENV: 'development',
      PORT: String(serverPort),
      MONGODB_URI: `mongodb://127.0.0.1:${unavailablePort}`,
      MONGODB_DB_NAME: 'verifitor_unavailable_mobile_test',
      DISABLE_DB: 'false',
      JWT_SECRET: jwtSecret,
      JWT_ISSUER: 'verifitor',
      JWT_AUDIENCE: 'verifitor-mobile',
      OTP_DEV_MODE: 'true',
      ALLOWED_ORIGIN: '',
      CLOUDINARY_URL: '',
      CLOUDINARY_CLOUD_NAME: '',
      CLOUDINARY_API_KEY: '',
      CLOUDINARY_API_SECRET: '',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  let output = '';
  failedServer.stdout.on('data', (chunk) => { output += String(chunk); });
  failedServer.stderr.on('data', (chunk) => { output += String(chunk); });
  const exitCode = await Promise.race([
    new Promise((resolve) => failedServer.once('exit', resolve)),
    new Promise((_, reject) => setTimeout(
      () => reject(new Error('Backend did not fail within 10 seconds.')),
      10_000,
    )),
  ]);
  assert.equal(exitCode, 1);
  assert.match(output, /MongoDB connection failed/);
});
