// services/orchestrators/orchestrator_etape1_T3_bilan.js
// ORCHESTRATEUR ÉTAPE 1 T3 — BILAN (chaîne « FABLE »)
//
// v1 CTO (17/06/2026) — CORRECTION A31 : méthodes fantômes → exports réels
// v2 CTO (17/06/2026) — CORRECTION R1 : anonymisation agents Claude API
//   Les agents LLM reçoivent UNIQUEMENT candidat_id + civilite.
//   JAMAIS prenom ni nom. La civilite est lue depuis VISITEUR.
//   PB/PC/PD n'envoient pas de données candidat à Claude — conformes.

'use strict';

const airtableService = require('../infrastructure/airtableService');
const backupService   = require('../infrastructure/backupService');
const logger          = require('../../utils/logger');

const E0 = require('../etape1/etape1_t3/bilan_fable/service_etape1_T3_bilan_E0_extraction');
const PA = require('../etape1/etape1_t3/bilan_fable/service_etape1_T3_bilan_PA_pilier');
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

// Lit la civilité depuis VISITEUR — seule donnée candidat envoyée aux agents LLM (R1)
async function _lireCivilite(candidat_id) {
  const civilite = await airtableService.getCiviliteCandidat(candidat_id);
  return civilite || '';
}

async function _phaseE0etPA(candidat_id, civilite) {
  // É0 — déterministe, 0 appel Claude
  await E0.buildContexteE0({ candidat_id });

  // PA — 5 appels Claude · reçoit civilite (jamais prenom/nom)
  const resultats = await PA.lancerAgentPA(candidat_id, { civilite, write_mode: true });

  const tousValides = (resultats || []).every(r => r.mode_statut !== 'PROPOSITION');
  return { tousValides };
}

async function _phaseAval(candidat_id, coutPrincipal, coutSecondaire) {
  // PB/PC/PD n'envoient pas de données candidat à Claude — conformes R1
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

  // Lecture civilité une seule fois — R1 : seule donnée candidat transmise aux agents
  const civilite = await _lireCivilite(candidat_id);

  let statut_sortie;

  switch (statut) {

    case 'REPRENDRE_BILAN_FABLE': {
      const { tousValides } = await _phaseE0etPA(candidat_id, civilite);
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
      await _phaseE0etPA(candidat_id, civilite);
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
