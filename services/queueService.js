// services/queueService.js
// Service de file d'attente intelligente
// ✅ PHASE 3.1 - État persisté + priorités + limite concurrence

const airtableService = require('./airtableService');
const orchestratorService = require('./orchestratorService');
const errorClassifier = require('../utils/errorClassifier');
const logger = require('../utils/logger');

// Limite concurrence
const MAX_CONCURRENT = 1;  // 1 seul à la fois pour éviter rate limit Claude API

// Analyses en cours (en mémoire pour check rapide)
const runningAnalyses = new Set();

// Interval ID pour polling
let pollingIntervalId = null;

/**
 * Ajouter un candidat à la queue
 * @param {string} session_id 
 * @param {string} priority - "NORMAL" | "RETRY" | "URGENT"
 */
async function addToQueue(session_id, priority = 'NORMAL') {
  try {
    // Vérifier si pas déjà en cours
    if (runningAnalyses.has(session_id)) {
      logger.debug('Already running', { session_id });
      return;
    }
    
    // Marquer en_cours dans Airtable
    await airtableService.updateVisiteur(session_id, {
      statut_analyse_pivar: 'en_cours',
      derniere_activite: new Date().toISOString()
    });
    
    logger.info('Added to queue', { session_id, priority });
    
  } catch (error) {
    logger.error('Failed to add to queue', {
      session_id,
      error: error.message
    });
  }
}

/**
 * Traiter la queue (max 3 simultanés)
 */
async function processQueue() {
  try {
    logger.debug('processQueue called', {
      running: runningAnalyses.size,
      max: MAX_CONCURRENT
    });
    
    // Vérifier si on peut lancer de nouvelles analyses
    if (runningAnalyses.size >= MAX_CONCURRENT) {
      logger.debug('Queue full', { running: runningAnalyses.size });
      return;
    }
    
    // Récupérer candidats en attente depuis Airtable
    const candidates = await getCandidatesFromAirtable();
    
    if (candidates.length === 0) {
      logger.debug('No candidates found in Airtable');
      return;
    }
    
    // Lancer autant que possible (max MAX_CONCURRENT)
    const available = MAX_CONCURRENT - runningAnalyses.size;
    const toProcess = candidates.slice(0, available);
    
    logger.info('Processing queue', {
      available: available,
      toProcess: toProcess.length,
      currentlyRunning: runningAnalyses.size,
      candidates_total: candidates.length
    });
    
    for (const candidate of toProcess) {
      processCandidate(candidate.session_ID);
    }
    
  } catch (error) {
    logger.error('Queue processing error', { error: error.message });
  }
}

/**
 * Récupérer les candidats depuis Airtable (triés par priorité)
 * @returns {Array<Object>}
 */
async function getCandidatesFromAirtable() {
  try {
    // Récupérer NOUVEAU, ERREUR, en_cours
    const allCandidates = await airtableService.getVisiteursByStatus({
      statut_analyse_pivar: ['NOUVEAU', 'ERREUR', 'en_cours'],
      statut_test: 'terminé',
      derniere_question_repondue: 25
    });
    
    logger.info('Candidates fetched from Airtable', {
      total: allCandidates.length,
      session_ids: allCandidates.map(c => c.session_ID),
      statuses: allCandidates.map(c => ({
        session_id: c.session_ID,
        statut_analyse: c.statut_analyse_pivar,
        statut_test: c.statut_test,
        questions_repondues: c.derniere_question_repondue
      }))
    });
    
    // Filtrer ceux déjà en cours (en mémoire)
    const available = allCandidates.filter(c => !runningAnalyses.has(c.session_ID));
    
    logger.info('Available candidates after filter', {
      available: available.length,
      running: runningAnalyses.size,
      running_ids: Array.from(runningAnalyses)
    });
    
    // Trier par priorité
    const sorted = available.sort((a, b) => {
      const prioA = getPriority(a);
      const prioB = getPriority(b);
      return prioB - prioA; // Descending (URGENT > RETRY > NORMAL)
    });
    
    return sorted;
    
  } catch (error) {
    logger.error('Failed to get candidates', { error: error.message });
    return [];
  }
}

/**
 * Calculer la priorité d'un candidat
 * @param {Object} candidate 
 * @returns {number} Score priorité (plus haut = plus prioritaire)
 */
