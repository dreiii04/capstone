const assert = require('node:assert/strict');
const { test } = require('node:test');

const {
  databaseNameFromUri,
  resolveMongoDatabaseName,
} = require('../utils/mongoConfig');

test('uses the explicit MongoDB database name when configured', () => {
  assert.equal(
    resolveMongoDatabaseName({
      MONGODB_URI: 'mongodb+srv://user:pass@example.invalid/wrong',
      MONGODB_DB_NAME: 'verifitor',
    }),
    'verifitor',
  );
});

test('reads a database name from the MongoDB URI', () => {
  assert.equal(
    databaseNameFromUri(
      'mongodb+srv://user:pass@example.invalid/verifitor?retryWrites=true',
    ),
    'verifitor',
  );
});

test('preserves the existing production database when the URI has no name', () => {
  assert.equal(
    resolveMongoDatabaseName({
      MONGODB_URI: 'mongodb+srv://user:pass@example.invalid/?retryWrites=true',
    }),
    'test',
  );
});

test('rejects invalid database names', () => {
  assert.throws(
    () => resolveMongoDatabaseName({ MONGODB_DB_NAME: 'wrong/name' }),
    /invalid/,
  );
});
