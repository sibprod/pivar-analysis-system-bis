// services/etape1/agentPromptEtape1Service.js
// Agent Prompt Étape 1 — Lecture cognitive des 25 réponses du candidat
// Profil-Cognitif v10.7 (Phase ETAPE1.1-1.0.0 — 2026-05-07)
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//
// Rôle :
//   - PRÉ-ÉTAPE doctrinale exécutée AVANT T1
//   - Lit les 25 réponses brutes du candidat depuis RESPONSES (frontend)
//   - Appelle Claude en 5 APPELS distincts (1 par scénario doctrinal) :
//     • SOMMEIL  (Q1-Q5)   → 5 questions
//     • WEEKEND  (Q6-Q10)  → 5 questions
//     • ANIMAL_1 (Q11-Q15) → 5 questions
//     • ANIMAL_2 (Q16-Q20) → 5 questions
//     • PANNE    (Q21-Q25) → 5 questions
//   - Pour chaque ligne RESPONSES, écrit 10 champs de lecture cognitive :
//     PHASE 1 — Compréhension (3 champs) :
//       • v2_repond_question     (OUI / NON)
//       • v2_repond_situation    (OUI_TRANSITION / OUI_STORYTELLING / OUI_SITUATION_CONSTRUITE / NON)
//       • v2_analyse             (justification 1-3 phrases)
//     PHASE 2 — Lecture cognitive (7 champs) :
//       • cog_comprend
//       • cog_outils_mobilises
//       • cog_pilier_sortie
//       • cog_sortie_commentaire
//       • cog_pilier_gouverne
//       • cog_gouverne_commentaire
//       • cog_resultat_vise
//
// IDEMPOTENCE :
//   - Le service détecte les lignes RESPONSES déjà traitées (cog_pilier_gouverne rempli)
//   - Il ne re-traite QUE les scénarios incomplets
//   - Permet la reprise sans coût supplémentaire après crash partiel
//
// DOCTRINE APPLIQUÉE :
//   - Le prompt prompt_etape1 v3.1bis (490 lignes) contient TOUTE la doctrine
//   - Le code service ne porte aucune doctrine — uniquement la tuyauterie
//     (cf. règle de gouvernance v10.4 : primat du fond sur la technique)
//   - ANONYMISATION : on n'envoie JAMAIS le prénom à Claude (Décision n°4)
//     On lit la civilité (Madame/Monsieur) via getCiviliteCandidat()
//
// PATTERN ALIGNÉ SUR agentT1Service v10.6
//   - Même mécanique de groupage par scénario
//   - Même mécanique d'appels Claude via agentBase.callAgent
//   - Même logging, même gestion d'erreurs
//   - Même tolérance multi-format pour parser la sortie

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

// ─── CONSTANTES ───────────────────────────────────────────────────────────
const SERVICE_NAME = 'agent_prompt_etape1';
const PROMPT_PATH  = 'etape1/prompt_etape1';  // ⚠️ pas d'extension — match GitHub

const SCENARIOS_ORDER = [
  { name: 'SOMMEIL',  range: [1, 5] },
  { name: 'WEEKEND',  range: [6, 10] },
  { name: 'ANIMAL_1', range: [11, 15] },
  { name: 'ANIMAL_2', range: [16, 20] },
  { name: 'PANNE',    range: [21, 25] }
];

// Liste des 10 champs de sortie à patcher dans RESPONSES
const OUTPUT_FIELDS = [
  'v2_repond_question',
  'v2_repond_situation',
  'v2_analyse',
  'cog_comprend',
  'cog_outils_mobilises',
  'cog_pilier_sortie',
  'cog_sortie_commentaire',
  'cog_pilier_gouverne',
  'cog_gouverne_commentaire',
  'cog_resultat_vise'
];

// Champ utilisé comme marqueur d'idempotence (rempli après traitement)
const IDEMPOTENCY_MARKER = 'cog_pilier_gouverne';

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE — runAgentPromptEtape1
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute l'étape 1.1 (lecture cognitive) sur l'ensemble des 25 réponses
 * d'un candidat. Idempotent : skip les scénarios déjà traités.
 *
 * @param {Object} args
 * @param {string} args.candidat_id - candidate_ID dans VISITEUR
 * @param {string} [args.session_id] - alias historique (= candidat_id)
 * @returns {Promise<Object>} { success, totalLignesEcrites, totalCostUsd, totalElapsedMs, ... }
 */
