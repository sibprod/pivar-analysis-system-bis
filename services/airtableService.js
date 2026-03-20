// services/airtableService.js
// Service Airtable v8.2 — Pipeline profil cognitif
// Couche d'accès unique à l'API Airtable REST
//
// ARCHITECTURE :
// - Toutes les opérations Airtable passent par ce service
// - Jamais d'appels directs à l'API depuis les autres services
// - Noms de champs en string (typecast: true) — jamais d'IDs fldXXX
// - Tables : VISITEUR (tblslPP9B71FveOX5) | RESPONSES (tblLnWhszYAQldZOJ) | BILAN (tbljRMIMjM9SwVyox)
//
// FONCTIONS EXPORTÉES :
//   getVisiteur(session_id)                         → objet visiteur ou null
//   getVisiteursByStatus(filtre)                    → array de visiteurs
//     filtre peut être :
//       - array de statuts : ['NOUVEAU', 'ERREUR']
//       - objet multi-conditions : { statut_analyse_pivar: ['NOUVEAU'], statut_test: 'terminé', derniere_question_repondue: 25 }
//   updateVisiteur(session_id, fields)              → void
//   getResponsesBySession(session_id)               → array 25 questions triées
//   updateResponse(id_question, session_id, fields) → void
//   getBilan(session_id)                            → objet bilan ou null
//   updateBilan(session_id, fields)                 → void

'use strict';

const logger = require('../utils/logger');

// ─── CONFIGURATION ────────────────────────────────────────────────────────────

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const TOKEN   = process.env.AIRTABLE_TOKEN;

const TABLES = {
  VISITEUR:  'tblslPP9B71FveOX5',
  RESPONSES: 'tblLnWhszYAQldZOJ',
  BILAN:     'tbljRMIMjM9SwVyox',   // "Copie de BILAN 2" — table de production
};

const BASE_URL = `https://api.airtable.com/v0/${BASE_ID}`;

// ─── HELPERS HTTP ─────────────────────────────────────────────────────────────

function headers() {
  return {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type':  'application/json',
  };
}

/**
 * GET paginé — retourne tous les records d'une table avec filtre optionnel.
 */
async function fetchAllRecords(tableId, filterFormula = null) {
  const records = [];
  let offset    = null;

  do {
    const params = new URLSearchParams();
    if (filterFormula) params.set('filterByFormula', filterFormula);
    if (offset)        params.set('offset', offset);

    const url = `${BASE_URL}/${tableId}?${params.toString()}`;
    const res = await fetch(url, { headers: headers() });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Airtable GET ${tableId} — HTTP ${res.status}: ${body}`);
    }

    const data = await res.json();
    records.push(...(data.records || []));
    offset = data.offset || null;

  } while (offset);

  return records;
}

/**
 * PATCH — mise à jour partielle d'un record existant.
 * typecast: true pour accepter les noms de champs directement sans IDs.
 */
async function patchRecord(tableId, recordId, fields) {
  const url = `${BASE_URL}/${tableId}/${recordId}`;

  const res = await fetch(url, {
    method:  'PATCH',
    headers: headers(),
    body:    JSON.stringify({ fields, typecast: true }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Airtable PATCH ${tableId}/${recordId} — HTTP ${res.status}: ${body}`);
  }

  return res.json();
}

/**
 * Supprime les clés undefined avant envoi (conserve null pour effacer un champ).
 */
function sanitizeFields(fields) {
  const clean = {};
  for (const [k, v] of Object.entries(fields)) {
    if (v !== undefined) clean[k] = v;
  }
  return clean;
}

/**
 * Construit une formule Airtable depuis un objet de conditions.
 * Supporte :
 *   - valeur string/number simple → {champ}="valeur"
 *   - array de strings → OR({champ}="v1", {champ}="v2")
 */
function buildFormuleFromObject(conditions) {
  const clauses = [];

  for (const [champ, valeur] of Object.entries(conditions)) {
    if (Array.isArray(valeur)) {
      if (valeur.length === 0) continue;
      if (valeur.length === 1) {
        clauses.push(`{${champ}}="${valeur[0]}"`);
      } else {
        const orParts = valeur.map(v => `{${champ}}="${v}"`).join(', ');
        clauses.push(`OR(${orParts})`);
      }
    } else if (typeof valeur === 'number') {
      clauses.push(`{${champ}}=${valeur}`);
    } else {
      clauses.push(`{${champ}}="${valeur}"`);
    }
  }

  if (clauses.length === 0) return null;
  if (clauses.length === 1) return clauses[0];
  return `AND(${clauses.join(', ')})`;
}

// ─── CACHE RECORD IDS ─────────────────────────────────────────────────────────

const cache = {
  visiteurs: new Map(),  // session_id → record_id
  responses: new Map(),  // "id_question::session_id" → record_id
  bilans:    new Map(),  // session_id → record_id
};

// ─── VISITEUR ─────────────────────────────────────────────────────────────────

/**
 * Récupère un visiteur par session_id (= candidate_ID dans VISITEUR).
 * @returns {Object|null}
 */
async function getVisiteur(session_id) {
  if (!session_id) throw new Error('getVisiteur: session_id manquant');

  const formula = `{candidate_ID}="${session_id}"`;
  const records = await fetchAllRecords(TABLES.VISITEUR, formula);

  if (records.length === 0) {
    logger.warn('airtableService.getVisiteur: aucun enregistrement', { session_id });
    return null;
  }

  const record = records[0];
  cache.visiteurs.set(session_id, record.id);
  logger.info('airtableService.getVisiteur: trouvé', { session_id, record_id: record.id });
  return { _record_id: record.id, ...record.fields };
}

