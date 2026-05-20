// services/etape1/etape1_t3/agentT3_2_circuitsService.js
// Agent T3_2 — Circuits par pilier (lab + cand + commentaires_t3)
// Profil-Cognitif v10.7
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et new-prompts/etape1/etape1_t4/etape1_t4_2_circuits.txt (v1.1)
//
// RÔLE
// ────
// Sous-service de l'orchestrateur T4. Pour CHAQUE pilier (P1..P5), produit
// 3 sections HTML :
//   • pX_circuits_lab  : version laboratoire (technique, citations chiffrées T3)
//   • pX_circuits_cand : version candidat (humanisée, lecture cognitive)
//   • pX_commentaires_t3 : compilation des commentaires_attribution T3
//
// PHASE D'EXÉCUTION
// ─────────────────
// Phase 1 parallèle — exécuté simultanément avec Agents 1, 3, 6.
//
// SORTIE
// ──────
// 16 champs HTML (5 piliers × 3 champs + audit_agent2) :
//   p1_circuits_lab, p1_circuits_cand, p1_commentaires_t3,
//   p2_circuits_lab, p2_circuits_cand, p2_commentaires_t3,
//   p3_circuits_lab, p3_circuits_cand, p3_commentaires_t3,
//   p4_circuits_lab, p4_circuits_cand, p4_commentaires_t3,
//   p5_circuits_lab, p5_circuits_cand, p5_commentaires_t3,
//   audit_agent2 (timestamp ISO 8601 UTC)
//
// DOCTRINE APPLIQUÉE
// ──────────────────
//   - Toute la doctrine vit dans le prompt etape1_t4_2_circuits.txt v1.1
//     (Décision n°35).
//   - Le prompt v1.1 enrichit l'encart "lab" avec les commentaires T3 par
//     circuit pour la traçabilité (ajout doctrinal de la session du 04/05).
//   - Anonymisation : payload utilise candidat_id + civilite. Sorties HTML
//     sans prénom rédigé.
//   - thinking activé (THINKING.agent_t4_2_circuits = true) — analyse cognitive
//     non-mécanique.
//   - injectLexique: true — Agent 2 utilise les 15 termes du lexique mot
//     pour mot dans les versions cand.
//
// DENSITÉ DES SORTIES
// ───────────────────
// Le pilier socle (P3 chez Cécile) a typiquement 14 circuits actifs avec
// commentaires_attribution riches → pX_circuits_lab du socle peut faire
// 8-12 Ko. Les piliers fonctionnels avec peu de circuits actifs auront
// des sorties plus courtes.
//
// PHASE v10.7 (2026-05-06) — Création initiale

'use strict';

const agentBase = require('../../infrastructure/agentBase');
const logger    = require('../../../utils/logger');

const SERVICE_NAME = 'agent_t4_2_circuits';
const PROMPT_PATH  = 'etape1/etape1_t4/etape1_t4_2_circuits.txt';

// ─── Constantes ───────────────────────────────────────────────────────────
const PILIERS = ['P1', 'P2', 'P3', 'P4', 'P5'];

// 16 champs en sortie : 5 piliers × 3 sections + audit
const CHAMPS_SORTIE = [];
for (const p of PILIERS) {
  const pp = p.toLowerCase();
  CHAMPS_SORTIE.push(`${pp}_circuits_lab`, `${pp}_circuits_cand`, `${pp}_commentaires_t3`);
}
CHAMPS_SORTIE.push('audit_agent2');

const MIN_HTML_LENGTH = 100;  // section HTML minimale
const MIN_LAB_SOCLE_LENGTH = 500;  // le pilier socle doit être substantiellement décrit

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute Agent T4_2 (Circuits) pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Object} params.payload  Construit par orchestratorT4.
 *                                 Contient : candidat_id, civilite,
 *                                            attributions_par_pilier (avec rôles + T3),
 *                                            t3_lignes_par_pilier (jusqu'à 15 par pilier).
 * @returns {Promise<{result: Object, usage: Object, cost: number, elapsedMs: number, thinking: string}>}
 */
async function runAgentT4_2({ candidat_id, payload }) {
  const startTime = Date.now();
  logger.info('Agent T4_2 (Circuits) starting', { candidat_id });

  validatePayload(payload, candidat_id);

  // Identifier le pilier socle pour la validation V5 (sortie substantielle)
  const pilierSocle = identifierPilierSocle(payload);

  const { result, usage, cost, thinking } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId:    candidat_id
  });

  const fields = extractFields(result, candidat_id);
  validateOutput(fields, candidat_id, pilierSocle);

  const elapsedMs = Date.now() - startTime;

  logger.info('Agent T4_2 done', {
    candidat_id,
    nb_champs:        Object.keys(fields).length,
    pilier_socle:     pilierSocle || 'inconnu',
    socle_lab_len:    pilierSocle ? (fields[`${pilierSocle.toLowerCase()}_circuits_lab`]?.length || 0) : 0,
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
    throw new Error(`Agent T4_2: payload manquant pour ${candidat_id}`);
  }
  if (!payload.civilite) {
    throw new Error(`Agent T4_2: payload.civilite manquant pour ${candidat_id}`);
  }
  if (!payload.attributions_par_pilier) {
    throw new Error(`Agent T4_2: payload.attributions_par_pilier manquant pour ${candidat_id}`);
  }
  if (!payload.t3_lignes_par_pilier) {
    throw new Error(`Agent T4_2: payload.t3_lignes_par_pilier manquant pour ${candidat_id}`);
  }

  // Vérifier qu'au moins un pilier a des lignes T3 (sinon Agent 2 produira du vide)
  const pilierAvecLignes = PILIERS.find(p =>
    payload.t3_lignes_par_pilier[p] && payload.t3_lignes_par_pilier[p].length > 0
  );
  if (!pilierAvecLignes) {
    throw new Error(
      `Agent T4_2: aucun pilier n'a de lignes T3 dans le payload pour ${candidat_id} — ` +
      `vérifier que T3 a tourné avec succès`
    );
  }
}

