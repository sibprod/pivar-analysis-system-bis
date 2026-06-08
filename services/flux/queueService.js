// services/flux/queueService.js
// File d'attente d'analyse — Profil-Cognitif v11.8
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// PHASE v11.8 (2026-06-08) — anti double prise en charge :
//   Un candidat déjà EN COURS de traitement ne peut plus être réinséré dans la file
//   par le polling. Sans ce garde-fou, le polling voyait encore le candidat (statut
//   intermédiaire ETAPE2_2EXCELLENCE) pendant que le T5BC tournait, le remettait en
//   file, et l'orchestrateur le reprenait APRÈS le succès → lecture d'un statut non
//   traitable ("terminé") → bascule en ERREUR alors que l'analyse était bonne.

'use strict';

const orchestratorPrincipal = require('../orchestrators/orchestratorPrincipal');
const airtableService       = require('../infrastructure/airtableService');
const errorClassifier       = require('../../utils/errorClassifier');
const logger                = require('../../utils/logger');

// ─── État interne ─────────────────────────────────────────────────────────────
const _queue = [];
let _processing = false;
let _currentlyProcessingId = null;   // ⭐ v11.8 — id du candidat actuellement traité
let _pollingInterval = null;
let _cycleCount = 0;

const MAX_CONCURRENT = 1;

const STATUTS_DETECTES_PAR_POLLING = [
  'NOUVEAU',
  'REPRENDRE_PROMPT_ETAPE1',
  'REPRENDRE_AGENT1',
  'REPRENDRE_VERIFICATEUR1',
  'REPRENDRE_T1_SOMMEIL_SEUL',
  'REPRENDRE_T1_WEEKEND_SEUL',
  'REPRENDRE_T1_ANIMAL1_SEUL',
  'REPRENDRE_T1_ANIMAL2_SEUL',
  'REPRENDRE_T1_PANNE_SEUL',
  'REPRENDRE_T1_DES_SOMMEIL',
  'REPRENDRE_T1_DES_WEEKEND',
  'REPRENDRE_T1_DES_ANIMAL1',
  'REPRENDRE_T1_DES_ANIMAL2',
  'REPRENDRE_T1_DES_PANNE',
  'REPRENDRE_AGENT2',
  'REPRENDRE_AGENT2_PHASE1',
  'REPRENDRE_AGENT2_PHASE2',
  'REPRENDRE_AGENT2_PHASE3',
  'REPRENDRE_AGENT3',
  'REPRENDRE_AGENT4',
  'ETAPE2_1REPONSE4DIMENSIONS',
  'ETAPE2_2EXCELLENCE',
  'REPRENDRE_EXCELLENCES'
];

// ═══════════════════════════════════════════════════════════════════════════
// QUEUE — Ajout / récupération
// ═══════════════════════════════════════════════════════════════════════════

function addToQueue(session_id, priority = 'NORMAL') {
  // ⭐ v11.8 — Ne jamais remettre en file un candidat déjà EN COURS de traitement.
  if (_currentlyProcessingId === session_id) {
    logger.debug('Candidate already being processed, skipping enqueue', { id: session_id });
    return;
  }

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

  _queue.sort((a, b) => priorityValue(b.priority) - priorityValue(a.priority));

  logger.info('Added to queue', { id: session_id, priority, queueSize: _queue.length });
  setImmediate(() => processNext());
}

function priorityValue(priority) {
  return ({ HIGH: 3, NORMAL: 2, LOW: 1 }[priority] || 2);
}

function getQueueStatus() {
  return {
    size:           _queue.length,
    processing:     _processing,
    processing_id:  _currentlyProcessingId,
    cycle_count:    _cycleCount,
    polling_active: _pollingInterval !== null,
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

async function processNext() {
  if (_processing) return;
  if (_queue.length === 0) return;

  _processing = true;
  const item = _queue.shift();
  _currentlyProcessingId = item.id;   // ⭐ v11.8 — on mémorise qui est en cours

  logger.info('Processing candidate from queue', {
    id:        item.id,
    attempts:  item.attempts + 1,
    remaining: _queue.length
  });

  try {
    item.attempts++;
    await orchestratorPrincipal.processCandidate(item.id);
    logger.info('Candidate processed successfully', { id: item.id });
  } catch (error) {
    const classification = errorClassifier.classifyError(error);

    logger.error('Candidate processing failed', {
      id:          item.id,
      attempts:    item.attempts,
      errorType:   classification.errorType,
      isTemporary: classification.isTemporary,
      shouldRetry: classification.shouldRetry
    });

    if (classification.shouldRetry && !errorClassifier.shouldGiveUp(item.attempts)) {
      const backoffMs = errorClassifier.calculateBackoffDelay(item.attempts);
      logger.info('Re-queuing with backoff', {
        id:             item.id,
        attempts:       item.attempts,
        backoffMinutes: (backoffMs / 60000).toFixed(1)
      });
      setTimeout(() => {
        _queue.unshift(item);
        processNext();
      }, backoffMs);
    } else {
      logger.error('Giving up on candidate', { id: item.id, attempts: item.attempts });
    }
  } finally {
    _processing = false;
    _currentlyProcessingId = null;   // ⭐ v11.8 — on libère le verrou
    if (_queue.length > 0) {
      setImmediate(() => processNext());
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POLLING
// ═══════════════════════════════════════════════════════════════════════════

function startPolling(intervalMs = 60000) {
  if (_pollingInterval) {
    logger.warn('Polling already started');
    return;
  }

  logger.info('Starting polling service', {
    intervalMs,
    intervalSec: (intervalMs / 1000).toFixed(0),
    nb_statuts_detectes: STATUTS_DETECTES_PAR_POLLING.length
  });

  runPollingCycle();
  _pollingInterval = setInterval(runPollingCycle, intervalMs);
}

function stopPolling() {
  if (_pollingInterval) {
    clearInterval(_pollingInterval);
    _pollingInterval = null;
    logger.info('Polling stopped');
  }
}

async function runPollingCycle() {
  _cycleCount++;
  logger.info('Polling cycle started', { cycle: _cycleCount });

  try {
    const candidates = await airtableService.getVisiteursByStatus({
      statut_analyse_pivar: STATUTS_DETECTES_PAR_POLLING
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

      // ⭐ v11.8 — Skip si déjà en cours de traitement
      if (_currentlyProcessingId === id) {
        logger.debug('Candidate currently processing, skipping poll enqueue', { id });
        continue;
      }

      if (c.statut_test !== 'terminé') {
        logger.debug('Candidate test not finished, skipping', {
          id, statut_test: c.statut_test
        });
        continue;
      }

      const priority = (c.statut_analyse_pivar === 'NOUVEAU') ? 'NORMAL' : 'HIGH';
      addToQueue(id, priority);
    }

    logger.info('Polling cycle completed', { cycle: _cycleCount });

  } catch (error) {
    logger.error('Polling cycle error', {
      cycle: _cycleCount,
      error: error.message
    });
  }
}

module.exports = {
  addToQueue,
  getQueueStatus,
  startPolling,
  stopPolling,
  processNext,
  runPollingCycle,
  STATUTS_DETECTES_PAR_POLLING
};
