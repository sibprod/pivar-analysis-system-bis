// services/orchestrators/orchestratorEtape2.js
// Sous-Orchestrateur Étape 2 — Cartographie des circuits cognitifs
// Profil-Cognitif v10.9 (Phase 3 ajoutée 22/05/2026)
//
// ⚠️ AVANT MODIFICATION : lire docs/PLAN_CORRECTION_v10_8.md
//                       et docs/memo_technique_phase3.md (22/05/2026)
//
// ───────────────────────────────────────────────────────────────────────────
// ARCHITECTURE v10.9 — REFONTE EN 3 PHASES
// ───────────────────────────────────────────────────────────────────────────
//
//   étape 1.1 (lecture cognitive amont) ← orchestratorPromptEtape1
//   étape 1   (T1 analyse 25 lignes)    ← orchestratorEtape1
//   étape 2   (circuits cognitifs)      ← CET orchestrateur (v10.9)
//     ├─ Phase 1 : agentT2_phase1_attribution_Service    (1 appel Claude)
//     │  └─ Écrit types_verbatim_circuits dans les 25 lignes ETAPE1_T1
//     │  └─ Crée les ad hoc dans REFERENTIEL_CIRCUITS_CANDIDATS
//     ├─ Phase 2 : agentT2_phase2_consolidation_Service  (0 appel Claude, mécanique)
//     │  └─ Lit types_verbatim_circuits + référentiel
//     │  └─ Écrit ETAPE1_T2 (delete + create atomique)
//     └─ Phase 3 : agentT2_phase3_enrichissement_Service (0 appel Claude, mécanique) ⭐ v10.9
//        ├─ 3A : enrichit ETAPE1_T1 avec 14 champs (Algorithme A v1.1)
//        ├─ 3B : écrit ETAPE1_T2_VENTILATION_PILIERS (1-5 lignes/candidat)
//        └─ 3C : écrit ETAPE1_T2_INVENTAIRE_CIRCUITS (~30-60 lignes/candidat)
//        → Données lues par les routes /visualiser/tableau2piliers
//          et /visualiser/tableau2circuits (visualisation HTML dynamique)
//   étape 3   (synthèse 6 sous-agents)  ← orchestratorEtape3 (à coder)
//
// ───────────────────────────────────────────────────────────────────────────
// 4 MODES DE RUN (sélectionnés par le statut entrant)
// ───────────────────────────────────────────────────────────────────────────
//
//   ┌──────────────────────────────┬──────────────────────────────────────────────┐
//   │ Statut entrant               │ Mode interne / Comportement                  │
//   ├──────────────────────────────┼──────────────────────────────────────────────┤
//   │ REPRENDRE_AGENT2             │ COMPLET : Phase 1 + Phase 2 + Phase 3 ⭐v10.9│
//   │                              │ (cas normal — relance après T1 terminé)      │
//   ├──────────────────────────────┼──────────────────────────────────────────────┤
//   │ REPRENDRE_AGENT2_PHASE1      │ PHASE1_ISOLEE : Phase 1 seule                │
//   │                              │ (ré-attribution des circuits sans toucher    │
//   │                              │  à ETAPE1_T2 ni Phase 3 — usage : Isabelle   │
//   │                              │  veut refaire l'attribution sans déclencher  │
//   │                              │  la consolidation pour vérifier la qualité   │
//   │                              │  intermédiaire avant de poursuivre)          │
//   │                              │ Bascule statut → ETAPE2_PHASE1_TERMINEE      │
//   ├──────────────────────────────┼──────────────────────────────────────────────┤
//   │ REPRENDRE_AGENT2_PHASE2      │ PHASE2_ISOLEE : Phase 2 + Phase 3 ⭐v10.9    │
//   │                              │ (consolidation + enrichissement, coût zéro)  │
//   │                              │ ⭐ v10.9 : Phase 3 enchaînée pour garantir   │
//   │                              │  la cohérence des vues HTML après une        │
//   │                              │  re-consolidation.                           │
//   │                              │ (pré-requis : types_verbatim_circuits déjà   │
//   │                              │  rempli dans ETAPE1_T1 par Phase 1 antérieur)│
//   │                              │ Bascule statut → ETAPE2_TERMINEE             │
//   ├──────────────────────────────┼──────────────────────────────────────────────┤
//   │ REPRENDRE_AGENT2_PHASE3 ⭐   │ PHASE3_ISOLEE : Phase 3 seule (coût zéro)    │
//   │                              │ Rejoue l'enrichissement T1 + tables          │
//   │                              │ ventilation_piliers + inventaire_circuits.   │
//   │                              │ (pré-requis : types_verbatim_circuits déjà   │
//   │                              │  rempli, ETAPE1_T2 déjà écrite par Phase 2)  │
//   │                              │ Idempotent : réécrit l'état complet depuis   │
//   │                              │ ETAPE1_T1.                                   │
//   │                              │ Bascule statut → ETAPE2_TERMINEE             │
//   └──────────────────────────────┴──────────────────────────────────────────────┘
//
//   Les 3 modes ISOLES servent :
//   - Au debug (rejouer une phase sans relancer les autres)
//   - À la reprise après crash (Phase 1 OK + Phase 2 KO → on saute Phase 1)
//   - Au test itératif (rejouer Phase 1 avec un nouveau prompt sans
//     dégrader la T2 actuelle, puis basculer Phase 2 manuellement)
//   - À la régénération de l'enrichissement Phase 3 si l'algorithme évolue
//
// ───────────────────────────────────────────────────────────────────────────
// KILL-SWITCH PHASE3_PRETE
// ───────────────────────────────────────────────────────────────────────────
//
//   Drapeau booléen `PHASE3_PRETE` (constante en haut du fichier).
//   - true  (défaut)  : Phase 3 s'enchaîne après Phase 2 en mode COMPLET et PHASE2_ISOLEE,
//                       et s'exécute en mode PHASE3_ISOLEE.
//   - false           : Phase 3 ignorée, comportement v10.8 strict. Tout statut
//                       REPRENDRE_AGENT2_PHASE3 log un warning et bascule en ERREUR.
//
//   Permet de désactiver Phase 3 sans toucher au code (ex: bug détecté en prod,
//   on désactive, le pipeline retombe en v10.8 fonctionnel).
//
// ───────────────────────────────────────────────────────────────────────────
// STRATÉGIE DE GESTION D'ERREUR ET STATUTS INTERMÉDIAIRES
// ───────────────────────────────────────────────────────────────────────────
//
//   Mode COMPLET :
//     - Si Phase 1 échoue → statut posé par orchestratorPrincipal = ERREUR
//     - Si Phase 1 OK mais Phase 2 échoue → on pose ETAPE2_PHASE1_TERMINEE
//       (sentinel d'erreur intermédiaire) pour signaler que Phase 1 est OK
//       et qu'on peut relancer la Phase 2 seule via REPRENDRE_AGENT2_PHASE2.
//     - ⭐ v10.9 — Si Phase 1+2 OK mais Phase 3 échoue → on pose ETAPE2_PHASE2_TERMINEE
//       (nouveau sentinel) pour signaler que Phase 1+2 sont OK et qu'on peut
//       relancer la Phase 3 seule via REPRENDRE_AGENT2_PHASE3. Les données
//       métier (ETAPE1_T2) restent valides ; seules les vues de visualisation
//       sont potentiellement en état intermédiaire.
//
//   Mode PHASE1_ISOLEE :
//     - Si Phase 1 OK → ETAPE2_PHASE1_TERMINEE (statut sentinelle final)
//     - Si Phase 1 échoue → ERREUR (orchestratorPrincipal)
//
//   Mode PHASE2_ISOLEE :
//     - Si Phase 2 + Phase 3 OK → ETAPE2_TERMINEE (statut final normal)
//     - Si Phase 2 échoue → ERREUR
//     - ⭐ v10.9 — Si Phase 2 OK mais Phase 3 échoue → ETAPE2_PHASE2_TERMINEE
//
//   Mode PHASE3_ISOLEE :
//     - Si Phase 3 OK → ETAPE2_TERMINEE (statut final normal)
//     - Si Phase 3 échoue → ERREUR (orchestratorPrincipal)

