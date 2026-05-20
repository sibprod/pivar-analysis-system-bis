// services/etape1/etape1_t3/agentT3_4_syntheseCoeurService.js
// Agent T3_4 — Synthèse cœur (filtre + boucle + finalité + signature)
// Profil-Cognitif v10.7
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et new-prompts/etape1/etape1_t4/etape1_t4_4_synthese_coeur.txt (v1.1)
//
// RÔLE
// ────
// Sous-service de l'orchestrateur T4 — LE CŒUR DOCTRINAL DU BILAN.
// Produit les 4 dimensions cognitives essentielles :
//   • d1 — Filtre cognitif (le COMMENT du candidat capte/lit la situation)
//   • d2 — Boucle cognitive (l'enchaînement Filtre → Mode socle → Modes structurants)
//   • d3 — Finalité (les 3 grandes lignes de POUR QUOI ce moteur tourne)
//   • d4 — Signature cognitive (formulation intégrée — récit d'identité)
//
// PHASE D'EXÉCUTION
// ─────────────────
// Phase 2 séquentielle — exécuté APRÈS Agents 1, 2, 3, 6 (Phase 1).
// Reçoit dans son payload mode_retenu de chaque pilier (extrait par
// orchestratorT4 depuis Agent 3) — sans cela, les modes seraient vides.
//
// Sa sortie d4_signature alimente ensuite Agent 5 (conclusion tripartite).
//
// SORTIE
// ──────
// 8 champs HTML (d1..d4 en double version + audit) :
//   d1_filtre_lab, d1_filtre_cand,
//   d2_boucle_lab, d2_boucle_cand,
//   d3_finalite_lab, d3_finalite_cand,
//   d4_signature (formulation intégrée unique — pas de double version),
//   audit_agent4 (timestamp ISO 8601 UTC)
//
// DOCTRINE APPLIQUÉE
// ──────────────────
//   - Toute la doctrine vit dans le prompt etape1_t4_4_synthese_coeur.txt v1.1
//     (594 lignes) — c'est le prompt le plus dense doctrinalement.
//   - DISTINCTION CRITIQUE filtre vs finalité (§7.1 du prompt) :
//       Le filtre = COMMENT (mode de captation). Verbe-pivot, statique.
//       La finalité = POUR QUOI (résultat observable). Action visée, prospective.
//     Le service ne re-vérifie pas cette distinction (c'est du fond) —
//     mais V5 vérifie que d4_signature ne mélange pas les niveaux.
//   - Anonymisation : payload utilise candidat_id + civilite. d4_signature
//     peut utiliser {prenom} placeholder pour l'introduction du récit.
//   - thinking activé (THINKING.agent_t4_4_synthese_coeur = true).
//   - injectLexique: true — le prompt utilise massivement le lexique
//     mot pour mot (filtre, boucle, finalité, signature, mode, pilier...).
//
// PHASE v10.7 (2026-05-06) — Création initiale

'use strict';

const agentBase = require('../../infrastructure/agentBase');
const logger    = require('../../../utils/logger');

const SERVICE_NAME = 'agent_t4_4_synthese_coeur';
const PROMPT_PATH  = 'etape1/etape1_t4/etape1_t4_4_synthese_coeur.txt';

// ─── Constantes ───────────────────────────────────────────────────────────
const CHAMPS_SORTIE = [
  'd1_filtre_lab', 'd1_filtre_cand',
  'd2_boucle_lab', 'd2_boucle_cand',
  'd3_finalite_lab', 'd3_finalite_cand',
  'd4_signature',
  'audit_agent4'
];

// Longueurs minimales par champ — d4_signature doit être substantiel
// (récit d'identité enrichi v1.1)
const MIN_LENGTH = {
  default:           100,
  d3_finalite_lab:   400,   // 3 grandes lignes ancrées clusters T3
  d3_finalite_cand:  400,
  d4_signature:      500,   // récit intégré enrichi v1.1
  audit_agent4:       19
};

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute Agent T4_4 (Synthèse cœur) pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Object} params.payload  Construit par orchestratorT4.
 *                                 Contient : candidat_id, civilite, chiffres T1,
 *                                            pilier_socle (avec T3 complet),
 *                                            pilier_resistant (si présent),
 *                                            clusters_socle_top3, sequences,
 *                                            filtre, synthese_t2,
 *                                            finalite_grandes_lignes (inputs A3),
 *                                            modes_retenus (injecté par orchestrateur après Phase 1).
 * @returns {Promise<{result: Object, usage: Object, cost: number, elapsedMs: number, thinking: string}>}
 */
