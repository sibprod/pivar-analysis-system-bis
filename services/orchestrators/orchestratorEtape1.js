// services/orchestrators/orchestratorEtape1.js
// Sous-orchestrateur Étape 1 — Profil-Cognitif
//
// Pipeline étape 1 : T1 → T2 → T3 → T4 (orchestrateur + certificateur lexique)
//
// Aiguillage par statut entrant :
//   - NOUVEAU                       → mode PIPELINE_COMPLET
//   - REPRENDRE_AGENT1              → mode PIPELINE_COMPLET
//   - en_cours                      → mode PIPELINE_COMPLET (cas marginal)
//   - REPRENDRE_T1_<X>_SEUL         → mode SCENARIO_ISOLÉ
//   - REPRENDRE_T1_DES_<X>          → mode SCENARIO_CASCADE
//   - REPRENDRE_AGENT2              → mode AGENT2_SEUL (saute T1, démarre T2)
//   - REPRENDRE_AGENT3              → mode AGENT3_SEUL (saute T1+T2, démarre T3)
//   - REPRENDRE_AGENT4              → mode AGENT4_SEUL (saute T1+T2+T3, démarre T4)

'use strict';

const airtableService     = require('../infrastructure/airtableService');
const backupService       = require('../infrastructure/backupService');
const agentBase           = require('../infrastructure/agentBase');
const logger              = require('../../utils/logger');

const agentT1Service      = require('../etape1/agentT1Service');
const agentT2Service      = require('../etape1/agentT2Service');
const agentT3Service      = require('../etape1/agentT3Service');
const orchestratorT4      = require('./orchestratorT4');

// ═══════════════════════════════════════════════════════════════════════════
// Helpers
// ═══════════════════════════════════════════════════════════════════════════

// Extrait le scénario cible depuis un statut manuel.
// Pattern A : REPRENDRE_T1_<SCENARIO>_SEUL  → relance isolée
// Pattern B : REPRENDRE_T1_DES_<SCENARIO>   → relance cascade
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

// Ordre canonique d'exécution T1 (5 scénarios)
const SCENARIOS_ORDER = ['SOMMEIL', 'WEEKEND', 'ANIMAL_1', 'ANIMAL_2', 'PANNE'];

function trackUsage(usages, costs, agentResult) {
  if (agentResult?.usage) usages.push(agentResult.usage);
  if (typeof agentResult?.cost === 'number') costs.push(agentResult.cost);
}

function identifyFailedStep(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('agent t1') || msg.includes('etape1_t1')) return 't1';
  if (msg.includes('agent t2') || msg.includes('etape1_t2')) return 't2';
  if (msg.includes('agent t3') || msg.includes('etape1_t3')) return 't3';
  if (msg.includes('agent t4') || msg.includes('etape1_t4')) return 't4';
  if (msg.includes('responses')) return 'responses_loading';
  if (msg.includes('scenario_isole') || msg.includes('runscenarioisole')) return 'scenario_isole';
  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE — run
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute le pipeline Étape 1 pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Object} params.visiteur — données du candidat (déjà lues par orchestratorPrincipal)
 * @returns {Promise<Object>} { success, candidat_id, mode, totalCostUsd, totalElapsedMs, ... }
 */
