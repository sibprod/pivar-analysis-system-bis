/**
 * SERVICE P-A — Génération rédactionnelle des 5 piliers
 * Profil-Cognitif Sib Prod · 2026-06-16
 *
 * UN seul fichier. Lit Airtable → appelle Claude P-A v8 → valide → écrit.
 *
 * USAGE :
 *   node service_pa.js <candidat_id> <prenom> [options]
 *
 * OPTIONS :
 *   --piliers P3,P1   Traiter seulement ces piliers
 *   --dry-run         Affiche les entrées sans écrire
 *   --write-mode      Écrit aussi pilier_mode (après validation manuelle)
 *   --strict          Bloque l'écriture si validation échoue
 *
 * ENV :
 *   AIRTABLE_API_KEY
 *   ANTHROPIC_API_KEY
 */

'use strict';
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const Airtable  = require('airtable');
const PROMPT    = require('./prompt_pa_v8');

// ═══════════════════════════════════════════════════════════════
// SECTION 1 — CONFIGURATION
// ═══════════════════════════════════════════════════════════════

const BASE_ID = 'appgghhXjYBdFRras';

const T = {
  T3_PILIER:    'tblzDIn7P2cOvVvY2',
  T3_CIRCUIT:   'tblLAC4dS25v6IUbs',
  T2_VERBATIMS: 'tblaGd3ixAWxbJJp2',
  REF_PILIERS:  'tblf4OodQ2Qi5xSXs',
  REF_CIRCUITS: 'tbllMoTjOsILuzR6m',
  REF_PROFILS:  'tblLTxeKoRa9m8io7',
};

// T3_PILIER field IDs
const FP = {
  candidat_id:    'fldZKruIBDdjAsY47',
  pilier:         'fldVvi5gbKioBmlsQ',
  pilier_label:   'fldbDYECHFEGkh0Ng',
  pilier_role:    'fldhFisqhUf9oBLOe',
  pilier_mode:    'fldoGY71vyiaUeFl6',
  nb_activations: 'fldg5DCdL9U523YfG',
  nb_actifs:      'fldtUV0KYT0zyjg0J',
  nb_haut:        'fldUmfMvtMEsADKFX',
  synth_coeur:    'fldCM0X6TsHYLQ0YD',
  synth_elargi:   'fldKkGWMbDy4csrOg',
  // Champs rédactionnels écrits par P-A
  haut_candidat:     'fldBLvofzosLTPUOr',
  haut_technique:    'flds6XOIwvYr20iRY',
  haut_rattach:      'fldB9fRf8U61z4WZK',
  moyen_candidat:    'flda16lg5Dt1HrXrF',
  moyen_technique:   'fld7Sv7LXlZ6XPghN',
  moyen_rattach:     'fldMA46pZRI6Bi0ZU',
  faible_candidat:   'fld68H41z6b9XtFoZ',
  faible_technique:  'fld6BWLEjDMdbYTs6',
  faible_rattach:    'fldZiSdH20uMb5wCY',
  synth_interpretee: 'fldho6MPGr5J5QmPu',
  mode_explication:  'fld6GtEBRP5UxvHeI',
  ch4_intro:         'fldomziXNOGf7Ujsb',
};

