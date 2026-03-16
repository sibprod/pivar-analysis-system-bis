// services/verificateurService.js
// Vérificateur v8.0 — Arbitrage des attributions Agent 1
// Prompt : verificateur_v2.txt (version 2.0)
// Architecture : 25 appels indépendants (1/question)
// Écriture : champs arbitrés dans RESPONSES × 25

'use strict';

const fs = require('fs').promises;
const path = require('path');
const claudeService = require('./claudeService');
const airtableService = require('./airtableService');
const logger = require('../utils/logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let cachedPrompt = null;

// ═══════════════════════════════════════════════════════════════════════════
// CHARGEMENT DU PROMPT
// ═══════════════════════════════════════════════════════════════════════════

async function loadPrompt() {
  if (cachedPrompt) return cachedPrompt;
  try {
    const promptPath = path.join(__dirname, '../prompts/verificateur_v2.txt');
    cachedPrompt = await fs.readFile(promptPath, 'utf8');
    logger.info('Vérificateur: prompt chargé', { length: cachedPrompt.length });
    return cachedPrompt;
  } catch (error) {
    logger.error('Vérificateur: échec chargement prompt', { error: error.message });
    throw new Error('Prompt introuvable : prompts/verificateur_v2.txt');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ARBITRAGE D'UNE QUESTION (1 appel API)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Arbitrer l'attribution Agent 1 pour une question.
 * @param {string} session_id
 * @param {Object} question - { id_question, scenario_nom, pilier, question_text, response_text }
 * @param {Object} agent1Result - JSON produit par Agent 1 pour cette question
 * @returns {Object} { id_question, result: Object (JSON vérificateur), cost }
 */
async function arbitrateQuestion(session_id, question, agent1Result) {
  const systemPrompt = await loadPrompt();
  const userPrompt = buildQuestionPrompt(question, agent1Result);

  logger.info('Vérificateur: arbitrage question', {
    session_id,
    id_question: question.id_question,
    pilier_coeur_agent1: agent1Result.pilier_coeur,
    niveau_coeur_agent1: agent1Result.niveau_coeur
  });

  const response = await claudeService.callClaude({
    systemPrompt,
    userPrompt,
    service: 'verificateur',
    maxTokens: 3000
  });

  const parsed = claudeService.parseClaudeJSON(response.content);

  if (!parsed || !parsed.verificateur_arbitrage || !parsed.verificateur_arbitrage.pilier_coeur_final) {
    throw new Error(`Vérificateur: réponse invalide pour ${question.id_question} — pilier_coeur_final manquant`);
  }

  return {
    id_question: question.id_question,
    result: parsed,
    cost: response.cost || 0
  };
}

/**
 * Construire le prompt utilisateur pour une question.
 */
function buildQuestionPrompt(question, agent1Result) {
  return `Arbitre l'attribution suivante de l'Agent 1 et produis le JSON demandé dans le prompt système.

---
Question : ${question.id_question} | Pilier question : ${question.pilier} | Scénario : ${question.scenario_nom}

Texte de la question :
${question.question_text}

Verbatim du candidat :
${question.response_text}

Attribution Agent 1 :
${JSON.stringify({
  pilier_coeur: agent1Result.pilier_coeur,
  niveau_coeur: agent1Result.niveau_coeur,
  boucles: agent1Result.boucles || [],
  sequence: agent1Result.sequence || '',
  piliers_actives: agent1Result.piliers_actives || [],
  justification: agent1Result.justification || '',
  difficulte_signalee: agent1Result.difficulte_signalee || 'aucune'
}, null, 2)}
---

Produis UNIQUEMENT le JSON de l'output par question tel que défini dans le prompt système. Pas de commentaire avant ou après.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DES CHAMPS AIRTABLE DEPUIS LE JSON VÉRIFICATEUR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapper le JSON vérificateur vers les champs plats Airtable RESPONSES.
 * @param {Object} parsed - JSON brut produit par le Vérificateur
 * @returns {Object} champs prêts pour updateResponse
 */
function mapToAirtableFields(parsed) {
  const arbitrage = parsed.verificateur_arbitrage || {};

  return {
    // Pilier et niveau arbitrés finaux
    pilier_reponse_coeur:               arbitrage.pilier_coeur_final || null,
    verification_coeur:                 arbitrage.justification_arbitrage || null,
    coherence:                          parsed.verificateur_statut || null,
    pilier_reponse_coeur_confirme:      arbitrage.pilier_coeur_final || null,
    justification_attribution_pilier_coeur: arbitrage.justification_arbitrage || null,
    circuits_actives_pilier_coeur:      JSON.stringify(parsed.piliers_actives || []),
    justification_actions_majoritairement_faites: arbitrage.reserve_eventuelle || null,
    justification_attribution_niveau:   arbitrage.difficulte_referentiel || null,

    // Qualification de la réponse
    repond_question:                    parsed.repond_question || null,
    traite_problematique_situation:     parsed.traite_problematique_situation || null,
    fait_processus_pilier:              parsed.fait_processus_pilier || null,

    // Cohérence inter-agents (statut du vérificateur = CONFIRMÉ/CORRIGÉ/MAINTENU_AVEC_RÉSERVE)
    coherence_agents:                   parsed.verificateur_statut || null
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pipeline complet Vérificateur pour un candidat.
 * 25 appels indépendants → écriture des champs arbitrés dans RESPONSES.
 *
 * @param {string} session_id
 * @param {Array} questions - 25 questions avec { id_question, scenario_nom, pilier, question_text, response_text }
 * @param {Array} agent1Analyses - résultats Agent 1 : Array de { id_question, result }
 * @returns {Object} { arbitrages: Array<{id_question, result}>, totalCost }
 */
async function run(session_id, questions, agent1Analyses) {
  if (!questions || questions.length !== 25) {
    throw new Error(`Vérificateur: attendu 25 questions, reçu ${questions?.length ?? 0}`);
  }
  if (!agent1Analyses || agent1Analyses.length !== 25) {
    throw new Error(`Vérificateur: attendu 25 analyses Agent 1, reçu ${agent1Analyses?.length ?? 0}`);
  }

  // Indexer les analyses Agent 1 par id_question pour lookup rapide
  const agent1ByQuestion = {};
  for (const a of agent1Analyses) {
    agent1ByQuestion[a.id_question] = a.result;
  }

  logger.info('Vérificateur: démarrage pipeline', { session_id });

  const arbitrages = [];
  let totalCost = 0;

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const agent1Result = agent1ByQuestion[question.id_question];

    if (!agent1Result) {
      throw new Error(`Vérificateur: analyse Agent 1 introuvable pour ${question.id_question}`);
    }

    let result;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        result = await arbitrateQuestion(session_id, question, agent1Result);
        break;
      } catch (error) {
        attempts++;
        logger.warn(`Vérificateur: erreur ${question.id_question} (tentative ${attempts}/${maxAttempts})`, {
          error: error.message
        });
        if (attempts >= maxAttempts) {
          throw new Error(`Vérificateur: échec définitif ${question.id_question} : ${error.message}`);
        }
        await sleep(2000 * attempts);
      }
    }

    arbitrages.push({ id_question: question.id_question, result: result.result });
    totalCost += result.cost;

    // Écriture immédiate dans RESPONSES
    const fields = mapToAirtableFields(result.result);
    await airtableService.updateResponse(question.id_question, session_id, fields);

    const arbitrage = result.result.verificateur_arbitrage || {};
    logger.info(`Vérificateur: question ${i + 1}/25 arbitrée`, {
      session_id,
      id_question: question.id_question,
      statut: result.result.verificateur_statut,
      pilier_coeur_final: arbitrage.pilier_coeur_final,
      niveau_coeur_final: arbitrage.niveau_coeur_final
    });

    if (i < questions.length - 1) {
      await sleep(1000);
    }
  }

  logger.info('Vérificateur: pipeline terminé', {
    session_id,
    arbitrages: arbitrages.length,
    totalCost: totalCost.toFixed(4)
  });

  return {
    arbitrages,  // Array de { id_question, result } — utilisé par Agent 2 et Agent 3
    totalCost
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  run,
  arbitrateQuestion  // exposé pour retry granulaire depuis orchestrateur
};
