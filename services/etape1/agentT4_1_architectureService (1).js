// services/etape1/etape1_t4/agentT4_1_architectureService.js
// Agent T4_1 — Architecture (en-têtes des 5 piliers + justification du rôle)
// Profil-Cognitif v10.7
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et new-prompts/etape1/etape1_t4/etape1_t4_1_architecture.txt (v1.1)
//
// RÔLE
// ────
// Sous-service de l'orchestrateur T4. Produit l'**architecture HTML** des
// 5 piliers du candidat avec :
//   • un en-tête par pilier (rôle visible, marqueur ★ pour socle, mode retenu)
//   • une justification "pourquoi ce rôle" par pilier (preuves chiffrées T1/T2/T3)
//
// PHASE D'EXÉCUTION
// ─────────────────
// Phase 1 parallèle — exécuté simultanément avec Agents 2, 3, 6 par
// orchestratorT4. Reçoit son payload pré-construit (rôles, attributions par
// pilier, chiffres T1, synthèse T2). Ne lit RIEN d'Airtable directement.
//
// SORTIE
// ──────
// Renvoie 11 champs HTML qui seront agrégés par l'orchestrateur dans
// ETAPE1_T4_BILAN :
//   p1_entete, p1_pourquoi_role,
//   p2_entete, p2_pourquoi_role,
//   p3_entete, p3_pourquoi_role,
//   p4_entete, p4_pourquoi_role,
//   p5_entete, p5_pourquoi_role,
//   audit_agent1 (timestamp ISO 8601 UTC)
//
// DOCTRINE APPLIQUÉE
// ──────────────────
//   - Toute la doctrine d'analyse vit dans le prompt etape1_t4_1_architecture.txt
//     v1.1 — PAS dans ce code (règle de gouvernance v10.4 — Décision n°35).
//   - Le service est de la plomberie : appel Claude + validation structurelle
//     + retour. Aucune logique doctrinale ici.
//   - Anonymisation : le payload contient civilite + candidat_id, JAMAIS de
//     prénom (Décision n°4). Les sorties HTML utilisent {prenom} placeholder.
//   - thinking activé via claude.js THINKING.agent_t4_1_architecture = true.
//   - injectLexique: true — le prompt utilise les 15 termes du lexique
//     mot pour mot (cf. règle d'or §0 du prompt).
//
// PHASE v10.7 (2026-05-06) — Création initiale
// ────────────────────────────────────────────
//   Premier sous-service T4 produit. Pattern de référence pour les 5 autres
//   sous-services T4 (similaire structure : appel Claude + validation +
//   retour, pas d'écriture Airtable directe).

'use strict';

const agentBase = require('../../infrastructure/agentBase');
const logger    = require('../../../utils/logger');

const SERVICE_NAME = 'agent_t4_1_architecture';
const PROMPT_PATH  = 'etape1/etape1_t4/etape1_t4_1_architecture.txt';

// ─── Constantes ───────────────────────────────────────────────────────────
const PILIERS = ['P1', 'P2', 'P3', 'P4', 'P5'];

// Les 11 champs de sortie attendus (cf. §5 du prompt v1.1)
const CHAMPS_SORTIE = [
  'p1_entete', 'p1_pourquoi_role',
  'p2_entete', 'p2_pourquoi_role',
  'p3_entete', 'p3_pourquoi_role',
  'p4_entete', 'p4_pourquoi_role',
  'p5_entete', 'p5_pourquoi_role',
  'audit_agent1'
];

// Longueur minimale acceptable pour un champ HTML (heuristique anti-troncature)
const MIN_HTML_LENGTH = 80;

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute Agent T4_1 (Architecture) pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Object} params.payload  Construit par orchestratorT4.construirePayloadsSubAgents
 *                                 Contient : candidat_id, civilite, nb_conformes, nb_ecart,
 *                                            nb_scenarios, ecart_details, synthese_t2,
 *                                            attributions_par_pilier (avec rôles, modes, T3 par pilier)
 * @returns {Promise<{result: Object, usage: Object, cost: number, elapsedMs: number, thinking: string}>}
 */
