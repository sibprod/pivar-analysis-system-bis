// server.js
// Profil-Cognitif v9.0 — Web Service Render
//
// Express qui :
//   - expose les endpoints HTTP via routes/index.js
//   - démarre le polling de queueService
//   - gère le graceful shutdown (SIGTERM/SIGINT)

'use strict';

require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const bodyParser   = require('body-parser');

const logger        = require('./utils/logger');
const routes        = require('./routes');
const queueService  = require('./services/queueService');

const app = express();
const PORT = process.env.PORT || 3000;

// ─── VERSION ──────────────────────────────────────────────────────────────────
const APP_NAME    = 'Profil-Cognitif Analysis System';
const APP_VERSION = require('./package.json').version;  // 9.0.0

// ─── MIDDLEWARES ──────────────────────────────────────────────────────────────
app.use(cors({
  origin: process.env.CORS_ORIGINS === '*' ? true : (process.env.CORS_ORIGINS || '*').split(',')
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

// ─── REQUEST LOGGING ──────────────────────────────────────────────────────────
app.use((req, res, next) => {
  logger.debug('HTTP request', {
    method: req.method,
    path:   req.path,
    ip:     req.ip
  });
  next();
});

// ─── ROUTES ───────────────────────────────────────────────────────────────────
app.use('/', routes);

// Endpoint /health (avant routes pour éviter conflits)
app.get('/health', (req, res) => {
  res.json({
    status:      'OK',
    version:     APP_VERSION,
    name:        APP_NAME,
    timestamp:   new Date().toISOString(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// ─── ERROR HANDLER ────────────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  logger.error('Unhandled HTTP error', {
    method: req.method,
    path:   req.path,
    error:  err.message,
    stack:  err.stack?.substring(0, 500)
  });

  res.status(err.status || 500).json({
    error:   err.message || 'Internal Server Error',
    success: false
  });
});

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({
    error:   `Route not found: ${req.method} ${req.path}`,
    success: false
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// STARTUP
// ═══════════════════════════════════════════════════════════════════════════

const server = app.listen(PORT, () => {
  logger.info(`${APP_NAME} v${APP_VERSION} — pivar-analysis-system-bis`);
  logger.info('Server started', {
    port:        String(PORT),
    env:         process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });

  // Vérifier la config minimale
  const requiredEnv = ['CLAUDE_API_KEY', 'AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID'];
  const missing = requiredEnv.filter(k => !process.env[k]);

  if (missing.length > 0) {
    logger.error('Missing environment variables', { missing });
    logger.warn('Service started but cannot function without these vars');
  } else {
    logger.info('Configuration OK');
  }

  // Démarrer le polling si activé
  if (process.env.ENABLE_POLLING !== 'false') {
    const intervalMs = parseInt(process.env.POLLING_INTERVAL) || 300000;
    queueService.startPolling(intervalMs);
    logger.info('Starting polling service', {
      intervalMinutes: (intervalMs / 60000).toFixed(1)
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GRACEFUL SHUTDOWN
// ═══════════════════════════════════════════════════════════════════════════

let isShuttingDown = false;

function gracefulShutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  logger.info(`${signal} received — graceful shutdown starting`);

  // Arrêter le polling
  try {
    queueService.stopPolling();
  } catch (e) {
    logger.error('Error stopping polling', { error: e.message });
  }

  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });

  // Force exit après 10 secondes max
  setTimeout(() => {
    logger.warn('Force exit after shutdown timeout');
    process.exit(1);
  }, 10000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT',  () => gracefulShutdown('SIGINT'));

process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', {
    reason: reason?.message || String(reason),
    stack:  reason?.stack?.substring(0, 500)
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', {
    error: error.message,
    stack: error.stack?.substring(0, 500)
  });
  // Force exit après uncaught exception (état potentiellement corrompu)
  setTimeout(() => process.exit(1), 1000);
});

module.exports = app;
