// services/etape1/bilan_fable/serviceP_D.js
// P-D — CHAPITRE III : MARQUEURS LIMBIQUES & ZONES DE COÛT (FABLE) — v1.0 (13/06/2026)
//
// Rôle : nomme le paysage émotionnel du candidat (§05, les registres de signal
// limbique) et ce qu'il délimite comme zones de coût (§06). Appelle
// PROMPT_CH3_MARQUEURS_v1 une fois.
//
// RÈGLE DE SENS (verrouillée) : une zone de coût n'est PAS un manque de capacité.
//
// ENTRÉES (assemblées ici, FIGÉES) :
//   - rôles + modes validés ........... T3_BILAN + T3_PILIER
//   - libellés ........................ REFERENTIEL_PILIERS
//   - signaux + verbatims limbiques ... ETAPE1_T1.signal_limbique (fldZA9RVR3XtKEmsI),
//       format « {tonalité} · "{verbatim exact}" » ; présent sur les réponses marquées.
//       → signaux_par_pilier (agrégés par pilier_coeur) + verbatims_limbiques.
//
//   ⚠️ ATTRIBUTION DES COÛTS = JUGEMENT (non déterministe) :
//     quel pilier est coût principal / secondaire, et son libellé d'activité, sont
//     « établis par les analyses pilier validées » — ce n'est PAS le pilier_coeur des
//     réponses (l'aversion « à l'exécution » vise la Mise en œuvre, pas le pilier qui
//     gouverne la réponse où elle s'exprime). Ces coûts sont donc un PARAMÈTRE figé.
//     S'ils ne sont pas fournis, un repli heuristique (piliers à signal aversif, classés
//     par fréquence) est utilisé et SIGNALÉ — il peut diverger de l'étalon. Jamais inventé.
//
// SORTIE (contrat verrouillé) → T3_BILAN via upsertEtape1T3Bilan (formats stockés vérifiés) :
//   s05_intro ; registres (3, « titre / texte / verbatims » séparés par ligne vide) ;
//   s05_cloture ; s06_intro ; cout_principal & cout_secondaire (« label / titre / TEXTE: /
//   VERBATIMS: », verbatims rattachés ici depuis verbatims_limbiques) ; s06_cloture.
//   alerte de l'agent → journalisée.

'use strict';

const config          = require('../../../config/airtable');
const airtableService = require('../../infrastructure/airtableService');
const agentBase       = require('../../infrastructure/agentBase');
const logger          = require('../../../utils/logger');

const PROMPT_PATH = 'etape1/bilan/PROMPT_CH3_MARQUEURS_v1.md';
const PB = config.ETAPE1_T3_BILAN_FIELDS;

const SLOT_ROLE = { socle: 'socle', str1: 'amont', str2: 'aval', fn1: 'fonctionnel', fn2: 'fonctionnel' };
// marqueurs lexicaux d'un signal aversif (repli heuristique uniquement)
const MOTS_AVERSIFS = ['aversion', 'coût', 'cout', 'déteste', 'deteste', 'pénible', 'penible', 'stress', 'tension', 'n\'aime pas', 'pire'];

function lireSignal(row) {
  return row.signal_limbique || row['signal_limbique'] || '';
}

// « aversion à l'organisation · "je n'aime pas..." » → { tonalite, verbatim }
function parseSignal(raw) {
  if (!raw) return null;
  const idx = raw.indexOf('·');
  const tonalite = (idx >= 0 ? raw.slice(0, idx) : raw).trim();
  const vm = /"([^"]*)"|«\s*([\s\S]*?)\s*»/.exec(raw);
  const verbatim = vm ? (vm[1] || vm[2] || '').trim() : '';
  return { tonalite, verbatim };
}

function estAversif(tonalite) {
  const t = (tonalite || '').toLowerCase();
  return MOTS_AVERSIFS.some(m => t.includes(m));
}

function formatRegistres(registres) {
  return (registres || [])
    .map(r => [r.titre || '', r.texte || '', r.verbatims || ''].filter(Boolean).join('\n'))
    .join('\n\n');
}

