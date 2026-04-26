// services/agentT4TransversesService.js
// Agent T4-6 — Éléments transverses (header, navigation, footer, schémas, lexique)
// Profil-Cognitif v9.0
//
// Rôle :
//   - Lit minimaement T1, T2, T3 (juste pour métadonnées + identifier socle)
//   - Appelle agent Claude (prompt etape1_t4/AGENT_6_TRANSVERSES.md)
//   - Écrit 11 champs : a_definition_moteur, a_legende_couleurs, a_ordre_boucle,
//     a_schema_generique, a_schema_revelation, a_cartouche_attribution,
//     b_lexique_html, e_header, e_navigation, e_footer, audit_agent6
//
// Pas d'extended thinking (assemblage technique sans raisonnement complexe).
// Lexique INJECTÉ — l'agent produit notamment b_lexique_html à partir du référentiel.

'use strict';

const agentBase       = require('./agentBase');
const airtableService = require('./airtableService');
const prepareT4       = require('./prepareT4Inputs');
const logger          = require('../utils/logger');

const SERVICE_NAME = 'agent_t4_transverses';
const PROMPT_PATH  = 'etape1_t4/AGENT_6_TRANSVERSES.md';

async function runAgentT4Transverses({ candidat_id, civilite, t1Rows, t2Rows, t3Rows }) {
  logger.info('Agent T4-Transverses starting', { candidat_id });

  const t4Inputs = prepareT4.buildT4Inputs({ candidat_id, civilite, t1Rows, t2Rows, t3Rows });

  const payload = {
    candidat_id,
    civilite,
    chiffres_t1:      t4Inputs.chiffres_t1,
    pilier_socle:     t4Inputs.pilier_socle,
    roles_par_pilier: t4Inputs.roles_par_pilier
  };

  const { result, usage, cost, elapsedMs } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId:    candidat_id
  });

  // Note : audit_agent6 n'est pas listé dans le prompt mais on l'ajoute par cohérence
  const expectedKeys = [
    'a_definition_moteur',
    'a_legende_couleurs',
    'a_ordre_boucle',
    'a_schema_generique',
    'a_schema_revelation',
    'a_cartouche_attribution',
    'b_lexique_html',
    'e_header',
    'e_navigation',
    'e_footer'
  ];

  const missing = expectedKeys.filter(k => !(k in result));
  if (missing.length > 0) {
    logger.warn('Agent T4-Transverses missing keys', { candidat_id, missing });
  }

  const fields = {};
  for (const key of expectedKeys) {
    fields[key] = result[key] || '';
  }
  // audit_agent6 — produit même si pas dans prompt (pour traçabilité)
  fields.audit_agent6 = result.audit_agent6 || new Date().toISOString();

  await airtableService.upsertEtape1T4Bilan(candidat_id, fields);

  logger.info('Agent T4-Transverses completed', {
    candidat_id,
    keys_produced: expectedKeys.length - missing.length,
    cost_usd:      cost.toFixed(4),
    elapsedMs
  });

  return { result, usage, cost, elapsedMs };
}

module.exports = {
  runAgentT4Transverses
};
