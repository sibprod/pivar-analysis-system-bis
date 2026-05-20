// services/etape1/etape1_t4/agentT4_3_modeService.js
// Agent T4_3 — Modes par pilier (pX_mode_lab + pX_mode_cand)
// Profil-Cognitif v10.7
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et new-prompts/etape1/etape1_t4/etape1_t4_3_mode.txt (v1.1)
//
// RÔLE
// ────
// Sous-service de l'orchestrateur T4. Pour CHAQUE pilier (P1..P5), produit
// 2 sections HTML décrivant le **mode cognitif retenu** :
//   • pX_mode_lab  : version laboratoire (avec preuves circuits T3)
//   • pX_mode_cand : version candidat (humanisée, lecture du mode)
//
// CONTRAINTE CRITIQUE
// ───────────────────
// Le prompt v1.1 produit IMPÉRATIVEMENT un titre HTML de la forme :
//   <h3 class="mode-titre">🎯 Mode retenu : "{mode}"</h3>
// dans pX_mode_lab et pX_mode_cand.
//
// Cette structure est OBLIGATOIRE car l'orchestrateur T4
// (orchestratorT4.extraireModesRetenus) extrait `mode_retenu` par regex :
//   /Mode retenu\s*:\s*[«"]([^»"]+)[»"]/i
// puis le réinjecte dans les payloads d'Agents 4 et 5 (Phase 2).
//
// Si le prompt change le format, l'orchestrateur cassera silencieusement
// (modes vides en Phase 2). La validation V5 de ce service vérifie le format.
//
// PHASE D'EXÉCUTION
// ─────────────────
// Phase 1 parallèle — exécuté simultanément avec Agents 1, 2, 6.
// SES SORTIES CONDITIONNENT Agents 4 et 5 (Phase 2).
//
// SORTIE
// ──────
// 11 champs HTML (5 piliers × 2 + audit) :
//   p1_mode_lab, p1_mode_cand,
//   p2_mode_lab, p2_mode_cand,
//   p3_mode_lab, p3_mode_cand,
//   p4_mode_lab, p4_mode_cand,
//   p5_mode_lab, p5_mode_cand,
//   audit_agent3
//
// DOCTRINE APPLIQUÉE
// ──────────────────
//   - Toute la doctrine vit dans le prompt etape1_t4_3_mode.txt v1.1 — y
//     compris la table de matching circuits → mode (35 modes possibles
//     sur les 5 piliers). Décision D3 du 05/05 : pas de REFERENTIEL_MODES
//     externe pour T4 v1.
//   - Anonymisation : payload utilise candidat_id + civilite. Pas de prénom.
//   - thinking activé (THINKING.agent_t4_3_mode = true) — choix du mode
//     demande analyse cognitive non-mécanique.
//   - injectLexique: true.
//
// PHASE v10.7 (2026-05-06) — Création initiale

'use strict';

const agentBase = require('../../infrastructure/agentBase');
const logger    = require('../../../utils/logger');

const SERVICE_NAME = 'agent_t4_3_mode';
const PROMPT_PATH  = 'etape1/etape1_t4/etape1_t4_3_mode.txt';

// ─── Constantes ───────────────────────────────────────────────────────────
const PILIERS = ['P1', 'P2', 'P3', 'P4', 'P5'];

// 11 champs : 5 piliers × 2 (lab + cand) + audit
const CHAMPS_SORTIE = [];
for (const p of PILIERS) {
  const pp = p.toLowerCase();
  CHAMPS_SORTIE.push(`${pp}_mode_lab`, `${pp}_mode_cand`);
}
CHAMPS_SORTIE.push('audit_agent3');

const MIN_HTML_LENGTH = 100;

// Regex critique — DOIT matcher pX_mode_lab pour que extraireModesRetenus
// de l'orchestrateur fonctionne. Aligné sur le format imposé par §4 du prompt v1.1.
const REGEX_MODE_RETENU = /Mode retenu\s*:\s*[«"]([^»"]+)[»"]/i;

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute Agent T4_3 (Modes) pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Object} params.payload  Construit par orchestratorT4.
 *                                 Contient : candidat_id, civilite,
 *                                            attributions_par_pilier (avec circuits_dominants_top5),
 *                                            filtre, synthese_t2.
 * @returns {Promise<{result: Object, usage: Object, cost: number, elapsedMs: number, thinking: string, modesRetenus: Object}>}
 */
