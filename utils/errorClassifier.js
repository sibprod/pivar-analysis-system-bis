// utils/errorClassifier.js
// Classification des erreurs Claude API et Airtable
// Détermine si une erreur est temporaire (retry) ou permanente (stop)
// Profil-Cognitif v9.0

'use strict';

const logger = require('./logger');

/**
 * Classifier une erreur pour déterminer si elle est temporaire (retry) ou permanente (stop)
 *
 * @param {Error} error - L'erreur à classifier
 * @returns {Object} { isTemporary: boolean, errorType: string, shouldRetry: boolean, reason: string, action: string }
 */
function classifyError(error) {
  const errorMessage = error.message || '';
  const errorStack   = error.stack || '';

  // Extraire le status HTTP si disponible
  let statusCode = null;

  if (error.response && error.response.status) {
    statusCode = error.response.status;
  }

  const statusMatch = errorMessage.match(/status code (\d+)/i);
  if (statusMatch) {
    statusCode = parseInt(statusMatch[1]);
  }

  // ERREURS PERMANENTES (4XX - Erreurs client)

  if (statusCode === 400) {
    return {
      isTemporary: false,
      errorType: 'invalid_request_error',
      shouldRetry: false,
      reason: 'Format ou contenu de requête invalide',
      action: 'Vérifier le code - Erreur de développement'
    };
  }

  if (statusCode === 401) {
    return {
      isTemporary: false,
      errorType: 'authentication_error',
      shouldRetry: false,
      reason: 'Clé API invalide ou expirée',
      action: 'URGENT - Vérifier la clé API'
    };
  }

  if (statusCode === 403) {
    return {
      isTemporary: false,
      errorType: 'permission_error',
      shouldRetry: false,
      reason: 'Clé API sans permission pour cette ressource',
      action: 'Vérifier les permissions de la clé API'
    };
  }

  if (statusCode === 404) {
    return {
      isTemporary: false,
      errorType: 'not_found_error',
      shouldRetry: false,
      reason: 'Ressource non trouvée',
      action: 'Vérifier l\'URL ou le modèle utilisé'
    };
  }

  if (statusCode === 413) {
    return {
      isTemporary: false,
      errorType: 'request_too_large',
      shouldRetry: false,
      reason: 'Requête trop volumineuse (>32MB)',
      action: 'Réduire la taille de la requête'
    };
  }

  // ERREURS TEMPORAIRES (429, 5XX)

  if (statusCode === 429) {
    return {
      isTemporary: true,
      errorType: 'rate_limit_error',
      shouldRetry: true,
      reason: 'Limite de taux atteinte',
      action: 'Attendre et réessayer avec backoff exponentiel'
    };
  }

  if (statusCode === 500) {
    return {
      isTemporary: true,
      errorType: 'api_error',
      shouldRetry: true,
      reason: 'Erreur interne Anthropic',
      action: 'Réessayer - Problème temporaire serveur'
    };
  }

  if (statusCode === 529) {
    return {
      isTemporary: true,
      errorType: 'overloaded_error',
      shouldRetry: true,
      reason: 'API temporairement surchargée',
      action: 'Réessayer - Forte charge sur API Anthropic'
    };
  }

  // ERREURS RÉSEAU (Temporaires)

  const networkErrors = [
    'ETIMEDOUT',
    'ECONNREFUSED',
    'ENOTFOUND',
    'ECONNRESET',
    'EHOSTUNREACH',
    'EAI_AGAIN',
    'socket hang up',
    'network timeout',
    'connect ETIMEDOUT'
  ];

  for (const networkError of networkErrors) {
    if (errorMessage.includes(networkError) || errorStack.includes(networkError)) {
      return {
        isTemporary: true,
        errorType: 'network_error',
        shouldRetry: true,
        reason: `Erreur réseau: ${networkError}`,
        action: 'Réessayer - Problème réseau temporaire'
      };
    }
  }

  // ERREURS FICHIERS (Permanentes)

  if (errorMessage.includes('ENOENT') || errorMessage.includes('no such file')) {
    return {
      isTemporary: false,
      errorType: 'file_not_found',
      shouldRetry: false,
      reason: 'Fichier manquant (prompt ou config)',
      action: 'Vérifier que tous les fichiers sont déployés'
    };
  }

  // ERREURS AIRTABLE (Selon le cas)

  if (errorMessage.includes('Airtable') || errorMessage.includes('AIRTABLE')) {
    if (errorMessage.includes('permission') || errorMessage.includes('Insufficient')) {
      return {
        isTemporary: false,
        errorType: 'airtable_permission_error',
        shouldRetry: false,
        reason: 'Permissions Airtable insuffisantes',
        action: 'Vérifier les permissions du token Airtable'
      };
    }

    if (errorMessage.includes('rate limit') || statusCode === 429) {
      return {
        isTemporary: true,
        errorType: 'airtable_rate_limit',
        shouldRetry: true,
        reason: 'Rate limit Airtable atteint',
        action: 'Réessayer après délai'
      };
    }

    return {
      isTemporary: true,
      errorType: 'airtable_error',
      shouldRetry: true,
      reason: 'Erreur Airtable temporaire',
      action: 'Réessayer'
    };
  }

  // ERREUR INCONNUE (Prudence: Temporaire par défaut)

  logger.warn('Unknown error type - Treating as temporary', {
    message: errorMessage,
    statusCode: statusCode,
    stack: errorStack.substring(0, 200)
  });

  return {
    isTemporary: true,
    errorType: 'unknown_error',
    shouldRetry: true,
    reason: 'Erreur inconnue - Traitement prudent',
    action: 'Réessayer par précaution'
  };
}

/**
 * Calculer le délai d'attente avant le prochain retry (backoff exponentiel)
 *
 * @param {number} attemptNumber - Numéro de la tentative (1-based)
 * @returns {number} Délai en millisecondes
 */
function calculateBackoffDelay(attemptNumber) {
  // Backoff exponentiel: 1min, 2min, 4min, 8min, 16min — Plafonné à 30 minutes
  const baseDelayMs = 60000;   // 1 minute
  const maxDelayMs  = 1800000; // 30 minutes

  const delay = Math.min(
    baseDelayMs * Math.pow(2, attemptNumber - 1),
    maxDelayMs
  );

  return delay;
}

/**
 * Déterminer si on doit abandonner après N tentatives
 *
 * @param {number} attemptNumber - Numéro de la tentative actuelle
 * @returns {boolean} true si on doit abandonner
 */
function shouldGiveUp(attemptNumber) {
  const MAX_ATTEMPTS = 10;
  return attemptNumber >= MAX_ATTEMPTS;
}

module.exports = {
  classifyError,
  calculateBackoffDelay,
  shouldGiveUp
};
