// services/agentT4SyntheseService.js
// Agent T4-4 — Synthèse cœur (filtre, boucle, finalité, signature)
// Profil-Cognitif v9.0
//
// Rôle :
//   - Lit T1, T2, T3 (avec focus sur le pilier socle et ses clusters)
//   - Appelle agent Claude (prompt etape1_t4/AGENT_4_SYNTHESE_COEUR.md)
//   - Écrit 8 champs : d1_filtre_lab, d1_filtre_cand, d2_boucle_lab, d2_boucle_cand,
//     d3_finalite_lab, d3_finalite_cand, d4_signature, audit_agent4
//
// Extended thinking ACTIVÉ — c'est l'agent qui demande le plus de raisonnement
// (formulation du filtre, finalité, signature).
// Lexique INJECTÉ — discours doctrinal.

'use strict';

const agentBase       = require('./agentBase');
const airtableService = require('./airtableService');
const prepareT4       = require('./prepareT4Inputs');
const logger          = require('../utils/logger');

const SERVICE_NAME = 'agent_t4_synthese';
const PROMPT_PATH  = 'etape1_t4/AGENT_4_SYNTHESE_COEUR.md';

async function runAgentT4Synthese({ candidat_id, prenom, t1Rows, t2Rows, t3Rows }) {
  logger.info('Agent T4-Synthese starting', { candidat_id });

  const t4Inputs = prepareT4.buildT4Inputs({ candidat_id, prenom, t1Rows, t2Rows, t3Rows });

  // L'Agent Synthèse a besoin de :
  //   - métadonnées
  //   - chiffres clés T1 + ecart_details
  //   - pilier socle complet (id, densité, top5 circuits)
  //   - clusters T3 du pilier socle (paires de circuits co-occurrents)
  //   - signaux limbiques (pour repérer les zones de coût qui éclairent le filtre)
  //   - séquences récurrentes T2 (pour analyser la boucle)
  const sequences_recurrentes = extractSequencesRecurrentes(t2Rows);

  const payload = {
    candidat_id,
    prenom,
    chiffres_t1:        t4Inputs.chiffres_t1,
    pilier_socle:       t4Inputs.pilier_socle,
    clusters_socle:     t4Inputs.clusters_socle,
    roles_par_pilier:   t4Inputs.roles_par_pilier,
    signaux_limbiques:  t4Inputs.signaux_limbiques,
    sequences_recurrentes,
    // Aussi un résumé condensé de chaque pilier pour permettre la formulation
    piliers_synthese: buildPiliersSynthese(t4Inputs)
  };

  const { result, usage, cost, elapsedMs } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId:    candidat_id
  });

  const expectedKeys = [
    'd1_filtre_lab', 'd1_filtre_cand',
    'd2_boucle_lab', 'd2_boucle_cand',
    'd3_finalite_lab', 'd3_finalite_cand',
    'd4_signature',
    'audit_agent4'
  ];

  const missing = expectedKeys.filter(k => !(k in result));
  if (missing.length > 0) {
    logger.warn('Agent T4-Synthese missing keys', { candidat_id, missing });
  }

  const fields = {};
  for (const key of expectedKeys) {
    fields[key] = result[key] || '';
  }

  await airtableService.upsertEtape1T4Bilan(candidat_id, fields);

  logger.info('Agent T4-Synthese completed', {
    candidat_id,
    keys_produced: expectedKeys.length - missing.length,
    filtre_preview:    (result.d1_filtre_cand || '').substring(0, 150),
    finalite_preview:  (result.d3_finalite_cand || '').substring(0, 150),
    signature_preview: (result.d4_signature || '').substring(0, 150),
    cost_usd:          cost.toFixed(4),
    elapsedMs
  });

  return { result, usage, cost, elapsedMs };
}

/**
 * Extrait les séquences de piliers récurrentes depuis T2 pour identifier la boucle
 */
function extractSequencesRecurrentes(t2Rows) {
  const sequences = {};

  for (const r of t2Rows) {
    const seq = r.sequence_piliers;
    if (!seq) continue;
    sequences[seq] = (sequences[seq] || 0) + 1;
  }

  // Trier par fréquence descendante
  return Object.entries(sequences)
    .sort((a, b) => b[1] - a[1])
    .map(([seq, count]) => ({ sequence: seq, occurrences: count }));
}

/**
 * Construit un résumé synthétique pour chaque pilier (utile pour l'Agent Synthèse)
 */
function buildPiliersSynthese(t4Inputs) {
  const result = {};
  for (const pilier of prepareT4.PILIERS) {
    const data = t4Inputs.piliers_data[pilier];
    result[pilier] = {
      nom:                prepareT4.PILIER_NOMS[pilier],
      role:               t4Inputs.roles_par_pilier[pilier],
      nb_circuits_actifs: data.nb_circuits_actifs,
      total_activations:  data.total_activations,
      top3_circuits:      data.circuits_dominants_top5.slice(0, 3)
    };
  }
  return result;
}

module.exports = {
  runAgentT4Synthese,
  extractSequencesRecurrentes
};
