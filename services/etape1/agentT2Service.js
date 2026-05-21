// services/etape1/agentT2Service.js
// Agent T2 — ÉTAPE 2 (Circuits cognitifs) v10.7
// Profil-Cognitif — Architecture v10.7 (3 étapes : 1.1 / 1 / 2 / 3)
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2+)
//                       et le prompt prompts/etape1/etape1_t2.txt (v2.0)
//
// ───────────────────────────────────────────────────────────────────────────
// CONTEXTE DOCTRINAL — Refonte v10.7 (mai 2026)
// ───────────────────────────────────────────────────────────────────────────
//
// L'ancien T2 (synthèse écart/conforme) est SUPPRIMÉ doctrinalement.
// L'étape 1.1 a déjà posé les bases solides ; T1 produit l'analyse cognitive
// des 25 lignes. L'étape 2 (ex-T3 circuits) est entièrement refondue.
//
// Architecture v10.7 :
//   - étape 1.1 : lecture cognitive amont (prompt_etape1, inchangé)
//   - étape 1   : analyse 25 lignes (T1, inchangé)
//   - étape 2   : circuits cognitifs (T2 nouveau, ce service)
//   - étape 3   : 6 sous-agents (ex-T4, non concerné)
//
// ───────────────────────────────────────────────────────────────────────────
// RÔLE DU SERVICE
// ───────────────────────────────────────────────────────────────────────────
//
// Pour CHAQUE candidat (1 appel Claude unique) :
//
//   1. Lit les 25 lignes ETAPE1_T1 (analyse cognitive) du candidat
//   2. Lit les 25 lignes RESPONSES (réponses brutes + 6 champs cog_*) du candidat
//   3. Lit les 75 circuits officiels (REFERENTIEL_CIRCUITS)
//   4. Lit les circuits ad hoc existants par pilier (REFERENTIEL_CIRCUITS_CANDIDATS,
//      statut EN_ATTENTE) — pour éviter les doublons
//   5. Appelle Claude (1 appel) avec le prompt etape1_t2.txt v2.0
//   6. Reçoit en sortie :
//      - `rows` : 5 à 75 lignes ETAPE1_T2 (1 par circuit × pilier × candidat)
//      - `circuits_ad_hoc_proposes` : 0 à N circuits ad hoc créés par l'agent
//   7. Écrit les rows en Airtable (writeEtape1T2 — delete+create atomique)
//   8. Pour chaque circuit ad hoc proposé :
//      - Si un ad hoc EN_ATTENTE avec le même nom_propose existe déjà dans
//        REFERENTIEL_CIRCUITS_CANDIDATS → incrémente occurrences + ajoute le
//        candidat_id dans candidats_concernes (upsert)
//      - Sinon → crée un nouveau record EN_ATTENTE
//   9. (Optionnel) Si un ad hoc atteint occurrences >= 3 dans le même pilier
//      principal → log un signal de promotion possible (l'arbitrage reste
//      manuel, écrit par CTO dans Airtable)
//
// ───────────────────────────────────────────────────────────────────────────
// DOCTRINE DES 4 PASSES (Option B validée 20/05/2026)
// ───────────────────────────────────────────────────────────────────────────
//
// Toute la doctrine est dans le prompt etape1_t2.txt v2.0. Le service
// se contente d'orchestrer les lectures, l'appel Claude, et les écritures.
//
//   PASSE 1 — Cadrage doctrinal (cog_pilier_gouverne/sortie/commentaires,
//             cog_resultat_vise, cog_comprend, pilier_coeur, pilier_coeur_analyse,
//             outil_cognitif_libelle, piliers_secondaires)
//   PASSE 2 — Lecture séquentielle des gestes (cog_outils_mobilises avec
//             flèches → en source primaire ; types_verbatim en complément)
//   PASSE 3 — Attribution :
//             3.A — Match franc dans les 15 circuits du pilier annoncé
//             3.B — Sinon, création circuit ad hoc rigoureux dans le pilier
//                   d'origine (8 règles naming dans le prompt)
//             3.C — Construction du `circuit_personnalise` (4 ingrédients)
//   PASSE 4 — Synthèse par pilier (12 champs synthétiques, identique v4.3)
//
// (La PASSE 4 transverse cross-pilier de la v1 du brief a été SUPPRIMÉE
//  doctrinalement le 20/05 — Option B validée : sur 15 attributions de
//  test, 1 seul cas l'aurait utilisée.)
//
// ───────────────────────────────────────────────────────────────────────────
// RÈGLES DURES NON NÉGOCIABLES (rappelées ici, appliquées par le prompt)
// ───────────────────────────────────────────────────────────────────────────
//
//   - Le pilier d'attribution vient de cog_outils_mobilises / types_verbatim.
//     L'étape 2 ne réattribue JAMAIS un pilier.
//   - Le circuit_personnalise commence TOUJOURS par le nom du circuit officiel
//     ou ad hoc attribué.
//   - Tout circuit ad hoc créé en PASSE 3.B doit être écrit dans
//     REFERENTIEL_CIRCUITS_CANDIDATS (mission de veille obligatoire).
//
// ───────────────────────────────────────────────────────────────────────────
// CE QUE T2 NE FAIT PAS (anti-doctrine)
// ───────────────────────────────────────────────────────────────────────────
//
//   - N'écrit pas dans ETAPE1_T1 ou RESPONSES (chasses gardées)
//   - Ne remplit pas `role_pilier` (chasse gardée de l'étape 3)
//   - Ne met pas à jour statut_analyse_pivar (chasse gardée de
//     l'orchestratorEtape1)
//   - Ne tranche pas le pilier socle — produit candidature_socle_score qui
//     aide l'étape 3 à arbitrer
//   - Ne promeut PAS automatiquement un circuit ad hoc en officiel (la
//     promotion vers REFERENTIEL_CIRCUITS reste manuelle — l'arbitrage
//     humain est doctrinal)
//
// ───────────────────────────────────────────────────────────────────────────

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const SERVICE_NAME = 'agent_t2';
const PROMPT_PATH  = 'etape1/etape1_t2.txt';  // étape 2 circuits v2.0

