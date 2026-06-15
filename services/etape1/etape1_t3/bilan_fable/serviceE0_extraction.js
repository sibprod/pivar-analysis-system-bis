// services/etape1/bilan_fable/serviceE0_extraction.js
// É0 — EXTRACTION & DÉRIVATIONS — v4.0 (14/06/2026)
// Source unique : DOSSIER_AGENT_FABLE5_v1.md + prompts Fable + base Cécile
//
// SOURCES (doctrine §1 dossier) :
//   INVENTAIRE_CIRCUITS tblUHZjXIW9jp9nIf → coeur/total autoritaires
//   T3_CIRCUIT tblLAC4dS25v6IUbs → verbatim_1..4+refs + en_svc_Px (sortants RÈGLE GRAVÉE)
//   T3_PILIER tblzDIn7P2cOvVvY2 → mode existant fldoGY71vyiaUeFl6
//   T3_BILAN tblv775KQrEhsogdI → architecture rôles
//   ETAPE1_T2 tblaGd3ixAWxbJJp2 → signal_limbique fldnDxnEc3uLoAknN + synthèse fldYZIvT2gMtumy6O
//   REFERENTIEL_PILIERS tblf4OodQ2Qi5xSXs → libellés fldI2u7FxkWhdGoot (jamais hardcodés)
//
// SORTIE : { candidat_id, piliers[] } — payload pour P-A×5, P-B, P-C, P-D

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const logger          = require('../../../../utils/logger');

// fldIDs INVENTAIRE_CIRCUITS
const INV = {
  candidat_id:  'fldWInB63lYApVz8G',
  pilier:       'fldSudlYoCeU2cOqz',  // singleSelect → .name
  circuit_id:   'fldPF1xvYiONGiOAA',  // "C12"
  code_complet: 'fldjbr1Ej7Dosb6S6',  // "P3C12"
  coeur:        'fld76259zIzR6XVRB',
  total:        'fldzV8udGk3eQ58No',
  adhoc:        'fldgAjStrMoLleMbA',  // 1=ADHOC
};

// fldIDs T3_CIRCUIT verbatims (dossier §1)
const VERB = [
  { t: 'fldLP9juCWCTlCZPt', r: 'fldI1DVJiH7EH4zel' },
  { t: 'fldSCQD9zvgRQcuq9', r: 'fldmVPwfku0vUz6xX' },
  { t: 'fldhIp3aW72WR2V1t', r: 'fldcQ7hxyRumcc1DO' },
  { t: 'fld4lrLWySRXVmvZe', r: 'fldQgruSXveuTCLM4' },
];

// fldID T3_PILIER mode
const FLD_MODE = 'fldoGY71vyiaUeFl6';

// fldIDs T2
const T2 = {
  candidat_id:     'fldbHyiLdkkRU6B0J',
  pilier:          'fldkByLh883MLtHB3',
  circuit_id:      'fldf3Rfux16asTI0I',
  signal_limbique: 'fldnDxnEc3uLoAknN',
  synthese_pilier: 'fldYZIvT2gMtumy6O',
};

// fldID REFERENTIEL_PILIERS
const FLD_PIL_NOM = 'fldI2u7FxkWhdGoot';

// Seuils niveau (doctrine §2.8)
function niveauFromCoeur(n) {
  if (n >= 4) return 'HAUT';
  if (n >= 2) return 'MOYEN';
  if (n === 1) return 'FAIBLE';
  return 'EN_SOUTIEN';
}

// Parse ref "PxQn Lieu"
function parseRef(s) {
  const m = /^(P\d+Q\d+)\s+(.+)$/.exec((s || '').trim());
  return m ? { qid: m[1], lieu: m[2] } : { qid: (s||'').trim(), lieu: '' };
}

// Verbatims depuis T3_CIRCUIT verbatim_1..4
function extraireVerbatims(rec) {
  return VERB.map(f => {
    const texte = (rec[f.t] || '').trim();
    if (!texte) return null;
    const { qid, lieu } = parseRef(rec[f.r]);
    return { qid, lieu, texte };
  }).filter(Boolean);
}

// Architecture rôles
const ARCH_MAP = [
  ['pilier_socle', 'socle',       'socle'],
  ['pilier_str1',  'amont',       'str1'],
  ['pilier_str2',  'aval',        'str2'],
  ['pilier_fn1',   'fonctionnel', 'fn1'],
  ['pilier_fn2',   'fonctionnel', 'fn2'],
];

