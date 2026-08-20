import cors from 'cors';
import express from 'express';
import helmet from 'helmet';

import config from '../config/config.js';
import { ensureDb } from '../config/db.js';
import {
  apiLimiter,
  authLimiter,
} from './rate-limit.middleware.js';

let startupErrorLogged = false;

function isHealthPath(req) {
  return (
    req.path === '/health' ||
    req.path === '/api/health'
  );
}

export function applyAppMiddleware(app) {
  app.disable('x-powered-by');

  // --------------------------------------------------
  // TRUST PROXY
  // --------------------------------------------------

  if (config.trustProxyHops > 0) {
    app.set(
      'trust proxy',
      config.trustProxyHops,
    );
  }

  // --------------------------------------------------
  // SECURITY HEADERS
  // --------------------------------------------------

  app.use(
    helmet({
      strictTransportSecurity:
        config.isProduction
          ? {
              maxAge: 63_072_000,
              includeSubDomains: true,
              preload: true,
            }
          : false,
    }),
  );

  // --------------------------------------------------
  // HTTPS
  // --------------------------------------------------

  // Vercel terminates HTTPS before forwarding
  // the request to the Node function.
  //
  // "trust proxy" above makes req.secure work.
  app.use((req, res, next) => {
    if (
      !config.isProduction ||
      req.secure
    ) {
      return next();
    }

    return res.status(400).json({
      success: false,
      message: 'HTTPS is required.',
    });
  });

  // --------------------------------------------------
  // CORS
  // --------------------------------------------------

  app.use(
    cors({
      origin(origin, callback) {
        // Flutter Android/iOS requests normally
        // have no browser Origin header.
        if (!origin) {
          return callback(
            null,
            true,
          );
        }

        // Local development can optionally use "*".
        if (
          !config.isProduction &&
          config.allowedOrigins.includes(
            '*',
          )
        ) {
          return callback(
            null,
            true,
          );
        }

        // Browser-based clients / Flutter Web
        // must exist in ALLOWED_ORIGIN.
        return callback(
          null,
          config.allowedOrigins.includes(
            origin,
          ),
        );
      },

      credentials: false,

      methods: [
        'GET',
        'POST',
        'PUT',
        'PATCH',
        'DELETE',
        'OPTIONS',
      ],

      allowedHeaders: [
        'Authorization',
        'Content-Type',
        'X-Notification-Key',
      ],
    }),
  );

  // --------------------------------------------------
  // CONFIG VALIDATION
  // --------------------------------------------------

  app.use((_req, res, next) => {
    if (!config.startupError) {
      return next();
    }

    if (!startupErrorLogged) {
      console.error(
        `Startup configuration error: ${config.startupError}`,
      );

      startupErrorLogged = true;
    }

    return res.status(503).json({
      success: false,
      message:
        'Service configuration is unavailable.',
    });
  });

  // --------------------------------------------------
  // NO CACHE
  // --------------------------------------------------

  app.use((_req, res, next) => {
    res.set(
      'Cache-Control',
      'no-store',
    );

    res.set(
      'Pragma',
      'no-cache',
    );

    next();
  });

  // --------------------------------------------------
  // STATIC PROFILE UPLOADS
  // --------------------------------------------------

  app.use(
    '/uploads/profiles',
    express.static(
      config.paths.profiles,
      {
        dotfiles: 'deny',
        index: false,
        maxAge: '1d',
      },
    ),
  );

  // --------------------------------------------------
  // JSON
  // --------------------------------------------------

  app.use(
    express.json({
      limit: '1mb',
    }),
  );

  // --------------------------------------------------
  // DATABASE
  // --------------------------------------------------

  // Do not block /health when MongoDB is down.
  //
  // This makes it easier to tell whether:
  // 1. Node/Vercel is alive
  // 2. MongoDB is unavailable
  app.use(
    async (req, res, next) => {
      if (isHealthPath(req)) {
        return next();
      }

      try {
        await ensureDb();

        return next();
      } catch (error) {
        console.error(
          config.isProduction
            ? 'Database unavailable.'
            : `Database unavailable: ${error.message}`,
        );

        return res
          .status(503)
          .json({
            success: false,
            message:
              'Database is temporarily unavailable.',
          });
      }
    },
  );

  // --------------------------------------------------
  // RATE LIMITING
  // --------------------------------------------------

  app.use(apiLimiter);

  app.use(
    '/auth',
    authLimiter,
  );
}