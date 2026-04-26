// services/agentT4CircuitsService.js
// Agent T4-2 — Circuits cognitifs par pilier
// Profil-Cognitif v9.0
//
// Rôle :
//   - Lit T3 complet (75 lignes circuits) + T1+T2
//   - Appelle agent Claude (prompt etape1_t4/AGENT_2_CIRCUITS.md)
//   - Écrit 16 champs : pX_circuits_lab, pX_circuits_cand, pX_commentaires_t3 × 5 + audit_agent2
//
// Extended thinking ACTIVÉ.
// Lexique INJECTÉ.
// Output volumineux (jusqu'à 64000 tokens — streaming activé automatiquement).

'use strict';

const agentBase       = require('./agentBase');
const airtableService = require('./airtableService');
const prepareT4       = require('./prepareT4Inputs');
const logger          = require('../utils/logger');

const SERVICE_NAME = 'agent_t4_circuits';
const PROMPT_PATH  = 'etape1_t4/AGENT_2_CIRCUITS.md';

async function runAgentT4Circuits({ candidat_id, civilite, t1Rows, t2Rows, t3Rows }) {
  logger.info('Agent T4-Circuits starting', { candidat_id });

  const t4Inputs = prepareT4.buildT4Inputs({ candidat_id, civilite, t1Rows, t2Rows, t3Rows });

  // L'Agent Circuits a besoin de TOUTES les lignes T3 de chaque pilier
  // (15 circuits × 5 piliers = 75 lignes au total) avec les arrays JSON désérialisés
  const piliers = {};
  for (const pilier of prepareT4.PILIERS) {
    piliers[pilier] = t4Inputs.piliers_data[pilier].circuits_actifs_detail;
  }

  const payload = {
    candidat_id,
    civilite,
    roles_par_pilier: t4Inputs.roles_par_pilier,
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
    'p1_circuits_lab', 'p1_circuits_cand', 'p1_commentaires_t3',
    'p2_circuits_lab', 'p2_circuits_cand', 'p2_commentaires_t3',
    'p3_circuits_lab', 'p3_circuits_cand', 'p3_commentaires_t3',
    'p4_circuits_lab', 'p4_circuits_cand', 'p4_commentaires_t3',
    'p5_circuits_lab', 'p5_circuits_cand', 'p5_commentaires_t3',
    'audit_agent2'
  ];

  const missing = expectedKeys.filter(k => !(k in result));
  if (missing.length > 0) {
    logger.warn('Agent T4-Circuits missing keys', { candidat_id, missing });
  }

  const fields = {};
  for (const key of expectedKeys) {
    fields[key] = result[key] || '';
  }

  await airtableService.upsertEtape1T4Bilan(candidat_id, fields);

  logger.info('Agent T4-Circuits completed', {
    candidat_id,
    keys_produced: expectedKeys.length - missing.length,
    cost_usd:      cost.toFixed(4),
    elapsedMs
  });

  return { result, usage, cost, elapsedMs };
}

module.exports = {
  runAgentT4Circuits
};
