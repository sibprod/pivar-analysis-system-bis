/**
 * ════════════════════════════════════════════════════════════════════════
 * SERVICE MODE RAPIDE DE PROFILING (« PROFIL V ») — L4 · v1.1 · 13/08/2026
 * Profil-Cognitif Sib Prod
 *
 * PRINCIPE : 1 candidat → 1 appel agent (conducteur prompt_mode_rapide_profilV.md)
 *   → portrait de gouvernance (socle, filtre, rôles, modes, gestes sourcés).
 *   Statut : PROTOTYPE (verrous AM-07 architecture / AM-08 étalonnage non levés).
 *
 * RÈGLES DURES :
 *   - ÉCRITURE CONFINÉE : ce service écrit UNIQUEMENT dans la table MODE_RAPIDE
 *     (une ligne par exécution — l'historique est conservé). Il ne touche JAMAIS
 *     aux tables du protocole ni aux référentiels. Sorties disque en complément.
 *   - Température 0. Le prompt est chargé depuis le fichier — la doctrine est
 *     dans le conducteur, jamais dans le code.
 *   - Doctrine du NON CONCLUSIF respectée telle que rendue par l'agent.
 *
 * ENTRÉES (deux modes) :
 *   A. Airtable : --candidat <id>       → lit questions + réponses en base.
 *   B. Fichier  : --candidat <id> --input reponses.json
 *      (format : [ { "qid":"P1Q2", "reponse":"..." }, ×25 ] — l'instrument est
 *       toujours lu en base, ou via --instrument instrument.json)
 *
 * USAGE :
 *   node service_mode_rapide.js --candidat <id>                  → exécute, écrit ./out
 *   node service_mode_rapide.js --candidat <id> --dry-run        → n'écrit rien, affiche
 *   Variables d'env : ANTHROPIC_API_KEY, AIRTABLE_API_KEY (mode A)
 * ════════════════════════════════════════════════════════════════════════
 */
'use strict';
const fs = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

// ── CONFIG ────────────────────────────────────────────────────────────────
const BASE_ID     = 'appgghhXjYBdFRras';
const T_QUESTIONS = 'tblplgCMOqQYBd40o';   // questions_pivar_scenario
const T_RESPONSES = 'tblXThYoxv33La6B6';   // RESPONSES
const T_MODE_RAPIDE = 'tblXXXXXXXXXXXXXX';  // ⚠ MODE_RAPIDE — coller l'ID après création (cf. TABLE_MODE_RAPIDE_SPEC.md)
// ⚠ À VÉRIFIER PAR LA GARANTE avant premier run en mode A : les NOMS exacts des
//   champs de RESPONSES (le REST Airtable renvoie les noms, pas les IDs).
const F_RESP = {
  candidat: 'candidat_id',      // champ identifiant le candidat sur la ligne réponse
  qid:      'id_question',      // champ code question (P1Q2…)
  texte:    'reponse_text',     // champ texte intégral de la réponse
};
const MODEL = 'claude-sonnet-4-6';
const PROMPT_PATH = path.join(__dirname, 'prompt_mode_rapide_profilV.md');

// ── Airtable REST (lecture seule) ─────────────────────────────────────────
async function atList(table, params = {}) {
  const key = process.env.AIRTABLE_API_KEY;
  if (!key) throw new Error('AIRTABLE_API_KEY manquant');
  let records = [], offset;
  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE_ID}/${table}`);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    if (offset) url.searchParams.set('offset', offset);
    const r = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!r.ok) throw new Error(`Airtable ${table} : HTTP ${r.status} — ${await r.text()}`);
    const j = await r.json();
    records = records.concat(j.records || []);
    offset = j.offset;
  } while (offset);
  return records;
}

// ── BUILDER ───────────────────────────────────────────────────────────────
async function lireInstrument(instrumentFile) {
  if (instrumentFile) return JSON.parse(fs.readFileSync(instrumentFile, 'utf8'));
  const recs = await atList(T_QUESTIONS, {});
  const rows = recs.map(r => ({
    qid:         r.fields['id_question'],
    pilier_vise: (r.fields['pilier'] && r.fields['pilier'].name) || r.fields['pilier'] || '',
    scenario:    (r.fields['scenario_nom'] && r.fields['scenario_nom'].name) || r.fields['scenario_nom'] || '',
    position:    r.fields['position_narrative'],
    question:    r.fields['question_text'] || '',
    guidance:    r.fields['guidance_new'] || r.fields['guidance'] || '',
    amorce:      r.fields['amorce_reponse'] || '',
  })).filter(x => x.qid);
  rows.sort((a, b) => (a.position || 0) - (b.position || 0));
  if (rows.length !== 25) console.warn(`⚠ instrument : ${rows.length} questions lues (25 attendues)`);
  return rows;
}

async function lireReponses(cid, inputFile) {
  if (inputFile) return JSON.parse(fs.readFileSync(inputFile, 'utf8'));
  const formula = `{${F_RESP.candidat}}='${cid.replace(/'/g, "\\'")}'`;
  const recs = await atList(T_RESPONSES, { filterByFormula: formula });
  const rows = recs.map(r => ({
    qid:     r.fields[F_RESP.qid] && (r.fields[F_RESP.qid].name || r.fields[F_RESP.qid]),
    reponse: r.fields[F_RESP.texte] || '',
  })).filter(x => x.qid && x.reponse);
  if (rows.length !== 25) console.warn(`⚠ réponses : ${rows.length} lues pour ${cid} (25 attendues) — vérifier F_RESP`);
  return rows;
}

