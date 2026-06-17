// services/orchestrators/orchestratorEtape1.js
// Sous-orchestrateur Étape 1 — Profil-Cognitif
//
// ARCHITECTURE v11.2 (3 étapes — suppression T2 historique, renumérotation propre) :
//   étape 1 (analyse cognitive)  ← T1 (analyse 25 lignes)
//   étape 2 (circuits)            ← ex-T3 (cartographie circuits cognitifs)
//   étape 3 (synthèse / bilan)    ← chaîne « Fable » (orchestrators/orchestratoretape3bilan.js)
//
// ⚠ v11.2 (14/06/2026) — ANCIEN BILAN (étape 3) RETIRÉ DE CE FICHIER :
//   L'ancienne chaîne du bilan (mode AGENT3_SEUL → orchestratorT3 → agentT3BilanService,
//   prompt monolithe etape1_t3bilan.txt v5.3) est intégralement remplacée par la chaîne
//   « Fable » (statut REPRENDRE_BILAN_FABLE → orchestrators/orchestratoretape3bilan.js),
//   branchée directement dans orchestratorPrincipal — elle NE passe PAS par ce fichier.
//   En conséquence : plus de require('./orchestratorT3') (fichier supprimé du dépôt),
//   plus de mode AGENT3_SEUL. orchestratorEtape1 ne gère plus que T1 (étape 1).
//
// ⚠ ÉTAT TRANSITOIRE — Phase Render-débloquage :
//   Seule l'étape 1 (T1) est branchée dans le pipeline complet de cette version.
//   L'étape 2 (circuits) est en cours de refonte doctrinale. La logique d'aiguillage
//   par statut (REPRENDRE_AGENT2) est préservée pour la brancher dès qu'elle est prête.
//
// Aiguillage par statut entrant :
//   - NOUVEAU                       → mode PIPELINE_COMPLET (actuellement T1 seul)
//   - REPRENDRE_AGENT1              → mode PIPELINE_COMPLET (actuellement T1 seul)
//   - en_cours                      → mode PIPELINE_COMPLET (cas marginal)
//   - REPRENDRE_T1_<X>_SEUL         → mode SCENARIO_ISOLÉ
//   - REPRENDRE_T1_DES_<X>          → mode SCENARIO_CASCADE
//   - REPRENDRE_AGENT2              → mode AGENT2_SEUL (en attente refonte étape 2)

'use strict';

const airtableService     = require('../infrastructure/airtableService');
const backupService       = require('../infrastructure/backupService');
const agentBase           = require('../infrastructure/agentBase');
const logger              = require('../../utils/logger');

const agentT1Service      = require('../etape1/agent_etape1_T1');

// ─── Étape 2 (circuits) — import désactivé en attente refonte doctrinale ───
// const agentT2Service      = require('../etape1/agentT2Service');
//
// ─── Étape 3 (bilan) — chaîne « Fable », branchée dans orchestratorPrincipal ─
// Le bilan ne passe plus par orchestratorEtape1 : il est aiguillé directement par
// orchestratorPrincipal (statut REPRENDRE_BILAN_FABLE) vers orchestratoretape3bilan.
// L'ancien orchestratorT3 a été supprimé du dépôt — aucun require ici.

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
  const reprendreAgent2 = (statut_entrant === 'REPRENDRE_AGENT2');

  let mode;
  if (reprendreAgent2) {
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
    // Mode AGENT2_SEUL — étape 2 (circuits) en attente refonte doctrinale
    // ═════════════════════════════════════════════════════════════════════════
    if (mode === 'AGENT2_SEUL') {
      throw new Error(
        'Mode AGENT2_SEUL : étape 2 (circuits) en cours de refonte doctrinale. ' +
        'Le prompt etape1_t2.txt et le service agentT2Service doivent être adaptés ' +
        'à la nouvelle architecture v11.2 à 3 étapes avant réactivation.'
      );
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
    // Mode PIPELINE_COMPLET — T1 seul (étape 2 en attente refonte ; étape 3 = Fable)
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

    // ─── Étape 2 (circuits) — en attente refonte doctrinale ──────────────────
    logger.info('Étape 2 (circuits) skipped — refonte doctrinale en cours', { candidat_id });

    // ─── Étape 3 (bilan) — via chaîne Fable, hors de ce fichier ──────────────
    logger.info('Étape 3 (bilan) — chaîne Fable, déclenchée par REPRENDRE_BILAN_FABLE', { candidat_id });

    // ─── Statut final ────────────────────────────────────────────────────────
    const totalElapsedMs = Date.now() - startTime;
    const totalCostUsd   = costs.reduce((s, c) => s + c, 0);

    await airtableService.resetTentativesEtape1(candidat_id);

    logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
    logger.info('🎉 Étape 1 completed (T1 only — étape 2 en refonte, étape 3 = Fable)', {
      candidat_id,
      mode,
      totalElapsedMs,
      totalElapsedSec:    (totalElapsedMs / 1000).toFixed(1),
      totalCostUsd:       totalCostUsd.toFixed(4),
      t1_rows:            t1Result.rows.length
    });
    logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

    return {
      success:        true,
      candidat_id,
      mode,
      totalCostUsd,
      totalElapsedMs,
      t1Result,
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
