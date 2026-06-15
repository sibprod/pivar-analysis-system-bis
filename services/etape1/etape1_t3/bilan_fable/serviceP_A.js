// services/etape1/bilan_fable/serviceP_A.js
// P-A — ANALYSE PILIER — v3.0 (14/06/2026)
// Source : PROMPT_ANALYSE_PILIER_v7.md + dossier §1 + base Cécile
//
// Prompt v7 produit par circuit : explication + explication_courte + en_renfort + verbatims_cites
// Prompt v7 produit par pilier : blocs (synth_candidat + synth_technique) + synthese_pilier
//
// Écriture T3_CIRCUIT (dossier §1 fldIDs) :
//   explication        → fldSx0VOHYILowFSj
//   explication_courte → fld3zZ8SteMWedetW
//   renfort_phrase     → fldixMQDcsD7cCyd3
//   verbatim_1..4      → fldLP9juCWCTlCZPt / fldSCQD9zvgRQcuq9 / fldhIp3aW72WR2V1t / fld4lrLWySRXVmvZe
//   verbatim_1..4_ref  → fldI1DVJiH7EH4zel / fldmVPwfku0vUz6xX / fldcQ7hxyRumcc1DO / fldQgruSXveuTCLM4
//
// Écriture T3_PILIER (vérifiés en base Cécile) :
//   pilier_mode        → fldoGY71vyiaUeFl6
//   mode_explication   → fld6GtEBRP5UxvHeI
//   intro_eclate       → fldomziXNOGf7Ujsb
//   HAUT  agregat      → fldBLvofzosLTPUOr  rattachement → fldB9fRf8U61z4WZK  technique → flds6XOIwvYr20iRY
//   MOYEN agregat      → flda16lg5Dt1HrXrF  rattachement → fldMA46pZRI6Bi0ZU  technique → fld7Sv7LXlZ6XPghN
//   FAIBLE agregat     → fld68H41z6b9XtFoZ  rattachement → fldZiSdH20uMb5wCY  technique → fld6BWLEjDMdbYTs6

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const agentBase       = require('../../../infrastructure/agentBase');
const logger          = require('../../../../utils/logger');
const { buildContexteE0 } = require('./serviceE0_extraction');

const PROMPT_PATH = 'etape1/bilan/PROMPT_ANALYSE_PILIER_v7.md';
const PC = config.ETAPE1_T3_CIRCUIT_FIELDS;
const PP = config.ETAPE1_T3_PILIER_FIELDS;

// fldIDs T3_CIRCUIT verbatims (dossier §1 — écriture directe par fldID)
// explication/courte/renfort passent maintenant par config PC (I3)
const VERB_FLD = {
  v1: 'fldLP9juCWCTlCZPt', v1r: 'fldI1DVJiH7EH4zel',
  v2: 'fldSCQD9zvgRQcuq9', v2r: 'fldmVPwfku0vUz6xX',
  v3: 'fldhIp3aW72WR2V1t', v3r: 'fldcQ7hxyRumcc1DO',
  v4: 'fld4lrLWySRXVmvZe', v4r: 'fldQgruSXveuTCLM4',
};

// fldIDs T3_PILIER blocs (vérifiés en base Cécile — 3 champs par groupe)
const BLOC = {
  HAUT:  { a: 'fldBLvofzosLTPUOr', r: 'fldB9fRf8U61z4WZK', t: 'flds6XOIwvYr20iRY' },
  MOYEN: { a: 'flda16lg5Dt1HrXrF', r: 'fldMA46pZRI6Bi0ZU', t: 'fld7Sv7LXlZ6XPghN' },
  FAIBLE:{ a: 'fld68H41z6b9XtFoZ', r: 'fldZiSdH20uMb5wCY', t: 'fld6BWLEjDMdbYTs6' },
};

const ROLE_SELECT = { socle:'socle', str1:'structurant_1', str2:'structurant_2', fn1:'fonctionnel_1', fn2:'fonctionnel_2' };

function bareId(code) { return String(code).replace(/^P[1-5]/, ''); }

// Écriture verbatims cités dans 4 paires de champs séparés (dossier §1)
function ecrireVerbatims(row, cites) {
  const slots = [
    [VERB_FLD.v1,VERB_FLD.v1r],[VERB_FLD.v2,VERB_FLD.v2r],[VERB_FLD.v3,VERB_FLD.v3r],[VERB_FLD.v4,VERB_FLD.v4r],
  ];
  const valides = (cites||[]).filter(v=>v&&v.texte);
  slots.forEach(([ft,fr],i) => {
    const v = valides[i];
    row[ft] = v ? v.texte : '';
    row[fr] = v ? `${v.qid||''} ${v.lieu||''}`.trim() : '';
  });
}

// Écriture blocs — prompt v7 produit exactement 2 champs par bloc :
//   synth_candidat  → agregat   (registre B — texte candidat)
//   synth_technique → technique (registre A — chiffres bruts)
// rattachement : NON produit par le prompt v7 — pas écrit.
function ecrireBlocs(prow, blocs) {
  for (const niv of ['HAUT','MOYEN','FAIBLE']) {
    const b = (blocs||[]).find(x => String(x.niveau||'').toUpperCase()===niv);
    const f = BLOC[niv];
    prow[f.a] = b ? (b.synth_candidat  || '') : '';
    prow[f.t] = b ? (b.synth_technique || '') : '';
    // f.r (rattachement) : non produit par prompt v7 — non écrit
  }
}

