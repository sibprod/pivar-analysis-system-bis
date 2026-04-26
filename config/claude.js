// config/claude.js
// Configuration Claude API — Profil-Cognitif v9.1 (LOT 18)
// Modèle Sonnet 4.6 (avril 2026), prompt caching natif, extended thinking adaptive
//
// LOT 17 (2026-04-26) — APPLICATION DE LA DOCTRINE DE PROMPTING :
//   - agent_t1 : thinking passé à TRUE (Pilier 1 doctrine)
//   - agent_t1_certificateur : NOUVEL agent (vérification post-T1, Pilier 6)
//
// LOT 18 (2026-04-26) — FIX bug "no text content found" :
//   - agent_t1 : MAX_TOKENS passé de 24000 à 32000 (thinking adaptive consomme du quota)
//   - agent_t1_certificateur : MAX_TOKENS passé de 16000 à 24000 (idem)

'use strict';

module.exports = {
  // ─── API ──────────────────────────────────────────────────────────────────
  API_KEY:     process.env.CLAUDE_API_KEY,
  MODEL:       process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
  API_URL:     'https://api.anthropic.com/v1/messages',
  API_VERSION: '2023-06-01',

  // ─── Prompt caching (natif en 2026, plus de header beta) ──────────────────
  PROMPT_CACHING_ENABLED: true,

  // ─── Max tokens output par service (v9.1 — pipeline Étape 1 doctrinal) ────
  // 10 agents au total : T1 (4 appels par scénario), T1_Certificateur,
  // T2, T3 (amont) + 6 agents T4 (Architecture, Circuits, Modes, Synthèse,
  // Coûts, Transverses) + Certificateur lexique
  //
  // ⭐ LOT 18 — Quand thinking est activé, le max_tokens est partagé entre
  // le thinking ET le texte de réponse. Si thinking consomme 20k tokens,
  // il ne reste que 4k pour le JSON → bug "no text content found".
  // → Pour les agents avec thinking ON, prévoir une marge confortable.
  MAX_TOKENS: {
    // ── Agents amont Étape 1 (production des tableaux T1, T2, T3) ─────────
    agent_t1:                32000,  // ⭐ LOT 18 : 24000 → 32000 (thinking adaptive ON)
    agent_t1_certificateur:  24000,  // ⭐ LOT 18 : 16000 → 24000 (thinking adaptive ON)
    agent_t2:                16000,  // T2 : pas de thinking, OK
    agent_t3:                32000,  // T3 v4 : déjà à 32000 avec thinking

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
  //
  // ⚠ IMPORTANT — Quand thinking est activé, prévoir un MAX_TOKENS large
  // car le thinking consomme du quota partagé avec le texte de réponse.
  // Règle empirique : MAX_TOKENS = 2× le besoin réel en texte de sortie.
  THINKING: {
    agent_t1:                true,   // ⭐ LOT 17 : DOCTRINE Pilier 1
    agent_t1_certificateur:  true,   // ⭐ LOT 17 : vérification doctrinale stricte
    agent_t2:                false,  // T2 : pas de thinking requis (redistribution)
    agent_t3:                true,   // T3 : nuances + clusters demandent du raisonnement
    agent_t4_architecture:   true,
    agent_t4_circuits:       true,
    agent_t4_modes:          true,
    agent_t4_synthese:       true,   // raisonnement filtre/boucle/finalité
    agent_t4_couts:          true,
    agent_t4_transverses:    false,  // assemblage technique sans raisonnement
    certificateur_lexique:   true    // détection de violations lexicales fines
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
