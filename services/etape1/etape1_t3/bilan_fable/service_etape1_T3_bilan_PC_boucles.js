/**service_etape1_T3_bilan_PC_boucles.js
 * ════════════════════════════════════════════════════════════════════════
 * SERVICE P-C — CHAPITRE II « BOUCLES »  ·  FICHIER UNIQUE
 * Profil-Cognitif Sib Prod · 16/06/2026
 *
 * UN prompt (PROMPT_CH2_BOUCLES_v1.md) + UN service (ce fichier). Rien d'autre.
 *
 * Ce service enchaîne 4 étapes, dans l'ordre :
 *   1) BUILDER déterministe — lit la table RESPONSES, calcule les comptages des
 *      4 maillons (M1 / M2a / M2b / M3 / M4). AUCUN LLM. Prouvé sur Cécile.
 *   2) AGENT — construit l'entrée JSON et appelle l'API avec le prompt CH2.
 *      L'agent rédige (et tranche M2b) ; il ne calcule aucun chiffre.
 *   3) WRITER — assemble les 6 champs ch2 (format étalon Cécile) et écrit dans T3_BILAN.
 *   4) RUN — orchestration + garde-fous (dénominateur 25, architecture atypique).
 *
 * USAGE :
 *   node service_pc.js --candidat <id>            → DRY-RUN (affiche, n'écrit rien)
 *   node service_pc.js --candidat <id> --write    → écrit les 6 champs ch2 dans T3_BILAN
 *   node service_pc.js --candidat <id> --write --force  → passe outre l'alerte architecture
 *
 * VARIABLES D'ENV : AIRTABLE_API_KEY, ANTHROPIC_API_KEY
 * ════════════════════════════════════════════════════════════════════════
 */

const Airtable  = require('airtable');
const Anthropic = require('@anthropic-ai/sdk');
const fs   = require('fs');
const path = require('path');

const BASE_ID     = 'appgghhXjYBdFRras';
const T_RESP      = 'tblK28GE8RWq9tQMV';   // RESPONSES
const T_BILAN     = 'tblv775KQrEhsogdI';   // ETAPE1_T3_BILAN
const T_PILIER    = 'tblzDIn7P2cOvVvY2';   // ETAPE1_T3_PILIER
const PROMPT_PATH = path.join(__dirname, 'PROMPT_CH2_BOUCLES_v1.md');
const DENOM       = 25;                     // dénominateur figé

// field IDs RESPONSES (vérifiés en base 16/06)
const F_RESP = {
  candidat: 'fldD6c9DdWkVpZvMg',
  question: 'fldFgNVoNt5st0CXx',
  scenario: 'fldXIGBLwTBHaaLtZ',
  gouverne: 'fldVepvgG6umwwG3R',   // pilier qui GOUVERNE (≠ fldl8bM45ANu5wQ9B = demandé)
  sequence: 'fldunWgxM8I5RZdAB',
  texte:    'fldPEHxIIJwYIOs2Q',
};
// field IDs T3_BILAN — les 6 champs ch2
const F_BILAN = {
  candidat: 'fldk66gddYGCREOV4',
  intro:    'fldFWT8vtfVuTm4zC',
  maillon1: 'fldVM2cfim5rBivMt',
  maillon2: 'fldAZQSbNRxK8ugWo',
  maillon3: 'fldKxUzxHTvZ6d3z5',
  maillon4: 'fldzc8cjyygsfbC5N',
  technique:'fldRRLpspWX6qTx7d',
};
// field IDs T3_PILIER — pour lire l'architecture (rôles, labels, modes)
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

/** Liste ordonnée des codes pilier d'une séquence. Étape sans code Px = 'X' (posture, rompt l'adjacence). */
function piliersDeSequence(seq) {
  if (!seq) return [];
  return seq.split('→').map(step => {
    const m = step.trim().match(/^(P[1-5])\b/);
    return m ? m[1] : 'X';
  });
}

/** adjacence stricte a→b (X rompt l'enchaînement) */
function aAdjacence(piliers, a, b) {
  for (let i = 0; i < piliers.length - 1; i++) {
    if (piliers[i] === a && piliers[i + 1] === b) return true;
  }
  return false;
}

