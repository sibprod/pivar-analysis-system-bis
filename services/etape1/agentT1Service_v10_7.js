// services/etape1/agentT1Service.js
// Agent T1 — Analyse technique cognitive en aval de l'étape 1.1
// Profil-Cognitif v10.7
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//                       et docs/CONTRAT_ETAPE1.md
//
// Rôle :
//   - Lit les 25 réponses brutes du candidat depuis RESPONSES (frontend)
//   - ⭐ v10.7 : Lit AUSSI les 10 champs cog_*/v2_* étape 1.1 déjà présents
//     dans RESPONSES (écrits par l'agent prompt_etape1 lors de la lecture
//     cognitive amont).
//   - Appelle l'agent Claude T1 en 5 APPELS distincts (1 par scénario doctrinal)
//     • SOMMEIL  (Q1-Q5)   → 5 questions
//     • WEEKEND  (Q6-Q10)  → 5 questions
//     • ANIMAL_1 (Q11-Q15) → 5 questions
//     • ANIMAL_2 (Q16-Q20) → 5 questions
//     • PANNE    (Q21-Q25) → 5 questions
//   - Écrit les 5 lignes de chaque scénario en Airtable APRÈS chaque scénario
//     (Décision n°47), pour permettre la reprise via REPRENDRE_T1_<X>_SEUL.
//
// PHASE v10.7 (2026-05-08) — Architecture en aval de l'étape 1.1 (Décision n°50) :
//
//   Refonte majeure du périmètre T1. Le pipeline amont a changé :
//
//     RESPONSES brut → étape 1.1 (prompt_etape1) → 10 champs cog_*/v2_* écrits
//     dans RESPONSES → T1 lit RESPONSES enrichie et complète l'analyse technique
//
//   T1 ne calcule plus :
//     - le pilier_coeur (reçu via cog_pilier_gouverne)
//     - les verdicts v2 (reçus via v2_repond_question, v2_repond_situation)
//     - la séquence des outils (reçue via cog_outils_mobilises)
//     - la finalité (reçue via cog_resultat_vise)
//
//   T1 produit toujours :
//     - les libellés doctrinaux (pilier_finalite_libelle, outil_cognitif_libelle)
//     - le reformatage (pilier_coeur_analyse au format PX·desc, piliers_traverses
//       au format codé, piliers_secondaires avec position narrative amont/aval)
//     - l'analyse linguistique (verbes_observes, verbes_angles_piliers, types_verbatim)
//     - le signal limbique
//     - la version descriptive de v2_analyse (étape 1.1 ne produit qu'une version courte)
//
//   T1 recopie tels quels :
//     - identité (candidat_id, id_question, scenario, pilier_demande, etc.)
//     - verbatim_candidat
//     - v2_repond_question, v2_repond_situation
//     - pilier_coeur (= cog_pilier_gouverne)
//     - finalite_reponse (= cog_resultat_vise)
//     - cog_comprend, cog_sortie_commentaire (transmis vers ETAPE1_T1 pour T2/T3/T4)
//
//   5 CHAMPS SUPPRIMÉS de ETAPE1_T1 (Décision n°50 — 2026-05-08) :
//     - v1_conforme
//     - v2_traite_problematique
//     - conforme_ecart
//     - ecart_detail
//     - attribution_pilier_signal_brut
//
//   Le verdict de conformité CONFORME/ÉCART devient une responsabilité de T2
//   (calcul mécanique à partir de pilier_coeur vs pilier_demande + analyse
//   de piliers_traverses). T1 ne fait plus ce calcul.
//
//   2 CHAMPS NOUVEAUX dans le mapping ETAPE1_T1 :
//     - cog_comprend            (recopié de RESPONSES.cog_comprend)
//     - cog_sortie_commentaire  (recopié de RESPONSES.cog_sortie_commentaire)
//
//   Total ETAPE1_T1 après v10.7 : 26 champs (vs 31 en v10.6).
//
//   Modifications du service v10.7 :
//     1. Construction d'un objet lecture_amont_etape1_1 par réponse, en lisant
//        les 10 champs cog_*/v2_* dans le record RESPONSES.
//     2. Injection de cet objet dans le payload Claude.
//     3. normalizeRowForAirtable adapté (5 champs retirés, 2 ajoutés).
//     4. Comptage d'écarts retiré des logs (n'a plus de sens à ce stade).
//     5. Toute la doctrine vit dans le prompt etape1_t1.txt v4.1 (546 lignes,
//        4 blocs A/B/C/D). Le code service ne porte aucune doctrine.
//
//   Briques techniques utilisées (existantes depuis v10.2b) :
//   - airtableService.deleteEtape1T1Scenario(candidat_id, scenario_name)
//   - airtableService.writeEtape1T1Scenario(candidat_id, rows)
//   - airtableService.getResponses(session_id) — retourne déjà tous les champs
//     du record RESPONSES (spread de r.fields), donc les cog_*/v2_* sont inclus
//     sans modification de airtableService.
//
// HISTORIQUE DES PHASES PRÉCÉDENTES (préservé pour traçabilité) :
//   v10.2b (2026-05-03) — runAgentT1ForScenario (Décision n°42)
//   v10.4  (2026-05-04) — alignement v3.2 + écriture incrémentale (n°43-47)
//   v10.4.1(2026-05-04) — suppression champ orphelin `raisonnement` (n°48)
//   v10.5  (2026-05-05) — Doctrine v2 v3.3 (n°49)
//   v10.6  (2026-05-05) — Injection référentiel piliers
//   v10.7  (2026-05-08) — Architecture en aval de l'étape 1.1 (n°50)

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const SERVICE_NAME = 'agent_t1';
const PROMPT_PATH  = 'etape1/etape1_t1.txt';

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
  logger.info('Agent T1 starting v10.7 (en aval étape 1.1, 5 scénarios)', { candidat_id, session_id });

  // 1. Lire les 25 réponses brutes (avec champs cog_*/v2_* étape 1.1)
  const responses = await airtableService.getResponses(session_id);

  if (!responses || responses.length === 0) {
    throw new Error(`No responses found for session ${session_id}`);
  }

  if (responses.length < 25) {
    logger.warn('Responses count below 25', { candidat_id, count: responses.length });
  }

  // 1bis. ⭐ v10.7 — Garde-fou : vérifier que la lecture amont étape 1.1 est
  // bien présente. Sans elle, T1 ne peut pas fonctionner (il s'appuie sur
  // cog_pilier_gouverne, cog_outils_mobilises, etc.).
  const responsesWithoutAmont = responses.filter(r =>
    !r.cog_pilier_gouverne || !r.cog_outils_mobilises
  );
  if (responsesWithoutAmont.length > 0) {
    throw new Error(
      `Agent T1 v10.7 — ${responsesWithoutAmont.length}/${responses.length} réponses sans lecture amont étape 1.1 ` +
      `(cog_pilier_gouverne ou cog_outils_mobilises manquant). ` +
      `T1 nécessite que l'étape 1.1 soit complète avant exécution. ` +
      `Vérifier le statut du candidat dans VISITEUR.`
    );
  }
  logger.info('Agent T1 — lecture amont étape 1.1 vérifiée OK', {
    candidat_id, count: responses.length
  });

  // 2. Grouper les réponses par scénario
  const responsesByScenario = groupResponsesByScenario(responses);

  // 2bis. Nettoyage préalable scénario par scénario (Décision n°47)
  logger.info('Agent T1 — nettoyage préalable ETAPE1_T1 par scénario', { candidat_id });
  for (const scenario of SCENARIOS) {
    try {
      await airtableService.deleteEtape1T1Scenario(candidat_id, scenario.name);
    } catch (err) {
      logger.warn(`Agent T1 — delete préalable ${scenario.name} échoué (non bloquant)`, {
        candidat_id, error: err.message
      });
    }
  }

  // 3. Appeler l'agent 5 fois (1 par scénario), avec ÉCRITURE INCRÉMENTALE
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
    totalUsage.input_tokens                += usage.input_tokens || 0;
    totalUsage.output_tokens               += usage.output_tokens || 0;
    totalUsage.cache_read_input_tokens     += usage.cache_read_input_tokens || 0;
    totalUsage.cache_creation_input_tokens += usage.cache_creation_input_tokens || 0;
    totalCost += cost;

    logger.info(`Agent T1 — scenario ${scenario.name} done`, {
      candidat_id,
      rows:     rows.length,
      cost_usd: cost.toFixed(4)
    });

    // ⭐ ÉCRITURE INCRÉMENTALE EN AIRTABLE (Décision n°47)
    try {
      const normalizedRows = rows.map(normalizeRowForAirtable);
      const written = await airtableService.writeEtape1T1Scenario(candidat_id, normalizedRows);
      logger.info(`✅ Scenario ${scenario.name} écrit en Airtable — point de reprise possible`, {
        candidat_id,
        scenario: scenario.name,
        rows_written: written
      });
    } catch (err) {
      logger.error(`Agent T1 — échec écriture scénario ${scenario.name}`, {
        candidat_id,
        scenario: scenario.name,
        error: err.message
      });
      throw err;
    }
  }

  const elapsedMs = Date.now() - startTime;

  if (allRows.length === 0) {
    throw new Error('Agent T1 returned no rows across all scenarios');
  }

  logger.info('Agent T1 produced rows (TOTAL across 5 scenarios)', {
    candidat_id,
    count:          allRows.length,
    total_cost_usd: totalCost.toFixed(4),
    elapsedMs
  });

  return { rows: allRows, usage: totalUsage, cost: totalCost, elapsedMs };
}

