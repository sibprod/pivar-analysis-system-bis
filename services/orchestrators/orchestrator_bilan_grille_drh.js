// services/orchestrators/orchestrator_bilan_grille_drh.js
// La bascule de statut de la grille référent.
//
// ⚠️ AVANT MODIFICATION : lire docs/14-cablage-grille-referent.md
//
// FLUX :
//   ETAPE2_TESTDEC_COMPLET  ──(bascule)──▶  LANCER_BILAN_GRILLE_DRH
//   LANCER_BILAN_GRILLE_DRH ──(agent)────▶  BILAN_GRILLE_DRH_OK
//                             (échec)  ──▶  ERREUR + motif
//
// Modèle suivi : orchestrator_bilan_presente_candidat.js
//
'use strict';

const airtableService = require('../infrastructure/airtableService');
const orchestrateur   = require('../grille-referent/orchestrateur_grille');
const logger          = require('../../utils/logger');

const STATUT = {
  DECLENCHEUR: 'ETAPE2_TESTDEC_COMPLET',
  A_LANCER:    'LANCER_BILAN_GRILLE_DRH',
  FAIT:        'BILAN_GRILLE_DRH_OK',
  ERREUR:      'ERREUR'
};

/**
 * Bascule les candidats dont la mesure de décentration vient de s'achever.
 * Geste séparé de l'exécution : si la production échoue, le candidat reste
 * en file plutôt que de repartir au début du flux.
 */
async function armer() {
  const enAttente = await airtableService.getVisiteursByStatus({
    statut_analyse_pivar: [STATUT.DECLENCHEUR]
  });
  for (const v of enAttente) {
    const candidat_id = v.candidate_ID || v.candidat_id;
    if (!candidat_id) continue;
    await airtableService.updateVisiteur(candidat_id, { statut_analyse_pivar: STATUT.A_LANCER });
    logger.info('Grille référent — armée', { candidat_id });
  }
  return enAttente.length;
}

/**
 * Produit la grille pour un candidat et positionne son statut.
 * Ne relance jamais tout seul : un échec est un signal, pas un incident à masquer.
 */
async function executer(candidat_id) {
  logger.info('Grille référent — exécution', { candidat_id });
  try {
    const res = await orchestrateur.produire(candidat_id);

    if (!res.ok) {
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: STATUT.ERREUR,
        erreur_analyse: `GRILLE RÉFÉRENT — ${res.motif}`,
        type_erreur_analyse: res.revision_humaine ? 'REVISION_HUMAINE' : 'TECHNIQUE',
        derniere_tentative_analyse: new Date().toISOString()
      });
      logger.error('Grille référent — échec', { candidat_id, motif: res.motif });
      return { ok: false, motif: res.motif };
    }

    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: STATUT.FAIT,
      erreur_analyse: '',
      derniere_tentative_analyse: new Date().toISOString()
    });
    logger.info('Grille référent — disponible pour le référent', {
      candidat_id, cost_usd: (res.cost || 0).toFixed(4), signalements: (res.signalements || []).length
    });
    return { ok: true, cost: res.cost };

  } catch (error) {
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: STATUT.ERREUR,
      erreur_analyse: `GRILLE RÉFÉRENT — exception : ${error.message}`,
      type_erreur_analyse: 'TECHNIQUE',
      derniere_tentative_analyse: new Date().toISOString()
    }).catch(() => {});
    logger.error('Grille référent — exception', { candidat_id, error: error.message });
    return { ok: false, motif: error.message };
  }
}

/** Traite la file : arme les candidats prêts, puis exécute ceux qui attendent. */
async function traiterFile() {
  const armes = await armer();
  const aLancer = await airtableService.getVisiteursByStatus({
    statut_analyse_pivar: [STATUT.A_LANCER]
  });
  const resultats = [];
  for (const v of aLancer) {
    const candidat_id = v.candidate_ID || v.candidat_id;
    if (!candidat_id) continue;
    resultats.push({ candidat_id, ...(await executer(candidat_id)) });
  }
  logger.info('Grille référent — file traitée', {
    armes, traites: resultats.length, echecs: resultats.filter(r => !r.ok).length
  });
  return resultats;
}

module.exports = { armer, executer, traiterFile, STATUT };
