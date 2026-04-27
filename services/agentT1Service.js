// services/agentT1Service.js
// Agent T1 — Analyse brute des 25 réponses du candidat
// Profil-Cognitif v9.1 — DOCTRINE DE PROMPTING APPLIQUÉE (Lot 17)
//
// Rôle :
//   - Lit les 25 réponses brutes du candidat depuis RESPONSES (frontend)
//   - Appelle l'agent Claude T1 en 4 APPELS distincts (1 par scénario)
//     • SOMMEIL (Q1-Q5)   → 5 questions
//     • WEEKEND (Q6-Q10)  → 5 questions
//     • ANIMAL  (Q11-Q20) → 10 questions
//     • PANNE   (Q21-Q25) → 5 questions
//   - Écrit les 25 lignes analysées dans ETAPE1_T1
//
// DOCTRINE APPLIQUÉE (cf. DOCTRINE_PROMPTING_PROFIL_COGNITIF.md) :
//   - Pilier 1 : thinking activé (claude.js THINKING.agent_t1 = true)
//   - Pilier 2 : découpage par unité narrative (4 scénarios)
//   - Pilier 3 : raisonnement verbalisé exigé (champ raisonnement dans output)
//   - Pilier 5 : self-critique finale par scénario (instruction dans payload)
//   - Pilier 6 : certificateur T1 appelé après (agentT1CertificateurService)
//   - Pilier 7 : log complet dans LOG_AGENT_CALLS (via agentBase)

'use strict';

const agentBase       = require('./agentBase');
const airtableService = require('./airtableService');
const logger          = require('../utils/logger');

const SERVICE_NAME = 'agent_t1';
const PROMPT_PATH  = 'etape1_t1.txt';

// ─── DÉFINITION DES SCÉNARIOS (unités narratives — Pilier 2 doctrine) ──────
const SCENARIOS = [
  { name: 'SOMMEIL',  questionRange: [1, 5],   expectedQuestions: 5 },
  { name: 'WEEKEND',  questionRange: [6, 10],  expectedQuestions: 5 },
  { name: 'ANIMAL_1', questionRange: [11, 15], expectedQuestions: 5 },
  { name: 'ANIMAL_2', questionRange: [16, 20], expectedQuestions: 5 },
  { name: 'PANNE',    questionRange: [21, 25], expectedQuestions: 5 }
];

/**
 * Exécute l'agent T1 pour un candidat — 4 appels par scénario
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {string} params.session_id
 * @returns {Promise<{rows: Array, usage: Object, cost: number, elapsedMs: number}>}
 */
async function runAgentT1({ candidat_id, session_id }) {
  const startTime = Date.now();
  logger.info('Agent T1 starting (DOCTRINAL — 4 scénarios)', { candidat_id, session_id });

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

  // 3. Appeler l'agent 4 fois (1 par scénario) avec attente entre appels
  //    pour respecter la cohérence narrative
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

  logger.info('Agent T1 produced rows (TOTAL across 4 scenarios)', {
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
  const payload = {
    candidat_id,
    scenario_name:           scenario.name,
    nb_questions_in_scenario: responses.length,
    nb_questions_total:      25,  // pour info
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

  // Extraire les lignes du résultat
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

// ─── EXTRACTION DES LIGNES ────────────────────────────────────────────────
function extractRows(result, candidat_id) {
  // Cas 1 : { scenario_name: "...", rows: [...] }
  if (Array.isArray(result?.rows)) return result.rows;

  // Cas 2 : { lignes: [...] }
  if (Array.isArray(result?.lignes)) return result.lignes;

  // Cas 3 : { t1: [...] }
  if (Array.isArray(result?.t1)) return result.t1;

  // Cas 4 : array direct
  if (Array.isArray(result)) return result;

  // Cas 5 : objet avec un seul candidat
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
function normalizeRowForAirtable(row) {
  let conformeEcart = row.conforme_ecart || '';
  if (conformeEcart === 'ÉCART') conformeEcart = 'ECART';
  if (conformeEcart && conformeEcart !== 'CONFORME' && conformeEcart !== 'ECART') {
    logger.warn('Unexpected conforme_ecart value', { value: conformeEcart });
  }

  // Le champ raisonnement (Pilier 3) est un objet → on le sérialise pour Airtable
  // (Airtable n'accepte pas d'objet, il faut une string)
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
    pilier_sortie:                 row.pilier_sortie || '',
    finalite_reponse:              row.finalite_reponse || '',
    attribution_pilier_signal_brut: row.attribution_pilier_signal_brut || '',
    conforme_ecart:                conformeEcart,
    ecart_detail:                  row.ecart_detail || '',
    signal_limbique:               row.signal_limbique || '',
    raisonnement:                  raisonnementStr  // ⭐ NOUVEAU CHAMP DOCTRINAL
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

module.exports = {
  runAgentT1,
  // exports techniques pour tests/debug
  extractRows,
  normalizeRowForAirtable,
  extractLookup,
  groupResponsesByScenario,
  buildDoctrineInstruction,
  SCENARIOS
};
