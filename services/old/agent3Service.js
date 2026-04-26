// services/agent3Service.js
// Agent 3 v8.1 — Circuits & Vérification
// Prompt : agent3_v2.txt
// Architecture : 25 appels question (M0, M2, M5A, M6) + 5 appels synthèse pilier (M5B, M7)
// Input : outputs fusionnés Agent1 + Vérificateur + Agent2
// Écriture : analyse_json_agent3 + champs plats dans RESPONSES × 25
//            circuits_top3_PX, boucles_detectees_pilier_PX, lecture_cognitive_enrichie_PX,
//            profil_neuroscientifique_PX, limbique_*, coherence_agents dans BILAN
//
// CORRECTIONS + SÉCURISATIONS v8.1 — audit 19/03/2026 :
// - limbique_detecte BILAN : 'oui'/'non' → 'vrai'/'non' (options Airtable confirmées MCP)
// - liste_piliers_actives : retiré du mapping RESPONSES — Agent 3 ne doit PAS écraser
//   la valeur écrite par le Vérificateur (séquence arbitrée finale)
// - normalizeCoherence() : sécurisation valeurs TOTALE/PARTIELLE/FAIBLE
// - normalizeLimbiqueIntens() : sécurisation intensite_max avant écriture BILAN
// - safeString() / safeNumber() : helpers défensifs
// - try/catch global sur mapToAirtableFieldsQuestion et mapToAirtableFieldsBilan
// - vérification session_id + inputs obligatoires en entrée de run()

'use strict';

