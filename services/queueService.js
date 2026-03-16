// services/queueService.js
// Service de file d'attente v8.0
// v8 : statut_analyse_pivar → statut_analyse_reponses

'use strict';

const airtableService    = require('./airtableService');
const orchestratorService = require('./orchestratorService');
const errorClassifier    = require('../utils/errorClassifier');
const logger             = require('../utils/logger');

const MAX_CONCURRENT = 1;

const runningAnalyses  = new Set();
let   pollingIntervalId = null;

// ─── Ajouter à la queue ───────────────────────────────────────────────────

async function addToQueue(session_id, priority = 'NORMAL') {
  try {
    if (runningAnalyses.has(session_id)) {
      logger.debug('Already running', { session_id });
      return;
    }

    await airtableService.updateVisiteur(session_id, {
      statut_analyse_pivar: 'en_cours',           // champ Airtable VISITEUR
      derniere_activite: new Date().toISOString()
    });

    logger.info('Added to queue', { session_id, priority });
  } catch (error) {
    logger.error('Failed to add to queue', { session_id, error: error.message });
  }
}

// ─── Traiter la queue ─────────────────────────────────────────────────────

async function processQueue() {
  try {
    logger.debug('processQueue called', { running: runningAnalyses.size, max: MAX_CONCURRENT });

    if (runningAnalyses.size >= MAX_CONCURRENT) {
      logger.debug('Queue full', { running: runningAnalyses.size });
      return;
    }

    const candidates = await getCandidatesFromAirtable();

    if (candidates.length === 0) {
      logger.debug('No candidates found');
      return;
    }

    const available = MAX_CONCURRENT - runningAnalyses.size;
    const toProcess = candidates.slice(0, available);

    logger.info('Processing queue', {
      available,
      toProcess: toProcess.length,
      currentlyRunning: runningAnalyses.size,
      candidates_total: candidates.length
    });

    for (const candidate of toProcess) {
      processCandidate(candidate.session_ID || candidate.candidate_ID);
    }
  } catch (error) {
    logger.error('Queue processing error', { error: error.message });
  }
}

// ─── Récupérer candidats depuis Airtable ─────────────────────────────────

async function getCandidatesFromAirtable() {
  try {
    const allCandidates = await airtableService.getVisiteursByStatus({
      statut_analyse_pivar: ['NOUVEAU', 'ERREUR', 'en_cours'],  // champ Airtable VISITEUR
      statut_test: 'terminé',
      derniere_question_repondue: 25
    });

    logger.info('Candidates fetched from Airtable', {
      total: allCandidates.length,
      statuses: allCandidates.map(c => ({
        session_id: c.session_ID || c.candidate_ID,
        statut: c.statut_analyse_pivar
      }))
    });

    const available = allCandidates.filter(c => {
      const sid = c.session_ID || c.candidate_ID;
      return !runningAnalyses.has(sid);
    });

    return available.sort((a, b) => getPriority(b) - getPriority(a));
  } catch (error) {
    logger.error('Failed to get candidates', { error: error.message });
    return [];
  }
}

// ─── Priorité ─────────────────────────────────────────────────────────────

function getPriority(candidate) {
  const statut = candidate.statut_analyse_pivar;  // champ Airtable VISITEUR

  if (statut === 'ERREUR') {
    const classification = errorClassifier.classifyError({
      message: candidate.erreur_analyse || ''
    });
    return classification.shouldRetry ? 50 : 0;
  }

  if (statut === 'en_cours') {
    const lastActivity = new Date(candidate.derniere_activite || 0);
    const elapsedMinutes = (Date.now() - lastActivity) / 1000 / 60;
    if (elapsedMinutes > 30) {
      logger.warn('Stuck analysis detected', {
        session_id: candidate.session_ID || candidate.candidate_ID,
        elapsedMinutes: elapsedMinutes.toFixed(1)
      });
      return 50;
    }
    return 0;
  }

  if (statut === 'NOUVEAU') return 10;

  return 0;
}

// ─── Traiter un candidat (async, non bloquant) ────────────────────────────

async function processCandidate(session_id) {
  runningAnalyses.add(session_id);

  logger.info('Starting candidate processing', {
    session_id,
    currentlyRunning: runningAnalyses.size
  });

  try {
    await orchestratorService.processCandidate(session_id);

    // Marquer terminé dans VISITEUR
    await airtableService.updateVisiteur(session_id, {
      statut_analyse_pivar: 'terminé',           // champ Airtable VISITEUR
      derniere_activite: new Date().toISOString()
    });

    logger.info('Candidate completed', { session_id });
  } catch (error) {
    logger.error('Candidate processing failed', { session_id, error: error.message });

    // Marquer ERREUR
    try {
      await airtableService.updateVisiteur(session_id, {
        statut_analyse_pivar: 'ERREUR',          // champ Airtable VISITEUR
        erreur_analyse: error.message,
        derniere_activite: new Date().toISOString()
      });
    } catch (e) {
      logger.warn('Could not mark ERREUR in Visiteur', { session_id, error: e.message });
    }
  } finally {
    runningAnalyses.delete(session_id);
  }
}

// ─── Polling ──────────────────────────────────────────────────────────────

function startPolling(intervalMs = 300000) {
  if (pollingIntervalId) {
    logger.warn('Polling already started');
    return pollingIntervalId;
  }

  logger.info('Starting polling service', {
    intervalMs,
    intervalMinutes: (intervalMs / 60000).toFixed(1)
  });

  let cycleCount = 0;
  let isRunning  = true;

  const pollRecursive = async () => {
    if (!isRunning) {
      logger.info('Polling stopped');
      return;
    }

    cycleCount++;
    logger.info('Polling cycle started', { cycle: cycleCount, timestamp: new Date().toISOString() });

    try {
      await processQueue();
      logger.info('Polling cycle completed', { cycle: cycleCount });
    } catch (error) {
      logger.error('Polling cycle failed', { cycle: cycleCount, error: error.message });
    }

    if (isRunning) {
      pollingIntervalId = setTimeout(pollRecursive, intervalMs);
    }
  };

  pollingIntervalId = {
    stop: () => {
      isRunning = false;
      logger.info('Polling stop requested');
    }
  };

  pollRecursive();
  return pollingIntervalId;
}

function stopPolling(intervalObj) {
  if (intervalObj && typeof intervalObj.stop === 'function') {
    intervalObj.stop();
  } else if (intervalObj) {
    clearInterval(intervalObj);
    clearTimeout(intervalObj);
  }
  pollingIntervalId = null;
  logger.info('Polling stopped');
}

// ─── Statut queue ─────────────────────────────────────────────────────────

async function getQueueStatus() {
  try {
    const candidates = await getCandidatesFromAirtable();
    return {
      running:      runningAnalyses.size,
      waiting:      candidates.length,
      maxConcurrent: MAX_CONCURRENT,
      runningIds:   Array.from(runningAnalyses)
    };
  } catch (error) {
    logger.error('Failed to get queue status', { error: error.message });
    return { running: runningAnalyses.size, waiting: 0, maxConcurrent: MAX_CONCURRENT, error: error.message };
  }
}

// ─── Exports ──────────────────────────────────────────────────────────────

module.exports = {
  addToQueue,
  processQueue,
  startPolling,
  stopPolling,
  getQueueStatus
};
