// services/etape1/agentT2Service.js
// Agent T2 — Lecture transversale des 25 lignes ETAPE1_T1
// v10.8 (2026-05-06) — extractT2Output adapté au format ARRAY direct du prompt T2 v3.4
// Profil-Cognitif v10.7
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et docs/CONTRAT_ETAPE1.md (v1.10 prévue avec Décisions n°47-49)
//
// Rôle :
//   - Lit les 25 lignes ETAPE1_T1 du candidat (produites par agentT1Service +
//     corrigées par agentT1VerificateurService)
//   - Appelle l'agent Claude T2 v3.4 en 1 SEUL APPEL pour faire la lecture
//     transversale des 25 verbatims
//   - Produit 25 lignes ETAPE1_T2 enrichies des 8 nouveaux champs synthétiques
//     v3.4 recopiés sur chaque ligne (cross-lignes)
//   - Écrit les 25 lignes en Airtable via writeEtape1T2 (delete+create
//     atomique, géré par airtableService)
//
// DOCTRINE APPLIQUÉE :
//   - Toute la doctrine d'analyse vit dans le prompt etape1_t2.txt v3.4
//     — PAS dans ce code (règle de gouvernance v10.4 — Décision n°35)
//   - Anonymisation : payload utilise candidat_id + civilite uniquement,
//     jamais le prénom (Décision n°4)
//   - thinking activé via claude.js THINKING.agent_t2 = true (Pilier 1)
//   - 1 seul appel Claude (lecture transversale par nature, pas par scénario)
//   - Pas de vérificateur T2 (Décision n°32 — autonomie de T2)
//
// PHASE v10.7 (2026-05-05) — Création du service T2 v3.4 :
//   T2 v3.3 n'existait que comme prompt non plombé. La session du 04/05 a
//   produit T2 v3.4 (768 lignes, 8 nouveaux champs synthétiques) après le
//   travail doctrinal sur les 3 candidats référents (Cécile, Rémi, Véronique).
//
//   Les 8 champs ajoutés à ETAPE1_T2 (présents et vérifiés en Airtable) :
//     - hypothese_pilier_dominant_ecart  (singleSelect P1-P5/NULL)
//     - confiance_socle_par_ecart        (singleSelect HAUTE/MOYENNE/FAIBLE)
//     - pourcentage_concentration_ecart  (number)
//     - flag_profil_quasi_conforme       (checkbox)
//     - directive_t3                     (singleSelect)
//     - pattern_finalite_pressenti       (multilineText)
//     - nb_conformes_total               (number)
//     - nb_ecart_total                   (number)
//
//   Ces 8 champs sont recopiés sur les 25 lignes ETAPE1_T2 (redondance
//   acceptée pour faciliter les requêtes T3 et T4 amont).
//
//   Ce que T2 NE FAIT PAS (anti-doctrine) :
//     - Ne tranche PAS le pilier socle. Il produit une "hypothèse" — la
//       terminologie pilier socle est réservée à T4 (Décision doctrinale
//       du 04/05/2026, Section "découverte progressive").
//     - N'écrit pas dans ETAPE1_T1 (chasse gardée du vérificateur T1)
//     - N'écrit pas dans ETAPE1_T3 (chasse gardée d'agentT3Service)
//     - Ne met pas à jour statut_analyse_pivar (chasse gardée de
//       l'orchestratorEtape1)

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const SERVICE_NAME = 'agent_t2';
const PROMPT_PATH  = 'etape1/etape1_t2.txt';  // T2 v3.4

// ─── VALEURS VALIDES POUR LES SINGLESELECT (cohérence Airtable v10.7) ────
const VALID_VALUES = {
  confiance_socle_par_ecart:    ['HAUTE', 'MOYENNE', 'FAIBLE'],
  directive_t3:                 ['lecture_normale', 'lecture_par_concentration_circuits'],
  hypothese_pilier_dominant_ecart: ['P1', 'P2', 'P3', 'P4', 'P5', 'NULL']
};

const EXPECTED_T1_LINES = 25;
const EXPECTED_T2_LINES = 25;

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute l'agent T2 pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @returns {Promise<{rows: Array, synthese: Object, usage: Object, cost: number, elapsedMs: number}>}
 */
