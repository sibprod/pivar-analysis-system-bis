// services/infrastructure/claudeService.js
// Service Claude API — Profil-Cognitif v10.0
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// PHASE D (2026-04-28) — v10 :
//   - Déplacé dans services/infrastructure/ (Décision n°27)
//   - Chemins require mis à jour (../../config/claude, ../../utils/*)
//
// Historique technique préservé (LOT 18, LOT 21-ter)
//
// Wrapper sur l'API Anthropic Messages avec :
//   - Modèle Sonnet 4.6 par défaut
//   - Extended thinking adaptive (recommandé sur 4.6)
//   - Streaming automatique quand max_tokens > 21333
//   - Prompt caching natif (cache_control: ephemeral)
//   - Retry intelligent via errorClassifier
//   - Cost tracking détaillé
//   - Parsing JSON tolérant aux markdown code blocks
//
// LOT 18 (2026-04-26) — FIX bug "Invalid response: no text content found" :
//   - extractContent : diagnostic enrichi en cas d'échec (logs détaillés du contenu reçu)
//   - extractContent : fallback intelligent si seul thinking est présent
//   - processStreamEvent : push systématique des blocks text (même vides) pour traçabilité
//   - Logs de stop_reason et output_tokens pour identifier les troncatures

'use strict';

const axios           = require('axios');
const claudeConfig    = require('../../config/claude');
const logger          = require('../../utils/logger');
const errorClassifier = require('../../utils/errorClassifier');

// Helper: Attendre
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── APPEL PRINCIPAL ──────────────────────────────────────────────────────────

/**
 * Appeler Claude API avec retry automatique, prompt caching et thinking adaptive.
 *
 * @param {Object} params
 * @param {string} params.systemPrompt - Prompt système (sera mis en cache si activé)
 * @param {string} params.userPrompt   - Prompt utilisateur
 * @param {string} params.service      - Nom du service (clé dans MAX_TOKENS et THINKING)
 * @param {number} [params.maxTokens]  - Override max tokens output (sinon depuis config)
 * @param {boolean} [params.thinkingOverride] - Force thinking on/off (sinon depuis config)
 * @returns {Promise<Object>} { content, usage, cost, thinking }
 */
