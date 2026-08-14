// services/mode-rapide/service_mode_rapide.js
// Service MODE RAPIDE — L4 · v3.0 (13/08/2026) — Profil-Cognitif
//
// v3.0 — DOCTRINE INJECTÉE + CALCUL MÉCANIQUE (décision garante : un mode rapide
//   FIABLE pour la production ; l'expérience d'inimitabilité reste figée sur v1.x).
//   Architecture en DEUX ÉTAGES, miniature du protocole :
//     Étage 1 (agent, prompt_mode_rapide_codage.md) : code les gestes — sortie,
//       service, verbatim — JSON compact, ~3 min.
//     Entre les deux (CODE, pas IA) : le serveur CALCULE la table — en_propre,
//       receptions (le socle est le pilier le plus servi), émissions, flux,
//       glissements. Le calcul qui départage est mécanique, comme au protocole.
//     Étage 2 (agent, prompt_mode_rapide_profil.md v2.0) : applique la doctrine
//       (D1 receveur → D6 preuve) sur la table calculée, écrit le portrait.
//   Les deux conducteurs sont des ACTIFS SENSIBLES (serveur uniquement).
//   Sortie/écriture/contrôle inchangés. Coût = somme des deux appels.
//
// v2.6 — CAS RÉSOLU DE CALIBRAGE (reproduction du dispositif de l'épreuve E2,
//   décision garante : sans 100 % sur le socle et un filtre fiable, l'outil n'est
//   pas retenu — AM-08). Le service charge new-prompts/mode_rapide_cas_resolu.md
//   s'il existe et le passe en entrée (cas_resolu). GARDE-FOU : si le candidat
//   analysé EST le candidat du cas résolu (liste CAS_RESOLU_INTERDIT_POUR,
//   surchageable par env), le cas est retiré — on ne donne jamais à l'agent le
//   corrigé de la copie qu'il analyse.
// v2.5 — Version du conducteur portée à v1.1 (durcissement OP-3/OP-4/non-conclusif).
//
// v2.4 — Le modèle se pilote depuis l'environnement Render comme le reste du
//   service : CLAUDE_MODEL (confirmé garante : claude-sonnet-4-6), avec repli
//   sur claude-sonnet-4-6 si absent. Le nom du modèle réellement utilisé est
//   écrit dans chaque ligne MODE_RAPIDE (champ modele) — traçabilité des runs.
//
// v2.3 — CORRECTIF clé API (incident 13/08, 12h51) : la variable d'environnement
//   du service s'appelle CLAUDE_API_KEY (cf. server.js, requiredEnv) — le SDK ne
//   trouvait pas ANTHROPIC_API_KEY. Résolution au pattern maison (comme le
//   service PA) : CLAUDE_API_KEY d'abord, ANTHROPIC_API_KEY en repli, clé passée
//   explicitement au client. Aucune autre modification.
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

const MODEL       = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';   // ⭐ v2.4 — piloté par Render
const PROMPT_PATH = path.join(__dirname, '../../new-prompts/prompt_mode_rapide_profil.md');
const VERSION_CONDUCTEUR = 'mode rapide v2.0 — codage v1.0 + profil v2.0 (doctrine + calcul mécanique)';
const PROMPT_CODAGE_PATH = path.join(__dirname, '../../new-prompts/prompt_mode_rapide_codage.md');
const CAS_RESOLU_PATH = path.join(__dirname, '../../new-prompts/mode_rapide_cas_resolu.md');
// Identifiants du candidat du cas résolu (R original + R rejeu) — jamais son propre corrigé.
const CAS_RESOLU_INTERDIT_POUR = (process.env.CAS_RESOLU_INTERDIT_POUR ||
  'pivar_1762094675215_77bg53iz0,pcc_1786375017158_p3caz8zma').split(',').map(x => x.trim());

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
  // ⭐ v2.6 — cas résolu de calibrage (dispositif de l'épreuve E2)
  let cas_resolu = null;
  if (CAS_RESOLU_INTERDIT_POUR.includes(candidat_id)) {
    logger.info('[ModeRapide] cas résolu retiré — le candidat analysé est le candidat du cas résolu', { candidat_id });
  } else if (fs.existsSync(CAS_RESOLU_PATH)) {
    cas_resolu = {
      note: 'Cas résolu fourni en CALIBRAGE — règle anti-recopie OP-7b OBLIGATOIRE : confrontation point par point, le cas montre COMMENT lire, jamais QUOI conclure.',
      dossier: fs.readFileSync(CAS_RESOLU_PATH, 'utf8')
    };
    logger.info('[ModeRapide] cas résolu de calibrage chargé', { candidat_id });
  }
  return { candidat_id, instrument, reponses, cas_resolu };
}

