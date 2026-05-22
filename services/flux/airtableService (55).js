// services/infrastructure/airtableService.js
// Service Airtable v10.5 — Profil-Cognitif
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Responsabilités :
//   - VISITEUR : suivi candidat, statuts, backups, validation humaine, emails
//   - RESPONSES : lecture seule (frontend candidat)
//   - ETAPE1_T1, T2, T3, T4_BILAN : tables du pipeline
//   - VERIFICATEUR_T1 : audit du vérificateur (Décision n°10)
//   - REFERENTIEL_LEXIQUE : 15 termes doctrinaux, lus par tous les agents
//
// PHASE D (2026-04-28) — v10 :
//   - Déplacé dans services/infrastructure/ (Décision n°27)
//   - Renommage corrections_certificateur → corrections_verificateur (Décision n°10)
//   - +7 nouvelles fonctions (Décisions n°10, n°16, n°24, n°33)
//
// PHASE D-correction (2026-04-29) — v10.1 :
//   - Ajout getReferentielPiliers (vérificateur T1 — bug 2 v10.1)
//   - Ajout getCiviliteCandidat (vérificateur T1 — bug 2 v10.1)
//
// PHASE v10.2b (2026-05-03) — relances par scénario :
//   - Ajout deleteEtape1T1Scenario : suppression ciblée des 5 lignes d'un scénario
//   - Ajout writeEtape1T1Scenario : création ciblée sans écraser les autres lignes
//   - Constante SCENARIOS_VALIDES_T1 : liste canonique des 5 scénarios (Décision n°40)
//   - Décision n°42 : 2 familles de statuts T1 (_SEUL et _DES_<SCENARIO>)
//
// PHASE v10.5 (2026-05-05) — affichage HTML interne :
//   - Ajout getVisiteurInfoForVisualisation : récupère prénom + nom + civilité
//     pour affichage HTML interne UNIQUEMENT (superviseur). Frontière de
//     gouvernance préservée : les agents IA continuent de ne recevoir que la
//     civilité (Décision n°4 — anonymisation absolue côté agents).
//
// Historique :
//   - LOT 21 (2026-04-27) : patchEtape1T1Rows pour patch ciblé sans destruction

'use strict';

const Airtable        = require('airtable');
const airtableConfig  = require('../../config/airtable');
const logger          = require('../../utils/logger');

// ─── Lazy initialization du base Airtable ─────────────────────────────────────
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

// ═══════════════════════════════════════════════════════════════════════════
// ETAPE1_T1 — Analyse brute des 25 réponses
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

/**
 * Patch ciblé sur des lignes ETAPE1_T1 existantes (sans delete+create)
 * Utilisé par le vérificateur T1 pour appliquer ses corrections (Mode 2).
 */
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

// ═══════════════════════════════════════════════════════════════════════════
// ETAPE1_T1 — updateTypesVerbatimCircuits — ⭐ v10.8 (refonte étape 2)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ v10.8 (21/05/2026) — Ajouté pour l'agent d'attribution (Phase 1 de
// l'étape 2 refondue). Met à jour la colonne types_verbatim_circuits sur les
// 25 lignes ETAPE1_T1 d'un candidat.
//
// Cette colonne contient l'attribution d'un circuit (officiel ou ad hoc)
// à chaque entrée de types_verbatim. C'est la trace doctrinale qui garantit
// l'exhaustivité de l'attribution geste par geste.
//
// Source primaire du nom de champ :
//   - Champ Airtable ETAPE1_T1 = 'types_verbatim_circuits' (multilineText)
//
// @param {Array<{record_id: string, types_verbatim_circuits: string}>} updates
// @returns {Promise<{updated: number}>}

