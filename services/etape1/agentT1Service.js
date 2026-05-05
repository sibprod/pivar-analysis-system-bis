// services/etape1/agentT1Service.js
// Agent T1 — Analyse brute des 25 réponses du candidat
// Profil-Cognitif v10.6
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et docs/CONTRAT_ETAPE1.md (v1.10 prévue avec Décisions n°47-49)
//
// Rôle :
//   - Lit les 25 réponses brutes du candidat depuis RESPONSES (frontend)
//   - Appelle l'agent Claude T1 en 5 APPELS distincts (1 par scénario doctrinal)
//     • SOMMEIL  (Q1-Q5)   → 5 questions
//     • WEEKEND  (Q6-Q10)  → 5 questions
//     • ANIMAL_1 (Q11-Q15) → 5 questions
//     • ANIMAL_2 (Q16-Q20) → 5 questions
//     • PANNE    (Q21-Q25) → 5 questions
//   - ⭐ v10.4 : Écrit les 5 lignes de chaque scénario en Airtable APRÈS chaque
//     scénario (Décision n°47), pour permettre la reprise via REPRENDRE_T1_<X>_SEUL
//     en cas de crash.
//
// DOCTRINE APPLIQUÉE (cf. docs/CONTRAT_ETAPE1.md v1.9) :
//   - Pilier 1 : thinking activé (claude.js THINKING.agent_t1 = true)
//   - Pilier 2 : découpage par unité narrative (5 scénarios — Décision n°40)
//   - Pilier 6 : vérificateur T1 v1.2 appelé après (agentT1VerificateurService)
//   - Pilier 7 : log complet
//   - Décision n°47 : écriture incrémentale par scénario (point de reprise)
//   - Toute la doctrine d'analyse vit dans le prompt etape1_t1.txt v3.2 — PAS dans ce code.
//
// PHASE D (2026-04-28) — v10 :
//   - Déplacé dans services/etape1/ (Décision n°27)
//   - PROMPT_PATH mis à jour : 'etape1/etape1_t1.txt' (Décision n°27)
//   - Champ pilier_sortie RETIRÉ (Décision n°5 — D-A : pilier_sortie abandonné)
//   - Anonymisation Décision n°4 : DÉJÀ CONFORME — payload utilise candidat_id, jamais le prénom
//
// PHASE v10.2b (2026-05-03) — relances par scénario (Décision n°42) :
//   - Ajout runAgentT1ForScenario : exécution T1 sur 1 seul scénario
//     Réutilise callT1ForScenario interne. Strictement additif.
//     Utilisé par orchestratorEtape1 dans modes SCENARIO_ISOLÉ et SCENARIO_CASCADE.
//
// PHASE v10.3 — annulée (jamais en prod, fusionnée dans v10.4).
//
// PHASE v10.4 (2026-05-04) — alignement T1 v3.2 + écriture incrémentale (Décisions n°43-47) :
//   ⚠️ DEUX CHANGEMENTS CRITIQUES — applique tout ce qui était prévu en v10.3
//      plus la Décision n°47 (écriture par scénario).
//
//   1. Mapping Airtable enrichi des 5 nouveaux champs grille à 3 niveaux v1.9
//      (Décisions n°43, n°46) dans normalizeRowForAirtable :
//        - pilier_finalite          (recopie de pilier_demande)
//        - pilier_finalite_libelle  (nom officiel court)
//        - pilier_coeur             (code court isolé du pilier coeur)
//        - outil_cognitif_libelle   (libellé court du filtre cognitif)
//        - piliers_traverses        (codes courts des piliers traversés)
//      Bug corrigé : avant v10.4, ces 5 champs étaient produits par le prompt
//      T1 v3.2 mais perdus dans le mapping. Résultat : 25 lignes Airtable
//      avec 5 cellules vides systématiquement (cf. analyse Véronique 04/05).
//
//   2. ÉCRITURE INCRÉMENTALE PAR SCÉNARIO (Décision n°47) :
//      Avant v10.4 : T1 faisait les 5 appels Claude en série puis écrivait les
//      25 lignes en bloc à la fin (writeEtape1T1 unique). Si crash sur le 4ème
//      ou 5ème scénario, TOUT était perdu — pas de reprise ciblée possible.
//
//      v10.4 : nettoyage préalable scénario par scénario, puis dans la boucle,
//      à chaque fin de scénario réussie :
//        1. write les 5 nouvelles lignes IMMÉDIATEMENT en Airtable
//        2. log "✅ Scenario X écrit, point de reprise possible"
//
//      Bénéfices :
//      - Crash sur scénario N → les scénarios 1..N-1 sont en base
//      - Reprise possible via statut REPRENDRE_T1_<X>_SEUL (Famille A, Décision n°42)
//      - Visibilité immédiate dans Airtable du progrès du run (debug live)
//
//   3. Conservation accent É dans 'ÉCART' (Décision n°45) :
//      Suppression de la conversion forcée 'ÉCART' → 'ECART'. Le champ Airtable
//      conforme_ecart est multilineText, accepte les 2. La doctrine v1.9 prescrit
//      l'accent É.
//
//   4. Suppression de buildDoctrineInstruction obsolète :
//      Cette fonction injectait des instructions doctrinales héritées du contrat
//      v1.7, devenues contradictoires avec v1.9 (notamment règle "incarne PY"
//      abandonnée par Décision n°45 ; et règle "filtrage par crédibilité = P2"
//      contredite par Décision n°43 — Cécile P1Q2 = P3 directeur).
//      Désormais, toute la doctrine vit UNIQUEMENT dans le prompt etape1_t1.txt v3.2.
//      Cf. règle de gouvernance v10.4 : aucune doctrine dans le code service.
//
//   Briques techniques utilisées (existantes depuis v10.2b) :
//   - airtableService.deleteEtape1T1Scenario(candidat_id, scenario_name)
//   - airtableService.writeEtape1T1Scenario(candidat_id, rows)
//
// PHASE v10.4.1 (2026-05-04 soir) — Décision n°48 : suppression du champ orphelin `raisonnement` :
//   Audit du 04/05 sur les 3 candidats référents (Cécile, Rémi, Véronique = 75 lignes
//   ETAPE1_T1) a révélé que le champ `raisonnement` reste systématiquement vide :
//   - Le prompt T1 v3.2 (707 lignes) ne demande pas ce champ en sortie JSON
//   - Le prompt Vérificateur v1.2 (645 lignes) ne le mentionne jamais
//   - Le service écrivait `raisonnement: row.raisonnement || ''` → toujours vide
//   Le raisonnement nécessaire est déjà tracé par pilier_coeur_analyse (T1),
//   corrections_verificateur (Vérif), violations_json (VERIFICATEUR_T1).
//   Le champ est supprimé côté code ET côté Airtable (ETAPE1_T1).
//   ⚠️ ORDRE D'EXÉCUTION CRITIQUE : ce patch service doit être déployé AVANT
//   la suppression du champ Airtable, sinon écriture 422 « field not found ».
//
// PHASE v10.5 (2026-05-05) — Doctrine v2 v3.3 (Décision n°49) :
//   Doctrine v2_traite_problematique reformulée par Isabelle. La règle vague
//   "généralement OUI sauf dérive totale" du prompt v3.2 est remplacée par
//   2 questions binaires séparées :
//     A — v2_repond_question : OUI/NON, le candidat répond-il à la question
//         stricte (réécrite dans le champ réponse côté frontend) ?
//         Qu'importe le pilier mobilisé.
//     B — v2_repond_situation : OUI_TRANSITION / OUI_STORYTELLING /
//         OUI_SITUATION_CONSTRUITE / NON. Si le candidat ne répond pas à la
//         question, à quoi répond-il ? À la transition narrative immédiate,
//         au storytelling général, ou à sa propre lecture mentale qu'il a
//         construite au fil des questions ?
//   Verdict synthétique : v2_traite_problematique = OUI si A=OUI, sinon NON.
//
//   Mapping enrichi de 3 nouveaux champs dans normalizeRowForAirtable :
//     - v2_repond_question     (singleSelect OUI/NON)
//     - v2_repond_situation    (singleSelect 4 valeurs)
//     - v2_analyse             (multilineText : 1-3 phrases justification)
//
//   Ces 3 champs ont été créés en Airtable le 05/05/2026 (Field IDs réels
//   visibles dans config/airtable.js v10.4 en-tête).
//
//   La nouvelle doctrine v2 vit dans le prompt T1 v3.3 (etape1_t1.txt v3.3,
//   section v2_traite_problematique reformulée). Le code service ne porte
//   aucune doctrine — seulement la tuyauterie (règle de gouvernance v10.4).
//
// PHASE v10.6 (2026-05-05) — Injection du référentiel piliers :
//   Correction d'un bug de gouvernance qui existait depuis le début du pipeline T1.
//
//   Le prompt T1 promet à l'agent qu'il reçoit `referentiel_piliers` dans son
//   payload (table REFERENTIEL_PILIERS, 5 enregistrements doctrinaux). Cette
//   promesse n'était pas tenue côté service : seul le service vérificateur
//   chargeait et injectait le référentiel. L'agent T1 travaillait donc sans
//   la doctrine officielle des 5 piliers en main et s'en sortait avec ses
//   connaissances générales — ce qui explique en partie pourquoi T1 ratait
//   systématiquement les pièges de la matrice (P3 directeur, P4 dispositif,
//   P5 normatif, etc.).
//
//   Modifications :
//     1. Chargement de referentiel_piliers via airtableService.getReferentielPiliers()
//        avant la construction du payload (pattern aligné avec le vérificateur).
//     2. Garde-fou Guard V1.0 : arrêt si le référentiel n'a pas exactement 5 piliers.
//     3. Injection dans le payload sous la clé `referentiel_piliers`.
//
//   Cette injection est faite UNE FOIS PAR SCÉNARIO (5 appels par candidat),
//   au même titre que le vérificateur charge le référentiel à chaque appel.
//   Coût négligeable (lecture Airtable de 5 enregistrements).

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const SERVICE_NAME = 'agent_t1';
const PROMPT_PATH  = 'etape1/etape1_t1.txt';  // ⭐ v10 : nouvelle hiérarchie

