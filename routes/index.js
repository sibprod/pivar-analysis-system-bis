// routes/index.js
// Routes API principales PIVAR v7.0
// ✅ PHASE 4.1 - Code minimal, logique dans services

const express = require('express');
const router = express.Router();
const orchestratorService = require('../services/orchestratorService');
const queueService = require('../services/queueService');
const algorithmeService = require('../services/algorithmeService');
const airtableService = require('../services/airtableService');
const backupService = require('../services/backupService');
const logger = require('../utils/logger');

/**
 * GET /health - Health check
 */
router.get('/health', async (req, res) => {
  try {
    const status = {
      status: 'OK',
      version: '7.0.0',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV || 'development'
    };
    
    res.json(status);
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

/**
 * POST /webhook - Webhook Airtable (automatique)
 * Body: { session_id: string }
 */
router.post('/webhook', async (req, res) => {
  try {
    const { session_id } = req.body;
    
    if (!session_id) {
      return res.status(400).json({
        error: 'Missing session_id in body'
      });
    }
    
    logger.info('Webhook received', { session_id });
    
    // Ajouter à la queue (traitement asynchrone)
    await queueService.addToQueue(session_id, 'NORMAL');
    
    // Retourner immédiatement (202 Accepted)
    res.status(202).json({
      status: 'accepted',
      session_id: session_id,
      message: 'Analysis queued'
    });
    
  } catch (error) {
    logger.error('Webhook error', { error: error.message });
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /analyze/:session_id - Analyse manuelle complète (synchrone)
 */
router.post('/analyze/:session_id', async (req, res) => {
  const { session_id } = req.params;
  
  try {
    logger.info('Manual analysis requested', { session_id });
    
    // Traiter immédiatement (synchrone)
    const result = await orchestratorService.processCandidate(session_id);
    
    // Récupérer résultats finaux
    const bilan = await airtableService.getBilan(session_id);
    
    res.json({
      status: 'completed',
      session_id: session_id,
      duration_ms: result.duration_ms,
      score_moyen_global: bilan.score_moyen_global,
      niveau_pivar: bilan.niveau_pivar,
      nom_niveau_pivar: bilan.nom_niveau_pivar,
      type_pivar: bilan.type_pivar,
      zone_pivar: bilan.zone_pivar
    });
    
  } catch (error) {
    logger.error('Manual analysis failed', {
      session_id,
      error: error.message
    });
    
    res.status(500).json({
      status: 'error',
      session_id: session_id,
      error: error.message
    });
  }
});

/**
 * GET /status/:session_id - Statut d'une analyse
 */
router.get('/status/:session_id', async (req, res) => {
  const { session_id } = req.params;
  
  try {
    const visiteur = await airtableService.getVisiteur(session_id);
    
    if (!visiteur) {
      return res.status(404).json({
        error: 'Session not found',
        session_id: session_id
      });
    }
    
    res.json({
      session_id: session_id,
      statut_analyse_pivar: visiteur.statut_analyse_pivar,
      statut_test: visiteur.statut_test,
      derniere_question_repondue: visiteur.derniere_question_repondue,
      derniere_activite: visiteur.derniere_activite,
      erreur: visiteur.erreur_analyse || null
    });
    
  } catch (error) {
    logger.error('Status check failed', {
      session_id,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/retry-missing/:session_id - Relancer questions manquantes uniquement
 */
router.post('/api/retry-missing/:session_id', async (req, res) => {
  const { session_id } = req.params;
  
  try {
    logger.info('Retry missing questions requested', { session_id });
    
    // Récupérer toutes les réponses
    const responses = await airtableService.getResponses(session_id);
    
    // Identifier questions manquantes (Agent 1)
    const missingAgent1 = responses.filter(r => 
      !r.analyse_json_pivar || r.analyse_json_pivar.trim() === ''
    );
    
    logger.info('Missing analyses detected', {
      session_id,
      total: missingAgent1.length,
      questions: missingAgent1.map(r => r.id_question)
    });
    
    if (missingAgent1.length === 0) {
      return res.json({
        status: 'no_missing',
        session_id: session_id,
        message: 'All questions already analyzed'
      });
    }
    
    // Retry chaque question manquante
    const agent1Service = require('../services/agent1Service');
    let succeeded = 0;
    let failed = 0;
    
    for (const question of missingAgent1) {
      try {
        logger.info('Retrying question', {
          session_id,
          id_question: question.id_question
        });
        
        const analysis = await agent1Service.analyzeQuestion(session_id, question);
        
        await airtableService.updateResponse(
          question.id_question,
          session_id,
          {
            analyse_json_pivar: JSON.stringify(analysis.analyse_json_pivar),
            nombre_mots_reponse: analysis.nombre_mots_reponse,
            niveau_sophistication: analysis.niveau_sophistication,
            laconique: analysis.laconique,
            statut_analyse_reponses: 'analyse_ok',
            question_analysée: true
          }
        );
        
        succeeded++;
        
        // Sleep entre questions
        await new Promise(resolve => setTimeout(resolve, 2000));
        
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
      session_id: session_id,
      attempted: missingAgent1.length,
      succeeded: succeeded,
      failed: failed
    });
    
  } catch (error) {
    logger.error('Retry missing failed', {
      session_id,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/recalculate-scores/:session_id - Recalculer scores uniquement
 */
router.post('/api/recalculate-scores/:session_id', async (req, res) => {
  const { session_id } = req.params;
  
  try {
    logger.info('Recalculate scores requested', { session_id });
    
    // Récupérer toutes les réponses
    const responses = await airtableService.getResponses(session_id);
    
    if (responses.length !== 25) {
      return res.status(400).json({
        error: 'Incomplete responses',
        expected: 25,
        found: responses.length
      });
    }
    
    // Calculer scores
    const algoResults = await algorithmeService.calculate(session_id, responses);
    
    // Écrire scores dans RESPONSES
    for (const response of algoResults.responses) {
      await airtableService.updateResponse(
        response.id_question,
        session_id,
        {
          score_question: response.score_final,
          question_scoree: true
        }
      );
    }
    
    // Écrire scores globaux dans BILAN
    await airtableService.createOrUpdateBilan(session_id, algoResults.global);
    
    res.json({
      status: 'success',
      session_id: session_id,
      scores_calculated: algoResults.responses.length,
      ...algoResults.global
    });
    
  } catch (error) {
    logger.error('Recalculate failed', {
      session_id,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * POST /api/recover-from-backup/:session_id - Reprendre depuis backup
 */
router.post('/api/recover-from-backup/:session_id', async (req, res) => {
  const { session_id } = req.params;
  
  try {
    logger.info('Recovery from backup requested', { session_id });
    
    // Vérifier si backups existent
    const hasBackups = await backupService.hasBackups(session_id);
    
    if (!hasBackups) {
      return res.status(404).json({
        error: 'No backups found',
        session_id: session_id,
        message: 'Start fresh analysis instead'
      });
    }
    
    // Reprendre depuis backup
    const result = await orchestratorService.recoverFromBackup(session_id);
    
    res.json({
      status: 'recovered',
      session_id: session_id,
      result: result
    });
    
  } catch (error) {
    logger.error('Recovery failed', {
      session_id,
      error: error.message
    });
    
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

/**
 * GET /api/queue/status - Statut de la queue
 */
router.get('/api/queue/status', async (req, res) => {
  try {
    const status = await queueService.getQueueStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({
      error: 'Internal server error',
      message: error.message
    });
  }
});

module.exports = router;