// ─── AGENTS (deux étages) + CALCUL MÉCANIQUE ───────────────────────────────
function _client() {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY / ANTHROPIC_API_KEY manquante');
  return new Anthropic({ apiKey });
}
async function _appel(client, promptPath, contenu, maxTokens) {
  const prompt = fs.readFileSync(promptPath, 'utf8');
  const stream = client.messages.stream({
    model: MODEL, max_tokens: maxTokens, temperature: 0,
    system: prompt,
    messages: [{ role: 'user', content: contenu }]
  });
  const msg = await stream.finalMessage();
  const texte = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  return { texte, usage: msg.usage || {} };
}
// ⭐ v3.0 — LE CALCUL QUI DÉPARTAGE EST FAIT PAR LE CODE, PAS PAR L'IA.
function calculerTable(codage) {
  const P = ['P1','P2','P3','P4','P5'];
  const zero = () => ({ P1:0, P2:0, P3:0, P4:0, P5:0 });
  const en_propre = zero(), receptions = zero(), emissions = zero();
  const flux = {}; const glissements = [];
  for (const q of codage) {
    const vise = String(q.qid || '').slice(0, 2);
    for (const g of (q.gestes || [])) {
      const sortie = g.sortie, sert = g.sert || null;
      if (!P.includes(sortie)) continue;
      if (sert && P.includes(sert) && sert !== sortie) {
        emissions[sortie]++; receptions[sert]++;
        const k = sortie + '→' + sert; flux[k] = (flux[k] || 0) + 1;
      } else {
        en_propre[sortie]++;
      }
      if (sortie !== vise) {
        glissements.push({ qid: q.qid, pilier_vise: vise, sortie, sert, verbatim: g.verbatim || '' });
      }
    }
  }
  return { en_propre, receptions, emissions, flux, glissements };
}
async function appelerAgent(entree) {
  const client = _client();
  // ÉTAGE 1 — codage des gestes (JSON compact)
  const e1 = await _appel(client, PROMPT_CODAGE_PATH,
    'RÉPONSES À CODER (JSON) :\n' + JSON.stringify({ reponses: entree.reponses }, null, 1), 16000);
  const brut1 = e1.texte.replace(/```json|```/g, '').trim();
  const d1 = brut1.indexOf('['), f1 = brut1.lastIndexOf(']');
  if (d1 < 0 || f1 < 0) throw new Error('ModeRapide étage 1 : JSON codage introuvable');
  const codage = JSON.parse(brut1.slice(d1, f1 + 1));
  logger.info('[ModeRapide] étage 1 — codage terminé', {
    candidat_id: entree.candidat_id, questions: codage.length,
    tokens: (e1.usage.input_tokens || 0) + (e1.usage.output_tokens || 0)
  });
  // CALCUL MÉCANIQUE — la table qui départage
  const table = calculerTable(codage);
  logger.info('[ModeRapide] table calculée', {
    candidat_id: entree.candidat_id, receptions: table.receptions, en_propre: table.en_propre
  });
  // ÉTAGE 2 — doctrine appliquée sur la table, portrait
  const entree2 = { candidat_id: entree.candidat_id, reponses: entree.reponses, table_calculee: table };
  const e2 = await _appel(client, PROMPT_PATH,
    'ENTRÉE JSON :\n' + JSON.stringify(entree2, null, 1), 24000);
  const texte = e2.texte;
  const mA = texte.match(/<analyse>([\s\S]*?)<\/analyse>/);
  const analyse = (mA ? mA[1].trim() : '(analyse absente)') +
    '\n\n── TABLE CALCULÉE (serveur) ──\n' + JSON.stringify(table, null, 1);
  const brut = texte.replace(/<analyse>[\s\S]*?<\/analyse>/, '').replace(/```json|```/g, '').trim();
  const d = brut.indexOf('{'), f = brut.lastIndexOf('}');
  if (d < 0 || f < 0) throw new Error('ModeRapide étage 2 : JSON introuvable dans la sortie agent');
  const sortie = JSON.parse(brut.slice(d, f + 1));
  const usage = {
    input_tokens:  (e1.usage.input_tokens  || 0) + (e2.usage.input_tokens  || 0),
    output_tokens: (e1.usage.output_tokens || 0) + (e2.usage.output_tokens || 0)
  };
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
