// services/etape1/etape1_t3/bilan_fable/service_etape1_T3_preparation.js
// PRÉPARATION T3 — v1.0 (19/06/2026)
//
// Remplace É0 (extraction) + É0b (initialisation), fusionnés.
//
// RÔLE UNIQUE : « le commis qui sort les ingrédients et dresse le plan de travail ».
//   1. LIT la table figée ETAPE1_T2_CIRCUITS_POURBILAN (tout est déjà calculé : rôle,
//      niveaux cœur/amplitude, capacité, instrumentaux, totaux, bloc, ordre).
//      → AUCUN recalcul. On lit, on ne dérive rien.
//   2. LIT les verbatims (T2_FABLE) pour les transmettre à l'agent rédacteur.
//   3. PRÉSERVE un pilier_mode déjà validé s'il existe dans T3_PILIER.
//   4. CRÉE les coquilles vides T3_BILAN → T3_PILIER → T3_CIRCUIT, avec les chiffres
//      figés déjà posés dedans, prêtes à être remplies par l'agent rédacteur (P-A).
//
// CE QUI A DISPARU vs ancien É0/É0b (l'« usine à gaz ») :
//   - lecture VENTILATION_PILIERS (rôle/ordre)   → lus dans POURBILAN
//   - lecture INVENTAIRE_CIRCUITS (cœur/total)   → lus dans POURBILAN
//   - fonction niveauFromCoeur()                 → niveaux déjà figés
//   - table RANG_TO_ROLE + slots str1/str2/fn    → vocabulaire périmé supprimé
//
// SORTIE : { candidat_id, piliers[], bilanRecId, pilierMap }
//   piliers[] sert à l'agent rédacteur (P-A) ; bilanRecId/pilierMap sont les rec_ids créés.

'use strict';

const airtableConfig  = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const logger          = require('../../../../utils/logger');

const POURBILAN = airtableConfig.ETAPE1_T2_CIRCUITS_POURBILAN_FIELDS;
const F_PIL      = airtableConfig.ETAPE1_T3_PILIER_FIELDS;
const F_CIR      = airtableConfig.ETAPE1_T3_CIRCUIT_FIELDS;
const F_BIL      = airtableConfig.ETAPE1_T3_BILAN_FIELDS;

// Libellé de rôle affiché (vocabulaire officiel : socle / amont / aval / fonctionnel)
const ROLE_LABEL = {
  socle:        'Socle — le pilier qui gouverne tout le reste',
  amont:        'Pilier amont — ce qui alimente le socle',
  aval:         'Pilier aval — ce qui conclut',
  fonctionnel:  'Pilier fonctionnel — activé sous contrainte',
};

// Mapping rôle → slot de champ dans T3_BILAN.
// ⚠️ Les NOMS de champs de T3_BILAN sont historiques (str1/str2/fn1/fn2) et figés dans la
// structure Airtable. On NE réintroduit PAS ce vocabulaire ailleurs : il ne sert qu'à viser
// la bonne colonne du bilan. Le 2e amont éventuel et le 2e fonctionnel prennent le slot libre.
const ROLE_TO_BILAN_SLOT = {
  socle:        { code: 'pilier_socle', label: 'pilier_socle_label' },
  amont:        { code: 'pilier_str1',  label: 'pilier_str1_label'  },
  aval:         { code: 'pilier_str2',  label: 'pilier_str2_label'  },
  fonctionnel:  { code: 'pilier_fn1',   label: 'pilier_fn1_label'   },
};

// Helper : un singleSelect Airtable revient en objet { name } ; on extrait le nom.
function nom(val) {
  if (val === null || val === undefined) return '';
  if (typeof val === 'object') return val.name || '';
  return String(val);
}
function num(val) {
  const n = Number(val);
  return Number.isFinite(n) ? n : 0;
}

// ═══════════════════════════════════════════════════════════════
// 1. LECTURE DE LA TABLE FIGÉE → structure piliers[] (aucun recalcul)
// ═══════════════════════════════════════════════════════════════

