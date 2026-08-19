const assert = require('node:assert/strict');
const { test } = require('node:test');

const { ownerQuery } = require('../utils/ownership');

test('record ownership uses immutable user ID with email only as legacy fallback', () => {
  const query = ownerQuery({
    id: 'user-123',
    email: 'Renamed.User@Example.com',
    name: 'A name that may change',
  });
  assert.deepEqual(query, {
    $or: [
      { userId: 'user-123' },
      {
        $expr: {
          $eq: [{ $toString: '$userId' }, 'user-123'],
        },
      },
      {
        $and: [
          {
            $or: [
              { userId: { $exists: false } },
              { userId: null },
              { userId: '' },
            ],
          },
          { email: 'renamed.user@example.com' },
        ],
      },
    ],
  });
  assert.equal(query.name, undefined);
  assert.equal(query.$or.some((clause) => Object.hasOwn(clause, 'name')), false);
});

test('ownership supports collections with a different email field', () => {
  assert.deepEqual(
    ownerQuery(
      { id: 'user-123', email: 'user@example.com' },
      { emailField: 'payerEmail' },
    ),
    {
      $or: [
        { userId: 'user-123' },
        {
          $expr: {
            $eq: [{ $toString: '$userId' }, 'user-123'],
          },
        },
        {
          $and: [
            {
              $or: [
                { userId: { $exists: false } },
                { userId: null },
                { userId: '' },
              ],
            },
            { payerEmail: 'user@example.com' },
          ],
        },
      ],
    },
  );
});

test('email fallback cannot expose a record owned by another user ID', () => {
  const query = ownerQuery({ id: 'current-user', email: 'same@example.com' });
  const emailFallback = query.$or[2];
  assert.deepEqual(emailFallback.$and[0].$or, [
    { userId: { $exists: false } },
    { userId: null },
    { userId: '' },
  ]);
  assert.equal(
    emailFallback.$and[0].$or.some((condition) => condition.userId === 'other-user'),
    false,
  );
});