// ─── VALEURS VALIDES POUR LES SINGLESELECT (cohérence Airtable v10.7) ────
const VALID_VALUES = {
  candidature_socle_score:     ['FORTE', 'MOYENNE', 'FAIBLE', 'NULLE'],
  candidature_resistant_score: ['FORTE', 'FAIBLE', 'NULLE'],
  niveau_activation:           ['HAUT', 'MOYEN'],
  actif:                       ['OUI', 'NON'],
  pilier:                      ['P1', 'P2', 'P3', 'P4', 'P5']
};

// Seuil de promotion automatique signalée (l'arbitrage reste manuel)
const PROMOTION_OCCURRENCE_THRESHOLD_SAME_PILLAR = 3;
const PROMOTION_OCCURRENCE_THRESHOLD_MULTI_PILLAR = 5;

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute l'agent étape 2 (circuits cognitifs) pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {string} [params.session_id]  Optionnel — si fourni, évite une lecture VISITEUR
 * @returns {Promise<{
 *   rows: Array,
 *   circuits_ad_hoc_proposes: Array,
 *   stats: Object,
 *   usage: Object,
 *   cost: number,
 *   elapsedMs: number
 * }>}
 */
async function runAgentT2({ candidat_id, session_id = null }) {
  const startTime = Date.now();
  logger.info('Agent étape 2 (circuits) starting', { candidat_id });

  // ─── 1. Récupérer la civilité (anonymisation Décision n°4) ─────────────
  const civilite = await airtableService.getCiviliteCandidat(candidat_id);

  // ─── 2. Lire les 25 lignes ETAPE1_T1 ──────────────────────────────────
  const lignesT1 = await airtableService.getEtape1T1(candidat_id);
  if (!lignesT1 || lignesT1.length === 0) {
    throw new Error(
      `Agent T2 — aucune ligne ETAPE1_T1 pour ${candidat_id}. ` +
      `T1 doit avoir tourné avant T2.`
    );
  }
  if (lignesT1.length < 25) {
    logger.warn('Agent T2 — moins de 25 lignes T1 (T1 incomplet ?)', {
      candidat_id, count: lignesT1.length
    });
  }

  // ─── 3. Résoudre session_id depuis T1 si pas fourni ───────────────────
  if (!session_id) {
    session_id = lignesT1[0].session_ID || lignesT1[0].session_id || null;
    if (!session_id) {
      throw new Error(
        `Agent T2 — session_ID introuvable dans ETAPE1_T1 pour ${candidat_id}. ` +
        `Impossible de joindre avec RESPONSES.`
      );
    }
  }

  // ─── 4. Lire les 25 lignes RESPONSES (avec les 6 champs cog_*) ─────────
  const responses = await airtableService.getResponsesBySession(session_id);
  if (!responses || responses.length === 0) {
    throw new Error(
      `Agent T2 — aucune ligne RESPONSES pour session ${session_id}. ` +
      `Incohérence : T1 existe mais pas RESPONSES.`
    );
  }

  // ─── 5. Lire le référentiel des 75 circuits officiels ─────────────────
  const referentiel75 = await airtableService.getReferentielCircuits();
  if (!referentiel75 || referentiel75.length === 0) {
    throw new Error(
      'Agent T2 — REFERENTIEL_CIRCUITS vide ou inaccessible. Setup Airtable incomplet.'
    );
  }
  if (referentiel75.length !== 75) {
    logger.warn('Agent T2 — REFERENTIEL_CIRCUITS ne contient pas 75 records', {
      count: referentiel75.length
    });
  }

  // ─── 6. Lire les circuits ad hoc existants EN_ATTENTE (par pilier) ─────
  const adHocExistants = await airtableService.getCircuitsAdHocByStatut('EN_ATTENTE');

  // ─── 7. Construire le payload ─────────────────────────────────────────
  const payload = buildPayload({
    candidat_id,
    civilite,
    lignesT1,
    responses,
    referentiel75,
    adHocExistants
  });

  // ─── 8. Appeler Claude (1 seul appel) ─────────────────────────────────
  const { result, usage, cost, elapsedMs: callMs } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: false,  // le prompt est self-contained
    candidatId:    candidat_id
  });

  // ─── 9. Extraire et valider la sortie ─────────────────────────────────
  const rows = extractRows(result);
  const circuitsAdHocProposes = extractCircuitsAdHocProposes(result);

  validateT2Output(rows, candidat_id);

  // ─── 10. Normaliser les rows pour Airtable ────────────────────────────
  const normalizedRows = rows.map(row => normalizeRowForAirtable(row, candidat_id, session_id));

  // ─── 11. Écrire ETAPE1_T2 (delete + create atomique) ──────────────────
  await airtableService.writeEtape1T2(candidat_id, normalizedRows);

  // ─── 12. Mission de veille — écrire les circuits ad hoc proposés ──────
  const adHocStats = await processCircuitsAdHoc({
    candidat_id,
    circuitsAdHocProposes
  });

  // ─── 13. Stats finales ────────────────────────────────────────────────
  const totalMs = Date.now() - startTime;
  const stats = {
    nb_rows_ecrites:           normalizedRows.length,
    nb_circuits_ad_hoc_nouveaux: adHocStats.crees,
    nb_circuits_ad_hoc_existants_incremente: adHocStats.incrementes,
    nb_promotions_signalees:   adHocStats.promotions_signalees,
    elapsed_call_ms:           callMs,
    elapsed_total_ms:          totalMs,
    cost_usd:                  cost
  };

  logger.info('Agent étape 2 (circuits) completed', { candidat_id, ...stats });

  return {
    rows: normalizedRows,
    circuits_ad_hoc_proposes: circuitsAdHocProposes,
    stats,
    usage,
    cost,
    elapsedMs: totalMs
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION DU PAYLOAD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construit le payload JSON envoyé à Claude.
 *
 * Le prompt etape1_t2.txt attend cette structure exacte (voir section 6 du
 * prompt). On joint T1 et RESPONSES par id_question côté agent (le prompt
 * suppose la jointure faite — il reçoit 2 arrays alignés).
 */
function buildPayload({
  candidat_id,
  civilite,
  lignesT1,
  responses,
  referentiel75,
  adHocExistants
}) {
  // ─── Sélection des champs T1 nécessaires au prompt ───────────────────
  const lignes_t1 = lignesT1.map(t1 => ({
    id_question:           t1.id_question || null,
    question_id_protocole: t1.question_id_protocole || t1.id_question || null,
    scenario:              t1.scenario || null,
    pilier_demande:        t1.pilier_demande || null,
    verbatim_candidat:     t1.verbatim_candidat || null,
    pilier_coeur:          extractLookup(t1.pilier_coeur),
    pilier_coeur_analyse:  t1.pilier_coeur_analyse || null,
    outil_cognitif_libelle: t1.outil_cognitif_libelle || null,
    piliers_traverses:     t1.piliers_traverses || null,
    piliers_secondaires:   t1.piliers_secondaires || null,
    types_verbatim:        t1.types_verbatim || null,
    verbes_angles_piliers: t1.verbes_angles_piliers || null,
    signal_limbique:       t1.signal_limbique || null,
    finalite_reponse:      t1.finalite_reponse || null,
    pilier_finalite:       extractLookup(t1.pilier_finalite),
    cog_comprend:          t1.cog_comprend || null,
    cog_sortie_commentaire: t1.cog_sortie_commentaire || null
  }));

  // ─── Sélection des champs RESPONSES nécessaires (6 cog_* + texte) ────
  const responses_t1 = responses.map(r => ({
    session_ID:              r.session_ID || r.session_id || null,
    id_question:             r.id_question || null,
    scenario_nom:            r.scenario_nom || r.scenario || null,
    pilier:                  r.pilier || null,
    question_text:           r.question_text || null,
    response_text:           r.response_text || null,
    cog_comprend:            r.cog_comprend || null,
    cog_outils_mobilises:    r.cog_outils_mobilises || null,
    cog_pilier_gouverne:     r.cog_pilier_gouverne || null,
    cog_gouverne_commentaire: r.cog_gouverne_commentaire || null,
    cog_pilier_sortie:       r.cog_pilier_sortie || null,
    cog_sortie_commentaire:  r.cog_sortie_commentaire || null,
    cog_resultat_vise:       r.cog_resultat_vise || null
  }));

  // ─── Référentiel des 75 circuits (format compact) ────────────────────
  const referentiel_75_circuits = referentiel75.map(c => ({
    pilier:       c.pilier,
    circuit_id:   c.circuit_id,
    circuit_nom:  c.circuit_nom,
    geste:        c.geste || null
  }));

  // ─── Circuits ad hoc existants groupés par pilier (anti-doublons) ────
  const circuits_ad_hoc_existants = { P1: [], P2: [], P3: [], P4: [], P5: [] };
  for (const ad of (adHocExistants || [])) {
    const pilier = extractLookup(ad.pilier_propose);
    if (pilier && circuits_ad_hoc_existants[pilier]) {
      circuits_ad_hoc_existants[pilier].push({
        nom_propose:        ad.nom_propose,
        description_courte: ad.description_courte || null,
        occurrences:        ad.occurrences || 1
      });
    }
  }

  return {
    candidat_id,
    civilite:              civilite || null,
    referentiel_75_circuits,
    circuits_ad_hoc_existants,
    lignes_t1,
    responses_t1
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE LA SORTIE CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrait le tableau `rows` depuis la sortie Claude.
 * Tolère plusieurs formats : { rows: [...] } | { result: { rows: [...] } } | [...]
 */
function extractRows(result) {
  if (!result) {
    throw new Error('Agent T2 — sortie Claude vide');
  }

  // Format direct array (peu probable mais toléré)
  if (Array.isArray(result)) return result;

  // Format standard
  if (Array.isArray(result.rows)) return result.rows;

  // Format niché
  if (result.result && Array.isArray(result.result.rows)) {
    return result.result.rows;
  }

  throw new Error('Agent T2 — champ `rows` absent ou mal formé dans la sortie Claude');
}

/**
 * Extrait le tableau `circuits_ad_hoc_proposes` depuis la sortie Claude.
 * Renvoie [] si absent (cas normal si l'agent n'a créé aucun ad hoc).
 */
function extractCircuitsAdHocProposes(result) {
  if (!result) return [];
  if (Array.isArray(result.circuits_ad_hoc_proposes)) {
    return result.circuits_ad_hoc_proposes;
  }
  if (result.result && Array.isArray(result.result.circuits_ad_hoc_proposes)) {
    return result.result.circuits_ad_hoc_proposes;
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATIONS V1-V9
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Validations doctrinales V1-V9 sur les rows produites par Claude.
 * Lève une exception si une règle est violée.
 */
function validateT2Output(rows, candidat_id) {
  // V1 — Volumétrie
  if (!Array.isArray(rows) || rows.length < 5) {
    throw new Error(
      `V1 violée — Agent T2 doit produire au moins 5 rows (au moins 1 circuit/pilier). ` +
      `Reçu : ${rows ? rows.length : 0} pour ${candidat_id}.`
    );
  }
  if (rows.length > 75) {
    throw new Error(
      `V1 violée — Agent T2 ne peut pas produire plus de 75 rows. ` +
      `Reçu : ${rows.length} pour ${candidat_id}.`
    );
  }

  // V3 — Pilier ∈ {P1..P5}
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!VALID_VALUES.pilier.includes(r.pilier)) {
      throw new Error(
        `V3 violée — row[${i}].pilier="${r.pilier}" invalide. Attendu : P1..P5. ` +
        `Candidat ${candidat_id}.`
      );
    }

    // V4 — Aucun circuit inactif (frequence >= 1)
    const freq = parseInt(r.frequence, 10);
    if (!Number.isFinite(freq) || freq < 1) {
      throw new Error(
        `V4 violée — row[${i}] frequence=${r.frequence} invalide (doit être ≥ 1). ` +
        `Candidat ${candidat_id}, circuit ${r.circuit_id}.`
      );
    }

    // V6 — Valeurs valides singleSelect
    if (r.niveau_activation && !VALID_VALUES.niveau_activation.includes(r.niveau_activation)) {
      throw new Error(
        `V6 violée — row[${i}].niveau_activation="${r.niveau_activation}" invalide. ` +
        `Attendu : HAUT|MOYEN.`
      );
    }
    if (r.actif && !VALID_VALUES.actif.includes(r.actif)) {
      throw new Error(
        `V6 violée — row[${i}].actif="${r.actif}" invalide. Attendu : OUI|NON.`
      );
    }
    if (r.candidature_socle_score &&
        !VALID_VALUES.candidature_socle_score.includes(r.candidature_socle_score)) {
      throw new Error(
        `V6 violée — row[${i}].candidature_socle_score="${r.candidature_socle_score}" invalide.`
      );
    }
    if (r.candidature_resistant_score &&
        !VALID_VALUES.candidature_resistant_score.includes(r.candidature_resistant_score)) {
      throw new Error(
        `V6 violée — row[${i}].candidature_resistant_score="${r.candidature_resistant_score}" invalide.`
      );
    }

    // V7 — Cohérence frequence/niveau (HAUT si ≥ 4, MOYEN si 1-3)
    if (r.niveau_activation === 'HAUT' && freq < 4) {
      logger.warn(`V7 — niveau HAUT mais frequence=${freq} (attendu ≥ 4)`, {
        candidat_id, circuit: r.circuit_id
      });
    }
    if (r.niveau_activation === 'MOYEN' && freq >= 4) {
      logger.warn(`V7 — niveau MOYEN mais frequence=${freq} (attendu 1-3)`, {
        candidat_id, circuit: r.circuit_id
      });
    }

    // V9 — Identifiants techniques présents (NOUVEAU v2.0)
    if (!r.session_ID || !String(r.session_ID).trim()) {
      throw new Error(
        `V9 violée — row[${i}].session_ID vide. Candidat ${candidat_id}, circuit ${r.circuit_id}.`
      );
    }
    if (!r.id_question || !String(r.id_question).trim()) {
      throw new Error(
        `V9 violée — row[${i}].id_question vide. Candidat ${candidat_id}, circuit ${r.circuit_id}.`
      );
    }
  }

  // V5 — Cohérence intra-pilier des 12 champs synthétiques
  validateSyntheseCoherence(rows, candidat_id);

  // V8 — Cohérence socle FORTE → signature_unifiee = true
  for (const r of rows) {
    if (r.candidature_socle_score === 'FORTE' &&
        r.cluster_dominant_signature_unifiee === false) {
      logger.warn('V8 — socle FORTE mais signature_unifiee=false (incohérence doctrinale)', {
        candidat_id, pilier: r.pilier
      });
    }
  }
}

/**
 * V5 — Toutes les lignes d'un même pilier doivent avoir des valeurs identiques
 * pour les 12 champs synthétiques.
 */
function validateSyntheseCoherence(rows, candidat_id) {
  const SYNTH_FIELDS = [
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

  const byPilier = {};
  for (const r of rows) {
    if (!byPilier[r.pilier]) byPilier[r.pilier] = [];
    byPilier[r.pilier].push(r);
  }

  for (const pilier of Object.keys(byPilier)) {
    const lignes = byPilier[pilier];
    if (lignes.length < 2) continue;

    const ref = lignes[0];
    for (let i = 1; i < lignes.length; i++) {
      for (const f of SYNTH_FIELDS) {
        if (JSON.stringify(ref[f]) !== JSON.stringify(lignes[i][f])) {
          logger.warn(`V5 — champ synthétique ${f} divergent dans le pilier ${pilier}`, {
            candidat_id,
            ref_value:     ref[f],
            divergent:     lignes[i][f],
            row_circuit:   lignes[i].circuit_id
          });
        }
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NORMALISATION POUR AIRTABLE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Normalise une row pour l'écriture Airtable.
 * - Force candidat_id (au cas où Claude l'aurait oublié)
 * - Force session_ID en string non vide (V9 déjà vérifié, mais sécurité)
 * - Convertit cluster_dominant_signature_unifiee en booléen strict
 * - Nettoie les champs (trim)
 */
function normalizeRowForAirtable(row, candidat_id, session_id) {
  const normalized = {
    candidat_id,
    pilier:                  row.pilier,
    // role_pilier RESTE VIDE en étape 2 — chasse gardée de l'étape 3
    nb_circuits_actifs_pilier: row.nb_circuits_actifs_pilier ?? null,

    // Identifiants techniques (V9 — nouveaux v2.0)
    session_ID:              String(row.session_ID || session_id).trim(),
    id_question:             String(row.id_question || '').trim(),

    // Circuit officiel ou ad hoc
    circuit_id:              row.circuit_id || null,
    circuit_nom:             row.circuit_nom || null,
    circuit_personnalise:    row.circuit_personnalise || null,

    // Fréquence et activité
    frequence:               String(row.frequence ?? ''),
    niveau_activation:       row.niveau_activation || null,
    actif:                   row.actif || 'OUI',

    // Verbatims
    types_verbatim_detail:   row.types_verbatim_detail || null,
    types_verbatim_brut:     row.types_verbatim_brut || null,
    type_contenu:            row.type_contenu || 'ANALYSE',

    // 12 champs synthétiques par pilier (recopiés sur chaque ligne)
    total_activations_pilier:                 numOrNull(row.total_activations_pilier),
    score_concentration_pilier:               numOrNull(row.score_concentration_pilier),
    cluster_dominant_circuits:                row.cluster_dominant_circuits || null,
    cluster_dominant_co_occurrences:          numOrNull(row.cluster_dominant_co_occurrences),
    cluster_dominant_signature_unifiee:       row.cluster_dominant_signature_unifiee === true,
    cluster_dominant_lecture:                 row.cluster_dominant_lecture || null,
    nb_signaux_limbiques_pilier:              numOrNull(row.nb_signaux_limbiques_pilier),
    questions_avec_signaux_limbiques_pilier:  row.questions_avec_signaux_limbiques_pilier || null,
    candidature_socle_score:                  row.candidature_socle_score || null,
    candidature_socle_raison:                 row.candidature_socle_raison || null,
    candidature_resistant_score:              row.candidature_resistant_score || null,
    candidature_resistant_raison:             row.candidature_resistant_raison || null
  };

  return normalized;
}

function numOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ═══════════════════════════════════════════════════════════════════════════
// MISSION DE VEILLE — Traitement des circuits ad hoc proposés
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pour chaque circuit ad hoc proposé par l'agent :
 *   - Si un ad hoc EN_ATTENTE avec le même nom_propose existe déjà → upsert
 *     (incrément occurrences + ajout candidat_id dans candidats_concernes)
 *   - Sinon → création d'un nouveau record EN_ATTENTE
 *
 * En sortie, signale les ad hoc qui atteignent le seuil de promotion (3 dans
 * le même pilier, ou 5 multi-piliers). Ces signaux sont loggés mais
 * l'arbitrage reste manuel (CTO décide dans Airtable).
 */
async function processCircuitsAdHoc({ candidat_id, circuitsAdHocProposes }) {
  const stats = {
    crees:                0,
    incrementes:          0,
    promotions_signalees: 0,
    erreurs:              0
  };

  if (!circuitsAdHocProposes || circuitsAdHocProposes.length === 0) {
    return stats;
  }

  for (const ad of circuitsAdHocProposes) {
    try {
      // Validation minimale (le prompt impose nom_propose + pilier_propose)
      if (!ad.nom_propose || !ad.pilier_propose) {
        logger.warn('Circuit ad hoc proposé ignoré (champs requis manquants)', {
          candidat_id, ad
        });
        stats.erreurs++;
        continue;
      }

      const result = await airtableService.upsertCircuitAdHoc({
        candidat_id,
        nom_propose:               ad.nom_propose,
        pilier_propose:            ad.pilier_propose,
        description_courte:        ad.description_courte || null,
        geste_decrit:              ad.geste_decrit || null,
        verbatim_source:           ad.verbatim_source || null,
        question_source:           ad.question_source || null,
        circuits_proches_envisages: ad.circuits_proches_envisages || null
      });

      if (result.action === 'created') {
        stats.crees++;
        logger.info('Circuit ad hoc nouveau créé', {
          candidat_id,
          nom_propose: ad.nom_propose,
          pilier:      ad.pilier_propose
        });
      } else if (result.action === 'incremented') {
        stats.incrementes++;
        logger.info('Circuit ad hoc existant incrémenté', {
          candidat_id,
          nom_propose: ad.nom_propose,
          occurrences: result.occurrences
        });

        // Signal de promotion (seuil 3 même pilier ou 5 multi-piliers)
        if (result.occurrences >= PROMOTION_OCCURRENCE_THRESHOLD_SAME_PILLAR) {
          stats.promotions_signalees++;
          logger.info('🎯 Circuit ad hoc candidat à la promotion (signal)', {
            nom_propose: ad.nom_propose,
            pilier:      ad.pilier_propose,
            occurrences: result.occurrences,
            note: `Seuil ${PROMOTION_OCCURRENCE_THRESHOLD_SAME_PILLAR} atteint — arbitrage manuel requis`
          });
        }
      }
    } catch (err) {
      stats.erreurs++;
      logger.error('Échec upsert circuit ad hoc', {
        candidat_id,
        nom_propose: ad.nom_propose,
        error:       err.message
      });
      // On continue le traitement des autres ad hoc — un échec n'arrête pas
      // le service (la mission de veille n'est pas bloquante).
    }
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrait une valeur scalaire d'un champ Airtable qui peut être un array
 * (lookup) ou une string simple.
 *   ["P3"] → "P3"
 *   "P3"   → "P3"
 *   null   → null
 */
function extractLookup(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : null;
  return String(value);
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runAgentT2,

  // Exports internes pour tests unitaires
  _internal: {
    buildPayload,
    extractRows,
    extractCircuitsAdHocProposes,
    validateT2Output,
    validateSyntheseCoherence,
    normalizeRowForAirtable,
    processCircuitsAdHoc,
    VALID_VALUES,
    PROMOTION_OCCURRENCE_THRESHOLD_SAME_PILLAR,
    PROMOTION_OCCURRENCE_THRESHOLD_MULTI_PILLAR
  }
};
