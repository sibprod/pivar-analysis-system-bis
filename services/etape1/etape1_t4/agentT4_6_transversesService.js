// services/etape1/etape1_t4/agentT4_6_transversesService.js
// Agent T4_6 — Transverses (lexique HTML, header, navigation, footer, schémas, cartouche)
// Profil-Cognitif v10.7
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et new-prompts/etape1/etape1_t4/etape1_t4_6_transverses.txt (v1.1)
//
// RÔLE
// ────
// Sous-service de l'orchestrateur T4. Produit les **éléments transverses**
// du bilan HTML (sections "a", "b", "e") :
//   • a_definition_moteur, a_legende_couleurs, a_ordre_boucle (3 encarts pédagogiques)
//   • a_schema_generique, a_schema_revelation (2 placeholders SVG)
//   • a_cartouche_attribution (table d'attributions enrichie v1.1, 7 lignes)
//   • b_lexique_html (lexique HTML complet — 15 définitions du protocole)
//   • e_header, e_navigation, e_footer (chrome de la page)
//
// PHASE D'EXÉCUTION
// ─────────────────
// Phase 1 parallèle — exécuté simultanément avec Agents 1, 2, 3 par
// orchestratorT4. Reçoit son payload pré-construit.
//
// SORTIE
// ──────
// 11 champs HTML qui seront agrégés dans ETAPE1_T4_BILAN :
//   a_definition_moteur, a_legende_couleurs, a_ordre_boucle,
//   a_schema_generique, a_schema_revelation, a_cartouche_attribution,
//   b_lexique_html,
//   e_header, e_navigation, e_footer,
//   audit_agent6 (timestamp ISO 8601 UTC)
//
// DOCTRINE APPLIQUÉE
// ──────────────────
//   - Toute la doctrine vit dans le prompt etape1_t4_6_transverses.txt v1.1
//     — PAS dans ce code (Décision n°35).
//   - Anonymisation : le prompt utilise {prenom} placeholder dans e_header.
//     Le frontend remplace lors du rendu.
//   - thinking désactivé pour cet agent (THINKING.agent_t4_6_transverses = false)
//     car la tâche est essentiellement mécanique : remplir des templates.
//   - injectLexique: true — Agent 6 PRODUIT le lexique HTML, donc il a
//     besoin du lexique source pour le formater fidèlement.
//
// PHASE v10.7 (2026-05-06) — Création initiale

'use strict';

const agentBase = require('../../infrastructure/agentBase');
const logger    = require('../../../utils/logger');

const SERVICE_NAME = 'agent_t4_6_transverses';
const PROMPT_PATH  = 'etape1/etape1_t4/etape1_t4_6_transverses.txt';

// ─── Constantes ───────────────────────────────────────────────────────────
const CHAMPS_SORTIE = [
  'a_definition_moteur',
  'a_legende_couleurs',
  'a_ordre_boucle',
  'a_schema_generique',
  'a_schema_revelation',
  'a_cartouche_attribution',
  'b_lexique_html',
  'e_header',
  'e_navigation',
  'e_footer',
  'audit_agent6'
];

// Longueur minimale par champ (heuristique anti-troncature)
// Le lexique HTML est volumineux (15 définitions) donc seuil plus élevé.
const MIN_LENGTH = {
  default:                  80,
  a_cartouche_attribution: 400,    // table 7 lignes
  b_lexique_html:          1500,   // 15 définitions HTML
  a_schema_generique:        20,   // placeholder SVG (peut être court)
  a_schema_revelation:       20,
  audit_agent6:              19    // timestamp ISO 8601 minimum
};

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute Agent T4_6 (Transverses) pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Object} params.payload  Construit par orchestratorT4.
 *                                 Contient : candidat_id, civilite, nb_conformes/ecart/scenarios,
 *                                            pilier_socle, piliers_structurants/fonctionnels,
 *                                            filtre_formulation/precision_semantique,
 *                                            grandes_lignes_finalite, synthese_t2.
 * @returns {Promise<{result: Object, usage: Object, cost: number, elapsedMs: number, thinking: string}>}
 */
async function runAgentT4_6({ candidat_id, payload }) {
  const startTime = Date.now();
  logger.info('Agent T4_6 (Transverses) starting', { candidat_id });

  validatePayload(payload, candidat_id);

  // injectLexique: true — Agent 6 produit b_lexique_html à partir du lexique
  // de référence injecté automatiquement par agentBase.
  const { result, usage, cost, thinking } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId:    candidat_id
  });

  const fields = extractFields(result, candidat_id);
  validateOutput(fields, candidat_id);

  const elapsedMs = Date.now() - startTime;

  logger.info('Agent T4_6 done', {
    candidat_id,
    nb_champs:        Object.keys(fields).length,
    cartouche_len:    fields.a_cartouche_attribution?.length || 0,
    lexique_len:      fields.b_lexique_html?.length || 0,
    cost_usd:         cost.toFixed(4),
    elapsedMs
  });

  return { result: fields, usage, cost, elapsedMs, thinking };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION DU PAYLOAD ENTRANT
// ═══════════════════════════════════════════════════════════════════════════

