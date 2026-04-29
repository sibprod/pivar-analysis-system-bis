// services/etape1/agentT1VerificateurService.js
// Vérificateur T1 — Vérification doctrinale + Production + Corrections actives
// Profil-Cognitif v10.1
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Rôle :
//   - Lit les 25 lignes T1 produites par l'agent T1
//   - Vérifie l'application stricte des règles critiques (Niveaux 1, 2, 3)
//   - Calcule le mode_recommande (1/2/3/4) selon les comptes par gravité
//   - Applique les corrections directement dans ETAPE1_T1 (PATCH ciblé) — Mode 2
//   - Écrit le rapport synthétique dans la table VERIFICATEUR_T1 (audit)
//
// 4 MODES OPÉRATIONNELS (Décisions n°15, n°16, n°24) :
//   Mode 1 — Conforme : pas de violation critique ni doctrinale → pipeline continue
//   Mode 2 — Corrections directes : violations doctrinales corrigeables → patch ETAPE1_T1
//   Mode 3 — Validation humaine : cas ambigu non résolvable → EN_ATTENTE_VALIDATION_HUMAINE
//   Mode 4 — Erreur système : verdict bloquant + tentatives < 2 → REPRENDRE_AGENT1
//
// DOCTRINE APPLIQUÉE :
//   - Pilier 1 : thinking activé pour ce vérificateur
//   - Pilier 6 : indépendance — prompt distinct, contexte distinct
//   - Pilier 7 : log complet + écriture VERIFICATEUR_T1
//
// PHASE D (2026-04-28) — v10 :
//   - RENOMMAGE doctrinal : agentT1CertificateurService → agentT1VerificateurService (Décision n°10)
//   - SERVICE_NAME : agent_t1_certificateur → agent_t1_verificateur
//   - PROMPT_PATH : 'certificateur_t1.txt' → 'etape1/verificateur1_t1.txt' (Décisions n°10, n°27, n°28)
//   - Déplacé dans services/etape1/ (Décision n°27)
//   - Ajout aiguillage 4 modes (mode_recommande dans le retour)
//   - Ajout écriture VERIFICATEUR_T1 (Décision n°10)
//   - Renommage interne : corrections_certificateur → corrections_verificateur
//
// PHASE D-correction (2026-04-29) — v10.1 :
//   ⚠️ CORRECTION CRITIQUE alignement code ↔ prompt v1.1 doctrinal
//   "On ne dénature pas le fond pour servir la technique" (Isabelle, 29/04/2026)
//
//   Bug 1 corrigé — décalage noms de champs JSON top-level :
//     code v10 lisait : verdict_global, violations, corrections_a_appliquer,
//                       nb_violations_critique, nb_violations_doctrinale, nb_violations_observation
//     prompt v1.1 produit : recommandation_mode, corrections, comptage_erreurs,
//                           diagnostic_local, lignes_traitees, batch_id
//     → Tous les compteurs tombaient à 0, verdict INDETERMINE par fallback,
//       Mode 1 retourné mécaniquement
//
//   Bug 2 corrigé — referentiel_piliers + civilite non injectés dans le payload :
//     prompt v1.1 (section 3) attend : referentiel_piliers, lignes_t1, civilite
//     code v10 ne passait que lignes_t1
//     → Le vérificateur travaillait sans la doctrine d'analyse en main
//
//   Bug 3 corrigé — décalage noms de champs sur les corrections individuelles :
//     code v10 lisait : champ, valeur_corrigee, valeur_actuelle, raison, type
//     prompt v1.1 produit : champ, nouvelle_valeur, ancienne_valeur, raison_doctrinale,
//                           type_erreur, gravite, categorie, cas_ambigu_doctrinal
//     → Les corrections n'étaient jamais appliquées (champs undefined)
//
//   determinerMode v10.1 — combine la recommandation Claude (Option D doctrinale)
//     avec les comptages mécaniques par scénario (seuil ≥3 erreurs GRAVES sur un
//     scénario = Mode 2). Aligne sur Section 4.4 du Contrat ETAPE1 v1.7.

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const SERVICE_NAME = 'agent_t1_verificateur';   // ⭐ v10 : renommé
const PROMPT_PATH  = 'etape1/verificateur1_t1.txt';  // ⭐ v10 : renommé + nouveau chemin