async function runAgentT4_4({ candidat_id, payload }) {
  const startTime = Date.now();
  logger.info('Agent T4_4 (Synthèse cœur) starting', { candidat_id });

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

  logger.info('Agent T4_4 done', {
    candidat_id,
    nb_champs:           Object.keys(fields).length,
    filtre_cand_len:     fields.d1_filtre_cand?.length || 0,
    finalite_cand_len:   fields.d3_finalite_cand?.length || 0,
    signature_len:       fields.d4_signature?.length || 0,
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
    throw new Error(`Agent T4_4: payload manquant pour ${candidat_id}`);
  }
  if (!payload.civilite) {
    throw new Error(`Agent T4_4: payload.civilite manquant pour ${candidat_id}`);
  }
  if (!payload.pilier_socle || !payload.pilier_socle.id) {
    throw new Error(`Agent T4_4: payload.pilier_socle manquant ou invalide pour ${candidat_id}`);
  }
  if (!payload.filtre || !payload.filtre.formulation) {
    throw new Error(`Agent T4_4: payload.filtre.formulation manquant pour ${candidat_id}`);
  }
  if (!payload.finalite_grandes_lignes) {
    throw new Error(
      `Agent T4_4: payload.finalite_grandes_lignes manquant pour ${candidat_id} — ` +
      `Algorithme A3 doit avoir tourné dans l'orchestrateur`
    );
  }
  // modes_retenus est optionnel : si absent ou vide, le prompt fonctionnera
  // mais d2_boucle_lab/cand ne pourra pas mentionner les modes par pilier.
  // On warn plutôt que d'échouer.
  if (!payload.modes_retenus || Object.keys(payload.modes_retenus).length === 0) {
    logger.warn(
      'Agent T4_4: payload.modes_retenus absent ou vide — d2_boucle sera incomplet',
      { candidat_id }
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE LA SORTIE CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

function extractFields(result, candidat_id) {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    if ('d1_filtre_lab' in result || 'audit_agent4' in result) return result;
    if (result.fields && typeof result.fields === 'object') return result.fields;
    if (result.output && typeof result.output === 'object') return result.output;
  }
  logger.error('Agent T4_4: format de sortie non reconnu', {
    candidat_id,
    type: Array.isArray(result) ? 'array' : typeof result,
    keys: result && typeof result === 'object' ? Object.keys(result).slice(0, 10) : null
  });
  throw new Error(
    'Agent T4_4: sortie Claude non-objet. Attendu : objet avec ' +
    'd1..d4 (×2 versions sauf d4) + audit_agent4.'
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION STRUCTURELLE DE LA SORTIE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Règles :
 *   V1 — Présence des 8 champs
 *   V2 — Aucun champ vide ou trop court (par champ avec MIN_LENGTH spécifique)
 *   V3 — audit_agent4 ISO 8601
 *   V4 — HTML structuré dans chaque section
 *   V5 — d1_filtre_cand contient la formulation du filtre fournie en payload
 *        (cohérence avec l'algorithme A2 — pas de filtre inventé)
 *   V6 — d4_signature mentionne au moins le pilier socle (cohérence narrative)
 *   V7 — Anti-contamination : pas de termes Étape 2 (ANT/DEC/MET/VUE) ni Étape 3 (A/F)
 */
function validateOutput(fields, candidat_id, payload) {
  const errors = [];

  // V1 — Présence
  for (const champ of CHAMPS_SORTIE) {
    if (!(champ in fields)) errors.push(`V1: champ ${champ} manquant`);
  }
  if (errors.length > 0) {
    throw new Error(`Agent T4_4: ${errors.join(' ; ')}`);
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

  // V3 — audit_agent4 ISO 8601
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(fields.audit_agent4 || '')) {
    errors.push(`V3: audit_agent4 invalide ("${fields.audit_agent4}")`);
  }

  // V4 — HTML structuré
  for (const champ of CHAMPS_SORTIE) {
    if (champ === 'audit_agent4') continue;
    const html = fields[champ] || '';
    if (!/<(h[1-6]|div|p|span|strong|em|ul|ol|li|table)/i.test(html)) {
      errors.push(`V4: champ ${champ} sans HTML structuré`);
    }
  }

  // V5 — Cohérence avec le filtre du payload (pas de filtre inventé)
  // On extrait quelques mots distinctifs de la formulation du filtre
  // et on vérifie qu'au moins une partie significative apparaît dans d1_filtre_cand
  if (payload?.filtre?.formulation) {
    const filtreFormulation = payload.filtre.formulation.toLowerCase();
    // Mots significatifs (>= 5 chars, pas de mots fonction)
    const motsFonction = new Set(['depuis', 'dans', 'pour', 'avec', 'situation', 'cette', 'ainsi']);
    const motsSignificatifs = filtreFormulation
      .replace(/[«»",.;:!?]/g, '')
      .split(/\s+/)
      .filter(m => m.length >= 5 && !motsFonction.has(m))
      .slice(0, 3);  // 3 mots clés à matcher

    const filtreCandLower = (fields.d1_filtre_cand || '').toLowerCase();
    const motsTrouves = motsSignificatifs.filter(m => filtreCandLower.includes(m));

    if (motsSignificatifs.length >= 2 && motsTrouves.length === 0) {
      errors.push(
        `V5: d1_filtre_cand semble ne pas reprendre la formulation du filtre du payload ` +
        `("${payload.filtre.formulation}") — risque de filtre inventé. ` +
        `Mots-clés cherchés : [${motsSignificatifs.join(', ')}], aucun trouvé.`
      );
    }
  }

  // V6 — d4_signature mentionne le pilier socle
  if (payload?.pilier_socle?.id) {
    const signature = fields.d4_signature || '';
    const pilierSocleId = payload.pilier_socle.id;
    const pilierSocleNom = payload.pilier_socle.nom || '';
    // Cohérence : mentionner soit l'ID (P3), soit le nom complet (Analyse, etc.)
    if (!signature.includes(pilierSocleId) && pilierSocleNom &&
        !signature.toLowerCase().includes(pilierSocleNom.toLowerCase())) {
      errors.push(
        `V6: d4_signature ne mentionne ni "${pilierSocleId}" ni "${pilierSocleNom}" ` +
        `(pilier socle). La signature doit être ancrée sur le socle.`
      );
    }
  }

  // V7 — Anti-contamination Étape 2 (ANT/DEC/MET/VUE) et Étape 3 (A/F)
  // Cherche des mentions exactes de ces termes dans les sections
  const TERMES_INTERDITS = [
    /\bANT\b/, /\bDEC\b/, /\bMET\b/, /\bVUE\b/,        // Étape 2 (Profils ANT/DEC/MET/VUE)
    /\b[Tt]ype 9\b/, /\bennéagramme/i                   // Étape 3 (9 types)
  ];
  for (const champ of CHAMPS_SORTIE) {
    if (champ === 'audit_agent4') continue;
    const html = fields[champ] || '';
    for (const regex of TERMES_INTERDITS) {
      if (regex.test(html)) {
        errors.push(
          `V7: contamination — ${champ} contient un terme d'autre étape ` +
          `(${regex.source}). Cf. règle §6.5 du prompt v1.1.`
        );
      }
    }
  }

  if (errors.length > 0) {
    logger.error('Agent T4_4 validation échouée', {
      candidat_id,
      errors_count: errors.length,
      errors
    });
    throw new Error(
      `Agent T4_4: validation structurelle échouée (${errors.length} violations):\n  - ` +
      errors.join('\n  - ')
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runAgentT4_4,
  validatePayload,
  extractFields,
  validateOutput,
  CHAMPS_SORTIE,
  MIN_LENGTH,
  SERVICE_NAME,
  PROMPT_PATH
};
