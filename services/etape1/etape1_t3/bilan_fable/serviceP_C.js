// services/etape1/bilan_fable/serviceP_C.js
// P-C — CHAPITRE II BOUCLES — v3.0 (14/06/2026)
// Source : PROMPT_CH2_BOUCLES_v1.md + dossier §1 + base Cécile
//
// Prompt P-C entrées : maillon1..4 + verbatims_trajectoires + rôles + modes
// Le prompt NE calcule rien : toutes les métriques viennent du service.
//
// Métriques maillons depuis T1 :
//   M1 : nb réponses gouvernées par le socle (pilier_coeur == socle)
//   M2 : adjacences amont↔socle dans types_verbatim_circuits (ordre des activations)
//   M3 : gouvernées socle ET socle→aval dans la séquence
//   M4 : nb réponses gouvernées par l'aval (attendu 0 — négatif structurant)
//
// Format maillon stocké T3_BILAN — vérifié en base Cécile :
//   "badge · titre\nAttesté : ...\nVERBATIMS :\n[verbatims]\nTEXTE :\n[texte]"
//
// Écriture T3_BILAN (6 champs — vérifiés en base Cécile, dossier §1) :
//   ch2_intro      → fldFWT8vtfVuTm4zC
//   ch2_technique  → fldRRLpspWX6qTx7d
//   ch2_maillon1   → fldVM2cfim5rBivMt
//   ch2_maillon2   → fldAZQSbNRxK8ugWo
//   ch2_maillon3   → fldKxUzxHTvZ6d3z5
//   ch2_maillon4   → fldzc8cjyygsfbC5N

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const agentBase       = require('../../../infrastructure/agentBase');
const logger          = require('../../../../utils/logger');

const PROMPT_PATH = 'etape1/bilan/PROMPT_CH2_BOUCLES_v1.md';
const PB = config.ETAPE1_T3_BILAN_FIELDS;
const PC = config.ETAPE1_T3_CIRCUIT_FIELDS;

// fldIDs verbatims T3_CIRCUIT (dossier §1)
const VERB = [
  { t:'fldLP9juCWCTlCZPt', r:'fldI1DVJiH7EH4zel' },
  { t:'fldSCQD9zvgRQcuq9', r:'fldmVPwfku0vUz6xX' },
  { t:'fldhIp3aW72WR2V1t', r:'fldcQ7hxyRumcc1DO' },
  { t:'fld4lrLWySRXVmvZe', r:'fldQgruSXveuTCLM4' },
];

const SLOT_ROLE = { socle:'socle', str1:'amont', str2:'aval', fn1:'fonctionnel', fn2:'fonctionnel' };

// Verbatims depuis T3_CIRCUIT (dossier §1)
function extraireVerbatims(c) {
  return VERB.map(f => {
    const texte=(c[f.t]||'').trim(); if(!texte) return null;
    const ref=(c[f.r]||'').trim();
    const m=/^(P\d+Q\d+)\s+(.+)$/.exec(ref);
    return { texte, qid:m?m[1]:ref, lieu:m?m[2]:'' };
  }).filter(Boolean);
}

// Parse séquence de piliers depuis types_verbatim_circuits T1
// Format observé : "P3 · C12 · FRANCHE\n  geste : ...\n  verbatim : ..." (blocs séparés \n\n)
// On extrait l'ordre des piliers propriétaires (doublons consécutifs fusionnés)
function pilierSequenceT1(raw) {
  if (!raw) return [];
  const seq=[];
  const blocs=raw.split(/\n\s*\n/);
  for (const bloc of blocs) {
    const m=/^P([1-5])\s*·\s*C\d+/.exec(bloc.trim());
    if (!m) continue;
    const pil=`P${m[1]}`;
    if (!seq.length || seq[seq.length-1]!==pil) seq.push(pil);
  }
  return seq;
}

function aTransition(seq, a, b) {
  for (let i=0; i<seq.length-1; i++) if (seq[i]===a && seq[i+1]===b) return true;
  return false;
}

// Format maillon — vérifié en base Cécile
function formatMaillon(m) {
  return [
    `${(m.badge||'').trim()} · ${(m.titre||'').trim()}`.trim(),
    m.attest||'', 'VERBATIMS :', m.verbatims||'', 'TEXTE :', m.texte||'',
  ].join('\n');
}