function formatCout(cout, verbatimsStr) {
  const parts = [cout.label || '', cout.titre || '', 'TEXTE :', cout.texte || ''];
  if (verbatimsStr) { parts.push('VERBATIMS :'); parts.push(verbatimsStr); }
  return parts.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════

/**
 * Produit le chapitre III (marqueurs + coûts) et écrit les 7 champs T3_BILAN.
 * @param {Object} p
 * @param {string} p.candidat_id
 * @param {string} [p.prenom]
 * @param {{pilier:string, activite:string}} [p.coutPrincipal]   coût figé (sinon repli signalé)
 * @param {{pilier:string, activite:string}} [p.coutSecondaire]
 * @returns {Promise<{candidat_id, cost, alerte}>}
 */
async function runMarqueurs({ candidat_id, prenom = '', coutPrincipal = null, coutSecondaire = null }) {
  const startTime = Date.now();
  logger.info('P-D — démarrage chapitre III (marqueurs & coûts)', { candidat_id });

  const [piliers, bilan, t1, piliersRef] = await Promise.all([
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T3Bilan(candidat_id),
    airtableService.getEtape1T1(candidat_id),
    airtableService.getReferentielPiliers()
  ]);
  if (!bilan) throw new Error(`P-D: T3_BILAN absent pour ${candidat_id}`);
  if (!t1 || !t1.length) throw new Error(`P-D: ETAPE1_T1 absent pour ${candidat_id}`);

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

  // ─── signaux + verbatims limbiques depuis T1 ────────────────────────────
  const verbatims_limbiques = [];
  const signauxParPilier = {};   // pilier → [tonalités]
  for (const row of t1) {
    const sig = parseSignal(lireSignal(row));
    if (!sig || (!sig.verbatim && !sig.tonalite)) continue;
    const pil = row.pilier_coeur;
    verbatims_limbiques.push({
      qid: row.id_question || '',
      lieu: row.scenario || '',
      texte: sig.verbatim,
      pilier: pil,
      tonalite: sig.tonalite
    });
    if (pil) (signauxParPilier[pil] = signauxParPilier[pil] || []).push(sig.tonalite);
  }
  // signaux_par_pilier : on transmet la tonalité dominante (1re rencontrée) par pilier
  const signaux_par_pilier = {};
  for (const pil of Object.keys(signauxParPilier)) signaux_par_pilier[pil] = signauxParPilier[pil][0];

  // ─── coûts : paramètre figé, sinon repli heuristique SIGNALÉ ────────────
  let cp = coutPrincipal, cs = coutSecondaire, reculHeuristique = false;
  if (!cp || !cs) {
    reculHeuristique = true;
    const aversifsCount = {};
    for (const v of verbatims_limbiques) {
      if (estAversif(v.tonalite) && v.pilier) aversifsCount[v.pilier] = (aversifsCount[v.pilier] || 0) + 1;
    }
    const classes = Object.keys(aversifsCount).sort((a, b) => aversifsCount[b] - aversifsCount[a]);
    if (!cp && classes[0]) cp = { pilier: classes[0], activite: piliers_libelles[classes[0]] || classes[0] };
    if (!cs && classes[1]) cs = { pilier: classes[1], activite: piliers_libelles[classes[1]] || classes[1] };
    logger.warn('P-D: attribution des coûts par repli heuristique (peut diverger de l\'étalon — zone de jugement)', {
      candidat_id, cout_principal: cp, cout_secondaire: cs
    });
  }
  if (!cp || !cs) throw new Error('P-D: coûts principal/secondaire indéterminés (aucun signal aversif et aucun paramètre fourni)');

  // verbatims rattachés à chaque coût (depuis les verbatims limbiques du pilier concerné)
  const verbStr = (pilier) => verbatims_limbiques
    .filter(v => v.pilier === pilier)
    .map(v => `« ${v.texte} » (${v.qid} ${v.lieu})`)
    .join(' · ');

  // ─── payload P-D ────────────────────────────────────────────────────────
  const payload = {
    candidat_prenom: prenom,
    piliers_libelles,
    roles,
    modes_valides,
    signaux_par_pilier,
    cout_principal: { pilier: cp.pilier, activite: cp.activite },
    cout_secondaire: { pilier: cs.pilier, activite: cs.activite },
    verbatims_limbiques
  };

  const { result, cost } = await agentBase.callAgent({
    serviceName: 'bilan_fable_PD',
    promptPath:  PROMPT_PATH,
    payload,
    injectLexique: true,
    candidatId: candidat_id
  });

  if (!result || !Array.isArray(result.registres) || !result.cout_principal) {
    throw new Error('P-D: sortie agent invalide (registres / coût principal manquants)');
  }
  if (result.alerte) {
    logger.warn('P-D: alerte agent (matière insuffisante signalée)', { candidat_id, alerte: result.alerte });
  }

  // ─── écriture (patch T3_BILAN, formats stockés vérifiés) ────────────────
  const fields = {};
  fields[PB.s05_intro]      = result.s05_intro || '';
  fields[PB.registres]      = formatRegistres(result.registres);
  fields[PB.s05_cloture]    = result.s05_cloture || '';
  fields[PB.s06_intro]      = result.s06_intro || '';
  fields[PB.cout_principal] = formatCout(result.cout_principal, verbStr(cp.pilier));
  fields[PB.cout_secondaire] = formatCout(result.cout_secondaire || { label: 'Coût secondaire' }, verbStr(cs.pilier));
  fields[PB.s06_cloture]    = result.s06_cloture || '';

  await airtableService.upsertEtape1T3Bilan(candidat_id, fields);

  const elapsedMs = Date.now() - startTime;
  logger.info('P-D — terminé', {
    candidat_id, registres: result.registres.length, recul_heuristique_couts: reculHeuristique,
    cost, elapsedMs
  });

  return { candidat_id, cost, alerte: result.alerte || '' };
}

module.exports = { runMarqueurs };