// T3_CIRCUIT field IDs
const FC = {
  candidat_id:   'fldpQzPEvlNaRXFgg',
  pilier:        'fld74EvZRf7r4biGh',
  circuit_id:    'fldrnHJtNOWWYJ91t',
  circuit_nom:   'fldSGRXf8mi4q1NTd',
  circuit_freq:  'fldrM33rxdYnJ39vz',
  circuit_niveau:'fld0LTPI1KfAVHRqI',
  ordre:         'fld5SPJJXdv9Bo6vT',
  en_svc_P1:     'fldoGZPSxM22pk82R',
  en_svc_P2:     'fldAgQzO8YgqbzUEe',
  en_svc_P3:     'fld56OTFNSTo7OGAE',
  en_svc_P4:     'fldJ76jeasA2KVmdY',
  en_svc_P5:     'fldqMhYYHMy7b2s1n',
  total:         'fldnFNJm6GP0mAGNm',
  // Champs rédactionnels écrits par P-A
  n3_nuance:     'fldSx0VOHYILowFSj',
  expl_courte:   'fld3zZ8SteMWedetW',
  renfort:       'fldixMQDcsD7cCyd3',
  soleil_vb:     'fldLP9juCWCTlCZPt',
  soleil_ref:    'fldI1DVJiH7EH4zel',
  vb2:           'fldSCQD9zvgRQcuq9',
  vb2_ref:       'fldmVPwfku0vUz6xX',
  vb3:           'fldhIp3aW72WR2V1t',
  vb3_ref:       'fldcQ7hxyRumcc1DO',
  vb4:           'fld4lrLWySRXVmvZe',
  vb4_ref:       'fldQgruSXveuTCLM4',  // ⚠️ g pas b
};

// T2_VERBATIMS field IDs
const FT2 = {
  candidat_id:   'fldbHyiLdkkRU6B0J',
  pilier:        'fldkByLh883MLtHB3',
  circuit_id:    'fldf3Rfux16asTI0I',
  detail:        'fldHd6KNM11jQTcts',
  signal:        'fldWlSKIGYrtvEBCT',
  signal_expl:   'fldnDxnEc3uLoAknN',
};

// REF field IDs
const FREF = {
  pilier_code: 'fldgf7XGb55eTroKn',
  pilier_nom:  'fldI2u7FxkWhdGoot',
  circ_pilier: 'fldYUFKjWvPZWGXva',
  circ_code:   'fldLrUbZhzYvYYf1I',
  circ_nom:    'fldaRcdCErwKZfLft',
  circ_geste:  'fldS4sVj4FxFofcqJ',
  prof_pilier: 'fldmr0XA22Q4OiRbG',
  prof_label:  'fldqXSmhxJXSPJzId',
};

const PILIERS_ORDRE = ['P4', 'P5', 'P1', 'P2', 'P3'];

// ═══════════════════════════════════════════════════════════════
// SECTION 2 — LECTURE AIRTABLE
// ═══════════════════════════════════════════════════════════════

function base() {
  if (!process.env.AIRTABLE_API_KEY) throw new Error('AIRTABLE_API_KEY manquante');
  return new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(BASE_ID);
}

async function selectAll(tableId, opts = {}) {
  return new Promise((resolve, reject) => {
    const recs = [];
    base()(tableId).select({ ...opts, returnFieldsByFieldId: true })
      .eachPage((page, next) => { recs.push(...page); next(); },
                (err) => { if (err) reject(err); else resolve(recs); });
  });
}

function fv(rec, fId) { return rec.fields[fId] ?? null; }
function fname(obj) { return typeof obj === 'object' ? obj?.name : obj; }

async function lireRefPiliers() {
  const recs = await selectAll(T.REF_PILIERS, { fields: [FREF.pilier_code, FREF.pilier_nom] });
  const map = {};
  for (const r of recs) map[fv(r, FREF.pilier_code)] = fv(r, FREF.pilier_nom);
  return map; // { P1: "Collecte d'information", ... }
}

async function lireRefCircuits() {
  const recs = await selectAll(T.REF_CIRCUITS, {
    fields: [FREF.circ_pilier, FREF.circ_code, FREF.circ_nom, FREF.circ_geste]
  });
  const map = {};
  for (const r of recs) {
    const p = fv(r, FREF.circ_pilier);
    const c = fname(fv(r, FREF.circ_code));
    if (p && c) map[`${p}${c}`] = { nom: fv(r, FREF.circ_nom) || '', geste: fv(r, FREF.circ_geste) || '' };
  }
  return map; // { P3C12: {nom, geste}, ... }
}

