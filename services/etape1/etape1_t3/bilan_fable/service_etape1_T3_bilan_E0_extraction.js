// services/etape1/etape1_t3/bilan_fable/serviceE0_extraction.js
// É0 — EXTRACTION & DÉRIVATIONS — v5.0 (15/06/2026)
//
// CORRECTION FONDAMENTALE v5.0 :
// É0 ne lit QUE les tables produites AVANT la chaîne bilan.
// T3_BILAN et T3_CIRCUIT sont des SORTIES — ils n'existent pas encore au démarrage.
//
// SOURCES (toutes antérieures à la chaîne) :
//   ETAPE1_T2_VENTILATION_PILIERS tbl4UzvAMQY4nRnI5
//     → rang_par_frequence (1=socle, 2=str1, 3=str2, 4=fn1, 5=fn2)
//     → pilier_coeur (P1..P5)
//   ETAPE1_T2_INVENTAIRE_CIRCUITS tblUHZjXIW9jp9nIf
//     → coeur/total autoritaires par circuit
//   T3_PILIER tblzDIn7P2cOvVvY2
//     → mode existant (pilier_mode fldoGY71vyiaUeFl6)
//   ETAPE1_T2 tblaGd3ixAWxbJJp2
//     → signal_limbique + synthese_pilier par pilier
//   REFERENTIEL_PILIERS tblf4OodQ2Qi5xSXs
//     → libellés officiels
//
// SORTIE : { candidat_id, piliers[] } — payload pour P-A×5

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const logger          = require('../../../../utils/logger');

// fldIDs VENTILATION_PILIERS
const VENT = {
  candidat_id:        'fldElNhexmTf6w73F',  // candidat_id (session_ID en v11)
  pilier_coeur:       'fldDzu3P3ryAT5eTt',  // singleSelect P1..P5
  rang:               'fldZqTLiapVQSznq0',  // rang_par_frequence 1..5
  nb_activations:     'flddntGV77W5qGzeH',  // nb_activations_coeur_total
};

// fldIDs INVENTAIRE_CIRCUITS
const INV = {
  candidat_id:  'fldWInB63lYApVz8G',
  pilier:       'fldSudlYoCeU2cOqz',  // singleSelect → .name
  circuit_id:   'fldPF1xvYiONGiOAA',  // "C12"
  code_complet: 'fldjbr1Ej7Dosb6S6',  // "P4C12"
  coeur:        'fld8nEBQqdLqQqe1b',  // nb_coeur (corrigé — fld76259zIzR6XVRB = rang_dans_pilier)
  total:        'fldzV8udGk3eQ58No',  // total_activations ✓
  adhoc:        'fld0SuUut21rToKbj',  // circuit_origine singleSelect OFFICIEL/ADHOC (corrigé — fldgAjStrMoLleMbA = nb_svc_P4)
};

// fldID T3_PILIER mode
const FLD_PIL_CODE = 'fldVvi5gbKioBmlsQ';
const FLD_MODE     = 'fldoGY71vyiaUeFl6';

// fldIDs T2 Fable
const T2 = {
  pilier:          'fldkByLh883MLtHB3',
  signal_limbique: 'fldnDxnEc3uLoAknN',
  synthese_pilier: 'fldYZIvT2gMtumy6O',
};

// fldID REFERENTIEL_PILIERS
const FLD_PIL_NOM = 'fldI2u7FxkWhdGoot';

// rang → rôle/slot
const RANG_TO_ROLE = {
  1: { role: 'socle',       slot: 'socle' },
  2: { role: 'amont',       slot: 'str1'  },
  3: { role: 'aval',        slot: 'str2'  },
  4: { role: 'fonctionnel', slot: 'fn1'   },
  5: { role: 'fonctionnel', slot: 'fn2'   },
};

function niveauFromCoeur(n) {
  if (n >= 4) return 'HAUT';
  if (n >= 2) return 'MOYEN';
  if (n === 1) return 'FAIBLE';
  return 'EN_SOUTIEN';
}