async function updateTypesVerbatimCircuits(updates) {
  if (!updates || updates.length === 0) {
    logger.info('updateTypesVerbatimCircuits — empty updates, nothing to do');
    return { updated: 0 };
  }

  try {
    const tableName = airtableConfig.TABLES.ETAPE1_T1;
    const BATCH_SIZE = 10;

    // Validation : chaque update doit avoir record_id et types_verbatim_circuits
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

// ═══════════════════════════════════════════════════════════════════════════
// ETAPE1_T1 — ⭐ v10.2b (Décision n°42 — relances par scénario)
// ═══════════════════════════════════════════════════════════════════════════

// Liste canonique des scénarios (Décision n°40 : 5 agents T1 distincts)
const SCENARIOS_VALIDES_T1 = ['SOMMEIL', 'WEEKEND', 'ANIMAL_1', 'ANIMAL_2', 'PANNE'];

/**
 * Supprime sélectivement les lignes ETAPE1_T1 d'un scénario donné.
 * Phase v10.2b — Décision n°42.
 *
 * Utilisé par l'orchestrateur Étape 1 dans les modes SCENARIO_ISOLÉ et SCENARIO_CASCADE,
 * et par le futur Mode 2 auto du vérificateur (Phase v10.2c).
 *
 * Doctrinalement : on supprime les 5 lignes attendues du scénario sans toucher
 * aux 20 autres lignes du candidat. Pour une suppression complète, utiliser
 * writeEtape1T1 (qui appelle deleteRowsByCandidatId en interne).
 *
 * Garde-fous :
 *   - Refuse si scenario_name n'est pas dans la liste canonique
 *   - Warning (sans refus) si nombre de lignes != 5 (cas d'usage normal = exactement 5)
 *
 * Source primaire des noms de champ :
 *   - Champ Airtable ETAPE1_T1 = 'candidat_id' (snake_case)
 *     → contrat v1.8 Section 3.2 + airtableService.getEtape1T1 ligne 174
 *
 * @param {string} candidat_id
 * @param {string} scenario_name  // SOMMEIL, WEEKEND, ANIMAL_1, ANIMAL_2, PANNE
 * @returns {Promise<{deleted: number, scenario: string}>}
 */
async function deleteEtape1T1Scenario(candidat_id, scenario_name) {
  if (!SCENARIOS_VALIDES_T1.includes(scenario_name)) {
    throw new Error(
      `deleteEtape1T1Scenario — scenario_name invalide: "${scenario_name}". ` +
      `Attendu: ${SCENARIOS_VALIDES_T1.join(', ')}`
    );
  }

  try {
    // 1. Lister les lignes du scénario pour ce candidat
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T1)
      .select({
        filterByFormula: `AND({candidat_id} = "${candidat_id}", {scenario} = "${scenario_name}")`,
        fields: []
      })
      .all();

    if (records.length === 0) {
      logger.warn('deleteEtape1T1Scenario — aucune ligne à supprimer', {
        candidat_id, scenario_name
      });
      return { deleted: 0, scenario: scenario_name };
    }

    if (records.length !== 5) {
      logger.warn('deleteEtape1T1Scenario — nombre de lignes inattendu (attendu: 5)', {
        candidat_id, scenario_name, count: records.length
      });
    }

    // 2. Suppression batch (max 10 IDs par destroy chez Airtable, ici toujours <= 5)
    const idsToDelete = records.map(r => r.id);
    await getBase()(airtableConfig.TABLES.ETAPE1_T1).destroy(idsToDelete);

    logger.info('ETAPE1_T1 rows deleted for scenario', {
      candidat_id,
      scenario_name,
      deleted: idsToDelete.length
    });

    return { deleted: idsToDelete.length, scenario: scenario_name };
  } catch (error) {
    logger.error('Failed to delete ETAPE1_T1 rows for scenario', {
      candidat_id,
      scenario_name,
      error: error.message
    });
    throw error;
  }
}

/**
 * Écrit des lignes ETAPE1_T1 SANS écraser les autres lignes du candidat.
 * Phase v10.2b — Décision n°42.
 *
 * Diffère de writeEtape1T1 : ne fait PAS deleteRowsByCandidatId préalable.
 * Le delete ciblé doit être fait en amont via deleteEtape1T1Scenario.
 *
 * Pattern d'usage attendu (orchestrateur SCENARIO_ISOLÉ / CASCADE) :
 *   1. await deleteEtape1T1Scenario(candidat_id, 'SOMMEIL')   // -5 lignes ciblées
 *   2. const { rows } = await runAgentT1ForScenario(...)      // produit 5 rows
 *   3. await writeEtape1T1Scenario(candidat_id, rows)         // +5 lignes (pas de delete)
 *
 * @param {string} candidat_id
 * @param {Array} rows  // typiquement 5 rows (1 scénario)
 * @returns {Promise<number>} nombre de lignes créées
 */
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
    const created = await createRowsInBatches(
      airtableConfig.TABLES.ETAPE1_T1,
      rows,
      candidat_id
    );
    logger.info('ETAPE1_T1 scenario rows written (additive, no delete)', {
      candidat_id,
      count: created
    });
    return created;
  } catch (error) {
    logger.error('Failed to write ETAPE1_T1 scenario rows', {
      candidat_id,
      error: error.message
    });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VERIFICATEUR_T1 — ⭐ v10 (Décision n°10)
// Audit du vérificateur T1 : 1 ligne par exécution
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Écrit une ligne d'audit dans VERIFICATEUR_T1 après chaque exécution du vérificateur
 * @param {string} candidat_id
 * @param {Object} auditData - {verdict_global, nb_lignes_verifiees, nb_violations_total, nb_critique, nb_doctrinale, nb_observation, violations_json, cost_usd, elapsed_ms}
 */
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
    // Non-bloquant : on log l'erreur mais on continue
  }
}

