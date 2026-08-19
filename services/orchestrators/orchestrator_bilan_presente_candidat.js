// services/orchestrators/orchestrator_bilan_presente_candidat.js
// Orchestrateur Étape 1.4 — BILAN PRÉSENTÉ AU CANDIDAT (L1)
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Rôle :
//   - Assemble le bilan remis au candidat à partir de la matière validée (T3)
//   - N'écrit QUE dans la table BILAN_PRESENTE_CANDIDAT (aucune table d'analyse touchée)
//   - Pose lui-même le statut final et retourne { stopReason } : le principal
//     ne pose donc JAMAIS « terminé » sur ce chemin (même pattern que Fable / mode rapide)
//
// Statuts :
//   - Déclencheur  : 'LANCER BILAN_PRESENTE _CANDIDAT'   (posé manuellement ou en fin de chaîne Fable)
//   - Succès       : 'BILAN_PRESENTE_CANDIDAT_OK'        (terminal — le lien candidat devient servable)
//   - Échec        : 'REPRENDRE_BILAN_FABLE'             (repérable, ne reboucle pas)
//
// Verrou d'affichage : la ligne écrite porte statut = 'publie' ou 'anomalie'.
// Le serveur livrables (dépôt bilan) ne sert QUE les lignes 'publie'.

'use strict';

const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const { genererBilan } = require('../bilan-candidat/orchestrateur_bilan');

const STATUT_DECLENCHEUR = 'LANCER BILAN_PRESENTE _CANDIDAT';
const STATUT_OK          = 'BILAN_PRESENTE_CANDIDAT_OK';
const STATUT_ECHEC       = 'REPRENDRE_BILAN_FABLE';

/**
 * Point d'entrée appelé par orchestrator_principal.
 * @param {Object} params
 * @param {string} params.candidat_id
 * @returns {Promise<Object>} { success, stopReason, statut, alertes }
 */
async function run({ candidat_id }) {
  const startTime = Date.now();
  logger.info('╔═══════════════════════════════════════════════════════════╗', { candidat_id });
  logger.info('║ Bilan présenté au candidat — début                        ║', { candidat_id });
  logger.info('╚═══════════════════════════════════════════════════════════╝', { candidat_id });

  try {
    const r = await genererBilan(candidat_id, airtableService);
    const publie = r.statut === 'publie';

    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: publie ? STATUT_OK : STATUT_ECHEC,
      erreur_analyse:       publie ? '' : (r.alertes || []).join(' · ').substring(0, 1000),
      derniere_activite:    new Date().toISOString()
    });

    logger.info(publie ? '🎉 Bilan présenté au candidat — publié' : '⚠ Bilan présenté au candidat — anomalie', {
      candidat_id,
      statut:        r.statut,
      tentatives:    r.tentatives,
      nb_alertes:    (r.alertes || []).length,
      totalElapsedMs: Date.now() - startTime
    });

    return {
      success:    publie,
      statut:     r.statut,
      alertes:    r.alertes || [],
      stopReason: 'bilan_presente_candidat'
    };

  } catch (error) {
    logger.error('Bilan présenté au candidat — échec', {
      candidat_id,
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });

    try {
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: STATUT_ECHEC,
        erreur_analyse:       (error.message || '').substring(0, 1000),
        derniere_activite:    new Date().toISOString()
      });
    } catch (e) {
      logger.error('Échec mise à jour statut VISITEUR', { candidat_id, error: e.message });
    }

    return {
      success:    false,
      statut:     'anomalie',
      alertes:    [error.message],
      stopReason: 'bilan_presente_candidat_erreur'
    };
  }
}

module.exports = { run, STATUT_DECLENCHEUR, STATUT_OK, STATUT_ECHEC };
