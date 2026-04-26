// services/agent2Service.js
// Agent 2 v8.1 — Mesure & Qualification
// Prompt : agent2_v2.txt
// Architecture : 25 appels indépendants (1/question)
// Input : outputs Vérificateur (pilier_coeur_final, niveau_coeur_final, piliers_actives, boucles_finales, sequence_finale)
// Missions : M4 (dimensions simples) M5 (dimensions sophistiquées) M6 (4 excellences) M7 (amplitude) M8 (lecture cognitive)
// Écriture : analyse_json_agent2 + champs plats dans RESPONSES × 25
//
// CORRECTIONS v8.1 :
// - nombre_criteres_details ← totalDetails (somme nombre_criteres M4 par pilier)
//   était totalSimples — FAUX, les critères et les actions sont deux comptages distincts
// - liste_criteres_details ← uniquement liste_criteres M4 par pilier
//   était fusion actions+critères — FAUX
// - liste_dimensions_simples ← uniquement liste_actions M4 par pilier
//   séparée des critères comme le demande le prompt
// - plusieurs_niveaux_reponse ← booléen true/false (Single Select Airtable)
//   était array de strings — rejeté par Airtable
// - capacites_detectees ← synthese M8 narrative (ce que le candidat déploie)
//   était synthese_indices M6 — mauvais champ, synthese_indices = indices paliers pas capacités
// - marqueurs_emotionnels_detectes SUPPRIMÉ — doublon de limbique_detail (organigramme v3 C8)
// - impact_excellences_profil SUPPRIMÉ — doublon de capacites_detectees (organigramme v3 C8)
// - normalizeZone : pass-through supprimé → null si zone non reconnue (évite valeurs parasites)
// - amplitude : cherche d'abord le pilier_coeur_final, fallback max (conservé de la v8.0)

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
    id_question:        question.id_question,
    pilier_coeur_final: verificateurResult.verificateur_arbitrage?.pilier_coeur_final
  });

  const response = await claudeService.callClaude({
    systemPrompt,
    userPrompt,
    service:   'agent2',
    maxTokens: 4000
  });

  const parsed = claudeService.parseClaudeJSON(response.content);

  if (!parsed || !parsed.agent2_mesure) {
    throw new Error(`Agent 2: réponse invalide pour ${question.id_question} — agent2_mesure manquant`);
  }

  return {
    id_question: question.id_question,
    result:      parsed,
    cost:        response.cost || 0
  };
}

/**
 * Construire le prompt utilisateur pour une question.
 */
