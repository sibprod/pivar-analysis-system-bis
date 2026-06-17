/**
 * ════════════════════════════════════════════════════════════════════════
 * SERVICE CH4 — CHAPITRE IV §02 « LE FILTRE COGNITIF »  ·  FICHIER UNIQUE
 * Profil-Cognitif Sib Prod · 16/06/2026
 *
 * UN prompt (PROMPT_CH4_FILTRE_v1.md) + UN service (ce fichier).
 *
 * 4 étapes :
 *   1) BUILDER déterministe — lit l'inventaire (gestes HAUT du socle, échelle CŒUR, en_svc),
 *      RESPONSES (gouvernance → glissements), T3_PILIER (architecture + mode socle).
 *      Fait T2 (tri par fréquence) + T3 (transversalité). AUCUN LLM.
 *      Prouvé sur Cécile : gestes HAUT P3 = C12(17) C10(11) C4(6) dans cet ordre.
 *   2) AGENT — fait T1 (traduire geste→axe) + T4 (verbaliser ≤15 mots) + 5 preuves.
 *   3) WRITER — écrit filtre (permanence) + paragraphe + preuves + schéma + nature dans T3_BILAN.
 *   4) RUN — orchestration + garde-fous.
 *
 * USAGE :
 *   node service_ch4.js --candidat <id>            → DRY-RUN
 *   node service_ch4.js --candidat <id> --write    → écrit §02 dans T3_BILAN
 *
 * VARIABLES D'ENV : AIRTABLE_API_KEY, ANTHROPIC_API_KEY
 * ════════════════════════════════════════════════════════════════════════
 */

const Airtable  = require('airtable');
const Anthropic = require('@anthropic-ai/sdk');
const fs   = require('fs');
const path = require('path');

const BASE_ID     = 'appgghhXjYBdFRras';
const T_INV       = 'tblUHZjXIW9jp9nIf';    // ETAPE1_T2_INVENTAIRE_CIRCUITS (source figée)
const T_RESP      = 'tblK28GE8RWq9tQMV';    // RESPONSES (gouvernance → glissements)
const T_BILAN     = 'tblv775KQrEhsogdI';
const T_PILIER    = 'tblzDIn7P2cOvVvY2';
const PROMPT_PATH = path.join(__dirname, 'PROMPT_CH4_FILTRE_v1.md');

const SEUIL_HAUT = 4;   // échelle CŒUR : HAUT >=4, MOYEN 2-3, FAIBLE 1

// field IDs INVENTAIRE (décodés en base 16/06)
const F_INV = {
  candidat:  'fldBdSBJUBvLHYPdo',
  code:      'fldjbr1Ej7Dosb6S6',   // "P3C12" / "P5·ADHOC ..."
  pilier:    'fldSudlYoCeU2cOqz',
  nb_coeur:  'fld8nEBQqdLqQqe1b',   // CŒUR (vérifié : C12=17, C10=11, C4=6)
  total:     'fldzV8udGk3eQ58No',
  // en_svc par pilier (débordements) — colonnes par pilier instrumental
  svc_P1:    'fldGyYvWzGiY9jlXb',
  svc_P2:    'fldUFMnbQl8NJAwgl',
  svc_P4:    'fldgAjStrMoLleMbA',
  svc_P5:    'fldQbwuHBRywn2rzp',
  // NB : svc_P3 (fldQbwuHBRywn2rzp) RÉPUTÉ CORROMPU dans la mémoire projet → on ne s'en sert pas
  //      pour le socle ; ici on lit les en_svc des AUTRES piliers, ce qui est l'usage voulu.
};
// field IDs RESPONSES
const F_RESP = {
  candidat: 'fldD6c9DdWkVpZvMg',
  question: 'fldFgNVoNt5st0CXx',
  gouverne: 'fldVepvgG6umwwG3R',
};
// field IDs T3_BILAN §02 (repérés dans l'étalon Cécile)
const F_BILAN = {
  candidat:          'fldk66gddYGCREOV4',
  filtre:            'fld9vAKpKEMIcRiTB',   // PERMANENCE (rendu en 4 lieux)
  filtre_paragraphe: 'fldqDeT7EDov18iTz',
  preuves:           'fldXGZ5ijlcGPYc16',
  schema_questions:  'fld1p9p9Csvyllvcm',
  nature_grille:     'fldKeQsg0PvyQTOWx',
};
// field IDs T3_PILIER
const F_PIL = {
  candidat: 'fldZKruIBDdjAsY47',
  pilier:   'fldVvi5gbKioBmlsQ',
  role:     'fldhFisqhUf9oBLOe',
  label:    'fldbDYECHFEGkh0Ng',
  mode:     'fldoGY71vyiaUeFl6',
};

