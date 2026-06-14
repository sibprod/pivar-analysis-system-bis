// services/orchestrators/orchestratorPrincipal.js
// Orchestrateur principal — Profil-Cognitif v10.7
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
//   - REPRENDRE_AGENT3              → Étape 3 ANCIENNE génération (orchestratorEtape1 mode AGENT3_SEUL → orchestratorT3 → agentT3BilanService)
//   - REPRENDRE_BILAN_FABLE (+ PA/PB/PC/PD)  → ⭐ v10.7 (13/06/2026) Étape 3 NOUVELLE chaîne « Fable » (orchestratorBilanFable)
//   - REPRENDRE_AGENT4              → Étape 4 (à coder)
//   - REPRENDRE_VERIFICATEUR4       → Étape 4 (à coder)
//   ─── Statuts hors pipeline ───────────────────────────────────────────
//   - SUSPENDU MANUELLEMENT         → ignoré par l'orchestrateur (pause superviseur)
//   - EN_ATTENTE_VALIDATION_HUMAINE → ignoré (Mode 4 vérificateur, attente diagnostic)
//   - terminé                       → ignoré (pipeline complet réussi)
//   - ERREUR                        → ignoré (reprise manuelle nécessaire)
//   - BILAN_FABLE_PA_OK             → ignoré (sentinelle : 5 piliers produits, validation des modes ; aval relancé manuellement via REPRENDRE_BILAN_PB/PC/PD)
//   - BILAN_FABLE_TERMINE           → ignoré (bilan Fable produit, terminal)
//
// PHASE v10.7 (2026-06-13) — INTÉGRATION CHAÎNE BILAN « FABLE » :
//   - ⭐ Ajout du require orchestratorBilanFable (services/etape1/bilan_fable/).
//   - ⭐ Ajout de la liste STATUTS_BILAN_FABLE (5 déclencheurs) + branche d'aiguillage
//     dédiée, calquée sur le bloc STATUTS_EXCELLENCES. La chaîne Fable court-circuite
//     l'ancien chemin (orchestratorEtape1/orchestratorT3/agentT3BilanService), qui reste
//     intact et accessible via REPRENDRE_AGENT3 (filet de retour arrière).
//   - ⭐ Gestion du statut en sortie : l'orchestrateur Fable pose lui-même son statut
//     (BILAN_FABLE_PA_OK pour la pause de validation des modes, BILAN_FABLE_TERMINE en fin)
//     et retourne { stopReason } pour que processCandidate NE l'écrase PAS par 'terminé'
//     (même mécanisme que les relances par scénario v10.2b et le vérificateur).
//   - Aucune autre modification fonctionnelle : tout le reste est identique à v10.6.
//
// PHASE D (2026-04-28) — v10 :
//   - Fichier NOUVEAU : extrait du monolithe orchestratorService.js (Décision n°26)
//   - Aiguillage par statut implémenté
//   - Healthcheck préalable : squelette (sera enrichi en Phase D-2 avec healthcheckService)
//
// PHASE v10.2b (2026-05-03) — relances par scénario (Décision n°42) :
//   - STATUTS_ETAPE_1 élargi : +5 statuts _SEUL +5 statuts _DES_
//   - Le retour { success: false, stopReason: 'scenario_*_done' } est traité comme
//     un arrêt volontaire (le statut REPRENDRE_VERIFICATEUR1 posé par
//     orchestratorEtape1 est préservé, le polling reprend au cycle suivant)
//
// PHASE v10.3 (2026-05-04) — alignement v1.9 :
//   - Mise à jour références v1.8 → v1.9
//   - Aucun changement fonctionnel : la liste STATUTS_ETAPE_1 est déjà alignée
//     sur la Décision n°42 et le statut SUSPENDU MANUELLEMENT est correctement
//     ignoré (rejeté par aiguillerVersSousOrchestrateur, ce qui le préserve en pause).
//
// PHASE v10.9 (2026-05-22) — Phase 3 enrichissement Algorithme A v1.1 :
//   - ⭐ Ajout statut REPRENDRE_AGENT2_PHASE3 dans STATUTS_ETAPE_2.
//     Aiguillage inchangé : orchestratorEtape2.run() reçoit le visiteur et
//     détecte le mode PHASE3_ISOLEE automatiquement via sa table STATUT_TO_MODE.
//   - Aucune autre modification fonctionnelle dans ce fichier.
//   - Note : le statut sentinelle ETAPE2_PHASE2_TERMINEE (Phase 1+2 OK, Phase 3 KO)
//     n'est PAS aiguillé ici — c'est un statut terminal qui demande à Isabelle
//     de poser manuellement REPRENDRE_AGENT2_PHASE3 pour rejouer Phase 3 seule.

'use strict';

