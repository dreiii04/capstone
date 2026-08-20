const privateUserFields = ['password', 'refreshTokens'];

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
