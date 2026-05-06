// services/etape1/etape1_t4/agentT4_5_coutsClotureService.js
// Agent T4_5 — Coûts cognitifs + Conclusion tripartite
// Profil-Cognitif v10.7
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et new-prompts/etape1/etape1_t4/etape1_t4_5_couts_cloture.txt (v1.1)
//
// RÔLE
// ────
// Sous-service de l'orchestrateur T4 — DERNIER AGENT DU PIPELINE T4.
// Produit :
//   • d5_couts_lab + d5_couts_cand : zones de coût cognitif (où le moteur fatigue)
//   • d6_conclusion : conclusion narrative tripartite (v1.1) — récit de clôture
//     enrichi qui articule filtre + finalité + signature
//
// PHASE D'EXÉCUTION
// ─────────────────
// Phase 2 séquentielle — exécuté APRÈS Agent 4 (Phase 2.A4).
// Reçoit dans son payload :
//   • mode_retenu de chaque pilier (depuis Agent 3, via orchestrateur)
//   • signature_recit_agent4 (depuis Agent 4 — d4_signature)
//   • filtre_cand_agent4 (depuis Agent 4 — d1_filtre_cand)
//   • finalite_lab_agent4 (depuis Agent 4 — d3_finalite_lab)
//
// SORTIE
// ──────
// 4 champs HTML :
//   d5_couts_lab, d5_couts_cand, d6_conclusion,
//   audit_agent5 (timestamp ISO 8601 UTC)
//
// DOCTRINE APPLIQUÉE
// ──────────────────
//   - Toute la doctrine vit dans le prompt etape1_t4_5_couts_cloture.txt v1.1.
//   - d6_conclusion v1.1 est TRIPARTITE (Décision doctrinale 04/05) :
//       Partie 1 — Reprise filtre + signature
//       Partie 2 — Finalité observable (3 grandes lignes)
//       Partie 3 — Invitation à confirmer / poursuivre Étape 2
//   - Anonymisation : payload utilise candidat_id + civilite. d6_conclusion
//     peut utiliser {prenom} dans la salutation.
//   - thinking activé (THINKING.agent_t4_5_couts_cloture = true).
//   - injectLexique: true.
//
// PHASE v10.7 (2026-05-06) — Création initiale

'use strict';

const agentBase = require('../../infrastructure/agentBase');
const logger    = require('../../../utils/logger');

const SERVICE_NAME = 'agent_t4_5_couts_cloture';
const PROMPT_PATH  = 'etape1/etape1_t4/etape1_t4_5_couts_cloture.txt';

// ─── Constantes ───────────────────────────────────────────────────────────
const CHAMPS_SORTIE = [
  'd5_couts_lab',
  'd5_couts_cand',
  'd6_conclusion',
  'audit_agent5'
];

// Longueurs minimales — d6_conclusion tripartite v1.1 doit être substantiel
const MIN_LENGTH = {
  default:        100,
  d5_couts_lab:   200,
  d5_couts_cand:  200,
  d6_conclusion:  600,   // tripartite — narration enrichie v1.1
  audit_agent5:    19
};

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute Agent T4_5 (Coûts/Clôture) pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Object} params.payload  Construit par orchestratorT4 + enrichi
 *                                 entre Phase 2.A4 et Phase 2.A5 :
 *                                   • candidat_id, civilite
 *                                   • attributions_par_pilier, synthese_t2
 *                                   • filtre_formulation, filtre_precision_semantique
 *                                   • pilier_socle, pilier_resistant
 *                                   • modes_retenus (depuis Agent 3)
 *                                   • signature_recit_agent4 (depuis Agent 4)
 *                                   • filtre_cand_agent4
 *                                   • finalite_lab_agent4
 * @returns {Promise<{result: Object, usage: Object, cost: number, elapsedMs: number, thinking: string}>}
 */
async function runAgentT4_5({ candidat_id, payload }) {
  const startTime = Date.now();
  logger.info('Agent T4_5 (Coûts/Clôture) starting', { candidat_id });

  validatePayload(payload, candidat_id);

  const { result, usage, cost, thinking } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId:    candidat_id
  });

  const fields = extractFields(result, candidat_id);
  validateOutput(fields, candidat_id, payload);

  const elapsedMs = Date.now() - startTime;

  logger.info('Agent T4_5 done', {
    candidat_id,
    nb_champs:           Object.keys(fields).length,
    couts_cand_len:      fields.d5_couts_cand?.length || 0,
    conclusion_len:      fields.d6_conclusion?.length || 0,
    cost_usd:            cost.toFixed(4),
    elapsedMs
  });

  return { result: fields, usage, cost, elapsedMs, thinking };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION DU PAYLOAD ENTRANT
// ═══════════════════════════════════════════════════════════════════════════