/**
 * Exécute le vérificateur T1 sur les 25 lignes produites par T1
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Array}  params.rows_t1 — les 25 lignes T1 à vérifier (avec airtable_id)
 * @param {number} [params.tentatives_actuelles] — nombre de tentatives Étape 1 (Décision n°24)
 * @returns {Promise<{verdict, violations, corrections, mode_recommande, usage, cost, elapsedMs}>}
 */
async function runVerificateurT1({ candidat_id, rows_t1, tentatives_actuelles = 0 }) {
  const startTime = Date.now();
  logger.info('Vérificateur T1 starting', {
    candidat_id,
    lignes_a_verifier: rows_t1.length,
    tentatives_actuelles
  });

  if (!rows_t1 || rows_t1.length === 0) {
    throw new Error(`No T1 rows to verify for ${candidat_id}`);
  }

  // Si les rows n'ont pas leur airtable_id, on les recharge depuis Airtable
  let rowsWithIds = rows_t1;
  const hasAirtableIds = rows_t1.every(r => r && r.airtable_id);
  if (!hasAirtableIds) {
    logger.info('Vérificateur T1 — re-reading T1 rows from Airtable to get airtable_id', { candidat_id });
    rowsWithIds = await airtableService.getEtape1T1(candidat_id);
  }

  // ⭐ v10.1 — Bug 2 corrigé : injection du référentiel piliers + civilité
  // Le prompt v1.1 (section 3) attend explicitement ces 2 données dans le payload.
  // Sans cela le vérificateur travaille sans la doctrine d'analyse en main.
  logger.info('Vérificateur T1 — chargement référentiel piliers + civilité', { candidat_id });
  const referentiel_piliers = await airtableService.getReferentielPiliers();
  const civilite = await airtableService.getCiviliteCandidat(candidat_id);

  if (!referentiel_piliers || referentiel_piliers.length !== 5) {
    throw new Error(
      `Vérificateur T1 — référentiel piliers incomplet ou corrompu (${referentiel_piliers?.length || 0}/5). ` +
      `Guard V1.0 : arrêt avant exécution.`
    );
  }

  if (!civilite) {
    logger.warn('Vérificateur T1 — civilité non trouvée, utilisation du fallback', { candidat_id });
  }

  // Construction du payload conforme au prompt verificateur1_t1.txt v1.1 (section 3)
  // ⚠️ ANONYMISATION : aucun prénom, uniquement candidat_id (Décision n°4)
  const payload = {
    candidat_id,
    civilite: civilite || 'Madame',  // fallback prudent (la majorité des candidats sont Madame)
    referentiel_piliers,
    nb_lignes_a_verifier: rowsWithIds.length,
    lignes_t1: rowsWithIds.map(row => ({
      id_question:                   row.id_question,
      question_id_protocole:         row.question_id_protocole,
      scenario:                      row.scenario,
      pilier_demande:                row.pilier_demande,
      verbatim_candidat:             row.verbatim_candidat,
      v1_conforme:                   row.v1_conforme,
      v2_traite_problematique:       row.v2_traite_problematique,
      pilier_coeur_analyse:          row.pilier_coeur_analyse,
      verbes_observes:               row.verbes_observes,
      conforme_ecart:                row.conforme_ecart,
      ecart_detail:                  row.ecart_detail,
      signal_limbique:               row.signal_limbique,
      attribution_pilier_signal_brut: row.attribution_pilier_signal_brut,
      raisonnement:                  row.raisonnement || ''
      // ⛔ pilier_sortie ABANDONNÉ en v10 (Décision n°5) — non passé au vérificateur
    }))
  };

  // Appel Claude (thinking activé)
  const { result, usage, cost } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: false,
    candidatId:    candidat_id
  });

  const elapsedMs = Date.now() - startTime;

  // ⭐ v10.1 — Bug 1 corrigé : alignement parsing JSON sur le prompt v1.1
  //
  // Le prompt verificateur1_t1.txt v1.1 (section 7) produit STRICTEMENT ce JSON :
  //   { batch_id, lignes_traitees, comptage_erreurs, diagnostic_local,
  //     recommandation_mode, corrections }
  //
  // Le code v10 lisait des champs qui n'existaient pas (verdict_global,
  // nb_violations_critique, etc.) → tous les fallback se déclenchaient → INDETERMINE.
  //
  // Note : actuellement 1 seul appel sur les 25 lignes (Option A doctrinale validée
  // par Isabelle 29/04). Le prompt parle de batches mais le code fait un appel unique.
  // À terme, si on bascule en 2 batches, il faudra consolider 2 JSON.

  const recommandation_claude = result?.recommandation_mode;
  const corrections           = Array.isArray(result?.corrections) ? result.corrections : [];
  const comptage_erreurs      = (result?.comptage_erreurs && typeof result.comptage_erreurs === 'object') ? result.comptage_erreurs : {};
  const diagnostic_local      = result?.diagnostic_local || '';
  const lignes_traitees       = Array.isArray(result?.lignes_traitees) ? result.lignes_traitees : [];

  // Calcul des comptages agrégés à partir de comptage_erreurs (par scénario)
  let nb_graves = 0;
  let nb_moyennes = 0;
  let nb_mineures = 0;
  for (const scenario of Object.keys(comptage_erreurs)) {
    const c = comptage_erreurs[scenario] || {};
    nb_graves   += (typeof c.graves   === 'number') ? c.graves   : 0;
    nb_moyennes += (typeof c.moyennes === 'number') ? c.moyennes : 0;
    nb_mineures += (typeof c.mineures === 'number') ? c.mineures : 0;
  }

  // ⭐ v10.1 — Calcul du mode recommandé (Décisions n°15, n°16, n°24, n°22)
  // Combine la recommandation Claude (Option D doctrinale) avec les comptages
  // mécaniques par scénario. Conformément à Section 4.4 du Contrat ETAPE1 v1.7.
  const mode_recommande = determinerMode({
    recommandation_claude,
    comptage_erreurs,
    nb_graves,
    nb_moyennes,
    tentatives_actuelles
  });

  // Verdict synthétique (mapping mode → label pour traçabilité audit)
  const verdict = verdictFromMode(mode_recommande, { nb_graves, nb_moyennes, nb_mineures });

  logger.info('Vérificateur T1 — verdict received', {
    candidat_id,
    verdict,
    mode_recommande,
    recommandation_claude,
    nb_corrections: corrections.length,
    nb_graves,
    nb_moyennes,
    nb_mineures,
    scenarios_concernes: Object.keys(comptage_erreurs),
    diagnostic_local,
    cost_usd:       cost.toFixed(4),
    elapsedMs
  });

  // ⭐ v10.1 — Trace VERIFICATEUR_T1 enrichie : on stocke les violations détaillées
  // dans violations_json (qui devient le détail des corrections + diagnostic),
  // pour conserver une traçabilité complète et permettre le debug ultérieur.
  await airtableService.writeVerificateurT1(candidat_id, {
    verdict_global:        verdict,
    nb_lignes_verifiees:   rowsWithIds.length,
    nb_violations_total:   corrections.length,
    nb_critique:           nb_graves,       // mapping doctrinal : GRAVE → critique
    nb_doctrinale:         nb_moyennes,     // mapping doctrinal : MOYENNE → doctrinale
    nb_observation:        nb_mineures,     // mapping doctrinal : MINEURE → observation
    violations_json:       {
      mode_recommande,
      recommandation_claude,
      diagnostic_local,
      comptage_erreurs,
      lignes_traitees,
      corrections
    },
    cost_usd:              cost,
    elapsed_ms:            elapsedMs
  });

  // ─── Mode 2 : Appliquer les corrections sur ETAPE1_T1 ────────────────────
  if (mode_recommande === 2 && corrections.length > 0) {
    const patchPlan = buildVerificateurPatchPlan(rowsWithIds, corrections);
    if (patchPlan.length > 0) {
      await airtableService.patchEtape1T1Rows(candidat_id, patchPlan);
      logger.info('Vérificateur T1 — patches applied (Mode 2)', {
        candidat_id,
        lignes_patchees: patchPlan.length
      });
    }
  } else if (corrections.length > 0 && mode_recommande !== 2) {
    logger.info('Vérificateur T1 — corrections produced but mode is not 2, patches skipped', {
      candidat_id,
      mode_recommande,
      nb_corrections: corrections.length
    });
  }

  return {
    verdict,
    corrections,                    // ⭐ v10.1 — alias correct
    mode_recommande,                // ⭐ v10 — pour aiguillage orchestrateur
    recommandation_claude,          // ⭐ v10.1 — recommandation IA brute
    diagnostic_local,               // ⭐ v10.1 — texte explicatif Claude
    comptage_erreurs,               // ⭐ v10.1 — par scénario
    nb_graves,                      // ⭐ v10.1 — agrégé
    nb_moyennes,                    // ⭐ v10.1 — agrégé
    nb_mineures,                    // ⭐ v10.1 — agrégé
    // Aliases legacy (compatibilité ascendante avec orchestrateur v10) :
    violations:    corrections,     // legacy : 'violations' était synonyme côté code
    nb_critique:   nb_graves,       // legacy mapping
    nb_doctrinale: nb_moyennes,     // legacy mapping
    nb_observation: nb_mineures,    // legacy mapping
    usage,
    cost,
    elapsedMs
  };
}

