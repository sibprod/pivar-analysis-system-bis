// services/grille-referent/orchestrateur_grille.js
// Enchaîne : payload → agent → contrôles → écriture.
//
// ⚠️ AVANT MODIFICATION : lire docs/12-doctrine-preuve-et-mission-agent-grille.md
//
// Principe qui gouverne ce fichier :
//   RENDRE UNE GRILLE FAUSSE EST PLUS GRAVE QUE NE PAS EN RENDRE.
//   Tout échec de contrôle bloque l'écriture et part en révision humaine.
//
'use strict';

const payloadService = require('./service_grille_payload');
const agent          = require('./agent_grille_referent');
const controles      = require('./controles_grille');
const refGrille      = require('./airtable_grille');
const logger         = require('../../utils/logger');

/**
 * Produit la grille référent d'un candidat.
 * @returns {Promise<{ ok: boolean, motif?: string, cost: number, revision_humaine: boolean }>}
 */
async function produire(candidat_id) {
  logger.info('Grille référent — démarrage', { candidat_id });
  let cost = 0;

  // ── 1 · Le payload. Il refuse de se construire sur une matière incomplète.
  let payload;
  try {
    payload = await payloadService.construire(candidat_id);
  } catch (e) {
    logger.error('Grille référent — payload impossible', { candidat_id, error: e.message, manques: e.manques });
    return { ok: false, motif: `matière incomplète : ${e.message}`, cost, revision_humaine: true };
  }

  // ── 2 · L'agent.
  const { grille, cost: coutAgent } = await agent.executer(payload);
  cost += coutAgent;
  if (!grille) {
    return { ok: false, motif: 'aucune sortie exploitable de l\'agent', cost, revision_humaine: true };
  }

  // ── 3 · Les contrôles. Un bloquant interdit l'écriture.
  const verdict = controles.controler(grille, payload);
  if (!verdict.conforme) {
    logger.error('Grille référent — non conforme, écriture refusée', {
      candidat_id, bloquants: verdict.bloquants
    });
    return {
      ok: false,
      motif: `contrôles non passés : ${verdict.bloquants.join(' · ')}`,
      cost,
      revision_humaine: true
    };
  }

  // ── 4 · La verbalisation AVANT la grille.
  // Ordre volontaire : une grille écrite sans sa verbalisation serait une grille
  // dont les écarts ne sont pas documentés — donc invalidable (R8).
  try {
    await refGrille.insertVerbalisations(candidat_id, (grille.verbalisations || []).map(v => ({
      ...v, version_referentiel: payload.referentiels.version_profils
    })));
  } catch (e) {
    logger.error('Grille référent — verbalisations non écrites, grille refusée', { candidat_id, error: e.message });
    return { ok: false, motif: 'verbalisations non enregistrées', cost, revision_humaine: true };
  }

  // ── 5 · La grille. Le rendu est CONSERVÉ : il doit pouvoir être reproduit
  // à l'identique s'il est contesté. On ne régénère jamais à l'affichage.
  await refGrille.upsertGrilleReferent(candidat_id, {
    grille_json:          JSON.stringify(grille),
    cle_tuile:            payload.profil.cle_tuile,
    version_profils:      payload.referentiels.version_profils,
    version_equivalences: payload.referentiels.version_equivalences,
    date_generation:      new Date().toISOString(),
    statut:               'produite',
    alerte_revision:      verdict.signalements.length > 0
  });

  logger.info('Grille référent — produite', {
    candidat_id,
    signalements: verdict.signalements.length,
    cost_usd: cost.toFixed(4)
  });
  return { ok: true, cost, revision_humaine: false, signalements: verdict.signalements };
}

module.exports = { produire };
