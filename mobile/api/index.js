const { randomBytes } = require('crypto');

let handlerPromise;

/**
 * Loads the Express backend once during a Vercel cold start.
 */
async function loadBackendHandler() {
  const backend = await import('../backend/app.js');

  await backend.initializeBackend();

  return backend.default;
}

/**
 * Converts the public Vercel API path:
 *
 * /api/auth/login
 *
 * into the internal Express route:
 *
 * /auth/login
 */
function removePublicApiPrefix(req) {
  const url = String(req.url || '/');

  if (
    url !== '/api' &&
    !url.startsWith('/api/') &&
    !url.startsWith('/api?')
  ) {
    return;
  }

  const suffix = url.slice('/api'.length);

  req.url = !suffix
    ? '/'
    : suffix.startsWith('?')
      ? `/${suffix}`
      : suffix;
}

/**
 * Vercel serverless entrypoint.
 *
 * The Express application does NOT call app.listen()
 * when running through this file.
 *
 * Web and mobile apps both access:
 *
 * https://your-backend.vercel.app/api/...
 *
 * while Express internally uses routes such as:
 *
 * /auth/login
 * /users
 * /documents
 */
module.exports = async function vercelHandler(req, res) {
  try {
    // Cache initialization during the current
    // Vercel serverless instance.
    handlerPromise ||= loadBackendHandler();

    const handler = await handlerPromise;

    // Example:
    //
    // /api/auth/login
    // becomes
    // /auth/login
    removePublicApiPrefix(req);

    return handler(req, res);
  } catch (error) {
    // Reset it so another invocation can retry
    // if the failure was temporary.
    handlerPromise = undefined;

    const errorId = randomBytes(8).toString('hex');

    console.error(
      `Failed to initialize backend application (${errorId}):`,
      error?.message || error,
    );

    return res.status(503).json({
      success: false,
      message: 'Service temporarily unavailable.',
      errorId,
    });
  }
};