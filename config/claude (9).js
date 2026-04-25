// config/claude.js
// Configuration Claude API — Profil-Cognitif v9.0
// Modèle Sonnet 4.6 (avril 2026), prompt caching natif, extended thinking

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
    agent_t3:                32000,  // T3 v4 : analyse pilier × circuit (75 lignes/candidat)

    // ── Agents T4 (production du bilan ETAPE1_T4_BILAN) ───────────────────
    agent_t4_architecture:   24000,  // Agent 1 : architecture des piliers (entête, rôle)
    agent_t4_circuits:       64000,  // Agent 2 : circuits laboratoire/candidat (le plus volumineux)
    agent_t4_modes:          32000,  // Agent 3 : modes retenus par pilier
    agent_t4_synthese:       32000,  // Agent 4 : synthèse cœur (filtre, boucle, finalité, signature)
    agent_t4_couts:          20000,  // Agent 5 : coûts cognitifs et conclusion
    agent_t4_transverses:    16000,  // Agent 6 : header, navigation, footer, schéma, lexique

    // ── Certificateur (contrôle qualité lexique post-production) ──────────
    certificateur_lexique:   16000,

    // ── Default ───────────────────────────────────────────────────────────
    default:                  8000
  },

  // ─── Extended thinking (par agent) ─────────────────────────────────────────
  // Indique pour chaque agent s'il faut activer le thinking étendu
  // et le budget de tokens internes alloué
  THINKING: {
    agent_t1:                { enabled: false }, // T1 : pas de thinking requis (analyse mécanique)
    agent_t2:                { enabled: false }, // T2 : pas de thinking requis (redistribution)
    agent_t3:                { enabled: true,  budget_tokens: 16000 }, // T3 : nuances + clusters
    agent_t4_architecture:   { enabled: true,  budget_tokens: 16000 },
    agent_t4_circuits:       { enabled: true,  budget_tokens: 16000 },
    agent_t4_modes:          { enabled: true,  budget_tokens: 16000 },
    agent_t4_synthese:       { enabled: true,  budget_tokens: 16000 }, // raisonnement filtre/boucle
    agent_t4_couts:          { enabled: true,  budget_tokens: 16000 },
    agent_t4_transverses:    { enabled: false }, // assemblage technique sans raisonnement
    certificateur_lexique:   { enabled: true,  budget_tokens: 8000 }
  },

  // ─── Temperature ──────────────────────────────────────────────────────────
  TEMPERATURE: 0,  // Analyse normée — déterminisme maximal

  // ─── Timeouts ─────────────────────────────────────────────────────────────
  // 180s par défaut (augmenté depuis 90s en v9 pour les agents avec thinking
  // étendu, notamment Circuits qui peut générer 64000 tokens output)
  TIMEOUT_MS: parseInt(process.env.CLAUDE_TIMEOUT) || 180000,

  // ─── Retry ────────────────────────────────────────────────────────────────
  MAX_RETRIES:    parseInt(process.env.MAX_RETRIES) || 3,
  RETRY_DELAY_MS: 5000,

  // ─── Rate limiting ────────────────────────────────────────────────────────
  QUESTION_DELAY_MS:  parseInt(process.env.QUESTION_DELAY) || 2000,   // 2s entre questions
  CANDIDATE_DELAY_MS: parseInt(process.env.CANDIDATE_DELAY) || 30000, // 30s entre candidats

  // ─── Pricing (Sonnet 4.6 — avril 2026) ────────────────────────────────────
  PRICING: {
    input_per_million:        3.0,   // $3 / 1M tokens input
    cached_input_per_million: 0.3,   // $0.30 / 1M tokens input cached (90% économie)
    output_per_million:       15.0   // $15 / 1M tokens output
  },

  // ─── Budget monitoring ────────────────────────────────────────────────────
  BUDGET_ALERT_THRESHOLD: parseFloat(process.env.BUDGET_ALERT_THRESHOLD) || 0.8,  // 80%
  MAX_MONTHLY_BUDGET:     parseFloat(process.env.MAX_MONTHLY_BUDGET) || 100      // $100
};
