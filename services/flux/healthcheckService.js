// services/flux/healthcheckService.js
// Healthcheck préalable des services externes — Profil-Cognitif v10.0
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Rôle (Décision n°23) :
//   - Vérifier que les 3 services externes sont OPÉRATIONNELS avant de lancer un pipeline :
//     1. Airtable (lecture VISITEUR)
//     2. Anthropic Claude API (ping minimal)
//     3. Resend (lecture status API)
//   - Si KO, skip le cycle de polling et alerter le superviseur (anti-spam : 1 alerte/jour max)
//
// PHASE D (2026-04-28) — v10 :
//   - Fichier NOUVEAU — squelette MINIMAL FONCTIONNEL pour test Cécile
//   - Toutes les fonctions retournent allOk: true par défaut
//   - À enrichir en Phase D-2 (Décision n°23) avec :
//     * Vrais checks Airtable / Claude / Resend
//     * Anti-spam : flag persisté en mémoire (dernière alerte envoyée < 24h)
//     * Email superviseur via Resend si KO
//
// État : SQUELETTE — non bloquant pour le pipeline T1+Vérificateur

'use strict';

const logger = require('../../utils/logger');

// ─── État interne (anti-spam) ────────────────────────────────────────────────
let _lastAlertSent = null;  // Date du dernier email d'alerte superviseur
const ALERT_COOLDOWN_MS = 24 * 60 * 60 * 1000;  // 24h

// ═══════════════════════════════════════════════════════════════════════════
// CHECKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Vérifie l'accès à Airtable (lecture d'un record VISITEUR)
 * SQUELETTE Phase D : retourne toujours OK
 */
async function checkAirtable() {
  try {
    // Phase D-2 : faire un vrai test avec airtableService.getVisiteursByStatus({}) avec maxRecords=1
    return { service: 'airtable', ok: true, latency_ms: 0 };
  } catch (error) {
    return { service: 'airtable', ok: false, error: error.message };
  }
}

/**
 * Vérifie l'accès à Claude API (appel minimal)
 * SQUELETTE Phase D : retourne toujours OK
 */
async function checkClaude() {
  try {
    // Phase D-2 : faire un vrai test avec un appel max_tokens=10 minimal
    return { service: 'claude', ok: true, latency_ms: 0 };
  } catch (error) {
    return { service: 'claude', ok: false, error: error.message };
  }
}

/**
 * Vérifie l'accès à Resend (status API)
 * SQUELETTE Phase D : retourne toujours OK
 */
async function checkResend() {
  try {
    // Phase D-2 : faire un vrai test avec resend.domains.list() ou /v1/status
    if (!process.env.RESEND_API_KEY) {
      return { service: 'resend', ok: false, error: 'RESEND_API_KEY not configured' };
    }
    return { service: 'resend', ok: true, latency_ms: 0 };
  } catch (error) {
    return { service: 'resend', ok: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// VÉRIFICATION GLOBALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Vérifie tous les services externes
 * @returns {Promise<{allOk: boolean, services: Array, failedCount: number}>}
 */
async function checkAllServices() {
  logger.debug('Healthcheck — checking all external services');

  const results = await Promise.all([
    checkAirtable(),
    checkClaude(),
    checkResend()
  ]);

  const failedCount = results.filter(r => !r.ok).length;
  const allOk = failedCount === 0;

  logger.info('Healthcheck completed', {
    allOk,
    failedCount,
    services: results.map(r => `${r.service}:${r.ok ? 'OK' : 'KO'}`).join(', ')
  });

  return { allOk, services: results, failedCount };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALERTE SUPERVISEUR (anti-spam : 1/jour max)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Envoie une alerte au superviseur si des services sont KO
 * SQUELETTE Phase D : juste log, pas d'email
 * Phase D-2 : envoyer un vrai email Resend
 */
async function alertSuperviseurSiBesoin(checkResults) {
  if (checkResults.allOk) return;

  // Anti-spam : 1 alerte par 24h max
  const now = Date.now();
  if (_lastAlertSent && (now - _lastAlertSent) < ALERT_COOLDOWN_MS) {
    logger.debug('Healthcheck — alerte superviseur skipped (cooldown)', {
      lastAlertAge_min: ((now - _lastAlertSent) / 60000).toFixed(0)
    });
    return;
  }

  logger.warn('🚨 ALERT SUPERVISEUR — services externes KO', {
    failedServices: checkResults.services.filter(s => !s.ok).map(s => s.service),
    details: checkResults.services
  });

  // Phase D-2 : envoyer un vrai email avec Resend
  // const { Resend } = require('resend');
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'no-reply@profil-cognitif.com',
  //   to: process.env.SUPERVISOR_EMAIL,
  //   subject: '🚨 Profil-Cognitif — Services externes KO',
  //   html: ...
  // });

  _lastAlertSent = now;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  checkAirtable,
  checkClaude,
  checkResend,
  checkAllServices,
  alertSuperviseurSiBesoin
};