// ─── APPEL T1 POUR UN SCÉNARIO ────────────────────────────────────────────
async function callT1ForScenario({ candidat_id, scenario, responses }) {
  // ⭐ v10.6 — Chargement du référentiel des 5 piliers (doctrine officielle).
  // Pattern aligné avec le service vérificateur.
  const referentiel_piliers = await airtableService.getReferentielPiliers();
  if (!referentiel_piliers || referentiel_piliers.length !== 5) {
    throw new Error(
      `Agent T1 — référentiel piliers incomplet ou corrompu (${referentiel_piliers?.length || 0}/5). ` +
      `Guard V1.0 : arrêt avant exécution sur le scénario ${scenario.name}.`
    );
  }
  logger.info('Agent T1 — référentiel piliers chargé', {
    candidat_id,
    scenario: scenario.name,
    nb_piliers: referentiel_piliers.length
  });

  // ⭐ v10.7 — Construction du payload avec lecture amont étape 1.1
  // Pour chaque réponse, on injecte les 10 champs cog_*/v2_* lus dans RESPONSES.
  // Le prompt T1 v4.1 attend cette structure sous la clé `lecture_amont_etape1_1`.
  // ⚠️ ANONYMISATION : aucun prénom dans le payload (Décision n°4)
  const payload = {
    candidat_id,
    scenario_name:            scenario.name,
    nb_questions_in_scenario: responses.length,
    nb_questions_total:       25,
    referentiel_piliers,                                      // doctrine officielle des 5 piliers
    responses: responses.map(r => ({
      // ─── Inputs natifs RESPONSES (situation et verbatim) ───────────────
      id_question:    r.id_question,
      numero_global:  r.numero_global,
      pilier:         r.pilier,
      scenario_nom:   r.scenario_nom,
      question_text:  r.question_text,
      response_text:  r.response_text,
      storytelling:   extractLookup(r['storytelling_general (from question _lien)']) || r.storytelling || '',
      transition:     extractLookup(r['transition_narrative (from question _lien)']) || r.transition || '',
      // ─── ⭐ v10.7 — Lecture cognitive amont étape 1.1 ──────────────────
      // Les 10 champs sont déjà dans RESPONSES (écrits par l'agent prompt_etape1).
      // T1 les recevra et s'appuiera dessus pour produire son analyse technique
      // sans avoir à recalculer le pilier_coeur ni la séquence des outils.
      lecture_amont_etape1_1: {
        v2_repond_question:      r.v2_repond_question      || '',
        v2_repond_situation:     extractSelect(r.v2_repond_situation),
        v2_analyse_synthetique:  r.v2_analyse              || '',
        cog_comprend:            r.cog_comprend            || '',
        cog_outils_mobilises:    r.cog_outils_mobilises    || '',
        cog_pilier_sortie:       r.cog_pilier_sortie       || '',
        cog_sortie_commentaire:  r.cog_sortie_commentaire  || '',
        cog_pilier_gouverne:     r.cog_pilier_gouverne     || '',
        cog_gouverne_commentaire: r.cog_gouverne_commentaire || '',
        cog_resultat_vise:       r.cog_resultat_vise       || ''
      }
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
// ⭐ v10.7 — Mapping aligné sur la nouvelle structure ETAPE1_T1 (26 champs).
//
// SUPPRIMÉS (Décision n°50 — colonnes retirées d'Airtable le 2026-05-08) :
//   - v1_conforme
//   - v2_traite_problematique
//   - conforme_ecart
//   - ecart_detail
//   - attribution_pilier_signal_brut
//
// AJOUTÉS (recopiés de la lecture amont étape 1.1, transmis vers ETAPE1_T1
// pour que T2/T3/T4 y aient accès sans requêter RESPONSES) :
//   - cog_comprend
//   - cog_sortie_commentaire
//
// HISTORIQUE :
//   - pilier_sortie : abandonné en v10 (Décision n°5)
//   - raisonnement : abandonné en v10.4.1 (Décision n°48)
function normalizeRowForAirtable(row) {
  return {
    // ─── BLOC A — Recopie pure depuis le payload (13 champs) ──────────────
    id_question:                row.id_question                || '',
    question_id_protocole:      row.question_id_protocole      || '',
    scenario:                   row.scenario                   || '',
    pilier_demande:             row.pilier_demande             || '',
    question_texte:             row.question_texte             || '',
    storytelling:               row.storytelling               || '',
    transition:                 row.transition                 || '',
    verbatim_candidat:          row.verbatim_candidat          || '',
    v2_repond_question:         row.v2_repond_question         || '',
    v2_repond_situation:        row.v2_repond_situation        || '',
    pilier_finalite:            row.pilier_finalite            || '',
    pilier_coeur:               row.pilier_coeur               || '',
    // (candidat_id n'est pas stocké ici, c'est la clé du record géré par writeEtape1T1Scenario)

    // ─── BLOC B — Reformatés depuis cog_* (6 champs) ──────────────────────
    pilier_finalite_libelle:    row.pilier_finalite_libelle    || '',
    outil_cognitif_libelle:     row.outil_cognitif_libelle     || '',
    pilier_coeur_analyse:       row.pilier_coeur_analyse       || '',
    piliers_traverses:          row.piliers_traverses          || '',
    piliers_secondaires:        row.piliers_secondaires        || '',
    finalite_reponse:           row.finalite_reponse           || '',

    // ─── BLOC C — Produits à neuf par T1 (5 champs) ───────────────────────
    v2_analyse:                 row.v2_analyse                 || '',
    verbes_observes:            row.verbes_observes            || '',
    verbes_angles_piliers:      row.verbes_angles_piliers      || '',
    types_verbatim:             row.types_verbatim             || '',
    signal_limbique:            row.signal_limbique            || '',

    // ─── BLOC D — Recopie pure des cog_* uniques (2 champs) ───────────────
    // Ces 2 champs sont transmis depuis RESPONSES vers ETAPE1_T1 pour rester
    // accessibles aux agents T2/T3/T4 sans requêter RESPONSES.
    cog_comprend:               row.cog_comprend               || '',
    cog_sortie_commentaire:     row.cog_sortie_commentaire     || ''
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

// ─── EXTRACTION SINGLE SELECT ─────────────────────────────────────────────
// ⭐ v10.7 — Les champs Airtable singleSelect renvoient soit une string
// (nom de l'option) soit un objet { id, name, color }. On normalise en string.
function extractSelect(value) {
  if (value === undefined || value === null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value.name) return value.name;
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
// ⭐ v10.7 — La fonction lit aussi la lecture amont étape 1.1 dans RESPONSES,
// comme runAgentT1, et inclut le même garde-fou (vérifier que cog_pilier_gouverne
// et cog_outils_mobilises sont présents avant d'appeler Claude).
//
// @param {Object} params
// @param {string} params.candidat_id
// @param {string} params.session_id    // typiquement = candidat_id
// @param {string} params.scenario_name // SOMMEIL | WEEKEND | ANIMAL_1 | ANIMAL_2 | PANNE
// @returns {Promise<{rows: Array, usage: Object, cost: number, elapsedMs: number}>}
async function runAgentT1ForScenario({ candidat_id, session_id, scenario_name }) {
  const startTime = Date.now();
  logger.info('Agent T1 starting v10.7 (1 SCENARIO ISOLÉ, en aval étape 1.1)', {
    candidat_id, scenario_name
  });

  // 1. Validation entrée
  const scenario = SCENARIOS.find(s => s.name === scenario_name);
  if (!scenario) {
    throw new Error(
      `runAgentT1ForScenario — scenario_name invalide: "${scenario_name}". ` +
      `Attendu: ${SCENARIOS.map(s => s.name).join(', ')}`
    );
  }

  // 2. Lire les 25 réponses brutes (avec champs cog_*/v2_* étape 1.1)
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

  // 3bis. ⭐ v10.7 — Garde-fou : vérifier que la lecture amont étape 1.1 est
  // présente sur les 5 réponses du scénario.
  const responsesWithoutAmont = scenarioResponses.filter(r =>
    !r.cog_pilier_gouverne || !r.cog_outils_mobilises
  );
  if (responsesWithoutAmont.length > 0) {
    throw new Error(
      `Agent T1 v10.7 — ${responsesWithoutAmont.length}/${scenarioResponses.length} réponses du scénario ` +
      `${scenario_name} sans lecture amont étape 1.1 (cog_pilier_gouverne ou cog_outils_mobilises manquant). ` +
      `T1 ne peut pas s'exécuter sans cette lecture amont.`
    );
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
    elapsedMs
  });

  return { rows, usage, cost, elapsedMs };
}

module.exports = {
  runAgentT1,
  runAgentT1ForScenario,  // v10.2b (Décision n°42)
  // exports techniques pour tests/debug
  extractRows,
  normalizeRowForAirtable,
  extractLookup,
  extractSelect,           // ⭐ v10.7 — nouveau
  groupResponsesByScenario,
  SCENARIOS
};
