const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');
const mongoose = require('mongoose');

const Request = require('../models/Request');
const Notification = require('../models/Notification');
const ActivityLog = require('../models/ActivityLog');
const BlockchainTransaction = require(
  '../blockchain_essentials/modelBC/blockchainTransactionModel',
);
const blockchainService = require('../services/blockchainService');
const sessionService = require('../services/sessionService');

const originals = {
  requestFindOne: Request.findOne,
  requestFindOneAndUpdate: Request.findOneAndUpdate,
  requestUpdateOne: Request.updateOne,
  blockchainFindOne: BlockchainTransaction.findOne,
  blockchainCreate: BlockchainTransaction.create,
  notificationCreate: Notification.create,
  activityCreate: ActivityLog.create,
  anchorDocumentHash: blockchainService.anchorDocumentHash,
  findUserById: sessionService.findUserById,
};

let controller;

before(() => {
  sessionService.findUserById = async () => ({
    role: 'student',
    course: 'BSCS',
    yearLevel: '4',
  });
  const controllerPath = require.resolve(
    '../blockchain_essentials/controller/transactionController',
  );
  delete require.cache[controllerPath];
  controller = require(controllerPath);
});

after(() => {
  Request.findOne = originals.requestFindOne;
  Request.findOneAndUpdate = originals.requestFindOneAndUpdate;
  Request.updateOne = originals.requestUpdateOne;
  BlockchainTransaction.findOne = originals.blockchainFindOne;
  BlockchainTransaction.create = originals.blockchainCreate;
  Notification.create = originals.notificationCreate;
  ActivityLog.create = originals.activityCreate;
  blockchainService.anchorDocumentHash = originals.anchorDocumentHash;
  sessionService.findUserById = originals.findUserById;
});

function responseRecorder() {
  return {
    statusCode: 200,
    body: null,
    status(value) {
      this.statusCode = value;
      return this;
    },
    json(value) {
      this.body = value;
      return this;
    },
  };
}

function issuedRequest() {
  return {
    _id: new mongoose.Types.ObjectId(),
    requestId: 'REQ-ISSUE-1',
    userId: String(new mongoose.Types.ObjectId()),
    studentId: 'STU-001',
    name: 'Canonical Student',
    documentType: 'Transcript of Records',
    course: 'BSCS',
    yearLevel: '4',
    status: 'In Process',
    documentFile: 'data:application/pdf;base64,JVBERi0=',
    documentHash: 'a'.repeat(64),
    hasDocument: true,
    async save() {},
  };
}

function stubQuery(value) {
  return { select: async () => value, sort: async () => value };
}

test('blockchain issuance derives immutable data from the stored request and releases it', async () => {
  const storedRequest = issuedRequest();
  let createdRecord;
  let anchorArguments;
  let releaseUpdate;

  Request.findOne = () => stubQuery(storedRequest);
  BlockchainTransaction.findOne = () => stubQuery(null);
  BlockchainTransaction.create = async (data) => {
    createdRecord = {
      ...data,
      async save() {},
    };
    return createdRecord;
  };
  Request.findOneAndUpdate = async (_filter, update) => {
    releaseUpdate = update;
    return { ...storedRequest, status: 'Released' };
  };
  Notification.create = async () => ({});
  ActivityLog.create = async () => ({});
  blockchainService.anchorDocumentHash = async (...args) => {
    anchorArguments = args;
    return {
      success: true,
      txID: `0x${'b'.repeat(64)}`,
      blockNumber: 42,
      status: 'Secured on Live Ledger',
    };
  };

  const res = responseRecorder();
  await controller.createTransaction({
    user: {
      id: String(new mongoose.Types.ObjectId()),
      email: 'registrar@example.edu',
      name: 'Registrar',
    },
    body: {
      requestId: storedRequest.requestId,
      nameOfStudent: 'Forged Name',
      studentIDNumber: 'FORGED-ID',
      documentHash: 'forged-hash',
    },
  }, res);

  assert.equal(res.statusCode, 201);
  assert.equal(createdRecord.nameOfStudent, storedRequest.name);
  assert.equal(createdRecord.studentIDNumber, storedRequest.studentId);
  assert.equal(createdRecord.documentHash, storedRequest.documentHash);
  assert.deepEqual(anchorArguments, [
    storedRequest.requestId,
    storedRequest.studentId,
    storedRequest.name,
    storedRequest.documentHash,
  ]);
  assert.equal(createdRecord.blockchainStatus, 'Recorded');
  assert.equal(releaseUpdate.$set.status, 'Released');
  assert.equal(releaseUpdate.$set.blockchainStatus, 'Recorded');
});

test('failed blockchain issuance leaves the request unreleased', async () => {
  const storedRequest = issuedRequest();
  let createdRecord;
  let releaseAttempted = false;
  let failureUpdate;

  Request.findOne = () => stubQuery(storedRequest);
  BlockchainTransaction.findOne = () => stubQuery(null);
  BlockchainTransaction.create = async (data) => {
    createdRecord = { ...data, async save() {} };
    return createdRecord;
  };
  Request.findOneAndUpdate = async () => {
    releaseAttempted = true;
    return null;
  };
  Request.updateOne = async (_filter, update) => {
    failureUpdate = update;
  };
  blockchainService.anchorDocumentHash = async () => {
    const error = new Error('ledger unavailable');
    error.code = 'BLOCKCHAIN_UNAVAILABLE';
    throw error;
  };

  const res = responseRecorder();
  await controller.createTransaction({
    user: {
      id: String(new mongoose.Types.ObjectId()),
      email: 'registrar@example.edu',
    },
    body: { requestId: storedRequest.requestId },
  }, res);

  assert.equal(res.statusCode, 502);
  assert.equal(releaseAttempted, false);
  assert.equal(createdRecord.blockchainStatus, 'Failed');
  assert.equal(failureUpdate.$set.blockchainStatus, 'Failed');
});