async function callClaude({
  systemPrompt,
  userPrompt,
  service = 'default',
  maxTokens = null,
  thinkingOverride = null
}) {
  const maxRetries = claudeConfig.MAX_RETRIES;
  let lastError    = null;

  // Résoudre les paramètres effectifs
  const effectiveMaxTokens = maxTokens
    || claudeConfig.MAX_TOKENS[service]
    || claudeConfig.MAX_TOKENS.default;

  const effectiveThinking = thinkingOverride !== null
    ? thinkingOverride
    : (claudeConfig.THINKING[service] === true);

  const requiresStreaming = effectiveMaxTokens > claudeConfig.STREAMING_THRESHOLD;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      logger.debug('Calling Claude API', {
        service,
        attempt,
        maxTokens: effectiveMaxTokens,
        thinking: effectiveThinking,
        streaming: requiresStreaming
      });

      // ─── Headers ───────────────────────────────────────────────────────
      const headers = {
        'x-api-key':         claudeConfig.API_KEY,
        'anthropic-version': claudeConfig.API_VERSION,
        'content-type':      'application/json'
      };

      // ─── Body ──────────────────────────────────────────────────────────
      const body = {
        model:      claudeConfig.MODEL,
        max_tokens: effectiveMaxTokens,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      };

      // System prompt avec cache_control si activé
      if (systemPrompt) {
        if (claudeConfig.PROMPT_CACHING_ENABLED) {
          body.system = [{
            type: 'text',
            text: systemPrompt,
            cache_control: { type: 'ephemeral' }
          }];
        } else {
          body.system = systemPrompt;
        }
      }

      // Extended thinking adaptive (Sonnet 4.6+)
      // ⚠ Quand thinking est activé :
      //   - L'API n'accepte PAS de temperature ≠ 1 → on omet temperature
      //   - Streaming requis si max_tokens > 21333
      if (effectiveThinking) {
        body.thinking = { type: 'adaptive' };
        // Pas de temperature avec thinking
      } else {
        body.temperature = claudeConfig.TEMPERATURE;
      }

      // Streaming requis si max_tokens > 21333
      if (requiresStreaming) {
        body.stream = true;
      }

      // ─── Appel API ─────────────────────────────────────────────────────
      let response;
      if (requiresStreaming) {
        response = await callClaudeStreaming(body, headers);
      } else {
        response = await callClaudeNonStreaming(body, headers);
      }

      // ─── Extraire résultat (avec diagnostic enrichi LOT 18) ────────────
      const { content, thinking } = extractContent(response, { service, attempt });
      const usage = response.usage;
      const cost  = calculateCost(usage);

      logger.info('Claude API success', {
        service,
        attempt,
        input_tokens:                 usage.input_tokens,
        cache_creation_input_tokens:  usage.cache_creation_input_tokens || 0,
        cache_read_input_tokens:      usage.cache_read_input_tokens || 0,
        output_tokens:                usage.output_tokens,
        thinking_used:                !!thinking,
        thinking_chars:               thinking ? thinking.length : 0,
        text_chars:                   content ? content.length : 0,
        stop_reason:                  response.stop_reason || 'unknown',
        cost_usd:                     cost.toFixed(4)
      });

      return { content, usage, cost, thinking };

    } catch (error) {
      lastError = error;

      // Classifier l'erreur
      const classification = errorClassifier.classifyError(error);

      // ⭐ LOT 21-ter — Logger PROPREMENT le body d'erreur Anthropic.
      // Bug précédent : JSON.stringify(error.response.data) plantait avec
      // "Converting circular structure" car en mode streaming, response.data
      // est un stream (TLSSocket). On décode proprement selon le type.
      if (error.response?.data) {
        const errorData = error.response.data;
        let errorBody = '';

        try {
          if (Buffer.isBuffer(errorData)) {
            // Body bufferisé brut — peut être gzip
            const isGzip = errorData[0] === 0x1f && errorData[1] === 0x8b;
            if (isGzip) {
              const zlib = require('zlib');
              errorBody = zlib.gunzipSync(errorData).toString('utf-8');
            } else {
              errorBody = errorData.toString('utf-8');
            }
          } else if (typeof errorData === 'string') {
            errorBody = errorData;
          } else if (errorData && typeof errorData === 'object' && !errorData.pipe) {
            // Objet JSON simple (pas un stream)
            errorBody = JSON.stringify(errorData);
          } else {
            // Stream ou autre objet non-sérialisable
            errorBody = '[stream — body non récupérable côté client]';
          }
        } catch (logErr) {
          errorBody = `[décodage impossible : ${logErr.message}]`;
        }

        logger.error('Claude API error body', {
          service,
          status:    error.response.status,
          errorBody: errorBody.substring(0, 1500)
        });
      }

      logger.warn('Claude API error', {
        service,
        attempt,
        errorType:    classification.errorType,
        isTemporary:  classification.isTemporary,
        shouldRetry:  classification.shouldRetry,
        reason:       classification.reason
      });

      // Erreur permanente → abandon immédiat
      if (!classification.shouldRetry) {
        logger.error('Permanent error - aborting', {
          service,
          errorType: classification.errorType,
          action:    classification.action
        });
        throw error;
      }

      // Dernière tentative épuisée
      if (attempt >= maxRetries) {
        logger.error('Max retries reached', {
          service,
          attempts:  maxRetries,
          errorType: classification.errorType
        });
        throw error;
      }

      // Backoff
      const backoffDelay = errorClassifier.calculateBackoffDelay(attempt);
      logger.info('Retrying after backoff', {
        service,
        attempt:        attempt + 1,
        backoffSeconds: (backoffDelay / 1000).toFixed(1)
      });
      await sleep(backoffDelay);
    }
  }

  throw lastError;
}

// ─── APPEL NON-STREAMING (max_tokens ≤ 21333) ─────────────────────────────────

async function callClaudeNonStreaming(body, headers) {
  const axiosResponse = await axios.post(
    claudeConfig.API_URL,
    body,
    {
      headers,
      timeout: claudeConfig.TIMEOUT_MS,
      signal:  AbortSignal.timeout(claudeConfig.TIMEOUT_MS)
    }
  );
  return axiosResponse.data;
}

// ─── APPEL STREAMING (max_tokens > 21333) ─────────────────────────────────────

