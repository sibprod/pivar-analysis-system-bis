// services/etape1/service_etape1_T2_phase4_circuits_pourbilan.js
// MISSION DE FIN D'ÉTAPE 1.2 — Phase 4 — v1.0
// Profil-Cognitif Sib Prod
//
// ─────────────────────────────────────────────────────────────────────────────
// RESPONSABILITÉ UNIQUE
// ─────────────────────────────────────────────────────────────────────────────
// Projeter l'inventaire figé de l'étape 1.2 en une table PRÊTE À LIRE pour
// l'agent PA pilier (étape 1.3), sans rien recalculer des chiffres sources.
//
// La table ETAPE1_T2_CIRCUITS_POURBILAN ajoute à l'inventaire brut, par pur
// calcul mécanique (ZÉRO LLM, ZÉRO interprétation) :
//   - le NOM EN CLAIR du circuit, résolu sur la paire (pilier, circuit_id)
//     → impossible de confondre P1C1 / P2C1 / P3C1 (gestes différents)
//   - le NIVEAU CŒUR     (HAUT≥4 · MOYEN 2-3 · FAIBLE 1 · EN_SOUTIEN 0)
//   - le NIVEAU AMPLITUDE (HAUT≥8 · MOYEN 4-7 · FAIBLE 1-3, calculé toujours)
//   - le BLOC (têtière de fréquence, déduit du niveau cœur)
//   - les ADDITIONS : sous-total par bloc, total par pilier, total général
//
// SOURCES LUES (jamais écrites) :
//   ETAPE1_T2_INVENTAIRE_CIRCUITS  tblUHZjXIW9jp9nIf  (cœur/instru/total figés)
//   ETAPE1_T2_VENTILATION_PILIERS  tbl4UzvAMQY4nRnI5  (rang → rôle du pilier)
//   REFERENTIEL_CIRCUITS           tbllMoTjOsILuzR6m  (nom officiel par PxCy)
//   REFERENTIEL_PILIERS            tblf4OodQ2Qi5xSXs  (nom officiel du pilier)
//
// SORTIE : ETAPE1_T2_CIRCUITS_POURBILAN (créée si absente) — delete+create
//          par candidat, idempotente.
//
// DÉPLOIEMENT : pousser sur GitHub → Render. La table est créée par CODE via
//               l'API meta schéma au premier run (clé AIRTABLE_TOKEN scope write).
//
// USAGE :
//   node service_etape1_T2_phase4_circuits_pourbilan.js <candidat_id> [--dry-run]
// ─────────────────────────────────────────────────────────────────────────────

'use strict';
require('dotenv').config();
const Airtable = require('airtable');

// ═══════════════════════════════════════════════════════════════
// CONFIG
// ═══════════════════════════════════════════════════════════════

const BASE_ID = 'appgghhXjYBdFRras';
const TOKEN   = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;

const T = {
  INVENTAIRE:   'tblUHZjXIW9jp9nIf',
  VENTILATION:  'tbl4UzvAMQY4nRnI5',
  REF_CIRCUITS: 'tbllMoTjOsILuzR6m',
  REF_PILIERS:  'tblf4OodQ2Qi5xSXs',
};

// Nom de la table de sortie (résolu en tableId au runtime via meta API)
const TABLE_SORTIE = 'ETAPE1_T2_CIRCUITS_POURBILAN';

const PILIERS = ['P1', 'P2', 'P3', 'P4', 'P5'];

// rang VENTILATION → rôle pilier
const RANG_TO_ROLE = { 1: 'socle', 2: 'amont', 3: 'aval', 4: 'fonctionnel', 5: 'fonctionnel' };

// ═══════════════════════════════════════════════════════════════
// DÉFINITION DE LA TABLE (pour création via meta API)
// ═══════════════════════════════════════════════════════════════

