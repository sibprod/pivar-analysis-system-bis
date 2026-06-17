/**
 * SERVICE P-A — Génération rédactionnelle des 5 piliers
 * Profil-Cognitif Sib Prod · 2026-06-16 · v9
 *
 * UN seul fichier. Lit Airtable → appelle Claude P-A v9 → valide → écrit.
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
 *
 * DELTA v8 → v9 (7 corrections) :
 *   C1  const fs manquant dans les imports — ajouté
 *   C2  FC : n2_verbatims + soleil_micro ajoutés
 *   C3  construireEntree() : emprunts_recus convertis au format [{depuis, circuits:[{code,nb}]}]
 *   C4  valider() : c.n3_nuance || c.explication / c.renfort_phrase || c.en_renfort
 *   C5  valider() : bloc.rattachement || bloc.synth_rattachement
 *   C6  ecrirePilier() : bloc.rattachement || bloc.synth_rattachement
 *   C7  ecrireCircuits() : n3_nuance, renfort_phrase, + écriture n2_verbatims + soleil_micro
 */

'use strict';
require('dotenv').config();
const Anthropic = require('@anthropic-ai/sdk');
const Airtable  = require('airtable');
const fs   = require('fs');   // C1 — manquait dans l'original
const path = require('path');
const PROMPT = fs.readFileSync(path.join(__dirname, '../../../../new-prompts/etape1/bilan/prompt_etape1_T3_bilan_PA_pilier.md'), 'utf8');

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
  n2_verbatims:  'fldV3EBlHGUleiifK',   // C2 — ajouté v9
  expl_courte:   'fld3zZ8SteMWedetW',
  renfort:       'fldixMQDcsD7cCyd3',
  soleil_micro:  'flduJoJnNpHRmh6jg',   // C2 — ajouté v9
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
  return map;
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
  return map;
}

async function lireRefProfils() {
  const recs = await selectAll(T.REF_PROFILS, { fields: [FREF.prof_pilier, FREF.prof_label] });
  const map = {};
  for (const r of recs) {
    const p = fname(fv(r, FREF.prof_pilier));
    const l = fv(r, FREF.prof_label);
    if (p && l) { if (!map[p]) map[p] = []; map[p].push(l); }
  }
  return map;
}

async function lirePilier(candidat_id, pilier_code) {
  const recs = await selectAll(T.T3_PILIER, {
    filterByFormula: `AND({candidat_id} = "${candidat_id}", {pilier} = "${pilier_code}")`,
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
    filterByFormula: `AND({candidat_id} = "${candidat_id}", {pilier} = "${pilier_code}")`,
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
    filterByFormula: `AND({candidat_id} = "${candidat_id}", {pilier} = "${pilier_code}")`,
    fields: [FT2.circuit_id, FT2.detail, FT2.signal, FT2.signal_expl],
  });
  const map = {};
  for (const r of recs) {
    const cid = fv(r, FT2.circuit_id);
    if (!cid) continue;
    const signal_obj = fv(r, FT2.signal);
    const signal = fname(signal_obj);
    map[cid] = {
      verbatims: parseVerbatims(fv(r, FT2.detail) || '', `${pilier_code}${cid}`),
      signal: signal === 'NULLE' ? null : signal,
      signal_expl: fv(r, FT2.signal_expl) || 'Aucun signal limbique détecté.',
    };
  }
  return map;
}

// D1 — Emprunts reçus : circuits des AUTRES piliers dont en_svc_Px pointe vers le pilier courant.
async function lireEmpruntsRecus(candidat_id, pilier_code) {
  const svc_field_pour_pilier = {
    P1: FC.en_svc_P1, P2: FC.en_svc_P2, P3: FC.en_svc_P3,
    P4: FC.en_svc_P4, P5: FC.en_svc_P5,
  };
  const field_cible = svc_field_pour_pilier[pilier_code];
  if (!field_cible) return {};

  const recs = await selectAll(T.T3_CIRCUIT, {
    filterByFormula: `{candidat_id} = "${candidat_id}"`,
    fields: [FC.pilier, FC.circuit_id, FC.circuit_nom, field_cible],
  });

  const emprunts = {};
  for (const r of recs) {
    const pilier_source = fname(fv(r, FC.pilier));
    if (pilier_source === pilier_code) continue;
    const nb = fv(r, field_cible) || 0;
    if (nb <= 0) continue;
    const cid = fv(r, FC.circuit_id);
    const nom = fv(r, FC.circuit_nom) || '';
    const code = `${pilier_source}${cid}`;
    if (!emprunts[pilier_source]) emprunts[pilier_source] = [];
    emprunts[pilier_source].push({ code, nom, n: nb });
  }
  for (const py of Object.keys(emprunts)) {
    emprunts[py].sort((a, b) => b.n - a.n);
  }
  return emprunts; // { P1: [{code, nom, n}], P5: [...] }
}

