// services/etape1/agentT1Service.js
// Agent T1 — Analyse brute des 25 réponses du candidat
// Profil-Cognitif v10.2b
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Rôle :
//   - Lit les 25 réponses brutes du candidat depuis RESPONSES (frontend)
//   - Appelle l'agent Claude T1 en 5 APPELS distincts (1 par scénario doctrinal)
//     • SOMMEIL  (Q1-Q5)   → 5 questions
//     • WEEKEND  (Q6-Q10)  → 5 questions
//     • ANIMAL_1 (Q11-Q15) → 5 questions
//     • ANIMAL_2 (Q16-Q20) → 5 questions  (découpé pour éviter max_tokens dépassé)
//     • PANNE    (Q21-Q25) → 5 questions
//   - Écrit les 25 lignes analysées dans ETAPE1_T1
//
// DOCTRINE APPLIQUÉE (cf. docs/CONTRAT_ETAPE1.md) :
//   - Pilier 1 : thinking activé (claude.js THINKING.agent_t1 = true)
//   - Pilier 2 : découpage par unité narrative (5 scénarios)
//   - Pilier 3 : raisonnement verbalisé exigé (champ raisonnement dans output)
//   - Pilier 5 : self-critique finale par scénario (instruction dans payload)
//   - Pilier 6 : vérificateur T1 appelé après (agentT1VerificateurService)
//   - Pilier 7 : log complet
//
// PHASE D (2026-04-28) — v10 :
//   - Déplacé dans services/etape1/ (Décision n°27)
//   - PROMPT_PATH mis à jour : 'etape1/etape1_t1.txt' (Décision n°27)
//   - Champ pilier_sortie RETIRÉ (Décision n°5 — D-A : pilier_sortie abandonné)
//   - Anonymisation Décision n°4 : DÉJÀ CONFORME — payload utilise candidat_id, jamais le prénom
//
// PHASE v10.2b (2026-05-03) — relances par scénario (Décision n°42) :
//   - Ajout runAgentT1ForScenario : exécution T1 sur 1 seul scénario
//     Réutilise callT1ForScenario interne. Strictement additif.
//     Utilisé par orchestratorEtape1 dans modes SCENARIO_ISOLÉ et SCENARIO_CASCADE.
//     Préparé pour Mode 2 auto du vérificateur (Phase v10.2c).

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const SERVICE_NAME = 'agent_t1';
const PROMPT_PATH  = 'etape1/etape1_t1.txt';  // ⭐ v10 : nouvelle hiérarchie

// ─── DÉFINITION DES SCÉNARIOS (unités narratives — Pilier 2 doctrine) ──────
const SCENARIOS = [
  { name: 'SOMMEIL',  questionRange: [1, 5],   expectedQuestions: 5 },
  { name: 'WEEKEND',  questionRange: [6, 10],  expectedQuestions: 5 },
  { name: 'ANIMAL_1', questionRange: [11, 15], expectedQuestions: 5 },
  { name: 'ANIMAL_2', questionRange: [16, 20], expectedQuestions: 5 },
  { name: 'PANNE',    questionRange: [21, 25], expectedQuestions: 5 }
];

/**
 * Exécute l'agent T1 pour un candidat — 5 appels par scénario
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {string} params.session_id
 * @returns {Promise<{rows: Array, usage: Object, cost: number, elapsedMs: number}>}
 */