const TABLE_FIELDS = [
  { name: 'candidat_id',        type: 'singleLineText' },
  { name: 'type_ligne',         type: 'singleSelect', options: { choices: [
      { name: 'CIRCUIT' }, { name: 'SOUS_TOTAL' }, { name: 'TOTAL_PILIER' }, { name: 'TOTAL_GENERAL' } ] } },
  { name: 'pilier_owner',       type: 'singleSelect', options: { choices: [
      { name: 'P1' }, { name: 'P2' }, { name: 'P3' }, { name: 'P4' }, { name: 'P5' } ] } },
  { name: 'pilier_nom',         type: 'singleLineText' },
  { name: 'rang_pilier',        type: 'number', options: { precision: 0 } },
  { name: 'role_pilier',        type: 'singleSelect', options: { choices: [
      { name: 'socle' }, { name: 'amont' }, { name: 'aval' }, { name: 'fonctionnel' } ] } },
  { name: 'circuit_code',       type: 'singleLineText' },
  { name: 'circuit_nom_clair',  type: 'singleLineText' },
  { name: 'bloc',               type: 'singleSelect', options: { choices: [
      { name: 'très souvent (4+)' }, { name: 'régulièrement (2-3)' },
      { name: 'de temps en temps (1)' }, { name: 'au service d\'un autre outil' } ] } },
  { name: 'ordre_bloc',         type: 'number', options: { precision: 0 } },
  { name: 'niveau_coeur',       type: 'singleSelect', options: { choices: [
      { name: 'HAUT' }, { name: 'MOYEN' }, { name: 'FAIBLE' }, { name: 'EN_SOUTIEN' } ] } },
  { name: 'niveau_amplitude',   type: 'singleSelect', options: { choices: [
      { name: 'HAUT' }, { name: 'MOYEN' }, { name: 'FAIBLE' } ] } },
  { name: 'activation_coeur',   type: 'number', options: { precision: 0 } },
  { name: 'instru_P1',          type: 'number', options: { precision: 0 } },
  { name: 'instru_P2',          type: 'number', options: { precision: 0 } },
  { name: 'instru_P3',          type: 'number', options: { precision: 0 } },
  { name: 'instru_P4',          type: 'number', options: { precision: 0 } },
  { name: 'instru_P5',          type: 'number', options: { precision: 0 } },
  { name: 'total_occurrences',  type: 'number', options: { precision: 0 } },
  { name: 'circuit_origine',    type: 'singleSelect', options: { choices: [
      { name: 'OFFICIEL' }, { name: 'AD_HOC' } ] } },
  { name: 'nom_ad_hoc',         type: 'singleLineText' },
  { name: 'rang_dans_pilier',   type: 'number', options: { precision: 0 } },
];

// ═══════════════════════════════════════════════════════════════
// RÈGLES DE NIVEAU (figées — doctrine validée)
// ═══════════════════════════════════════════════════════════════

function niveauCoeur(coeur) {
  if (coeur >= 4) return 'HAUT';
  if (coeur >= 2) return 'MOYEN';
  if (coeur === 1) return 'FAIBLE';
  return 'EN_SOUTIEN';                 // cœur 0 : jamais gouvernant
}

function niveauAmplitude(total) {       // calculé TOUJOURS, même si cœur 0
  if (total >= 8) return 'HAUT';
  if (total >= 4) return 'MOYEN';
  return 'FAIBLE';
}

function blocDepuisCoeur(coeur) {
  if (coeur >= 4) return { bloc: 'très souvent (4+)',           ordre: 0 };
  if (coeur >= 2) return { bloc: 'régulièrement (2-3)',         ordre: 1 };
  if (coeur === 1) return { bloc: 'de temps en temps (1)',      ordre: 2 };
  return            { bloc: 'au service d\'un autre outil',     ordre: 3 };
}

// ═══════════════════════════════════════════════════════════════
// META API — création de la table si absente (scope schema.bases:write)
// ═══════════════════════════════════════════════════════════════

