// services/etape1/agentT1VerificateurService.js
// Vérificateur T1 — Vérification doctrinale + Production + Corrections actives
// Profil-Cognitif v10.5
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et docs/CONTRAT_ETAPE1.md (v1.10 prévue)
//
// Rôle :
//   - Lit les 25 lignes T1 produites par l'agent T1 (29 colonnes en v10.3)
//   - Vérifie l'application stricte des règles critiques (Niveaux 1, 2, 3)
//   - Calcule le mode_recommande (1/2/3/4) selon la doctrine v1.9
//   - Applique les corrections directement dans ETAPE1_T1 (PATCH ciblé) — Mode 1 ET Mode 2
//   - Écrit le rapport synthétique dans la table VERIFICATEUR_T1 (audit)
//
// 4 MODES OPÉRATIONNELS — v10.3 alignés Décisions n°38, n°39, n°41 (contrat v1.9) :
//   Mode 1 — ≤2 erreurs par agent → patches appliqués dans ETAPE1_T1 (Décision n°38)
//   Mode 2 — ≥3 graves sur 1 scénario → patches sur scénarios fiables uniquement
//            puis l'orchestrateur relance T1 ciblé sur le scénario défaillant.
//   Mode 3 — Tour 2 d'un Mode 2 ayant échoué : le vérificateur impose ses
//            propres corrections (≥3 graves persistent après relance T1 ciblée).
//            PAS de validation humaine. Pipeline continue. (Décision n°39)
//   Mode 4 — Erreur technique grave (référentiel cassé, JSON malformé en
//            cascade, services down) → escalade humaine DIRECTE :
//            statut → EN_ATTENTE_VALIDATION_HUMAINE + email superviseur.
//            PAS de relance auto (la cause technique ne se résout pas par
//            relance — il faut un œil humain). (Décision n°24)
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
//   - Bug 1 : alignement noms de champs JSON top-level (recommandation_mode, etc.)
//   - Bug 2 : injection de referentiel_piliers + civilite dans le payload
//   - Bug 3 : alignement noms de champs sur les corrections (nouvelle_valeur, etc.)
//
// PHASE v10.2a (2026-04-29) :
//   - Décision n°38 : Mode 1 patche réellement (avant : seul Mode 2 patchait)
//   - Décision n°38 : extension patches en Mode 2 sur scénarios fiables uniquement
//   - Ajout 3 champs VERIFICATEUR_T1 : tour_verificateur, scenario_relance_demande,
//     compteur_relance_scenario
//
// PHASE v10.3 (2026-05-04) — alignement T1 v3.2 + prompt vérificateur v1.2 :
//   - Bug 1 corrigé : payload lignes_t1 enrichi avec les 5 nouveaux champs grille
//     à 3 niveaux (pilier_finalite, pilier_finalite_libelle, pilier_coeur,
//     outil_cognitif_libelle, piliers_traverses) — Décisions n°43, n°46.
//     Sans cela, le vérificateur v1.2 ne pouvait pas vérifier ces champs.
//   - Bug 2 corrigé : determinerMode aligné Décision n°39 (Mode 3 ≠ validation humaine)
//     - Suppression du Mode 3 mécanique "nb_graves > 2" (faux en v1.9)
//     - Suppression du fallback "Mode 4 → Mode 3 après 2 tentatives" (faux en v1.9)
//     - Mode 3 désormais : tour 2 d'un Mode 2 ayant échoué (vérificateur impose)
//     - Mode 4 désormais : escalade humaine directe (pas de relance auto)
//   - Bug 3 corrigé : verdictFromMode pour Mode 3 ne retourne plus
//     EN_ATTENTE_VALIDATION_HUMAINE mais CORRECTIONS_IMPOSEES_TOUR_2.
//   - Bug 4 corrigé : suppression de la conversion ÉCART → ECART dans
//     applyVerificateurPatches (le champ est multilineText, accepte les 2,
//     et la doctrine v1.9 veut l'accent É).
//
// PHASE v10.4 (2026-05-05) — Doctrine v2 v3.3 (Décision n°49) :
//   Le prompt T1 v3.3 introduit 3 nouveaux champs v2 (v2_repond_question,
//   v2_repond_situation, v2_analyse). Le service vérificateur doit :
//
//   1. ENRICHIR le payload `lignes_t1` avec ces 3 nouveaux champs pour que
//      le vérificateur v1.4 puisse les voir et les vérifier. Sans cet
//      enrichissement, le vérificateur travaillerait à l'aveugle sur la
//      doctrine v2 v3.3 (angle mort doctrinal — exactement le bug qui a
//      laissé passer la doctrine v2 vague pendant tout le run du 04/05).
//
//   2. SUPPRIMER le champ `raisonnement` du payload (Décision n°48 — champ
//      orphelin systématiquement vide dans les analyses T1).
//
//   3. Le code de patch (buildVerificateurPatchPlan) supporte déjà les
//      patches sur n'importe quel champ via corr.champ — pas de modif
//      nécessaire pour patcher v2_repond_question / v2_repond_situation /
//      v2_analyse.
//
//   Aucune modification de la logique determinerMode, verdictFromMode, ou
//   du calcul des comptages — cette phase est purement de la tuyauterie
//   pour transmettre les 3 nouveaux champs v2 à Claude.
//
//   Le vérificateur correspondant est verificateur1_t1.txt v1.4, qui
//   contient la matrice des pièges v2.
//
// PHASE v10.5 (2026-05-05) — Alignement prompts nettoyés :
//   Pas de modification fonctionnelle. Mise à jour des références au prompt
//   vérificateur (v1.3 → v1.4 — prompt nettoyé en mode "ouvrier qui découvre
//   sa mission", sans journal de version dans le corps du document).

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

  // Construction du payload conforme au prompt verificateur1_t1.txt v1.4 (section 3)
  // ⚠️ ANONYMISATION : aucun prénom, uniquement candidat_id (Décision n°4)
  // ⭐ v10.3 : payload enrichi des 5 nouveaux champs grille à 3 niveaux (Décisions n°43, n°46)
  // ⭐ v10.4 : payload enrichi des 3 nouveaux champs v2 v3.3 (Décision n°49)
  //           Sans cela, le vérificateur v1.4 ne pourrait pas vérifier la
  //           doctrine v2 reformulée (A : répond à la question / B : répond
  //           à la situation, et à quel niveau).
  const payload = {
    candidat_id,
    civilite: civilite || 'Madame',  // fallback prudent (la majorité des candidats sont Madame)
    referentiel_piliers,
    nb_lignes_a_verifier: rowsWithIds.length,
    lignes_t1: rowsWithIds.map(row => ({
      // ─── Identité (4) ────────────────────────────────────────────────────
      id_question:                   row.id_question,
      question_id_protocole:         row.question_id_protocole,
      scenario:                      row.scenario,
      pilier_demande:                row.pilier_demande,

      // ─── Réponse brute (1) ───────────────────────────────────────────────
      verbatim_candidat:             row.verbatim_candidat,

      // ─── Analyse de base (3) ─────────────────────────────────────────────
      v1_conforme:                   row.v1_conforme,
      v2_traite_problematique:       row.v2_traite_problematique,
      // ⭐ v10.4 — Doctrine v2 v3.3 (Décision n°49) — 3 nouveaux champs
      // Sans ces champs dans le payload, le vérificateur v1.4 ne peut pas
      // vérifier la doctrine v2 reformulée par Isabelle le 04/05/2026.
      v2_repond_question:            row.v2_repond_question || '',
      v2_repond_situation:           row.v2_repond_situation || '',
      v2_analyse:                    row.v2_analyse || '',
      verbes_observes:               row.verbes_observes,

      // ─── Grille à 3 niveaux v10.3 (5 nouveaux + 2 historiques) ──────────
      pilier_finalite:               row.pilier_finalite || '',         // ⭐ v10.3
      pilier_finalite_libelle:       row.pilier_finalite_libelle || '', // ⭐ v10.3
      pilier_coeur:                  row.pilier_coeur || '',            // ⭐ v10.3
      outil_cognitif_libelle:        row.outil_cognitif_libelle || '',  // ⭐ v10.3
      pilier_coeur_analyse:          row.pilier_coeur_analyse,
      piliers_traverses:             row.piliers_traverses || '',       // ⭐ v10.3
      piliers_secondaires:           row.piliers_secondaires || '',

      // ─── Verdict de conformité (4) ───────────────────────────────────────
      conforme_ecart:                row.conforme_ecart,
      ecart_detail:                  row.ecart_detail,
      signal_limbique:               row.signal_limbique,
      attribution_pilier_signal_brut: row.attribution_pilier_signal_brut
      // ⛔ pilier_sortie ABANDONNÉ en v10 (Décision n°5) — non passé au vérificateur
      // ⛔ raisonnement SUPPRIMÉ en v10.4 (Décision n°48) — champ orphelin
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

  // ⭐ v10.2a (29/04/2026) — Identification du scénario défaillant en Mode 2
  // Décision n°41 : un agent T1 est non fiable si ≥3 erreurs de pilier_coeur sur ses 5 analyses.
  // En Mode 2, on identifie le 1er scénario à ≥3 graves pour exclure ses corrections des patches
  // (Phase 2c future déclenchera la relance T1 ciblée sur ce scénario).
  let scenarioDefaillant = null;
  if (mode_recommande === 2) {
    for (const sc of Object.keys(comptage_erreurs)) {
      const c = comptage_erreurs[sc] || {};
      if ((c.graves || 0) >= 3) {
        scenarioDefaillant = sc;
        logger.warn('Vérificateur T1 — Mode 2 détecté : scénario défaillant identifié', {
          candidat_id,
          scenarioDefaillant,
          nb_graves_scenario: c.graves,
          note: 'Phase 2c (relance auto Mode 2) pas encore déployée — relance manuelle via REPRENDRE_T1_' + scenarioDefaillant + '_SEUL si nécessaire'
        });
        break;
      }
    }
  }

  // ⭐ v10.1 — Trace VERIFICATEUR_T1 enrichie : on stocke les violations détaillées
  // dans violations_json (qui devient le détail des corrections + diagnostic),
  // pour conserver une traçabilité complète et permettre le debug ultérieur.
  // ⭐ v10.2a — Ajout des 3 nouveaux champs : tour_verificateur, scenario_relance_demande, compteur_relance_scenario
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
    elapsed_ms:            elapsedMs,
    // ⭐ v10.2a — nouveaux champs
    tour_verificateur:        1,                            // toujours 1 en Phase 2a (Mode 3 = tour 2 = Phase 2c)
    scenario_relance_demande: scenarioDefaillant || null,    // si Mode 2 détecté (info pour Phase 2c)
    compteur_relance_scenario: 0                             // toujours 0 en Phase 2a (relance auto = Phase 2c)
  });

  // ─── ⭐ v10.2a (Décision n°38) — Mode 1 et Mode 2 appliquent les corrections ──
  // Le vérificateur est producteur de vérité : ses corrections doivent atterrir
  // dans ETAPE1_T1 pour que les agents aval (T2, T3, T4) lisent la vérité corrigée.
  //
  // Mode 1 : ≤ 2 erreurs par agent → toutes les corrections appliquées
  // Mode 2 : ≥ 3 graves sur 1 scénario → corrections appliquées SAUF sur le scénario défaillant
  //          (Phase 2c future relancera ce scénario via REPRENDRE_T1_<X>_SEUL)
  // Mode 3 : Phase 2c future (vérificateur impose après échec Mode 2)
  // Mode 4 : pas de patches (erreur technique → relance T1 complet par orchestrateur)
  let correctionsAAppliquer = corrections;
  if (mode_recommande === 2 && scenarioDefaillant) {
    // Filtrer : retirer les corrections du scénario défaillant
    correctionsAAppliquer = corrections.filter(corr => {
      const idQ = corr.id_question || '';
      const row = rowsWithIds.find(r => r.id_question === idQ);
      const sc = row?.scenario || '';
      return sc !== scenarioDefaillant;
    });
    logger.info('Vérificateur T1 — Mode 2 : corrections du scénario défaillant exclues des patches', {
      candidat_id,
      scenarioDefaillant,
      corrections_totales: corrections.length,
      corrections_appliquees: correctionsAAppliquer.length,
      corrections_exclues: corrections.length - correctionsAAppliquer.length
    });
  }

  if ((mode_recommande === 1 || mode_recommande === 2) && correctionsAAppliquer.length > 0) {
    const patchPlan = buildVerificateurPatchPlan(rowsWithIds, correctionsAAppliquer);
    if (patchPlan.length > 0) {
      await airtableService.patchEtape1T1Rows(candidat_id, patchPlan);
      logger.info('Vérificateur T1 — patches appliqués dans ETAPE1_T1', {
        candidat_id,
        mode_recommande,
        lignes_patchees: patchPlan.length,
        scenarioDefaillant_exclu: scenarioDefaillant || 'aucun'
      });
    }
  } else if (corrections.length > 0 && mode_recommande >= 3) {
    logger.warn('Vérificateur T1 — Mode 3/4 détecté, patches non appliqués (Phase 2c future)', {
      candidat_id,
      mode_recommande,
      nb_corrections: corrections.length,
      note: 'Mode 3 = vérificateur impose (Phase 2c) ; Mode 4 = erreur technique (relance T1 par orchestrateur)'
    });
  } else if (corrections.length === 0 && (mode_recommande === 1 || mode_recommande === 2)) {
    logger.info('Vérificateur T1 — aucune correction à appliquer', {
      candidat_id,
      mode_recommande,
      verdict
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
// ──────────────────────────────────────────────────────────────────────────
// determinerMode v10.3 — aligné Décisions n°38, n°39, n°41 (contrat v1.9)
//
// Combine la recommandation Claude (Option D doctrinale) avec les comptages
// mécaniques par scénario. Les modes sont strictement définis par v1.9 :
//
//   Mode 1 : ≤2 erreurs par scénario (graves+moyennes), patches appliqués
//   Mode 2 : ≥3 graves sur 1 scénario → relance T1 ciblée par orchestrateur
//   Mode 3 : tour 2 d'un Mode 2 ayant échoué (le vérificateur impose ses
//            propres analyses car T1 a échoué deux fois consécutivement
//            sur le scénario). Pipeline continue, PAS de validation humaine.
//   Mode 4 : erreur technique grave → escalade humaine DIRECTE,
//            statut → EN_ATTENTE_VALIDATION_HUMAINE (PAS de relance auto).
//
// Note : le paramètre `tentatives_actuelles` est conservé pour rétrocompatibilité
// avec l'orchestrateur, mais n'a plus d'effet sur le retour Mode 4 (escalade
// directe en v10.3 — décision Isabelle 04/05/2026).
// ──────────────────────────────────────────────────────────────────────────
function determinerMode({
  recommandation_claude,
  comptage_erreurs,
  nb_graves,
  nb_moyennes,
  tentatives_actuelles  // conservé pour signature, non utilisé en v10.3
}) {
  // 1. Mode 4 — erreur système (Claude détecte référentiel cassé / structure cassée)
  // ⭐ v10.3 (Décision Isabelle 04/05/2026) : Mode 4 = escalade humaine DIRECTE.
  // Une erreur technique grave (référentiel corrompu, services down, JSON cassé
  // en cascade) ne se résout pas par relance auto — il faut un œil humain.
  // L'orchestrateur passera le statut à EN_ATTENTE_VALIDATION_HUMAINE.
  if (recommandation_claude === 4) {
    return 4;
  }

  // 2. Mode 2 mécanique — un scénario a ≥ 3 erreurs GRAVES (seuil de défaillance d'un agent)
  // Décision n°41 : critère de fiabilité d'un agent T1.
  // L'orchestrateur déclenchera une relance T1 ciblée sur ce scénario.
  for (const scenario of Object.keys(comptage_erreurs || {})) {
    const c = comptage_erreurs[scenario] || {};
    const graves = (typeof c.graves === 'number') ? c.graves : 0;
    if (graves >= 3) {
      return 2;
    }
  }

  // 3. Mode 3 — UNIQUEMENT si Claude le recommande explicitement.
  // Décision n°39 (v1.9) : Mode 3 = tour 2 d'un Mode 2 ayant échoué.
  // Le vérificateur, ayant déjà déclenché Mode 2 et constaté que T1 a échoué
  // à nouveau au tour 2, impose ses propres corrections. PAS de validation humaine.
  // Le prompt verificateur v1.2 ne recommande Mode 3 que dans ce cas précis.
  // ⭐ v10.3 : SUPPRESSION du Mode 3 mécanique "nb_graves > 2" (faux en v1.9).
  if (recommandation_claude === 3) {
    return 3;
  }

  // 4. Mode 1 garanti — aucune erreur GRAVE ni MOYENNE
  if (nb_graves === 0 && nb_moyennes === 0) {
    return 1;
  }

  // 5. Cas restants : on suit Claude (1 ou 2 selon son diagnostic doctrinal)
  // Avec garde-fou : si Claude n'a rien dit, défaut Mode 1 (le plus prudent côté pipeline)
  if (recommandation_claude === 2) return 2;
  return 1;
}

/**
 * Verdict synthétique calculé depuis le mode recommandé.
 * Sert uniquement à l'audit dans VERIFICATEUR_T1.verdict_global.
 * ⭐ v10.3 — Mode 3 et Mode 4 alignés Décisions n°39 et n°24 (contrat v1.9).
 */
function verdictFromMode(mode, { nb_graves = 0, nb_moyennes = 0, nb_mineures = 0 } = {}) {
  switch (mode) {
    case 1:
      if (nb_mineures > 0 || nb_moyennes > 0) return 'CONFORME_AVEC_OBSERVATIONS';
      return 'CONFORME';
    case 2: return 'CORRECTIONS_APPLIQUEES';
    case 3: return 'CORRECTIONS_IMPOSEES_TOUR_2';   // ⭐ v10.3 (Décision n°39 — vérificateur impose après échec Mode 2)
    case 4: return 'ERREUR_TECHNIQUE_ESCALADE_HUMAINE';  // ⭐ v10.3 (Décision n°24 — escalade directe)
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
        // ⭐ v10.3 : suppression de la conversion 'ÉCART' → 'ECART'.
        // Le champ conforme_ecart est multilineText (accepte les 2 orthographes)
        // et la doctrine v1.9 prescrit l'accent É (Décision n°45). On préserve donc
        // strictement la valeur produite par le vérificateur.
        fields_to_patch[corr.champ] = nouvelle_valeur;
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
      // ⭐ v10.2a (29/04/2026) — Compteur de corrections par ligne (Décision n°38)
      // 1 = corrigée au tour 1 (Mode 1 ou Mode 2 sur scénario fiable)
      // 2 = corrigée au tour 2 (Mode 3, Phase 2c future)
      fields_to_patch.nb_corrections_verificateur = corrs.length;

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