// ═══════════════════════════════════════════════════════════════════════════
// INITIALISATION T3 — crée les records vides avant que P-A puisse écrire
// Doctrine : T3_BILAN → T3_PILIER (×5) → T3_CIRCUIT (×N) dans cet ordre
// ═══════════════════════════════════════════════════════════════════════════

const SLOT_TO_FIELD = {
  socle: { code: 'pilier_socle', label: 'pilier_socle_label' },
  str1:  { code: 'pilier_str1',  label: 'pilier_str1_label'  },
  str2:  { code: 'pilier_str2',  label: 'pilier_str2_label'  },
  fn1:   { code: 'pilier_fn1',   label: 'pilier_fn1_label'   },
  fn2:   { code: 'pilier_fn2',   label: 'pilier_fn2_label'   },
};

async function initialiserT3(candidat_id, piliers, visiteur) {
  const F_PIL = config.ETAPE1_T3_PILIER_FIELDS;
  const F_CIR = config.ETAPE1_T3_CIRCUIT_FIELDS;
  const F_BIL = config.ETAPE1_T3_BILAN_FIELDS;
  const F_REF = config.REFERENTIEL_PILIERS_FIELDS || {};

  logger.info('É0 — initialisation T3 (BILAN + PILIERS + CIRCUITS)', { candidat_id });

  // ── 1. T3_BILAN (1 record) ────────────────────────────────────────────────
  const socle = piliers.find(p => p.role_slot === 'socle') || piliers[0];
  const bilanFields = {
    [F_BIL.candidat_id]:         candidat_id,
    [F_BIL.version_bilan]:       'FABLE_5',
    [F_BIL.pilier_socle]:        socle?.pilier_code || '',
    [F_BIL.pilier_socle_label]:  socle?.pilier_nom  || '',
  };
  if (visiteur) {
    if (visiteur.civilite)  bilanFields[F_BIL.civilite] = visiteur.civilite;
    if (visiteur.prenom)    bilanFields[F_BIL.prenom]   = visiteur.prenom;
    if (visiteur.nom)       bilanFields[F_BIL.nom]      = visiteur.nom;
  }
  // Remplir pilier_str1/str2/fn1/fn2
  for (const p of piliers) {
    const slot = p.role_slot;
    const flds = SLOT_TO_FIELD[slot];
    if (flds) {
      bilanFields[F_BIL[flds.code]]  = p.pilier_code;
      bilanFields[F_BIL[flds.label]] = p.pilier_nom;
    }
  }
  const bilanRec = await airtableService.upsertEtape1T3Bilan(candidat_id, bilanFields);
  const bilanRecId = bilanRec?.id || bilanRec;
  logger.info('É0 — T3_BILAN créé/mis à jour', { candidat_id, bilanRecId });

  // ── 2. T3_PILIER (5 records) ──────────────────────────────────────────────
  const ROLE_LABEL = { socle: 'Socle', amont: 'Stratégique amont', aval: 'Stratégique aval', fonctionnel: 'Fonctionnel' };
  const pilierRows = piliers.map(p => ({
    [F_PIL.candidat_id]:   candidat_id,
    [F_PIL.pilier]:        p.pilier_code,
    [F_PIL.pilier_label]:  p.pilier_nom,
    [F_PIL.role_pilier]:   p.pilier_role,
    [F_PIL.pilier_role_label]: ROLE_LABEL[p.pilier_role] || p.pilier_role,
    [F_PIL.bilan_link]:    bilanRecId ? [bilanRecId] : [],
    [F_PIL.nb_activations]: p.circuits.reduce((s, c) => s + c.coeur, 0),
    [F_PIL.nb_circuits_actifs]: p.circuits.filter(c => c.coeur > 0).length,
  }));

  const pilierMap = await airtableService.writeEtape1T3Piliers(candidat_id, pilierRows);
  logger.info('É0 — T3_PILIER créés', { candidat_id, count: pilierMap.size });

  // ── 3. T3_CIRCUIT (N records) ─────────────────────────────────────────────
  const circuitRows = [];
  let ordrePilier = 0;
  for (const p of piliers) {
    ordrePilier++;
    const pilierRecId = pilierMap.get(p.pilier_code);
    let ordreCircuit = 0;
    for (const c of p.circuits) {
      ordreCircuit++;
      circuitRows.push({
        [F_CIR.candidat_id]:       candidat_id,
        [F_CIR.pilier]:            p.pilier_code,
        [F_CIR.circuit_id]:        c.circuit_id || c.code.replace(/^P[1-5]/, ''),
        [F_CIR.circuit_nom]:       c.nom || '',
        [F_CIR.circuit_freq]:      c.coeur,
        [F_CIR.circuit_niveau]:    c.niveau,
        [F_CIR.ordre_pilier]:      ordrePilier,
        [F_CIR.ordre_circuit]:     ordreCircuit,
        [F_CIR.total_activations]: c.total,
        [F_CIR.bilan_link]:        bilanRecId  ? [bilanRecId]  : [],
        [F_CIR.pilier_link]:       pilierRecId ? [pilierRecId] : [],
      });
    }
  }
  await airtableService.writeEtape1T3Circuits(candidat_id, circuitRows);
  logger.info('É0 — T3_CIRCUIT créés', { candidat_id, count: circuitRows.length });

  return { bilanRecId, pilierMap };
}

