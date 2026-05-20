// services/orchestrators/orchestratorPromptEtape1.js
// Sous-Orchestrator Prompt Étape 1 — pré-étape doctrinale avant T1
// Profil-Cognitif v10.7
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//
// ARCHITECTURE v10.7 (3 étapes — après suppression T2 historique) :
//   étape 1.1 (lecture cognitive amont) ← ce sous-orchestrator
//   étape 1   (T1)                       ← orchestratorEtape1
//   étape 2   (ex-T3 circuits)           ← orchestratorEtape1 (en attente refonte)
//   étape 3   (ex-T4 synthèse)           ← orchestratorEtape1 (en attente refonte)
//
// Rôle :
//   Sous-orchestrator dédié à la PRÉ-ÉTAPE 1.1 (lecture cognitive) qui s'exécute
//   AVANT l'orchestratorEtape1 (T1 + étape 2 + étape 3).
//
// Flux d'aiguillage (côté orchestratorPrincipal) :
//
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ Statut entrant            → Sous-orchestrator                        │
//   ├──────────────────────────────────────────────────────────────────────┤
//   │ NOUVEAU                   → orchestratorPromptEtape1 (cette classe)  │
//   │ REPRENDRE_PROMPT_ETAPE1   → orchestratorPromptEtape1 (cette classe)  │
//   │ REPRENDRE_AGENT1          → orchestratorEtape1 (étape 1 T1)          │
//   │ REPRENDRE_AGENT2          → orchestratorEtape1 (étape 2 circuits)    │
//   │ REPRENDRE_AGENT3          → orchestratorEtape1 (étape 3 synthèse)    │
//   └──────────────────────────────────────────────────────────────────────┘
//
// Bascule de fin :
//   À la fin du traitement réussi, le statut bascule à `REPRENDRE_AGENT1`
//   afin que le prochain pickup polling enchaîne T1 (et la suite du pipeline).
//
// Si erreur :
//   Le statut passe à `ERREUR` (géré côté orchestratorPrincipal).

'use strict';

const airtableService            = require('../infrastructure/airtableService');
const agentPromptEtape1Service   = require('../etape1/agentPromptEtape1Service');
const logger                     = require('../../utils/logger');

/**
 * Point d'entrée du sous-orchestrator étape 1.1
 *
 * @param {Object} args
 * @param {string} args.candidat_id
 * @param {Object} [args.visiteur] - record visiteur (pour éviter une relecture)
 * @returns {Promise<Object>} { success, candidat_id, totalLignesEcrites, ... }
 */
async function run({ candidat_id, visiteur }) {
  const startTime = Date.now();

  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
  logger.info('Pipeline Prompt Étape 1 starting', {
    candidat_id,
    statut_entrant: visiteur?.statut_analyse_pivar || '?'
  });
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

  // ─── 1. Marquer le candidat en cours ────────────────────────────────────
  try {
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: 'en_cours',
      derniere_activite:    new Date().toISOString()
    });
  } catch (e) {
    logger.warn('orchestratorPromptEtape1 — échec mise à jour statut en_cours (non bloquant)', {
      candidat_id,
      error: e.message
    });
  }

  // ─── 2. Exécuter l'agent Prompt Étape 1 ─────────────────────────────────
  let agentResult;
  try {
    agentResult = await agentPromptEtape1Service.runAgentPromptEtape1({ candidat_id });
  } catch (err) {
    logger.error('Pipeline Prompt Étape 1 failed', {
      candidat_id,
      error: err.message,
      stack: err.stack
    });
    // L'orchestratorPrincipal s'occupera de mettre le statut à ERREUR
    throw err;
  }

  // ─── 3. Bascule du statut → REPRENDRE_AGENT1 (déclenchera T1 au prochain polling) ──
  try {
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: 'REPRENDRE_AGENT1',
      derniere_activite:    new Date().toISOString(),
      erreur_analyse:       ''  // on efface une éventuelle erreur passée
    });
    logger.info('orchestratorPromptEtape1 — bascule statut → REPRENDRE_AGENT1', { candidat_id });
  } catch (e) {
    logger.error('orchestratorPromptEtape1 — échec bascule statut REPRENDRE_AGENT1', {
      candidat_id,
      error: e.message
    });
    throw new Error(
      `Pipeline Prompt Étape 1 a réussi mais la bascule du statut vers REPRENDRE_AGENT1 a échoué : ${e.message}`
    );
  }

  const totalElapsedMs = Date.now() - startTime;

  logger.info('🎉 Pipeline Prompt Étape 1 terminé — bascule vers T1', {
    candidat_id,
    totalLignesEcrites: agentResult.totalLignesEcrites,
    scenariosTraites:   agentResult.scenariosTraites,
    scenariosSkipped:   agentResult.scenariosSkipped,
    totalCostUsd:       agentResult.totalCostUsd?.toFixed?.(4) || '0',
    totalElapsedMs
  });

  return {
    success:           true,
    candidat_id,
    pipeline:          'prompt_etape1',
    totalLignesEcrites: agentResult.totalLignesEcrites,
    scenariosTraites:  agentResult.scenariosTraites,
    scenariosSkipped:  agentResult.scenariosSkipped,
    totalCostUsd:      agentResult.totalCostUsd,
    totalElapsedMs,
    nextStatus:        'REPRENDRE_AGENT1'
  };
}

module.exports = {
  run
};
