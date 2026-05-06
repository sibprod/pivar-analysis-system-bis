// services/certificateurs/certificateurLexiqueService.js
// Certificateur Lexique — valide le bilan T4 contre les 15 termes du lexique
// Profil-Cognitif v10.7
//
// ⚠️ AVANT MODIFICATION : lire docs/REFERENTIEL_LEXIQUE_BILAN.md
//                       et new-prompts/certificateurs/certificateur_lexique.txt (v1.0)
//
// RÔLE
// ────
// Service final du pipeline T4. Audit le bilan agrégé produit par les
// 6 sous-agents T4 et vérifie qu'aucun des 15 termes du lexique n'est
// reformulé, paraphrasé, ou utilisé de manière inappropriée.
//
// Produit `audit_certificateur` (un des 66 champs de ETAPE1_T4_BILAN —
// `flda3kTS4tsXzSeyR`) qui résume l'état de conformité du bilan.
//
// PHASE D'EXÉCUTION
// ─────────────────
// Appelé par orchestratorT4 après agrégation des 6 sous-agents et
// validation cross-agents (validerCoherenceBilan).
//
// SORTIE
// ──────
// {
//   verdict: 'CONFORME' | 'CONFORME_AVEC_OBSERVATIONS' | 'NON_CONFORME',
//   score_conformite: 0-100,
//   nb_violations_graves, nb_violations_moyennes, nb_violations_mineures,
//   violations: [...],
//   agents_impactes: [...],
//   recommandation: 'ACCEPTER' | 'RETRY_AGENTS_IMPACTES' | 'ESCALADE_HUMAINE',
//   diagnostic_synthese: '...',
//   audit_certificateur: '<ISO 8601>'
// }
//
// COMPORTEMENT FACE AU NON-CONFORME
// ─────────────────────────────────
// Le service ne fait PAS de retry automatiquement — il retourne juste
// l'audit. C'est l'orchestrateur T4 (ou un futur ré-orchestrateur)
// qui décide :
//   - ACCEPTER → upsert ETAPE1_T4_BILAN avec audit_certificateur
//   - RETRY_AGENTS_IMPACTES → relance ciblée des agents identifiés
//   - ESCALADE_HUMAINE → laisse le statut en PENDING_HUMAN_REVIEW
//
// DOCTRINE APPLIQUÉE
// ──────────────────
//   - Toute la doctrine d'audit vit dans le prompt certificateur_lexique.txt
//     v1.0 (Décision n°35).
//   - injectLexique: true — le prompt utilise le lexique comme RÉFÉRENCE
//     d'audit (les 15 termes officiels avec définitions exactes).
//   - thinking activé (THINKING.certificateur_lexique = true).
//   - max_tokens: 16000 (audit court mais détaillé).
//
// PHASE v10.7 (2026-05-06) — Création initiale (T4 v1)

'use strict';

const agentBase = require('../infrastructure/agentBase');
const logger    = require('../../utils/logger');

const SERVICE_NAME = 'certificateur_lexique';
const PROMPT_PATH  = 'certificateurs/certificateur_lexique.txt';

// ─── Constantes ───────────────────────────────────────────────────────────
const VERDICTS_VALIDES = ['CONFORME', 'CONFORME_AVEC_OBSERVATIONS', 'NON_CONFORME'];
const RECOMMANDATIONS_VALIDES = ['ACCEPTER', 'RETRY_AGENTS_IMPACTES', 'ESCALADE_HUMAINE'];
const SEVERITES_VALIDES = ['GRAVE', 'MOYENNE', 'MINEURE'];

