// server.js
// Profil-Cognitif v10.0 — Web Service Render
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Express qui :
//   - expose les endpoints HTTP via routes/index.js
//   - démarre le polling de queueService (60s — Décision n°30)
//   - démarre le polling de validationHumaineService (Décision n°16)
//   - démarre le polling de notificationCandidatService (Décision n°33)
//   - gère le graceful shutdown (SIGTERM/SIGINT)
//
// PHASE D (2026-04-28) — v10 :
//   - Chemins require mis à jour vers nouvelle architecture (Décision n°27)
//   - Polling default : 300000ms (5min) → 60000ms (1min) — Décision n°30
//   - RESEND_API_KEY + SUPERVISOR_EMAIL ajoutés en warning si manquants
//   - Démarrage validationHumaineService.startPolling()
//   - Démarrage notificationCandidatService.startPolling() (cron horaire)

'use strict';

require('dotenv').config();

const express      = require('express');
const cors         = require('cors');
const bodyParser   = require('body-parser');

const logger                      = require('./utils/logger');
const routes                      = require('./routes');
const queueService                = require('./services/flux/queueService');                     // ⭐ v10
const validationHumaineService    = require('./services/flux/validationHumaineService');         // ⭐ v10
const notificationCandidatService = require('./services/flux/notificationCandidatService');      // ⭐ v10

const app = express();
const PORT = process.env.PORT || 3000;

// ─── VERSION ──────────────────────────────────────────────────────────────────
const APP_NAME    = 'Profil-Cognitif Analysis System';
const APP_VERSION = require('./package.json').version;  // 10.0.0

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

  // ─── Vérifier la config minimale ───────────────────────────────────────
  const requiredEnv = ['CLAUDE_API_KEY', 'AIRTABLE_TOKEN', 'AIRTABLE_BASE_ID'];
  const missing = requiredEnv.filter(k => !process.env[k]);

  if (missing.length > 0) {
    logger.error('Missing required environment variables', { missing });
    logger.warn('Service started but cannot function without these vars');
  } else {
    logger.info('Required configuration OK');
  }

  // ─── ⭐ v10 : Vérifier les vars Resend (optionnelles mais recommandées) ─
  const optionalEnv = ['RESEND_API_KEY', 'SUPERVISOR_EMAIL'];
  const missingOptional = optionalEnv.filter(k => !process.env[k]);

  if (missingOptional.length > 0) {
    logger.warn('Missing optional environment variables (emails will be skipped)', {
      missing: missingOptional
    });
  } else {
    logger.info('Optional Resend configuration OK', {
      supervisor_email: process.env.SUPERVISOR_EMAIL
    });
  }

  // ─── Démarrer les pollings ────────────────────────────────────────────
  if (process.env.ENABLE_POLLING !== 'false') {
    // ⭐ v10 : default polling = 60s (Décision n°30)
    const intervalMs = parseInt(process.env.POLLING_INTERVAL) || 60000;
    queueService.startPolling(intervalMs);
    logger.info('Queue polling started', {
      intervalSec: (intervalMs / 1000).toFixed(0)
    });

    // ⭐ v10 : Démarrage validation humaine polling (60s par défaut)
    const validationIntervalMs = parseInt(process.env.VALIDATION_POLLING_INTERVAL) || 60000;
    validationHumaineService.startPolling(validationIntervalMs);
    logger.info('Validation humaine polling started', {
      intervalSec: (validationIntervalMs / 1000).toFixed(0)
    });

    // ⭐ v10 : Démarrage notification candidat polling (60min par défaut)
    const notifIntervalMs = parseInt(process.env.NOTIFICATION_POLLING_INTERVAL) || 3600000;
    notificationCandidatService.startPolling(notifIntervalMs);
    logger.info('Notification candidat polling started', {
      intervalMin: (notifIntervalMs / 60000).toFixed(0)
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

  // Arrêter tous les pollings (v10 : 3 services au lieu de 1)
  try {
    queueService.stopPolling();
  } catch (e) {
    logger.error('Error stopping queue polling', { error: e.message });
  }

  try {
    validationHumaineService.stopPolling();
  } catch (e) {
    logger.error('Error stopping validation humaine polling', { error: e.message });
  }

  try {
    notificationCandidatService.stopPolling();
  } catch (e) {
    logger.error('Error stopping notification candidat polling', { error: e.message });
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
  setTimeout(() => process.exit(1), 1000);
});

module.exports = app;
