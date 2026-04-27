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

  // Construction du payload : on ne passe que ce qui est nécessaire à la vérification
  // (allège le contexte, augmente la saillance des règles critiques)
  const payload = {
    candidat_id,
    nb_lignes_a_verifier: rowsWithIds.length,
    instruction_certificateur: buildCertificateurInstruction(),
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

  // ─── Écrire le rapport synthétique dans CERTIFICATEUR_T1 (audit historique) ─
  // Conservation Lot 17 : permet de tracer chaque exécution du certificateur.
  await writeCertificateurReport({
    candidat_id,
    verdict,
    violations,
    nb_lignes_verifiees: rowsWithIds.length,
    cost_usd:            cost,
    elapsed_ms:          elapsedMs
  });

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

// ─── INSTRUCTION CERTIFICATEUR (étendue Lot 21 avec production + corrections) ─
function buildCertificateurInstruction() {
  return `
TU ES LE CERTIFICATEUR T1.

Ta mission : pour chaque ligne T1 reçue, tu fais 3 choses :
1. VÉRIFIER l'application stricte des règles doctrinales (Niveaux 1, 2, 3)
2. PRODUIRE le pilier_sortie pour les 25 lignes (champ délibérément hors périmètre T1)
3. ÉMETTRE une liste de corrections à appliquer dans ETAPE1_T1

Tu ne refais pas l'analyse cognitive du verbatim. Tu vérifies que T1 a appliqué les règles,
tu corriges quand T1 a manifestement dérivé, et tu produis le pilier_sortie.

═══════════════════════════════════════════════════════════════════════════
NIVEAU 1 — RÈGLES MÉCANIQUES (CRITIQUE — corrigées automatiquement)
═══════════════════════════════════════════════════════════════════════════

V1.1 — Cohérence v1_conforme ↔ conforme_ecart
  - Si v1_conforme = 'OUI' alors conforme_ecart DOIT être 'CONFORME'
  - Si v1_conforme = 'NON' alors conforme_ecart DOIT être 'ECART'
  - Toute autre combinaison est une violation CRITIQUE corrigée automatiquement.

V1.2 — ecart_detail rempli si ECART
  - Si conforme_ecart = 'ECART', alors ecart_detail DOIT être non vide
  - Si conforme_ecart = 'CONFORME', alors ecart_detail DOIT être vide
  - Correction automatique : vider ecart_detail si CONFORME.
    Si ECART et ecart_detail vide, flag CRITIQUE sans correction (l'agent doit fournir la justification).

═══════════════════════════════════════════════════════════════════════════
NIVEAU 2 — RÈGLES DOCTRINALES DE DIFFÉRENCIATION DES PILIERS (DOCTRINALE)
═══════════════════════════════════════════════════════════════════════════

V2.1 — Erreur 9 du prompt T1 : ne pas confondre verbe initial et angle d'attaque
  - Si pilier_coeur_analyse commence par P3 :
      Vérifie que le candidat produit bien une analyse causale autonome
      (pas une action conditionnelle, pas de génération multiple, pas d'exécution déguisée)
  - Indice : verbatim avec "j'analyse"/"j'évalue" en début, mais geste réel = filtrer/générer/agir.

V2.2 — Filtre crédibilité ≠ P3 cœur
  - « Évaluer la fiabilité d'une source = P3 au service de P1, le cœur reste P1. »
  - Si verbatim contient "j'analyse qui a produit", "je vérifie la source", "pas trop de [type]"
    et pilier_coeur = P3 : violation DOCTRINALE.

V2.3 — Solutions conditionnelles = P4 (pas P3)
  - « Si … alors X, sinon Y » avec actions différenciées et pilier_coeur = P3 : violation.

V2.4 — Action concrète ≠ P3
  - « Je consulte un spécialiste », « je m'adapte » = P5, pas P3.

Pour Niveau 2 : si tu détectes une violation, tu produis une correction.
La nouvelle valeur de pilier_coeur_analyse doit reformuler le pilier réellement déployé,
en conservant la description du geste cognitif (préfixe "Px · " puis description).

═══════════════════════════════════════════════════════════════════════════
NIVEAU 3 — SIGNAL LIMBIQUE (OBSERVATION — corrigé automatiquement)
═══════════════════════════════════════════════════════════════════════════

V3.1 — Signal limbique = rupture émotionnelle vive
  ✅ OUI : "ça me met hors de moi", "j'ai paniqué", "j'enrage", "ça m'agace" sur événement précis
  ❌ NON : préférence stylistique ("pas trop vulgarisateur"), difficulté objective ("la pire partie"),
          formulation conditionnelle-hedgée ("ça peut me contrarier si...")
  Si pas de rupture vive → violation V3.1 (sur-détection).
  Correction automatique : vider signal_limbique.

═══════════════════════════════════════════════════════════════════════════
PRODUCTION — CALCUL DE pilier_sortie (obligatoire pour les 25 lignes)
═══════════════════════════════════════════════════════════════════════════

Le champ pilier_sortie n'est PAS calculé par T1 (décision doctrinale).
Tu le calcules ici, pour chaque ligne, depuis attribution_pilier_signal_brut et verbatim_candidat.

Définition du pilier de sortie :
> Le DERNIER pilier réellement développé dans la réponse. Pas le pilier auquel on s'attendrait,
> pas celui qui clôt « logiquement » — celui que le verbatim développe en dernier dans la séquence cognitive.

Méthode mécanique :
1. Lire attribution_pilier_signal_brut (ex: "P1 · P3 + P5 Conforme" ou "P3 → P5 ÉCART")
2. Identifier la séquence ordonnée des piliers présents
3. pilier_sortie = dernier pilier de la séquence, sauf cas border :
   - Bascule conditionnelle très courte (1-2 mots) → c'est l'avant-dernier
   - Verbatim s'achève sur évaluation/compréhension/conception → sortie = pilier de cette zone finale

Cas standards :
- "P1 · P3 + P5" (CONFORME, P5 développé en fin) → pilier_sortie = P5
- "P3 → P1 → P4" → pilier_sortie = P4
- "P3 → P5" → pilier_sortie = P5
- "P1" seul → pilier_sortie = P1

Format : valeur P1 à P5 (jamais vide).
Trace : marque toujours la production du pilier_sortie en [PRODUCTION].

═══════════════════════════════════════════════════════════════════════════
FORMAT DE SORTIE — JSON UNIQUEMENT (pas de markdown, pas de préambule)
═══════════════════════════════════════════════════════════════════════════

{
  "candidat_id": "<id>",
  "verdict_global": "CONFORME | FLAG_OBSERVATIONS | CORRECTION REQUISE | BLOQUANT — CORRECTION REQUISE",
  "nb_violations_critique": 0,
  "nb_violations_doctrinale": 0,
  "nb_violations_observation": 0,
  "nb_lignes_corrigees": 0,
  "nb_pilier_sortie_produits": 25,
  "violations": [
    {
      "id_question": "Q5",
      "regle_violee": "V1.1 | V1.2 | V2.1 | V2.2 | V2.3 | V2.4 | V3.1",
      "severite": "CRITIQUE | DOCTRINALE | OBSERVATION",
      "details": "<observation>",
      "evidence_verbatim": "<extrait du verbatim>",
      "action_recommandee": "<correction suggérée>"
    }
  ],
  "corrections_a_appliquer": [
    {
      "id_question": "Q5",
      "champ": "pilier_coeur_analyse | pilier_sortie | conforme_ecart | ecart_detail | signal_limbique",
      "valeur_actuelle": "<valeur actuelle>",
      "valeur_corrigee": "<nouvelle valeur>",
      "type": "V1.1 | V1.2 | V2.1 | V2.2 | V2.3 | V2.4 | V3.1 | PRODUCTION",
      "raison": "<phrase courte>"
    }
  ],
  "synthese": "<résumé en 2-3 phrases>"
}

═══════════════════════════════════════════════════════════════════════════
RÈGLES DE REMPLISSAGE
═══════════════════════════════════════════════════════════════════════════

- corrections_a_appliquer contient TOUS les patches à appliquer : violations corrigées
  (V1.x, V2.x, V3.x) + production de pilier_sortie pour les 25 lignes.
- nb_lignes_corrigees = nombre de lignes T1 distinctes dont au moins un champ a été
  corrigé (hors production seule de pilier_sortie).
- nb_pilier_sortie_produits = nombre de lignes pour lesquelles pilier_sortie a été
  calculé (idéalement 25).

VERDICT GLOBAL :
- CONFORME : aucune violation, uniquement production de pilier_sortie
- FLAG_OBSERVATIONS : seulement violations OBSERVATION (V3.1) — corrigées
- CORRECTION REQUISE : violations DOCTRINALE détectées et corrigées
- BLOQUANT — CORRECTION REQUISE : violations CRITIQUE détectées (corrigées si possible, sinon flagguées)
  `.trim();
}

// ─── ÉCRITURE DU RAPPORT (table CERTIFICATEUR_T1 — audit historique) ──────
async function writeCertificateurReport({
  candidat_id,
  verdict,
  violations,
  nb_lignes_verifiees,
  cost_usd,
  elapsed_ms
}) {
  if (typeof airtableService.writeCertificateurT1 === 'function') {
    await airtableService.writeCertificateurT1({
      candidat_id,
      verdict_global:        verdict,
      nb_lignes_verifiees,
      nb_violations_total:   violations.length,
      nb_critique:           violations.filter(v => v.severite === 'CRITIQUE').length,
      nb_doctrinale:         violations.filter(v => v.severite === 'DOCTRINALE').length,
      nb_observation:        violations.filter(v => v.severite === 'OBSERVATION').length,
      violations_json:       JSON.stringify(violations, null, 2),
      cost_usd:              cost_usd.toFixed(4),
      elapsed_ms,
      timestamp:             new Date().toISOString()
    });
  } else {
    logger.warn('airtableService.writeCertificateurT1 not implemented yet — report not persisted');
  }
}

module.exports = {
  runCertificateurT1,
  buildCertificateurInstruction,
  buildPatchPlan
};