async function lireStructureDepuisPourbilan(candidat_id) {
  // getEtape1T2CircuitsPourbilan trie déjà par rang_pilier / ordre_bloc / rang_dans_pilier.
  const rows = await airtableService.getEtape1T2CircuitsPourbilan(candidat_id);
  if (!rows || !rows.length) {
    throw new Error(`Préparation T3 : CIRCUITS_POURBILAN vide pour ${candidat_id}`);
  }

  // On ne garde que les lignes de circuit (on ignore SOUS_TOTAL / TOTAL_PILIER / TOTAL_GENERAL).
  const lignesCircuit = rows.filter(r => nom(r[POURBILAN.type_ligne]) === 'CIRCUIT');

  // Regroupement par pilier, dans l'ordre d'apparition (déjà trié par la lecture).
  const ordrePiliers = [];
  const parPilier = {};

  for (const r of lignesCircuit) {
    const pilier_code = nom(r[POURBILAN.pilier_owner]);
    if (!/^P[1-5]$/.test(pilier_code)) continue;

    if (!parPilier[pilier_code]) {
      parPilier[pilier_code] = {
        pilier_code,
        pilier_nom:  nom(r[POURBILAN.pilier_nom]) || pilier_code,
        role_pilier: nom(r[POURBILAN.role_pilier]) || 'fonctionnel',  // déjà socle/amont/aval/fonctionnel
        circuits: [],
      };
      ordrePiliers.push(pilier_code);
    }

    const coeur = num(r[POURBILAN.activation_coeur]);
    const total = num(r[POURBILAN.total_occurrences]);

    parPilier[pilier_code].circuits.push({
      code:             nom(r[POURBILAN.circuit_code]),          // "P3C12" ou "P5·ADHOC"
      nom:              nom(r[POURBILAN.circuit_nom_clair]),
      capacite:         nom(r[POURBILAN['capacité']]),           // ⚠️ clé littérale avec accent
      coeur,
      total,
      niveau_coeur:     nom(r[POURBILAN.niveau_coeur]),          // figé : HAUT/MOYEN/FAIBLE/EN_SOUTIEN
      niveau_amplitude: nom(r[POURBILAN.niveau_amplitude]),      // figé : HAUT/MOYEN/FAIBLE
      bloc:             nom(r[POURBILAN.bloc]),
      adhoc:            nom(r[POURBILAN.circuit_origine]) === 'AD_HOC',
      nom_ad_hoc:       nom(r[POURBILAN.nom_ad_hoc]),
      instrumentaux: {
        P1: num(r[POURBILAN.instru_P1]),
        P2: num(r[POURBILAN.instru_P2]),
        P3: num(r[POURBILAN.instru_P3]),
        P4: num(r[POURBILAN.instru_P4]),
        P5: num(r[POURBILAN.instru_P5]),
      },
    });
  }

  // echelle_classement : "coeur" si le pilier a au moins un circuit qui gouverne, sinon "total".
  const piliers = ordrePiliers.map(code => {
    const p = parPilier[code];
    const aDuCoeur = p.circuits.some(c => c.coeur > 0);
    return { ...p, echelle_classement: aDuCoeur ? 'coeur' : 'total' };
  });

  return piliers;
}

// ═══════════════════════════════════════════════════════════════
// 2. VERBATIMS (T2_FABLE) — regroupés par circuit pour transmission à l'agent
// ═══════════════════════════════════════════════════════════════
//
// T2_FABLE = 1 ligne par circuit et par candidat. Field IDs vérifiés sur pièce (19/06) :
//   fldbHyiLdkkRU6B0J = candidat_id · fldkByLh883MLtHB3 = pilier ("P3")
//   fldf3Rfux16asTI0I = circuit (code court "C10") · fldHd6KNM11jQTcts = détail verbatims
//   fldWlSKIGYrtvEBCT = signal_limbique
// On lit par field IDs (méthode éprouvée du service P-A), pas par noms, pour ne rien deviner.
const FT2 = {
  candidat_id: 'fldbHyiLdkkRU6B0J',
  pilier:      'fldkByLh883MLtHB3',
  circuit:     'fldf3Rfux16asTI0I',
  detail:      'fldHd6KNM11jQTcts',
  signal:      'fldWlSKIGYrtvEBCT',
};

