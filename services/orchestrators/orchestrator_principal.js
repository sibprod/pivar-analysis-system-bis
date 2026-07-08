// services/orchestrators/orchestratorPrincipal.js
// Orchestrateur principal — Profil-Cognitif v10.8
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et docs/CONTRAT_ETAPE1.md (v1.9, Section 12 Machine à états)
//
// Rôle (métaphore "chef de cuisine") :
//   - Lit le statut du candidat dans VISITEUR
//   - Aiguille vers le bon sous-orchestrateur selon où le candidat en est dans le pipeline
//   - Surveille la santé globale (healthcheck préalable, Décision n°23) — squelette pour Phase D-2
//   - Met à jour le statut final en sortie
//
// Aiguillage par statut (Section 12 du Contrat ETAPE1 v1.9) :
//   ─── Étape 1 ────────────────────────────────────────────────────────
//   - NOUVEAU                       → Étape 1 mode PIPELINE_COMPLET
//   - REPRENDRE_AGENT1              → Étape 1 mode PIPELINE_COMPLET (synonyme de REPRENDRE_T1_DES_SOMMEIL)
//   - REPRENDRE_VERIFICATEUR1       → Étape 1 mode VÉRIFICATEUR_SEUL
//   - en_cours                      → Étape 1 (cas marginal, typiquement après ACCEPTER_TEL_QUEL)
//   - REPRENDRE_T1_<X>_SEUL  (5)    → Étape 1 mode SCENARIO_ISOLÉ      ⭐ v10.2b
//   - REPRENDRE_T1_DES_<X>   (5)    → Étape 1 mode SCENARIO_CASCADE    ⭐ v10.2b
//   ─── Étapes ultérieures (à coder) ────────────────────────────────────
//   - REPRENDRE_AGENT2              → Étape 2 v10.9 mode COMPLET (Phase 1 + Phase 2 + Phase 3) ⭐ v10.9
//   - REPRENDRE_AGENT2_PHASE1       → Étape 2 v10.9 mode PHASE1_ISOLEE
//   - REPRENDRE_AGENT2_PHASE2       → Étape 2 v10.9 mode PHASE2_ISOLEE (consolidation + enrichissement, coût zéro)
//   - REPRENDRE_AGENT2_PHASE3       → Étape 2 v10.9 mode PHASE3_ISOLEE (enrichissement seul, coût zéro) ⭐ v10.9
//   - REPRENDRE_AGENT2_CIRCUITPOURBILAN → Étape 2 v10.10 mode PHASE4_ISOLEE (mission de fin d'étape 1.2) ⭐ v10.10
//   - REPRENDRE_AGENT3              → SUPPRIMÉ v11.2 : ancien bilan retiré du dépôt (remplacé par la chaîne Fable)
//   - REPRENDRE_BILAN_FABLE (+ PA/PB/PD)  → ⭐ v10.7 (13/06/2026) Étape 3, chaîne « Fable » (orchestratoretape3bilan)
//                                            ⭐ 26/06 : P-C (boucles) retiré de la chaîne.
//   - REPRENDRE_AGENT4              → Étape 4 (à coder)
//   - REPRENDRE_VERIFICATEUR4       → Étape 4 (à coder)
//   ─── Statuts hors pipeline ───────────────────────────────────────────
//   - SUSPENDU MANUELLEMENT         → ignoré par l'orchestrateur (pause superviseur)
//   - EN_ATTENTE_VALIDATION_HUMAINE → ignoré (Mode 4 vérificateur, attente diagnostic)
//   - terminé                       → ignoré (pipeline complet réussi)
//   - ERREUR                        → ignoré (reprise manuelle nécessaire)
//   - BILAN_FABLE_PA_OK             → ignoré (sentinelle : 5 piliers produits, validation des modes ; aval relancé manuellement via REPRENDRE_BILAN_PB/PD)
//   - BILAN_FABLE_TERMINE           → ignoré (bilan Fable produit, terminal)
//
// ⭐ NETTOYAGE 26/06/2026 — SUPPRESSION DU MAILLON P-C (BOUCLES) :
//   'REPRENDRE_BILAN_PC' retiré du fallback STATUTS_BILAN_FABLE (le maillon P-C est supprimé
//   de la chaîne Fable ; cf. orchestrator_etape1_T3_bilan.js). Aucune autre modification.
//
// ⭐ PHASE v10.8 (2026-06-18) — MISSION DE FIN D'ÉTAPE 1.2 (Phase 4) :
//   - ⭐ Ajout du statut REPRENDRE_AGENT2_CIRCUITPOURBILAN dans STATUTS_ETAPE_2.
//     Aiguillage inchangé : orchestratorEtape2.run() reçoit le visiteur et détecte
//     le mode PHASE4_ISOLEE automatiquement via sa table STATUT_TO_MODE (v10.10).
//     Sans cet ajout, le statut tombait en "non éligible" → ERREUR.
//   - Aucune autre modification fonctionnelle : tout le reste est identique à v10.7.
//
// PHASE v10.7 (2026-06-13) — INTÉGRATION CHAÎNE BILAN « FABLE » :
//   - ⭐ Ajout du require orchestratoretape3bilan (services/orchestrators/).
//   - ⭐ Ajout de la liste STATUTS_BILAN_FABLE + branche d'aiguillage dédiée.
//   - ⭐ Gestion du statut en sortie : l'orchestrateur Fable pose lui-même son statut
//     (BILAN_FABLE_PA_OK / BILAN_FABLE_TERMINE) et retourne { stopReason }.
//
// PHASE D (2026-04-28) — v10 :
//   - Fichier NOUVEAU : extrait du monolithe orchestratorService.js (Décision n°26)
//   - Aiguillage par statut implémenté
//   - Healthcheck préalable : squelette (sera enrichi en Phase D-2 avec healthcheckService)
//
// PHASE v10.2b (2026-05-03) — relances par scénario (Décision n°42) :
//   - STATUTS_ETAPE_1 élargi : +5 statuts _SEUL +5 statuts _DES_
//   - Le retour { success: false, stopReason: 'scenario_*_done' } est traité comme
//     un arrêt volontaire.
//
// PHASE v10.9 (2026-05-22) — Phase 3 enrichissement Algorithme A v1.1 :
//   - ⭐ Ajout statut REPRENDRE_AGENT2_PHASE3 dans STATUTS_ETAPE_2.

