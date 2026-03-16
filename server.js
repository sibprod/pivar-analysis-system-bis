// server.js
// Point d'entrée principal v8.0 — Pipeline profil cognitif
// v8 : renommage statut_analyse_pivar → statut_analyse_reponses dans queueService

'use strict';

require('dotenv').config();
const express    = require('express');
const cors       = require('cors');
const bodyParser = require('body-parser');
const routes     = require('./routes');
const queueService = require('./services/queueService');
const logger     = require('./utils/logger');

const app  = express();
const PORT = process.env.PORT || 3000;

// ─── Middleware ───────────────────────────────────────────────────────────

app.use(cors({
  origin: process.env.CORS_ORIGINS || '*'
}));
app.use(bodyParser.json({ limit: '50mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }));

if (process.env.DEBUG_MODE === 'true') {
  app.use((req, res, next) => {
    logger.debug('Incoming request', { method: req.method, path: req.path, ip: req.ip });
    next();
  });
}

// ─── Routes ───────────────────────────────────────────────────────────────

app.use('/', routes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Not found', path: req.path });
});

// Erreur globale
app.use((err, req, res, next) => {
  logger.error('Unhandled error', {
    error: err.message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    path: req.path
  });
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// ─── Démarrage ────────────────────────────────────────────────────────────

let pollingInterval = null;

app.listen(PORT, () => {
  logger.info('Profil Cognitif Analysis System v8.0');
  logger.info('Server started', {
    port: PORT,
    env: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });

  const missingConfig = [];
  if (!process.env.AIRTABLE_TOKEN)   missingConfig.push('AIRTABLE_TOKEN');
  if (!process.env.CLAUDE_API_KEY)   missingConfig.push('CLAUDE_API_KEY');
  if (!process.env.AIRTABLE_BASE_ID) missingConfig.push('AIRTABLE_BASE_ID');

  if (missingConfig.length > 0) {
    logger.warn('Missing configuration', { missing: missingConfig });
  } else {
    logger.info('Configuration OK');
  }

  const pollingEnabled    = process.env.ENABLE_POLLING === 'true';
  const pollingIntervalMs = parseInt(process.env.POLLING_INTERVAL) || 300000;

  if (pollingEnabled) {
    logger.info('Starting polling service', {
      intervalMinutes: (pollingIntervalMs / 60000).toFixed(1)
    });
    pollingInterval = queueService.startPolling(pollingIntervalMs);
  } else {
    logger.info('Polling disabled (webhook only mode)');
  }
});

// ─── Graceful shutdown ────────────────────────────────────────────────────

function shutdown() {
  logger.info('Shutdown signal received');

  if (pollingInterval) {
    queueService.stopPolling(pollingInterval);
  }

  logger.info('Waiting for running analyses...');
  setTimeout(() => {
    logger.info('Shutting down');
    process.exit(0);
  }, 5000);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT',  shutdown);

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled Rejection', { reason });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

module.exports = app;