async function metaFetch(path, method = 'GET', body = null) {
  const url = `https://api.airtable.com/v0/meta/bases/${BASE_ID}${path}`;
  const opts = {
    method,
    headers: {
      'Authorization': `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url, opts);
  const json = await res.json();
  if (!res.ok) {
    const msg = json?.error?.message || JSON.stringify(json);
    const err = new Error(`Meta API ${method} ${path} → ${res.status} : ${msg}`);
    err.status = res.status;
    err.body = json;
    throw err;
  }
  return json;
}

/**
 * Retourne le tableId de TABLE_SORTIE.
 *
 * DOCTRINE : ce service NE CRÉE JAMAIS de table. Le schéma de la base reste
 * sous le contrôle exclusif d'Isabelle. La table ETAPE1_T2_CIRCUITS_POURBILAN
 * doit être créée à la main, une fois, AVANT le premier run. Si elle est
 * absente, la mission s'arrête avec un message explicite — elle ne tente
 * aucune écriture de schéma (le token de prod n'a pas, et ne doit pas avoir,
 * le scope schema.bases:write).
 *
 * La liste des champs attendus est dans TABLE_FIELDS (consultable plus haut).
 */
async function ensureTableExists() {
  const schema = await metaFetch('/tables');               // lecture seule du schéma
  const found = schema.tables.find(t => t.name === TABLE_SORTIE);
  if (found) {
    console.log(`  Table "${TABLE_SORTIE}" trouvée (${found.id}).`);
    return found.id;
  }

  // Absente → on REFUSE de la créer. Arrêt net avec consigne claire.
  throw new Error(
    `Table "${TABLE_SORTIE}" absente de la base. `
    + `Ce service ne crée pas de table (le schéma reste sous contrôle manuel). `
    + `Créez la table à la main une fois, avec les ${TABLE_FIELDS.length} champs listés `
    + `dans TABLE_FIELDS de ce fichier, puis relancez. `
    + `Les options des champs "Sélection unique" peuvent rester vides : `
    + `elles se remplissent automatiquement à l'écriture (typecast).`
  );
}

// ═══════════════════════════════════════════════════════════════
// LECTURE DES SOURCES (par nom de champ — SDK retourne r.fields)
// ═══════════════════════════════════════════════════════════════

function base() {
  if (!TOKEN) throw new Error('AIRTABLE_TOKEN manquant');
  return new Airtable({ apiKey: TOKEN }).base(BASE_ID);
}

function selectAll(tableId, opts = {}) {
  return new Promise((resolve, reject) => {
    const recs = [];
    base()(tableId).select(opts)
      .eachPage((page, next) => { recs.push(...page); next(); },
                (err) => err ? reject(err) : resolve(recs));
  });
}

function fname(v) { return (v && typeof v === 'object' && v.name) ? v.name : v; }

// REFERENTIEL_CIRCUITS → map "P3C12" -> "Priorisation hiérarchique…"
async function lireNomsCircuits() {
  const recs = await selectAll(T.REF_CIRCUITS, { fields: ['pilier', 'circuit_id', 'circuit_nom'] });
  const map = {};
  for (const r of recs) {
    const p = r.fields['pilier'];
    const c = fname(r.fields['circuit_id']);
    const nom = r.fields['circuit_nom'] || '';
    if (p && c) map[`${p}${c}`] = nom;
  }
  return map;
}

// REFERENTIEL_PILIERS → map "P3" -> "Analyse et diagnostic"
async function lireNomsPiliers() {
  const recs = await selectAll(T.REF_PILIERS, { fields: ['pilier_code', 'pilier_nom'] });
  const map = {};
  for (const r of recs) {
    const code = r.fields['pilier_code'];
    const nom  = r.fields['pilier_nom'] || '';
    if (code) map[code] = nom;
  }
  return map;
}

// VENTILATION → map "P3" -> { rang, role }
async function lireArchitecture(candidat_id) {
  const recs = await selectAll(T.VENTILATION, {
    filterByFormula: `{candidat_id} = "${candidat_id}"`,
  });
  const map = {};
  for (const r of recs) {
    const code = fname(r.fields['pilier_coeur']);
    const rang = Number(r.fields['rang_par_frequence'] || 0);
    if (code) map[code] = { rang, role: RANG_TO_ROLE[rang] || 'fonctionnel' };
  }
  return map;
}

// INVENTAIRE → liste brute des circuits du candidat (LIGNE À LIGNE, aucun écrasement)
async function lireInventaire(candidat_id) {
  const recs = await selectAll(T.INVENTAIRE, {
    filterByFormula: `{candidat_id} = "${candidat_id}"`,
    sort: [
      { field: 'pilier_owner',     direction: 'asc' },
      { field: 'rang_dans_pilier', direction: 'asc' },
    ],
  });
  return recs.map(r => ({
    pilier:       fname(r.fields['pilier_owner']),
    circuit_id:   fname(r.fields['circuit_id']),       // "C12"
    code:         r.fields['circuit_label'] || '',     // "P3C12" ou "P5·ADHOC \"…\""
    origine:      fname(r.fields['circuit_origine']) || 'OFFICIEL',
    nom_ad_hoc:   r.fields['nom_ad_hoc'] || '',
    coeur:        Number(r.fields['nb_coeur'] || 0),
    svc_P1:       Number(r.fields['nb_svc_P1'] || 0),
    svc_P2:       Number(r.fields['nb_svc_P2'] || 0),
    svc_P3:       Number(r.fields['nb_svc_P3'] || 0),
    svc_P4:       Number(r.fields['nb_svc_P4'] || 0),
    svc_P5:       Number(r.fields['nb_svc_P5'] || 0),
    total:        Number(r.fields['total_activations'] || 0),
    rang_pilier_circuit: Number(r.fields['rang_dans_pilier'] || 0),
  }));
}

// ═══════════════════════════════════════════════════════════════
// CONSTRUCTION DES LIGNES À GRAVER
// ═══════════════════════════════════════════════════════════════

function vecZero() { return { coeur: 0, P1: 0, P2: 0, P3: 0, P4: 0, P5: 0, total: 0 }; }
function vecAdd(acc, c) {
  acc.coeur += c.coeur; acc.P1 += c.svc_P1; acc.P2 += c.svc_P2;
  acc.P3 += c.svc_P3; acc.P4 += c.svc_P4; acc.P5 += c.svc_P5; acc.total += c.total;
}

function construireLignes(candidat_id, inventaire, archi, nomsCircuits, nomsPiliers) {
  const lignes = [];
  const general = vecZero();

  // Ordre des piliers par rang (socle d'abord) ; piliers absents de la ventilation à la fin
  const piliersPresents = [...new Set(inventaire.map(c => c.pilier))]
    .filter(p => PILIERS.includes(p))
    .sort((a, b) => (archi[a]?.rang || 99) - (archi[b]?.rang || 99));

  for (const P of piliersPresents) {
    const circuits = inventaire.filter(c => c.pilier === P);
    const rangP = archi[P]?.rang || 0;
    const roleP = archi[P]?.role || 'fonctionnel';
    const nomP  = nomsPiliers[P] || P;

    // Tri intra-pilier : par bloc (ordre), puis cœur desc, puis total desc
    circuits.sort((a, b) => {
      const ba = blocDepuisCoeur(a.coeur).ordre, bb = blocDepuisCoeur(b.coeur).ordre;
      if (ba !== bb) return ba - bb;
      if (b.coeur !== a.coeur) return b.coeur - a.coeur;
      return b.total - a.total;
    });

    const totalPilier = vecZero();
    let blocCourant = null;
    let sousTotal = vecZero();

    const flushSousTotal = () => {
      if (blocCourant === null) return;
      lignes.push({
        candidat_id, type_ligne: 'SOUS_TOTAL', pilier_owner: P, pilier_nom: nomP,
        rang_pilier: rangP, role_pilier: roleP,
        bloc: blocCourant, ordre_bloc: blocDepuisCoeur_ordreFromLabel(blocCourant),
        activation_coeur: sousTotal.coeur,
        instru_P1: sousTotal.P1, instru_P2: sousTotal.P2, instru_P3: sousTotal.P3,
        instru_P4: sousTotal.P4, instru_P5: sousTotal.P5,
        total_occurrences: sousTotal.total,
      });
      sousTotal = vecZero();
    };

    for (const c of circuits) {
      const { bloc, ordre } = blocDepuisCoeur(c.coeur);
      if (bloc !== blocCourant) { flushSousTotal(); blocCourant = bloc; }

      const isAdhoc = (c.origine === 'AD_HOC') || /ADHOC/i.test(c.code);
      // Nom en clair : résolu sur la paire (pilier, circuit_id) — jamais le numéro seul
      let nomClair;
      if (isAdhoc) {
        nomClair = c.nom_ad_hoc || c.code;
      } else {
        const cle = `${P}${c.circuit_id}`;          // ex "P3C12"
        nomClair = nomsCircuits[cle] || `[nom introuvable ${cle}]`;
      }

      lignes.push({
        candidat_id, type_ligne: 'CIRCUIT', pilier_owner: P, pilier_nom: nomP,
        rang_pilier: rangP, role_pilier: roleP,
        circuit_code: isAdhoc ? `${P}·ADHOC` : `${P}${c.circuit_id}`,
        circuit_nom_clair: nomClair,
        bloc, ordre_bloc: ordre,
        niveau_coeur: niveauCoeur(c.coeur),
        niveau_amplitude: niveauAmplitude(c.total),
        activation_coeur: c.coeur,
        // case du pilier owner = 0 (un outil ne se sert pas de lui-même)
        instru_P1: P === 'P1' ? 0 : c.svc_P1,
        instru_P2: P === 'P2' ? 0 : c.svc_P2,
        instru_P3: P === 'P3' ? 0 : c.svc_P3,
        instru_P4: P === 'P4' ? 0 : c.svc_P4,
        instru_P5: P === 'P5' ? 0 : c.svc_P5,
        total_occurrences: c.total,
        circuit_origine: isAdhoc ? 'AD_HOC' : 'OFFICIEL',
        nom_ad_hoc: isAdhoc ? (c.nom_ad_hoc || '') : '',
        rang_dans_pilier: c.rang_pilier_circuit,
      });

      vecAdd(sousTotal, c);
      vecAdd(totalPilier, c);
      vecAdd(general, c);
    }
    flushSousTotal();

    // Ligne TOTAL_PILIER
    lignes.push({
      candidat_id, type_ligne: 'TOTAL_PILIER', pilier_owner: P, pilier_nom: nomP,
      rang_pilier: rangP, role_pilier: roleP,
      activation_coeur: totalPilier.coeur,
      instru_P1: totalPilier.P1, instru_P2: totalPilier.P2, instru_P3: totalPilier.P3,
      instru_P4: totalPilier.P4, instru_P5: totalPilier.P5,
      total_occurrences: totalPilier.total,
    });
  }

  // Ligne TOTAL_GENERAL (toutes fonctionnalités confondues)
  lignes.push({
    candidat_id, type_ligne: 'TOTAL_GENERAL',
    circuit_nom_clair: 'TOTAL — toutes les fonctionnalités',
    activation_coeur: general.coeur,
    instru_P1: general.P1, instru_P2: general.P2, instru_P3: general.P3,
    instru_P4: general.P4, instru_P5: general.P5,
    total_occurrences: general.total,
  });

  return lignes;
}

function blocDepuisCoeur_ordreFromLabel(label) {
  return { 'très souvent (4+)': 0, 'régulièrement (2-3)': 1,
           'de temps en temps (1)': 2, 'au service d\'un autre outil': 3 }[label] ?? 9;
}

// ═══════════════════════════════════════════════════════════════
// ÉCRITURE (delete + create, idempotent par candidat)
// ═══════════════════════════════════════════════════════════════

async function purgerCandidat(tableId, candidat_id) {
  const recs = await selectAll(tableId, {
    filterByFormula: `{candidat_id} = "${candidat_id}"`,
    fields: ['candidat_id'],
  });
  const ids = recs.map(r => r.id);
  for (let i = 0; i < ids.length; i += 10) {
    const lot = ids.slice(i, i + 10);
    await new Promise((resolve, reject) =>
      base()(tableId).destroy(lot, (err) => err ? reject(err) : resolve()));
  }
  return ids.length;
}

async function graver(tableId, lignes) {
  for (let i = 0; i < lignes.length; i += 10) {
    const lot = lignes.slice(i, i + 10).map(f => ({ fields: f }));
    await new Promise((resolve, reject) =>
      base()(tableId).create(lot, { typecast: true }, (err) => err ? reject(err) : resolve()));
  }
}

// ═══════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════

async function runPhase4({ candidat_id, dry_run = false }) {
  console.log(`\n${'═'.repeat(60)}\nPHASE 4 — CIRCUITS_POURBILAN — ${candidat_id}\n${'═'.repeat(60)}`);

  const [nomsCircuits, nomsPiliers, archi, inventaire] = await Promise.all([
    lireNomsCircuits(), lireNomsPiliers(), lireArchitecture(candidat_id), lireInventaire(candidat_id),
  ]);

  if (!inventaire.length) throw new Error(`Phase 4 : INVENTAIRE vide pour ${candidat_id}`);
  console.log(`  Inventaire lu : ${inventaire.length} circuits`);

  const lignes = construireLignes(candidat_id, inventaire, archi, nomsCircuits, nomsPiliers);
  const nbCircuits = lignes.filter(l => l.type_ligne === 'CIRCUIT').length;
  console.log(`  Lignes construites : ${lignes.length} (dont ${nbCircuits} circuits)`);

  if (dry_run) {
    console.log('  [DRY-RUN] aucune écriture. Aperçu des 3 premières lignes :');
    console.log(JSON.stringify(lignes.slice(0, 3), null, 2));
    return { candidat_id, nb_lignes: lignes.length, nb_circuits: nbCircuits, dry_run: true };
  }

  const tableId = await ensureTableExists();
  const purges = await purgerCandidat(tableId, candidat_id);
  if (purges) console.log(`  ${purges} ancienne(s) ligne(s) purgée(s)`);
  await graver(tableId, lignes);
  console.log(`  ✅ ${lignes.length} lignes gravées dans ${TABLE_SORTIE}`);

  return { candidat_id, nb_lignes: lignes.length, nb_circuits: nbCircuits, tableId };
}

// ═══════════════════════════════════════════════════════════════
// CLI
// ═══════════════════════════════════════════════════════════════

if (require.main === module) {
  const args = process.argv.slice(2);
  if (!args[0] || args[0].startsWith('--')) {
    console.error('Usage: node service_etape1_T2_phase4_circuits_pourbilan.js <candidat_id> [--dry-run]');
    process.exit(1);
  }
  const candidat_id = args[0];
  const dry_run = args.includes('--dry-run');
  runPhase4({ candidat_id, dry_run })
    .then(r => { console.log('\nTerminé :', JSON.stringify(r)); process.exit(0); })
    .catch(e => { console.error('\nERREUR FATALE:', e.message); process.exit(1); });
}

module.exports = { runPhase4, _internal: {
  niveauCoeur, niveauAmplitude, blocDepuisCoeur, construireLignes, TABLE_FIELDS,
}};