function validatePayload(payload, candidat_id) {
  if (!payload) {
    throw new Error(`Agent T4_6: payload manquant pour ${candidat_id}`);
  }
  if (!payload.civilite || !['Madame', 'Monsieur'].includes(payload.civilite)) {
    throw new Error(`Agent T4_6: payload.civilite invalide ("${payload.civilite}")`);
  }
  if (!payload.pilier_socle || !payload.pilier_socle.id) {
    throw new Error(`Agent T4_6: payload.pilier_socle manquant pour ${candidat_id}`);
  }
  if (!payload.filtre_formulation) {
    throw new Error(`Agent T4_6: payload.filtre_formulation manquant pour ${candidat_id}`);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE LA SORTIE CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

function extractFields(result, candidat_id) {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    if ('a_definition_moteur' in result || 'audit_agent6' in result) return result;
    if (result.fields && typeof result.fields === 'object') return result.fields;
    if (result.output && typeof result.output === 'object') return result.output;
  }
  logger.error('Agent T4_6: format de sortie non reconnu', {
    candidat_id,
    type: Array.isArray(result) ? 'array' : typeof result,
    keys: result && typeof result === 'object' ? Object.keys(result).slice(0, 10) : null
  });
  throw new Error(
    'Agent T4_6: sortie Claude non-objet ou champs absents. Attendu : objet ' +
    'avec a_*, b_lexique_html, e_*, audit_agent6.'
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION STRUCTURELLE DE LA SORTIE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valide les 11 champs de sortie.
 *
 * Règles :
 *   V1 — Présence des 11 champs
 *   V2 — Aucun champ vide ou anormalement court
 *   V3 — audit_agent6 est ISO 8601
 *   V4 — e_header contient {prenom} placeholder (anonymisation)
 *   V5 — b_lexique_html contient les 15 termes du lexique
 *   V6 — a_cartouche_attribution est une <table> avec 7 lignes attendues
 */
function validateOutput(fields, candidat_id) {
  const errors = [];

  // V1 — Présence
  for (const champ of CHAMPS_SORTIE) {
    if (!(champ in fields)) errors.push(`V1: champ ${champ} manquant`);
  }
  if (errors.length > 0) {
    throw new Error(`Agent T4_6: ${errors.join(' ; ')}`);
  }

  // V2 — Champs non vides et longueur minimale
  for (const champ of CHAMPS_SORTIE) {
    const val = fields[champ];
    if (typeof val !== 'string' || val.trim().length === 0) {
      errors.push(`V2: champ ${champ} vide ou non-string`);
      continue;
    }
    const minLen = MIN_LENGTH[champ] || MIN_LENGTH.default;
    if (val.length < minLen) {
      errors.push(
        `V2: champ ${champ} anormalement court (${val.length} chars, attendu >= ${minLen})`
      );
    }
  }

  // V3 — audit_agent6 ISO 8601
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(fields.audit_agent6 || '')) {
    errors.push(`V3: audit_agent6 invalide ("${fields.audit_agent6}")`);
  }

  // V4 — e_header doit contenir {prenom} placeholder
  // Le prompt §6 (règle d'adressage) impose strictement ce placeholder.
  if (!fields.e_header.includes('{prenom}')) {
    errors.push(
      'V4: e_header ne contient pas le placeholder {prenom} — anonymisation violée ' +
      '(cf. §6 prompt — Décision n°4)'
    );
  }

  // V5 — b_lexique_html contient au moins quelques termes du lexique
  // On vérifie la présence d'au moins 5 mentions de termes structurants
  const termesAttendus = [
    'Pilier', 'socle', 'structurant', 'fonctionnel', 'cycle',
    'Mode', 'Filtre', 'Boucle', 'Finalité', 'Cluster'
  ];
  const lexique = fields.b_lexique_html || '';
  const termesPresents = termesAttendus.filter(t =>
    new RegExp(`\\b${t}`, 'i').test(lexique)
  );
  if (termesPresents.length < 5) {
    errors.push(
      `V5: b_lexique_html semble incomplet — seulement ${termesPresents.length}/10 ` +
      `termes-clés détectés (attendu >= 5)`
    );
  }

  // V6 — a_cartouche_attribution est une table avec ~7 lignes (compte des <tr>)
  const cartouche = fields.a_cartouche_attribution || '';
  const nbTr = (cartouche.match(/<tr[\s>]/gi) || []).length;
  if (!/<table/i.test(cartouche)) {
    errors.push('V6: a_cartouche_attribution ne contient pas de <table>');
  } else if (nbTr < 7) {  // 7 lignes attendues + éventuellement un <tr> de header
    errors.push(
      `V6: a_cartouche_attribution n'a que ${nbTr} <tr> (attendu >= 7 lignes selon prompt v1.1)`
    );
  }

  if (errors.length > 0) {
    logger.error('Agent T4_6 validation échouée', {
      candidat_id,
      errors_count: errors.length,
      errors
    });
    throw new Error(
      `Agent T4_6: validation structurelle échouée (${errors.length} violations):\n  - ` +
      errors.join('\n  - ')
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runAgentT4_6,
  validatePayload,
  extractFields,
  validateOutput,
  CHAMPS_SORTIE,
  SERVICE_NAME,
  PROMPT_PATH
};