async function chargerProfils() {
  if (typeof airtableService.getReferentielProfils !== 'function') return {};
  try {
    const profils = await airtableService.getReferentielProfils();
    const out = {};
    for (const p of (profils||[])) {
      const pil = p.pilier || p.pilier_code;
      const lib = p.nom || p.profil_nom || p.libelle;
      if (pil && lib) (out[pil]=out[pil]||[]).push(lib);
    }
    return out;
  } catch(e) { logger.warn('P-A: profils indisponibles', {err:e.message}); return {}; }
}

async function runAnalysePiliers({ candidat_id, prenom='', modesValides=null }) {
  const t = Date.now();
  logger.info('P-A v3 — démarrage', { candidat_id });

  const ctx = await buildContexteE0({ candidat_id });
  if (!ctx.piliers?.length) throw new Error(`P-A: É0 vide pour ${candidat_id}`);

  const profils = await chargerProfils();
  const circuitRows=[], pilierRows=[], modes={};
  let totalCost=0;

  for (let i=0; i<ctx.piliers.length; i++) {
    const P = ctx.piliers[i];

    const payload = {
      candidat_prenom: prenom, pilier_code: P.pilier_code, pilier_nom: P.pilier_nom,
      pilier_role: P.pilier_role, echelle_classement: P.echelle_classement,
      sous_totaux_instrumentaux: P.sous_totaux_instrumentaux,
      signal_limbique: P.signal_limbique || '',
      synth_factuelle_coeur: P.synth_factuelle_coeur || '',
      synth_factuelle_elargie: '',
      profils_types: profils[P.pilier_code] || [],
      circuits: P.circuits.map(c=>({
        code:c.code, nom:c.nom, coeur:c.coeur, total:c.total,
        niveau:c.niveau, adhoc:c.adhoc, sortants:c.sortants, verbatims:c.verbatims,
      })),
    };

    // Mode : gate Isabelle > É0 (T3_PILIER) > absent (agent propose)
    const mv = modesValides && modesValides[P.pilier_code];
    if (mv)           payload.pilier_mode = mv;
    else if (P.pilier_mode) payload.pilier_mode = P.pilier_mode;

    const { result, cost } = await agentBase.callAgent({
      serviceName: `bilan_fable_PA_${P.pilier_code}`,
      promptPath: PROMPT_PATH, payload, injectLexique:true, candidatId:candidat_id,
    });
    totalCost += (cost||0);

    if (!result?.synthese_pilier || !Array.isArray(result.circuits))
      throw new Error(`P-A: sortie invalide pour ${P.pilier_code}`);

    const agentByCode = {};
    for (const ac of result.circuits) agentByCode[ac.code] = ac;

    P.circuits.forEach((c,j) => {
      const a = agentByCode[c.code] || {};
      const s = c.sortants || {};
      const row = {};
      row[PC.candidat_id]       = candidat_id;
      row[PC.pilier]            = P.pilier_code;
      row[PC.circuit_id]        = bareId(c.code);
      row[PC.circuit_nom]       = c.nom;
      row[PC.circuit_freq]      = c.coeur;
      row[PC.circuit_niveau]    = c.niveau;
      row[PC.total_activations] = c.total;
      row[PC.en_svc_P1]=s.P1||0; row[PC.en_svc_P2]=s.P2||0; row[PC.en_svc_P3]=s.P3||0;
      row[PC.en_svc_P4]=s.P4||0; row[PC.en_svc_P5]=s.P5||0;
      row[PC.ordre_pilier]  = i+1; row[PC.ordre_circuit] = j+1;
      row[PC.n3_nuance]              = a.explication        || '';   // fldSx0VOHYILowFSj
      row[PC.explication_courte_ch4] = a.explication_courte || '';   // fld3zZ8SteMWedetW
      row[PC.en_renfort]             = a.en_renfort         || '';   // fldixMQDcsD7cCyd3
      ecrireVerbatims(row, a.verbatims_cites);
      circuitRows.push(row);
    });

    const sp = result.synthese_pilier;
    const prow = {};
    prow[PP.candidat_id]   = candidat_id; prow[PP.pilier]       = P.pilier_code;
    prow[PP.pilier_label]  = P.pilier_nom; prow[PP.role_pilier] = ROLE_SELECT[P.role_slot]||'fonctionnel_1';
    prow[PP.cle_composite] = `${candidat_id}_${P.pilier_code}`;
    prow[PP.pilier_mode]      = sp.mode_libelle             || '';
    prow[PP.mode_explication] = sp.mode_explication_candidat || '';
    prow[PP.intro_eclate]     = sp.intro_eclate             || '';
    prow[PP.synth_interpretee]= sp.vue_ensemble             || '';
    prow[PP.synth_factuelle]  = sp.profil_pur               || '';
    ecrireBlocs(prow, result.blocs);
    prow[PP.nb_activations]    = P.circuits.reduce((a,c)=>a+(c.total||0),0);
    prow[PP.nb_circuits_actifs]= P.circuits.filter(c=>(c.total||0)>=1).length;
    prow[PP.nb_circuits_haut]  = P.circuits.filter(c=>c.niveau==='HAUT').length;
    pilierRows.push(prow);

    modes[P.pilier_code] = { libelle: sp.mode_libelle||'', statut: sp.mode_statut||'' };
    logger.info('P-A v3 — pilier', { candidat_id, pilier:P.pilier_code, mode_statut:modes[P.pilier_code].statut });
  }

  await airtableService.writeEtape1T3Circuits(candidat_id, circuitRows);
  await airtableService.writeEtape1T3Piliers(candidat_id, pilierRows);

  logger.info('P-A v3 — terminé', { candidat_id, nb_circuits:circuitRows.length, cost:totalCost, elapsedMs:Date.now()-t });
  return { candidat_id, modes, nb_circuits:circuitRows.length, nb_piliers:pilierRows.length, cost:totalCost };
}

module.exports = { runAnalysePiliers };
