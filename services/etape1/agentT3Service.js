// services/etape1/agentT3Service.js
// Agent T3 — Cartographie des circuits cognitifs par pilier
// Profil-Cognitif v10.7
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et docs/CONTRAT_ETAPE1.md (v1.10 prévue)
//
// Rôle :
//   - Lit les 25 lignes ETAPE1_T1 (corrigées par le vérificateur T1) et les
//     25 lignes ETAPE1_T2 (avec synthèse v3.4) du candidat
//   - Appelle l'agent Claude T3 v4.3 en 1 SEUL APPEL pour produire la
//     cartographie des circuits cognitifs activés par pilier
//   - Produit jusqu'à 75 lignes ETAPE1_T3 (15 circuits × 5 piliers, dont
//     seuls les actifs sont émis), avec 12 champs synthétiques par pilier
//     recopiés sur chaque ligne du même pilier
//   - Écrit les lignes en Airtable via writeEtape1T3 (delete+create
//     atomique, géré par airtableService)
//
// DOCTRINE APPLIQUÉE :
//   - Toute la doctrine d'analyse vit dans le prompt etape1_t3.txt v4.3
//     — PAS dans ce code (règle de gouvernance v10.4 — Décision n°35)
//   - Anonymisation : payload utilise candidat_id + civilite uniquement,
//     jamais le prénom (Décision n°4)
//   - thinking activé via claude.js THINKING.agent_t3 = true (Pilier 1)
//   - 1 seul appel Claude (lecture transversale par nature)
//   - Pas de vérificateur T3 (Décision n°32 — autonomie de T3)
//
// LE RÉFÉRENTIEL DES 75 CIRCUITS EST DANS LE PROMPT :
//   Section 9 du prompt etape1_t3.txt v4.3 contient la liste complète des
//   75 circuits (15 par pilier × 5 piliers). PAS d'injection runtime
//   depuis REFERENTIEL_CIRCUITS Airtable — le prompt est self-contained.
//   Cette décision est doctrinale (cohérence avec la version "self-contained
//   v36" de T3) et simplifie le service.
//
// PHASE v10.7 (2026-05-05) — Création du service T3 v4.3 :
//   T3 v4.2 n'existait que comme prompt non plombé. La session du 04-05/05/2026
//   a produit T3 v4.3 (1000 lignes) avec 12 champs synthétiques par pilier
//   (Décision doctrinale "découverte du pilier socle par méthode CIRCUITS"
//   ajoutée à la méthode ÉCART de T2).
//
//   Les 12 champs ajoutés à ETAPE1_T3 (présents et vérifiés en Airtable) :
//     - total_activations_pilier              (number)
//     - score_concentration_pilier            (number)
//     - cluster_dominant_circuits             (multilineText)
//     - cluster_dominant_co_occurrences       (number)
//     - cluster_dominant_signature_unifiee    (checkbox)
//     - cluster_dominant_lecture              (multilineText)
//     - nb_signaux_limbiques_pilier           (number)
//     - questions_avec_signaux_limbiques_pilier (multilineText)
//     - candidature_socle_score               (singleSelect FORTE/MOYENNE/FAIBLE/NULLE)
//     - candidature_socle_raison              (multilineText)
//     - candidature_resistant_score           (singleSelect FORTE/FAIBLE/NULLE)
//     - candidature_resistant_raison          (multilineText)
//
//   Ces 12 champs sont recopiés sur toutes les lignes du même candidat ×
//   même pilier (cohérence cross-lignes intra-pilier).
//
//   Ce que T3 NE FAIT PAS (anti-doctrine) :
//     - N'écrit pas dans ETAPE1_T1 ou ETAPE1_T2 (chasses gardées)
//     - Ne tranche PAS le pilier socle. Il produit `candidature_socle_score`
//       qui aide T4 à arbitrer. La désignation "pilier socle" finale est
//       réservée à T4.
//     - role_pilier reste vide en T3 (T4 le remplira)
//     - Ne met pas à jour statut_analyse_pivar (chasse gardée de
//       l'orchestratorEtape1)

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const SERVICE_NAME = 'agent_t3';
const PROMPT_PATH  = 'etape1/etape1_t3.txt';  // T3 v4.3

// ─── VALEURS VALIDES POUR LES SINGLESELECT (cohérence Airtable v10.7) ────
const VALID_VALUES = {
  candidature_socle_score:     ['FORTE', 'MOYENNE', 'FAIBLE', 'NULLE'],
  candidature_resistant_score: ['FORTE', 'FAIBLE', 'NULLE']
};

