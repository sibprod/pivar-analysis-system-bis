// services/infrastructure/airtableService.js
// Service Airtable v12.1-fable — Profil-Cognitif
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// PHASE v12.1 (2026-06-24) — RÔLES DE PILIERS (agent Phase 4b) :
//   ⭐ ADDITIF PUR. Une seule fonction ajoutée, aucun appelant existant modifié :
//     (E) patchEtape1T2CircuitsPourbilanRoles : patch ciblé du SEUL champ
//         role_pilier sur les lignes de la table figée POURBILAN. Modèle =
//         patchEtape1T1Rows. Utilisée par agent_etape1_T2_phase4b_roles_piliers.
//
// PHASE v12.0 (2026-06-18) — TABLE FIGÉE CIRCUITS_POURBILAN (Phase 4 étape 1.2) :
//   ⭐ ADDITIF. Une seule fonction existante modifiée (getReferentielCircuits),
//      UNIQUEMENT par ajout d'un champ (capacite) à l'objet retourné — aucun
//      champ retiré ni renommé, donc aucun appelant existant n'est cassé.
//   4 changements :
//     (A) getReferentielCircuits : + champ `capacite` (colonne « capacité »)
//     (B) getReferentielCircuitsCapacites : NOUVELLE — map nom ad hoc → capacité
//     (C) getEtape1T2CircuitsPourbilan : NOUVELLE — lecture table figée
//     (D) writeEtape1T2CircuitsPourbilan : NOUVELLE — purge + écriture table figée
//
// PHASE v11.7-fable (2026-06-15) — Ajout getEtape1T2Fable :
//   - ⭐ Ajout getEtape1T2Fable(candidat_id) : lit la table tblaGd3ixAWxbJJp2
//     (verbatims circuits + signal limbique Fable), distincte de ETAPE1_T2.
//     Utilisée par serviceE0_extraction (É0 de la chaîne bilan Fable).
//
// PHASE v11.6 (2026-06-05) — Visualisation Étape 2 (les 4 excellences) :
//   - ⭐ Ajout getEtape2Excellences(session_id) : lit la table
//     "ETAPE2_1_RESPONSES pour 4 excellences" (25 lignes/candidat), filtre
//     sur session_ID, tri numero_global. Calquée sur getResponses.
//     Lecture seule, utilisée par la route
//     /visualiser/etape2_1responsepour4excellences/:candidat_id.
//
// (Historique antérieur conservé.)

'use strict';

const Airtable        = require('airtable');
const airtableConfig  = require('../../config/airtable');
const logger          = require('../../utils/logger');

let _base = null;
function getBase() {
  if (!_base) {
    _base = new Airtable({ apiKey: airtableConfig.TOKEN }).base(airtableConfig.BASE_ID);
  }
  return _base;
}

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

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