function _selName(v){ if(!v) return ''; if(typeof v==='string') return v; if(Array.isArray(v)) return v[0]?.name||''; return v.name||''; }
function _num(v){ return typeof v === 'number' ? v : 0; }
/** "P3C12" → {pilier:"P3", c:"C12"} ; ignore les ADHOC (pas de geste officiel chiffré pour le filtre). */
function _parseCode(code){ const m = (code||'').match(/^(P[1-5])(C\d{1,2})$/); return m ? { pilier:m[1], c:m[2] } : null; }

// ════════════════════════════════════════════════════════════════════════
// 1) BUILDER DÉTERMINISTE
// ════════════════════════════════════════════════════════════════════════

/** Lit l'inventaire du candidat (circuits officiels uniquement). */
async function lireInventaire(candidat_id, airtable) {
  const out = [];
  await airtable(T_INV).select({
    filterByFormula: `{candidat_id}="${candidat_id}"`,
    fields: Object.values(F_INV),
    pageSize: 200,
  }).eachPage((records, next) => {
    for (const r of records) {
      const codeRaw = r.get(F_INV.code) || '';
      const parsed = _parseCode(codeRaw);
      if (!parsed) continue;   // ADHOC ou format inattendu : exclu du filtre
      out.push({
        code: codeRaw, pilier: parsed.pilier, c: parsed.c,
        coeur: _num(r.get(F_INV.nb_coeur)),
        total: _num(r.get(F_INV.total)),
        en_svc: { P1:_num(r.get(F_INV.svc_P1)), P2:_num(r.get(F_INV.svc_P2)),
                  P4:_num(r.get(F_INV.svc_P4)), P5:_num(r.get(F_INV.svc_P5)) },
      });
    }
    next();
  });
  return out;
}

/** Lit la gouvernance et calcule les glissements (question demandée vs pilier qui gouverne). */
async function lireGlissements(candidat_id, socle, airtable) {
  const resp = [];
  await airtable(T_RESP).select({
    filterByFormula: `{session_ID}="${candidat_id}"`,
    fields: [F_RESP.candidat, F_RESP.question, F_RESP.gouverne],
    pageSize: 100,
  }).eachPage((records, next) => {
    for (const r of records) {
      resp.push({ q: _selName(r.get(F_RESP.question)), gouv: _selName(r.get(F_RESP.gouverne)) });
    }
    next();
  });
  // un glissement = la question vise un pilier mais une autre gouverne
  const glissements = resp.filter(r => r.q.slice(0,2) !== r.gouv);
  const versSocle = glissements.filter(r => r.gouv === socle);
  const parOrigine = {};
  for (const g of versSocle) { const o = g.q.slice(0,2); parOrigine[o] = (parOrigine[o]||0)+1; }
  // glissement sortant du socle (question P<socle> gouvernée ailleurs)
  const sortant = glissements.find(r => r.q.slice(0,2) === socle && r.gouv !== socle);
  return {
    total: glissements.length,
    vers_socle: versSocle.length,
    par_origine: parOrigine,
    sortant: sortant ? { de: socle, vers: sortant.gouv, ref: sortant.q } : null,
    gouverne_socle: resp.filter(r => r.gouv === socle).length,
    total_reponses: resp.length,
  };
}

/** Dérive les gestes HAUT du socle, triés par cœur décroissant (T2), avec transversalité (T3). */
function deriverGestesHaut(inventaire, socle) {
  const gestesSocle = inventaire.filter(x => x.pilier === socle && x.coeur >= SEUIL_HAUT);
  gestesSocle.sort((a,b) => b.coeur - a.coeur);   // T2 : ordre décroissant
  return gestesSocle.map(g => {
    // T3a : débordement en service d'AUTRES piliers (en_svc > 0, hors socle)
    const en_svc = {};
    for (const p of ['P1','P2','P4','P5']) if (p !== socle && g.en_svc[p] > 0) en_svc[p] = g.en_svc[p];
    const deborde = Object.values(en_svc).reduce((a,b)=>a+b,0);
    return { code: g.code, c: g.c, coeur: g.coeur, total: g.total, en_svc, deborde };
  });
}

