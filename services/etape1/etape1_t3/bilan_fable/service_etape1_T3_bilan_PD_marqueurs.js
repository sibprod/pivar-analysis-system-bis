/**
 * ════════════════════════════════════════════════════════════════════════
 * SERVICE CH3 — CHAPITRE III « MARQUEURS AFFECTIFS ET ZONES DE COÛT »  ·  FICHIER UNIQUE
 * Profil-Cognitif Sib Prod · 16/06/2026
 *
 * UN prompt (PROMPT_CH3_MARQUEURS_v1.md) + UN service (ce fichier).
 *
 * 4 étapes :
 *   1) BUILDER déterministe — lit ETAPE1_T1 (signaux) + RESPONSES (gouvernance) + T3_PILIER
 *      (architecture). Regroupe les signaux par valence/domaine. Calcule les chiffres §06.
 *      AUCUN LLM. Chiffres §06 prouvés sur Cécile (gouverne P3=16, P5=0, P4=2 ; bascule=3).
 *   2) AGENT — entrée JSON + appel API avec le prompt CH3. Applique la règle de récurrence,
 *      nomme les registres, rédige §05 + §06 avec les deux clôtures obligatoires.
 *   3) WRITER — écrit les champs §05 + §06 + technique dans T3_BILAN.
 *   4) RUN — orchestration + garde-fous.
 *
 * USAGE :
 *   node service_ch3.js --candidat <id>            → DRY-RUN (affiche, n'écrit rien)
 *   node service_ch3.js --candidat <id> --write    → écrit §05 + §06 dans T3_BILAN
 *
 * VARIABLES D'ENV : AIRTABLE_API_KEY, ANTHROPIC_API_KEY
 * ════════════════════════════════════════════════════════════════════════
 */

const Airtable  = require('airtable');
const Anthropic = require('@anthropic-ai/sdk');
const fs   = require('fs');
const path = require('path');

const BASE_ID     = 'appgghhXjYBdFRras';
const T_T1        = 'ETAPE1_T1';            // signaux limbiques
const T_RESP      = 'tblK28GE8RWq9tQMV';    // RESPONSES (gouvernance)
const T_BILAN     = 'tblv775KQrEhsogdI';    // sortie
const T_PILIER    = 'tblzDIn7P2cOvVvY2';    // architecture
const PROMPT_PATH = path.join(__dirname, '../../../../new-prompts/etape1/bilan/prompt_etape1_T3_bilan_PD_marqueurs.md');

// field IDs ETAPE1_T1 (vérifiés en base 16/06)
const F_T1 = {
  candidat: 'fldS3DReACm4aHCos',
  question: 'fldAiJZUuV837fvjt',
  scenario: 'fldSld8Vm5Yla57My',
  pilier:   'fldZCwKuLvVMff2oT',
  signal:   'fldZA9RVR3XtKEmsI',   // "émotion · \"verbatim\""
};
// field IDs RESPONSES
const F_RESP = {
  candidat: 'fldD6c9DdWkVpZvMg',
  question: 'fldFgNVoNt5st0CXx',   // PqQn demandée
  gouverne: 'fldVepvgG6umwwG3R',   // pilier qui gouverne
};
// field IDs T3_BILAN — §05 + §06 (repérés dans le bilan étalon Cécile)
const F_BILAN = {
  candidat:        'fldk66gddYGCREOV4',
  // §05 signal
  def_signal:      'fldx4U59bOkoI7MkN',
  registres:       'fldgeeC3lg3M89ESA',
  cloture_signal:  'fld9x0yRmGnAhVFS4',
  // §06 zones de coût
  ouverture_cout:  'fldxZi0jRCWnXsVng',
  cout_principal:  'fld0nyRitbejCsihG',
  cout_secondaire: 'fld7JUPi80iqSKzzV',
  cloture_cout:    'fld1nB5UqVklCjikE',
  // technique
  technique:       'fldlkVPGScKwBpPQV',
};
// field IDs T3_PILIER (architecture)
const F_PIL = {
  candidat: 'fldZKruIBDdjAsY47',
  pilier:   'fldVvi5gbKioBmlsQ',
  role:     'fldhFisqhUf9oBLOe',
  label:    'fldbDYECHFEGkh0Ng',
  mode:     'fldoGY71vyiaUeFl6',
};