async function getVisiteursByStatus(filters = {}) {
  try {
    const conditions = [];

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

const getResponsesBySession = getResponses;

// ⭐ A21 (17/06/2026) — patchResponseRow : met à jour un record RESPONSES par son airtable_id
async function patchResponseRow(recordId, fields) {
  if (!recordId) {
    logger.warn('patchResponseRow — recordId manquant, patch ignoré');
    return false;
  }
  try {
    await getBase()(airtableConfig.TABLES.RESPONSES).update(
      recordId,
      cleanFields(fields),
      { typecast: true }
    );
    logger.debug('RESPONSES row patched', { recordId });
    return true;
  } catch (error) {
    logger.error('Failed to patch RESPONSES row', { recordId, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v11.6 — ETAPE2 — LES 4 EXCELLENCES
// ═══════════════════════════════════════════════════════════════════════════

async function getEtape2Excellences(session_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.ETAPE2_RESPONSES_EXCELLENCES)
      .select({
        filterByFormula: `{session_ID} = "${session_id}"`,
        sort: [{ field: 'numero_global', direction: 'asc' }]
      })
      .all();

    const rows = records.map(r => ({ airtable_id: r.id, ...r.fields }));
    logger.debug('ETAPE2 excellences fetched', { session_id, count: rows.length });
    return rows;
  } catch (error) {
    logger.error('Failed to get ETAPE2 excellences', { session_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v11.7 — ÉTAPE 2 : PRODUCTION DES 4 EXCELLENCES
// ═══════════════════════════════════════════════════════════════════════════

async function getEtape2T5ARows(session_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.ETAPE2_RESPONSES_EXCELLENCES)
      .select({
        filterByFormula: `{session_ID} = "${session_id}"`,
        sort: [{ field: 'numero_global', direction: 'asc' }]
      })
      .all();
    const rows = records.map(r => ({ airtable_id: r.id, ...r.fields }));
    logger.debug('ETAPE2 T5A rows fetched', { session_id, count: rows.length });
    return rows;
  } catch (error) {
    logger.error('Failed to get ETAPE2 T5A rows', { session_id, error: error.message });
    throw error;
  }
}

async function patchEtape2T5ARows(session_id, patchPlan) {
  if (!Array.isArray(patchPlan) || patchPlan.length === 0) {
    logger.info('patchEtape2T5ARows — rien à écrire', { session_id });
    return 0;
  }
  try {
    const tableName  = airtableConfig.TABLES.ETAPE2_RESPONSES_EXCELLENCES;
    const BATCH_SIZE = 10;
    const records = patchPlan.map(p => ({
      id:     p.airtable_id,
      fields: cleanFields(p.fields_to_patch)
    }));
    let total = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await getBase()(tableName).update(batch, { typecast: true });
      total += batch.length;
      if (i + BATCH_SIZE < records.length) await sleep(200);
    }
    logger.info('ETAPE2 T5A rows updated', { session_id, count: total });
    return total;
  } catch (error) {
    logger.error('Failed to patch ETAPE2 T5A rows', { session_id, error: error.message });
    throw error;
  }
}

async function upsertEtape2T5B(candidat_id, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    logger.warn('upsertEtape2T5B — aucune ligne', { candidat_id });
    return 0;
  }
  try {
    const tableName = airtableConfig.TABLES.ETAPE2_BILAN_EXCELLENCE;
    const existing = await getBase()(tableName)
      .select({ filterByFormula: `LOWER({candidat_id}) = "${String(candidat_id).toLowerCase()}"` })
      .all();
    const idByExc = {};
    for (const r of existing) {
      const exc = r.fields.excellence && (r.fields.excellence.name || r.fields.excellence);
      if (exc) idByExc[String(exc).toUpperCase()] = r.id;
    }

    const toUpdate = [];
    const toCreate = [];
    for (const row of rows) {
      const exc = String(row.excellence || '').toUpperCase();
      const fields = cleanFields(row);
      if (idByExc[exc]) toUpdate.push({ id: idByExc[exc], fields });
      else toCreate.push({ fields });
    }

    let count = 0;
    for (let i = 0; i < toUpdate.length; i += 10) {
      await getBase()(tableName).update(toUpdate.slice(i, i + 10), { typecast: true });
      count += Math.min(10, toUpdate.length - i);
      await sleep(150);
    }
    for (let i = 0; i < toCreate.length; i += 10) {
      await getBase()(tableName).create(toCreate.slice(i, i + 10), { typecast: true });
      count += Math.min(10, toCreate.length - i);
      await sleep(150);
    }
    logger.info('ETAPE2 T5B upserted', { candidat_id, updated: toUpdate.length, created: toCreate.length });
    return count;
  } catch (error) {
    logger.error('Failed to upsert ETAPE2 T5B', { candidat_id, error: error.message });
    throw error;
  }
}

async function getEtape2T5BRows(candidat_id) {
  try {
    const tableName = airtableConfig.TABLES.ETAPE2_BILAN_EXCELLENCE;
    const records = await getBase()(tableName)
      .select({ filterByFormula: `LOWER({candidat_id}) = "${String(candidat_id).toLowerCase()}"` })
      .all();
    const rows = records.map(r => ({ airtable_id: r.id, ...r.fields }));
    logger.debug('ETAPE2 T5B rows fetched', { candidat_id, count: rows.length });
    return rows;
  } catch (error) {
    logger.error('Failed to get ETAPE2 T5B rows', { candidat_id, error: error.message });
    throw error;
  }
}

async function upsertEtape2T5C(candidat_id, fields) {
  try {
    const tableName = airtableConfig.TABLES.ETAPE2_BILAN4EXCELLENCES;
    const existing = await getBase()(tableName)
      .select({ filterByFormula: `LOWER({candidat_id}) = "${String(candidat_id).toLowerCase()}"`, maxRecords: 1 })
      .all();
    const clean = cleanFields(fields);
    if (existing && existing.length > 0) {
      await getBase()(tableName).update([{ id: existing[0].id, fields: clean }], { typecast: true });
      logger.info('ETAPE2 T5C updated', { candidat_id });
    } else {
      await getBase()(tableName).create([{ fields: clean }], { typecast: true });
      logger.info('ETAPE2 T5C created', { candidat_id });
    }
    return true;
  } catch (error) {
    logger.error('Failed to upsert ETAPE2 T5C', { candidat_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v11.7 — BILAN DYNAMIQUE DES 4 EXCELLENCES
// ═══════════════════════════════════════════════════════════════════════════

const _EXC_ORDER_LABEL = { ANT: 'ANT', DEC: 'DEC', MET: 'MET', VUE: 'VUE' };

function _excCode(excellenceValue) {
  if (!excellenceValue) return '';
  if (typeof excellenceValue === 'object' && excellenceValue.name) return excellenceValue.name;
  return String(excellenceValue);
}

function _safeParsePreuves(raw) {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr : [];
  } catch (e) {
    logger.warn('verbatims_preuves JSON invalide — ignoré', { error: e.message });
    return [];
  }
}

function _amplitude(e) {
  return (e.nb_eleve || 0) * 3 + (e.nb_moyen || 0) * 2 + (e.nb_faible || 0);
}

async function getBilanExcellences(candidat_id) {
  try {
    const base = getBase();

    const t5bRecords = await base(airtableConfig.TABLES.ETAPE2_BILAN_EXCELLENCE)
      .select({ filterByFormula: `{candidat_id} = "${candidat_id}"` })
      .all();

    if (!t5bRecords || t5bRecords.length === 0) {
      logger.warn('Bilan — aucune ligne T5B', { candidat_id });
      return null;
    }

    const excellences = t5bRecords.map(r => {
      const f = r.fields;
      return {
        code:            _excCode(f.excellence),
        niveau_global:   f.niveau_global || '',
        pattern:         f.pattern || '',
        nb_eleve:        f.nb_eleve || 0,
        nb_moyen:        f.nb_moyen || 0,
        nb_faible:       f.nb_faible || 0,
        nb_nulle:        f.nb_nulle || 0,
        densite_sommeil: f.densite_sommeil || '',
        densite_weekend: f.densite_weekend || '',
        densite_animal:  f.densite_animal || '',
        densite_panne:   f.densite_panne || '',
        declencheur:     f.declencheur || '',
        synthese:        f.synthese || '',
        verbatims_preuves: _safeParsePreuves(f.verbatims_preuves)
      };
    }).sort((a, b) => _amplitude(b) - _amplitude(a));

    const t5cRecords = await base(airtableConfig.TABLES.ETAPE2_BILAN4EXCELLENCES)
      .select({ filterByFormula: `{candidat_id} = "${candidat_id}"`, maxRecords: 1 })
      .all();

    if (!t5cRecords || t5cRecords.length === 0) {
      logger.warn('Bilan — aucune ligne T5C (profil)', { candidat_id });
      return null;
    }
    const c = t5cRecords[0].fields;

    function jaugeFromVerdict(verdictTxt, niveauTxt) {
      const v = String(verdictTxt || '').toUpperCase();
      const na = v.includes('RÉSERVE') || v.includes('DÉFAVORABLE') || v.includes('NON');
      const map = { 'TRÈS BON': 80, 'BON': 62, 'SUFFISANT': 45 };
      let pct = 0, lab = '';
      for (const k of Object.keys(map)) { if (v.includes(k)) { pct = map[k]; lab = k.charAt(0) + k.slice(1).toLowerCase(); break; } }
      if (na) return { na: true, val: 'non mesuré par ce test' };
      return { na: false, pct: pct || 50, val: lab || (niveauTxt || '') };
    }

    const profil = {
      prenom:         c.prenom || c.Prenom || '',
      etiquette:      c.profil_dominant || '',
      dominante:      c.signal_constitutif || c.dominante || c.note_profil_global || '',
      portrait:       c.portrait_un_mot || '',
      ordre:          c.ordre_excellences || '',
      combinaison:    c.combinaison || '',
      verdict_enc:    c.verdict_encadrement || '',
      verdict_man:    c.verdict_management || '',
      verdict_man_niveau: _sel(c.verdict_man_niveau) || '',
      conclusions_enc: c.B4_conclusions_enc || '',
      conclusions_man: c.B4_conclusions_man || '',
      conditions_enc:  c.conditions_encadrement || '',
      conditions_man:  c.conditions_management || '',
      decoupage:       c.profil_dominant || '',
      montee:          c.montee_autre_face || '',
      reserve:         c.reserves_globales || '',
      jauge_trav:      jaugeFromVerdict(c.verdict_encadrement, c.ANT_densite),
      jauge_rev:       jaugeFromVerdict(c.verdict_management, c.DEC_densite)
    };

    logger.debug('Bilan assemblé', { candidat_id, nb_excellences: excellences.length });
    // 🔒 MASQUAGE CANDIDAT (garante, 03/07/2026) : le verdict DÉFAVORABLE est
    // INTERNE (base/recruteur) — le candidat ne le lit JAMAIS. Son bilan affiche
    // RÉSERVE DE PROTOCOLE + conseil du test complémentaire. Masqué ICI (serveur)
    // pour que le mot n'atteigne jamais le navigateur, même dans le JSON.
    if (String(profil.verdict_man_niveau || '').toUpperCase() === 'DÉFAVORABLE') {
      profil.verdict_man_niveau = 'RÉSERVE DE PROTOCOLE';
      profil.verdict_man = "🛡️ RÉSERVE DE PROTOCOLE — ce parcours n'a pas permis d'établir cette face : un test complémentaire vous est conseillé pour compléter la mesure.";
      profil.jauge_rev = { na: true, val: 'à compléter par le test' };
    }

    // ⭐ Option B (garante, 03/07) : registre du test dans le payload.
    // 'remede'   = verdict management en réserve (vraie réserve ou défavorable masqué)
    // 'affinage' = décentration posée en tranche 6-14 (« posé + test proposé »)
    // null       = pas de test proposé par le bilan (accès DRH direct toujours possible)
    let testDecMode = null;
    if (String(profil.verdict_man_niveau || '').toUpperCase() === 'RÉSERVE DE PROTOCOLE') {
      testDecMode = 'remede';
    } else {
      const mA = String(c.DEC_densite || '').match(/\((\d+)\/20\)/);
      if (mA) {
        const a = parseInt(mA[1], 10);
        if (a >= 6 && a <= 14) testDecMode = 'affinage';
      }
    }
    profil.test_dec_mode = testDecMode;

    return { profil, excellences };
  } catch (error) {
    logger.error('Failed to build bilan excellences', { candidat_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ETAPE1_T1
// ═══════════════════════════════════════════════════════════════════════════

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

async function writeEtape1T1(candidat_id, rows) {
  try {
    await deleteRowsByCandidatId(airtableConfig.TABLES.ETAPE1_T1, candidat_id);
    await createRowsInBatches(airtableConfig.TABLES.ETAPE1_T1, rows, candidat_id);
    logger.info('ETAPE1_T1 written', { candidat_id, count: rows.length });
  } catch (error) {
    logger.error('Failed to write ETAPE1_T1', { candidat_id, error: error.message });
    throw error;
  }
}

async function patchEtape1T1Rows(candidat_id, patchPlan) {
  if (!patchPlan || patchPlan.length === 0) {
    logger.info('patchEtape1T1Rows — empty patch plan, nothing to do', { candidat_id });
    return;
  }

  try {
    const tableName = airtableConfig.TABLES.ETAPE1_T1;
    const BATCH_SIZE = 10;

    const records = patchPlan.map(p => ({
      id:     p.airtable_id,
      fields: cleanFields(p.fields_to_patch)
    }));

    let totalUpdated = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await getBase()(tableName).update(batch, { typecast: true });
      totalUpdated += batch.length;
      if (i + BATCH_SIZE < records.length) await sleep(200);
    }

    logger.info('ETAPE1_T1 patched by verificateur', {
      candidat_id,
      lignes_patchees: totalUpdated,
      total_corrections_appliquees: patchPlan.reduce((sum, p) => sum + (p.nb_corrections || 0), 0)
    });
  } catch (error) {
    logger.error('Failed to patch ETAPE1_T1', {
      candidat_id,
      error: error.message,
      patchPlan_size: patchPlan.length
    });
    throw error;
  }
}

async function updateTypesVerbatimCircuits(updates) {
  if (!updates || updates.length === 0) {
    logger.info('updateTypesVerbatimCircuits — empty updates, nothing to do');
    return { updated: 0 };
  }

  try {
    const tableName = airtableConfig.TABLES.ETAPE1_T1;
    const BATCH_SIZE = 10;

    for (const u of updates) {
      if (!u.record_id) {
        throw new Error('updateTypesVerbatimCircuits — record_id manquant');
      }
      if (typeof u.types_verbatim_circuits !== 'string') {
        throw new Error(
          `updateTypesVerbatimCircuits — types_verbatim_circuits non-string pour ${u.record_id}`
        );
      }
    }

    const records = updates.map(u => ({
      id:     u.record_id,
      fields: cleanFields({
        types_verbatim_circuits: u.types_verbatim_circuits
      })
    }));

    let totalUpdated = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await getBase()(tableName).update(batch, { typecast: true });
      totalUpdated += batch.length;
      if (i + BATCH_SIZE < records.length) await sleep(200);
    }

    logger.info('ETAPE1_T1 types_verbatim_circuits updated', {
      lignes_updated: totalUpdated
    });

    return { updated: totalUpdated };
  } catch (error) {
    logger.error('Failed to update types_verbatim_circuits', {
      error:        error.message,
      updates_size: updates.length
    });
    throw error;
  }
}

const SCENARIOS_VALIDES_T1 = ['SOMMEIL', 'WEEKEND', 'ANIMAL_1', 'ANIMAL_2', 'PANNE'];

async function deleteEtape1T1Scenario(candidat_id, scenario_name) {
  if (!SCENARIOS_VALIDES_T1.includes(scenario_name)) {
    throw new Error(
      `deleteEtape1T1Scenario — scenario_name invalide: "${scenario_name}". ` +
      `Attendu: ${SCENARIOS_VALIDES_T1.join(', ')}`
    );
  }

  try {
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T1)
      .select({
        filterByFormula: `AND({candidat_id} = "${candidat_id}", {scenario} = "${scenario_name}")`,
        fields: []
      })
      .all();

    if (records.length === 0) {
      logger.warn('deleteEtape1T1Scenario — aucune ligne à supprimer', { candidat_id, scenario_name });
      return { deleted: 0, scenario: scenario_name };
    }

    if (records.length !== 5) {
      logger.warn('deleteEtape1T1Scenario — nombre de lignes inattendu (attendu: 5)', {
        candidat_id, scenario_name, count: records.length
      });
    }

    const idsToDelete = records.map(r => r.id);
    await getBase()(airtableConfig.TABLES.ETAPE1_T1).destroy(idsToDelete);

    logger.info('ETAPE1_T1 rows deleted for scenario', {
      candidat_id, scenario_name, deleted: idsToDelete.length
    });

    return { deleted: idsToDelete.length, scenario: scenario_name };
  } catch (error) {
    logger.error('Failed to delete ETAPE1_T1 rows for scenario', {
      candidat_id, scenario_name, error: error.message
    });
    throw error;
  }
}

async function writeEtape1T1Scenario(candidat_id, rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    logger.warn('writeEtape1T1Scenario — aucune ligne à écrire', { candidat_id });
    return 0;
  }

  if (rows.length !== 5) {
    logger.warn('writeEtape1T1Scenario — nombre de lignes inattendu (attendu: 5)', {
      candidat_id, count: rows.length
    });
  }

  try {
    const created = await createRowsInBatches(airtableConfig.TABLES.ETAPE1_T1, rows, candidat_id);
    logger.info('ETAPE1_T1 scenario rows written', { candidat_id, count: created });
    return created;
  } catch (error) {
    logger.error('Failed to write ETAPE1_T1 scenario rows', { candidat_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFICATEUR_T1
// ═══════════════════════════════════════════════════════════════════════════

async function writeVerificateurT1(candidat_id, auditData) {
  try {
    const fields = {
      candidat_id,
      verdict_global:        auditData.verdict_global || 'INDETERMINE',
      nb_lignes_verifiees:   auditData.nb_lignes_verifiees || 0,
      nb_violations_total:   auditData.nb_violations_total || 0,
      nb_critique:           auditData.nb_critique || 0,
      nb_doctrinale:         auditData.nb_doctrinale || 0,
      nb_observation:        auditData.nb_observation || 0,
      violations_json:       typeof auditData.violations_json === 'string'
                                ? auditData.violations_json
                                : JSON.stringify(auditData.violations_json || []),
      cost_usd:              auditData.cost_usd || 0,
      elapsed_ms:            auditData.elapsed_ms || 0,
      timestamp:             new Date().toISOString()
    };

    await getBase()(airtableConfig.TABLES.VERIFICATEUR_T1).create([{
      fields: cleanFields(fields)
    }], { typecast: true });

    logger.info('VERIFICATEUR_T1 audit written', {
      candidat_id,
      verdict: fields.verdict_global,
      nb_violations: fields.nb_violations_total
    });
  } catch (error) {
    logger.error('Failed to write VERIFICATEUR_T1', { candidat_id, error: error.message });
  }
}

async function getVerificateurT1History(candidat_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.VERIFICATEUR_T1)
      .select({
        filterByFormula: `{candidat_id} = "${candidat_id}"`,
        sort: [{ field: 'timestamp', direction: 'desc' }]
      })
      .all();

    return records.map(r => ({ airtable_id: r.id, ...r.fields }));
  } catch (error) {
    logger.error('Failed to get VERIFICATEUR_T1 history', { candidat_id, error: error.message });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION HUMAINE
// ═══════════════════════════════════════════════════════════════════════════

async function getCandidatsEnAttenteValidation() {
  try {
    const formula = `AND(
      {statut_analyse_pivar} = "EN_ATTENTE_VALIDATION_HUMAINE",
      NOT({validation_humaine_action} = BLANK())
    )`.replace(/\s+/g, ' ');

    const records = await getBase()(airtableConfig.TABLES.VISITEUR)
      .select({ filterByFormula: formula })
      .all();

    return records.map(r => ({ id: r.id, ...r.fields }));
  } catch (error) {
    logger.error('Failed to get candidats en attente validation', { error: error.message });
    return [];
  }
}

async function appliquerValidationHumaine(candidat_id, action, motif) {
  try {
    const statutMap = {
      RELANCER_AGENT_T1:        'REPRENDRE_AGENT1',
      RELANCER_VERIFICATEUR_T1: 'REPRENDRE_VERIFICATEUR1',
      ACCEPTER_TEL_QUEL:        'en_cours',
      ABANDONNER:               'ERREUR'
    };

    const nouveauStatut = statutMap[action];
    if (!nouveauStatut) throw new Error(`Action validation humaine inconnue : ${action}`);

    await updateVisiteur(candidat_id, {
      validation_humaine_action: action,
      validation_humaine_motif:  motif || '',
      validation_humaine_date:   new Date().toISOString(),
      statut_analyse_pivar:      nouveauStatut,
      derniere_activite:         new Date().toISOString()
    });

    logger.info('Validation humaine appliquée', { candidat_id, action, nouveauStatut });
  } catch (error) {
    logger.error('Failed to appliquer validation humaine', { candidat_id, action, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TENTATIVES MODE 4
// ═══════════════════════════════════════════════════════════════════════════

async function incrementTentativesEtape1(candidat_id) {
  try {
    const visiteur = await getVisiteur(candidat_id);
    const current = parseInt(visiteur?.nombre_tentatives_etape1 || 0, 10);
    const newValue = current + 1;
    await updateVisiteur(candidat_id, { nombre_tentatives_etape1: newValue });
    logger.info('Tentatives etape1 incremented', { candidat_id, value: newValue });
    return newValue;
  } catch (error) {
    logger.error('Failed to increment tentatives etape1', { candidat_id, error: error.message });
    throw error;
  }
}

async function resetTentativesEtape1(candidat_id) {
  try {
    await updateVisiteur(candidat_id, { nombre_tentatives_etape1: 0 });
    logger.debug('Tentatives etape1 reset to 0', { candidat_id });
  } catch (error) {
    logger.error('Failed to reset tentatives etape1', { candidat_id, error: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMUNICATION CANDIDAT
// ═══════════════════════════════════════════════════════════════════════════

async function getCandidatsAEmailler() {
  try {
    const formula = `AND(
      NOT({date_T0} = BLANK()),
      OR(
        {email_T0_envoye} = FALSE(),
        {email_24h_envoye} = FALSE(),
        {email_48h_envoye} = FALSE(),
        {email_72h_envoye} = FALSE(),
        AND({statut_analyse_pivar} = "terminé", {email_livraison_envoye} = FALSE())
      )
    )`.replace(/\s+/g, ' ');

    const records = await getBase()(airtableConfig.TABLES.VISITEUR)
      .select({ filterByFormula: formula })
      .all();

    return records.map(r => ({ id: r.id, ...r.fields }));
  } catch (error) {
    logger.error('Failed to get candidats à emailler', { error: error.message });
    return [];
  }
}

async function markerEmailCandidatEnvoye(candidat_id, type) {
  try {
    const fieldMap = {
      'T0':        'email_T0_envoye',
      '24h':       'email_24h_envoye',
      '48h':       'email_48h_envoye',
      '72h':       'email_72h_envoye',
      'livraison': 'email_livraison_envoye'
    };

    const fieldName = fieldMap[type];
    if (!fieldName) throw new Error(`Type d'email inconnu : ${type}`);

    await updateVisiteur(candidat_id, { [fieldName]: true });
    logger.info('Email candidat marqué envoyé', { candidat_id, type });
  } catch (error) {
    logger.error('Failed to marquer email candidat envoyé', { candidat_id, type, error: error.message });
    throw error;
  }
}

async function setDateT0(candidat_id) {
  try {
    await updateVisiteur(candidat_id, { date_T0: new Date().toISOString() });
    logger.info('date_T0 set', { candidat_id });
  } catch (error) {
    logger.error('Failed to set date_T0', { candidat_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ETAPE1_T2
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

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v11.7-fable (15/06/2026) — ETAPE1_T2_FABLE — table tblaGd3ixAWxbJJp2
// ═══════════════════════════════════════════════════════════════════════════
async function getEtape1T2Fable(candidat_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T2_FABLE)
      .select({
        filterByFormula: `{candidat_id} = "${candidat_id}"`
      })
      .all();
    const rows = records.map(r => ({ airtable_id: r.id, ...r.fields }));
    logger.debug('ETAPE1_T2_FABLE fetched', { candidat_id, count: rows.length });
    return rows;
  } catch (error) {
    logger.error('Failed to get ETAPE1_T2_FABLE', { candidat_id, error: error.message });
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

async function getEtape1T2VentilationPiliers(candidat_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T2_VENTILATION_PILIERS)
      .select({
        filterByFormula: `{candidat_id} = "${candidat_id}"`,
        sort: [{ field: 'rang_par_frequence', direction: 'asc' }]
      })
      .all();
    return records.map(r => ({ airtable_id: r.id, ...r.fields }));
  } catch (error) {
    logger.error('Failed to get ETAPE1_T2_VENTILATION_PILIERS', { candidat_id, error: error.message });
    throw error;
  }
}

async function writeEtape1T2VentilationPiliers(candidat_id, rows) {
  try {
    await deleteRowsByCandidatId(airtableConfig.TABLES.ETAPE1_T2_VENTILATION_PILIERS, candidat_id);
    await createRowsInBatches(airtableConfig.TABLES.ETAPE1_T2_VENTILATION_PILIERS, rows, candidat_id);
    logger.info('ETAPE1_T2_VENTILATION_PILIERS written', { candidat_id, count: rows.length });
  } catch (error) {
    logger.error('Failed to write ETAPE1_T2_VENTILATION_PILIERS', { candidat_id, error: error.message });
    throw error;
  }
}

async function getEtape1T2InventaireCircuits(candidat_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T2_INVENTAIRE_CIRCUITS)
      .select({
        filterByFormula: `{candidat_id} = "${candidat_id}"`,
        sort: [{ field: 'pilier_owner', direction: 'asc' }]
      })
      .all();
    return records.map(r => ({ airtable_id: r.id, ...r.fields }));
  } catch (error) {
    logger.error('Failed to get ETAPE1_T2_INVENTAIRE_CIRCUITS', { candidat_id, error: error.message });
    throw error;
  }
}

async function writeEtape1T2InventaireCircuits(candidat_id, rows) {
  try {
    await deleteRowsByCandidatId(airtableConfig.TABLES.ETAPE1_T2_INVENTAIRE_CIRCUITS, candidat_id);
    await createRowsInBatches(airtableConfig.TABLES.ETAPE1_T2_INVENTAIRE_CIRCUITS, rows, candidat_id);
    logger.info('ETAPE1_T2_INVENTAIRE_CIRCUITS written', { candidat_id, count: rows.length });
  } catch (error) {
    logger.error('Failed to write ETAPE1_T2_INVENTAIRE_CIRCUITS', { candidat_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ 18/06/2026 — ETAPE1_T2_CIRCUITS_POURBILAN — table figée (Phase 4)
// ═══════════════════════════════════════════════════════════════════════════

async function getEtape1T2CircuitsPourbilan(candidat_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T2_CIRCUITS_POURBILAN)
      .select({
        filterByFormula: `{candidat_id} = "${candidat_id}"`,
        sort: [
          { field: 'rang_pilier',      direction: 'asc' },
          { field: 'ordre_bloc',       direction: 'asc' },
          { field: 'rang_dans_pilier', direction: 'asc' }
        ]
      })
      .all();
    const rows = records.map(r => ({ airtable_id: r.id, ...r.fields }));
    logger.debug('ETAPE1_T2_CIRCUITS_POURBILAN fetched', { candidat_id, count: rows.length });
    return rows;
  } catch (error) {
    logger.error('Failed to get ETAPE1_T2_CIRCUITS_POURBILAN', { candidat_id, error: error.message });
    throw error;
  }
}

async function writeEtape1T2CircuitsPourbilan(candidat_id, rows) {
  try {
    await deleteRowsByCandidatId(airtableConfig.TABLES.ETAPE1_T2_CIRCUITS_POURBILAN, candidat_id);
    const rowsSansId = rows.map(({ candidat_id: _omit, ...reste }) => reste);
    await createRowsInBatches(airtableConfig.TABLES.ETAPE1_T2_CIRCUITS_POURBILAN, rowsSansId, candidat_id);
    logger.info('ETAPE1_T2_CIRCUITS_POURBILAN written', { candidat_id, count: rows.length });
  } catch (error) {
    logger.error('Failed to write ETAPE1_T2_CIRCUITS_POURBILAN', { candidat_id, error: error.message });
    throw error;
  }
}

// ⭐ 24/06/2026 — Patch ciblé de role_pilier sur les lignes POURBILAN (agent rôles, Phase 4b).
//   Ne touche QUE le champ role_pilier — aucun chiffre, bloc, capacité ou total n'est modifié.
//   Modèle = patchEtape1T1Rows / patchEtape2T5ARows. patchPlan : [{ airtable_id, role_pilier }].
async function patchEtape1T2CircuitsPourbilanRoles(candidat_id, patchPlan) {
  if (!Array.isArray(patchPlan) || patchPlan.length === 0) {
    logger.info('patchEtape1T2CircuitsPourbilanRoles — rien à écrire', { candidat_id });
    return 0;
  }
  try {
    const tableName  = airtableConfig.TABLES.ETAPE1_T2_CIRCUITS_POURBILAN;
    const BATCH_SIZE = 10;
    const records = patchPlan.map(p => ({
      id:     p.airtable_id,
      fields: cleanFields({ role_pilier: p.role_pilier })
    }));
    let total = 0;
    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      await getBase()(tableName).update(batch, { typecast: true });
      total += batch.length;
      if (i + BATCH_SIZE < records.length) await sleep(200);
    }
    logger.info('ETAPE1_T2_CIRCUITS_POURBILAN role_pilier patched', { candidat_id, count: total });
    return total;
  } catch (error) {
    logger.error('Failed to patch POURBILAN role_pilier', { candidat_id, error: error.message });
    throw error;
  }
}

async function getEtape1T3(candidat_id, options = {}) {
  try {
    const conditions = [`{candidat_id} = "${candidat_id}"`];
    if (options.pilier) conditions.push(`{pilier} = "${options.pilier}"`);

    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T3)
      .select({
        filterByFormula: conditions.length > 1 ? `AND(${conditions.join(', ')})` : conditions[0],
        sort: [{ field: 'pilier', direction: 'asc' }, { field: 'circuit_id', direction: 'asc' }]
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

async function getEtape1T4Bilan(candidat_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T4_BILAN)
      .select({
        filterByFormula: `{candidat_id} = "${candidat_id}"`,
        maxRecords: 1
      })
      .firstPage();

    if (records.length === 0) return null;
    return { airtable_id: records[0].id, ...records[0].fields };
  } catch (error) {
    logger.error('Failed to get ETAPE1_T4_BILAN', { candidat_id, error: error.message });
    throw error;
  }
}

async function upsertEtape1T4Bilan(candidat_id, fields) {
  try {
    const existing = await getEtape1T4Bilan(candidat_id);
    const cleanedFields = cleanFields(fields);

    if (existing) {
      await getBase()(airtableConfig.TABLES.ETAPE1_T4_BILAN).update([{
        id: existing.airtable_id,
        fields: cleanedFields
      }], { typecast: true });
      logger.debug('ETAPE1_T4_BILAN updated', { candidat_id });
    } else {
      await getBase()(airtableConfig.TABLES.ETAPE1_T4_BILAN).create([{
        fields: { candidat_id, ...cleanedFields }
      }], { typecast: true });
      logger.debug('ETAPE1_T4_BILAN created', { candidat_id });
    }
  } catch (error) {
    logger.error('Failed to upsert ETAPE1_T4_BILAN', { candidat_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REFERENTIEL_LEXIQUE
// ═══════════════════════════════════════════════════════════════════════════

async function getReferentielLexique() {
  try {
    const records = await getBase()(airtableConfig.TABLES.REFERENTIEL_LEXIQUE)
      .select({ sort: [{ field: 'ordre_affichage', direction: 'asc' }] })
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

function formaterLexiquePourPrompt(lexique) {
  const lignes = ['# 🔒 LEXIQUE DE RÉFÉRENCE (source : Airtable REFERENTIEL_LEXIQUE) — NON NÉGOCIABLE', ''];

  for (const terme of lexique) {
    lignes.push(`## ${terme.ordre_affichage}. ${terme.terme}`);
    lignes.push(`**Définition** : ${terme.definition}`);
    if (terme.forme_grammaticale) lignes.push(`**Forme grammaticale** : ${terme.forme_grammaticale}`);
    if (terme.precision_semantique) lignes.push(`**Précision sémantique** : ${terme.precision_semantique}`);
    if (terme.termes_interdits_associes) lignes.push(`**Termes interdits associés** : ${terme.termes_interdits_associes}`);
    lignes.push('');
  }

  lignes.push('---');
  lignes.push('**RÈGLE ABSOLUE** : utilise ces termes et leurs définitions mot pour mot. Toute reformulation est interdite.');

  return lignes.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// REFERENTIEL_PILIERS
// ═══════════════════════════════════════════════════════════════════════════

async function getReferentielPiliers() {
  try {
    const records = await getBase()(airtableConfig.TABLES.REFERENTIEL_PILIERS)
      .select({ sort: [{ field: 'pilier_code', direction: 'asc' }] })
      .all();

    const piliers = records.map(r => ({
      pilier_code:               r.fields.pilier_code,
      pilier_nom:                r.fields.pilier_nom,
      pilier_intitule_court:     r.fields.pilier_intitule_court || '',
      verbes_caracteristiques:   r.fields.verbes_caracteristiques || '',
      ce_qu_est:                 r.fields.ce_qu_est || '',
      ce_qu_on_peut_faire:       r.fields.ce_qu_on_peut_faire || '',
      structure_interne:         r.fields.structure_interne || '',
      nb_modes:                  r.fields.nb_modes || 0,
      modes_liste:               r.fields.modes_liste || '',
      regles_critiques:          r.fields.regles_critiques || '',
      pieges_avertissements:     r.fields.regles_critiques || '',
      illustrations_terrain:     r.fields.illustrations_terrain || '',
      source_v36_section:        r.fields.source_v36_section || '',
      version_doctrine:          r.fields.version_doctrine || ''
    }));

    if (piliers.length !== 5) {
      logger.warn('Référentiel piliers incomplet', { found: piliers.length, expected: 5 });
    }

    logger.debug('Référentiel piliers loaded', { count: piliers.length });
    return piliers;
  } catch (error) {
    logger.error('Failed to load REFERENTIEL_PILIERS', { error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REFERENTIEL_CIRCUITS
// ═══════════════════════════════════════════════════════════════════════════

async function getReferentielCircuits() {
  try {
    const records = await getBase()(airtableConfig.TABLES.REFERENTIEL_CIRCUITS)
      .select({
        sort: [
          { field: 'pilier',     direction: 'asc' },
          { field: 'circuit_id', direction: 'asc' }
        ]
      })
      .all();

    const circuits = records.map(r => ({
      airtable_id: r.id,
      pilier:      extractLookup(r.fields.pilier),
      circuit_id:  r.fields.circuit_id,
      circuit_nom: r.fields.circuit_nom,
      geste:       r.fields.geste || null,
      capacite:    extractLookup(r.fields['capacité']) || null   // ⭐ 18/06 — colonne « capacité » (avec accent)
    }));

    if (circuits.length !== 75) {
      logger.warn('REFERENTIEL_CIRCUITS incomplet', { found: circuits.length, expected: 75 });
    }

    logger.debug('REFERENTIEL_CIRCUITS loaded', { count: circuits.length });
    return circuits;
  } catch (error) {
    logger.error('Failed to load REFERENTIEL_CIRCUITS', { error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REFERENTIEL_CIRCUITS_CANDIDATS
// ═══════════════════════════════════════════════════════════════════════════

const PROMOTION_THRESHOLD_SAME_PILLAR  = 3;
const PROMOTION_THRESHOLD_MULTI_PILLAR = 5;

async function getCircuitsAdHocByStatut(statut = 'EN_ATTENTE') {
  try {
    const records = await getBase()(airtableConfig.TABLES.REFERENTIEL_CIRCUITS_CANDIDATS)
      .select({
        filterByFormula: `{statut} = "${statut}"`,
        sort: [{ field: 'occurrences_pilier_principal', direction: 'desc' }]
      })
      .all();

    const adHocs = records.map(r => ({
      airtable_id:                       r.id,
      nom_propose:                       r.fields.nom_propose,
      pilier_principal:                  extractLookup(r.fields.pilier_principal),
      geste_propose:                     r.fields.geste_propose || null,
      occurrences_pilier_principal:      r.fields.occurrences_pilier_principal || 0,
      occurrences_autres_piliers:        r.fields.occurrences_autres_piliers || 0,
      candidats_concernes:               r.fields.candidats_concernes || '',
      questions_concernees:              r.fields.questions_concernees || '',
      verbatim_source_premier:           r.fields.verbatim_source_premier || null,
      circuits_proches_envisages:        r.fields.circuits_proches_envisages || null,
      statut:                            extractLookup(r.fields.statut),
      circuit_officiel_apres_promotion:  r.fields.circuit_officiel_apres_promotion || null,
      date_premiere_detection:           r.fields.date_premiere_detection || null,
      date_derniere_mise_a_jour:         r.fields.date_derniere_mise_a_jour || null,
      commentaire_validation:            r.fields.commentaire_validation || null
    }));

    logger.debug('Circuits ad hoc loaded', { statut, count: adHocs.length });
    return adHocs;
  } catch (error) {
    logger.error('Failed to load REFERENTIEL_CIRCUITS_CANDIDATS', { statut, error: error.message });
    throw error;
  }
}

// ⭐ 18/06/2026 — Map { nom_propose → capacité } pour la Phase 4 (capacité des ad hoc)
async function getReferentielCircuitsCapacites() {
  try {
    const records = await getBase()(airtableConfig.TABLES.REFERENTIEL_CIRCUITS_CANDIDATS)
      .select({ fields: ['nom_propose', 'capacité'] })
      .all();

    const map = {};
    for (const r of records) {
      const nom = r.fields['nom_propose'];
      const cap = extractLookup(r.fields['capacité']);
      if (nom) map[nom] = cap || null;
    }
    logger.debug('REFERENTIEL_CIRCUITS_CANDIDATS capacités loaded', { count: Object.keys(map).length });
    return map;
  } catch (error) {
    logger.error('Failed to load ad hoc capacités', { error: error.message });
    throw error;
  }
}

async function upsertCircuitAdHoc({
  candidat_id, nom_propose, pilier_courant,
  geste_propose = null, verbatim_source = null,
  question_source = null, circuits_proches_envisages = null
}) {
  if (!candidat_id || !nom_propose || !pilier_courant) {
    throw new Error('upsertCircuitAdHoc — candidat_id, nom_propose et pilier_courant sont requis');
  }

  const nowIso = new Date().toISOString();

  try {
    const safeName = String(nom_propose).replace(/"/g, '\\"');

    const existants = await getBase()(airtableConfig.TABLES.REFERENTIEL_CIRCUITS_CANDIDATS)
      .select({ filterByFormula: `{nom_propose} = "${safeName}"`, maxRecords: 1 })
      .firstPage();

    if (existants && existants.length > 0) {
      const existant = existants[0];
      const pilierPrincipalRecord = extractLookup(existant.fields.pilier_principal);
      const currentOccPrincipal = existant.fields.occurrences_pilier_principal || 0;
      const currentOccAutres    = existant.fields.occurrences_autres_piliers   || 0;
      const currentCandidats    = existant.fields.candidats_concernes || '';
      const currentQuestions    = existant.fields.questions_concernees || '';
      const currentStatut       = extractLookup(existant.fields.statut);

      if (['PROMU_AUTO', 'PROMU_MANUEL', 'REJETE', 'FUSIONNE'].includes(currentStatut)) {
        logger.debug('Circuit ad hoc déjà finalisé — skip', { nom_propose, statut: currentStatut, candidat_id });
        return {
          action: 'skipped', airtable_id: existant.id,
          occurrences_pilier_principal: currentOccPrincipal,
          occurrences_autres_piliers: currentOccAutres,
          total: currentOccPrincipal + currentOccAutres,
          promotion_triggered: null
        };
      }

      const candidatsList = currentCandidats.split('\n').map(s => s.trim()).filter(s => s.length > 0);

      if (candidatsList.includes(candidat_id)) {
        logger.debug('Circuit ad hoc déjà connu pour ce candidat (skip)', { nom_propose, candidat_id });
        return {
          action: 'skipped', airtable_id: existant.id,
          occurrences_pilier_principal: currentOccPrincipal,
          occurrences_autres_piliers: currentOccAutres,
          total: currentOccPrincipal + currentOccAutres,
          promotion_triggered: null
        };
      }

      const isPilierPrincipal = (pilier_courant === pilierPrincipalRecord);
      const newOccPrincipal   = isPilierPrincipal ? currentOccPrincipal + 1 : currentOccPrincipal;
      const newOccAutres      = isPilierPrincipal ? currentOccAutres        : currentOccAutres + 1;
      const total             = newOccPrincipal + newOccAutres;

      candidatsList.push(candidat_id);
      const newCandidats = candidatsList.join('\n');
      const questionEntry = `${question_source || '?'} - ${candidat_id}`;
      const newQuestions  = currentQuestions ? `${currentQuestions}\n${questionEntry}` : questionEntry;

      let promotionTriggered = null;
      let newStatut = currentStatut;

      if (newOccPrincipal >= PROMOTION_THRESHOLD_SAME_PILLAR) {
        newStatut = 'PROMU_AUTO';
        promotionTriggered = 'auto';
        logger.warn('🎯 PROMOTION AUTOMATIQUE DÉCLENCHÉE', { nom_propose, pilier_principal: pilierPrincipalRecord, occurrences_pilier_principal: newOccPrincipal });
      } else if (total >= PROMOTION_THRESHOLD_MULTI_PILLAR && newOccAutres > 0) {
        promotionTriggered = 'flag_arbitrage';
        logger.warn('⚠️ ARBITRAGE MANUEL REQUIS', { nom_propose, total });
      }

      const updateFields = {
        occurrences_pilier_principal: newOccPrincipal,
        occurrences_autres_piliers:   newOccAutres,
        candidats_concernes:          newCandidats,
        questions_concernees:         newQuestions,
        date_derniere_mise_a_jour:    nowIso
      };
      if (newStatut !== currentStatut) updateFields.statut = newStatut;

      await getBase()(airtableConfig.TABLES.REFERENTIEL_CIRCUITS_CANDIDATS).update([{ id: existant.id, fields: updateFields }]);

      logger.info('Circuit ad hoc incrémenté', { nom_propose, pilier_courant, occurrences_pilier_principal: newOccPrincipal, total, candidat_id, statut: newStatut });

      return {
        action: isPilierPrincipal ? 'incremented_principal' : 'incremented_autres',
        airtable_id: existant.id,
        occurrences_pilier_principal: newOccPrincipal,
        occurrences_autres_piliers: newOccAutres,
        total,
        promotion_triggered: promotionTriggered
      };
    }

    const questionEntry = `${question_source || '?'} - ${candidat_id}`;

    const created = await getBase()(airtableConfig.TABLES.REFERENTIEL_CIRCUITS_CANDIDATS).create([{
      fields: cleanFields({
        nom_propose, pilier_principal: pilier_courant, geste_propose,
        occurrences_pilier_principal: 1, occurrences_autres_piliers: 0,
        candidats_concernes: candidat_id, questions_concernees: questionEntry,
        verbatim_source_premier: verbatim_source, circuits_proches_envisages,
        statut: 'EN_ATTENTE',
        date_premiere_detection: nowIso, date_derniere_mise_a_jour: nowIso
      })
    }]);

    logger.info('Circuit ad hoc créé', { nom_propose, pilier_principal: pilier_courant, candidat_id, airtable_id: created[0].id });

    return {
      action: 'created', airtable_id: created[0].id,
      occurrences_pilier_principal: 1, occurrences_autres_piliers: 0,
      total: 1, promotion_triggered: null
    };
  } catch (error) {
    logger.error('Failed to upsert circuit ad hoc', { candidat_id, nom_propose, pilier_courant, error: error.message });
    throw error;
  }
}

function extractLookup(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : null;
  if (value && typeof value === 'object' && value.name !== undefined) return String(value.name);
  return String(value);
}

// ═══════════════════════════════════════════════════════════════════════════
// VISITEUR — civilité et info visualisation
// ═══════════════════════════════════════════════════════════════════════════

async function getCiviliteCandidat(candidat_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.VISITEUR)
      .select({
        filterByFormula: `{${airtableConfig.VISITEUR_FIELDS.candidate_ID}} = "${candidat_id}"`,
        fields: [airtableConfig.VISITEUR_FIELDS.civilite_candidat],
        maxRecords: 1
      })
      .firstPage();

    if (!records || records.length === 0) {
      logger.warn('Candidat introuvable pour civilité', { candidat_id });
      return null;
    }

    const civilite = records[0].fields[airtableConfig.VISITEUR_FIELDS.civilite_candidat] || null;
    logger.debug('Civilité candidat lue', { candidat_id, civilite });
    return civilite;
  } catch (error) {
    logger.error('Failed to read civilite_candidat', { candidat_id, error: error.message });
    throw error;
  }
}

async function getVisiteurInfoForVisualisation(candidat_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.VISITEUR)
      .select({
        filterByFormula: `{${airtableConfig.VISITEUR_FIELDS.candidate_ID}} = "${candidat_id}"`,
        fields: [
          airtableConfig.VISITEUR_FIELDS.candidate_ID,
          airtableConfig.VISITEUR_FIELDS.Prenom,
          airtableConfig.VISITEUR_FIELDS.Nom,
          airtableConfig.VISITEUR_FIELDS.civilite_candidat
        ],
        maxRecords: 1
      })
      .firstPage();

    if (!records || records.length === 0) {
      logger.warn('Visiteur introuvable pour visualisation', { candidat_id });
      return { prenom: '?', nom: '?', civilite: '?', candidate_ID: candidat_id };
    }

    const f = records[0].fields;
    return {
      candidate_ID: f[airtableConfig.VISITEUR_FIELDS.candidate_ID] || candidat_id,
      prenom:       f[airtableConfig.VISITEUR_FIELDS.Prenom]            || '?',
      nom:          f[airtableConfig.VISITEUR_FIELDS.Nom]               || '?',
      civilite:     f[airtableConfig.VISITEUR_FIELDS.civilite_candidat] || '?'
    };
  } catch (error) {
    logger.error('Failed to read visiteur info for visualisation', { candidat_id, error: error.message });
    return { prenom: '?', nom: '?', civilite: '?', candidate_ID: candidat_id };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS INTERNES
// ═══════════════════════════════════════════════════════════════════════════


// ═══════════════════════════════════════════════════════════════════════════
// ⭐ ÉTAPE 2c (02/07/2026) — TEST COMPLÉMENTAIRE DE DÉCENTRATION
// ═══════════════════════════════════════════════════════════════════════════

const TABLE_TESTDEC     = (airtableConfig.TABLES && airtableConfig.TABLES.ETAPE2_TEST_DECENTRATION) || 'ETAPE2_TEST_DECENTRATION';
const TABLE_T3_BILAN    = (airtableConfig.TABLES && airtableConfig.TABLES.ETAPE1_T3_BILAN)  || 'ETAPE1_T3_BILAN';
const TABLE_T3_PILIER   = (airtableConfig.TABLES && airtableConfig.TABLES.ETAPE1_T3_PILIER) || 'ETAPE1_T3_PILIER';

function _sel(v) { return (v && (v.name || v)) || ''; }

// Profil compact du candidat pour le test (socle + structurants + fonctionnels, avec modes).
async function getEtape1ProfilPourTest(candidat_id) {
  try {
    const bilans = await getBase()(TABLE_T3_BILAN)
      .select({ filterByFormula: `{candidat_id} = "${candidat_id}"`, maxRecords: 1 })
      .all();
    const b = bilans[0] ? bilans[0].fields : {};

    const piliers = await getBase()(TABLE_T3_PILIER)
      .select({ filterByFormula: `{candidat_id} = "${candidat_id}"` })
      .all();

    const socle = { pilier: '', label: '', mode: '' };
    const structurants = [];
    const fonctionnels = [];
    for (const r of piliers) {
      const f = r.fields;
      const item = { pilier: _sel(f.pilier), label: _sel(f.pilier_label), mode: f.pilier_mode || '' };
      const role = String(_sel(f.pilier_role)).toLowerCase();
      if (role === 'socle') Object.assign(socle, item);
      else if (role === 'amont' || role === 'aval' || role === 'structurant') structurants.push(item);
      else fonctionnels.push(item);
    }
    // Repli sur le bilan si la table pilier est vide.
    if (!socle.pilier && b.pilier_socle) {
      socle.pilier = _sel(b.pilier_socle);
      socle.label  = _sel(b.pilier_socle_label);
      socle.mode   = b.pilier_socle_mode || '';
    }
    return { prenom: b.Prenom || '', socle, structurants, fonctionnels };
  } catch (error) {
    logger.error('Failed to get profil Étape 1 pour test', { candidat_id, error: error.message });
    throw error;
  }
}

// Écrit les 10 situations générées (delete + create — jamais appelé si réponses présentes).
async function writeTestDecentration(candidat_id, situations) {
  const now = new Date().toISOString();
  const rows = situations.map(s => ({
    candidat_id,
    numero:            Number(s.numero),
    position_candidat: s.position_candidat || '',
    compatibilite:     s.compatibilite || '',
    personnage:        s.personnage || '',
    personnage_profil: s.personnage_profil || '',
    situation_text:    s.situation_text || '',
    question_text:     s.question_text || '',
    amorce:            s.amorce || '',
    date_generation:   now
  }));
  await deleteRowsByCandidatId(TABLE_TESTDEC, candidat_id);
  await createRowsInBatches(TABLE_TESTDEC, rows, candidat_id);
  logger.info('TESTDEC situations écrites', { candidat_id, count: rows.length });
  return rows.length;
}

async function getTestDecentrationRows(candidat_id) {
  try {
    const records = await getBase()(TABLE_TESTDEC)
      .select({
        filterByFormula: `{candidat_id} = "${candidat_id}"`,
        sort: [{ field: 'numero', direction: 'asc' }]
      })
      .all();
    return records.map(r => ({ airtable_id: r.id, ...r.fields }));
  } catch (error) {
    logger.error('Failed to get TESTDEC rows', { candidat_id, error: error.message });
    throw error;
  }
}

// Enregistre les réponses du candidat (patch par numéro).
async function saveTestDecentrationReponses(candidat_id, reponses) {
  const rows = await getTestDecentrationRows(candidat_id);
  const idByNumero = {};
  for (const r of rows) idByNumero[Number(r.numero)] = r.airtable_id;
  const now = new Date().toISOString();
  const updates = [];
  for (const rep of reponses) {
    const id = idByNumero[Number(rep.numero)];
    if (!id) throw new Error(`TESTDEC : situation ${rep.numero} introuvable pour ${candidat_id}`);
    updates.push({ id, fields: cleanFields({ response_text: rep.response_text, date_response: now }) });
  }
  for (let i = 0; i < updates.length; i += 10) {
    await getBase()(TABLE_TESTDEC).update(updates.slice(i, i + 10), { typecast: true });
    await sleep(150);
  }
  logger.info('TESTDEC réponses enregistrées', { candidat_id, count: updates.length });
  return updates.length;
}

// Écrit les codages de l'agent (patch par numéro).
async function patchTestDecentrationCodage(candidat_id, codages) {
  const rows = await getTestDecentrationRows(candidat_id);
  const idByNumero = {};
  for (const r of rows) idByNumero[Number(r.numero)] = r.airtable_id;
  const updates = [];
  for (const c of codages) {
    const id = idByNumero[Number(c.numero)];
    if (!id) throw new Error(`TESTDEC codage : situation ${c.numero} introuvable pour ${candidat_id}`);
    updates.push({ id, fields: cleanFields({
      DEC_niveau:        c.DEC_niveau || '',
      DEC_verbatim:      c.DEC_verbatim || '',
      DEC_manifestation: c.DEC_manifestation || ''
    }) });
  }
  for (let i = 0; i < updates.length; i += 10) {
    await getBase()(TABLE_TESTDEC).update(updates.slice(i, i + 10), { typecast: true });
    await sleep(150);
  }
  logger.info('TESTDEC codages écrits', { candidat_id, count: updates.length });
  return updates.length;
}

// Verdict management seul (déclencheur de la génération du test).
async function getEtape2T5CVerdictMan(candidat_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.ETAPE2_BILAN4EXCELLENCES)
      .select({ filterByFormula: `LOWER({candidat_id}) = "${String(candidat_id).toLowerCase()}"`, maxRecords: 1 })
      .all();
    if (!records[0]) return '';
    return _sel(records[0].fields.verdict_man_niveau);
  } catch (error) {
    logger.error('Failed to get verdict_man_niveau', { candidat_id, error: error.message });
    throw error;
  }
}

async function deleteRowsByCandidatId(tableName, candidat_id) {
  const records = await getBase()(tableName)
    .select({ filterByFormula: `{candidat_id} = "${candidat_id}"`, fields: [] })
    .all();

  if (records.length === 0) {
    logger.debug('No existing rows to delete', { tableName, candidat_id });
    return 0;
  }

  const ids = records.map(r => r.id);
  for (let i = 0; i < ids.length; i += 10) {
    const batch = ids.slice(i, i + 10);
    await getBase()(tableName).destroy(batch);
    if (i + 10 < ids.length) await sleep(200);
  }

  logger.debug('Rows deleted', { tableName, candidat_id, count: ids.length });
  return ids.length;
}

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
// ⭐ v11.0 — ÉTAPE 3 : LE BILAN (3 tables T3)
// ═══════════════════════════════════════════════════════════════════════════

function _mapByFieldIds(record, fieldsMap) {
  const out = { airtable_id: record.id };
  const raw = record.fields || {};
  for (const [cleLisible, fieldId] of Object.entries(fieldsMap)) {
    let v = raw[fieldId];
    if (v === undefined) v = raw[cleLisible];
    if (v && typeof v === 'object' && !Array.isArray(v) && v.name !== undefined) {
      v = v.name;
    }
    out[cleLisible] = v !== undefined ? v : null;
  }
  return out;
}

async function _deleteT3ByKeyField(tableName, keyFieldName, candidat_id) {
  const records = await getBase()(tableName)
    .select({ filterByFormula: `{${keyFieldName}} = "${candidat_id}"` })
    .all();
  if (records.length === 0) return 0;
  const ids = records.map(r => r.id);
  for (let i = 0; i < ids.length; i += 10) {
    await getBase()(tableName).destroy(ids.slice(i, i + 10));
    if (i + 10 < ids.length) await sleep(200);
  }
  return ids.length;
}

async function _createT3Batches(tableName, rows) {
  if (!Array.isArray(rows) || rows.length === 0) return 0;
  const records = rows.map(fields => ({ fields }));
  let created = 0;
  for (let i = 0; i < records.length; i += 10) {
    await getBase()(tableName).create(records.slice(i, i + 10), { typecast: true });
    created += Math.min(10, records.length - i);
    if (i + 10 < records.length) await sleep(200);
  }
  return created;
}

async function getEtape1T3Piliers(candidat_id) {
  try {
    const F = airtableConfig.ETAPE1_T3_PILIER_FIELDS;
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T3_PILIER)
      .select({ filterByFormula: `{candidat_id} = "${candidat_id}"`, returnFieldsByFieldId: true })
      .all();
    return records.map(r => _mapByFieldIds(r, F));
  } catch (error) {
    logger.error('Failed to get ETAPE1_T3_PILIER', { candidat_id, error: error.message });
    throw error;
  }
}

async function getEtape1T3Circuits(candidat_id) {
  try {
    const F = airtableConfig.ETAPE1_T3_CIRCUIT_FIELDS;
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T3_CIRCUIT)
      .select({ filterByFormula: `{candidat_id} = "${candidat_id}"`, returnFieldsByFieldId: true })
      .all();
    return records.map(r => _mapByFieldIds(r, F));
  } catch (error) {
    logger.error('Failed to get ETAPE1_T3_CIRCUIT', { candidat_id, error: error.message });
    throw error;
  }
}

async function getEtape1T3Bilan(candidat_id) {
  try {
    const F = airtableConfig.ETAPE1_T3_BILAN_FIELDS;
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T3_BILAN)
      .select({ filterByFormula: `{candidat_id} = "${candidat_id}"`, maxRecords: 1, returnFieldsByFieldId: true })
      .firstPage();
    if (records.length === 0) return null;
    return _mapByFieldIds(records[0], F);
  } catch (error) {
    logger.error('Failed to get ETAPE1_T3_BILAN', { candidat_id, error: error.message });
    throw error;
  }
}

async function writeEtape1T3Piliers(candidat_id, rows) {
  try {
    const t = airtableConfig.TABLES.ETAPE1_T3_PILIER;
    const F = airtableConfig.ETAPE1_T3_PILIER_FIELDS;
    await _deleteT3ByKeyField(t, 'candidat_id', candidat_id);
    const pilierMap = new Map();
    for (let i = 0; i < rows.length; i += 10) {
      const slice = rows.slice(i, i + 10);
      const batch = slice.map(fields => ({ fields }));
      const created = await getBase()(t).create(batch, { typecast: true });
      created.forEach((rec, j) => {
        const sent = slice[j] || {};
        const rawPilier = sent[F.pilier];
        const pilierKey = (rawPilier && typeof rawPilier === 'object') ? (rawPilier.name || null) : rawPilier;
        if (pilierKey) pilierMap.set(pilierKey, rec.id);
      });
      if (i + 10 < rows.length) await sleep(200);
    }
    logger.info('ETAPE1_T3_PILIER written', { candidat_id, count: pilierMap.size });
    return pilierMap;
  } catch (error) {
    logger.error('Failed to write ETAPE1_T3_PILIER', { candidat_id, error: error.message });
    throw error;
  }
}

async function writeEtape1T3Circuits(candidat_id, rows) {
  try {
    const t = airtableConfig.TABLES.ETAPE1_T3_CIRCUIT;
    await _deleteT3ByKeyField(t, 'candidat_id', candidat_id);
    const n = await _createT3Batches(t, rows);
    logger.info('ETAPE1_T3_CIRCUIT written', { candidat_id, count: n });
    return n;
  } catch (error) {
    logger.error('Failed to write ETAPE1_T3_CIRCUIT', { candidat_id, error: error.message });
    throw error;
  }
}

async function upsertEtape1T3Bilan(candidat_id, fields) {
  try {
    const t = airtableConfig.TABLES.ETAPE1_T3_BILAN;
    const existing = await getBase()(t)
      .select({ filterByFormula: `{candidat_id} = "${candidat_id}"`, maxRecords: 1 })
      .firstPage();
    if (existing.length > 0) {
      await getBase()(t).update([{ id: existing[0].id, fields }], { typecast: true });
      logger.info('ETAPE1_T3_BILAN updated', { candidat_id, recordId: existing[0].id });
      return existing[0].id;
    } else {
      const created = await getBase()(t).create([{ fields }], { typecast: true });
      const newId = created[0].id;
      logger.info('ETAPE1_T3_BILAN created', { candidat_id, recordId: newId });
      return newId;
    }
  } catch (error) {
    logger.error('Failed to upsert ETAPE1_T3_BILAN', { candidat_id, error: error.message });
    throw error;
  }
}

async function getReferentielProfils() {
  try {
    const records = await getBase()(airtableConfig.TABLES.REFERENTIEL_PROFILS)
      .select({
        sort: [
          { field: 'fldSVjfx7fiqmNdJc', direction: 'asc' },
          { field: 'fldT4KInNV3JdfS7A', direction: 'asc' }
        ]
      })
      .all();
    return records.map(r => {
      const f = r.fields || {};
      const pilierRaw = f['fldSVjfx7fiqmNdJc'];
      const pilier = (pilierRaw && typeof pilierRaw === 'object' && pilierRaw.name !== undefined)
        ? pilierRaw.name : (pilierRaw || '');
      return {
        airtable_id: r.id,
        nom:         f['fldGmwZVzaVNts203'] || '',
        description: f['fldK84i0RPwiXCgYH'] || '',
        pilier,
        ordre:       f['fldT4KInNV3JdfS7A'] || 0,
        version:     f['fldWPovkZEmVaAZXu'] || ''
      };
    });
  } catch (error) {
    logger.error('Failed to get REFERENTIEL_PROFILS', { error: error.message });
    throw error;
  }
}

async function writeVerifBilan(bilanRecordId, fieldsVerif) {
  if (!bilanRecordId || !fieldsVerif || Object.keys(fieldsVerif).length === 0) return;
  try {
    const F = airtableConfig.ETAPE1_T3_BILAN_FIELDS;
    const row = {};
    for (const [k, v] of Object.entries(fieldsVerif)) {
      if (F[k] && v != null && String(v).trim() !== '') row[F[k]] = v;
    }
    if (Object.keys(row).length === 0) return;
    await getBase()(airtableConfig.TABLES.ETAPE1_T3_BILAN).update(
      [{ id: bilanRecordId, fields: row }], { typecast: true }
    );
    logger.info('Verif BILAN écrit', { bilanRecordId, champs: Object.keys(fieldsVerif) });
  } catch (error) {
    logger.error('Failed to write verif BILAN', { bilanRecordId, error: error.message });
  }
}

async function writeVerifPiliers(pilierMap, piliersVerif) {
  if (!pilierMap || !piliersVerif) return;
  try {
    const F = airtableConfig.ETAPE1_T3_PILIER_FIELDS;
    const updates = [];
    for (const [pilier, champs] of Object.entries(piliersVerif)) {
      const recId = pilierMap.get ? pilierMap.get(pilier) : (pilierMap[pilier]);
      if (!recId || !champs) continue;
      const row = {};
      for (const [k, v] of Object.entries(champs)) {
        if (F[k] && v != null && String(v).trim() !== '') row[F[k]] = v;
      }
      if (Object.keys(row).length > 0) updates.push({ id: recId, fields: row });
    }
    if (updates.length === 0) return;
    for (let i = 0; i < updates.length; i += 10) {
      await getBase()(airtableConfig.TABLES.ETAPE1_T3_PILIER).update(updates.slice(i, i + 10), { typecast: true });
    }
    logger.info('Verif PILIER écrit', { nb: updates.length });
  } catch (error) {
    logger.error('Failed to write verif PILIER', { error: error.message });
  }
}

module.exports = {
  // VISITEUR
  getVisiteur,
  updateVisiteur,
  getVisiteursByStatus,

  // RESPONSES (lecture seule)
  getResponses,
  getResponsesBySession,
  patchResponseRow,

  // ⭐ v11.6 — ETAPE2 : visualisation 4 excellences
  getEtape2Excellences,

  // ⭐ v11.7 — Bilan dynamique des 4 excellences (T5B + T5C)
  getBilanExcellences,

  // ⭐ Étape 2c (02/07) — Test complémentaire de décentration
  getEtape1ProfilPourTest,
  writeTestDecentration,
  getTestDecentrationRows,
  saveTestDecentrationReponses,
  patchTestDecentrationCodage,
  getEtape2T5CVerdictMan,

  // ⭐ v11.7 — Production Étape 2 (agents T5A / T5BC)
  getEtape2T5ARows,
  patchEtape2T5ARows,
  getEtape2T5BRows,
  upsertEtape2T5B,
  upsertEtape2T5C,

  // ETAPE1_T1
  getEtape1T1,
  writeEtape1T1,
  patchEtape1T1Rows,
  updateTypesVerbatimCircuits,
  deleteEtape1T1Scenario,
  writeEtape1T1Scenario,

  // VERIFICATEUR_T1
  writeVerificateurT1,
  getVerificateurT1History,

  // VALIDATION HUMAINE
  getCandidatsEnAttenteValidation,
  appliquerValidationHumaine,

  // TENTATIVES MODE 4
  incrementTentativesEtape1,
  resetTentativesEtape1,

  // COMMUNICATION CANDIDAT
  getCandidatsAEmailler,
  markerEmailCandidatEnvoye,
  setDateT0,

  // ETAPE1_T2
  getEtape1T2,
  getEtape1T2Fable,             // ⭐ v11.7-fable — table tblaGd3ixAWxbJJp2
  writeEtape1T2,

  // ⭐ v10.9 — Tables Phase 3
  getEtape1T2VentilationPiliers,
  writeEtape1T2VentilationPiliers,
  getEtape1T2InventaireCircuits,
  writeEtape1T2InventaireCircuits,

  // ⭐ 18/06/2026 — Table figée Phase 4
  getEtape1T2CircuitsPourbilan,
  writeEtape1T2CircuitsPourbilan,
  patchEtape1T2CircuitsPourbilanRoles,   // ⭐ 24/06/2026 — patch role_pilier (agent rôles 4b)

  // ETAPE1_T3
  getEtape1T3,
  writeEtape1T3,

  // ⭐ v11.0 — Étape 3 : le bilan (3 tables T3)
  getEtape1T3Piliers,
  getEtape1T3Circuits,
  getEtape1T3Bilan,
  writeEtape1T3Piliers,
  writeEtape1T3Circuits,
  upsertEtape1T3Bilan,

  // REFERENTIEL_PROFILS
  getReferentielProfils,

  // VÉRIFICATEUR (Lot D)
  writeVerifBilan,
  writeVerifPiliers,

  // ETAPE1_T4_BILAN
  getEtape1T4Bilan,
  upsertEtape1T4Bilan,

  // REFERENTIEL_LEXIQUE
  getReferentielLexique,
  formaterLexiquePourPrompt,

  // REFERENTIEL_PILIERS
  getReferentielPiliers,

  // REFERENTIEL_CIRCUITS
  getReferentielCircuits,

  // REFERENTIEL_CIRCUITS_CANDIDATS
  getCircuitsAdHocByStatut,
  getReferentielCircuitsCapacites,   // ⭐ 18/06/2026 — capacité des ad hoc
  upsertCircuitAdHoc,

  // VISITEUR — civilité
  getCiviliteCandidat,
  getVisiteurInfoForVisualisation,

  // Helpers exportés
  cleanFields,
  deepCleanString
};