async function runAgentT1({ candidat_id, session_id }) {
  const startTime = Date.now();
  logger.info('Agent T1 starting (DOCTRINAL — 5 scénarios)', { candidat_id, session_id });

  // 1. Lire les 25 réponses brutes
  const responses = await airtableService.getResponses(session_id);

  if (!responses || responses.length === 0) {
    throw new Error(`No responses found for session ${session_id}`);
  }

  if (responses.length < 25) {
    logger.warn('Responses count below 25', { candidat_id, count: responses.length });
  }

  // 2. Grouper les réponses par scénario
  const responsesByScenario = groupResponsesByScenario(responses);

  // 3. Appeler l'agent 5 fois (1 par scénario)
  const allRows = [];
  let totalUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  let totalCost  = 0;

  for (const scenario of SCENARIOS) {
    const scenarioResponses = responsesByScenario[scenario.name] || [];

    if (scenarioResponses.length === 0) {
      logger.warn(`No responses for scenario ${scenario.name}`, { candidat_id });
      continue;
    }

    if (scenarioResponses.length !== scenario.expectedQuestions) {
      logger.warn(`Unexpected number of responses for scenario ${scenario.name}`, {
        candidat_id,
        expected: scenario.expectedQuestions,
        actual:   scenarioResponses.length
      });
    }

    logger.info(`Agent T1 — calling for scenario ${scenario.name}`, {
      candidat_id,
      questions: scenarioResponses.length
    });

    const { rows, usage, cost } = await callT1ForScenario({
      candidat_id,
      scenario,
      responses: scenarioResponses
    });

    allRows.push(...rows);
    totalUsage.input_tokens             += usage.input_tokens || 0;
    totalUsage.output_tokens            += usage.output_tokens || 0;
    totalUsage.cache_read_input_tokens  += usage.cache_read_input_tokens || 0;
    totalUsage.cache_creation_input_tokens += usage.cache_creation_input_tokens || 0;
    totalCost += cost;

    logger.info(`Agent T1 — scenario ${scenario.name} done`, {
      candidat_id,
      rows:         rows.length,
      cost_usd:     cost.toFixed(4),
      ecarts:       rows.filter(r => r.conforme_ecart === 'ÉCART' || r.conforme_ecart === 'ECART').length
    });
  }

  const elapsedMs = Date.now() - startTime;

  if (allRows.length === 0) {
    throw new Error('Agent T1 returned no rows across all scenarios');
  }

  logger.info('Agent T1 produced rows (TOTAL across 5 scenarios)', {
    candidat_id,
    count:           allRows.length,
    ecarts_detected: allRows.filter(r => r.conforme_ecart === 'ÉCART' || r.conforme_ecart === 'ECART').length,
    total_cost_usd:  totalCost.toFixed(4),
    elapsedMs
  });

  // 4. Écrire dans ETAPE1_T1 (pattern d'écrasement)
  await airtableService.writeEtape1T1(candidat_id, allRows.map(normalizeRowForAirtable));

  return { rows: allRows, usage: totalUsage, cost: totalCost, elapsedMs };
}

// ─── APPEL T1 POUR UN SCÉNARIO ────────────────────────────────────────────
async function callT1ForScenario({ candidat_id, scenario, responses }) {
  // Construire le payload pour ce scénario uniquement
  // ⚠️ ANONYMISATION : aucun prénom, uniquement candidat_id (Décision n°4)
  const payload = {
    candidat_id,
    scenario_name:           scenario.name,
    nb_questions_in_scenario: responses.length,
    nb_questions_total:      25,
    instruction_doctrinale:  buildDoctrineInstruction(scenario),  // Pilier 3 + 5
    responses: responses.map(r => ({
      id_question:           r.id_question,
      numero_global:         r.numero_global,
      pilier:                r.pilier,
      scenario_nom:          r.scenario_nom,
      question_text:         r.question_text,
      response_text:         r.response_text,
      storytelling:          extractLookup(r['storytelling_general (from question _lien)']) || r.storytelling || '',
      transition:            extractLookup(r['transition_narrative (from question _lien)']) || r.transition || ''
    }))
  };

  // Appel Claude (thinking activé via claude.js THINKING.agent_t1 = true)
  const { result, usage, cost } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: false,
    candidatId:    candidat_id
  });

  const rows = extractRows(result, candidat_id);
  return { rows, usage, cost };
}