function getPriority(candidate) {
  // URGENT : marqué explicitement (pas encore implémenté)
  // → Score 100
  
  // RETRY : ERREUR temporaire
  if (candidate.statut_analyse_pivar === 'ERREUR') {
    // Vérifier si erreur temporaire
    const classification = errorClassifier.classifyError({
      message: candidate.erreur_analyse || ''
    });
    
    if (classification.shouldRetry) {
      return 50; // RETRY
    } else {
      return 0; // Erreur permanente, ne pas retry
    }
  }
  
  // en_cours stuck (timeout > 30 min)
  if (candidate.statut_analyse_pivar === 'en_cours') {
    const lastActivity = new Date(candidate.derniere_activite);
    const now = new Date();
    const elapsedMinutes = (now - lastActivity) / 1000 / 60;
    
    if (elapsedMinutes > 30) {
      logger.warn('Stuck analysis detected', {
        session_id: candidate.session_ID,
        elapsedMinutes: elapsedMinutes.toFixed(1)
      });
      return 50; // RETRY stuck
    } else {
      return 0; // Encore en cours normalement
    }
  }
  
  // NOUVEAU : priorité normale
  if (candidate.statut_analyse_pivar === 'NOUVEAU') {
    return 10; // NORMAL
  }
  
  return 0;
}

/**
 * Traiter un candidat (async, ne bloque pas)
 * @param {string} session_id 
 */
async function processCandidate(session_id) {
  // Marquer comme running
  runningAnalyses.add(session_id);
  
  logger.info('Starting candidate processing', {
    session_id,
    currentlyRunning: runningAnalyses.size
  });
  
  try {
    await orchestratorService.processCandidate(session_id);
    
    logger.info('Candidate completed', {
      session_id,
      currentlyRunning: runningAnalyses.size - 1
    });
    
  } catch (error) {
    logger.error('Candidate processing failed', {
      session_id,
      error: error.message
    });
  } finally {
    // Toujours retirer de running
    runningAnalyses.delete(session_id);
  }
}

/**
 * Démarrer le polling (backup webhook)
 * @param {number} intervalMs - Intervalle en ms (défaut: 300000 = 5 min)
 * @returns {NodeJS.Timeout} Interval ID
 */
function startPolling(intervalMs = 300000) {
  if (pollingIntervalId) {
    logger.warn('Polling already started');
    return pollingIntervalId;
  }
  
  logger.info('Starting polling service', {
    intervalMs: intervalMs,
    intervalMinutes: (intervalMs / 60000).toFixed(1)
  });
  
  // Compteur pour debug
  let cycleCount = 0;
  let isRunning = true;
  
  // Fonction récursive avec setTimeout (plus fiable que setInterval)
  const pollRecursive = async () => {
    if (!isRunning) {
      logger.info('Polling stopped');
      return;
    }
    
    cycleCount++;
    logger.info('Polling cycle started', {
      cycle: cycleCount,
      timestamp: new Date().toISOString()
    });
    
    try {
      await processQueue();
      logger.info('Polling cycle completed', {
        cycle: cycleCount
      });
    } catch (error) {
      logger.error('Polling cycle failed', {
        cycle: cycleCount,
        error: error.message,
        stack: error.stack
      });
    }
    
    // Programmer le prochain cycle
    if (isRunning) {
      const nextTime = new Date(Date.now() + intervalMs);
      logger.debug('Next polling cycle scheduled', {
        nextCycle: cycleCount + 1,
        nextTime: nextTime.toISOString(),
        inMinutes: (intervalMs / 60000).toFixed(1)
      });
      
      pollingIntervalId = setTimeout(pollRecursive, intervalMs);
    }
  };
  
  // Fonction pour arrêter le polling
  pollingIntervalId = {
    stop: () => {
      isRunning = false;
      logger.info('Polling stop requested');
    }
  };
  
  // Lancer le premier cycle
  pollRecursive();
  
  return pollingIntervalId;
}

/**
 * Arrêter le polling
 * @param {Object} intervalObj - Objet retourné par startPolling
 */
function stopPolling(intervalObj) {
  if (intervalObj && typeof intervalObj.stop === 'function') {
    intervalObj.stop();
    logger.info('Polling stopped');
  } else if (intervalObj) {
    // Fallback pour ancien système setInterval
    clearInterval(intervalObj);
    clearTimeout(intervalObj);
    logger.info('Polling stopped (fallback)');
  }
  
  pollingIntervalId = null;
}

/**
 * Obtenir le statut de la queue
 * @returns {Object}
 */
async function getQueueStatus() {
  try {
    const candidates = await getCandidatesFromAirtable();
    
    return {
      running: runningAnalyses.size,
      waiting: candidates.length,
      maxConcurrent: MAX_CONCURRENT,
      runningIds: Array.from(runningAnalyses)
    };
    
  } catch (error) {
    logger.error('Failed to get queue status', { error: error.message });
    return {
      running: runningAnalyses.size,
      waiting: 0,
      maxConcurrent: MAX_CONCURRENT,
      error: error.message
    };
  }
}

module.exports = {
  addToQueue,
  processQueue,
  startPolling,
  stopPolling,
  getQueueStatus
};