function _selName(v){ if(!v) return ''; if(typeof v==='string') return v; if(Array.isArray(v)) return v[0]?.name||''; return v.name||''; }

// ════════════════════════════════════════════════════════════════════════
// 1) BUILDER DÉTERMINISTE
// ════════════════════════════════════════════════════════════════════════

/**
 * Parse le champ signal "émotion · \"verbatim\"" → { emotion, verbatim }.
 */
function parseSignal(raw) {
  if (!raw) return null;
  const idx = raw.indexOf('·');
  if (idx === -1) return { emotion: raw.trim(), verbatim: '' };
  const emotion = raw.slice(0, idx).trim();
  let verbatim = raw.slice(idx + 1).trim();
  verbatim = verbatim.replace(/^["«»\s]+|["«»\s]+$/g, '').trim();
  return { emotion, verbatim };
}

/** Lit les signaux limbiques du candidat (ETAPE1_T1). */
async function lireSignaux(candidat_id, airtable) {
  const out = [];
  await airtable(T_T1).select({
    filterByFormula: `{candidat_id}="${candidat_id}"`,
    fields: [F_T1.candidat, F_T1.question, F_T1.scenario, F_T1.pilier, F_T1.signal],
    pageSize: 100,
  }).eachPage((records, next) => {
    for (const r of records) {
      const raw = r.get(F_T1.signal);
      if (!raw) continue;            // ligne sans signal = ignorée
      const p = parseSignal(raw);
      out.push({
        q:        _selName(r.get(F_T1.question)),
        scenario: _selName(r.get(F_T1.scenario)),
        pilier:   _selName(r.get(F_T1.pilier)),
        emotion:  p.emotion,
        verbatim: p.verbatim,
      });
    }
    next();
  });
  return out;
}

/** Lit la gouvernance (RESPONSES) : pour chaque réponse, question demandée + pilier qui gouverne. */
async function lireGouvernance(candidat_id, airtable) {
  const out = [];
  await airtable(T_RESP).select({
    filterByFormula: `{session_ID}="${candidat_id}"`,
    fields: [F_RESP.candidat, F_RESP.question, F_RESP.gouverne],
    pageSize: 100,
  }).eachPage((records, next) => {
    for (const r of records) {
      out.push({ q: _selName(r.get(F_RESP.question)), gouv: _selName(r.get(F_RESP.gouverne)) });
    }
    next();
  });
  return out;
}

/**
 * Regroupe les signaux par valence/domaine en registres-candidats.
 * Heuristique déterministe sur le libellé d'émotion ; l'agent affine et nomme.
 * - AVERSION : aversion, agacement, désagrément, exaspération, irritation, lassitude (négatif récurrent)
 * - MAITRISE : sérénité, zen, réassurance, stress contenu (maîtrise affichée / positif)
 * - EXIGENCE : "déteste", exigence sur la qualité
 * Les signaux qui ne tombent dans aucun groupe récurrent → "appui" (non généralisés).
 */
function regrouperSignaux(signaux) {
  const reg = { AVERSION: [], MAITRISE: [], EXIGENCE: [], appui: [] };
  for (const s of signaux) {
    const e = s.emotion.toLowerCase();
    const v = (s.verbatim || '').toLowerCase();
    // EXIGENCE d'abord : un « je déteste » sur la qualité d'un contenu est un registre dédié
    // (doctrine §05 : exigence sur les contenus), même si le mot "aversion" apparaît dans l'émotion.
    if (/déteste|deteste/.test(v) || /exigen|rigueur/.test(e)) {
      reg.EXIGENCE.push(s.q);
    }
    // MAITRISE / positif : sérénité, réassurance, stress CONTENU (maîtrisé)
    else if (/sérén|seren|zen|réassur|reassur|maîtrise|maitrise|confian/.test(e) || /stress (assum|conten)/.test(e)) {
      reg.MAITRISE.push(s.q);
    }
    // AVERSION : aversion/agacement/désagrément déclarés face à organiser/exécuter (registre récurrent)
    else if (/avers|agac|désagré|desagre|lassitude/.test(e)) {
      reg.AVERSION.push(s.q);
    }
    // appui NON généralisé (garde-fou de récurrence) : signaux isolés ou méta —
    // exaspération, irritation, distanciation, stress isolé. L'agent ne les érige PAS en registre.
    else {
      reg.appui.push(s.q);
    }
  }
  return reg;
}

