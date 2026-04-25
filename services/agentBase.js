// services/agentBase.js
// Service de base mutualisé pour les agents Profil-Cognitif v9.0
//
// Ce service factorise tout ce qui est commun aux 9 agents :
//   - Chargement du prompt système depuis le disque (avec cache mémoire)
//   - Préparation du payload utilisateur (JSON sérialisé)
//   - Injection du lexique (pour les agents qui en ont besoin)
//   - Appel Claude via claudeService
//   - Parsing JSON tolérant
//   - Logging structuré
//
// Structure des prompts dans le repo :
//   new-prompts/
//     ├── etape1_t1.txt
//     ├── etape1_t2.txt
//     ├── etape1_t3.txt
//     ├── PROMPT_BLOCS_LEXIQUE.md       (à ajouter)
//     └── etape1_t4/
//         ├── AGENT_1_ARCHITECTURE.md
//         ├── AGENT_2_CIRCUITS.md
//         ├── AGENT_3_MODE.md            (sans S)
//         ├── AGENT_4_SYNTHESE_COEUR.md
//         ├── AGENT_5_COUTS_CLOTURE.md
//         └── AGENT_6_TRANSVERSES.md
//
// L'ancien dossier `prompts/` contient les prompts de l'ancien protocole
// et n'est PAS utilisé par le pipeline v9.

'use strict';

const fs              = require('fs');
const path            = require('path');
const claudeService   = require('./claudeService');
const airtableService = require('./airtableService');
const logger          = require('../utils/logger');

// ─── Dossier racine des prompts v9 ────────────────────────────────────────────
const PROMPTS_ROOT = path.join(__dirname, '..', 'new-prompts');

// ─── Cache des prompts en mémoire ──────────────────────────────────────────────
// Les prompts sont chargés une seule fois au démarrage et réutilisés
// (économise les I/O disque et le hash de cache pour le prompt caching Claude)
const _promptCache = {};

/**
 * Charge un prompt depuis le disque (avec cache mémoire)
 * @param {string} relativePath - Chemin relatif depuis new-prompts/
 *                                Exemples :
 *                                  - 'etape1_t1.txt'
 *                                  - 'etape1_t4/AGENT_1_ARCHITECTURE.md'
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

// ─── Cache du lexique (chargé une fois par exécution de pipeline) ──────────────
// Note : le lexique peut être modifié dans Airtable, donc on ne le cache qu'au
// niveau d'une exécution candidat. L'orchestrateur le passera explicitement.
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
 *                                            (ex: 'etape1_t1.txt' ou 'etape1_t4/AGENT_1_ARCHITECTURE.md')
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
// PARSING JSON DE SORTIE — Tolérant aux formats variés
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse la sortie d'un agent Claude.
 * Gère les cas :
 *   - JSON pur
 *   - JSON entouré de ```json ... ```
 *   - JSON avec texte avant/après (extrait depuis premier { jusqu'au dernier })
 *
 * @param {string} content - Contenu brut de la réponse Claude
 * @returns {Object} JSON parsé
 */
function parseAgentOutput(content) {
  // Tentative 1 : parsing direct via claudeService.parseClaudeJSON
  try {
    return claudeService.parseClaudeJSON(content);
  } catch (e1) {
    // Tentative 2 : extraction du premier { au dernier }
    try {
      const debut = content.indexOf('{');
      const fin   = content.lastIndexOf('}');
      if (debut === -1 || fin === -1 || fin <= debut) {
        throw new Error('No JSON object found in agent output');
      }
      const extracted = content.substring(debut, fin + 1);
      return JSON.parse(extracted);
    } catch (e2) {
      // Tentative 3 : extraction du premier [ au dernier ] (cas tableaux)
      try {
        const debut = content.indexOf('[');
        const fin   = content.lastIndexOf(']');
        if (debut === -1 || fin === -1 || fin <= debut) {
          throw new Error('No JSON array found in agent output');
        }
        const extracted = content.substring(debut, fin + 1);
        return JSON.parse(extracted);
      } catch (e3) {
        logger.error('Failed to parse agent JSON output', {
          contentPreview: content.substring(0, 500),
          errors: [e1.message, e2.message, e3.message]
        });
        throw new Error(`Cannot parse agent JSON output: ${e1.message}`);
      }
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  callAgent,
  loadPrompt,
  loadLexique,
  resetLexiqueCache,
  parseAgentOutput,
  // Constantes utiles
  PROMPTS_ROOT
};
