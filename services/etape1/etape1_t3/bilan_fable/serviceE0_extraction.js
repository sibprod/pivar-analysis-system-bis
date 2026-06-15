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
  coeur:        'fld76259zIzR6XVRB',
  total:        'fldzV8udGk3eQ58No',
  adhoc:        'fldgAjStrMoLleMbA',
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
      adhoc: Number(r[INV.adhoc] || 0) === 1,
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
  logger.info('É0 v5.0 — terminée', { candidat_id, nb_piliers: piliers.length, elapsedMs: Date.now()-t });
  return { candidat_id, piliers };
}

module.exports = { buildContexteE0 };
