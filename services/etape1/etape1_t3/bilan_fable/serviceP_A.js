// services/etape1/bilan_fable/serviceP_A.js
// P-A — ANALYSE PILIER (chaîne bilan FABLE) — v2.0 (14/06/2026)
//
// BASE DE TRAVAIL UNIQUE : DOSSIER_AGENT_FABLE5_v1.md
//
// CORRECTIONS v1→v2 :
//   C1. Verbatims cités → 4 paires de champs séparés (verbatim_1..4 + refs)
//       fldLP9juCWCTlCZPt / fldI1DVJiH7EH4zel ... fld4lrLWySRXVmvZe / fldQgruSXveuTCLM4
//       La v1 écrivait dans PC.n2_verbatims (champ inexistant dans le dossier).
//   C2. Explication → PC.explication = fldSx0VOHYILowFSj (pas PC.n3_nuance).
//   C3. Blocs : le dossier définit 3 champs par groupe (agregat / rattachement / technique).
//       Vérifié en base Cécile : les 3 sont remplis par Fable.
//       Mapping depuis le prompt v7 :
//         agregat      ← synth_candidat  (registre B)
//         rattachement ← synth_technique (registre A — texte nominatif avec codes circuits)
//         technique    ← synth_technique (même source — chiffres bruts)
//   C4. ou_revient : tableau_note est un champ purgé non documenté dans le dossier.
//       ou_outil_revient_candidat et _technique sont stockés dans les champs dédiés
//       du dossier si la config les expose ; sinon loggués pour traitement manuel.
//   C5. signal_limbique et synth_factuelle_coeur : fournis par É0 v3, passés au payload.
//
// ÉCRITURE EN UNE PASSE (inchangé) : on accumule les 5 piliers avant d'écrire
// pour éviter que chaque écriture efface les piliers précédents.

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const agentBase       = require('../../../infrastructure/agentBase');
const logger          = require('../../../../utils/logger');
const { buildContexteE0 } = require('./serviceE0_extraction');

const PROMPT_PATH = 'etape1/bilan/PROMPT_ANALYSE_PILIER_v7.md';

const PC = config.ETAPE1_T3_CIRCUIT_FIELDS;
const PP = config.ETAPE1_T3_PILIER_FIELDS;

// ─── fldIDs T3_CIRCUIT verbatims (dossier §1 — écriture directe par fldID) ──
const VERB_FIELDS = {
  v1:     'fldLP9juCWCTlCZPt',
  v1_ref: 'fldI1DVJiH7EH4zel',
  v2:     'fldSCQD9zvgRQcuq9',
  v2_ref: 'fldmVPwfku0vUz6xX',
  v3:     'fldhIp3aW72WR2V1t',
  v3_ref: 'fldcQ7hxyRumcc1DO',
  v4:     'fld4lrLWySRXVmvZe',
  v4_ref: 'fldQgruSXveuTCLM4',
};

// ─── fldIDs T3_PILIER blocs (dossier §1 — vérifiés en base Cécile) ───────────
// 3 champs par groupe : agregat · rattachement · technique (tous remplis par Fable)
const BLOC_FIELDS = {
  HAUT:  { agregat: 'fldBLvofzosLTPUOr', rattachement: 'fldB9fRf8U61z4WZK', technique: 'flds6XOIwvYr20iRY' },
  MOYEN: { agregat: 'flda16lg5Dt1HrXrF', rattachement: 'fldMA46pZRI6Bi0ZU', technique: 'fld7Sv7LXlZ6XPghN' },
  FAIBLE:{ agregat: 'fld68H41z6b9XtFoZ', rattachement: 'fldZiSdH20uMb5wCY', technique: 'fld6BWLEjDMdbYTs6' },
};

// ─── fldID explication T3_CIRCUIT (dossier §1) ───────────────────────────────
const FLD_EXPLICATION = 'fldSx0VOHYILowFSj';

