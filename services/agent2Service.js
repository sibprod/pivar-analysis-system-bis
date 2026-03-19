// services/agent2Service.js
// Agent 2 v8.2 — Mesure & Qualification
// Prompt : agent2_v2.txt
// Architecture : 25 appels indépendants (1/question)
// Input : outputs Vérificateur (pilier_coeur_final, niveau_coeur_final, piliers_actives, boucles_finales, sequence_finale)
// Missions : M4 (dimensions simples) M5 (dimensions sophistiquées) M6 (4 excellences) M7 (amplitude) M8 (lecture cognitive)
// Écriture : analyse_json_agent2 + champs plats dans RESPONSES × 25
//
// CORRECTIONS v8.1 :
// - nombre_criteres_details ← totalDetails (somme nombre_criteres M4 par pilier)
// - liste_criteres_details ← uniquement liste_criteres M4 par pilier
// - liste_dimensions_simples ← uniquement liste_actions M4 par pilier
// - plusieurs_niveaux_reponse ← booléen true/false (Single Select Airtable)
// - capacites_detectees ← synthese M8 narrative
// - marqueurs_emotionnels_detectes SUPPRIMÉ (doublon limbique_detail)
// - impact_excellences_profil SUPPRIMÉ (doublon capacites_detectees)
// - normalizeZone : null si zone non reconnue
// - amplitude : cherche pilier_coeur_final, fallback max
//
// CORRECTIONS + SÉCURISATIONS v8.2 — audit 19/03/2026 :
// - plusieurs_niveaux_reponse : multipleSelects → array ['oui']/['non'] (était string scalaire)
// - niveau_sophistication : palier 'très élevé' ajouté (totalSoph >= 5)
// - normalizeExcellence() : sécurisation valeurs singleSelect M6 (nulle/faible/moyen/élevé)
// - normalizeNiveauAmplitude() : sécurisation "1"→"9" avant écriture singleSelect
// - normalizeNomAmplitude() : sécurisation nom amplitude contre valeurs inconnues
// - safeString() / safeNumber() / safeBoolean() : helpers défensifs sur tous les champs plats
// - buildQuestionPrompt : warning si pilierCoeurFinal absent
// - mapToAirtableFields : try/catch global — erreur mapping ne plante pas le pipeline
// - run() : vérification session_id présent avant démarrage

'use strict';

const fs              = require('fs').promises;
const path            = require('path');
const claudeService   = require('./claudeService');
const airtableService = require('./airtableService');
const logger          = require('../utils/logger');

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
// HELPERS DÉFENSIFS — v8.2
// Garantissent qu'aucune valeur parasite n'atteint Airtable
// ═══════════════════════════════════════════════════════════════════════════

/** Retourne une string propre ou null */
function safeString(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'string') return v.trim() || null;
  if (typeof v === 'number' && !isNaN(v)) return String(v);
  return null;
}

/** Retourne un number entier ou defaultVal */
function safeNumber(v, defaultVal = 0) {
  const n = Number(v);
  return isNaN(n) ? defaultVal : Math.round(n);
}

/** Retourne un boolean strict */
function safeBoolean(v) {
  if (typeof v === 'boolean') return v;
  if (v === 'true' || v === 1) return true;
  return false;
}

/**
 * Normalise limbique_intensite.
 * Options Airtable confirmées MCP : aucune / faible / modérée / forte
 */
function normalizeLimbique(v) {
  if (!v) return 'aucune';
  const n = v.toString().toLowerCase().trim();
  if (['aucune', 'aucun', 'none', 'false', '0'].includes(n)) return 'aucune';
  if (['faible', 'low'].includes(n)) return 'faible';
  if (n.includes('modér') || n.includes('moder') || n === 'medium') return 'modérée';
  if (['forte', 'fort', 'high', 'élevée', 'elevee'].includes(n)) return 'forte';
  logger.warn(`Agent 2: limbique_intensite non reconnue : "${v}" → aucune`);
  return 'aucune';
}

/**
 * Normalise zone_amplitude_max.
 * Options Airtable confirmées MCP : Exécution / Opérationnelle / Stratégique
 */