const PILIERS = ['P1', 'P2', 'P3', 'P4', 'P5'];
const EXPECTED_T1_LINES = 25;
const EXPECTED_T2_LINES = 25;

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute l'agent T3 pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @returns {Promise<{rows: Array, syntheseParPilier: Object, usage: Object, cost: number, elapsedMs: number}>}
 */
async function runAgentT3({ candidat_id }) {
  const startTime = Date.now();
  logger.info('Agent T3 starting (cartographie circuits par pilier)', { candidat_id });

  // ─── 1. Lire les 25 lignes ETAPE1_T1 ──────────────────────────────────
  const lignesT1 = await airtableService.getEtape1T1(candidat_id);

  if (!lignesT1 || lignesT1.length === 0) {
    throw new Error(
      `Agent T3 — aucune ligne ETAPE1_T1 trouvée pour candidat ${candidat_id}. ` +
      `T1 doit avoir tourné avant T3.`
    );
  }
  if (lignesT1.length < EXPECTED_T1_LINES) {
    logger.warn('Agent T3 — moins de 25 lignes T1 (T1 incomplet ?)', {
      candidat_id,
      count: lignesT1.length,
      expected: EXPECTED_T1_LINES
    });
  }

  // ─── 2. Lire les 25 lignes ETAPE1_T2 ──────────────────────────────────
  const lignesT2 = await airtableService.getEtape1T2(candidat_id);

  if (!lignesT2 || lignesT2.length === 0) {
    throw new Error(
      `Agent T3 — aucune ligne ETAPE1_T2 trouvée pour candidat ${candidat_id}. ` +
      `T2 doit avoir tourné avant T3.`
    );
  }
  if (lignesT2.length < EXPECTED_T2_LINES) {
    logger.warn('Agent T3 — moins de 25 lignes T2 (T2 incomplet ?)', {
      candidat_id,
      count: lignesT2.length,
      expected: EXPECTED_T2_LINES
    });
  }

  // ─── 3. Extraire la synthèse T2 (recopiée sur les 25 lignes — on lit la 1ère) ─
  const syntheseT2 = extractSyntheseT2(lignesT2);
  logger.info('Agent T3 — sources lues', {
    candidat_id,
    count_t1: lignesT1.length,
    count_t2: lignesT2.length,
    directive_t3: syntheseT2.directive_t3,
    flag_quasi_conforme: syntheseT2.flag_profil_quasi_conforme,
    hypothese_socle: syntheseT2.hypothese_pilier_dominant_ecart
  });

  // ─── 4. Lire la civilité depuis VISITEUR (pour accords grammaticaux) ──
  let civilite = await airtableService.getCiviliteCandidat(candidat_id);
  if (!civilite) {
    logger.warn('Agent T3 — civilité non trouvée, fallback sur "Madame"', { candidat_id });
    civilite = 'Madame';
  }

  // ─── 5. Construire le payload Claude ──────────────────────────────────
  const payload = buildPayload(candidat_id, civilite, lignesT1, syntheseT2);

  // ─── 6. Appel Claude via agentBase ────────────────────────────────────
  // injectLexique: false — T3 n'utilise pas le lexique des 15 termes du
  // bilan T4 (réservé aux agents T4 et au certificateur).
  const { result, usage, cost, thinking } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: false,
    candidatId:    candidat_id
  });

  // ─── 7. Extraire et valider la sortie ─────────────────────────────────
  const rows = extractT3Output(result, candidat_id);
  const syntheseParPilier = validateT3Output({ rows, candidat_id });

  // ─── 8. Normaliser les rows pour Airtable ─────────────────────────────
  const normalizedRows = rows.map(row => normalizeRowForAirtable(row, candidat_id));

  // ─── 9. Écrire les lignes en Airtable ─────────────────────────────────
  // writeEtape1T3 fait delete+create atomique (cf. airtableService).
  await airtableService.writeEtape1T3(candidat_id, normalizedRows);

  const elapsedMs = Date.now() - startTime;

  logger.info('Agent T3 produced rows', {
    candidat_id,
    count: normalizedRows.length,
    nb_circuits_par_pilier: PILIERS.map(p => `${p}:${syntheseParPilier[p]?.nb_circuits_actifs_pilier || 0}`).join(' '),
    pilier_avec_socle_FORTE: PILIERS.filter(p => syntheseParPilier[p]?.candidature_socle_score === 'FORTE').join(',') || 'aucun',
    pilier_avec_resistant_FORTE: PILIERS.filter(p => syntheseParPilier[p]?.candidature_resistant_score === 'FORTE').join(',') || 'aucun',
    cost_usd: cost.toFixed(4),
    elapsedMs
  });

  return {
    rows: normalizedRows,
    syntheseParPilier,
    usage,
    cost,
    elapsedMs,
    thinking
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE LA SYNTHÈSE T2 (recopiée sur les 25 lignes — on lit la 1ère)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Les 8 champs de synthèse T2 v3.4 sont recopiés sur les 25 lignes ETAPE1_T2
 * (cohérence cross-lignes). Ce helper lit la première ligne pour les extraire.
 *
 * On valide aussi qu'elles sont identiques sur toutes les lignes (Guard V1.0).
 */
function extractSyntheseT2(lignesT2) {
  if (lignesT2.length === 0) {
    throw new Error('Agent T3 — extractSyntheseT2 appelé sur une liste vide');
  }

  const first = lignesT2[0];
  const synthese = {
    hypothese_pilier_dominant_ecart: first.hypothese_pilier_dominant_ecart || null,
    confiance_socle_par_ecart:       first.confiance_socle_par_ecart || null,
    pourcentage_concentration_ecart: first.pourcentage_concentration_ecart || 0,
    flag_profil_quasi_conforme:      first.flag_profil_quasi_conforme === true,
    directive_t3:                    first.directive_t3 || 'lecture_normale',
    pattern_finalite_pressenti:      first.pattern_finalite_pressenti || '',
    signal_transversal_candidat:     first.signal_transversal_candidat || '',
    nb_conformes_total:              first.nb_conformes_total || 0,
    nb_ecart_total:                  first.nb_ecart_total || 0
  };

  // Guard V1.0 : vérifier que la synthèse est bien identique sur toutes les
  // lignes (sinon T2 a un bug d'écriture cross-lignes).
  const sample = lignesT2[Math.floor(lignesT2.length / 2)];
  if (sample.directive_t3 !== synthese.directive_t3 ||
      sample.hypothese_pilier_dominant_ecart !== synthese.hypothese_pilier_dominant_ecart) {
    throw new Error(
      `Agent T3 — Guard V1.0 : synthèse T2 incohérente entre les 25 lignes. ` +
      `Première ligne directive_t3="${synthese.directive_t3}", ligne du milieu ` +
      `directive_t3="${sample.directive_t3}". Bug probable dans T2 — relancer T2.`
    );
  }

  return synthese;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION DU PAYLOAD CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construit le payload JSON envoyé au prompt T3 v4.3.
 *
 * Les 25 lignes T1 sont projetées avec les champs nécessaires à la
 * cartographie des circuits (Section 6a du prompt T3 v4.3).
 * La synthèse T2 (4 champs critiques) est injectée pour piloter
 * la directive T3 (Section 6b du prompt T3 v4.3).
 *
 * ⚠️ ANONYMISATION : aucun prénom, uniquement candidat_id + civilite
 *   (Décision n°4). civilite sert uniquement aux accords grammaticaux.
 *
 * ⚠️ Le référentiel des 75 circuits N'EST PAS injecté ici : il est embarqué
 *   dans le prompt etape1_t3.txt (Section 9). Décision doctrinale
 *   "self-contained v36".
 */
function buildPayload(candidat_id, civilite, lignesT1, syntheseT2) {
  const lignes_t1 = lignesT1.map(row => ({
    id_question:                     row.id_question || '',
    question_id_protocole:           row.question_id_protocole || '',
    scenario:                        row.scenario || '',
    pilier_demande:                  row.pilier_demande || '',
    verbatim_candidat:               row.verbatim_candidat || '',

    // Champs grille v3.2 (utiles pour la cartographie des circuits)
    pilier_coeur:                    row.pilier_coeur || '',
    outil_cognitif_libelle:          row.outil_cognitif_libelle || '',
    pilier_coeur_analyse:            row.pilier_coeur_analyse || '',
    piliers_traverses:               row.piliers_traverses || '',
    piliers_secondaires:             row.piliers_secondaires || '',
    types_verbatim:                  row.types_verbatim || '',
    attribution_pilier_signal_brut:  row.attribution_pilier_signal_brut || '',

    // Verdict T1 (utile pour la lecture transversale)
    conforme_ecart:                  row.conforme_ecart || '',
    ecart_detail:                    row.ecart_detail || '',
    signal_limbique:                 row.signal_limbique || ''
  }));

  // Synthèse T2 v3.4 — 4 champs critiques + 4 champs informatifs (cf. Section 6b prompt T3)
  const synthese_t2 = {
    directive_t3:                    syntheseT2.directive_t3,
    flag_profil_quasi_conforme:      syntheseT2.flag_profil_quasi_conforme,
    hypothese_pilier_dominant_ecart: syntheseT2.hypothese_pilier_dominant_ecart,
    confiance_socle_par_ecart:       syntheseT2.confiance_socle_par_ecart,
    pourcentage_concentration_ecart: syntheseT2.pourcentage_concentration_ecart,
    pattern_finalite_pressenti:      syntheseT2.pattern_finalite_pressenti,
    signal_transversal_candidat:     syntheseT2.signal_transversal_candidat,
    nb_conformes_total:              syntheseT2.nb_conformes_total,
    nb_ecart_total:                  syntheseT2.nb_ecart_total
  };

  return {
    candidat_id,
    civilite,
    synthese_t2,
    lignes_t1
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE LA SORTIE CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrait l'array des rows de circuits depuis la sortie Claude.
 *
 * Format attendu : array plat d'objets, 1 ligne par circuit actif (≤ 75
 * lignes total — 15 circuits × 5 piliers, dont seuls les actifs).
 *
 * Tolérant à 4 formats : array racine, {rows}, {lignes_t3}, {circuits}.
 */
function extractT3Output(result, candidat_id) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.lignes_t3)) return result.lignes_t3;
  if (Array.isArray(result?.circuits)) return result.circuits;
  if (Array.isArray(result?.t3)) return result.t3;

  logger.error('Agent T3 — format de sortie non reconnu', {
    candidat_id,
    keys: result && typeof result === 'object' ? Object.keys(result) : null,
    type: Array.isArray(result) ? 'array' : typeof result
  });
  throw new Error(
    'Agent T3 — sortie Claude non-array. Attendu : array de circuits actifs ' +
    'ou wrapping {rows|lignes_t3|circuits|t3: [...]}'
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION DOCTRINALE DE LA SORTIE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Valide la cohérence doctrinale de la sortie T3.
 * Lève une erreur explicite si une règle est violée.
 *
 * Règles vérifiées :
 *   V1 — Volumétrie : entre 5 et 75 rows produites (au moins 1 circuit/pilier)
 *   V2 — Champs obligatoires par row : candidat_id, pilier, circuit_id, etc.
 *   V3 — Pilier ∈ {P1..P5}
 *   V4 — Aucun circuit inactif (frequence ≥ 1 et actif = "OUI")
 *   V5 — Cohérence intra-pilier : les 12 champs synthétiques sont identiques
 *        sur toutes les lignes du même pilier
 *   V6 — Valeurs valides singleSelect : candidature_socle_score, candidature_resistant_score
 *   V7 — Cohérence frequence/niveau : HAUT si ≥ 4, MOYEN si 1-3
 *   V8 — Cohérence pour le pilier socle : si candidature_socle_score = FORTE,
 *        cluster_dominant_signature_unifiee = true (Décision doctrinale
 *        04/05/2026 : signature unifiée vs boîte à outils variée)
 *
 * Retourne aussi un dictionnaire `syntheseParPilier` pour les logs.
 */
function validateT3Output({ rows, candidat_id }) {
  const errors = [];

  // V1 — Volumétrie
  if (rows.length < 5) {
    errors.push(
      `V1 Volumétrie: ${rows.length} lignes T3 produites — c'est anormalement bas. ` +
      `Au moins 1 circuit actif par pilier attendu (5 piliers).`
    );
  }
  if (rows.length > 75) {
    errors.push(
      `V1 Volumétrie: ${rows.length} lignes T3 — anormalement élevé. ` +
      `Maximum théorique = 75 (15 circuits × 5 piliers).`
    );
  }

  // V2 — Champs obligatoires + V3 Pilier valide + V4 Actif + V7 Niveau
  const champsObligatoires = [
    'pilier', 'circuit_id', 'circuit_nom',
    'frequence', 'niveau_activation', 'actif',
    'total_activations_pilier', 'score_concentration_pilier',
    'nb_circuits_actifs_pilier',
    'candidature_socle_score', 'candidature_resistant_score'
  ];

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const where = `row[${i}] (${r.pilier || '?'} / ${r.circuit_id || '?'})`;

    // V2 — Champs obligatoires
    for (const champ of champsObligatoires) {
      if (r[champ] === undefined || r[champ] === null || r[champ] === '') {
        errors.push(`V2 ${where}: champ obligatoire manquant ou vide: ${champ}`);
      }
    }

    // V3 — Pilier ∈ {P1..P5}
    if (r.pilier && !PILIERS.includes(r.pilier)) {
      errors.push(`V3 ${where}: pilier invalide: "${r.pilier}" (attendu: P1..P5)`);
    }

    // V4 — Aucun circuit inactif
    if (r.frequence !== undefined && r.frequence < 1) {
      errors.push(`V4 ${where}: frequence < 1 (${r.frequence}) — circuit inactif ne doit pas apparaître`);
    }
    if (r.actif && r.actif !== 'OUI') {
      errors.push(`V4 ${where}: actif="${r.actif}" (attendu: "OUI" — les inactifs ne sont pas émis)`);
    }

    // V6 — Valeurs valides singleSelect
    if (r.candidature_socle_score &&
        !VALID_VALUES.candidature_socle_score.includes(r.candidature_socle_score)) {
      errors.push(
        `V6 ${where}: candidature_socle_score invalide: "${r.candidature_socle_score}" ` +
        `(attendu: ${VALID_VALUES.candidature_socle_score.join('/')})`
      );
    }
    if (r.candidature_resistant_score &&
        !VALID_VALUES.candidature_resistant_score.includes(r.candidature_resistant_score)) {
      errors.push(
        `V6 ${where}: candidature_resistant_score invalide: "${r.candidature_resistant_score}" ` +
        `(attendu: ${VALID_VALUES.candidature_resistant_score.join('/')})`
      );
    }

    // V7 — Cohérence frequence/niveau
    if (r.frequence !== undefined && r.niveau_activation) {
      const freq = Number(r.frequence);
      if (freq >= 4 && r.niveau_activation !== 'HAUT') {
        errors.push(`V7 ${where}: frequence=${freq} ≥ 4 mais niveau_activation="${r.niveau_activation}" (attendu: HAUT)`);
      }
      if (freq >= 1 && freq <= 3 && r.niveau_activation !== 'MOYEN') {
        errors.push(`V7 ${where}: frequence=${freq} ∈ [1,3] mais niveau_activation="${r.niveau_activation}" (attendu: MOYEN)`);
      }
    }
  }

  // V5 — Cohérence intra-pilier des 12 champs synthétiques
  // V8 — Cohérence socle FORTE → signature_unifiee = true
  const champsSynthetiquesParPilier = [
    'total_activations_pilier',
    'score_concentration_pilier',
    'nb_circuits_actifs_pilier',
    'cluster_dominant_circuits',
    'cluster_dominant_co_occurrences',
    'cluster_dominant_signature_unifiee',
    'cluster_dominant_lecture',
    'nb_signaux_limbiques_pilier',
    'questions_avec_signaux_limbiques_pilier',
    'candidature_socle_score',
    'candidature_socle_raison',
    'candidature_resistant_score',
    'candidature_resistant_raison'
  ];

  const syntheseParPilier = {};

  for (const pilier of PILIERS) {
    const rowsPilier = rows.filter(r => r.pilier === pilier);
    if (rowsPilier.length === 0) {
      logger.warn(`Agent T3 — pilier ${pilier}: aucun circuit actif`, { candidat_id });
      continue;
    }

    const ref = rowsPilier[0];
    syntheseParPilier[pilier] = {};
    for (const champ of champsSynthetiquesParPilier) {
      syntheseParPilier[pilier][champ] = ref[champ];
    }

    // V5 — Comparaison sur les autres lignes du pilier
    for (let i = 1; i < rowsPilier.length; i++) {
      const cur = rowsPilier[i];
      for (const champ of champsSynthetiquesParPilier) {
        if (JSON.stringify(cur[champ]) !== JSON.stringify(ref[champ])) {
          errors.push(
            `V5 ${pilier}: champ synthétique "${champ}" diverge entre row[0] (${ref.circuit_id}) ` +
            `et row[${i}] (${cur.circuit_id}). ref="${ref[champ]}" cur="${cur[champ]}"`
          );
          break;  // une divergence par champ par pilier suffit
        }
      }
    }

    // V8 — Cohérence socle FORTE → signature_unifiee = true
    if (ref.candidature_socle_score === 'FORTE' &&
        ref.cluster_dominant_signature_unifiee !== true) {
      errors.push(
        `V8 ${pilier}: candidature_socle_score=FORTE mais ` +
        `cluster_dominant_signature_unifiee=${ref.cluster_dominant_signature_unifiee} ` +
        `(attendu: true — Décision doctrinale "signature unifiée vs boîte à outils")`
      );
    }
  }

  if (errors.length > 0) {
    logger.error('Agent T3 — validation doctrinale échouée', {
      candidat_id,
      errors_count: errors.length,
      errors_preview: errors.slice(0, 5)
    });
    throw new Error(
      `Agent T3 — validation doctrinale échouée (${errors.length} violations):\n  - ${errors.join('\n  - ')}`
    );
  }

  return syntheseParPilier;
}

// ═══════════════════════════════════════════════════════════════════════════
// NORMALISATION POUR AIRTABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalise une row T3 pour l'écriture Airtable.
 * Conforme aux 27 champs ETAPE1_T3 de l'Airtable v10.7.
 *
 * ⚠️ Les 3 champs arrays JSON (activations_franches, activations_nuancees,
 *    clusters_identifies) sont stockés en multilineText en Airtable —
 *    on les sérialise en JSON.stringify (cf. prompt T3 v4.3 Section 16).
 */
function normalizeRowForAirtable(row, candidat_id) {
  return {
    // ─── Identifiants ─────────────────────────────────────────────────
    candidat_id:                            candidat_id,
    pilier:                                 row.pilier || '',
    role_pilier:                            row.role_pilier || '',  // Vide en T3, T4 le remplira
    nb_circuits_actifs_pilier:              String(row.nb_circuits_actifs_pilier || 0),  // multilineText
    circuit_id:                             row.circuit_id || '',
    circuit_nom:                            row.circuit_nom || '',
    frequence:                              String(row.frequence || 0),  // multilineText
    niveau_activation:                      row.niveau_activation || '',
    actif:                                  row.actif || 'OUI',

    // ─── Champs analyse circuit ───────────────────────────────────────
    types_verbatim_detail:                  row.types_verbatim_detail || '',
    activations_franches:                   serializeArray(row.activations_franches),
    activations_nuancees:                   serializeArray(row.activations_nuancees),
    clusters_identifies:                    serializeArray(row.clusters_identifies),
    commentaire_attribution:                row.commentaire_attribution || '',
    type_contenu:                           row.type_contenu || 'ANALYSE',

    // ─── 12 champs synthétiques par pilier (recopiés sur toutes les lignes du pilier) ─
    total_activations_pilier:               row.total_activations_pilier || 0,
    score_concentration_pilier:             row.score_concentration_pilier || 0,
    cluster_dominant_circuits:              row.cluster_dominant_circuits || '',
    cluster_dominant_co_occurrences:        row.cluster_dominant_co_occurrences || 0,
    cluster_dominant_signature_unifiee:     row.cluster_dominant_signature_unifiee === true,
    cluster_dominant_lecture:               row.cluster_dominant_lecture || '',
    nb_signaux_limbiques_pilier:            row.nb_signaux_limbiques_pilier || 0,
    questions_avec_signaux_limbiques_pilier: row.questions_avec_signaux_limbiques_pilier || '',
    candidature_socle_score:                row.candidature_socle_score || 'NULLE',
    candidature_socle_raison:               row.candidature_socle_raison || '',
    candidature_resistant_score:            row.candidature_resistant_score || 'NULLE',
    candidature_resistant_raison:           row.candidature_resistant_raison || ''
  };
}

/**
 * Sérialise un array (activations_franches, activations_nuancees,
 * clusters_identifies) en JSON pour stockage en multilineText Airtable.
 *
 * Format de sortie Claude attendu : array d'objets.
 * Format de stockage Airtable : string JSON.
 */
function serializeArray(value) {
  if (!value) return '[]';
  if (typeof value === 'string') {
    // Déjà sérialisé — vérifier que c'est du JSON valide
    try {
      JSON.parse(value);
      return value;
    } catch {
      return '[]';
    }
  }
  if (Array.isArray(value)) {
    return JSON.stringify(value);
  }
  return '[]';
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runAgentT3,
  // Exports techniques pour tests/debug
  buildPayload,
  extractSyntheseT2,
  extractT3Output,
  validateT3Output,
  normalizeRowForAirtable,
  serializeArray,
  VALID_VALUES,
  PILIERS,
  SERVICE_NAME,
  PROMPT_PATH
};
