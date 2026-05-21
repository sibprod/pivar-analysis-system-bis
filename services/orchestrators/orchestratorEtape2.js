// services/orchestrators/orchestratorEtape2.js
// Sous-Orchestrator Étape 2 — Cartographie des circuits cognitifs
// Profil-Cognitif v10.7
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2+)
//                       et le prompt prompts/etape1/etape1_t2.txt (v2.0)
//
// ───────────────────────────────────────────────────────────────────────────
// ARCHITECTURE v10.7 (3 étapes — après suppression T2 historique)
// ───────────────────────────────────────────────────────────────────────────
//
//   étape 1.1 (lecture cognitive amont) ← orchestratorPromptEtape1
//   étape 1   (T1 analyse 25 lignes)    ← orchestratorEtape1
//   étape 2   (circuits cognitifs)      ← ce sous-orchestrator (v10.7 refonte)
//   étape 3   (synthèse 6 sous-agents)  ← orchestratorEtape3 (en attente refonte)
//
// ───────────────────────────────────────────────────────────────────────────
// RÔLE
// ───────────────────────────────────────────────────────────────────────────
//
//   Sous-orchestrator dédié à l'ÉTAPE 2 (circuits cognitifs) qui s'exécute
//   APRÈS l'orchestratorEtape1 (T1) et AVANT l'orchestratorEtape3 (synthèse).
//
//   Délègue tout le travail métier à services/etape1/agentT2Service.runAgentT2
//   qui :
//     - Lit ETAPE1_T1 (25 lignes) + RESPONSES (25 lignes avec 6 champs cog_*)
//     - Lit REFERENTIEL_CIRCUITS (75 officiels) + REFERENTIEL_CIRCUITS_CANDIDATS
//       (ad hoc EN_ATTENTE, anti-doublons)
//     - Appelle Claude (1 seul appel) avec le prompt etape1_t2.txt v2.0
//     - Applique la doctrine 4 PASSES (Option B validée 20/05/2026)
//     - Écrit jusqu'à 75 lignes ETAPE1_T2 (delete+create atomique)
//     - Mission de veille : upsert dans REFERENTIEL_CIRCUITS_CANDIDATS pour
//       chaque circuit ad hoc créé en PASSE 3.B
//
// ───────────────────────────────────────────────────────────────────────────
// FLUX D'AIGUILLAGE (côté orchestratorPrincipal)
// ───────────────────────────────────────────────────────────────────────────
//
//   ┌──────────────────────────────────────────────────────────────────────┐
//   │ Statut entrant            → Sous-orchestrator                        │
//   ├──────────────────────────────────────────────────────────────────────┤
//   │ NOUVEAU                   → orchestratorPromptEtape1 (étape 1.1)     │
//   │ REPRENDRE_PROMPT_ETAPE1   → orchestratorPromptEtape1 (étape 1.1)     │
//   │ REPRENDRE_AGENT1          → orchestratorEtape1 (étape 1 T1)          │
//   │ REPRENDRE_AGENT2          → orchestratorEtape2 (cette classe)        │
//   │ REPRENDRE_AGENT3          → orchestratorEtape3 (étape 3 synthèse)    │
//   └──────────────────────────────────────────────────────────────────────┘
//
// ───────────────────────────────────────────────────────────────────────────
// BASCULE DE STATUT
// ───────────────────────────────────────────────────────────────────────────
//
//   À la fin d'un traitement réussi, le statut bascule vers `REPRENDRE_AGENT3`
//   pour que le prochain pickup polling enchaîne sur l'étape 3 (synthèse).
//
//   Si l'étape 3 n'est pas encore prête (en refonte), le statut bascule
//   intermédiaire `ETAPE2_TERMINEE` peut être utilisé pour marquer un état
//   final temporaire — à activer via la constante ETAPE3_PRETE = false.
//
//   Si erreur :
//     - L'exception remonte à l'orchestratorPrincipal qui pose le statut ERREUR
//     - Les éventuelles tentatives sont gérées côté orchestratorPrincipal
//
// ───────────────────────────────────────────────────────────────────────────

'use strict';

const airtableService     = require('../infrastructure/airtableService');
const agentT2Service      = require('../etape1/agentT2Service');
const backupService       = require('../infrastructure/backupService');
const logger              = require('../../utils/logger');

// ─── Drapeau de réactivation de l'étape 3 ─────────────────────────────────
// Mettre à `true` quand orchestratorEtape3 sera prêt (post-refonte synthèse).
// Tant que `false`, l'étape 2 bascule le statut vers `ETAPE2_TERMINEE` au lieu
// de `REPRENDRE_AGENT3` (le polling ne re-tirera pas le candidat).
const ETAPE3_PRETE = false;

const STATUT_BASCULE_FIN = ETAPE3_PRETE ? 'REPRENDRE_AGENT3' : 'ETAPE2_TERMINEE';

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Point d'entrée du sous-orchestrator étape 2.
 *
 * @param {Object} args
 * @param {string} args.candidat_id
 * @param {Object} [args.visiteur]    record visiteur (lu par orchestratorPrincipal)
 * @param {string} [args.session_id]  optionnel — sinon résolu depuis ETAPE1_T1
 * @returns {Promise<Object>} { success, candidat_id, ... }
 */
