// services/orchestrators/orchestrator_etape2_b_excellences.js
// Sous-orchestrateur Étape 2b — Les 4 excellences cognitives + bilan
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// v3.0 (2026-06-09) — UN SERVICE PAR AGENT (A / B / C) + relance solo
// v1 CTO (17/06/2026) — CORRECTION A16 : suffixes _EXCELLENCES ajoutés dans
//   STATUT_TO_PLAN (les statuts entrants depuis orchestrator_principal portent
//   ce suffixe — sans lui, plan = undefined → throw pour tout candidat).
//   + require mis à jour vers nouveaux noms de fichiers (nomenclature CTO).
//
// Machine à états (statut entrant → ce qu'on exécute) :
//   - ETAPE2_COMPLET_EXCELLENCES              → A + B + C à la suite
//   - ETAPE2_AGENT_A_EXCELLENCES              → A seul
//   - ETAPE2_AGENT_B_EXCELLENCES              → B seul
//   - ETAPE2_AGENT_C_EXCELLENCES              → C seul
//   - ETAPE2_3BILAN4EXCELLENCES               → déjà terminé (idempotent)
//   (compat : ETAPE2_1REPONSE4DIMENSIONS / ETAPE2_2EXCELLENCE / REPRENDRE_EXCELLENCES)
//
// Jalons posés au fil de l'eau :
//   A fait → ETAPE2_AGENT_B_EXCELLENCES
//   B fait → ETAPE2_AGENT_C_EXCELLENCES
//   C fait → ETAPE2_3BILAN4EXCELLENCES
//
// ⚠️ run() renvoie { stopReason: 'excellences_done' } et NON { success:true }
//   pour préserver le jalon posé (l'orchestrateur principal n'écrase pas le statut).

'use strict';

const airtableService = require('../infrastructure/airtableService');
const agentT5A        = require('../etape2/agent_etape2_b_T5A_codage');
const agentT5B        = require('../etape2/agent_etape2_b_T5B_portraits');
const agentT5C        = require('../etape2/agent_etape2_b_T5C_profil');
const logger          = require('../../utils/logger');

// Quels agents lancer selon le statut entrant.
// a = T5A (25 réponses), b = T5B (portraits), c = T5C (profil+verdicts).
const STATUT_TO_PLAN = {
  // ── Statuts courants (avec suffixe _EXCELLENCES) ── correction A16 ──────
  'ETAPE2_COMPLET_EXCELLENCES':  { a: true,  b: true,  c: true  },
  'ETAPE2_AGENT_A_EXCELLENCES':  { a: true,  b: false, c: false },
  'ETAPE2_AGENT_B_EXCELLENCES':  { a: false, b: true,  c: false },
  'ETAPE2_AGENT_C_EXCELLENCES':  { a: false, b: false, c: true  },
  // ── Compatibilité anciens statuts ────────────────────────────────────────
  'ETAPE2_1REPONSE4DIMENSIONS':  { a: true,  b: true,  c: true  },
  'ETAPE2_2EXCELLENCE':          { a: false, b: true,  c: true  },
  'REPRENDRE_EXCELLENCES':       { a: true,  b: true,  c: true  }
};

// Statut déjà terminal : rien à refaire (idempotent).
const DONE_STATUSES = new Set(['ETAPE2_3BILAN4EXCELLENCES']);

async function run({ candidat_id, visiteur }) {
  const startTime = Date.now();
  const statut    = (visiteur && visiteur.statut_analyse_pivar) || '';
  logger.info('Orchestrateur Excellences — démarrage', { candidat_id, statut });

  // Déjà terminé → ne rien refaire, ne pas écraser le statut.
  if (DONE_STATUSES.has(statut)) {
    logger.info('Excellences — déjà terminé, rien à refaire', { candidat_id, statut });
    return { stopReason: 'excellences_already_done', candidat_id };
  }

  const plan = STATUT_TO_PLAN[statut];
  if (!plan) {
    throw new Error(`Orchestrateur Excellences : statut "${statut}" non géré`);
  }

  let totalCost = 0;

  try {
    // ─── Agent A — T5A (code les 25 réponses) ──────────────────────────────
    if (plan.a) {
      const rA = await agentT5A.run({ candidat_id });
      totalCost += rA.cost || 0;
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: 'ETAPE2_AGENT_B_EXCELLENCES',
        derniere_activite:    new Date().toISOString()
      });
      logger.info('Excellences — Agent A (T5A) terminé', { candidat_id, lignes: rA.lignes });
    }

    // ─── Agent B — T5B (portraits par excellence) ──────────────────────────
    if (plan.b) {
      const rB = await agentT5B.run({ candidat_id });
      totalCost += rB.cost || 0;
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: 'ETAPE2_AGENT_C_EXCELLENCES',
        derniere_activite:    new Date().toISOString()
      });
      logger.info('Excellences — Agent B (T5B) terminé', { candidat_id, t5b: rB.t5b });
    }

    // ─── Agent C — T5C (profil + verdicts des deux faces) ──────────────────
    if (plan.c) {
      const rC = await agentT5C.run({ candidat_id });
      totalCost += rC.cost || 0;
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: 'ETAPE2_3BILAN4EXCELLENCES',
        derniere_activite:    new Date().toISOString()
      });
      logger.info('Excellences — Agent C (T5C) terminé', { candidat_id, t5c: rC.t5c });
    }

    const totalElapsedMs = Date.now() - startTime;
    logger.info('Orchestrateur Excellences — succès', {
      candidat_id, statut, totalElapsedMs, totalCostUsd: totalCost.toFixed(4)
    });

    return { stopReason: 'excellences_done', candidat_id, totalCostUsd: totalCost, totalElapsedMs };

  } catch (error) {
    logger.error('Orchestrateur Excellences — échec', {
      candidat_id, statut, error: error.message, stack: error.stack && error.stack.substring(0, 400)
    });
    throw error;
  }
}

module.exports = { run };
