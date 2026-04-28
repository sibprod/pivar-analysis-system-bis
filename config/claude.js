// config/claude.js
// Configuration Claude API — Profil-Cognitif v10.0
// Modèle Sonnet 4.6 (avril 2026), prompt caching natif, extended thinking adaptive
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Historique technique préservé (mémoire institutionnelle) :
//   - LOT 17 (2026-04-26) : doctrine de prompting appliquée (thinking adaptive, vérificateur indépendant)
//   - LOT 18 (2026-04-26) : fix bug "no text content found" (push systématique blocks vides)
//   - LOT 19 (2026-04-26 SOIR) : MAX_TOKENS recalibrés à 64000 pour tous agents avec thinking ON
//
// PHASE D (2026-04-28) — v10 :
//   - Renommage doctrinal `agent_t1_certificateur` → `agent_t1_verificateur` (Décision n°10)
//   - Le "certificateur lexique" final reste appelé `certificateur_lexique` (objet distinct)

'use strict';

module.exports = {
  // ─── API ────────────────────────────────────────────────────────────────────
  API_KEY:     process.env.CLAUDE_API_KEY,
  MODEL:       process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
  API_URL:     'https://api.anthropic.com/v1/messages',
  API_VERSION: '2023-06-01',

  // ─── Prompt caching (natif en 2026, plus de header beta) ────────────────────
  PROMPT_CACHING_ENABLED: true,

  // ─── Max tokens output par service (LOT 19 — calibrage doctrinal) ──────────
  //
  // ⭐ IMPORTANT : avec thinking adaptive sur Sonnet 4.6, le max_tokens
  // est PARTAGÉ entre le thinking ET le texte de réponse (source : doc Anthropic).
  // Si thinking consomme tout le quota, le texte est tronqué brutalement.
  //
  // Règle empirique observée :
  //   - 5 questions doctrinales avec raisonnement   → ~12k thinking + ~12k texte = 24k
  //   - 10 questions doctrinales avec raisonnement  → ~25k thinking + ~20k texte = 45k
  //
  // → Tous les agents avec thinking ON sont à 64000 (max Sonnet 4.6 sync API).
  // → Coût réel : on paye uniquement ce qui est consommé. Aucun surcoût gratuit.
  MAX_TOKENS: {
    // ── Agents amont Étape 1 ──────────────────────────────────────────────
    agent_t1:                64000,  // 5 appels par scénario, thinking ON
    agent_t1_verificateur:   64000,  // ⭐ v10 : renommé depuis agent_t1_certificateur (Décision n°10)
    agent_t2:                16000,  // pas de thinking (redistribution mécanique)
    agent_t3:                64000,  // 75 lignes pilier × circuit, thinking ON

    // ── Agents T4 (production du bilan) ───────────────────────────────────
    agent_t4_architecture:   64000,
    agent_t4_circuits:       64000,
    agent_t4_modes:          64000,
    agent_t4_synthese:       64000,
    agent_t4_couts:          64000,
    agent_t4_transverses:    16000,  // pas de thinking, OK

    // ── Certificateur lexique (objet distinct du vérificateur T1) ─────────
    certificateur_lexique:   64000,

    // ── Healthcheck (appel léger) ─────────────────────────────────────────
    healthcheck:                10,

    // ── Default ───────────────────────────────────────────────────────────
    default:                  8000
  },

  // ─── Extended thinking par agent (format Sonnet 4.6 adaptive) ──────────────
  //
  // Sur Sonnet 4.6 (avril 2026), le format recommandé est :
  //   thinking: { type: 'adaptive' }
  // → Claude évalue la complexité et décide combien réfléchir.
  //
  // ⚠ Quand thinking est activé, prévoir un MAX_TOKENS large car le thinking
  // partage le quota avec le texte de réponse.
  THINKING: {
    agent_t1:                true,   // DOCTRINE Pilier 1
    agent_t1_verificateur:   true,   // ⭐ v10 : vérification doctrinale stricte
    agent_t2:                false,  // pas de thinking requis (redistribution mécanique)
    agent_t3:                true,   // nuances + clusters
    agent_t4_architecture:   true,
    agent_t4_circuits:       true,
    agent_t4_modes:          true,
    agent_t4_synthese:       true,   // raisonnement filtre/boucle/finalité
    agent_t4_couts:          true,
    agent_t4_transverses:    false,  // assemblage technique
    certificateur_lexique:   true,   // détection violations lexicales fines
    healthcheck:             false   // appel rapide, pas de raisonnement
  },

  // ─── Temperature ────────────────────────────────────────────────────────────
  // ⚠ Quand thinking est activé, l'API ignore TEMPERATURE et accepte
  // uniquement temperature=1 (ou pas de temperature). Le service Claude
  // gère automatiquement ce cas en omettant le champ quand thinking=true.
  TEMPERATURE: 0,  // Analyse normée — déterminisme maximal (quand pas de thinking)

  // ─── Streaming requirements ─────────────────────────────────────────────────
  // L'API Anthropic exige le streaming quand max_tokens > 21333.
  // Notre service Claude active automatiquement le streaming au-dessus de ce seuil.
  STREAMING_THRESHOLD: 21333,

  // ─── Timeouts ───────────────────────────────────────────────────────────────
  // 1200s (20 min) pour les agents avec thinking étendu et batches longs
  TIMEOUT_MS: parseInt(process.env.CLAUDE_TIMEOUT) || 1200000,

  // ─── Retry ──────────────────────────────────────────────────────────────────
  MAX_RETRIES:    parseInt(process.env.MAX_RETRIES) || 3,
  RETRY_DELAY_MS: 5000,

  // ─── Rate limiting ──────────────────────────────────────────────────────────
  QUESTION_DELAY_MS:  parseInt(process.env.QUESTION_DELAY) || 2000,
  CANDIDATE_DELAY_MS: parseInt(process.env.CANDIDATE_DELAY) || 30000,

  // ─── Pricing (Sonnet 4.6 — avril 2026) ──────────────────────────────────────
  PRICING: {
    input_per_million:        3.0,   // $3 / 1M tokens input
    cached_input_per_million: 0.3,   // $0.30 / 1M tokens input cached (90% économie)
    output_per_million:       15.0   // $15 / 1M tokens output
  },

  // ─── Budget monitoring ──────────────────────────────────────────────────────
  BUDGET_ALERT_THRESHOLD: parseFloat(process.env.BUDGET_ALERT_THRESHOLD) || 0.8,
  MAX_MONTHLY_BUDGET:     parseFloat(process.env.MAX_MONTHLY_BUDGET) || 100
};
