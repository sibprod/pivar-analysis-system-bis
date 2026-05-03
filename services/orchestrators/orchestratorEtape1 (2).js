// services/orchestrators/orchestratorEtape1.js
// Sous-orchestrateur Étape 1 — Profil-Cognitif v10.2b
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (Section 4.1 Architecture multi-étapes)
//
// Rôle :
//   - Gère le pipeline complet de l'Étape 1 :
//     T1 → vérificateur T1 (si fichier prompt existe) → T2 → vérif T2 → T3 → vérif T3
//        → T4 (4 parallèles + Synthèse + Coûts) → certificateur lexique
//   - Détecte automatiquement les vérificateurs via la présence de leur fichier prompt (Décision n°32)
//   - Gère les 4 modes opérationnels du vérificateur T1 (Décisions n°15, n°16, n°24)
//
// AIGUILLAGE PAR STATUT (Section 12 du Contrat ETAPE1 v1.8) :
//   - NOUVEAU                       → mode PIPELINE_COMPLET (T1 + vérificateur)
//   - REPRENDRE_AGENT1              → mode PIPELINE_COMPLET (synonyme historique de REPRENDRE_T1_DES_SOMMEIL)
//   - REPRENDRE_VERIFICATEUR1       → mode VÉRIFICATEUR_SEUL (saute T1, lit ETAPE1_T1, lance vérificateur)
//   - en_cours                      → mode PIPELINE_COMPLET par défaut (cas marginal)
//   - REPRENDRE_T1_<X>_SEUL         → mode SCENARIO_ISOLÉ (Famille A — Décision n°42)  ⭐ v10.2b
//   - REPRENDRE_T1_DES_<X>          → mode SCENARIO_CASCADE (Famille B — Décision n°42) ⭐ v10.2b
//
// PHASE D (2026-04-28) — v10 :
//   - Fichier NOUVEAU : extrait de orchestratorService.js (Décision n°26)
//   - Détection auto vérificateur via promptExists() (Décision n°32)
//   - Logique tentatives Mode 4 + escalade Mode 3 (Décision n°24)
//
// PHASE D-correction (2026-04-29) — v10.1 :
//   ⚠️ CORRECTION CRITIQUE — bug d'aiguillage par statut détecté en production
//
//   Bug détecté :
//     Cécile mise en REPRENDRE_VERIFICATEUR1 → orchestratorEtape1 lançait T1
//     en complet au lieu de sauter directement au vérificateur.
//     Cela écrasait les 25 lignes ETAPE1_T1 existantes (delete-then-create T1)
//     au lieu de les vérifier doctrinalement.
//
//   Cause :
//     run() lançait T1 systématiquement, sans regarder visiteur.statut_analyse_pivar
//
//   Correction v10.1 :
//     run() lit le statut entrant et aiguille selon Section 12 du contrat :
//       - REPRENDRE_VERIFICATEUR1 → relit ETAPE1_T1 existant, saute T1, lance vérificateur
//       - tous autres statuts éligibles → pipeline complet (comportement v10 inchangé)
//
// PHASE v10.2b (2026-05-03) — relances par scénario (Décision n°42) :
//   - Helper parseStatutScenario : extrait scénario depuis statut REPRENDRE_T1_*_SEUL ou REPRENDRE_T1_DES_*
//   - Constante SCENARIOS_ORDER : ordre canonique d'exécution T1 (Décision n°40)
//   - Mode SCENARIO_ISOLÉ : suppression ciblée + relance T1 sur 1 scénario + bascule REPRENDRE_VERIFICATEUR1
//   - Mode SCENARIO_CASCADE : boucle SCENARIO_ISOLÉ depuis le pivot jusqu'à PANNE
//   - Retour { success: false, stopReason } pour ces modes — empêche orchestratorPrincipal
//     d'écraser le statut REPRENDRE_VERIFICATEUR1 par 'terminé'

'use strict';

const airtableService              = require('../infrastructure/airtableService');
const backupService                = require('../infrastructure/backupService');
const agentBase                    = require('../infrastructure/agentBase');
const logger                       = require('../../utils/logger');

// Agents amont
const agentT1Service               = require('../etape1/agentT1Service');
const agentT1VerificateurService   = require('../etape1/agentT1VerificateurService');

