// services/queueService.js
// File d'attente d'analyse — Profil-Cognitif v9.0
//
// Responsabilités :
//   - Stocker les candidats à analyser (en mémoire, FIFO avec priorité)
//   - Polling Airtable périodique pour récupérer les nouveaux candidats
//     (statut_analyse_pivar = 'NOUVEAU' ou 'en_cours' bloqué)
//   - Lancer l'orchestrateur séquentiellement (MAX_CONCURRENT = 1 sur Starter)
//   - Gérer les erreurs avec backoff via errorClassifier

'use strict';

const orchestratorService = require('./orchestratorService');
const airtableService     = require('./airtableService');
const errorClassifier     = require('../utils/errorClassifier');
const logger              = require('../utils/logger');

// ─── État interne ─────────────────────────────────────────────────────────────
const _queue = [];   // Array de { id, priority, addedAt, attempts }
let _processing = false;
let _pollingInterval = null;
let _cycleCount = 0;

const MAX_CONCURRENT = 1; // Starter Render : un candidat à la fois

// ═══════════════════════════════════════════════════════════════════════════
// QUEUE — Ajout / récupération
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Ajoute un candidat à la queue
 * @param {string} session_id - identifiant candidat
 * @param {string} [priority] - 'HIGH' | 'NORMAL' | 'LOW' (default 'NORMAL')
 */
function addToQueue(session_id, priority = 'NORMAL') {
  // Eviter les doublons
  const existing = _queue.find(item => item.id === session_id);
  if (existing) {
    logger.debug('Already in queue, updating priority', { id: session_id });
    if (priorityValue(priority) > priorityValue(existing.priority)) {
      existing.priority = priority;
    }
    return;
  }

  _queue.push({
    id:       session_id,
    priority: priority,
    addedAt:  new Date().toISOString(),
    attempts: 0
  });

  // Trier par priorité descendante
  _queue.sort((a, b) => priorityValue(b.priority) - priorityValue(a.priority));

  logger.info('Added to queue', {
    id:        session_id,
    priority,
    queueSize: _queue.length
  });

  // Lancer le traitement (non bloquant)
  setImmediate(() => processNext());
}

function priorityValue(priority) {
  return ({ HIGH: 3, NORMAL: 2, LOW: 1 }[priority] || 2);
}

/**
 * Retourne l'état de la queue
 */
function getQueueStatus() {
  return {
    size:                _queue.length,
    processing:          _processing,
    cycle_count:         _cycleCount,
    polling_active:      _pollingInterval !== null,
    items: _queue.map(item => ({
      id:       item.id,
      priority: item.priority,
      addedAt:  item.addedAt,
      attempts: item.attempts
    }))
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSING — Lancement séquentiel
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Traite le prochain candidat en queue (1 seul à la fois)
 */
async function processNext() {
  if (_processing) return; // déjà en cours
  if (_queue.length === 0) return;

  _processing = true;
  const item = _queue.shift();

  logger.info('Processing candidate from queue', {
    id:        item.id,
    attempts:  item.attempts + 1,
    remaining: _queue.length
  });

  try {
    item.attempts++;
    await orchestratorService.processCandidate(item.id);
    logger.info('Candidate processed successfully', { id: item.id });
  } catch (error) {
    const classification = errorClassifier.classifyError(error);

    logger.error('Candidate processing failed', {
      id:           item.id,
      attempts:     item.attempts,
      errorType:    classification.errorType,
      isTemporary:  classification.isTemporary,
      shouldRetry:  classification.shouldRetry
    });

    // Retry si erreur temporaire ET pas trop de tentatives
    if (classification.shouldRetry && !errorClassifier.shouldGiveUp(item.attempts)) {
      const backoffMs = errorClassifier.calculateBackoffDelay(item.attempts);
      logger.info('Re-queuing with backoff', {
        id:             item.id,
        attempts:       item.attempts,
        backoffMinutes: (backoffMs / 60000).toFixed(1)
      });
      setTimeout(() => {
        _queue.unshift(item); // remettre en tête de queue
        processNext();
      }, backoffMs);
    } else {
      logger.error('Giving up on candidate', { id: item.id, attempts: item.attempts });
      // L'orchestrateur a déjà mis le statut ERREUR dans VISITEUR
    }
  } finally {
    _processing = false;
    // Lancer le suivant si encore des éléments
    if (_queue.length > 0) {
      setImmediate(() => processNext());
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POLLING — Vérification Airtable périodique
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Démarre le polling Airtable pour récupérer les candidats à analyser
 * @param {number} intervalMs - intervalle en ms (default 5 minutes)
 */
function startPolling(intervalMs = 300000) {
  if (_pollingInterval) {
    logger.warn('Polling already started');
    return;
  }

  logger.info('Starting polling service', {
    intervalMs,
    intervalMinutes: (intervalMs / 60000).toFixed(1)
  });

  // Premier cycle immédiat
  runPollingCycle();

  // Cycles suivants
  _pollingInterval = setInterval(runPollingCycle, intervalMs);
}

/**
 * Arrête le polling
 */
function stopPolling() {
  if (_pollingInterval) {
    clearInterval(_pollingInterval);
    _pollingInterval = null;
    logger.info('Polling stopped');
  }
}

/**
 * Un cycle de polling : interroger Airtable et ajouter à la queue
 */
async function runPollingCycle() {
  _cycleCount++;
  logger.info('Polling cycle started', { cycle: _cycleCount });

  try {
    // Récupérer les candidats avec statut analyse 'NOUVEAU' (à traiter)
    const candidates = await airtableService.getVisiteursByStatus({
      statut_analyse_pivar: ['NOUVEAU']
    });

    logger.info('Candidates fetched from Airtable', {
      total:    candidates.length,
      statuses: candidates.map(c => c.statut_analyse_pivar)
    });

    for (const c of candidates) {
      const id = c.candidate_ID || c.candidat_id;
      if (!id) {
        logger.warn('Candidate without ID, skipping', { record: c.id });
        continue;
      }

      // Vérifier que toutes les 25 réponses sont là (statut_test = 'terminé')
      if (c.statut_test !== 'terminé') {
        logger.debug('Candidate test not finished, skipping', {
          id,
          statut_test: c.statut_test
        });
        continue;
      }

      addToQueue(id, 'NORMAL');
    }

    logger.info('Polling cycle completed', { cycle: _cycleCount });

  } catch (error) {
    logger.error('Polling cycle error', {
      cycle: _cycleCount,
      error: error.message
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  addToQueue,
  getQueueStatus,
  startPolling,
  stopPolling,
  // Exports utiles pour tests
  processNext,
  runPollingCycle
};
