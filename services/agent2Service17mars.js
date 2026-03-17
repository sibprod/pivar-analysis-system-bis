// services/agent2Service.js
// Agent 2 v8.0 — Mesure & Qualification
// Prompt : agent2_v2.txt
// Architecture : 25 appels indépendants (1/question)
// Input : outputs Vérificateur (pilier_coeur_final, niveau_coeur_final, piliers_actives, boucles_finales, sequence_finale)
// Missions : M4 (dimensions simples) M5 (dimensions sophistiquées) M6 (4 excellences) M7 (amplitude) M8 (lecture cognitive)
// Écriture : analyse_json_agent2 + champs plats dans RESPONSES × 25

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
    const promptPath = path.join(__dirname, '../prompts/agent2_v2.txt');
    cachedPrompt = await fs.readFile(promptPath, 'utf8');
    logger.info('Agent 2: prompt chargé', { length: cachedPrompt.length });
    return cachedPrompt;
  } catch (error) {
    logger.error('Agent 2: échec chargement prompt', { error: error.message });
    throw new Error('Prompt introuvable : prompts/agent2_v2.txt');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSE D'UNE QUESTION (1 appel API)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mesurer la richesse cognitive d'une réponse.
 * @param {string} session_id
 * @param {Object} question - { id_question, scenario_nom, pilier, question_text, response_text }
 * @param {Object} verificateurResult - JSON produit par le Vérificateur pour cette question
 * @returns {Object} { id_question, result: Object (JSON agent2), cost }
 */
async function analyzeQuestion(session_id, question, verificateurResult) {
  const systemPrompt = await loadPrompt();
  const userPrompt = buildQuestionPrompt(question, verificateurResult);

  logger.info('Agent 2: analyse question', {
    session_id,
    id_question: question.id_question,
    pilier_coeur_final: verificateurResult.verificateur_arbitrage?.pilier_coeur_final
  });

  const response = await claudeService.callClaude({
    systemPrompt,
    userPrompt,
    service: 'agent2',
    maxTokens: 4000
  });

  const parsed = claudeService.parseClaudeJSON(response.content);

  if (!parsed || !parsed.agent2_mesure) {
    throw new Error(`Agent 2: réponse invalide pour ${question.id_question} — agent2_mesure manquant`);
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
function buildQuestionPrompt(question, verificateurResult) {
  const arbitrage = verificateurResult.verificateur_arbitrage || {};

  const inputData = {
    question: question.id_question,
    scenario: question.scenario_nom,
    pilier_question: question.pilier,
    verbatim: question.response_text,
    pilier_coeur_final: arbitrage.pilier_coeur_final || null,
    niveau_coeur_final: arbitrage.niveau_coeur_final || null,
    piliers_actives: verificateurResult.piliers_actives || [],
    boucles_finales: verificateurResult.boucles_finales || [],
    sequence_finale: verificateurResult.sequence_finale || ''
  };

  return `Mesure la richesse cognitive de la réponse suivante et produis le JSON demandé dans le prompt système (missions M4 à M8).

---
Texte de la question :
${question.question_text}

Données transmises par l'Agent 1 + Vérificateur :
${JSON.stringify(inputData, null, 2)}
---

Produis UNIQUEMENT le JSON complet agent2_mesure tel que défini dans le prompt système. Pas de commentaire avant ou après.`;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DES CHAMPS AIRTABLE DEPUIS LE JSON AGENT 2
// ═══════════════════════════════════════════════════════════════════════════

// Normaliser limbique_intensite vers les valeurs exactes Airtable
function normalizeLimbique(v) {
  if (!v) return 'aucune';
  const n = v.toString().toLowerCase().trim();
  if (n === 'aucune' || n === 'aucun' || n === 'none') return 'aucune';
  if (n === 'faible') return 'faible';
  if (n.includes('modér') || n.includes('moder')) return 'modérée';
  if (n === 'forte' || n === 'fort') return 'forte';
  return 'aucune';
}

/**
 * Mapper le JSON agent2 vers les champs plats Airtable RESPONSES.
 * @param {Object} parsed - JSON brut produit par Agent 2
 * @returns {Object} champs prêts pour updateResponse
 */
function mapToAirtableFields(parsed) {
  const mesure = parsed.agent2_mesure || {};

  // M4 — dimensions simples (agrégées toutes piliers)
  // Structure M4 output : { nombre_actions, nombre_criteres, total_dimensions_simples, liste_actions, liste_criteres }
  const m4 = mesure.mission_4_dimensions_simples?.par_pilier || {};
  const totalSimples = Object.values(m4).reduce((sum, p) => sum + (p.total_dimensions_simples || p.total || 0), 0);
  const totalDetails = Object.values(m4).reduce((sum, p) => sum + (p.nombre_criteres || 0), 0);
  const listeDimSimples = Object.values(m4).flatMap(p => [...(p.liste_actions || p.liste || []), ...(p.liste_criteres || [])]);

  // M5 — dimensions sophistiquées (agrégées toutes piliers)
  // Structure M5 output : { nombre, liste }
  const m5 = mesure.mission_5_dimensions_sophistiquees?.par_pilier || {};
  const totalSoph = Object.values(m5).reduce((sum, p) => sum + (p.nombre || p.total || 0), 0);
  const listeDimSoph = Object.values(m5).flatMap(p => p.liste || []);

  // Niveau sophistication global
  let niveauSoph = 'faible';
  if (totalSoph >= 3) niveauSoph = 'élevé';
  else if (totalSoph >= 1) niveauSoph = 'moyen';

  // M6 — excellences (4 dimensions)
  const m6 = mesure.mission_6_excellences || {};
  const anticipation = m6.anticipation_niveau || {};
  const decentration = m6.decentration_niveau || {};
  const metacognition = m6.metacognition_niveau || {};
  const vueSystemique = m6.vue_systemique_niveau || {};

  // M7 — amplitude (pilier dominant = pilier cœur final, sinon max sur les piliers activés)
  const m7 = mesure.mission_7_amplitude?.par_pilier || {};
  const piliersCles = Object.keys(m7);
  let amplitudeMax = null;
  let nomAmplitude = null;
  let zoneAmplitude = null;
  let justifAmplitude = null;
  let amplitudeNiveau = null;

  // Mapping zone amplitude → valeurs exactes Airtable
  // Airtable accepte : "Exécution" / "Opérationnelle" / "Stratégique"
  // 3 zones autorisées uniquement — toute autre valeur → null
  function normalizeZone(z) {
    if (!z) return null;
    const v = z.toLowerCase();
    if (v.includes('exécut') || v.includes('execut') || v.includes('fondament')) return 'Exécution';
    if (v.includes('opérat') || v.includes('operat') || v.includes('tactique')) return 'Opérationnelle';
    if (v.includes('stratég') || v.includes('strateg')) return 'Stratégique';
    return null; // zone non reconnue → null, jamais d'invention
  }

  // Mapping amplitude numérique → nom Airtable
  const NOM_AMPLITUDE = {
    1: 'EXÉCUTEUR', 2: 'SYSTÉMATIQUE', 3: 'MÉTHODIQUE', 4: 'OPTIMISATEUR',
    5: 'ADAPTATEUR', 6: 'DÉTECTEUR', 7: 'ORCHESTRATEUR', 8: 'MAÎTRE', 9: 'ARCHITECTE'
  };

  if (piliersCles.length > 0) {
    // Le prompt dit : amplitude = celle du PILIER CŒUR FINAL (arbitré par le Vérificateur)
    // Le pilier cœur final est transmis dans parsed.verificateur_arbitrage.pilier_coeur_final
    // On cherche ce pilier dans m7, sinon on prend le max comme fallback
    const pilierCoeurFinal = parsed.verificateur_arbitrage?.pilier_coeur_final || null;
    const dataCoeur = pilierCoeurFinal ? m7[pilierCoeurFinal] : null;

    if (dataCoeur) {
      amplitudeMax = dataCoeur.amplitude;
      nomAmplitude = NOM_AMPLITUDE[dataCoeur.amplitude] || dataCoeur.nom_amplitude || null;
      zoneAmplitude = normalizeZone(dataCoeur.zone_amplitude);
      justifAmplitude = dataCoeur.justification_qualitative || null;
    } else {
      // Fallback : prendre le max si pilier cœur absent de m7
      let maxVal = -1;
      for (const [pilier, data] of Object.entries(m7)) {
        if ((data.amplitude || 0) > maxVal) {
          maxVal = data.amplitude;
          amplitudeMax = data.amplitude;
          nomAmplitude = NOM_AMPLITUDE[data.amplitude] || data.nom_amplitude || null;
          zoneAmplitude = normalizeZone(data.zone_amplitude);
          justifAmplitude = data.justification_qualitative || null;
        }
      }
    }
    amplitudeNiveau = amplitudeMax ? String(amplitudeMax) : null; // "1" à "9" strings
  }

  // M7 — detail par niveaux (JSON stringify de l'objet par pilier)
  const detailParNiveaux = piliersCles.length > 0 ? JSON.stringify(m7) : null;
  // plusieurs_niveaux_reponse est un multipleSelects → array des noms de niveaux activés
  const plusieursNiveauxArray = piliersCles.length > 1
    ? Object.values(m7)
        .filter(d => d.amplitude)
        .map(d => NOM_AMPLITUDE[d.amplitude])
        .filter(Boolean)
    : [];

  // M8 — lecture cognitive
  const m8 = mesure.mission_8_lecture_cognitive || {};

  return {
    // JSON complet
    analyse_json_agent2: JSON.stringify(parsed),

    // M4
    dimensions_simples:       totalSimples,
    liste_dimensions_simples: listeDimSimples.join(', ') || null,
    nombre_criteres_details:  totalSimples,
    liste_criteres_details:   listeDimSimples.join(', ') || null,

    // M5
    dimensions_sophistiquees:       totalSoph,
    liste_dimensions_sophistiquees: listeDimSoph.join(', ') || null,
    niveau_sophistication:          niveauSoph,

    // M6 — anticipation
    anticipation_niveau:              anticipation.niveau || 'nulle',
    anticipation_verbatim:            anticipation.verbatim || null,
    anticipation_manifestation:       anticipation.manifestation || null,
    anticipation_contexte_activation: anticipation.contexte_activation || null,

    // M6 — décentration
    decentration_niveau:              decentration.niveau || 'nulle',
    decentration_verbatim:            decentration.verbatim || null,
    decentration_manifestation:       decentration.manifestation || null,
    decentration_contexte_activation: decentration.contexte_activation || null,

    // M6 — métacognition
    metacognition_niveau:              metacognition.niveau || 'nulle',
    metacognition_verbatim:            metacognition.verbatim || null,
    metacognition_manifestation:       metacognition.manifestation || null,
    metacognition_contexte_activation: metacognition.contexte_activation || null,

    // M6 — vue systémique (jamais angles_morts)
    vue_systemique_niveau:              vueSystemique.niveau || 'nulle',
    vue_systemique_verbatim:            vueSystemique.verbatim || null,
    vue_systemique_manifestation:       vueSystemique.manifestation || null,
    vue_systemique_contexte_activation: vueSystemique.contexte_activation || null,

    // M7 — amplitude
    niveau_amplitude_reponse:     amplitudeNiveau,    // "1" à "9" (string)
    niveau_amplitude_max:         nomAmplitude,        // "EXÉCUTEUR" ... "ARCHITECTE"
    zone_amplitude_max:           zoneAmplitude,       // "Exécution" / "Opérationnelle" / "Stratégique"
    detail_par_niveaux:           detailParNiveaux,
    plusieurs_niveaux_reponse:    plusieursNiveauxArray,  // array de strings pour multipleSelects

    // M8 — limbique_intensite : valeurs exactes Airtable : "aucune"/"faible"/"modérée"/"forte"
    nombre_mots_reponse:  m8.nombre_mots_reponse || 0,
    laconique:            m8.laconique || false,
    limbique_detecte:     m8.limbique_detecte || false,
    limbique_intensite:   normalizeLimbique(m8.limbique_intensite),
    limbique_detail:      m8.limbique_detail || null,
    marqueurs_emotionnels_detectes: m8.limbique_detail || null,

    // Capacités (synthèse M6)
    capacites_detectees:    m6.synthese_indices || null,
    impact_excellences_profil: m6.synthese_indices || null
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pipeline complet Agent 2 pour un candidat.
 * 25 appels indépendants → écriture des champs dans RESPONSES.
 *
 * @param {string} session_id
 * @param {Array} questions - 25 questions avec { id_question, scenario_nom, pilier, question_text, response_text }
 * @param {Array} verificateurArbitrages - résultats Vérificateur : Array de { id_question, result }
 * @returns {Object} { analyses: Array<{id_question, result}>, totalCost }
 */
async function run(session_id, questions, verificateurArbitrages) {
  if (!questions || questions.length !== 25) {
    throw new Error(`Agent 2: attendu 25 questions, reçu ${questions?.length ?? 0}`);
  }
  if (!verificateurArbitrages || verificateurArbitrages.length !== 25) {
    throw new Error(`Agent 2: attendu 25 arbitrages Vérificateur, reçu ${verificateurArbitrages?.length ?? 0}`);
  }

  // Indexer par id_question
  const verifByQuestion = {};
  for (const a of verificateurArbitrages) {
    verifByQuestion[a.id_question] = a.result;
  }

  logger.info('Agent 2: démarrage pipeline', { session_id });

  const analyses = [];
  let totalCost = 0;

  for (let i = 0; i < questions.length; i++) {
    const question = questions[i];
    const verifResult = verifByQuestion[question.id_question];

    if (!verifResult) {
      throw new Error(`Agent 2: résultat Vérificateur introuvable pour ${question.id_question}`);
    }

    let result;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      try {
        result = await analyzeQuestion(session_id, question, verifResult);
        break;
      } catch (error) {
        attempts++;
        logger.warn(`Agent 2: erreur ${question.id_question} (tentative ${attempts}/${maxAttempts})`, {
          error: error.message
        });
        if (attempts >= maxAttempts) {
          throw new Error(`Agent 2: échec définitif ${question.id_question} : ${error.message}`);
        }
        await sleep(2000 * attempts);
      }
    }

    analyses.push({ id_question: question.id_question, result: result.result });
    totalCost += result.cost;

    // Écriture immédiate dans RESPONSES
    const fields = mapToAirtableFields(result.result);
    await airtableService.updateResponse(question.id_question, session_id, fields);

    const m8 = result.result.agent2_mesure?.mission_8_lecture_cognitive || {};
    logger.info(`Agent 2: question ${i + 1}/25 mesurée`, {
      session_id,
      id_question: question.id_question,
      limbique: m8.limbique_detecte,
      mots: m8.nombre_mots_reponse
    });

    if (i < questions.length - 1) {
      await sleep(1000);
    }
  }

  logger.info('Agent 2: pipeline terminé', {
    session_id,
    questions_traitees: analyses.length,
    totalCost: totalCost.toFixed(4)
  });

  return {
    analyses,   // Array de { id_question, result } — utilisé par Agent 3
    totalCost
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  run,
  analyzeQuestion  // exposé pour retry granulaire depuis orchestrateur
};
