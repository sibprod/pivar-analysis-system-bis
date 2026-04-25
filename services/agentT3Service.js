// services/agentT3Service.js
// Agent T3 — Analyse pilier × circuit (75 lignes)
// Profil-Cognitif v9.0
//
// Rôle :
//   - Lit T1 + T2 du candidat depuis Airtable
//   - Appelle l'agent Claude T3 (prompt etape1_t3.txt — version v4)
//   - Écrit les 75 lignes (5 piliers × 15 circuits) dans ETAPE1_T3
//
// Format de sortie agent : { rows: [{...}, ...] } — 75 objets
//
// Extended thinking ACTIVÉ (raisonnement sur nuances, clusters, attributions).
// Pas d'injection lexique (T3 produit du factuel structuré).
//
// Particularité : les champs activations_franches, activations_nuancees,
// clusters_identifies sont des ARRAYS d'objets JSON. Pour Airtable (Long text),
// on les sérialise en JSON.stringify lors de l'écriture.

'use strict';

const agentBase       = require('./agentBase');
const airtableService = require('./airtableService');
const logger          = require('../utils/logger');

const SERVICE_NAME = 'agent_t3';
const PROMPT_PATH  = 'etape1_t3.txt';

/**
 * Exécute l'agent T3 pour un candidat
 * @param {Object} params
 * @param {string} params.candidat_id   - Identifiant du candidat
 * @returns {Promise<{rows: Array, usage: Object, cost: number, elapsedMs: number}>}
 */
async function runAgentT3({ candidat_id }) {
  logger.info('Agent T3 starting', { candidat_id });

  // 1. Lire T1 et T2
  const [t1Rows, t2Rows] = await Promise.all([
    airtableService.getEtape1T1(candidat_id),
    airtableService.getEtape1T2(candidat_id)
  ]);

  if (!t1Rows || t1Rows.length === 0) {
    throw new Error(`No T1 rows found for ${candidat_id} — run Agent T1 first`);
  }
  if (!t2Rows || t2Rows.length === 0) {
    throw new Error(`No T2 rows found for ${candidat_id} — run Agent T2 first`);
  }

  logger.info('T1+T2 loaded for T3', {
    candidat_id,
    t1_count: t1Rows.length,
    t2_count: t2Rows.length
  });

  // 2. Construire le payload
  const payload = {
    candidat_id,
    t1_rows: t1Rows.map(r => ({
      id_question:           r.id_question,
      question_id_protocole: r.question_id_protocole,
      scenario:              r.scenario,
      pilier_demande:        r.pilier_demande,
      types_verbatim:        r.types_verbatim,
      pilier_coeur_analyse:  r.pilier_coeur_analyse,
      piliers_secondaires:   r.piliers_secondaires,
      verbes_angles_piliers: r.verbes_angles_piliers,
      conforme_ecart:        r.conforme_ecart
    })),
    t2_rows: t2Rows.map(r => ({
      id_question:        r.id_question,
      pilier_coeur:       r.pilier_coeur,
      conforme_ecart:     r.conforme_ecart,
      sequence_piliers:   r.sequence_piliers,
      stat_pattern_pilier: r.stat_pattern_pilier
    }))
  };

  // 3. Appeler l'agent Claude (avec thinking activé via la config)
  const { result, usage, cost, elapsedMs } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: false,
    candidatId:    candidat_id
  });

  // 4. Extraire les 75 lignes T3
  const rows = extractRows(result, candidat_id);

  if (rows.length === 0) {
    throw new Error('Agent T3 returned no rows');
  }

  logger.info('Agent T3 produced rows', {
    candidat_id,
    count:                  rows.length,
    expected:               75,
    circuits_actifs:        rows.filter(r => r.actif === 'OUI').length,
    circuits_par_pilier:    countCircuitsByPilier(rows)
  });

  if (rows.length !== 75) {
    logger.warn('Agent T3 row count differs from expected 75', {
      candidat_id,
      got: rows.length
    });
  }

  // 5. Écrire dans ETAPE1_T3 (avec sérialisation JSON des arrays)
  await airtableService.writeEtape1T3(candidat_id, rows.map(normalizeRowForAirtable));

  return { rows, usage, cost, elapsedMs };
}

/**
 * Extrait les lignes T3 du résultat
 */
function extractRows(result, candidat_id) {
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.lignes)) return result.lignes;
  if (Array.isArray(result?.t3)) return result.t3;
  if (Array.isArray(result)) return result;

  if (result?.candidat_id && result?.circuit_id) {
    logger.warn('Agent T3 returned single object', { candidat_id });
    return [result];
  }

  logger.error('Unable to extract T3 rows', {
    candidat_id,
    keys: result ? Object.keys(result) : null
  });
  throw new Error('Agent T3 output format not recognized');
}