const fs              = require('fs').promises;
const path            = require('path');
const claudeService   = require('./claudeService');
const airtableService = require('./airtableService');
const logger          = require('../utils/logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const PILIERS = ['P1', 'P2', 'P3', 'P4', 'P5'];

// ═══════════════════════════════════════════════════════════════════════════
// CHARGEMENT DU PROMPT
// ═══════════════════════════════════════════════════════════════════════════

let cachedPrompt = null;

async function loadPrompt() {
  if (cachedPrompt) return cachedPrompt;
  try {
    const promptPath = path.join(__dirname, '../prompts/agent3_v2.txt');
    cachedPrompt = await fs.readFile(promptPath, 'utf8');
    logger.info('Agent 3: prompt chargé', { length: cachedPrompt.length });
    return cachedPrompt;
  } catch (error) {
    logger.error('Agent 3: échec chargement prompt', { error: error.message });
    throw new Error('Prompt introuvable : prompts/agent3_v2.txt');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS DÉFENSIFS — v8.1
// ═══════════════════════════════════════════════════════════════════════════

function safeString(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' && !isNaN(v)) return String(v);
  return null;
}

function safeNumber(v, defaultVal = 0) {
  const n = Number(v);
  return isNaN(n) ? defaultVal : Math.round(n);
}

/**
 * Normalise coherence_agent1_agent3 et coherence_agents.
 * Options Airtable confirmées MCP : TOTALE / PARTIELLE / FAIBLE
 */
function normalizeCoherence(v) {
  if (!v) return null;
  const n = v.toString().toUpperCase().trim();
  if (n === 'TOTALE')    return 'TOTALE';
  if (n === 'PARTIELLE') return 'PARTIELLE';
  if (n === 'FAIBLE')    return 'FAIBLE';
  logger.warn(`Agent 3: coherence non reconnue : "${v}" → null`);
  return null;
}

/**
 * Normalise limbique_intensite_max pour BILAN.
 * Options Airtable confirmées MCP : aucune / faible / modérée / forte
 */
function normalizeLimbiqueIntens(v) {
  if (!v) return 'aucune';
  const n = v.toString().toLowerCase().trim();
  if (['aucune', 'aucun', 'none'].includes(n))                                   return 'aucune';
  if (n === 'faible')                                                             return 'faible';
  if (n.includes('modér') || n.includes('moder'))                                return 'modérée';
  if (['forte', 'fort', 'élevée'].includes(n))                                   return 'forte';
  logger.warn(`Agent 3: limbique_intensite_max non reconnue : "${v}" → aucune`);
  return 'aucune';
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSE D'UNE QUESTION — M0, M2, M5A, M6 (1 appel API)
// ═══════════════════════════════════════════════════════════════════════════

async function analyzeQuestion(session_id, question, verifResult, agent2Result) {
  const systemPrompt = await loadPrompt();
  const userPrompt   = buildQuestionPrompt(question, verifResult, agent2Result);

  logger.info('Agent 3: analyse question', { session_id, id_question: question.id_question });

  const response = await claudeService.callClaude({
    systemPrompt,
    userPrompt,
    service:   'agent3',
    maxTokens: 4000
  });

  const parsed = claudeService.parseClaudeJSON(response.content);

  if (!parsed || !parsed.agent3_verification) {
    throw new Error(`Agent 3: réponse invalide pour ${question.id_question} — agent3_verification manquant`);
  }
  if (!parsed.agent3_verification.mission_6_donnees_algo) {
    throw new Error(`Agent 3: mission_6_donnees_algo manquante pour ${question.id_question}`);
  }

  return { id_question: question.id_question, result: parsed, cost: response.cost || 0 };
}

function buildQuestionPrompt(question, verifResult, agent2Result) {
  const arbitrage = verifResult.verificateur_arbitrage || {};
  const mesure    = agent2Result.agent2_mesure || {};
  const m4 = mesure.mission_4_dimensions_simples?.par_pilier || {};
  const m5 = mesure.mission_5_dimensions_sophistiquees?.par_pilier || {};
  const m6 = mesure.mission_6_excellences || {};
  const m7 = mesure.mission_7_amplitude?.par_pilier || {};
  const m8 = mesure.mission_8_lecture_cognitive || {};

  const piliersCombines = new Set([
    ...(verifResult.piliers_actives || []),
    ...Object.keys(m4),
    ...Object.keys(m5)
  ]);
  const dimensionsParPilier = {};
  for (const p of piliersCombines) {
    dimensionsParPilier[p] = {
      simples:      m4[p]?.total || 0,
      sophistiquees: m5[p]?.total || 0
    };
  }

  const inputData = {
    question:           question.id_question,
    scenario:           question.scenario_nom,
    pilier_question:    question.pilier,
    verbatim:           question.response_text,
    pilier_coeur_final: arbitrage.pilier_coeur_final || null,
    niveau_coeur_final: arbitrage.niveau_coeur_final || null,
    piliers_actives:    verifResult.piliers_actives  || [],
    boucles_finales:    verifResult.boucles_finales  || [],
    sequence_finale:    verifResult.sequence_finale  || '',
    dimensions_par_pilier: dimensionsParPilier,
    excellences: {
      anticipation:   m6.anticipation_niveau?.niveau   || 'nulle',
      decentration:   m6.decentration_niveau?.niveau   || 'nulle',
      metacognition:  m6.metacognition_niveau?.niveau  || 'nulle',
      vue_systemique: m6.vue_systemique_niveau?.niveau || 'nulle'
    },
    amplitude_par_pilier: Object.fromEntries(
      Object.entries(m7).map(([p, d]) => [p, d.amplitude || null])
    ),
    limbique: {
      detecte:  m8.limbique_detecte  || false,
      intensite: m8.limbique_intensite || 'aucune'
    }
  };

  return `Analyse la question suivante (missions M0, M2, M5A et M6) et produis le JSON demandé dans le prompt système.

---
Texte de la question :
${question.question_text}

Données transmises (Agent 1 + Vérificateur + Agent 2) :
${JSON.stringify(inputData, null, 2)}
---

Produis UNIQUEMENT le JSON complet agent3_verification (missions M0, M2, M5A, M6) tel que défini dans le prompt système. Inclure obligatoirement mission_6_donnees_algo. Pas de commentaire avant ou après.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNTHÈSE PAR PILIER — M5B, M7 (1 appel API par pilier)
// ═══════════════════════════════════════════════════════════════════════════

async function synthesePilier(session_id, pilier, questionsResultsPilier) {
  const systemPrompt = await loadPrompt();
  const userPrompt   = buildSynthesePrompt(pilier, questionsResultsPilier);

  logger.info('Agent 3: synthèse pilier', { session_id, pilier, nb: questionsResultsPilier.length });

  const response = await claudeService.callClaude({
    systemPrompt,
    userPrompt,
    service:   'agent3_synthese',
    maxTokens: 4000
  });

  const parsed = claudeService.parseClaudeJSON(response.content);

  if (!parsed || !parsed.mission_5B_synthese) {
    throw new Error(`Agent 3: synthèse invalide pour ${pilier} — mission_5B_synthese manquante`);
  }
  if (!parsed.mission_7_bilan_certificateur) {
    throw new Error(`Agent 3: synthèse invalide pour ${pilier} — mission_7_bilan_certificateur manquante`);
  }

  return { pilier, synthese: parsed, cost: response.cost || 0 };
}

function buildSynthesePrompt(pilier, questionsResultsPilier) {
  const corpusJson = JSON.stringify(
    questionsResultsPilier.map(qr => qr.result?.agent3_verification || qr.result),
    null, 2
  );

  return `Tu as analysé les ${questionsResultsPilier.length} questions du pilier ${pilier}.

Voici les JSON produits pour ces questions :

${corpusJson}

---

Produis maintenant la SYNTHÈSE TRANSVERSALE du pilier ${pilier} (missions M5B et M7) telle que définie dans le prompt système.

Format JSON attendu :
{
  "pilier": "${pilier}",
  "mission_5B_synthese": {
    "circuits_recurrents_top3": [...],
    "boucles_agregees": {...},
    "distribution_excellences": {...}
  },
  "mission_7_bilan_certificateur": {
    "processus_dominant": {...},
    "capacites_observees": [...],
    "pattern_navigation": {...},
    "lecture_cognitive_enrichie": "...",
    "profil_neuroscientifique": {"circuits_signatures": [...], "traduction": "..."},
    "flags": {"revision_necessaire": false, "alertes": []}
  }
}

Produis UNIQUEMENT ce JSON. Pas de commentaire avant ou après.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DES CHAMPS AIRTABLE RESPONSES (par question)
// try/catch global — erreur mapping ne plante pas le pipeline
// ═══════════════════════════════════════════════════════════════════════════

function mapToAirtableFieldsQuestion(parsed, id_question) {
  try {
    const verif = parsed.agent3_verification || {};
    const m2    = verif.mission_2_circuits   || {};
    const m5A   = verif.mission_5A_coherence || {};

    const circuitsParPilier = m2.circuits_par_pilier || {};
    const boucles           = Array.isArray(m5A.boucles_detectees) ? m5A.boucles_detectees : [];

    return {
      analyse_json_agent3:      JSON.stringify(parsed),
      circuits_actives:         JSON.stringify(circuitsParPilier),

      // boucles_detectees_agent3 : version structurelle Agent 3 (circuits)
      // distinct de boucles_detectees_agent1 (narratif Agent 1)
      boucles_detectees_agent3: boucles.length > 0 ? boucles.join(', ') : null,
      nombre_boucles_agent3:    safeNumber(boucles.length),

      // coherence_agent1_agent3 : singleSelect TOTALE/PARTIELLE/FAIBLE
      coherence_agent1_agent3:  normalizeCoherence(m5A.coherence_agents),

      // ⚠️ CORRECTION v8.1 : liste_piliers_actives RETIRÉ
      // Agent 3 ne doit PAS écraser la séquence arbitrée du Vérificateur
      // La valeur du Vérificateur (sequence_finale) est la référence pour le pipeline aval

      profiling_qualifie:  m5A.flag_revision ? 'FLAG_REVISION' : 'OK',
      lecture_cognitive_m8: null  // rempli lors de la synthèse pilier (étape 2)
    };
  } catch (err) {
    logger.error(`Agent 3: erreur mapToAirtableFieldsQuestion pour ${id_question || '?'}`, { error: err.message });
    return { analyse_json_agent3: JSON.stringify(parsed) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DES CHAMPS AIRTABLE BILAN (depuis synthèse pilier)
// try/catch global — erreur mapping ne plante pas le pipeline
// ═══════════════════════════════════════════════════════════════════════════

function mapToAirtableFieldsBilan(pilier, synthese) {
  try {
    const m5B = synthese.mission_5B_synthese          || {};
    const m7  = synthese.mission_7_bilan_certificateur || {};

    const fields = {};

    // circuits_top3_PX
    fields[`circuits_top3_${pilier}`] = JSON.stringify(m5B.circuits_recurrents_top3 || []);

    // boucles_detectees_pilier_PX
    fields[`boucles_detectees_pilier_${pilier}`] = JSON.stringify(m5B.boucles_agregees || {});

    // lecture_cognitive_enrichie_PX
    fields[`lecture_cognitive_enrichie_${pilier}`] = safeString(m7.lecture_cognitive_enrichie);

    // profil_neuroscientifique_PX
    fields[`profil_neuroscientifique_${pilier}`] = JSON.stringify(m7.profil_neuroscientifique || {});

    // excellences_par_pilier_PX — agrégation qualitative des 4 excellences sur ce pilier
    if (m5B.excellences_par_pilier) {
      fields[`excellences_par_pilier_${pilier}`] = JSON.stringify(m5B.excellences_par_pilier);
    }

    return fields;
  } catch (err) {
    logger.error(`Agent 3: erreur mapToAirtableFieldsBilan pour ${pilier}`, { error: err.message });
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AGRÉGATION LIMBIQUE SUR 25 QUESTIONS
// ═══════════════════════════════════════════════════════════════════════════

function aggregateLimbique(allAnalyses) {
  const intensiteOrder = { 'aucune': 0, 'faible': 1, 'modérée': 2, 'forte': 3 };
  let detecte      = false;
  let intensiteMax = 'aucune';
  let nbLimbiques  = 0;

  for (const { result } of allAnalyses) {
    const m0 = result?.agent3_verification?.mission_0_limbique || {};
    if (m0.limbique_perturbateur) {
      detecte = true;
      nbLimbiques++;
      const intensite = m0.intensite || 'aucune';
      if ((intensiteOrder[intensite] || 0) > (intensiteOrder[intensiteMax] || 0)) {
        intensiteMax = intensite;
      }
    }
  }

  return {
    limbique_detecte:        detecte,
    limbique_intensite_max:  intensiteMax,
    nb_questions_limbiques:  nbLimbiques
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// COHÉRENCE GLOBALE SUR 25 QUESTIONS
// ═══════════════════════════════════════════════════════════════════════════

function aggregateCoherence(allAnalyses) {
  // Cohérence globale = la plus faible sur l'ensemble
  const order   = { 'TOTALE': 2, 'PARTIELLE': 1, 'FAIBLE': 0 };
  const reverse = { 2: 'TOTALE',  1: 'PARTIELLE',  0: 'FAIBLE'  };
  let min = 2;
  for (const { result } of allAnalyses) {
    const coh = result?.agent3_verification?.mission_5A_coherence?.coherence_agents || 'TOTALE';
    if ((order[coh] ?? 2) < min) min = order[coh] ?? 2;
  }
  return reverse[min] || 'TOTALE';
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

async function run(session_id, questions, verificateurArbitrages, agent2Analyses) {
  if (!session_id) {
    throw new Error('Agent 3: session_id manquant');
  }
  if (!questions || questions.length !== 25) {
    throw new Error(`Agent 3: attendu 25 questions, reçu ${questions?.length ?? 0}`);
  }
  if (!verificateurArbitrages || verificateurArbitrages.length !== 25) {
    throw new Error(`Agent 3: attendu 25 arbitrages Vérificateur, reçu ${verificateurArbitrages?.length ?? 0}`);
  }
  if (!agent2Analyses || agent2Analyses.length !== 25) {
    throw new Error(`Agent 3: attendu 25 analyses Agent 2, reçu ${agent2Analyses?.length ?? 0}`);
  }

  // Indexer les inputs
  const verifByQuestion  = {};
  const agent2ByQuestion = {};
  for (const a of verificateurArbitrages) verifByQuestion[a.id_question]  = a.result;
  for (const a of agent2Analyses)         agent2ByQuestion[a.id_question] = a.result;

  logger.info('Agent 3: démarrage pipeline', { session_id });

  const analyses = [];
  let totalCost  = 0;

  // ── ÉTAPE 1 : 25 appels question ──────────────────────────────────────────
  for (let i = 0; i < questions.length; i++) {
    const question    = questions[i];
    const verifResult  = verifByQuestion[question.id_question];
    const agent2Result = agent2ByQuestion[question.id_question];

    if (!verifResult)  throw new Error(`Agent 3: résultat Vérificateur introuvable pour ${question.id_question}`);
    if (!agent2Result) throw new Error(`Agent 3: résultat Agent 2 introuvable pour ${question.id_question}`);

    let result;
    let attempts      = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        result = await analyzeQuestion(session_id, question, verifResult, agent2Result);
        break;
      } catch (error) {
        attempts++;
        logger.warn(`Agent 3: erreur ${question.id_question} (tentative ${attempts}/${maxAttempts})`, {
          error: error.message
        });
        if (attempts >= maxAttempts) {
          throw new Error(`Agent 3: échec définitif ${question.id_question} : ${error.message}`);
        }
        await sleep(2000 * attempts);
      }
    }

    analyses.push({ id_question: question.id_question, result: result.result });
    totalCost += result.cost;

    // Écriture immédiate dans RESPONSES
    const fields = mapToAirtableFieldsQuestion(result.result, question.id_question);
    await airtableService.updateResponse(question.id_question, session_id, fields);

    logger.info(`Agent 3: question ${i + 1}/25 analysée`, {
      session_id,
      id_question: question.id_question,
      coherence:   result.result?.agent3_verification?.mission_5A_coherence?.coherence_agents
    });

    if (i < questions.length - 1) await sleep(1000);
  }

  // ── ÉTAPE 2 : 5 synthèses pilier ──────────────────────────────────────────
  const syntheses  = {};
  const bilanFields = {};

  for (const pilier of PILIERS) {
    // Regrouper par pilier_reponse_coeur réellement déployé (pas pilier_question)
    const questionsPilier = questions.filter(q => {
      const analyse = analyses.find(a => a.id_question === q.id_question);
      const coeur   = analyse?.result?.agent3_verification?.mission_2_circuits?.pilier_reponse_coeur
                   || analyse?.result?.verificateur_arbitrage?.pilier_coeur_final
                   || q.pilier_reponse_coeur
                   || q.pilier;
      return coeur === pilier;
    });

    const resultsPilier = questionsPilier
      .map(q => analyses.find(a => a.id_question === q.id_question))
      .filter(Boolean);

    if (resultsPilier.length === 0) {
      logger.warn(`Agent 3: aucune question pour pilier ${pilier} — synthèse ignorée`, { session_id });
      continue;
    }

    await sleep(1000);

    let synthResult;
    let attempts      = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        synthResult = await synthesePilier(session_id, pilier, resultsPilier);
        break;
      } catch (error) {
        attempts++;
        logger.warn(`Agent 3: erreur synthèse ${pilier} (tentative ${attempts}/${maxAttempts})`, {
          error: error.message
        });
        if (attempts >= maxAttempts) {
          throw new Error(`Agent 3: échec synthèse ${pilier} : ${error.message}`);
        }
        await sleep(3000 * attempts);
      }
    }

    syntheses[pilier] = synthResult.synthese;
    totalCost += synthResult.cost;

    // Préparer champs BILAN pour ce pilier
    Object.assign(bilanFields, mapToAirtableFieldsBilan(pilier, synthResult.synthese));

    // Mettre à jour lecture_cognitive_m8 dans RESPONSES pour les questions de ce pilier
    const lce = synthResult.synthese.mission_7_bilan_certificateur?.lecture_cognitive_enrichie || null;
    if (lce) {
      for (const q of questionsPilier) {
        await airtableService.updateResponse(q.id_question, session_id, {
          lecture_cognitive_m8: lce
        });
      }
    }

    logger.info(`Agent 3: synthèse pilier ${pilier} terminée`, { session_id });
  }

  // ── Agrégations globales BILAN ─────────────────────────────────────────────
  const limbique        = aggregateLimbique(analyses);
  const coherenceGlobale = aggregateCoherence(analyses);

  Object.assign(bilanFields, {
    // CORRECTION v8.1 : 'oui' → 'vrai' (options Airtable confirmées MCP : vrai/faux/non)
    limbique_detecte:       limbique.limbique_detecte ? 'vrai' : 'non',
    limbique_intensite_max: normalizeLimbiqueIntens(limbique.limbique_intensite_max),
    nb_questions_limbiques: safeNumber(limbique.nb_questions_limbiques),
    coherence_agents:       normalizeCoherence(coherenceGlobale) || 'TOTALE'
  });

  // Écriture dans BILAN
  await airtableService.updateBilan(session_id, bilanFields);

  logger.info('Agent 3: pipeline terminé', {
    session_id,
    questions_traitees:  analyses.length,
    syntheses_piliers:   Object.keys(syntheses).length,
    totalCost:           totalCost.toFixed(4)
  });

  return {
    analyses,   // Array de { id_question, result } — mission_6_donnees_algo utilisé par algorithme
    syntheses,  // { P1: {...}, P2: {...}, ... } — M7 utilisé par certificateur
    totalCost
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  run,
  analyzeQuestion,              // exposé pour retry granulaire
  synthesePilier,               // exposé pour tests
  mapToAirtableFieldsQuestion,  // exposé pour tests unitaires
  mapToAirtableFieldsBilan      // exposé pour tests unitaires
};