async function lireRefProfils() {
  const recs = await selectAll(T.REF_PROFILS, { fields: [FREF.prof_pilier, FREF.prof_label] });
  const map = {};
  for (const r of recs) {
    const p = fname(fv(r, FREF.prof_pilier));
    const l = fv(r, FREF.prof_label);
    if (p && l) { if (!map[p]) map[p] = []; map[p].push(l); }
  }
  return map; // { P3: ["Critérié et tranché", ...], ... }
}

async function lirePilier(candidat_id, pilier_code) {
  const recs = await selectAll(T.T3_PILIER, {
    filterByFormula: `AND({${FP.candidat_id}} = "${candidat_id}", {${FP.pilier}} = "${pilier_code}")`,
    fields: Object.values(FP),
  });
  if (!recs.length) throw new Error(`T3_PILIER ${pilier_code} introuvable pour ${candidat_id}`);
  const r = recs[0];
  return {
    rec_id:       r.id,
    pilier_role:  fname(fv(r, FP.pilier_role)) || 'fonctionnel',
    pilier_mode:  fv(r, FP.pilier_mode) || '',
    synth_coeur:  fv(r, FP.synth_coeur) || '',
    synth_elargi: fv(r, FP.synth_elargi) || '',
  };
}

async function lireCircuits(candidat_id, pilier_code) {
  const recs = await selectAll(T.T3_CIRCUIT, {
    filterByFormula: `AND({${FC.candidat_id}} = "${candidat_id}", {${FC.pilier}} = "${pilier_code}")`,
    sort: [{ field: FC.ordre, direction: 'asc' }],
    fields: Object.values(FC),
  });
  return recs.map(r => {
    const cid = fv(r, FC.circuit_id);
    return {
      rec_id: r.id,
      code: `${pilier_code}${cid}`,
      circuit_id: cid,
      circuit_nom: fv(r, FC.circuit_nom) || '',
      niveau: fname(fv(r, FC.circuit_niveau)) || 'FAIBLE',
      coeur: fv(r, FC.circuit_freq) || 0,
      total: fv(r, FC.total) || 0,
      en_svc: {
        P1: fv(r, FC.en_svc_P1) || 0,
        P2: fv(r, FC.en_svc_P2) || 0,
        P3: fv(r, FC.en_svc_P3) || 0,
        P4: fv(r, FC.en_svc_P4) || 0,
        P5: fv(r, FC.en_svc_P5) || 0,
      },
    };
  });
}

async function lireVerbatims(candidat_id, pilier_code) {
  const recs = await selectAll(T.T2_VERBATIMS, {
    filterByFormula: `AND({${FT2.candidat_id}} = "${candidat_id}", {${FT2.pilier}} = "${pilier_code}")`,
    fields: [FT2.circuit_id, FT2.detail, FT2.signal, FT2.signal_expl],
  });
  const map = {};
  for (const r of recs) {
    const cid = fv(r, FT2.circuit_id);
    if (!cid) continue;
    const signal_obj = fv(r, FT2.signal);
    const signal = fname(signal_obj);
    map[cid] = {
      verbatims: parseVerbatims(fv(r, FT2.detail) || ''),
      signal: signal === 'NULLE' ? null : signal,
      signal_expl: fv(r, FT2.signal_expl) || 'Aucun signal limbique détecté.',
    };
  }
  return map;
}

