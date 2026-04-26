// routes/index.js
// Routes HTTP — Profil-Cognitif v9.0
//
// Endpoints :
//   GET  /health                                    — health check (défini dans server.js)
//   POST /webhook                                   — trigger principal Airtable
//   POST /analyze/:session_id                       — analyse synchrone
//   GET  /status/:session_id                        — statut analyse en cours
//   GET  /api/queue/status                          — état queue interne
//   POST /api/recover-from-backup/:session_id       — reprise depuis backup
//
// Endpoint legacy retiré (v9) :
//   POST /api/retry-missing/:session_id             — n'a plus de sens dans le pipeline 9 agents

'use strict';

const express              = require('express');
const router               = express.Router();
const orchestratorService  = require('../services/orchestratorService');
const queueService         = require('../services/queueService');
const airtableService      = require('../services/airtableService');
const backupService        = require('../services/backupService');
const logger               = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// POST /webhook — TRIGGER ASYNC depuis Airtable
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Trigger principal depuis Airtable Automation.
 * Met le candidat en queue et retourne 202 immédiatement (Airtable a un timeout court).
 */
router.post('/webhook', async (req, res) => {
  const { session_id, candidate_id, priority } = req.body || {};
  const id = session_id || candidate_id;

  if (!id) {
    return res.status(400).json({
      error: 'session_id or candidate_id required',
      success: false
    });
  }

  try {
    queueService.addToQueue(id, priority || 'NORMAL');
    logger.info('Candidate added to queue via webhook', { id });

    return res.status(202).json({
      success:    true,
      message:    'Candidate queued for analysis',
      session_id: id
    });
  } catch (error) {
    logger.error('Webhook error', { id, error: error.message });
    return res.status(500).json({ error: error.message, success: false });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /analyze/:session_id — ANALYSE SYNCHRONE (test, relance manuelle)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/analyze/:session_id', async (req, res) => {
  const { session_id } = req.params;

  try {
    const result = await orchestratorService.processCandidate(session_id);
    return res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Analyze error', { session_id, error: error.message });
    return res.status(500).json({
      error:      error.message,
      session_id,
      success:    false
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /status/:session_id — STATUT D'UN CANDIDAT
// ═══════════════════════════════════════════════════════════════════════════

router.get('/status/:session_id', async (req, res) => {
  const { session_id } = req.params;

  try {
    const visiteur = await airtableService.getVisiteur(session_id);
    if (!visiteur) {
      return res.status(404).json({ error: 'Candidate not found', session_id });
    }

    const t4Bilan = await airtableService.getEtape1T4Bilan(session_id);

    return res.json({
      session_id,
      statut_test:           visiteur.statut_test,
      statut_analyse_pivar:  visiteur.statut_analyse_pivar,  // alias rétrocompat
      statut_analyse:        visiteur.statut_analyse_pivar,  // nouveau nom
      derniere_activite:     visiteur.derniere_activite,
      erreur_analyse:        visiteur.erreur_analyse,
      bilan: t4Bilan ? {
        statut_bilan:        t4Bilan.statut_bilan,
        certifie:            t4Bilan.statut_bilan === 'certifie',
        has_audit_certif:    !!t4Bilan.audit_certificateur
      } : null
    });
  } catch (error) {
    logger.error('Status error', { session_id, error: error.message });
    return res.status(500).json({ error: error.message, session_id });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/queue/status — ÉTAT DE LA QUEUE
// ═══════════════════════════════════════════════════════════════════════════

router.get('/api/queue/status', (req, res) => {
  try {
    const status = queueService.getQueueStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    logger.error('Queue status error', { error: error.message });
    return res.status(500).json({ error: error.message, success: false });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/recover-from-backup/:session_id — REPRISE DEPUIS BACKUP
// ═══════════════════════════════════════════════════════════════════════════

router.post('/api/recover-from-backup/:session_id', async (req, res) => {
  const { session_id } = req.params;

  try {
    const lastStep = await backupService.getLastSuccessfulStep(session_id);
    if (!lastStep) {
      return res.status(404).json({
        error:      'No backup found for this candidate',
        session_id,
        success:    false
      });
    }

    // Mettre en queue pour reprise (asynchrone)
    queueService.addToQueue(session_id, 'HIGH');

    return res.status(202).json({
      success:    true,
      message:    'Recovery queued',
      session_id,
      last_step:  lastStep
    });
  } catch (error) {
    logger.error('Recover error', { session_id, error: error.message });
    return res.status(500).json({ error: error.message, session_id });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/retry-missing/:session_id — LEGACY v8, retiré en v9
// ═══════════════════════════════════════════════════════════════════════════

router.post('/api/retry-missing/:session_id', (req, res) => {
  return res.status(410).json({
    error:   'This endpoint has been removed in v9. Use POST /api/recover-from-backup/:session_id instead.',
    success: false
  });
});

module.exports = router;
