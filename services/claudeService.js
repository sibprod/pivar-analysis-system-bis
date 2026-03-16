// services/claudeService.js
// Service Claude API avec prompt caching et retry intelligent
// ✅ PHASE 1.6 - Code expert avec économie 90% tokens input

const axios = require('axios');
const claudeConfig = require('../config/claude');
const logger = require('../utils/logger');
const errorClassifier = require('../utils/errorClassifier');

// Helper: Attendre
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Appeler Claude API avec retry automatique et prompt caching
 * @param {Object} params
 * @param {string} params.systemPrompt - Prompt système (sera caché)
 * @param {string} params.userPrompt - Prompt utilisateur
 * @param {string} params.service - Nom du service (agent1, agent2, certificateur)
 * @param {number} params.maxTokens - Max tokens output (optionnel)
 * @returns {Object} { content, usage, cost }
 */
async function callClaude({
  systemPrompt,
  userPrompt,
  service = 'default',
  maxTokens = null
}) {
  const maxRetries = claudeConfig.MAX_RETRIES;
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug('Calling Claude API', { service, attempt });
      
      // Préparer headers
      const headers = {
        'x-api-key': claudeConfig.API_KEY,
        'anthropic-version': claudeConfig.API_VERSION,
        'content-type': 'application/json'
      };
      
      // Ajouter header prompt caching si activé
      if (claudeConfig.PROMPT_CACHING_ENABLED) {
        headers['anthropic-beta'] = claudeConfig.PROMPT_CACHING_HEADER;
      }
      
      // Préparer body
      const body = {
        model: claudeConfig.MODEL,
        max_tokens: maxTokens || claudeConfig.MAX_TOKENS[service] || claudeConfig.MAX_TOKENS.default,
        temperature: claudeConfig.TEMPERATURE,
        messages: [
          {
            role: 'user',
            content: userPrompt
          }
        ]
      };
      
      // Ajouter system prompt avec cache_control si prompt caching activé
      if (systemPrompt) {
        if (claudeConfig.PROMPT_CACHING_ENABLED) {
          body.system = [
            {
              type: 'text',
              text: systemPrompt,
              cache_control: { type: 'ephemeral' }
            }
          ];
        } else {
          body.system = systemPrompt;
        }
      }
      
      // Appel API
      const response = await axios.post(
        claudeConfig.API_URL,
        body,
        {
          headers,
          timeout: claudeConfig.TIMEOUT_MS
        }
      );
      
      // Extraire résultat
      const content = response.data.content[0].text;
      const usage = response.data.usage;
      
      // Calculer coût
      const cost = calculateCost(usage);
      
      logger.info('Claude API success', {
        service,
        attempt,
        input_tokens: usage.input_tokens,
        cache_creation_input_tokens: usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens: usage.cache_read_input_tokens || 0,
        output_tokens: usage.output_tokens,
        cost_usd: cost.toFixed(4)
      });
      
      return {
        content,
        usage,
        cost
      };
      
    } catch (error) {
      lastError = error;
      
      // Classifier l'erreur
      const classification = errorClassifier.classifyError(error);
      // Log détail erreur Claude - AJOUTER CES LIGNES
      if (error.response?.data) {
      logger.error('CLAUDE API ERROR BODY', {
      service,
      errorData: JSON.stringify(error.response.data)
      });
      }
      logger.warn('Claude API error', {
        service,
        attempt,
        errorType: classification.errorType,
        isTemporary: classification.isTemporary,
        shouldRetry: classification.shouldRetry,
        reason: classification.reason
      });
      
      // Si erreur permanente, abandonner immédiatement
      if (!classification.shouldRetry) {
        logger.error('Permanent error - aborting', {
          service,
          errorType: classification.errorType,
          action: classification.action
        });
        throw error;
      }
      
      // Si dernière tentative, abandonner
      if (attempt >= maxRetries) {
        logger.error('Max retries reached', {
          service,
          attempts: maxRetries,
          errorType: classification.errorType
        });
        throw error;
      }
      
      // Calculer délai backoff
      const backoffDelay = errorClassifier.calculateBackoffDelay(attempt);
      
      logger.info('Retrying after backoff', {
        service,
        attempt: attempt + 1,
        backoffSeconds: (backoffDelay / 1000).toFixed(1)
      });
      
      await sleep(backoffDelay);
    }
  }
  
  // Ne devrait jamais arriver ici
  throw lastError;
}

/**
 * Calculer le coût d'un appel Claude
 * @param {Object} usage - Usage tokens depuis API
 * @returns {number} Coût en USD
 */
function calculateCost(usage) {
  const inputTokens = usage.input_tokens || 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
  const cacheReadTokens = usage.cache_read_input_tokens || 0;
  const outputTokens = usage.output_tokens || 0;
  
  // Tokens input normaux (plein tarif)
  const normalInputCost = (inputTokens / 1000000) * claudeConfig.PRICING.input_per_million;
  
  // Tokens cache creation (plein tarif aussi - première fois)
  const cacheCreationCost = (cacheCreationTokens / 1000000) * claudeConfig.PRICING.input_per_million;
  
  // Tokens cache read (90% économie)
  const cacheReadCost = (cacheReadTokens / 1000000) * claudeConfig.PRICING.cached_input_per_million;
  
  // Tokens output
  const outputCost = (outputTokens / 1000000) * claudeConfig.PRICING.output_per_million;
  
  const totalCost = normalInputCost + cacheCreationCost + cacheReadCost + outputCost;
  
  return totalCost;
}

/**
 * Parser une réponse JSON de Claude (gère markdown code blocks)
 * @param {string} content - Réponse Claude
 * @returns {Object} JSON parsé
 */
function parseClaudeJSON(content) {
  try {
    // Nettoyer markdown code blocks si présents
    let cleaned = content.trim();
    
    // Retirer ```json et ```
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/, '');
    cleaned = cleaned.replace(/```\s*$/, '');
    
    // Parser
    const parsed = JSON.parse(cleaned);
    
    return parsed;
  } catch (error) {
    logger.error('Failed to parse Claude JSON', {
      error: error.message,
      contentPreview: content.substring(0, 200)
    });
    throw new Error(`Invalid JSON from Claude: ${error.message}`);
  }
}

/**
 * Vérifier la santé de l'API Claude
 * @returns {boolean} true si API accessible
 */
async function healthCheck() {
  try {
    const response = await callClaude({
      systemPrompt: 'You are a helpful assistant.',
      userPrompt: 'Reply with just "OK"',
      service: 'healthcheck',
      maxTokens: 10
    });
    
    return response.content.includes('OK');
  } catch (error) {
    logger.error('Claude API health check failed', { error: error.message });
    return false;
  }
}

/**
 * Calculer le coût total mensuel (pour monitoring budget)
 * @param {Array<Object>} usages - Liste des usages
 * @returns {number} Coût total USD
 */
function calculateTotalCost(usages) {
  return usages.reduce((total, usage) => {
    return total + calculateCost(usage);
  }, 0);
}

module.exports = {
  callClaude,
  calculateCost,
  parseClaudeJSON,
  healthCheck,
  calculateTotalCost
};