function parseVerbatims(raw) {
  const result = [];
  const blocks = raw.split(/\n\n+/);
  for (const block of blocks) {
    const h = block.match(/\*\*(P\d+Q\d+)\s+([A-Z_0-9\-]+)\*\*/i);
    const v = block.match(/^>\s*["«](.+?)["»]?\s*$/m);
    if (h && v) result.push({ qid: h[1], lieu: h[2].charAt(0).toUpperCase() + h[2].slice(1).toLowerCase(), texte: v[1].trim() });
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3 — CONSTRUCTION ENTRÉE P-A
// ═══════════════════════════════════════════════════════════════

function construireEntree(pilierData, circuits, verbatimsMap, refCircuits, refPiliers, refProfils, pilier_code, prenom) {
  const has_coeur = circuits.some(c => c.coeur > 0);
  const signal_global = Object.values(verbatimsMap)
    .filter(v => v.signal).map(v => v.signal_expl).find(Boolean) || 'Aucun signal limbique détecté.';

  const sous_totaux = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
  for (const c of circuits) for (const [px, val] of Object.entries(c.en_svc)) sous_totaux[px] += val;

  const circuits_input = circuits.map(c => {
    const t2 = verbatimsMap[c.circuit_id] || { verbatims: [] };
    const ref = refCircuits[c.code] || { nom: c.circuit_nom, geste: '' };
    const niveau = normaliserNiveau(c.niveau, c.coeur, c.total, has_coeur ? 'coeur' : 'total');
    const sortants = {};
    for (const [px, val] of Object.entries(c.en_svc)) if (val > 0) sortants[px] = val;
    return {
      code: c.code,
      nom: ref.nom || c.circuit_nom,
      coeur: c.coeur,
      total: c.total,
      niveau,
      adhoc: false,
      sortants,
      verbatims: t2.verbatims,
    };
  });

  return {
    candidat_prenom: prenom,
    pilier_code,
    pilier_nom: refPiliers[pilier_code] || '',
    pilier_role: normaliserRole(pilierData.pilier_role),
    pilier_mode: pilierData.pilier_mode || '',
    profils_types: refProfils[pilier_code] || [],
    echelle_classement: has_coeur ? 'coeur' : 'total',
    signal_limbique: signal_global,
    sous_totaux_instrumentaux: sous_totaux,
    synth_factuelle_coeur: pilierData.synth_coeur || null,
    synth_factuelle_elargie: pilierData.synth_elargi || null,
    circuits: circuits_input,
  };
}

function normaliserNiveau(niveau, coeur, total, echelle) {
  if (echelle === 'total') {
    if (total >= 5) return 'HAUT';
    if (total >= 2) return 'MOYEN';
    return 'FAIBLE';
  }
  const n = (niveau || '').toUpperCase().replace(/\s/g, '_');
  if (n.includes('SOUTIEN')) return 'EN_SOUTIEN';
  if (n === 'HAUT') return 'HAUT';
  if (n === 'MOYEN') return 'MOYEN';
  if (n === 'FAIBLE') return 'FAIBLE';
  if (coeur >= 4) return 'HAUT';
  if (coeur >= 2) return 'MOYEN';
  if (coeur === 1) return 'FAIBLE';
  return 'EN_SOUTIEN';
}

function normaliserRole(role) {
  const r = (role || '').toLowerCase();
  if (r === 'socle') return 'socle';
  if (['str1','str2','amont'].includes(r)) return 'amont';
  if (['fn1','fn2','fonctionnel'].includes(r)) return 'fonctionnel';
  if (['aval'].includes(r)) return 'aval';
  return 'fonctionnel';
}

// ═══════════════════════════════════════════════════════════════
// SECTION 4 — APPEL CLAUDE API
// ═══════════════════════════════════════════════════════════════

async function appellerClaude(entree_json, opts = {}) {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error('ANTHROPIC_API_KEY manquante');
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const response = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: opts.max_tokens || 8000,
    system:     PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(entree_json, null, 2) }],
  });

  const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();

  try { return JSON.parse(cleaned); }
  catch (err) {
    console.error('❌ Parse JSON P-A raté. Début :', raw.slice(0, 300));
    throw new Error(`Parse JSON: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 5 — VALIDATION SORTIE
// ═══════════════════════════════════════════════════════════════

const MOTS_INTERDITS = ['impressionnant','impressionnante','remarquable','performant','performante',
  'précieux','précieuse','anticiper','prévoir','à mobiliser sur','cluster'];

function valider(pa_output, entree_json) {
  const errors = [], warnings = [];

  // Circuits attendus présents ?
  const codes_attendus = (entree_json.circuits || []).map(c => c.code);
  const codes_sortie = new Set((pa_output.circuits || []).map(c => c.code));
  for (const code of codes_attendus) if (!codes_sortie.has(code)) errors.push(`Circuit ${code} absent de la sortie`);

  // Validation par circuit
  for (const c of (pa_output.circuits || [])) {
    const code = c.code;
    const expl = c.explication || '';
    const expl_c = c.explication_courte || '';
    const renfort = c.en_renfort || '';
    const ic = (entree_json.circuits || []).find(x => x.code === code) || {};
    const max_svc = Math.max(0, ...Object.values(ic.sortants || {}));
    const niveau = ic.niveau || 'FAIBLE';

    // T1 : "Vous + verbe"
    if (!expl.match(/^(Vous\s|Dans |Avant |Ponctuellement|À l'occasion|Il vous arrive|Ce geste ne s'active|Quand |En |Depuis )/i)) {
      errors.push(`[${code}] n3_nuance T1 ne commence pas par "Vous + verbe". Début : "${expl.slice(0,50)}"`);
    }
    // Guillemets dans n3_nuance
    if (/[«»]/.test(expl)) errors.push(`[${code}] n3_nuance contient des guillemets «» — paraphrase pure obligatoire`);
    // explication_courte : 18 mots max
    const nb_mots = (expl_c.match(/\S+/g) || []).length;
    if (nb_mots > 18) errors.push(`[${code}] explication_courte : ${nb_mots} mots (max 18). Texte : "${expl_c}"`);
    if (!expl_c) errors.push(`[${code}] explication_courte vide`);
    // EN SOUTIEN : "Jamais en propre"
    if (niveau === 'EN_SOUTIEN' && expl_c && !expl_c.toLowerCase().startsWith('jamais en propre')) {
      errors.push(`[${code}] explication_courte EN_SOUTIEN doit commencer par "Jamais en propre :"`);
    }
    // en_renfort : vide si pas de sortant ≥ 2
    if (max_svc < 2 && renfort.trim()) errors.push(`[${code}] en_renfort devrait être vide (aucun sortant ≥2)`);
    if (renfort.trim() && !renfort.trim().startsWith('En renfort :')) {
      errors.push(`[${code}] en_renfort doit commencer par "En renfort :"`);
    }
    // Mots interdits
    for (const mot of MOTS_INTERDITS) {
      if ((expl + expl_c + renfort).toLowerCase().includes(mot)) {
        errors.push(`[${code}] Mot interdit : "${mot}"`);
      }
    }
    // Longueurs
    const seuils = { HAUT:{min:250,max:450}, MOYEN:{min:160,max:300}, FAIBLE:{min:100,max:200}, EN_SOUTIEN:{min:70,max:160} };
    const s = seuils[niveau] || seuils.FAIBLE;
    if (expl.length < s.min) warnings.push(`[${code}] n3_nuance courte pour ${niveau} (${expl.length}c < ${s.min}c)`);
    if (expl.length > s.max) warnings.push(`[${code}] n3_nuance longue pour ${niveau} (${expl.length}c > ${s.max}c)`);
  }

  // Validation blocs
  for (const bloc of (pa_output.blocs || [])) {
    const n = (bloc.niveau || '').toUpperCase();
    const tech = bloc.synth_technique || '';
    const cand = bloc.synth_candidat || '';
    const rattach = bloc.synth_rattachement || '';

    // Préfixe synth_technique
    const prefixe = n === 'HAUT' ? 'Bloc HAUT cœur' : n === 'MOYEN' ? 'Bloc MOYEN cœur' : 'Bloc FAIBLE';
    if (!tech.trim().startsWith(prefixe)) {
      errors.push(`[Bloc ${n}] synth_technique doit commencer par "${prefixe}". Trouvé : "${tech.slice(0,50)}"`);
    }
    // synth_candidat : zéro code circuit
    if (/P[1-5]C\d{1,2}/i.test(cand)) errors.push(`[Bloc ${n}] synth_candidat contient un code circuit PxCy`);
    // Rattachements
    if ((n === 'HAUT' || n === 'MOYEN') && !rattach.includes('sont ce que le protocole nomme')) {
      errors.push(`[Bloc ${n}] synth_rattachement doit contenir "sont ce que le protocole nomme"`);
    }
    if (n === 'FAIBLE' && rattach.includes('sont ce que le protocole nomme')) {
      errors.push(`[Bloc FAIBLE] synth_rattachement NE DOIT PAS contenir "sont ce que le protocole nomme" (format FAIBLE = "portent leur étiquette")`);
    }
    if (n === 'FAIBLE' && rattach.trim() && !rattach.includes('portent leur étiquette') && !rattach.includes('portent les étiquettes')) {
      warnings.push(`[Bloc FAIBLE] synth_rattachement devrait contenir "portent leur étiquette" ou "portent les étiquettes". Trouvé : "${rattach.slice(0,60)}"`);
    }
  }

  // Validation synthese_pilier
  const s = pa_output.synthese_pilier || {};
  if (!s.mode_libelle) errors.push('mode_libelle vide');
  if (!['FOURNI','PROPOSITION'].includes(s.mode_statut)) errors.push(`mode_statut invalide : "${s.mode_statut}"`);
  if (!(s.mode_explication_candidat || '').startsWith('Ce mode découle')) {
    errors.push(`mode_explication_candidat doit commencer par "Ce mode découle". Trouvé : "${(s.mode_explication_candidat||'').slice(0,60)}"`);
  }
  const vue = s.vue_ensemble || '';
  for (const titre of ['Profil — ce que vos gestes disent de vous','▸','Le mode retenu','Où cet outil revient']) {
    if (!vue.includes(titre)) errors.push(`vue_ensemble (synth_interpretee) : titre manquant "${titre}"`);
  }
  const intro = s.intro_eclate || '';
  if (!intro) errors.push('intro_eclate vide');
  if (/\d/.test(intro)) errors.push('intro_eclate contient un chiffre (interdit)');
  if (/P[1-5]C\d/i.test(intro)) errors.push('intro_eclate contient un code circuit (interdit)');

  return { ok: errors.length === 0, errors, warnings };
}

// ═══════════════════════════════════════════════════════════════
// SECTION 6 — ÉCRITURE AIRTABLE
// ═══════════════════════════════════════════════════════════════

async function updateRecord(tableId, recId, fields) {
  return new Promise((resolve, reject) => {
    base()(tableId).update(recId, fields, { returnFieldsByFieldId: true }, (err, rec) => {
      if (err) reject(err); else resolve(rec);
    });
  });
}

async function ecrirePilier(pa_output, pilier_rec_id, write_mode) {
  const s = pa_output.synthese_pilier || {};
  const fields = {};

  // Blocs par niveau
  for (const bloc of (pa_output.blocs || [])) {
    const n = (bloc.niveau || '').toUpperCase();
    if (n === 'HAUT') {
      fields[FP.haut_candidat]  = bloc.synth_candidat  || '';
      fields[FP.haut_technique] = bloc.synth_technique  || '';
      fields[FP.haut_rattach]   = bloc.synth_rattachement || '';
    } else if (n === 'MOYEN') {
      fields[FP.moyen_candidat]  = bloc.synth_candidat  || '';
      fields[FP.moyen_technique] = bloc.synth_technique  || '';
      fields[FP.moyen_rattach]   = bloc.synth_rattachement || '';
    } else if (n === 'FAIBLE') {
      fields[FP.faible_candidat]  = bloc.synth_candidat  || '';
      fields[FP.faible_technique] = bloc.synth_technique  || '';
      fields[FP.faible_rattach]   = bloc.synth_rattachement || '';
    }
  }

  // Synthèse
  fields[FP.synth_interpretee] = s.vue_ensemble || '';
  fields[FP.mode_explication]  = s.mode_explication_candidat || '';
  fields[FP.ch4_intro]         = s.intro_eclate || '';

  // Synth factuelles si construites par P-A
  if (s.profil_pur)    fields[FP.synth_coeur]  = s.profil_pur;
  if (s.profil_elargi) fields[FP.synth_elargi] = s.profil_elargi;

  // Mode (seulement après validation manuelle)
  if (write_mode && s.mode_libelle) fields[FP.pilier_mode] = s.mode_libelle;

  await updateRecord(T.T3_PILIER, pilier_rec_id, fields);
  console.log(`    ✅ T3_PILIER ${pilier_rec_id} mis à jour`);
}

async function ecrireCircuits(pa_output, circuits_t3) {
  // Map code → rec_id depuis les T3_CIRCUIT lus
  const rec_map = {};
  for (const c of circuits_t3) rec_map[c.code] = c.rec_id;

  for (const c of (pa_output.circuits || [])) {
    const rec_id = rec_map[c.code];
    if (!rec_id) { console.warn(`    ⚠️  ${c.code} : rec T3_CIRCUIT introuvable — skipped`); continue; }

    const fields = {
      [FC.n3_nuance]:  c.explication      || '',
      [FC.expl_courte]:c.explication_courte || '',
      [FC.renfort]:    c.en_renfort       || '',
    };

    // Verbatims sélectionnés par P-A
    const vbs = c.verbatims_cites || [];
    if (vbs[0]) { fields[FC.soleil_vb]  = vbs[0].texte || ''; fields[FC.soleil_ref] = `${vbs[0].qid} ${vbs[0].lieu}`.trim(); }
    if (vbs[1]) { fields[FC.vb2]        = vbs[1].texte || ''; fields[FC.vb2_ref]    = `${vbs[1].qid} ${vbs[1].lieu}`.trim(); }
    if (vbs[2]) { fields[FC.vb3]        = vbs[2].texte || ''; fields[FC.vb3_ref]    = `${vbs[2].qid} ${vbs[2].lieu}`.trim(); }
    if (vbs[3]) { fields[FC.vb4]        = vbs[3].texte || ''; fields[FC.vb4_ref]    = `${vbs[3].qid} ${vbs[3].lieu}`.trim(); }

    await updateRecord(T.T3_CIRCUIT, rec_id, fields);
    console.log(`    ✅ ${c.code}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 7 — ORCHESTRATEUR PRINCIPAL
// ═══════════════════════════════════════════════════════════════

async function traiterPilier(candidat_id, pilier_code, prenom, refs, opts) {
  console.log(`\n  ── ${pilier_code} ──`);

  // Lecture
  process.stdout.write('    Lecture Airtable...');
  const [pilierData, circuits, verbatimsMap] = await Promise.all([
    lirePilier(candidat_id, pilier_code),
    lireCircuits(candidat_id, pilier_code),
    lireVerbatims(candidat_id, pilier_code),
  ]);
  console.log(` ${circuits.length} circuits`);

  // Construction entrée
  const entree = construireEntree(pilierData, circuits, verbatimsMap,
    refs.circuits, refs.piliers, refs.profils, pilier_code, prenom);

  if (opts.dry_run) {
    console.log('    [DRY-RUN] Entrée P-A :');
    console.log(JSON.stringify(entree, null, 2).slice(0, 1000) + '...');
    return null;
  }

  // Appel Claude avec retry
  const MAX_RETRY = opts.max_retries || 2;
  let pa_output, validation;

  for (let t = 1; t <= MAX_RETRY; t++) {
    process.stdout.write(`    Appel Claude (tentative ${t}/${MAX_RETRY})...`);
    pa_output = await appellerClaude(entree, opts);
    console.log(' OK');

    validation = valider(pa_output, entree);

    if (validation.ok) break;

    console.log(`    ❌ ${validation.errors.length} erreur(s) :`);
    for (const e of validation.errors) console.log(`       - ${e}`);

    if (t < MAX_RETRY) {
      console.log('    ↻ Nouvelle tentative avec corrections...');
      entree._corrections_requises = validation.errors;
    } else if (opts.strict) {
      throw new Error(`Validation P-A échouée après ${MAX_RETRY} tentatives`);
    } else {
      console.log('    ⚠️  Écriture malgré erreurs (--strict non activé)');
    }
  }

  if (validation.warnings.length > 0) {
    for (const w of validation.warnings) console.log(`    ⚠️  ${w}`);
  }

  // Écriture
  console.log('    Écriture T3_PILIER...');
  await ecrirePilier(pa_output, pilierData.rec_id, opts.write_mode || false);

  console.log('    Écriture T3_CIRCUIT...');
  await ecrireCircuits(pa_output, circuits);

  const mode_libelle = pa_output.synthese_pilier?.mode_libelle || '';
  const mode_statut  = pa_output.synthese_pilier?.mode_statut  || '?';
  console.log(`    Mode [${mode_statut}] : "${mode_libelle}"`);

  return { pilier_code, mode_libelle, mode_statut, erreurs: validation.errors };
}

async function lancerAgentPA(candidat_id, opts = {}) {
  console.log(`\n${'═'.repeat(55)}`);
  console.log(`AGENT P-A v8 — ${candidat_id}`);
  console.log(`${'═'.repeat(55)}`);
  console.log(`Prénom   : ${opts.prenom || '?'}`);
  console.log(`Piliers  : ${(opts.piliers || PILIERS_ORDRE).join(', ')}`);
  console.log(`Dry-run  : ${opts.dry_run ? 'oui' : 'non'}`);
  console.log(`Modes    : ${opts.write_mode ? 'écriture' : 'lecture seule'}`);

  // Charger les référentiels une fois
  process.stdout.write('\nChargement référentiels...');
  const refs = {
    piliers:  await lireRefPiliers(),
    circuits: await lireRefCircuits(),
    profils:  await lireRefProfils(),
  };
  console.log(' OK');

  const piliers = opts.piliers || PILIERS_ORDRE;
  const resultats = [];

  for (const pilier_code of piliers) {
    try {
      const res = await traiterPilier(candidat_id, pilier_code, opts.prenom || 'le candidat', refs, opts);
      if (res) resultats.push(res);
    } catch (err) {
      console.error(`\n  ❌ ${pilier_code} : ${err.message}`);
      if (opts.strict) throw err;
    }
  }

  // Résumé final
  console.log(`\n${'─'.repeat(55)}`);
  const propositions = resultats.filter(r => r.mode_statut === 'PROPOSITION');
  if (propositions.length > 0) {
    console.log('MODES À VALIDER avant étape P-B :');
    for (const r of propositions) console.log(`  ${r.pilier_code} : "${r.mode_libelle}"`);
    console.log('→ Valider manuellement, puis relancer avec --write-mode');
  } else {
    console.log('Tous les modes sont FOURNIS ✅');
  }
  console.log('\nAGENT P-A TERMINÉ ✓');

  return resultats;
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length < 2 || args[0].startsWith('--')) {
    console.error('Usage: node service_pa.js <candidat_id> <prenom> [--piliers P3,P1] [--dry-run] [--write-mode] [--strict]');
    process.exit(1);
  }

  const candidat_id = args[0];
  const prenom      = args[1];
  const opts        = { prenom };

  for (let i = 2; i < args.length; i++) {
    if (args[i] === '--dry-run')    opts.dry_run    = true;
    if (args[i] === '--write-mode') opts.write_mode = true;
    if (args[i] === '--strict')     opts.strict     = true;
    if (args[i] === '--piliers' && args[i+1]) opts.piliers = args[++i].split(',').map(s => s.trim());
    if (args[i].startsWith('--piliers=')) opts.piliers = args[i].slice(10).split(',').map(s => s.trim());
    if (args[i] === '--tokens' && args[i+1]) opts.max_tokens = parseInt(args[++i]);
  }

  lancerAgentPA(candidat_id, opts)
    .then(() => process.exit(0))
    .catch(err => { console.error('ERREUR FATALE:', err.message); process.exit(1); });
}

module.exports = { lancerAgentPA };
