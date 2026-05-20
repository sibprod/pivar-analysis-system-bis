// services/orchestrators/orchestratorPrincipal.js
// Orchestrateur Principal — Profil-Cognitif
//
// Point d'entrée unique du pipeline d'analyse pour un candidat.
// Lit le statut dans VISITEUR et aiguille vers le bon sous-orchestrateur.
//
// Aiguillage par statut :
//
//   ─── Pré-étape (lecture cognitive amont) ─────────────────────────────
//   - NOUVEAU                       → orchestratorPromptEtape1
//   - REPRENDRE_PROMPT_ETAPE1       → orchestratorPromptEtape1
//
//   ─── Étape 1 (T1 → T2 → T3 → T4) ─────────────────────────────────────
//   - REPRENDRE_AGENT1              → orchestratorEtape1 (mode PIPELINE_COMPLET)
//   - en_cours                      → orchestratorEtape1 (cas marginal)
//   - REPRENDRE_T1_<X>_SEUL  (5)    → orchestratorEtape1 (mode SCENARIO_ISOLÉ)
//   - REPRENDRE_T1_DES_<X>   (5)    → orchestratorEtape1 (mode SCENARIO_CASCADE)
//   - REPRENDRE_AGENT2              → orchestratorEtape1 (mode AGENT2_SEUL)
//   - REPRENDRE_AGENT3              → orchestratorEtape1 (mode AGENT3_SEUL)
//   - REPRENDRE_AGENT4              → orchestratorEtape1 (mode AGENT4_SEUL)
//
//   ─── Statuts hors pipeline ───────────────────────────────────────────
//   - SUSPENDU MANUELLEMENT         → ignoré (pause superviseur)
//   - EN_ATTENTE_VALIDATION_HUMAINE → ignoré (attente diagnostic)
//   - terminé                       → ignoré (pipeline complet réussi)
//   - ERREUR                        → ignoré (reprise manuelle nécessaire)

'use strict';

const airtableService             = require('../infrastructure/airtableService');
const orchestratorPromptEtape1    = require('./orchestratorPromptEtape1');
const orchestratorEtape1          = require('./orchestratorEtape1');
const logger                      = require('../../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE — processCandidate
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Point d'entrée unique pour traiter un candidat.
 *
 * @param {string} session_id - Identifiant du candidat (= candidate_ID dans VISITEUR)
 * @returns {Promise<Object>} { success, candidat_id, totalCostUsd, totalElapsedMs, ... }
 */
async function processCandidate(session_id) {
  const candidat_id = session_id;
  const startTime = Date.now();

  logger.info('╔═══════════════════════════════════════════════════════════╗', { candidat_id });
  logger.info('║ Orchestrateur Principal — processCandidate                ║', { candidat_id });
  logger.info('╚═══════════════════════════════════════════════════════════╝', { candidat_id });

  let visiteur = null;

  try {
    // ─── 1. Lecture VISITEUR ────────────────────────────────────────────────
    visiteur = await airtableService.getVisiteur(candidat_id);
    if (!visiteur) {
      throw new Error(`Visiteur ${candidat_id} not found in Airtable`);
    }

    const statut_actuel = visiteur.statut_analyse_pivar || 'INCONNU';

    logger.info('Statut candidat lu', {
      candidat_id,
      statut_analyse_pivar: statut_actuel,
      tentatives_etape1:    visiteur.nombre_tentatives_etape1 || 0
    });

    // ─── 2. Marquer en cours ────────────────────────────────────────────────
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: 'en_cours',
      erreur_analyse:       '',
      derniere_activite:    new Date().toISOString()
    });

    // ─── 3. Aiguillage selon le statut ──────────────────────────────────────
    const result = await aiguillerVersSousOrchestrateur({
      candidat_id,
      visiteur,
      statut_actuel
    });

    // ─── 4. Statut final ────────────────────────────────────────────────────
    const totalElapsedMs = Date.now() - startTime;

    if (result?.success) {
      // Pipeline réussi → terminé (sauf si le sous-orchestrateur a déjà mis un statut)
      if (!result.nextStatus) {
        await airtableService.updateVisiteur(candidat_id, {
          statut_analyse_pivar: 'terminé',
          erreur_analyse:       '',
          derniere_activite:    new Date().toISOString()
        });
      }

      logger.info('🎉 Pipeline terminé', {
        candidat_id,
        totalElapsedMs,
        totalCostUsd: result.totalCostUsd?.toFixed(4) || '0',
        finalStatus:  result.nextStatus || 'terminé'
      });

      return {
        success: true,
        candidat_id,
        totalElapsedMs,
        totalCostUsd: result.totalCostUsd || 0,
        ...result
      };
    } else {
      // Sous-orchestrateur a renvoyé success=false (cas particulier, statut déjà géré)
      logger.info('Sous-orchestrateur a renvoyé success=false (statut géré par le sous-orchestrateur)', {
        candidat_id,
        stopReason: result?.stopReason || 'unknown',
        totalElapsedMs
      });

      return {
        success: false,
        candidat_id,
        totalElapsedMs,
        ...result
      };
    }

  } catch (error) {
    const totalElapsedMs = Date.now() - startTime;

    logger.error('Pipeline failed dans orchestratorPrincipal', {
      candidat_id,
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });

    // Marquer en erreur dans Airtable
    try {
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: 'ERREUR',
        erreur_analyse:       error.message?.substring(0, 500) || 'unknown error',
        derniere_activite:    new Date().toISOString()
      });
    } catch (updateErr) {
      logger.error('Failed to update visiteur status to ERREUR', {
        candidat_id,
        error: updateErr.message
      });
    }

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AIGUILLAGE PAR STATUT
// ═══════════════════════════════════════════════════════════════════════════