// ─── DÉFINITION DES SCÉNARIOS (unités narratives — Pilier 2 doctrine) ──────
const SCENARIOS = [
  { name: 'SOMMEIL',  questionRange: [1, 5],   expectedQuestions: 5 },
  { name: 'WEEKEND',  questionRange: [6, 10],  expectedQuestions: 5 },
  { name: 'ANIMAL_1', questionRange: [11, 15], expectedQuestions: 5 },
  { name: 'ANIMAL_2', questionRange: [16, 20], expectedQuestions: 5 },
  { name: 'PANNE',    questionRange: [21, 25], expectedQuestions: 5 }
];

/**
 * Exécute l'agent T1 pour un candidat — 5 appels par scénario
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {string} params.session_id
 * @returns {Promise<{rows: Array, usage: Object, cost: number, elapsedMs: number}>}
 */
async function runAgentT1({ candidat_id, session_id }) {
  const startTime = Date.now();
  logger.info('Agent T1 starting (DOCTRINAL — 5 scénarios)', { candidat_id, session_id });

  // 1. Lire les 25 réponses brutes
  const responses = await airtableService.getResponses(session_id);

  if (!responses || responses.length === 0) {
    throw new Error(`No responses found for session ${session_id}`);
  }

  if (responses.length < 25) {
    logger.warn('Responses count below 25', { candidat_id, count: responses.length });
  }

  // 2. Grouper les réponses par scénario
  const responsesByScenario = groupResponsesByScenario(responses);

  // 2bis. ⭐ v10.4 — Nettoyage préalable scénario par scénario (Décision n°47).
  // Avant la boucle, on supprime les éventuelles lignes pré-existantes du candidat
  // pour chaque scénario. Comme l'écriture est désormais incrémentale (write
  // immédiatement après chaque scénario), on ne peut plus s'appuyer sur le
  // delete-then-create global de writeEtape1T1. On nettoie donc en amont pour
  // éviter doublons et résidus si le candidat avait déjà tourné précédemment
  // (ex: ré-exécution complète après ERREUR ou changement de statut manuel).
  logger.info('Agent T1 — nettoyage préalable ETAPE1_T1 par scénario (v10.4)', { candidat_id });
  for (const scenario of SCENARIOS) {
    try {
      await airtableService.deleteEtape1T1Scenario(candidat_id, scenario.name);
    } catch (err) {
      // Si delete échoue sur un scénario, on continue. Le scénario sera quand
      // même écrit après l'analyse Claude. Risque résiduel : doublons si delete
      // KO mais write OK. Préférable à bloquer tout le run pour une erreur
      // transitoire Airtable. Le vérificateur détectera tout résidu anormal.
      logger.warn(`Agent T1 — delete préalable ${scenario.name} échoué (non bloquant)`, {
        candidat_id, error: err.message
      });
    }
  }

  // 3. Appeler l'agent 5 fois (1 par scénario), avec ÉCRITURE INCRÉMENTALE
  const allRows = [];
  let totalUsage = { input_tokens: 0, output_tokens: 0, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 };
  let totalCost  = 0;

  for (const scenario of SCENARIOS) {
    const scenarioResponses = responsesByScenario[scenario.name] || [];

    if (scenarioResponses.length === 0) {
      logger.warn(`No responses for scenario ${scenario.name}`, { candidat_id });
      continue;
    }

    if (scenarioResponses.length !== scenario.expectedQuestions) {
      logger.warn(`Unexpected number of responses for scenario ${scenario.name}`, {
        candidat_id,
        expected: scenario.expectedQuestions,
        actual:   scenarioResponses.length
      });
    }

    logger.info(`Agent T1 — calling for scenario ${scenario.name}`, {
      candidat_id,
      questions: scenarioResponses.length
    });

    const { rows, usage, cost } = await callT1ForScenario({
      candidat_id,
      scenario,
      responses: scenarioResponses
    });

    allRows.push(...rows);
    totalUsage.input_tokens             += usage.input_tokens || 0;
    totalUsage.output_tokens            += usage.output_tokens || 0;
    totalUsage.cache_read_input_tokens  += usage.cache_read_input_tokens || 0;
    totalUsage.cache_creation_input_tokens += usage.cache_creation_input_tokens || 0;
    totalCost += cost;

    logger.info(`Agent T1 — scenario ${scenario.name} done`, {
      candidat_id,
      rows:         rows.length,
      cost_usd:     cost.toFixed(4),
      ecarts:       rows.filter(r => r.conforme_ecart === 'ÉCART' || r.conforme_ecart === 'ECART').length
    });

    // ⭐ v10.4 — ÉCRITURE INCRÉMENTALE EN AIRTABLE (Décision n°47)
    // On écrit les 5 lignes du scénario IMMÉDIATEMENT après réception du
    // résultat Claude. Si un scénario ultérieur plante (timeout, output_truncated),
    // les scénarios déjà traités sont préservés en base et accessibles via
    // REPRENDRE_T1_<X>_SEUL (Famille A — Décision n°42).
    try {
      const normalizedRows = rows.map(normalizeRowForAirtable);
      const written = await airtableService.writeEtape1T1Scenario(candidat_id, normalizedRows);
      logger.info(`✅ Scenario ${scenario.name} écrit en Airtable — point de reprise possible`, {
        candidat_id,
        scenario: scenario.name,
        rows_written: written
      });
    } catch (err) {
      // Si l'écriture Airtable échoue, on remonte l'erreur : ça veut dire
      // qu'Airtable est down ou que le mapping est cassé. Inutile de continuer
      // les scénarios suivants — l'orchestrateur verra l'erreur et passera le
      // candidat en ERREUR.
      logger.error(`Agent T1 — échec écriture scénario ${scenario.name}`, {
        candidat_id,
        scenario: scenario.name,
        error: err.message
      });
      throw err;
    }
  }

  const elapsedMs = Date.now() - startTime;

  if (allRows.length === 0) {
    throw new Error('Agent T1 returned no rows across all scenarios');
  }

  logger.info('Agent T1 produced rows (TOTAL across 5 scenarios)', {
    candidat_id,
    count:           allRows.length,
    ecarts_detected: allRows.filter(r => r.conforme_ecart === 'ÉCART' || r.conforme_ecart === 'ECART').length,
    total_cost_usd:  totalCost.toFixed(4),
    elapsedMs
  });

  // ⭐ v10.4 — Le writeEtape1T1 global de fin de boucle est SUPPRIMÉ.
  // Les 25 lignes ont déjà été écrites scénario par scénario dans la boucle
  // ci-dessus (Décision n°47). Un write final ferait des doublons.

  return { rows: allRows, usage: totalUsage, cost: totalCost, elapsedMs };
}

