// services/orchestrators/orchestrator_etape2_b_excellences.js
// Sous-orchestrateur Étape 2 — Les 4 excellences cognitives + bilan
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// v3.0 (2026-06-09) — UN SERVICE PAR AGENT (A / B / C) + relance solo
//   Trois agents distincts, un prompt chacun (aligné sur le reste du protocole) :
//     - agent A = agentT5A  → code les 4 excellences réponse par réponse (25 lignes)
//     - agent B = agentT5B  → portraits par excellence (4 lignes T5B)
//     - agent C = agentT5C  → profil + verdicts des deux faces (1 ligne T5C)
//
// Machine à états (statut entrant → ce qu'on exécute) :
//   - ETAPE2_COMPLET              → A + B + C à la suite (production autonome)
//   - ETAPE2_AGENT_A              → A seul
//   - ETAPE2_AGENT_B              → B seul (suppose A déjà fait : 25 lignes T5A en base)
//   - ETAPE2_AGENT_C              → C seul (suppose B déjà fait : 4 lignes T5B en base)
//   - ETAPE2_3BILAN4_EXCELLENCES   → déjà terminé : rien à refaire (idempotent)
//   (compat : ETAPE2_1REPONSE4DIMENSIONS = ancien point d'entrée = COMPLET ;
//             ETAPE2_2EXCELLENCE = ancien « reprise B+C » = B puis C)
//
// Jalons posés au fil de l'eau (servent de points de reprise) :
//   A fait → ETAPE2_AGENT_B ; B fait → ETAPE2_AGENT_C ; C fait → ETAPE2_3BILAN4_EXCELLENCES.
//
// v3.1 (2026-07-02) — INTÉGRITÉ : ARRÊT SUR ÉCHEC PARTIEL (A et B)
//   Avant : si l'agent B produisait 3 excellences sur 4, la chaîne enchaînait sur C,
//   qui calculait profil et verdicts sur un T5B INCOMPLET → bilan silencieusement faux
//   (ex. MET manquante = verdict management sans une de ses indispensables).
//   Après : si rA.echecs ou rB.echecs n'est pas vide, la chaîne S'ARRÊTE, pose le
//   jalon de reprise (ETAPE2_AGENT_A/B_EXCELLENCES) et écrit le détail dans
//   erreur_analyse. Un verdict ne se calcule JAMAIS sur des données incomplètes.
//
// ⚠️ En sortie réussie, run() renvoie { stopReason: 'excellences_done' } et NON
//   { success:true } : l'orchestrateur principal, sur success:true, écrase le statut
//   par "terminé" (non éligible → faux ERREUR si repris). Avec stopReason, le principal
//   préserve le jalon ETAPE2_3BILAN4_EXCELLENCES posé ici (statut final de l'Étape 2).

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
const DONE_STATUSES = new Set(['ETAPE2_3BILAN4_EXCELLENCES']);

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
      // v3.1 — INTÉGRITÉ : des réponses n'ont pas pu être codées → on N'ENCHAÎNE PAS
      // (B agrégerait des lignes non recodées → portraits faux d'apparence normale).
      if (rA.echecs && rA.echecs.length > 0) {
        await airtableService.updateVisiteur(candidat_id, {
          statut_analyse_pivar: 'ETAPE2_AGENT_A_EXCELLENCES',
          erreur_analyse:       `Agent A partiel — réponses non codées : ${rA.echecs.join(', ')}. Chaîne arrêtée avant B. Relance = reposer ETAPE2_AGENT_A_EXCELLENCES (rejoue les 25 réponses).`,
          derniere_activite:    new Date().toISOString()
        });
        logger.warn('Excellences — Agent A partiel, chaîne ARRÊTÉE avant B', { candidat_id, echecs: rA.echecs });
        return { stopReason: 'excellences_a_partiel', candidat_id, echecs: rA.echecs, totalCostUsd: totalCost };
      }
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
      // v3.1 — INTÉGRITÉ : une excellence manque → on N'ENCHAÎNE PAS sur C
      // (un verdict ne se calcule jamais sur un T5B incomplet).
      if (rB.echecs && rB.echecs.length > 0) {
        await airtableService.updateVisiteur(candidat_id, {
          statut_analyse_pivar: 'ETAPE2_AGENT_B_EXCELLENCES',
          erreur_analyse:       `Agent B partiel — excellences en échec : ${rB.echecs.join(', ')}. Chaîne arrêtée avant C. Relance = reposer ETAPE2_AGENT_B_EXCELLENCES (l'upsert par excellence réécrit proprement).`,
          derniere_activite:    new Date().toISOString()
        });
        logger.warn('Excellences — Agent B partiel, chaîne ARRÊTÉE avant C', { candidat_id, echecs: rB.echecs });
        return { stopReason: 'excellences_b_partiel', candidat_id, echecs: rB.echecs, totalCostUsd: totalCost };
      }
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
        statut_analyse_pivar: 'ETAPE2_3BILAN4_EXCELLENCES',
        derniere_activite:    new Date().toISOString()
      });
      logger.info('Excellences — Agent C (T5C) terminé', { candidat_id, t5c: rC.t5c });
    }

    const totalElapsedMs = Date.now() - startTime;
    logger.info('Orchestrateur Excellences — succès', {
      candidat_id, statut, totalElapsedMs, totalCostUsd: totalCost.toFixed(4)
    });

    // stopReason (pas success:true) → le principal NE pose PAS "terminé".
    return { stopReason: 'excellences_done', candidat_id, totalCostUsd: totalCost, totalElapsedMs };

  } catch (error) {
    logger.error('Orchestrateur Excellences — échec', {
      candidat_id, statut, error: error.message, stack: error.stack && error.stack.substring(0, 400)
    });
    throw error;
  }
}

module.exports = { run };
