// services/etape1/bilan_fable/serviceP_A.js
// P-A — ANALYSE PILIER (chaîne bilan FABLE) — v1.0 (13/06/2026)
//
// Rôle : pour chaque pilier (ordre socle → str1 → str2 → fn1 → fn2), appelle
// l'agent PROMPT_ANALYSE_PILIER_v7 avec le payload produit par É0, parse sa
// sortie JSON (contrat verrouillé), et assemble des lignes T3_CIRCUIT et
// T3_PILIER COMPLÈTES (chiffres d'É0 + rédactionnel de l'agent + identité).
//
// ⚠️ ÉCRITURE EN UNE PASSE. writeEtape1T3Circuits / writeEtape1T3Piliers font
// un delete+create de TOUTES les lignes du candidat. On accumule donc les 5
// piliers et on écrit une seule fois à la fin — sinon chaque écriture effacerait
// les piliers précédents.
//
// Décisions de mapping (toutes vérifiées en base le 13/06) :
//   - circuit_id est stocké SANS préfixe pilier : "P3C10" → "C10" (le pilier va
//     dans le champ `pilier`). ADHOC_* conservé tel quel.
//   - n2_verbatims : format « {texte exact} » ({qid} {LIEU}), un par ligne.
//   - n3_nuance ← explication (3 temps) ; explication_courte_ch4 ← explication_courte ;
//     en_renfort ← en_renfort ; chiffres (circuit_freq/niveau/en_svc/total) ← É0.
//   - ou_revient : le template consomme {{pN.ou_revient}} mais aucune case dédiée
//     n'existe (pas de create_field disponible). On réutilise le champ vide et
//     inutilisé `tableau_note` (fldKax0VwI4BhnLKV) pour stocker ou_outil_revient_candidat.
//     → le builder de rendu (buildPayload) devra mapper pN.ou_revient sur ce champ.
//   - role_pilier (singleSelect) ← role_slot d'É0 (socle/str1/str2/fn1/fn2).
//
// HORS PÉRIMÈTRE de ce service (dérivations de RENDU, pas du rédactionnel) :
//   - têtière composée : tetiere_rappel (synth_courte), tetiere_star, tetiere_roleband,
//     carte_role. Ce sont des dérivations chiffres+rôle (et la clause « Signal … »
//     dépend des marqueurs de P-D, transverses au bilan). Elles sont assemblées
//     côté rendu / buildPayload, pas inventées ici. Les compteurs (nb_*) eux sont
//     des chiffres d'É0 et sont écrits.

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const agentBase       = require('../../../infrastructure/agentBase');
const logger          = require('../../../../utils/logger');
const { buildContexteE0 } = require('./serviceE0_extraction');

const PROMPT_PATH = 'etape1/bilan/PROMPT_ANALYSE_PILIER_v7.md';

const PC = config.ETAPE1_T3_CIRCUIT_FIELDS;
const PP = config.ETAPE1_T3_PILIER_FIELDS;

// rôle architecture (É0) → valeur singleSelect role_pilier (config ALLOWED_VALUES)
const ROLE_SELECT = {
  socle: 'socle',
  str1:  'structurant_1',
  str2:  'structurant_2',
  fn1:   'fonctionnel_1',
  fn2:   'fonctionnel_2'
};

// ─── helpers ──────────────────────────────────────────────────────────────

// "P3C10" → "C10" ; "ADHOC_C17" → "ADHOC_C17" (inchangé)
function bareCircuitId(code) {
  return String(code).replace(/^P[1-5]/, '');
}

// verbatims_cites [{qid,lieu,texte}] → format stocké, vérifié en base
function formatVerbatims(cites) {
  if (!Array.isArray(cites) || cites.length === 0) return '';
  return cites
    .filter(v => v && v.texte)
    .map(v => `« ${v.texte} » (${v.qid || ''} ${v.lieu || ''})`.replace(/\s+\)/, ')'))
    .join('\n');
}

// récupère un champ d'un bloc par niveau (HAUT/MOYEN/FAIBLE)
function blocChamp(blocs, niveau, champ) {
  const b = (blocs || []).find(x => String(x.niveau || '').toUpperCase() === niveau);
  return b ? (b[champ] || '') : '';
}

