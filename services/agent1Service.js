// services/agent1Service.js
// Agent 1 v8.1 — Observateur cognitif
// Prompt : agent1_v2.txt (version 10.3)
// Architecture : 25 appels indépendants (1/question) + 1 appel final (Sections A/B/C + rapport)
// Écriture RESPONSES (×25) : analyse_json_agent1 + champs plats
// Écriture BILAN (×1)      : moteur_cognitif, binome_actif, reaction_flou, signature_cloture,
//                            agent1_rapport, pattern_emergent
//
// CORRECTION v8.1 :
// - pattern_emergent (Section C) ajouté dans l'écriture BILAN
//   → était produit par l'appel corpus, parsé, mais jamais écrit dans Airtable

'use strict';

const fs = require('fs').promises;
const path = require('path');
const claudeService = require('./claudeService');
const airtableService = require('./airtableService');
const logger = require('../utils/logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Cache du prompt (chargé une seule fois par process)
let cachedPrompt = null;

// ═══════════════════════════════════════════════════════════════════════════
// CHARGEMENT DU PROMPT
// ═══════════════════════════════════════════════════════════════════════════

async function loadPrompt() {
  if (cachedPrompt) return cachedPrompt;
  try {
    const promptPath = path.join(__dirname, '../prompts/agent1_v2.txt');
    cachedPrompt = await fs.readFile(promptPath, 'utf8');
    logger.info('Agent 1: prompt chargé', { length: cachedPrompt.length });
    return cachedPrompt;
  } catch (error) {
    logger.error('Agent 1: échec chargement prompt', { error: error.message });
    throw new Error('Prompt introuvable : prompts/agent1_v2.txt');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSE D'UNE QUESTION (1 appel API)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Analyser une seule réponse candidat.
 * @param {string} session_id
 * @param {Object} question - { id_question, scenario_nom, pilier, question_text, response_text, numero_global }
 * @returns {Object} { id_question, result: Object (JSON agent1), cost }
 */
async function analyzeQuestion(session_id, question) {
  const systemPrompt = await loadPrompt();
  const userPrompt = buildQuestionPrompt(question);

  logger.info('Agent 1: analyse question', {
    session_id,
    id_question: question.id_question,
    pilier: question.pilier,
    scenario: question.scenario_nom
  });

  const response = await claudeService.callClaude({
    systemPrompt,
    userPrompt,
    service: 'agent1',
    maxTokens: 3000
  });

  const parsed = claudeService.parseClaudeJSON(response.content);

  if (!parsed || !parsed.pilier_coeur) {
    throw new Error(`Agent 1: réponse invalide pour ${question.id_question} — champ pilier_coeur manquant`);
  }

  return {
    id_question: question.id_question,
    result: parsed,
    cost: response.cost || 0
  };
}

/**
 * Construire le prompt utilisateur pour une question unique.
 */
function buildQuestionPrompt(question) {
  return `Analyse la réponse suivante et produis le JSON demandé dans le prompt système.

---
Question : ${question.id_question} | Pilier : ${question.pilier} | Scénario : ${question.scenario_nom}

Texte de la question :
${question.question_text}

Réponse du candidat :
${question.response_text}
---

Produis UNIQUEMENT le JSON de l'output par question tel que défini dans le prompt système. Pas de commentaire avant ou après.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// APPEL FINAL — SECTIONS A/B/C + RAPPORT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Appel final après les 25 questions : produit Sections A/B/C et agent1_rapport.
 * @param {string} session_id
 * @param {Object} candidat - { prenom, nom }
 * @param {Array} analyses25 - tableau des 25 résultats JSON
 * @returns {Object} { section_A, section_B, section_C, agent1_rapport, cost }
 */
async function analyzeCorpus(session_id, candidat, analyses25) {
  const systemPrompt = await loadPrompt();
  const userPrompt = buildCorpusPrompt(session_id, candidat, analyses25);

  logger.info('Agent 1: appel final corpus', { session_id, nb_questions: analyses25.length });

  const response = await claudeService.callClaude({
    systemPrompt,
    userPrompt,
    service: 'agent1_final',
    maxTokens: 6000
  });

  const parsed = claudeService.parseClaudeJSON(response.content);

  if (!parsed || !parsed.section_B_mode_operatoire) {
    throw new Error('Agent 1: réponse finale invalide — section_B_mode_operatoire manquante');
  }

  return {
    section_A:      parsed.section_A_stats_piliers      || {},
    section_B:      parsed.section_B_mode_operatoire    || {},
    section_C:      parsed.section_C_pattern_emergent   || '',
    agent1_rapport: parsed.agent1_rapport               || '',
    cost:           response.cost || 0
  };
}

/**
 * Construire le prompt utilisateur pour l'appel final corpus.
 */
function buildCorpusPrompt(session_id, candidat, analyses25) {
  const corpusJson = JSON.stringify(analyses25, null, 2);

  return `Tu as terminé l'analyse des 25 questions du candidat ${candidat.prenom} ${candidat.nom} (session : ${session_id}).

Voici les 25 JSON produits question par question :

${corpusJson}

---

À partir de ce corpus, produis UNIQUEMENT le JSON de la section finale (après les 25 questions) tel que défini dans le prompt système :
- section_A_stats_piliers : stats par pilier P1 à P5 (nb_coeur, nb_boucles, niveau_plancher, niveau_plafond, moyenne_niveaux, moyenne_top3, intrusions)
- section_B_mode_operatoire : moteur_cognitif, binome_actif, reaction_flou, signature_cloture
- section_C_pattern_emergent : pattern comportemental observable (texte)
- agent1_rapport : tableau lisible des 25 questions + écarts + stats + mode opératoire (format texte structuré pour Airtable)

Format JSON attendu :
{
  "section_A_stats_piliers": { "P1": {...}, "P2": {...}, "P3": {...}, "P4": {...}, "P5": {...} },
  "section_B_mode_operatoire": {
    "moteur_cognitif": "...",
    "binome_actif": "...",
    "reaction_flou": "...",
    "signature_cloture": "..."
  },
  "section_C_pattern_emergent": "...",
  "agent1_rapport": "..."
}

Produis UNIQUEMENT ce JSON. Pas de commentaire avant ou après.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pipeline complet Agent 1 pour un candidat.
 * Étape 1 : 25 appels question par question → écriture dans RESPONSES
 * Étape 2 : 1 appel final corpus → écriture dans BILAN
 *
 * @param {string} session_id
 * @param {Object} candidat - { prenom, nom }
 * @param {Array} questions - 25 questions
 * @returns {Object} { analyses, corpus, totalCost }
 */
async function run(session_id, candidat, questions) {
  if (!questions || questions.length !== 25) {
    throw new Error(`Agent 1: attendu 25 questions, reçu ${questions?.length ?? 0}`);
  }

  logger.info('Agent 1: démarrage pipeline', { session_id, candidat: `${candidat.prenom} ${candidat.nom}` });

  const analyses = [];
  let totalCost = 0;

  // ── ÉTAPE 1 : 25 appels indépendants ──────────────────────────────────────
  // Reprise intra-étape : ignorer les questions déjà analysées
  const questionsRestantes = questions.filter(q => !q.analyse_json_agent1);
  if (questionsRestantes.length < questions.length) {
    logger.info('Agent 1: reprise intra-étape', {
      session_id,
      deja_faites: questions.length - questionsRestantes.length,
      restantes: questionsRestantes.length
    });
    const analysesExistantes = questions
      .filter(q => q.analyse_json_agent1)
      .map(q => ({ id_question: q.id_question, result: safeParseJSON(q.analyse_json_agent1) }));
    analyses.push(...analysesExistantes);
  }

  for (let i = 0; i < questionsRestantes.length; i++) {
    const question = questionsRestantes[i];

    let result;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        result = await analyzeQuestion(session_id, question);
        break;
      } catch (error) {
        attempts++;
        logger.warn(`Agent 1: erreur question ${question.id_question} (tentative ${attempts}/${maxAttempts})`, {
          error: error.message
        });
        if (attempts >= maxAttempts) {
          throw new Error(`Agent 1: échec définitif question ${question.id_question} après ${maxAttempts} tentatives : ${error.message}`);
        }
        await sleep(2000 * attempts);
      }
    }

    analyses.push({ id_question: question.id_question, result: result.result });
    totalCost += result.cost;

    // Écriture immédiate dans RESPONSES
    const r = result.result;
    const a1Fields = {
      analyse_json_agent1:     JSON.stringify(r),
      question_analysee:       true,
      pilier_reponse_coeur:    r.pilier_coeur                    || null,
      niveau_amplitude_reponse: r.niveau_coeur != null ? String(r.niveau_coeur) : null,
      liste_piliers_actives:   r.sequence                        || null,
      piliers_actives_final:   r.piliers_actives ? JSON.stringify(r.piliers_actives) : null
    };

    if (r.boucles && r.boucles.length > 0) {
      a1Fields.boucles_detectees_agent1 = r.boucles.map(b => `${b.pilier}(N${b.niveau})`).join(', ');
      a1Fields.nombre_boucles_agent1    = r.boucles.length;
    }

    await airtableService.updateResponse(question.id_question, session_id, a1Fields);

    logger.info(`Agent 1: question ${i + 1}/${questionsRestantes.length} traitée`, {
      session_id,
      id_question:  question.id_question,
      pilier_coeur: r.pilier_coeur,
      niveau_coeur: r.niveau_coeur,
      conforme:     r.conforme
    });

    if (i < questions.length - 1) {
      await sleep(1000);
    }
  }

  logger.info('Agent 1: 25 questions traitées', { session_id, totalCost: totalCost.toFixed(4) });

  // ── ÉTAPE 2 : Appel final corpus ──────────────────────────────────────────
  await sleep(1000);

  let corpus;
  let corpusAttempts = 0;
  const maxCorpusAttempts = 3;

  while (corpusAttempts < maxCorpusAttempts) {
    try {
      corpus = await analyzeCorpus(session_id, candidat, analyses.map(a => a.result));
      break;
    } catch (error) {
      corpusAttempts++;
      logger.warn(`Agent 1: erreur appel final (tentative ${corpusAttempts}/${maxCorpusAttempts})`, {
        error: error.message
      });
      if (corpusAttempts >= maxCorpusAttempts) {
        throw new Error(`Agent 1: échec définitif appel final : ${error.message}`);
      }
      await sleep(3000 * corpusAttempts);
    }
  }

  totalCost += corpus.cost;

  // Écriture dans BILAN — tous les champs produits par l'appel corpus
  await airtableService.updateBilan(session_id, {
    moteur_cognitif:   corpus.section_B.moteur_cognitif   || null,
    binome_actif:      corpus.section_B.binome_actif       || null,
    reaction_flou:     corpus.section_B.reaction_flou      || null,
    signature_cloture: corpus.section_B.signature_cloture  || null,
    agent1_rapport:    corpus.agent1_rapport               || null,
    pattern_emergent:  corpus.section_C                    || null   // CORRECTION v8.1 — était produit mais non écrit
  });

  logger.info('Agent 1: pipeline terminé', {
    session_id,
    questions_traitees: analyses.length,
    totalCost: totalCost.toFixed(4)
  });

  return {
    analyses,  // Array de { id_question, result } — utilisé par le Vérificateur
    corpus,    // { section_A, section_B, section_C, agent1_rapport }
    totalCost
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

function safeParseJSON(v) { if (!v) return null; if (typeof v === "object") return v; try { return JSON.parse(v); } catch { return null; } }

module.exports = {
  run,
  analyzeQuestion,  // exposé pour retry granulaire
  analyzeCorpus     // exposé pour tests
};
