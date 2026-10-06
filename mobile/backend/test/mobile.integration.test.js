import { verifyPassword } from '../components/services/password.service.js';
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
const formerStudentEmail = `qa.former.${runId}@example.test`;
const inactiveEmail = `qa.inactive.${runId}@example.test`;
const otherEmail = `qa.other.${runId}@example.test`;

let mongoProcess;
let backendProcess;
let webProcess;
let databaseDirectory;
let mongoClient;
let db;
let mongoPort;
let apiPort;
let apiOrigin;
let webApiPort;
let webApiOrigin;
let adminToken;
let alumniId;
let alumniToken;
let studentToken;
let formerStudentToken;
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
    const candidate = new MongoClient(uri, { serverSelectionTimeoutMS: 300, directConnection: true });
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

async function webApi(route, { method = 'GET', body } = {}) {
  const response = await fetch(`${webApiOrigin}${route}`, {
    method,
    headers: {
      Authorization: `Bearer ${adminToken}`,
      ...(body === undefined ? {} : { 'Content-Type': 'application/json' }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: response.status, data: await response.json() };
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
  webApiPort = await freePort();
  apiOrigin = `http://127.0.0.1:${apiPort}`;
  webApiOrigin = `http://127.0.0.1:${webApiPort}`;
  databaseDirectory = await mkdtemp(path.join(os.tmpdir(), 'verifitor-mobile-it-'));
  mongoProcess = spawn('mongod', [
    '--dbpath', databaseDirectory,
    '--port', String(mongoPort),
    '--bind_ip', '127.0.0.1',
    '--quiet',
    '--replSet', 'verifitor-test',
  ], { stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  recordLogs('mongod', mongoProcess.stdout);
  recordLogs('mongod', mongoProcess.stderr);

  const mongoUri = `mongodb://127.0.0.1:${mongoPort}`;
  mongoClient = await waitForMongo(mongoUri);
  await mongoClient.db('admin').command({ replSetInitiate: { _id: 'verifitor-test', members: [{ _id: 0, host: '127.0.0.1:' + mongoPort }] } });
  const electionDeadline = Date.now() + 20000;
  while (!(await mongoClient.db('admin').command({ hello: 1 })).isWritablePrimary) {
    if (Date.now() > electionDeadline) throw new Error('Test replica set did not elect a primary');
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  db = mongoClient.db(databaseName);

  const registrarId = new ObjectId();
  await db.collection('registrars').insertOne({
    _id: registrarId,
    registrarId: `REG-${runId}`,
    name: 'Receipt Reviewer',
    email: `reviewer.${runId}@example.test`,
    password: 'test-only-unused',
    role: 'Registrar Staff',
    status: 'Active',
    sessionVersion: 0,
  });
  adminToken = jwt.sign({ sub: String(registrarId), role: 'Registrar Staff', sv: 0 },
    jwtSecret, { algorithm: 'HS256', expiresIn: '1h' });

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
  await db.collection('alumni').insertOne({
    _id: new ObjectId(),
    firstName: 'QA',
    lastName: 'FormerStudent',
    email: formerStudentEmail,
    personalEmail: formerStudentEmail,
    passwordHash: await bcrypt.hash(password, 12),
    role: 'former_student',
    status: 'Active',
    yearLevel: '2023',
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
      EXPRESS_REQUEST_POLICY: JSON.stringify({ documents: ['Certified True Copy (CTC)'], additionalFee: 125, processingTime: 'Test policy target', startsWhen: 'Test payment verification' }),
    },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  recordLogs('mobile-api', backendProcess.stdout);
  recordLogs('mobile-api', backendProcess.stderr);
  await waitForApi(`${apiOrigin}/api/health`);
});

test.after(async () => {
  await stopChild(webProcess);
  await stopChild(backendProcess);
  if (db) await db.dropDatabase();
  if (mongoClient) await mongoClient.close();
  await stopChild(mongoProcess);
  if (databaseDirectory) {
    await rm(databaseDirectory, { recursive: true, force: true });
  }
});

test('student registration requires identity fields and saves them after email verification', async (t) => {
  t.after(async () => {
    await db.collection('rate_limits').deleteMany({});
  });
  for (const roleField of ['studentStatus', 'role']) {
    const email = `qa.new-student.${roleField}.${runId}@example.test`.toLowerCase();
    const payload = {
      [roleField]: 'student',
      firstName: 'Current',
      lastName: 'Student',
      schoolEmail: email,
      studentId: roleField === 'role' ? '2026-1002' : '2026-1001',
      yearLevel: roleField === 'role' ? '3rd Year' : 'Grade 12',
      program: roleField === 'role' ? 'BSCS' : 'Science, Technology, Engineering, and Mathematics (STEM)',
      password,
    };
    for (const field of ['studentId', 'schoolEmail', 'firstName', 'lastName', 'yearLevel']) {
      const invalid = await api('/api/auth/register/request-otp', {
        method: 'POST', body: { ...payload, schoolEmail: `missing.${field}.${email}`, [field]: '' },
      });
      assert.equal(invalid.status, 400, `Missing ${field} must be rejected`);
    }
    const invalidId = await api('/api/auth/register/request-otp', {
      method: 'POST', body: { ...payload, studentId: 'bad id!' },
    });
    assert.equal(invalidId.status, 400);
    const invalidGrade = await api('/api/auth/register/request-otp', {
      method: 'POST', body: { ...payload, yearLevel: 'Grade 13' },
    });
    assert.equal(invalidGrade.status, 400);
    const missingProgram = await api('/api/auth/register/request-otp', {
      method: 'POST', body: { ...payload, program: '' },
    });
    assert.equal(missingProgram.status, 400);
    const challenge = await api('/api/auth/register/request-otp', {
      method: 'POST', body: payload,
    });
    assert.equal(challenge.status, 200, JSON.stringify(challenge.data));
    assert.equal(await db.collection('students').findOne({ email }), null);
    const verified = await api('/api/auth/register/verify-otp', {
      method: 'POST',
      body: { email, otp: challenge.data.otp, challengeToken: challenge.data.challengeToken },
    });
    assert.equal(verified.status, 201, JSON.stringify(verified.data));
    const stored = await db.collection('students').findOne({ email });
    assert.equal(stored.role, 'student');
    assert.equal(stored.studentStatus, 'student');
    assert.equal(stored.studentId, payload.studentId);
    assert.equal(stored.yearLevel, payload.yearLevel);
    assert.equal(stored.program, payload.program);
    assert.equal(stored.educationalLevel, roleField === 'role' ? 'bachelors' : 'shs');
    assert.equal(stored.schoolEmail, email);
    assert.equal(stored.personalEmail, '');
    assert.equal(stored.firstName, payload.firstName);
    assert.equal(stored.lastName, payload.lastName);
    const signedIn = await login(email);
    assert.equal(signedIn.status, 200);
    assert.equal(signedIn.data.user.role, 'student');
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
  assert.equal(verified.status, 201, JSON.stringify(verified.data) + logs.join(''));

  const stored = await db.collection('alumni').findOne({ email: alumniEmail });
  assert.ok(stored);
  alumniId = String(stored._id);
  assert.equal(stored.role, 'alumni');
  assert.equal(stored.program, 'BSIT');
  assert.equal(stored.course, 'BSIT');
  assert.equal(stored.status, undefined);
  assert.equal(stored.password, undefined);
  assert.match(stored.passwordHash, /^scrypt-v1\$/);
  assert.equal(await verifyPassword(password, stored.passwordHash), true);

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
  studentToken = studentLogin.data.accessToken;

  const formerStudentLogin = await login(formerStudentEmail);
  assert.equal(formerStudentLogin.status, 200);
  formerStudentToken = formerStudentLogin.data.accessToken;

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
    method: 'POST', body: { docName: 'Certified True Copy (CTC)', purpose: 'Employment' },
  })).status, 401);
  assert.equal((await api('/api/requests', {
    method: 'POST', token: 'invalid',
    body: { docName: 'Certified True Copy (CTC)', purpose: 'Employment' },
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
    body: { docName: 'Certified True Copy (CTC)', purpose: 'Employment' },
  })).status, 404);

  const create = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Certified True Copy (CTC)', purpose: 'Employment' },
  });
  assert.equal(create.status, 201);
  assert.equal(create.data.persisted, true);
  assert.equal(create.data.request.status, 'Pending for Payment');
  trackedRequestId = create.data.request.requestId;
  assert.match(trackedRequestId, /^req_\d+_[a-f0-9]{12}$/);

  const stored = await db.collection('requests').findOne({ requestId: trackedRequestId });
  assert.ok(stored);
  assert.equal(String(stored.userId), alumniId);
  assert.equal(stored.documentType, 'Certified True Copy (CTC)');
  assert.equal(stored.purpose, 'Employment');
  assert.equal(stored.status, 'Pending for Payment');
  assert.equal(stored.mobileStatus, 'pending_payment');
  assert.ok(stored.dateRequested);
  assert.ok(stored.createdAt);

  assert.ok(await db.collection('notifications').findOne({
    userId: stored.userId,
    message: /submitted/i,
  }));

  const duplicate = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Certified True Copy (CTC)', purpose: 'Employment' },
  });
  assert.equal(duplicate.status, 201);
  assert.notEqual(duplicate.data.request.requestId, trackedRequestId);

  const customDocument = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Custom Archive Certification', purpose: 'Personal Use' },
  });
  assert.equal(customDocument.status, 403);
  assert.match(customDocument.data.message, /not eligible/i);

  // Student cannot request Diploma
  const studentDiplomaAttempt = await api('/api/requests', {
    method: 'POST', token: studentToken,
    body: { docName: 'Diploma (2nd Copy)', purpose: 'Employment' },
  });
  assert.equal(studentDiplomaAttempt.status, 403);
  assert.match(studentDiplomaAttempt.data.message, /not eligible/i);

  // Student cannot request TOR
  const studentTorRequest = await api('/api/requests', {
    method: 'POST', token: studentToken,
    body: { docName: 'Transcript of Records (TOR)', purpose: 'Employment' },
  });
  assert.equal(studentTorRequest.status, 403);
  assert.match(studentTorRequest.data.message, /not eligible/i);

  // Alumni CAN request Diploma
  const alumniDiplomaRequest = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Diploma (2nd Copy)', purpose: 'Employment' },
  });
  assert.equal(alumniDiplomaRequest.status, 201);
  assert.equal(alumniDiplomaRequest.data.request.docName, 'Diploma (2nd Copy)');
  assert.equal(alumniDiplomaRequest.data.request.documentPrice, 300);

  // --- Role-based document eligibility ---

  // Former student cannot request TOR
  const formerTor = await api('/api/requests', {
    method: 'POST', token: formerStudentToken,
    body: { docName: 'Transcript of Records (TOR)', purpose: 'Employment' },
  });
  assert.equal(formerTor.status, 403);
  assert.match(formerTor.data.message, /not eligible/i);

  // Former student CAN request CTC
  const formerCtc = await api('/api/requests', {
    method: 'POST', token: formerStudentToken,
    body: { docName: 'Certified True Copy (CTC)', purpose: 'Employment' },
  });
  assert.equal(formerCtc.status, 201);

  // Former student CAN request Certificate of Grades
  const formerGrades = await api('/api/requests', {
    method: 'POST', token: formerStudentToken,
    body: { docName: 'Certificate of Grades', purpose: 'Employment' },
  });
  assert.equal(formerGrades.status, 201);

  // Former student CANNOT request F-137
  const formerF137 = await api('/api/requests', {
    method: 'POST', token: formerStudentToken,
    body: { docName: 'F-137 (SH)', purpose: 'Employment' },
  });
  assert.equal(formerF137.status, 403);
  assert.match(formerF137.data.message, /not eligible/i);

  // Former student CANNOT request Card (re-print)
  const formerCard = await api('/api/requests', {
    method: 'POST', token: formerStudentToken,
    body: { docName: 'Card (re-print)', purpose: 'Employment' },
  });
  assert.equal(formerCard.status, 403);

  // Former student CANNOT request Certificate of Enrollment
  const formerEnrollment = await api('/api/requests', {
    method: 'POST', token: formerStudentToken,
    body: { docName: 'Certificate of Enrollment', purpose: 'Employment' },
  });
  assert.equal(formerEnrollment.status, 403);

  // Former student CANNOT request Diploma
  const formerDiploma = await api('/api/requests', {
    method: 'POST', token: formerStudentToken,
    body: { docName: 'Diploma (2nd Copy)', purpose: 'Employment' },
  });
  assert.equal(formerDiploma.status, 403);

  // Student CAN request F-137
  const studentF137 = await api('/api/requests', {
    method: 'POST', token: studentToken,
    body: { docName: 'F-137 (SH)', purpose: 'Employment' },
  });
  assert.equal(studentF137.status, 201);

  // Student CAN request Card (re-print)
  const studentCard = await api('/api/requests', {
    method: 'POST', token: studentToken,
    body: { docName: 'Card (re-print)', purpose: 'Employment' },
  });
  assert.equal(studentCard.status, 201);

  // Student CAN request Application for Graduation
  const studentGrad = await api('/api/requests', {
    method: 'POST', token: studentToken,
    body: { docName: 'Application for Graduation', purpose: 'Employment' },
  });
  assert.equal(studentGrad.status, 201);

  // Student CAN request Certificate of Enrollment
  const studentEnrollment = await api('/api/requests', {
    method: 'POST', token: studentToken,
    body: { docName: 'Certificate of Enrollment', purpose: 'Employment' },
  });
  assert.equal(studentEnrollment.status, 201);

  // Alumni CANNOT request F-137
  const alumniF137 = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'F-137 (SH)', purpose: 'Employment' },
  });
  assert.equal(alumniF137.status, 403);

  // Alumni CANNOT request Card (re-print)
  const alumniCard = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Card (re-print)', purpose: 'Employment' },
  });
  assert.equal(alumniCard.status, 403);

  // Alumni CANNOT request Student Verification
  const alumniSV = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Student Verification', purpose: 'Employment' },
  });
  assert.equal(alumniSV.status, 403);

  // Alumni CANNOT request Application for Graduation
  const alumniGrad = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Application for Graduation', purpose: 'Employment' },
  });
  assert.equal(alumniGrad.status, 403);

  // Alumni CANNOT request Certificate of Enrollment
  const alumniEnrollment = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Certificate of Enrollment', purpose: 'Employment' },
  });
  assert.equal(alumniEnrollment.status, 403);

  // Alumni CAN request TOR
  const alumniTor = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Transcript of Records (TOR)', purpose: 'Employment' },
  });
  assert.equal(alumniTor.status, 201);

  // Alumni CAN request CTC
  const alumniCtc = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Certified True Copy (CTC)', purpose: 'Employment' },
  });
  assert.equal(alumniCtc.status, 201);

  // Alumni CAN request Certificate of Grades
  const alumniGrades = await api('/api/requests', {
    method: 'POST', token: alumniToken,
    body: { docName: 'Certificate of Grades', purpose: 'Employment' },
  });
  assert.equal(alumniGrades.status, 201);

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
  assert.equal(pendingRecord.status, 'Pending for Payment');
  assert.equal(pendingRecord.docName, 'Certified True Copy (CTC)');
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

  const readyRequest = await api('/api/requests', {
    method: 'POST',
    token: alumniToken,
    body: { docName: 'Certified True Copy (CTC)', purpose: 'Employment' },
  });
  assert.equal(readyRequest.status, 201);
  await db.collection('requests').updateOne(
    { requestId: readyRequest.data.request.requestId, userId: new ObjectId(alumniId) },
    { $set: { status: 'Ready to Claim', updatedAt: new Date().toISOString() } },
  );
  const readyClaim = await api(`/api/requests/${readyRequest.data.request.requestId}/claim`, {
    method: 'POST',
    token: alumniToken,
  });
  assert.equal(readyClaim.status, 200);
  assert.equal(readyClaim.data.request.status, 'Claimed');
  assert.ok(readyClaim.data.request.claimedAt);

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

