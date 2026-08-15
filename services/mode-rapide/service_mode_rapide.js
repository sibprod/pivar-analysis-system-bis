// Service MODE RAPIDE — L4 · v4.0 (14/08/2026) — Profil-Cognitif
//
// v4.0 — FIN DE LA COMPRESSION (doute garante confirmé : les condensés v2.x
//   biaisent vers P4 au lieu de lire). L'étage de lecture est désormais LA PIÈCE
//   1.1 RÉELLE du protocole (prompt_etape1_responses.txt, 490 lignes), exécutée
//   comme le pipeline l'exécute : PAR SCÉNARIO, 5 lots de 5 questions, avec le
//   payload exact de l'agent maison (question + storytelling + transition +
//   réponse). Le serveur AGRÈGE mécaniquement ses 25 décisions (gouvernes,
//   sorties, glissements, débordements), puis l'étage final (profil v3.0)
//   détermine et rédige SANS re-lire : la 1.1 fait foi.
//   Ce mode rapide n'imite plus le protocole : il en exécute le premier étage
//   authentique, avec un raccourci d'agrégation (T1/T2/référentiel sautés).
//   Conducteurs = ACTIFS SENSIBLES. Coût = somme des 6 appels.

'use strict';

const fs   = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');
const logger          = require('../../utils/logger');
const airtableService = require('../infrastructure/airtableService');
const accesModeRapide = require('./acces_mode_rapide');

// ─── CONSTANTES ──────────────────────────────────────────────────────────────
const MODEL = process.env.CLAUDE_MODEL || 'claude-sonnet-4-6';   // piloté par Render
const PROMPT_PATH = path.join(__dirname, '../../new-prompts/prompt_mode_rapide_profil.md');
const VERSION_CONDUCTEUR = 'mode rapide v3.0 — étage 1 = pièce 1.1 réelle (5 lots) + agrégation mécanique + profil v3.0';

// Le prompt 1.1 vit déjà dans le repo — résolution multi-chemins par prudence.
const CHEMINS_PROMPT_11 = [
  path.join(__dirname, '../../new-prompts/prompt_etape1_responses.txt'),
  path.join(__dirname, '../../prompts/prompt_etape1_responses.txt'),
  path.join(__dirname, '../../prompt_etape1_responses.txt')
];
function cheminPrompt11() {
  for (const c of CHEMINS_PROMPT_11) { if (fs.existsSync(c)) return c; }
  throw new Error('prompt_etape1_responses.txt introuvable (new-prompts/, prompts/, racine)');
}
const SCENARIOS_ORDRE_MR = ['SOMMEIL', 'WEEKEND', 'ANIMAL_1', 'ANIMAL_2', 'PANNE'];
function extraireLookupMR(v) { return Array.isArray(v) ? (v[0] || '') : (v || ''); }
function _sel(v) { return (v && typeof v === 'object' && v.name) ? v.name : (v || ''); }

// Tarif API (USD par MILLION de tokens), vérifié le 13/08/2026 — à revoir si CLAUDE_MODEL change.
const PRIX_INPUT_PAR_MTOK  = 3.00;
const PRIX_OUTPUT_PAR_MTOK = 15.00;
function calculerCoutUsd(usage) {
  const tin  = (usage && usage.input_tokens)  || 0;
  const tout = (usage && usage.output_tokens) || 0;
  const cout = (tin / 1e6) * PRIX_INPUT_PAR_MTOK + (tout / 1e6) * PRIX_OUTPUT_PAR_MTOK;
  return { tokens_entree: tin, tokens_sortie: tout, cout_usd: Math.round(cout * 10000) / 10000 };
}

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
    // ⭐ v4.0 — la pièce 1.1 réelle exige le payload complet de l'agent maison
    reponses.push({
      id_question:   qid,
      numero_global: r.numero_global || null,
      pilier:        _sel(r.pilier),
      scenario_nom:  _sel(r.scenario_nom),
      question_text: r.question_text || '',
      response_text: r.response_text || '',
      storytelling:  extraireLookupMR(r['storytelling_general (from question _lien)']),
      transition:    extraireLookupMR(r['transition_narrative (from question _lien)'])
    });
  }
  if (reponses.length !== 25) {
    logger.warn('[ModeRapide] nombre de réponses inattendu', { candidat_id, count: reponses.length, attendu: 25 });
  }
  // v4.0 — plus de cas résolu : la lecture est faite par la pièce 1.1 réelle.
  return { candidat_id, instrument, reponses, cas_resolu: null };
}

