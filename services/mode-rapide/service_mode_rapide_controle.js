// services/mode-rapide/service_mode_rapide_controle.js
// Contrôle MODE RAPIDE ↔ PROTOCOLE COMPLET — v2.0 (13/08/2026) — Profil-Cognitif
//
// PRINCIPE : comparaison 100 % MÉCANIQUE (aucun appel au modèle) entre la
//   dernière ligne MODE_RAPIDE d'un candidat et l'architecture du protocole
//   complet (ETAPE1_T3_PILIER : rôles/modes ; ETAPE1_T3_BILAN : filtre).
//
// DOCTRINE DES DIVERGENCES (TABLE_MODE_RAPIDE_SPEC, garante 13/08) :
//   CRITIQUE     : socle différent · amont ou aval sur un pilier différent ·
//                  NON_CONCLUSIF alors que le protocole conclut.
//   NON CRITIQUE : fonctionnel ↔ absence · formulations (filtre/modes) ·
//                  dénominations libres des gestes.
//   Le filtre et les modes sont posés CÔTE À CÔTE (comparaison_json) : la
//   convergence de SENS est un jugement de la garante, jamais de la machine.
//
// ÉCRITURE CONFINÉE : ne patch QUE la ligne MODE_RAPIDE (champs de contrôle).

'use strict';

const accesModeRapide = require('./acces_mode_rapide'); // accès autonome — aucun fichier existant modifié
const logger          = require('../../utils/logger');

function comparer(rapide, protocole) {
  const critiques = [], nonCritiques = [];
  const socleR = rapide.socle || null, socleP = protocole.socle || null;

  if (rapide.statut_resultat === 'NON_CONCLUSIF' && socleP) {
    critiques.push(`Mode rapide NON CONCLUSIF alors que le protocole conclut (socle ${socleP}).`);
  } else if (socleR && socleP && socleR !== socleP) {
    critiques.push(`SOCLE divergent : rapide ${socleR} vs protocole ${socleP}.`);
  }

  const rolesR = rapide.roles || {}, rolesP = protocole.roles || {};
  const trouve = (roles, cible) =>
    Object.keys(roles).find(p => String(roles[p] || '').toLowerCase() === cible) || null;

  for (const roleStruct of ['amont', 'aval']) {
    const pR = trouve(rolesR, roleStruct), pP = trouve(rolesP, roleStruct);
    if (pR !== pP) {
      if (pR && pP) critiques.push(`Rôle ${roleStruct.toUpperCase()} divergent : rapide ${pR} vs protocole ${pP}.`);
      else nonCritiques.push(`Rôle ${roleStruct} : ${pR ? `posé sur ${pR} par le rapide` : `posé sur ${pP} par le protocole`}, absent chez l'autre — position structurelle à trancher par la garante.`);
    }
  }
  for (const p of ['P1', 'P2', 'P3', 'P4', 'P5']) {
    const rR = String(rolesR[p] || '').toLowerCase(), rP = String(rolesP[p] || '').toLowerCase();
    if (rR && rP && rR !== rP && !['amont', 'aval'].includes(rR) && !['amont', 'aval'].includes(rP)) {
      nonCritiques.push(`${p} : ${rR} (rapide) vs ${rP} (protocole).`);
    }
  }
  nonCritiques.push('Filtre et modes : formulations posées côte à côte dans comparaison_json — convergence de sens à juger par la garante (le protocole reproduit une lecture, pas un libellé).');

  const statut = critiques.length ? 'DIVERGENCE_CRITIQUE'
               : (nonCritiques.length > 1 ? 'DIVERGENCES_NON_CRITIQUES' : 'CONFORME');
  return { statut, critiques, nonCritiques };
}

async function run({ candidat_id }) {
  if (!candidat_id) throw new Error('service_mode_rapide_controle.run : candidat_id requis');

  const rec = await accesModeRapide.getModeRapideDerniere(candidat_id);
  if (!rec) throw new Error(`Aucune ligne MODE_RAPIDE pour ${candidat_id} — lancer d'abord le profil rapide.`);

  const protocole = await accesModeRapide.getArchitecturePourControle(candidat_id);
  if (!protocole || !protocole.socle) {
    logger.info('[ModeRapide contrôle] pas de protocole complet — NON_COMPARE conservé', { candidat_id });
    return { success: true, candidat_id, concordance: 'NON_COMPARE' };
  }

  const rapide = {
    socle:           rec.socle || null,
    statut_resultat: rec.statut_resultat || '',
    roles:           JSON.parse(rec.roles_json || '{}'),
    filtre:          rec.filtre || '',
    modes:           JSON.parse(rec.modes_json || '{}')
  };
  const { statut, critiques, nonCritiques } = comparer(rapide, protocole);

  await accesModeRapide.patchModeRapideControle(rec.airtable_id, {
    protocole_existe:          true,
    concordance_statut:        statut,
    divergences_critiques:     critiques.join('\n') || '(aucune)',
    divergences_non_critiques: nonCritiques.join('\n') || '(aucune)',
    comparaison_json: JSON.stringify({
      socle:  { rapide: rapide.socle,  protocole: protocole.socle },
      roles:  { rapide: rapide.roles,  protocole: protocole.roles },
      filtre: { rapide: rapide.filtre, protocole: protocole.filtre },
      modes:  { rapide: rapide.modes,  protocole: protocole.modes }
    }, null, 2),
    controle_date: new Date().toISOString()
  });

  logger.info('[ModeRapide contrôle] ✅', { candidat_id, concordance: statut, nb_critiques: critiques.length });
  return { success: true, candidat_id, concordance: statut, critiques, nonCritiques };
}

module.exports = { run, comparer };