function parseVerbatims(raw, circuit_code) {
  const result = [];
  if (!raw || !raw.trim()) return result;
  const blocks = raw.split(/\n\n+/);
  const nb_blocs = blocks.filter(b => b.trim().length > 0).length;

  for (const block of blocks) {
    if (!block.trim()) continue;
    const h = block.match(/\*\*(P\d+Q\d+)(?:\s+([A-Z_0-9\-À-Ü][A-Za-zÀ-ü0-9_\-]*))?(?:\s+[^*]*)?\*\*/i);
    const v = block.match(/^>\s*["""«](.+?)["""»]?\s*$/m);
    if (h && v) {
      result.push({
        qid:   h[1],
        lieu:  h[2] ? (h[2].charAt(0).toUpperCase() + h[2].slice(1).toLowerCase()) : '',
        texte: v[1].trim()
      });
    }
  }

  if (result.length < nb_blocs && circuit_code) {
    const perte = nb_blocs - result.length;
    console.warn(`    ⚠️  [${circuit_code}] parseVerbatims : ${nb_blocs} bloc(s) / ${result.length} capté(s) — ${perte} au format non reconnu`);
    if (nb_blocs <= 4 && result.length < nb_blocs) {
      console.warn(`    ❌  [${circuit_code}] RÈGLE COUVERTURE : ≤4 blocs → tous doivent être captés. Vérifier format T2.detail.`);
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3 — CONSTRUCTION ENTRÉE P-A
// ═══════════════════════════════════════════════════════════════

function construireEntree(pilierData, circuits, verbatimsMap, empruntsRecus, refCircuits, refPiliers, refProfils, pilier_code, civilite) {
  const has_coeur = circuits.some(c => c.coeur > 0);

  const signal_entry = Object.values(verbatimsMap).find(v => v.signal) || {};
  const signal_valeur = signal_entry.signal || 'NULLE';
  const signal_expl   = signal_entry.signal_expl || 'Aucun signal limbique détecté.';
  const signal_global = signal_valeur === 'NULLE'
    ? 'Aucun signal limbique détecté.'
    : `${signal_valeur} — ${signal_expl}`;

  const sous_totaux = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
  for (const c of circuits) for (const [px, val] of Object.entries(c.en_svc)) sous_totaux[px] += val;

  // emprunts_recus : garder le format objet { P1: [{code, nom, n}], ... }
  // (format natif de lireEmpruntsRecus, attendu par le prompt)

  const circuits_input = circuits.map(c => {
    const t2 = verbatimsMap[c.circuit_id] || { verbatims: [] };
    const ref = refCircuits[c.code] || { nom: c.circuit_nom, geste: '' };
    const niveau = normaliserNiveau(c.niveau, c.coeur, c.total, has_coeur ? 'coeur' : 'total');
    const sortants = {};
    for (const [px, val] of Object.entries(c.en_svc)) if (val > 0) sortants[px] = val;
    return {
      code: c.code,
      nom: ref.nom || c.circuit_nom,
      geste: ref.geste || '',
      coeur: c.coeur,
      total: c.total,
      niveau,
      adhoc: false,
      sortants,
      verbatims: t2.verbatims,
    };
  });

  return {
    candidat_civilite: civilite,
    pilier_code,
    pilier_nom: refPiliers[pilier_code] || '',
    pilier_role: normaliserRole(pilierData.pilier_role),
    pilier_mode: pilierData.pilier_mode || '',
    profils_types: refProfils[pilier_code] || [],
    echelle_classement: has_coeur ? 'coeur' : 'total',
    signal_limbique: signal_global,
    sous_totaux_instrumentaux: sous_totaux,
    emprunts_recus: empruntsRecus || {},  // format objet { P1: [{code, nom, n}], ... }
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
  if (coeur === 0) return 'EN_SOUTIEN';
  const n = (niveau || '').toUpperCase().replace(/\s/g, '_');
  if (n.includes('SOUTIEN')) return 'EN_SOUTIEN';
  if (n === 'HAUT') return 'HAUT';
  if (n === 'MOYEN') return 'MOYEN';
  if (n === 'FAIBLE') return 'FAIBLE';
  if (coeur >= 4) return 'HAUT';
  if (coeur >= 2) return 'MOYEN';
  return 'FAIBLE';
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
  'précieux','précieuse','à mobiliser sur','cluster','aucun cluster'];

const QUALITES_INTERDITES_MODE = ['analytique','rigoureux','rigoureuse','méthodique','organisé','organisée','curieux','curieuse','créatif','créative','précis','précise','efficace','polyvalent'];

function valider(pa_output, entree_json) {
  const errors = [], warnings = [];

  const codes_attendus = (entree_json.circuits || []).map(c => c.code);
  const codes_sortie = new Set((pa_output.circuits || []).map(c => c.code));
  for (const code of codes_attendus) if (!codes_sortie.has(code)) errors.push(`Circuit ${code} absent de la sortie`);

  for (const c of (pa_output.circuits || [])) {
    const code = c.code;
    const expl    = c.explication || '';
    const expl_c  = c.explication_courte || '';
    const renfort = c.en_renfort || '';
    const n2      = c.n2_verbatims || '';
    const micro   = c.soleil_micro || '';

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

    // EN SOUTIEN : basé sur coeur===0
    const est_soutien = (ic.coeur === 0);
    if (est_soutien && expl_c && !expl_c.toLowerCase().startsWith('jamais en propre')) {
      errors.push(`[${code}] explication_courte circuit cœur=0 doit commencer par "Jamais en propre :" (coeur=0 force EN_SOUTIEN)`);
    }

    // en_renfort / renfort_phrase : vide si pas de sortant ≥ 2
    if (max_svc < 2 && renfort.trim()) errors.push(`[${code}] renfort devrait être vide (aucun sortant ≥2)`);
    if (renfort.trim() && !renfort.trim().startsWith('En renfort :')) {
      errors.push(`[${code}] renfort doit commencer par "En renfort :"`);
    }

    // n2_verbatims : format INLINE (pas de \n)
    if (n2 && n2.includes('\n')) errors.push(`[${code}] n2_verbatims contient des \\n — format INLINE obligatoire`);

    // soleil_micro : HAUT+MOYEN seulement, ≤15 mots
    if (micro) {
      if (niveau === 'FAIBLE' || niveau === 'EN_SOUTIEN') {
        errors.push(`[${code}] soleil_micro non vide pour niveau ${niveau} — FAIBLE et EN_SOUTIEN doivent être vides`);
      }
      const mots_micro = (micro.match(/\S+/g) || []).length;
      if (mots_micro > 15) errors.push(`[${code}] soleil_micro : ${mots_micro} mots (max 15)`);
    }

    // Mots interdits
    for (const mot of MOTS_INTERDITS) {
      if ((expl + expl_c + renfort).toLowerCase().includes(mot)) {
        errors.push(`[${code}] Mot interdit : "${mot}"`);
      }
    }

    // Longueurs n3_nuance
    const seuils = { HAUT:{min:250,max:450}, MOYEN:{min:160,max:300}, FAIBLE:{min:100,max:200}, EN_SOUTIEN:{min:70,max:160} };
    const s = seuils[niveau] || seuils.FAIBLE;
    if (expl.length < s.min) warnings.push(`[${code}] n3_nuance courte pour ${niveau} (${expl.length}c < ${s.min}c)`);
    if (expl.length > s.max) warnings.push(`[${code}] n3_nuance longue pour ${niveau} (${expl.length}c > ${s.max}c)`);
  }

  // Validation blocs
  const renforts_par_cible = {};
  for (const c of (pa_output.circuits || [])) {
    const r = c.en_renfort || '';
    if (!r.trim()) continue;
    const m = r.match(/\(P([1-5])\)\s*[—-]\s*(\d+)\s*fois/i);
    if (m) {
      const cible = `P${m[1]}`, nb = parseInt(m[2]);
      if (!renforts_par_cible[cible]) renforts_par_cible[cible] = 0;
      renforts_par_cible[cible] += nb;
    }
  }

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

    // synth_candidat : zéro code circuit pour FAIBLE, codes autorisés en M2 pour HAUT/MOYEN
    if (n === 'FAIBLE' && /P[1-5]C\d{1,2}/i.test(cand)) {
      errors.push(`[Bloc FAIBLE] synth_candidat contient un code circuit PxCy (interdit pour ce niveau)`);
    }

    // Contrôle M2 cohérence renforts
    for (const [cible, nb] of Object.entries(renforts_par_cible)) {
      if (nb >= 2 && !cand.includes(cible) && !tech.includes(cible)) {
        warnings.push(`[Bloc ${n}] M2 : renfort vers ${cible} (${nb}×) non mentionné dans synth_candidat ou synth_technique`);
      }
    }

    // Rattachements
    if ((n === 'HAUT' || n === 'MOYEN') && rattach && !rattach.includes('sont ce que le protocole nomme')) {
      errors.push(`[Bloc ${n}] rattachement doit contenir "sont ce que le protocole nomme"`);
    }
    if (n === 'FAIBLE' && rattach && rattach.includes('sont ce que le protocole nomme')) {
      errors.push(`[Bloc FAIBLE] rattachement NE DOIT PAS contenir "sont ce que le protocole nomme" (format = "portent leur étiquette")`);
    }
    if (n === 'FAIBLE' && rattach.trim() && !rattach.includes('portent leur étiquette') && !rattach.includes('portent les étiquettes')) {
      warnings.push(`[Bloc FAIBLE] rattachement devrait contenir "portent leur étiquette" ou "portent les étiquettes". Trouvé : "${rattach.slice(0,60)}"`);
    }
    // Clôture rattachement
    if (rattach.trim() && !rattach.includes('Le nom de') && !rattach.includes('l\'étiquette du geste')) {
      warnings.push(`[Bloc ${n}] rattachement manque la clôture "Le nom de chaque circuit n'est que l'étiquette..."`);
    }
  }

  // Validation synthese_pilier
  const s = pa_output.synthese_pilier || {};
  if (!s.mode_libelle) errors.push('mode_libelle vide');
  if (!['FOURNI','PROPOSITION'].includes(s.mode_statut)) errors.push(`mode_statut invalide : "${s.mode_statut}"`);
  if (!(s.mode_explication_candidat || '').startsWith('Ce mode découle')) {
    errors.push(`mode_explication_candidat doit commencer par "Ce mode découle". Trouvé : "${(s.mode_explication_candidat||'').slice(0,60)}"`);
  }
  if (s.mode_statut === 'PROPOSITION' && s.mode_libelle) {
    const mode_lc = s.mode_libelle.toLowerCase();
    const qualite_detectee = QUALITES_INTERDITES_MODE.find(q => mode_lc.includes(q));
    if (qualite_detectee) {
      errors.push(`[mode_libelle PROPOSITION] qualité interdite "${qualite_detectee}" — le mode nomme une manière de faire, pas un trait. Trouvé : "${s.mode_libelle}"`);
    }
  }
  const vue = s.vue_ensemble || '';
  for (const titre of ['Profil — ce que vos gestes disent de vous','▸','Le mode retenu','Où cet outil revient']) {
    if (!vue.includes(titre)) errors.push(`vue_ensemble : titre manquant "${titre}"`);
  }
  // Titre 3ème section : "ou en appui" (v9)
  if (vue && !vue.includes('ou en appui') && !vue.includes('de temps en temps')) {
    warnings.push('vue_ensemble : titre 3ème section devrait contenir "de temps en temps, ou en appui"');
  }
  const intro = s.intro_eclate || '';
  if (!intro) errors.push('intro_eclate vide');
  if (/\d/.test(intro)) errors.push('intro_eclate contient un chiffre (interdit)');
  if (/P[1-5]C\d/i.test(intro)) errors.push('intro_eclate contient un code circuit (interdit)');
  const mots_intro = (intro.match(/\S+/g) || []).length;
  if (mots_intro > 20) errors.push(`intro_eclate : ${mots_intro} mots (max 20)`);

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

  for (const bloc of (pa_output.blocs || [])) {
    const n = (bloc.niveau || '').toUpperCase();
    const rattach = bloc.synth_rattachement || '';
    if (n === 'HAUT') {
      fields[FP.haut_candidat]  = bloc.synth_candidat  || '';
      fields[FP.haut_technique] = bloc.synth_technique  || '';
      fields[FP.haut_rattach]   = rattach;
    } else if (n === 'MOYEN') {
      fields[FP.moyen_candidat]  = bloc.synth_candidat  || '';
      fields[FP.moyen_technique] = bloc.synth_technique  || '';
      fields[FP.moyen_rattach]   = rattach;
    } else if (n === 'FAIBLE') {
      fields[FP.faible_candidat]  = bloc.synth_candidat  || '';
      fields[FP.faible_technique] = bloc.synth_technique  || '';
      fields[FP.faible_rattach]   = rattach;
    }
  }

  fields[FP.synth_interpretee] = s.vue_ensemble || '';
  fields[FP.mode_explication]  = s.mode_explication_candidat || '';
  fields[FP.ch4_intro]         = s.intro_eclate || '';

  if (s.profil_pur)    fields[FP.synth_coeur]  = s.profil_pur;
  if (s.profil_elargi) fields[FP.synth_elargi] = s.profil_elargi;

  if (write_mode && s.mode_libelle) fields[FP.pilier_mode] = s.mode_libelle;

  await updateRecord(T.T3_PILIER, pilier_rec_id, fields);
  console.log(`    ✅ T3_PILIER ${pilier_rec_id} mis à jour`);
}

async function ecrireCircuits(pa_output, circuits_t3) {
  const rec_map = {};
  for (const c of circuits_t3) rec_map[c.code] = c.rec_id;

  for (const c of (pa_output.circuits || [])) {
    const rec_id = rec_map[c.code];
    if (!rec_id) { console.warn(`    ⚠️  ${c.code} : rec T3_CIRCUIT introuvable — skipped`); continue; }

    // C7 — v9 utilise n3_nuance et renfort_phrase (backward compat)
    const fields = {
      [FC.n3_nuance]:  c.explication      || '',
      [FC.expl_courte]:c.explication_courte || '',
      [FC.renfort]:    c.en_renfort     || '',
    };

    // C7 — n2_verbatims : produit directement par l'agent v9 en format inline
    if (c.n2_verbatims) fields[FC.n2_verbatims] = c.n2_verbatims;

    // C7 — soleil_micro : produit par l'agent v9 (HAUT+MOYEN seulement)
    if (c.soleil_micro) fields[FC.soleil_micro] = c.soleil_micro;

    // Verbatims sélectionnés par P-A (format prompt : verbatims_cites[])
    const vbs = c.verbatims_cites || [];
    if (vbs[0]) { fields[FC.soleil_vb]  = vbs[0].texte || ''; fields[FC.soleil_ref] = `${vbs[0].qid} ${vbs[0].lieu}`.trim(); }
    if (vbs[1]) { fields[FC.vb2]  = vbs[1].texte || ''; fields[FC.vb2_ref] = `${vbs[1].qid} ${vbs[1].lieu}`.trim(); }
    if (vbs[2]) { fields[FC.vb3]  = vbs[2].texte || ''; fields[FC.vb3_ref] = `${vbs[2].qid} ${vbs[2].lieu}`.trim(); }
    if (vbs[3]) { fields[FC.vb4]  = vbs[3].texte || ''; fields[FC.vb4_ref] = `${vbs[3].qid} ${vbs[3].lieu}`.trim(); }

    await updateRecord(T.T3_CIRCUIT, rec_id, fields);
    console.log(`    ✅ ${c.code}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 7 — ORCHESTRATEUR PRINCIPAL
// ═══════════════════════════════════════════════════════════════

async function traiterPilier(candidat_id, pilier_code, civilite, refs, opts) {
  console.log(`\n  ── ${pilier_code} ──`);

  process.stdout.write('    Lecture Airtable...');
  const [pilierData, circuits, verbatimsMap, empruntsRecus] = await Promise.all([
    lirePilier(candidat_id, pilier_code),
    lireCircuits(candidat_id, pilier_code),
    lireVerbatims(candidat_id, pilier_code),
    lireEmpruntsRecus(candidat_id, pilier_code),
  ]);
  const nb_verbatims = Object.values(verbatimsMap).reduce((s, v) => s + v.verbatims.length, 0);
  const nb_emprunts  = Object.values(empruntsRecus).reduce((s, arr) => s + arr.length, 0);
  console.log(` ${circuits.length} circuits · ${nb_verbatims} verbatims · ${nb_emprunts} emprunts reçus`);

  const entree = construireEntree(pilierData, circuits, verbatimsMap, empruntsRecus,
    refs.circuits, refs.piliers, refs.profils, pilier_code, civilite);

  if (opts.dry_run) {
    console.log('    [DRY-RUN] Entrée P-A :');
    console.log(JSON.stringify(entree, null, 2));
    return null;
  }

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
  console.log(`AGENT P-A v9 — ${candidat_id}`);
  console.log(`${'═'.repeat(55)}`);
  console.log(`Civilité : ${opts.civilite || '?'}`);
  console.log(`Piliers  : ${(opts.piliers || PILIERS_ORDRE).join(', ')}`);
  console.log(`Dry-run  : ${opts.dry_run ? 'oui' : 'non'}`);
  console.log(`Modes    : ${opts.write_mode ? 'écriture' : 'lecture seule'}`);

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
      const res = await traiterPilier(candidat_id, pilier_code, opts.civilite || '', refs, opts);
      if (res) resultats.push(res);
    } catch (err) {
      console.error(`\n  ❌ ${pilier_code} : ${err.message}`);
      if (opts.strict) throw err;
    }
  }

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
    console.error('Usage: node service_pa.js <candidat_id> <prenom> [--piliers P4,P1] [--dry-run] [--write-mode] [--strict]');
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
