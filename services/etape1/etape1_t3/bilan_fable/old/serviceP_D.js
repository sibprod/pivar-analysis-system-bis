// services/etape1/bilan_fable/serviceP_D.js
// P-D — CHAPITRE III MARQUEURS LIMBIQUES & ZONES DE COÛT — v3.0 (14/06/2026)
// Source : PROMPT_CH3_MARQUEURS_v1.md + dossier §1 + base Cécile
//
// Prompt P-D entrées : signaux_par_pilier + verbatims_limbiques + cout_principal/secondaire
// Les signaux VIENNENT DE É0 (T2.fldnDxnEc3uLoAknN) — pas de lecture T1 par nom.
//
// Coûts : paramètres figés (jugement Isabelle). Repli heuristique si absents (loggué).
//
// Format registres — vérifié en base Cécile :
//   "titre\ntexte\n« verbatim » (ref)\n\ntitre2\n..."
//
// Format coût — vérifié en base Cécile :
//   "label\ntitre\nTEXTE :\ntexte\nVERBATIMS :\nverbatims"
//
// Écriture T3_BILAN (7 champs — vérifiés en base Cécile, dossier §1) :
//   ch3_s05_intro    → fldxCNvqR4qyYAYjr
//   ch3_registres    → fldgeeC3lg3M89ESA
//   ch3_s05_cloture  → fld9x0yRmGnAhVFS4
//   ch3_s06_intro    → fldxZi0jRCWnXsVng
//   ch3_cout_principal  → fld0nyRitbejCsihG
//   ch3_cout_secondaire → fld7JUPi80iqSKzzV
//   ch3_s06_cloture  → fld1nB5UqVklCjikE

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const agentBase       = require('../../../infrastructure/agentBase');
const logger          = require('../../../../utils/logger');
const { buildContexteE0 } = require('./serviceE0_extraction');

const PROMPT_PATH = 'etape1/bilan/PROMPT_CH3_MARQUEURS_v1.md';
const PB = config.ETAPE1_T3_BILAN_FIELDS;

const SLOT_ROLE = { socle:'socle', str1:'amont', str2:'aval', fn1:'fonctionnel', fn2:'fonctionnel' };
const MOTS_AVERSIFS = ['aversion','coût','cout','déteste','deteste','pénible','penible','stress','tension',"n'aime pas",'pire'];

function estAversif(t) { const s=(t||'').toLowerCase(); return MOTS_AVERSIFS.some(m=>s.includes(m)); }

// Signal dominant = tonalité la plus fréquente (doctrine §2.3B)
function signalDominant(tonalites) {
  if (!tonalites?.length) return '';
  const c={}; for (const t of tonalites) c[t]=(c[t]||0)+1;
  return Object.keys(c).sort((a,b)=>c[b]-c[a])[0];
}

// Format registres — vérifié en base Cécile
function formatRegistres(registres) {
  return (registres||[])
    .map(r=>[r.titre||'',r.texte||'',r.verbatims||''].filter(Boolean).join('\n'))
    .join('\n\n');
}

// Format coût — vérifié en base Cécile
function formatCout(cout, verbatimsStr) {
  const parts=[cout.label||'',cout.titre||'','TEXTE :',cout.texte||''];
  if (verbatimsStr) { parts.push('VERBATIMS :'); parts.push(verbatimsStr); }
  return parts.join('\n');
}