async function runAgentPromptEtape1({ candidat_id, session_id }) {
  const cid = candidat_id || session_id;
  const startTime = Date.now();

  logger.info('Agent Prompt Étape 1 starting (lecture cognitive 25 réponses)', { candidat_id: cid });

  // ─── 1. Lecture des 25 réponses RESPONSES ───────────────────────────────
  const responses = await airtableService.getResponses(cid);
  if (!responses || responses.length === 0) {
    throw new Error(`Agent Prompt Étape 1 — aucune réponse trouvée dans RESPONSES pour ${cid}`);
  }
  logger.info('Agent Prompt Étape 1 — réponses RESPONSES lues', {
    candidat_id: cid,
    count: responses.length
  });

  if (responses.length !== 25) {
    logger.warn('Agent Prompt Étape 1 — nombre de réponses inattendu', {
      candidat_id: cid,
      expected: 25,
      actual: responses.length
    });
    // On continue quand même — le pipeline doit être tolérant aux candidats partiels
  }

  // ─── 2. Lecture de la civilité (Décision n°4 — anonymisation) ───────────
  // On envoie « Madame » ou « Monsieur » à Claude, jamais le prénom
  let civilite = '';
  try {
    civilite = await airtableService.getCiviliteCandidat(cid);
    logger.info('Agent Prompt Étape 1 — civilité lue', { candidat_id: cid, civilite });
  } catch (e) {
    logger.warn('Agent Prompt Étape 1 — civilité non disponible (continuera sans)', {
      candidat_id: cid,
      error: e.message
    });
  }

  // ─── 3. Groupage par scénario (Q1-5, Q6-10, Q11-15, Q16-20, Q21-25) ─────
  const grouped = groupResponsesByScenario(responses);

  // ─── 4. Détection des scénarios déjà traités (idempotence) ──────────────
  const scenariosToProcess = [];
  for (const sc of SCENARIOS_ORDER) {
    const rows = grouped[sc.name];
    if (!rows || rows.length === 0) {
      logger.warn('Agent Prompt Étape 1 — scénario absent', { candidat_id: cid, scenario: sc.name });
      continue;
    }
    const allDone = rows.every(r => {
      const marker = r[IDEMPOTENCY_MARKER];
      return marker && String(marker).trim().length > 0;
    });
    if (allDone) {
      logger.info('Agent Prompt Étape 1 — scénario déjà traité, skip (idempotence)', {
        candidat_id: cid,
        scenario: sc.name,
        nb_rows: rows.length
      });
    } else {
      scenariosToProcess.push(sc);
    }
  }

  if (scenariosToProcess.length === 0) {
    logger.info('Agent Prompt Étape 1 — tous scénarios déjà traités, rien à faire', { candidat_id: cid });
    return {
      success: true,
      candidat_id: cid,
      totalLignesEcrites: 0,
      totalCostUsd: 0,
      totalElapsedMs: Date.now() - startTime,
      scenariosTraites: 0,
      scenariosSkipped: SCENARIOS_ORDER.length,
      message: 'Tous les scénarios étaient déjà traités (idempotence)'
    };
  }

  logger.info('Agent Prompt Étape 1 — scénarios à traiter', {
    candidat_id: cid,
    nb: scenariosToProcess.length,
    liste: scenariosToProcess.map(s => s.name).join(', ')
  });

  // ─── 5. Boucle scénario par scénario ────────────────────────────────────
  const results = {
    success: true,
    candidat_id: cid,
    totalLignesEcrites: 0,
    totalCostUsd: 0,
    scenariosTraites: 0,
    scenariosSkipped: SCENARIOS_ORDER.length - scenariosToProcess.length,
    erreurs: []
  };

  for (const scenario of scenariosToProcess) {
    const scenarioRows = grouped[scenario.name];
    logger.info('Agent Prompt Étape 1 — traitement scénario', {
      candidat_id: cid,
      scenario: scenario.name,
      nb_questions: scenarioRows.length
    });

    try {
      const { lignesEcrites, cost } = await callPromptEtape1ForScenario({
        candidat_id: cid,
        civilite,
        scenario,
        responses: scenarioRows
      });

      results.totalLignesEcrites += lignesEcrites;
      results.totalCostUsd += cost;
      results.scenariosTraites += 1;

      logger.info('Agent Prompt Étape 1 — scénario complété', {
        candidat_id: cid,
        scenario: scenario.name,
        lignesEcrites,
        costUsd: cost.toFixed(4)
      });
    } catch (err) {
      logger.error('Agent Prompt Étape 1 — échec sur scénario', {
        candidat_id: cid,
        scenario: scenario.name,
        error: err.message,
        stack: err.stack
      });
      results.erreurs.push({ scenario: scenario.name, error: err.message });
      // On ne casse pas tout le pipeline pour un scénario : on continue
    }
  }

  results.totalElapsedMs = Date.now() - startTime;

  if (results.erreurs.length > 0) {
    results.success = false;
    const msg = `Agent Prompt Étape 1 — ${results.erreurs.length} scénario(s) en erreur : ` +
                results.erreurs.map(e => `${e.scenario} (${e.error})`).join(' | ');
    throw new Error(msg);
  }

  logger.info('🎉 Agent Prompt Étape 1 terminé', {
    candidat_id: cid,
    scenariosTraites: results.scenariosTraites,
    scenariosSkipped: results.scenariosSkipped,
    totalLignesEcrites: results.totalLignesEcrites,
    totalCostUsd: results.totalCostUsd.toFixed(4),
    totalElapsedMs: results.totalElapsedMs
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// APPEL CLAUDE POUR UN SCÉNARIO (5 questions)
// ═══════════════════════════════════════════════════════════════════════════

async function callPromptEtape1ForScenario({ candidat_id, civilite, scenario, responses }) {
  // Construction du payload — anonymisé (pas de prénom)
  const payload = {
    candidat_id,
    civilite: civilite || 'Madame ou Monsieur',  // fallback neutre si lecture échouée
    scenario_name: scenario.name,
    nb_questions_in_scenario: responses.length,
    nb_questions_total: 25,
    responses: responses.map(r => ({
      id_question:    r.id_question,
      numero_global:  r.numero_global,
      pilier:         r.pilier,
      scenario_nom:   r.scenario_nom,
      question_text:  r.question_text,
      response_text:  r.response_text,
      storytelling:   extractLookup(r['storytelling_general (from question _lien)']) || '',
      transition:     extractLookup(r['transition_narrative (from question _lien)']) || ''
    }))
  };

  // Appel Claude via agentBase
  const { result, usage, cost } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: false,  // pas de lexique pour cette pré-étape
    candidatId:    candidat_id
  });

  // Extraction des lignes (tolérant multi-format)
  const rows = extractRows(result, candidat_id);

  if (rows.length !== responses.length) {
    throw new Error(
      `Agent Prompt Étape 1 — mismatch sur scénario ${scenario.name} : ` +
      `${rows.length} lignes retournées pour ${responses.length} envoyées`
    );
  }

  // Écriture des 10 champs dans RESPONSES (1 PATCH par ligne)
  let lignesEcrites = 0;
  for (let i = 0; i < responses.length; i++) {
    const recordId = responses[i].airtable_id;
    const fields = mapToAirtableFields(rows[i]);

    // Sécurité : vérifier qu'on patche bien la bonne ligne (id_question match)
    if (rows[i].id_question && responses[i].id_question &&
        rows[i].id_question !== responses[i].id_question) {
      logger.warn('Agent Prompt Étape 1 — id_question mismatch sur ligne', {
        candidat_id,
        scenario: scenario.name,
        index: i,
        attendu: responses[i].id_question,
        recu:    rows[i].id_question
      });
      // On continue quand même (l'ordre du JSON peut différer si Claude a inversé 2 questions)
      // Mais on log pour audit
    }

    try {
      await airtableService.patchResponseRow(recordId, fields);
      lignesEcrites += 1;
    } catch (err) {
      logger.error('Agent Prompt Étape 1 — échec patch ligne RESPONSES', {
        candidat_id,
        scenario: scenario.name,
        recordId,
        id_question: responses[i].id_question,
        error: err.message
      });
      throw err;  // critique : on remonte
    }
  }

  return { lignesEcrites, cost };
}

// ═══════════════════════════════════════════════════════════════════════════
// GROUPAGE PAR SCÉNARIO (pattern aligné sur agentT1Service)
// ═══════════════════════════════════════════════════════════════════════════

function groupResponsesByScenario(responses) {
  const grouped = { SOMMEIL: [], WEEKEND: [], ANIMAL_1: [], ANIMAL_2: [], PANNE: [] };

  for (const r of responses) {
    const scenarioName = (r.scenario_nom || '').toUpperCase().trim();
    const nq = parseInt(r.numero_global, 10);

    if (scenarioName === 'SOMMEIL') {
      grouped.SOMMEIL.push(r);
    } else if (scenarioName === 'WEEKEND') {
      grouped.WEEKEND.push(r);
    } else if (scenarioName === 'ANIMAL' || scenarioName === 'ANIMAL_1' || scenarioName === 'ANIMAL_2') {
      // Découpage par numero_global : Q11-15 → ANIMAL_1, Q16-20 → ANIMAL_2
      if (nq >= 11 && nq <= 15) grouped.ANIMAL_1.push(r);
      else if (nq >= 16 && nq <= 20) grouped.ANIMAL_2.push(r);
    } else if (scenarioName === 'PANNE') {
      grouped.PANNE.push(r);
    } else {
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
    grouped[name].sort((a, b) =>
      (parseInt(a.numero_global, 10) || 0) - (parseInt(b.numero_global, 10) || 0)
    );
  }

  return grouped;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DES LIGNES (tolérance multi-format — pattern T1)
// ═══════════════════════════════════════════════════════════════════════════

function extractRows(result, candidat_id) {
  if (Array.isArray(result?.rows)) return result.rows;
  if (Array.isArray(result?.lignes)) return result.lignes;
  if (Array.isArray(result?.responses)) return result.responses;
  if (Array.isArray(result)) return result;

  // Cas dégradé : objet unique au lieu d'un array
  if (result?.candidat_id && result?.id_question) {
    logger.warn('Agent Prompt Étape 1 returned single object instead of array', { candidat_id });
    return [result];
  }

  logger.error('Unable to extract Prompt Étape 1 rows from agent output', {
    candidat_id,
    keys: result ? Object.keys(result) : null
  });
  throw new Error('Agent Prompt Étape 1 output format not recognized');
}

// ═══════════════════════════════════════════════════════════════════════════
// MAPPING JSON → CHAMPS AIRTABLE RESPONSES
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Transforme une ligne du JSON retourné par le prompt en objet fields prêt
 * pour le PATCH Airtable. Les noms de champs correspondent exactement à la
 * table RESPONSES (10 colonnes de sortie).
 */
function mapToAirtableFields(row) {
  return {
    v2_repond_question:        row.v2_repond_question        || '',
    v2_repond_situation:       row.v2_repond_situation       || '',
    v2_analyse:                row.v2_analyse                || '',
    cog_comprend:              row.cog_comprend              || '',
    cog_outils_mobilises:      row.cog_outils_mobilises      || '',
    cog_pilier_sortie:         row.cog_pilier_sortie         || '',
    cog_sortie_commentaire:    row.cog_sortie_commentaire    || '',
    cog_pilier_gouverne:       row.cog_pilier_gouverne       || '',
    cog_gouverne_commentaire:  row.cog_gouverne_commentaire  || '',
    cog_resultat_vise:         row.cog_resultat_vise         || ''
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE VALEUR LOOKUP (Airtable retourne parfois un array pour les lookups)
// ═══════════════════════════════════════════════════════════════════════════

function extractLookup(value) {
  if (value === null || value === undefined) return '';
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    return String(value[0] || '').trim();
  }
  return String(value).trim();
}

module.exports = {
  runAgentPromptEtape1
};
