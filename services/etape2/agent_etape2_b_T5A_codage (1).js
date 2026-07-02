// services/etape2/agent_etape2_b_T5A_codage.js
// Agent T5A — Codage des 4 excellences cognitives, réponse par réponse (Étape 2)
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Rôle :
//   - Lit les 25 lignes du candidat dans ETAPE2_RESPONSES_EXCELLENCES.
//   - Pour chaque réponse, appelle le prompt new-prompts/etape2/prompt_etape2_b_T5A_codage.md
//     qui code les 4 excellences (niveau / verbatim / manifestation / contexte).
//
// v2.1 (2026-07-02) — RÈGLE D19bis APPLIQUÉE (journal du 04/06) :
//   L'entrée de l'agent A est la réponse du candidat, SEULE. Le signal limbique
//   pré-calculé à l'Étape 1 (limbique_detecte / limbique_intensite / limbique_detail)
//   n'est PLUS transmis dans le payload — l'interférence émotionnelle se lit dans le
//   texte de la réponse lui-même (prompt v3.1, règle R5).
//   - Met à jour la même ligne avec les résultats (patch, pas de création).
//
// v2.0 (2026-06-09) — PARALLÉLISME + ÉCRITURE AU FIL DE L'EAU
//   AVANT : les 25 réponses étaient analysées EN SÉRIE (une à la fois) puis écrites
//   toutes ensemble à la fin → ~50-70 min, impression de blocage, perte totale si coupure.
//   APRÈS : les réponses sont traitées par VAGUES de CONCURRENCE réponses simultanées
//   (Promise.all), et chaque vague est ÉCRITE en base dès qu'elle est finie.
//   ⭐ La PROFONDEUR D'ANALYSE PAR RÉPONSE EST INCHANGÉE : chaque réponse fait toujours
//      son propre appel Claude avec thinking complet. On ne mutualise rien, on ne dilue
//      rien — on lance juste plusieurs analyses en parallèle au lieu d'en file indienne.
//      Le coût en tokens est identique ; seul le TEMPS total baisse (~÷CONCURRENCE).
//   Réglage : CONCURRENCE = nombre d'appels simultanés. 5 est prudent (sous les limites
//   de débit de l'API). Monter à 8-10 accélère encore si le quota le permet.

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const PROMPT_PATH  = 'etape2/prompt_etape2_b_T5A_codage.md';
const SERVICE_NAME = 'agent_t5a';

// Nombre de réponses analysées EN MÊME TEMPS. Chaque analyse garde son thinking complet.
// 25 réponses / 5 = 5 vagues → ~÷5 sur le temps total. Ajustable sans rien changer d'autre.
const CONCURRENCE = 5;

// Mapping des 4 excellences : clé de sortie de l'agent → préfixe de champ base.
const EXCELLENCES = [
  { out: 'ANT', field: 'anticipation' },
  { out: 'DEC', field: 'decentration' },
  { out: 'MET', field: 'metacognition' },
  { out: 'VUE', field: 'vue_systemique' }
];

const NIVEAUX_VIDE = new Set(['NULLE', 'NON ÉVALUÉ EN SITUATION']);

/**
 * Construit le patch de champs base à partir de la sortie de l'agent pour une réponse.
 * Applique la règle de vidage : verbatim + manifestation vides si NULLE / NON ÉVALUÉ.
 */
function buildPatchFields(agentOut) {
  const fields = {};
  for (const { out, field } of EXCELLENCES) {
    const niveau = (agentOut[`${out}_niveau`] || '').trim();
    fields[`${field}_niveau`] = niveau;
    if (NIVEAUX_VIDE.has(niveau)) {
      fields[`${field}_verbatim`]            = '';
      fields[`${field}_manifestation`]       = '';
      fields[`${field}_contexte_activation`] = (agentOut[`${out}_contexte_activation`] || '').trim();
    } else {
      fields[`${field}_verbatim`]            = (agentOut[`${out}_verbatim`] || '').trim();
      fields[`${field}_manifestation`]       = (agentOut[`${out}_manifestation`] || '').trim();
      fields[`${field}_contexte_activation`] = (agentOut[`${out}_contexte_activation`] || '').trim();
    }
  }
  return fields;
}

/**
 * Analyse UNE réponse (un appel Claude complet, thinking inclus, + 1 retry si JSON illisible).
 * Identique au traitement séquentiel d'origine — extrait dans un helper pour le parallélisme.
 * @returns {Promise<{ row, out|null, cost }>}
 */
