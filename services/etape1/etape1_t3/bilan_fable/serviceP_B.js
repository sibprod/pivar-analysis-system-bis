// services/etape1/bilan_fable/serviceP_B.js
// P-B — FILTRE COGNITIF & CHAPITRE IV — v3.0 (14/06/2026)
// Source : PROMPT_FILTRE_CH4_v1.md + dossier §1 + base Cécile
//
// Prompt P-B entrées : modes_valides, gestes_haut_socle (avec explication = geste_candidat),
//   debordements_socle, glissements, verbatims_cles, vues_ensemble_piliers
//
// Écriture T3_BILAN (6 champs — vérifiés en base Cécile) :
//   filtre              → fld9vAKpKEMIcRiTB
//   filtre_declinaison  → fld1p9p9Csvyllvcm
//   ch4_filtre_revelation → fldqDeT7EDov18iTz
//   ch4_filtre_preuves  → fldXGZ5ijlcGPYc16
//   schema_intro_roles  → fldm2QaOvI5cKpLwg
//   schema_legende_socle → fldXlpyU1EdUPBtIH
//
// Métriques transverses (glissements, sorties_par_pilier) : calculées depuis T1
// car non pré-calculées dans le dossier.

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const agentBase       = require('../../../infrastructure/agentBase');
const logger          = require('../../../../utils/logger');

const PROMPT_PATH = 'etape1/bilan/PROMPT_FILTRE_CH4_v1.md';
const PB = config.ETAPE1_T3_BILAN_FIELDS;
const PC = config.ETAPE1_T3_CIRCUIT_FIELDS;

// fldID explication T3_CIRCUIT (dossier §1)
const FLD_EXPL = 'fldSx0VOHYILowFSj';

// fldIDs verbatims T3_CIRCUIT
const VERB = [
  { t:'fldLP9juCWCTlCZPt', r:'fldI1DVJiH7EH4zel' },
  { t:'fldSCQD9zvgRQcuq9', r:'fldmVPwfku0vUz6xX' },
  { t:'fldhIp3aW72WR2V1t', r:'fldcQ7hxyRumcc1DO' },
  { t:'fld4lrLWySRXVmvZe', r:'fldQgruSXveuTCLM4' },
];

const SLOT_ROLE = { str1:'amont', str2:'aval', fn1:'fonctionnel', fn2:'fonctionnel' };
const ARCH_SLOTS = [['pilier_str1','str1'],['pilier_str2','str2'],['pilier_fn1','fn1'],['pilier_fn2','fn2']];

function codeComplet(c) {
  const cid = String(c[PC.circuit_id]||c.circuit_id||'');
  const pil = String(c[PC.pilier]||c.pilier||'');
  return /^P[1-5]/.test(cid) ? cid : `${pil}${cid}`;
}

function extraireVerbatims(circuit) {
  return VERB.map(f => {
    const texte = (circuit[f.t]||'').trim();
    if (!texte) return null;
    const ref = (circuit[f.r]||'').trim();
    const m = /^(P\d+Q\d+)\s+(.+)$/.exec(ref);
    return { texte, qid: m?m[1]:ref, lieu: m?m[2]:'' };
  }).filter(Boolean);
}

function getSvc(c, pj) {
  const key = PC[`en_svc_${pj}`] || `en_svc_${pj}`;
  return Number(c[key]||0);
}

