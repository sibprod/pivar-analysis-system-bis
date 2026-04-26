// services/agentCertificateurService.js
// Agent Certificateur — Contrôle qualité lexical post-production
// Profil-Cognitif v9.0
//
// Rôle :
//   - Lit le bilan T4 produit par les 6 agents (depuis ETAPE1_T4_BILAN)
//   - Soumet à un agent Claude qui vérifie 6 contrôles lexicaux
//   - Écrit le rapport JSON dans ETAPE1_T4_BILAN.audit_certificateur
//   - Met à jour statut_bilan : 'certifie' (CONFORME) ou 'non_conforme' (sinon)
//
// Extended thinking ACTIVÉ (détection fine de violations).
// Lexique INJECTÉ obligatoirement.

'use strict';

const agentBase       = require('./agentBase');
const airtableService = require('./airtableService');
const logger          = require('../utils/logger');

const SERVICE_NAME = 'certificateur_lexique';
const PROMPT_PATH  = 'PROMPT_CERTIFICATEUR.md';

/**
 * Exécute le certificateur sur le bilan T4 d'un candidat
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {string} params.prenom
 * @returns {Promise<{report: Object, usage, cost, elapsedMs, isConforme: boolean}>}
 */
async function runAgentCertificateur({ candidat_id, prenom }) {
  logger.info('Certificateur starting', { candidat_id });

  // 1. Lire le bilan T4 complet depuis Airtable
  const bilan = await airtableService.getEtape1T4Bilan(candidat_id);

  if (!bilan) {
    throw new Error(`No T4 bilan found for ${candidat_id} — run T4 agents first`);
  }

  // 2. Construire les 6 sorties agents à partir du bilan T4
  // Chaque sortie agent = ensemble de champs produits par un agent
  const sortie_agent_1 = pick(bilan, [
    'p1_entete', 'p1_pourquoi_role',
    'p2_entete', 'p2_pourquoi_role',
    'p3_entete', 'p3_pourquoi_role',
    'p4_entete', 'p4_pourquoi_role',
    'p5_entete', 'p5_pourquoi_role',
    'audit_agent1'
  ]);

  const sortie_agent_2 = pick(bilan, [
    'p1_circuits_lab', 'p1_circuits_cand', 'p1_commentaires_t3',
    'p2_circuits_lab', 'p2_circuits_cand', 'p2_commentaires_t3',
    'p3_circuits_lab', 'p3_circuits_cand', 'p3_commentaires_t3',
    'p4_circuits_lab', 'p4_circuits_cand', 'p4_commentaires_t3',
    'p5_circuits_lab', 'p5_circuits_cand', 'p5_commentaires_t3',
    'audit_agent2'
  ]);

  const sortie_agent_3 = pick(bilan, [
    'p1_mode_lab', 'p1_mode_cand',
    'p2_mode_lab', 'p2_mode_cand',
    'p3_mode_lab', 'p3_mode_cand',
    'p4_mode_lab', 'p4_mode_cand',
    'p5_mode_lab', 'p5_mode_cand',
    'audit_agent3'
  ]);

  const sortie_agent_4 = pick(bilan, [
    'd1_filtre_lab', 'd1_filtre_cand',
    'd2_boucle_lab', 'd2_boucle_cand',
    'd3_finalite_lab', 'd3_finalite_cand',
    'd4_signature',
    'audit_agent4'
  ]);

  const sortie_agent_5 = pick(bilan, [
    'd5_couts_lab', 'd5_couts_cand',
    'd6_conclusion',
    'audit_agent5'
  ]);

  const sortie_agent_6 = pick(bilan, [
    'a_definition_moteur', 'a_legende_couleurs', 'a_ordre_boucle',
    'a_schema_generique', 'a_schema_revelation', 'a_cartouche_attribution',
    'b_lexique_html',
    'e_header', 'e_navigation', 'e_footer',
    'audit_agent6'
  ]);

  // 3. Construire le payload
  const payload = {
    candidat_id,
    prenom,
    sortie_agent_1,
    sortie_agent_2,
    sortie_agent_3,
    sortie_agent_4,
    sortie_agent_5,
    sortie_agent_6,
    bilan_html_complet: bilan.bilan_html_complet || ''
  };

  // 4. Appel Claude
  const { result, usage, cost, elapsedMs } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: true,  // OBLIGATOIRE
    candidatId:    candidat_id
  });

  // 5. Valider le rapport
  const report = normalizeReport(result, candidat_id);
  const isConforme = report.statut_global === 'CONFORME';

  // 6. Écrire le rapport dans audit_certificateur + mettre à jour statut_bilan
  await airtableService.upsertEtape1T4Bilan(candidat_id, {
    audit_certificateur: JSON.stringify(report, null, 2),
    statut_bilan:        isConforme ? 'certifie' : 'erreur'
  });

  logger.info('Certificateur completed', {
    candidat_id,
    statut_global:        report.statut_global,
    nb_violations_total:  report.nb_violations_total,
    agents_non_conformes: report.synthese?.agents_non_conformes || [],
    cost_usd:             cost.toFixed(4),
    elapsedMs
  });

  return { report, usage, cost, elapsedMs, isConforme };
}

/**
 * Pick un sous-ensemble de clés d'un objet
 */
function pick(obj, keys) {
  const result = {};
  for (const k of keys) {
    if (k in obj) result[k] = obj[k];
  }
  return result;
}

/**
 * Normalise le rapport pour garantir la structure attendue
 */
function normalizeReport(result, candidat_id) {
  return {
    candidat_id:         result.candidat_id || candidat_id,
    date_certification:  result.date_certification || new Date().toISOString(),
    statut_global:       result.statut_global || (result.violations?.length > 0 ? 'NON_CONFORME' : 'CONFORME'),
    nb_violations_total: result.nb_violations_total ?? (result.violations?.length || 0),
    violations:          Array.isArray(result.violations) ? result.violations : [],
    synthese: {
      agents_conformes:                result.synthese?.agents_conformes        || [],
      agents_non_conformes:            result.synthese?.agents_non_conformes    || [],
      terminologie_obsolete_detectee:  result.synthese?.terminologie_obsolete_detectee ?? false,
      finalite_conforme_au_lexique:    result.synthese?.finalite_conforme_au_lexique ?? true,
      filtre_conforme_au_lexique:      result.synthese?.filtre_conforme_au_lexique ?? true
    }
  };
}

module.exports = {
  runAgentCertificateur,
  pick,
  normalizeReport
};