const airtableService            = require('../infrastructure/airtableService');
const orchestratorEtape1         = require('./orchestratorEtape1');
const orchestratorEtape2         = require('./orchestratorEtape2');  // ⭐ v10.8 (refonte étape 2 en 2 phases)
const orchestratorExcellences    = require('./orchestratorExcellences');  // ⭐ v11.7 (bilan 4 excellences)
const orchestratorPromptEtape1   = require('./orchestratorPromptEtape1');  // ⭐ v10.6 (Phase ETAPE1.1)
const orchestratorBilanFable     = require('../etape1/bilan_fable/orchestratorBilanFable');  // ⭐ v10.7 (chaîne bilan Fable)
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
  logger.info('║ Orchestrateur Principal v10.7 — processCandidate          ║', { candidat_id });
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

    if (result?.stopReason) {
      // Pipeline arrêté volontairement (Mode 3, Mode 4 du vérificateur, SCENARIO_*_done v10.2b,
      // ou chaîne Fable v10.7 qui pose elle-même BILAN_FABLE_PA_OK / BILAN_FABLE_TERMINE).
      // Le statut a déjà été mis à jour par le sous-orchestrateur — ne rien écraser ici.
      logger.info('Pipeline arrêté avec raison', {
        candidat_id,
        stopReason: result.stopReason,
        totalElapsedMs
      });
    } else if (result?.success) {
      // Pipeline réussi → terminé
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
  // ⭐ v10.6 — Aiguillage vers la pré-étape 1.1 (lecture cognitive)
  // (Phase ETAPE1.1-1.0.0 — 2026-05-07)
  //
  // NOUVEAU et REPRENDRE_PROMPT_ETAPE1 vont vers orchestratorPromptEtape1 :
  //   - NOUVEAU : nouveau candidat → on commence par la lecture cognitive
  //     puis bascule auto vers REPRENDRE_AGENT1 (T1 déclenché au pickup suivant)
  //   - REPRENDRE_PROMPT_ETAPE1 : relance manuelle de la pré-étape seule
  //     (idempotent — skip les scénarios déjà traités, ne rejoue que ce qu'il faut)
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

  // Statuts qui aiguillent vers Étape 1 (T1+Vérif+T2+T3+T4)
  // Source primaire : Section 12 du Contrat ETAPE1 v1.8
  // ⚠️ NOUVEAU n'est plus dans cette liste depuis v10.6 (va vers orchestratorPromptEtape1)
  const STATUTS_ETAPE_1 = [
    'REPRENDRE_AGENT1',
    'REPRENDRE_VERIFICATEUR1',
    'en_cours',
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
    'REPRENDRE_T1_DES_PANNE',
    // ⭐ v10.8 (21/05/2026) — REPRENDRE_AGENT2 retiré d'ici, désormais aiguillé
    //  vers orchestratorEtape2.run() (refonte étape 2 en 2 phases)
    //  cf. bloc d'aiguillage spécifique étape 2 ci-dessous.
    // ⭐ v10.6 — T3 v4.3 migré : reprise à T3 (saute T1+Vérif+T2, démarre T3)
    // L'aiguillage va vers orchestratorEtape1 qui détecte le mode AGENT3_SEUL
    // ⚠️ v10.7 — REPRENDRE_AGENT3 = ANCIENNE génération du bilan (conservée, filet
    //    de retour arrière). La NOUVELLE chaîne Fable a ses propres statuts, aiguillés
    //    plus bas vers orchestratorBilanFable.
    'REPRENDRE_AGENT3',
    // ⭐ v10.7 — T4 v1.1 migré : reprise à T4 (saute T1+Vérif+T2+T3, démarre T4)
    // L'aiguillage va vers orchestratorEtape1 qui détecte le mode AGENT4_SEUL
    'REPRENDRE_AGENT4'
  ];

  if (STATUTS_ETAPE_1.includes(statut_actuel)) {
    logger.info('Aiguillage → Étape 1', { candidat_id, statut: statut_actuel });
    return await orchestratorEtape1.run({ candidat_id, visiteur });
  }

  // ─── ⭐ v10.9 — Aiguillage Étape 2 (refonte en 3 phases) ─────────────────
  // Les 4 statuts ci-dessous sont tous gérés par orchestratorEtape2 qui détecte
  // automatiquement le mode (COMPLET / PHASE1_ISOLEE / PHASE2_ISOLEE / PHASE3_ISOLEE)
  // à partir du statut entrant via la table STATUT_TO_MODE.
  //
  // ⭐ v10.9 (22/05/2026) : ajout de REPRENDRE_AGENT2_PHASE3 (mode PHASE3_ISOLEE)
  // qui rejoue uniquement l'enrichissement Algorithme A (3A + 3B + 3C) sans
  // toucher à Phase 1 ni Phase 2. Cf. orchestratorEtape2.js v10.9.
  const STATUTS_ETAPE_2 = [
    'REPRENDRE_AGENT2',           // Mode COMPLET : Phase 1 + Phase 2 + Phase 3 enchaînées (⭐ v10.9)
    'REPRENDRE_AGENT2_PHASE1',    // Mode PHASE1_ISOLEE : attribution seule, statut sentinelle ETAPE2_PHASE1_TERMINEE
    'REPRENDRE_AGENT2_PHASE2',    // Mode PHASE2_ISOLEE : consolidation + enrichissement (coût zéro, pré-requis : types_verbatim_circuits rempli)
    'REPRENDRE_AGENT2_PHASE3'     // ⭐ v10.9 — Mode PHASE3_ISOLEE : enrichissement seul (coût zéro, pré-requis : types_verbatim_circuits rempli, ETAPE1_T2 déjà écrite)
  ];

  if (STATUTS_ETAPE_2.includes(statut_actuel)) {
    logger.info('Aiguillage → Étape 2 (v10.9 — 3 phases)', { candidat_id, statut: statut_actuel });
    return await orchestratorEtape2.run({ candidat_id, visiteur });
  }

  // ─── ⭐ v11.7 — Aiguillage Étape 2 : LES 4 EXCELLENCES (bilan) ───────────
  // Point d'entrée de l'Étape 2 : ETAPE2_1REPONSE4DIMENSIONS (posé après l'Agent 3).
  // orchestratorExcellences détecte lui-même, à partir de visiteur.statut_analyse_pivar,
  // s'il doit jouer T5A+T5BC (entrée / relance complète) ou reprendre à T5BC seul.
  const STATUTS_EXCELLENCES = [
    // ⭐ v12.0 — 3 agents A/B/C (un service par prompt) + mode complet
    'ETAPE2_COMPLET',              // production autonome → A + B + C à la suite
    'ETAPE2_AGENT_A',              // relance solo agent A (T5A : code 25 réponses)
    'ETAPE2_AGENT_B',              // relance solo agent B (T5B : portraits) — suppose A fait
    'ETAPE2_AGENT_C',              // relance solo agent C (T5C : profil+verdicts) — suppose B fait
    // Compatibilité (anciens statuts)
    'ETAPE2_1REPONSE4DIMENSIONS',  // ancien point d'entrée → fait tout (A+B+C)
    'ETAPE2_2EXCELLENCE',          // ancienne reprise → B+C
    'REPRENDRE_EXCELLENCES'        // relance manuelle complète (A+B+C)
  ];

  if (STATUTS_EXCELLENCES.includes(statut_actuel)) {
    logger.info('Aiguillage → Étape 2 Excellences (bilan 4 dimensions)', { candidat_id, statut: statut_actuel });
    return await orchestratorExcellences.run({ candidat_id, visiteur });
  }

  // ─── ⭐ v10.7 (13/06/2026) — Aiguillage Étape 3 : CHAÎNE BILAN « FABLE » ──
  // Nouvelle génération du bilan (P-A ×5 → P-B → P-C → P-D), distincte de l'ancien
  // chemin REPRENDRE_AGENT3 (conservé). orchestratorBilanFable pose lui-même son
  // statut de sortie (BILAN_FABLE_PA_OK = pause validation des modes ; BILAN_FABLE_TERMINE
  // = fin) ; on retourne donc { stopReason } pour que processCandidate ne l'écrase pas.
  //
  // Sentinelle BILAN_FABLE_PA_OK et terminal BILAN_FABLE_TERMINE NE sont PAS aiguillés
  // ici (ni pollés) : après validation des modes, l'aval est relancé manuellement via
  // REPRENDRE_BILAN_PB → REPRENDRE_BILAN_PC → REPRENDRE_BILAN_PD.
  const STATUTS_BILAN_FABLE = orchestratorBilanFable.STATUTS_BILAN_FABLE || [
    'REPRENDRE_BILAN_FABLE',
    'REPRENDRE_BILAN_PA',
    'REPRENDRE_BILAN_PB',
    'REPRENDRE_BILAN_PC',
    'REPRENDRE_BILAN_PD'
  ];

  if (STATUTS_BILAN_FABLE.includes(statut_actuel)) {
    logger.info('Aiguillage → Étape 3 Bilan Fable (P-A…P-D)', { candidat_id, statut: statut_actuel });
    const prenom = visiteur.Prenom || visiteur.prenom || '';
    const fableResult = await orchestratorBilanFable.executerBilanFable({
      candidat_id,
      statut: statut_actuel,
      prenom
    });
    // L'orchestrateur Fable a déjà posé le statut final → on préserve via stopReason.
    return {
      ...fableResult,
      stopReason: `bilan_fable_${statut_actuel}`
    };
  }

  // Statut "REPRENDRE_VERIFICATEUR4" → Étape 4 (à coder en Phase ultérieure)
  // if (statut_actuel === 'REPRENDRE_VERIFICATEUR4') {
  //   logger.info('Aiguillage → Étape 4', { candidat_id });
  //   return await orchestratorEtape4.run({ candidat_id, visiteur });
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