/**
 * Normalise une ligne T3 pour Airtable.
 * - Sérialise les arrays JSON (activations_franches, activations_nuancees, clusters_identifies)
 *   en chaînes JSON pour stockage en Long text
 * - Force les types pour les single selects (niveau_activation, actif, role_pilier)
 */
function normalizeRowForAirtable(row) {
  // Sérialisation JSON des arrays (Airtable Long text)
  const activationsFranches = serializeArray(row.activations_franches);
  const activationsNuancees = serializeArray(row.activations_nuancees);
  const clustersIdentifies  = serializeArray(row.clusters_identifies);

  // Conversions de single selects
  let niveauActivation = row.niveau_activation || '';
  // niveau_activation : HAUT / MOYEN / INACTIF (T3 v4 — 3 niveaux)
  if (!['HAUT', 'MOYEN', 'INACTIF'].includes(niveauActivation)) {
    if (niveauActivation) {
      logger.warn('Unexpected niveau_activation', { value: niveauActivation });
    }
  }

  let actif = row.actif || '';
  if (actif === true || actif === 'true') actif = 'OUI';
  if (actif === false || actif === 'false') actif = 'NON';
  if (!['OUI', 'NON'].includes(actif)) {
    // Inférer depuis niveau_activation
    actif = (niveauActivation === 'INACTIF') ? 'NON' : 'OUI';
  }

  // role_pilier : socle / structurant_1 / structurant_2 / fonctionnel_1 / fonctionnel_2 / résistant
  // L'agent peut renvoyer "Pilier socle" → on normalise
  let rolePilier = row.role_pilier || '';
  rolePilier = normalizeRolePilier(rolePilier);

  // type_contenu : ANALYSE si actif=OUI, BRUT si NON (règle T3 v4)
  let typeContenu = row.type_contenu || '';
  if (!typeContenu) {
    typeContenu = (actif === 'OUI') ? 'ANALYSE' : 'BRUT';
  }

  // frequence : nombre
  let frequence = row.frequence;
  if (typeof frequence === 'string') frequence = parseInt(frequence, 10) || 0;
  if (frequence === undefined || frequence === null) frequence = 0;

  // nb_circuits_actifs_pilier : nombre
  let nbCircuitsActifs = row.nb_circuits_actifs_pilier;
  if (typeof nbCircuitsActifs === 'string') nbCircuitsActifs = parseInt(nbCircuitsActifs, 10) || 0;
  if (nbCircuitsActifs === undefined || nbCircuitsActifs === null) nbCircuitsActifs = 0;

  return {
    pilier:                    row.pilier || '',
    role_pilier:               rolePilier,
    nb_circuits_actifs_pilier: nbCircuitsActifs,
    circuit_id:                row.circuit_id || '',
    circuit_nom:               row.circuit_nom || '',
    frequence:                 frequence,
    niveau_activation:         niveauActivation,
    actif:                     actif,
    types_verbatim_detail:     row.types_verbatim_detail || '',
    activations_franches:      activationsFranches,
    activations_nuancees:      activationsNuancees,
    clusters_identifies:       clustersIdentifies,
    commentaire_attribution:   row.commentaire_attribution || '',
    type_contenu:              typeContenu
  };
}

/**
 * Normalise role_pilier vers les valeurs attendues du single select Airtable
 */
function normalizeRolePilier(value) {
  if (!value) return '';
  const v = value.toString().toLowerCase().trim();

  // Mappings tolérants
  if (v.includes('socle')) return 'socle';
  if (v.includes('structurant') && v.includes('1')) return 'structurant_1';
  if (v.includes('structurant') && v.includes('2')) return 'structurant_2';
  if (v.includes('fonctionnel') && v.includes('1')) return 'fonctionnel_1';
  if (v.includes('fonctionnel') && v.includes('2')) return 'fonctionnel_2';
  if (v.includes('résistant') || v.includes('resistant')) return 'résistant';

  // Tel quel si déjà au bon format
  return value;
}

/**
 * Sérialise un array d'objets JSON en chaîne (pour stockage Airtable Long text)
 * Retourne '' si vide/null/undefined.
 */
function serializeArray(arr) {
  if (!arr) return '';
  if (!Array.isArray(arr)) return '';
  if (arr.length === 0) return '';
  try {
    return JSON.stringify(arr, null, 2);
  } catch (e) {
    logger.warn('Failed to serialize array for Airtable', { error: e.message });
    return '';
  }
}

/**
 * Compte les circuits actifs par pilier (pour logging diagnostique)
 */
function countCircuitsByPilier(rows) {
  const counts = {};
  for (const r of rows) {
    if (r.actif === 'OUI') {
      counts[r.pilier] = (counts[r.pilier] || 0) + 1;
    }
  }
  return counts;
}

module.exports = {
  runAgentT3,
  extractRows,
  normalizeRowForAirtable,
  normalizeRolePilier,
  serializeArray
};
