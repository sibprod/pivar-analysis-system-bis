// services/flux/queueService.js
// File d'attente d'analyse — Profil-Cognitif v10.2b
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Responsabilités :
//   - Stocker les candidats à analyser (en mémoire, FIFO avec priorité)
//   - Polling Airtable périodique pour récupérer les nouveaux candidats
//   - Lancer l'orchestrateur principal séquentiellement (MAX_CONCURRENT = 1 sur Starter)
//   - Gérer les erreurs avec backoff via errorClassifier
//
// Statuts détectés par le polling (Section 12 du Contrat ETAPE1 v1.8) :
//   - NOUVEAU
//   - REPRENDRE_AGENT1
//   - REPRENDRE_VERIFICATEUR1
//   - REPRENDRE_T1_<X>_SEUL  (5 statuts)         ⭐ v10.2b
//   - REPRENDRE_T1_DES_<X>   (5 statuts)         ⭐ v10.2b
//
// PHASE D (2026-04-28) — v10 :
//   - Déplacé dans services/flux/ (Décision n°27)
//   - Chemins require mis à jour (orchestrators/ + infrastructure/)
//   - Polling default : 300000ms (5min) → 60000ms (1min) — Décision n°30
//   - Statuts élargis : ajout REPRENDRE_AGENT1, REPRENDRE_VERIFICATEUR1
//   - Healthcheck préalable : squelette pour Phase D-2 (Décision n°23)
//
// PHASE v10.2b (2026-05-03) — relances par scénario (Décision n°42) :
//   - Ajout des 10 nouveaux statuts dans le filtre du polling
//   - Priorité HIGH automatique pour les statuts de reprise (logique inchangée)

'use strict';

const orchestratorPrincipal = require('../orchestrators/orchestratorPrincipal');
const airtableService       = require('../infrastructure/airtableService');
const errorClassifier       = require('../../utils/errorClassifier');
const logger                = require('../../utils/logger');

// ─── État interne ─────────────────────────────────────────────────────────────
const _queue = [];   // Array de { id, priority, addedAt, attempts }
let _processing = false;
let _pollingInterval = null;
let _cycleCount = 0;

const MAX_CONCURRENT = 1; // Starter Render : un candidat à la fois

// ⭐ v10.2b — Liste centrale des statuts détectés par le polling
// Source primaire : Section 12 du Contrat ETAPE1 v1.8
// Cohérent avec STATUTS_ETAPE_1 dans orchestratorPrincipal.js
const STATUTS_DETECTES_PAR_POLLING = [
  // Statuts existants v10
  'NOUVEAU',
  'REPRENDRE_AGENT1',
  'REPRENDRE_VERIFICATEUR1',
  // ⭐ v10.2b — Famille A : relances isolées (Décision n°42)
  'REPRENDRE_T1_SOMMEIL_SEUL',
  'REPRENDRE_T1_WEEKEND_SEUL',
  'REPRENDRE_T1_ANIMAL1_SEUL',
  'REPRENDRE_T1_ANIMAL2_SEUL',
  'REPRENDRE_T1_PANNE_SEUL',
  // ⭐ v10.2b — Famille B : relances cascade (Décision n°42)
  'REPRENDRE_T1_DES_SOMMEIL',
  'REPRENDRE_T1_DES_WEEKEND',
  'REPRENDRE_T1_DES_ANIMAL1',
  'REPRENDRE_T1_DES_ANIMAL2',
  'REPRENDRE_T1_DES_PANNE'
  // Statuts futurs (étapes ultérieures) à ajouter ici quand T2/T3/T4 seront migrés :
  // 'REPRENDRE_AGENT2', 'REPRENDRE_AGENT3', 'REPRENDRE_VERIFICATEUR4'
];

// ═══════════════════════════════════════════════════════════════════════════
// QUEUE — Ajout / récupération
// ═══════════════════════════════════════════════════════════════════════════

function addToQueue(session_id, priority = 'NORMAL') {
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

async function processNext() {
  if (_processing) return;
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
    await orchestratorPrincipal.processCandidate(item.id);
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
    if (_queue.length > 0) {
      setImmediate(() => processNext());
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POLLING — Vérification Airtable périodique (Décision n°30 : 60s)
// ═══════════════════════════════════════════════════════════════════════════

function startPolling(intervalMs = 60000) {  // ⭐ v10 : 60s (Décision n°30)
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
    // ⭐ v10 : Healthcheck préalable squelette (Décision n°23)
    // En Phase D-2 : implémenter via healthcheckService et skip le cycle si KO
    // Pour le test Cécile, on continue sans vérification
    // const healthOk = await healthcheckService.checkAllServices();
    // if (!healthOk.allOk) {
    //   logger.warn('Polling cycle skipped: services KO', { cycle: _cycleCount, ...healthOk });
    //   return;
    // }

    // ⭐ v10.2b — Polling sur 13 statuts (3 hérités v10 + 10 ajoutés v10.2b)
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

      if (c.statut_test !== 'terminé') {
        logger.debug('Candidate test not finished, skipping', {
          id, statut_test: c.statut_test
        });
        continue;
      }

      // Priorité HIGH pour les retry/reprise (tous les REPRENDRE_*)
      // Priorité NORMAL pour NOUVEAU
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

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  addToQueue,
  getQueueStatus,
  startPolling,
  stopPolling,
  processNext,
  runPollingCycle,
  // ⭐ v10.2b — export pour tests/debug et cohérence avec orchestratorPrincipal
  STATUTS_DETECTES_PAR_POLLING
};
