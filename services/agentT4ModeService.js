// services/agentT4ModeService.js
// Agent T4-3 — Mode retenu par pilier
// Profil-Cognitif v9.0
//
// Note : nom du fichier prompt = AGENT_3_MODE.md (sans S, doctrine actée)
// Le service utilise "Mode" au singulier également pour cohérence.
//
// Rôle :
//   - Lit T3 (circuits par pilier)
//   - Appelle agent Claude (prompt etape1_t4/AGENT_3_MODE.md)
//   - Écrit 11 champs : pX_mode_lab, pX_mode_cand × 5 + audit_agent3
//
// Extended thinking ACTIVÉ.
// Lexique INJECTÉ.

'use strict';

const agentBase       = require('./agentBase');
const airtableService = require('./airtableService');
const prepareT4       = require('./prepareT4Inputs');
const logger          = require('../utils/logger');

const SERVICE_NAME = 'agent_t4_modes';
const PROMPT_PATH  = 'etape1_t4/AGENT_3_MODE.md';

async function runAgentT4Mode({ candidat_id, civilite, t1Rows, t2Rows, t3Rows }) {
  logger.info('Agent T4-Mode starting', { candidat_id });

  const t4Inputs = prepareT4.buildT4Inputs({ candidat_id, civilite, t1Rows, t2Rows, t3Rows });

  // L'Agent Mode a besoin par pilier des circuits dominants avec leurs noms
  // exacts pour combiner le mode (ex: "Modulation + Pertinence + Personnalisation")
  const piliers = {};
  for (const pilier of prepareT4.PILIERS) {
    const data = t4Inputs.piliers_data[pilier];
    piliers[pilier] = {
      nom:                     prepareT4.PILIER_NOMS[pilier],
      role:                    t4Inputs.roles_par_pilier[pilier],
      nb_circuits_actifs:      data.nb_circuits_actifs,
      total_activations:       data.total_activations,
      circuits_dominants_top5: data.circuits_dominants_top5,
      // Aussi les circuits actifs avec leur niveau pour discrimination HAUT/MOYEN
      circuits_actifs:         data.circuits_actifs_detail.map(c => ({
        id:                c.id,
        nom:               c.nom,
        frequence:         c.frequence,
        niveau_activation: c.niveau_activation
      }))
    };
  }

  const payload = {
    candidat_id,
    civilite,
    piliers
  };

  const { result, usage, cost, elapsedMs } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId:    candidat_id
  });

  const expectedKeys = [
    'p1_mode_lab', 'p1_mode_cand',
    'p2_mode_lab', 'p2_mode_cand',
    'p3_mode_lab', 'p3_mode_cand',
    'p4_mode_lab', 'p4_mode_cand',
    'p5_mode_lab', 'p5_mode_cand',
    'audit_agent3'
  ];

  const missing = expectedKeys.filter(k => !(k in result));
  if (missing.length > 0) {
    logger.warn('Agent T4-Mode missing keys', { candidat_id, missing });
  }

  const fields = {};
  for (const key of expectedKeys) {
    fields[key] = result[key] || '';
  }

  await airtableService.upsertEtape1T4Bilan(candidat_id, fields);

  logger.info('Agent T4-Mode completed', {
    candidat_id,
    keys_produced: expectedKeys.length - missing.length,
    cost_usd:      cost.toFixed(4),
    elapsedMs
  });

  return { result, usage, cost, elapsedMs };
}

module.exports = {
  runAgentT4Mode
};