// ════════════════════════════════════════════════════════════════════════
// 2) AGENT
// ════════════════════════════════════════════════════════════════════════

function construireEntreeAgent(candidat_id, arch, gestesHaut, glissements, opts) {
  const libelles = {};
  for (const code of ['P1','P2','P3','P4','P5']) libelles[code] = arch.piliers[code]?.label || code;
  return {
    candidat_id,
    piliers_libelles: libelles,
    roles: arch.roles,
    mode_socle: arch.piliers[arch.roles.socle]?.mode || '',
    gestes_haut: gestesHaut.map(g => ({
      code: g.code, coeur: g.coeur,
      transversalite: { en_svc: g.en_svc, deborde: g.deborde },
    })),
    volume: { gouverne_socle: glissements.gouverne_socle, total: glissements.total_reponses,
              pct: Math.round(100 * glissements.gouverne_socle / glissements.total_reponses) },
    glissements: { total: glissements.total, vers_socle: glissements.vers_socle,
                   par_origine: glissements.par_origine, sortant: glissements.sortant },
    tempo_verbatim: opts.tempo || null,
    glose_candidat: opts.glose || null,
    note: "gestes_haut DÉJÀ triés par cœur décroissant (T2 fait). Traduis chaque geste en axe (T1), verbalise ≤15 mots (T4). Les noms de circuits ne sont pas fournis ici : déduis l'axe du libellé officiel que tu connais pour ce code, ou demande qu'il soit ajouté à l'entrée.",
  };
}

async function appelerAgent(entree) {
  const prompt = fs.readFileSync(PROMPT_PATH, 'utf-8');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const msg = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 4000,
    system: prompt,
    messages: [{ role: 'user', content: JSON.stringify(entree, null, 2) }],
  });
  const text = msg.content.filter(b => b.type === 'text').map(b => b.text).join('\n');
  const clean = text.replace(/```json|```/g, '').trim();
  try { return JSON.parse(clean); }
  catch (e) { throw new Error('Sortie agent non-JSON : ' + clean.slice(0, 500)); }
}

// ════════════════════════════════════════════════════════════════════════
// 3) WRITER
// ════════════════════════════════════════════════════════════════════════

async function ecrireCh4(sortie, bilan_rec_id, airtable) {
  if (!sortie.filtre) throw new Error('Sortie agent : champ "filtre" manquant');
  // garde-fou ≤15 mots
  const nbMots = sortie.filtre.trim().split(/\s+/).length;
  if (nbMots > 15) throw new Error(`Filtre = ${nbMots} mots (max 15) : "${sortie.filtre}"`);
  const fields = {
    [F_BILAN.filtre]:            sortie.filtre,             // PERMANENCE
    [F_BILAN.filtre_paragraphe]: sortie.filtre_paragraphe,
    [F_BILAN.preuves]:           sortie.preuves,
    [F_BILAN.schema_questions]:  sortie.schema_questions,
    [F_BILAN.nature_grille]:     sortie.nature_grille,
  };
  await airtable(T_BILAN).update(bilan_rec_id, fields);
  return bilan_rec_id;
}

// ════════════════════════════════════════════════════════════════════════
// 4) RUN
// ════════════════════════════════════════════════════════════════════════

async function lireArchitecture(candidat_id, airtable) {
  const piliers = {};
  let socle=null, amont=null, aval=null;
  await airtable(T_PILIER).select({
    filterByFormula: `{candidat_id}="${candidat_id}"`,
    fields: [F_PIL.pilier, F_PIL.role, F_PIL.label, F_PIL.mode],
    pageSize: 20,
  }).eachPage((records, next) => {
    for (const r of records) {
      const code = _selName(r.get(F_PIL.pilier));
      const role = _selName(r.get(F_PIL.role));
      piliers[code] = { code, role, label: _selName(r.get(F_PIL.label)), mode: r.get(F_PIL.mode) || '' };
      if (role === 'socle') socle = code;
      if (role === 'amont') amont = code;
      if (role === 'aval')  aval  = code;
    }
    next();
  });
  return { piliers, roles: { socle, amont, aval } };
}

