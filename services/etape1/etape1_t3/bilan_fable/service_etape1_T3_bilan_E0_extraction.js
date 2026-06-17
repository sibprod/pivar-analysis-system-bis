// services/etape1/etape1_t3/bilan_fable/service_etape1_T3_bilan_E0_extraction.js
// É0 — EXTRACTION & DÉRIVATIONS — v5.1 (17/06/2026)
//
// RESPONSABILITÉ UNIQUE : lecture seule des sources → payload pour P-A×5
// L'initialisation T3 (création records) est déléguée à É0b.
//
// SOURCES :
//   ETAPE1_T2_VENTILATION_PILIERS → rang, pilier_coeur
//   ETAPE1_T2_INVENTAIRE_CIRCUITS → coeur/total/adhoc par circuit
//   T3_PILIER                     → mode existant si déjà validé
//   ETAPE1_T2 (Fable)             → signal_limbique + synthese_pilier
//   REFERENTIEL_PILIERS           → libellés officiels
//
// SORTIE : { candidat_id, piliers[] }

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const logger          = require('../../../../utils/logger');

// fldIDs VENTILATION_PILIERS
const VENT = {
  candidat_id:    'fldElNhexmTf6w73F',
  pilier_coeur:   'fldDzu3P3ryAT5eTt',  // singleSelect P1..P5
  rang:           'fldZqTLiapVQSznq0',  // rang_par_frequence 1..5
  nb_activations: 'flddntGV77W5qGzeH',
};

// fldIDs INVENTAIRE_CIRCUITS
const INV = {
  candidat_id:  'fldWInB63lYApVz8G',
  pilier:       'fldSudlYoCeU2cOqz',  // singleSelect → .name
  circuit_id:   'fldPF1xvYiONGiOAA',  // "C12"
  code_complet: 'fldjbr1Ej7Dosb6S6',  // "P4C12"
  coeur:        'fld8nEBQqdLqQqe1b',  // nb_coeur ✓
  total:        'fldzV8udGk3eQ58No',  // total_activations ✓
  adhoc:        'fld0SuUut21rToKbj',  // circuit_origine singleSelect OFFICIEL/ADHOC ✓
};

// fldIDs T3_PILIER
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
  logger.info('É0 v5.1 — démarrage', { candidat_id });

  const [ventilation, inventaire, t3piliers, t2rows, piliersRef] = await Promise.all([
    airtableService.getEtape1T2VentilationPiliers(candidat_id),
    airtableService.getEtape1T2InventaireCircuits(candidat_id),
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T2Fable(candidat_id),
    airtableService.getReferentielPiliers(),
  ]);

  logger.info('É0 — données lues', { candidat_id, nb_ventilation: ventilation?.length, nb_inventaire: inventaire?.length, nb_t2rows: t2rows?.length });
  if (!ventilation?.length) throw new Error(`É0: VENTILATION_PILIERS vide pour ${candidat_id}`);
  if (!inventaire?.length)  throw new Error(`É0: INVENTAIRE_CIRCUITS vide pour ${candidat_id}`);

  // Libellés officiels depuis REFERENTIEL_PILIERS
  const nomParPilier = {};
  for (const p of (piliersRef || [])) {
    const code = p.pilier_code || '';
    const nom  = p[FLD_PIL_NOM] || p.pilier_nom || '';
    if (code && nom) nomParPilier[code] = nom;
  }

  // Architecture rôles depuis VENTILATION_PILIERS
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

  // Trier par rang
  ordre.sort((a, b) => {
    const ra = ventilation.find(r => {
      const v = r[VENT.pilier_coeur];
      return (typeof v === 'object' ? v.name : v) === a;
    });
    const rb = ventilation.find(r => {
      const v = r[VENT.pilier_coeur];
      return (typeof v === 'object' ? v.name : v) === b;
    });
    return Number(ra?.[VENT.rang] || 99) - Number(rb?.[VENT.rang] || 99);
  });

  // Modes existants depuis T3_PILIER (vide au premier run — normal)
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

  // INVENTAIRE → coeur/total/adhoc par code circuit
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
    if (pilier && /^P[1-5]$/.test(pilier) && !ordre.includes(pilier)) {
      roleParPilier[pilier] = 'fonctionnel';
      slotParPilier[pilier] = 'fn2';
      ordre.push(pilier);
    }
  }

  logger.info('É0 — invByCode', { candidat_id, nb_codes: Object.keys(invByCode).length, sample: Object.keys(invByCode).slice(0,3), ordre });
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
      code:      inv.code,
      nom:       inv.circuit_id,
      circuit_id: inv.circuit_id,
      coeur:     inv.coeur,
      total:     inv.total,
      niveau:    niveauFromCoeur(inv.coeur),
      adhoc:     inv.adhoc,
      verbatims: [],
      sortants:  {},
    })).sort((a, b) => (b.coeur - a.coeur) || (b.total - a.total));

    const modeExistant = modeParPilier[pilier_code] || '';
    piliers.push({
      pilier_code,
      pilier_nom:            nomParPilier[pilier_code] || pilier_code,
      pilier_role:           roleParPilier[pilier_code] || 'fonctionnel',
      role_slot:             slotParPilier[pilier_code] || 'fn2',
      pilier_mode:           modeExistant,
      mode_statut:           modeExistant ? 'FOURNI' : 'A_PROPOSER',
      echelle_classement:    aDuCoeur ? 'coeur' : 'total',
      signal_limbique:       signalParPilier[pilier_code] || '',
      synth_factuelle_coeur: synthParPilier[pilier_code]  || '',
      circuits,
    });
  }

  if (!piliers.length) throw new Error(`É0: aucun pilier assemblé pour ${candidat_id}`);

  logger.info('É0 v5.1 — terminée', { candidat_id, nb_piliers: piliers.length, elapsedMs: Date.now() - t });
  return { candidat_id, piliers };
}

module.exports = { buildContexteE0 };
