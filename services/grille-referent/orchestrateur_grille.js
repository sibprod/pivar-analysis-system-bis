// ⟦LOT 2026-09-04 ab⟧ orchestrateur_grille.js — écrit les 4 champs de profil hors JSON (doctrine 92)
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

  // ── 2 · Les quatre agents, et l'assemblage de leurs sorties.
  // `let` (26/08) : la grille est réassignée par la substitution mécanique de
  // jargon (2bis) avant les contrôles — `const` levait « Assignment to
  // constant variable » et arrêtait le pipeline après l'assemblage.
  let { grille, cost: coutAgent, manquantes } = await agent.executer(payload);
  cost += coutAgent;

  // ── 2bis · SAUVEGARDE — première opération après les agents, avant TOUT contrôle
  //          et avant tout retour anticipé.
  //
  // ⚠️ Cette sauvegarde était placée APRÈS le contrôle des missions manquantes.
  //    Le 21/08, l'agent des vigilances a échoué : le contrôle a rendu la main,
  //    la sauvegarde n'a jamais été atteinte, et TOUT ce que les quatre autres
  //    agents avaient produit a été perdu — 14 minutes, 0,36 $, et surtout la
  //    matière qui aurait permis de comprendre.
  //
  //    Un refus ne doit JAMAIS détruire la pièce à conviction. On écrit d'abord,
  //    on juge ensuite. Le fichier porte aussi les missions manquantes et le
  //    payload, pour qu'un passage partiel reste auditable.
  try {
    const fs = require('fs');
    fs.writeFileSync(`/tmp/grille_${candidat_id}.json`, JSON.stringify({
      horodatage: new Date().toISOString(),
      candidat_id,
      manquantes: manquantes || [],
      cout: cost,
      grille: grille || null,
      tuile: payload.profil.tuile,
      piliers: payload.piliers,
      referentiels: { desalignement: payload.referentiels.desalignement }
    }, null, 2));
    logger.info('Grille référent — sortie sauvegardée', {
      candidat_id, fichier: `/tmp/grille_${candidat_id}.json`,
      manquantes: (manquantes || []).length ? manquantes : 'aucune'
    });
  } catch (e) {
    logger.warn('Grille référent — sauvegarde impossible', { candidat_id, error: e.message });
  }

  if (!grille) {
    return { ok: false, motif: 'aucune sortie exploitable des agents', cost, revision_humaine: true };
  }
  // Une mission qui n'a rien rendu laisse un bloc vide. On ne le comble pas :
  // on refuse la grille, parce qu'une grille amputée d'un bloc n'est pas la
  // grille validée — c'est une grille au rabais.
  if (manquantes && manquantes.length) {
    logger.error('Grille référent — mission(s) sans sortie', { candidat_id, manquantes });
    return {
      ok: false,
      motif: `mission(s) sans sortie : ${manquantes.join(', ')}`,
      cost, revision_humaine: true
    };
  }

  // ── 2bis · Le jargon D95 de la sortie des agents se remplace par le code.
  // (24/08 : « Cette disposition » écrit par un agent ; 26/08 : récidive.
  //  Le prompt seul ne suffit pas — la mécanique passe avant les contrôles.
  //  Les mots de SCÉNARIO ne sont pas concernés : eux doivent bloquer.)
  grille = payloadService.substituerJargonSortie(grille);

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

    // ⟦04/09/2026⟧ Les quatre champs de profil, exposés hors du JSON pour que
    // l'espace référent les lise sans parser la grille — et pour qu'aucun écran
    // n'ait besoin d'inventer un libellé quand il ne trouve rien (doctrine 92).
    type_referentiel_libelle:        grille.cartouche?.type_referentiel_libelle || payload.profil.tuile?.titre || '',
    type_referentiel_zone:           grille.cartouche?.type_referentiel_zone    || payload.profil.tuile?.zone  || '',
    profil_personnalise_libelle:     grille.cartouche?.profil_personnalise_libelle     || '',
    profil_personnalise_explication: grille.cartouche?.profil_personnalise_explication || '',
    version_profils:      payload.referentiels.version_profils,
    version_equivalences: payload.referentiels.version_equivalences,
    date_generation:      new Date().toISOString(),
    statut:               'produite',
    alerte_revision:      verdict.signalements.length > 0,
    // ⚠️ La case d'alerte se levait sans dire POURQUOI : la garante voyait un
    //    signal sans pouvoir le lire. Les signalements sont désormais écrits
    //    en clair, un par ligne. Une alerte muette ne sert à personne.
    signalements:         verdict.signalements.join('\n') || ''
  });

  logger.info('Grille référent — produite', {
    candidat_id,
    signalements: verdict.signalements.length,
    cost_usd: cost.toFixed(4)
  });
  return { ok: true, cost, revision_humaine: false, signalements: verdict.signalements };
}

module.exports = { produire };
