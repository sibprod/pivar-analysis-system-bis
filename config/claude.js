// config/claude.js
// Configuration Claude API — Profil-Cognitif v9.1 (LOT 19)
// Modèle Sonnet 4.6 (avril 2026), prompt caching natif, extended thinking adaptive
//
// LOT 17 (2026-04-26) — APPLICATION DE LA DOCTRINE DE PROMPTING :
//   - agent_t1 : thinking passé à TRUE (Pilier 1 doctrine)
//   - agent_t1_certificateur : NOUVEL agent (vérification post-T1, Pilier 6)
//
// LOT 18 (2026-04-26) — FIX bug "no text content found" :
//   - agent_t1 : MAX_TOKENS passé de 24000 à 32000
//   - claudeService.js : push systématique des blocks vides + diagnostic enrichi
//
// LOT 19 (2026-04-26 SOIR) — MAX_TOKENS RECALIBRÉS via diagnostic Lot 18 :
//   Observation : SOMMEIL (5 questions) consomme déjà 50k chars de thinking (~12500 tokens)
//   sur 32k max_tokens → texte tronqué. Pour ANIMAL (10 questions), prévoir le double.
//   → Tous les agents avec thinking ON passent à 64000 (max Sonnet 4.6 sync API).
//   → Aucun risque : on paye uniquement les tokens réellement consommés.

'use strict';

module.exports = {
  // ─── API ──────────────────────────────────────────────────────────────────
  API_KEY:     process.env.CLAUDE_API_KEY,
  MODEL:       process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
  API_URL:     'https://api.anthropic.com/v1/messages',
  API_VERSION: '2023-06-01',

  // ─── Prompt caching (natif en 2026, plus de header beta) ──────────────────
  PROMPT_CACHING_ENABLED: true,

  // ─── Max tokens output par service (v9.1 LOT 19 — calibrage doctrinal) ────
  //
  // ⭐ LOT 19 — IMPORTANT : avec thinking adaptive sur Sonnet 4.6, le max_tokens
  // est PARTAGÉ entre le thinking ET le texte de réponse (source : doc Anthropic).
  // Si thinking consomme tout le quota, le texte est tronqué brutalement.
  //
  // Règle empirique observée sur ce projet :
  //   - 5 questions doctrinales avec raisonnement   → ~12k thinking + ~12k texte = 24k
  //   - 10 questions doctrinales avec raisonnement  → ~25k thinking + ~20k texte = 45k
  //
  // → On met 64000 sur tous les agents avec thinking, pour sécuriser.
  // → Coût réel : on paye uniquement ce qui est consommé. Aucun surcoût gratuit.
  MAX_TOKENS: {
    // ── Agents amont Étape 1 ──────────────────────────────────────────────
    agent_t1:                64000,  // ⭐ LOT 19 : 32000 → 64000 (ANIMAL = 10 questions thinking)
    agent_t1_certificateur:  64000,  // ⭐ LOT 19 : 24000 → 64000 (vérification 25 lignes)
    agent_t2:                16000,  // T2 : pas de thinking, pas concerné
    agent_t3:                64000,  // ⭐ LOT 19 : 32000 → 64000 (75 lignes pilier × circuit)

    // ── Agents T4 (production du bilan) ──────────────────────────────────
    agent_t4_architecture:   64000,  // ⭐ LOT 19 : 24000 → 64000 (thinking ON)
    agent_t4_circuits:       64000,  // déjà à 64000 (le plus volumineux historiquement)
    agent_t4_modes:          64000,  // ⭐ LOT 19 : 32000 → 64000
    agent_t4_synthese:       64000,  // ⭐ LOT 19 : 32000 → 64000 (raisonnement filtre/boucle)
    agent_t4_couts:          64000,  // ⭐ LOT 19 : 20000 → 64000
    agent_t4_transverses:    16000,  // pas de thinking, OK

    // ── Certificateur lexique ────────────────────────────────────────────
    certificateur_lexique:   64000,  // ⭐ LOT 19 : 16000 → 64000 (thinking ON, contrôle qualité)

    // ── Default ───────────────────────────────────────────────────────────
    default:                  8000
  },

  // ─── Extended thinking par agent (format Sonnet 4.6 adaptive) ─────────────
  //
  // Sur Sonnet 4.6 (avril 2026), le format recommandé est:
  //   thinking: { type: 'adaptive' }
  // → Claude évalue la complexité et décide combien réfléchir.
  //
  // ⚠ Quand thinking est activé, prévoir un MAX_TOKENS large car le thinking
  // partage le quota avec le texte de réponse.
  THINKING: {
    agent_t1:                true,   // ⭐ LOT 17 : DOCTRINE Pilier 1
    agent_t1_certificateur:  true,   // ⭐ LOT 17 : vérification doctrinale stricte
    agent_t2:                false,  // T2 : pas de thinking requis (redistribution mécanique)
    agent_t3:                true,   // T3 : nuances + clusters
    agent_t4_architecture:   true,
    agent_t4_circuits:       true,
    agent_t4_modes:          true,
    agent_t4_synthese:       true,   // raisonnement filtre/boucle/finalité
    agent_t4_couts:          true,
    agent_t4_transverses:    false,  // assemblage technique
    certificateur_lexique:   true    // détection violations lexicales fines
  },

  // ─── Temperature ──────────────────────────────────────────────────────────
  // ⚠ Quand thinking est activé, l'API ignore TEMPERATURE et accepte
  // uniquement temperature=1 (ou pas de temperature). Le service Claude
  // gère automatiquement ce cas en omettant le champ quand thinking=true.
  TEMPERATURE: 0,  // Analyse normée — déterminisme maximal (quand pas de thinking)

  // ─── Streaming requirements ──────────────────────────────────────────────
  // L'API Anthropic exige le streaming quand max_tokens > 21333.
  // Notre service Claude active automatiquement le streaming au-dessus de ce seuil.
  STREAMING_THRESHOLD: 21333,

  // ─── Timeouts ─────────────────────────────────────────────────────────────
  // 1200s (20 min) pour les agents avec thinking étendu et batches longs
  TIMEOUT_MS: parseInt(process.env.CLAUDE_TIMEOUT) || 1200000,

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
