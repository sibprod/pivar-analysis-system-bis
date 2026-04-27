// services/agentT1CertificateurService.js
// Certificateur T1 — Vérification doctrinale + Production + Corrections actives
// Profil-Cognitif v9.1 — Lot 17 (Doctrine) + Lot 21 (Actif)
//
// Rôle :
//   - Lit les 25 lignes T1 produites par l'agent T1
//   - Vérifie l'application stricte des règles critiques (Niveaux 1, 2, 3)
//   - ⭐ LOT 21 : produit le pilier_sortie (calcul depuis attribution_pilier_signal_brut)
//   - ⭐ LOT 21 : applique les corrections directement dans ETAPE1_T1 (PATCH ciblé)
//   - ⭐ LOT 21 : trace les corrections dans le champ corrections_certificateur
//   - Écrit toujours le rapport synthétique dans la table CERTIFICATEUR_T1 (audit)
//
// DOCTRINE APPLIQUÉE :
//   - Pilier 1 : thinking activé pour ce certificateur
//   - Pilier 6 : indépendance — prompt distinct, contexte distinct
//   - Pilier 7 : log complet
//
// Mission étendue Lot 21 : vérifier + corriger + compléter (pas que vérifier).

'use strict';

const agentBase       = require('./agentBase');
const airtableService = require('./airtableService');
const logger          = require('../utils/logger');

const SERVICE_NAME = 'agent_t1_certificateur';
const PROMPT_PATH  = 'certificateur_t1.txt';

/**
 * Exécute le certificateur T1 sur les 25 lignes produites par T1
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Array}  params.rows_t1 — les 25 lignes T1 à vérifier (avec airtable_id)
 * @returns {Promise<{verdict, violations, corrections, usage, cost, elapsedMs}>}
 */
async function runCertificateurT1({ candidat_id, rows_t1 }) {
  const startTime = Date.now();
  logger.info('Certificateur T1 starting', { candidat_id, lignes_a_verifier: rows_t1.length });

  if (!rows_t1 || rows_t1.length === 0) {
    throw new Error(`No T1 rows to certify for ${candidat_id}`);
  }

  // ⭐ LOT 21 : si les rows n'ont pas leur airtable_id (cas où on les passe
  // directement depuis le résultat de runAgentT1 sans re-lire Airtable),
  // on les recharge pour avoir les airtable_id nécessaires au PATCH.
  let rowsWithIds = rows_t1;
  const hasAirtableIds = rows_t1.every(r => r && r.airtable_id);
  if (!hasAirtableIds) {
    logger.info('Certificateur T1 — re-reading T1 rows from Airtable to get airtable_id', { candidat_id });
    rowsWithIds = await airtableService.getEtape1T1(candidat_id);
  }

  // Construction du payload : on ne passe que les données nécessaires à la vérification.
  // ⭐ LOT 21-bis : suppression de instruction_certificateur (redondante avec le prompt
  // fichier certificateur_t1.txt qui contient déjà les règles V1.x, V2.x, V3.x et
  // la doctrine de production de pilier_sortie). Le doublon faisait exploser le
  // contexte et le thinking.
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
      pilier_sortie:                 row.pilier_sortie || '',
      attribution_pilier_signal_brut: row.attribution_pilier_signal_brut,
      raisonnement:                  row.raisonnement || ''
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

  const verdict     = result?.verdict_global || 'INDETERMINE';
  const violations  = Array.isArray(result?.violations) ? result.violations : [];
  const corrections = Array.isArray(result?.corrections_a_appliquer) ? result.corrections_a_appliquer : [];

  logger.info('Certificateur T1 — verdict received', {
    candidat_id,
    verdict,
    nb_violations: violations.length,
    nb_corrections: corrections.length,
    nb_critique: result?.nb_violations_critique || 0,
    nb_doctrinale: result?.nb_violations_doctrinale || 0,
    nb_observation: result?.nb_violations_observation || 0,
    nb_pilier_sortie_produits: result?.nb_pilier_sortie_produits || 0,
    cost_usd: cost.toFixed(4),
    elapsedMs
  });

  // ─── ⭐ LOT 21 : Appliquer les corrections sur ETAPE1_T1 ───────────────────
  if (corrections.length > 0) {
    const patchPlan = buildPatchPlan(rowsWithIds, corrections);
    if (patchPlan.length > 0) {
      await airtableService.patchEtape1T1Rows(candidat_id, patchPlan);
      logger.info('Certificateur T1 — patches applied', {
        candidat_id,
        lignes_patchees: patchPlan.length
      });
    }
  } else {
    logger.warn('Certificateur T1 — no corrections produced (unexpected, pilier_sortie should always be produced)', {
      candidat_id
    });
  }

  return { verdict, violations, corrections, usage, cost, elapsedMs };
}

// ──────────────────────────────────────────────────────────────────────────
// ⭐ LOT 21 — Construction du plan de patch
//
// Transforme la liste plate de corrections (1 entrée par champ corrigé) en
// un plan groupé par ligne T1 (1 entrée par ligne, contenant tous les champs
// à patcher + la trace à écrire dans corrections_certificateur).
//
// Format de sortie :
//   [
//     {
//       airtable_id: 'rec...',
//       id_question: 'Q5',
//       fields_to_patch: { pilier_sortie: 'P5', conforme_ecart: 'CONFORME', corrections_certificateur: 'trace...' },
//       nb_corrections: 2
//     },
//     ...
//   ]
// ──────────────────────────────────────────────────────────────────────────
function buildPatchPlan(rows_t1, corrections) {
  // Indexer les rows par id_question pour retrouver airtable_id
  const rowsByIdQuestion = new Map();
  for (const row of rows_t1) {
    rowsByIdQuestion.set(row.id_question, row);
  }

  // Grouper les corrections par id_question
  const correctionsByIdQuestion = new Map();
  for (const corr of corrections) {
    const idQ = corr.id_question;
    if (!correctionsByIdQuestion.has(idQ)) {
      correctionsByIdQuestion.set(idQ, []);
    }
    correctionsByIdQuestion.get(idQ).push(corr);
  }

  // Construire le plan de patch
  const plan = [];
  for (const [idQ, corrs] of correctionsByIdQuestion.entries()) {
    const row = rowsByIdQuestion.get(idQ);
    if (!row || !row.airtable_id) {
      logger.warn('Certificateur T1 — ligne T1 introuvable pour correction', { id_question: idQ });
      continue;
    }

    // Préparer les fields à patcher
    const fields_to_patch = {};
    const traces = [];

    for (const corr of corrs) {
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

    // Ajouter le champ corrections_certificateur à patcher
    fields_to_patch.corrections_certificateur = traces.join('\n');

    plan.push({
      airtable_id:      row.airtable_id,
      id_question:      idQ,
      fields_to_patch,
      nb_corrections:   corrs.length
    });
  }

  return plan;
}


module.exports = {
  runCertificateurT1,
  buildPatchPlan
};
