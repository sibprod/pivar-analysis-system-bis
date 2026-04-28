// services/infrastructure/agentBase.js
// Service de base mutualisé pour les agents Profil-Cognitif v10.0
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (Règle 4 : modification très critique)
//
// Ce service factorise tout ce qui est commun aux agents :
//   - Chargement du prompt système depuis le disque (avec cache mémoire)
//   - Préparation du payload utilisateur (JSON sérialisé)
//   - Injection du lexique (pour les agents qui en ont besoin)
//   - Appel Claude via claudeService
//   - Parsing JSON tolérant (4 niveaux de fallback)
//   - Logging structuré
//
// Structure des prompts dans new-prompts/ (Décision n°27) :
//   new-prompts/
//     ├── etape1/
//     │   ├── etape1_t1.txt
//     │   ├── verificateur1_t1.txt
//     │   ├── etape1_t2.txt
//     │   ├── etape1_t3.txt
//     │   └── etape1_t4/
//     │       ├── AGENT_1_ARCHITECTURE.md
//     │       ├── AGENT_2_CIRCUITS.md
//     │       └── ...
//     └── partages/
//         ├── PROMPT_BLOCS_LEXIQUE.md
//         └── PROMPT_CERTIFICATEUR.md
//
// PHASE D (2026-04-28) — v10 :
//   - Déplacé dans services/infrastructure/ (Décision n°27)
//   - PROMPTS_ROOT corrigé : 2 niveaux remontants depuis infrastructure/ (CRITIQUE)
//   - Logger require chemin mis à jour (../../utils/logger)

'use strict';

const fs              = require('fs');
const path            = require('path');
const claudeService   = require('./claudeService');
const airtableService = require('./airtableService');
const logger          = require('../../utils/logger');

// ─── Dossier racine des prompts ───────────────────────────────────────────────
// ⚠️ CRITIQUE v10 : depuis services/infrastructure/, on remonte 2 niveaux pour atteindre la racine
const PROMPTS_ROOT = path.join(__dirname, '..', '..', 'new-prompts');

// ─── Cache des prompts en mémoire ─────────────────────────────────────────────
// Les prompts sont chargés une seule fois au démarrage et réutilisés
// (économise les I/O disque et le hash de cache pour le prompt caching Claude)
const _promptCache = {};

/**
 * Charge un prompt depuis le disque (avec cache mémoire)
 * @param {string} relativePath - Chemin relatif depuis new-prompts/
 *                                Exemples :
 *                                  - 'etape1/etape1_t1.txt'
 *                                  - 'etape1/verificateur1_t1.txt'
 *                                  - 'etape1/etape1_t4/AGENT_1_ARCHITECTURE.md'
 *                                  - 'partages/PROMPT_CERTIFICATEUR.md'
 * @returns {string} Contenu du prompt
 */
function loadPrompt(relativePath) {
  if (_promptCache[relativePath]) {
    return _promptCache[relativePath];
  }

  const promptPath = path.join(PROMPTS_ROOT, relativePath);

  try {
    const content = fs.readFileSync(promptPath, 'utf-8');
    _promptCache[relativePath] = content;
    logger.debug('Prompt loaded', { relativePath, length: content.length });
    return content;
  } catch (error) {
    logger.error('Failed to load prompt', { relativePath, error: error.message });
    throw new Error(`Prompt file not found: new-prompts/${relativePath}`);
  }
}

/**
 * Vérifie si un fichier prompt existe (pour la détection auto des vérificateurs — Décision n°32)
 * @param {string} relativePath - Chemin relatif depuis new-prompts/
 * @returns {boolean}
 */
function promptExists(relativePath) {
  const promptPath = path.join(PROMPTS_ROOT, relativePath);
  return fs.existsSync(promptPath);
}

// ─── Cache du lexique (chargé une fois par exécution de pipeline) ─────────────
let _lexiqueCache = null;

/**
 * Récupère et formate le lexique depuis Airtable
 * @param {boolean} forceReload - Force le rechargement depuis Airtable
 * @returns {Promise<{lexique: Array, lexique_formate: string}>}
 */
async function loadLexique(forceReload = false) {
  if (_lexiqueCache && !forceReload) {
    return _lexiqueCache;
  }

  logger.debug('Loading REFERENTIEL_LEXIQUE from Airtable');
  const lexique = await airtableService.getReferentielLexique();
  const lexique_formate = airtableService.formaterLexiquePourPrompt(lexique);

  _lexiqueCache = { lexique, lexique_formate };
  return _lexiqueCache;
}

/**
 * Réinitialise le cache du lexique (à appeler après chaque candidat
 * pour avoir la version la plus à jour si le lexique a été modifié)
 */
function resetLexiqueCache() {
  _lexiqueCache = null;
}

// ═══════════════════════════════════════════════════════════════════════════
// APPEL D'UN AGENT — Méthode mutualisée
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Appelle un agent Claude avec gestion complète :
 *   - Charge le prompt système
 *   - Sérialise le payload en JSON
 *   - Optionnellement injecte le lexique
 *   - Appelle Claude
 *   - Parse la sortie JSON
 *   - Log les métriques (tokens, coût)
 *
 * @param {Object} params
 * @param {string} params.serviceName       - Nom du service (clé MAX_TOKENS, ex: 'agent_t1')
 * @param {string} params.promptPath        - Chemin relatif depuis new-prompts/
 *                                            (ex: 'etape1/etape1_t1.txt' ou 'etape1/etape1_t4/AGENT_1_ARCHITECTURE.md')
 * @param {Object} params.payload           - Données spécifiques à l'agent (sera sérialisé en JSON)
 * @param {boolean} [params.injectLexique]  - Si true, ajoute lexique_reference au payload
 * @param {string} [params.candidatId]      - Pour logging
 * @returns {Promise<{result: Object, usage: Object, cost: number, raw: string}>}
 */