async function lireVerbatims(candidat_id) {
  const Airtable = require('airtable');
  const token = airtableConfig.TOKEN || process.env.AIRTABLE_TOKEN;
  const base  = new Airtable({ apiKey: token }).base(airtableConfig.BASE_ID || 'appgghhXjYBdFRras');

  const recs = await new Promise((resolve, reject) => {
    const out = [];
    base(airtableConfig.TABLES.ETAPE1_T2_FABLE)
      .select({
        filterByFormula: `{candidat_id} = "${candidat_id}"`,
        returnFieldsByFieldId: true,
      })
      .eachPage((page, next) => { out.push(...page); next(); },
                (err) => err ? reject(err) : resolve(out));
  });

  // Indexé par "PxCy" → on laisse le détail brut ; l'agent rédacteur fera son parsing fin.
  const parCircuit = {};
  for (const r of recs) {
    const pilier  = nom(r.fields[FT2.pilier]);     // "P3"
    const circuit = nom(r.fields[FT2.circuit]);    // "C10"
    if (!pilier || !circuit) continue;
    const code = `${pilier}${circuit}`;
    parCircuit[code] = {
      detail:          r.fields[FT2.detail] || '',
      signal_limbique: nom(r.fields[FT2.signal]),
    };
  }
  return parCircuit;
}

// ═══════════════════════════════════════════════════════════════
// 3. MODES DÉJÀ VALIDÉS (T3_PILIER) — à préserver
// ═══════════════════════════════════════════════════════════════

async function lireModesExistants(candidat_id) {
  const modeParPilier = {};
  try {
    const t3piliers = await airtableService.getEtape1T3Piliers(candidat_id);
    for (const p of (t3piliers || [])) {
      const code = nom(p[F_PIL.pilier]) || nom(p.pilier);
      const mode = p[F_PIL.pilier_mode] || p.pilier_mode || '';
      if (code && mode) modeParPilier[code] = mode;
    }
  } catch (e) {
    logger.warn('Préparation T3 : lecture modes existants impossible (non bloquant)', { candidat_id, error: e.message });
  }
  return modeParPilier;
}

// ═══════════════════════════════════════════════════════════════
// 4. CRÉATION DES COQUILLES VIDES T3 (ordre : BILAN → PILIER → CIRCUIT)
// ═══════════════════════════════════════════════════════════════

