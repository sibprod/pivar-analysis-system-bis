// config/claude.js
// Configuration Claude API — Profil-Cognitif v9.1
// Modèle Sonnet 4.6 (avril 2026), prompt caching natif, extended thinking adaptive

'use strict';

module.exports = {
  // ─── API ──────────────────────────────────────────────────────────────────
  API_KEY:     process.env.CLAUDE_API_KEY,
  MODEL:       process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
  API_URL:     'https://api.anthropic.com/v1/messages',
  API_VERSION: '2023-06-01',

  // ─── Prompt caching (natif en 2026, plus de header beta) ──────────────────
  // En 2026, le prompt caching est natif sur l'API Messages.
  // On utilise simplement cache_control: { type: 'ephemeral' } sur les blocs
  // que l'on veut mettre en cache. Pas de header beta nécessaire.
  PROMPT_CACHING_ENABLED: true,

  // ─── Max tokens output par service (v9 — pipeline Étape 1) ────────────────
  // 9 agents au total : T1, T2, T3 (amont) + 6 agents T4 (Architecture,
  // Circuits, Modes, Synthèse, Coûts, Transverses) + Certificateur lexique
  MAX_TOKENS: {
    // ── Agents amont Étape 1 (production des tableaux T1, T2, T3) ─────────
    agent_t1:                24000,  // T1 : analyse brute des 25 réponses (3 appels/candidat)
    agent_t2:                16000,  // T2 : synthèse par question (3 appels/candidat)
    agent_t3:                48000,  // T3 v4 : 75 lignes × ~500 tokens = ~38k + marge. Le prompt T3 v4 recommande 48000.

    // ── Agents T4 (production du bilan ETAPE1_T4_BILAN) ───────────────────
    agent_t4_architecture:   24000,  // Agent 1 : architecture des piliers
    agent_t4_circuits:       64000,  // Agent 2 : circuits laboratoire/candidat (le plus volumineux)
    agent_t4_modes:          32000,  // Agent 3 : modes retenus par pilier
    agent_t4_synthese:       32000,  // Agent 4 : synthèse cœur (filtre, boucle, finalité)
    agent_t4_couts:          20000,  // Agent 5 : coûts cognitifs et conclusion
    agent_t4_transverses:    16000,  // Agent 6 : header, navigation, footer, schéma, lexique

    // ── Certificateur (contrôle qualité lexique post-production) ──────────
    certificateur_lexique:   16000,

    // ── Default ───────────────────────────────────────────────────────────
    default:                  8000
  },

  // ─── Extended thinking par agent (format Sonnet 4.6 adaptive) ─────────────
  //
  // Sur Sonnet 4.6 (avril 2026), le format recommandé est:
  //   thinking: { type: 'adaptive' }
  // → Claude évalue la complexité de la requête et décide automatiquement
  //   combien réfléchir. Pas besoin de spécifier un budget précis.
  //
  // Le format legacy { type: 'enabled', budget_tokens: N } fonctionne encore
  // mais est déprécié sur Sonnet 4.6 et sera retiré.
  //
  // Pour chaque agent on indique simplement s'il faut activer le thinking.
  // - false  : pas de bloc thinking dans la requête (analyse mécanique)
  // - true   : thinking adaptive activé
  THINKING: {
    agent_t1:                false, // T1 : pas de thinking requis (analyse mécanique)
    agent_t2:                false, // T2 : pas de thinking requis (redistribution)
    agent_t3:                true,  // T3 : nuances + clusters demandent du raisonnement
    agent_t4_architecture:   true,
    agent_t4_circuits:       true,
    agent_t4_modes:          true,
    agent_t4_synthese:       true,  // raisonnement filtre/boucle/finalité
    agent_t4_couts:          true,
    agent_t4_transverses:    false, // assemblage technique sans raisonnement
    certificateur_lexique:   true   // détection de violations lexicales fines
  },

  // ─── Temperature ──────────────────────────────────────────────────────────
  // ⚠ Quand thinking est activé, l'API ignore TEMPERATURE et accepte
  // uniquement temperature=1 (ou pas de temperature). Le service Claude
  // gère automatiquement ce cas en omettant le champ quand thinking=true.
  TEMPERATURE: 0,  // Analyse normée — déterminisme maximal (quand pas de thinking)

  // ─── Streaming requirements (v9) ──────────────────────────────────────────
  // L'API Anthropic exige le streaming quand max_tokens > 21333.
  // Notre service Claude active automatiquement le streaming au-dessus de ce seuil.
  STREAMING_THRESHOLD: 21333,

  // ─── Timeouts ─────────────────────────────────────────────────────────────
  // 180s par défaut (augmenté depuis 90s en v9 pour les agents avec thinking
  // étendu, notamment Circuits qui peut générer 64000 tokens output)
  TIMEOUT_MS: parseInt(process.env.CLAUDE_TIMEOUT) || 180000,

  // ─── Retry ────────────────────────────────────────────────────────────────
  MAX_RETRIES:    parseInt(process.env.MAX_RETRIES) || 3,
  RETRY_DELAY_MS: 5000,

  // ─── Rate limiting ────────────────────────────────────────────────────────
  QUESTION_DELAY_MS:  parseInt(process.env.QUESTION_DELAY) || 2000,
  CANDIDATE_DELAY_MS: parseInt(process.env.CANDIDATE_DELAY) || 30000,

  // ─── Pricing (Sonnet 4.6 — avril 2026) ────────────────────────────────────
  PRICING: {
    input_per_million:        3.0,   // $3 / 1M tokens input
    cached_input_per_million: 0.3,   // $0.30 / 1M tokens input cached (90% économie)
    output_per_million:       15.0   // $15 / 1M tokens output
  },

  // ─── Budget monitoring ────────────────────────────────────────────────────
  BUDGET_ALERT_THRESHOLD: parseFloat(process.env.BUDGET_ALERT_THRESHOLD) || 0.8,
  MAX_MONTHLY_BUDGET:     parseFloat(process.env.MAX_MONTHLY_BUDGET) || 100
};
