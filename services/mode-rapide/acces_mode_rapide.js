// services/mode-rapide/acces_mode_rapide.js
// Accès Airtable AUTONOME du mode rapide — v1.1 (13/08/2026) — Profil-Cognitif
//
// v1.1 — CORRECTIF nom du jeton (incident 13/08, 13h17) : la variable du service
//   s'appelle AIRTABLE_TOKEN (cf. server.js, requiredEnv, et la route de debug) —
//   pas AIRTABLE_API_KEY. Résolution au pattern maison : AIRTABLE_TOKEN d'abord,
//   AIRTABLE_API_KEY en repli. Aucune autre modification.
//
// POURQUOI CE FICHIER EXISTE : pour que le déploiement du mode rapide ne modifie
// AUCUN fichier existant (décision garante 13/08 : « je ne touche jamais un fichier »).
// Tout l'accès propre au mode rapide est ici : création/lecture/patch de la table
// MODE_RAPIDE (seule table écrite — consigne CA-08) et lectures de contrôle
// (ETAPE1_T3_PILIER, ETAPE1_T3_BILAN — lecture seule).
//
// La configuration est résolue dans cet ordre : config/airtable.js si présent,
// sinon variables d'environnement (AIRTABLE_API_KEY / AIRTABLE_BASE_ID),
// sinon l'ID de base connu du projet.

'use strict';

const Airtable = require('airtable');
const logger   = require('../../utils/logger');

let cfg = {};
try { cfg = require('../../config/airtable'); } catch (e) { cfg = {}; }

const API_KEY = (cfg.API_KEY || cfg.apiKey || process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY);   // ⭐ v1.1 — AIRTABLE_TOKEN = la variable du service
const BASE_ID = (cfg.BASE_ID || cfg.baseId || process.env.AIRTABLE_BASE_ID || 'appgghhXjYBdFRras');
const TABLES  = cfg.TABLES || {};

const T_MODE_RAPIDE = TABLES.MODE_RAPIDE       || 'MODE_RAPIDE';
const T_T3_PILIER   = TABLES.ETAPE1_T3_PILIER  || 'ETAPE1_T3_PILIER';
const T_T3_BILAN    = TABLES.ETAPE1_T3_BILAN   || 'ETAPE1_T3_BILAN';

let _base = null;
function base() {
  if (!_base) {
    if (!API_KEY) throw new Error('AIRTABLE_TOKEN / AIRTABLE_API_KEY manquant (env ou config/airtable)');
    _base = new Airtable({ apiKey: API_KEY }).base(BASE_ID);
  }
  return _base;
}
const _sel = v => (v && typeof v === 'object' && v.name !== undefined) ? v.name : (v == null ? '' : String(v));
const _clean = o => { const r = {}; for (const k of Object.keys(o)) if (o[k] !== undefined) r[k] = o[k]; return r; };

// ─── MODE_RAPIDE (seule table écrite) ───────────────────────────────────────
async function createModeRapide(candidat_id, fields) {
  const created = await base()(T_MODE_RAPIDE).create(
    [{ fields: { candidat_id, ..._clean(fields) } }], { typecast: true });
  logger.info('MODE_RAPIDE created', { candidat_id, recordId: created[0].id });
  return created[0].id;
}

async function getModeRapideDerniere(candidat_id) {
  const records = await base()(T_MODE_RAPIDE).select({
    filterByFormula: `{candidat_id} = "${candidat_id}"`,
    sort: [{ field: 'date_execution', direction: 'desc' }],
    maxRecords: 1
  }).firstPage();
  if (!records || records.length === 0) return null;
  return { airtable_id: records[0].id, ...records[0].fields };
}

async function patchModeRapideControle(recordId, fields) {
  await base()(T_MODE_RAPIDE).update([{ id: recordId, fields: _clean(fields) }], { typecast: true });
  logger.info('MODE_RAPIDE contrôle patché', { recordId, champs: Object.keys(fields) });
  return true;
}

// ─── Lectures de contrôle (protocole complet — LECTURE SEULE) ───────────────
async function getArchitecturePourControle(candidat_id) {
  const records = await base()(T_T3_PILIER).select({
    filterByFormula: `{candidat_id} = "${candidat_id}"`
  }).all();
  if (!records || records.length === 0) return null;
  const roles = {}, modes = {};
  let socle = null;
  for (const r of records) {
    const f = r.fields;
    const p = _sel(f.pilier);
    if (!p) continue;
    const role = String(_sel(f.pilier_role)).toLowerCase();
    roles[p] = role || 'fonctionnel';
    modes[p] = f.pilier_mode || '';
    if (role === 'socle') socle = p;
  }
  let filtre = '';
  try {
    const b = await base()(T_T3_BILAN).select({
      filterByFormula: `{candidat_id} = "${candidat_id}"`, maxRecords: 1
    }).firstPage();
    if (b && b[0]) filtre = b[0].fields.filtre || b[0].fields.filtre_texte || '';
  } catch (eF) {
    logger.warn('Contrôle mode rapide — filtre T3_BILAN non lu (non bloquant)', { candidat_id, error: eF.message });
  }
  return { socle, roles, modes, filtre };
}

module.exports = { createModeRapide, getModeRapideDerniere, patchModeRapideControle, getArchitecturePourControle };
