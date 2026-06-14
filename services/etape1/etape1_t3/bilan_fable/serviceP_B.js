// services/etape1/bilan_fable/serviceP_B.js
// P-B — FILTRE COGNITIF & CHAPITRE IV (chaîne bilan FABLE) — v1.0 (13/06/2026)
//
// Rôle : produit la SIGNATURE du candidat — le filtre (affiché à l'identique en
// 4 lieux), sa déclinaison, la révélation du ch. IV, les 5 preuves, et les 2
// textes du schéma. Appelle l'agent PROMPT_FILTRE_CH4_v1 une fois.
//
// ENTRÉES (assemblées ici, FIGÉES, jamais inventées) :
//   - modes validés + vues d'ensemble ...... T3_PILIER (sorties de P-A)
//   - gestes HAUT du socle + débordements ... T3_CIRCUIT (sorties de P-A : coeur, en_svc, explication)
//   - architecture (socle, rôles) .......... T3_BILAN
//   - libellés officiels ................... REFERENTIEL_PILIERS
//   - métriques transverses ................ calculées depuis ETAPE1_T1 (doctrine FILTRE) :
//       · sorties_par_pilier = nb de réponses gouvernées par chaque pilier (pilier_coeur)
//       · glissements : N = réponses où pilier_coeur ≠ pilier_demande ;
//                       M (convergent_socle) = de ces N, celles où pilier_coeur == socle ;
//                       repartition_origine = par pilier_demande (outil que la question visait)
//       · débordements_socle = circuits du socle avec en_svc_Pj ≥ 2 (Preuve 4)
//
// SORTIE (contrat verrouillé) → T3_BILAN (champs Fable) via upsertEtape1T3Bilan :
//   filtre, filtre_declinaison, ch4_filtre_revelation, ch4_filtre_preuves,
//   schema_intro_roles, schema_legende_socle.
//
// Note : socle_libelle est une dérivation (architecture), pas une sortie de P-B.
//   verbatims_cles : on fournit le POOL des verbatims des circuits HAUT du socle
//   (l'agent y puise pour la Preuve 3) — la sélection fine par angle reste à affiner.

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const agentBase       = require('../../../infrastructure/agentBase');
const logger          = require('../../../../utils/logger');

const PROMPT_PATH = 'etape1/bilan/PROMPT_FILTRE_CH4_v1.md';
const PB = config.ETAPE1_T3_BILAN_FIELDS;

// rôle architecture → mot « rôle » du prompt (amont/aval/fonctionnel)
const SLOT_ROLE = { str1: 'amont', str2: 'aval', fn1: 'fonctionnel', fn2: 'fonctionnel' };
const ARCH_SLOTS = [
  ['pilier_str1', 'str1'], ['pilier_str2', 'str2'],
  ['pilier_fn1',  'fn1'],  ['pilier_fn2',  'fn2']
];

// reconstruit le code complet d'un circuit T3 : pilier "P3" + circuit_id "C10" → "P3C10"
function codeComplet(circuit) {
  const cid = String(circuit.circuit_id || '');
  if (/^P[1-5]/.test(cid)) return cid;            // déjà complet (sécurité)
  return `${circuit.pilier || ''}${cid}`;
}

// reparse le champ n2_verbatims (« texte » (qid LIEU), un par ligne) → [{qid,lieu,texte}]
function parseVerbatimsField(raw) {
  if (!raw) return [];
  const out = [];
  const re = /«\s*([\s\S]*?)\s*»\s*\(([^\s)]+)\s+([^)]+)\)/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    out.push({ texte: m[1].trim(), qid: m[2].trim(), lieu: m[3].trim() });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════

/**
 * Produit le filtre + le chapitre IV et écrit les 6 champs dans T3_BILAN.
 * @param {Object} p
 * @param {string} p.candidat_id
 * @param {string} [p.prenom]
 * @returns {Promise<{candidat_id, cost}>}
 */