async function buildContexteE0({ candidat_id }) {
  const t = Date.now();
  logger.info('É0 v4 — démarrage', { candidat_id });

  const [inventaire, t3circuits, t3piliers, bilan, t2rows, piliersRef] = await Promise.all([
    airtableService.getEtape1T2InventaireCircuits(candidat_id),
    airtableService.getEtape1T3Circuits(candidat_id),
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T3Bilan(candidat_id),
    airtableService.getEtape1T2Fable(candidat_id),  // tblaGd3ixAWxbJJp2 — verbatims circuits Fable
    airtableService.getReferentielPiliers(),
  ]);

  if (!inventaire?.length) throw new Error(`É0: INVENTAIRE vide pour ${candidat_id}`);
  if (!bilan)              throw new Error(`É0: T3_BILAN absent pour ${candidat_id}`);

  // Libellés officiels
  const nomParPilier = {};
  for (const p of (piliersRef || [])) {
    const code = p.pilier_code || '';
    const nom  = p[FLD_PIL_NOM] || p.pilier_nom || '';
    if (code && nom) nomParPilier[code] = nom;
  }

  // Architecture rôles
  const roleParPilier = {}, slotParPilier = {}, ordre = [];
  for (const [champ, role, slot] of ARCH_MAP) {
    const code = bilan[champ];
    if (code && /^P[1-5]$/.test(code)) {
      roleParPilier[code] = role; slotParPilier[code] = slot;
      if (!ordre.includes(code)) ordre.push(code);
    }
  }

  // Modes existants T3_PILIER
  const modeParPilier = {};
  for (const p of (t3piliers || [])) {
    const code = p.pilier || p[config.ETAPE1_T3_PILIER_FIELDS?.pilier] || '';
    const mode = p[FLD_MODE] || p.pilier_mode || '';
    if (code) modeParPilier[code] = mode;
  }

  // Signal + synthèse par pilier depuis T2
  const signalParPilier = {}, synthParPilier = {};
  for (const r of (t2rows || [])) {
    const pil = r[T2.pilier] || '';
    if (!pil) continue;
    if (!signalParPilier[pil] && r[T2.signal_limbique]) signalParPilier[pil] = r[T2.signal_limbique];
    if (!synthParPilier[pil]  && r[T2.synthese_pilier]) synthParPilier[pil]  = r[T2.synthese_pilier];
  }

  // INVENTAIRE → coeur/total autoritaires
  const invByCode = {};
  for (const r of inventaire) {
    const code = r[INV.code_complet] || '';
    if (!code) continue;
    const pilierVal = r[INV.pilier];
    const pilier = typeof pilierVal === 'object' ? pilierVal.name : String(pilierVal || '');
    invByCode[code] = {
      code, circuit_id: String(r[INV.circuit_id] || ''), pilier,
      coeur: Number(r[INV.coeur] || 0), total: Number(r[INV.total] || 0),
      adhoc: Number(r[INV.adhoc] || 0) === 1,
    };
    if (pilier && /^P[1-5]$/.test(pilier) && !ordre.includes(pilier)) {
      roleParPilier[pilier] = 'fonctionnel'; slotParPilier[pilier] = 'fn2'; ordre.push(pilier);
    }
  }

  // T3_CIRCUIT → verbatims EXACTS + sortants en_svc_Px (RÈGLE GRAVÉE)
  // getEtape1T3Circuits utilise _mapByFieldIds → champs accessibles par CLÉ LISIBLE
  // (pas par fldID). On accède donc par r.pilier, r.circuit_id, r.en_svc_P1...
  const t3cByCode = {};
  for (const r of (t3circuits || [])) {
    const pil = r.pilier       || '';
    const cid = r.circuit_id   || '';
    if (!pil || !cid) continue;
    const code = `${pil}${cid}`;
    t3cByCode[code] = {
      verbatims: extraireVerbatims(r),
      sortants: {
        P1: Number(r.en_svc_P1 || 0), P2: Number(r.en_svc_P2 || 0),
        P3: Number(r.en_svc_P3 || 0), P4: Number(r.en_svc_P4 || 0),
        P5: Number(r.en_svc_P5 || 0),
      },
    };
  }

  // Sous-totaux instrumentaux SORTANTS (ce pilier → chaque Pj)
  function sousTotaux(pilier_code) {
    const tot = { P1:0, P2:0, P3:0, P4:0, P5:0 };
    for (const [code, data] of Object.entries(t3cByCode)) {
      if (!code.startsWith(pilier_code)) continue;
      for (const pj of ['P1','P2','P3','P4','P5'])
        if (pj !== pilier_code) tot[pj] += (data.sortants[pj] || 0);
    }
    return tot;
  }

  // Assemblage piliers
  const piliers = [];
  for (const pilier_code of ordre) {
    const circuitsInv = Object.values(invByCode).filter(c => c.pilier === pilier_code);
    if (!circuitsInv.length) { logger.warn(`É0: aucun circuit pour ${pilier_code}`, { candidat_id }); continue; }

    const aDuCoeur = circuitsInv.some(c => c.coeur > 0);
    const circuits = circuitsInv.map(inv => {
      const t3c = t3cByCode[inv.code] || { verbatims: [], sortants: {} };
      const sortants = {};
      for (const pj of ['P1','P2','P3','P4','P5'])
        if (pj !== pilier_code && (t3c.sortants[pj]||0) > 0) sortants[pj] = t3c.sortants[pj];
      return {
        code: inv.code, nom: inv.circuit_id,
        coeur: inv.coeur, total: inv.total,
        niveau: niveauFromCoeur(inv.coeur),
        adhoc: inv.adhoc, sortants,
        verbatims: t3c.verbatims,
      };
    }).sort((a, b) => (b.coeur - a.coeur) || (b.total - a.total));

    const modeExistant = modeParPilier[pilier_code] || '';
    piliers.push({
      pilier_code, pilier_nom: nomParPilier[pilier_code] || pilier_code,
      pilier_role: roleParPilier[pilier_code] || 'fonctionnel',
      role_slot:   slotParPilier[pilier_code] || 'fn2',
      pilier_mode: modeExistant,
      mode_statut: modeExistant ? 'FOURNI' : 'A_PROPOSER',
      echelle_classement: aDuCoeur ? 'coeur' : 'total',
      signal_limbique:    signalParPilier[pilier_code] || '',
      synth_factuelle_coeur: synthParPilier[pilier_code] || '',
      sous_totaux_instrumentaux: sousTotaux(pilier_code),
      circuits,
    });
  }

  if (!piliers.length) throw new Error(`É0: aucun pilier assemblé pour ${candidat_id}`);
  logger.info('É0 v4 — terminée', { candidat_id, nb_piliers: piliers.length, elapsedMs: Date.now()-t });
  return { candidat_id, piliers };
}

module.exports = { buildContexteE0 };