function identifierPilierSocle(payload) {
  for (const [pilier, attr] of Object.entries(payload.attributions_par_pilier || {})) {
    if (attr && attr.role === 'pilier_socle') return pilier;
  }
  return null;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE LA SORTIE CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

function extractFields(result, candidat_id) {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    if ('p1_circuits_lab' in result || 'audit_agent2' in result) return result;
    if (result.fields && typeof result.fields === 'object') return result.fields;
    if (result.output && typeof result.output === 'object') return result.output;
  }
  logger.error('Agent T4_2: format de sortie non reconnu', {
    candidat_id,
    type: Array.isArray(result) ? 'array' : typeof result,
    keys: result && typeof result === 'object' ? Object.keys(result).slice(0, 10) : null
  });
  throw new Error(
    'Agent T4_2: sortie Claude non-objet ou champs absents. Attendu : objet ' +
    'avec pX_circuits_lab/cand/commentaires_t3 (×5) + audit_agent2.'
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION STRUCTURELLE DE LA SORTIE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Règles :
 *   V1 — Présence des 16 champs
 *   V2 — Aucun champ vide ou anormalement court (>= 100 chars)
 *   V3 — audit_agent2 ISO 8601
 *   V4 — Présence de HTML structuré dans chaque section
 *   V5 — Le pilier socle doit avoir un pX_circuits_lab substantiel (>= 500 chars)
 *        car il a typiquement le plus de circuits actifs
 *   V6 — Cohérence lab vs cand : si lab existe, cand doit exister aussi
 */
function validateOutput(fields, candidat_id, pilierSocle) {
  const errors = [];

  // V1 — Présence
  for (const champ of CHAMPS_SORTIE) {
    if (!(champ in fields)) errors.push(`V1: champ ${champ} manquant`);
  }
  if (errors.length > 0) {
    throw new Error(`Agent T4_2: ${errors.join(' ; ')}`);
  }

  // V2 — Champs non vides et longueur minimale
  for (const champ of CHAMPS_SORTIE) {
    if (champ === 'audit_agent2') continue;
    const val = fields[champ];
    if (typeof val !== 'string' || val.trim().length === 0) {
      errors.push(`V2: champ ${champ} vide ou non-string`);
      continue;
    }
    if (val.length < MIN_HTML_LENGTH) {
      errors.push(
        `V2: champ ${champ} court (${val.length} chars, attendu >= ${MIN_HTML_LENGTH})`
      );
    }
  }

  // V3 — audit_agent2 ISO 8601
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(fields.audit_agent2 || '')) {
    errors.push(`V3: audit_agent2 invalide ("${fields.audit_agent2}")`);
  }

  // V4 — HTML structuré dans chaque section
  for (const champ of CHAMPS_SORTIE) {
    if (champ === 'audit_agent2') continue;
    const html = fields[champ] || '';
    if (!/<(h[1-6]|div|p|span|strong|em|ul|ol|table|li)/i.test(html)) {
      errors.push(`V4: champ ${champ} sans HTML structuré`);
    }
  }

  // V5 — Pilier socle substantiel
  if (pilierSocle) {
    const labSocle = fields[`${pilierSocle.toLowerCase()}_circuits_lab`] || '';
    if (labSocle.length < MIN_LAB_SOCLE_LENGTH) {
      errors.push(
        `V5: ${pilierSocle.toLowerCase()}_circuits_lab (pilier socle) anormalement court ` +
        `(${labSocle.length} chars, attendu >= ${MIN_LAB_SOCLE_LENGTH}). Le pilier socle ` +
        `doit avoir une description riche des circuits actifs.`
      );
    }
  }

  // V6 — Cohérence lab/cand : si l'un est rempli substantiellement, l'autre aussi
  for (const p of PILIERS) {
    const pp = p.toLowerCase();
    const lab = fields[`${pp}_circuits_lab`] || '';
    const cand = fields[`${pp}_circuits_cand`] || '';
    // Tolérance : cand peut être ~30% plus court que lab (humanisation),
    // mais pas vide ni dérisoire si lab est riche.
    if (lab.length > 300 && cand.length < 100) {
      errors.push(
        `V6: ${pp}_circuits_lab=${lab.length} chars mais ${pp}_circuits_cand=${cand.length} chars ` +
        `— incohérence (la version cand doit exister si la version lab est riche)`
      );
    }
  }

  if (errors.length > 0) {
    logger.error('Agent T4_2 validation échouée', {
      candidat_id,
      errors_count: errors.length,
      errors
    });
    throw new Error(
      `Agent T4_2: validation structurelle échouée (${errors.length} violations):\n  - ` +
      errors.join('\n  - ')
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runAgentT4_2,
  validatePayload,
  extractFields,
  validateOutput,
  identifierPilierSocle,
  CHAMPS_SORTIE,
  SERVICE_NAME,
  PROMPT_PATH
};
