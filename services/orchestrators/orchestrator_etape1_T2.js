// services/orchestrators/orchestrator_etape1_T2.js
// Sous-Orchestrateur Étape 2 — Cartographie des circuits cognitifs
// Profil-Cognitif v10.12 (Phase 4b rôles de piliers enchaînée — 24/06/2026)
//
// ⚠️ AVANT MODIFICATION : lire docs/PLAN_CORRECTION_v10_8.md
//                       et docs/memo_technique_phase3.md (22/05/2026)
//
// ───────────────────────────────────────────────────────────────────────────
// ⭐ v10.12 (24/06/2026) — PHASE 4b : ATTRIBUTION DES RÔLES DE PILIERS
// ───────────────────────────────────────────────────────────────────────────
//
//   Après chaque gravure de ETAPE1_T2_CIRCUITS_POURBILAN (Phase 4), on enchaîne
//   l'agent d'attribution des rôles (socle / amont / aval / fonctionnel). Il LIT
//   la table figée fraîchement gravée, fait la lecture de laboratoire (socle par
//   la colonne instrumentale, structurant/fonctionnel par la nature des circuits,
//   amont/aval par la boucle cognitive), et MET À JOUR le seul champ role_pilier
//   sur les lignes POURBILAN — sans toucher aux chiffres.
//
//   Cela REMPLACE l'ancien RANG_TO_ROLE de la Phase 4 (rôle déduit du rang de
//   fréquence, faux dès qu'un pilier d'exécution gouverne en nombre sans être le
//   socle — cas Rémi). La Phase 4 continue de poser un rôle provisoire ; l'agent
//   l'écrase par le bon. 1 appel Claude.
//
//   BRANCHÉ AUX DEUX ENDROITS où la Phase 4 grave :
//     - mode PHASE4_ISOLEE (statut REPRENDRE_AGENT2_CIRCUITPOURBILAN)
//     - mode COMPLET (Phase 4 enchaînée, v10.11)
//
//   GARDE-FOU : l'échec de l'agent rôles NE fait PAS échouer la mission. POURBILAN
//   est déjà gravée avec des chiffres justes ; seul le rôle resterait provisoire.
//   On log un avertissement (le rôle est rejouable via REPRENDRE_AGENT2_CIRCUITPOURBILAN),
//   plutôt que de casser une étape 1.2 par ailleurs valide. Kill-switch PHASE4B_PRETE.
//
// ───────────────────────────────────────────────────────────────────────────
// ⭐ v10.11 (18/06/2026) — PHASE 4 ENCHAÎNÉE EN MODE COMPLET
// ───────────────────────────────────────────────────────────────────────────
//
//   En production le pipeline est autogéré : personne ne pose les statuts à la
//   main. La Phase 4 (gravure ETAPE1_T2_CIRCUITS_POURBILAN) doit donc s'enchaîner
//   automatiquement à la fin du mode COMPLET, après la Phase 3, avant la bascule
//   de statut finale. Un candidat traité de bout en bout a ainsi sa table
//   pour-bilan prête pour l'agent PA pilier, sans intervention.
//
//   GARDE-FOUS :
//   - Le kill-switch PHASE4_PRETE reste le maître interrupteur : si false, la
//     Phase 4 est sautée en mode COMPLET (le pipeline finit quand même proprement)
//     et le statut isolé REPRENDRE_AGENT2_CIRCUITPOURBILAN est rejeté.
//   - Avant de graver, on vérifie que l'inventaire ETAPE1_T2_INVENTAIRE_CIRCUITS
//     n'est pas vide. S'il l'est (Phase 3 partielle), on NE grave PAS une table
//     vide : on pose la sentinelle pour rejouer, sans casser les données métier.
//   - Le mode PHASE4_ISOLEE (déclenchement manuel) reste intact pour rejouer la
//     Phase 4 seule sur un candidat déjà traité.
//
// ───────────────────────────────────────────────────────────────────────────
// ⭐ v10.10 (18/06/2026) — MISSION DE FIN D'ÉTAPE 1.2 (Phase 4)
// ───────────────────────────────────────────────────────────────────────────
//
//   Ajout d'un 4e mode ISOLÉ : PHASE4_ISOLEE, déclenché par le statut
//   REPRENDRE_AGENT2_CIRCUITPOURBILAN. Mécanique, 0 appel Claude.
//
//   La Phase 4 grave la table ETAPE1_T2_CIRCUITS_POURBILAN : projection figée
//   de l'inventaire (niveaux cœur + amplitude, bloc, additions, noms en clair)
//   prête à lire pour l'agent PA pilier de l'étape 1.3. Elle NE recalcule aucun
//   chiffre source : elle lit ETAPE1_T2_INVENTAIRE_CIRCUITS ligne à ligne.
//
//   FIN DE MISSION : bascule statut → ETAPE2_TERMINEE (l'étape 1.2 est finie,
//   l'inventaire pour bilan est gravé, l'étape 1.3 peut démarrer).
//
//   Kill-switch PHASE4_PRETE : si false, le statut REPRENDRE_AGENT2_CIRCUITPOURBILAN
//   est rejeté avec ERREUR explicite (aucune autre phase n'est affectée).
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
//     ├─ Phase 3 : agentT2_phase3_enrichissement_Service (0 appel Claude, mécanique) ⭐ v10.9
//     │  ├─ 3A : enrichit ETAPE1_T1 avec 14 champs (Algorithme A v1.1)
//     │  ├─ 3B : écrit ETAPE1_T2_VENTILATION_PILIERS (1-5 lignes/candidat)
//     │  └─ 3C : écrit ETAPE1_T2_INVENTAIRE_CIRCUITS (~30-60 lignes/candidat)
//     │     → Données lues par les routes /visualiser/tableau2piliers
//     │       et /visualiser/tableau2circuits (visualisation HTML dynamique)
//     ├─ Phase 4 : service_etape1_T2_phase4_circuits_pourbilan (0 appel Claude) ⭐ v10.10
//     │  └─ Grave ETAPE1_T2_CIRCUITS_POURBILAN (mission de fin d'étape 1.2)
//     │  └─ ⭐ v10.11 : enchaînée automatiquement en mode COMPLET
//     └─ Phase 4b : agent_etape1_T2_phase4b_roles_piliers (1 appel Claude) ⭐ v10.12
//        └─ Met à jour role_pilier sur POURBILAN (socle/amont/aval/fonctionnel)
//   étape 3   (synthèse 6 sous-agents)  ← orchestratorEtape3 (à coder)
//
// ───────────────────────────────────────────────────────────────────────────
// 5 MODES DE RUN (sélectionnés par le statut entrant)
// ───────────────────────────────────────────────────────────────────────────
//
//   ┌──────────────────────────────────────┬──────────────────────────────────────┐
//   │ Statut entrant                       │ Mode interne / Comportement          │
//   ├──────────────────────────────────────┼──────────────────────────────────────┤
//   │ REPRENDRE_AGENT2                     │ COMPLET : Phase 1+2+3+4+4b ⭐v10.12   │
//   │ REPRENDRE_AGENT2_PHASE1             │ PHASE1_ISOLEE : Phase 1 seule        │
//   │ REPRENDRE_AGENT2_PHASE2             │ PHASE2_ISOLEE : Phase 2 + 3          │
//   │ REPRENDRE_AGENT2_PHASE3             │ PHASE3_ISOLEE : Phase 3 seule        │
//   │ REPRENDRE_AGENT2_CIRCUITPOURBILAN ⭐ │ PHASE4_ISOLEE : Phase 4 + 4b         │
//   │                                      │ → ETAPE2_TERMINEE                    │
//   └──────────────────────────────────────┴──────────────────────────────────────┘

