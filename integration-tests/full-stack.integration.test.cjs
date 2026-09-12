const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const path = require('node:path');
const test = require('node:test');

const bcrypt = require('../web/backend/node_modules/bcryptjs');
const jwt = require('../mobile/node_modules/jsonwebtoken');
const {
  MongoClient,
  ObjectId,
} = require('../mobile/node_modules/mongodb');

const workspace = path.resolve(__dirname, '..');
const mongoUri = 'mongodb://127.0.0.1:27019';
const databaseName = 'verifitor_full_stack_integration_test';
const mobileOrigin = 'http://127.0.0.1:4101';
const webOrigin = 'http://127.0.0.1:5101';
const jwtSecret = 'integration-test-secret-only-2026-08-23-0123456789';
const runId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
const alumniEmail = `qa.alumni.${runId}@example.test`;
const studentEmail = `qa.student.${runId}@example.test`;
const inactiveEmail = `qa.inactive.${runId}@example.test`;
const adminEmail = `qa.admin.${runId}@example.test`;
const userPassword = 'SafeTest1!';
const adminPassword = 'SafeAdminTest1!';

let mongoClient;
let db;
let mobileProcess;
let webProcess;
const processLogs = new Map();

function startNode(label, cwd, entry, environment) {
  const child = spawn(process.execPath, [entry], {
    cwd,
    env: { ...process.env, ...environment },
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const logs = [];
  processLogs.set(label, logs);
  for (const stream of [child.stdout, child.stderr]) {
    stream.on('data', (chunk) => {
      logs.push(String(chunk));
      if (logs.length > 200) logs.shift();
    });
  }
  return child;
}

async function stopProcess(child) {
  if (!child || child.exitCode != null) return;
  child.kill('SIGTERM');
  await Promise.race([
    once(child, 'exit'),
    new Promise((resolve) => setTimeout(resolve, 3000)),
  ]);
  if (child.exitCode == null) child.kill('SIGKILL');
}

async function waitFor(url, expectedStatus = 200) {
  const deadline = Date.now() + 20_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status === expectedStatus) return response;
      lastError = new Error(`${url} returned ${response.status}`);
    } catch (error) {
      lastError = error;
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  const logs = [...processLogs.entries()]
    .map(([label, entries]) => `${label}:\n${entries.join('')}`)
    .join('\n');
  throw new Error(`Timed out waiting for ${url}: ${lastError?.message}\n${logs}`);
}

async function api(origin, route, {
  method = 'GET',
  token,
  body,
  form,
} = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${origin}${route}`, {
    method,
    headers,
    body: form || (body === undefined ? undefined : JSON.stringify(body)),
  });
  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json')
    ? await response.json()
    : await response.arrayBuffer();
  return { status: response.status, data, headers: response.headers };
}

function assertNoAuthenticationSecrets(value) {
  const serialized = JSON.stringify(value);
  assert.equal(serialized.includes('passwordHash'), false);
  assert.equal(serialized.includes('refreshTokens'), false);
  assert.equal(serialized.includes('tokenHash'), false);
  assert.equal(serialized.includes(userPassword), false);
}

test.before(async () => {
  mongoClient = new MongoClient(mongoUri);
  await mongoClient.connect();
  db = mongoClient.db(databaseName);
  await db.dropDatabase();

  const now = new Date();
  await db.collection('superadmins').insertOne({
    _id: new ObjectId(),
    email: adminEmail,
    password: await bcrypt.hash(adminPassword, 10),
    role: 'super admin',
    name: 'QA Super Admin',
    sessionVersion: 0,
    refreshTokens: [],
    createdAt: now,
    updatedAt: now,
  });
  await db.collection('students').insertMany([
    {
      _id: new ObjectId(),
      firstName: 'QA',
      lastName: 'Student',
      email: studentEmail,
      schoolEmail: studentEmail,
      passwordHash: await bcrypt.hash(userPassword, 12),
      role: 'student',
      status: 'Active',
      studentId: `STU-${runId.slice(-8)}`,
      course: 'BSIT',
      program: 'BSIT',
      yearLevel: '3rd Year',
      sessionVersion: 0,
      refreshTokens: [],
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
  ]);
  await db.collection('alumni').insertOne({
    _id: new ObjectId(),
    firstName: 'QA',
    lastName: 'Inactive',
    email: inactiveEmail,
    personalEmail: inactiveEmail,
    passwordHash: await bcrypt.hash(userPassword, 12),
    role: 'alumni',
    status: 'Inactive',
    yearLevel: '2025',
    course: 'BSIT',
    program: 'BSIT',
    sessionVersion: 0,
    refreshTokens: [],
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
  });

  const shared = {
    NODE_ENV: 'development',
    MONGODB_URI: mongoUri,
    MONGODB_DB_NAME: databaseName,
    JWT_SECRET: jwtSecret,
    OTP_DEV_MODE: 'true',
    SEED_DEFAULT_USERS: 'false',
  };
  mobileProcess = startNode(
    'mobile backend',
    path.join(workspace, 'mobile', 'backend'),
    'server.js',
    {
      ...shared,
      PORT: '4101',
      DISABLE_DB: 'false',
      RUN_DB_MIGRATIONS: 'true',
      JWT_ISSUER: 'verifitor',
      JWT_AUDIENCE: 'verifitor-mobile',
      ALLOWED_ORIGIN: 'http://127.0.0.1:5173',
      SMTP_HOST: '',
      SMTP_USER: '',
      SMTP_PASS: '',
      SMTP_FROM: '',
      CLOUDINARY_URL: '',
      CLOUDINARY_CLOUD_NAME: '',
      CLOUDINARY_API_KEY: '',
      CLOUDINARY_API_SECRET: '',
    },
  );
  webProcess = startNode(
    'web backend',
    path.join(workspace, 'web', 'backend'),
    'server.js',
    {
      ...shared,
      PORT: '5101',
      ALLOWED_ORIGINS: 'http://127.0.0.1:5173',
      FRONTEND_URL: 'http://127.0.0.1:5173',
    },
  );
  await Promise.all([
    waitFor(`${mobileOrigin}/api/health`),
    waitFor(`${webOrigin}/api/health`),
  ]);
});

test.after(async () => {
  await Promise.all([stopProcess(mobileProcess), stopProcess(webProcess)]);
  if (db) await db.dropDatabase();
  if (mongoClient) await mongoClient.close();
});

test('IT-001 mobile registration persists one hashed account visible to web management', async (t) => {
  await t.test('rejects missing, invalid-email, and invalid-role registration data', async () => {
    const missing = await api(mobileOrigin, '/api/auth/register/request-otp', {
      method: 'POST',
      body: {},
    });
    assert.equal(missing.status, 400);

    const invalidEmail = await api(mobileOrigin, '/api/auth/register/request-otp', {
      method: 'POST',
      body: {
        studentStatus: 'alumni', educationalLevel: 'bachelors',
        firstName: 'QA', lastName: 'Invalid', email: 'not-an-email',
        password: userPassword, program: 'BSIT', yearGraduated: '2025',
      },
    });
    assert.equal(invalidEmail.status, 400);

    const invalidRole = await api(mobileOrigin, '/api/auth/register/request-otp', {
      method: 'POST',
      body: {
        studentStatus: 'super_admin', educationalLevel: 'bachelors',
        firstName: 'QA', lastName: 'Invalid', email: alumniEmail,
        password: userPassword, program: 'BSIT', yearGraduated: '2025',
      },
    });
    assert.equal(invalidRole.status, 400);
  });

  const registration = {
    studentStatus: 'alumni',
    educationalLevel: 'bachelors',
    firstName: 'QA',
    lastName: 'Integration',
    email: alumniEmail,
    password: userPassword,
    program: 'BSIT',
    yearGraduated: '2025',
  };
  const otpResponse = await api(mobileOrigin, '/api/auth/register/request-otp', {
    method: 'POST', body: registration,
  });
  assert.equal(otpResponse.status, 200);
  assert.match(otpResponse.data.otp, /^\d{6}$/);
  assert.match(otpResponse.data.challengeToken, /^[a-f0-9]{64}$/);

  const verify = await api(mobileOrigin, '/api/auth/register/verify-otp', {
    method: 'POST',
    body: {
      email: alumniEmail,
      otp: otpResponse.data.otp,
      challengeToken: otpResponse.data.challengeToken,
    },
  });
  assert.equal(verify.status, 201);

  const stored = await db.collection('alumni').findOne({ email: alumniEmail });
  assert.ok(stored);
  assert.equal(stored.firstName, registration.firstName);
  assert.equal(stored.lastName, registration.lastName);
  assert.equal(stored.role, 'alumni');
  assert.equal(stored.password, undefined);
  assert.match(stored.passwordHash, /^\$2[aby]\$12\$/);
  assert.equal(await bcrypt.compare(userPassword, stored.passwordHash), true);
  assert.equal(await db.collection('alumni').countDocuments({ email: alumniEmail }), 1);

  const duplicate = await api(mobileOrigin, '/api/auth/register/request-otp', {
    method: 'POST', body: registration,
  });
  assert.equal(duplicate.status, 409);
  assert.equal(await db.collection('alumni').countDocuments({ email: alumniEmail }), 1);

  const adminLogin = await api(webOrigin, '/api/auth/login', {
    method: 'POST', body: { email: adminEmail, password: adminPassword },
  });
  assert.equal(adminLogin.status, 200);
  assert.equal(adminLogin.data.user.role, 'super admin');
  const users = await api(webOrigin, '/api/v1/alumni', {
    token: adminLogin.data.accessToken,
  });
  assert.equal(users.status, 200);
  const visible = users.data.data.find((user) => user.email === alumniEmail);
  assert.ok(visible);
  assert.equal(visible.firstName, registration.firstName);
  assert.equal(visible.lastName, registration.lastName);
  assertNoAuthenticationSecrets(visible);
});

test('IT-002 authentication validates passwords, status, tokens, and roles', async () => {
  const validAlumni = await api(mobileOrigin, '/api/auth/login', {
    method: 'POST', body: { email: alumniEmail, password: userPassword },
  });
  assert.equal(validAlumni.status, 200);
  assert.equal(validAlumni.data.user.role, 'alumni');
  assert.match(validAlumni.data.accessToken, /^[^.]+\.[^.]+\.[^.]+$/);
  assert.match(validAlumni.data.refreshToken, /^[a-f0-9]{96}$/);

  const validStudent = await api(mobileOrigin, '/api/auth/login', {
    method: 'POST', body: { email: studentEmail, password: userPassword },
  });
  assert.equal(validStudent.status, 200);
  assert.equal(validStudent.data.user.role, 'student');

  for (const body of [
    { email: alumniEmail, password: 'WrongTest1!' },
    { email: `missing.${runId}@example.test`, password: userPassword },
  ]) {
    const response = await api(mobileOrigin, '/api/auth/login', { method: 'POST', body });
    assert.equal(response.status, 401);
  }
  const empty = await api(mobileOrigin, '/api/auth/login', { method: 'POST', body: {} });
  assert.equal(empty.status, 400);
  const inactive = await api(mobileOrigin, '/api/auth/login', {
    method: 'POST', body: { email: inactiveEmail, password: userPassword },
  });
  assert.equal(inactive.status, 403);

  const invalidToken = await api(mobileOrigin, '/api/profile', { token: 'not-a-jwt' });
  assert.equal(invalidToken.status, 401);
  const alumni = await db.collection('alumni').findOne({ email: alumniEmail });
  const expired = jwt.sign(
    { sub: String(alumni._id), email: alumniEmail, role: 'alumni', sv: 0 },
    jwtSecret,
    { algorithm: 'HS256', issuer: 'verifitor', audience: 'verifitor-mobile', expiresIn: -60 },
  );
  const expiredToken = await api(mobileOrigin, '/api/profile', { token: expired });
  assert.equal(expiredToken.status, 401);

  const forbiddenManagement = await api(webOrigin, '/api/v1/alumni', {
    token: validAlumni.data.accessToken,
  });
  assert.ok([401, 403].includes(forbiddenManagement.status));
  const forbiddenDashboard = await api(webOrigin, '/api/dashboard/stats', {
    token: validAlumni.data.accessToken,
  });
  assert.ok([401, 403].includes(forbiddenDashboard.status));

  const adminLogin = await api(webOrigin, '/api/auth/login', {
    method: 'POST', body: { email: adminEmail, password: adminPassword },
  });
  assert.equal(adminLogin.status, 200);
  const dashboard = await api(webOrigin, '/api/dashboard/stats', {
    token: adminLogin.data.accessToken,
  });
  assert.equal(dashboard.status, 200);
});

test('IT-003 and IT-004 request persistence, web status management, mobile sync, notifications, and logs', async () => {
  const login = await api(mobileOrigin, '/api/auth/login', {
    method: 'POST', body: { email: alumniEmail, password: userPassword },
  });
  assert.equal(login.status, 200);
  const userToken = login.data.accessToken;

  const missingDocument = await api(mobileOrigin, '/api/requests', {
    method: 'POST', token: userToken, body: { purpose: 'Employment' },
  });
  assert.equal(missingDocument.status, 400);
  const missingPurpose = await api(mobileOrigin, '/api/requests', {
    method: 'POST', token: userToken, body: { docName: 'Certificate of Enrollment' },
  });
  assert.equal(missingPurpose.status, 400);
  const unauthorized = await api(mobileOrigin, '/api/requests', {
    method: 'POST', body: { docName: 'Certificate of Enrollment', purpose: 'Employment' },
  });
  assert.equal(unauthorized.status, 401);

  const create = await api(mobileOrigin, '/api/requests', {
    method: 'POST',
    token: userToken,
    body: { docName: 'Certificate of Enrollment', purpose: 'Employment' },
  });
  assert.equal(create.status, 201);
  assert.equal(create.data.persisted, true);
  assert.match(create.data.request.requestId, /^req_\d+_[a-f0-9]{12}$/);
  assert.equal(create.data.request.status, 'pending_payment');
  const requestId = create.data.request.requestId;

  const stored = await db.collection('requests').findOne({ requestId });
  assert.ok(stored);
  assert.equal(String(stored.userId), String(login.data.user.id));
  assert.equal(stored.documentType, 'Certificate of Enrollment');
  assert.equal(stored.status, 'Pending');
  assert.ok(stored.dateRequested);
  assert.ok(await db.collection('notifications').findOne({
    userId: stored.userId,
    message: /submitted/i,
  }));

  const duplicate = await api(mobileOrigin, '/api/requests', {
    method: 'POST',
    token: userToken,
    body: { docName: 'Certificate of Enrollment', purpose: 'Employment' },
  });
  assert.equal(duplicate.status, 201);
  assert.notEqual(duplicate.data.request.requestId, requestId);

  const adminLogin = await api(webOrigin, '/api/auth/login', {
    method: 'POST', body: { email: adminEmail, password: adminPassword },
  });
  assert.equal(adminLogin.status, 200);
  const adminToken = adminLogin.data.accessToken;

  const webList = await api(webOrigin, '/api/requests', { token: adminToken });
  assert.equal(webList.status, 200);
  assert.ok(webList.data.some((request) => request.requestId === requestId));

  const forbiddenUpdate = await api(webOrigin, `/api/requests/${requestId}`, {
    method: 'PUT', token: userToken, body: { status: 'In Process' },
  });
  assert.ok([401, 403].includes(forbiddenUpdate.status));

  const invalidStatus = await api(webOrigin, `/api/requests/${requestId}`, {
    method: 'PUT', token: adminToken, body: { status: 'Completed' },
  });
  assert.equal(invalidStatus.status, 400);
  const invalidTransition = await api(webOrigin, `/api/requests/${requestId}`, {
    method: 'PUT', token: adminToken, body: { status: 'In Process' },
  });
  assert.equal(invalidTransition.status, 409);

  const initialUpdatedAt = new Date(stored.updatedAt).getTime();
  const processing = await api(webOrigin, `/api/requests/${requestId}`, {
    method: 'PUT',
    token: adminToken,
    body: { status: 'In Process', forceOverride: true },
  });
  assert.equal(processing.status, 200);
  assert.equal(processing.data.status, 'In Process');
  const processingDb = await db.collection('requests').findOne({ requestId });
  assert.equal(processingDb.status, 'In Process');
  assert.ok(new Date(processingDb.updatedAt).getTime() >= initialUpdatedAt);

  const mobileProcessing = await api(mobileOrigin, '/api/requests', { token: userToken });
  assert.equal(mobileProcessing.status, 200);
  assert.equal(
    mobileProcessing.data.requests.find((request) => request.requestId === requestId).status,
    'In Process',
  );
  const webProcessing = await api(webOrigin, '/api/requests', { token: adminToken });
  assert.equal(
    webProcessing.data.find((request) => request.requestId === requestId).status,
    'In Process',
  );

  const form = new FormData();
  form.append(
    'document',
    new Blob([Buffer.from('%PDF-1.4\n% isolated integration test\n%%EOF\n')], {
      type: 'application/pdf',
    }),
    'integration-test.pdf',
  );
  const upload = await api(webOrigin, `/api/requests/${requestId}/upload`, {
    method: 'POST', token: adminToken, form,
  });
  assert.equal(upload.status, 200);
  assert.equal(upload.data.hasDocument, true);

  const released = await api(webOrigin, `/api/requests/${requestId}`, {
    method: 'PUT', token: adminToken, body: { status: 'Released' },
  });
  assert.equal(released.status, 200);
  assert.equal(released.data.status, 'Released');
  const releasedDb = await db.collection('requests').findOne({ requestId });
  assert.equal(releasedDb.status, 'Released');
  assert.equal(releasedDb.hasDocument, true);

  const mobileReleased = await api(mobileOrigin, '/api/requests', { token: userToken });
  assert.equal(
    mobileReleased.data.requests.find((request) => request.requestId === requestId).status,
    'Released',
  );
  const webReleased = await api(webOrigin, '/api/requests', { token: adminToken });
  assert.equal(
    webReleased.data.find((request) => request.requestId === requestId).status,
    'Released',
  );

  const notifications = await api(mobileOrigin, '/api/notifications', { token: userToken });
  assert.equal(notifications.status, 200);
  assert.ok(notifications.data.notifications.some((item) => /In Process/i.test(item.message)));
  assert.ok(notifications.data.notifications.some((item) => /ready for pickup/i.test(item.message)));

  await new Promise((resolve) => setTimeout(resolve, 300));
  assert.ok(await db.collection('activitylogs').findOne({
    action: 'Force Override', details: new RegExp(requestId),
  }));
  assert.ok(await db.collection('activitylogs').findOne({
    action: 'Update Request', details: new RegExp(requestId),
  }));
  assert.ok(await db.collection('auditlogs').findOne({
    method: 'PUT', path: `/api/requests/${requestId}`, statusCode: 200,
  }));
  const collectionNames = (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((collection) => collection.name.toLowerCase());
  assert.equal(collectionNames.includes('requesthistories'), false);
});

test('IT-005 mobile profile updates persist and remain restricted in web management', async () => {
  const login = await api(mobileOrigin, '/api/auth/login', {
    method: 'POST', body: { email: alumniEmail, password: userPassword },
  });
  assert.equal(login.status, 200);
  const userToken = login.data.accessToken;
  const before = await api(mobileOrigin, '/api/profile', { token: userToken });
  assert.equal(before.status, 200);
  assert.equal(before.data.user.email, alumniEmail);
  const immutableId = before.data.user.id;

  const empty = await api(mobileOrigin, '/api/profile', {
    method: 'PUT', token: userToken, body: {},
  });
  assert.equal(empty.status, 400);
  const invalidEmail = await api(mobileOrigin, '/api/profile', {
    method: 'PUT',
    token: userToken,
    body: {
      firstName: 'QA', lastName: 'Updated', personalEmail: 'invalid',
      schoolEmail: '', studentId: '', yearLevel: '2025', program: 'BSCS',
    },
  });
  assert.equal(invalidEmail.status, 400);
  const changedEmail = await api(mobileOrigin, '/api/profile', {
    method: 'PUT',
    token: userToken,
    body: {
      firstName: 'QA', lastName: 'Updated',
      personalEmail: `other.${runId}@example.test`, schoolEmail: '',
      studentId: '', yearLevel: '2025', program: 'BSCS',
    },
  });
  assert.equal(changedEmail.status, 400);
  const unauthenticated = await api(mobileOrigin, '/api/profile', {
    method: 'PUT', body: { firstName: 'QA', lastName: 'Updated' },
  });
  assert.equal(unauthenticated.status, 401);

  const update = await api(mobileOrigin, '/api/profile', {
    method: 'PUT',
    token: userToken,
    body: {
      firstName: 'Quality',
      lastName: 'Updated',
      personalEmail: alumniEmail,
      schoolEmail: '',
      studentId: '',
      yearLevel: '2025',
      program: 'BSCS',
      role: 'super admin',
      status: 'Inactive',
      id: new ObjectId().toString(),
      password: 'InjectedPassword1!',
      passwordHash: 'injected',
    },
  });
  assert.equal(update.status, 200);
  assert.equal(update.data.user.id, immutableId);
  assert.equal(update.data.user.role, 'alumni');
  assert.equal(update.data.user.program, 'BSCS');

  const refreshed = await api(mobileOrigin, '/api/profile', { token: userToken });
  assert.equal(refreshed.status, 200);
  assert.equal(refreshed.data.user.firstName, 'Quality');
  assert.equal(refreshed.data.user.program, 'BSCS');
  assert.equal(refreshed.data.user.id, immutableId);
  assert.equal(refreshed.data.user.role, 'alumni');

  const stored = await db.collection('alumni').findOne({ email: alumniEmail });
  assert.equal(String(stored._id), immutableId);
  assert.equal(stored.role, 'alumni');
  assert.notEqual(stored.status, 'Inactive');
  assert.match(stored.passwordHash, /^\$2[aby]\$12\$/);
  assert.equal(stored.firstName, 'Quality');
  assert.equal(stored.program, 'BSCS');
  assert.equal(stored.course, 'BSCS');

  const adminLogin = await api(webOrigin, '/api/auth/login', {
    method: 'POST', body: { email: adminEmail, password: adminPassword },
  });
  const users = await api(webOrigin, '/api/v1/alumni', {
    token: adminLogin.data.accessToken,
  });
  const visible = users.data.data.find((user) => user.email === alumniEmail);
  assert.ok(visible);
  assert.equal(visible.firstName, 'Quality');
  assert.equal(visible.lastName, 'Updated');
  assert.equal(visible.course, 'BSCS');
  assertNoAuthenticationSecrets(visible);
});