'use strict';

const airtableService                       = require('../infrastructure/airtableService');
const agentT2_phase1_attribution_Service    = require('../etape1/agentT2_phase1_attribution_Service');
const agentT2_phase2_consolidation_Service  = require('../etape1/agentT2_phase2_consolidation_Service');
const agentT2_phase3_enrichissement_Service = require('../etape1/agentT2_phase3_enrichissement_Service');  // ⭐ v10.9
const backupService                         = require('../infrastructure/backupService');
const logger                                = require('../../utils/logger');

// ─── Drapeau de réactivation de l'étape 3 ─────────────────────────────────
const ETAPE3_PRETE = false;

// ⭐ v10.9 — Drapeau d'activation de la Phase 3 (Algorithme A v1.1)
// Si false : Phase 3 est ignorée. Le pipeline retombe en comportement v10.8 strict.
//            Les statuts REPRENDRE_AGENT2_PHASE3 sont rejetés.
// Si true (défaut) : Phase 3 s'enchaîne après Phase 2 en mode COMPLET et PHASE2_ISOLEE,
//                    et s'exécute seule en mode PHASE3_ISOLEE.
const PHASE3_PRETE = true;

// Statuts de sortie selon le mode
const STATUT_FIN_COMPLET           = ETAPE3_PRETE ? 'REPRENDRE_AGENT3' : 'ETAPE2_TERMINEE';
const STATUT_FIN_PHASE1_ISOLEE     = 'ETAPE2_PHASE1_TERMINEE';
const STATUT_FIN_PHASE2_ISOLEE     = ETAPE3_PRETE ? 'REPRENDRE_AGENT3' : 'ETAPE2_TERMINEE';
const STATUT_FIN_PHASE3_ISOLEE     = ETAPE3_PRETE ? 'REPRENDRE_AGENT3' : 'ETAPE2_TERMINEE';  // ⭐ v10.9
const STATUT_SENTINELLE_PHASE3_KO  = 'ETAPE2_PHASE2_TERMINEE';                                // ⭐ v10.9