function normalizeZone(z) {
  if (!z) return null;
  const v = z.toLowerCase();
  if (v.includes('exécut') || v.includes('execut') || v.includes('fondament')) return 'Exécution';
  if (v.includes('opérat') || v.includes('operat') || v.includes('tactique'))  return 'Opérationnelle';
  if (v.includes('stratég') || v.includes('strateg'))                          return 'Stratégique';
  logger.warn(`Agent 2: zone_amplitude non reconnue : "${z}" → null`);
  return null;
}

/**
 * Normalise niveau_amplitude_reponse.
 * Options Airtable confirmées MCP : "1" à "9" (singleSelect)
 */
function normalizeNiveauAmplitude(v) {
  if (v === null || v === undefined) return null;
  const n = parseInt(v, 10);
  if (isNaN(n) || n < 1 || n > 9) {
    logger.warn(`Agent 2: niveau_amplitude hors bornes : "${v}" → null`);
    return null;
  }
  return String(n);
}

/**
 * Normalise niveau_amplitude_max (nom du palier).
 * Options Airtable confirmées MCP : EXÉCUTEUR→ARCHITECTE
 */
const NOM_AMPLITUDE_VALIDES = new Set([
  'EXÉCUTEUR', 'SYSTÉMATIQUE', 'MÉTHODIQUE', 'OPTIMISATEUR',
  'ADAPTATEUR', 'DÉTECTEUR', 'ORCHESTRATEUR', 'MAÎTRE', 'ARCHITECTE'
]);

const NOM_AMPLITUDE_MAP = {
  1: 'EXÉCUTEUR', 2: 'SYSTÉMATIQUE', 3: 'MÉTHODIQUE',    4: 'OPTIMISATEUR',
  5: 'ADAPTATEUR', 6: 'DÉTECTEUR',   7: 'ORCHESTRATEUR', 8: 'MAÎTRE', 9: 'ARCHITECTE'
};

function normalizeNomAmplitude(nom, niveau) {
  if (nom) {
    const upper = nom.toString().toUpperCase().trim();
    if (NOM_AMPLITUDE_VALIDES.has(upper)) return upper;
  }
  // Fallback depuis niveau numérique
  if (niveau !== null && niveau !== undefined) {
    const n = parseInt(niveau, 10);
    if (!isNaN(n) && NOM_AMPLITUDE_MAP[n]) return NOM_AMPLITUDE_MAP[n];
  }
  logger.warn(`Agent 2: nom_amplitude non reconnu : "${nom}" → null`);
  return null;
}

/**
 * Normalise valeur excellence (anticipation/décentration/métacognition/vue_systémique).
 * Options Airtable confirmées MCP : nulle / faible / moyen / élevé
 */
function normalizeExcellence(v) {
  if (!v) return 'nulle';
  const n = v.toString().toLowerCase().trim();
  if (['nulle', 'null', 'none', '0', 'absent', 'absente'].includes(n)) return 'nulle';
  if (['faible', 'low', 'bas', 'basse'].includes(n))                   return 'faible';
  if (['moyen', 'moyenne', 'medium', 'modéré', 'modérée'].includes(n)) return 'moyen';
  if (['élevé', 'élevée', 'elevé', 'eleve', 'high', 'fort', 'forte'].includes(n)) return 'élevé';
  logger.warn(`Agent 2: excellence non reconnue : "${v}" → nulle`);
  return 'nulle';
}

// ═══════════════════════════════════════════════════════════════════════════
// ANALYSE D'UNE QUESTION (1 appel API)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Mesurer la richesse cognitive d'une réponse.
 */
