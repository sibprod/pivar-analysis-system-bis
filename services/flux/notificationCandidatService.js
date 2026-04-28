// services/flux/notificationCandidatService.js
// Communication asynchrone candidat — Profil-Cognitif v10.0
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Rôle (Décision n°33 — engagement délai client max 72h) :
//   Envoie 5 types d'emails au candidat :
//   - T0           : confirmation réception + annonce délai 72h (immédiat après statut_test=terminé)
//   - T0+24h       : si bilan prêt → email livraison. Sinon → rien.
//   - T0+48h       : si bilan prêt → email livraison. Sinon → email "élaboration approfondie"
//   - T0+72h       : si bilan prêt → email livraison. Sinon → alerte superviseur
//   - livraison    : email avec le lien vers le bilan (statut_analyse_pivar=terminé)
//
// PHASE D (2026-04-28) — v10 :
//   - Fichier NOUVEAU — squelette MINIMAL FONCTIONNEL pour test Cécile
//   - Polling fonctionnel : interroge Airtable et marque les emails comme envoyés
//   - Envoi réel via Resend : non implémenté (sera fait en Phase D-2 avec templates HTML)
//
// État : SQUELETTE FONCTIONNEL — détecte les besoins mais n'envoie pas d'emails

'use strict';

const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

// ─── État interne ────────────────────────────────────────────────────────────
let _pollingInterval = null;
let _cycleCount = 0;

// ═══════════════════════════════════════════════════════════════════════════
// POLLING
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Démarre le polling de notifications candidat
 * @param {number} intervalMs - intervalle en ms (default 60min = 3600000)
 */
function startPolling(intervalMs = 3600000) {
  if (_pollingInterval) {
    logger.warn('Notification candidat polling already started');
    return;
  }

  logger.info('Starting notification candidat polling', {
    intervalMs,
    intervalMin: (intervalMs / 60000).toFixed(0)
  });

  runPollingCycle();
  _pollingInterval = setInterval(runPollingCycle, intervalMs);
}

function stopPolling() {
  if (_pollingInterval) {
    clearInterval(_pollingInterval);
    _pollingInterval = null;
    logger.info('Notification candidat polling stopped');
  }
}

/**
 * Un cycle de polling : trouve les candidats à emailler et envoie ce qui doit l'être
 */
async function runPollingCycle() {
  _cycleCount++;
  logger.debug('Notification candidat polling cycle', { cycle: _cycleCount });

  try {
    const candidats = await airtableService.getCandidatsAEmailler();

    if (candidats.length === 0) {
      logger.debug('Notification candidat — aucun email à envoyer', { cycle: _cycleCount });
      return;
    }

    logger.info('Notification candidat — emails à envoyer', {
      cycle: _cycleCount,
      count: candidats.length
    });

    const now = new Date();

    for (const candidat of candidats) {
      const id      = candidat.candidate_ID;
      const dateT0  = candidat.date_T0 ? new Date(candidat.date_T0) : null;

      if (!dateT0) {
        logger.debug('Skipping candidat sans date_T0', { id });
        continue;
      }

      const ageMs = now - dateT0;
      const age24h = ageMs >= 24 * 60 * 60 * 1000;
      const age48h = ageMs >= 48 * 60 * 60 * 1000;
      const age72h = ageMs >= 72 * 60 * 60 * 1000;

      // Déterminer quels emails envoyer
      const aEnvoyer = [];

      // T0 : pas encore envoyé
      if (!candidat.email_T0_envoye) {
        aEnvoyer.push('T0');
      }

      // 24h : âge >= 24h ET pas encore envoyé
      if (age24h && !candidat.email_24h_envoye) {
        aEnvoyer.push('24h');
      }

      // 48h : âge >= 48h ET pas encore envoyé
      if (age48h && !candidat.email_48h_envoye) {
        aEnvoyer.push('48h');
      }

      // 72h : âge >= 72h ET pas encore envoyé
      if (age72h && !candidat.email_72h_envoye) {
        aEnvoyer.push('72h');
      }

      // Livraison : statut terminé ET pas encore envoyé
      if (candidat.statut_analyse_pivar === 'terminé' && !candidat.email_livraison_envoye) {
        aEnvoyer.push('livraison');
      }

      // Envoyer
      for (const type of aEnvoyer) {
        try {
          await envoyerEmail(candidat, type);
          await airtableService.markerEmailCandidatEnvoye(id, type);
        } catch (error) {
          logger.error('Failed to send email to candidat', {
            id, type, error: error.message
          });
        }
      }
    }
  } catch (error) {
    logger.error('Notification candidat polling cycle error', {
      cycle: _cycleCount,
      error: error.message
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENVOI D'EMAIL CANDIDAT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Envoie un email au candidat
 * SQUELETTE Phase D : juste log, pas d'envoi réel
 * @param {Object} candidat - record VISITEUR avec Email, Prenom, etc.
 * @param {string} type - 'T0' | '24h' | '48h' | '72h' | 'livraison'
 */
async function envoyerEmail(candidat, type) {
  const id = candidat.candidate_ID;
  const email = candidat.Email;

  if (!email) {
    logger.warn('Candidat sans Email, skip', { id, type });
    return;
  }

  logger.info('📧 Email candidat — TO BE IMPLEMENTED IN PHASE D-2', {
    id,
    type,
    destinataire: email
  });

  // Phase D-2 : envoyer un vrai email avec Resend
  // const { Resend } = require('resend');
  // const resend = new Resend(process.env.RESEND_API_KEY);
  //
  // const subjects = {
  //   T0:        'Profil-Cognitif — Confirmation de réception de tes 25 réponses',
  //   '24h':     'Profil-Cognitif — Ton bilan est en cours d\'élaboration',
  //   '48h':     'Profil-Cognitif — Ton bilan demande une élaboration approfondie',
  //   '72h':     'Profil-Cognitif — Update sur ton bilan',
  //   livraison: '✨ Profil-Cognitif — Ton bilan personnel est disponible'
  // };
  //
  // const subject = subjects[type] || `Profil-Cognitif — ${type}`;
  //
  // await resend.emails.send({
  //   from: 'bilan@profil-cognitif.com',
  //   to: email,
  //   subject,
  //   html: buildEmailHtml(type, candidat)  // à concevoir Phase D-2
  // });
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  startPolling,
  stopPolling,
  runPollingCycle,
  envoyerEmail
};