// ─── INSTRUCTION DOCTRINALE (Piliers 3 + 5) ───────────────────────────────
function buildDoctrineInstruction(scenario) {
  return `
ATTENTION — INSTRUCTIONS DOCTRINALES POUR CET APPEL :

Tu analyses UNIQUEMENT le scénario ${scenario.name} (questions ${scenario.questionRange[0]} à ${scenario.questionRange[1]}). Ne retourne PAS de lignes pour les autres scénarios.

Pilier 3 — RAISONNEMENT VERBALISÉ OBLIGATOIRE :
Pour CHAQUE question, tu dois inclure dans ta réponse JSON un champ "raisonnement" qui contient :
{
  "indices_verbatim": "ce que tu observes dans le verbatim",
  "regles_applicables": ["règles du prompt T1 que tu appliques"],
  "pieges_ecartes": "les confusions que tu évites (ex: Erreur 9 - ne pas confondre verbe avec angle d'attaque)",
  "decision_pilier_coeur": "P? — pourquoi",
  "decision_v1": "OUI/NON — pourquoi",
  "decision_conforme_ecart": "CONFORME/ECART — cohérent avec V1"
}

Pilier 5 — SELF-CRITIQUE FINALE OBLIGATOIRE :
Avant d'émettre ton JSON final, relis chaque ligne et vérifie :

1. COHÉRENCE V1 ↔ conforme_ecart
   - Si conforme_ecart = ECART, est-ce que V1 = NON ? (sinon corrige)
   - Si conforme_ecart = CONFORME, est-ce que V1 = OUI ? (sinon corrige)
   - V1=OUI → toujours CONFORME, sans exception
   - V1=NON → toujours ECART, sans exception

2. PILIER CŒUR
   - Pour chaque pilier_coeur = P3 : le candidat produit-il vraiment une analyse causale autonome ?
     Sinon (action conditionnelle, génération multiple, exécution), reformuler.
   - Vérifier l'Erreur 9 : ne pas confondre le premier verbe avec l'angle d'attaque.
   - Filtrer une source par crédibilité = P2 (pas P3 cœur).

3. SIGNAL LIMBIQUE
   - Pour chaque signal_limbique rempli, y a-t-il une vraie rupture émotionnelle vive ?
     Une simple préférence stylistique ("pas trop vulgarisateur") n'est PAS un signal.
     Une difficulté objective déclarée ("la pire partie") n'est PAS un signal.
     Effacer si pas de rupture émotionnelle vive.

4. COHÉRENCE INTERNE
   - Le pilier_coeur attribué correspond-il bien aux types_verbatim cités ?

Si tu détectes une incohérence, CORRIGE-LA avant d'émettre. N'émets jamais
un JSON contenant une violation de ces règles.

FORMAT DE SORTIE :
{
  "scenario_name": "${scenario.name}",
  "rows": [
    { ... ligne T1 complète avec raisonnement ... },
    ...
  ]
}

Retourne UNIQUEMENT le JSON, sans préambule, sans markdown.
  `.trim();
}