async function runFiltreEtChapitre4({ candidat_id, prenom='' }) {
  const t = Date.now();
  logger.info('P-B v3 — démarrage', { candidat_id });

  const [piliers, circuits, bilan, t1, piliersRef] = await Promise.all([
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T3Circuits(candidat_id),
    airtableService.getEtape1T3Bilan(candidat_id),
    airtableService.getEtape1T1(candidat_id),
    airtableService.getReferentielPiliers(),
  ]);

  if (!bilan)              throw new Error(`P-B: T3_BILAN absent`);
  if (!piliers?.length)    throw new Error(`P-B: T3_PILIER absent — P-A doit précéder`);
  if (!circuits?.length)   throw new Error(`P-B: T3_CIRCUIT absent — P-A doit précéder`);
  if (!t1?.length)         throw new Error(`P-B: T1 absent`);

  const socle = bilan.pilier_socle;
  if (!socle || !/^P[1-5]$/.test(socle)) throw new Error(`P-B: pilier_socle invalide`);

  // Libellés
  const piliers_libelles = {};
  for (const p of (piliersRef||[])) if (p.pilier_code) piliers_libelles[p.pilier_code] = p.pilier_nom||'';

  // Rôles
  const roles = { [socle]: 'socle' };
  for (const [champ, slot] of ARCH_SLOTS) {
    const code = bilan[champ];
    if (code && /^P[1-5]$/.test(code) && code!==socle) roles[code] = SLOT_ROLE[slot];
  }

  // Modes + vues d'ensemble depuis T3_PILIER
  const modes_valides={}, vues_ensemble={};
  for (const p of (piliers||[])) {
    const code = p.pilier||'';
    const mode  = p.pilier_mode        || '';   // clé lisible après _mapByFieldIds
    const synth = p.synth_interpretee  || '';   // clé lisible après _mapByFieldIds
    if (code && mode)  modes_valides[code]= mode;
    if (code && synth) vues_ensemble[code] = synth;
  }

  // Métriques transverses depuis T1
  const sorties_par_pilier={P1:0,P2:0,P3:0,P4:0,P5:0};
  let glissTotal=0, glissConvergent=0;
  const repartition_origine={};
  for (const row of t1) {
    const gov=row.pilier_coeur, dem=row.pilier_demande;
    if (gov && /^P[1-5]$/.test(gov)) sorties_par_pilier[gov]+=1;
    if (gov && dem && gov!==dem && /^P[1-5]$/.test(gov) && /^P[1-5]$/.test(dem)) {
      glissTotal+=1;
      if (gov===socle) glissConvergent+=1;
      repartition_origine[dem]=(repartition_origine[dem]||0)+1;
    }
  }

  // Circuits du socle
  const circuitsSocle = (circuits||[]).filter(c=>(c[PC.pilier]||c.pilier||'')===socle);

  // Gestes HAUT du socle — explication depuis fldSx0VOHYILowFSj (dossier §1)
  const gestes_haut_socle = circuitsSocle
    .filter(c=>(c[PC.circuit_niveau]||c.circuit_niveau||'')==='HAUT')
    .sort((a,b)=>Number(b[PC.circuit_freq]||0)-Number(a[PC.circuit_freq]||0))
    .map(c=>({
      code: codeComplet(c), nom: c[PC.circuit_nom]||c.circuit_nom||'',
      coeur: Number(c[PC.circuit_freq]||0),
      geste_candidat: c[FLD_EXPL]||'',  // explication 3 temps — fldSx0VOHYILowFSj
    }));

  // Débordements socle ≥2
  const debordements_socle=[];
  for (const c of circuitsSocle) {
    for (const pj of ['P1','P2','P3','P4','P5']) {
      if (pj===socle) continue;
      const n=getSvc(c,pj);
      if (n>=2) debordements_socle.push({ code:codeComplet(c), vers:pj, n, geste:c[PC.circuit_nom]||'' });
    }
  }

  // Pool verbatims clés — circuits HAUT du socle — fldLP9juCWCTlCZPt..4 (dossier §1)
  const verbatims_cles=[];
  for (const c of circuitsSocle.filter(c=>(c[PC.circuit_niveau]||'')===  'HAUT')) {
    for (const v of extraireVerbatims(c))
      verbatims_cles.push({ qid:v.qid, lieu:v.lieu, texte:v.texte, angle:'' });
  }

  const payload = {
    candidat_prenom: prenom, piliers_libelles,
    socle: { code:socle, role_carte:'★ socle — décide' },
    roles, modes_valides,
    gouvernance: { sorties_par_pilier, total:t1.length },
    gestes_haut_socle, debordements_socle,
    glissements: { total:glissTotal, convergent_socle:glissConvergent, repartition_origine },
    verbatims_cles, vues_ensemble_piliers:vues_ensemble,
  };

  const { result, cost } = await agentBase.callAgent({
    serviceName:'bilan_fable_PB', promptPath:PROMPT_PATH, payload, injectLexique:true, candidatId:candidat_id,
  });

  if (!result?.filtre || !result?.ch4_filtre_preuves) throw new Error('P-B: sortie invalide');

  const fields={};
  fields[PB.filtre]                = result.filtre;
  fields[PB.filtre_declinaison]    = result.filtre_declinaison    ||'';
  fields[PB.ch4_filtre_revelation] = result.ch4_filtre_revelation ||'';
  fields[PB.ch4_filtre_preuves]    = result.ch4_filtre_preuves;
  fields[PB.schema_intro_roles]    = result.schema_intro_roles    ||'';
  fields[PB.schema_legende_socle]  = result.schema_legende_socle  ||'';

  await airtableService.upsertEtape1T3Bilan(candidat_id, fields);
  logger.info('P-B v3 — terminé', { candidat_id, cost, elapsedMs:Date.now()-t });
  return { candidat_id, cost };
}

module.exports = { runFiltreEtChapitre4 };
