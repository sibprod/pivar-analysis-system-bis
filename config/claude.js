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
//
// PHASE ETAPE1.1 (2026-05-07) — v10.6 :
//   - Ajout du service agent_prompt_etape1 pour la pré-étape 1.1 (lecture cognitive)
//   - max_tokens 16000, thinking false (5 questions × 10 champs = ~7-10k output, marge x1.6)
//
// ⭐ PHASE v10.12 (2026-06-24) — AGENT RÔLES DE PILIERS (Phase 4b étape 1.2) :
//   - Ajout du service agent_t2_roles (attribution socle/amont/aval/fonctionnel).
//   - max_tokens 16000, thinking false : sortie = 5 rôles + raisonnement étape par
//     étape en JSON (~2-4k output). 16000 donne une marge large sans troncature.
//     Pas de thinking : le raisonnement est explicite dans le JSON de sortie
//     (la matière est pré-mâchée par le service, lecture déterministe).

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
    // ── Pré-étape 1.1 (lecture cognitive) — Phase ETAPE1.1-1.0.0 v10.6 ────
    agent_prompt_etape1:     16000,  // 5 questions × ~1.5K output + marge — pas de thinking

    // ── Agents amont Étape 1 ──────────────────────────────────────────────
    agent_t1:                64000,  // 5 appels par scénario, thinking ON
    agent_t1_verificateur:   96000,  // ⭐ v10 : renommé depuis agent_t1_certificateur (Décision n°10)
    agent_t2:                48000,  // ⭐ A22 — aligné sur déclaration prompt etape1_t2_phase1 (48000)
    agent_t2_roles:          16000,  // ⭐ v10.12 — agent rôles de piliers (4b) : 5 rôles + raisonnement, pas de thinking
    agent_t3:                64000,  // 75 lignes pilier × circuit, thinking ON

    // ── Étape 3 — le bilan (v11.0, 28/05/2026) ────────────────────────────
    // 7 appels segmentés du même prompt etape1_t3bilan.txt :
    // - Appel 0 (sections globales)   : ~4k output
    // - Appel 0bis (soleil §02bis)    : ~6k output
    // - Appels 1-5 (un par pilier)    : pilier socle riche peut dépasser 8k
    //                                    (12 circuits × verbatims + synthèses + bloc 4)
    // → 64000 cohérent avec agent_t3 et la richesse du contenu pilier socle.
    // Pas de thinking : assemblage rédactionnel structuré, pas de raisonnement complexe.
    agent_t3_bilan:          64000,

    // ── Agents T4 (production du bilan) ───────────────────────────────────
    agent_t4_architecture:   64000,
    agent_t4_circuits:       64000,
    agent_t4_modes:          64000,
    agent_t4_synthese:       64000,
    agent_t4_couts:          64000,
    agent_t4_transverses:    16000,  // pas de thinking, OK

    // ── Étape 2 — les 4 excellences cognitives (v11.7, 05/06/2026) ────────
    // agent_t5a : code les 4 excellences réponse par réponse (25 lignes/candidat),
    //   thinking ON (distinction fine des niveaux, justification comparative).
    // agent_t5bc : synthèse agrégée T5B (4 lignes + verbatims_preuves) + T5C (profil
    //   + verdicts des deux faces), thinking ON (raisonnement régime/verdict).
    //   ⭐ CORRECTION A11 (17/06/2026) : agent_t5b et agent_t5c ajoutés séparément
    //   (découpage v2.0 en 4 sous-agents — agent_t5bc n'est plus lu).
    agent_t5a:               64000,
    agent_t5bc:              64000,  // conservé pour compatibilité — non utilisé depuis v2.0
    agent_t5b:               64000,  // ⭐ A11 — portraits par excellence (portrait_excellence long)
    agent_t5c:               64000,  // ⭐ A11 — profil global + verdicts deux faces
    agent_testdec_gen:       64000,  // ⭐ Étape 2c (02/07) — générateur du test de décentration
    agent_testdec_cod:       64000,  // ⭐ Étape 2c (02/07) — codeur du test de décentration

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
    agent_prompt_etape1:     false,  // ⭐ v10.6 — lecture cognitive structurée, pas de thinking
    agent_t1:                true,   // DOCTRINE Pilier 1
    agent_t1_verificateur:   true,   // ⭐ v10 : vérification doctrinale stricte
    agent_t2:                false,  // pas de thinking requis (redistribution mécanique)
    agent_t2_roles:          false,  // ⭐ v10.12 — lecture déterministe pré-mâchée, pas de thinking
    agent_t3:                true,   // nuances + clusters
    agent_t3_bilan:          false,  // ⭐ v11.0 — assemblage rédactionnel du bilan, pas de raisonnement complexe
    agent_t5a:               true,   // ⭐ v11.7 — distinction fine des niveaux par excellence
    agent_testdec_gen:       true,   // ⭐ Étape 2c — construction calibrée des contrastes
    agent_testdec_cod:       true,   // ⭐ Étape 2c — codage de l'ancrage contre deux référentiels
    agent_t5bc:              true,   // conservé pour compatibilité — non utilisé depuis v2.0
    agent_t5b:               true,   // ⭐ A11 — portraits par excellence, raisonnement régime
    agent_t5c:               true,   // ⭐ A11 — verdicts deux faces, raisonnement comparatif
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