function buildQuestionPrompt(question, verificateurResult) {
  const arbitrage = verificateurResult.verificateur_arbitrage || {};

  const inputData = {
    question:           question.id_question,
    scenario:           question.scenario_nom,
    pilier_question:    question.pilier,
    verbatim:           question.response_text,
    pilier_coeur_final: arbitrage.pilier_coeur_final || null,
    niveau_coeur_final: arbitrage.niveau_coeur_final || null,
    piliers_actives:    verificateurResult.piliers_actives  || [],
    boucles_finales:    verificateurResult.boucles_finales  || [],
    sequence_finale:    verificateurResult.sequence_finale  || ''
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
// HELPERS NORMALISATION
// ═══════════════════════════════════════════════════════════════════════════

function normalizeLimbique(v) {
  if (!v) return 'aucune';
  const n = v.toString().toLowerCase().trim();
  if (n === 'aucune' || n === 'aucun' || n === 'none') return 'aucune';
  if (n === 'faible') return 'faible';
  if (n.includes('modér') || n.includes('moder')) return 'modérée';
  if (n === 'forte' || n === 'fort') return 'forte';
  return 'aucune';
}

function normalizeZone(z) {
  if (!z) return null;
  const v = z.toLowerCase();
  if (v.includes('exécut') || v.includes('execut') || v.includes('fondament')) return 'Exécution';
  if (v.includes('opérat') || v.includes('operat') || v.includes('tactique')) return 'Opérationnelle';
  if (v.includes('stratég') || v.includes('strateg')) return 'Stratégique';
  return null; // zone non reconnue → null, jamais de valeur parasite
}

const NOM_AMPLITUDE = {
  1: 'EXÉCUTEUR', 2: 'SYSTÉMATIQUE', 3: 'MÉTHODIQUE', 4: 'OPTIMISATEUR',
  5: 'ADAPTATEUR', 6: 'DÉTECTEUR',   7: 'ORCHESTRATEUR', 8: 'MAÎTRE', 9: 'ARCHITECTE'
};

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DES CHAMPS AIRTABLE DEPUIS LE JSON AGENT 2
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mapper le JSON agent2 vers les champs plats Airtable RESPONSES.
 * @param {Object} parsed - JSON brut produit par Agent 2
 * @returns {Object} champs prêts pour updateResponse
 */
function mapToAirtableFields(parsed) {
  const mesure = parsed.agent2_mesure || {};

  // ── M4 — dimensions simples par pilier ────────────────────────────────────
  // Structure prompt : { nombre_actions, nombre_criteres, total_dimensions_simples,
  //                      liste_actions, liste_criteres }
  const m4 = mesure.mission_4_dimensions_simples?.par_pilier || {};

  // total_dimensions_simples = nombre_actions par pilier agrégés
  const totalSimples = Object.values(m4).reduce(
    (sum, p) => sum + (p.total_dimensions_simples || p.nombre_actions || p.total || 0), 0
  );

  // nombre_criteres_details = nombre_criteres par pilier agrégés — DISTINCT de totalSimples
  const totalDetails = Object.values(m4).reduce(
    (sum, p) => sum + (p.nombre_criteres || 0), 0
  );

  // liste_dimensions_simples = uniquement les ACTIONS (pas les critères)
  const listeActions = Object.values(m4).flatMap(p => p.liste_actions || p.liste || []);

  // liste_criteres_details = uniquement les CRITÈRES (pas les actions)
  const listeCriteres = Object.values(m4).flatMap(p => p.liste_criteres || []);

  // ── M5 — dimensions sophistiquées par pilier ──────────────────────────────
  const m5 = mesure.mission_5_dimensions_sophistiquees?.par_pilier || {};
  const totalSoph     = Object.values(m5).reduce((sum, p) => sum + (p.nombre || p.total || 0), 0);
  const listeDimSoph  = Object.values(m5).flatMap(p => p.liste || []);

  // Niveau sophistication global
  let niveauSoph = 'faible';
  if (totalSoph >= 3)      niveauSoph = 'élevé';
  else if (totalSoph >= 1) niveauSoph = 'moyen';

  // ── M6 — 4 excellences ───────────────────────────────────────────────────
  const m6           = mesure.mission_6_excellences || {};
  const anticipation = m6.anticipation_niveau   || {};
  const decentration = m6.decentration_niveau   || {};
  const metacognition = m6.metacognition_niveau || {};
  const vueSystemique = m6.vue_systemique_niveau || {};

  // ── M7 — amplitude par pilier ─────────────────────────────────────────────
  // Priorité : pilier_coeur_final du Vérificateur → fallback : amplitude max toutes piliers
  const m7         = mesure.mission_7_amplitude?.par_pilier || {};
  const piliersCles = Object.keys(m7);

  let amplitudeMax   = null;
  let nomAmplitude   = null;
  let zoneAmplitude  = null;
  let amplitudeNiveau = null;

  if (piliersCles.length > 0) {
    // Chercher d'abord le pilier cœur final arbitré par le Vérificateur
    const pilierCoeurFinal = parsed.verificateur_arbitrage?.pilier_coeur_final || null;
    const dataCoeur = pilierCoeurFinal ? m7[pilierCoeurFinal] : null;

    if (dataCoeur) {
      amplitudeMax  = dataCoeur.amplitude;
      nomAmplitude  = NOM_AMPLITUDE[dataCoeur.amplitude] || dataCoeur.nom_amplitude || null;
      zoneAmplitude = normalizeZone(dataCoeur.zone_amplitude);
    } else {
      // Fallback : amplitude max sur tous les piliers activés
      let maxVal = -1;
      for (const data of Object.values(m7)) {
        if ((data.amplitude || 0) > maxVal) {
          maxVal        = data.amplitude;
          amplitudeMax  = data.amplitude;
          nomAmplitude  = NOM_AMPLITUDE[data.amplitude] || data.nom_amplitude || null;
          zoneAmplitude = normalizeZone(data.zone_amplitude);
        }
      }
    }
    amplitudeNiveau = amplitudeMax ? String(amplitudeMax) : null;
  }

  // detail_par_niveaux = JSON de tout M7 par pilier (pour Certificateur section 1A)
  const detailParNiveaux = piliersCles.length > 0 ? JSON.stringify(m7) : null;

  // plusieurs_niveaux_reponse = booléen — plusieurs piliers activés dans cette réponse
  // Single Select Airtable — ne pas envoyer d'array
  const plusieursNiveaux = piliersCles.length > 1;

  // ── M8 — lecture cognitive ────────────────────────────────────────────────
  const m8 = mesure.mission_8_lecture_cognitive || {};

  // capacites_detectees = synthèse narrative M8 de ce que le candidat déploie
  // PAS synthese_indices M6 qui est un résumé des indices paliers
  const capacitesDetectees = m8.synthese || null;

  return {
    // JSON complet
    analyse_json_agent2: JSON.stringify(parsed),

    // M4 — actions et critères SÉPARÉS
    dimensions_simples:       totalSimples,
    liste_dimensions_simples: listeActions.join(', ')  || null,   // uniquement les actions
    nombre_criteres_details:  totalDetails,                        // CORRECTION v8.1
    liste_criteres_details:   listeCriteres.join(', ') || null,   // CORRECTION v8.1 — uniquement les critères

    // M5
    dimensions_sophistiquees:       totalSoph,
    liste_dimensions_sophistiquees: listeDimSoph.join(', ') || null,
    niveau_sophistication:          niveauSoph,

    // M6 — anticipation
    anticipation_niveau:              anticipation.niveau      || 'nulle',
    anticipation_verbatim:            anticipation.verbatim    || null,
    anticipation_manifestation:       anticipation.manifestation || null,
    anticipation_contexte_activation: anticipation.contexte_activation || null,

    // M6 — décentration
    decentration_niveau:              decentration.niveau      || 'nulle',
    decentration_verbatim:            decentration.verbatim    || null,
    decentration_manifestation:       decentration.manifestation || null,
    decentration_contexte_activation: decentration.contexte_activation || null,

    // M6 — métacognition
    metacognition_niveau:              metacognition.niveau      || 'nulle',
    metacognition_verbatim:            metacognition.verbatim    || null,
    metacognition_manifestation:       metacognition.manifestation || null,
    metacognition_contexte_activation: metacognition.contexte_activation || null,

    // M6 — vue systémique (jamais angles_morts)
    vue_systemique_niveau:              vueSystemique.niveau      || 'nulle',
    vue_systemique_verbatim:            vueSystemique.verbatim    || null,
    vue_systemique_manifestation:       vueSystemique.manifestation || null,
    vue_systemique_contexte_activation: vueSystemique.contexte_activation || null,

    // M7 — amplitude du pilier cœur final
    niveau_amplitude_reponse:  amplitudeNiveau,   // "1" à "9" string — Single Select
    niveau_amplitude_max:      nomAmplitude,       // "EXÉCUTEUR" ... "ARCHITECTE"
    zone_amplitude_max:        zoneAmplitude,      // "Exécution" / "Opérationnelle" / "Stratégique"
    detail_par_niveaux:        detailParNiveaux,   // JSON M7 complet par pilier
    plusieurs_niveaux_reponse: plusieursNiveaux ? 'oui' : 'non',

    // M8 — lecture cognitive
    nombre_mots_reponse: m8.nombre_mots_reponse || 0,
    laconique:           m8.laconique           || false,
    limbique_detecte:    m8.limbique_detecte    || false,
    limbique_intensite:  normalizeLimbique(m8.limbique_intensite),
    limbique_detail:     m8.limbique_detail     || null,
    // marqueurs_emotionnels_detectes SUPPRIMÉ — doublon de limbique_detail (organigramme v3 C8)
    // impact_excellences_profil SUPPRIMÉ — doublon de capacites_detectees (organigramme v3 C8)

    // Capacités — synthèse narrative M8 de ce que le candidat déploie réellement
    // CORRECTION v8.1 — était synthese_indices M6 (indices paliers, pas capacités)
    capacites_detectees: capacitesDetectees
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
 * @param {Array} questions              - 25 questions
 * @param {Array} verificateurArbitrages - Array de { id_question, result }
 * @returns {Object} { analyses: Array<{id_question, result}>, totalCost }
 */
async function run(session_id, questions, verificateurArbitrages) {
  if (!questions || questions.length !== 25) {
    throw new Error(`Agent 2: attendu 25 questions, reçu ${questions?.length ?? 0}`);
  }
  if (!verificateurArbitrages || verificateurArbitrages.length !== 25) {
    throw new Error(`Agent 2: attendu 25 arbitrages Vérificateur, reçu ${verificateurArbitrages?.length ?? 0}`);
  }

  const verifByQuestion = {};
  for (const a of verificateurArbitrages) {
    verifByQuestion[a.id_question] = a.result;
  }

  logger.info('Agent 2: démarrage pipeline', { session_id });

  const analyses  = [];
  let totalCost   = 0;

  // ── Reprise intra-étape : ignorer les questions déjà analysées ──────────
  const questionsRestantes = questions.filter(q => !q.analyse_json_agent2);
  if (questionsRestantes.length < questions.length) {
    logger.info('Agent 2: reprise intra-étape', {
      session_id,
      deja_faites: questions.length - questionsRestantes.length,
      restantes: questionsRestantes.length
    });
    const analysesExistantes = questions
      .filter(q => q.analyse_json_agent2)
      .map(q => ({ id_question: q.id_question, result: safeParseJSON(q.analyse_json_agent2) }));
    analyses.push(...analysesExistantes);
  }

  for (let i = 0; i < questionsRestantes.length; i++) {
    const question   = questionsRestantes[i];
    const verifResult = verifByQuestion[question.id_question];

    if (!verifResult) {
      throw new Error(`Agent 2: résultat Vérificateur introuvable pour ${question.id_question}`);
    }

    let result;
    let attempts      = 0;
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
      limbique:    m8.limbique_detecte,
      mots:        m8.nombre_mots_reponse
    });

    if (i < questions.length - 1) {
      await sleep(1000);
    }
  }

  logger.info('Agent 2: pipeline terminé', {
    session_id,
    questions_traitees: analyses.length,
    totalCost:          totalCost.toFixed(4)
  });

  return {
    analyses,  // Array de { id_question, result } — utilisé par Agent 3
    totalCost
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

function safeParseJSON(v) { if (!v) return null; if (typeof v === "object") return v; try { return JSON.parse(v); } catch { return null; } }

module.exports = {
  run,
  analyzeQuestion  // exposé pour retry granulaire
};