/** Lit les réponses du candidat depuis RESPONSES. */
async function lireResponses(candidat_id, airtable) {
  const out = [];
  await airtable(T_RESP).select({
    filterByFormula: `{${F_RESP.candidat}}="${candidat_id}"`,
    fields: [F_RESP.candidat, F_RESP.question, F_RESP.scenario, F_RESP.gouverne, F_RESP.sequence, F_RESP.texte],
    pageSize: 100,
  }).eachPage((records, next) => {
    for (const r of records) {
      const seq = r.get(F_RESP.sequence) || '';
      out.push({
        q:        _selName(r.get(F_RESP.question)),
        scenario: _selName(r.get(F_RESP.scenario)),
        gouv:     _selName(r.get(F_RESP.gouverne)),
        seq,
        piliers:  piliersDeSequence(seq),
        texte:    r.get(F_RESP.texte) || '',
      });
    }
    next();
  });
  return out;
}

/**
 * Calcule les 4 maillons. Rôles fournis (socle/amont/aval), JAMAIS plaqués depuis Cécile.
 * M2b : on expose les CANDIDATS bruts ; l'agent tranche acte vs posture/fragment.
 */
function calculerMaillons(responses, roles) {
  const { socle, amont, aval } = roles;
  const total = responses.length;

  const m1_q  = responses.filter(r => r.gouv === socle).map(r => r.q);
  const m2a_q = responses.filter(r => aAdjacence(r.piliers, amont, socle)).map(r => r.q);
  const m2b_candidats = responses
    .filter(r => aAdjacence(r.piliers, socle, amont))
    .map(r => ({ q: r.q, scenario: r.scenario, gouv: r.gouv, gouvernee_par_amont: r.gouv === amont, sequence: r.seq }));
  const m3_q = responses.filter(r => r.gouv === socle && aAdjacence(r.piliers, socle, aval)).map(r => r.q);
  const m4_q = responses.filter(r => r.gouv === aval).map(r => r.q);

  const gouvernance = {};
  for (const p of ['P1','P2','P3','P4','P5']) gouvernance[p] = responses.filter(r => r.gouv === p).length;

  const textes_par_q = {};
  for (const r of responses) textes_par_q[r.q] = r.texte;

  return {
    denominateur: total, denominateur_attendu: DENOM,
    maillon1: { pilier: socle, gouvernees: m1_q.length, total, q: m1_q.sort() },
    maillon2: { de: socle, vers: amont, aller_amont_socle: m2a_q.length, aller_q: m2a_q.sort(),
                retour_socle_amont_brut: m2b_candidats.length, retour_candidats: m2b_candidats },
    maillon3: { de: socle, vers: aval, n: m3_q.length, total, q: m3_q.sort() },
    maillon4: { de: aval, vers: socle, gouvernees_par_aval: m4_q.length, q: m4_q.sort() },
    gouvernance, textes_par_q,
  };
}

// ════════════════════════════════════════════════════════════════════════
// 2) AGENT (entrée + appel API)
// ════════════════════════════════════════════════════════════════════════

