// services/agentT2Service.js
// Agent T2 — Synthèse par question
// Profil-Cognitif v9.0
//
// Rôle :
//   - Lit les 25 lignes T1 du candidat depuis ETAPE1_T1
//   - Appelle l'agent Claude T2 (prompt etape1_t2.txt)
//   - Écrit les 25 lignes synthétisées dans ETAPE1_T2
//
// Format de sortie agent : { rows: [{...}, ...] } — 25 objets
//
// Pas d'extended thinking (redistribution mécanique).
// Pas d'injection lexique (T2 produit du factuel/analyse, pas de discours doctrinal).

'use strict';

const agentBase       = require('./agentBase');
const airtableService = require('./airtableService');
const logger          = require('../utils/logger');

const SERVICE_NAME = 'agent_t2';
const PROMPT_PATH  = 'etape1_t2.txt';

/**
 * Exécute l'agent T2 pour un candidat
 * @param {Object} params
 * @param {string} params.candidat_id   - Identifiant du candidat
 * @returns {Promise<{rows: Array, usage: Object, cost: number, elapsedMs: number}>}
 */
async function runAgentT2({ candidat_id }) {
  logger.info('Agent T2 starting', { candidat_id });

  // 1. Lire les 25 lignes T1 (qui ont été écrites par l'Agent T1)
  const t1Rows = await airtableService.getEtape1T1(candidat_id);

  if (!t1Rows || t1Rows.length === 0) {
    throw new Error(`No T1 rows found for candidate ${candidat_id} — run Agent T1 first`);
  }

  logger.info('T1 rows loaded for T2', {
    candidat_id,
    count: t1Rows.length
  });

  if (t1Rows.length < 25) {
    logger.warn('T1 rows count below 25', {
      candidat_id,
      count: t1Rows.length
    });
  }

  // 2. Construire le payload — passer toutes les colonnes utiles de T1
  const payload = {
    candidat_id,
    nb_questions: t1Rows.length,
    t1_rows: t1Rows.map(r => ({
      id_question:                   r.id_question,
      question_id_protocole:         r.question_id_protocole,
      scenario:                      r.scenario,
      pilier_demande:                r.pilier_demande,
      verbatim_candidat:             r.verbatim_candidat,
      v1_conforme:                   r.v1_conforme,
      verbes_angles_piliers:         r.verbes_angles_piliers,
      pilier_coeur_analyse:          r.pilier_coeur_analyse,
      types_verbatim:                r.types_verbatim,
      piliers_secondaires:           r.piliers_secondaires,
      attribution_pilier_signal_brut: r.attribution_pilier_signal_brut,
      conforme_ecart:                r.conforme_ecart,
      signal_limbique:               r.signal_limbique
    }))
  };

  // 3. Appeler l'agent Claude
  const { result, usage, cost, elapsedMs } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: false,
    candidatId:    candidat_id
  });

  // 4. Extraire les 25 lignes T2
  const rows = extractRows(result, candidat_id);

  if (rows.length === 0) {
    throw new Error('Agent T2 returned no rows');
  }

  logger.info('Agent T2 produced rows', {
    candidat_id,
    count:           rows.length,
    types_contenus:  countByField(rows, 'type_contenu')
  });

  // 5. Écrire dans ETAPE1_T2
  await airtableService.writeEtape1T2(candidat_id, rows.map(normalizeRowForAirtable));

  return { rows, usage, cost, elapsedMs };
}

/**
 * Extrait les lignes T2 du résultat Claude (même tolérance que T1)
 */
function extractRows(result, candidat_id) {
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.lignes)) return result.lignes;
  if (Array.isArray(result?.t2)) return result.t2;
  if (Array.isArray(result)) return result;

  if (result?.candidat_id && result?.id_question) {
    logger.warn('Agent T2 returned single object instead of array', { candidat_id });
    return [result];
  }

  logger.error('Unable to extract T2 rows', {
    candidat_id,
    keys: result ? Object.keys(result) : null
  });
  throw new Error('Agent T2 output format not recognized');
}

/**
 * Normalise une ligne T2 pour Airtable.
 * - Gère ÉCART → ECART (single select)
 * - Garantit signal_limbique_detecte = OUI/NON
 */
function normalizeRowForAirtable(row) {
  let conformeEcart = row.conforme_ecart || '';
  if (conformeEcart === 'ÉCART') conformeEcart = 'ECART';

  let signalDetecte = row.signal_limbique_detecte || '';
  // Tolérer formats variés
  if (signalDetecte === true || signalDetecte === 'true' || signalDetecte === 1) signalDetecte = 'OUI';
  if (signalDetecte === false || signalDetecte === 'false' || signalDetecte === 0) signalDetecte = 'NON';
  if (!signalDetecte) signalDetecte = 'NON'; // valeur par défaut sécuritaire

  let typeContenu = row.type_contenu || '';
  if (!typeContenu) {
    // Inférer depuis conforme_ecart selon la règle T2
    typeContenu = (conformeEcart === 'ECART') ? 'ANALYSE' : 'BRUT';
  }

  return {
    id_question:                 row.id_question || '',
    question_id_protocole:       row.question_id_protocole || '',
    scenario:                    row.scenario || '',
    pilier_demande:              row.pilier_demande || '',
    pilier_coeur:                row.pilier_coeur || '',
    conforme_ecart:              conformeEcart,
    sequence_piliers:            row.sequence_piliers || '',
    analyse_note:                row.analyse_note || '',
    analyse_ecart_action:        row.analyse_ecart_action || '',
    signal_limbique_detecte:     signalDetecte,
    signal_limbique_detail:      row.signal_limbique_detail || '',
    signal_transversal_candidat: row.signal_transversal_candidat || '',
    stat_pattern_pilier:         row.stat_pattern_pilier || '',
    type_contenu:                typeContenu
  };
}

function countByField(rows, fieldName) {
  return rows.reduce((acc, r) => {
    const val = r[fieldName] || 'undefined';
    acc[val] = (acc[val] || 0) + 1;
    return acc;
  }, {});
}

module.exports = {
  runAgentT2,
  extractRows,
  normalizeRowForAirtable
};
