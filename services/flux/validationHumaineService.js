// services/flux/validationHumaineService.js
// Workflow de validation humaine (Mode 3 du vérificateur) — Profil-Cognitif v10.0
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Rôle (Décision n°16) :
//   - Quand le vérificateur retourne Mode 3 (validation humaine), le candidat est mis en
//     statut EN_ATTENTE_VALIDATION_HUMAINE et un email est envoyé au superviseur (Isabelle)
//   - Le superviseur tranche dans Airtable VISITEUR :
//     * validation_humaine_action = RELANCER_AGENT_T1 | RELANCER_VERIFICATEUR_T1 | ACCEPTER_TEL_QUEL | ABANDONNER
//     * validation_humaine_motif = motif libre
//   - Ce service est lancé par cron toutes les minutes pour détecter les actions tranchées
//     et appliquer le nouveau statut au candidat
//
// PHASE D (2026-04-28) — v10 :
//   - Fichier NOUVEAU — squelette MINIMAL FONCTIONNEL pour test Cécile
//   - Polling fonctionnel : interroge Airtable et applique l'action via airtableService
//   - Envoi email superviseur : non implémenté (sera fait en Phase D-2 via Resend)
//
// État : SQUELETTE FONCTIONNEL — gère le polling mais n'envoie pas d'emails

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
 * Démarre le polling de validation humaine
 * @param {number} intervalMs - intervalle en ms (default 60s)
 */
function startPolling(intervalMs = 60000) {
  if (_pollingInterval) {
    logger.warn('Validation humaine polling already started');
    return;
  }

  logger.info('Starting validation humaine polling', { intervalMs });

  runPollingCycle();
  _pollingInterval = setInterval(runPollingCycle, intervalMs);
}

function stopPolling() {
  if (_pollingInterval) {
    clearInterval(_pollingInterval);
    _pollingInterval = null;
    logger.info('Validation humaine polling stopped');
  }
}

/**
 * Un cycle de polling : trouve les candidats en attente avec une action tranchée
 * et applique l'action
 */
async function runPollingCycle() {
  _cycleCount++;
  logger.debug('Validation humaine polling cycle', { cycle: _cycleCount });

  try {
    const candidats = await airtableService.getCandidatsEnAttenteValidation();

    if (candidats.length === 0) {
      logger.debug('Validation humaine — no actions to apply', { cycle: _cycleCount });
      return;
    }

    logger.info('Validation humaine — actions à appliquer', {
      cycle: _cycleCount,
      count: candidats.length
    });

    for (const candidat of candidats) {
      const id     = candidat.candidate_ID;
      const action = candidat.validation_humaine_action;
      const motif  = candidat.validation_humaine_motif || '';

      try {
        await airtableService.appliquerValidationHumaine(id, action, motif);
        logger.info('Validation humaine appliquée', { id, action });
      } catch (error) {
        logger.error('Failed to apply validation humaine', {
          id, action, error: error.message
        });
      }
    }
  } catch (error) {
    logger.error('Validation humaine polling cycle error', {
      cycle: _cycleCount,
      error: error.message
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ENVOI D'EMAIL SUPERVISEUR (Phase D-2)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Envoie un email au superviseur quand un candidat passe en EN_ATTENTE_VALIDATION_HUMAINE
 * SQUELETTE Phase D : juste log, pas d'envoi réel
 *
 * @param {string} candidat_id
 * @param {Object} contexte - { verdict, nb_violations, mode_recommande, link_airtable }
 */
async function envoyerEmailSuperviseur(candidat_id, contexte) {
  logger.warn('📧 Email superviseur — TO BE IMPLEMENTED IN PHASE D-2', {
    candidat_id,
    contexte,
    destinataire: process.env.SUPERVISOR_EMAIL || 'NOT_CONFIGURED'
  });

  // Phase D-2 : envoyer un vrai email avec Resend
  // const { Resend } = require('resend');
  // const resend = new Resend(process.env.RESEND_API_KEY);
  //
  // await resend.emails.send({
  //   from: 'no-reply@profil-cognitif.com',
  //   to: process.env.SUPERVISOR_EMAIL,
  //   subject: `🔍 Validation humaine requise — Candidat ${candidat_id}`,
  //   html: `
  //     <h2>Validation humaine requise</h2>
  //     <p>Le candidat <strong>${candidat_id}</strong> nécessite ton arbitrage suite au vérificateur T1.</p>
  //     <ul>
  //       <li>Verdict : ${contexte.verdict}</li>
  //       <li>Nombre de violations : ${contexte.nb_violations}</li>
  //       <li>Mode recommandé : ${contexte.mode_recommande}</li>
  //     </ul>
  //     <p><a href="${contexte.link_airtable}">Ouvrir dans Airtable</a></p>
  //     <p>Pour trancher, mets à jour les champs suivants dans VISITEUR :</p>
  //     <ul>
  //       <li><strong>validation_humaine_action</strong> : RELANCER_AGENT_T1 | RELANCER_VERIFICATEUR_T1 | ACCEPTER_TEL_QUEL | ABANDONNER</li>
  //       <li><strong>validation_humaine_motif</strong> : ton motif libre</li>
  //     </ul>
  //   `
  // });
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  startPolling,
  stopPolling,
  runPollingCycle,
  envoyerEmailSuperviseur
};
