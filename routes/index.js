// routes/index.js
// Routes API v8.0 — Pipeline profil cognitif
// v8 : suppression des références pivar, mise à jour champs bilan

'use strict';

const express = require('express');
const router = express.Router();
const orchestratorService = require('../services/orchestratorService');
const queueService         = require('../services/queueService');
const airtableService      = require('../services/airtableService');
const backupService        = require('../services/backupService');
const logger               = require('../utils/logger');

// ─── Health check ─────────────────────────────────────────────────────────

router.get('/health', async (req, res) => {
  try {
    res.json({
      status: 'OK',
      version: '8.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    });
  } catch (error) {
    res.status(500).json({ status: 'ERROR', error: error.message });
  }
});

// ─── Webhook Airtable (déclenchement automatique) ─────────────────────────

/**
 * POST /webhook
 * Body: { session_id: string }
 * Retour immédiat 202, traitement asynchrone via queue.
 */
router.post('/webhook', async (req, res) => {
  try {
    const { session_id } = req.body;

    if (!session_id) {
      return res.status(400).json({ error: 'Missing session_id in body' });
    }

    logger.info('Webhook received', { session_id });

    await queueService.addToQueue(session_id, 'NORMAL');

    res.status(202).json({
      status: 'accepted',
      session_id,
      message: 'Analysis queued'
    });
  } catch (error) {
    logger.error('Webhook error', { error: error.message });
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// ─── Analyse manuelle (synchrone) ─────────────────────────────────────────

/**
 * POST /analyze/:session_id
 * Exécute le pipeline complet de manière synchrone.
 * Usage : tests, relances manuelles.
 */
router.post('/analyze/:session_id', async (req, res) => {
  const { session_id } = req.params;

  try {
    logger.info('Manual analysis requested', { session_id });

    const result = await orchestratorService.processCandidate(session_id);

    const bilan = await airtableService.getBilan(session_id);

    res.json({
      status: 'completed',
      session_id,
      duree_ms: result.duree_ms,
      // v8 — champs profil cognitif (plus de références pivar)
      type_profil_cognitif:       bilan?.type_profil_cognitif       || null,
      niveau_profil_cognitif:     bilan?.niveau_profil_cognitif     || null,
      nom_niveau_profil_cognitif: bilan?.nom_niveau_profil_cognitif || null,
      zone_profil_cognitif:       bilan?.zone_profil_cognitif       || null,
      pilier_dominant_certif:     bilan?.pilier_dominant_certif     || null,
      pilier_structurant_certif:  bilan?.pilier_structurant_certif  || null,
      statut_certification:       bilan?.statut_certification       || null
    });
  } catch (error) {
    logger.error('Manual analysis failed', { session_id, error: error.message });
    res.status(500).json({ status: 'error', session_id, error: error.message });
  }
});

// ─── Statut d'une analyse ─────────────────────────────────────────────────

/**
 * GET /status/:session_id
 */
router.get('/status/:session_id', async (req, res) => {
  const { session_id } = req.params;

  try {
    const visiteur = await airtableService.getVisiteur(session_id);

    if (!visiteur) {
      return res.status(404).json({ error: 'Session not found', session_id });
    }

    res.json({
      session_id,
      statut_analyse_reponses: visiteur.statut_analyse_reponses || null,  // v8
      statut_test:             visiteur.statut_test,
      derniere_question_repondue: visiteur.derniere_question_repondue,
      derniere_activite:       visiteur.derniere_activite,
      erreur:                  visiteur.erreur_analyse || null
    });
  } catch (error) {
    logger.error('Status check failed', { session_id, error: error.message });
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// ─── Statut de la queue ───────────────────────────────────────────────────

router.get('/api/queue/status', async (req, res) => {
  try {
    const status = await queueService.getQueueStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// ─── Retry questions manquantes ───────────────────────────────────────────

/**
 * POST /api/retry-missing/:session_id
 * Relance uniquement les questions sans analyse_json_agent1.
 */
router.post('/api/retry-missing/:session_id', async (req, res) => {
  const { session_id } = req.params;

  try {
    logger.info('Retry missing questions requested', { session_id });

    const responses = await airtableService.getResponsesBySession(session_id);

    const missing = responses.filter(r =>
      !r.analyse_json_agent1 || r.analyse_json_agent1.trim() === ''
    );

    logger.info('Missing agent1 analyses', {
      session_id,
      total: missing.length,
      questions: missing.map(r => r.id_question)
    });

    if (missing.length === 0) {
      return res.json({
        status: 'no_missing',
        session_id,
        message: 'All questions already analyzed by Agent 1'
      });
    }

    const agent1Service = require('../services/agent1Service');
    let succeeded = 0;
    let failed = 0;

    for (const question of missing) {
      try {
        const analysis = await agent1Service.analyzeQuestion(session_id, question);

        await airtableService.updateResponse(question.id_question, session_id, {
          analyse_json_agent1: JSON.stringify(analysis.result)
        });

        succeeded++;
        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        logger.error('Question retry failed', {
          session_id,
          id_question: question.id_question,
          error: error.message
        });
        failed++;
      }
    }

    res.json({
      status: 'completed',
      session_id,
      attempted: missing.length,
      succeeded,
      failed
    });
  } catch (error) {
    logger.error('Retry missing failed', { session_id, error: error.message });
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

// ─── Reprendre depuis backup ──────────────────────────────────────────────

router.post('/api/recover-from-backup/:session_id', async (req, res) => {
  const { session_id } = req.params;

  try {
    const hasBackups = await backupService.hasBackups(session_id);

    if (!hasBackups) {
      return res.status(404).json({
        error: 'No backups found',
        session_id,
        message: 'Start fresh analysis instead'
      });
    }

    const result = await orchestratorService.processCandidate(session_id);

    res.json({ status: 'recovered', session_id, result });
  } catch (error) {
    logger.error('Recovery failed', { session_id, error: error.message });
    res.status(500).json({ error: 'Internal server error', message: error.message });
  }
});

module.exports = router;