test('IT-006 Express price and receipt correction preserve ownership, history, and one request', async () => {
  const created = await api('/api/requests', { method: 'POST', token: alumniToken,
    body: { docName: 'Certified True Copy (CTC)', purpose: 'Testing receipt correction', processingOption: 'express', processingFee: 0, totalAmount: 1 } });
  assert.equal(created.status, 201);
  const request = created.data.request;
  assert.equal(request.processingOption, 'express');
  assert.equal(request.totalAmount, 325);
  assert.equal(request.statusHistory.length, 1);
  const forbidden = await api('/api/requests', { method: 'POST', token: alumniToken,
    body: { docName: 'F-137 (SH)', purpose: 'Forged role', role: 'student', processingOption: 'express' } });
  assert.equal(forbidden.status, 403);
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN3sAAAAASUVORK5CYII=', 'base64');
  async function upload(token = alumniToken) {
    const form = new FormData();
    form.append('requestId', request.requestId);
    form.append('paymentType', 'receipt');
    form.append('receipt', new Blob([png], { type: 'image/png' }), 'test.png');
    const response = await fetch(`${apiOrigin}/api/payments/receipt`, { method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form });
    return { status: response.status, data: await response.json() };
  }
  assert.equal((await upload(otherToken)).status, 404);
  const initial = await upload();
  assert.equal(initial.status, 201, JSON.stringify(initial.data));
  const oldReceipt = await db.collection('transactions').findOne({ requestId: request.requestId });
  assert.equal(Number(oldReceipt.amount), 325);
  assert.equal((await upload()).status, 409);
  await db.collection('transactions').updateOne({ _id: oldReceipt._id }, { $set: { status: 'Needs Update', adminRemarks: 'Please upload a legible receipt.' } });
  await db.collection('requests').updateOne({ requestId: request.requestId }, { $set: { status: 'Needs Update', correctionType: 'requirements', remarks: 'Update requirements only.' } });
  assert.equal((await upload()).status, 409, 'Other corrections cannot authorize receipt replacement');
  await db.collection('requests').updateOne({ requestId: request.requestId }, { $set: { correctionType: 'receipt', remarks: 'Please upload a legible receipt.' } });
  const outcomes = await Promise.all([upload(), upload()]);
  assert.deepEqual(outcomes.map(r => r.status).sort(), [201, 409]);
  const stored = await db.collection('transactions').findOne({ _id: oldReceipt._id });
  assert.equal(stored.status, 'Pending Verification');
  assert.equal(stored.receiptHistory.length, 1);
  assert.equal(stored.receiptHistory[0].receiptImage, oldReceipt.receiptImage);
  assert.equal(stored.receiptHistory[0].remarks, 'Please upload a legible receipt.');
  assert.equal(await db.collection('transactions').countDocuments({ requestId: request.requestId }), 1);
  const updated = await db.collection('requests').findOne({ requestId: request.requestId });
  assert.equal(updated.status, 'Pending');
  assert.equal(updated.statusHistory.at(-1).remarks, 'Replacement receipt submitted for review.');
  assert.equal(await db.collection('notifications').countDocuments({ message: 'Replacement receipt submitted for request #' + request.requestId }), 1);
});