// ── AGENT ─────────────────────────────────────────────────────────────────
async function appelerAgent(entree) {
  const client = new Anthropic();
  const prompt = fs.readFileSync(PROMPT_PATH, 'utf8');
  const msg = await client.messages.create({
    model: MODEL, max_tokens: 32000, temperature: 0,
    system: prompt,
    messages: [{ role: 'user', content: 'ENTRÉE JSON :\n' + JSON.stringify(entree, null, 2) }],
  });
  const texte = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  const mA = texte.match(/<analyse>([\s\S]*?)<\/analyse>/);
  const analyse = mA ? mA[1].trim() : '(analyse absente)';
  const jsonBrut = texte.replace(/<analyse>[\s\S]*?<\/analyse>/, '').replace(/```json|```/g, '').trim();
  const debut = jsonBrut.indexOf('{'), fin = jsonBrut.lastIndexOf('}');
  if (debut < 0 || fin < 0) throw new Error('Agent : JSON introuvable dans la sortie');
  const sortie = JSON.parse(jsonBrut.slice(debut, fin + 1));
  return { sortie, analyse };
}

// ── WRITER AIRTABLE (MODE_RAPIDE uniquement) ─────────────────────────────
async function ecrireModeRapide(cid, sortie, analyse) {
  const key = process.env.AIRTABLE_API_KEY;
  const fields = {
    candidat_id: cid,
    date_execution: new Date().toISOString(),
    version_conducteur: 'prompt_mode_rapide_profilV v1.0',
    modele: MODEL,
    statut_resultat: sortie.non_conclusif ? 'NON_CONCLUSIF' : 'CONCLUSIF',
    socle: sortie.socle || null,
    rival_examine: sortie.rival_examine || '',
    roles_json: JSON.stringify(sortie.roles || {}),
    filtre: sortie.filtre || '',
    modes_json: JSON.stringify(sortie.modes || {}),
    gestes_json: JSON.stringify(sortie.gestes || []),
    glissements_json: JSON.stringify(sortie.glissements || []),
    marqueurs_json: JSON.stringify(sortie.marqueurs_affectifs || []),
    tests_departage_json: JSON.stringify(sortie.tests_departage || {}),
    portrait_markdown: sortie.portrait_markdown || '',
    analyse_verbalisee: analyse || '',
    protocole_existe: false,
    concordance_statut: 'NON_COMPARE',
  };
  Object.keys(fields).forEach(k => (fields[k] === null) && delete fields[k]);
  const r = await fetch(`https://api.airtable.com/v0/${BASE_ID}/${T_MODE_RAPIDE}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ records: [{ fields }] }),
  });
  if (!r.ok) throw new Error(`MODE_RAPIDE write : HTTP ${r.status} — ${await r.text()}`);
  const j = await r.json();
  return j.records[0].id;
}

// ── WRITER DISQUE ─────────────────────────────────────────────────────────
function ecrire(cid, sortie, analyse, outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const base = path.join(outDir, `${cid}_${stamp}`);
  fs.writeFileSync(base + '_profilV.json', JSON.stringify(sortie, null, 2), 'utf8');
  fs.writeFileSync(base + '_analyse.md', '# Trace <analyse> de l\'agent\n\n' + analyse, 'utf8');
  fs.writeFileSync(base + '_portrait.md', sortie.portrait_markdown || '(portrait absent)', 'utf8');
  return base;
}

// ── RUN ───────────────────────────────────────────────────────────────────
async function run(opts = {}) {
  const argv = process.argv.slice(2);
  const arg = f => argv.includes(f) ? argv[argv.indexOf(f) + 1] : null;
  const cid = opts.candidat_id || arg('--candidat');
  if (!cid) throw new Error('--candidat <id> obligatoire');
  const dry = opts.dry_run === true || argv.includes('--dry-run');
  const outDir = opts.out || arg('--out') || path.join(__dirname, 'out');

  console.log(`[ProfilV] Candidat ${cid} — mode rapide L4 (prototype, lecture seule)`);
  const instrument = await lireInstrument(opts.instrument || arg('--instrument'));
  const reponses   = await lireReponses(cid, opts.input || arg('--input'));
  console.log(`[ProfilV] Instrument : ${instrument.length} questions · Réponses : ${reponses.length}`);

  const entree = { candidat_id: cid, instrument, reponses, cas_resolu: null };
  const { sortie, analyse } = await appelerAgent(entree);

  if (sortie.non_conclusif) {
    console.log('[ProfilV] ⚠ NON CONCLUSIF — protocole complet requis (doctrine OP-4 respectée)');
  } else {
    console.log(`[ProfilV] Socle : ${sortie.socle} · Rival examiné : ${sortie.rival_examine}`);
    console.log(`[ProfilV] Filtre : « ${sortie.filtre} »`);
  }
  if (dry) { console.log('\n── <analyse> ──\n' + analyse); console.log('\n── JSON ──\n' + JSON.stringify(sortie, null, 2)); return { ok: true, dryRun: true, sortie }; }
  const base = ecrire(cid, sortie, analyse, outDir);
  let recId = null;
  if (!argv.includes('--no-airtable') && opts.airtable !== false) {
    recId = await ecrireModeRapide(cid, sortie, analyse);
    console.log(`[ProfilV] ✅ MODE_RAPIDE : ligne ${recId} créée`);
  }
  console.log(`[ProfilV] ✅ Disque : ${base}_{profilV.json, analyse.md, portrait.md}`);
  return { ok: true, candidat_id: cid, files: base, modeRapideRecId: recId, sortie };
}

if (require.main === module) run().catch(e => { console.error(e); process.exit(1); });
module.exports = { lireInstrument, lireReponses, appelerAgent, ecrire, ecrireModeRapide, run, T_MODE_RAPIDE, BASE_ID };