async function creerCoquillesT3(candidat_id, piliers) {
  // ── 4a. Identité candidat ───────────────────────────────────────────────
  const visiteur = await airtableService.getVisiteur(candidat_id);
  const civilite = visiteur?.civilite_candidat || visiteur?.civilite || '';
  const prenom   = visiteur?.Prenom || visiteur?.prenom || '';
  const nomFam   = visiteur?.Nom    || visiteur?.nom    || '';

  // ── 4b. T3_BILAN (1 record) ─────────────────────────────────────────────
  const socle = piliers.find(p => p.role_pilier === 'socle') || piliers[0];
  const bilanFields = {
    [F_BIL.candidat_id]:        candidat_id,
    [F_BIL.version_bilan]:      'FABLE_5',
    [F_BIL.civilite]:           civilite,
    [F_BIL.prenom]:             prenom,
    [F_BIL.nom]:                nomFam,
    [F_BIL.pilier_socle]:       socle?.pilier_code || '',
    [F_BIL.pilier_socle_label]: socle?.pilier_nom  || '',
  };
  // Slots du bilan : on vise la bonne colonne historique selon le rôle, sans dupliquer un slot.
  const slotsUtilises = new Set();
  for (const p of piliers) {
    if (p.role_pilier === 'socle') continue;
    let slot = ROLE_TO_BILAN_SLOT[p.role_pilier];
    // Si le slot principal du rôle est déjà pris (ex. 2 fonctionnels), basculer sur le slot suivant.
    if (slot && slotsUtilises.has(slot.code)) {
      if (p.role_pilier === 'amont')       slot = { code: 'pilier_str2', label: 'pilier_str2_label' };
      else if (p.role_pilier === 'fonctionnel') slot = { code: 'pilier_fn2', label: 'pilier_fn2_label' };
    }
    if (slot && F_BIL[slot.code]) {
      bilanFields[F_BIL[slot.code]]  = p.pilier_code;
      bilanFields[F_BIL[slot.label]] = p.pilier_nom;
      slotsUtilises.add(slot.code);
    }
  }
  const bilanRecId = await airtableService.upsertEtape1T3Bilan(candidat_id, bilanFields);
  logger.info('Préparation T3 — T3_BILAN prêt', { candidat_id, bilanRecId });

  // ── 4c. T3_PILIER (1 record par pilier) ─────────────────────────────────
  const pilierRows = piliers.map(p => ({
    [F_PIL.candidat_id]:        candidat_id,
    [F_PIL.pilier]:             p.pilier_code,
    [F_PIL.pilier_label]:       p.pilier_nom,
    [F_PIL.role_pilier]:        p.role_pilier,                       // socle/amont/aval/fonctionnel
    [F_PIL.pilier_role_label]:  ROLE_LABEL[p.role_pilier] || p.role_pilier,
    [F_PIL.pilier_mode]:        p.pilier_mode || '',                 // préservé si déjà validé
    [F_PIL.bilan_link]:         bilanRecId ? [bilanRecId] : [],
    [F_PIL.nb_activations]:     p.circuits.reduce((s, c) => s + c.coeur, 0),
    [F_PIL.nb_circuits_actifs]: p.circuits.filter(c => c.coeur > 0).length,
    [F_PIL.nb_circuits_haut]:   p.circuits.filter(c => c.niveau_coeur === 'HAUT').length,
  }));
  const pilierMap = await airtableService.writeEtape1T3Piliers(candidat_id, pilierRows);
  logger.info('Préparation T3 — T3_PILIER prêts', { candidat_id, count: pilierMap.size });

  // ── 4d. T3_CIRCUIT (1 record par circuit), chiffres figés posés dedans ───
  const circuitRows = [];
  let ordrePilier = 0;
  for (const p of piliers) {
    ordrePilier++;
    const pilierRecId = pilierMap.get(p.pilier_code);
    let ordreCircuit = 0;
    for (const c of p.circuits) {
      ordreCircuit++;
      // circuit_id court : "C12" depuis "P3C12" ; pour ADHOC on garde le code tel quel.
      const circuit_id = c.code.startsWith(p.pilier_code)
        ? c.code.slice(p.pilier_code.length)
        : c.code;
      circuitRows.push({
        [F_CIR.candidat_id]:       candidat_id,
        [F_CIR.pilier]:            p.pilier_code,
        [F_CIR.circuit_id]:        circuit_id,
        [F_CIR.circuit_nom]:       c.nom || '',
        [F_CIR.circuit_freq]:      c.coeur,
        [F_CIR.circuit_niveau]:    c.niveau_coeur,
        [F_CIR.total_activations]: c.total,
        [F_CIR.en_svc_P1]:         c.instrumentaux.P1,
        [F_CIR.en_svc_P2]:         c.instrumentaux.P2,
        [F_CIR.en_svc_P3]:         c.instrumentaux.P3,
        [F_CIR.en_svc_P4]:         c.instrumentaux.P4,
        [F_CIR.en_svc_P5]:         c.instrumentaux.P5,
        [F_CIR.ordre_pilier]:      ordrePilier,
        [F_CIR.ordre_circuit]:     ordreCircuit,
        [F_CIR.bilan_link]:        bilanRecId  ? [bilanRecId]  : [],
        [F_CIR.pilier_link]:       pilierRecId ? [pilierRecId] : [],
      });
    }
  }
  await airtableService.writeEtape1T3Circuits(candidat_id, circuitRows);
  logger.info('Préparation T3 — T3_CIRCUIT prêts', { candidat_id, count: circuitRows.length });

  return { bilanRecId, pilierMap };
}

// ═══════════════════════════════════════════════════════════════
// ORCHESTRATION
// ═══════════════════════════════════════════════════════════════

async function preparerT3({ candidat_id }) {
  const t = Date.now();
  logger.info('Préparation T3 — démarrage', { candidat_id });

  // Lectures (tout en lecture, aucun recalcul)
  const [piliersBruts, verbatims, modes] = await Promise.all([
    lireStructureDepuisPourbilan(candidat_id),
    lireVerbatims(candidat_id),
    lireModesExistants(candidat_id),
  ]);

  // Injecter le mode préservé + les verbatims dans la structure
  const piliers = piliersBruts.map(p => ({
    ...p,
    pilier_mode: modes[p.pilier_code] || '',
    mode_statut: modes[p.pilier_code] ? 'FOURNI' : 'A_PROPOSER',
    circuits: p.circuits.map(c => ({
      ...c,
      verbatims_source: verbatims[c.code]?.detail || '',
      signal_limbique:  verbatims[c.code]?.signal_limbique || '',
    })),
  }));

  // Créer les coquilles vides T3
  const { bilanRecId, pilierMap } = await creerCoquillesT3(candidat_id, piliers);

  logger.info('Préparation T3 — terminée', {
    candidat_id,
    nb_piliers: piliers.length,
    nb_circuits: piliers.reduce((s, p) => s + p.circuits.length, 0),
    elapsedMs: Date.now() - t,
  });

  return { candidat_id, piliers, bilanRecId, pilierMap };
}

module.exports = { preparerT3 };