// rôle architecture É0 → valeur singleSelect role_pilier
const ROLE_SELECT = {
  socle: 'socle',
  str1:  'structurant_1',
  str2:  'structurant_2',
  fn1:   'fonctionnel_1',
  fn2:   'fonctionnel_2',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

// "P3C10" → "C10" ; ADHOC conservé tel quel
function bareCircuitId(code) {
  return String(code).replace(/^P[1-5]/, '');
}

// Écrit les verbatims cités dans les 4 paires de champs séparés (C1)
// Dossier §1 : verbatim_1..4 + verbatim_1_ref..4_ref
function ecrireVerbatims(row, cites) {
  const slots = [
    [VERB_FIELDS.v1, VERB_FIELDS.v1_ref],
    [VERB_FIELDS.v2, VERB_FIELDS.v2_ref],
    [VERB_FIELDS.v3, VERB_FIELDS.v3_ref],
    [VERB_FIELDS.v4, VERB_FIELDS.v4_ref],
  ];
  const valides = (cites || []).filter(v => v && v.texte);
  slots.forEach(([fldTexte, fldRef], i) => {
    const v = valides[i];
    row[fldTexte] = v ? v.texte : '';    // texte EXACT — coquilles conservées
    row[fldRef]   = v ? `${v.qid || ''} ${v.lieu || ''}`.trim() : '';
  });
}

// Écrit les 3 champs par groupe de niveau (vérifié en base Cécile 14/06) :
//   agregat      ← synth_candidat  (registre B — texte accessible candidat)
//   rattachement ← synth_technique (registre A — texte nominatif avec codes circuits)
//   technique    ← synth_technique (même source — chiffres bruts + facettes)
// Fable a écrit les 3 champs sur tous les groupes. Le rattachement contient
// le texte d'attribution nominatif (« ces manières de faire sont ce que le
// protocole nomme… ») = registre A du prompt v7.
function ecrireBlocs(prow, blocs) {
  for (const niveau of ['HAUT', 'MOYEN', 'FAIBLE']) {
    const b = (blocs || []).find(x => String(x.niveau || '').toUpperCase() === niveau);
    const f = BLOC_FIELDS[niveau];
    prow[f.agregat]      = b ? (b.synth_candidat  || '') : '';
    prow[f.rattachement] = b ? (b.synth_technique || '') : '';
    prow[f.technique]    = b ? (b.synth_technique || '') : '';
  }
}

// Référentiel profils-types par pilier (tolérant)
async function chargerProfilsParPilier() {
  if (typeof airtableService.getReferentielProfils !== 'function') return {};
  try {
    const profils = await airtableService.getReferentielProfils();
    const out = {};
    for (const p of (profils || [])) {
      const pil = p.pilier || p.pilier_code;
      const lib = p.nom || p.profil_nom || p.libelle;
      if (pil && lib) (out[pil] = out[pil] || []).push(lib);
    }
    return out;
  } catch (e) {
    logger.warn('P-A: référentiel profils indisponible', { err: e.message });
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute les 5 analyses pilier et écrit T3_CIRCUIT + T3_PILIER en une passe.
 *
 * @param {{ candidat_id: string, prenom?: string, modesValides?: Object }} p
 *   modesValides : { P1: '<mode validé>', ... } — modes déjà validés par Isabelle.
 *   Si absent, É0 fournit mode_statut A_PROPOSER et l'agent propose (Δ3).
 * @returns {Promise<{ candidat_id, modes, nb_circuits, nb_piliers, cost }>}
 */
async function runAnalysePiliers({ candidat_id, prenom = '', modesValides = null }) {
  const startTime = Date.now();
  logger.info('P-A v2 — démarrage analyse des 5 piliers', { candidat_id });

  // ─── 1. É0 : chiffres + verbatims + rôles + modes existants ───────────
  const ctx = await buildContexteE0({ candidat_id });
  if (!ctx.piliers || ctx.piliers.length === 0)
    throw new Error(`P-A: É0 n'a produit aucun pilier pour ${candidat_id}`);

  const profilsParPilier = await chargerProfilsParPilier();

  const circuitRows = [];
  const pilierRows  = [];
  const modes       = {};
  let totalCost     = 0;

  // ─── 2. Boucle pilier par pilier ─────────────────────────────────────
  for (let i = 0; i < ctx.piliers.length; i++) {
    const P = ctx.piliers[i];

    // ── Payload prompt v7 ─────────────────────────────────────────────
    // Entrées définies par le prompt §ENTRÉES.
    const payload = {
      candidat_prenom:            prenom,
      pilier_code:                P.pilier_code,
      pilier_nom:                 P.pilier_nom,
      pilier_role:                P.pilier_role,
      echelle_classement:         P.echelle_classement,
      sous_totaux_instrumentaux:  P.sous_totaux_instrumentaux,
      signal_limbique:            P.signal_limbique || '',         // C5 : fourni par É0 v3
      synth_factuelle_coeur:      P.synth_factuelle_coeur || '',   // C5 : fourni par É0 v3
      synth_factuelle_elargie:    '',                              // non produit par É0 — vide
      profils_types:              profilsParPilier[P.pilier_code] || [],
      circuits: P.circuits.map(c => ({
        code:      c.code,
        nom:       c.nom,
        coeur:     c.coeur,
        total:     c.total,
        niveau:    c.niveau,
        adhoc:     c.adhoc,
        sortants:  c.sortants,
        verbatims: c.verbatims,
      })),
    };

    // Mode : priorité modesValides (gate Isabelle) → puis É0 (FOURNI depuis T3_PILIER)
    // Si ni l'un ni l'autre → pilier_mode absent → agent propose (Δ3, CAS B)
    const modeValide = modesValides && modesValides[P.pilier_code];
    if (modeValide) {
      payload.pilier_mode = modeValide;
    } else if (P.pilier_mode) {
      payload.pilier_mode = P.pilier_mode;   // FOURNI depuis T3_PILIER (permanence §2.6)
    }
    // sinon pilier_mode absent → agent propose

    // ── Appel agent ──────────────────────────────────────────────────
    const { result, cost } = await agentBase.callAgent({
      serviceName: `bilan_fable_PA_${P.pilier_code}`,
      promptPath:  PROMPT_PATH,
      payload,
      injectLexique: true,
      candidatId:  candidat_id,
    });
    totalCost += (cost || 0);

    if (!result || !result.synthese_pilier || !Array.isArray(result.circuits))
      throw new Error(`P-A: sortie agent invalide pour ${P.pilier_code}`);

    const agentByCode = {};
    for (const ac of result.circuits) agentByCode[ac.code] = ac;

    // ── 3a. Lignes T3_CIRCUIT ─────────────────────────────────────────
    P.circuits.forEach((c, j) => {
      const a = agentByCode[c.code] || {};
      const s = c.sortants || {};
      const row = {};

      // Identité
      row[PC.candidat_id]       = candidat_id;
      row[PC.pilier]            = P.pilier_code;
      row[PC.circuit_id]        = bareCircuitId(c.code);
      row[PC.circuit_nom]       = c.nom;
      row[PC.ordre_pilier]      = i + 1;
      row[PC.ordre_circuit]     = j + 1;

      // Chiffres É0 (autoritaires — jamais recalculés)
      row[PC.circuit_freq]      = c.coeur;
      row[PC.circuit_niveau]    = c.niveau;
      row[PC.total_activations] = c.total;
      row[PC.en_svc_P1]         = s.P1 || 0;
      row[PC.en_svc_P2]         = s.P2 || 0;
      row[PC.en_svc_P3]         = s.P3 || 0;
      row[PC.en_svc_P4]         = s.P4 || 0;
      row[PC.en_svc_P5]         = s.P5 || 0;

      // Rédactionnel agent (C2 : explication → fldSx0VOHYILowFSj)
      row[FLD_EXPLICATION]               = a.explication        || '';
      row[PC.explication_courte_ch4]     = a.explication_courte || '';   // fld3zZ8SteMWedetW
      row[PC.en_renfort]                 = a.en_renfort         || '';   // fldixMQDcsD7cCyd3

      // Verbatims cités : 4 paires séparées (C1 — dossier §1)
      ecrireVerbatims(row, a.verbatims_cites);

      circuitRows.push(row);
    });

    // ── 3b. Ligne T3_PILIER ───────────────────────────────────────────
    const sp = result.synthese_pilier;
    const prow = {};

    // Identité
    prow[PP.candidat_id]    = candidat_id;
    prow[PP.pilier]         = P.pilier_code;
    prow[PP.pilier_label]   = P.pilier_nom;
    prow[PP.role_pilier]    = ROLE_SELECT[P.role_slot] || 'fonctionnel_1';
    prow[PP.cle_composite]  = `${candidat_id}_${P.pilier_code}`;

    // Rédactionnel agent
    prow[PP.pilier_mode]        = sp.mode_libelle             || '';   // fldoGY71vyiaUeFl6
    prow[PP.mode_explication]   = sp.mode_explication_candidat || '';  // fld6GtEBRP5UxvHeI
    prow[PP.intro_eclate]       = sp.intro_eclate             || '';   // fldomziXNOGf7Ujsb
    prow[PP.synth_interpretee]  = sp.vue_ensemble             || '';
    prow[PP.synth_factuelle]    = sp.profil_pur               || '';

    // Blocs : agregat (synth_candidat) + technique (synth_technique) (C3)
    ecrireBlocs(prow, result.blocs);

    // ou_revient : loggé pour le builder de rendu (C4 — pas de champ tableau_note)
    if (sp.ou_outil_revient_candidat || sp.ou_outil_revient_technique) {
      logger.info('P-A: ou_revient produit (à mapper côté rendu)', {
        candidat_id,
        pilier: P.pilier_code,
        candidat: sp.ou_outil_revient_candidat,
        technique: sp.ou_outil_revient_technique,
      });
    }

    // Compteurs É0
    prow[PP.nb_activations]    = P.circuits.reduce((acc, c) => acc + (c.total || 0), 0);
    prow[PP.nb_circuits_actifs]= P.circuits.filter(c => (c.total || 0) >= 1).length;
    prow[PP.nb_circuits_haut]  = P.circuits.filter(c => c.niveau === 'HAUT').length;

    pilierRows.push(prow);

    modes[P.pilier_code] = {
      libelle: sp.mode_libelle || '',
      statut:  sp.mode_statut  || '',   // "FOURNI" | "PROPOSITION"
    };

    logger.info('P-A v2 — pilier traité', {
      candidat_id,
      pilier:       P.pilier_code,
      circuits:     P.circuits.length,
      mode_statut:  modes[P.pilier_code].statut,
    });
  }

  // ─── 4. Écriture en une passe (delete+create all-or-nothing) ─────────
  await airtableService.writeEtape1T3Circuits(candidat_id, circuitRows);
  await airtableService.writeEtape1T3Piliers(candidat_id, pilierRows);

  logger.info('P-A v2 — terminé', {
    candidat_id,
    nb_circuits: circuitRows.length,
    nb_piliers:  pilierRows.length,
    cost:        totalCost,
    elapsedMs:   Date.now() - startTime,
  });

  return {
    candidat_id,
    modes,                        // pour la gate de validation Isabelle avant P-B
    nb_circuits: circuitRows.length,
    nb_piliers:  pilierRows.length,
    cost: totalCost,
  };
}

module.exports = { runAnalysePiliers };