async function runBoucles({ candidat_id, prenom='' }) {
  const t=Date.now();
  logger.info('P-C v3 — démarrage', { candidat_id });

  const [piliers, circuits, bilan, t1, piliersRef] = await Promise.all([
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T3Circuits(candidat_id),
    airtableService.getEtape1T3Bilan(candidat_id),
    airtableService.getEtape1T1(candidat_id),
    airtableService.getReferentielPiliers(),
  ]);

  if (!bilan)       throw new Error(`P-C: T3_BILAN absent`);
  if (!t1?.length)  throw new Error(`P-C: T1 absent`);

  const socle=bilan.pilier_socle, amont=bilan.pilier_str1||null, aval=bilan.pilier_str2||null;
  if (!socle||!/^P[1-5]$/.test(socle)) throw new Error(`P-C: pilier_socle invalide`);

  // Libellés + rôles + modes
  const piliers_libelles={};
  for (const p of (piliersRef||[])) if (p.pilier_code) piliers_libelles[p.pilier_code]=p.pilier_nom||'';
  const roles={};
  for (const [champ,slot] of [['pilier_socle','socle'],['pilier_str1','str1'],['pilier_str2','str2'],['pilier_fn1','fn1'],['pilier_fn2','fn2']]) {
    const code=bilan[champ]; if (code&&/^P[1-5]$/.test(code)) roles[code]=SLOT_ROLE[slot];
  }
  const modes_valides={};
  for (const p of (piliers||[])) {
    const code=p.pilier||''; const mode=p[config.ETAPE1_T3_PILIER_FIELDS?.pilier_mode]||p.pilier_mode||'';
    if (code&&mode) modes_valides[code]=mode;
  }

  // Métriques maillons depuis T1
  let gouverneeSocle=0, gouverneeAval=0, m2_aller=0, m2_retour=0, m3_n=0;
  for (const row of t1) {
    const gov=row.pilier_coeur||'';
    // Séquence intra-réponse depuis types_verbatim_circuits
    const raw=row.types_verbatim_circuits||row['types_verbatim_circuits']||'';
    const seq=pilierSequenceT1(raw);
    if (gov===socle) gouverneeSocle+=1;
    if (aval&&gov===aval) gouverneeAval+=1;
    if (amont) {
      if (aTransition(seq,amont,socle)) m2_aller+=1;
      if (aTransition(seq,socle,amont)) m2_retour+=1;
    }
    if (aval&&gov===socle&&aTransition(seq,socle,aval)) m3_n+=1;
  }
  if (m2_retour>0) logger.warn('P-C: M2b brut (exclusions sémantiques non appliquées)', { candidat_id, m2_retour });

  // Pool verbatims trajectoire — circuits HAUT du socle — T3_CIRCUIT dossier §1
  const verbatims_trajectoires=[];
  for (const c of (circuits||[]).filter(c=>(c[PC.pilier]||c.pilier||'')===socle && (c[PC.circuit_niveau]||c.circuit_niveau||'')==='HAUT')) {
    for (const v of extraireVerbatims(c))
      verbatims_trajectoires.push({ qid:v.qid, lieu:v.lieu, texte:v.texte, maillon:1 });
  }

  const payload = {
    candidat_prenom:prenom, piliers_libelles, roles, modes_valides,
    maillon1: { pilier:socle, gouvernees:gouverneeSocle, total:t1.length },
    maillon2: amont ? { de:socle, vers:amont, aller:m2_aller, retour:m2_retour } : null,
    maillon3: aval  ? { de:socle, vers:aval, n:m3_n, total:t1.length }           : null,
    maillon4: aval  ? { de:aval, vers:socle, n:gouverneeAval, lecture:'' }        : null,
    verbatims_trajectoires,
  };

  const { result, cost } = await agentBase.callAgent({
    serviceName:'bilan_fable_PC', promptPath:PROMPT_PATH, payload, injectLexique:true, candidatId:candidat_id,
  });

  if (!Array.isArray(result?.maillons)||result.maillons.length<4) throw new Error('P-C: 4 maillons attendus');

  const M=result.maillons;
  const fields={};
  fields[PB.boucle_intro_texte]  = result.intro     ||'';
  fields[PB.boucle_technique]    = result.technique  ||'';
  fields[PB.maillon_m1_depart]   = formatMaillon(M[0]);
  fields[PB.maillon_m2_dialogue] = formatMaillon(M[1]);
  fields[PB.maillon_m3_debouche] = formatMaillon(M[2]);
  fields[PB.maillon_m4_jamais]   = formatMaillon(M[3]);

  await airtableService.upsertEtape1T3Bilan(candidat_id, fields);
  logger.info('P-C v3 — terminé', { candidat_id, m1:gouverneeSocle, m2_aller, m2_retour, m3_n, cost, elapsedMs:Date.now()-t });
  return { candidat_id, cost };
}

module.exports = { runBoucles };