/**
 * Détermine le mode opérationnel — v10.1
 *
 * Combine la recommandation Claude (Option D doctrinale) avec les comptages
 * mécaniques par scénario. Aligne sur Section 4.4 du Contrat ETAPE1 v1.7.
 *
 * Algorithme :
 *   1. Si Claude recommande Mode 4 (référentiel cassé / structure T1 cassée)
 *      → on suit Claude (Mode 4 si tentatives < 2, sinon Mode 3)
 *   2. Si un scénario unique a ≥ 3 erreurs GRAVES → Mode 2 (relance T1 sur scénario)
 *      [Section 4.4 du contrat — seuil de défaillance d'un agent]
 *   3. Si > 2 erreurs GRAVES dispersées sur plusieurs scénarios → Mode 3 (validation humaine)
 *      [Section 4.4 — cas pathologique persistant]
 *   4. Si 0 erreur GRAVE et 0 erreur MOYENNE → Mode 1 (conforme)
 *   5. Sinon → on suit la recommandation Claude (Mode 1 ou 2 selon son diagnostic)
 *      Mode 1 par défaut si la recommandation est manquante.
 *
 * Les erreurs MINEURES n'influencent jamais le mode (doctrine prompt section 8).
 *
 * @param {Object} params
 * @param {number} params.recommandation_claude — 1, 2, 3 ou 4 selon Claude
 * @param {Object} params.comptage_erreurs     — { SOMMEIL: {graves,moyennes,mineures}, ... }
 * @param {number} params.nb_graves            — total agrégé
 * @param {number} params.nb_moyennes          — total agrégé
 * @param {number} params.tentatives_actuelles — Décision n°24
 * @returns {1|2|3|4}
 */