async function run({ candidat_id, visiteur = null, session_id = null }) {
  const startTime = Date.now();

  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
  logger.info('Pipeline Étape 2 (circuits) starting', {
    candidat_id,
    statut_entrant: visiteur?.statut_analyse_pivar || '?',
    etape3_prete:   ETAPE3_PRETE
  });
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

  // ─── 1. Marquer en_cours (idempotent) ───────────────────────────────────
  try {
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: 'en_cours',
      derniere_activite:    new Date().toISOString()
    });
  } catch (e) {
    logger.warn('orchestratorEtape2 — échec mise à jour statut en_cours (non bloquant)', {
      candidat_id,
      error: e.message
    });
  }

  // ─── 2. Backup avant étape 2 ────────────────────────────────────────────
  try {
    await backupService.save(candidat_id, 'before_etape2', {
      session_id: session_id || candidat_id,
      statut_entrant: visiteur?.statut_analyse_pivar || '?'
    });
  } catch (e) {
    logger.warn('orchestratorEtape2 — échec backup before_etape2 (non bloquant)', {
      candidat_id,
      error: e.message
    });
  }

  // ─── 3. Exécution de l'agent étape 2 ────────────────────────────────────
  let agentResult;
  try {
    agentResult = await agentT2Service.runAgentT2({
      candidat_id,
      session_id: session_id || candidat_id
    });
  } catch (err) {
    logger.error('Pipeline Étape 2 (circuits) failed', {
      candidat_id,
      error: err.message,
      stack: err.stack?.substring(0, 500)
    });

    // Backup d'erreur pour debug
    try {
      await backupService.save(candidat_id, 'error_etape2', {
        error: err.message,
        step: identifyFailedStep(err)
      });
    } catch (e) {
      // backup non bloquant
    }

    // L'orchestratorPrincipal posera le statut ERREUR
    throw err;
  }

  // ─── 4. Backup après étape 2 ────────────────────────────────────────────
  try {
    await backupService.save(candidat_id, 'after_etape2', {
      rows_count:    agentResult.rows.length,
      ad_hoc_count:  agentResult.circuits_ad_hoc_proposes.length,
      stats:         agentResult.stats
    });
  } catch (e) {
    logger.warn('orchestratorEtape2 — échec backup after_etape2 (non bloquant)', {
      candidat_id,
      error: e.message
    });
  }

  // ─── 5. Bascule du statut vers la suite ─────────────────────────────────
  try {
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: STATUT_BASCULE_FIN,
      derniere_activite:    new Date().toISOString(),
      erreur_analyse:       ''  // efface une éventuelle erreur passée
    });
    logger.info(`orchestratorEtape2 — bascule statut → ${STATUT_BASCULE_FIN}`, { candidat_id });
  } catch (e) {
    logger.error('orchestratorEtape2 — échec bascule statut', {
      candidat_id,
      bascule_cible: STATUT_BASCULE_FIN,
      error: e.message
    });
    throw new Error(
      `Pipeline Étape 2 a réussi mais la bascule du statut vers ${STATUT_BASCULE_FIN} a échoué : ${e.message}`
    );
  }

  // ─── 6. Reset tentatives (cohérence avec autres orchestrateurs) ─────────
  try {
    await airtableService.resetTentativesEtape1(candidat_id);
  } catch (e) {
    logger.warn('orchestratorEtape2 — échec reset tentatives (non bloquant)', {
      candidat_id, error: e.message
    });
  }

  // ─── 7. Synthèse finale ─────────────────────────────────────────────────
  const totalElapsedMs = Date.now() - startTime;

  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
  logger.info('🎉 Pipeline Étape 2 (circuits) terminé', {
    candidat_id,
    rows_ecrites:               agentResult.rows.length,
    ad_hoc_crees:                  agentResult.stats.nb_circuits_ad_hoc_nouveaux,
    ad_hoc_increment_principal:    agentResult.stats.nb_circuits_ad_hoc_increment_principal,
    ad_hoc_increment_autres:       agentResult.stats.nb_circuits_ad_hoc_increment_autres,
    ad_hoc_skipped:                agentResult.stats.nb_circuits_ad_hoc_skipped,
    promotions_auto:               agentResult.stats.nb_promotions_auto,
    flags_arbitrage_manuel:        agentResult.stats.nb_flags_arbitrage,
    totalCostUsd:               agentResult.cost.toFixed(4),
    totalElapsedMs,
    totalElapsedSec:            (totalElapsedMs / 1000).toFixed(1),
    nextStatus:                 STATUT_BASCULE_FIN
  });
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

  return {
    success:                   true,
    candidat_id,
    pipeline:                  'etape2_circuits',
    rows_ecrites:              agentResult.rows.length,
    circuits_ad_hoc_proposes:  agentResult.circuits_ad_hoc_proposes,
    stats:                     agentResult.stats,
    totalCostUsd:              agentResult.cost,
    totalElapsedMs,
    nextStatus:                STATUT_BASCULE_FIN,
    agentResult
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Identifie l'étape d'échec interne (utile pour le backup d'erreur).
 * Pattern simple : regarde le message d'erreur pour repérer le contexte.
 */
function identifyFailedStep(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('etape1_t1') || msg.includes('lignes etape1_t1'))     return 'lecture_etape1_t1';
  if (msg.includes('responses'))                                          return 'lecture_responses';
  if (msg.includes('referentiel_circuits'))                               return 'lecture_referentiel';
  if (msg.includes('v1 ') || msg.includes('v3 ') || msg.includes('v9 ')
      || msg.includes('volumétrie') || msg.includes('validation'))         return 'validation_sortie_claude';
  if (msg.includes('writeetape1t2') || msg.includes('etape1_t2'))         return 'ecriture_etape1_t2';
  if (msg.includes('ad hoc') || msg.includes('candidat'))                 return 'mission_veille_ad_hoc';
  if (msg.includes('claude') || msg.includes('agent t2'))                 return 'appel_claude';
  return 'inconnu';
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  run,
  // Exports internes pour tests unitaires / supervision
  _internal: {
    identifyFailedStep,
    STATUT_BASCULE_FIN,
    ETAPE3_PRETE
  }
};
