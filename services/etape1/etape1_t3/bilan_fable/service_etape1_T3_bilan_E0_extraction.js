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


  return { candidat_id, piliers };
}

module.exports = { buildContexteE0 };
