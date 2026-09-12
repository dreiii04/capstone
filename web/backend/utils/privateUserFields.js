// The mobile backend stores bcrypt credentials in `passwordHash`, while the
// web backend's Mongoose models historically used `password`. Records created
// by either backend can be hydrated and returned by User Management, so both
// credential field names must be stripped from every serialized user.
const privateUserFields = ['password', 'passwordHash', 'refreshTokens'];

function removePrivateUserFields(_document, value) {
  if (!value || typeof value !== 'object') return value;
  for (const field of privateUserFields) delete value[field];
  return value;
}

function composeTransform(existingTransform) {
  return (document, value, options) => {
    const transformed = typeof existingTransform === 'function'
      ? existingTransform(document, value, options) || value
      : value;
    return removePrivateUserFields(document, transformed);
  };
}

function protectPrivateUserFields(schema) {
  for (const field of privateUserFields) {
    schema.path(field)?.select(false);
  }

  for (const outputType of ['toJSON', 'toObject']) {
    const current = schema.get(outputType) || {};
    schema.set(outputType, {
      ...current,
      transform: composeTransform(current.transform),
    });
  }
}

module.exports = { protectPrivateUserFields };