async function callClaudeStreaming(body, headers) {
  // ⭐ LOT 21-ter — En mode streaming, si Anthropic renvoie une erreur HTTP
  // (4xx, 5xx) AVANT d'établir le stream, le body d'erreur est court et
  // bufferisable. Si on laisse responseType:'stream', on ne peut PAS lire
  // le body d'erreur (il vient comme un objet TLSSocket non-sérialisable).
  // Solution : utiliser validateStatus pour intercepter, et essayer de buffer
  // l'erreur en arraybuffer si elle arrive.
  let axiosResponse;
  try {
    axiosResponse = await axios.post(
      claudeConfig.API_URL,
      body,
      {
        headers:      { ...headers, 'accept': 'text/event-stream' },
        timeout:      claudeConfig.TIMEOUT_MS,
        signal:       AbortSignal.timeout(claudeConfig.TIMEOUT_MS),
        responseType: 'stream'
      }
    );
  } catch (streamErr) {
    // Si l'erreur est une réponse HTTP (4xx/5xx), le response.data est probablement
    // un stream non-consommé. On essaie de le lire en buffer pour récupérer le
    // message d'erreur Anthropic en clair.
    if (streamErr.response?.data && typeof streamErr.response.data.on === 'function') {
      try {
        const chunks = [];
        for await (const chunk of streamErr.response.data) {
          chunks.push(chunk);
        }
        const buffer = Buffer.concat(chunks);
        // Décoder gzip si applicable
        const isGzip = buffer[0] === 0x1f && buffer[1] === 0x8b;
        const text = isGzip
          ? require('zlib').gunzipSync(buffer).toString('utf-8')
          : buffer.toString('utf-8');
        // Remplacer le stream par le texte décodé pour que le logging soit propre
        streamErr.response.data = text;
      } catch (readErr) {
        streamErr.response.data = `[lecture stream impossible : ${readErr.message}]`;
      }
    }
    throw streamErr;
  }

  // Reconstitution de la réponse depuis les SSE events
  return new Promise((resolve, reject) => {
    let buffer = '';

    // Accumulateurs
    const finalMessage = {
      id:           null,
      type:         'message',
      role:         'assistant',
      model:        null,
      content:      [],   // tableau de blocks (text, thinking)
      stop_reason:  null,
      stop_sequence: null,
      usage: {
        input_tokens:                0,
        output_tokens:               0,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens:     0
      }
    };

    // État courant des blocks en cours de construction
    const currentBlocks = {}; // index → { type, text/thinking }

    axiosResponse.data.on('data', (chunk) => {
      buffer += chunk.toString();

      let lineEnd;
      while ((lineEnd = buffer.indexOf('\n')) !== -1) {
        const line = buffer.slice(0, lineEnd).trim();
        buffer = buffer.slice(lineEnd + 1);

        if (!line.startsWith('data:')) continue;

        const data = line.slice(5).trim();
        if (!data || data === '[DONE]') continue;

        try {
          const event = JSON.parse(data);
          processStreamEvent(event, finalMessage, currentBlocks);
        } catch (e) {
          // Ignore les lignes mal formées
        }
      }
    });

    axiosResponse.data.on('end', () => {
      // ⭐ LOT 18 — Sauvegarder tous les blocks en cours qui n'ont pas reçu content_block_stop
      // (cas où le stream se termine avant que tous les stop events soient envoyés)
      for (const idx of Object.keys(currentBlocks)) {
        const block = currentBlocks[idx];
        if (block.type === 'thinking' && block.thinking) {
          finalMessage.content.push({ type: 'thinking', thinking: block.thinking });
        } else if (block.type === 'text') {
          // ⭐ LOT 18 — push même si vide pour ne pas perdre de trace
          finalMessage.content.push({ type: 'text', text: block.text || '' });
        }
        delete currentBlocks[idx];
      }
      resolve(finalMessage);
    });

    axiosResponse.data.on('error', (err) => {
      reject(err);
    });
  });
}

/**
 * Traite un événement SSE individuel et met à jour l'accumulateur de message
 */
