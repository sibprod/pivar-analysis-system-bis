// services/mode-rapide/service_mode_rapide.js
// Service MODE RAPIDE (« Profil V ») — L4 · v2.2 (13/08/2026) — Profil-Cognitif
//
// v2.2 — COÛT PAR PROFIL (demande garante, pricing) : chaque exécution calcule
//   son coût exact en USD depuis les tokens réellement consommés (msg.usage) et
//   l'écrit dans la ligne MODE_RAPIDE (champs cout_usd, tokens_entree,
//   tokens_sortie — à créer dans la table, type Number). Tarif claude-sonnet-4-6
//   vérifié le 13/08/2026 : 3 $/M tokens d'entrée, 15 $/M tokens de sortie —
//   constantes ci-dessous, à ajuster si Anthropic change ses prix.
//
// v2.1 — CORRECTIF premier lancement (incident 13/08, 12h35) : le SDK Anthropic
//   refuse un appel non-streamé au-delà de son seuil (max_tokens 32000 → erreur
//   « Streaming is required for operations that may take longer than 10 minutes »).
//   L'appel passe en STREAMING (client.messages.stream + finalMessage()) —
//   même résultat, même parsing, aucune autre modification.
//
// ⚠️ AVANT MODIFICATION : lire new-prompts/prompt_mode_rapide_profil.md (LA doctrine
//    est dans le conducteur, jamais dans le code) et l'acte de fixation (partie IV).
//
// PRINCIPE : 1 candidat → 1 appel agent → portrait de gouvernance (socle, filtre,
//   rôles, modes, gestes sourcés verbatim) écrit dans la table MODE_RAPIDE.
//   Statut : PROTOTYPE (verrous AM-07 architecture / AM-08 étalonnage non levés).
//
// RÈGLES DURES :
//   - ÉCRITURE CONFINÉE : n'écrit QUE dans MODE_RAPIDE (1 ligne par exécution,
//     l'historique est conservé). Ne touche JAMAIS aux tables du protocole ni aux
//     référentiels. (Consigne CA-08, 13/08/2026.)
//   - Température 0. Modèle claude-sonnet-4-6.
//   - Doctrine du NON CONCLUSIF respectée telle que rendue par l'agent.
//
// ENTRÉE : les 25 lignes RESPONSES du candidat (via airtableService.getResponses) —
//   elles portent À LA FOIS l'instrument (question_text, pilier, scenario_nom,
//   numero_global) et la réponse (response_text). Aucune autre lecture.

'use strict';

const fs   = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const airtableService = require('../infrastructure/airtableService'); // fonctions EXISTANTES uniquement (getResponses)
const accesModeRapide  = require('./acces_mode_rapide');               // accès autonome MODE_RAPIDE (aucun fichier existant modifié)
const logger          = require('../../utils/logger');

const MODEL       = 'claude-sonnet-4-6';
const PROMPT_PATH = path.join(__dirname, '../../new-prompts/prompt_mode_rapide_profil.md');
const VERSION_CONDUCTEUR = 'prompt_mode_rapide_profil v1.0';

// ⭐ v2.2 — Tarif API (USD par MILLION de tokens), vérifié le 13/08/2026.
const PRIX_INPUT_PAR_MTOK  = 3.00;
const PRIX_OUTPUT_PAR_MTOK = 15.00;
function calculerCoutUsd(usage) {
  const tin  = (usage && usage.input_tokens)  || 0;
  const tout = (usage && usage.output_tokens) || 0;
  const cout = (tin / 1e6) * PRIX_INPUT_PAR_MTOK + (tout / 1e6) * PRIX_OUTPUT_PAR_MTOK;
  return { tokens_entree: tin, tokens_sortie: tout, cout_usd: Math.round(cout * 10000) / 10000 };
}

const _sel = v => (v && typeof v === 'object' && v.name !== undefined) ? v.name : (v == null ? '' : String(v));