async function callAgent({
  serviceName,
  promptPath,
  payload,
  injectLexique = false,
  candidatId = null
}) {
  const startTime = Date.now();

  try {
    // 1. Charger le prompt
    const systemPrompt = loadPrompt(promptPath);

    // 2. Préparer le payload
    let finalPayload = payload;
    if (injectLexique) {
      const { lexique_formate } = await loadLexique();
      finalPayload = { ...payload, lexique_reference: lexique_formate };
    }

    // 3. Sérialiser le payload en JSON pour le user message
    const userMessage = JSON.stringify(finalPayload, null, 2);

    logger.info('Calling agent', {
      serviceName,
      candidatId,
      payloadSize: userMessage.length,
      promptSize:  systemPrompt.length,
      injectLexique
    });

    // 4. Appel Claude via claudeService
    const response = await claudeService.callClaude({
      systemPrompt,
      userPrompt: userMessage,
      service:    serviceName
    });

    // 5. Parser le JSON de sortie
    const result = parseAgentOutput(response.content);

    const elapsedMs = Date.now() - startTime;

    logger.info('Agent completed', {
      serviceName,
      candidatId,
      elapsedMs,
      outputTokens: response.usage.output_tokens,
      cost_usd:     response.cost.toFixed(4),
      hasThinking:  !!response.thinking
    });

    return {
      result,
      usage:    response.usage,
      cost:     response.cost,
      raw:      response.content,
      thinking: response.thinking || null,
      elapsedMs
    };

  } catch (error) {
    const elapsedMs = Date.now() - startTime;
    logger.error('Agent call failed', {
      serviceName,
      candidatId,
      elapsedMs,
      error: error.message
    });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PARSING JSON DE SORTIE — Tolérant aux formats variés (4 niveaux)
// ═══════════════════════════════════════════════════════════════════════════

function parseAgentOutput(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('Empty or invalid content');
  }

  // Tentative 1 : parsing direct via claudeService.parseClaudeJSON
  try {
    return claudeService.parseClaudeJSON(content);
  } catch (e1) {
    // Tentative 2 : extraire le JSON d'un bloc ```json ... ``` ou ``` ... ```
    try {
      const fenceRegex = /```(?:json)?\s*\n?([\s\S]*?)\n?```/;
      const match = content.match(fenceRegex);
      if (match && match[1]) {
        return JSON.parse(match[1].trim());
      }
      throw new Error('No fenced JSON block found');
    } catch (e2) {
      // Tentative 3 : extraction structurelle
      try {
        return extractFirstJsonStructure(content);
      } catch (e3) {
        // Tentative 4 : récupération array tronqué
        try {
          return recoverTruncatedJsonArray(content);
        } catch (e4) {
          logger.error('Failed to parse agent JSON output', {
            contentPreview: content.substring(0, 500),
            contentLength:  content.length,
            errors: [e1.message, e2.message, e3.message, e4.message]
          });
          throw new Error(`Cannot parse agent JSON output: ${e1.message}`);
        }
      }
    }
  }
}

function extractFirstJsonStructure(content) {
  let startIdx = -1;
  let openChar = '';
  let closeChar = '';

  for (let i = 0; i < content.length; i++) {
    const c = content[i];
    if (c === '[' || c === '{') {
      startIdx = i;
      openChar = c;
      closeChar = (c === '[') ? ']' : '}';
      break;
    }
  }

  if (startIdx === -1) {
    throw new Error('No JSON structure ([ or {) found in content');
  }

  let depth = 0;
  let inString = false;
  let escapeNext = false;

  for (let i = startIdx; i < content.length; i++) {
    const c = content[i];

    if (escapeNext) { escapeNext = false; continue; }
    if (c === '\\' && inString) { escapeNext = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;

    if (c === openChar)  depth++;
    if (c === closeChar) {
      depth--;
      if (depth === 0) {
        const extracted = content.substring(startIdx, i + 1);
        return JSON.parse(extracted);
      }
    }
  }

  throw new Error(`Unbalanced ${openChar}${closeChar} in JSON structure`);
}

function recoverTruncatedJsonArray(content) {
  const startIdx = content.indexOf('[');
  if (startIdx === -1) {
    throw new Error('No array start [ found for recovery');
  }

  const recovered = [];
  let i = startIdx + 1;
  let inString = false;
  let escapeNext = false;
  let depth = 0;
  let objectStart = -1;

  while (i < content.length) {
    const c = content[i];

    if (escapeNext) { escapeNext = false; i++; continue; }
    if (c === '\\' && inString) { escapeNext = true; i++; continue; }
    if (c === '"') { inString = !inString; i++; continue; }
    if (inString) { i++; continue; }

    if (c === '{') {
      if (depth === 0) objectStart = i;
      depth++;
    } else if (c === '}') {
      depth--;
      if (depth === 0 && objectStart !== -1) {
        const objStr = content.substring(objectStart, i + 1);
        try {
          recovered.push(JSON.parse(objStr));
        } catch (parseErr) {
          logger.warn('Skipping malformed object during recovery', {
            preview: objStr.substring(0, 100)
          });
        }
        objectStart = -1;
      }
    } else if (c === ']' && depth === 0) {
      break;
    }
    i++;
  }

  if (recovered.length === 0) {
    throw new Error('Recovery yielded no objects');
  }

  logger.warn('Recovered partial JSON from truncated output', {
    objectsRecovered: recovered.length
  });

  return recovered;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  callAgent,
  loadPrompt,
  promptExists,         // ⭐ v10 — détection auto des vérificateurs (Décision n°32)
  loadLexique,
  resetLexiqueCache,
  parseAgentOutput,
  PROMPTS_ROOT
};