// Modes de run
const MODE_COMPLET        = 'COMPLET';
const MODE_PHASE1_ISOLEE  = 'PHASE1_ISOLEE';
const MODE_PHASE2_ISOLEE  = 'PHASE2_ISOLEE';
const MODE_PHASE3_ISOLEE  = 'PHASE3_ISOLEE';  // ⭐ v10.9
const VALID_MODES         = [MODE_COMPLET, MODE_PHASE1_ISOLEE, MODE_PHASE2_ISOLEE, MODE_PHASE3_ISOLEE];

// Statuts d'entrée → mode
const STATUT_TO_MODE = {
  'REPRENDRE_AGENT2':         MODE_COMPLET,
  'REPRENDRE_AGENT2_PHASE1':  MODE_PHASE1_ISOLEE,
  'REPRENDRE_AGENT2_PHASE2':  MODE_PHASE2_ISOLEE,
  'REPRENDRE_AGENT2_PHASE3':  MODE_PHASE3_ISOLEE   // ⭐ v10.9
};

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Point d'entrée du sous-orchestrateur étape 2 refondu v10.8.
 *
 * @param {Object} args
 * @param {string} args.candidat_id
 * @param {Object} [args.visiteur]      record visiteur (lu par orchestratorPrincipal)
 * @param {string} [args.session_id]    optionnel — sinon résolu depuis ETAPE1_T1
 * @param {string} [args.mode]          force le mode (COMPLET / PHASE1_ISOLEE /
 *                                      PHASE2_ISOLEE). Si absent, dérivé du
 *                                      statut_analyse_pivar du visiteur.
 * @returns {Promise<Object>}
 */