'use strict';

const airtableService                       = require('../infrastructure/airtableService');
const agentT2_phase1_attribution_Service    = require('../etape1/agent_etape1_T2_phase1_attribution');
const agentT2_phase2_consolidation_Service  = require('../etape1/agent_etape1_T2_phase2_consolidation');
const agentT2_phase3_enrichissement_Service = require('../etape1/agent_etape1_T2_phase3_enrichissement');  // ⭐ v10.9
const phase4_circuits_pourbilan_Service     = require('../etape1/service_etape1_T2_phase4_circuits_pourbilan');  // ⭐ v10.10
const phase4b_roles_piliers_Service         = require('../etape1/agent_etape1_T2_phase4b_roles_piliers');  // ⭐ v10.12
const backupService                         = require('../infrastructure/backupService');
const logger                                = require('../../utils/logger');

// ─── Drapeau de réactivation de l'étape 3 ─────────────────────────────────
const ETAPE3_PRETE = false;

// ⭐ v10.9 — Drapeau d'activation de la Phase 3 (Algorithme A v1.1)
const PHASE3_PRETE = true;

// ⭐ v10.10 — Drapeau d'activation de la Phase 4 (mission de fin d'étape 1.2)
// Si false : le statut REPRENDRE_AGENT2_CIRCUITPOURBILAN est rejeté avec ERREUR,
//            et la Phase 4 enchaînée en mode COMPLET (v10.11) est sautée.
//            Aucune autre phase n'est affectée.
const PHASE4_PRETE = true;

