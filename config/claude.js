// config/claude.js
// Configuration Claude API
// ✅ PHASE 1.4 - Configuration propre pour v7.0

module.exports = {
  // API
  API_KEY: process.env.CLAUDE_API_KEY,
  MODEL: process.env.CLAUDE_MODEL || 'claude-sonnet-4-20250514',
  API_URL: 'https://api.anthropic.com/v1/messages',
  API_VERSION: '2023-06-01',
  
  // Prompt caching (économie 90% tokens input)
  PROMPT_CACHING_ENABLED: true,
  PROMPT_CACHING_HEADER: 'prompt-caching-2024-07-31',
  
  // Max tokens par service
  MAX_TOKENS: {
    agent1: 8000,
    agent2: 10000,
    certificateur: 32000,
    default: 8000
  },
  
  // Temperature
  TEMPERATURE: 0.7,
  
  // Timeouts
  TIMEOUT_MS: parseInt(process.env.CLAUDE_TIMEOUT) || 90000,
  
  // Retry
  MAX_RETRIES: parseInt(process.env.MAX_RETRIES) || 3,
  RETRY_DELAY_MS: 5000,
  
  // Rate limiting
  QUESTION_DELAY_MS: parseInt(process.env.QUESTION_DELAY) || 2000, // 2s entre questions
  CANDIDATE_DELAY_MS: parseInt(process.env.CANDIDATE_DELAY) || 30000, // 30s entre candidats
  
  // Pricing (Sonnet 4 - 2025-05)
  PRICING: {
    input_per_million: 3.0, // $3 / 1M tokens input
    cached_input_per_million: 0.3, // $0.3 / 1M tokens input cached (90% économie)
    output_per_million: 15.0 // $15 / 1M tokens output
  },
  
  // Budget monitoring
  BUDGET_ALERT_THRESHOLD: parseFloat(process.env.BUDGET_ALERT_THRESHOLD) || 0.8, // 80%
  MAX_MONTHLY_BUDGET: parseFloat(process.env.MAX_MONTHLY_BUDGET) || 100 // $100
};