async function runMarqueurs({ candidat_id, prenom='', coutPrincipal=null, coutSecondaire=null }) {
  const t=Date.now();
  logger.info('P-D v3 — démarrage', { candidat_id });

  // É0 fournit signal_limbique (T2) et verbatims circuits
  const [e0ctx, piliers, bilan, piliersRef] = await Promise.all([
    buildContexteE0({ candidat_id }),
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T3Bilan(candidat_id),
    airtableService.getReferentielPiliers(),
  ]);

  if (!bilan) throw new Error(`P-D: T3_BILAN absent`);

  // Libellés + rôles + modes
  const piliers_libelles={};
  for (const p of (piliersRef||[])) if (p.pilier_code) piliers_libelles[p.pilier_code]=p.pilier_nom||'';
  const roles={};
  for (const [champ,slot] of [['pilier_socle','socle'],['pilier_str1','str1'],['pilier_str2','str2'],['pilier_fn1','fn1'],['pilier_fn2','fn2']]) {
    const code=bilan[champ]; if (code&&/^P[1-5]$/.test(code)) roles[code]=SLOT_ROLE[slot];
  }
  const modes_valides={};
  for (const p of (piliers||[])) {
    const code=p.pilier||''; const mode=p.pilier_mode||'';   // clé lisible après _mapByFieldIds
    if (code&&mode) modes_valides[code]=mode;
  }

  // Signaux + verbatims limbiques depuis É0 (T2 — fldnDxnEc3uLoAknN)
  const signauxParPilier={}, verbatims_limbiques=[];
  for (const P of (e0ctx.piliers||[])) {
    const signal=(P.signal_limbique||'').trim();
    if (!signal) continue;
    if (!signauxParPilier[P.pilier_code]) signauxParPilier[P.pilier_code]=[];
    signauxParPilier[P.pilier_code].push(signal);
    // Verbatims des circuits HAUT/MOYEN de ce pilier
    for (const c of (P.circuits||[])) {
      if (c.niveau!=='HAUT'&&c.niveau!=='MOYEN') continue;
      for (const v of (c.verbatims||[])) {
        if (!v.texte) continue;
        verbatims_limbiques.push({ qid:v.qid||'', lieu:v.lieu||'', texte:v.texte, pilier:P.pilier_code, tonalite:signal });
      }
    }
  }

  // Signal dominant par pilier (§2.3B)
  const signaux_par_pilier={};
  for (const pil of Object.keys(signauxParPilier)) signaux_par_pilier[pil]=signalDominant(signauxParPilier[pil]);

  // Coûts : paramètre figé ou repli heuristique
  let cp=coutPrincipal, cs=coutSecondaire, repli=false;
  if (!cp||!cs) {
    repli=true;
    const cnt={};
    for (const v of verbatims_limbiques) if (estAversif(v.tonalite)&&v.pilier) cnt[v.pilier]=(cnt[v.pilier]||0)+1;
    const cl=Object.keys(cnt).sort((a,b)=>cnt[b]-cnt[a]);
    if (!cp&&cl[0]) cp={ pilier:cl[0], activite:piliers_libelles[cl[0]]||cl[0] };
    if (!cs&&cl[1]) cs={ pilier:cl[1], activite:piliers_libelles[cl[1]]||cl[1] };
    logger.warn('P-D: coûts heuristiques — peut diverger (zone de jugement)', { candidat_id, cp, cs });
  }
  if (!cp||!cs) throw new Error('P-D: coûts indéterminés');

  const verbStr=(pil)=>verbatims_limbiques.filter(v=>v.pilier===pil&&v.texte)
    .map(v=>`« ${v.texte} » (${v.qid} ${v.lieu})`.trim()).join(' · ');

  const payload = {
    candidat_prenom:prenom, piliers_libelles, roles, modes_valides,
    signaux_par_pilier,
    cout_principal:  { pilier:cp.pilier, activite:cp.activite },
    cout_secondaire: { pilier:cs.pilier, activite:cs.activite },
    verbatims_limbiques,
  };

  const { result, cost } = await agentBase.callAgent({
    serviceName:'bilan_fable_PD', promptPath:PROMPT_PATH, payload, injectLexique:true, candidatId:candidat_id,
  });

  if (!Array.isArray(result?.registres)||!result?.cout_principal) throw new Error('P-D: sortie invalide');
  if (result.alerte) logger.warn('P-D: alerte agent', { candidat_id, alerte:result.alerte });

  const fields={};
  fields[PB.s05_intro]       = result.s05_intro   ||'';
  fields[PB.registres]       = formatRegistres(result.registres);
  fields[PB.s05_cloture]     = result.s05_cloture ||'';
  fields[PB.s06_intro]       = result.s06_intro   ||'';
  fields[PB.cout_principal]  = formatCout(result.cout_principal,  verbStr(cp.pilier));
  fields[PB.cout_secondaire] = formatCout(result.cout_secondaire||{label:'Coût secondaire'}, verbStr(cs.pilier));
  fields[PB.s06_cloture]     = result.s06_cloture ||'';

  await airtableService.upsertEtape1T3Bilan(candidat_id, fields);
  logger.info('P-D v3 — terminé', { candidat_id, repli, cost, elapsedMs:Date.now()-t });
  return { candidat_id, cost, alerte:result.alerte||'' };
}

module.exports = { runMarqueurs };