async function analyzeQuestion(session_id, question, verificateurResult) {
  const systemPrompt = await loadPrompt();
  const userPrompt   = buildQuestionPrompt(question, verificateurResult);

  const pilierCoeurFinal = verificateurResult.verificateur_arbitrage?.pilier_coeur_final;
  logger.info('Agent 2: analyse question', {
    session_id,
    id_question:        question.id_question,
    pilier_coeur_final: pilierCoeurFinal || 'ABSENT — fallback max activé'
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

  if (!arbitrage.pilier_coeur_final) {
    logger.warn(`Agent 2: pilier_coeur_final absent pour ${question.id_question} — amplitude calculée sur max piliers activés`);
  }

  const inputData = {
    question:           question.id_question,
    scenario:           question.scenario_nom,
    pilier_question:    question.pilier,
    verbatim:           question.response_text,
    pilier_coeur_final: arbitrage.pilier_coeur_final || null,
    niveau_coeur_final: arbitrage.niveau_coeur_final || null,
    piliers_actives:    verificateurResult.piliers_actives || [],
    boucles_finales:    verificateurResult.boucles_finales || [],
    sequence_finale:    verificateurResult.sequence_finale || ''
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

/**
 * Mapper le JSON agent2 vers les champs plats Airtable RESPONSES.
 * try/catch global : erreur de mapping → retourne uniquement le JSON brut.
 * Le pipeline continue sans planter.
 */
function mapToAirtableFields(parsed, id_question) {
  try {
    const mesure = parsed.agent2_mesure || {};

    // ── M4 — dimensions simples ─────────────────────────────────────────────
    const m4 = mesure.mission_4_dimensions_simples?.par_pilier || {};

    const totalSimples = Object.values(m4).reduce(
      (sum, p) => sum + safeNumber(p.total_dimensions_simples ?? p.nombre_actions ?? p.total), 0
    );
    const totalDetails = Object.values(m4).reduce(
      (sum, p) => sum + safeNumber(p.nombre_criteres), 0
    );
    const listeActions  = Object.values(m4).flatMap(p =>
      Array.isArray(p.liste_actions)  ? p.liste_actions  :
      Array.isArray(p.liste)          ? p.liste          : []
    );
    const listeCriteres = Object.values(m4).flatMap(p =>
      Array.isArray(p.liste_criteres) ? p.liste_criteres : []
    );

    // ── M5 — dimensions sophistiquées ──────────────────────────────────────
    const m5       = mesure.mission_5_dimensions_sophistiquees?.par_pilier || {};
    const totalSoph    = Object.values(m5).reduce((sum, p) => sum + safeNumber(p.nombre ?? p.total), 0);
    const listeDimSoph = Object.values(m5).flatMap(p => Array.isArray(p.liste) ? p.liste : []);

    // niveau_sophistication — CORRECTION v8.2 : palier très élevé ajouté
    // Options Airtable : faible / moyen / élevé / très élevé
    let niveauSoph = 'faible';
    if      (totalSoph >= 5) niveauSoph = 'très élevé';
    else if (totalSoph >= 3) niveauSoph = 'élevé';
    else if (totalSoph >= 1) niveauSoph = 'moyen';

    // ── M6 — 4 excellences ─────────────────────────────────────────────────
    const m6            = mesure.mission_6_excellences || {};
    const anticipation  = m6.anticipation_niveau   || {};
    const decentration  = m6.decentration_niveau   || {};
    const metacognition = m6.metacognition_niveau  || {};
    const vueSystemique = m6.vue_systemique_niveau || {};

    // ── M7 — amplitude par pilier ───────────────────────────────────────────
    const m7          = mesure.mission_7_amplitude?.par_pilier || {};
    const piliersCles = Object.keys(m7);

    let amplitudeMax    = null;
    let nomAmplitude    = null;
    let zoneAmplitude   = null;
    let amplitudeNiveau = null;

    if (piliersCles.length > 0) {
      const pilierCoeurFinal = parsed.verificateur_arbitrage?.pilier_coeur_final || null;
      const dataCoeur        = pilierCoeurFinal ? m7[pilierCoeurFinal] : null;

      if (dataCoeur) {
        amplitudeMax  = dataCoeur.amplitude;
        nomAmplitude  = normalizeNomAmplitude(dataCoeur.nom_amplitude, dataCoeur.amplitude);
        zoneAmplitude = normalizeZone(dataCoeur.zone_amplitude);
      } else {
        // Fallback : amplitude max sur tous les piliers activés
        let maxVal = -1;
        for (const data of Object.values(m7)) {
          const val = safeNumber(data.amplitude, 0);
          if (val > maxVal) {
            maxVal        = val;
            amplitudeMax  = val;
            nomAmplitude  = normalizeNomAmplitude(data.nom_amplitude, val);
            zoneAmplitude = normalizeZone(data.zone_amplitude);
          }
        }
      }
      amplitudeNiveau = normalizeNiveauAmplitude(amplitudeMax);
    }

    const detailParNiveaux = piliersCles.length > 0 ? JSON.stringify(m7) : null;

    // CORRECTION v8.2 : multipleSelects → array obligatoire
    const plusieursNiveaux = piliersCles.length > 1 ? ['oui'] : ['non'];

    // ── M8 — lecture cognitive ──────────────────────────────────────────────
    const m8 = mesure.mission_8_lecture_cognitive || {};

    return {
      analyse_json_agent2: JSON.stringify(parsed),

      // M4
      dimensions_simples:       safeNumber(totalSimples),
      liste_dimensions_simples: listeActions.length  > 0 ? listeActions.join(', ')  : null,
      nombre_criteres_details:  safeNumber(totalDetails),
      liste_criteres_details:   listeCriteres.length > 0 ? listeCriteres.join(', ') : null,

      // M5
      dimensions_sophistiquees:       safeNumber(totalSoph),
      liste_dimensions_sophistiquees: listeDimSoph.length > 0 ? listeDimSoph.join(', ') : null,
      niveau_sophistication:          niveauSoph,

      // M6 — anticipation
      anticipation_niveau:              normalizeExcellence(anticipation.niveau),
      anticipation_verbatim:            safeString(anticipation.verbatim),
      anticipation_manifestation:       safeString(anticipation.manifestation),
      anticipation_contexte_activation: safeString(anticipation.contexte_activation),

      // M6 — décentration
      decentration_niveau:              normalizeExcellence(decentration.niveau),
      decentration_verbatim:            safeString(decentration.verbatim),
      decentration_manifestation:       safeString(decentration.manifestation),
      decentration_contexte_activation: safeString(decentration.contexte_activation),

      // M6 — métacognition
      metacognition_niveau:              normalizeExcellence(metacognition.niveau),
      metacognition_verbatim:            safeString(metacognition.verbatim),
      metacognition_manifestation:       safeString(metacognition.manifestation),
      metacognition_contexte_activation: safeString(metacognition.contexte_activation),

      // M6 — vue systémique
      vue_systemique_niveau:              normalizeExcellence(vueSystemique.niveau),
      vue_systemique_verbatim:            safeString(vueSystemique.verbatim),
      vue_systemique_manifestation:       safeString(vueSystemique.manifestation),
      vue_systemique_contexte_activation: safeString(vueSystemique.contexte_activation),

      // M7
      niveau_amplitude_reponse:  amplitudeNiveau,    // "1"→"9" singleSelect
      niveau_amplitude_max:      nomAmplitude,        // "EXÉCUTEUR"..."ARCHITECTE" singleSelect
      zone_amplitude_max:        zoneAmplitude,       // "Exécution"/"Opérationnelle"/"Stratégique"
      detail_par_niveaux:        detailParNiveaux,    // JSON M7 complet
      plusieurs_niveaux_reponse: plusieursNiveaux,    // ['oui']/['non'] multipleSelects

      // M8
      nombre_mots_reponse: safeNumber(m8.nombre_mots_reponse),
      laconique:           safeBoolean(m8.laconique),
      limbique_detecte:    safeBoolean(m8.limbique_detecte),
      limbique_intensite:  normalizeLimbique(m8.limbique_intensite),
      limbique_detail:     safeString(m8.limbique_detail),
      capacites_detectees: safeString(m8.synthese)
    };

  } catch (err) {
    // Sécurisation v8.2 : erreur mapping → retourne JSON brut uniquement
    logger.error(`Agent 2: erreur mapToAirtableFields pour ${id_question || '?'}`, { error: err.message });
    return { analyse_json_agent2: JSON.stringify(parsed) };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

async function run(session_id, questions, verificateurArbitrages) {
  if (!session_id) {
    throw new Error('Agent 2: session_id manquant');
  }
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

  const analyses = [];
  let totalCost  = 0;

  for (let i = 0; i < questions.length; i++) {
    const question    = questions[i];
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

    const fields = mapToAirtableFields(result.result, question.id_question);
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

module.exports = {
  run,
  analyzeQuestion,     // exposé pour retry granulaire
  mapToAirtableFields  // exposé pour tests unitaires
};