// ─── APPEL T1 POUR UN SCÉNARIO ────────────────────────────────────────────
async function callT1ForScenario({ candidat_id, scenario, responses }) {
  // Construire le payload pour ce scénario uniquement
  // ⚠️ ANONYMISATION : aucun prénom, uniquement candidat_id (Décision n°4)
  // ⚠️ v10.4 : plus d'instruction doctrinale injectée. Toute la doctrine vit
  //           dans le prompt T1 v3.3 (etape1_t1.txt). Cf. Décision n°35
  //           (primat du fond sur la technique) et règle de gouvernance v10.4 :
  //           aucune instruction doctrinale ne doit vivre dans le code service.

  // ⭐ v10.6 — Chargement du référentiel des 5 piliers cognitifs
  // Le prompt T1 attend l'objet `referentiel_piliers` dans son payload pour
  // appliquer la doctrine officielle des 5 piliers (description du geste,
  // pieges_avertissements, dimensions d'analyse, modes opérationnels,
  // exemples). Sans cette injection, l'agent travaillerait à l'aveugle.
  // Pattern aligné avec le service vérificateur v10.4.
  const referentiel_piliers = await airtableService.getReferentielPiliers();
  if (!referentiel_piliers || referentiel_piliers.length !== 5) {
    throw new Error(
      `Agent T1 — référentiel piliers incomplet ou corrompu (${referentiel_piliers?.length || 0}/5). ` +
      `Guard V1.0 : arrêt avant exécution sur le scénario ${scenario.name}.`
    );
  }
  logger.info('Agent T1 — référentiel piliers chargé', {
    candidat_id,
    scenario: scenario.name,
    nb_piliers: referentiel_piliers.length
  });

  const payload = {
    candidat_id,
    scenario_name:           scenario.name,
    nb_questions_in_scenario: responses.length,
    nb_questions_total:      25,
    referentiel_piliers,                                      // ⭐ v10.6 — doctrine officielle des 5 piliers
    responses: responses.map(r => ({
      id_question:           r.id_question,
      numero_global:         r.numero_global,
      pilier:                r.pilier,
      scenario_nom:          r.scenario_nom,
      question_text:         r.question_text,
      response_text:         r.response_text,
      storytelling:          extractLookup(r['storytelling_general (from question _lien)']) || r.storytelling || '',
      transition:            extractLookup(r['transition_narrative (from question _lien)']) || r.transition || ''
    }))
  };

  // Appel Claude (thinking activé via claude.js THINKING.agent_t1 = true)
  const { result, usage, cost } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: false,
    candidatId:    candidat_id
  });

  const rows = extractRows(result, candidat_id);
  return { rows, usage, cost };
}