function construireEntreeAgent(candidat_id, arch, maillons) {
  const { piliers, roles } = arch;
  const libelles = {};
  for (const code of ['P1','P2','P3','P4','P5']) libelles[code] = piliers[code]?.label || code;
  const modes = {};
  for (const code of Object.keys(piliers)) modes[code] = piliers[code].mode;

  return {
    candidat_id,
    piliers_libelles: libelles,
    roles,
    modes_valides: modes,
    denominateur: maillons.denominateur,
    maillon1: maillons.maillon1,
    maillon2: maillons.maillon2,   // inclut retour_candidats (M2b) à trancher
    maillon3: maillons.maillon3,
    maillon4: maillons.maillon4,
    gouvernance: maillons.gouvernance,
    textes_par_q: maillons.textes_par_q,   // textes intégraux → verbatims de trajectoire
    consigne_m2b: "Pour chaque candidat de maillon2.retour_candidats : VALIDER si l'étape socle est un ACTE d'analyse (compter) ou EXCLURE si posture / mention de surface / fragment instrumental dans une réponse gouvernée par l'amont. Justifier chaque exclusion (auditable).",
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
// 3) WRITER (assemblage + écriture T3_BILAN)
// ════════════════════════════════════════════════════════════════════════

/** Formate un maillon au format étalon Cécile : badge · titre / Attesté / VERBATIMS / TEXTE. */
function formaterMaillon(m) {
  const lignes = [];
  lignes.push(`${m.badge} · ${m.titre}`);
  lignes.push(`Attesté : ${m.attest}`);
  if (m.verbatims && m.verbatims.length > 0) {
    lignes.push('VERBATIMS :');
    for (const v of m.verbatims) {
      const sc = (v.scenario || v.lieu || '').toUpperCase().replace(/-/g, '_');
      lignes.push(`« ${v.texte} » (${v.qid} ${sc})`);
    }
  }
  lignes.push('TEXTE :');
  lignes.push(m.texte);
  return lignes.join('\n');
}

async function ecrireCh2(sortie, bilan_rec_id, airtable) {
  if (!sortie.maillons || sortie.maillons.length !== 4) {
    throw new Error(`Sortie agent : ${sortie.maillons?.length || 0} maillons (4 attendus)`);
  }
  const [m1, m2, m3, m4] = sortie.maillons;
  const fields = {
    [F_BILAN.intro]:     sortie.intro,
    [F_BILAN.maillon1]:  formaterMaillon(m1),
    [F_BILAN.maillon2]:  formaterMaillon(m2),
    [F_BILAN.maillon3]:  formaterMaillon(m3),
    [F_BILAN.maillon4]:  formaterMaillon(m4),
    [F_BILAN.technique]: sortie.technique,
  };
  await airtable(T_BILAN).update(bilan_rec_id, fields);
  return bilan_rec_id;
}

// ════════════════════════════════════════════════════════════════════════
// 4) RUN (orchestration + garde-fous)
// ════════════════════════════════════════════════════════════════════════

/** Lit l'architecture (socle/amont/aval) depuis pilier_role — jamais déduite de la fréquence. */
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
  const force   = args.includes('--force');
  if (!candidat_id) { console.error('ERREUR : --candidat <id> obligatoire'); process.exit(1); }

  const airtable = new Airtable({ apiKey: process.env.AIRTABLE_API_KEY }).base(BASE_ID);

  // 1) Architecture
  const arch = await lireArchitecture(candidat_id, airtable);
  const { socle, amont, aval } = arch.roles;
  if (!socle || !amont || !aval) {
    console.error(`ERREUR : rôles incomplets (socle=${socle} amont=${amont} aval=${aval}). Vérifier pilier_role dans T3_PILIER.`);
    process.exit(1);
  }
  console.log(`Architecture : socle=${socle} · amont=${amont} · aval=${aval}`);

  // 2) Builder
  const responses = await lireResponses(candidat_id, airtable);
  const maillons = calculerMaillons(responses, arch.roles);

  if (maillons.denominateur !== maillons.denominateur_attendu) {
    console.error(`ARRÊT : ${maillons.denominateur} réponses ≠ ${maillons.denominateur_attendu}. RESPONSES incomplet.`);
    process.exit(1);
  }

  // Garde-fou architecture atypique (cas Rémi)
  const socle_majoritaire = maillons.maillon1.gouvernees > maillons.denominateur / 2;
  const aval_gouverne = maillons.maillon4.gouvernees_par_aval > 0;
  const m3_faible = maillons.maillon3.n <= 3;
  if ((!socle_majoritaire || aval_gouverne || m3_faible) && !force) {
    console.warn('\n⚠️  ARCHITECTURE ATYPIQUE (≠ schéma Cécile) :');
    console.warn(`    socle gouverne ${maillons.maillon1.gouvernees}/${maillons.denominateur}, aval gouverne ${maillons.maillon4.gouvernees_par_aval}, M3 débouché=${maillons.maillon3.n}`);
    console.warn('    gouvernance :', JSON.stringify(maillons.gouvernance));
    console.warn('    → Rôles des maillons (M2 partenaire, M3 débouché, M4 absence) à arbitrer par Isabelle AVANT génération.');
    console.warn('      Relancer avec --force après arbitrage.');
    if (doWrite) { console.warn('    Écriture BLOQUÉE (pas de --force).'); process.exit(2); }
  }

  // 3) Agent
  const entree = construireEntreeAgent(candidat_id, arch, maillons);
  const sortie = await appelerAgent(entree);

  // 4) Écriture / dry-run
  if (doWrite) {
    const bilan = await _findBilan(candidat_id, airtable);
    if (!bilan) { console.error('ERREUR : record T3_BILAN introuvable'); process.exit(1); }
    await ecrireCh2(sortie, bilan.id, airtable);
    console.log(`\n✅ Chapitre II écrit dans T3_BILAN ${bilan.id}`);
  } else {
    console.log('\n── DRY-RUN (pas d\'écriture). JSON agent : ──');
    console.log(JSON.stringify(sortie, null, 2));
    console.log('\n── Comptages builder (audit) : ──');
    console.log(JSON.stringify(maillons, null, 2));
  }
}

if (require.main === module) run().catch(e => { console.error(e); process.exit(1); });

module.exports = {
  piliersDeSequence, aAdjacence, lireResponses, calculerMaillons,
  construireEntreeAgent, appelerAgent,
  formaterMaillon, ecrireCh2,
  lireArchitecture, run,
  F_RESP, F_BILAN, F_PIL, DENOM, BASE_ID,
};
