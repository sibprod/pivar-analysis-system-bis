// services/etape1/bilan_fable/serviceP_B.js
// P-B — FILTRE COGNITIF & CHAPITRE IV (chaîne bilan FABLE) — v2.0 (14/06/2026)
//
// BASE DE TRAVAIL UNIQUE : DOSSIER_AGENT_FABLE5_v1.md
//
// CORRECTIONS v1→v2 :
//   C1. Verbatims circuits HAUT du socle : lus depuis les 4 paires de champs séparés
//       (verbatim_1..4 + refs — dossier §1), pas depuis n2_verbatims (inexistant).
//   C2. Explication circuits : lue depuis fldSx0VOHYILowFSj (champ "explication" dossier §1),
//       pas depuis c.n3_nuance (inexistant).
//   C3. Débordements socle : lus depuis en_svc_P1..P5 via config PC (champs T3_CIRCUIT),
//       pas depuis c[`en_svc_${pj}`] qui suppose un mapping direct sur le nom de champ.
//
// ÉCRITURE : 6 champs T3_BILAN — vérifiés en base Cécile (tous remplis, fldIDs confirmés).

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const agentBase       = require('../../../infrastructure/agentBase');
const logger          = require('../../../../utils/logger');

const PROMPT_PATH = 'etape1/bilan/PROMPT_FILTRE_CH4_v1.md';
const PB = config.ETAPE1_T3_BILAN_FIELDS;
const PC = config.ETAPE1_T3_CIRCUIT_FIELDS;

// ─── fldIDs T3_CIRCUIT explication + verbatims (dossier §1) ──────────────────
const FLD_EXPLICATION = 'fldSx0VOHYILowFSj';
const VERB_FIELDS = [
  { texte: 'fldLP9juCWCTlCZPt', ref: 'fldI1DVJiH7EH4zel' },
  { texte: 'fldSCQD9zvgRQcuq9', ref: 'fldmVPwfku0vUz6xX' },
  { texte: 'fldhIp3aW72WR2V1t', ref: 'fldcQ7hxyRumcc1DO' },
  { texte: 'fld4lrLWySRXVmvZe', ref: 'fldQgruSXveuTCLM4' },
];

