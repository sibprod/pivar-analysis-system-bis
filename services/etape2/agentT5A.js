// services/agents/etape2/agentT5A.js
// Agent T5A — Codage des 4 excellences cognitives, réponse par réponse (Étape 2)
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Rôle :
//   - Lit les 25 lignes du candidat dans ETAPE2_RESPONSES_EXCELLENCES (chaque ligne
//     porte déjà response_text + le signal limbique calculé à l'Étape 1).
//   - Pour chaque réponse, appelle le prompt new-prompts/etape2/AGENT_T5A_prompt.md
//     qui code les 4 excellences (niveau / verbatim / manifestation / contexte).
//   - Met à jour la même ligne avec les résultats (patch, pas de création).
//
// Pattern : calqué sur agent_t1 (un appel par réponse, robuste au JSON tronqué).
// Prompt chargé via agentBase.callAgent ; écriture via airtableService.patchEtape2T5ARows.

'use strict';

const agentBase       = require('../../infrastructure/agentBase');
const airtableService = require('../../infrastructure/airtableService');
const logger          = require('../../../utils/logger');

const PROMPT_PATH  = 'etape2/AGENT_T5A_prompt.md';
const SERVICE_NAME = 'agent_t5a';

// Mapping des 4 excellences : clé de sortie de l'agent → préfixe de champ base.
const EXCELLENCES = [
  { out: 'ANT', field: 'anticipation' },
  { out: 'DEC', field: 'decentration' },
  { out: 'MET', field: 'metacognition' },
  { out: 'VUE', field: 'vue_systemique' }
];

const NIVEAUX_VIDE = new Set(['NULLE', 'NON ÉVALUÉ EN SITUATION']);

/**
 * Construit le patch de champs base à partir de la sortie de l'agent pour une réponse.
 * Applique la règle de vidage : verbatim + manifestation vides si NULLE / NON ÉVALUÉ.
 */
function buildPatchFields(agentOut) {
  const fields = {};
  for (const { out, field } of EXCELLENCES) {
    const niveau = (agentOut[`${out}_niveau`] || '').trim();
    fields[`${field}_niveau`] = niveau;
    if (NIVEAUX_VIDE.has(niveau)) {
      fields[`${field}_verbatim`]            = '';
      fields[`${field}_manifestation`]       = '';
      fields[`${field}_contexte_activation`] = (agentOut[`${out}_contexte_activation`] || '').trim();
    } else {
      fields[`${field}_verbatim`]            = (agentOut[`${out}_verbatim`] || '').trim();
      fields[`${field}_manifestation`]       = (agentOut[`${out}_manifestation`] || '').trim();
      fields[`${field}_contexte_activation`] = (agentOut[`${out}_contexte_activation`] || '').trim();
    }
  }
  return fields;
}

/**
 * Exécute l'agent T5A pour un candidat.
 * @param {Object} params
 * @param {string} params.candidat_id - session_id du candidat
 * @returns {Promise<{ lignes: number, cost: number }>}
 */
async function run({ candidat_id }) {
  logger.info('Agent T5A — démarrage', { candidat_id });

  const rows = await airtableService.getEtape2T5ARows(candidat_id);
  if (!rows || rows.length === 0) {
    throw new Error(`Agent T5A : aucune ligne T5A trouvée pour ${candidat_id}`);
  }

  const patchPlan = [];
  let totalCost = 0;

  for (const row of rows) {
    // Entrée de l'agent : la réponse brute + le signal limbique (lecture, pas recalcul).
    const payload = {
      candidat_id,
      id_question:           row.id_question || '',
      question_id_protocole: row.question_id_protocole || '',
      scenario:              (row.scenario_nom && (row.scenario_nom.name || row.scenario_nom)) || row.scenario || '',
      pilier_demande:        (row.pilier_demande && (row.pilier_demande.name || row.pilier_demande)) || '',
      verbatim_candidat:     row.response_text || '',
      limbique_detecte:      row.limbique_detecte || false,
      limbique_intensite:    (row.limbique_intensite && (row.limbique_intensite.name || row.limbique_intensite)) || '',
      limbique_detail:       row.limbique_detail || ''
    };

    const { result, cost } = await agentBase.callAgent({
      serviceName: SERVICE_NAME,
      promptPath:  PROMPT_PATH,
      payload,
      candidatId:  candidat_id
    });
    totalCost += cost || 0;

    // L'agent peut renvoyer un objet unique ou un objet sous une clé ; on normalise.
    const out = Array.isArray(result) ? result[0] : result;
    patchPlan.push({
      airtable_id:     row.airtable_id,
      fields_to_patch: buildPatchFields(out)
    });
  }

  const updated = await airtableService.patchEtape2T5ARows(candidat_id, patchPlan);
  logger.info('Agent T5A — terminé', { candidat_id, lignes: updated, cost_usd: totalCost.toFixed(4) });
  return { lignes: updated, cost: totalCost };
}

module.exports = { run };
