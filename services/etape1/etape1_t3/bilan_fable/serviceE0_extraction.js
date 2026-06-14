// services/etape1/bilan_fable/serviceE0_extraction.js
// É0 — EXTRACTION & DÉRIVATIONS (chaîne bilan FABLE) — v3.0 (14/06/2026)
//
// BASE DE TRAVAIL UNIQUE : DOSSIER_AGENT_FABLE5_v1.md
//
// ═══════════════════════════════════════════════════════════════════════════
// SOURCES — section 1 du dossier, règles gravées
// ═══════════════════════════════════════════════════════════════════════════
//
//  ETAPE1_T2_INVENTAIRE_CIRCUITS (tblUHZjXIW9jp9nIf)
//    ★ SOURCE AUTORITAIRE ET UNIQUE pour coeur/total par circuit.
//    Jamais ETAPE1_T2_VENTILATION_PILIERS (cross-check seulement).
//    Champs lus (returnFieldsByFieldId:true obligatoire) :
//      fldWInB63lYApVz8G  candidat_id
//      fldSudlYoCeU2cOqz  pilier (singleSelect → .name)
//      fldPF1xvYiONGiOAA  circuit_id  ("C12")
//      fldjbr1Ej7Dosb6S6  circuit_code_complet  ("P3C12")
//      fld76259zIzR6XVRB  nb_coeur    (autoritaire)
//      fldzV8udGk3eQ58No  total_activations  (autoritaire)
//      fldgAjStrMoLleMbA  adhoc  (number : 1 = ADHOC, 0 = OFFICIEL)
//
//  ETAPE1_T3_CIRCUIT (tblLAC4dS25v6IUbs)
//    Usage É0 : verbatims EXACTS (qid/lieu/texte) + sortants en_svc_Px.
//    ★ JAMAIS pour coeur/total (erreur du 10/06 corrigée).
//    ★ en_svc_Px = SOURCE UNIQUE des sortants (jamais INVENTAIRE.nb_svc_Px, corrompu).
//    Champs lus (fldIDs du dossier §1) :
//      fldk66gddYGCREOV4  candidat_id  ← filtre SDK
//      [pilier, circuit_id : via config ETAPE1_T3_CIRCUIT_FIELDS]
//      fldLP9juCWCTlCZPt  verbatim_1       fldI1DVJiH7EH4zel  verbatim_1_ref
//      fldSCQD9zvgRQcuq9  verbatim_2       fldmVPwfku0vUz6xX  verbatim_2_ref
//      fldhIp3aW72WR2V1t  verbatim_3       fldcQ7hxyRumcc1DO  verbatim_3_ref
//      fld4lrLWySRXVmvZe  verbatim_4       fldQgruSXveuTCLM4  verbatim_4_ref
//      [en_svc_P1..P5 : via config ETAPE1_T3_CIRCUIT_FIELDS]
//
//  ETAPE1_T3_PILIER (tblzDIn7P2cOvVvY2)
//    Lecture du mode existant (pilier_mode = fldoGY71vyiaUeFl6) pour chaque pilier.
//    Si présent → statut FOURNI (recopié) ; si absent → statut PROPOSITION (P-A propose).
//
//  ETAPE1_T3_BILAN (tblv775KQrEhsogdI)
//    Architecture des rôles : pilier_socle / pilier_str1 / pilier_str2 / pilier_fn1 / pilier_fn2.
//    Filtre SDK : fldID fldk66gddYGCREOV4 (règle absolue §1).
//
//  REFERENTIEL_PILIERS (tblf4OodQ2Qi5xSXs)
//    pilier_nom = fldI2u7FxkWhdGoot — SEULE source des libellés officiels, jamais hardcodés.
//
// ═══════════════════════════════════════════════════════════════════════════
// SORTIE — payload pour P-A (×5), P-B, P-C, P-D
// ═══════════════════════════════════════════════════════════════════════════
// {
//   candidat_id,
//   piliers: [                           // ordre : socle → str1 → str2 → fn1 → fn2
//     {
//       pilier_code,                     // "P3"
//       pilier_nom,                      // depuis REFERENTIEL_PILIERS
//       pilier_role,                     // "socle"|"amont"|"aval"|"fonctionnel"
//       role_slot,                       // "socle"|"str1"|"str2"|"fn1"|"fn2"
//       pilier_mode,                     // depuis T3_PILIER si présent, '' sinon
//       mode_statut,                     // "FOURNI" | "A_PROPOSER"
//       echelle_classement,              // "coeur" | "total"
//       sous_totaux_instrumentaux,       // { P1,P2,P3,P4,P5 } — sortants de ce pilier
//       circuits: [
//         {
//           code,      // "P3C12"
//           nom,       // depuis REFERENTIEL_CIRCUITS (non chargé ici — nom de T3_CIRCUIT si dispo)
//           coeur,     // INVENTAIRE (autoritaire)
//           total,     // INVENTAIRE (autoritaire)
//           niveau,    // calculé depuis coeur (seuils doctrine §2.8)
//           adhoc,     // boolean
//           sortants,  // { P1:n, ... } — depuis T3_CIRCUIT.en_svc_Px (fldIDs config)
//           verbatims  // [ { qid, lieu, texte } ] — depuis T3_CIRCUIT verbatim_1..4
//         }
//       ]
//     }
//   ]
// }

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const logger          = require('../../../../utils/logger');