// ─── Architecture ─────────────────────────────────────────────────────────────
const SLOT_ROLE = { str1: 'amont', str2: 'aval', fn1: 'fonctionnel', fn2: 'fonctionnel' };
const ARCH_SLOTS = [
  ['pilier_str1', 'str1'], ['pilier_str2', 'str2'],
  ['pilier_fn1',  'fn1'],  ['pilier_fn2',  'fn2'],
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

// Code complet : pilier "P3" + circuit_id "C10" → "P3C10"
function codeComplet(circuit) {
  const cid = String(circuit[PC.circuit_id] || circuit.circuit_id || '');
  const pil = String(circuit[PC.pilier]     || circuit.pilier     || '');
  if (/^P[1-5]/.test(cid)) return cid;
  return `${pil}${cid}`;
}

// Extrait les verbatims depuis les 4 paires de champs séparés (C1 — dossier §1)
function extraireVerbatims(circuit) {
  const out = [];
  for (const f of VERB_FIELDS) {
    const texte = (circuit[f.texte] || '').trim();
    if (!texte) continue;
    const ref   = (circuit[f.ref]   || '').trim();
    // ref format "PxQn Lieu" → qid + lieu
    const m = /^(P\d+Q\d+)\s+(.+)$/.exec(ref);
    out.push({
      texte,
      qid:  m ? m[1] : ref,
      lieu: m ? m[2] : '',
    });
  }
  return out;
}

// Sortant en_svc_Pj depuis config PC (C3)
function getSvc(circuit, pj) {
  const key = PC[`en_svc_${pj}`] || `en_svc_${pj}`;
  return Number(circuit[key] || 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Produit le filtre + le chapitre IV et écrit les 6 champs dans T3_BILAN.
 * Vérifié en base Cécile : les 6 fldIDs sont remplis et alignés avec le dossier §1.
 *
 * @param {{ candidat_id: string, prenom?: string }} p
 * @returns {Promise<{ candidat_id, cost }>}
 */
async function runFiltreEtChapitre4({ candidat_id, prenom = '' }) {
  const startTime = Date.now();
  logger.info('P-B v2 — démarrage filtre & chapitre IV', { candidat_id });

  const [piliers, circuits, bilan, t1, piliersRef] = await Promise.all([
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T3Circuits(candidat_id),
    airtableService.getEtape1T3Bilan(candidat_id),
    airtableService.getEtape1T1(candidat_id),
    airtableService.getReferentielPiliers(),
  ]);

  if (!bilan)                       throw new Error(`P-B: T3_BILAN absent pour ${candidat_id}`);
  if (!piliers  || !piliers.length)  throw new Error(`P-B: T3_PILIER absent — P-A doit précéder`);
  if (!circuits || !circuits.length) throw new Error(`P-B: T3_CIRCUIT absent — P-A doit précéder`);
  if (!t1       || !t1.length)       throw new Error(`P-B: ETAPE1_T1 absent pour ${candidat_id}`);

  const socle = bilan.pilier_socle;
  if (!socle || !/^P[1-5]$/.test(socle))
    throw new Error(`P-B: pilier_socle invalide (${socle})`);

  // ─── 1. Libellés officiels ────────────────────────────────────────────
  const piliers_libelles = {};
  for (const p of (piliersRef || [])) {
    if (p.pilier_code) piliers_libelles[p.pilier_code] = p.pilier_nom || '';
  }

  // ─── 2. Rôles depuis T3_BILAN ─────────────────────────────────────────
  const roles = { [socle]: 'socle' };
  for (const [champ, slot] of ARCH_SLOTS) {
    const code = bilan[champ];
    if (code && /^P[1-5]$/.test(code) && code !== socle) roles[code] = SLOT_ROLE[slot];
  }

  // ─── 3. Modes validés + vues d'ensemble depuis T3_PILIER ──────────────
  const modes_valides        = {};
  const vues_ensemble_piliers = {};
  for (const p of piliers) {
    const code = p.pilier || p[PP?.pilier] || '';
    if (!code) continue;
    const mode  = p[config.ETAPE1_T3_PILIER_FIELDS?.pilier_mode] || p.pilier_mode || '';
    const synth = p[config.ETAPE1_T3_PILIER_FIELDS?.synth_interpretee] || p.synth_interpretee || '';
    if (mode)  modes_valides[code]         = mode;
    if (synth) vues_ensemble_piliers[code] = synth;
  }

  // ─── 4. Métriques transverses depuis T1 ───────────────────────────────
  // Doctrine §3 : É0 produit ces métriques — elles transitent ici depuis T1
  // en attendant que le pipeline les pré-calcule et les injecte.
  const sorties_par_pilier = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
  let glissTotal = 0, glissConvergent = 0;
  const repartition_origine = {};
  for (const row of t1) {
    const gov = row.pilier_coeur;
    const dem = row.pilier_demande;
    if (gov && /^P[1-5]$/.test(gov)) sorties_par_pilier[gov] += 1;
    if (gov && dem && gov !== dem && /^P[1-5]$/.test(gov) && /^P[1-5]$/.test(dem)) {
      glissTotal += 1;
      if (gov === socle) glissConvergent += 1;
      repartition_origine[dem] = (repartition_origine[dem] || 0) + 1;
    }
  }
  const totalReponses = t1.length;

  // ─── 5. Circuits du socle — gestes HAUT + débordements (C2 + C3) ──────
  const circuitsSocle = circuits.filter(c => {
    const pil = c[PC.pilier] || c.pilier || '';
    return pil === socle;
  });

  const gestes_haut_socle = circuitsSocle
    .filter(c => (c[PC.circuit_niveau] || c.circuit_niveau || '') === 'HAUT')
    .sort((a, b) => Number(b[PC.circuit_freq] || 0) - Number(a[PC.circuit_freq] || 0))
    .map(c => ({
      code:           codeComplet(c),
      nom:            c[PC.circuit_nom]  || c.circuit_nom  || '',
      coeur:          Number(c[PC.circuit_freq] || 0),
      geste_candidat: c[FLD_EXPLICATION] || '',              // C2 : explication fldSx0VOHYILowFSj
    }));

  const debordements_socle = [];
  for (const c of circuitsSocle) {
    for (const pj of ['P1', 'P2', 'P3', 'P4', 'P5']) {
      if (pj === socle) continue;
      const n = getSvc(c, pj);                               // C3 : via config PC
      if (n >= 2) {
        debordements_socle.push({
          code:  codeComplet(c),
          vers:  pj,
          n,
          geste: c[PC.circuit_nom] || c.circuit_nom || '',
        });
      }
    }
  }

  // ─── 6. Pool verbatims clés — circuits HAUT du socle (C1) ─────────────
  // Source : T3_CIRCUIT verbatim_1..4 + refs (dossier §1)
  const verbatims_cles = [];
  for (const c of circuitsSocle.filter(c =>
    (c[PC.circuit_niveau] || c.circuit_niveau || '') === 'HAUT'
  )) {
    for (const v of extraireVerbatims(c)) {
      verbatims_cles.push({ qid: v.qid, lieu: v.lieu, texte: v.texte, angle: '' });
    }
  }

  // ─── 7. Payload P-B ───────────────────────────────────────────────────
  const payload = {
    candidat_prenom:       prenom,
    piliers_libelles,
    socle:                 { code: socle, role_carte: '★ socle — décide' },
    roles,
    modes_valides,
    gouvernance:           { sorties_par_pilier, total: totalReponses },
    gestes_haut_socle,
    debordements_socle,
    glissements: {
      total:               glissTotal,
      convergent_socle:    glissConvergent,
      repartition_origine,
    },
    verbatims_cles,
    vues_ensemble_piliers,
  };

  const { result, cost } = await agentBase.callAgent({
    serviceName:  'bilan_fable_PB',
    promptPath:   PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId:   candidat_id,
  });

  if (!result || !result.filtre || !result.ch4_filtre_preuves)
    throw new Error('P-B: sortie agent invalide (filtre / preuves manquants)');

  // ─── 8. Écriture T3_BILAN (6 champs — vérifiés en base Cécile) ────────
  const fields = {};
  fields[PB.filtre]                = result.filtre;
  fields[PB.filtre_declinaison]    = result.filtre_declinaison    || '';
  fields[PB.ch4_filtre_revelation] = result.ch4_filtre_revelation || '';
  fields[PB.ch4_filtre_preuves]    = result.ch4_filtre_preuves;
  fields[PB.schema_intro_roles]    = result.schema_intro_roles    || '';
  fields[PB.schema_legende_socle]  = result.schema_legende_socle  || '';

  await airtableService.upsertEtape1T3Bilan(candidat_id, fields);

  logger.info('P-B v2 — terminé', {
    candidat_id, glissements: glissTotal, convergent: glissConvergent,
    debordements: debordements_socle.length, verbatims_pool: verbatims_cles.length,
    cost, elapsedMs: Date.now() - startTime,
  });

  return { candidat_id, cost };
}

module.exports = { runFiltreEtChapitre4 };