// ⭐ v10.12 — Drapeau d'activation de la Phase 4b (rôles de piliers).
// Si false : on saute l'agent rôles (POURBILAN garde le rôle provisoire de la
//            Phase 4). Aucune autre phase n'est affectée.
const PHASE4B_PRETE = true;

// Statuts de sortie selon le mode
const STATUT_FIN_COMPLET           = ETAPE3_PRETE ? 'REPRENDRE_AGENT3' : 'ETAPE2_TERMINEE';
const STATUT_FIN_PHASE1_ISOLEE     = 'ETAPE2_PHASE1_TERMINEE';
const STATUT_FIN_PHASE2_ISOLEE     = ETAPE3_PRETE ? 'REPRENDRE_AGENT3' : 'ETAPE2_TERMINEE';
const STATUT_FIN_PHASE3_ISOLEE     = ETAPE3_PRETE ? 'REPRENDRE_AGENT3' : 'ETAPE2_TERMINEE';  // ⭐ v10.9
const STATUT_SENTINELLE_PHASE3_KO  = 'ETAPE2_PHASE2_TERMINEE';                                // ⭐ v10.9
const STATUT_FIN_PHASE4_ISOLEE     = 'ETAPE2_TERMINEE';                                       // ⭐ v10.10

// ⭐ v10.11 — Sentinelle si la Phase 4 enchaînée (mode COMPLET) échoue ou si
// l'inventaire est vide : on conserve les données métier (Phases 1-3 OK) et on
// permet de rejouer la Phase 4 seule via REPRENDRE_AGENT2_CIRCUITPOURBILAN.
const STATUT_SENTINELLE_PHASE4_KO  = 'ETAPE2_PHASE4_A_REJOUER';

// Modes de run
const MODE_COMPLET        = 'COMPLET';
const MODE_PHASE1_ISOLEE  = 'PHASE1_ISOLEE';
const MODE_PHASE2_ISOLEE  = 'PHASE2_ISOLEE';
const MODE_PHASE3_ISOLEE  = 'PHASE3_ISOLEE';  // ⭐ v10.9
const MODE_PHASE4_ISOLEE  = 'PHASE4_ISOLEE';  // ⭐ v10.10
const VALID_MODES         = [MODE_COMPLET, MODE_PHASE1_ISOLEE, MODE_PHASE2_ISOLEE, MODE_PHASE3_ISOLEE, MODE_PHASE4_ISOLEE];

