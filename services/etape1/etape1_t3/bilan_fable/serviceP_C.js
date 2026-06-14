// services/etape1/bilan_fable/serviceP_C.js
// P-C — CHAPITRE II : LES BOUCLES (chaîne bilan FABLE) — v1.0 (13/06/2026)
//
// Rôle : décrit la trajectoire des outils à l'intérieur des réponses — 4 maillons
// (départ / dialogue / débouché / jamais). Appelle PROMPT_CH2_BOUCLES_v1 une fois.
//
// ENTRÉES (assemblées ici, dénominateur figé = nb de réponses T1) :
//   - rôles + modes validés ............ T3_BILAN (architecture) + T3_PILIER
//   - libellés .......................... REFERENTIEL_PILIERS
//   - métriques de maillons ............. calculées depuis ETAPE1_T1 :
//       · M1 gouvernees = nb de réponses gouvernées par le socle (pilier_coeur == socle)
//       · adjacences = transitions consécutives dans la SÉQUENCE intra-réponse,
//         déduite de l'ORDRE des activations du champ types_verbatim_circuits
//         (on réutilise le parseur déterministe d'É0). M2 aller/retour, M3 n.
//       · M4 = trajectoire absente : l'aval ne gouverne aucune réponse (comptage direct).
//
//   ⚠️ ZONE DE JUGEMENT NON FORMALISÉE — M2b (sens socle→amont) :
//     l'étalon valide « 8 adjacences brutes − 2 exclusions sémantiques = 6 ». Ces
//     exclusions (« auto-évaluation rassurante », « fragment instrumental ») sont un
//     jugement non encore formalisé en règle déterministe. Ce service fournit le
//     compte BRUT (retour_brut) et NE l'invente pas. Tant qu'une règle d'exclusion
//     (ou un agent d'audit dédié) n'est pas défini, retour peut dépasser la valeur
//     validée de l'étalon. À trancher (doctrine).
//
// SORTIE (contrat verrouillé) → T3_BILAN via upsertEtape1T3Bilan :
//   intro → boucle_intro_texte ; technique → boucle_technique ;
//   maillons[0..3] → maillon_m1_depart / m2_dialogue / m3_debouche / m4_jamais
//   (chacun au FORMAT STOCKÉ vérifié en base : « badge · titre / Attesté / VERBATIMS / TEXTE »).

'use strict';

const config          = require('../../../config/airtable');
const airtableService = require('../../infrastructure/airtableService');
const agentBase       = require('../../infrastructure/agentBase');
const logger          = require('../../../utils/logger');
const { _internal }   = require('./serviceE0_extraction');
const { parseAttribution, ownerPilier } = _internal;

const PROMPT_PATH = 'etape1/bilan/PROMPT_CH2_BOUCLES_v1.md';
const PB = config.ETAPE1_T3_BILAN_FIELDS;

const SLOT_ROLE = { socle: 'socle', str1: 'amont', str2: 'aval', fn1: 'fonctionnel', fn2: 'fonctionnel' };

// lit l'attribution ordonnée d'une ligne T1 (champ hors config, par son nom)
function lireAttribution(row) {
  return row.types_verbatim_circuits || row['types_verbatim_circuits'] || '';
}

// séquence intra-réponse des piliers (ordre des activations, doublons consécutifs fusionnés)
function pilierSequence(attrStr) {
  const seq = [];
  for (const it of parseAttribution(attrStr)) {
    const o = ownerPilier(it.code);
    if (o && (seq.length === 0 || seq[seq.length - 1] !== o)) seq.push(o);
  }
  return seq;
}

// la séquence contient-elle la transition consécutive a→b ?
function aTransition(seq, a, b) {
  for (let i = 0; i < seq.length - 1; i++) {
    if (seq[i] === a && seq[i + 1] === b) return true;
  }
  return false;
}

// assemble un maillon au format stocké vérifié en base
function formatMaillon(m) {
  const lignes = [];
  lignes.push(`${(m.badge || '').trim()} · ${(m.titre || '').trim()}`.trim());
  if (m.attest) lignes.push(m.attest);
  lignes.push('VERBATIMS :');
  lignes.push(m.verbatims || '');
  lignes.push('TEXTE :');
  lignes.push(m.texte || '');
  return lignes.join('\n');
}

function parseVerbatimsField(raw) {
  if (!raw) return [];
  const out = []; const re = /«\s*([\s\S]*?)\s*»\s*\(([^\s)]+)\s+([^)]+)\)/g; let m;
  while ((m = re.exec(raw)) !== null) out.push({ texte: m[1].trim(), qid: m[2].trim(), lieu: m[3].trim() });
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════

/**
 * Produit le chapitre II (boucles) et écrit intro + 4 maillons + technique.
 * @param {Object} p
 * @param {string} p.candidat_id
 * @param {string} [p.prenom]
 * @returns {Promise<{candidat_id, cost}>}
 */
