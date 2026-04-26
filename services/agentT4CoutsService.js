// services/agentT4CoutsService.js
// Agent T4-5 — Zones de coût cognitif + conclusion
// Profil-Cognitif v9.0
//
// Rôle :
//   - Lit T1, T2, T3 + résultats de l'Agent Synthèse (filtre, finalité, signature)
//   - Appelle agent Claude (prompt etape1_t4/AGENT_5_COUTS_CLOTURE.md)
//   - Écrit 4 champs : d5_couts_lab, d5_couts_cand, d6_conclusion, audit_agent5
//
// Doit être lancé APRÈS l'Agent Synthèse (a besoin du filtre/finalité/signature).
// Extended thinking ACTIVÉ.
// Lexique INJECTÉ.

'use strict';

const agentBase       = require('./agentBase');
const airtableService = require('./airtableService');
const prepareT4       = require('./prepareT4Inputs');
const logger          = require('../utils/logger');

const SERVICE_NAME = 'agent_t4_couts';
const PROMPT_PATH  = 'etape1_t4/AGENT_5_COUTS_CLOTURE.md';

/**
 * Exécute l'Agent T4-5 Coûts/Clôture
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {string} params.prenom
 * @param {Array} params.t1Rows
 * @param {Array} params.t2Rows
 * @param {Array} params.t3Rows
 * @param {Object} params.synthese - Résultat de l'Agent Synthèse (filtre, finalité, signature)
 *                                    Format : { d1_filtre_cand, d3_finalite_cand, d4_signature, ... }
 */
async function runAgentT4Couts({ candidat_id, prenom, t1Rows, t2Rows, t3Rows, synthese = null }) {
  logger.info('Agent T4-Couts starting', { candidat_id });

  const t4Inputs = prepareT4.buildT4Inputs({ candidat_id, prenom, t1Rows, t2Rows, t3Rows });

  // Agent Coûts a besoin :
  //   - métadonnées
  //   - données complètes de chaque pilier avec signaux limbiques + verbatims
  //   - résultats Synthèse (pour cohérence narrative avec filtre/finalité/signature)
  const payload = {
    candidat_id,
    prenom,
    chiffres_t1: t4Inputs.chiffres_t1,
    piliers:     t4Inputs.piliers_pour_couts,
    pilier_socle: t4Inputs.pilier_socle
  };

  // Si on a la synthèse, on la passe pour assurer cohérence
  if (synthese) {
    payload.synthese_coeur = {
      filtre_lab:    synthese.d1_filtre_lab    || '',
      filtre_cand:   synthese.d1_filtre_cand   || '',
      boucle_lab:    synthese.d2_boucle_lab    || '',
      boucle_cand:   synthese.d2_boucle_cand   || '',
      finalite_lab:  synthese.d3_finalite_lab  || '',
      finalite_cand: synthese.d3_finalite_cand || '',
      signature:     synthese.d4_signature     || ''
    };
  } else {
    logger.warn('Agent T4-Couts called without synthese — narrative coherence may be reduced', { candidat_id });
  }

  const { result, usage, cost, elapsedMs } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId:    candidat_id
  });

  const expectedKeys = ['d5_couts_lab', 'd5_couts_cand', 'd6_conclusion', 'audit_agent5'];

  const missing = expectedKeys.filter(k => !(k in result));
  if (missing.length > 0) {
    logger.warn('Agent T4-Couts missing keys', { candidat_id, missing });
  }

  const fields = {};
  for (const key of expectedKeys) {
    fields[key] = result[key] || '';
  }

  await airtableService.upsertEtape1T4Bilan(candidat_id, fields);

  logger.info('Agent T4-Couts completed', {
    candidat_id,
    keys_produced:      expectedKeys.length - missing.length,
    couts_preview:      (result.d5_couts_cand || '').substring(0, 150),
    conclusion_preview: (result.d6_conclusion || '').substring(0, 150),
    cost_usd:           cost.toFixed(4),
    elapsedMs
  });

  return { result, usage, cost, elapsedMs };
}

module.exports = {
  runAgentT4Couts
};
