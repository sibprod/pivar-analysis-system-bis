// services/orchestrators/etape2/orchestratorExcellences.js
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
// ⚠️ En sortie réussie, run() renvoie { stopReason: 'excellences_done' } et NON
//   { success:true } : l'orchestrateur principal, sur success:true, écrase le statut
//   par "terminé" (non éligible → faux ERREUR si repris). Avec stopReason, le principal
//   préserve le jalon ETAPE2_3BILAN4_EXCELLENCES posé ici (statut final de l'Étape 2).

'use strict';

const airtableService = require('../infrastructure/airtableService');
const agentT5A        = require('../etape2/agent_etape2_b_T5A_codage');
const agentT5B        = require('../etape2/agent_etape2_b_T5B_portraits');
const agentT5C        = require('../etape2/agent_etape2_b_T5C_profil');
const agentTestDecGen = require('../etape2/agent_etape2_c_TESTDEC_generation');
const agentTestDecCod = require('../etape2/agent_etape2_c_TESTDEC_codage');
const logger          = require('../../utils/logger');

// Quels agents lancer selon le statut entrant.
// a = T5A (25 réponses), b = T5B (portraits), c = T5C (profil+verdicts).
const STATUT_TO_PLAN = {
  // ── Statuts courants (avec suffixe _EXCELLENCES) ── correction A16 ──────
  'ETAPE2_COMPLET_EXCELLENCES':  { a: true,  b: true,  c: true  },
  // 🔒 Recodage VOLONTAIRE (garante, 09/07) : le seul chemin qui recode des
  // lignes déjà codées — à poser explicitement après un changement de grille.
  'ETAPE2_RECODAGE_COMPLET':     { a: true,  force: true, b: true,  c: true  },
  'ETAPE2_AGENT_A_EXCELLENCES':  { a: true,  b: false, c: false },
  'ETAPE2_AGENT_B_EXCELLENCES':  { a: false, b: true,  c: false },
  'ETAPE2_AGENT_C_EXCELLENCES':  { a: false, b: false, c: true  },
  // ⭐ Étape 2c (02/07) — test de décentration répondu : codage → ligne DEC recalculée → verdicts (C)
  'ETAPE2_TESTDEC_COMPLET':      { a: false, b: false, c: true,  testdec: true },
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
      const rA = await agentT5A.run({ candidat_id, force: !!plan.force });
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

    // ─── ⭐ Étape 2c — Codage du test de décentration (AVANT le C : la ligne
    //     DEC recalculée doit être en base quand C relit les 4 lignes T5B) ────
    if (plan.testdec) {
      const rT = await agentTestDecCod.run({ candidat_id });
      totalCost += rT.cost || 0;
      // 🔒 (garante, 20/07) : codage annulé pour données périmées → le statut a
      // été reposé par l'agent, la file relancera sur l'état frais — on
      // n'exécute PAS le C sur une mesure inexistante.
      if (rT && rT.stale) {
        logger.info('Excellences — TESTDEC codage reprogrammé (données modifiées pendant l\'analyse) — chaîne interrompue proprement', { candidat_id });
        return { ok: true, reprogramme: true, cost: totalCost };
      }
      logger.info('Excellences — TESTDEC codage terminé', {
        candidat_id, activations: rT.activations
      });
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

      // ⭐ Étape 2c — pré-générer le test de décentration (best effort : un échec
      // ici ne bloque JAMAIS le bilan — le service saute si des réponses existent).
      // Cas couverts (garante, 03/07 — Option B) :
      //   remède   : verdict management RÉSERVE DE PROTOCOLE ou DÉFAVORABLE
      //              (interne, affiché réserve au candidat)
      //   affinage : décentration posée en tranche 6-14 (« posé + test proposé »)
      if (!plan.testdec) {
        try {
          const verdict = await airtableService.getEtape2T5CVerdictMan(candidat_id);
          let besoinTest = (verdict === 'RÉSERVE DE PROTOCOLE' || verdict === 'DÉFAVORABLE');
          if (!besoinTest) {
            const t5bRows = await airtableService.getEtape2T5BRows(candidat_id);
            const decRow = (t5bRows || []).find(r =>
              String((r.excellence && (r.excellence.name || r.excellence)) || '').toUpperCase() === 'DEC');
            if (decRow && String(decRow.densite_sommeil || '') !== 'TEST') {
              const a = (decRow.nb_eleve || 0) + (decRow.nb_moyen || 0);
              if (a >= 6 && a <= 14) besoinTest = true;
            }
          }
          if (besoinTest) {
            const rG = await agentTestDecGen.run({ candidat_id });
            totalCost += rG.cost || 0;
            logger.info('Excellences — TESTDEC génération', {
              candidat_id, generated: rG.generated, skipped: rG.skipped || ''
            });
          }
        } catch (eGen) {
          logger.error('Excellences — TESTDEC génération échouée (non bloquant)', {
            candidat_id, error: eGen.message
          });
        }
      }
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