// ─── GROUPAGE PAR SCÉNARIO ────────────────────────────────────────────────
function groupResponsesByScenario(responses) {
  const grouped = { SOMMEIL: [], WEEKEND: [], ANIMAL_1: [], ANIMAL_2: [], PANNE: [] };

  for (const r of responses) {
    const scenarioName = (r.scenario_nom || '').toUpperCase().trim();
    const nq = parseInt(r.numero_global, 10);
    if (scenarioName === 'SOMMEIL')       grouped.SOMMEIL.push(r);
    else if (scenarioName === 'WEEKEND')  grouped.WEEKEND.push(r);
    else if (scenarioName === 'ANIMAL' || scenarioName === 'ANIMAL_1' || scenarioName === 'ANIMAL_2') {
      // Découpage par numero_global : Q11-15 → ANIMAL_1, Q16-20 → ANIMAL_2
      if (nq >= 11 && nq <= 15) grouped.ANIMAL_1.push(r);
      else if (nq >= 16 && nq <= 20) grouped.ANIMAL_2.push(r);
    }
    else if (scenarioName === 'PANNE')    grouped.PANNE.push(r);
    else {
      // Fallback : déduire du numero_global
      if (nq >= 1 && nq <= 5)        grouped.SOMMEIL.push(r);
      else if (nq >= 6 && nq <= 10)  grouped.WEEKEND.push(r);
      else if (nq >= 11 && nq <= 15) grouped.ANIMAL_1.push(r);
      else if (nq >= 16 && nq <= 20) grouped.ANIMAL_2.push(r);
      else if (nq >= 21 && nq <= 25) grouped.PANNE.push(r);
      else logger.warn('Cannot determine scenario for response', { id_question: r.id_question });
    }
  }

  // Trier chaque scénario par numero_global
  for (const name of Object.keys(grouped)) {
    grouped[name].sort((a, b) => (parseInt(a.numero_global, 10) || 0) - (parseInt(b.numero_global, 10) || 0));
  }

  return grouped;
}

// ─── EXTRACTION DES LIGNES (5 niveaux de tolérance) ───────────────────────
function extractRows(result, candidat_id) {
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.lignes)) return result.lignes;
  if (Array.isArray(result?.t1)) return result.t1;
  if (Array.isArray(result)) return result;
  if (result?.candidat_id && result?.id_question) {
    logger.warn('Agent T1 returned single object instead of array', { candidat_id });
    return [result];
  }

  logger.error('Unable to extract T1 rows from agent output', {
    candidat_id,
    keys: result ? Object.keys(result) : null
  });
  throw new Error('Agent T1 output format not recognized');
}

// ─── NORMALISATION POUR AIRTABLE ──────────────────────────────────────────
// ⚠️ v10 : pilier_sortie RETIRÉ (Décision n°5)
function normalizeRowForAirtable(row) {
  let conformeEcart = row.conforme_ecart || '';
  if (conformeEcart === 'ÉCART') conformeEcart = 'ECART';
  if (conformeEcart && conformeEcart !== 'CONFORME' && conformeEcart !== 'ECART') {
    logger.warn('Unexpected conforme_ecart value', { value: conformeEcart });
  }

  // Le champ raisonnement (Pilier 3) est un objet → on le sérialise pour Airtable
  let raisonnementStr = '';
  if (row.raisonnement) {
    raisonnementStr = typeof row.raisonnement === 'string'
      ? row.raisonnement
      : JSON.stringify(row.raisonnement, null, 2);
  }

  return {
    id_question:                   row.id_question || '',
    question_id_protocole:         row.question_id_protocole || '',
    scenario:                      row.scenario || '',
    pilier_demande:                row.pilier_demande || '',
    question_texte:                row.question_texte || '',
    storytelling:                  row.storytelling || '',
    transition:                    row.transition || '',
    verbatim_candidat:             row.verbatim_candidat || '',
    v1_conforme:                   row.v1_conforme || '',
    v2_traite_problematique:       row.v2_traite_problematique || '',
    verbes_observes:               row.verbes_observes || '',
    verbes_angles_piliers:         row.verbes_angles_piliers || '',
    pilier_coeur_analyse:          row.pilier_coeur_analyse || '',
    types_verbatim:                row.types_verbatim || '',
    piliers_secondaires:           row.piliers_secondaires || '',
    // ⛔ pilier_sortie : champ ABANDONNÉ en v10 (Décision n°5)
    finalite_reponse:              row.finalite_reponse || '',
    attribution_pilier_signal_brut: row.attribution_pilier_signal_brut || '',
    conforme_ecart:                conformeEcart,
    ecart_detail:                  row.ecart_detail || '',
    signal_limbique:               row.signal_limbique || '',
    raisonnement:                  raisonnementStr
  };
}

