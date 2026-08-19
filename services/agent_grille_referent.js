// services/grille-referent/agent_grille_referent.js
// Appel de l'agent GRILLE RÉFÉRENT, normalisation de sa sortie.
//
// ⚠️ AVANT MODIFICATION : lire docs/12-doctrine-preuve-et-mission-agent-grille.md
//
// Ce fichier n'écrit AUCUN contenu : il appelle, il normalise, il rend.
// Les contrôles sont dans controles_grille.js, l'écriture dans l'orchestrateur.
//
'use strict';

const agentBase = require('../infrastructure/agentBase');
const logger    = require('../../utils/logger');

const SERVICE_NAME = 'agent_grille_referent';
const PROMPT_PATH  = 'grille-referent/prompt_grille_referent.md';

function pick(obj, keys) {
  if (!obj) return null;
  for (const k of keys) if (obj[k] !== undefined) return obj[k];
  return null;
}
function tab(v) { return Array.isArray(v) ? v : []; }

/**
 * Normalise la sortie de l'agent.
 * On ne complète RIEN : un champ absent reste vide et sera vu par les contrôles.
 * Compléter ici masquerait une défaillance de l'agent.
 */
function normaliser(brut, payload) {
  const g = pick(brut, ['GRILLE', 'grille']) || brut || {};
  return {
    candidat_id: g.candidat_id || payload.candidat_id,
    cartouche:   g.cartouche || {},
    bloc_apport: {
      cle_tuile:            (g.bloc_apport && g.bloc_apport.cle_tuile) || payload.profil.cle_tuile,
      titre:                (g.bloc_apport && g.bloc_apport.titre) || '',
      zone:                 (g.bloc_apport && g.bloc_apport.zone) || '',
      definition_type:      (g.bloc_apport && g.bloc_apport.definition_type) || '',
      application_au_socle: (g.bloc_apport && g.bloc_apport.application_au_socle) || '',
      chaine_ajoute:        (g.bloc_apport && g.bloc_apport.chaine_ajoute) || '',
      atouts:               tab(g.bloc_apport && g.bloc_apport.atouts),
      couts:                tab(g.bloc_apport && g.bloc_apport.couts)
    },
    bloc_profil: {
      filtre: (g.bloc_profil && g.bloc_profil.filtre) || '',
      outils: tab(g.bloc_profil && g.bloc_profil.outils)
    },
    bloc_dimensions:          tab(g.bloc_dimensions),
    bloc_vigilances:          tab(g.bloc_vigilances),
    situations_non_traduites: tab(g.situations_non_traduites),
    revision_humaine:         g.revision_humaine === true,
    motif_revision:           g.motif_revision || '',
    verbalisations:           tab(g.verbalisations)
  };
}

/**
 * Exécute l'agent. Deux tentatives : une sortie illisible est souvent une
 * troncature, pas une erreur de fond.
 * @returns {Promise<{ grille: Object|null, cost: number }>}
 */
async function executer(payload) {
  const candidat_id = payload.candidat_id;
  let sortie = null, cout = 0;

  for (let essai = 1; essai <= 2 && sortie === null; essai++) {
    try {
      const res = await agentBase.callAgent({
        serviceName: SERVICE_NAME,
        promptPath:  PROMPT_PATH,
        payload,
        candidatId:  candidat_id
      });
      cout += res.cost || 0;
      sortie = res.result;
    } catch (e) {
      logger.warn('Agent grille référent — sortie illisible', { candidat_id, essai, error: e.message });
    }
  }

  if (!sortie) {
    logger.error('Agent grille référent — aucune sortie exploitable', { candidat_id });
    return { grille: null, cost: cout };
  }

  const grille = normaliser(sortie, payload);
  logger.info('Agent grille référent — sortie normalisée', {
    candidat_id,
    outils:        grille.bloc_profil.outils.length,
    vigilances:    grille.bloc_vigilances.length,
    verbalisations: grille.verbalisations.length,
    revision:      grille.revision_humaine,
    cost_usd:      cout.toFixed(4)
  });
  return { grille, cost: cout };
}

module.exports = { executer, normaliser, SERVICE_NAME, PROMPT_PATH };