async function aiguillerVersSousOrchestrateur({ candidat_id, visiteur, statut_actuel }) {
  // Statuts qui aiguillent vers la pré-étape (lecture cognitive amont)
  const STATUTS_PROMPT_ETAPE1 = [
    'NOUVEAU',
    'REPRENDRE_PROMPT_ETAPE1'
  ];

  // Statuts qui aiguillent vers l'Étape 1 (T1 → T2 → T3 → T4)
  const STATUTS_ETAPE_1 = [
    'REPRENDRE_AGENT1',
    'en_cours',
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
    'REPRENDRE_AGENT3',
    'REPRENDRE_AGENT4'
  ];

  if (STATUTS_PROMPT_ETAPE1.includes(statut_actuel)) {
    logger.info('Aiguillage → Pré-étape (lecture cognitive amont)', { candidat_id, statut: statut_actuel });
    return await orchestratorPromptEtape1.run({ candidat_id, visiteur });
  }

  if (STATUTS_ETAPE_1.includes(statut_actuel)) {
    logger.info('Aiguillage → Étape 1', { candidat_id, statut: statut_actuel });
    return await orchestratorEtape1.run({ candidat_id, visiteur });
  }

  // Statut inconnu ou non éligible
  logger.warn('Statut non éligible pour traitement', { candidat_id, statut_actuel });
  throw new Error(`Statut "${statut_actuel}" non éligible pour traitement par l'orchestrateur principal`);
}

// ═══════════════════════════════════════════════════════════════════════════
// REPRISE APRÈS CRASH — recoverCandidate
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reprend le traitement d'un candidat après un crash du service.
 * Lit le statut actuel dans VISITEUR et relance le pipeline approprié.
 *
 * @param {string} session_id
 * @returns {Promise<Object>}
 */
async function recoverCandidate(session_id) {
  const candidat_id = session_id;
  logger.info('Reprise après crash', { candidat_id });
  return await processCandidate(candidat_id);
}

module.exports = {
  processCandidate,
  recoverCandidate,
  aiguillerVersSousOrchestrateur
};