// Mapping champs T4_BILAN → agent qui les produit (utilisé en debug et
// pour validation cohérence agents_impactes)
const CHAMP_TO_AGENT = {};
const PILIERS = ['p1', 'p2', 'p3', 'p4', 'p5'];
for (const p of PILIERS) {
  CHAMP_TO_AGENT[`${p}_entete`] = 'agent_t4_1_architecture';
  CHAMP_TO_AGENT[`${p}_pourquoi_role`] = 'agent_t4_1_architecture';
  CHAMP_TO_AGENT[`${p}_circuits_lab`] = 'agent_t4_2_circuits';
  CHAMP_TO_AGENT[`${p}_circuits_cand`] = 'agent_t4_2_circuits';
  CHAMP_TO_AGENT[`${p}_commentaires_t3`] = 'agent_t4_2_circuits';
  CHAMP_TO_AGENT[`${p}_mode_lab`] = 'agent_t4_3_mode';
  CHAMP_TO_AGENT[`${p}_mode_cand`] = 'agent_t4_3_mode';
}
for (const d of ['d1_filtre_lab', 'd1_filtre_cand', 'd2_boucle_lab', 'd2_boucle_cand',
                 'd3_finalite_lab', 'd3_finalite_cand', 'd4_signature']) {
  CHAMP_TO_AGENT[d] = 'agent_t4_4_synthese_coeur';
}
for (const d of ['d5_couts_lab', 'd5_couts_cand', 'd6_conclusion']) {
  CHAMP_TO_AGENT[d] = 'agent_t4_5_couts_cloture';
}
for (const a of ['a_definition_moteur', 'a_legende_couleurs', 'a_ordre_boucle',
                 'a_schema_generique', 'a_schema_revelation', 'a_cartouche_attribution',
                 'b_lexique_html', 'e_header', 'e_navigation', 'e_footer']) {
  CHAMP_TO_AGENT[a] = 'agent_t4_6_transverses';
}

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Audit le bilan T4 contre les 15 termes du lexique.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Object} params.bilan_t4    Bilan agrégé par orchestratorT4 (62 champs HTML)
 * @returns {Promise<{
 *   verdict: string,
 *   score_conformite: number,
 *   nb_violations_graves: number,
 *   nb_violations_moyennes: number,
 *   nb_violations_mineures: number,
 *   violations: Array,
 *   agents_impactes: Array<string>,
 *   recommandation: string,
 *   diagnostic_synthese: string,
 *   audit_certificateur: string,
 *   usage: Object,
 *   cost: number,
 *   elapsedMs: number
 * }>}
 */