// ─── INSTRUCTION DOCTRINALE — SUPPRIMÉE EN v10.4 ──────────────────────────
// La fonction buildDoctrineInstruction a été supprimée en v10.4.
// Raison : son contenu était hérité du contrat v1.7 et devenu contradictoire
// avec la doctrine v1.9 (Décisions n°43-46). Notamment :
//   - "V1=OUI → toujours CONFORME, sans exception" contredit la règle simplifiée
//     de Décision n°45 (un coeur ≠ finalité avec finalité présente comme pilier
//     traversé pleinement effectué = aussi CONFORME).
//   - "Filtrer une source par crédibilité = P2 (pas P3 cœur)" contredit la
//     Décision n°43 et l'exemple F du prompt T1 v3.2 (Cécile P1Q2 : filtrer
//     par jugement de crédibilité = P3 directeur).
// Désormais, toute la doctrine vit dans le prompt etape1_t1.txt v3.2 (707 lignes,
// 8 exemples, test discriminant, règle geste effectué vs mention de surface).
// Le code service ne porte plus aucune doctrine — seulement la tuyauterie.
// Cf. règle de gouvernance v10.4.

// ─── GROUPAGE PAR SCÉNARIO ────────────────────────────────────────────────
function groupResponsesByScenario(responses) {
  const grouped = { SOMMEIL: [], WEEKEND: [], ANIMAL_1: [], ANIMAL_2: [], PANNE: [] };

  for (const r of responses) {
    const scenarioName = (r.scenario_nom || '').toUpperCase().trim();
    const nq = parseInt(r.numero_global, 10);
    if (scenarioName === 'SOMMEIL')       grouped.SOMMEIL.push(r);
    else if (scenarioName === 'WEEKEND')  grouped.WEEKEND.push(r);
    else if (scenarioName === 'ANIMAL' || scenarioName === 'ANIMAL_1' || scenarioName === 'ANIMAL_2') {
      // Découpage par numero_global : Q11-15 → ANIMAL_1, Q16-20 → ANIMAL_2
      if (nq >= 11 && nq <= 15) grouped.ANIMAL_1.push(r);
      else if (nq >= 16 && nq <= 20) grouped.ANIMAL_2.push(r);
    }
    else if (scenarioName === 'PANNE')    grouped.PANNE.push(r);
    else {
      // Fallback : déduire du numero_global
      if (nq >= 1 && nq <= 5)        grouped.SOMMEIL.push(r);
      else if (nq >= 6 && nq <= 10)  grouped.WEEKEND.push(r);
      else if (nq >= 11 && nq <= 15) grouped.ANIMAL_1.push(r);
      else if (nq >= 16 && nq <= 20) grouped.ANIMAL_2.push(r);
      else if (nq >= 21 && nq <= 25) grouped.PANNE.push(r);
      else logger.warn('Cannot determine scenario for response', { id_question: r.id_question });
    }
  }

  // Trier chaque scénario par numero_global
  for (const name of Object.keys(grouped)) {
    grouped[name].sort((a, b) => (parseInt(a.numero_global, 10) || 0) - (parseInt(b.numero_global, 10) || 0));
  }

  return grouped;
}