async function run({ candidat_id, visiteur }) {
  const startTime = Date.now();

  const statut_entrant = visiteur?.statut_analyse_pivar || 'INCONNU';

  const aiguillageScenario = parseStatutScenario(statut_entrant);
  const reprendreAgentT2 = (statut_entrant === 'REPRENDRE_AGENT2');
  const reprendreAgentT3 = (statut_entrant === 'REPRENDRE_AGENT3');
  const reprendreAgentT4 = (statut_entrant === 'REPRENDRE_AGENT4');

  let mode;
  if (reprendreAgentT4) {
    mode = 'AGENT4_SEUL';
  } else if (reprendreAgentT3) {
    mode = 'AGENT3_SEUL';
  } else if (reprendreAgentT2) {
    mode = 'AGENT2_SEUL';
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
    // Charger le lexique UNE FOIS pour tout le pipeline
    agentBase.resetLexiqueCache();
    await agentBase.loadLexique();
    logger.info('Lexique loaded for pipeline', { candidat_id });

    // ═════════════════════════════════════════════════════════════════════════
    // Mode SCENARIO_ISOLÉ
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
      logger.info('✅ SCENARIO_ISOLÉ terminé', {
        candidat_id,
        scenario,
        rows_produites: result.rows_produites,
        totalCostUsd: totalCostUsd.toFixed(4),
        totalElapsedMs
      });
      logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

      return {
        success: true,
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
    // Mode AGENT2_SEUL
    // ═════════════════════════════════════════════════════════════════════════
    if (mode === 'AGENT2_SEUL') {
      logger.info('Mode AGENT2_SEUL — saute T1, exécute T2 seul', { candidat_id });

      const t2Exists = agentBase.promptExists('etape1/etape1_t2.txt');
      if (!t2Exists) {
        throw new Error(
          'Mode AGENT2_SEUL : le prompt etape1/etape1_t2.txt est introuvable.'
        );
      }

      const existingT1 = await airtableService.getEtape1T1(candidat_id);
      if (!existingT1 || existingT1.length === 0) {
        throw new Error(
          `Mode AGENT2_SEUL : aucune ligne ETAPE1_T1 trouvée pour ${candidat_id}. ` +
          `T1 doit avoir tourné avec succès avant T2 seul.`
        );
      }

      await backupService.save(candidat_id, 'before_t2_seul', {
        statut_entrant,
        nb_lignes_t1_lues: existingT1.length
      });

      const t2Result = await agentT2Service.runAgentT2({ candidat_id });
      trackUsage(usages, costs, t2Result);

      await backupService.save(candidat_id, 'after_t2_seul', {
        lignes_t2_produites:             t2Result.rows.length,
        hypothese_pilier_dominant_ecart: t2Result.synthese.hypothese_pilier_dominant_ecart,
        confiance_socle_par_ecart:       t2Result.synthese.confiance_socle_par_ecart,
        flag_profil_quasi_conforme:      t2Result.synthese.flag_profil_quasi_conforme,
        directive_t3:                    t2Result.synthese.directive_t3
      });

      const totalElapsedMs = Date.now() - startTime;
      const totalCostUsd = costs.reduce((s, c) => s + c, 0);

      logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
      logger.info('🎉 AGENT2_SEUL terminé', {
        candidat_id,
        rows:                t2Result.rows.length,
        hypothese_socle:     t2Result.synthese.hypothese_pilier_dominant_ecart,
        confiance:           t2Result.synthese.confiance_socle_par_ecart,
        flag_quasi_conforme: t2Result.synthese.flag_profil_quasi_conforme,
        directive_t3:        t2Result.synthese.directive_t3,
        totalCostUsd:        totalCostUsd.toFixed(4),
        totalElapsedMs
      });
      logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

      await airtableService.resetTentativesEtape1(candidat_id);

      return {
        success:        true,
        candidat_id,
        mode:           'AGENT2_SEUL',
        totalCostUsd,
        totalElapsedMs,
        t2Result,
        usages
      };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Mode AGENT3_SEUL
    // ═════════════════════════════════════════════════════════════════════════
    if (mode === 'AGENT3_SEUL') {
      logger.info('Mode AGENT3_SEUL — saute T1+T2, exécute T3 seul', { candidat_id });

      const t3Exists = agentBase.promptExists('etape1/etape1_t3.txt');
      if (!t3Exists) {
        throw new Error(
          'Mode AGENT3_SEUL : le prompt etape1/etape1_t3.txt est introuvable.'
        );
      }

      const lignesT1 = await airtableService.getEtape1T1(candidat_id);
      if (!lignesT1 || lignesT1.length === 0) {
        throw new Error(
          `Mode AGENT3_SEUL : aucune ligne ETAPE1_T1 trouvée pour ${candidat_id}.`
        );
      }
      const lignesT2 = await airtableService.getEtape1T2(candidat_id);
      if (!lignesT2 || lignesT2.length === 0) {
        throw new Error(
          `Mode AGENT3_SEUL : aucune ligne ETAPE1_T2 trouvée pour ${candidat_id}.`
        );
      }

      await backupService.save(candidat_id, 'before_t3_seul', {
        statut_entrant,
        lignes_t1_disponibles: lignesT1.length,
        lignes_t2_disponibles: lignesT2.length
      });

      const t3Result = await agentT3Service.runAgentT3({ candidat_id });
      trackUsage(usages, costs, t3Result);

      const piliersSocleFortes = Object.entries(t3Result.syntheseParPilier || {})
        .filter(([_p, s]) => s.candidature_socle_score === 'FORTE')
        .map(([p]) => p);
      const piliersResistantFortes = Object.entries(t3Result.syntheseParPilier || {})
        .filter(([_p, s]) => s.candidature_resistant_score === 'FORTE')
        .map(([p]) => p);

      await backupService.save(candidat_id, 'after_t3_seul', {
        lignes_t3_produites:        t3Result.rows.length,
        piliers_socle_fortes:       piliersSocleFortes,
        piliers_resistant_fortes:   piliersResistantFortes
      });

      const totalElapsedMs = Date.now() - startTime;
      const totalCostUsd = costs.reduce((s, c) => s + c, 0);

      logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
      logger.info('🎉 AGENT3_SEUL terminé', {
        candidat_id,
        rows:                     t3Result.rows.length,
        piliers_socle_FORTE:      piliersSocleFortes.join(',') || 'aucun',
        piliers_resistant_FORTE:  piliersResistantFortes.join(',') || 'aucun',
        totalCostUsd:             totalCostUsd.toFixed(4),
        totalElapsedMs
      });
      logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

      await airtableService.resetTentativesEtape1(candidat_id);

      return {
        success:        true,
        candidat_id,
        mode:           'AGENT3_SEUL',
        totalCostUsd,
        totalElapsedMs,
        t3Result,
        usages
      };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Mode AGENT4_SEUL
    // ═════════════════════════════════════════════════════════════════════════
    if (mode === 'AGENT4_SEUL') {
      logger.info('Mode AGENT4_SEUL — saute T1+T2+T3, exécute T4 seul', { candidat_id });

      const t4Exists = agentBase.promptExists('etape1/etape1_t4/etape1_t4_1_architecture.txt');
      if (!t4Exists) {
        throw new Error(
          'Mode AGENT4_SEUL : le prompt etape1/etape1_t4/etape1_t4_1_architecture.txt est introuvable.'
        );
      }

      await backupService.save(candidat_id, 'before_t4_seul', { statut_entrant });

      const t4Result = await orchestratorT4.runOrchestratorT4({ candidat_id });
      trackUsage(usages, costs, t4Result);

      await backupService.save(candidat_id, 'after_t4_seul', {
        nb_champs_bilan:        Object.keys(t4Result.bilan_t4 || {}).length,
        pilier_socle:           t4Result.pilier_socle,
        pilier_resistant:       t4Result.pilier_resistant,
        socle_par_defaut:       t4Result.socle_par_defaut,
        certificateur_verdict:  t4Result.certificateur?.verdict || 'N/A',
        certificateur_score:    t4Result.certificateur?.score_conformite || 0
      });

      const totalElapsedMs = Date.now() - startTime;
      const totalCostUsd = costs.reduce((s, c) => s + c, 0);

      logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
      logger.info('🎉 AGENT4_SEUL terminé', {
        candidat_id,
        pilier_socle:           t4Result.pilier_socle,
        pilier_resistant:       t4Result.pilier_resistant || 'aucun',
        socle_par_defaut:       t4Result.socle_par_defaut,
        certificateur_verdict:  t4Result.certificateur?.verdict || 'N/A',
        certificateur_score:    t4Result.certificateur?.score_conformite || 0,
        nb_champs_bilan:        Object.keys(t4Result.bilan_t4 || {}).length,
        totalCostUsd:           totalCostUsd.toFixed(4),
        totalElapsedMs
      });
      logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

      await airtableService.resetTentativesEtape1(candidat_id);

      return {
        success:        true,
        candidat_id,
        mode:           'AGENT4_SEUL',
        totalCostUsd,
        totalElapsedMs,
        t4Result,
        usages
      };
    }

    // ═════════════════════════════════════════════════════════════════════════
    // Mode SCENARIO_CASCADE
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

      // Cas particulier : cascade depuis SOMMEIL = T1 complet
      if (pivot === 'SOMMEIL') {
        logger.info('SCENARIO_CASCADE depuis SOMMEIL = T1 complet', { candidat_id });

        await backupService.save(candidat_id, 'before_t1_cascade_complet', { responses_count: 25 });

        const t1Result = await agentT1Service.runAgentT1({
          candidat_id,
          session_id: candidat_id
        });
        trackUsage(usages, costs, t1Result);

        await backupService.save(candidat_id, 'after_t1_cascade_complet', { rows: t1Result.rows });

        const totalElapsedMs = Date.now() - startTime;
        const totalCostUsd = costs.reduce((s, c) => s + c, 0);

        logger.info('✅ SCENARIO_CASCADE (T1 complet) terminé', {
          candidat_id,
          totalCostUsd: totalCostUsd.toFixed(4),
          totalElapsedMs
        });

        return {
          success: true,
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

      // Cas général : cascade partielle
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

      const totalElapsedMs = Date.now() - startTime;
      const totalCostUsd = costs.reduce((s, c) => s + c, 0);

      logger.info('✅ SCENARIO_CASCADE terminé', {
        candidat_id,
        scenarios_relances: scenarios_a_relancer.length,
        totalCostUsd: totalCostUsd.toFixed(4),
        totalElapsedMs
      });

      return {
        success: true,
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
    // Mode PIPELINE_COMPLET — T1 → T2 → T3 → T4
    // ═════════════════════════════════════════════════════════════════════════

    // ─── T1 ──────────────────────────────────────────────────────────────────
    await backupService.save(candidat_id, 'before_t1', { responses_count: 25 });

    const t1Result = await agentT1Service.runAgentT1({
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

    // ─── T2 ──────────────────────────────────────────────────────────────────
    let t2Result = null;
    const t2Exists = agentBase.promptExists('etape1/etape1_t2.txt');

    if (t2Exists) {
      logger.info('Pipeline étape 1 — démarrage T2', { candidat_id });

      await backupService.save(candidat_id, 'before_t2', {
        lignes_t1_disponibles: t1Result.rows.length
      });

      t2Result = await agentT2Service.runAgentT2({ candidat_id });
      trackUsage(usages, costs, t2Result);

      await backupService.save(candidat_id, 'after_t2', {
        lignes_t2_produites:             t2Result.rows.length,
        hypothese_pilier_dominant_ecart: t2Result.synthese.hypothese_pilier_dominant_ecart,
        confiance_socle_par_ecart:       t2Result.synthese.confiance_socle_par_ecart,
        flag_profil_quasi_conforme:      t2Result.synthese.flag_profil_quasi_conforme,
        directive_t3:                    t2Result.synthese.directive_t3
      });

      logger.info('✅ T2 done', {
        candidat_id,
        rows:                t2Result.rows.length,
        hypothese_socle:     t2Result.synthese.hypothese_pilier_dominant_ecart,
        confiance:           t2Result.synthese.confiance_socle_par_ecart,
        flag_quasi_conforme: t2Result.synthese.flag_profil_quasi_conforme,
        directive_t3:        t2Result.synthese.directive_t3,
        cost:                t2Result.cost.toFixed(4)
      });
    } else {
      logger.info('T2 prompt NOT detected — skipping T2', { candidat_id });
    }

    // ─── T3 ──────────────────────────────────────────────────────────────────
    let t3Result = null;
    const t3Exists = agentBase.promptExists('etape1/etape1_t3.txt');

    if (t3Exists && t2Result) {
      logger.info('Pipeline étape 1 — démarrage T3', { candidat_id });

      await backupService.save(candidat_id, 'before_t3', {
        lignes_t1_disponibles: t1Result.rows.length,
        lignes_t2_disponibles: t2Result.rows.length,
        directive_t3:          t2Result.synthese?.directive_t3 || 'unknown'
      });

      t3Result = await agentT3Service.runAgentT3({ candidat_id });
      trackUsage(usages, costs, t3Result);

      const piliersSocleFortes = Object.entries(t3Result.syntheseParPilier || {})
        .filter(([_p, s]) => s.candidature_socle_score === 'FORTE')
        .map(([p]) => p);
      const piliersResistantFortes = Object.entries(t3Result.syntheseParPilier || {})
        .filter(([_p, s]) => s.candidature_resistant_score === 'FORTE')
        .map(([p]) => p);

      await backupService.save(candidat_id, 'after_t3', {
        lignes_t3_produites:        t3Result.rows.length,
        piliers_socle_fortes:       piliersSocleFortes,
        piliers_resistant_fortes:   piliersResistantFortes
      });

      logger.info('✅ T3 done', {
        candidat_id,
        rows:                     t3Result.rows.length,
        piliers_socle_FORTE:      piliersSocleFortes.join(',') || 'aucun',
        piliers_resistant_FORTE:  piliersResistantFortes.join(',') || 'aucun',
        cost:                     t3Result.cost.toFixed(4)
      });
    } else if (!t2Result) {
      logger.warn('T3 skipped — T2 n\'a pas tourné en amont', { candidat_id });
    } else {
      logger.info('T3 prompt NOT detected — skipping T3', { candidat_id });
    }

    // ─── T4 ──────────────────────────────────────────────────────────────────
    let t4Result = null;
    const t4Exists = agentBase.promptExists('etape1/etape1_t4/etape1_t4_1_architecture.txt');

    if (t4Exists && t3Result) {
      logger.info('Pipeline étape 1 — démarrage T4', { candidat_id });

      await backupService.save(candidat_id, 'before_t4', {
        lignes_t1_disponibles: t1Result.rows.length,
        lignes_t2_disponibles: t2Result.rows.length,
        lignes_t3_disponibles: t3Result.rows.length
      });

      t4Result = await orchestratorT4.runOrchestratorT4({ candidat_id });
      trackUsage(usages, costs, t4Result);

      await backupService.save(candidat_id, 'after_t4', {
        nb_champs_bilan:        Object.keys(t4Result.bilan_t4 || {}).length,
        pilier_socle:           t4Result.pilier_socle,
        pilier_resistant:       t4Result.pilier_resistant,
        socle_par_defaut:       t4Result.socle_par_defaut,
        certificateur_verdict:  t4Result.certificateur?.verdict || 'N/A',
        certificateur_score:    t4Result.certificateur?.score_conformite || 0
      });

      logger.info('✅ T4 done', {
        candidat_id,
        pilier_socle:           t4Result.pilier_socle,
        pilier_resistant:       t4Result.pilier_resistant || 'aucun',
        socle_par_defaut:       t4Result.socle_par_defaut,
        certificateur_verdict:  t4Result.certificateur?.verdict || 'N/A',
        certificateur_score:    t4Result.certificateur?.score_conformite || 0,
        cost:                   t4Result.cost.toFixed(4)
      });
    } else if (!t3Result) {
      logger.warn('T4 skipped — T3 n\'a pas tourné en amont', { candidat_id });
    } else {
      logger.info('T4 prompts NOT detected — skipping T4', { candidat_id });
    }

    // ─── Statut final ────────────────────────────────────────────────────────
    const totalElapsedMs = Date.now() - startTime;
    const totalCostUsd   = costs.reduce((s, c) => s + c, 0);

    await airtableService.resetTentativesEtape1(candidat_id);

    logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
    logger.info('🎉 Étape 1 completed', {
      candidat_id,
      mode,
      totalElapsedMs,
      totalElapsedSec:    (totalElapsedMs / 1000).toFixed(1),
      totalCostUsd:       totalCostUsd.toFixed(4),
      t1_rows:            t1Result.rows.length,
      t2_executed:        !!t2Result,
      t2_rows:            t2Result?.rows.length || 0,
      hypothese_socle:    t2Result?.synthese?.hypothese_pilier_dominant_ecart || 'N/A',
      confiance:          t2Result?.synthese?.confiance_socle_par_ecart || 'N/A',
      directive_t3:       t2Result?.synthese?.directive_t3 || 'N/A',
      t3_executed:        !!t3Result,
      t3_rows:            t3Result?.rows.length || 0,
      t4_executed:        !!t4Result,
      t4_pilier_socle:    t4Result?.pilier_socle || 'N/A',
      t4_certificateur:   t4Result?.certificateur?.verdict || 'N/A'
    });
    logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

    return {
      success:        true,
      candidat_id,
      mode,
      totalCostUsd,
      totalElapsedMs,
      t1Result,
      t2Result,
      t3Result,
      t4Result,
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
// runScenarioIsole — sous-routine SCENARIO_ISOLÉ
// ═══════════════════════════════════════════════════════════════════════════
//
// Encapsule la séquence atomique pour 1 scénario :
//   1. Inventaire des lignes existantes du scénario
//   2. Backup before_scenario_isole
//   3. Suppression ciblée des lignes existantes
//   4. Relance T1 sur ce scénario uniquement
//   5. Écriture ciblée (additive)
//   6. Backup after_scenario_isole

async function runScenarioIsole({ candidat_id, session_id, scenario, usages, costs }) {
  logger.info('runScenarioIsole — début', { candidat_id, scenario });

  const existingRows = await airtableService.getEtape1T1(candidat_id);
  const rowsScenario = existingRows.filter(r => r.scenario === scenario);

  if (rowsScenario.length === 0) {
    logger.info('runScenarioIsole — scénario sans lignes préexistantes (production ex-nihilo)', {
      candidat_id, scenario,
      total_lignes_candidat: existingRows.length
    });
  } else if (rowsScenario.length !== 5) {
    logger.warn('runScenarioIsole — nombre de lignes scénario préexistantes inattendu (attendu: 5)', {
      candidat_id, scenario, count: rowsScenario.length
    });
  }

  await backupService.save(candidat_id, 'before_scenario_isole', {
    scenario,
    count_avant: rowsScenario.length
  });

  const deleteResult = await airtableService.deleteEtape1T1Scenario(candidat_id, scenario);
  logger.info('runScenarioIsole — lignes supprimées', { candidat_id, scenario, ...deleteResult });

  const scenarioResult = await agentT1Service.runAgentT1ForScenario({
    candidat_id,
    session_id,
    scenario_name: scenario
  });
  trackUsage(usages, costs, scenarioResult);

  const rowsNormalisees = scenarioResult.rows.map(agentT1Service.normalizeRowForAirtable);
  const created = await airtableService.writeEtape1T1Scenario(candidat_id, rowsNormalisees);

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

module.exports = {
  run,
  identifyFailedStep,
  parseStatutScenario,
  SCENARIOS_ORDER,
  runScenarioIsole
};
