// services/mode-rapide/orchestrator_mode_rapide.js
// Orchestrateur MODE RAPIDE — v1.1 (13/08/2026) — Profil-Cognitif
//
// v1.1 — DEUX TERMINAUX DISTINCTS (décision garante) :
//   MODE_RAPIDE_EVALUE  = portrait produit, protocole absent → non contrôlé.
//   MODE_RAPIDE_CONTROLE = portrait produit ET comparé au protocole complet.
//   (MODE_RAPIDE_TERMINE reste au sélecteur en trace historique, n'est plus posé.)
//
// Enchaîne : profil rapide → (si protocole complet présent) contrôle de concordance.
// Déclenché par le statut VISITEUR « MODE_RAPIDE » (polling → orchestrateur principal).
//
// STATUT EN SORTIE : pose MODE_RAPIDE_EVALUE ou MODE_RAPIDE_CONTROLE et retourne { stopReason } pour
// que l'orchestrateur principal NE pose PAS « terminé » (le mode rapide ne doit
// jamais écrire l'état du pipeline complet). La garante repositionne ensuite le
// statut pipeline réel du candidat si besoin (candidats typiquement déjà terminés).

'use strict';

const airtableService = require('../infrastructure/airtableService');
const serviceProfil   = require('./service_mode_rapide');
const serviceControle = require('./service_mode_rapide_controle');
const logger          = require('../../utils/logger');

async function run({ candidat_id }) {
  if (!candidat_id) throw new Error('orchestrator_mode_rapide.run : candidat_id requis');
  const t0 = Date.now();
  logger.info('═══ Orchestrateur MODE RAPIDE ▶ ═══', { candidat_id });

  const profil = await serviceProfil.run({ candidat_id });

  let controle = { concordance: 'NON_COMPARE' };
  try {
    controle = await serviceControle.run({ candidat_id });
  } catch (e) {
    logger.warn('[ModeRapide] contrôle non exécuté (non bloquant)', { candidat_id, error: e.message });
  }

  // ⭐ v1.1 — deux terminaux distincts : évalué (non contrôlé) vs contrôlé.
  const statutFinal = (controle.concordance && controle.concordance !== 'NON_COMPARE')
    ? 'MODE_RAPIDE_CONTROLE'
    : 'MODE_RAPIDE_EVALUE';
  await airtableService.updateVisiteur(candidat_id, {
    statut_analyse_pivar: statutFinal,
    derniere_activite:    new Date().toISOString()
  });

  const elapsedMs = Date.now() - t0;
  logger.info('═══ MODE RAPIDE ✅ terminé ═══', {
    candidat_id,
    resultat:    profil.non_conclusif ? 'NON_CONCLUSIF' : `socle ${profil.socle}`,
    concordance: controle.concordance,
    elapsedMs
  });

  return {
    success: true, candidat_id,
    stopReason: 'mode_rapide_termine',
    statutFinal,
    non_conclusif: profil.non_conclusif, socle: profil.socle,
    concordance: controle.concordance, elapsedMs
  };
}

module.exports = { run };
