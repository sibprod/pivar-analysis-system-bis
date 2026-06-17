// services/etape1/etape1_t3/bilan_fable/service_etape1_T3_bilan_E0b_initialisation.js
// É0b — INITIALISATION T3 — v1.0 (17/06/2026)
//
// RESPONSABILITÉ UNIQUE : créer les records vides dans T3_BILAN, T3_PILIER, T3_CIRCUIT
// avant que P-A puisse les trouver et les remplir.
//
// DOCTRINE :
//   - É0  = lecture seule des sources
//   - É0b = création des records destination (lecture seule interdite ici)
//   - P-A = écriture des textes rédigés dans les records créés par É0b
//
// ORDRE OBLIGATOIRE : T3_BILAN → T3_PILIER (×5) → T3_CIRCUIT (×N)
//   T3_PILIER.bilan_link dépend du rec_id T3_BILAN
//   T3_CIRCUIT.pilier_link dépend du rec_id T3_PILIER
//
// ENTRÉE : { candidat_id, piliers[] } — payload produit par É0
// SORTIE : { bilanRecId, pilierMap } — rec_ids pour P-A

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const logger          = require('../../../../utils/logger');

// slot → noms de champs dans T3_BILAN
const SLOT_TO_BILAN_FIELD = {
  socle: { code: 'pilier_socle',  label: 'pilier_socle_label'  },
  str1:  { code: 'pilier_str1',   label: 'pilier_str1_label'   },
  str2:  { code: 'pilier_str2',   label: 'pilier_str2_label'   },
  fn1:   { code: 'pilier_fn1',    label: 'pilier_fn1_label'    },
  fn2:   { code: 'pilier_fn2',    label: 'pilier_fn2_label'    },
};

const ROLE_LABEL = {
  socle:        'Socle — le pilier qui gouverne tout le reste',
  amont:        'Pilier amont — Ce qui alimente le socle',
  aval:         'Pilier aval — Ce qui conclut',
  fonctionnel:  'Pilier fonctionnel — Activé sous contrainte',
};

async function initialiserT3(candidat_id, piliers) {
  const F_BIL = config.ETAPE1_T3_BILAN_FIELDS;
  const F_PIL = config.ETAPE1_T3_PILIER_FIELDS;
  const F_CIR = config.ETAPE1_T3_CIRCUIT_FIELDS;

  logger.info('É0b — initialisation T3', { candidat_id, nb_piliers: piliers.length });

  // ── 1. VISITEUR → identité du candidat ───────────────────────────────────
  const visiteur = await airtableService.getVisiteur(candidat_id);
  const civilite = visiteur?.civilite_candidat || visiteur?.civilite || '';
  const prenom   = visiteur?.Prenom || visiteur?.prenom || '';
  const nom      = visiteur?.Nom    || visiteur?.nom    || '';

  // ── 2. T3_BILAN (1 record) ────────────────────────────────────────────────
  const socle = piliers.find(p => p.role_slot === 'socle') || piliers[0];

  const bilanFields = {
    [F_BIL.candidat_id]:        candidat_id,
    [F_BIL.version_bilan]:      'FABLE_5',
    [F_BIL.civilite]:           civilite,
    [F_BIL.prenom]:             prenom,
    [F_BIL.nom]:                nom,
    [F_BIL.pilier_socle]:       socle?.pilier_code || '',
    [F_BIL.pilier_socle_label]: socle?.pilier_nom  || '',
  };

  // Remplir les champs pilier_str1/str2/fn1/fn2
  for (const p of piliers) {
    const flds = SLOT_TO_BILAN_FIELD[p.role_slot];
    if (flds && F_BIL[flds.code]) {
      bilanFields[F_BIL[flds.code]]  = p.pilier_code;
      bilanFields[F_BIL[flds.label]] = p.pilier_nom;
    }
  }

  const bilanRec   = await airtableService.upsertEtape1T3Bilan(candidat_id, bilanFields);
  const bilanRecId = bilanRec?.id || bilanRec;
  logger.info('É0b — T3_BILAN upsert', { candidat_id, bilanRecId });

  // ── 3. T3_PILIER (5 records) ──────────────────────────────────────────────
  const pilierRows = piliers.map(p => ({
    [F_PIL.candidat_id]:        candidat_id,
    [F_PIL.pilier]:             p.pilier_code,
    [F_PIL.pilier_label]:       p.pilier_nom,
    [F_PIL.role_pilier]:        p.pilier_role,
    [F_PIL.pilier_role_label]:  ROLE_LABEL[p.pilier_role] || p.pilier_role,
    [F_PIL.bilan_link]:         bilanRecId ? [bilanRecId] : [],
    [F_PIL.nb_activations]:     p.circuits.reduce((s, c) => s + c.coeur, 0),
    [F_PIL.nb_circuits_actifs]: p.circuits.filter(c => c.coeur > 0).length,
  }));

  const pilierMap = await airtableService.writeEtape1T3Piliers(candidat_id, pilierRows);
  logger.info('É0b — T3_PILIER créés', { candidat_id, count: pilierMap.size });

  // ── 4. T3_CIRCUIT (N records) ─────────────────────────────────────────────
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
  logger.info('É0b — T3_CIRCUIT créés', { candidat_id, count: circuitRows.length });

  return { bilanRecId, pilierMap };
}

module.exports = { initialiserT3 };