async function analyseUneReponse(row, candidat_id) {
  const payload = {
    candidat_id,
    id_question:           row.id_question || '',
    question_id_protocole: row.question_id_protocole || '',
    scenario:              (row.scenario_nom && (row.scenario_nom.name || row.scenario_nom)) || row.scenario || '',
    pilier_demande:        (row.pilier_demande && (row.pilier_demande.name || row.pilier_demande)) || '',
    verbatim_candidat:     row.response_text || ''
    // v2.1 (D19bis) : le signal limbique de l'Étape 1 n'est plus transmis — l'entrée
    // de l'agent A est la réponse du candidat, seule (prompt v3.1, règle R5).
  };

  let out = null;
  let cost = 0;
  for (let attempt = 1; attempt <= 2 && out === null; attempt++) {
    try {
      const res = await agentBase.callAgent({
        serviceName: SERVICE_NAME,
        promptPath:  PROMPT_PATH,
        payload,
        candidatId:  candidat_id
      });
      cost += res.cost || 0;
      out = Array.isArray(res.result) ? res.result[0] : res.result;
    } catch (e) {
      logger.warn('Agent T5A — réponse illisible', {
        candidat_id, id_question: payload.id_question, attempt, error: e.message
      });
    }
  }
  return { row, out, cost, id_question: payload.id_question };
}

/**
 * Exécute l'agent T5A pour un candidat — par vagues parallèles, écriture au fil de l'eau.
 * @param {Object} params
 * @param {string} params.candidat_id - session_id du candidat
 * @returns {Promise<{ lignes: number, cost: number, echecs: string[] }>}
 */
async function run({ candidat_id }) {
  logger.info('Agent T5A — démarrage', { candidat_id, concurrence: CONCURRENCE });

  const rows = await airtableService.getEtape2T5ARows(candidat_id);
  if (!rows || rows.length === 0) {
    throw new Error(`Agent T5A : aucune ligne T5A trouvée pour ${candidat_id}`);
  }

  let totalCost = 0;
  let totalUpdated = 0;
  const echecs = [];

  // Traitement par vagues de CONCURRENCE réponses lancées simultanément.
  for (let i = 0; i < rows.length; i += CONCURRENCE) {
    const vague = rows.slice(i, i + CONCURRENCE);
    const numVague = Math.floor(i / CONCURRENCE) + 1;
    const nbVagues = Math.ceil(rows.length / CONCURRENCE);

    logger.info('Agent T5A — vague en cours', {
      candidat_id, vague: `${numVague}/${nbVagues}`, reponses: vague.length
    });

    // Les CONCURRENCE analyses tournent EN MÊME TEMPS, chacune avec son thinking complet.
    const resultats = await Promise.all(
      vague.map(row => analyseUneReponse(row, candidat_id))
    );

    // Construction du patch de CETTE vague + comptage des échecs.
    const patchVague = [];
    for (const r of resultats) {
      totalCost += r.cost || 0;
      if (!r.out) {
        echecs.push(r.id_question);   // on laisse la ligne en l'état, jamais écrasée par du vide
        continue;
      }
      patchVague.push({
        airtable_id:     r.row.airtable_id,
        fields_to_patch: buildPatchFields(r.out)
      });
    }

    // ÉCRITURE AU FIL DE L'EAU : on écrit la vague dès qu'elle est finie.
    // → progression visible en base, et aucune perte des vagues déjà écrites si coupure.
    if (patchVague.length > 0) {
      const n = await airtableService.patchEtape2T5ARows(candidat_id, patchVague);
      totalUpdated += n;
      logger.info('Agent T5A — vague écrite', {
        candidat_id, vague: `${numVague}/${nbVagues}`, lignes_ecrites: n,
        cumul: totalUpdated, cout_cumule_usd: totalCost.toFixed(4)
      });
    }
  }

  if (echecs.length > 0) {
    logger.warn('Agent T5A — réponses non traitées (à relancer)', { candidat_id, echecs });
  }
  logger.info('Agent T5A — terminé', {
    candidat_id, lignes: totalUpdated, echecs: echecs.length, cost_usd: totalCost.toFixed(4)
  });
  return { lignes: totalUpdated, cost: totalCost, echecs };
}

module.exports = { run };