// ─── EXTRACTION DES LIGNES (5 niveaux de tolérance) ───────────────────────
function extractRows(result, candidat_id) {
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.lignes)) return result.lignes;
  if (Array.isArray(result?.t1)) return result.t1;
  if (Array.isArray(result)) return result;
  if (result?.candidat_id && result?.id_question) {
    logger.warn('Agent T1 returned single object instead of array', { candidat_id });
    return [result];
  }

  logger.error('Unable to extract T1 rows from agent output', {
    candidat_id,
    keys: result ? Object.keys(result) : null
  });
  throw new Error('Agent T1 output format not recognized');
}

// ─── NORMALISATION POUR AIRTABLE ──────────────────────────────────────────
// ⚠️ v10 : pilier_sortie RETIRÉ (Décision n°5)
function normalizeRowForAirtable(row) {
  let conformeEcart = row.conforme_ecart || '';
  // ⭐ v10.4 : suppression de la conversion forcée 'ÉCART' → 'ECART'.
  //           Le champ Airtable conforme_ecart est multilineText (accepte les 2)
  //           et la doctrine v1.9 prescrit l'accent É (Décision n°45).
  if (conformeEcart && conformeEcart !== 'CONFORME' && conformeEcart !== 'ÉCART' && conformeEcart !== 'ECART') {
    logger.warn('Unexpected conforme_ecart value', { value: conformeEcart });
  }

  // ⭐ v10.4.1 — Décision n°48 (04/05/2026) : champ `raisonnement` SUPPRIMÉ.
  //           Audit du 04/05 a montré que ce champ restait systématiquement vide
  //           sur les 75 lignes des 3 candidats référents : ni le prompt T1 v3.2
  //           ni le prompt Vérificateur v1.2 ne le demandent. Le raisonnement
  //           nécessaire est déjà tracé par pilier_coeur_analyse (T1),
  //           corrections_verificateur (Vérif) et violations_json (VERIFICATEUR_T1).
  //           Le champ a également été supprimé côté Airtable (ETAPE1_T1).
  //           ⚠️ ORDRE : ce patch service doit être déployé AVANT la suppression
  //           Airtable, sinon écriture 422 « field not found ».

  return {
    id_question:                   row.id_question || '',
    question_id_protocole:         row.question_id_protocole || '',
    scenario:                      row.scenario || '',
    pilier_demande:                row.pilier_demande || '',
    question_texte:                row.question_texte || '',
    storytelling:                  row.storytelling || '',
    transition:                    row.transition || '',
    verbatim_candidat:             row.verbatim_candidat || '',
    v1_conforme:                   row.v1_conforme || '',
    v2_traite_problematique:       row.v2_traite_problematique || '',
    // ⭐ v10.5 — Doctrine v2 v3.3 (3 nouveaux champs)
    // Distinction A/B selon la doctrine du 04/05/2026 :
    //   A — v2_repond_question : OUI/NON, est-ce que le candidat répond à la
    //       question stricte (réécrite dans le champ réponse côté frontend) ?
    //   B — v2_repond_situation : OUI_TRANSITION / OUI_STORYTELLING /
    //       OUI_SITUATION_CONSTRUITE / NON, est-ce qu'il répond à la situation,
    //       et si oui à quel niveau (transition immédiate, storytelling général,
    //       ou sa propre lecture mentale construite au fil des questions) ?
    //   v2_analyse — justification courte (1-3 phrases) du verdict A/B.
    //   v2_traite_problematique reste le verdict synthétique (A=OUI → v2=OUI).
    v2_repond_question:            row.v2_repond_question || '',
    v2_repond_situation:           row.v2_repond_situation || '',
    v2_analyse:                    row.v2_analyse || '',
    verbes_observes:               row.verbes_observes || '',
    verbes_angles_piliers:         row.verbes_angles_piliers || '',
    // ⭐ v10.4 — 5 nouveaux champs grille à 3 niveaux (Décisions n°43, n°46) :
    pilier_finalite:               row.pilier_finalite || '',
    pilier_finalite_libelle:       row.pilier_finalite_libelle || '',
    pilier_coeur:                  row.pilier_coeur || '',
    outil_cognitif_libelle:        row.outil_cognitif_libelle || '',
    pilier_coeur_analyse:          row.pilier_coeur_analyse || '',
    piliers_traverses:             row.piliers_traverses || '',
    piliers_secondaires:           row.piliers_secondaires || '',
    types_verbatim:                row.types_verbatim || '',
    // ⛔ pilier_sortie : champ ABANDONNÉ en v10 (Décision n°5)
    finalite_reponse:              row.finalite_reponse || '',
    attribution_pilier_signal_brut: row.attribution_pilier_signal_brut || '',
    conforme_ecart:                conformeEcart,
    ecart_detail:                  row.ecart_detail || '',
    signal_limbique:               row.signal_limbique || ''
    // ⛔ raisonnement : champ SUPPRIMÉ en v10.4.1 (Décision n°48 — 04/05/2026)
  };
}