/** Calcule les chiffres du §06 depuis la gouvernance + l'architecture. */
function calculerCout(gouvernance, roles) {
  const { socle, aval } = roles;
  const g = {};
  for (const p of ['P1','P2','P3','P4','P5']) g[p] = gouvernance.filter(r => r.gouv === p).length;

  // pilier faible = pilier non-socle/non-amont/non-aval qui gouverne le moins, hors 0 structurel
  // pour le coût secondaire on suit la doctrine : pilier de création (P4) si présent
  const creationCode = 'P4';
  const questionsCreation = gouvernance.filter(r => r.q.startsWith(creationCode + 'Q'));
  const basculeVersSocle = questionsCreation.filter(r => r.gouv === socle).map(r => r.q);

  return {
    gouvernance: g,
    gouverne_socle: g[socle],
    gouverne_aval: g[aval],
    pilier_faible_code: creationCode,
    pilier_faible_gouverne: g[creationCode],
    questions_creation: questionsCreation.length,
    bascule_creation_vers_socle: basculeVersSocle.length,
    bascule_q: basculeVersSocle,
  };
}

// ════════════════════════════════════════════════════════════════════════
// 2) AGENT (entrée + appel API)
// ════════════════════════════════════════════════════════════════════════

function construireEntreeAgent(candidat_id, arch, signaux, registres, cout) {
  const libelles = {};
  for (const code of ['P1','P2','P3','P4','P5']) libelles[code] = arch.piliers[code]?.label || code;
  const modes = {};
  for (const code of Object.keys(arch.piliers)) modes[code] = arch.piliers[code].mode;

  return {
    candidat_id,
    piliers_libelles: libelles,
    roles: arch.roles,
    modes_valides: modes,
    signaux,
    registres_candidats: registres,
    gouvernance: cout.gouvernance,
    cout_chiffres: {
      gouverne_socle: cout.gouverne_socle,
      gouverne_aval: cout.gouverne_aval,
      pilier_faible_code: cout.pilier_faible_code,
      pilier_faible_gouverne: cout.pilier_faible_gouverne,
      bascule_creation_vers_socle: cout.bascule_creation_vers_socle,
      questions_creation: cout.questions_creation,
    },
    consigne_recurrence: "registres_candidats.appui = signaux isolés NON généralisés : ne PAS les ériger en registre (garde-fou de récurrence). Un registre = signaux récurrents multi-situations.",
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
// 3) WRITER (écriture T3_BILAN)
// ════════════════════════════════════════════════════════════════════════

/** Formate les registres §05 en un bloc texte (format étalon Cécile). */
function formaterRegistres(registres) {
  // registres = [{ titre, phrase, verbatims }]
  return registres.map(r => `${r.titre}\n${r.phrase}\n${r.verbatims}`).join('\n\n');
}

/** Formate un bloc coût §06 (titre + TEXTE + VERBATIMS), format étalon. */
function formaterCout(bloc, niveau) {
  const lignes = [];
  lignes.push(niveau);              // "Coût principal" / "Coût secondaire"
  lignes.push(bloc.titre);
  lignes.push('TEXTE :');
  lignes.push(bloc.texte);
  if (bloc.verbatims) { lignes.push('VERBATIMS :'); lignes.push(bloc.verbatims); }
  return lignes.join('\n');
}

async function ecrireCh3(sortie, bilan_rec_id, airtable) {
  const s = sortie.signal, c = sortie.cout;
  if (!s || !c) throw new Error('Sortie agent incomplète (signal/cout manquant)');
  const fields = {
    [F_BILAN.def_signal]:      s.def_signal,
    [F_BILAN.registres]:       formaterRegistres(s.registres || []),
    [F_BILAN.cloture_signal]:  s.cloture_signal,
    [F_BILAN.ouverture_cout]:  c.ouverture_cout,
    [F_BILAN.cout_principal]:  formaterCout(c.cout_principal, 'Coût principal'),
    [F_BILAN.cout_secondaire]: formaterCout(c.cout_secondaire, 'Coût secondaire'),
    [F_BILAN.cloture_cout]:    c.cloture_cout,
    [F_BILAN.technique]:       sortie.technique || '',
  };
  await airtable(T_BILAN).update(bilan_rec_id, fields);
  return bilan_rec_id;
}

// ════════════════════════════════════════════════════════════════════════
// 4) RUN (orchestration + garde-fous)
// ════════════════════════════════════════════════════════════════════════

async function lireArchitecture(candidat_id, airtable) {
  const piliers = {};
  let socle=null, amont=null, aval=null;
  await airtable(T_PILIER).select({
    filterByFormula: `{${F_PIL.candidat}}="${candidat_id}"`,
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
      filterByFormula: `{${F_BILAN.candidat}}="${candidat_id}"`, maxRecords: 1, fields: [F_BILAN.candidat],
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
  if (!arch.roles.socle) { console.error('ERREUR : socle introuvable (pilier_role). Vérifier T3_PILIER.'); process.exit(1); }
  console.log(`Architecture : socle=${arch.roles.socle} · amont=${arch.roles.amont} · aval=${arch.roles.aval}`);

  // 2) Builder
  const signaux = await lireSignaux(candidat_id, airtable);
  if (signaux.length === 0) { console.error('ARRÊT : aucun signal limbique trouvé (ETAPE1_T1).'); process.exit(1); }
  const gouvernance = await lireGouvernance(candidat_id, airtable);
  const registres = regrouperSignaux(signaux);
  const cout = calculerCout(gouvernance, arch.roles);
  console.log(`Signaux détectés : ${signaux.length} · registres : AVERSION ${registres.AVERSION.length} / MAITRISE ${registres.MAITRISE.length} / EXIGENCE ${registres.EXIGENCE.length} / appui ${registres.appui.length}`);
  console.log(`§06 : gouverne socle ${cout.gouverne_socle}, aval ${cout.gouverne_aval}, ${cout.pilier_faible_code} ${cout.pilier_faible_gouverne}, bascule création→socle ${cout.bascule_creation_vers_socle}/${cout.questions_creation}`);

  // 3) Agent
  const entree = construireEntreeAgent(candidat_id, arch, signaux, registres, cout);
  const sortie = await appelerAgent(entree);

  // 4) Écriture / dry-run
  if (doWrite) {
    const bilan = await _findBilan(candidat_id, airtable);
    if (!bilan) { console.error('ERREUR : record T3_BILAN introuvable'); process.exit(1); }
    await ecrireCh3(sortie, bilan.id, airtable);
    console.log(`\n✅ Chapitre III (§05 + §06) écrit dans T3_BILAN ${bilan.id}`);
  } else {
    console.log('\n── DRY-RUN (pas d\'écriture). JSON agent : ──');
    console.log(JSON.stringify(sortie, null, 2));
    console.log('\n── Builder (audit) : ──');
    console.log(JSON.stringify({ signaux, registres, cout }, null, 2));
  }
}

if (require.main === module) run().catch(e => { console.error(e); process.exit(1); });

module.exports = {
  parseSignal, lireSignaux, lireGouvernance, regrouperSignaux, calculerCout,
  construireEntreeAgent, appelerAgent,
  formaterRegistres, formaterCout, ecrireCh3,
  lireArchitecture, run,
  F_T1, F_RESP, F_BILAN, F_PIL, BASE_ID,
};