async function runCertificateurLexique({ candidat_id, bilan_t4 }) {
  const startTime = Date.now();
  logger.info('Certificateur Lexique starting', { candidat_id });

  validateInputs({ candidat_id, bilan_t4 });

  // Construire le payload — uniquement les champs HTML pertinents (les
  // 56 contenus + audits sans candidat_id ni metadata).
  const payload = {
    candidat_id,
    bilan_t4: filtrerChampsAuditables(bilan_t4)
  };

  // injectLexique: true — le prompt utilise lexique_reference pour comparer
  // les usages dans le bilan aux définitions officielles.
  const { result, usage, cost, thinking } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId:    candidat_id
  });

  const audit = extractAudit(result, candidat_id);
  validateAudit(audit, candidat_id);

  const elapsedMs = Date.now() - startTime;

  logger.info('Certificateur Lexique done', {
    candidat_id,
    verdict:                audit.verdict,
    score_conformite:       audit.score_conformite,
    nb_graves:              audit.nb_violations_graves,
    nb_moyennes:            audit.nb_violations_moyennes,
    nb_mineures:            audit.nb_violations_mineures,
    agents_impactes:        audit.agents_impactes?.join(',') || 'aucun',
    recommandation:         audit.recommandation,
    cost_usd:               cost.toFixed(4),
    elapsedMs
  });

  return {
    ...audit,
    usage,
    cost,
    elapsedMs,
    thinking
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION DES INPUTS
// ═══════════════════════════════════════════════════════════════════════════

function validateInputs({ candidat_id, bilan_t4 }) {
  if (!candidat_id) {
    throw new Error('Certificateur Lexique: candidat_id manquant');
  }
  if (!bilan_t4 || typeof bilan_t4 !== 'object') {
    throw new Error(`Certificateur Lexique: bilan_t4 manquant pour ${candidat_id}`);
  }
  // Vérifier qu'au moins quelques champs critiques sont présents
  const champsCritiques = ['p3_entete', 'd1_filtre_cand', 'd6_conclusion', 'b_lexique_html'];
  const champsManquants = champsCritiques.filter(c => !bilan_t4[c]);
  if (champsManquants.length > 0) {
    throw new Error(
      `Certificateur Lexique: champs critiques manquants dans bilan_t4 pour ${candidat_id} : ` +
      champsManquants.join(', ')
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FILTRAGE DES CHAMPS AUDITABLES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Filtre les champs du bilan_t4 qui doivent être audités.
 *
 * Exclut :
 *   - candidat_id (identifiant, pas de contenu HTML)
 *   - audit_agent1..6 (timestamps des sous-agents)
 *   - audit_certificateur (n'existe pas encore au moment de l'audit)
 *   - a_schema_generique, a_schema_revelation (placeholders SVG, pas de texte)
 */
function filtrerChampsAuditables(bilan_t4) {
  const exclusions = new Set([
    'candidat_id',
    'audit_agent1', 'audit_agent2', 'audit_agent3', 'audit_agent4', 'audit_agent5', 'audit_agent6',
    'audit_certificateur',
    'a_schema_generique', 'a_schema_revelation'  // placeholders SVG
  ]);
  const filtre = {};
  for (const [k, v] of Object.entries(bilan_t4)) {
    if (!exclusions.has(k) && typeof v === 'string' && v.trim().length > 0) {
      filtre[k] = v;
    }
  }
  return filtre;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE L'AUDIT
// ═══════════════════════════════════════════════════════════════════════════

function extractAudit(result, candidat_id) {
  if (result && typeof result === 'object' && !Array.isArray(result)) {
    if ('verdict' in result && 'audit_certificateur' in result) return result;
    if (result.audit && typeof result.audit === 'object') return result.audit;
    if (result.output && typeof result.output === 'object') return result.output;
  }
  logger.error('Certificateur Lexique: format de sortie non reconnu', {
    candidat_id,
    type: Array.isArray(result) ? 'array' : typeof result,
    keys: result && typeof result === 'object' ? Object.keys(result).slice(0, 10) : null
  });
  throw new Error(
    'Certificateur Lexique: sortie Claude non-objet ou champs absents. ' +
    'Attendu : objet avec verdict, score_conformite, violations, ' +
    'recommandation, audit_certificateur.'
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION STRUCTURELLE DE L'AUDIT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Règles :
 *   V1 — Présence des champs obligatoires
 *   V2 — verdict ∈ VERDICTS_VALIDES
 *   V3 — recommandation ∈ RECOMMANDATIONS_VALIDES
 *   V4 — score_conformite ∈ [0, 100]
 *   V5 — Cohérence verdict ↔ recommandation
 *        (NON_CONFORME → RETRY ou ESCALADE, pas ACCEPTER)
 *   V6 — Cohérence sévérité des violations ↔ score
 *        (≥ 1 GRAVE → score < 80 forcément)
 *   V7 — audit_certificateur ISO 8601
 *   V8 — Si violations existent, chacune est bien structurée
 *   V9 — agents_impactes contient des noms de service valides
 */
function validateAudit(audit, candidat_id) {
  const errors = [];

  const champsObligatoires = [
    'verdict', 'score_conformite',
    'nb_violations_graves', 'nb_violations_moyennes', 'nb_violations_mineures',
    'violations', 'agents_impactes', 'recommandation',
    'diagnostic_synthese', 'audit_certificateur'
  ];
  for (const champ of champsObligatoires) {
    if (!(champ in audit)) errors.push(`V1: champ ${champ} manquant`);
  }
  if (errors.length > 0) {
    throw new Error(`Certificateur: ${errors.join(' ; ')}`);
  }

  // V2 — verdict valide
  if (!VERDICTS_VALIDES.includes(audit.verdict)) {
    errors.push(`V2: verdict invalide "${audit.verdict}" — attendu ∈ {${VERDICTS_VALIDES.join(', ')}}`);
  }

  // V3 — recommandation valide
  if (!RECOMMANDATIONS_VALIDES.includes(audit.recommandation)) {
    errors.push(
      `V3: recommandation invalide "${audit.recommandation}" — ` +
      `attendu ∈ {${RECOMMANDATIONS_VALIDES.join(', ')}}`
    );
  }

  // V4 — score ∈ [0, 100]
  const score = Number(audit.score_conformite);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    errors.push(`V4: score_conformite invalide "${audit.score_conformite}" (attendu 0-100)`);
  }

  // V5 — Cohérence verdict ↔ recommandation
  if (audit.verdict === 'NON_CONFORME' && audit.recommandation === 'ACCEPTER') {
    errors.push(
      `V5: incohérence — verdict NON_CONFORME mais recommandation ACCEPTER. ` +
      `Attendu : RETRY_AGENTS_IMPACTES ou ESCALADE_HUMAINE.`
    );
  }
  if (audit.verdict === 'CONFORME' && audit.recommandation !== 'ACCEPTER') {
    errors.push(
      `V5: incohérence — verdict CONFORME mais recommandation "${audit.recommandation}". ` +
      `Attendu : ACCEPTER.`
    );
  }

  // V6 — Cohérence sévérité ↔ score
  const nbGraves = Number(audit.nb_violations_graves) || 0;
  if (nbGraves >= 1 && score >= 80) {
    errors.push(
      `V6: incohérence — ${nbGraves} violations graves mais score ${score} >= 80. ` +
      `Attendu : score < 80 dès la 1ère violation grave.`
    );
  }
  if (nbGraves === 0 && Number(audit.nb_violations_moyennes) === 0 &&
      Number(audit.nb_violations_mineures) <= 3 && score < 95) {
    // 0 grave, 0 moyenne, ≤ 3 mineures = doit être >= 95
    errors.push(
      `V6: incohérence — 0 grave, 0 moyenne, ≤ 3 mineures mais score ${score} < 95.`
    );
  }

  // V7 — audit_certificateur ISO 8601
  if (typeof audit.audit_certificateur !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(audit.audit_certificateur)) {
    errors.push(`V7: audit_certificateur invalide ("${audit.audit_certificateur}")`);
  }

  // V8 — Structure des violations
  if (!Array.isArray(audit.violations)) {
    errors.push(`V8: violations doit être un array (reçu: ${typeof audit.violations})`);
  } else {
    for (let i = 0; i < audit.violations.length; i++) {
      const v = audit.violations[i];
      if (!v.severite || !SEVERITES_VALIDES.includes(v.severite)) {
        errors.push(`V8 violation[${i}]: severite invalide "${v.severite}"`);
      }
      if (!v.terme_concerne) {
        errors.push(`V8 violation[${i}]: terme_concerne manquant`);
      }
      if (!v.champ_concerne) {
        errors.push(`V8 violation[${i}]: champ_concerne manquant`);
      }
    }
  }

  // V9 — agents_impactes valides
  if (!Array.isArray(audit.agents_impactes)) {
    errors.push(`V9: agents_impactes doit être un array`);
  } else {
    const SERVICES_VALIDES = new Set([
      'agent_t4_1_architecture', 'agent_t4_2_circuits', 'agent_t4_3_mode',
      'agent_t4_4_synthese_coeur', 'agent_t4_5_couts_cloture', 'agent_t4_6_transverses'
    ]);
    for (const a of audit.agents_impactes) {
      if (!SERVICES_VALIDES.has(a)) {
        errors.push(`V9: agent_impacte "${a}" non reconnu`);
      }
    }
  }

  if (errors.length > 0) {
    logger.error('Certificateur Lexique validation échouée', {
      candidat_id,
      errors_count: errors.length,
      errors
    });
    throw new Error(
      `Certificateur Lexique: validation structurelle échouée (${errors.length} violations):\n  - ` +
      errors.join('\n  - ')
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runCertificateurLexique,
  validateInputs,
  filtrerChampsAuditables,
  extractAudit,
  validateAudit,
  CHAMP_TO_AGENT,
  VERDICTS_VALIDES,
  RECOMMANDATIONS_VALIDES,
  SEVERITES_VALIDES,
  SERVICE_NAME,
  PROMPT_PATH
};
