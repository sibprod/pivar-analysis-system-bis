// services/orchestrators/etape2/orchestratorExcellences.js
// Sous-orchestrateur Étape 2 — Les 4 excellences cognitives + bilan
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Rôle (métaphore "chef de partie") :
//   - Enchaîne les deux agents de l'Étape 2 sur un candidat :
//       1. agentT5A   → code les 4 excellences réponse par réponse (25 lignes)
//       2. agentT5BC  → agrège en T5B (4 lignes + verbatims_preuves) et T5C (profil)
//   - Pose les jalons de statut dans VISITEUR.statut_analyse_pivar au fil de l'eau.
//     Ces jalons servent AUSSI de points de reprise (re-poser le statut relance la phase).
//
// Déclenchement : appelé par orchestratorPrincipal quand le candidat arrive avec
//   le statut ETAPE2_1REPONSE4DIMENSIONS (point d'entrée de l'Étape 2, après l'Agent 3).
//
// Machine à états (statut entrant → phase exécutée) :
//   - ETAPE2_1REPONSE4DIMENSIONS  → COMPLET : T5A puis T5BC (point d'entrée, fait tout)
//   - REPRENDRE_EXCELLENCES       → COMPLET : relance complète manuelle
//   - ETAPE2_2EXCELLENCE          → reprise : T5BC seul (T5A déjà fait → ré-agrégation)
//   - ETAPE2_3BILAN4EXCELLENCES   → terminé : rien à refaire (idempotent)
//
// Jalons posés :
//   T5A écrit   → ETAPE2_2EXCELLENCE   (T5A fait, prêt pour l'agrégation)
//   T5BC écrit  → ETAPE2_3BILAN4EXCELLENCES, puis ETAPE2_TERMINEE en sortie réussie.

'use strict';

const airtableService = require('../../infrastructure/airtableService');
const agentT5A        = require('../../etape2/agentT5A');
const agentT5BC       = require('../../etape2/agentT5BC');
const logger          = require('../../../utils/logger');

// Statuts qui sautent T5A (déjà produit) et reprennent directement à T5BC.
const SKIP_T5A_STATUSES = new Set([
  'ETAPE2_2EXCELLENCE'
]);

async function run({ candidat_id, visiteur }) {
  const startTime = Date.now();
  const statut    = (visiteur && visiteur.statut_analyse_pivar) || '';
  logger.info('Orchestrateur Excellences — démarrage', { candidat_id, statut });

  let totalCost = 0;

  try {
    // ─── Phase 1 — T5A (sauf si on reprend après T5A) ──────────────────────
    if (!SKIP_T5A_STATUSES.has(statut)) {
      const r5a = await agentT5A.run({ candidat_id });
      totalCost += r5a.cost || 0;
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: 'ETAPE2_2EXCELLENCE',
        derniere_activite:    new Date().toISOString()
      });
      logger.info('Excellences — T5A terminé', { candidat_id, lignes: r5a.lignes });
    } else {
      logger.info('Excellences — T5A sauté (reprise)', { candidat_id, statut });
    }

    // ─── Phase 2 — T5BC (agrégation + profil + bilan) ──────────────────────
    const r5bc = await agentT5BC.run({ candidat_id });
    totalCost += r5bc.cost || 0;
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: 'ETAPE2_3BILAN4EXCELLENCES',
      derniere_activite:    new Date().toISOString()
    });
    logger.info('Excellences — T5BC terminé', { candidat_id, t5b: r5bc.t5b });

    const totalElapsedMs = Date.now() - startTime;
    logger.info('Orchestrateur Excellences — succès', {
      candidat_id, totalElapsedMs, totalCostUsd: totalCost.toFixed(4)
    });

    // success:true → orchestratorPrincipal posera ETAPE2_TERMINEE / terminé.
    return { success: true, candidat_id, totalCostUsd: totalCost, totalElapsedMs };

  } catch (error) {
    logger.error('Orchestrateur Excellences — échec', {
      candidat_id, error: error.message, stack: error.stack && error.stack.substring(0, 400)
    });
    throw error;
  }
}

module.exports = { run };