'use strict';

const airtableService            = require('../infrastructure/airtableService');
const orchestratorEtape1         = require('./orchestrator_etape1_T1');
const orchestratorEtape2         = require('./orchestrator_etape1_T2');
const orchestratorExcellences    = require('./orchestrator_etape2_b_excellences');
const orchestratorPromptEtape1   = require('./orchestrator_etape1_responses');
const orchestratorEtape3Bilan    = require('./orchestrator_etape1_T3_bilan');
const logger                     = require('../../utils/logger');

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
  logger.info('║ Orchestrateur Principal v10.8 — processCandidate          ║', { candidat_id });
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
    logger.debug('Healthcheck préalable — squelette (à implémenter Phase D-2)', { candidat_id });

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

    if (result?.stopReason) {
      logger.info('Pipeline arrêté avec raison', {
        candidat_id,
        stopReason: result.stopReason,
        totalElapsedMs
      });
    } else if (result?.success) {
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
    }

    return {
      ...result,
      totalElapsedMs
    };

  } catch (error) {
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
  const STATUTS_PROMPT_ETAPE1 = [
    'NOUVEAU',
    'REPRENDRE_PROMPT_ETAPE1'
  ];

  if (STATUTS_PROMPT_ETAPE1.includes(statut_actuel)) {
    logger.info('Aiguillage → Prompt Étape 1 (lecture cognitive)', {
      candidat_id, statut: statut_actuel
    });
    return await orchestratorPromptEtape1.run({ candidat_id, visiteur });
  }

  const STATUTS_ETAPE_1 = [
    'REPRENDRE_AGENT1',
    'REPRENDRE_VERIFICATEUR1',
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
    'REPRENDRE_T1_DES_PANNE'
  ];

  if (STATUTS_ETAPE_1.includes(statut_actuel)) {
    // 🔒 GARDE-FOU (08/07/2026 — incident Cécile) : le statut transitoire
    // « en_cours » est posé par la file pendant TOUT traitement ; après un crash
    // (ex. panne Airtable en pleine chaîne Étape 2), il peut fuiter et être relu
    // ici — l'aiguillage lançait alors le pipeline Étape 1 COMPLET sur un candidat
    // déjà bilané, dont l'agent T1 commence par DÉTRUIRE les 25 lignes ETAPE1_T1.
    // Règle : « en_cours » ne route vers l'Étape 1 QUE si le candidat n'a pas
    // encore de bilan Étape 1. Sinon : statut d'alerte, aucune destruction,
    // intervention manuelle de la garante.
    if (statut_actuel === 'en_cours') {
      try {
        const dd = await airtableService.getDejaDitEtape1(candidat_id);
        const dejaBilane = dd && dd.profil_etape1 && Object.keys(dd.profil_etape1).length > 0;
        if (dejaBilane) {
          logger.error('🔒 GARDE-FOU aiguillage — « en_cours » sur candidat DÉJÀ BILANÉ : Étape 1 refusée', {
            candidat_id, statut: statut_actuel
          });
          await airtableService.updateVisiteur(candidat_id, {
            statut_analyse_pivar: 'ERREUR_AIGUILLAGE_A_VERIFIER',
            derniere_activite:    new Date().toISOString()
          }).catch(() => {});
          return { success: false, garde_fou: 'en_cours_sur_candidat_bilane' };
        }
      } catch (eGarde) {
        // En cas de doute (base injoignable), on REFUSE l'Étape 1 : ne jamais
        // détruire sur une lecture incertaine.
        logger.error('🔒 GARDE-FOU aiguillage — vérification impossible, Étape 1 refusée par prudence', {
          candidat_id, error: eGarde.message
        });
        return { success: false, garde_fou: 'verification_impossible' };
      }
    }
    logger.info('Aiguillage → Étape 1', { candidat_id, statut: statut_actuel });
    return await orchestratorEtape1.run({ candidat_id, visiteur });
  }

  const STATUTS_ETAPE_2 = [
    'REPRENDRE_AGENT2',
    'REPRENDRE_AGENT2_PHASE1',
    'REPRENDRE_AGENT2_PHASE2',
    'REPRENDRE_AGENT2_PHASE3',
    'REPRENDRE_AGENT2_CIRCUITPOURBILAN'
  ];

  if (STATUTS_ETAPE_2.includes(statut_actuel)) {
    logger.info('Aiguillage → Étape 2 (v10.10 — phases)', { candidat_id, statut: statut_actuel });
    return await orchestratorEtape2.run({ candidat_id, visiteur });
  }

  const STATUTS_EXCELLENCES = [
    'ETAPE2_COMPLET_EXCELLENCES',
    'ETAPE2_AGENT_A_EXCELLENCES',
    'ETAPE2_AGENT_B_EXCELLENCES',
    'ETAPE2_AGENT_C_EXCELLENCES',
    'ETAPE2_1REPONSE4DIMENSIONS',
    'ETAPE2_2EXCELLENCE',
    'REPRENDRE_EXCELLENCES'
  ];

  if (STATUTS_EXCELLENCES.includes(statut_actuel)) {
    logger.info('Aiguillage → Étape 2 Excellences (bilan 4 dimensions)', { candidat_id, statut: statut_actuel });
    return await orchestratorExcellences.run({ candidat_id, visiteur });
  }

  // ─── ⭐ v10.7 (13/06/2026) — Aiguillage Étape 3 : CHAÎNE BILAN « FABLE » ──
  // ⭐ 26/06 : P-C (boucles) retiré de la chaîne. Fallback nettoyé de 'REPRENDRE_BILAN_PC'.
  const STATUTS_BILAN_FABLE = orchestratorEtape3Bilan.STATUTS_BILAN_FABLE || [
    'REPRENDRE_BILAN_FABLE',
    'REPRENDRE_BILAN_PA',
    'REPRENDRE_BILAN_PB',
    'REPRENDRE_BILAN_PD'
  ];

  if (STATUTS_BILAN_FABLE.includes(statut_actuel)) {
    logger.info('Aiguillage → Étape 3 Bilan Fable (P-A…P-D)', { candidat_id, statut: statut_actuel });
    const fableResult = await orchestratorEtape3Bilan.executerBilanFable({
      candidat_id,
      statut: statut_actuel
    });
    return {
      ...fableResult,
      stopReason: `bilan_fable_${statut_actuel}`
    };
  }

  logger.warn('Statut non éligible pour traitement', { candidat_id, statut_actuel });
  throw new Error(`Statut "${statut_actuel}" non éligible pour traitement par l'orchestrateur principal`);
}

// ═══════════════════════════════════════════════════════════════════════════
// REPRISE APRÈS CRASH — recoverCandidate (signature compatible v9)
// ═══════════════════════════════════════════════════════════════════════════

async function recoverCandidate(session_id) {
  const candidat_id = session_id;
  logger.info('Recovery requested via orchestratorPrincipal', { candidat_id });
  return processCandidate(session_id);
}

module.exports = {
  processCandidate,
  recoverCandidate
};