function validatePayload(payload, candidat_id) {
  if (!payload) {
    throw new Error(`Agent T4_5: payload manquant pour ${candidat_id}`);
  }
  if (!payload.civilite) {
    throw new Error(`Agent T4_5: payload.civilite manquant pour ${candidat_id}`);
  }
  if (!payload.pilier_socle || !payload.pilier_socle.id) {
    throw new Error(`Agent T4_5: payload.pilier_socle manquant pour ${candidat_id}`);
  }
  if (!payload.filtre_formulation) {
    throw new Error(`Agent T4_5: payload.filtre_formulation manquant pour ${candidat_id}`);
  }
  // Sortie d'Agent 4 : essentielle pour produire d6_conclusion tripartite
  if (!payload.signature_recit_agent4) {
    logger.warn(
      `Agent T4_5: payload.signature_recit_agent4 vide — d6_conclusion sera ` +
      `incomplet (Agent 4 doit avoir produit d4_signature avant Agent 5)`,
      { candidat_id }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE LA SORTIE CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

function extractFields(result, candidat_id) {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    if ('d5_couts_lab' in result || 'audit_agent5' in result) return result;
    if (result.fields && typeof result.fields === 'object') return result.fields;
    if (result.output && typeof result.output === 'object') return result.output;
  }
  logger.error('Agent T4_5: format de sortie non reconnu', {
    candidat_id,
    type: Array.isArray(result) ? 'array' : typeof result,
    keys: result && typeof result === 'object' ? Object.keys(result).slice(0, 10) : null
  });
  throw new Error(
    'Agent T4_5: sortie Claude non-objet. Attendu : objet avec ' +
    'd5_couts_lab/cand + d6_conclusion + audit_agent5.'
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION STRUCTURELLE DE LA SORTIE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Règles :
 *   V1 — Présence des 4 champs
 *   V2 — Aucun champ vide ou trop court
 *   V3 — audit_agent5 ISO 8601
 *   V4 — HTML structuré
 *   V5 — Cohérence d5_lab vs d5_cand : mêmes zones de coût mentionnées
 *        (le prompt §8.2 impose "mêmes zones, mêmes chiffres")
 *   V6 — d6_conclusion tripartite : doit avoir 3 sections distinctes
 *        (heuristique : présence d'au moins 3 paragraphes ou divisions)
 *   V7 — Anti-contamination Étape 2/3
 */
function validateOutput(fields, candidat_id, payload) {
  const errors = [];

  // V1 — Présence
  for (const champ of CHAMPS_SORTIE) {
    if (!(champ in fields)) errors.push(`V1: champ ${champ} manquant`);
  }
  if (errors.length > 0) {
    throw new Error(`Agent T4_5: ${errors.join(' ; ')}`);
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
        `V2: champ ${champ} court (${val.length} chars, attendu >= ${minLen})`
      );
    }
  }

  // V3 — audit_agent5 ISO 8601
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(fields.audit_agent5 || '')) {
    errors.push(`V3: audit_agent5 invalide ("${fields.audit_agent5}")`);
  }

  // V4 — HTML structuré
  for (const champ of CHAMPS_SORTIE) {
    if (champ === 'audit_agent5') continue;
    const html = fields[champ] || '';
    if (!/<(h[1-6]|div|p|span|strong|em|ul|ol|li|table)/i.test(html)) {
      errors.push(`V4: champ ${champ} sans HTML structuré`);
    }
  }

  // V5 — Cohérence d5_lab vs d5_cand : mêmes zones mentionnées
  // Heuristique : extraire les noms de piliers cités (P1, P2, P3, P4, P5)
  // et vérifier qu'ils sont identiques dans les 2 versions.
  const labPiliers = (fields.d5_couts_lab || '').match(/\bP[1-5]\b/g) || [];
  const candPiliers = (fields.d5_couts_cand || '').match(/\bP[1-5]\b/g) || [];
  const labSet = new Set(labPiliers);
  const candSet = new Set(candPiliers);

  // Différence symétrique : piliers présents dans l'un mais pas l'autre
  const onlyInLab = [...labSet].filter(p => !candSet.has(p));
  const onlyInCand = [...candSet].filter(p => !labSet.has(p));
  if (onlyInLab.length > 0 || onlyInCand.length > 0) {
    errors.push(
      `V5: d5_couts_lab et d5_couts_cand mentionnent des piliers différents. ` +
      `Lab seul: [${onlyInLab.join(',')}], Cand seul: [${onlyInCand.join(',')}]. ` +
      `Le prompt §8.2 impose "mêmes zones, mêmes chiffres".`
    );
  }

  // V6 — d6_conclusion tripartite (heuristique)
  // On compte les blocs <h3>/<h4> ou <div class="..."> pour détecter
  // une structure tripartite.
  const conclusion = fields.d6_conclusion || '';
  const nbSections = (conclusion.match(/<(h[2-4]|hr)\b/gi) || []).length;
  const nbParagraphes = (conclusion.match(/<p\b/gi) || []).length;
  // Heuristique : au moins 2 sections HTML structurantes ou >= 4 paragraphes
  if (nbSections < 2 && nbParagraphes < 4) {
    errors.push(
      `V6: d6_conclusion semble ne pas être tripartite — ` +
      `seulement ${nbSections} sections H et ${nbParagraphes} paragraphes. ` +
      `Le prompt v1.1 §5.3 impose une structure tripartite (filtre/signature, finalité, invitation).`
    );
  }

  // V7 — Anti-contamination Étape 2/3
  const TERMES_INTERDITS = [
    /\bANT\b/, /\bDEC\b/, /\bMET\b/, /\bVUE\b/,
    /\b[Tt]ype 9\b/, /\bennéagramme/i
  ];
  for (const champ of CHAMPS_SORTIE) {
    if (champ === 'audit_agent5') continue;
    const html = fields[champ] || '';
    for (const regex of TERMES_INTERDITS) {
      if (regex.test(html)) {
        errors.push(
          `V7: contamination — ${champ} contient un terme d'autre étape ` +
          `(${regex.source}).`
        );
      }
    }
  }

  if (errors.length > 0) {
    logger.error('Agent T4_5 validation échouée', {
      candidat_id,
      errors_count: errors.length,
      errors
    });
    throw new Error(
      `Agent T4_5: validation structurelle échouée (${errors.length} violations):\n  - ` +
      errors.join('\n  - ')
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runAgentT4_5,
  validatePayload,
  extractFields,
  validateOutput,
  CHAMPS_SORTIE,
  MIN_LENGTH,
  SERVICE_NAME,
  PROMPT_PATH
};
