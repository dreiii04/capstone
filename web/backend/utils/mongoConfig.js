// Existing production data is stored in this database. Keep the fallback for
// backwards compatibility, while deployments should set MONGODB_DB_NAME
// explicitly so operators always know where records are written.
const DEFAULT_DATABASE_NAME = 'test';

function databaseNameFromUri(uri) {
  const value = String(uri || '').trim();
  if (!value) return '';

  try {
    const parsed = new URL(value);
    const pathname = decodeURIComponent(parsed.pathname || '');
    return pathname.replace(/^\/+/, '').trim();
  } catch (_error) {
    return '';
  }
}

function resolveMongoDatabaseName(env = process.env) {
  const explicitName = String(env.MONGODB_DB_NAME || '').trim();
  const uriName = databaseNameFromUri(env.MONGODB_URI);
  const databaseName = explicitName || uriName || DEFAULT_DATABASE_NAME;

  // MongoDB database names cannot contain these characters. Validate before
  // connecting so a configuration typo does not silently route writes.
  if (!databaseName || /[\s/\\."$*<>:|?]/.test(databaseName)) {
    throw new Error('MONGODB_DB_NAME is invalid.');
  }
  return databaseName;
}

module.exports = {
  DEFAULT_DATABASE_NAME,
  databaseNameFromUri,
  resolveMongoDatabaseName,
};