test('IT-008 mobile receipt and web review support approval, repeated rejection, and resubmission on one record', async () => {
  webProcess = spawn(process.execPath, ['server.js'], {
    cwd: path.resolve(import.meta.dirname, '../../../web/backend'),
    env: { ...process.env, NODE_ENV: 'development', VERCEL: '',
      PORT: String(webApiPort), MONGODB_URI: `mongodb://127.0.0.1:${mongoPort}`,
      MONGODB_DB_NAME: databaseName, JWT_SECRET: jwtSecret,
      SEED_DEFAULT_USERS: 'false' },
    stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true,
  });
  recordLogs('web-api', webProcess.stdout);
  recordLogs('web-api', webProcess.stderr);
  await waitForApi(`${webApiOrigin}/api/health`);
  try {
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN3sAAAAASUVORK5CYII=', 'base64');
  async function submit(requestId, bytes = png) {
    const form = new FormData();
    form.append('requestId', requestId);
    form.append('paymentType', 'receipt');
    form.append('receipt', new Blob([bytes], { type: 'image/png' }), 'receipt.png');
    const response = await fetch(`${apiOrigin}/api/payments/receipt`, {
      method: 'POST', headers: { Authorization: `Bearer ${alumniToken}` }, body: form,
    });
    return { status: response.status, data: await response.json() };
  }
  async function createRequest(purpose) {
    const response = await api('/api/requests', { method: 'POST', token: alumniToken,
      body: { docName: 'Certified True Copy (CTC)', purpose } });
    assert.equal(response.status, 201);
    return response.data.request.requestId;
  }
  async function webTransaction(requestId) {
    const result = await webApi('/api/transactions?limit=200');
    assert.equal(result.status, 200);
    const transaction = result.data.find((item) => item.requestId === requestId);
    assert.ok(transaction, `Web admin cannot see receipt for ${requestId}`);
    return transaction;
  }
  async function decide(transactionId, status, adminRemarks = '') {
    return webApi(`/api/transactions/${transactionId}/verify`, {
      method: 'PUT', body: { status, adminRemarks },
    });
  }

  const approvedRequestId = await createRequest('Approve readable receipt');
  assert.equal((await submit(approvedRequestId)).status, 201);
  const approvalTx = await webTransaction(approvedRequestId);
  assert.equal(approvalTx.status, 'Pending Verification');
  assert.equal((await decide(approvalTx.transactionId, 'Completed')).status, 200);
  const processingRecord = await db.collection('requests').findOne({ requestId: approvedRequestId });
  assert.equal(processingRecord.status, 'In Process');
  assert.ok(processingRecord.processingStartedAt);
  assert.ok(processingRecord.estimatedCompletionDate);
  assert.equal(processingRecord.processingDays, 5);
  const mobileProcessing = (await api('/api/requests', { token: alumniToken }))
    .data.requests.find((item) => item.requestId === approvedRequestId);
  const webProcessing = (await webApi('/api/requests')).data
    .find((item) => item.requestId === approvedRequestId);
  assert.equal(mobileProcessing.estimatedCompletionDate, processingRecord.estimatedCompletionDate);
  assert.equal(webProcessing.estimatedCompletionDate, processingRecord.estimatedCompletionDate);
  assert.equal((await db.collection('requests').findOne({ requestId: approvedRequestId })).processingStartedAt.toISOString(),
    processingRecord.processingStartedAt.toISOString());
  const manualRequestId = await createRequest('Registrar status transition');
  assert.equal((await webApi(`/api/requests/${manualRequestId}`, {
    method: 'PUT', body: { status: 'Pending' },
  })).status, 200);
  const manuallyStarted = await webApi(`/api/requests/${manualRequestId}`, {
    method: 'PUT', body: { status: 'In Process' },
  });
  assert.equal(manuallyStarted.status, 200);
  assert.ok(manuallyStarted.data.processingStartedAt);
  assert.ok(manuallyStarted.data.estimatedCompletionDate);
  const sameStatus = await webApi(`/api/requests/${manualRequestId}`, {
    method: 'PUT', body: { status: 'In Process' },
  });
  assert.equal(sameStatus.status, 200);
  assert.equal(sameStatus.data.processingStartedAt, manuallyStarted.data.processingStartedAt);
  assert.equal(sameStatus.data.estimatedCompletionDate, manuallyStarted.data.estimatedCompletionDate);
  const legacyProcessingRequestId = await createRequest('Recover legacy processing date');
  await db.collection('requests').updateOne({ requestId: legacyProcessingRequestId }, {
    $set: { status: 'In Process', mobileStatus: 'in_process' },
    $unset: { processingStartedAt: '', processingDays: '', estimatedCompletionDate: '' },
  });
  await db.collection('activitylogs').insertOne({
    userEmail: 'registrar@example.com', userName: 'Registrar',
    action: 'Update Request', status: 'Successful',
    details: `Updated request ${legacyProcessingRequestId} status to In Process`,
    timestamp: new Date('2026-09-11T08:00:00+08:00'),
  });
  const legacyOnMobile = (await api('/api/requests', { token: alumniToken }))
    .data.requests.find((item) => item.requestId === legacyProcessingRequestId);
  assert.equal(legacyOnMobile.estimatedCompletionDate, '2026-09-18');
  assert.equal(legacyOnMobile.processingDays, 5);
  assert.equal((await db.collection('requests').findOne({ requestId: legacyProcessingRequestId }))
    .estimatedCompletionDate, '2026-09-18');
  const webLegacyRequestId = await createRequest('Recover legacy admin date');
  await db.collection('requests').updateOne({ requestId: webLegacyRequestId }, {
    $set: { status: 'In Process', mobileStatus: 'in_process' },
    $unset: { processingStartedAt: '', processingDays: '', estimatedCompletionDate: '' },
  });
  await db.collection('activitylogs').insertOne({
    userEmail: 'registrar@example.com', userName: 'Registrar',
    action: 'Update Request', status: 'Successful',
    details: `Updated request ${webLegacyRequestId} status to In Process`,
    timestamp: new Date('2026-09-11T08:00:00+08:00'),
  });
  const legacyOnWeb = (await webApi('/api/requests')).data
    .find((item) => item.requestId === webLegacyRequestId);
  assert.equal(legacyOnWeb.estimatedCompletionDate, '2026-09-18');
  const unknownStartRequestId = await createRequest('Unknown legacy start');
  await db.collection('requests').updateOne({ requestId: unknownStartRequestId }, {
    $set: { status: 'In Process', mobileStatus: 'in_process' },
    $unset: { processingStartedAt: '', processingDays: '', estimatedCompletionDate: '' },
  });
  const unknownStart = (await api('/api/requests', { token: alumniToken }))
    .data.requests.find((item) => item.requestId === unknownStartRequestId);
  assert.equal(unknownStart.estimatedCompletionDate, '');
  assert.equal((await db.collection('requests').findOne({ requestId: unknownStartRequestId }))
    .processingStartedAt, undefined);
  const storedPeriodId = await createRequest('Use existing estimated period');
  await db.collection('requests').updateOne({ requestId: storedPeriodId }, {
    $set: {
      status: 'In Process', mobileStatus: 'in_process',
      estimatedProcessingStart: new Date('2026-10-01T00:00:00.000Z'),
      estimatedProcessingEnd: new Date('2026-10-06T00:00:00.000Z'),
    },
    $unset: { processingStartedAt: '', processingDays: '', estimatedCompletionDate: '' },
  });
  const storedPeriodMobile = (await api('/api/requests', { token: alumniToken }))
    .data.requests.find((item) => item.requestId === storedPeriodId);
  assert.equal(storedPeriodMobile.estimatedProcessingStart, '2026-10-01T00:00:00.000Z');
  assert.equal(storedPeriodMobile.estimatedProcessingEnd, '2026-10-06T00:00:00.000Z');
  assert.equal(storedPeriodMobile.estimatedCompletionDate, '2026-10-06T00:00:00.000Z');
  assert.equal(storedPeriodMobile.processingDays, null);
  const storedPeriodWeb = (await webApi('/api/requests')).data
    .find((item) => item.requestId === storedPeriodId);
  assert.equal(storedPeriodWeb.estimatedProcessingEnd, '2026-10-06T00:00:00.000Z');
  assert.equal((await db.collection('requests').findOne({ requestId: storedPeriodId }))
    .estimatedCompletionDate, undefined);
  assert.equal((await db.collection('transactions').findOne({ requestId: approvedRequestId })).status, 'Completed');
  const approvedReceiptBeforeRejection = (await api('/api/transactions', { token: alumniToken }))
    .data.transactions.find((item) => item.requestId === approvedRequestId);
  assert.equal(approvedReceiptBeforeRejection.refundEligible, false);
  assert.equal(approvedReceiptBeforeRejection.refundEligibilityStatus, 'Not Eligible');
  const missingRequestReason = await webApi(`/api/requests/${approvedRequestId}`, {
    method: 'PUT', body: { status: 'Rejected' },
  });
  assert.equal(missingRequestReason.status, 400);
  const rejectedRequest = await webApi(`/api/requests/${approvedRequestId}`, {
    method: 'PUT', body: { status: 'Rejected', rejectionReason: 'Document cannot be issued' },
  });
  assert.equal(rejectedRequest.status, 200, JSON.stringify(rejectedRequest.data));
  const refundEligibleRequest = (await api('/api/requests', { token: alumniToken }))
    .data.requests.find((item) => item.requestId === approvedRequestId);
  assert.equal(refundEligibleRequest.status, 'Rejected');
  assert.equal(refundEligibleRequest.receiptStatus, 'Completed');
  assert.equal(refundEligibleRequest.refundEligibilityStatus, 'Refund Eligible');
  assert.equal(refundEligibleRequest.requestRejectionReason, 'Document cannot be issued');
  const eligibleTx = (await api('/api/transactions', { token: alumniToken }))
    .data.transactions.find((item) => item.requestId === approvedRequestId);
  assert.equal(eligibleTx.refundEligible, true);
  const refundRequest = await api('/api/refunds', { method: 'POST', token: alumniToken,
    body: { transactionId: approvalTx.transactionId, refundMethod: 'gcash',
      accountName: 'Mobile Tester', accountNumber: '09123456789',
      reason: 'My paid document request was rejected.' } });
  assert.equal(refundRequest.status, 201, JSON.stringify(refundRequest.data));
  const refundId = refundRequest.data.refundId;
  const adminRefunds = await webApi('/api/transactions/refunds');
  assert.equal(adminRefunds.status, 200);
  assert.ok(adminRefunds.data.some((refund) => refund.refundId === refundId &&
    refund.userReason === 'My paid document request was rejected.'));
  const approvedRefund = await webApi(`/api/transactions/refunds/${refundId}/process`, {
    method: 'PUT', body: { status: 'Approved' },
  });
  assert.equal(approvedRefund.status, 200, JSON.stringify(approvedRefund.data));
  assert.equal((await db.collection('transactions').findOne({ requestId: approvedRequestId })).status,
    'Completed', 'Refund approval must not change the receipt decision');
  assert.equal((await db.collection('requests').findOne({ requestId: approvedRequestId })).refundStatus,
    'Approved');
  const mobileRefunds = await api('/api/refunds', { token: alumniToken });
  assert.equal(mobileRefunds.status, 200);
  assert.ok(mobileRefunds.data.refunds.some((refund) =>
    refund.refundId === refundId && refund.status.toLowerCase() === 'approved'));
  const afterRefund = (await api('/api/transactions', { token: alumniToken }))
    .data.transactions.find((item) => item.requestId === approvedRequestId);
  assert.equal(afterRefund.receiptStatus, 'Completed');
  assert.equal(afterRefund.refundStatus, 'Approved');

  const requestId = await createRequest('Reject and resubmit receipt twice');
  assert.equal((await submit(requestId)).status, 201);
  const firstTx = await webTransaction(requestId);
  assert.equal((await decide(firstTx.transactionId, 'Needs Update')).status, 400,
    'A receipt update without a reason must fail');
  assert.equal((await decide(firstTx.transactionId, 'Needs Update', 'Receipt is unreadable')).status, 200);
  assert.equal((await decide(firstTx.transactionId, 'Completed')).status, 409,
    'A decided receipt cannot be approved without resubmission');
  let request = await db.collection('requests').findOne({ requestId });
  assert.equal(request.status, 'Pending');
  assert.equal(request.correctionType, 'receipt');
  const userRequests = await api('/api/requests', { token: alumniToken });
  const userRequest = userRequests.data.requests.find((item) => item.requestId === requestId);
  assert.equal(userRequest.status, 'Pending');
  assert.equal(userRequest.receiptStatus, 'Needs Update');
  assert.equal(userRequest.refundEligibilityStatus, 'Not Eligible');
  assert.equal(userRequest.remarks, 'Receipt is unreadable');
  const adminRequests = await webApi('/api/requests');
  const adminRequest = adminRequests.data.find((item) => item.requestId === requestId);
  assert.equal(adminRequest.correctionType, 'receipt');
  let transaction = await db.collection('transactions').findOne({ requestId });
  assert.equal(transaction.status, 'Needs Update');
  assert.equal(transaction.rejectionReason, 'Receipt is unreadable');
  const mobileTransactions = await api('/api/transactions', { token: alumniToken });
  const mobileTx = mobileTransactions.data.transactions.find((item) => item.requestId === requestId);
  assert.equal(mobileTx.receiptStatus, 'Needs Update');
  assert.equal(mobileTx.receiptRejectionReason, 'Receipt is unreadable');
  assert.equal(mobileTx.refundEligible, false, 'A rejected receipt is not a rejected paid request');
  const prematureRequestRejection = await webApi(`/api/requests/${requestId}`, {
    method: 'PUT', body: { status: 'Rejected', rejectionReason: 'Unclear receipt' },
  });
  assert.equal(prematureRequestRejection.status, 409);
  assert.equal((await db.collection('requests').findOne({ requestId })).status, 'Pending');
  const invalidReceiptRefund = await api('/api/refunds', { method: 'POST', token: alumniToken,
    body: { transactionId: firstTx.transactionId, refundMethod: 'gcash',
      accountName: 'Mobile Tester', accountNumber: '09123456789' } });
  assert.equal(invalidReceiptRefund.status, 409);
  assert.equal(await db.collection('refunds').countDocuments({ transactionId: firstTx.transactionId }), 0);
  assert.equal((await submit(requestId, Buffer.from('not an image'))).status, 400);
  assert.equal((await submit(requestId, png.subarray(0, 20))).status, 400,
    'A truncated image cannot be accepted');

  const firstReplacement = await submit(requestId);
  assert.equal(firstReplacement.status, 201);
  assert.equal(firstReplacement.data.resubmitted, true);
  assert.equal((await submit(requestId)).status, 409, 'Pending receipts cannot be replaced');
  transaction = await webTransaction(requestId);
  assert.equal(transaction.status, 'Pending Verification');
  assert.equal((await api('/api/transactions', { token: alumniToken })).data.transactions
    .find((item) => item.requestId === requestId).receiptStatus, 'Pending Verification');
  assert.equal(transaction.receiptHistory.length, 1);
  assert.equal(transaction.receiptHistory[0].remarks, 'Receipt is unreadable');
  assert.notEqual(transaction.receiptImage, firstTx.receiptImage);
  assert.equal((await db.collection('requests').findOne({ requestId })).status, 'Pending');

  assert.equal((await decide(firstTx.transactionId, 'Needs Update', 'Receipt is incomplete')).status, 200);
  assert.equal((await submit(requestId)).status, 201);
  transaction = await webTransaction(requestId);
  assert.equal(transaction.receiptHistory.length, 2);
  assert.equal(transaction.receiptHistory[1].remarks, 'Receipt is incomplete');
  assert.equal((await decide(firstTx.transactionId, 'Completed')).status, 200);
  request = await db.collection('requests').findOne({ requestId });
  transaction = await db.collection('transactions').findOne({ requestId });
  assert.equal(request.status, 'In Process');
  assert.equal(request.correctionType, '');
  assert.equal(transaction.status, 'Completed');
  assert.equal(transaction.rejectionReason, '');
  assert.equal(await db.collection('requests').countDocuments({ requestId }), 1);
  assert.equal(await db.collection('transactions').countDocuments({ requestId }), 1);

  const legacyRequestId = await createRequest('Replace older receipt rejection');
  assert.equal((await submit(legacyRequestId)).status, 201);
  await db.collection('requests').updateOne({ requestId: legacyRequestId },
    { $set: { status: 'Rejected', rejectionReason: 'Document Issue' } });
  await db.collection('transactions').updateOne({ requestId: legacyRequestId },
    { $set: { status: 'Rejected', adminRemarks: 'Receipt is blurry' } });
  assert.equal((await submit(legacyRequestId)).status, 409,
    'A rejected document request must not reopen through receipt upload');
  await db.collection('requests').updateOne({ requestId: legacyRequestId },
    { $set: { rejectionReason: 'Payment Issue' } });
  const legacyReplacement = await submit(legacyRequestId);
  assert.equal(legacyReplacement.status, 201);
  assert.equal(legacyReplacement.data.resubmitted, true);
  const legacyRequest = await db.collection('requests').findOne({ requestId: legacyRequestId });
  const legacyTransaction = await db.collection('transactions').findOne({ requestId: legacyRequestId });
  assert.equal(legacyRequest.status, 'Pending');
  assert.equal(legacyRequest.rejectionReason, '');
  assert.equal(legacyTransaction.status, 'Pending Verification');
  assert.equal(legacyTransaction.receiptHistory[0].remarks, 'Receipt is blurry');
  assert.equal(await db.collection('requests').countDocuments({ requestId: legacyRequestId }), 1);
  assert.equal(await db.collection('transactions').countDocuments({ requestId: legacyRequestId }), 1);
  } finally {
    await stopChild(webProcess);
  }
});