async function runAgentT2({ candidat_id }) {
  const startTime = Date.now();
  logger.info('Agent T2 starting (lecture transversale 25 lignes T1)', { candidat_id });

  // ─── 1. Lire les 25 lignes ETAPE1_T1 ──────────────────────────────────
  const lignesT1 = await airtableService.getEtape1T1(candidat_id);

  if (!lignesT1 || lignesT1.length === 0) {
    throw new Error(
      `Agent T2 — aucune ligne ETAPE1_T1 trouvée pour candidat ${candidat_id}. ` +
      `T1 doit avoir tourné avant T2.`
    );
  }
  if (lignesT1.length < EXPECTED_T1_LINES) {
    logger.warn('Agent T2 — moins de 25 lignes T1 (T1 incomplet ?)', {
      candidat_id,
      count: lignesT1.length,
      expected: EXPECTED_T1_LINES
    });
  }

  logger.info('Agent T2 — lignes T1 lues', { candidat_id, count: lignesT1.length });

  // ─── 2. Lire la civilité depuis VISITEUR (pour accords grammaticaux) ──
  let civilite = await airtableService.getCiviliteCandidat(candidat_id);
  if (!civilite) {
    logger.warn('Agent T2 — civilité non trouvée, fallback sur "Madame"', { candidat_id });
    civilite = 'Madame';
  }

  // ─── 3. Construire le payload Claude ──────────────────────────────────
  const payload = buildPayload(candidat_id, civilite, lignesT1);

  // ─── 4. Appel Claude via agentBase ────────────────────────────────────
  // injectLexique: false — T2 n'utilise pas le lexique des 15 termes du
  // bilan T4. Le lexique est injecté uniquement par les agents T4 et le
  // certificateur (cf. PROMPT_BLOCS_LEXIQUE.md).
  const { result, usage, cost, thinking } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: false,
    candidatId:    candidat_id
  });

  // ─── 5. Extraire et valider la sortie ─────────────────────────────────
  const { rows, synthese } = extractT2Output(result, candidat_id);
  validateT2Output({ rows, synthese, lignesT1, candidat_id });

  // ─── 6. Normaliser les rows pour Airtable ─────────────────────────────
  const normalizedRows = rows.map(row => normalizeRowForAirtable(row, synthese, candidat_id));

  // ─── 7. Écrire les 25 lignes en Airtable ──────────────────────────────
  // writeEtape1T2 fait delete+create atomique (cf. airtableService).
  await airtableService.writeEtape1T2(candidat_id, normalizedRows);

  const elapsedMs = Date.now() - startTime;

  logger.info('Agent T2 produced rows', {
    candidat_id,
    count: normalizedRows.length,
    hypothese_socle: synthese.hypothese_pilier_dominant_ecart,
    confiance: synthese.confiance_socle_par_ecart,
    flag_quasi_conforme: synthese.flag_profil_quasi_conforme,
    directive_t3: synthese.directive_t3,
    pattern_finalite: (synthese.pattern_finalite_pressenti || '').slice(0, 80),
    cost_usd: cost.toFixed(4),
    elapsedMs
  });

  return {
    rows: normalizedRows,
    synthese,
    usage,
    cost,
    elapsedMs,
    thinking
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION DU PAYLOAD CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construit le payload JSON envoyé au prompt T2 v3.4.
 *
 * Stratégie de fallback v3.1/v3.2 (Décision n°46) :
 *   - Si pilier_coeur (v3.2) est vide, fallback sur extraction depuis
 *     ecart_detail (regex /P\d/).
 *   - Si pilier_finalite (v3.2) est vide, fallback sur pilier_demande.
 *
 * ⚠️ ANONYMISATION : aucun prénom, uniquement candidat_id + civilite
 *   (Décision n°4). civilite sert uniquement aux accords grammaticaux.
 */
function buildPayload(candidat_id, civilite, lignesT1) {
  const lignes = lignesT1.map(row => {
    // Fallback v3.1/v3.2 sur pilier_coeur
    let pilierCoeur = row.pilier_coeur || '';
    if (!pilierCoeur && row.ecart_detail) {
      const match = row.ecart_detail.match(/P\d/);
      if (match) pilierCoeur = match[0];
    }

    // Fallback v3.1/v3.2 sur pilier_finalite
    const pilierFinalite = row.pilier_finalite || row.pilier_demande || '';

    return {
      id_question:                     row.id_question || '',
      question_id_protocole:           row.question_id_protocole || '',
      scenario:                        row.scenario || '',
      pilier_demande:                  row.pilier_demande || '',
      verbatim_candidat:               row.verbatim_candidat || '',

      // Champs grille v3.2 (avec fallback)
      pilier_finalite:                 pilierFinalite,
      pilier_finalite_libelle:         row.pilier_finalite_libelle || '',
      pilier_coeur:                    pilierCoeur,
      outil_cognitif_libelle:          row.outil_cognitif_libelle || '',
      piliers_traverses:               row.piliers_traverses || '',

      // Lecture cognitive T1
      pilier_coeur_analyse:            row.pilier_coeur_analyse || '',
      types_verbatim:                  row.types_verbatim || '',
      finalite_reponse:                row.finalite_reponse || '',
      attribution_pilier_signal_brut:  row.attribution_pilier_signal_brut || '',
      piliers_secondaires:             row.piliers_secondaires || '',

      // Verdict T1
      conforme_ecart:                  row.conforme_ecart || '',
      ecart_detail:                    row.ecart_detail || '',
      signal_limbique:                 row.signal_limbique || ''
    };
  });

  return {
    candidat_id,
    civilite,
    lignes_t1: lignes
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE LA SORTIE CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrait { rows, synthese } depuis la sortie Claude (déjà parsée par agentBase).
 *
 * ⭐ v10.8 (2026-05-06) — Adaptation au prompt T2 v3.4
 *
 * Le prompt T2 v3.4 demande à Claude de produire un ARRAY JSON direct de 25 lignes,
 * où les 8 champs de synthèse (hypothese_pilier_dominant_ecart, confiance_socle_par_ecart,
 * pourcentage_concentration_ecart, flag_profil_quasi_conforme, directive_t3,
 * pattern_finalite_pressenti, nb_conformes_total, nb_ecart_total) sont RÉPÉTÉS
 * IDENTIQUEMENT sur les 25 lignes (cf. prompt v3.4 ligne 766 : "tous les champs de
 * synthèse candidat sont identiques sur les 25 lignes").
 *
 * Formats acceptés :
 *   1. ARRAY direct [ {ligne1}, {ligne2}, ... ] — format v3.4 — ✅ format actuel
 *   2. OBJET { lignes_t2: [...], synthese: {...} } — format historique pré-v3.4
 *   3. OBJET { rows: [...], synthese: {...} } — format historique
 *   4. OBJET { t2: [...], synthese: {...} } — format historique
 *
 * Pour le format 1, la synthese est extraite depuis la première ligne (les 25 sont
 * identiques sur ces 8 champs par doctrine).
 */
const SYNTHESE_FIELDS = [
  'hypothese_pilier_dominant_ecart',
  'confiance_socle_par_ecart',
  'pourcentage_concentration_ecart',
  'flag_profil_quasi_conforme',
  'directive_t3',
  'pattern_finalite_pressenti',
  'nb_conformes_total',
  'nb_ecart_total'
];

function extractT2Output(result, candidat_id) {
  if (!result) {
    throw new Error('Agent T2 — output Claude vide');
  }

  // ─── Format 1 (v3.4) : ARRAY direct ───────────────────────────────────────
  if (Array.isArray(result)) {
    if (result.length === 0) {
      throw new Error('Agent T2 — array vide retourné par Claude');
    }
    const firstRow = result[0];
    if (!firstRow || typeof firstRow !== 'object') {
      throw new Error('Agent T2 — première ligne invalide (non-objet)');
    }

    // Extraction de la synthèse depuis la première ligne (les 25 sont identiques par doctrine)
    const synthese = {};
    for (const field of SYNTHESE_FIELDS) {
      if (!(field in firstRow)) {
        logger.warn('Agent T2 — champ synthese absent de la première ligne', {
          candidat_id,
          champ: field,
          keys: Object.keys(firstRow)
        });
      }
      synthese[field] = firstRow[field];
    }

    // Validation minimale de la synthèse extraite
    if (synthese.hypothese_pilier_dominant_ecart === undefined ||
        synthese.confiance_socle_par_ecart === undefined ||
        synthese.flag_profil_quasi_conforme === undefined) {
      throw new Error('Agent T2 — synthèse incomplète extraite de la première ligne (champs critiques absents)');
    }

    return { rows: result, synthese };
  }

  // ─── Format 2-4 (historiques) : OBJET avec champ synthese séparé ─────────
  if (typeof result !== 'object') {
    throw new Error('Agent T2 — output Claude non-objet et non-array');
  }

  // Synthèse — attendue à la racine
  const synthese = result.synthese || result.synthese_t2 || null;
  if (!synthese || typeof synthese !== 'object') {
    throw new Error('Agent T2 — champ "synthese" manquant ou invalide dans la sortie Claude');
  }

  // Rows — 3 formats tolérés
  let rows = null;
  if (Array.isArray(result.lignes_t2)) rows = result.lignes_t2;
  else if (Array.isArray(result.rows)) rows = result.rows;
  else if (Array.isArray(result.t2)) rows = result.t2;

  if (!rows) {
    logger.error('Agent T2 — format de rows non reconnu', {
      candidat_id,
      keys: Object.keys(result)
    });
    throw new Error('Agent T2 — champ "lignes_t2" (ou "rows" ou "t2") absent ou non-array');
  }

  return { rows, synthese };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION DOCTRINALE DE LA SORTIE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valide la cohérence doctrinale de la sortie T2.
 * Lève une erreur explicite si une règle est violée.
 *
 * Règles vérifiées :
 *   V1 — Volumétrie : 25 rows produites
 *   V2 — Couverture : chaque id_question de T1 a une row T2 correspondante
 *   V3 — Synthèse complète : 8 champs obligatoires présents et non-null
 *   V4 — Valeurs valides : confiance / directive_t3 / hypothese_pilier
 *   V5 — Cohérence flag/directive : si flag=true alors directive_t3 = par_concentration
 *   V6 — Total : nb_conformes_total + nb_ecart_total = 25
 *   V7 — Pattern finalité : non vide et de longueur raisonnable
 */
function validateT2Output({ rows, synthese, lignesT1, candidat_id }) {
  const errors = [];

  // V1 — Volumétrie
  if (rows.length !== EXPECTED_T2_LINES) {
    errors.push(`V1 Volumétrie: ${rows.length} lignes T2 produites (attendu: ${EXPECTED_T2_LINES})`);
  }

  // V2 — Couverture
  const idsT1 = new Set(lignesT1.map(r => r.id_question));
  const idsT2 = new Set(rows.map(r => r.id_question));
  for (const id of idsT1) {
    if (!idsT2.has(id)) {
      errors.push(`V2 Couverture: id_question ${id} présent en T1 mais absent en T2`);
    }
  }

  // V3 — Champs synthèse obligatoires
  const champsObligatoires = [
    'hypothese_pilier_dominant_ecart',
    'confiance_socle_par_ecart',
    'pourcentage_concentration_ecart',
    'flag_profil_quasi_conforme',
    'directive_t3',
    'pattern_finalite_pressenti',
    'nb_conformes_total',
    'nb_ecart_total'
  ];
  for (const champ of champsObligatoires) {
    if (synthese[champ] === undefined || synthese[champ] === null) {
      errors.push(`V3 Synthèse: champ obligatoire manquant: ${champ}`);
    }
  }

  // V4 — Valeurs valides (singleSelect Airtable)
  if (synthese.confiance_socle_par_ecart &&
      !VALID_VALUES.confiance_socle_par_ecart.includes(synthese.confiance_socle_par_ecart)) {
    errors.push(
      `V4 confiance_socle_par_ecart invalide: "${synthese.confiance_socle_par_ecart}" ` +
      `(attendu: ${VALID_VALUES.confiance_socle_par_ecart.join('/')})`
    );
  }
  if (synthese.directive_t3 &&
      !VALID_VALUES.directive_t3.includes(synthese.directive_t3)) {
    errors.push(
      `V4 directive_t3 invalide: "${synthese.directive_t3}" ` +
      `(attendu: ${VALID_VALUES.directive_t3.join('/')})`
    );
  }
  if (synthese.hypothese_pilier_dominant_ecart &&
      !VALID_VALUES.hypothese_pilier_dominant_ecart.includes(synthese.hypothese_pilier_dominant_ecart)) {
    errors.push(
      `V4 hypothese_pilier_dominant_ecart invalide: "${synthese.hypothese_pilier_dominant_ecart}" ` +
      `(attendu: ${VALID_VALUES.hypothese_pilier_dominant_ecart.join('/')})`
    );
  }

  // V5 — Cohérence interne flag / directive
  // Règle doctrinale : si flag_profil_quasi_conforme=true → directive_t3 doit
  // être lecture_par_concentration_circuits. T2 doit basculer T3 sur la
  // méthode CIRCUITS quand les ÉCART sont dispersés.
  if (synthese.flag_profil_quasi_conforme === true &&
      synthese.directive_t3 !== 'lecture_par_concentration_circuits') {
    errors.push(
      `V5 Cohérence: flag_profil_quasi_conforme=true mais directive_t3="${synthese.directive_t3}" ` +
      `(attendu: lecture_par_concentration_circuits — méthode CIRCUITS)`
    );
  }

  // V6 — Total = 25
  const total = (synthese.nb_conformes_total || 0) + (synthese.nb_ecart_total || 0);
  if (total !== 25) {
    errors.push(
      `V6 Total: nb_conformes_total (${synthese.nb_conformes_total}) + ` +
      `nb_ecart_total (${synthese.nb_ecart_total}) = ${total} (attendu: 25)`
    );
  }

  // V7 — Pattern finalité non vide
  if (typeof synthese.pattern_finalite_pressenti !== 'string' ||
      synthese.pattern_finalite_pressenti.trim().length < 10) {
    errors.push(
      `V7 pattern_finalite_pressenti trop court ou vide: ` +
      `"${synthese.pattern_finalite_pressenti}"`
    );
  }

  if (errors.length > 0) {
    logger.error('Agent T2 — validation doctrinale échouée', { candidat_id, errors });
    throw new Error(
      `Agent T2 — validation doctrinale échouée:\n  - ${errors.join('\n  - ')}`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NORMALISATION POUR AIRTABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalise une row T2 + injecte les 8 champs synthèse recopiés.
 * Conforme aux 23 champs ETAPE1_T2 de l'Airtable v10.7.
 */
function normalizeRowForAirtable(row, synthese, candidat_id) {
  return {
    // ─── Identifiants (5 champs) ──────────────────────────────────────
    candidat_id:                     candidat_id,
    id_question:                     row.id_question || '',
    question_id_protocole:           row.question_id_protocole || '',
    scenario:                        row.scenario || '',
    pilier_demande:                  row.pilier_demande || '',

    // ─── Champs T2 par ligne (verdict T2 + analyse) ───────────────────
    pilier_coeur:                    row.pilier_coeur || '',
    conforme_ecart:                  row.conforme_ecart || '',
    sequence_piliers:                row.sequence_piliers || '',
    analyse_note:                    row.analyse_note || '',
    analyse_ecart_action:            row.analyse_ecart_action || '',
    signal_limbique_detecte:         row.signal_limbique_detecte || '',
    signal_limbique_detail:          row.signal_limbique_detail || '',
    type_contenu:                    row.type_contenu || '',
    stat_pattern_pilier:             row.stat_pattern_pilier || '',

    // ─── Champs de synthèse recopiés sur les 25 lignes (cohérence cross-lignes) ─

    // Champ T2 v3.3 (existant)
    signal_transversal_candidat:     synthese.signal_transversal_candidat || '',

    // 8 nouveaux champs T2 v3.4 (Airtable v10.7)
    hypothese_pilier_dominant_ecart: synthese.hypothese_pilier_dominant_ecart || 'NULL',
    confiance_socle_par_ecart:       synthese.confiance_socle_par_ecart || 'FAIBLE',
    pourcentage_concentration_ecart: synthese.pourcentage_concentration_ecart || 0,
    flag_profil_quasi_conforme:      synthese.flag_profil_quasi_conforme === true,
    directive_t3:                    synthese.directive_t3 || 'lecture_normale',
    pattern_finalite_pressenti:      synthese.pattern_finalite_pressenti || '',
    nb_conformes_total:              synthese.nb_conformes_total || 0,
    nb_ecart_total:                  synthese.nb_ecart_total || 0
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runAgentT2,
  // Exports techniques pour tests/debug
  buildPayload,
  extractT2Output,
  validateT2Output,
  normalizeRowForAirtable,
  VALID_VALUES,
  SERVICE_NAME,
  PROMPT_PATH
};