async function runBoucles({ candidat_id, prenom = '' }) {
  const startTime = Date.now();
  logger.info('P-C — démarrage chapitre II (boucles)', { candidat_id });

  const [piliers, circuits, bilan, t1, piliersRef] = await Promise.all([
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T3Circuits(candidat_id),
    airtableService.getEtape1T3Bilan(candidat_id),
    airtableService.getEtape1T1(candidat_id),
    airtableService.getReferentielPiliers()
  ]);
  if (!bilan) throw new Error(`P-C: T3_BILAN absent pour ${candidat_id}`);
  if (!t1 || !t1.length) throw new Error(`P-C: ETAPE1_T1 absent pour ${candidat_id}`);

  const socle = bilan.pilier_socle;
  const amont = bilan.pilier_str1 || null;
  const aval  = bilan.pilier_str2 || null;
  if (!socle || !/^P[1-5]$/.test(socle)) throw new Error(`P-C: pilier_socle invalide (${socle})`);

  // libellés + rôles + modes
  const piliers_libelles = {};
  for (const p of piliersRef) if (p.pilier_code) piliers_libelles[p.pilier_code] = p.pilier_nom || '';
  const roles = {};
  for (const [champ, slot] of [['pilier_socle','socle'],['pilier_str1','str1'],['pilier_str2','str2'],['pilier_fn1','fn1'],['pilier_fn2','fn2']]) {
    const code = bilan[champ];
    if (code && /^P[1-5]$/.test(code)) roles[code] = SLOT_ROLE[slot];
  }
  const modes_valides = {};
  for (const p of piliers) if (p.pilier && p.pilier_mode) modes_valides[p.pilier] = p.pilier_mode;

  const total = t1.length;

  // ─── métriques de maillons depuis T1 ────────────────────────────────────
  let gouverneeSocle = 0, gouverneeAval = 0;
  let m2_aller = 0, m2_retour_brut = 0;   // amont→socle / socle→amont (BRUT)
  let m3_n = 0;                           // gouverné socle ∧ socle→aval
  for (const row of t1) {
    const gov = row.pilier_coeur;
    const seq = pilierSequence(lireAttribution(row));
    if (gov === socle) gouverneeSocle += 1;
    if (aval && gov === aval) gouverneeAval += 1;
    if (amont) {
      if (aTransition(seq, amont, socle)) m2_aller += 1;
      if (aTransition(seq, socle, amont)) m2_retour_brut += 1;
    }
    if (aval && gov === socle && aTransition(seq, socle, aval)) m3_n += 1;
  }

  // ─── pool de verbatims de trajectoire (circuits HAUT du socle) ──────────
  const verbatims_trajectoires = [];
  for (const c of circuits.filter(c => c.pilier === socle && c.circuit_niveau === 'HAUT')) {
    for (const v of parseVerbatimsField(c.n2_verbatims)) {
      verbatims_trajectoires.push({ qid: v.qid, lieu: v.lieu, texte: v.texte, maillon: 1 });
    }
  }

  // ─── payload P-C ────────────────────────────────────────────────────────
  const payload = {
    candidat_prenom: prenom,
    piliers_libelles,
    roles,
    modes_valides,
    maillon1: { pilier: socle, gouvernees: gouverneeSocle, total },
    maillon2: amont
      ? { de: socle, vers: amont, aller: m2_aller, retour: m2_retour_brut }
      : null,
    maillon3: aval
      ? { de: socle, vers: aval, n: m3_n, total }
      : null,
    // M4 : trajectoire absente la plus signifiante — l'aval ne gouverne aucune réponse
    maillon4: aval
      ? { de: aval, vers: socle, n: gouverneeAval, lecture: '' }
      : null,
    verbatims_trajectoires,
    // transparence pour l'agent / audit : le retour M2 est BRUT (exclusions non appliquées)
    _note_m2b: 'retour = adjacences brutes socle→amont ; exclusions sémantiques non appliquées (zone de jugement)'
  };

  const { result, cost } = await agentBase.callAgent({
    serviceName: 'bilan_fable_PC',
    promptPath:  PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId: candidat_id
  });

  if (!result || !Array.isArray(result.maillons) || result.maillons.length < 4) {
    throw new Error('P-C: sortie agent invalide (4 maillons attendus)');
  }

  // ─── écriture (patch T3_BILAN) ──────────────────────────────────────────
  const M = result.maillons;
  const fields = {};
  fields[PB.boucle_intro_texte] = result.intro || '';
  fields[PB.boucle_technique]   = result.technique || '';
  fields[PB.maillon_m1_depart]   = formatMaillon(M[0]);
  fields[PB.maillon_m2_dialogue] = formatMaillon(M[1]);
  fields[PB.maillon_m3_debouche] = formatMaillon(M[2]);
  fields[PB.maillon_m4_jamais]   = formatMaillon(M[3]);

  await airtableService.upsertEtape1T3Bilan(candidat_id, fields);

  const elapsedMs = Date.now() - startTime;
  logger.info('P-C — terminé', {
    candidat_id, m1_socle: gouverneeSocle, m2_aller, m2_retour_brut, m3_n, m4_aval_gouv: gouverneeAval,
    cost, elapsedMs
  });

  return { candidat_id, cost };
}

module.exports = { runBoucles };
