// services/agentT4ArchitectureService.js
// Agent T4-1 — Architecture des piliers (entête, pourquoi rôle)
// Profil-Cognitif v9.0
//
// Rôle :
//   - Lit T1, T2, T3 du candidat
//   - Construit le payload via prepareT4Inputs
//   - Appelle agent Claude (prompt etape1_t4/AGENT_1_ARCHITECTURE.md)
//   - Écrit dans ETAPE1_T4_BILAN les 11 champs : pX_entete, pX_pourquoi_role × 5 + audit_agent1
//
// Extended thinking ACTIVÉ (raisonnement sur attribution rôles).
// Lexique INJECTÉ (production de texte doctrinal).

'use strict';

const agentBase       = require('./agentBase');
const airtableService = require('./airtableService');
const prepareT4       = require('./prepareT4Inputs');
const logger          = require('../utils/logger');

const SERVICE_NAME = 'agent_t4_architecture';
const PROMPT_PATH  = 'etape1_t4/AGENT_1_ARCHITECTURE.md';

/**
 * Exécute l'Agent T4-1 Architecture
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {string} params.prenom
 * @param {Array} params.t1Rows
 * @param {Array} params.t2Rows
 * @param {Array} params.t3Rows
 * @returns {Promise<{result: Object, usage: Object, cost: number, elapsedMs: number}>}
 */
async function runAgentT4Architecture({ candidat_id, prenom, t1Rows, t2Rows, t3Rows }) {
  logger.info('Agent T4-Architecture starting', { candidat_id });

  // 1. Préparer les inputs T4 communs
  const t4Inputs = prepareT4.buildT4Inputs({ candidat_id, prenom, t1Rows, t2Rows, t3Rows });

  // 2. Construire le payload spécifique Agent Architecture
  // Selon le prompt, l'Agent Architecture a besoin de :
  //   - métadonnées (candidat_id, prenom)
  //   - chiffres clés T1
  //   - attributions par pilier (T3 + T4) avec rôles
  const payload = {
    candidat_id,
    prenom,
    chiffres_t1: t4Inputs.chiffres_t1,
    piliers: buildPiliersForArchitecture(t4Inputs)
  };

  // 3. Appel Claude
  const { result, usage, cost, elapsedMs } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId:    candidat_id
  });

  // 4. Vérifier que les 11 clés attendues sont présentes
  const expectedKeys = [
    'p1_entete', 'p1_pourquoi_role',
    'p2_entete', 'p2_pourquoi_role',
    'p3_entete', 'p3_pourquoi_role',
    'p4_entete', 'p4_pourquoi_role',
    'p5_entete', 'p5_pourquoi_role',
    'audit_agent1'
  ];

  const missing = expectedKeys.filter(k => !(k in result));
  if (missing.length > 0) {
    logger.warn('Agent T4-Architecture missing keys', { candidat_id, missing });
  }

  // 5. Écrire dans ETAPE1_T4_BILAN (upsert partiel)
  const fields = {};
  for (const key of expectedKeys) {
    fields[key] = result[key] || '';
  }
  fields.prenom = prenom;

  await airtableService.upsertEtape1T4Bilan(candidat_id, fields);

  logger.info('Agent T4-Architecture completed', {
    candidat_id,
    keys_produced: expectedKeys.length - missing.length,
    cost_usd:      cost.toFixed(4),
    elapsedMs
  });

  return { result, usage, cost, elapsedMs };
}

/**
 * Construit la section "piliers" pour le payload Agent Architecture
 * Format attendu : { P1: {...}, P2: {...}, ... } avec données nécessaires à
 * la rédaction des entêtes et pourquoi_role
 */
function buildPiliersForArchitecture(t4Inputs) {
  const piliers = {};

  for (const pilier of prepareT4.PILIERS) {
    const data = t4Inputs.piliers_data[pilier];
    const role = t4Inputs.roles_par_pilier[pilier];

    piliers[pilier] = {
      nom:                     prepareT4.PILIER_NOMS[pilier],
      role:                    role,
      nb_circuits_actifs:      data.nb_circuits_actifs,
      total_activations:       data.total_activations,
      circuits_dominants_top5: data.circuits_dominants_top5
    };
  }

  return piliers;
}

module.exports = {
  runAgentT4Architecture,
  buildPiliersForArchitecture
};