/**
 * Récupère les visiteurs selon un filtre.
 *
 * @param {string[]|Object} filtre
 *   - Array de statuts : ['NOUVEAU', 'ERREUR', 'en_cours']
 *     → filtre sur statut_analyse_pivar uniquement
 *   - Objet multi-conditions : { statut_analyse_pivar: ['NOUVEAU'], statut_test: 'terminé', derniere_question_repondue: 25 }
 *     → toutes les conditions combinées en AND
 *
 * @returns {Object[]}
 */
async function getVisiteursByStatus(filtre) {
  let formula;

  if (Array.isArray(filtre)) {
    // Format simple — array de statuts
    if (filtre.length === 0) throw new Error('getVisiteursByStatus: tableau vide');
    formula = buildFormuleFromObject({ statut_analyse_pivar: filtre });

  } else if (filtre && typeof filtre === 'object') {
    // Format objet multi-conditions
    formula = buildFormuleFromObject(filtre);

  } else {
    throw new Error(`getVisiteursByStatus: format de filtre non supporté — reçu: ${typeof filtre}`);
  }

  const records = await fetchAllRecords(TABLES.VISITEUR, formula);

  return records.map(r => {
    if (r.fields.candidate_ID) {
      cache.visiteurs.set(r.fields.candidate_ID, r.id);
    }
    return { _record_id: r.id, ...r.fields };
  });
}

/**
 * Met à jour les champs d'un visiteur.
 */
async function updateVisiteur(session_id, fields) {
  if (!session_id) throw new Error('updateVisiteur: session_id manquant');
  if (!fields || Object.keys(fields).length === 0) return;

  let record_id = cache.visiteurs.get(session_id);
  if (!record_id) {
    const visiteur = await getVisiteur(session_id);
    if (!visiteur) throw new Error(`updateVisiteur: visiteur ${session_id} introuvable`);
    record_id = visiteur._record_id;
  }

  const clean = sanitizeFields(fields);
  await patchRecord(TABLES.VISITEUR, record_id, clean);
  logger.info('airtableService.updateVisiteur: mis à jour', { session_id, champs: Object.keys(clean) });
}

// ─── RESPONSES ────────────────────────────────────────────────────────────────

/**
 * Récupère les 25 réponses d'un candidat, triées par numero_global.
 * @returns {Object[]}
 */
async function getResponsesBySession(session_id) {
  if (!session_id) throw new Error('getResponsesBySession: session_id manquant');

  const formula = `{session_ID}="${session_id}"`;
  const records = await fetchAllRecords(TABLES.RESPONSES, formula);

  if (records.length === 0) {
    logger.warn('airtableService.getResponsesBySession: aucune réponse', { session_id });
    return [];
  }

  for (const r of records) {
    const key = `${r.fields.id_question}::${session_id}`;
    cache.responses.set(key, r.id);
  }

  const sorted = records
    .map(r => ({ _record_id: r.id, ...r.fields }))
    .sort((a, b) => (a.numero_global || 0) - (b.numero_global || 0));

  logger.info('airtableService.getResponsesBySession: chargé', { session_id, count: sorted.length });
  return sorted;
}

/**
 * Met à jour les champs d'une réponse (une question).
 */
async function updateResponse(id_question, session_id, fields) {
  if (!id_question) throw new Error('updateResponse: id_question manquant');
  if (!session_id)  throw new Error('updateResponse: session_id manquant');
  if (!fields || Object.keys(fields).length === 0) return;

  const cacheKey = `${id_question}::${session_id}`;
  let record_id  = cache.responses.get(cacheKey);

  if (!record_id) {
    const formula = `AND({id_question}="${id_question}", {session_ID}="${session_id}")`;
    const records = await fetchAllRecords(TABLES.RESPONSES, formula);

    if (records.length === 0) {
      throw new Error(`updateResponse: réponse introuvable — id_question=${id_question} session=${session_id}`);
    }

    record_id = records[0].id;
    cache.responses.set(cacheKey, record_id);
  }

  const clean = sanitizeFields(fields);
  await patchRecord(TABLES.RESPONSES, record_id, clean);

  logger.debug('airtableService.updateResponse: mis à jour', {
    id_question,
    session_id,
    champs: Object.keys(clean).slice(0, 5),
  });
}

// ─── BILAN ────────────────────────────────────────────────────────────────────

/**
 * Récupère le bilan d'un candidat.
 * @returns {Object|null}
 */
async function getBilan(session_id) {
  if (!session_id) throw new Error('getBilan: session_id manquant');

  const formula = `{session_ID}="${session_id}"`;
  const records = await fetchAllRecords(TABLES.BILAN, formula);

  if (records.length === 0) {
    logger.warn('airtableService.getBilan: aucun bilan trouvé', { session_id });
    return null;
  }

  const record = records[0];
  cache.bilans.set(session_id, record.id);
  logger.info('airtableService.getBilan: trouvé', { session_id, record_id: record.id });
  return { _record_id: record.id, ...record.fields };
}

/**
 * Met à jour les champs du bilan d'un candidat.
 */
async function updateBilan(session_id, fields) {
  if (!session_id) throw new Error('updateBilan: session_id manquant');
  if (!fields || Object.keys(fields).length === 0) return;

  let record_id = cache.bilans.get(session_id);
  if (!record_id) {
    const bilan = await getBilan(session_id);
    if (!bilan) throw new Error(`updateBilan: bilan introuvable pour session ${session_id}`);
    record_id = bilan._record_id;
  }

  const clean = sanitizeFields(fields);
  await patchRecord(TABLES.BILAN, record_id, clean);
  logger.info('airtableService.updateBilan: mis à jour', { session_id, nb_champs: Object.keys(clean).length });
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  getVisiteur,
  getVisiteursByStatus,
  updateVisiteur,
  getResponsesBySession,
  updateResponse,
  getBilan,
  updateBilan,
};
