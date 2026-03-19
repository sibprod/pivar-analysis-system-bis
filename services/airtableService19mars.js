// services/airtableService.js
// Service Airtable v8.0 — CRUD complet pipeline profil cognitif
// Modifications v8 :
//   - angles_morts → vue_systemique partout
//   - statut_analyse_pivar → statut_analyse_reponses
//   - Ajout getResponsesBySession (alias de getResponses, requis par orchestrateur)
//   - Nouveaux champs BILAN v8 supportés sans liste blanche restrictive

'use strict';

const Airtable = require('airtable');
const airtableConfig = require('../config/airtable');
const logger = require('../utils/logger');

// Instanciation lazy — évite l'erreur "API key required" au chargement du module
// avant que process.env soit disponible sur Render
let _base = null;
function getBase() {
  if (!_base) {
    _base = new Airtable({ apiKey: airtableConfig.TOKEN }).base(airtableConfig.BASE_ID);
  }
  return _base;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ═══════════════════════════════════════════════════════════════════════════
// NORMALISATION NIVEAUX EXCELLENCE (Single Select Airtable)
// Options strictes : nulle / faible / moyen / élevé
// ═══════════════════════════════════════════════════════════════════════════

function normalizeNiveauExcellence(value) {
  if (!value) return null;
  const n = value.toString().toLowerCase().trim();
  if (n === 'nulle') return 'nulle';
  if (n === 'faible') return 'faible';
  if (n === 'moyen' || n === 'moyenne') return 'moyen';
  if (n === 'élevé' || n === 'eleve' || n === 'elevé' || n === 'élevee' || n === 'elevee') return 'élevé';
  if (n === 'nul' || n === 'null' || n === 'aucun' || n === 'aucune') return 'nulle';
  logger.warn('normalizeNiveauExcellence: valeur inconnue ignorée', { original: value });
  return null;
}

// Champs Single Select excellence dans RESPONSES à normaliser
// v8 : vue_systemique remplace angles_morts / anglesmorts
const EXCELLENCE_FIELDS_RESPONSES = [
  'anticipation_niveau',
  'decentration_niveau',
  'metacognition_niveau',
  'vue_systemique_niveau'
];

// Champs Single Select excellence dans BILAN
const EXCELLENCE_FIELDS_BILAN = [
  'anticipation_niveau',
  'decentration_niveau',
  'metacognition_niveau',
  'vue_systemique_niveau',
  'excellence_dominante',
  'excellence_secondaire'
];

// ═══════════════════════════════════════════════════════════════════════════
// MAPPING NOMS EXCELLENCE INTERNE → AIRTABLE
// v8 : vue_systemique → vue_systemique (plus jamais anglesmorts)
// ═══════════════════════════════════════════════════════════════════════════

const EXCELLENCE_NAME_MAPPING = {
  'anticipation_spontanee': 'anticipation',
  'decentration_cognitive':  'decentration',
  'meta_cognition':          'metacognition',
  'metacognition':           'metacognition',
  'vue_systemique':          'vue_systemique',
  // Accepter aussi les formes courtes
  'anticipation':  'anticipation',
  'decentration':  'decentration'
};

function mapExcellenceName(value) {
  if (!value || typeof value !== 'string') return null;
  const cleaned = value.toLowerCase().trim();
  return EXCELLENCE_NAME_MAPPING[cleaned] || cleaned;
}

// ═══════════════════════════════════════════════════════════════════════════
// NETTOYAGE GUILLEMETS PARASITES
// ═══════════════════════════════════════════════════════════════════════════

function deepCleanString(value) {
  if (typeof value !== 'string') return value;
  let cleaned = value;
  while (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 1) {
    cleaned = cleaned.slice(1, -1);
  }
  while (cleaned.startsWith("'") && cleaned.endsWith("'") && cleaned.length > 1) {
    cleaned = cleaned.slice(1, -1);
  }
  return cleaned.trim();
}

// ═══════════════════════════════════════════════════════════════════════════
// VISITEUR
// ═══════════════════════════════════════════════════════════════════════════

async function getVisiteur(session_id) {
  try {
    // Dans la table VISITEUR, le champ identifiant s'appelle candidate_ID
    const records = await getBase()(airtableConfig.TABLES.VISITEUR)
      .select({
        filterByFormula: `{candidate_ID} = "${session_id}"`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      logger.warn('Visiteur not found', { session_id });
      return null;
    }

    return { id: records[0].id, ...records[0].fields };
  } catch (error) {
    logger.error('Failed to get visiteur', { session_id, error: error.message });
    throw error;
  }
}

async function updateVisiteur(session_id, fields) {
  try {
    const visiteur = await getVisiteur(session_id);
    if (!visiteur) throw new Error(`Visiteur ${session_id} not found`);

    await getBase()(airtableConfig.TABLES.VISITEUR).update([{
      id: visiteur.id,
      fields
    }], { typecast: true });

    logger.debug('Visiteur updated', { session_id, fields: Object.keys(fields) });
  } catch (error) {
    logger.error('Failed to update visiteur', { session_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSES — lecture
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Récupérer les 25 réponses d'un candidat triées par numero_global.
 * Alias getResponsesBySession pour compatibilité orchestrateur v8.
 */
async function getResponses(session_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.RESPONSES)
      .select({
        filterByFormula: `{session_ID} = "${session_id}"`,
        sort: [{ field: 'numero_global', direction: 'asc' }]
      })
      .all();

    const responses = records.map(r => ({ airtable_id: r.id, ...r.fields }));
    logger.debug('Responses fetched', { session_id, count: responses.length });
    return responses;
  } catch (error) {
    logger.error('Failed to get responses', { session_id, error: error.message });
    throw error;
  }
}

// Alias requis par orchestratorService v8
const getResponsesBySession = getResponses;

// ═══════════════════════════════════════════════════════════════════════════
// RESPONSES — écriture
// ═══════════════════════════════════════════════════════════════════════════

async function updateResponse(id_question, session_id, fields) {
  try {
    const records = await getBase()(airtableConfig.TABLES.RESPONSES)
      .select({
        filterByFormula: `AND({session_ID} = "${session_id}", {id_question} = "${id_question}")`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      throw new Error(`Response ${id_question} not found for ${session_id}`);
    }

    const cleanedFields = {};
    for (const [key, value] of Object.entries(fields)) {
      if (typeof value === 'string' && value.length > 0) {
        cleanedFields[key] = value.replace(/^["']+|["']+$/g, '');
      } else {
        cleanedFields[key] = value;
      }
    }

    // Mapper limbique_intensite (valeurs normalisées Airtable)
    if (cleanedFields.limbique_intensite) {
      const mapping = airtableConfig.VALUE_MAPPING?.limbique_intensite || {};
      cleanedFields.limbique_intensite = mapping[cleanedFields.limbique_intensite] || cleanedFields.limbique_intensite;
    }

    // Normaliser les champs Single Select excellence
    for (const field of EXCELLENCE_FIELDS_RESPONSES) {
      if (cleanedFields[field] !== undefined) {
        const normalized = normalizeNiveauExcellence(cleanedFields[field]);
        if (normalized === null) delete cleanedFields[field];
        else cleanedFields[field] = normalized;
      }
    }

    await getBase()(airtableConfig.TABLES.RESPONSES).update([{
      id: records[0].id,
      fields: cleanedFields
    }], { typecast: true });

    logger.debug('Response updated', { id_question, session_id });
  } catch (error) {
    logger.error('Failed to update response', { id_question, session_id, error: error.message });
    throw error;
  }
}

async function batchUpdateResponses(updates) {
  try {
    const bySession = {};
    for (const u of updates) {
      if (!bySession[u.session_id]) bySession[u.session_id] = [];
      bySession[u.session_id].push(u);
    }

    let totalUpdated = 0;

    for (const [session_id, sessionUpdates] of Object.entries(bySession)) {
      const records = await getBase()(airtableConfig.TABLES.RESPONSES)
        .select({ filterByFormula: `{session_ID} = "${session_id}"` })
        .all();

      const recordMap = {};
      for (const r of records) recordMap[r.fields.id_question] = r.id;

      const batchUpdates = [];
      for (const update of sessionUpdates) {
        const airtableId = recordMap[update.id_question];
        if (!airtableId) {
          logger.warn('Record not found for batch update', { id_question: update.id_question, session_id });
          continue;
        }

        const cleanedFields = {};
        for (const [key, value] of Object.entries(update.fields)) {
          if (typeof value === 'string' && value.length > 0) {
            cleanedFields[key] = value.replace(/^["']+|["']+$/g, '');
          } else {
            cleanedFields[key] = value;
          }
        }

        if (cleanedFields.limbique_intensite) {
          const mapping = airtableConfig.VALUE_MAPPING?.limbique_intensite || {};
          cleanedFields.limbique_intensite = mapping[cleanedFields.limbique_intensite] || cleanedFields.limbique_intensite;
        }

        for (const field of EXCELLENCE_FIELDS_RESPONSES) {
          if (cleanedFields[field] !== undefined) {
            const normalized = normalizeNiveauExcellence(cleanedFields[field]);
            if (normalized === null) delete cleanedFields[field];
            else cleanedFields[field] = normalized;
          }
        }

        batchUpdates.push({ id: airtableId, fields: cleanedFields });
      }

      for (let i = 0; i < batchUpdates.length; i += 10) {
        const batch = batchUpdates.slice(i, i + 10);
        await getBase()(airtableConfig.TABLES.RESPONSES).update(batch, { typecast: true });
        totalUpdated += batch.length;
        if (i + 10 < batchUpdates.length) await sleep(200);
      }
    }

    logger.info('Batch update completed', { total: totalUpdated });
  } catch (error) {
    logger.error('Failed batch update', { error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BILAN — lecture
// ═══════════════════════════════════════════════════════════════════════════

async function getBilan(session_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.BILAN)
      .select({
        filterByFormula: `{session_ID} = "${session_id}"`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      logger.debug('Bilan not found', { session_id });
      return null;
    }

    return { id: records[0].id, ...records[0].fields };
  } catch (error) {
    logger.error('Failed to get bilan', { session_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// BILAN — écriture
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Nettoyage complet d'un objet fields avant écriture BILAN.
 * - deepClean strings
 * - normalise niveaux Single Select excellence
 * - mappe excellence_dominante / excellence_secondaire
 */
function cleanBilanFields(fields) {
  const cleaned = {};

  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      let v = deepCleanString(value);

      if (key === 'excellence_dominante' || key === 'excellence_secondaire') {
        const mapped = mapExcellenceName(v);
        if (mapped) cleaned[key] = mapped;
        // Si mapExcellenceName retourne null, on skip le champ
      } else {
        cleaned[key] = v;
      }
    } else {
      cleaned[key] = value;
    }
  }

  // Normaliser les niveaux Single Select dans BILAN
  for (const field of EXCELLENCE_FIELDS_BILAN) {
    if (cleaned[field] !== undefined) {
      const normalized = normalizeNiveauExcellence(cleaned[field]);
      if (normalized === null) delete cleaned[field];
      else cleaned[field] = normalized;
    }
  }

  return cleaned;
}

async function createOrUpdateBilan(session_id, fields) {
  try {
    const existingBilan = await getBilan(session_id);
    const cleanedFields = cleanBilanFields(fields);

    if (existingBilan) {
      await getBase()(airtableConfig.TABLES.BILAN).update([{
        id: existingBilan.id,
        fields: cleanedFields
      }], { typecast: true });
      logger.debug('Bilan updated', { session_id });
    } else {
      await getBase()(airtableConfig.TABLES.BILAN).create([{
        fields: { session_ID: session_id, ...cleanedFields }
      }], { typecast: true });
      logger.debug('Bilan created', { session_id });
    }
  } catch (error) {
    logger.error('Failed to create/update bilan', { session_id, error: error.message });
    throw error;
  }
}

async function updateBilan(session_id, fields) {
  try {
    const bilan = await getBilan(session_id);
    if (!bilan) {
      // Créer si inexistant plutôt que crasher
      logger.warn('Bilan not found for updateBilan — creating', { session_id });
      return createOrUpdateBilan(session_id, fields);
    }

    const cleanedFields = cleanBilanFields(fields);

    await getBase()(airtableConfig.TABLES.BILAN).update([{
      id: bilan.id,
      fields: cleanedFields
    }], { typecast: true });

    logger.debug('Bilan updated', { session_id, fieldsCount: Object.keys(cleanedFields).length });
  } catch (error) {
    logger.error('Failed to update bilan', { session_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VISITEURS PAR STATUT (polling queue)
// v8 : statut_analyse_reponses remplace statut_analyse_pivar
// ═══════════════════════════════════════════════════════════════════════════

async function getVisiteursByStatus(filters = {}) {
  try {
    const conditions = [];

    if (filters.statut_analyse_pivar) {
      conditions.push(`OR(${filters.statut_analyse_pivar.map(v => `{statut_analyse_pivar} = "${v}"`).join(', ')})`);
    }
    if (filters.statut_analyse_reponses) {
      conditions.push(`OR(${filters.statut_analyse_reponses.map(v => `{statut_analyse_pivar} = "${v}"`).join(', ')})`);
    }

    if (filters.statut_test) {
      conditions.push(`{statut_test} = "${filters.statut_test}"`);
    }

    if (filters.derniere_question_repondue) {
      conditions.push(`{derniere_question_repondue} = ${filters.derniere_question_repondue}`);
    }

    const formula = conditions.length > 0 ? `AND(${conditions.join(', ')})` : '';

    const records = await getBase()(airtableConfig.TABLES.VISITEUR)
      .select({ filterByFormula: formula || undefined })
      .all();

    const visiteurs = records.map(r => ({ id: r.id, ...r.fields }));
    logger.debug('Visiteurs fetched by status', { count: visiteurs.length, filters });
    return visiteurs;
  } catch (error) {
    logger.error('Failed to get visiteurs by status', { error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// GLOBAL (optionnel, conservé pour compatibilité)
// ═══════════════════════════════════════════════════════════════════════════

async function getGlobal(session_id) {
  try {
    if (!airtableConfig.TABLES.GLOBAL) return null;

    const records = await getBase()(airtableConfig.TABLES.GLOBAL)
      .select({ filterByFormula: `{session_ID} = "${session_id}"`, maxRecords: 1 })
      .firstPage();

    if (records.length === 0) return null;
    return { id: records[0].id, ...records[0].fields };
  } catch (error) {
    if (error.message.includes('NOT_FOUND') || error.message.includes('Could not find table')) return null;
    logger.error('Failed to get global', { session_id, error: error.message });
    throw error;
  }
}

async function createOrUpdateGlobal(session_id, fields) {
  try {
    if (!airtableConfig.TABLES.GLOBAL) return;

    const existing = await getGlobal(session_id);
    if (existing) {
      await getBase()(airtableConfig.TABLES.GLOBAL).update([{ id: existing.id, fields }]);
    } else {
      await getBase()(airtableConfig.TABLES.GLOBAL).create([{ fields: { session_ID: session_id, ...fields } }]);
    }
  } catch (error) {
    if (error.message.includes('NOT_FOUND') || error.message.includes('Could not find table')) return;
    logger.error('Failed to create/update global', { session_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  getVisiteur,
  updateVisiteur,
  getResponses,
  getResponsesBySession,    // alias requis par orchestrateur v8
  updateResponse,
  batchUpdateResponses,
  getBilan,
  createOrUpdateBilan,
  updateBilan,
  getGlobal,
  createOrUpdateGlobal,
  getVisiteursByStatus
};