function determinerMode({
  recommandation_claude,
  comptage_erreurs,
  nb_graves,
  nb_moyennes,
  tentatives_actuelles
}) {
  // 1. Mode 4 — erreur système (Claude détecte référentiel cassé / structure cassée)
  if (recommandation_claude === 4) {
    if (tentatives_actuelles < 2) {
      return 4;  // relance auto T1
    } else {
      return 3;  // escalade humaine après 2 tentatives
    }
  }

  // 2. Mode 2 mécanique — un scénario a ≥ 3 erreurs GRAVES (seuil de défaillance d'un agent)
  // Section 4.4 du contrat v1.7
  for (const scenario of Object.keys(comptage_erreurs || {})) {
    const c = comptage_erreurs[scenario] || {};
    const graves = (typeof c.graves === 'number') ? c.graves : 0;
    if (graves >= 3) {
      return 2;
    }
  }

  // 3. Mode 3 mécanique — > 2 erreurs GRAVES dispersées (pathologique persistant)
  if (nb_graves > 2) {
    return 3;
  }

  // 4. Mode 1 garanti — aucune erreur GRAVE ni MOYENNE
  if (nb_graves === 0 && nb_moyennes === 0) {
    return 1;
  }

  // 5. Cas restants : on suit Claude (1 ou 2 selon son diagnostic doctrinal)
  // Avec garde-fou : si Claude n'a rien dit, défaut Mode 1 (le plus prudent côté pipeline)
  if (recommandation_claude === 2) return 2;
  if (recommandation_claude === 3) {
    // Claude veut validation humaine → on respecte
    return 3;
  }
  return 1;
}

/**
 * Verdict synthétique calculé depuis le mode recommandé.
 * Sert uniquement à l'audit dans VERIFICATEUR_T1.verdict_global.
 */
