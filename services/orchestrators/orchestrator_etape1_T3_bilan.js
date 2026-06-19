// services/orchestrators/orchestrator_etape1_T3_bilan.js
// ORCHESTRATEUR ÉTAPE 1 T3 — BILAN (chaîne « FABLE »)
//
// CTO 17/06/2026 — CORRECTIONS :
//   A31 : méthodes fantômes remplacées par exports réels
//   R1  : civilite lue depuis VISITEUR — prenom jamais transmis aux agents LLM
//
// ⭐ REFONTE 19/06/2026 — SIMPLIFICATION DE LA PRÉPARATION DU BILAN :
//   L'ancienne « usine à gaz » É0 (extraction) + É0b (initialisation) + P-A est remplacée par :
//     - PREPARATION : service_etape1_T3_preparation.preparerT3({candidat_id})
//       → lit la table figée CIRCUITS_POURBILAN (aucun recalcul) + crée les coquilles T3
//     - REDACTION   : service_etape1_T3_redaction_PA.redigerBilan(prep, opts)
//       → reçoit la structure préparée, appelle l'agent (prompt v10), valide, écrit T3
//   PB / PC / PD (aval) : INCHANGÉS.
//   Anciens fichiers É0 / É0b / P-A v9 : conservés dans le dépôt jusqu'à validation du test
//   réel, puis archivés (old/). NE PAS supprimer avant test concluant.

'use strict';

const airtableService = require('../infrastructure/airtableService');
const backupService   = require('../infrastructure/backupService');
const logger          = require('../../utils/logger');

// ⭐ REFONTE 19/06 — les 2 nouveaux services remplacent É0 + É0b + P-A
const PREPARATION = require('../etape1/etape1_t3/bilan_fable/service_etape1_T3_bilan_preparation');
const REDACTION   = require('../etape1/etape1_t3/bilan_fable/service_etape1_T3_redaction_PA');

// Aval inchangé
const PB = require('../etape1/etape1_t3/bilan_fable/service_etape1_T3_bilan_PB_filtre');
const PC = require('../etape1/etape1_t3/bilan_fable/service_etape1_T3_bilan_PC_boucles');
const PD = require('../etape1/etape1_t3/bilan_fable/service_etape1_T3_bilan_PD_marqueurs');

const MODE_VALIDATION_REQUISE =
  String(process.env.BILAN_FABLE_VALIDATION_MODES || 'true').toLowerCase() !== 'false';

const STATUT_PA_OK   = 'BILAN_FABLE_PA_OK';
const STATUT_TERMINE = 'BILAN_FABLE_TERMINE';

const STATUTS_BILAN_FABLE = [
  'REPRENDRE_BILAN_FABLE',
  'REPRENDRE_BILAN_PA',
  'REPRENDRE_BILAN_PB',
  'REPRENDRE_BILAN_PC',
  'REPRENDRE_BILAN_PD'
];

async function _setStatut(candidat_id, statut) {
  await airtableService.updateVisiteur(candidat_id, {
    statut_analyse_pivar: statut,
    derniere_activite:    new Date().toISOString()
  });
  logger.info('Bilan Fable — statut posé', { candidat_id, statut });
}

// ⭐ REFONTE 19/06 — préparation (lecture figée + coquilles) puis rédaction (agent v10)
async function _phasePreparationEtRedaction(candidat_id, civilite) {
  // PRÉPARATION — lit CIRCUITS_POURBILAN (aucun recalcul) + crée les coquilles T3.
  // Remplace É0.buildContexteE0 + É0b.initialiserT3.
  const prep = await PREPARATION.preparerT3({ candidat_id });

  // RÉDACTION — reçoit la structure préparée, appelle l'agent (prompt v10), valide, écrit T3.
  // Remplace PA.lancerAgentPA. La structure est passée EN MÉMOIRE (pas de relecture).
  const resultats = await REDACTION.redigerBilan(prep, { civilite, write_mode: true });

  const tousValides = (resultats || []).every(r => r.mode_statut !== 'PROPOSITION');
  return { tousValides };
}

async function _phaseAval(candidat_id, coutPrincipal, coutSecondaire) {
  await PB.run({ candidat_id });
  await PC.run({ candidat_id });
  await PD.run({ candidat_id, coutPrincipal, coutSecondaire });
}

async function executerBilanFable({
  candidat_id,
  statut,
  coutPrincipal = null,
  coutSecondaire = null
}) {
  const startTime = Date.now();
  logger.info('Orchestrateur Bilan Fable — entrée', { candidat_id, statut, gate: MODE_VALIDATION_REQUISE });

  await backupService.save(candidat_id, 'before_t3', { orchestrateur: 'bilan_fable', statut });

  const civilite = await airtableService.getCiviliteCandidat(candidat_id) || '';

  let statut_sortie;

  switch (statut) {

    case 'REPRENDRE_BILAN_FABLE': {
      const { tousValides } = await _phasePreparationEtRedaction(candidat_id, civilite);
      if (MODE_VALIDATION_REQUISE && !tousValides) {
        statut_sortie = STATUT_PA_OK;
        break;
      }
      await _phaseAval(candidat_id, coutPrincipal, coutSecondaire);
      await airtableService.resetTentativesEtape1(candidat_id);
      statut_sortie = STATUT_TERMINE;
      break;
    }

    case 'REPRENDRE_BILAN_PA': {
      await _phasePreparationEtRedaction(candidat_id, civilite);
      statut_sortie = STATUT_PA_OK;
      break;
    }

    case 'REPRENDRE_BILAN_PB': {
      await PB.run({ candidat_id });
      statut_sortie = STATUT_PA_OK;
      break;
    }

    case 'REPRENDRE_BILAN_PC': {
      await PC.run({ candidat_id });
      statut_sortie = STATUT_PA_OK;
      break;
    }

    case 'REPRENDRE_BILAN_PD': {
      await PD.run({ candidat_id, coutPrincipal, coutSecondaire });
      await airtableService.resetTentativesEtape1(candidat_id);
      statut_sortie = STATUT_TERMINE;
      break;
    }

    default:
      throw new Error(`Orchestrateur Bilan Fable: statut non géré « ${statut} »`);
  }

  await backupService.save(candidat_id, 'after_t3', { orchestrateur: 'bilan_fable', statut_sortie });
  await _setStatut(candidat_id, statut_sortie);

  logger.info('Orchestrateur Bilan Fable — sortie OK', {
    candidat_id, statut, statut_sortie, elapsedMs: Date.now() - startTime
  });

  return { ok: true, candidat_id, statut_traite: statut, statut_sortie };
}

module.exports = {
  executerBilanFable,
  MODE_VALIDATION_REQUISE,
  STATUTS_BILAN_FABLE
};