// ─── EXTRACTION LOOKUP ────────────────────────────────────────────────────
function extractLookup(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) {
    return value.length > 0 ? String(value[0]) : '';
  }
  return String(value);
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v10.2b — runAgentT1ForScenario (Décision n°42)
// ═══════════════════════════════════════════════════════════════════════════
//
// Exécute T1 pour UN SEUL scénario. Réutilise callT1ForScenario interne.
// Strictement additif : aucune fonction existante modifiée.
//
// Usage :
//   - Statuts manuels Famille A (REPRENDRE_T1_<X>_SEUL) — Phase v10.2b
//   - Statuts manuels Famille B (REPRENDRE_T1_DES_<X>) — boucle dans orchestratorEtape1
//   - Mode 2 auto du vérificateur — Phase v10.2c (à venir)
//
// IMPORTANT : cette fonction ne fait PAS l'écriture Airtable ni la suppression
// préalable. Ces opérations sont gérées par l'orchestrateur via :
//   - airtableService.deleteEtape1T1Scenario (suppression ciblée)
//   - airtableService.writeEtape1T1Scenario  (écriture additive)
//
// Cela permet à l'orchestrateur de séquencer correctement et de garantir
// la cohérence atomique : delete + run + write, sans toucher aux 20 autres lignes.
//
// @param {Object} params
// @param {string} params.candidat_id
// @param {string} params.session_id    // typiquement = candidat_id
// @param {string} params.scenario_name // SOMMEIL | WEEKEND | ANIMAL_1 | ANIMAL_2 | PANNE
// @returns {Promise<{rows: Array, usage: Object, cost: number, elapsedMs: number}>}
async function runAgentT1ForScenario({ candidat_id, session_id, scenario_name }) {
  const startTime = Date.now();
  logger.info('Agent T1 starting (1 SCENARIO ISOLÉ)', { candidat_id, scenario_name });

  // 1. Validation entrée
  const scenario = SCENARIOS.find(s => s.name === scenario_name);
  if (!scenario) {
    throw new Error(
      `runAgentT1ForScenario — scenario_name invalide: "${scenario_name}". ` +
      `Attendu: ${SCENARIOS.map(s => s.name).join(', ')}`
    );
  }

  // 2. Lire les 25 réponses brutes
  const responses = await airtableService.getResponses(session_id);
  if (!responses || responses.length === 0) {
    throw new Error(`No responses found for session ${session_id}`);
  }

  // 3. Filtrer les 5 réponses du scénario
  const responsesByScenario = groupResponsesByScenario(responses);
  const scenarioResponses = responsesByScenario[scenario_name] || [];

  if (scenarioResponses.length === 0) {
    throw new Error(`No responses for scenario ${scenario_name} (candidat ${candidat_id})`);
  }
  if (scenarioResponses.length !== 5) {
    logger.warn('runAgentT1ForScenario — nombre de réponses inattendu (attendu: 5)', {
      candidat_id, scenario_name, count: scenarioResponses.length
    });
  }

  // 4. Appel Claude (réutilise callT1ForScenario interne — code éprouvé)
  const { rows, usage, cost } = await callT1ForScenario({
    candidat_id,
    scenario,
    responses: scenarioResponses
  });

  const elapsedMs = Date.now() - startTime;
  logger.info('Agent T1 (SCENARIO ISOLÉ) done', {
    candidat_id,
    scenario_name,
    rows: rows.length,
    cost_usd: cost.toFixed(4),
    ecarts: rows.filter(r => r.conforme_ecart === 'ÉCART' || r.conforme_ecart === 'ECART').length,
    elapsedMs
  });

  return { rows, usage, cost, elapsedMs };
}

module.exports = {
  runAgentT1,
  runAgentT1ForScenario,  // ⭐ v10.2b (Décision n°42)
  // exports techniques pour tests/debug
  extractRows,
  normalizeRowForAirtable,
  extractLookup,
  groupResponsesByScenario,
  // buildDoctrineInstruction supprimée en v10.4 (cf. § 4 du journal en-tête)
  SCENARIOS
};