function verdictFromMode(mode, { nb_graves = 0, nb_moyennes = 0, nb_mineures = 0 } = {}) {
  switch (mode) {
    case 1:
      if (nb_mineures > 0 || nb_moyennes > 0) return 'CONFORME_AVEC_OBSERVATIONS';
      return 'CONFORME';
    case 2: return 'CORRECTIONS_APPLIQUEES';
    case 3: return 'EN_ATTENTE_VALIDATION_HUMAINE';
    case 4: return 'ERREUR_SYSTEME';
    default: return 'INDETERMINE';
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Construction du plan de patch
// Transforme la liste plate de corrections en plan groupé par ligne T1
// ──────────────────────────────────────────────────────────────────────────
function buildVerificateurPatchPlan(rows_t1, corrections) {
  const rowsByIdQuestion = new Map();
  for (const row of rows_t1) {
    rowsByIdQuestion.set(row.id_question, row);
  }

  const correctionsByIdQuestion = new Map();
  for (const corr of corrections) {
    const idQ = corr.id_question;
    if (!correctionsByIdQuestion.has(idQ)) {
      correctionsByIdQuestion.set(idQ, []);
    }
    correctionsByIdQuestion.get(idQ).push(corr);
  }

  const plan = [];
  for (const [idQ, corrs] of correctionsByIdQuestion.entries()) {
    const row = rowsByIdQuestion.get(idQ);
    if (!row || !row.airtable_id) {
      logger.warn('Vérificateur T1 — ligne T1 introuvable pour correction', { id_question: idQ });
      continue;
    }

    const fields_to_patch = {};
    const traces = [];

    for (const corr of corrs) {
      // ⛔ Skip les corrections sur pilier_sortie (champ abandonné en v10 — Décision n°5)
      if (corr.champ === 'pilier_sortie') {
        logger.warn('Vérificateur T1 — correction sur pilier_sortie ignorée (champ abandonné v10)', {
          id_question: idQ
        });
        continue;
      }

      // ⭐ v10.1 — Bug 3 corrigé : alignement sur le prompt v1.1
      //
      // Le prompt verificateur1_t1.txt v1.1 (section 7) produit chaque correction avec :
      //   { id_question, champ, ancienne_valeur, nouvelle_valeur, raison_doctrinale,
      //     categorie, gravite, type_erreur, cas_ambigu_doctrinal }
      //
      // Le code v10 lisait : corr.valeur_corrigee, corr.valeur_actuelle, corr.raison, corr.type
      // (ces champs n'existent pas dans la sortie Claude → patches jamais appliqués).
      //
      // Tolérance : on accepte les deux noms pour robustesse (legacy + nouveau).

      const nouvelle_valeur = (typeof corr.nouvelle_valeur !== 'undefined')
        ? corr.nouvelle_valeur
        : corr.valeur_corrigee;  // legacy fallback

      const ancienne_valeur = (typeof corr.ancienne_valeur !== 'undefined')
        ? corr.ancienne_valeur
        : corr.valeur_actuelle;  // legacy fallback

      const raison = corr.raison_doctrinale || corr.raison || '';
      const type_erreur = corr.type_erreur || corr.type || '?';
      const gravite = corr.gravite || '';

      // Appliquer la correction sur le champ
      if (corr.champ && typeof nouvelle_valeur !== 'undefined') {
        // Normaliser ECART/ÉCART pour Airtable (singleSelect = ECART, sans accent)
        let valueToWrite = nouvelle_valeur;
        if (corr.champ === 'conforme_ecart' && valueToWrite === 'ÉCART') {
          valueToWrite = 'ECART';
        }
        fields_to_patch[corr.champ] = valueToWrite;
      }

      // Construire la trace lisible (enrichie v10.1 : on ajoute la gravité)
      const tag       = gravite ? `[${gravite}/${type_erreur}]` : `[${type_erreur}]`;
      const champ     = corr.champ || '?';
      const ancienne  = (ancienne_valeur === '' || ancienne_valeur === null || typeof ancienne_valeur === 'undefined') ? '∅' : `"${ancienne_valeur}"`;
      const nouvelle  = (nouvelle_valeur === '' || nouvelle_valeur === null) ? '∅' : `"${nouvelle_valeur}"`;
      traces.push(`${tag} ${champ}: ${ancienne} → ${nouvelle}${raison ? ' · ' + raison : ''}`);
    }

    // Si on a au moins un patch utile, on l'ajoute au plan
    if (Object.keys(fields_to_patch).length > 0 || traces.length > 0) {
      // Ajouter le champ corrections_verificateur à patcher (renommage v10)
      fields_to_patch.corrections_verificateur = traces.join('\n');

      plan.push({
        airtable_id:      row.airtable_id,
        id_question:      idQ,
        fields_to_patch,
        nb_corrections:   corrs.length
      });
    }
  }

  return plan;
}


module.exports = {
  runVerificateurT1,
  determinerMode,
  verdictFromMode,                  // ⭐ v10.1
  buildVerificateurPatchPlan
};