async function runFiltreEtChapitre4({ candidat_id, prenom = '' }) {
  const startTime = Date.now();
  logger.info('P-B — démarrage filtre & chapitre IV', { candidat_id });

  const [piliers, circuits, bilan, t1, piliersRef] = await Promise.all([
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T3Circuits(candidat_id),
    airtableService.getEtape1T3Bilan(candidat_id),
    airtableService.getEtape1T1(candidat_id),
    airtableService.getReferentielPiliers()
  ]);

  if (!bilan)              throw new Error(`P-B: T3_BILAN absent pour ${candidat_id} (architecture requise)`);
  if (!piliers || !piliers.length) throw new Error(`P-B: T3_PILIER absent pour ${candidat_id} (P-A doit précéder)`);
  if (!circuits || !circuits.length) throw new Error(`P-B: T3_CIRCUIT absent pour ${candidat_id} (P-A doit précéder)`);

  const socle = bilan.pilier_socle;
  if (!socle || !/^P[1-5]$/.test(socle)) throw new Error(`P-B: pilier_socle invalide (${socle})`);

  // ─── libellés officiels ────────────────────────────────────────────────
  const piliers_libelles = {};
  for (const p of piliersRef) {
    if (p.pilier_code) piliers_libelles[p.pilier_code] = p.pilier_nom || '';
  }

  // ─── rôles (hors socle) depuis l'architecture ───────────────────────────
  const roles = {};
  for (const [champ, slot] of ARCH_SLOTS) {
    const code = bilan[champ];
    if (code && /^P[1-5]$/.test(code) && code !== socle) roles[code] = SLOT_ROLE[slot];
  }

  // ─── modes validés + vues d'ensemble (sorties de P-A, T3_PILIER) ────────
  const modes_valides = {};
  const vues_ensemble_piliers = {};
  for (const p of piliers) {
    const code = p.pilier;
    if (!code) continue;
    if (p.pilier_mode)        modes_valides[code] = p.pilier_mode;
    if (p.synth_interpretee)  vues_ensemble_piliers[code] = p.synth_interpretee;
  }

  // ─── métriques transverses depuis T1 (doctrine FILTRE) ──────────────────
  const sorties_par_pilier = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
  let glissTotal = 0, glissConvergent = 0;
  const repartition_origine = {};
  for (const row of t1) {
    const gov = row.pilier_coeur;             // pilier qui gouverne la réponse
    const dem = row.pilier_demande;           // pilier que la question visait
    if (gov && /^P[1-5]$/.test(gov)) sorties_par_pilier[gov] += 1;
    if (gov && dem && /^P[1-5]$/.test(gov) && /^P[1-5]$/.test(dem) && gov !== dem) {
      glissTotal += 1;                        // glissement : répondu avec un autre outil
      if (gov === socle) glissConvergent += 1;
      repartition_origine[dem] = (repartition_origine[dem] || 0) + 1;
    }
  }
  const totalReponses = t1.length;

  // ─── circuits du socle (sorties de P-A) : gestes HAUT + débordements ────
  const circuitsSocle = circuits.filter(c => c.pilier === socle);

  const gestes_haut_socle = circuitsSocle
    .filter(c => c.circuit_niveau === 'HAUT')
    .sort((a, b) => (Number(b.circuit_freq || 0) - Number(a.circuit_freq || 0)))
    .map(c => ({
      code: codeComplet(c),
      nom:  c.circuit_nom || '',
      coeur: Number(c.circuit_freq || 0),
      geste_candidat: c.n3_nuance || ''        // explication 3 temps produite par P-A
    }));

  const debordements_socle = [];
  for (const c of circuitsSocle) {
    for (const pj of ['P1', 'P2', 'P3', 'P4', 'P5']) {
      if (pj === socle) continue;
      const n = Number(c[`en_svc_${pj}`] || 0);
      if (n >= 2) {                            // Preuve 4 : débordements ≥ 2
        debordements_socle.push({ code: codeComplet(c), vers: pj, n, geste: c.circuit_nom || '' });
      }
    }
  }

  // ─── pool de verbatims clés : ceux des circuits HAUT du socle ───────────
  const verbatims_cles = [];
  for (const c of circuitsSocle.filter(c => c.circuit_niveau === 'HAUT')) {
    for (const v of parseVerbatimsField(c.n2_verbatims)) {
      verbatims_cles.push({ qid: v.qid, lieu: v.lieu, texte: v.texte, angle: '' });
    }
  }

  // ─── payload P-B ────────────────────────────────────────────────────────
  const payload = {
    candidat_prenom: prenom,
    piliers_libelles,
    socle: { code: socle, role_carte: '★ socle — décide' },
    roles,
    modes_valides,
    gouvernance: { sorties_par_pilier, total: totalReponses },
    gestes_haut_socle,
    debordements_socle,
    glissements: {
      total: glissTotal,
      convergent_socle: glissConvergent,
      repartition_origine
    },
    verbatims_cles,
    vues_ensemble_piliers
  };

  const { result, cost } = await agentBase.callAgent({
    serviceName: 'bilan_fable_PB',
    promptPath:  PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId: candidat_id
  });

  if (!result || !result.filtre || !result.ch4_filtre_preuves) {
    throw new Error('P-B: sortie agent invalide (filtre / preuves manquants)');
  }

  // ─── écriture (patch des champs Fable du record bilan) ──────────────────
  const fields = {};
  fields[PB.filtre]                = result.filtre;
  fields[PB.filtre_declinaison]    = result.filtre_declinaison || '';
  fields[PB.ch4_filtre_revelation] = result.ch4_filtre_revelation || '';
  fields[PB.ch4_filtre_preuves]    = result.ch4_filtre_preuves;
  fields[PB.schema_intro_roles]    = result.schema_intro_roles || '';
  fields[PB.schema_legende_socle]  = result.schema_legende_socle || '';

  await airtableService.upsertEtape1T3Bilan(candidat_id, fields);

  const elapsedMs = Date.now() - startTime;
  logger.info('P-B — terminé', {
    candidat_id, glissements: glissTotal, convergent: glissConvergent,
    debordements: debordements_socle.length, cost, elapsedMs
  });

  return { candidat_id, cost };
}

module.exports = { runFiltreEtChapitre4 };