// ─── fldIDs INVENTAIRE_CIRCUITS (source autoritaire coeur/total) ─────────────
const INV = {
  candidat_id:  'fldWInB63lYApVz8G',
  pilier:       'fldSudlYoCeU2cOqz',   // singleSelect → .name
  circuit_id:   'fldPF1xvYiONGiOAA',   // "C12"
  code_complet: 'fldjbr1Ej7Dosb6S6',   // "P3C12"
  coeur:        'fld76259zIzR6XVRB',
  total:        'fldzV8udGk3eQ58No',
  adhoc:        'fldgAjStrMoLleMbA',   // number : 1 = ADHOC
};

// ─── fldIDs T3_CIRCUIT verbatims (dossier §1) ────────────────────────────────
const T3C_VERB = {
  verbatim_1:     'fldLP9juCWCTlCZPt',
  verbatim_1_ref: 'fldI1DVJiH7EH4zel',
  verbatim_2:     'fldSCQD9zvgRQcuq9',
  verbatim_2_ref: 'fldmVPwfku0vUz6xX',
  verbatim_3:     'fldhIp3aW72WR2V1t',
  verbatim_3_ref: 'fldcQ7hxyRumcc1DO',
  verbatim_4:     'fld4lrLWySRXVmvZe',
  verbatim_4_ref: 'fldQgruSXveuTCLM4',
};

// ─── fldID T3_PILIER mode ─────────────────────────────────────────────────────
const T3P_MODE = 'fldoGY71vyiaUeFl6';

// ─── fldID REFERENTIEL_PILIERS nom ────────────────────────────────────────────
const REF_PIL_NOM = 'fldI2u7FxkWhdGoot';

// ─── Seuils de niveau échelle CŒUR — doctrine §2.8 ───────────────────────────
function niveauFromCoeur(coeur) {
  if (coeur >= 4) return 'HAUT';
  if (coeur >= 2) return 'MOYEN';
  if (coeur === 1) return 'FAIBLE';
  return 'EN_SOUTIEN';          // coeur = 0, instrumental pur
}

// ─── Architecture rôles ──────────────────────────────────────────────────────
const ARCH_MAP = [
  ['pilier_socle', 'socle',       'socle'],
  ['pilier_str1',  'amont',       'str1'],
  ['pilier_str2',  'aval',        'str2'],
  ['pilier_fn1',   'fonctionnel', 'fn1'],
  ['pilier_fn2',   'fonctionnel', 'fn2'],
];

// ─── Parse ref verbatim "PxQn Lieu" → { qid, lieu } ─────────────────────────
function parseRef(ref) {
  if (!ref) return { qid: '', lieu: '' };
  const m = /^(P\d+Q\d+)\s+(.+)$/.exec(ref.trim());
  return m ? { qid: m[1], lieu: m[2] } : { qid: ref.trim(), lieu: '' };
}