async function buildContexteE0({ candidat_id }) {
  const t = Date.now();
  logger.info('É0 v5.0 — démarrage', { candidat_id });

  const [ventilation, inventaire, t3piliers, t2rows, piliersRef] = await Promise.all([
    airtableService.getEtape1T2VentilationPiliers(candidat_id),
    airtableService.getEtape1T2InventaireCircuits(candidat_id),
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T2Fable(candidat_id),
    airtableService.getReferentielPiliers(),
  ]);

  if (!ventilation?.length) throw new Error(`É0: VENTILATION_PILIERS vide pour ${candidat_id}`);
  if (!inventaire?.length)  throw new Error(`É0: INVENTAIRE_CIRCUITS vide pour ${candidat_id}`);

  // Libellés officiels
  const nomParPilier = {};
  for (const p of (piliersRef || [])) {
    const code = p.pilier_code || '';
    const nom  = p[FLD_PIL_NOM] || p.pilier_nom || '';
    if (code && nom) nomParPilier[code] = nom;
  }

  // Architecture rôles depuis VENTILATION_PILIERS (rang 1=socle … 5=fn2)
  const roleParPilier = {}, slotParPilier = {}, ordre = [];
  for (const r of ventilation) {
    const pilierVal = r[VENT.pilier_coeur];
    const code = typeof pilierVal === 'object' ? pilierVal.name : String(pilierVal || '');
    const rang  = Number(r[VENT.rang] || 0);
    if (!code || !/^P[1-5]$/.test(code)) continue;
    const mapped = RANG_TO_ROLE[rang] || { role: 'fonctionnel', slot: 'fn2' };
    roleParPilier[code] = mapped.role;
    slotParPilier[code] = mapped.slot;
    if (!ordre.includes(code)) ordre.push(code);
  }
  // Trier ordre par rang
  ordre.sort((a, b) => {
    const ra = ventilation.find(r => {
      const v = r[VENT.pilier_coeur]; return (typeof v === 'object' ? v.name : v) === a;
    });
    const rb = ventilation.find(r => {
      const v = r[VENT.pilier_coeur]; return (typeof v === 'object' ? v.name : v) === b;
    });
    return Number(ra?.[VENT.rang] || 99) - Number(rb?.[VENT.rang] || 99);
  });

  // Modes depuis T3_PILIER
  const modeParPilier = {};
  for (const p of (t3piliers || [])) {
    const code = p[FLD_PIL_CODE] || p.pilier || '';
    const mode = p[FLD_MODE]     || p.pilier_mode || '';
    if (code) modeParPilier[code] = mode;
  }

  // Signal + synthèse depuis T2 Fable
  const signalParPilier = {}, synthParPilier = {};
  for (const r of (t2rows || [])) {
    const pil = r[T2.pilier] || '';
    if (!pil) continue;
    if (!signalParPilier[pil] && r[T2.signal_limbique]) signalParPilier[pil] = r[T2.signal_limbique];
    if (!synthParPilier[pil]  && r[T2.synthese_pilier]) synthParPilier[pil]  = r[T2.synthese_pilier];
  }

  // INVENTAIRE → coeur/total autoritaires par code circuit
  const invByCode = {};
  for (const r of inventaire) {
    const code = r[INV.code_complet] || '';
    if (!code) continue;
    const pilierVal = r[INV.pilier];
    const pilier = typeof pilierVal === 'object' ? pilierVal.name : String(pilierVal || '');
    invByCode[code] = {
      code,
      circuit_id: String(r[INV.circuit_id] || ''),
      pilier,
      coeur: Number(r[INV.coeur] || 0),
      total: Number(r[INV.total] || 0),
      adhoc: (r[INV.adhoc]?.name || r[INV.adhoc] || '') === 'ADHOC',
    };
    // Ajouter le pilier à l'ordre s'il n'y est pas (cas circuits sans ventilation)
    if (pilier && /^P[1-5]$/.test(pilier) && !ordre.includes(pilier)) {
      roleParPilier[pilier] = 'fonctionnel';
      slotParPilier[pilier] = 'fn2';
      ordre.push(pilier);
    }
  }

  // Assemblage piliers
  const piliers = [];
  for (const pilier_code of ordre) {
    const circuitsInv = Object.values(invByCode).filter(c => c.pilier === pilier_code);
    if (!circuitsInv.length) {
      logger.warn(`É0: aucun circuit inventaire pour ${pilier_code}`, { candidat_id });
      continue;
    }

    const aDuCoeur = circuitsInv.some(c => c.coeur > 0);
    const circuits = circuitsInv.map(inv => ({
      code:    inv.code,
      nom:     inv.circuit_id,
      coeur:   inv.coeur,
      total:   inv.total,
      niveau:  niveauFromCoeur(inv.coeur),
      adhoc:   inv.adhoc,
      // Verbatims et sortants : T3_CIRCUIT n'existe pas encore
      // P-A les écrira après exécution du prompt
      verbatims: [],
      sortants:  {},
    })).sort((a, b) => (b.coeur - a.coeur) || (b.total - a.total));

    const modeExistant = modeParPilier[pilier_code] || '';
    piliers.push({
      pilier_code,
      pilier_nom:   nomParPilier[pilier_code] || pilier_code,
      pilier_role:  roleParPilier[pilier_code] || 'fonctionnel',
      role_slot:    slotParPilier[pilier_code] || 'fn2',
      pilier_mode:  modeExistant,
      mode_statut:  modeExistant ? 'FOURNI' : 'A_PROPOSER',
      echelle_classement:    aDuCoeur ? 'coeur' : 'total',
      signal_limbique:       signalParPilier[pilier_code] || '',
      synth_factuelle_coeur: synthParPilier[pilier_code]  || '',
      circuits,
    });
  }

  if (!piliers.length) throw new Error(`É0: aucun pilier assemblé pour ${candidat_id}`);

  // Initialiser T3 : créer BILAN + PILIERS + CIRCUITS vides pour que PA puisse les remplir
  const visiteur = await airtableService.getVisiteur(candidat_id);
  const { bilanRecId, pilierMap } = await initialiserT3(candidat_id, piliers, visiteur);

  logger.info('É0 v5.0 — terminée', { candidat_id, nb_piliers: piliers.length, bilanRecId, elapsedMs: Date.now()-t });
  return { candidat_id, piliers, bilanRecId, pilierMap };
}

module.exports = { buildContexteE0 };