// ⚠️ Les agents T2, T3, T4 et certificateur lexique ne sont PAS encore migrés en v10.
// Les requires sont commentés pour Phase D test Cécile T1+Vérificateur.
// À décommenter au fur et à mesure qu'on génère leurs versions v10.
//
// const agentT2Service             = require('../etape1/agentT2Service');
// const agentT3Service             = require('../etape1/agentT3Service');
// const agentT4ArchitectureService = require('../etape1/etape1_t4/agentT4ArchitectureService');
// const agentT4CircuitsService     = require('../etape1/etape1_t4/agentT4CircuitsService');
// const agentT4ModeService         = require('../etape1/etape1_t4/agentT4ModeService');
// const agentT4SyntheseService     = require('../etape1/etape1_t4/agentT4SyntheseService');
// const agentT4CoutsService        = require('../etape1/etape1_t4/agentT4CoutsService');
// const agentT4TransversesService  = require('../etape1/etape1_t4/agentT4TransversesService');
// const certificateurLexiqueService = require('../certificateurs/certificateurLexiqueService');

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v10.2b — Helper parseStatutScenario (Décision n°42)
// ═══════════════════════════════════════════════════════════════════════════
//
// Extrait le scénario cible depuis un statut manuel.
// Pattern A : REPRENDRE_T1_<SCENARIO>_SEUL  → relance isolée (Famille A)
// Pattern B : REPRENDRE_T1_DES_<SCENARIO>   → relance cascade (Famille B)
//
// Note : ANIMAL1 / ANIMAL2 dans le statut sont normalisés en ANIMAL_1 / ANIMAL_2
// pour cohérence avec la liste SCENARIOS de agentT1Service.js (Décision n°40).
//
// Retourne null si le statut ne matche aucun pattern.
function parseStatutScenario(statut) {
  if (!statut || typeof statut !== 'string') return null;

  const matchSEUL = statut.match(/^REPRENDRE_T1_(SOMMEIL|WEEKEND|ANIMAL1|ANIMAL2|PANNE)_SEUL$/);
  if (matchSEUL) {
    const raw = matchSEUL[1];
    const scenario = (raw === 'ANIMAL1') ? 'ANIMAL_1'
                   : (raw === 'ANIMAL2') ? 'ANIMAL_2'
                   : raw;
    return { type: 'SEUL', scenario };
  }

  const matchDES = statut.match(/^REPRENDRE_T1_DES_(SOMMEIL|WEEKEND|ANIMAL1|ANIMAL2|PANNE)$/);
  if (matchDES) {
    const raw = matchDES[1];
    const scenario = (raw === 'ANIMAL1') ? 'ANIMAL_1'
                   : (raw === 'ANIMAL2') ? 'ANIMAL_2'
                   : raw;
    return { type: 'DES', scenario };
  }

  return null;
}

// Ordre canonique d'exécution T1 (Décision n°40 : 5 agents distincts)
// Utilisé pour le mode SCENARIO_CASCADE : on relance depuis le pivot jusqu'à PANNE.
const SCENARIOS_ORDER = ['SOMMEIL', 'WEEKEND', 'ANIMAL_1', 'ANIMAL_2', 'PANNE'];

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE — run
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute le pipeline Étape 1 pour un candidat.
 * Aiguille selon le statut entrant vers l'un des 4 modes :
 *   - PIPELINE_COMPLET  : T1 (5 scénarios) + vérificateur T1 (existant v10.1)
 *   - VÉRIFICATEUR_SEUL : saute T1, vérificateur seul    (existant v10.1)
 *   - SCENARIO_ISOLÉ    : delete + T1 ciblé + bascule REPRENDRE_VERIFICATEUR1  ⭐ v10.2b
 *   - SCENARIO_CASCADE  : boucle SCENARIO_ISOLÉ depuis pivot jusqu'à PANNE     ⭐ v10.2b
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Object} params.visiteur — données du candidat (déjà lues par orchestratorPrincipal)
 * @returns {Promise<Object>} { success, candidat_id, mode, totalCostUsd, totalElapsedMs, ... }
 */