async function runAgentT4_1({ candidat_id, payload }) {
  const startTime = Date.now();
  logger.info('Agent T4_1 (Architecture) starting', { candidat_id });

  // ─── 1. Validation rapide du payload reçu ─────────────────────────────
  validatePayload(payload, candidat_id);

  // ─── 2. Appel Claude via agentBase ────────────────────────────────────
  // injectLexique: true — Agent 1 utilise les 15 termes du lexique mot
  // pour mot dans ses justifications (cf. règle d'or du prompt).
  const { result, usage, cost, thinking } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId:    candidat_id
  });

  // ─── 3. Validation structurelle de la sortie ──────────────────────────
  const fields = extractFields(result, candidat_id);
  validateOutput(fields, candidat_id);

  const elapsedMs = Date.now() - startTime;

  logger.info('Agent T4_1 done', {
    candidat_id,
    nb_champs:    Object.keys(fields).length,
    p3_entete_len: fields.p3_entete?.length || 0,
    cost_usd:     cost.toFixed(4),
    elapsedMs
  });

  // L'orchestrateur T4 agrège ces 11 champs dans le bilan global et fait
  // l'upsert ETAPE1_T4_BILAN à la fin de Phase 2. Pas d'écriture Airtable ici.
  return {
    result: fields,
    usage,
    cost,
    elapsedMs,
    thinking
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION DU PAYLOAD ENTRANT
// ═══════════════════════════════════════════════════════════════════════════

function validatePayload(payload, candidat_id) {
  if (!payload) {
    throw new Error(`Agent T4_1: payload manquant pour ${candidat_id}`);
  }
  if (!payload.civilite || !['Madame', 'Monsieur'].includes(payload.civilite)) {
    throw new Error(
      `Agent T4_1: payload.civilite invalide ("${payload.civilite}") — ` +
      `attendu "Madame" ou "Monsieur" (Décision n°4 anonymisation)`
    );
  }
  if (!payload.attributions_par_pilier || typeof payload.attributions_par_pilier !== 'object') {
    throw new Error(
      `Agent T4_1: payload.attributions_par_pilier manquant ou invalide pour ${candidat_id}`
    );
  }
  // Au moins un pilier doit avoir un rôle assigné (sinon A1 a échoué)
  const piliersAvecRole = Object.values(payload.attributions_par_pilier)
    .filter(a => a && a.role);
  if (piliersAvecRole.length === 0) {
    throw new Error(
      `Agent T4_1: aucun pilier n'a de rôle assigné pour ${candidat_id} — ` +
      `vérifier que A1 (calculerRolesPiliers) a tourné dans l'orchestrateur`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE LA SORTIE CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrait l'objet de sortie depuis le retour Claude.
 *
 * Format attendu : objet avec les 11 champs (cf. §5 du prompt v1.1).
 * Tolérant aux wrappings habituels.
 */
function extractFields(result, candidat_id) {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    // Cas idéal — Claude a renvoyé directement l'objet
    if ('p1_entete' in result || 'audit_agent1' in result) {
      return result;
    }
    // Wrapping possible : {fields: {...}} ou {output: {...}}
    if (result.fields && typeof result.fields === 'object') return result.fields;
    if (result.output && typeof result.output === 'object') return result.output;
  }

  logger.error('Agent T4_1: format de sortie non reconnu', {
    candidat_id,
    type: Array.isArray(result) ? 'array' : typeof result,
    keys: result && typeof result === 'object' ? Object.keys(result).slice(0, 10) : null
  });
  throw new Error(
    'Agent T4_1: sortie Claude non-objet ou champs absents. Attendu : objet ' +
    'avec p1_entete..p5_entete + p1_pourquoi_role..p5_pourquoi_role + audit_agent1.'
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION STRUCTURELLE DE LA SORTIE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valide que la sortie contient bien les 11 champs attendus, non vides,
 * non tronqués, et que les invariants doctrinaux sont respectés.
 *
 * Règles vérifiées :
 *   V1 — Présence des 11 champs
 *   V2 — Aucun champ vide ou anormalement court (< 80 caractères pour HTML)
 *   V3 — audit_agent1 est un timestamp ISO 8601 plausible
 *   V4 — Anonymisation : pas de prénom en clair (best-effort regex)
 *   V5 — Marqueur socle ★ présent dans au moins un en-tête (cf. §6.4 prompt)
 *   V6 — Présence du HTML attendu (au moins une balise <h ou <div)
 */
function validateOutput(fields, candidat_id) {
  const errors = [];

  // V1 — Présence des 11 champs
  for (const champ of CHAMPS_SORTIE) {
    if (!(champ in fields)) {
      errors.push(`V1: champ ${champ} manquant`);
    }
  }
  if (errors.length > 0) {
    logger.error('Agent T4_1 validation V1 échouée', { candidat_id, errors });
    throw new Error(`Agent T4_1: ${errors.join(' ; ')}`);
  }

  // V2 — Champs non vides et non tronqués
  for (const champ of CHAMPS_SORTIE) {
    if (champ === 'audit_agent1') continue;  // traité en V3
    const val = fields[champ];
    if (typeof val !== 'string' || val.trim().length === 0) {
      errors.push(`V2: champ ${champ} vide ou non-string`);
    } else if (val.length < MIN_HTML_LENGTH) {
      errors.push(
        `V2: champ ${champ} anormalement court (${val.length} chars, attendu >= ${MIN_HTML_LENGTH})`
      );
    }
  }

  // V3 — audit_agent1 est un timestamp ISO 8601
  const audit = fields.audit_agent1;
  if (typeof audit !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(audit)) {
    errors.push(`V3: audit_agent1 n'est pas un timestamp ISO 8601 ("${audit}")`);
  }

  // V4 — Anonymisation : pas de prénom en clair (best-effort)
  // On cherche dans les champs e_header/p3_entete des patterns suspects type
  // "Bonjour <Mot Capitalisé>" ou "<h1>Mot Capitalisé</h1>" sans placeholder
  const champsHumains = ['p3_entete', 'p3_pourquoi_role'];
  const prenomsSuspects = [];
  for (const champ of champsHumains) {
    const html = fields[champ] || '';
    // Cherche un mot capitalisé seul dans une balise (en excluant les
    // termes du protocole connus)
    const TERMES_LEGITIMES = ['Pilier', 'Mode', 'Cycle', 'Analyse', 'Tri', 'Collecte', 'Création', 'Mise', 'Pourquoi'];
    const matches = html.match(/<h[1-3][^>]*>\s*([A-Z][a-zà-ÿ]{2,})\s*</g) || [];
    for (const m of matches) {
      const prenom = m.match(/>\s*([A-Z][a-zà-ÿ]{2,})/)?.[1];
      if (prenom && !TERMES_LEGITIMES.includes(prenom) && !html.includes('{prenom}')) {
        prenomsSuspects.push(`${champ}: "${prenom}"`);
      }
    }
  }
  if (prenomsSuspects.length > 0) {
    logger.warn('Agent T4_1 V4: prénoms potentiellement en clair', {
      candidat_id,
      prenoms_suspects: prenomsSuspects
    });
    // Warn seulement, pas d'erreur — la détection est imparfaite
  }

  // V5 — Marqueur socle ★ présent dans au moins un en-tête
  const tousEntetes = PILIERS.map(p => fields[`${p.toLowerCase()}_entete`] || '').join(' ');
  if (!tousEntetes.includes('★')) {
    errors.push(
      'V5: marqueur ★ absent de tous les en-têtes — le pilier socle doit être marqué (cf. §6.4 prompt)'
    );
  }

  // V6 — Présence de HTML structuré
  for (const champ of CHAMPS_SORTIE) {
    if (champ === 'audit_agent1') continue;
    const html = fields[champ] || '';
    if (!/<(h[1-6]|div|p|span|strong|em|ul|ol|table)/i.test(html)) {
      errors.push(`V6: champ ${champ} ne contient pas de HTML structuré`);
    }
  }

  if (errors.length > 0) {
    logger.error('Agent T4_1 validation échouée', {
      candidat_id,
      errors_count: errors.length,
      errors
    });
    throw new Error(
      `Agent T4_1: validation structurelle échouée (${errors.length} violations):\n  - ` +
      errors.join('\n  - ')
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runAgentT4_1,
  // Exports techniques pour tests/debug
  validatePayload,
  extractFields,
  validateOutput,
  CHAMPS_SORTIE,
  SERVICE_NAME,
  PROMPT_PATH
};
