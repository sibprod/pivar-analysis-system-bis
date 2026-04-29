// services/etape1/agentT1VerificateurService.js
// Vérificateur T1 — Vérification doctrinale + Production + Corrections actives
// Profil-Cognitif v10.0
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

  // Construction du payload : on ne passe que les données nécessaires à la vérification
  // ⚠️ ANONYMISATION : aucun prénom, uniquement candidat_id (Décision n°4)
  const payload = {
    candidat_id,
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

  const verdict       = result?.verdict_global || 'INDETERMINE';
  const violations    = Array.isArray(result?.violations) ? result.violations : [];
  const corrections   = Array.isArray(result?.corrections_a_appliquer) ? result.corrections_a_appliquer : [];
  const nb_critique   = result?.nb_violations_critique || 0;
  const nb_doctrinale = result?.nb_violations_doctrinale || 0;
  const nb_observation = result?.nb_violations_observation || 0;

  // ⭐ v10 : Calcul du mode recommandé (Décisions n°15, n°16, n°24)
  const mode_recommande = determinerMode({
    nb_critique,
    nb_doctrinale,
    tentatives_actuelles
  });

  logger.info('Vérificateur T1 — verdict received', {
    candidat_id,
    verdict,
    mode_recommande,
    nb_violations:  violations.length,
    nb_corrections: corrections.length,
    nb_critique,
    nb_doctrinale,
    nb_observation,
    cost_usd:       cost.toFixed(4),
    elapsedMs
  });

  // ⭐ v10 : Tracer dans VERIFICATEUR_T1 (Décision n°10)
  await airtableService.writeVerificateurT1(candidat_id, {
    verdict_global:        verdict,
    nb_lignes_verifiees:   rowsWithIds.length,
    nb_violations_total:   violations.length,
    nb_critique,
    nb_doctrinale,
    nb_observation,
    violations_json:       violations,
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
    violations,
    corrections,
    mode_recommande,    // ⭐ v10 — pour aiguillage orchestrateur
    nb_critique,
    nb_doctrinale,
    nb_observation,
    usage,
    cost,
    elapsedMs
  };
}

/**
 * Détermine le mode opérationnel selon les comptes de violations et les tentatives
 * (Décisions n°15, n°16, n°24)
 */
function determinerMode({ nb_critique, nb_doctrinale, tentatives_actuelles }) {
  // Si verdict critique → Mode 4 (retry T1) si tentatives < 2, sinon Mode 3 (validation humaine)
  if (nb_critique > 0) {
    if (tentatives_actuelles < 2) {
      return 4;  // Mode 4 — relance automatique T1
    } else {
      return 3;  // Mode 3 — escalade vers Isabelle
    }
  }

  // Si violations doctrinales → Mode 2 (corrections directes)
  if (nb_doctrinale > 0) {
    return 2;
  }

  // Sinon → Mode 1 (conforme)
  return 1;
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

      // Appliquer la correction sur le champ
      if (corr.champ && typeof corr.valeur_corrigee !== 'undefined') {
        // Normaliser ECART/ÉCART pour Airtable
        let valueToWrite = corr.valeur_corrigee;
        if (corr.champ === 'conforme_ecart' && valueToWrite === 'ÉCART') {
          valueToWrite = 'ECART';
        }
        fields_to_patch[corr.champ] = valueToWrite;
      }

      // Construire la trace lisible
      const tag       = `[${corr.type || '?'}]`;
      const champ     = corr.champ || '?';
      const ancienne  = (corr.valeur_actuelle === '' || corr.valeur_actuelle === null || typeof corr.valeur_actuelle === 'undefined') ? '∅' : `"${corr.valeur_actuelle}"`;
      const nouvelle  = (corr.valeur_corrigee === '' || corr.valeur_corrigee === null) ? '∅' : `"${corr.valeur_corrigee}"`;
      const raison    = corr.raison || '';
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
  buildVerificateurPatchPlan
};