async function run({ candidat_id, visiteur }) {
  const startTime = Date.now();

  // ⭐ v10.1 — Lecture du statut pour aiguillage (Section 12 du contrat v1.8)
  const statut_entrant = visiteur?.statut_analyse_pivar || 'INCONNU';

  // ⭐ v10.2b — Détection des modes scénario
  const aiguillageScenario = parseStatutScenario(statut_entrant);
  const sauterT1 = (statut_entrant === 'REPRENDRE_VERIFICATEUR1');

  let mode;
  if (sauterT1) {
    mode = 'VÉRIFICATEUR_SEUL';
  } else if (aiguillageScenario?.type === 'SEUL') {
    mode = 'SCENARIO_ISOLÉ';
  } else if (aiguillageScenario?.type === 'DES') {
    mode = 'SCENARIO_CASCADE';
  } else {
    mode = 'PIPELINE_COMPLET';
  }

  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
  logger.info('Pipeline Étape 1 starting', {
    candidat_id,
    statut_entrant,
    mode,
    scenario_cible: aiguillageScenario?.scenario || null
  });
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

  const usages = [];
  const costs = [];

  try {
    // ─── 1. Charger le lexique UNE FOIS pour tout le pipeline ───────────────
    agentBase.resetLexiqueCache();
    await agentBase.loadLexique();
    logger.info('Lexique loaded for pipeline', { candidat_id });

    // ═════════════════════════════════════════════════════════════════════════
    // ⭐ v10.2b — Mode SCENARIO_ISOLÉ (Famille A : REPRENDRE_T1_<X>_SEUL)
    // ═════════════════════════════════════════════════════════════════════════
    if (mode === 'SCENARIO_ISOLÉ') {
      const scenario = aiguillageScenario.scenario;
      const result = await runScenarioIsole({
        candidat_id,
        session_id: candidat_id,
        scenario,
        usages,
        costs
      });

      const totalElapsedMs = Date.now() - startTime;
      const totalCostUsd = costs.reduce((s, c) => s + c, 0);

      logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
      logger.info('✅ SCENARIO_ISOLÉ terminé — bascule REPRENDRE_VERIFICATEUR1', {
        candidat_id,
        scenario,
        rows_produites: result.rows_produites,
        totalCostUsd: totalCostUsd.toFixed(4),
        totalElapsedMs
      });
      logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

      // ⭐ Retour { success: false, stopReason } pour empêcher orchestratorPrincipal
      // d'écraser le statut REPRENDRE_VERIFICATEUR1 par 'terminé' (cf. ligne ~92-96
      // de orchestratorPrincipal.js : si success=true → statut passe à 'terminé').
      return {
        success: false,
        stopReason: 'scenario_isole_done',
        candidat_id,
        mode: 'SCENARIO_ISOLÉ',
        scenario,
        rows_produites: result.rows_produites,
        totalCostUsd,
        totalElapsedMs,
        scenarioResult: result.scenarioResult,
        usages
      };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // ⭐ v10.2b — Mode SCENARIO_CASCADE (Famille B : REPRENDRE_T1_DES_<X>)
    // ═════════════════════════════════════════════════════════════════════════
    if (mode === 'SCENARIO_CASCADE') {
      const pivot = aiguillageScenario.scenario;
      const pivotIndex = SCENARIOS_ORDER.indexOf(pivot);
      if (pivotIndex < 0) {
        throw new Error(`SCENARIO_CASCADE — pivot introuvable: "${pivot}"`);
      }
      const scenarios_a_relancer = SCENARIOS_ORDER.slice(pivotIndex);

      logger.info('Mode SCENARIO_CASCADE — relance T1 en cascade', {
        candidat_id,
        pivot,
        scenarios_a_relancer
      });

      // Cas particulier doctrinal (Section 12.2 du contrat v1.8) :
      // REPRENDRE_T1_DES_SOMMEIL = équivalent à REPRENDRE_AGENT1 = T1 complet.
      // → on délègue à writeEtape1T1 (delete-all + create-all) via runAgentT1.
      // C'est plus efficace qu'une boucle de 5 scénarios.
      if (pivot === 'SOMMEIL') {
        logger.info('SCENARIO_CASCADE depuis SOMMEIL = T1 complet (équivalent REPRENDRE_AGENT1)', { candidat_id });

        await backupService.save(candidat_id, 'before_t1_cascade_complet', { responses_count: 25 });

        const t1Result = await agentT1Service.runAgentT1({
          candidat_id,
          session_id: candidat_id
        });
        trackUsage(usages, costs, t1Result);

        await backupService.save(candidat_id, 'after_t1_cascade_complet', { rows: t1Result.rows });

        // Bascule en REPRENDRE_VERIFICATEUR1 pour que le polling reprenne sur le vérificateur
        await airtableService.updateVisiteur(candidat_id, {
          statut_analyse_pivar: 'REPRENDRE_VERIFICATEUR1',
          derniere_activite: new Date().toISOString()
        });

        const totalElapsedMs = Date.now() - startTime;
        const totalCostUsd = costs.reduce((s, c) => s + c, 0);

        logger.info('✅ SCENARIO_CASCADE (T1 complet) terminé — bascule REPRENDRE_VERIFICATEUR1', {
          candidat_id,
          totalCostUsd: totalCostUsd.toFixed(4),
          totalElapsedMs
        });

        return {
          success: false,
          stopReason: 'scenario_cascade_done',
          candidat_id,
          mode: 'SCENARIO_CASCADE',
          pivot,
          scenarios_a_relancer,
          totalCostUsd,
          totalElapsedMs,
          t1Result,
          usages
        };
      }

      // Cas général : cascade partielle — on enchaîne SCENARIO_ISOLÉ pour chaque scénario
      const cascadeResults = [];
      for (const scenario of scenarios_a_relancer) {
        const result = await runScenarioIsole({
          candidat_id,
          session_id: candidat_id,
          scenario,
          usages,
          costs
        });
        cascadeResults.push({ scenario, ...result });
      }

      // Bascule en REPRENDRE_VERIFICATEUR1 pour que le polling reprenne
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: 'REPRENDRE_VERIFICATEUR1',
        derniere_activite: new Date().toISOString()
      });

      const totalElapsedMs = Date.now() - startTime;
      const totalCostUsd = costs.reduce((s, c) => s + c, 0);

      logger.info('✅ SCENARIO_CASCADE terminé — bascule REPRENDRE_VERIFICATEUR1', {
        candidat_id,
        scenarios_relances: scenarios_a_relancer.length,
        totalCostUsd: totalCostUsd.toFixed(4),
        totalElapsedMs
      });

      return {
        success: false,
        stopReason: 'scenario_cascade_done',
        candidat_id,
        mode: 'SCENARIO_CASCADE',
        pivot,
        scenarios_a_relancer,
        cascadeResults,
        totalCostUsd,
        totalElapsedMs,
        usages
      };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Modes existants v10.1 : PIPELINE_COMPLET et VÉRIFICATEUR_SEUL
    // ═════════════════════════════════════════════════════════════════════════

    // ─── 2. T1 — exécuté seulement si on ne saute pas (Section 12 du contrat) ─
    let t1Result;
    if (sauterT1) {
      // ⭐ v10.1 — REPRENDRE_VERIFICATEUR1 : on relit ETAPE1_T1 existant
      logger.info('T1 SAUTÉ — relecture ETAPE1_T1 existant pour vérificateur', { candidat_id });
      const existingRows = await airtableService.getEtape1T1(candidat_id);

      if (!existingRows || existingRows.length === 0) {
        throw new Error(
          `REPRENDRE_VERIFICATEUR1 demandé mais aucune ligne ETAPE1_T1 trouvée pour ${candidat_id}. ` +
          `Le candidat doit d'abord passer par T1 (statut NOUVEAU ou REPRENDRE_AGENT1).`
        );
      }

      logger.info('ETAPE1_T1 relu depuis Airtable', {
        candidat_id,
        nb_lignes: existingRows.length
      });

      // Construire un t1Result minimal compatible avec la suite du pipeline
      t1Result = {
        rows:  existingRows,
        usage: { input_tokens: 0, output_tokens: 0 },
        cost:  0,
        elapsedMs: 0,
        skipped: true   // marqueur pour debug
      };
    } else {
      // Comportement v10 inchangé : T1 complet (5 scénarios)
      await backupService.save(candidat_id, 'before_t1', { responses_count: 25 });

      t1Result = await agentT1Service.runAgentT1({
        candidat_id,
        session_id: candidat_id
      });
      trackUsage(usages, costs, t1Result);

      await backupService.save(candidat_id, 'after_t1', { rows: t1Result.rows });
      logger.info('✅ T1 done', {
        candidat_id,
        rows: t1Result.rows.length,
        cost: t1Result.cost.toFixed(4)
      });
    }

    // ─── 2.5 Pipeline : Vérificateur T1 (Décision n°32 — détection auto) ───
    const verifT1Exists = agentBase.promptExists('etape1/verificateur1_t1.txt');

    let t1VerifResult = null;
    if (verifT1Exists) {
      logger.info('Vérificateur T1 prompt detected — running verification', { candidat_id });

      const tentatives_actuelles = parseInt(visiteur?.nombre_tentatives_etape1 || 0, 10);

      await backupService.save(candidat_id, 'before_t1_verificateur', {
        lignes_a_verifier: t1Result.rows.length,
        tentatives_actuelles
      });

      t1VerifResult = await agentT1VerificateurService.runVerificateurT1({
        candidat_id,
        rows_t1: t1Result.rows,
        tentatives_actuelles
      });
      trackUsage(usages, costs, t1VerifResult);

      await backupService.save(candidat_id, 'after_t1_verificateur', {
        verdict:          t1VerifResult.verdict,
        nb_violations:    t1VerifResult.violations.length,
        nb_corrections:   (t1VerifResult.corrections || []).length,
        mode_recommande:  t1VerifResult.mode_recommande,
        nb_critique:      t1VerifResult.nb_critique,
        nb_doctrinale:    t1VerifResult.nb_doctrinale
      });

      logger.info('✅ Vérificateur T1 done', {
        candidat_id,
        verdict:          t1VerifResult.verdict,
        mode_recommande:  t1VerifResult.mode_recommande,
        nb_violations:    t1VerifResult.violations.length,
        nb_corrections:   (t1VerifResult.corrections || []).length,
        cost:             t1VerifResult.cost.toFixed(4)
      });

      // ⭐ Aiguillage selon le mode recommandé (Décisions n°15, n°16, n°24)
      const aiguillageResult = await traiterModeVerificateur({
        candidat_id,
        mode: t1VerifResult.mode_recommande,
        verdict: t1VerifResult.verdict,
        nb_critique: t1VerifResult.nb_critique,
        tentatives_actuelles
      });

      // Si le mode demande l'arrêt du pipeline (Mode 3 ou Mode 4), on retourne tôt
      if (aiguillageResult.stopPipeline) {
        const totalElapsedMs = Date.now() - startTime;
        const totalCostUsd   = costs.reduce((s, c) => s + c, 0);

        return {
          success:        false,
          stopReason:     aiguillageResult.reason,
          candidat_id,
          mode,
          totalCostUsd,
          totalElapsedMs,
          t1Result,
          t1VerifResult,
          usages
        };
      }
      // Sinon, Mode 1 (conforme) ou Mode 2 (corrections appliquées) → on continue
    } else {
      logger.info('Vérificateur T1 prompt NOT detected — skipping verification', { candidat_id });
    }

    // ─── 3. Pipeline : T2, T3, T4, certificateur lexique ─────────────────────
    // ⚠️ NON MIGRÉ EN v10 : ces agents seront migrés progressivement.
    //   Pour le test Cécile T1+Vérificateur (Phase D), on s'arrête ici.
    //   Le statut sera mis à 'terminé' par orchestratorPrincipal après le retour.
    //
    // Quand on migrera T2 :
    //   await backupService.save(candidat_id, 'before_t2', {...});
    //   const t2Result = await agentT2Service.runAgentT2({ candidat_id });
    //   trackUsage(usages, costs, t2Result);
    //   await backupService.save(candidat_id, 'after_t2', {...});
    //   ... etc
    //
    //   Idem pour T3, T4 (4 parallèles + synthèse + coûts), certificateur lexique.

    logger.info('⚠️ Étape 1 partielle — seuls T1 + Vérificateur T1 ont été exécutés', {
      candidat_id,
      message: 'T2/T3/T4/certificateur lexique non encore migrés en v10'
    });

    // ─── Statut final ────────────────────────────────────────────────────────
    const totalElapsedMs = Date.now() - startTime;
    const totalCostUsd   = costs.reduce((s, c) => s + c, 0);

    // Reset compteur tentatives après succès (Décision n°24)
    await airtableService.resetTentativesEtape1(candidat_id);

    logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
    logger.info('🎉 Étape 1 (T1+Vérif) completed', {
      candidat_id,
      mode,
      totalElapsedMs,
      totalElapsedSec:    (totalElapsedMs / 1000).toFixed(1),
      totalCostUsd:       totalCostUsd.toFixed(4),
      t1_rows:            t1Result.rows.length,
      t1_verdict:         t1VerifResult?.verdict || 'N/A',
      t1_mode:            t1VerifResult?.mode_recommande || 'N/A'
    });
    logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

    return {
      success:        true,
      candidat_id,
      mode,
      totalCostUsd,
      totalElapsedMs,
      t1Result,
      t1VerifResult,
      usages
    };

  } catch (error) {
    logger.error('Pipeline Étape 1 failed', {
      candidat_id,
      mode,
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });

    await backupService.save(candidat_id, 'error', {
      error: error.message,
      step:  identifyFailedStep(error),
      orchestrateur: 'etape1',
      mode
    });

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v10.2b — runScenarioIsole : sous-routine SCENARIO_ISOLÉ (Décision n°42)
// ═══════════════════════════════════════════════════════════════════════════
//
// Encapsule la séquence atomique pour 1 scénario :
//   1. Garde-fou : vérifier que le candidat a au moins 1 ligne ETAPE1_T1 du scénario
//   2. backupService.save before_scenario_isole
//   3. airtableService.deleteEtape1T1Scenario (suppression ciblée des 5 lignes)
//   4. agentT1Service.runAgentT1ForScenario (production des 5 nouvelles rows)
//   5. airtableService.writeEtape1T1Scenario (écriture additive — pas d'écrasement)
//   6. backupService.save after_scenario_isole
//
// Utilisé par :
//   - mode SCENARIO_ISOLÉ (1 appel)
//   - mode SCENARIO_CASCADE (boucle sur scenarios_a_relancer)
//   - futur Mode 2 auto du vérificateur (Phase v10.2c)
//
// IMPORTANT : cette sous-routine NE met PAS à jour le statut visiteur ni ne
// lance le vérificateur. C'est run() qui s'en charge en sortie de mode.
async function runScenarioIsole({ candidat_id, session_id, scenario, usages, costs }) {
  logger.info('runScenarioIsole — début', { candidat_id, scenario });

  // 1. Garde-fou : vérifier qu'il y a quelque chose à supprimer
  const existingRows = await airtableService.getEtape1T1(candidat_id);
  const rowsScenario = existingRows.filter(r => r.scenario === scenario);
  if (rowsScenario.length === 0) {
    throw new Error(
      `runScenarioIsole — scénario ${scenario} demandé mais aucune ligne ETAPE1_T1 trouvée. ` +
      `Le candidat ${candidat_id} doit d'abord avoir un T1 complet ` +
      `(statut NOUVEAU, REPRENDRE_AGENT1, ou REPRENDRE_T1_DES_SOMMEIL).`
    );
  }
  if (rowsScenario.length !== 5) {
    logger.warn('runScenarioIsole — nombre de lignes scénario inattendu (attendu: 5)', {
      candidat_id, scenario, count: rowsScenario.length
    });
  }

  // 2. Backup avant
  await backupService.save(candidat_id, 'before_scenario_isole', {
    scenario,
    count_avant: rowsScenario.length
  });

  // 3. Suppression ciblée
  const deleteResult = await airtableService.deleteEtape1T1Scenario(candidat_id, scenario);
  logger.info('runScenarioIsole — lignes supprimées', { candidat_id, scenario, ...deleteResult });

  // 4. Relance T1 sur ce scénario uniquement
  const scenarioResult = await agentT1Service.runAgentT1ForScenario({
    candidat_id,
    session_id,
    scenario_name: scenario
  });
  trackUsage(usages, costs, scenarioResult);

  // 5. Écriture ciblée (additive, sans écraser les 20 autres lignes)
  const rowsNormalisees = scenarioResult.rows.map(agentT1Service.normalizeRowForAirtable);
  const created = await airtableService.writeEtape1T1Scenario(candidat_id, rowsNormalisees);

  // 6. Backup après
  await backupService.save(candidat_id, 'after_scenario_isole', {
    scenario,
    rows_supprimees: deleteResult.deleted,
    rows_creees: created,
    cost: scenarioResult.cost
  });

  logger.info('✅ runScenarioIsole — terminé', {
    candidat_id,
    scenario,
    rows_supprimees: deleteResult.deleted,
    rows_creees: created,
    cost_usd: scenarioResult.cost.toFixed(4)
  });

  return {
    rows_produites: created,
    rows_supprimees: deleteResult.deleted,
    scenarioResult
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// AIGUILLAGE SELON LE MODE DU VÉRIFICATEUR (Décisions n°15, n°16, n°24)
// ═══════════════════════════════════════════════════════════════════════════

async function traiterModeVerificateur({ candidat_id, mode, verdict, nb_critique, tentatives_actuelles }) {
  switch (mode) {
    case 1:
      // Mode 1 — Conforme : pas d'action, le pipeline continue
      logger.info('Mode 1 — Conforme, pipeline continue', { candidat_id });
      return { stopPipeline: false };

    case 2:
      // Mode 2 — Corrections directes : déjà appliquées par le vérificateur, le pipeline continue
      logger.info('Mode 2 — Corrections appliquées, pipeline continue', { candidat_id });
      return { stopPipeline: false };

    case 3:
      // Mode 3 — Validation humaine : statut EN_ATTENTE_VALIDATION_HUMAINE + alerte superviseur
      logger.warn('Mode 3 — Validation humaine requise, pipeline arrêté', {
        candidat_id,
        verdict,
        nb_critique,
        tentatives_actuelles
      });

      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: 'EN_ATTENTE_VALIDATION_HUMAINE',
        derniere_activite:    new Date().toISOString()
      });

      // L'envoi d'email superviseur est délégué à validationHumaineService.js (à créer Phase D-2)
      // Pour le test Cécile, on log juste l'alerte
      logger.warn('⚠️ Action superviseur requise — vérificateur T1 BLOQUANT après tentatives épuisées', {
        candidat_id,
        url_airtable: 'https://airtable.com/<base>/<table>/<recordId>'  // construire dynamiquement plus tard
      });

      return { stopPipeline: true, reason: 'mode_3_validation_humaine' };

    case 4:
      // Mode 4 — Erreur système : incrémenter tentatives + REPRENDRE_AGENT1
      const newTentatives = await airtableService.incrementTentativesEtape1(candidat_id);

      logger.warn('Mode 4 — Erreur système, T1 sera relancé', {
        candidat_id,
        verdict,
        nb_critique,
        new_tentatives: newTentatives
      });

      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: 'REPRENDRE_AGENT1',
        derniere_activite:    new Date().toISOString()
      });

      return { stopPipeline: true, reason: 'mode_4_relance_t1' };

    default:
      logger.error('Mode vérificateur inconnu', { candidat_id, mode });
      return { stopPipeline: true, reason: 'mode_inconnu' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS INTERNES
// ═══════════════════════════════════════════════════════════════════════════

function trackUsage(usages, costs, agentResult) {
  if (agentResult?.usage) usages.push(agentResult.usage);
  if (typeof agentResult?.cost === 'number') costs.push(agentResult.cost);
}

function identifyFailedStep(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('vérificateur t1') || msg.includes('verificateur t1')) return 't1_verificateur';
  if (msg.includes('agent t1') || msg.includes('etape1_t1')) return 't1';
  if (msg.includes('responses')) return 'responses_loading';
  if (msg.includes('scenario_isole') || msg.includes('runscenarioisole')) return 'scenario_isole';
  return 'unknown';
}

module.exports = {
  run,
  determinerMode: agentT1VerificateurService.determinerMode,
  identifyFailedStep,
  // ⭐ v10.2b — exports pour tests/debug
  parseStatutScenario,
  SCENARIOS_ORDER,
  runScenarioIsole
};
