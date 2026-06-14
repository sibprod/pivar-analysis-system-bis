// services/orchestrators/orchestratorT3.js
// Sous-Orchestrateur Étape 3 — Le bilan cognitif
// Profil-Cognitif v11.0 (28/05/2026)
//
// ⚠️ AVANT MODIFICATION : lire new-prompts/etape1/etape1_t3bilan.txt (prompt v5.3)
//                       + docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// ───────────────────────────────────────────────────────────────────────────
// ARCHITECTURE v11.0 — UN PROMPT / UN SERVICE
// ───────────────────────────────────────────────────────────────────────────
//
//   étape 1.1 (lecture cognitive amont)   ← orchestratorPromptEtape1
//   étape 1   (T1 analyse 25 lignes)      ← orchestratorEtape1
//   étape 2   (circuits cognitifs)        ← orchestratorEtape2 (Phase 1+2+3)
//   étape 3   (LE BILAN)                  ← CET orchestrateur (v11.0)
//     └─ agentT3BilanService.runAgentT3Bilan
//        ├─ Charge les 7 sources Airtable (T1, T2, T2_VENTILATION, T2_INVENTAIRE,
//        │  RESPONSES, REFERENTIEL_PROFILS, REFERENTIEL_CIRCUITS_CANDIDATS)
//        ├─ Calcule l'architecture moteur (ordre des piliers par rôle)
//        ├─ 7 appels Claude du MÊME prompt etape1_t3bilan.txt (§3.3) :
//        │   • Appel 0    → sections globales §01-§07              → ETAPE1_T3_BILAN
//        │   • Appel 0bis → §02bis profil cognitif (soleil)         → ETAPE1_T3_BILAN
//        │   • Appels 1-5 → un par pilier (socle→str1→str2→fn1→fn2)
//        │                  pilier_mode + synthèses + circuits[]    → ETAPE1_T3_PILIER
//        │                                                          + ETAPE1_T3_CIRCUIT
//        └─ Écrit les 3 tables T3 (delete+create pour PILIER/CIRCUIT, upsert pour BILAN)
//
//   Décision Isabelle 28/05/2026 : abandon de l'ancienne architecture à 6 sous-agents.
//   UN seul prompt + UN seul service (agentT3BilanService dans services/etape1/etape1_t3/).
//
// ───────────────────────────────────────────────────────────────────────────
// MODE DE RUN
// ───────────────────────────────────────────────────────────────────────────
//
//   ┌──────────────────────────────┬──────────────────────────────────────────────┐
//   │ Statut entrant               │ Mode interne / Comportement                  │
//   ├──────────────────────────────┼──────────────────────────────────────────────┤
//   │ REPRENDRE_AGENT3             │ COMPLET : génération du bilan                │
//   │                              │ (cas normal — relance après étape 2 terminée)│
//   │                              │ Bascule statut → terminé (ou ERREUR)         │
//   └──────────────────────────────┴──────────────────────────────────────────────┘
//
// ───────────────────────────────────────────────────────────────────────────
// KILL-SWITCH ETAPE3_PRETE
// ───────────────────────────────────────────────────────────────────────────
//
//   Drapeau booléen `ETAPE3_PRETE` (constante en haut du fichier).
//   - true  (défaut)  : étape 3 active.
//   - false           : étape 3 désactivée, log warning et bascule ERREUR.
//
// ───────────────────────────────────────────────────────────────────────────
// AIGUILLAGE
// ───────────────────────────────────────────────────────────────────────────
//
//   orchestratorPrincipal aiguille REPRENDRE_AGENT3 vers orchestratorEtape1
//   en mode AGENT3_SEUL, qui délègue à CET orchestrateur via run().
//
// ───────────────────────────────────────────────────────────────────────────

'use strict';

const agentT3BilanService = require('../etape1/etape1_t3/agentT3BilanService');
const logger              = require('../../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// KILL-SWITCH
// ═══════════════════════════════════════════════════════════════════════════
const ETAPE3_PRETE = true;

const MODE_COMPLET = 'COMPLET';

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute l'étape 3 (le bilan) pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Object} [params.visiteur]   — données candidat (prénom/nom/civilité)
 * @returns {Promise<Object>} {
 *   success, candidat_id, mode,
 *   nb_piliers, nb_circuits,
 *   totalCostUsd, totalElapsedMs,
 *   t3Result, usages
 * }
 */
async function run({ candidat_id, visiteur = null }) {
  const startTime = Date.now();

  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
  logger.info('Étape 3 — Bilan cognitif — démarrage', {
    candidat_id,
    mode: MODE_COMPLET,
    ETAPE3_PRETE
  });
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

  // Kill-switch
  if (!ETAPE3_PRETE) {
    const msg = 'orchestratorT3 — ETAPE3_PRETE = false (étape 3 désactivée). Réactiver le drapeau pour exécuter.';
    logger.warn(msg, { candidat_id });
    throw new Error(msg);
  }

  // ─── Exécution du service unique ─────────────────────────────────────────
  let t3Result;
  try {
    t3Result = await agentT3BilanService.runAgentT3Bilan({
      candidat_id,
      visiteur
    });
  } catch (error) {
    logger.error('Étape 3 — échec génération bilan', {
      candidat_id,
      error: error.message,
      stack: error.stack
    });
    throw error;
  }

  const totalElapsedMs = Date.now() - startTime;
  const totalCostUsd   = t3Result.totalCostUsd || 0;

  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
  logger.info('✅ Étape 3 — Bilan généré', {
    candidat_id,
    nb_piliers:   t3Result.nb_piliers,
    nb_circuits:  t3Result.nb_circuits,
    totalCostUsd: totalCostUsd.toFixed(4),
    totalElapsedMs
  });
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

  return {
    success: true,
    candidat_id,
    mode: MODE_COMPLET,
    nb_piliers:   t3Result.nb_piliers,
    nb_circuits:  t3Result.nb_circuits,
    totalCostUsd,
    totalElapsedMs,
    t3Result,
    usages: t3Result.usages || []
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════
module.exports = {
  run,

  // Constantes exposées pour tests et orchestratorPrincipal
  ETAPE3_PRETE,
  MODE_COMPLET
};