async function _findBilan(candidat_id, airtable) {
  return new Promise((resolve, reject) => {
    airtable(T_BILAN).select({
      filterByFormula: `{candidat_id}="${candidat_id}"`, maxRecords: 1, fields: [F_BILAN.candidat],
    }).firstPage((err, recs) => err ? reject(err) : resolve(recs && recs[0] ? recs[0] : null));
  });
}
function _arg(args, name){ const i = args.indexOf(name); return i>=0 && args[i+1] ? args[i+1] : null; }

async function run() {
  const args = process.argv.slice(2);
  const candidat_id = _arg(args, '--candidat');
  const doWrite = args.includes('--write');
  if (!candidat_id) { console.error('ERREUR : --candidat <id> obligatoire'); process.exit(1); }

  const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(BASE_ID);

  // 1) Architecture
  const arch = await lireArchitecture(candidat_id, airtable);
  const socle = arch.roles.socle;
  if (!socle) { console.error('ERREUR : socle introuvable (T3_PILIER.pilier_role).'); process.exit(1); }
  console.log(`Socle = ${socle} (${arch.piliers[socle]?.label})`);

  // 2) Builder
  const inventaire = await lireInventaire(candidat_id, airtable);
  const gestesHaut = deriverGestesHaut(inventaire, socle);
  if (gestesHaut.length === 0) { console.error('ARRÊT : aucun geste HAUT du socle (cœur>=4).'); process.exit(1); }
  const glissements = await lireGlissements(candidat_id, socle, airtable);

  console.log('Gestes HAUT du socle (T2, cœur décroissant) :');
  for (const g of gestesHaut) console.log(`  ${g.code} · cœur ${g.coeur} · déborde ${g.deborde} ${JSON.stringify(g.en_svc)}`);
  console.log(`Volume : socle gouverne ${glissements.gouverne_socle}/${glissements.total_reponses} · glissements ${glissements.total} (vers socle ${glissements.vers_socle})`);

  // garde-fou : transversalité (au moins les 2 premiers axes doivent déborder ou la doctrine T3b)
  const sansTransversalite = gestesHaut.filter(g => g.deborde === 0);
  if (sansTransversalite.length) {
    console.warn(`⚠️  Gestes HAUT sans débordement en_svc (T3a) : ${sansTransversalite.map(g=>g.code).join(', ')} — l'agent doit vérifier la route T3b (présence sur questions d'autres piliers) avant de les retenir comme axes.`);
  }

  // tempo + glose : connus pour Cécile ; à fournir par options sinon (test miroir ultérieur)
  const opts = {
    tempo: socle === 'P3' && candidat_id.startsWith('pcc_')
      ? { texte: 'je ne tergiverse pas 100 ans', ref: 'P3Q6 Panne' } : null,
    glose: null,   // recueillie au test miroir, ajoutée manuellement quand disponible
  };

  // 3) Agent
  const entree = construireEntreeAgent(candidat_id, arch, gestesHaut, glissements, opts);
  const sortie = await appelerAgent(entree);

  // 4) Écriture / dry-run
  if (doWrite) {
    const bilan = await _findBilan(candidat_id, airtable);
    if (!bilan) { console.error('ERREUR : record T3_BILAN introuvable'); process.exit(1); }
    await ecrireCh4(sortie, bilan.id, airtable);
    console.log(`\n✅ Filtre + §02 écrits dans T3_BILAN ${bilan.id}`);
    console.log(`   Filtre : « ${sortie.filtre} »`);
  } else {
    console.log('\n── DRY-RUN. JSON agent : ──');
    console.log(JSON.stringify(sortie, null, 2));
    console.log('\n── Builder (audit) : ──');
    console.log(JSON.stringify({ gestesHaut, glissements }, null, 2));
  }
}

if (require.main === module) run().catch(e => { console.error(e); process.exit(1); });

module.exports = {
  _parseCode, lireInventaire, lireGlissements, deriverGestesHaut,
  construireEntreeAgent, appelerAgent, ecrireCh4, lireArchitecture, run,
  F_INV, F_RESP, F_BILAN, F_PIL, SEUIL_HAUT, BASE_ID,
};