// ─── BUILDER — instrument + réponses depuis les 25 lignes RESPONSES ─────────
async function construireEntree(candidat_id) {
  const rows = await airtableService.getResponses(candidat_id);
  if (!rows || rows.length === 0) throw new Error(`Aucune ligne RESPONSES pour ${candidat_id}`);
  const instrument = [], reponses = [];
  for (const r of rows) {
    const qid = r.id_question || null;
    if (!qid) continue;
    instrument.push({
      qid,
      pilier_vise: _sel(r.pilier),
      scenario:    _sel(r.scenario_nom),
      position:    r.numero_global || null,
      question:    r.question_text || ''
    });
    reponses.push({ qid, reponse: r.response_text || '' });
  }
  if (reponses.length !== 25) {
    logger.warn('[ModeRapide] nombre de réponses inattendu', { candidat_id, count: reponses.length, attendu: 25 });
  }
  return { candidat_id, instrument, reponses, cas_resolu: null };
}

// ─── AGENT ──────────────────────────────────────────────────────────────────
async function appelerAgent(entree) {
  const client = new Anthropic();
  const prompt = fs.readFileSync(PROMPT_PATH, 'utf8');
  // ⭐ v2.1 — streaming obligatoire pour les grandes sorties (le SDK refuse sinon).
  const stream = client.messages.stream({
    model: MODEL, max_tokens: 32000, temperature: 0,
    system: prompt,
    messages: [{ role: 'user', content: 'ENTRÉE JSON :\n' + JSON.stringify(entree, null, 2) }]
  });
  const msg = await stream.finalMessage();
  const texte = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  const mA = texte.match(/<analyse>([\s\S]*?)<\/analyse>/);
  const analyse = mA ? mA[1].trim() : '(analyse absente)';
  const brut = texte.replace(/<analyse>[\s\S]*?<\/analyse>/, '').replace(/```json|```/g, '').trim();
  const d = brut.indexOf('{'), f = brut.lastIndexOf('}');
  if (d < 0 || f < 0) throw new Error('ModeRapide : JSON introuvable dans la sortie agent');
  const sortie = JSON.parse(brut.slice(d, f + 1));
  const usage = msg.usage || {};
  return { sortie, analyse, usage };
}

// ─── RUN ────────────────────────────────────────────────────────────────────
async function run({ candidat_id }) {
  if (!candidat_id) throw new Error('service_mode_rapide.run : candidat_id requis');
  const t0 = Date.now();
  logger.info('[ModeRapide] ▶ démarrage', { candidat_id });

  const entree = await construireEntree(candidat_id);
  const { sortie, analyse, usage } = await appelerAgent(entree);

  const fields = {
    date_execution:       new Date().toISOString(),
    version_conducteur:   VERSION_CONDUCTEUR,
    modele:               MODEL,
    statut_resultat:      sortie.non_conclusif ? 'NON_CONCLUSIF' : 'CONCLUSIF',
    socle:                sortie.socle || undefined,
    rival_examine:        sortie.rival_examine || '',
    roles_json:           JSON.stringify(sortie.roles || {}),
    filtre:               sortie.filtre || '',
    modes_json:           JSON.stringify(sortie.modes || {}),
    gestes_json:          JSON.stringify(sortie.gestes || []),
    glissements_json:     JSON.stringify(sortie.glissements || []),
    marqueurs_json:       JSON.stringify(sortie.marqueurs_affectifs || []),
    tests_departage_json: JSON.stringify(sortie.tests_departage || {}),
    portrait_markdown:    sortie.portrait_markdown || '',
    analyse_verbalisee:   analyse,
    protocole_existe:     false,
    concordance_statut:   'NON_COMPARE'
  };
  // ⭐ v2.2 — coût exact de l'exécution (pour le pricing garante)
  const cout = calculerCoutUsd(usage);
  fields.tokens_entree = cout.tokens_entree;
  fields.tokens_sortie = cout.tokens_sortie;
  fields.cout_usd      = cout.cout_usd;
  const recId = await accesModeRapide.createModeRapide(candidat_id, fields);

  const elapsedMs = Date.now() - t0;
  logger.info('[ModeRapide] ✅ portrait écrit', {
    candidat_id, recId,
    resultat: sortie.non_conclusif ? 'NON_CONCLUSIF' : `socle ${sortie.socle}`,
    input_tokens: usage.input_tokens, output_tokens: usage.output_tokens,
    cout_usd: fields.cout_usd, elapsedMs
  });
  return { success: true, candidat_id, modeRapideRecId: recId,
           non_conclusif: !!sortie.non_conclusif, socle: sortie.socle || null,
           cout_usd: fields.cout_usd, sortie, elapsedMs };
}

module.exports = { run, construireEntree, appelerAgent };