// Statuts d'entrée → mode
const STATUT_TO_MODE = {
  'REPRENDRE_AGENT2':                  MODE_COMPLET,
  'REPRENDRE_AGENT2_PHASE1':           MODE_PHASE1_ISOLEE,
  'REPRENDRE_AGENT2_PHASE2':           MODE_PHASE2_ISOLEE,
  'REPRENDRE_AGENT2_PHASE3':           MODE_PHASE3_ISOLEE,   // ⭐ v10.9
  'REPRENDRE_AGENT2_CIRCUITPOURBILAN': MODE_PHASE4_ISOLEE    // ⭐ v10.10
};

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v10.12 — HELPER : ENCHAÎNEMENT DE L'AGENT RÔLES APRÈS LA PHASE 4
//
// Appelé après chaque gravure réussie de POURBILAN (mode isolé + mode COMPLET).
// NE jette JAMAIS : l'échec de l'agent rôles laisse POURBILAN avec un rôle
// provisoire (chiffres justes), il est rejouable via REPRENDRE_AGENT2_CIRCUITPOURBILAN.
// Retourne { roles, socle } en cas de succès, ou null sinon.
// ═══════════════════════════════════════════════════════════════════════════
async function _enchainerRolesPiliers(candidat_id) {
  if (!PHASE4B_PRETE) {
    logger.warn('⏸️ Phase 4b désactivée (PHASE4B_PRETE = false) — POURBILAN garde le rôle provisoire', { candidat_id });
    return null;
  }

  logger.info('─── PHASE 4b — RÔLES DE PILIERS (1 appel Claude) ───', { candidat_id });

  try {
    const r = await phase4b_roles_piliers_Service.runRolesPiliers({ candidat_id });
    logger.info('PHASE 4b — Rôles de piliers attribués', {
      candidat_id,
      socle:              r?.socle,
      roles:              r?.roles,
      nb_lignes_patchees: r?.stats?.nb_lignes_patchees || 0
    });
    return r;
  } catch (err) {
    // Non bloquant : POURBILAN est gravée avec des chiffres justes ; seul le rôle
    // reste provisoire. On log et on continue — rejouable via le statut Phase 4.
    logger.warn('PHASE 4b — agent rôles KO (NON bloquant, POURBILAN garde le rôle provisoire)', {
      candidat_id,
      error:     err.message,
      rejouable: 'OUI — relancer REPRENDRE_AGENT2_CIRCUITPOURBILAN (re-grave + recalcule les rôles)'
    });
    try {
      await backupService.save(candidat_id, 'error_etape2_phase4b_roles', {
        phase: 'roles_piliers',
        error: err.message
      });
    } catch (e) { /* backup non bloquant */ }
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════

async function run({ candidat_id, visiteur = null, session_id = null, mode = null }) {
  const startTime = Date.now();

  // ─── Déterminer le mode de run ──────────────────────────────────────────
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
  logger.info('Pipeline Étape 2 (v10.12) starting', {
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
      version:        'v10.12'
    });
  } catch (e) {
    logger.warn('orchestratorEtape2 — échec backup before_etape2 (non bloquant)', {
      candidat_id, error: e.message
    });
  }

  // ═════════════════════════════════════════════════════════════════════════
  // ⭐ v10.10 — MODE PHASE4_ISOLEE : MISSION DE FIN D'ÉTAPE 1.2
  //
  // Traité en tête, isolé du reste : ce mode n'exécute que la Phase 4 (+ 4b) puis
  // bascule en ETAPE2_TERMINEE. Aucune autre phase n'est touchée.
  // ═════════════════════════════════════════════════════════════════════════
  if (runMode === MODE_PHASE4_ISOLEE) {
    if (!PHASE4_PRETE) {
      const errMsg = 'Phase 4 désactivée (PHASE4_PRETE = false). Statut REPRENDRE_AGENT2_CIRCUITPOURBILAN ne peut pas être traité.';
      logger.error('Pipeline Étape 2 — PHASE 4 désactivée', { candidat_id });
      try {
        await airtableService.updateVisiteur(candidat_id, {
          statut_analyse_pivar: 'ERREUR',
          erreur_analyse:       `[etape2_phase4_disabled] ${errMsg}`.substring(0, 500),
          derniere_activite:    new Date().toISOString()
        });
      } catch (e) { /* fallback */ }
      throw new Error(errMsg);
    }

    logger.info('─── PHASE 4 — CIRCUITS_POURBILAN (mécanique, 0 appel Claude) ───', { candidat_id });

    let phase4Result;
    try {
      phase4Result = await phase4_circuits_pourbilan_Service.runPhase4({ candidat_id });
    } catch (err) {
      logger.error('Pipeline Étape 2 — PHASE 4 (circuits_pourbilan) failed', {
        candidat_id,
        error:     err.message,
        stack:     err.stack?.substring(0, 500),
        rejouable: 'OUI — relancer via REPRENDRE_AGENT2_CIRCUITPOURBILAN (coût zéro, idempotent)'
      });

      try {
        await backupService.save(candidat_id, 'error_etape2_phase4', {
          phase: 'circuits_pourbilan',
          mode:  runMode,
          error: err.message
        });
      } catch (e) { /* backup non bloquant */ }

      // Phase 4 ne touche pas aux données métier (ETAPE1_T2 reste valide).
      // On pose ERREUR : la mission est rejouable seule sans rien casser.
      try {
        await airtableService.updateVisiteur(candidat_id, {
          statut_analyse_pivar: 'ERREUR',
          erreur_analyse:       `[etape2_phase4] ${err.message}`.substring(0, 500),
          derniere_activite:    new Date().toISOString()
        });
      } catch (e) { /* fallback */ }

      throw err;
    }

    logger.info('PHASE 4 — Circuits_pourbilan terminée', {
      candidat_id,
      nb_lignes:   phase4Result?.nb_lignes   || 0,
      nb_circuits: phase4Result?.nb_circuits || 0
    });

    // ⭐ v10.12 — PHASE 4b : rôles de piliers (non bloquant) sur POURBILAN fraîche
    const roles4b = await _enchainerRolesPiliers(candidat_id);

    // Backup après Phase 4
    try {
      await backupService.save(candidat_id, 'after_etape2_phase4', {
        version:     'v10.12',
        mode:        runMode,
        nb_lignes:   phase4Result?.nb_lignes   || 0,
        nb_circuits: phase4Result?.nb_circuits || 0,
        roles_socle: roles4b?.socle || null
      });
    } catch (e) { /* non bloquant */ }

    // Bascule statut → ETAPE2_TERMINEE (étape 1.2 finie, inventaire bilan gravé)
    try {
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: STATUT_FIN_PHASE4_ISOLEE,
        derniere_activite:    new Date().toISOString(),
        erreur_analyse:       ''
      });
      logger.info(`orchestratorEtape2 — bascule statut → ${STATUT_FIN_PHASE4_ISOLEE}`, { candidat_id });
    } catch (e) {
      logger.error('orchestratorEtape2 — échec bascule statut (mode PHASE4_ISOLEE)', {
        candidat_id, error: e.message
      });
      throw new Error(
        `Phase 4 OK mais bascule statut → ${STATUT_FIN_PHASE4_ISOLEE} a échoué : ${e.message}`
      );
    }

    const totalElapsedMs = Date.now() - startTime;
    logger.info('🎉 Pipeline Étape 2 mode PHASE4_ISOLEE terminé', {
      candidat_id,
      mode:            runMode,
      nb_lignes:       phase4Result?.nb_lignes   || 0,
      nb_circuits:     phase4Result?.nb_circuits || 0,
      roles_socle:     roles4b?.socle || '(rôles non posés)',
      totalElapsedSec: (totalElapsedMs / 1000).toFixed(1),
      nextStatus:      STATUT_FIN_PHASE4_ISOLEE
    });

    return {
      success:       true,
      candidat_id,
      pipeline:      'etape2_circuits_v10_12',
      mode:          runMode,
      phase1:        null,
      phase2:        null,
      phase3:        null,
      phase4: {
        nb_lignes:   phase4Result?.nb_lignes   || 0,
        nb_circuits: phase4Result?.nb_circuits || 0
      },
      phase4b: roles4b ? { socle: roles4b.socle, roles: roles4b.roles } : null,
      totalCostUsd:  roles4b?.cost || 0,
      totalElapsedMs,
      nextStatus:    STATUT_FIN_PHASE4_ISOLEE
    };
  }

  // ─── Aiguillage selon le mode ───────────────────────────────────────────
  let attributionResult    = null;
  let consolidationResult  = null;
  let enrichissementResult = null;  // ⭐ v10.9 — Phase 3
  let phase4Result         = null;  // ⭐ v10.11 — Phase 4 enchaînée
  let roles4bResult        = null;  // ⭐ v10.12 — Phase 4b enchaînée

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

    try {
      await backupService.save(candidat_id, 'after_etape2_phase1_isolee', {
        version:                  'v10.8',
        mode:                     runMode,
        phase1_stats:             attributionResult.stats,
        ad_hoc_nouveaux_crees:    attributionResult.stats.nb_ad_hoc_nouveaux_crees,
        attributions_totales:     attributionResult.stats.nb_attributions_totales
      });
    } catch (e) { /* non bloquant */ }

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
  // ═════════════════════════════════════════════════════════════════════════

  if (!PHASE3_PRETE) {
    if (runMode === MODE_PHASE3_ISOLEE) {
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
    logger.warn('⏸️ Phase 3 désactivée (PHASE3_PRETE = false) — saut de l\'enrichissement', { candidat_id, mode: runMode });
  } else if (runMode === MODE_COMPLET || runMode === MODE_PHASE2_ISOLEE || runMode === MODE_PHASE3_ISOLEE) {
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
  // ⭐ v10.11 — PHASE 4 ENCHAÎNÉE (mode COMPLET uniquement)
  //
  // En production autogérée, la Phase 4 doit graver CIRCUITS_POURBILAN dans la
  // foulée de la Phase 3, sans intervention. On ne l'enchaîne QU'EN MODE COMPLET
  // (le seul mode "bout en bout" du pipeline normal). Les modes isolés PHASE2/
  // PHASE3 gardent leur comportement (ils ne touchent pas à la Phase 4 ; pour la
  // rejouer on utilise REPRENDRE_AGENT2_CIRCUITPOURBILAN).
  //
  // Garde-fous :
  //  - PHASE4_PRETE = false  → on saute proprement (pipeline finit quand même).
  //  - inventaire vide       → on NE grave PAS, on pose la sentinelle PHASE4_KO
  //                            (données métier intactes, Phase 4 rejouable seule).
  //  - exception runPhase4   → idem sentinelle, jamais ERREUR (Phases 1-3 valides).
  // ═════════════════════════════════════════════════════════════════════════
  if (runMode === MODE_COMPLET) {
    if (!PHASE4_PRETE) {
      logger.warn('⏸️ Phase 4 désactivée (PHASE4_PRETE = false) — saut de la gravure CIRCUITS_POURBILAN en mode COMPLET', { candidat_id });
    } else {
      logger.info('─── PHASE 4 — CIRCUITS_POURBILAN (enchaînée, mécanique, 0 appel Claude) ───', { candidat_id });

      // Garde-fou : ne pas graver une table vide si l'inventaire est absent.
      let inventaireOk = true;
      try {
        const inv = await airtableService.getEtape1T2InventaireCircuits(candidat_id);
        if (!Array.isArray(inv) || inv.length === 0) {
          inventaireOk = false;
          logger.warn('Phase 4 enchaînée — inventaire ETAPE1_T2_INVENTAIRE_CIRCUITS vide, gravure annulée', {
            candidat_id,
            nb_inventaire: Array.isArray(inv) ? inv.length : 0
          });
        }
      } catch (e) {
        // Si la lecture de contrôle échoue, on laisse runPhase4 décider/échouer proprement.
        logger.warn('Phase 4 enchaînée — contrôle inventaire non concluant (on tente quand même la gravure)', {
          candidat_id, error: e.message
        });
      }

      if (!inventaireOk) {
        // Données métier (Phases 1-3) intactes : on pose la sentinelle pour rejouer la Phase 4 seule.
        try {
          await airtableService.updateVisiteur(candidat_id, {
            statut_analyse_pivar: STATUT_SENTINELLE_PHASE4_KO,
            erreur_analyse:       '[etape2_phase4_chained] Inventaire vide : gravure CIRCUITS_POURBILAN annulée. Rejouer via REPRENDRE_AGENT2_CIRCUITPOURBILAN après vérification de la Phase 3.'.substring(0, 500),
            derniere_activite:    new Date().toISOString()
          });
          logger.warn(`orchestratorEtape2 — Phase 4 sautée (inventaire vide), statut posé → ${STATUT_SENTINELLE_PHASE4_KO}`, { candidat_id });
        } catch (e) { /* fallback */ }

        throw new Error(
          `Phase 4 (enchaînée) annulée : inventaire ETAPE1_T2_INVENTAIRE_CIRCUITS vide pour ${candidat_id}. ` +
          `Phases 1-3 OK. Rejouer la Phase 4 via REPRENDRE_AGENT2_CIRCUITPOURBILAN.`
        );
      }

      try {
        phase4Result = await phase4_circuits_pourbilan_Service.runPhase4({ candidat_id });
      } catch (err) {
        logger.error('Pipeline Étape 2 — PHASE 4 enchaînée (circuits_pourbilan) failed', {
          candidat_id,
          error:     err.message,
          stack:     err.stack?.substring(0, 500),
          rejouable: 'OUI — relancer via REPRENDRE_AGENT2_CIRCUITPOURBILAN (coût zéro, idempotent)'
        });

        try {
          await backupService.save(candidat_id, 'error_etape2_phase4_chained', {
            phase: 'circuits_pourbilan',
            mode:  runMode,
            error: err.message
          });
        } catch (e) { /* backup non bloquant */ }

        // Phase 4 ne touche pas aux données métier (Phases 1-3 valides).
        // On pose la sentinelle : la Phase 4 est rejouable seule sans rien casser.
        try {
          await airtableService.updateVisiteur(candidat_id, {
            statut_analyse_pivar: STATUT_SENTINELLE_PHASE4_KO,
            erreur_analyse:       `[etape2_phase4_chained] ${err.message}`.substring(0, 500),
            derniere_activite:    new Date().toISOString()
          });
          logger.warn(`orchestratorEtape2 — Phase 4 enchaînée KO, statut posé → ${STATUT_SENTINELLE_PHASE4_KO}`, { candidat_id });
        } catch (e) { /* fallback */ }

        throw err;
      }

      logger.info('PHASE 4 — Circuits_pourbilan terminée (enchaînée)', {
        candidat_id,
        nb_lignes:   phase4Result?.nb_lignes   || 0,
        nb_circuits: phase4Result?.nb_circuits || 0
      });

      // ⭐ v10.12 — PHASE 4b : rôles de piliers (non bloquant) sur POURBILAN fraîche
      roles4bResult = await _enchainerRolesPiliers(candidat_id);
    }
  }

  // ═════════════════════════════════════════════════════════════════════════
  // SUITES POST-PHASES
  // ═════════════════════════════════════════════════════════════════════════

  // ─── 3. Backup après étape 2 ────────────────────────────────────────────
  try {
    await backupService.save(candidat_id, 'after_etape2', {
      version:                  'v10.12',
      mode:                     runMode,
      phase1_stats:             attributionResult?.stats    || null,
      phase2_stats:             consolidationResult?.stats  || null,
      phase3_stats:             enrichissementResult?.stats || null,  // ⭐ v10.9
      phase4_nb_lignes:         phase4Result?.nb_lignes     || 0,     // ⭐ v10.11
      phase4_nb_circuits:       phase4Result?.nb_circuits   || 0,     // ⭐ v10.11
      phase4b_socle:            roles4bResult?.socle        || null,  // ⭐ v10.12
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
  const totalCostUsd   = (attributionResult?.cost || 0) + (roles4bResult?.cost || 0);

  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
  logger.info(`🎉 Pipeline Étape 2 (v10.12 / mode ${runMode}) terminé`, {
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
    phase4_nb_lignes:             phase4Result?.nb_lignes   || 0,  // ⭐ v10.11
    phase4_nb_circuits:           phase4Result?.nb_circuits || 0,  // ⭐ v10.11
    phase4b_socle:                roles4bResult?.socle || '(rôles non posés)',  // ⭐ v10.12
    totalCostUsd:                 totalCostUsd.toFixed(4),
    totalElapsedMs,
    totalElapsedSec:              (totalElapsedMs / 1000).toFixed(1),
    nextStatus:                   statutSortie
  });
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

  return {
    success:    true,
    candidat_id,
    pipeline:   'etape2_circuits_v10_12',
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
    phase4: phase4Result ? {                                                      // ⭐ v10.11
      nb_lignes:                phase4Result.nb_lignes,
      nb_circuits:              phase4Result.nb_circuits
    } : null,
    phase4b: roles4bResult ? {                                                    // ⭐ v10.12
      socle:                    roles4bResult.socle,
      roles:                    roles4bResult.roles
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
  PHASE4_PRETE,                       // ⭐ v10.10
  PHASE4B_PRETE,                      // ⭐ v10.12
  STATUT_FIN_COMPLET,
  STATUT_FIN_PHASE1_ISOLEE,
  STATUT_FIN_PHASE2_ISOLEE,
  STATUT_FIN_PHASE3_ISOLEE,           // ⭐ v10.9
  STATUT_SENTINELLE_PHASE3_KO,        // ⭐ v10.9
  STATUT_FIN_PHASE4_ISOLEE,           // ⭐ v10.10
  STATUT_SENTINELLE_PHASE4_KO,        // ⭐ v10.11
  MODE_COMPLET,
  MODE_PHASE1_ISOLEE,
  MODE_PHASE2_ISOLEE,
  MODE_PHASE3_ISOLEE,                 // ⭐ v10.9
  MODE_PHASE4_ISOLEE,                 // ⭐ v10.10
  STATUT_TO_MODE,

  _internal: {
    identifyFailedStep,
    _enchainerRolesPiliers            // ⭐ v10.12
  }
};
