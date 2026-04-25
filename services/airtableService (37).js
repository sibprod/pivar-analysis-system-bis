// services/airtableService.js
// Service Airtable v9.0 — Profil-Cognitif
//
// Responsabilités :
//   - VISITEUR : suivi candidat, statuts, backups (existant)
//   - RESPONSES : lecture seule (frontend candidat) (existant)
//   - ETAPE1_T1, T2, T3, T4_BILAN : nouvelles tables du pipeline v9
//   - REFERENTIEL_LEXIQUE : 15 termes doctrinaux, lus par tous les agents

'use strict';

const Airtable        = require('airtable');
const airtableConfig  = require('../config/airtable');
const logger          = require('../utils/logger');

// ─── Lazy initialization du base Airtable ─────────────────────────────────────
// Évite l'erreur "API key required" au chargement du module
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
// HELPERS — nettoyage et normalisation
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Retire les guillemets parasites en début/fin de chaîne (Claude en ajoute parfois)
 */
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

/**
 * Nettoie tous les champs string d'un objet avant écriture Airtable
 */
function cleanFields(fields) {
  const cleaned = {};
  for (const [key, value] of Object.entries(fields)) {
    if (typeof value === 'string') {
      cleaned[key] = deepCleanString(value);
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

// ═══════════════════════════════════════════════════════════════════════════
// VISITEUR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Récupère un visiteur par son candidate_ID
 */
async function getVisiteur(candidate_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.VISITEUR)
      .select({
        filterByFormula: `{candidate_ID} = "${candidate_id}"`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      logger.warn('Visiteur not found', { candidate_id });
      return null;
    }

    return { id: records[0].id, ...records[0].fields };
  } catch (error) {
    logger.error('Failed to get visiteur', { candidate_id, error: error.message });
    throw error;
  }
}

/**
 * Met à jour les champs d'un visiteur
 */
async function updateVisiteur(candidate_id, fields) {
  try {
    const visiteur = await getVisiteur(candidate_id);
    if (!visiteur) throw new Error(`Visiteur ${candidate_id} not found`);

    await getBase()(airtableConfig.TABLES.VISITEUR).update([{
      id: visiteur.id,
      fields
    }], { typecast: true });

    logger.debug('Visiteur updated', { candidate_id, fields: Object.keys(fields) });
  } catch (error) {
    logger.error('Failed to update visiteur', { candidate_id, error: error.message });
    throw error;
  }
}

/**
 * Récupère les visiteurs filtrés par statut (pour le polling queue)
 */
async function getVisiteursByStatus(filters = {}) {
  try {
    const conditions = [];

    // Statut analyse — accepte les deux noms pour rétrocompat
    const statutValues = filters.statut_analyse_pivar || filters.statut_analyse || [];
    if (statutValues.length > 0) {
      conditions.push(
        `OR(${statutValues.map(v => `{statut_analyse_pivar} = "${v}"`).join(', ')})`
      );
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
// RESPONSES — LECTURE SEULE (frontend candidat)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Récupère les 25 réponses brutes d'un candidat depuis RESPONSES
 * (table connectée au frontend, lecture seule pour le pipeline v9)
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

// Alias pour compatibilité avec l'ancien orchestrateur
const getResponsesBySession = getResponses;

// ═══════════════════════════════════════════════════════════════════════════
// ETAPE1_T1 — Analyse brute des 25 réponses
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Récupère les lignes T1 d'un candidat (max 25)
 */
async function getEtape1T1(candidat_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T1)
      .select({
        filterByFormula: `{candidat_id} = "${candidat_id}"`,
        sort: [{ field: 'id_question', direction: 'asc' }]
      })
      .all();

    return records.map(r => ({ airtable_id: r.id, ...r.fields }));
  } catch (error) {
    logger.error('Failed to get ETAPE1_T1', { candidat_id, error: error.message });
    throw error;
  }
}

/**
 * Écrit (ou écrase) les lignes T1 d'un candidat
 * Pattern d'écrasement : supprime les lignes existantes puis crée les nouvelles
 *
 * @param {string} candidat_id
 * @param {Array<Object>} rows - tableau d'objets, chaque objet est une ligne T1
 */
async function writeEtape1T1(candidat_id, rows) {
  try {
    // 1. Supprimer les lignes existantes
    await deleteRowsByCandidatId(airtableConfig.TABLES.ETAPE1_T1, candidat_id);

    // 2. Créer les nouvelles lignes en batchs de 10
    await createRowsInBatches(airtableConfig.TABLES.ETAPE1_T1, rows, candidat_id);

    logger.info('ETAPE1_T1 written', { candidat_id, count: rows.length });
  } catch (error) {
    logger.error('Failed to write ETAPE1_T1', { candidat_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ETAPE1_T2 — Synthèse par question
// ═══════════════════════════════════════════════════════════════════════════

async function getEtape1T2(candidat_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T2)
      .select({
        filterByFormula: `{candidat_id} = "${candidat_id}"`,
        sort: [{ field: 'id_question', direction: 'asc' }]
      })
      .all();

    return records.map(r => ({ airtable_id: r.id, ...r.fields }));
  } catch (error) {
    logger.error('Failed to get ETAPE1_T2', { candidat_id, error: error.message });
    throw error;
  }
}

async function writeEtape1T2(candidat_id, rows) {
  try {
    await deleteRowsByCandidatId(airtableConfig.TABLES.ETAPE1_T2, candidat_id);
    await createRowsInBatches(airtableConfig.TABLES.ETAPE1_T2, rows, candidat_id);
    logger.info('ETAPE1_T2 written', { candidat_id, count: rows.length });
  } catch (error) {
    logger.error('Failed to write ETAPE1_T2', { candidat_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ETAPE1_T3 — Analyse pilier × circuit
// ═══════════════════════════════════════════════════════════════════════════

async function getEtape1T3(candidat_id, options = {}) {
  try {
    const conditions = [`{candidat_id} = "${candidat_id}"`];
    if (options.pilier) conditions.push(`{pilier} = "${options.pilier}"`);

    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T3)
      .select({
        filterByFormula: conditions.length > 1
          ? `AND(${conditions.join(', ')})`
          : conditions[0],
        sort: [
          { field: 'pilier', direction: 'asc' },
          { field: 'circuit_id', direction: 'asc' }
        ]
      })
      .all();

    return records.map(r => ({ airtable_id: r.id, ...r.fields }));
  } catch (error) {
    logger.error('Failed to get ETAPE1_T3', { candidat_id, error: error.message });
    throw error;
  }
}

async function writeEtape1T3(candidat_id, rows) {
  try {
    await deleteRowsByCandidatId(airtableConfig.TABLES.ETAPE1_T3, candidat_id);
    await createRowsInBatches(airtableConfig.TABLES.ETAPE1_T3, rows, candidat_id);
    logger.info('ETAPE1_T3 written', { candidat_id, count: rows.length });
  } catch (error) {
    logger.error('Failed to write ETAPE1_T3', { candidat_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ETAPE1_T4_BILAN — Bilan final (1 ligne par candidat)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Récupère le bilan T4 d'un candidat (1 ligne)
 */
async function getEtape1T4Bilan(candidat_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T4_BILAN)
      .select({
        filterByFormula: `{candidat_id} = "${candidat_id}"`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) {
      return null;
    }

    return { airtable_id: records[0].id, ...records[0].fields };
  } catch (error) {
    logger.error('Failed to get ETAPE1_T4_BILAN', { candidat_id, error: error.message });
    throw error;
  }
}

/**
 * Crée ou met à jour le bilan T4 (upsert)
 * @param {string} candidat_id
 * @param {Object} fields - Champs à écrire (peut être partiel)
 */
async function upsertEtape1T4Bilan(candidat_id, fields) {
  try {
    const existing = await getEtape1T4Bilan(candidat_id);
    const cleanedFields = cleanFields(fields);

    if (existing) {
      // Mise à jour partielle
      await getBase()(airtableConfig.TABLES.ETAPE1_T4_BILAN).update([{
        id: existing.airtable_id,
        fields: cleanedFields
      }], { typecast: true });
      logger.debug('ETAPE1_T4_BILAN updated', {
        candidat_id,
        fieldsCount: Object.keys(cleanedFields).length
      });
    } else {
      // Création
      await getBase()(airtableConfig.TABLES.ETAPE1_T4_BILAN).create([{
        fields: { candidat_id, ...cleanedFields }
      }], { typecast: true });
      logger.debug('ETAPE1_T4_BILAN created', {
        candidat_id,
        fieldsCount: Object.keys(cleanedFields).length
      });
    }
  } catch (error) {
    logger.error('Failed to upsert ETAPE1_T4_BILAN', { candidat_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REFERENTIEL_LEXIQUE — 15 termes doctrinaux
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Charge les 15 termes du lexique depuis Airtable
 * @returns {Array<Object>} 15 termes triés par ordre_affichage
 */
async function getReferentielLexique() {
  try {
    const records = await getBase()(airtableConfig.TABLES.REFERENTIEL_LEXIQUE)
      .select({
        sort: [{ field: 'ordre_affichage', direction: 'asc' }]
      })
      .all();

    const lexique = records.map(r => ({
      id:                       r.fields.id,
      terme:                    r.fields.terme,
      definition:               r.fields.definition,
      ordre_affichage:          r.fields.ordre_affichage,
      categorie:                r.fields.categorie,
      forme_grammaticale:       r.fields.forme_grammaticale || '',
      precision_semantique:     r.fields.precision_semantique || '',
      termes_interdits_associes: r.fields.termes_interdits_associes || '',
      exemple_cecile:           r.fields.exemple_cecile || ''
    }));

    if (lexique.length !== 15) {
      logger.warn('Lexique incomplet', { found: lexique.length, expected: 15 });
    }

    logger.debug('Référentiel lexique loaded', { count: lexique.length });
    return lexique;
  } catch (error) {
    logger.error('Failed to load REFERENTIEL_LEXIQUE', { error: error.message });
    throw error;
  }
}

/**
 * Formate le lexique en bloc texte injectable dans un prompt agent
 * @param {Array<Object>} lexique - Issu de getReferentielLexique()
 * @returns {string} Bloc texte prêt à injecter
 */
function formaterLexiquePourPrompt(lexique) {
  const lignes = ['# 🔒 LEXIQUE DE RÉFÉRENCE (source : Airtable REFERENTIEL_LEXIQUE) — NON NÉGOCIABLE', ''];

  for (const terme of lexique) {
    lignes.push(`## ${terme.ordre_affichage}. ${terme.terme}`);
    lignes.push(`**Définition** : ${terme.definition}`);
    if (terme.forme_grammaticale) {
      lignes.push(`**Forme grammaticale** : ${terme.forme_grammaticale}`);
    }
    if (terme.precision_semantique) {
      lignes.push(`**Précision sémantique** : ${terme.precision_semantique}`);
    }
    if (terme.termes_interdits_associes) {
      lignes.push(`**Termes interdits associés** : ${terme.termes_interdits_associes}`);
    }
    lignes.push('');
  }

  lignes.push('---');
  lignes.push('**RÈGLE ABSOLUE** : utilise ces termes et leurs définitions mot pour mot. Toute reformulation est interdite.');

  return lignes.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS INTERNES — suppression et création en batch
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Supprime toutes les lignes d'une table pour un candidat donné
 * (pattern d'écrasement, D6 actée)
 */
async function deleteRowsByCandidatId(tableName, candidat_id) {
  const records = await getBase()(tableName)
    .select({
      filterByFormula: `{candidat_id} = "${candidat_id}"`,
      fields: [] // ne récupère que l'ID, pas les champs (économie)
    })
    .all();

  if (records.length === 0) {
    logger.debug('No existing rows to delete', { tableName, candidat_id });
    return 0;
  }

  // Suppression par batchs de 10 (max Airtable)
  const ids = records.map(r => r.id);
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    await getBase()(tableName).destroy(batch);
    if (i + 10 < ids.length) await sleep(200);
  }

  logger.debug('Rows deleted', { tableName, candidat_id, count: ids.length });
  return ids.length;
}

/**
 * Crée des lignes en batchs de 10 (limite Airtable) avec sleep 200ms entre batchs
 */
async function createRowsInBatches(tableName, rows, candidat_id) {
  if (!Array.isArray(rows) || rows.length === 0) {
    logger.warn('No rows to create', { tableName, candidat_id });
    return 0;
  }

  const records = rows.map(row => ({
    fields: { candidat_id, ...cleanFields(row) }
  }));

  let created = 0;
  for (let i = 0; i < records.length; i += 10) {
    const batch = records.slice(i, i + 10);
    await getBase()(tableName).create(batch, { typecast: true });
    created += batch.length;
    if (i + 10 < records.length) await sleep(200);
  }

  return created;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // VISITEUR
  getVisiteur,
  updateVisiteur,
  getVisiteursByStatus,

  // RESPONSES (lecture seule)
  getResponses,
  getResponsesBySession,  // alias

  // ETAPE1_T1
  getEtape1T1,
  writeEtape1T1,

  // ETAPE1_T2
  getEtape1T2,
  writeEtape1T2,

  // ETAPE1_T3
  getEtape1T3,
  writeEtape1T3,

  // ETAPE1_T4_BILAN
  getEtape1T4Bilan,
  upsertEtape1T4Bilan,

  // REFERENTIEL_LEXIQUE
  getReferentielLexique,
  formaterLexiquePourPrompt,

  // Helpers exportés (utilisables ailleurs)
  cleanFields,
  deepCleanString
};