function processStreamEvent(event, finalMessage, currentBlocks) {
  switch (event.type) {
    case 'message_start':
      finalMessage.id    = event.message?.id;
      finalMessage.model = event.message?.model;
      if (event.message?.usage) {
        Object.assign(finalMessage.usage, event.message.usage);
      }
      break;

    case 'content_block_start':
      currentBlocks[event.index] = {
        type:      event.content_block?.type || 'text',
        text:      '',
        thinking:  ''
      };
      break;

    case 'content_block_delta': {
      const block = currentBlocks[event.index];
      if (!block) break;

      const delta = event.delta || {};
      if (delta.type === 'text_delta')     block.text     += delta.text || '';
      if (delta.type === 'thinking_delta') block.thinking += delta.thinking || '';
      break;
    }

    case 'content_block_stop': {
      const block = currentBlocks[event.index];
      if (!block) break;

      // ⭐ LOT 18 — Push systématique pour traçabilité, même blocks vides
      if (block.type === 'thinking' && block.thinking) {
        finalMessage.content.push({ type: 'thinking', thinking: block.thinking });
      } else if (block.type === 'text') {
        // Avant : "else if (block.text)" → ne pushait rien si text vide → bug !
        // Maintenant : on push toujours, même si text est vide
        finalMessage.content.push({ type: 'text', text: block.text || '' });
      }
      delete currentBlocks[event.index];
      break;
    }

    case 'message_delta':
      if (event.delta?.stop_reason)   finalMessage.stop_reason   = event.delta.stop_reason;
      if (event.delta?.stop_sequence) finalMessage.stop_sequence = event.delta.stop_sequence;
      if (event.usage) {
        Object.assign(finalMessage.usage, event.usage);
      }
      break;

    case 'message_stop':
      // Fin du message — rien à faire de plus, on attend 'end' du stream
      break;

    case 'error':
      // ⭐ LOT 18 — Réintégré (avait été supprimé par erreur)
      throw new Error(`Stream error: ${JSON.stringify(event.error)}`);
  }
}

// ─── EXTRACTION CONTENU ───────────────────────────────────────────────────────

/**
 * Extrait le texte final et le thinking depuis la réponse de l'API
 *
 * ⭐ LOT 18 — Diagnostic enrichi quand pas de texte trouvé :
 *   - Logs détaillés des blocks reçus, du stop_reason, des usages
 *   - Erreur explicite avec cause probable (max_tokens dépassé par thinking, etc.)
 *
 * @param {Object} response - Réponse API Claude
 * @param {Object} [context] - { service, attempt } pour les logs
 */
function extractContent(response, context = {}) {
  if (!response.content || !Array.isArray(response.content)) {
    throw new Error('Invalid response: no content array');
  }

  let text     = '';
  let thinking = '';
  const blocksDiag = [];  // ⭐ LOT 18 — diagnostic des blocks reçus

  for (const block of response.content) {
    if (block.type === 'text' && block.text) {
      text += block.text;
      blocksDiag.push({ type: 'text', chars: block.text.length, preview: block.text.substring(0, 80) });
    } else if (block.type === 'text') {
      // ⭐ LOT 18 — Block text vide tracé pour diagnostic
      blocksDiag.push({ type: 'text', chars: 0, status: 'empty' });
    } else if (block.type === 'thinking' && block.thinking) {
      thinking += block.thinking;
      blocksDiag.push({ type: 'thinking', chars: block.thinking.length });
    } else if (block.type === 'thinking') {
      blocksDiag.push({ type: 'thinking', chars: 0, status: 'empty' });
    } else {
      blocksDiag.push({ type: block.type || 'unknown', chars: 0 });
    }
  }

  if (!text) {
    // ⭐ LOT 18 — Diagnostic complet avant de planter
    const usage = response.usage || {};
    const stopReason = response.stop_reason || 'unknown';

    logger.error('Claude response has no text content — DIAGNOSTIC', {
      service:                context.service || 'unknown',
      attempt:                context.attempt || 0,
      stop_reason:            stopReason,
      input_tokens:           usage.input_tokens || 0,
      output_tokens:          usage.output_tokens || 0,
      cache_read_tokens:      usage.cache_read_input_tokens || 0,
      cache_creation_tokens:  usage.cache_creation_input_tokens || 0,
      blocks_received:        response.content.length,
      blocks_diag:            blocksDiag,
      thinking_chars:         thinking.length,
      cause_probable:         diagnoseCause(stopReason, thinking.length, usage)
    });

    throw new Error(
      `Claude returned no text content (stop_reason: ${stopReason}, ` +
      `output_tokens: ${usage.output_tokens || 0}, thinking_chars: ${thinking.length}). ` +
      `Cause probable: ${diagnoseCause(stopReason, thinking.length, usage)}`
    );
  }

  return { content: text, thinking: thinking || null };
}