// ─── Extrait les verbatims d'un record T3_CIRCUIT ────────────────────────────
// Retourne [ { qid, lieu, texte } ] — uniquement les slots remplis.
function extraireVerbatims(rec) {
  const out = [];
  const slots = [
    [T3C_VERB.verbatim_1, T3C_VERB.verbatim_1_ref],
    [T3C_VERB.verbatim_2, T3C_VERB.verbatim_2_ref],
    [T3C_VERB.verbatim_3, T3C_VERB.verbatim_3_ref],
    [T3C_VERB.verbatim_4, T3C_VERB.verbatim_4_ref],
  ];
  for (const [fldTexte, fldRef] of slots) {
    const texte = (rec[fldTexte] || '').trim();
    if (!texte) continue;
    const { qid, lieu } = parseRef(rec[fldRef] || '');
    out.push({ qid, lieu, texte });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construit le payload É0 par pilier pour la chaîne bilan FABLE.
 *
 * Sources (dossier §1, règles gravées) :
 *   INVENTAIRE_CIRCUITS → coeur/total (autoritaires)
 *   T3_CIRCUIT          → verbatims exacts + sortants en_svc_Px
 *   T3_PILIER           → mode existant par pilier
 *   T3_BILAN            → architecture des rôles
 *   REFERENTIEL_PILIERS → libellés officiels
 *
 * @param {{ candidat_id: string }} p
 * @returns {Promise<{ candidat_id: string, piliers: Array }>}
 */
async function buildContexteE0({ candidat_id }) {
  const startTime = Date.now();
  logger.info('É0 v3 — démarrage', { candidat_id });

  // ─── 1. Lectures parallèles des 5 sources ──────────────────────────────
  const [inventaire, t3circuits, t3piliers, bilan, piliersRef] = await Promise.all([
    airtableService.getEtape1T2InventaireCircuits(candidat_id),
    airtableService.getEtape1T3Circuits(candidat_id),
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T3Bilan(candidat_id),
    airtableService.getReferentielPiliers(),
  ]);

  // ─── 2. Gardes ─────────────────────────────────────────────────────────
  if (!inventaire || inventaire.length === 0)
    throw new Error(`É0: aucun record INVENTAIRE_CIRCUITS pour ${candidat_id}`);
  if (!bilan)
    throw new Error(`É0: aucun record T3_BILAN pour ${candidat_id}`);

  // ─── 3. Libellés officiels piliers (jamais hardcodés — §2.7) ───────────
  const nomParPilier = {};
  for (const p of (piliersRef || [])) {
    const code = p.pilier_code || '';
    const nom  = p[REF_PIL_NOM] || p.pilier_nom || '';
    if (code && nom) nomParPilier[code] = nom;
  }

  // ─── 4. Architecture des rôles depuis T3_BILAN ─────────────────────────
  const roleParPilier = {};
  const slotParPilier = {};
  const ordrePiliers  = [];
  for (const [champ, role, slot] of ARCH_MAP) {
    const code = bilan[champ];
    if (code && /^P[1-5]$/.test(code)) {
      roleParPilier[code] = role;
      slotParPilier[code] = slot;
      if (!ordrePiliers.includes(code)) ordrePiliers.push(code);
    }
  }

  // ─── 5. Modes existants depuis T3_PILIER ───────────────────────────────
  // Source : fldoGY71vyiaUeFl6 — permanence stricte §2.6.
  // Si présent → FOURNI (P-A recopie) ; absent → A_PROPOSER (P-A propose).
  const modeParPilier = {};
  for (const p of (t3piliers || [])) {
    const code = p.pilier || p[config.ETAPE1_T3_PILIER_FIELDS?.pilier] || '';
    const mode = p[T3P_MODE] || p.pilier_mode || '';
    if (code) modeParPilier[code] = mode;
  }

  // ─── 6. INVENTAIRE → coeur/total autoritaires, adhoc ──────────────────
  // Indexé par code complet "P3C12".
  const invByCode = {};
  for (const r of inventaire) {
    const code = r[INV.code_complet] || '';
    if (!code) continue;
    const pilierVal = r[INV.pilier];
    const pilier    = typeof pilierVal === 'object' ? pilierVal.name : String(pilierVal || '');
    invByCode[code] = {
      code,
      circuit_id: String(r[INV.circuit_id] || ''),
      pilier,
      coeur: Number(r[INV.coeur] || 0),
      total: Number(r[INV.total] || 0),
      adhoc: Number(r[INV.adhoc] || 0) === 1,
    };
    // Filet : pilier présent dans INVENTAIRE mais absent de T3_BILAN → fonctionnel
    if (pilier && /^P[1-5]$/.test(pilier) && !ordrePiliers.includes(pilier)) {
      roleParPilier[pilier] = 'fonctionnel';
      slotParPilier[pilier] = 'fn2';
      ordrePiliers.push(pilier);
    }
  }

  // ─── 7. T3_CIRCUIT → verbatims EXACTS + sortants en_svc_Px ───────────
  // Source UNIQUE des sortants (jamais INVENTAIRE.nb_svc_Px — corrompu).
  // Indexé par code complet : pilier + circuit_id depuis config.
  const PC = config.ETAPE1_T3_CIRCUIT_FIELDS;
  const t3cByCode = {};
  for (const r of (t3circuits || [])) {
    const pilier     = r[PC.pilier]     || '';
    const circuit_id = r[PC.circuit_id] || '';
    if (!pilier || !circuit_id) continue;
    const code = `${pilier}${circuit_id}`;    // "P3" + "C12" → "P3C12"
    t3cByCode[code] = {
      verbatims: extraireVerbatims(r),
      sortants: {
        P1: Number(r[PC.en_svc_P1] || 0),
        P2: Number(r[PC.en_svc_P2] || 0),
        P3: Number(r[PC.en_svc_P3] || 0),
        P4: Number(r[PC.en_svc_P4] || 0),
        P5: Number(r[PC.en_svc_P5] || 0),
      },
    };
  }

  // ─── 8. Sous-totaux instrumentaux (SORTANTS de ce pilier vers chaque Pj) ─
  // Doctrine §3 : lecture verticale — combien les circuits de code_pilier
  // vont en service de chaque Pj. Source : T3_CIRCUIT.en_svc_Px.
  function sousTotaux(pilier_code) {
    const tot = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
    for (const [code, data] of Object.entries(t3cByCode)) {
      if (!code.startsWith(pilier_code)) continue;
      for (const pj of ['P1', 'P2', 'P3', 'P4', 'P5']) {
        if (pj !== pilier_code) tot[pj] += (data.sortants[pj] || 0);
      }
    }
    return tot;
  }

  // ─── 9. Assemblage pilier par pilier ───────────────────────────────────
  const piliers = [];

  for (const pilier_code of ordrePiliers) {
    const circuitsInv = Object.values(invByCode).filter(c => c.pilier === pilier_code);

    if (circuitsInv.length === 0) {
      logger.warn(`É0: aucun circuit INVENTAIRE pour pilier ${pilier_code}`, { candidat_id });
      continue;
    }

    // Échelle : "coeur" si au moins 1 circuit a coeur > 0 ; sinon "total" (§2.8)
    const aDuCoeur = circuitsInv.some(c => c.coeur > 0);
    const echelle  = aDuCoeur ? 'coeur' : 'total';

    const circuits = circuitsInv.map(inv => {
      const t3c      = t3cByCode[inv.code] || { verbatims: [], sortants: {} };
      const sortants = {};
      for (const pj of ['P1', 'P2', 'P3', 'P4', 'P5']) {
        if (pj !== pilier_code && (t3c.sortants[pj] || 0) > 0) {
          sortants[pj] = t3c.sortants[pj];
        }
      }
      return {
        code:      inv.code,
        nom:       inv.circuit_id,     // nom officiel : P-A le complètera depuis le prompt catalogue
        coeur:     inv.coeur,          // INVENTAIRE — autoritaire
        total:     inv.total,          // INVENTAIRE — autoritaire
        niveau:    niveauFromCoeur(inv.coeur),
        adhoc:     inv.adhoc,
        sortants,                      // T3_CIRCUIT.en_svc_Px — règle gravée
        verbatims: t3c.verbatims,      // T3_CIRCUIT verbatim_1..4 — EXACTS
      };
    });

    // Tri : coeur décroissant, puis total décroissant
    circuits.sort((a, b) => (b.coeur - a.coeur) || (b.total - a.total));

    // Mode : depuis T3_PILIER (fldoGY71vyiaUeFl6)
    const modeExistant = modeParPilier[pilier_code] || '';

    piliers.push({
      pilier_code,
      pilier_nom:                 nomParPilier[pilier_code] || pilier_code,
      pilier_role:                roleParPilier[pilier_code] || 'fonctionnel',
      role_slot:                  slotParPilier[pilier_code] || 'fn2',
      pilier_mode:                modeExistant,
      mode_statut:                modeExistant ? 'FOURNI' : 'A_PROPOSER',
      echelle_classement:         echelle,
      sous_totaux_instrumentaux:  sousTotaux(pilier_code),
      circuits,
    });
  }

  if (piliers.length === 0)
    throw new Error(`É0: aucun pilier assemblé pour ${candidat_id}`);

  logger.info('É0 v3 — terminée', {
    candidat_id,
    nb_piliers:  piliers.length,
    nb_circuits: Object.keys(invByCode).length,
    elapsedMs:   Date.now() - startTime,
  });

  return { candidat_id, piliers };
}

module.exports = { buildContexteE0 };