async function runAgentT4_3({ candidat_id, payload }) {
  const startTime = Date.now();
  logger.info('Agent T4_3 (Modes) starting', { candidat_id });

  validatePayload(payload, candidat_id);

  const { result, usage, cost, thinking } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId:    candidat_id
  });

  const fields = extractFields(result, candidat_id);
  validateOutput(fields, candidat_id);

  // Extraction proactive des modes — utile pour log + sanity check précoce
  // (l'orchestrateur le refait via extraireModesRetenus, mais c'est mieux
  // de détecter ici si le format imposé n'est pas respecté).
  const modesRetenus = extraireModesRetenus(fields);

  const elapsedMs = Date.now() - startTime;

  logger.info('Agent T4_3 done', {
    candidat_id,
    nb_champs:        Object.keys(fields).length,
    modes_retenus:    Object.entries(modesRetenus)
      .map(([p, m]) => `${p}:${m || '(vide)'}`)
      .join(' | '),
    cost_usd:         cost.toFixed(4),
    elapsedMs
  });

  return {
    result: fields,
    usage,
    cost,
    elapsedMs,
    thinking,
    modesRetenus  // bonus : disponible pour debug/orchestrateur
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION DU PAYLOAD ENTRANT
// ═══════════════════════════════════════════════════════════════════════════

function validatePayload(payload, candidat_id) {
  if (!payload) {
    throw new Error(`Agent T4_3: payload manquant pour ${candidat_id}`);
  }
  if (!payload.civilite) {
    throw new Error(`Agent T4_3: payload.civilite manquant pour ${candidat_id}`);
  }
  if (!payload.attributions_par_pilier) {
    throw new Error(`Agent T4_3: payload.attributions_par_pilier manquant pour ${candidat_id}`);
  }

  // Vérifier qu'au moins un pilier a des circuits dominants (sinon Agent 3
  // ne peut pas déterminer de mode)
  const piliersAvecCircuits = Object.entries(payload.attributions_par_pilier)
    .filter(([_p, attr]) =>
      attr && attr.circuits_dominants_top5 && attr.circuits_dominants_top5.length > 0
    );
  if (piliersAvecCircuits.length === 0) {
    throw new Error(
      `Agent T4_3: aucun pilier n'a de circuits_dominants_top5 dans le payload ` +
      `pour ${candidat_id} — Agent 3 ne pourra pas déterminer les modes`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE LA SORTIE CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

function extractFields(result, candidat_id) {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    if ('p1_mode_lab' in result || 'audit_agent3' in result) return result;
    if (result.fields && typeof result.fields === 'object') return result.fields;
    if (result.output && typeof result.output === 'object') return result.output;
  }
  logger.error('Agent T4_3: format de sortie non reconnu', {
    candidat_id,
    type: Array.isArray(result) ? 'array' : typeof result,
    keys: result && typeof result === 'object' ? Object.keys(result).slice(0, 10) : null
  });
  throw new Error(
    'Agent T4_3: sortie Claude non-objet. Attendu : objet avec ' +
    'pX_mode_lab/cand (×5) + audit_agent3.'
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DES MODES RETENUS (DUPLIQUE LA LOGIQUE DE L'ORCHESTRATEUR)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrait par regex le mode retenu de chaque pX_mode_lab.
 *
 * IMPORTANT : cette fonction duplique exactement la logique de
 * orchestratorT4.extraireModesRetenus pour permettre une détection
 * précoce d'un éventuel changement de format dans le prompt.
 *
 * Si cette fonction échoue à extraire, V5 lèvera une erreur explicite.
 *
 * @returns {Object} { P1: 'mode...', P2: 'mode...', ... } (vide si non trouvé)
 */
function extraireModesRetenus(fields) {
  const modes = {};
  for (const p of PILIERS) {
    const lab = fields[`${p.toLowerCase()}_mode_lab`] || '';
    const match = lab.match(REGEX_MODE_RETENU);
    modes[p] = match ? match[1].trim() : '';
  }
  return modes;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION STRUCTURELLE DE LA SORTIE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Règles :
 *   V1 — Présence des 11 champs
 *   V2 — Aucun champ vide ou anormalement court
 *   V3 — audit_agent3 ISO 8601
 *   V4 — HTML structuré dans chaque section
 *   V5 — CRITIQUE : chaque pX_mode_lab DOIT contenir le pattern
 *        "Mode retenu : "..."" pour que l'orchestrateur puisse extraire mode_retenu
 *   V6 — Cohérence lab/cand : le mode retenu doit être le même dans lab et cand
 *        (sinon Agents 4/5 reçoivent un mode incohérent)
 */
function validateOutput(fields, candidat_id) {
  const errors = [];

  // V1 — Présence
  for (const champ of CHAMPS_SORTIE) {
    if (!(champ in fields)) errors.push(`V1: champ ${champ} manquant`);
  }
  if (errors.length > 0) {
    throw new Error(`Agent T4_3: ${errors.join(' ; ')}`);
  }

  // V2 — Champs non vides et longueur minimale
  for (const champ of CHAMPS_SORTIE) {
    if (champ === 'audit_agent3') continue;
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

  // V3 — audit_agent3 ISO 8601
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(fields.audit_agent3 || '')) {
    errors.push(`V3: audit_agent3 invalide ("${fields.audit_agent3}")`);
  }

  // V4 — HTML structuré
  for (const champ of CHAMPS_SORTIE) {
    if (champ === 'audit_agent3') continue;
    const html = fields[champ] || '';
    if (!/<(h[1-6]|div|p|span|strong|em|ul|ol|li)/i.test(html)) {
      errors.push(`V4: champ ${champ} sans HTML structuré`);
    }
  }

  // V5 — CRITIQUE : Mode retenu extractible dans chaque pX_mode_lab
  for (const p of PILIERS) {
    const pp = p.toLowerCase();
    const lab = fields[`${pp}_mode_lab`] || '';
    const match = lab.match(REGEX_MODE_RETENU);
    if (!match) {
      errors.push(
        `V5 CRITIQUE: ${pp}_mode_lab ne contient pas le pattern obligatoire ` +
        `"Mode retenu : \\"...\\"". L'orchestrateur T4 ne pourra pas extraire ` +
        `mode_retenu pour Agents 4 et 5. Format imposé par §4 du prompt v1.1 : ` +
        `<h3 class="mode-titre">🎯 Mode retenu : "{mode}"</h3>`
      );
    } else if (match[1].trim().length < 3) {
      errors.push(
        `V5: ${pp}_mode_lab a un mode_retenu vide ou trop court ("${match[1]}")`
      );
    }
  }

  // V6 — Cohérence lab/cand : même mode retenu
  for (const p of PILIERS) {
    const pp = p.toLowerCase();
    const matchLab = (fields[`${pp}_mode_lab`] || '').match(REGEX_MODE_RETENU);
    const matchCand = (fields[`${pp}_mode_cand`] || '').match(REGEX_MODE_RETENU);
    if (matchLab && matchCand) {
      const modeLab = matchLab[1].trim();
      const modeCand = matchCand[1].trim();
      if (modeLab !== modeCand) {
        errors.push(
          `V6: ${pp} — mode différent entre lab ("${modeLab}") et cand ("${modeCand}")`
        );
      }
    }
  }

  if (errors.length > 0) {
    logger.error('Agent T4_3 validation échouée', {
      candidat_id,
      errors_count: errors.length,
      errors
    });
    throw new Error(
      `Agent T4_3: validation structurelle échouée (${errors.length} violations):\n  - ` +
      errors.join('\n  - ')
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runAgentT4_3,
  validatePayload,
  extractFields,
  validateOutput,
  extraireModesRetenus,
  CHAMPS_SORTIE,
  REGEX_MODE_RETENU,
  SERVICE_NAME,
  PROMPT_PATH
};