test('IT-007 normalized availability, long-password registration and concurrent OTP verification', async () => {
  const existing = await api('/api/auth/email-availability', { method: 'POST', body: { email: ' ' + alumniEmail.toUpperCase() + ' ' } });
  assert.equal(existing.status, 200);
  assert.equal(existing.data.available, false);
  assert.deepEqual(Object.keys(existing.data).sort(), ['available', 'success']);
  const email = `long.${runId}@example.test`;
  const available = await api('/api/auth/email-availability', { method: 'POST', body: { email } });
  assert.equal(available.data.available, true);
  const longPassword = 'Strong1!' + '界'.repeat(100);
  const challenge = await api('/api/auth/register/request-otp', { method: 'POST', body: { ...registrationPayload(email), password: longPassword } });
  assert.equal(challenge.status, 200);
  const results = await Promise.all([1, 2].map(() => api('/api/auth/register/verify-otp', { method: 'POST', body: {
    email, otp: challenge.data.otp, challengeToken: challenge.data.challengeToken,
  } })));
  assert.equal(results.filter(r => r.status === 201).length, 1, JSON.stringify(results));
  assert.equal(await db.collection('alumni').countDocuments({ email }), 1);
  assert.ok(await db.collection('auth_email_claims').findOne({ _id: email }));
  assert.equal((await login(email, longPassword)).status, 200);
  assert.equal((await login(email, longPassword.slice(0, -1) + '改')).status, 401);
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
