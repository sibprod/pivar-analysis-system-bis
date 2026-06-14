// services/etape1/bilan_fable/orchestratorBilanFable.js
// ORCHESTRATEUR — CHAÎNE BILAN « FABLE » — v1.1 (13/06/2026)
//
// Enchaîne : É0 (déterministe) → P-A ×5 (analyses pilier) → [GATE validation des
// modes] → P-B (filtre/ch.IV) → P-C (boucles) → P-D (marqueurs/coûts).
// Aligné sur les conventions de prod (orchestratorEtape1 / orchestratorEtape2) :
//   - backupService.save(candidat_id, 'before_t3'/'after_t3', {...})
//   - airtableService.resetTentativesEtape1(candidat_id)
//   - airtableService.updateVisiteur(candidat_id, { <noms de champs> })
//   - en cas d'échec : on LÈVE l'erreur (orchestratorPrincipal pose ERREUR), pas de
//     double gestion. orchestratorPrincipal pose déjà 'en_cours' avant l'aiguillage.
//
// STATUT DE SORTIE (préservé par orchestratorPrincipal via stopReason) :
//   l'orchestrateur pose lui-même BILAN_FABLE_PA_OK (pause validation des modes) ou
//   BILAN_FABLE_TERMINE (fin). orchestratorPrincipal retourne { stopReason } pour NE
//   PAS écraser ce statut par 'terminé'.
//
// STATUTS (cf. config.ALLOWED_VALUES.statut_analyse_pivar) :
//   REPRENDRE_BILAN_FABLE : production. É0+P-A ; si gate ON et modes en PROPOSITION
//                           → BILAN_FABLE_PA_OK (pause humaine) ; sinon → aval → TERMINE.
//   REPRENDRE_BILAN_PA     : rejoue P-A seul → BILAN_FABLE_PA_OK.
//   REPRENDRE_BILAN_PB/PC  : rejoue ce service seul → BILAN_FABLE_PA_OK (bilan en cours).
//   REPRENDRE_BILAN_PD     : rejoue P-D seul → BILAN_FABLE_TERMINE.
//   BILAN_FABLE_PA_OK      : sentinelle (NON pollée) — P-A faits/validés, aval à lancer.
//   BILAN_FABLE_TERMINE    : terminal (NON pollé) — rend la main au pipeline.
//
// GATE : si MODE_VALIDATION_REQUISE (défaut true) et au moins un mode revient en
//   PROPOSITION, on s'arrête sur BILAN_FABLE_PA_OK pour validation humaine des modes
//   (édition de T3_PILIER.pilier_mode), puis l'aval est lancé via REPRENDRE_BILAN_PB
//   → REPRENDRE_BILAN_PC → REPRENDRE_BILAN_PD (P-D conclut sur TERMINE).

'use strict';

const airtableService = require('../../infrastructure/airtableService');
const backupService   = require('../../infrastructure/backupService');
const logger          = require('../../../utils/logger');

const PA = require('./serviceP_A');
const PB = require('./serviceP_B');
const PC = require('./serviceP_C');
const PD = require('./serviceP_D');

// Interrupteur de gate (comme ETAPE3_PRETE / PHASE3_PRETE) — défaut prudent : true.
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

// ─── helper de statut (noms de champs, comme orchestratorPrincipal) ──────────
async function _setStatut(candidat_id, statut) {
  await airtableService.updateVisiteur(candidat_id, {
    statut_analyse_pivar: statut,
    derniere_activite:    new Date().toISOString()
  });
  logger.info('Bilan Fable — statut posé', { candidat_id, statut });
}

// lit les modes déjà présents en T3_PILIER (pour les passer comme validés à l'aval)
async function _lireModesValides(candidat_id) {
  const piliers = await airtableService.getEtape1T3Piliers(candidat_id);
  const modes = {};
  for (const p of (piliers || [])) {
    if (p.pilier && p.pilier_mode) modes[p.pilier] = p.pilier_mode;
  }
  return modes;
}

// ─── phases ──────────────────────────────────────────────────────────────────

async function _phaseAnalysePiliers(candidat_id, prenom) {
  // É0 est appelé À L'INTÉRIEUR de runAnalysePiliers (il en est l'entrée)
  const res = await PA.runAnalysePiliers({ candidat_id, prenom, modesValides: null });
  const tousValides = Object.values(res.modes).every(m => m.statut === 'FOURNI');
  return { res, tousValides };
}

async function _phaseAval(candidat_id, prenom, coutPrincipal, coutSecondaire) {
  const rb = await PB.runFiltreEtChapitre4({ candidat_id, prenom });
  const rc = await PC.runBoucles({ candidat_id, prenom });
  const rd = await PD.runMarqueurs({ candidat_id, prenom, coutPrincipal, coutSecondaire });
  return { cost: (rb.cost || 0) + (rc.cost || 0) + (rd.cost || 0), alerte: rd.alerte };
}

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE (appelé par orchestratorPrincipal selon le statut)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * @param {Object} p
 * @param {string} p.candidat_id
 * @param {string} p.statut            statut déclencheur (REPRENDRE_BILAN_*)
 * @param {string} [p.prenom]
 * @param {Object} [p.coutPrincipal]   coût figé pour P-D (sinon repli signalé)
 * @param {Object} [p.coutSecondaire]
 * @returns {Promise<Object>} { ok, candidat_id, statut_traite, statut_sortie }
 *   (orchestratorPrincipal ajoute { stopReason } pour préserver le statut posé)
 */
async function executerBilanFable({ candidat_id, statut, prenom = '', coutPrincipal = null, coutSecondaire = null }) {
  const startTime = Date.now();
  logger.info('Orchestrateur Bilan Fable — entrée', { candidat_id, statut, gate: MODE_VALIDATION_REQUISE });

  // En cas d'échec : on LÈVE (orchestratorPrincipal pose ERREUR). Pas de try/catch ici.
  await backupService.save(candidat_id, 'before_t3', { orchestrateur: 'bilan_fable', statut });

  let statut_sortie;

  switch (statut) {

    case 'REPRENDRE_BILAN_FABLE': {
      const { tousValides } = await _phaseAnalysePiliers(candidat_id, prenom);
      if (MODE_VALIDATION_REQUISE && !tousValides) {
        statut_sortie = STATUT_PA_OK;                  // pause validation des modes
        break;
      }
      await _phaseAval(candidat_id, prenom, coutPrincipal, coutSecondaire);
      await airtableService.resetTentativesEtape1(candidat_id);
      statut_sortie = STATUT_TERMINE;
      break;
    }

    case 'REPRENDRE_BILAN_PA': {
      await _phaseAnalysePiliers(candidat_id, prenom);
      statut_sortie = STATUT_PA_OK;
      break;
    }

    case 'REPRENDRE_BILAN_PB': {
      await PB.runFiltreEtChapitre4({ candidat_id, prenom });
      statut_sortie = STATUT_PA_OK;                    // bilan en cours, aval à poursuivre
      break;
    }

    case 'REPRENDRE_BILAN_PC': {
      await PC.runBoucles({ candidat_id, prenom });
      statut_sortie = STATUT_PA_OK;
      break;
    }

    case 'REPRENDRE_BILAN_PD': {
      await PD.runMarqueurs({ candidat_id, prenom, coutPrincipal, coutSecondaire });
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
