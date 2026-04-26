// services/agentT1Service.js
// Agent T1 — Analyse brute des 25 réponses du candidat
// Profil-Cognitif v9.0
//
// Rôle :
//   - Lit les 25 réponses brutes du candidat depuis RESPONSES (frontend)
//   - Appelle l'agent Claude T1 (prompt etape1_t1.txt)
//   - Écrit les 25 lignes analysées dans ETAPE1_T1
//
// Format de sortie agent : { rows: [{...}, {...}, ...] } — 25 objets
// (l'agent peut aussi retourner un array directement, on gère les deux)
//
// Pas d'extended thinking (analyse mécanique).
// Pas d'injection lexique (T1 produit du factuel, pas de discours).

'use strict';

const agentBase       = require('./agentBase');
const airtableService = require('./airtableService');
const logger          = require('../utils/logger');

const SERVICE_NAME = 'agent_t1';
const PROMPT_PATH  = 'etape1_t1.txt';

/**
 * Exécute l'agent T1 pour un candidat
 * @param {Object} params
 * @param {string} params.candidat_id   - Identifiant du candidat (ex: 'cecile')
 * @param {string} params.session_id    - session_ID utilisé pour la table RESPONSES
 *                                        (souvent = candidat_id, mais peut différer)
 * @returns {Promise<{rows: Array, usage: Object, cost: number, elapsedMs: number}>}
 */
async function runAgentT1({ candidat_id, session_id }) {
  logger.info('Agent T1 starting', { candidat_id, session_id });

  // 1. Lire les 25 réponses brutes depuis RESPONSES (lecture seule)
  const responses = await airtableService.getResponses(session_id);

  if (!responses || responses.length === 0) {
    throw new Error(`No responses found for session ${session_id}`);
  }

  logger.info('Responses loaded for T1', {
    candidat_id,
    count: responses.length
  });

  // Vérification de robustesse
  if (responses.length < 25) {
    logger.warn('Responses count below 25', {
      candidat_id,
      count: responses.length
    });
  }

  // 2. Construire le payload pour l'agent
  const payload = {
    candidat_id,
    nb_questions: responses.length,
    responses: responses.map(r => ({
      id_question:           r.id_question,
      numero_global:         r.numero_global,
      pilier:                r.pilier,
      scenario_nom:          r.scenario_nom,
      question_text:         r.question_text,
      response_text:         r.response_text,
      // Lookups Airtable depuis QUESTIONS PIVAR SCENARIO via question_lien
      // (ajout doctrine 26/04 : T1 a besoin du contexte narratif complet)
      storytelling:          extractLookup(r['storytelling_general (from question _lien)']) || r.storytelling || '',
      transition:            extractLookup(r['transition_narrative (from question _lien)']) || r.transition || ''
    }))
  };

  // 3. Appeler l'agent Claude
  const { result, usage, cost, elapsedMs } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: false,  // T1 pas de discours = pas besoin du lexique
    candidatId:    candidat_id
  });

  // 4. Extraire les 25 lignes T1 du résultat
  const rows = extractRows(result, candidat_id);

  if (rows.length === 0) {
    throw new Error('Agent T1 returned no rows');
  }

  logger.info('Agent T1 produced rows', {
    candidat_id,
    count:           rows.length,
    ecarts_detected: rows.filter(r => r.conforme_ecart === 'ÉCART' || r.conforme_ecart === 'ECART').length
  });

  // 5. Écrire dans ETAPE1_T1 (pattern d'écrasement)
  await airtableService.writeEtape1T1(candidat_id, rows.map(normalizeRowForAirtable));

  return { rows, usage, cost, elapsedMs };
}

/**
 * Extrait les lignes T1 du résultat Claude.
 * Tolère plusieurs formats de sortie :
 *   - { rows: [...] }
 *   - { lignes: [...] }
 *   - { t1: [...] }
 *   - [...] (array direct)
 *   - { candidat_id: 'cecile', id_question: 'Q1', ... } (1 seul objet — n'arrive pas mais on gère)
 */
function extractRows(result, candidat_id) {
  // Cas 1 : { rows: [...] }
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

/**
 * Normalise une ligne T1 pour l'écriture Airtable.
 * - Convertit ÉCART (avec accent) en valeur acceptée par Airtable (single select)
 * - Force candidat_id si absent
 * - Garantit que les champs obligatoires existent
 */
function normalizeRowForAirtable(row) {
  // Normaliser conforme_ecart : agent peut retourner 'ÉCART' ou 'ECART'
  let conformeEcart = row.conforme_ecart || '';
  if (conformeEcart === 'ÉCART') conformeEcart = 'ECART';
  if (conformeEcart === 'CONFORME' || conformeEcart === 'ECART') {
    // OK
  } else if (conformeEcart) {
    logger.warn('Unexpected conforme_ecart value', { value: conformeEcart });
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
    signal_limbique:               row.signal_limbique || ''
  };
}

module.exports = {
  runAgentT1,
  // exports techniques pour tests/debug
  extractRows,
  normalizeRowForAirtable,
  extractLookup
};

/**
 * Extrait la valeur d'un champ lookup Airtable.
 * Les lookups peuvent être retournés sous forme :
 *   - String simple : "Vous dormez mal..."
 *   - Array (si le lookup vient d'une liaison multi) : ["Vous dormez mal..."]
 *   - undefined / null si pas de valeur
 */
function extractLookup(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : '';
  }
  return String(value);
}