// référentiel des profils-types groupés par pilier (tolérant si le getter n'existe pas)
async function chargerProfilsParPilier() {
  if (typeof airtableService.getReferentielProfils !== 'function') return {};
  try {
    const profils = await airtableService.getReferentielProfils();
    const out = {};
    for (const p of (profils || [])) {
      const pil = p.pilier || p.pilier_code;
      const lib = p.nom || p.profil_nom || p.libelle;
      if (pil && lib) { (out[pil] = out[pil] || []).push(lib); }
    }
    return out;
  } catch (e) {
    logger.warn('P-A: référentiel profils indisponible (mode PROPOSITION sans base de suggestion)', { err: e.message });
    return {};
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute les 5 analyses pilier et écrit T3_CIRCUIT + T3_PILIER en une passe.
 * @param {Object} p
 * @param {string} p.candidat_id
 * @param {string} [p.prenom]               prénom du candidat (pour le rédactionnel)
 * @param {Object} [p.modesValides]         { P1:'<mode>', ... } modes déjà validés (recopiés)
 * @returns {Promise<{candidat_id, modes, nb_circuits, nb_piliers, cost}>}
 */
async function runAnalysePiliers({ candidat_id, prenom = '', modesValides = null }) {
  const startTime = Date.now();
  logger.info('P-A — démarrage analyse des 5 piliers', { candidat_id });

  // 1. Contexte É0 (chiffres + verbatims + rôles), déterministe et auto-contrôlé
  const ctx = await buildContexteE0({ candidat_id });
  if (!ctx.piliers || ctx.piliers.length === 0) {
    throw new Error(`P-A: É0 n'a produit aucun pilier pour ${candidat_id}`);
  }

  const profilsParPilier = await chargerProfilsParPilier();

  const circuitRows = [];
  const pilierRows  = [];
  const modes       = {};
  let totalCost = 0;

  // 2. Boucle pilier par pilier (ordre socle → str1 → str2 → fn1 → fn2 fourni par É0)
  for (let i = 0; i < ctx.piliers.length; i++) {
    const P = ctx.piliers[i];

    const payload = {
      candidat_prenom: prenom,
      pilier_code: P.pilier_code,
      pilier_nom:  P.pilier_nom,
      pilier_role: P.pilier_role,
      echelle_classement: P.echelle_classement,
      sous_totaux_instrumentaux: P.sous_totaux_instrumentaux,
      signal_limbique: '',                 // fourni si dispo ; vide = l'agent n'invente pas
      synth_factuelle_coeur: '',           // optionnel (l'agent rédige profil_pur sinon)
      synth_factuelle_elargie: '',
      profils_types: profilsParPilier[P.pilier_code] || [],
      circuits: P.circuits.map(c => ({
        code: c.code, nom: c.nom, coeur: c.coeur, total: c.total,
        niveau: c.niveau, adhoc: c.adhoc, sortants: c.sortants, verbatims: c.verbatims
      }))
    };
    // mode recopié si déjà validé (permanence) ; sinon l'agent propose (cas B)
    if (modesValides && modesValides[P.pilier_code]) {
      payload.pilier_mode = modesValides[P.pilier_code];
    }

    const { result, cost } = await agentBase.callAgent({
      serviceName: `bilan_fable_PA_${P.pilier_code}`,
      promptPath:  PROMPT_PATH,
      payload,
      injectLexique: true,
      candidatId: candidat_id
    });
    totalCost += (cost || 0);

    if (!result || !result.synthese_pilier || !Array.isArray(result.circuits)) {
      throw new Error(`P-A: sortie agent invalide pour ${P.pilier_code} (synthese_pilier/circuits manquants)`);
    }

    // index du rédactionnel agent par code de circuit
    const agentByCode = {};
    for (const ac of result.circuits) agentByCode[ac.code] = ac;

    // 3a. lignes T3_CIRCUIT (chiffres É0 + rédactionnel agent), une par circuit
    P.circuits.forEach((c, j) => {
      const a = agentByCode[c.code] || {};
      const s = c.sortants || {};
      const row = {};
      row[PC.candidat_id]           = candidat_id;
      row[PC.pilier]                = P.pilier_code;
      row[PC.circuit_id]            = bareCircuitId(c.code);
      row[PC.circuit_nom]           = c.nom;
      row[PC.circuit_freq]          = c.coeur;
      row[PC.circuit_niveau]        = c.niveau;
      row[PC.total_activations]     = c.total;
      row[PC.en_svc_P1]             = s.P1 || 0;
      row[PC.en_svc_P2]             = s.P2 || 0;
      row[PC.en_svc_P3]             = s.P3 || 0;
      row[PC.en_svc_P4]             = s.P4 || 0;
      row[PC.en_svc_P5]             = s.P5 || 0;
      row[PC.n3_nuance]             = a.explication || '';
      row[PC.explication_courte_ch4] = a.explication_courte || '';
      row[PC.en_renfort]            = a.en_renfort || '';
      row[PC.n2_verbatims]          = formatVerbatims(a.verbatims_cites);
      row[PC.ordre_pilier]          = i + 1;
      row[PC.ordre_circuit]         = j + 1;
      circuitRows.push(row);
    });

    // 3b. ligne T3_PILIER (identité + rédactionnel agent + compteurs É0)
    const sp = result.synthese_pilier;
    const prow = {};
    prow[PP.candidat_id]        = candidat_id;
    prow[PP.pilier]             = P.pilier_code;
    prow[PP.pilier_label]       = P.pilier_nom;
    prow[PP.role_pilier]        = ROLE_SELECT[P.role_slot] || 'fonctionnel_1';
    prow[PP.cle_composite]      = `${candidat_id}_${P.pilier_code}`;
    prow[PP.pilier_mode]        = sp.mode_libelle || '';
    prow[PP.mode_explication]   = sp.mode_explication_candidat || '';
    prow[PP.intro_eclate]       = sp.intro_eclate || '';
    prow[PP.synth_interpretee]  = sp.vue_ensemble || '';
    prow[PP.synth_factuelle]    = sp.profil_pur || '';
    prow[PP.bloc_haut_candidat]  = blocChamp(result.blocs, 'HAUT',  'synth_candidat');
    prow[PP.bloc_moyen_candidat] = blocChamp(result.blocs, 'MOYEN', 'synth_candidat');
    prow[PP.bloc_faible_candidat] = blocChamp(result.blocs, 'FAIBLE', 'synth_candidat');
    prow[PP.bloc_haut_technique]  = blocChamp(result.blocs, 'HAUT',  'synth_technique');
    prow[PP.bloc_moyen_technique] = blocChamp(result.blocs, 'MOYEN', 'synth_technique');
    prow[PP.bloc_faible_technique] = blocChamp(result.blocs, 'FAIBLE', 'synth_technique');
    // ou_revient (template {{pN.ou_revient}}) stocké dans tableau_note réutilisé
    prow[PP.tableau_note]       = sp.ou_outil_revient_candidat || '';
    // compteurs (chiffres É0)
    prow[PP.nb_activations]     = P.circuits.reduce((acc, c) => acc + (c.total || 0), 0);
    prow[PP.nb_circuits_actifs] = P.circuits.filter(c => (c.total || 0) >= 1).length;
    prow[PP.nb_circuits_haut]   = P.circuits.filter(c => c.niveau === 'HAUT').length;
    pilierRows.push(prow);

    modes[P.pilier_code] = {
      libelle: sp.mode_libelle || '',
      statut:  sp.mode_statut  || ''   // FOURNI | PROPOSITION
    };

    logger.info('P-A — pilier traité', {
      candidat_id, pilier: P.pilier_code,
      circuits: P.circuits.length, mode_statut: modes[P.pilier_code].statut
    });
  }

  // 4. Écriture en une passe (delete+create all-or-nothing)
  await airtableService.writeEtape1T3Circuits(candidat_id, circuitRows);
  await airtableService.writeEtape1T3Piliers(candidat_id, pilierRows);

  const elapsedMs = Date.now() - startTime;
  logger.info('P-A — terminé', {
    candidat_id, nb_circuits: circuitRows.length, nb_piliers: pilierRows.length,
    cost: totalCost, elapsedMs
  });

  return {
    candidat_id,
    modes,                       // pour la gate de validation (avant P-B)
    nb_circuits: circuitRows.length,
    nb_piliers:  pilierRows.length,
    cost: totalCost
  };
}

module.exports = { runAnalysePiliers };