// ─── AGENTS : pièce 1.1 réelle (5 lots) + agrégation + détermination ───────
function _client() {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY / ANTHROPIC_API_KEY manquante');
  return new Anthropic({ apiKey });
}
async function _appel(client, promptTexte, contenu, maxTokens) {
  const stream = client.messages.stream({
    model: MODEL, max_tokens: maxTokens, temperature: 0,
    system: promptTexte,
    messages: [{ role: 'user', content: contenu }]
  });
  const msg = await stream.finalMessage();
  const texte = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  return { texte, usage: msg.usage || {} };
}
function _parseJson(texte, quoi) {
  const brut = texte.replace(/```json|```/g, '').trim();
  const d = brut.indexOf('{'), f = brut.lastIndexOf('}');
  if (d < 0 || f < 0) throw new Error('ModeRapide — JSON introuvable (' + quoi + ')');
  return JSON.parse(brut.slice(d, f + 1));
}
// ⭐ v4.0 — agrégation mécanique des 25 décisions de la pièce 1.1
function calculerComptes(lectures) {
  const P = ['P1','P2','P3','P4','P5'];
  const zero = () => ({ P1:0, P2:0, P3:0, P4:0, P5:0 });
  const gouvernes = zero(), sorties = zero(), gouverne_hors_terrain = zero();
  const glissements = [];
  for (const l of lectures) {
    const g = l.cog_pilier_gouverne, so = l.cog_pilier_sortie, vise = l.pilier_demande;
    if (P.includes(g)) gouvernes[g]++;
    if (P.includes(so)) sorties[so]++;
    if (P.includes(g) && P.includes(vise) && g !== vise) {
      gouverne_hors_terrain[g]++;
      glissements.push({ id_question: l.id_question, pilier_demande: vise, gouverne: g,
                         commentaire: l.cog_gouverne_commentaire || '' });
    }
  }
  return { gouvernes, sorties, gouverne_hors_terrain, glissements };
}
async function appelerAgent(entree) {
  const client = _client();
  const prompt11 = fs.readFileSync(cheminPrompt11(), 'utf8');
  const usage = { input_tokens: 0, output_tokens: 0 };
  // ÉTAGE 1 — LA PIÈCE 1.1 RÉELLE, par scénario (payload exact de l'agent maison)
  const parScenario = {};
  for (const r of entree.reponses) {
    const sc = r.scenario_nom || 'INCONNU';
    (parScenario[sc] = parScenario[sc] || []).push(r);
  }
  const lectures = [];
  for (const sc of SCENARIOS_ORDRE_MR) {
    const lot = parScenario[sc];
    if (!lot || !lot.length) continue;
    const payload = {
      candidat_id: entree.candidat_id,
      civilite: 'Madame ou Monsieur',
      scenario_name: sc,
      nb_questions_in_scenario: lot.length,
      nb_questions_total: 25,
      responses: lot.map(r => ({
        id_question:   r.id_question,
        numero_global: r.numero_global,
        pilier:        r.pilier,
        scenario_nom:  r.scenario_nom,
        question_text: r.question_text,
        response_text: r.response_text,
        storytelling:  r.storytelling,
        transition:    r.transition
      }))
    };
    const e = await _appel(client, prompt11, JSON.stringify(payload, null, 1), 8000);
    usage.input_tokens += e.usage.input_tokens || 0;
    usage.output_tokens += e.usage.output_tokens || 0;
    const sortie = _parseJson(e.texte, '1.1 ' + sc);
    const rows = sortie.rows || [];
    if (rows.length !== lot.length) throw new Error('ModeRapide 1.1 — mismatch ' + sc + ' : ' + rows.length + '/' + lot.length);
    lectures.push(...rows);
    logger.info('[ModeRapide] 1.1 réelle — scénario lu', { candidat_id: entree.candidat_id, scenario: sc, lignes: rows.length });
  }
  if (lectures.length < 20) throw new Error('ModeRapide 1.1 — lecture incomplète : ' + lectures.length + '/25');
  // AGRÉGATION MÉCANIQUE
  const comptes = calculerComptes(lectures);
  logger.info('[ModeRapide] comptes 1.1 calculés', {
    candidat_id: entree.candidat_id, gouvernes: comptes.gouvernes,
    hors_terrain: comptes.gouverne_hors_terrain
  });
  // ÉTAGE FINAL — détermination + portrait sur les décisions de la 1.1
  const lecturesUtiles = lectures.map(l => ({
    id_question: l.id_question, pilier_demande: l.pilier_demande,
    v2_analyse: l.v2_analyse, cog_comprend: l.cog_comprend,
    cog_outils_mobilises: l.cog_outils_mobilises,
    cog_pilier_sortie: l.cog_pilier_sortie, cog_sortie_commentaire: l.cog_sortie_commentaire,
    cog_pilier_gouverne: l.cog_pilier_gouverne, cog_gouverne_commentaire: l.cog_gouverne_commentaire,
    cog_resultat_vise: l.cog_resultat_vise
  }));
  const promptProfil = fs.readFileSync(PROMPT_PATH, 'utf8');
  const e2 = await _appel(client, promptProfil,
    'ENTRÉE JSON :\n' + JSON.stringify({ candidat_id: entree.candidat_id, lectures: lecturesUtiles, comptes }, null, 1), 24000);
  usage.input_tokens += e2.usage.input_tokens || 0;
  usage.output_tokens += e2.usage.output_tokens || 0;
  const mA = e2.texte.match(/<analyse>([\s\S]*?)<\/analyse>/);
  const analyse = (mA ? mA[1].trim() : '(analyse absente)') +
    '\n\n── COMPTES 1.1 (serveur) ──\n' + JSON.stringify(comptes, null, 1);
  const sortie = _parseJson(e2.texte.replace(/<analyse>[\s\S]*?<\/analyse>/, ''), 'profil');
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
