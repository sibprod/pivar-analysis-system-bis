// services/orchestrators/orchestrator_bilan_grille_drh.js
// Étape 1.5 — LA GRILLE RÉFÉRENT
//
// ⚠️ AVANT MODIFICATION : lire docs/14-cablage-grille-referent.md
//
// FLUX :
//   ETAPE2_TESTDEC_COMPLET  ──(bascule)──▶  LANCER_BILAN_GRILLE_DRH
//   LANCER_BILAN_GRILLE_DRH ──(ce fichier)▶ BILAN_GRILLE_DRH_OK
//                             (échec)   ──▶ ERREUR + motif
//
// MÊME PATTERN que orchestrator_bilan_presente_candidat :
//   · hors pipeline d'analyse — n'écrit QUE dans GRILLE_REFERENT et
//     GRILLE_VERBALISATION (aucune table d'analyse touchée) ;
//   · pose LUI-MÊME son statut final et retourne { stopReason } :
//     le principal ne pose donc JAMAIS « terminé » sur ce chemin.
//
'use strict';

const airtableService = require('../infrastructure/airtableService');
const orchestrateur   = require('../grille-referent/orchestrateur_grille');
const logger          = require('../../utils/logger');

const STATUT_DECLENCHEUR = 'LANCER_BILAN_GRILLE_DRH';
const STATUT_OK          = 'BILAN_GRILLE_DRH_OK';
const STATUT_ERREUR      = 'ERREUR';
const STATUT_AMONT       = 'ETAPE2_TESTDEC_COMPLET';

/**
 * Bascule les candidats dont la mesure de décentration vient de s'achever.
 * Geste séparé de l'exécution : si la production échoue, le candidat reste en
 * file plutôt que de repartir au début du flux.
 */
async function armer() {
  const enAttente = await airtableService.getVisiteursByStatus({
    statut_analyse_pivar: [STATUT_AMONT]
  });
  let armes = 0;
  for (const v of enAttente) {
    const candidat_id = v.candidate_ID || v.candidat_id;
    if (!candidat_id) continue;
    await airtableService.updateVisiteur(candidat_id, { statut_analyse_pivar: STATUT_DECLENCHEUR });
    logger.info('Grille référent — armée', { candidat_id });
    armes++;
  }
  return armes;
}

/**
 * Produit la grille d'un candidat et pose son statut final.
 * Signature alignée sur orchestrator_bilan_presente_candidat.run().
 * @param {Object} params
 * @param {string} params.candidat_id
 * @returns {Promise<{ success: boolean, stopReason: string, cost?: number, motif?: string }>}
 */
async function run({ candidat_id }) {
  logger.info('Grille référent — exécution', { candidat_id });

  try {
    const res = await orchestrateur.produire(candidat_id);

    if (!res.ok) {
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar:       STATUT_ERREUR,
        erreur_analyse:             `GRILLE RÉFÉRENT — ${res.motif}`,
        type_erreur_analyse:        res.revision_humaine ? 'REVISION_HUMAINE' : 'TECHNIQUE',
        derniere_tentative_analyse: new Date().toISOString()
      });
      logger.error('Grille référent — échec, statut ERREUR posé', { candidat_id, motif: res.motif });
      return { success: false, stopReason: 'grille_referent_echec', motif: res.motif };
    }

    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar:       STATUT_OK,
      erreur_analyse:             '',
      derniere_tentative_analyse: new Date().toISOString()
    });
    logger.info('Grille référent — disponible pour le référent', {
      candidat_id,
      cost_usd:     (res.cost || 0).toFixed(4),
      signalements: (res.signalements || []).length
    });
    return { success: true, stopReason: 'grille_referent_ok', cost: res.cost };

  } catch (error) {
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar:       STATUT_ERREUR,
      erreur_analyse:             `GRILLE RÉFÉRENT — exception : ${error.message}`,
      type_erreur_analyse:        'TECHNIQUE',
      derniere_tentative_analyse: new Date().toISOString()
    }).catch(() => {});
    logger.error('Grille référent — exception', { candidat_id, error: error.message });
    return { success: false, stopReason: 'grille_referent_exception', motif: error.message };
  }
}

/** Traite la file complète : arme les candidats prêts, puis exécute ceux qui attendent. */
async function traiterFile() {
  const armes = await armer();
  const aLancer = await airtableService.getVisiteursByStatus({
    statut_analyse_pivar: [STATUT_DECLENCHEUR]
  });
  const resultats = [];
  for (const v of aLancer) {
    const candidat_id = v.candidate_ID || v.candidat_id;
    if (!candidat_id) continue;
    resultats.push({ candidat_id, ...(await run({ candidat_id })) });
  }
  logger.info('Grille référent — file traitée', {
    armes, traites: resultats.length, echecs: resultats.filter(r => !r.success).length
  });
  return resultats;
}

module.exports = {
  run,
  armer,
  traiterFile,
  STATUT_DECLENCHEUR,
  STATUT_OK,
  STATUT_AMONT
};
