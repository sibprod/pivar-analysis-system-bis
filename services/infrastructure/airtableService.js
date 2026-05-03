// services/infrastructure/airtableService.js
// Service Airtable v10.2b — Profil-Cognitif
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

  // VISITEUR — civilité (anonymisation Décision n°4)
  getCiviliteCandidat,

  // Helpers exportés
  cleanFields,
  deepCleanString
};
