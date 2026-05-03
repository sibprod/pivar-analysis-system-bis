// services/orchestrators/orchestratorPrincipal.js
// Orchestrateur principal — Profil-Cognitif v10.0
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (Section 4.4 Architecture multi-étapes)
//
// Rôle (métaphore "chef de cuisine") :
//   - Lit le statut du candidat dans VISITEUR
//   - Aiguille vers le bon sous-orchestrateur selon où le candidat en est dans le pipeline
//   - Surveille la santé globale (healthcheck préalable, Décision n°23) — squelette pour Phase D-2
//   - Met à jour le statut final en sortie
//
// Aiguillage par statut :
//   - NOUVEAU                       → Étape 1 (depuis le début)
//   - REPRENDRE_AGENT1              → Étape 1 (Mode 4 du vérificateur — relance T1)
//   - REPRENDRE_VERIFICATEUR1       → Étape 1 (validation humaine relance vérif)
//   - en_cours                      → Continue (typiquement après ACCEPTER_TEL_QUEL)
//   - ETAPE1_TERMINEE (futur)       → Étape 2 (à concevoir)
//   - ETAPE2_TERMINEE (futur)       → Étape 3 (à concevoir)
//
// PHASE D (2026-04-28) — v10 :
//   - Fichier NOUVEAU : extrait du monolithe orchestratorService.js (Décision n°26)
//   - Aiguillage par statut implémenté
//   - Healthcheck préalable : squelette (sera enrichi en Phase D-2 avec healthcheckService)

'use strict';

const airtableService     = require('../infrastructure/airtableService');
const orchestratorEtape1  = require('./orchestratorEtape1');
const logger              = require('../../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE — processCandidate
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Point d'entrée unique pour traiter un candidat
 * Signature compatible avec l'ancien orchestrateur v9 (utilisé par routes/index.js et queueService.js)
 *
 * @param {string} session_id - Identifiant du candidat (= candidate_ID dans VISITEUR)
 * @returns {Promise<Object>} { success, candidat_id, totalCostUsd, totalElapsedMs, ... }
 */
async function processCandidate(session_id) {
  const candidat_id = session_id;  // uniformisation v9 (D7 actée)
  const startTime = Date.now();

  logger.info('╔═══════════════════════════════════════════════════════════╗', { candidat_id });
  logger.info('║ Orchestrateur Principal v10 — processCandidate            ║', { candidat_id });
  logger.info('╚═══════════════════════════════════════════════════════════╝', { candidat_id });

  let visiteur = null;

  try {
    // ─── 1. Lecture VISITEUR & vérifications préalables ────────────────────
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

    // ─── 2. Healthcheck préalable (Décision n°23) ───────────────────────────
    // Squelette pour Phase D-2 : sera implémenté avec healthcheckService.js
    // Pour l'instant, on log juste l'intention.
    logger.debug('Healthcheck préalable — squelette (à implémenter Phase D-2)', { candidat_id });
    // const healthOk = await healthcheckService.checkAllServices();
    // if (!healthOk.allOk) { return { success: false, reason: 'services_externes_down' }; }

    // ─── 3. Marquer en cours ─────────────────────────────────────────────────
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: 'en_cours',
      erreur_analyse:       '',
      derniere_activite:    new Date().toISOString()
    });

    // ─── 4. Aiguillage selon le statut ─────────────────────────────────────
    const result = await aiguillerVersSousOrchestrateur({
      candidat_id,
      visiteur,
      statut_actuel
    });

    // ─── 5. Statut final ─────────────────────────────────────────────────────
    const totalElapsedMs = Date.now() - startTime;

    if (result?.success) {
      // Pipeline réussi
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: 'terminé',
        erreur_analyse:       '',
        derniere_activite:    new Date().toISOString()
      });

      logger.info('🎉 Pipeline complet terminé', {
        candidat_id,
        totalElapsedMs,
        totalElapsedSec: (totalElapsedMs / 1000).toFixed(1)
      });
    } else if (result?.stopReason) {
      // Pipeline arrêté volontairement (Mode 3 ou Mode 4 du vérificateur)
      // Le statut a déjà été mis à jour par le sous-orchestrateur
      logger.info('Pipeline arrêté avec raison', {
        candidat_id,
        stopReason: result.stopReason,
        totalElapsedMs
      });
    }

    return {
      ...result,
      totalElapsedMs
    };

  } catch (error) {
    // Gestion erreur — statut ERREUR
    logger.error('Pipeline failed dans orchestratorPrincipal', {
      candidat_id,
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });

    try {
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: 'ERREUR',
        erreur_analyse:       (error.message || '').substring(0, 1000),
        derniere_activite:    new Date().toISOString()
      });
    } catch (e) {
      logger.error('Failed to update VISITEUR error status', { candidat_id, error: e.message });
    }

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AIGUILLAGE SELON LE STATUT DU CANDIDAT
// ═══════════════════════════════════════════════════════════════════════════

async function aiguillerVersSousOrchestrateur({ candidat_id, visiteur, statut_actuel }) {
  // Statuts qui aiguillent vers Étape 1
  const STATUTS_ETAPE_1 = [
    'NOUVEAU',
    'REPRENDRE_AGENT1',
    'REPRENDRE_VERIFICATEUR1',
    'en_cours'
  ];

  if (STATUTS_ETAPE_1.includes(statut_actuel)) {
    logger.info('Aiguillage → Étape 1', { candidat_id, statut: statut_actuel });
    return await orchestratorEtape1.run({ candidat_id, visiteur });
  }

  // Statut "ETAPE1_TERMINEE" (futur) → Étape 2
  // if (statut_actuel === 'ETAPE1_TERMINEE') {
  //   logger.info('Aiguillage → Étape 2', { candidat_id });
  //   return await orchestratorEtape2.run({ candidat_id, visiteur });
  // }

  // Statut "ETAPE2_TERMINEE" (futur) → Étape 3
  // if (statut_actuel === 'ETAPE2_TERMINEE') {
  //   logger.info('Aiguillage → Étape 3', { candidat_id });
  //   return await orchestratorEtape3.run({ candidat_id, visiteur });
  // }

  // Statut inconnu ou non éligible
  logger.warn('Statut non éligible pour traitement', { candidat_id, statut_actuel });
  throw new Error(`Statut "${statut_actuel}" non éligible pour traitement par l'orchestrateur principal`);
}

// ═══════════════════════════════════════════════════════════════════════════
// REPRISE APRÈS CRASH — recoverCandidate (signature compatible v9)
// ═══════════════════════════════════════════════════════════════════════════

async function recoverCandidate(session_id) {
  const candidat_id = session_id;
  logger.info('Recovery requested via orchestratorPrincipal', { candidat_id });

  // Pour la v10, on relance simplement le pipeline (aiguillage par statut fait le travail)
  // Le statut actuel détermine où on reprend (REPRENDRE_AGENT1, REPRENDRE_VERIFICATEUR1, etc.)
  return processCandidate(session_id);
}

module.exports = {
  processCandidate,
  recoverCandidate
};