/**
 * ⭐ LOT 18 — Diagnostic de la cause probable quand pas de texte
 */
function diagnoseCause(stopReason, thinkingChars, usage) {
  const outputTokens = usage.output_tokens || 0;

  if (stopReason === 'max_tokens') {
    if (thinkingChars > 0 && outputTokens > 0) {
      return `max_tokens dépassé — le thinking (${thinkingChars} chars) a probablement absorbé tout le quota. ` +
             `Solution: augmenter max_tokens dans config/claude.js pour ce service.`;
    }
    return `max_tokens dépassé sans thinking visible. Augmenter max_tokens.`;
  }

  if (stopReason === 'refusal') {
    return `Claude a refusé de répondre (refusal). Vérifier le contenu du prompt.`;
  }

  if (stopReason === 'pause_turn') {
    return `Claude a fait pause (pause_turn). Probablement quota épuisé.`;
  }

  if (stopReason === 'unknown') {
    return `Stop reason inconnu — possiblement un problème de streaming (block text non finalisé).`;
  }

  return `Cause indéterminée — stop_reason: ${stopReason}.`;
}

// ─── COST TRACKING ────────────────────────────────────────────────────────────

/**
 * Calculer le coût d'un appel Claude
 * @param {Object} usage - Usage tokens depuis API
 * @returns {number} Coût en USD
 */
function calculateCost(usage) {
  const inputTokens         = usage.input_tokens || 0;
  const cacheCreationTokens = usage.cache_creation_input_tokens || 0;
  const cacheReadTokens     = usage.cache_read_input_tokens || 0;
  const outputTokens        = usage.output_tokens || 0;

  // Tokens input normaux (plein tarif)
  const normalInputCost = (inputTokens / 1000000) * claudeConfig.PRICING.input_per_million;

  // Tokens cache creation (plein tarif aussi - première fois)
  const cacheCreationCost = (cacheCreationTokens / 1000000) * claudeConfig.PRICING.input_per_million;

  // Tokens cache read (90% économie)
  const cacheReadCost = (cacheReadTokens / 1000000) * claudeConfig.PRICING.cached_input_per_million;

  // Tokens output
  const outputCost = (outputTokens / 1000000) * claudeConfig.PRICING.output_per_million;

  return normalInputCost + cacheCreationCost + cacheReadCost + outputCost;
}

/**
 * Calculer le coût total d'une liste d'usages (pour monitoring budget)
 */
function calculateTotalCost(usages) {
  return usages.reduce((total, usage) => total + calculateCost(usage), 0);
}

// ─── PARSING JSON ─────────────────────────────────────────────────────────────

/**
 * Parser une réponse JSON de Claude (gère markdown code blocks)
 * @param {string} content - Réponse Claude
 * @returns {Object} JSON parsé
 */
function parseClaudeJSON(content) {
  try {
    let cleaned = content.trim();

    // Retirer ```json et ```
    cleaned = cleaned.replace(/^```json\s*/i, '');
    cleaned = cleaned.replace(/^```\s*/, '');
    cleaned = cleaned.replace(/```\s*$/, '');

    return JSON.parse(cleaned);
  } catch (error) {
    logger.error('Failed to parse Claude JSON', {
      error: error.message,
      contentPreview: content.substring(0, 200)
    });
    throw new Error(`Invalid JSON from Claude: ${error.message}`);
  }
}

// ─── HEALTH CHECK ─────────────────────────────────────────────────────────────

/**
 * Vérifier la santé de l'API Claude (appel léger)
 */
async function healthCheck() {
  try {
    const response = await callClaude({
      systemPrompt: 'You are a helpful assistant.',
      userPrompt:   'Reply with just "OK"',
      service:      'healthcheck',
      maxTokens:    10,
      thinkingOverride: false
    });
    return response.content.includes('OK');
  } catch (error) {
    logger.error('Claude API health check failed', { error: error.message });
    return false;
  }
}

// ─── EXPORTS ──────────────────────────────────────────────────────────────────

module.exports = {
  callClaude,
  calculateCost,
  calculateTotalCost,
  parseClaudeJSON,
  healthCheck
};