/**
 * Récupère l'historique des vérifications T1 pour un candidat
 */
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
// VALIDATION HUMAINE — ⭐ v10 (Décision n°16)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Polling : retourne tous les VISITEUR avec statut EN_ATTENTE_VALIDATION_HUMAINE
 * et avec une action déjà tranchée (validation_humaine_action != null)
 */
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

/**
 * Applique l'action décidée par le superviseur sur le candidat
 * @param {string} candidat_id
 * @param {string} action - RELANCER_AGENT_T1 | RELANCER_VERIFICATEUR_T1 | ACCEPTER_TEL_QUEL | ABANDONNER
 * @param {string} motif - Motif libre de la décision
 */
async function appliquerValidationHumaine(candidat_id, action, motif) {
  try {
    // Mapping action → nouveau statut
    const statutMap = {
      RELANCER_AGENT_T1:        'REPRENDRE_AGENT1',
      RELANCER_VERIFICATEUR_T1: 'REPRENDRE_VERIFICATEUR1',
      ACCEPTER_TEL_QUEL:        'en_cours',
      ABANDONNER:               'ERREUR'
    };

    const nouveauStatut = statutMap[action];
    if (!nouveauStatut) {
      throw new Error(`Action validation humaine inconnue : ${action}`);
    }

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
// TENTATIVES MODE 4 — ⭐ v10 (Décision n°24)
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
    // Non-bloquant
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMMUNICATION CANDIDAT — ⭐ v10 (Décision n°33)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Polling : retourne les VISITEUR qui ont besoin d'un email
 * (à appeler par notificationCandidatService toutes les heures)
 */
async function getCandidatsAEmailler() {
  try {
    // On veut les candidats avec date_T0 set (donc ayant terminé) et au moins un email manquant
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

/**
 * Marque qu'un email a été envoyé au candidat
 * @param {string} candidat_id
 * @param {string} type - 'T0' | '24h' | '48h' | '72h' | 'livraison'
 */
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
    if (!fieldName) {
      throw new Error(`Type d'email inconnu : ${type}`);
    }

    await updateVisiteur(candidat_id, { [fieldName]: true });
    logger.info('Email candidat marqué envoyé', { candidat_id, type });
  } catch (error) {
    logger.error('Failed to marquer email candidat envoyé', { candidat_id, type, error: error.message });
    throw error;
  }
}

/**
 * Définit date_T0 quand le candidat termine ses 25 réponses
 */
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
// ETAPE1_T2 / T3 / T4_BILAN
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
// ⭐ v10.9 (22/05/2026) — Tables Phase 3 (visualisation persistée)
//
// Données dérivées calculées mécaniquement par agentT2_phase3_enrichissement_Service.
// Pattern d'écriture identique à writeEtape1T2 : delete + create atomique par candidat_id.
// Lues par les routes /visualiser/tableau2piliers et /visualiser/tableau2circuits.
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Lit les lignes ETAPE1_T2_VENTILATION_PILIERS pour un candidat.
 * Granularité : 1 ligne par (candidat × pilier_coeur), max 5 par candidat.
 * Tri : rang_par_frequence ASC (pilier le plus mobilisé en premier).
 *
 * @param {string} candidat_id
 * @returns {Promise<Array<{ airtable_id: string, ...fields }>>}
 */
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

/**
 * Écrit les lignes ETAPE1_T2_VENTILATION_PILIERS pour un candidat.
 * Pattern atomique : delete by candidat_id + create rows in batches.
 * Idempotent : rejouable sans risque (réécrit l'état complet).
 *
 * @param {string} candidat_id
 * @param {Array<Object>} rows  Lignes à créer (sans candidat_id qui est ajouté par createRowsInBatches)
 */
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

/**
 * Lit les lignes ETAPE1_T2_INVENTAIRE_CIRCUITS pour un candidat.
 * Granularité : 1 ligne par (candidat × circuit distinct), ~30-60 par candidat.
 * Tri : pilier_owner ASC puis rang_dans_pilier ASC (P1 d'abord, top circuits en haut).
 *
 * @param {string} candidat_id
 * @returns {Promise<Array<{ airtable_id: string, ...fields }>>}
 */
async function getEtape1T2InventaireCircuits(candidat_id) {
  try {
    const records = await getBase()(airtableConfig.TABLES.ETAPE1_T2_INVENTAIRE_CIRCUITS)
      .select({
        filterByFormula: `{candidat_id} = "${candidat_id}"`,
        sort: [
          { field: 'pilier_owner',     direction: 'asc' },
          { field: 'rang_dans_pilier', direction: 'asc' }
        ]
      })
      .all();
    return records.map(r => ({ airtable_id: r.id, ...r.fields }));
  } catch (error) {
    logger.error('Failed to get ETAPE1_T2_INVENTAIRE_CIRCUITS', { candidat_id, error: error.message });
    throw error;
  }
}

/**
 * Écrit les lignes ETAPE1_T2_INVENTAIRE_CIRCUITS pour un candidat.
 * Pattern atomique : delete by candidat_id + create rows in batches.
 * Idempotent : rejouable sans risque (réécrit l'état complet).
 *
 * @param {string} candidat_id
 * @param {Array<Object>} rows
 */
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
      logger.debug('ETAPE1_T4_BILAN updated', { candidat_id, fieldsCount: Object.keys(cleanedFields).length });
    } else {
      await getBase()(airtableConfig.TABLES.ETAPE1_T4_BILAN).create([{
        fields: { candidat_id, ...cleanedFields }
      }], { typecast: true });
      logger.debug('ETAPE1_T4_BILAN created', { candidat_id, fieldsCount: Object.keys(cleanedFields).length });
    }
  } catch (error) {
    logger.error('Failed to upsert ETAPE1_T4_BILAN', { candidat_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REFERENTIEL_LEXIQUE — 15 termes doctrinaux
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
// REFERENTIEL_PILIERS — 5 entrées doctrinales (P1-P5)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ v10.1 (2026-04-29) — ajouté pour le vérificateur T1.
// Le prompt verificateur1_t1.txt v1.1 attend referentiel_piliers dans son payload.
// Pattern identique à getReferentielLexique.
//
// Le champ Airtable s'appelle 'regles_critiques' mais le prompt v1.1 le mentionne
// comme 'pieges_avertissements'. On expose la donnée sous les DEUX noms pour
// éviter toute ambiguïté côté agent (le prompt utilise les deux termes selon les
// sections — section 3 du prompt parle de pieges_avertissements, le contrat v1.7
// parle aussi de pieges_avertissements). À l'usage : agent doit chercher l'un ou
// l'autre, les deux pointent vers le même contenu.

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
      // ⭐ Le champ Airtable est 'regles_critiques' mais on expose AUSSI
      // sous le nom 'pieges_avertissements' utilisé dans le prompt v1.1.
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
// REFERENTIEL_CIRCUITS — 75 circuits officiels (étape 2)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ v10.7 (mai 2026) — Lecture du référentiel pour injection dans le payload
// envoyé à l'agent étape 2 (circuits). Les 75 records ont été créés et 23 noms
// ont été corrigés lors de la session du 20/05/2026.
//
// Schéma de la table :
//   - pilier      : singleSelect (P1, P2, P3, P4, P5)
//   - circuit_id  : singleLineText (C1 à C15)
//   - circuit_nom : singleLineText (nom doctrinal court)
//   - geste       : multilineText (description du geste cognitif)

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
      geste:       r.fields.geste || null
    }));

    if (circuits.length !== 75) {
      logger.warn('REFERENTIEL_CIRCUITS incomplet', {
        found: circuits.length, expected: 75
      });
    }

    logger.debug('REFERENTIEL_CIRCUITS loaded', { count: circuits.length });
    return circuits;
  } catch (error) {
    logger.error('Failed to load REFERENTIEL_CIRCUITS', { error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REFERENTIEL_CIRCUITS_CANDIDATS — Bac de veille circuits ad hoc (étape 2)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ v10.7.1 (21/05/2026) — Refonte schéma + logique de promotion automatique
//
// Table créée le 20/05/2026 puis refondue le même soir (tblUDy7QTOzMMkhEK)
// avec un schéma plus rigoureux distinguant les occurrences dans le pilier
// principal vs dans d'autres piliers (transversalité).
//
// Mission : quand l'agent étape 2 ne trouve aucun circuit officiel pour
// décrire un geste (PASSE 5), il crée un circuit ad hoc et l'écrit ici en
// statut EN_ATTENTE. Promotion automatique selon doctrine ci-dessous.
//
// ─── SCHÉMA RÉEL (14 champs — confirmé via CSV export 21/05/2026) ─────────
//   - nom_propose                       : singleLineText (primary)
//   - pilier_principal                  : singleSelect P1/P2/P3/P4/P5
//   - geste_propose                     : multilineText
//   - occurrences_pilier_principal      : number (precision 0)
//   - occurrences_autres_piliers        : number (precision 0)
//   - candidats_concernes               : multilineText (1 candidat_id par ligne)
//   - questions_concernees              : multilineText (1 "PXQYY SCENARIO - candidat_id" par ligne)
//   - verbatim_source_premier           : multilineText (verbatim du 1er candidat détecté)
//   - circuits_proches_envisages        : multilineText
//   - statut                            : singleSelect
//                                          EN_ATTENTE | PROMU_AUTO | PROMU_MANUEL | REJETE | FUSIONNE
//   - circuit_officiel_apres_promotion  : singleLineText (ex "P3·C16" si promu)
//   - date_premiere_detection           : dateTime (Europe/Paris)
//   - date_derniere_mise_a_jour         : dateTime (Europe/Paris)
//   - commentaire_validation            : multilineText (notes CTO)
//
// ─── DOCTRINE DE PROMOTION (validée 20/05/2026) ───────────────────────────
//
//   Cas A — Promotion automatique :
//     Si occurrences_pilier_principal ≥ PROMOTION_THRESHOLD_SAME_PILLAR (3)
//     → statut = PROMU_AUTO
//     → c'est une signature cognitive structurante du pilier principal
//     → bascule du statut + log. La création effective du record dans
//       REFERENTIEL_CIRCUITS sous P{X}·C{16+} est faite manuellement par
//       la CTO (choix du numéro libre + relecture nom officiel).
//
//   Cas B — Flag pour arbitrage humain :
//     Si (occurrences_pilier_principal + occurrences_autres_piliers) ≥
//        PROMOTION_THRESHOLD_MULTI_PILLAR (5)
//     ET présent sur ≥ 2 piliers distincts
//     → reste EN_ATTENTE (pas PROMU_AUTO car ambigu — quel pilier ?)
//     → log warn pour signaler à la CTO qu'arbitrage manuel requis
//     → la CTO décide du pilier de rattachement puis bascule manuellement
//       en PROMU_MANUEL.
//
//   Cas C — Sous seuil : statut reste EN_ATTENTE, on attend d'autres
//   candidats pour mûrir le compteur.

// ─── Seuils doctrinaux de promotion ─────────────────────────────────────
const PROMOTION_THRESHOLD_SAME_PILLAR  = 3;
const PROMOTION_THRESHOLD_MULTI_PILLAR = 5;

/**
 * Lit tous les circuits ad hoc filtrés par statut (par défaut EN_ATTENTE).
 *
 * Utilisé par agentT2Service en début de run pour injecter dans le payload
 * la liste des ad hoc déjà détectés — l'agent réutilise un nom existant si
 * le même geste réapparaît chez un nouveau candidat (anti-doublons).
 *
 * @param {string} statut  EN_ATTENTE | PROMU_AUTO | PROMU_MANUEL | REJETE | FUSIONNE
 * @returns {Promise<Array>}
 */
async function getCircuitsAdHocByStatut(statut = 'EN_ATTENTE') {
  try {
    const records = await getBase()(airtableConfig.TABLES.REFERENTIEL_CIRCUITS_CANDIDATS)
      .select({
        filterByFormula: `{statut} = "${statut}"`,
        sort: [
          { field: 'occurrences_pilier_principal', direction: 'desc' }
        ]
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
    logger.error('Failed to load REFERENTIEL_CIRCUITS_CANDIDATS', {
      statut, error: error.message
    });
    throw error;
  }
}

/**
 * Upsert d'un circuit ad hoc avec gestion automatique des compteurs par
 * pilier (principal vs autres) ET déclenchement automatique de la promotion
 * si seuils franchis.
 *
 *   - Si un ad hoc avec ce nom_propose existe déjà :
 *     • Si le pilier_courant == pilier_principal du record
 *       → occurrences_pilier_principal++
 *     • Sinon (transversalité)
 *       → occurrences_autres_piliers++
 *     • Ajout candidat_id à candidats_concernes (si pas déjà présent)
 *     • Ajout entrée "PXQYY SCENARIO - candidat_id" à questions_concernees
 *     • date_derniere_mise_a_jour = now
 *     • Check promotion (Cas A ou flag Cas B)
 *
 *   - Sinon (création) :
 *     • Crée avec pilier_principal = pilier_courant
 *     • occurrences_pilier_principal = 1, occurrences_autres_piliers = 0
 *     • statut = EN_ATTENTE
 *     • date_premiere_detection = now, date_derniere_mise_a_jour = now
 *
 * Match strict, case-sensitive sur nom_propose (les noms ad hoc sont produits
 * par Claude avec une convention stable).
 *
 * @param {Object}   args
 * @param {string}   args.candidat_id              candidat_id du candidat courant
 * @param {string}   args.nom_propose              nom du circuit ad hoc
 * @param {string}   args.pilier_courant           pilier du geste pour CE candidat (P1..P5)
 * @param {string}  [args.geste_propose]           description doctrinale du geste
 * @param {string}  [args.verbatim_source]         verbatim qui a justifié la création
 * @param {string}  [args.question_source]         question_id_protocole + scénario (ex "P2Q15 SOMMEIL")
 * @param {string}  [args.circuits_proches_envisages]
 *
 * @returns {Promise<{
 *   action: 'created'|'incremented_principal'|'incremented_autres'|'skipped',
 *   airtable_id: string,
 *   occurrences_pilier_principal: number,
 *   occurrences_autres_piliers: number,
 *   total: number,
 *   promotion_triggered: 'auto'|'flag_arbitrage'|null
 * }>}
 */
async function upsertCircuitAdHoc({
  candidat_id,
  nom_propose,
  pilier_courant,
  geste_propose                = null,
  verbatim_source              = null,
  question_source              = null,
  circuits_proches_envisages   = null
}) {
  if (!candidat_id || !nom_propose || !pilier_courant) {
    throw new Error(
      'upsertCircuitAdHoc — candidat_id, nom_propose et pilier_courant sont requis'
    );
  }

  const nowIso = new Date().toISOString();

  try {
    // ─── 1. Chercher un ad hoc existant (match strict sur nom_propose) ──
    const safeName = String(nom_propose).replace(/"/g, '\\"');

    const existants = await getBase()(airtableConfig.TABLES.REFERENTIEL_CIRCUITS_CANDIDATS)
      .select({
        filterByFormula: `{nom_propose} = "${safeName}"`,
        maxRecords: 1
      })
      .firstPage();

    if (existants && existants.length > 0) {
      // ─── Cas Incrément ────────────────────────────────────────────────
      const existant = existants[0];
      const pilierPrincipalRecord = extractLookup(existant.fields.pilier_principal);

      const currentOccPrincipal = existant.fields.occurrences_pilier_principal || 0;
      const currentOccAutres    = existant.fields.occurrences_autres_piliers   || 0;
      const currentCandidats    = existant.fields.candidats_concernes || '';
      const currentQuestions    = existant.fields.questions_concernees || '';
      const currentStatut       = extractLookup(existant.fields.statut);

      // Si déjà PROMU ou REJETE/FUSIONNE, on n'incrémente plus
      if (['PROMU_AUTO', 'PROMU_MANUEL', 'REJETE', 'FUSIONNE'].includes(currentStatut)) {
        logger.debug('Circuit ad hoc déjà finalisé — skip', {
          nom_propose, statut: currentStatut, candidat_id
        });
        return {
          action:                       'skipped',
          airtable_id:                  existant.id,
          occurrences_pilier_principal: currentOccPrincipal,
          occurrences_autres_piliers:   currentOccAutres,
          total:                        currentOccPrincipal + currentOccAutres,
          promotion_triggered:          null
        };
      }

      // Liste des candidats déjà connus
      const candidatsList = currentCandidats
        .split('\n')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      // Si même candidat re-soumis sur le même ad hoc, no-op
      if (candidatsList.includes(candidat_id)) {
        logger.debug('Circuit ad hoc déjà connu pour ce candidat (skip)', {
          nom_propose, candidat_id
        });
        return {
          action:                       'skipped',
          airtable_id:                  existant.id,
          occurrences_pilier_principal: currentOccPrincipal,
          occurrences_autres_piliers:   currentOccAutres,
          total:                        currentOccPrincipal + currentOccAutres,
          promotion_triggered:          null
        };
      }

      // Détermine de quel compteur on incrémente
      const isPilierPrincipal = (pilier_courant === pilierPrincipalRecord);
      const newOccPrincipal   = isPilierPrincipal ? currentOccPrincipal + 1 : currentOccPrincipal;
      const newOccAutres      = isPilierPrincipal ? currentOccAutres        : currentOccAutres + 1;
      const total             = newOccPrincipal + newOccAutres;

      // Mise à jour des listes
      candidatsList.push(candidat_id);
      const newCandidats = candidatsList.join('\n');

      const questionEntry  = `${question_source || '?'} - ${candidat_id}`;
      const newQuestions   = currentQuestions
        ? `${currentQuestions}\n${questionEntry}`
        : questionEntry;

      // ─── Check promotion automatique (Cas A) ────────────────────────
      let promotionTriggered = null;
      let newStatut          = currentStatut;
      let circuitOfficielTag = existant.fields.circuit_officiel_apres_promotion || null;

      if (newOccPrincipal >= PROMOTION_THRESHOLD_SAME_PILLAR) {
        // Cas A : promotion automatique
        newStatut = 'PROMU_AUTO';
        promotionTriggered = 'auto';
        // circuit_officiel_apres_promotion reste vide — la CTO la remplit
        // après création manuelle du C16+ dans REFERENTIEL_CIRCUITS
        logger.warn('🎯 PROMOTION AUTOMATIQUE DÉCLENCHÉE (Cas A : ≥3 même pilier)', {
          nom_propose,
          pilier_principal:                  pilierPrincipalRecord,
          occurrences_pilier_principal:      newOccPrincipal,
          candidats_concernes_count:         candidatsList.length,
          action_requise:                    'CTO doit créer le circuit officiel dans REFERENTIEL_CIRCUITS sous P{X}·C{16+}'
        });
      } else if (total >= PROMOTION_THRESHOLD_MULTI_PILLAR && newOccAutres > 0) {
        // Cas B : flag arbitrage manuel (statut reste EN_ATTENTE)
        promotionTriggered = 'flag_arbitrage';
        logger.warn('⚠️ ARBITRAGE MANUEL REQUIS (Cas B : ≥5 total multi-piliers)', {
          nom_propose,
          pilier_principal:                  pilierPrincipalRecord,
          occurrences_pilier_principal:      newOccPrincipal,
          occurrences_autres_piliers:        newOccAutres,
          total,
          action_requise:                    'CTO doit décider du pilier de rattachement définitif et basculer manuellement en PROMU_MANUEL'
        });
      }

      // Update
      const updateFields = {
        occurrences_pilier_principal: newOccPrincipal,
        occurrences_autres_piliers:   newOccAutres,
        candidats_concernes:          newCandidats,
        questions_concernees:         newQuestions,
        date_derniere_mise_a_jour:    nowIso
      };
      if (newStatut !== currentStatut) {
        updateFields.statut = newStatut;
      }

      await getBase()(airtableConfig.TABLES.REFERENTIEL_CIRCUITS_CANDIDATS).update([
        { id: existant.id, fields: updateFields }
      ]);

      logger.info('Circuit ad hoc incrémenté', {
        nom_propose,
        pilier_courant,
        pilier_principal_record: pilierPrincipalRecord,
        incremented:             isPilierPrincipal ? 'pilier_principal' : 'autres_piliers',
        occurrences_pilier_principal: newOccPrincipal,
        occurrences_autres_piliers:   newOccAutres,
        total,
        candidat_id,
        statut: newStatut
      });

      return {
        action:                       isPilierPrincipal ? 'incremented_principal' : 'incremented_autres',
        airtable_id:                  existant.id,
        occurrences_pilier_principal: newOccPrincipal,
        occurrences_autres_piliers:   newOccAutres,
        total,
        promotion_triggered:          promotionTriggered
      };
    }

    // ─── Cas Création (aucun record existant) ───────────────────────────
    const questionEntry = `${question_source || '?'} - ${candidat_id}`;

    const created = await getBase()(airtableConfig.TABLES.REFERENTIEL_CIRCUITS_CANDIDATS).create([
      {
        fields: cleanFields({
          nom_propose,
          pilier_principal:              pilier_courant,
          geste_propose,
          occurrences_pilier_principal:  1,
          occurrences_autres_piliers:    0,
          candidats_concernes:           candidat_id,
          questions_concernees:          questionEntry,
          verbatim_source_premier:       verbatim_source,
          circuits_proches_envisages,
          statut:                        'EN_ATTENTE',
          date_premiere_detection:       nowIso,
          date_derniere_mise_a_jour:     nowIso
        })
      }
    ]);

    logger.info('Circuit ad hoc créé', {
      nom_propose,
      pilier_principal: pilier_courant,
      candidat_id,
      airtable_id: created[0].id
    });

    return {
      action:                       'created',
      airtable_id:                  created[0].id,
      occurrences_pilier_principal: 1,
      occurrences_autres_piliers:   0,
      total:                        1,
      promotion_triggered:          null
    };
  } catch (error) {
    logger.error('Failed to upsert circuit ad hoc', {
      candidat_id, nom_propose, pilier_courant,
      error: error.message
    });
    throw error;
  }
}

// ─── Helper interne pour les nouvelles fonctions étape 2 ──────────────────
// Extrait une valeur scalaire d'un champ Airtable qui peut être un array
// (lookup) ou une string simple. ["P3"] → "P3" / "P3" → "P3" / null → null
function extractLookup(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : null;
  return String(value);
}


// ═══════════════════════════════════════════════════════════════════════════
// VISITEUR — getCiviliteCandidat (Décision n°4 : anonymisation absolue)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ v10.1 (2026-04-29) — ajouté pour le vérificateur T1.
// Le prompt verificateur1_t1.txt v1.1 attend civilite dans son payload.
// Aucun prénom transmis — uniquement la civilité (Madame/Monsieur) pour les
// accords grammaticaux dans les raisons doctrinales.

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

// ═══════════════════════════════════════════════════════════════════════════
// VISITEUR — getVisiteurInfoForVisualisation (v10.5 — affichage HTML interne)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ v10.5 (2026-05-05) — ajouté pour la visualisation HTML interne.
//
// Cette fonction récupère prénom + nom + civilité depuis la table VISITEUR
// pour AFFICHAGE INTERNE UNIQUEMENT (page HTML de visualisation des analyses
// par le superviseur). Elle ne doit PAS être utilisée dans les payloads
// envoyés aux agents IA — la Décision n°4 d'anonymisation absolue reste
// pleinement applicable côté agents (qui ne reçoivent que la civilité).
//
// Frontière de gouvernance :
//   - Côté agents (T1, Vérificateur, T2, T3...) : civilité seulement
//   - Côté visualisation interne (superviseur)   : prénom + nom + civilité
//
// Si le visiteur est introuvable ou le champ vide, retourne un objet avec
// fallback ('?') pour que le HTML reste fonctionnel sans crasher.

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
    const info = {
      candidate_ID: f[airtableConfig.VISITEUR_FIELDS.candidate_ID] || candidat_id,
      prenom:       f[airtableConfig.VISITEUR_FIELDS.Prenom]            || '?',
      nom:          f[airtableConfig.VISITEUR_FIELDS.Nom]               || '?',
      civilite:     f[airtableConfig.VISITEUR_FIELDS.civilite_candidat] || '?'
    };
    logger.debug('Visiteur info lu pour visualisation', { candidat_id, prenom: info.prenom });
    return info;
  } catch (error) {
    logger.error('Failed to read visiteur info for visualisation', { candidat_id, error: error.message });
    return { prenom: '?', nom: '?', civilite: '?', candidate_ID: candidat_id };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS INTERNES
// ═══════════════════════════════════════════════════════════════════════════

async function deleteRowsByCandidatId(tableName, candidat_id) {
  const records = await getBase()(tableName)
    .select({
      filterByFormula: `{candidat_id} = "${candidat_id}"`,
      fields: []
    })
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
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  // VISITEUR
  getVisiteur,
  updateVisiteur,
  getVisiteursByStatus,

  // RESPONSES (lecture seule)
  getResponses,
  getResponsesBySession,

  // ETAPE1_T1
  getEtape1T1,
  writeEtape1T1,
  patchEtape1T1Rows,
  updateTypesVerbatimCircuits, // ⭐ v10.8 (refonte étape 2 phase 1 - attribution)
  deleteEtape1T1Scenario,   // ⭐ v10.2b (Décision n°42)
  writeEtape1T1Scenario,    // ⭐ v10.2b (Décision n°42)

  // VERIFICATEUR_T1 — ⭐ v10
  writeVerificateurT1,
  getVerificateurT1History,

  // VALIDATION HUMAINE — ⭐ v10
  getCandidatsEnAttenteValidation,
  appliquerValidationHumaine,

  // TENTATIVES MODE 4 — ⭐ v10
  incrementTentativesEtape1,
  resetTentativesEtape1,

  // COMMUNICATION CANDIDAT — ⭐ v10
  getCandidatsAEmailler,
  markerEmailCandidatEnvoye,
  setDateT0,

  // ETAPE1_T2
  getEtape1T2,
  writeEtape1T2,

  // ⭐ v10.9 (22/05/2026) — Tables Phase 3 (visualisation persistée)
  getEtape1T2VentilationPiliers,
  writeEtape1T2VentilationPiliers,
  getEtape1T2InventaireCircuits,
  writeEtape1T2InventaireCircuits,

  // ETAPE1_T3
  getEtape1T3,
  writeEtape1T3,

  // ETAPE1_T4_BILAN
  getEtape1T4Bilan,
  upsertEtape1T4Bilan,

  // REFERENTIEL_LEXIQUE
  getReferentielLexique,
  formaterLexiquePourPrompt,

  // REFERENTIEL_PILIERS — ⭐ v10.1 (vérificateur T1)
  getReferentielPiliers,

  // REFERENTIEL_CIRCUITS — ⭐ v10.7 (étape 2 refonte)
  getReferentielCircuits,

  // REFERENTIEL_CIRCUITS_CANDIDATS — ⭐ v10.7 (mission de veille étape 2)
  getCircuitsAdHocByStatut,
  upsertCircuitAdHoc,

  // VISITEUR — civilité (anonymisation Décision n°4)
  getCiviliteCandidat,
  getVisiteurInfoForVisualisation,

  // Helpers exportés
  cleanFields,
  deepCleanString
};