// ─── EXTRACTION LOOKUP ────────────────────────────────────────────────────
function extractLookup(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : '';
  }
  return String(value);
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v10.2b — runAgentT1ForScenario (Décision n°42)
// ═══════════════════════════════════════════════════════════════════════════
//
// Exécute T1 pour UN SEUL scénario. Réutilise callT1ForScenario interne.
// Strictement additif : aucune fonction existante modifiée.
//
// Usage :
//   - Statuts manuels Famille A (REPRENDRE_T1_<X>_SEUL) — Phase v10.2b
//   - Statuts manuels Famille B (REPRENDRE_T1_DES_<X>) — boucle dans orchestratorEtape1
//   - Mode 2 auto du vérificateur — Phase v10.2c (à venir)
//
// IMPORTANT : cette fonction ne fait PAS l'écriture Airtable ni la suppression
// préalable. Ces opérations sont gérées par l'orchestrateur via :
//   - airtableService.deleteEtape1T1Scenario (suppression ciblée)
//   - airtableService.writeEtape1T1Scenario  (écriture additive)
//
// Cela permet à l'orchestrateur de séquencer correctement et de garantir
// la cohérence atomique : delete + run + write, sans toucher aux 20 autres lignes.
//
// @param {Object} params
// @param {string} params.candidat_id
// @param {string} params.session_id    // typiquement = candidat_id
// @param {string} params.scenario_name // SOMMEIL | WEEKEND | ANIMAL_1 | ANIMAL_2 | PANNE
// @returns {Promise<{rows: Array, usage: Object, cost: number, elapsedMs: number}>}
async function runAgentT1ForScenario({ candidat_id, session_id, scenario_name }) {
  const startTime = Date.now();
  logger.info('Agent T1 starting (1 SCENARIO ISOLÉ)', { candidat_id, scenario_name });

  // 1. Validation entrée
  const scenario = SCENARIOS.find(s => s.name === scenario_name);
  if (!scenario) {
    throw new Error(
      `runAgentT1ForScenario — scenario_name invalide: "${scenario_name}". ` +
      `Attendu: ${SCENARIOS.map(s => s.name).join(', ')}`
    );
  }

  // 2. Lire les 25 réponses brutes
  const responses = await airtableService.getResponses(session_id);
  if (!responses || responses.length === 0) {
    throw new Error(`No responses found for session ${session_id}`);
  }

  // 3. Filtrer les 5 réponses du scénario
  const responsesByScenario = groupResponsesByScenario(responses);
  const scenarioResponses = responsesByScenario[scenario_name] || [];

  if (scenarioResponses.length === 0) {
    throw new Error(`No responses for scenario ${scenario_name} (candidat ${candidat_id})`);
  }
  if (scenarioResponses.length !== 5) {
    logger.warn('runAgentT1ForScenario — nombre de réponses inattendu (attendu: 5)', {
      candidat_id, scenario_name, count: scenarioResponses.length
    });
  }

  // 4. Appel Claude (réutilise callT1ForScenario interne — code éprouvé)
  const { rows, usage, cost } = await callT1ForScenario({
    candidat_id,
    scenario,
    responses: scenarioResponses
  });

  const elapsedMs = Date.now() - startTime;
  logger.info('Agent T1 (SCENARIO ISOLÉ) done', {
    candidat_id,
    scenario_name,
    rows: rows.length,
    cost_usd: cost.toFixed(4),
    ecarts: rows.filter(r => r.conforme_ecart === 'ÉCART' || r.conforme_ecart === 'ECART').length,
    elapsedMs
  });

  return { rows, usage, cost, elapsedMs };
}

module.exports = {
  runAgentT1,
  runAgentT1ForScenario,  // ⭐ v10.2b (Décision n°42)
  // exports techniques pour tests/debug
  extractRows,
  normalizeRowForAirtable,
  extractLookup,
  groupResponsesByScenario,
  buildDoctrineInstruction,
  SCENARIOS
};