async function run({ candidat_id, visiteur = null, session_id = null, mode = null }) {
  const startTime = Date.now();

  // ─── Déterminer le mode de run ──────────────────────────────────────────
  // Priorité : mode explicite > déduction depuis statut entrant > COMPLET (défaut)
  let runMode = mode;
  if (!runMode) {
    const statutEntrant = visiteur?.statut_analyse_pivar || '';
    runMode = STATUT_TO_MODE[statutEntrant] || MODE_COMPLET;
  }
  if (!VALID_MODES.includes(runMode)) {
    throw new Error(
      `orchestratorEtape2 — mode invalide "${runMode}". Valides : ${VALID_MODES.join(', ')}`
    );
  }

  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
  logger.info('Pipeline Étape 2 (v10.8 refonte) starting', {
    candidat_id,
    statut_entrant: visiteur?.statut_analyse_pivar || '?',
    mode:           runMode,
    etape3_prete:   ETAPE3_PRETE
  });
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

  // ─── 1. Marquer en_cours ────────────────────────────────────────────────
  try {
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: 'en_cours',
      derniere_activite:    new Date().toISOString()
    });
  } catch (e) {
    logger.warn('orchestratorEtape2 — échec maj statut en_cours (non bloquant)', {
      candidat_id, error: e.message
    });
  }

  // ─── 2. Backup avant étape 2 ────────────────────────────────────────────
  try {
    await backupService.save(candidat_id, 'before_etape2', {
      session_id:     session_id || candidat_id,
      statut_entrant: visiteur?.statut_analyse_pivar || '?',
      mode:           runMode,
      version:        'v10.9'
    });
  } catch (e) {
    logger.warn('orchestratorEtape2 — échec backup before_etape2 (non bloquant)', {
      candidat_id, error: e.message
    });
  }

  // ─── Aiguillage selon le mode ───────────────────────────────────────────
  let attributionResult    = null;
  let consolidationResult  = null;
  let enrichissementResult = null;  // ⭐ v10.9 — Phase 3

  // ═════════════════════════════════════════════════════════════════════════
  // PHASE 1 — ATTRIBUTION (sauf en mode PHASE2_ISOLEE)
  // ═════════════════════════════════════════════════════════════════════════
  if (runMode === MODE_COMPLET || runMode === MODE_PHASE1_ISOLEE) {
    logger.info('─── PHASE 1 — ATTRIBUTION (1 appel Claude) ───', { candidat_id, mode: runMode });

    try {
      attributionResult = await agentT2_phase1_attribution_Service.runAttribution({
        candidat_id,
        session_id: session_id || candidat_id
      });
    } catch (err) {
      logger.error('Pipeline Étape 2 — PHASE 1 (attribution) failed', {
        candidat_id,
        mode:  runMode,
        error: err.message,
        stack: err.stack?.substring(0, 500)
      });

      try {
        await backupService.save(candidat_id, 'error_etape2_phase1', {
          phase: 'attribution',
          mode:  runMode,
          error: err.message,
          step:  identifyFailedStep(err, 'phase1')
        });
      } catch (e) { /* backup non bloquant */ }

      // Pose le statut ERREUR + champ erreur_analyse pour Isabelle
      try {
        await airtableService.updateVisiteur(candidat_id, {
          statut_analyse_pivar: 'ERREUR',
          erreur_analyse:       `[etape2_phase1] ${err.message}`.substring(0, 500),
          derniere_activite:    new Date().toISOString()
        });
      } catch (e) { /* fallback : orchestratorPrincipal posera ERREUR */ }

      throw err;
    }

    logger.info('PHASE 1 — Attribution terminée', {
      candidat_id,
      nb_attributions_totales:  attributionResult.stats.nb_attributions_totales,
      nb_franches:              attributionResult.stats.nb_attributions_franches,
      nb_nuancees:              attributionResult.stats.nb_attributions_nuancees,
      nb_ad_hoc:                attributionResult.stats.nb_attributions_ad_hoc,
      nb_non_attribuees:        attributionResult.stats.nb_attributions_non_attr,
      nb_ad_hoc_nouveaux_crees: attributionResult.stats.nb_ad_hoc_nouveaux_crees,
      cost_usd:                 attributionResult.cost.toFixed(4),
      elapsed_sec:              (attributionResult.elapsedMs / 1000).toFixed(1)
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ARRÊT INTERMÉDIAIRE EN MODE PHASE1_ISOLEE
  // ═════════════════════════════════════════════════════════════════════════
  if (runMode === MODE_PHASE1_ISOLEE) {
    logger.info('─── Mode PHASE1_ISOLEE : on s\'arrête après Phase 1 ───', { candidat_id });

    // Backup après Phase 1 (sans Phase 2)
    try {
      await backupService.save(candidat_id, 'after_etape2_phase1_isolee', {
        version:                  'v10.8',
        mode:                     runMode,
        phase1_stats:             attributionResult.stats,
        ad_hoc_nouveaux_crees:    attributionResult.stats.nb_ad_hoc_nouveaux_crees,
        attributions_totales:     attributionResult.stats.nb_attributions_totales
      });
    } catch (e) { /* non bloquant */ }

    // Bascule statut → ETAPE2_PHASE1_TERMINEE (statut sentinelle final)
    try {
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: STATUT_FIN_PHASE1_ISOLEE,
        derniere_activite:    new Date().toISOString(),
        erreur_analyse:       ''
      });
      logger.info(`orchestratorEtape2 — bascule statut → ${STATUT_FIN_PHASE1_ISOLEE}`, { candidat_id });
    } catch (e) {
      logger.error('orchestratorEtape2 — échec bascule statut (mode PHASE1_ISOLEE)', {
        candidat_id, error: e.message
      });
      throw new Error(
        `Phase 1 OK mais bascule statut → ${STATUT_FIN_PHASE1_ISOLEE} a échoué : ${e.message}`
      );
    }

    const totalElapsedMs = Date.now() - startTime;
    logger.info('🎉 Pipeline Étape 2 mode PHASE1_ISOLEE terminé', {
      candidat_id,
      mode:                      runMode,
      phase1_attributions_totales: attributionResult.stats.nb_attributions_totales,
      phase1_ad_hoc_nouveaux:      attributionResult.stats.nb_ad_hoc_nouveaux_crees,
      totalCostUsd:               attributionResult.cost.toFixed(4),
      totalElapsedSec:            (totalElapsedMs / 1000).toFixed(1),
      nextStatus:                 STATUT_FIN_PHASE1_ISOLEE
    });

    return {
      success:       true,
      candidat_id,
      pipeline:      'etape2_circuits_v10_8',
      mode:          runMode,
      phase1: {
        attributions_totales:  attributionResult.stats.nb_attributions_totales,
        ad_hoc_nouveaux_crees: attributionResult.stats.nb_ad_hoc_nouveaux_crees,
        stats:                 attributionResult.stats,
        cost_usd:              attributionResult.cost,
        elapsedMs:             attributionResult.elapsedMs
      },
      phase2:        null,
      totalCostUsd:  attributionResult.cost,
      totalElapsedMs,
      nextStatus:    STATUT_FIN_PHASE1_ISOLEE
    };
  }

  // ═════════════════════════════════════════════════════════════════════════
  // PHASE 2 — CONSOLIDATION (sauf en modes PHASE1_ISOLEE et PHASE3_ISOLEE)
  // ═════════════════════════════════════════════════════════════════════════
  // En mode PHASE2_ISOLEE, on vérifie d'abord que types_verbatim_circuits est rempli
  if (runMode === MODE_COMPLET || runMode === MODE_PHASE2_ISOLEE) {
    if (runMode === MODE_PHASE2_ISOLEE) {
      logger.info('─── Mode PHASE2_ISOLEE : vérification pré-requis ───', { candidat_id });
      try {
        const lignesT1 = await airtableService.getEtape1T1(candidat_id);
        const lignesVides = (lignesT1 || []).filter(t1 => {
          const tvc = t1.types_verbatim_circuits;
          return !tvc || typeof tvc !== 'string' || tvc.trim().length === 0;
        });
        if (lignesVides.length > 0) {
          throw new Error(
            `Mode PHASE2_ISOLEE impossible : ${lignesVides.length}/${lignesT1.length} lignes ETAPE1_T1 ` +
            `n'ont pas types_verbatim_circuits rempli. Lance d'abord REPRENDRE_AGENT2_PHASE1 ou REPRENDRE_AGENT2.`
          );
        }
      } catch (err) {
        logger.error('Pipeline Étape 2 — pré-requis PHASE2_ISOLEE non rempli', {
          candidat_id, error: err.message
        });

        try {
          await airtableService.updateVisiteur(candidat_id, {
            statut_analyse_pivar: 'ERREUR',
            erreur_analyse:       `[etape2_phase2_prereq] ${err.message}`.substring(0, 500),
            derniere_activite:    new Date().toISOString()
          });
        } catch (e) { /* fallback */ }

        throw err;
      }
    }

    logger.info('─── PHASE 2 — CONSOLIDATION (mécanique, 0 appel Claude) ───', { candidat_id, mode: runMode });

    try {
      consolidationResult = await agentT2_phase2_consolidation_Service.runConsolidation({
        candidat_id,
        session_id: session_id || candidat_id
      });
    } catch (err) {
      logger.error('Pipeline Étape 2 — PHASE 2 (consolidation) failed', {
        candidat_id,
        mode:           runMode,
        error:          err.message,
        stack:          err.stack?.substring(0, 500),
        phase1_status:  runMode === MODE_COMPLET ? 'OK (types_verbatim_circuits rempli)'
                                                  : 'PHASE2_ISOLEE (types_verbatim_circuits supposé déjà rempli)',
        rejouable:      'OUI — relancer la consolidation seule via REPRENDRE_AGENT2_PHASE2 (coût zéro)'
      });

      try {
        await backupService.save(candidat_id, 'error_etape2_phase2', {
          phase:          'consolidation',
          mode:           runMode,
          error:          err.message,
          step:           identifyFailedStep(err, 'phase2'),
          phase1_stats:   attributionResult?.stats || null,
          rejouable_seul: true
        });
      } catch (e) { /* backup non bloquant */ }

      // ⚠️ STATUT INTERMÉDIAIRE : ETAPE2_PHASE1_TERMINEE si on était en COMPLET
      // (Phase 1 OK, Phase 2 KO → on signale que Phase 1 est rejouable seul)
      // En mode PHASE2_ISOLEE : ERREUR direct (Phase 1 n'a pas été lancée)
      const statutErreur = (runMode === MODE_COMPLET) ? STATUT_FIN_PHASE1_ISOLEE : 'ERREUR';
      try {
        await airtableService.updateVisiteur(candidat_id, {
          statut_analyse_pivar: statutErreur,
          erreur_analyse:       `[etape2_phase2] ${err.message}`.substring(0, 500),
          derniere_activite:    new Date().toISOString()
        });
        logger.warn(`orchestratorEtape2 — Phase 2 KO, statut posé → ${statutErreur}`, { candidat_id });
      } catch (e) { /* fallback */ }

      throw err;
    }

    logger.info('PHASE 2 — Consolidation terminée', {
      candidat_id,
      nb_rows_ecrites:      consolidationResult.stats.nb_rows_ecrites,
      nb_piliers_actifs:    consolidationResult.stats.nb_piliers_actifs,
      nb_circuits_haut:     consolidationResult.stats.nb_circuits_haut,
      nb_circuits_moyen:    consolidationResult.stats.nb_circuits_moyen,
      nb_clusters_detectes: consolidationResult.stats.nb_clusters_detectes,
      elapsed_ms:           consolidationResult.stats.elapsed_total_ms
    });
  }  // fin du bloc Phase 2 (if MODE_COMPLET || MODE_PHASE2_ISOLEE)

  // ═════════════════════════════════════════════════════════════════════════
  // ⭐ v10.9 — PHASE 3 — ENRICHISSEMENT (Algorithme A v1.1)
  //
  // Mécanique, 0 appel Claude. 3 sous-étapes :
  //   3A : enrichit ETAPE1_T1 avec 14 champs
  //   3B : écrit ETAPE1_T2_VENTILATION_PILIERS
  //   3C : écrit ETAPE1_T2_INVENTAIRE_CIRCUITS
  //
  // Données utilisées par /visualiser/tableau2piliers et /visualiser/tableau2circuits.
  //
  // S'exécute en modes COMPLET, PHASE2_ISOLEE et PHASE3_ISOLEE
  // (pas en PHASE1_ISOLEE car celle-ci s'arrête via early return plus haut).
  //
  // Kill-switch : si PHASE3_PRETE = false, Phase 3 est ignorée.
  //   - En mode COMPLET / PHASE2_ISOLEE : log warning, on continue sans Phase 3
  //     (comportement v10.8 préservé)
  //   - En mode PHASE3_ISOLEE : on rejette le statut avec ERREUR
  // ═════════════════════════════════════════════════════════════════════════

  if (!PHASE3_PRETE) {
    if (runMode === MODE_PHASE3_ISOLEE) {
      // En PHASE3_ISOLEE avec drapeau OFF : statut ERREUR explicite
      const errMsg = 'Phase 3 désactivée (PHASE3_PRETE = false). Statut REPRENDRE_AGENT2_PHASE3 ne peut pas être traité.';
      logger.error('Pipeline Étape 2 — PHASE 3 désactivée', { candidat_id, mode: runMode });
      try {
        await airtableService.updateVisiteur(candidat_id, {
          statut_analyse_pivar: 'ERREUR',
          erreur_analyse:       `[etape2_phase3_disabled] ${errMsg}`.substring(0, 500),
          derniere_activite:    new Date().toISOString()
        });
      } catch (e) { /* fallback */ }
      throw new Error(errMsg);
    }
    // En COMPLET / PHASE2_ISOLEE : on saute Phase 3 silencieusement (warning + continue)
    logger.warn('⏸️ Phase 3 désactivée (PHASE3_PRETE = false) — saut de l\'enrichissement', { candidat_id, mode: runMode });
  } else if (runMode === MODE_COMPLET || runMode === MODE_PHASE2_ISOLEE || runMode === MODE_PHASE3_ISOLEE) {
    // ─── Pré-requis Phase 3 en mode PHASE3_ISOLEE ─────────────────────────
    if (runMode === MODE_PHASE3_ISOLEE) {
      logger.info('─── Mode PHASE3_ISOLEE : vérification pré-requis ───', { candidat_id });
      try {
        const lignesT1 = await airtableService.getEtape1T1(candidat_id);
        const lignesVides = (lignesT1 || []).filter(t1 => {
          const tvc = t1.types_verbatim_circuits;
          return !tvc || typeof tvc !== 'string' || tvc.trim().length === 0;
        });
        if (lignesVides.length > 0) {
          throw new Error(
            `Mode PHASE3_ISOLEE impossible : ${lignesVides.length}/${lignesT1.length} lignes ETAPE1_T1 ` +
            `n'ont pas types_verbatim_circuits rempli. Lance d'abord REPRENDRE_AGENT2_PHASE1 ou REPRENDRE_AGENT2.`
          );
        }
      } catch (err) {
        logger.error('Pipeline Étape 2 — pré-requis PHASE3_ISOLEE non rempli', {
          candidat_id, error: err.message
        });
        try {
          await airtableService.updateVisiteur(candidat_id, {
            statut_analyse_pivar: 'ERREUR',
            erreur_analyse:       `[etape2_phase3_prereq] ${err.message}`.substring(0, 500),
            derniere_activite:    new Date().toISOString()
          });
        } catch (e) { /* fallback */ }
        throw err;
      }
    }

    logger.info('─── PHASE 3 — ENRICHISSEMENT (mécanique, 0 appel Claude) ───', { candidat_id, mode: runMode });

    try {
      enrichissementResult = await agentT2_phase3_enrichissement_Service.runEnrichissement({
        candidat_id,
        session_id: session_id || candidat_id
      });
    } catch (err) {
      logger.error('Pipeline Étape 2 — PHASE 3 (enrichissement) failed', {
        candidat_id,
        mode:      runMode,
        error:     err.message,
        stack:     err.stack?.substring(0, 500),
        rejouable: 'OUI — relancer Phase 3 seule via REPRENDRE_AGENT2_PHASE3 (coût zéro, idempotent)'
      });

      try {
        await backupService.save(candidat_id, 'error_etape2_phase3', {
          phase:          'enrichissement',
          mode:           runMode,
          error:          err.message,
          step:           identifyFailedStep(err, 'phase3'),
          phase1_stats:   attributionResult?.stats   || null,
          phase2_stats:   consolidationResult?.stats || null,
          rejouable_seul: true
        });
      } catch (e) { /* backup non bloquant */ }

      // ⚠️ STATUT INTERMÉDIAIRE :
      //   - Mode COMPLET ou PHASE2_ISOLEE : Phase 1+2 OK → ETAPE2_PHASE2_TERMINEE
      //     (signale qu'on peut rejouer Phase 3 seule sans toucher à ETAPE1_T2)
      //   - Mode PHASE3_ISOLEE : ERREUR direct (rien à préserver)
      const statutErreur = (runMode === MODE_PHASE3_ISOLEE) ? 'ERREUR' : STATUT_SENTINELLE_PHASE3_KO;
      try {
        await airtableService.updateVisiteur(candidat_id, {
          statut_analyse_pivar: statutErreur,
          erreur_analyse:       `[etape2_phase3] ${err.message}`.substring(0, 500),
          derniere_activite:    new Date().toISOString()
        });
        logger.warn(`orchestratorEtape2 — Phase 3 KO, statut posé → ${statutErreur}`, { candidat_id });
      } catch (e) { /* fallback */ }

      throw err;
    }

    logger.info('PHASE 3 — Enrichissement terminé', {
      candidat_id,
      nb_lignes_t1_enrichies:  enrichissementResult.nb_lignes_t1_enrichies,
      nb_lignes_ventilation:   enrichissementResult.nb_lignes_ventilation,
      nb_lignes_inventaire:    enrichissementResult.nb_lignes_inventaire,
      nb_attributions_totales: enrichissementResult.stats.nb_attributions_totales,
      nb_piliers_actifs:       enrichissementResult.stats.nb_piliers_actifs,
      nb_circuits_distincts:   enrichissementResult.stats.nb_circuits_distincts,
      nb_ad_hoc:               enrichissementResult.stats.nb_ad_hoc,
      elapsed_ms:              enrichissementResult.stats.elapsed_total_ms
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SUITES POST-PHASES
  // ═════════════════════════════════════════════════════════════════════════

  // ─── 3. Backup après étape 2 ────────────────────────────────────────────
  try {
    await backupService.save(candidat_id, 'after_etape2', {
      version:                  'v10.9',
      mode:                     runMode,
      phase1_stats:             attributionResult?.stats    || null,
      phase2_stats:             consolidationResult?.stats  || null,
      phase3_stats:             enrichissementResult?.stats || null,  // ⭐ v10.9
      rows_count_etape1_t2:     consolidationResult?.rows?.length || 0,
      rows_count_ventilation:   enrichissementResult?.nb_lignes_ventilation || 0,  // ⭐ v10.9
      rows_count_inventaire:    enrichissementResult?.nb_lignes_inventaire  || 0,  // ⭐ v10.9
      ad_hoc_nouveaux_crees:    attributionResult?.stats?.nb_ad_hoc_nouveaux_crees || 0,
      attributions_totales:     attributionResult?.stats?.nb_attributions_totales || 0
    });
  } catch (e) {
    logger.warn('orchestratorEtape2 — échec backup after_etape2 (non bloquant)', {
      candidat_id, error: e.message
    });
  }

  // ─── 4. Bascule statut vers la suite ────────────────────────────────────
  // ⭐ v10.9 — Mode PHASE3_ISOLEE → STATUT_FIN_PHASE3_ISOLEE
  let statutSortie;
  if (runMode === MODE_PHASE2_ISOLEE)      statutSortie = STATUT_FIN_PHASE2_ISOLEE;
  else if (runMode === MODE_PHASE3_ISOLEE) statutSortie = STATUT_FIN_PHASE3_ISOLEE;
  else                                     statutSortie = STATUT_FIN_COMPLET;

  try {
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: statutSortie,
      derniere_activite:    new Date().toISOString(),
      erreur_analyse:       ''
    });
    logger.info(`orchestratorEtape2 — bascule statut → ${statutSortie}`, { candidat_id, mode: runMode });
  } catch (e) {
    logger.error('orchestratorEtape2 — échec bascule statut', {
      candidat_id, bascule_cible: statutSortie, error: e.message
    });
    throw new Error(
      `Pipeline Étape 2 a réussi mais la bascule du statut vers ${statutSortie} a échoué : ${e.message}`
    );
  }

  // ─── 5. Reset tentatives ────────────────────────────────────────────────
  try {
    await airtableService.resetTentativesEtape1(candidat_id);
  } catch (e) {
    logger.warn('orchestratorEtape2 — échec reset tentatives (non bloquant)', {
      candidat_id, error: e.message
    });
  }

  // ─── 6. Synthèse finale ─────────────────────────────────────────────────
  const totalElapsedMs = Date.now() - startTime;
  const totalCostUsd   = attributionResult?.cost || 0;

  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
  logger.info(`🎉 Pipeline Étape 2 (v10.9 / mode ${runMode}) terminé`, {
    candidat_id,
    mode:                          runMode,
    phase1_attributions_totales:  attributionResult?.stats?.nb_attributions_totales  || 0,
    phase1_franches:              attributionResult?.stats?.nb_attributions_franches || 0,
    phase1_nuancees:              attributionResult?.stats?.nb_attributions_nuancees || 0,
    phase1_ad_hoc:                attributionResult?.stats?.nb_attributions_ad_hoc   || 0,
    phase1_ad_hoc_nouveaux_crees: attributionResult?.stats?.nb_ad_hoc_nouveaux_crees || 0,
    phase1_promotions_auto:       attributionResult?.stats?.nb_promotions_auto       || 0,
    phase1_flags_arbitrage:       attributionResult?.stats?.nb_flags_arbitrage       || 0,
    phase2_rows_etape1_t2:        consolidationResult?.stats?.nb_rows_ecrites    || 0,
    phase2_circuits_haut:         consolidationResult?.stats?.nb_circuits_haut   || 0,
    phase2_circuits_moyen:        consolidationResult?.stats?.nb_circuits_moyen  || 0,
    phase2_clusters_detectes:     consolidationResult?.stats?.nb_clusters_detectes || 0,
    phase3_t1_enrichies:          enrichissementResult?.nb_lignes_t1_enrichies || 0,  // ⭐ v10.9
    phase3_ventilation_lignes:    enrichissementResult?.nb_lignes_ventilation  || 0,  // ⭐ v10.9
    phase3_inventaire_lignes:     enrichissementResult?.nb_lignes_inventaire   || 0,  // ⭐ v10.9
    phase3_piliers_actifs:        enrichissementResult?.stats?.nb_piliers_actifs     || 0,  // ⭐ v10.9
    phase3_circuits_distincts:    enrichissementResult?.stats?.nb_circuits_distincts || 0,  // ⭐ v10.9
    phase3_ad_hoc:                enrichissementResult?.stats?.nb_ad_hoc             || 0,  // ⭐ v10.9
    totalCostUsd:                 totalCostUsd.toFixed(4),
    totalElapsedMs,
    totalElapsedSec:              (totalElapsedMs / 1000).toFixed(1),
    nextStatus:                   statutSortie
  });
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

  return {
    success:    true,
    candidat_id,
    pipeline:   'etape2_circuits_v10_9',
    mode:       runMode,
    phase1: attributionResult ? {
      attributions_totales:     attributionResult.stats.nb_attributions_totales,
      ad_hoc_nouveaux_crees:    attributionResult.stats.nb_ad_hoc_nouveaux_crees,
      stats:                    attributionResult.stats,
      cost_usd:                 attributionResult.cost,
      elapsedMs:                attributionResult.elapsedMs
    } : null,
    phase2: consolidationResult ? {
      rows_ecrites:             consolidationResult.rows.length,
      stats:                    consolidationResult.stats,
      elapsedMs:                consolidationResult.elapsedMs
    } : null,
    phase3: enrichissementResult ? {                                              // ⭐ v10.9
      lignes_t1_enrichies:      enrichissementResult.nb_lignes_t1_enrichies,
      lignes_ventilation:       enrichissementResult.nb_lignes_ventilation,
      lignes_inventaire:        enrichissementResult.nb_lignes_inventaire,
      stats:                    enrichissementResult.stats,
      elapsedMs:                enrichissementResult.elapsedMs
    } : null,
    totalCostUsd,
    totalElapsedMs,
    nextStatus:                 statutSortie
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function identifyFailedStep(error, phase = 'unknown') {
  const msg = (error?.message || '').toLowerCase();

  if (phase === 'phase1') {
    if (msg.includes('etape1_t1') || msg.includes('lignes etape1_t1')) return 'phase1_lecture_etape1_t1';
    if (msg.includes('responses'))                                      return 'phase1_lecture_responses';
    if (msg.includes('referentiel_circuits'))                           return 'phase1_lecture_referentiel';
    if (msg.includes('json invalide') || msg.includes('parse'))         return 'phase1_parse_json_claude';
    if (msg.includes('exhaustivité') || msg.includes('attribution'))    return 'phase1_validation_doctrinale';
    if (msg.includes('claude') || msg.includes('agent attribution'))    return 'phase1_appel_claude';
    if (msg.includes('types_verbatim_circuits'))                        return 'phase1_ecriture_t1';
    if (msg.includes('ad hoc'))                                         return 'phase1_creation_ad_hoc';
    return 'phase1_inconnu';
  }

  if (phase === 'phase2') {
    if (msg.includes('phase2_isolee impossible'))                       return 'phase2_prereq_non_rempli';
    if (msg.includes('etape1_t1'))                                      return 'phase2_lecture_t1';
    if (msg.includes('types_verbatim_circuits'))                        return 'phase2_parsing_attributions';
    if (msg.includes('writeetape1t2') || msg.includes('etape1_t2'))     return 'phase2_ecriture_etape1_t2';
    if (msg.includes('cluster'))                                        return 'phase2_detection_clusters';
    if (msg.includes('candidature'))                                    return 'phase2_calcul_candidatures';
    return 'phase2_inconnu';
  }

  // ⭐ v10.9 — Phase 3 enrichissement (3A + 3B + 3C)
  if (phase === 'phase3') {
    if (msg.includes('phase3_isolee impossible'))                       return 'phase3_prereq_non_rempli';
    if (msg.includes('aucune ligne etape1_t1'))                         return 'phase3_lecture_t1';
    if (msg.includes('aucune ligne à enrichir'))                        return 'phase3_pilier_coeur_manquant';
    if (msg.includes('patchetape1t1rows'))                              return 'phase3a_ecriture_t1';
    if (msg.includes('ventilation_piliers'))                            return 'phase3b_ecriture_ventilation';
    if (msg.includes('inventaire_circuits'))                            return 'phase3c_ecriture_inventaire';
    if (msg.includes('referentiel_piliers'))                            return 'phase3_lecture_referentiel_piliers';
    return 'phase3_inconnu';
  }

  return 'inconnu';
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  run,

  // Constantes exposées pour les tests et orchestratorPrincipal
  ETAPE3_PRETE,
  PHASE3_PRETE,                       // ⭐ v10.9
  STATUT_FIN_COMPLET,
  STATUT_FIN_PHASE1_ISOLEE,
  STATUT_FIN_PHASE2_ISOLEE,
  STATUT_FIN_PHASE3_ISOLEE,           // ⭐ v10.9
  STATUT_SENTINELLE_PHASE3_KO,        // ⭐ v10.9
  MODE_COMPLET,
  MODE_PHASE1_ISOLEE,
  MODE_PHASE2_ISOLEE,
  MODE_PHASE3_ISOLEE,                 // ⭐ v10.9
  STATUT_TO_MODE,

  _internal: {
    identifyFailedStep
  }
};
