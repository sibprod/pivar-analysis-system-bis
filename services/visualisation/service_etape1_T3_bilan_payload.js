// services/visualisation/service_etape1_T3_bilan_payload.js
// Payload service — Bilan Fable cognitif complet (chaîne P-A→P-D)
// v2.0 — 20/06/2026
//
// RÉÉCRITURE selon règles validées 20/06 :
//   - Le TABLEAU récap vient de ETAPE1_T2_CIRCUITS_POURBILAN (table figée), dans l'ordre,
//     avec capacité / niveau_coeur / niveau_amplitude / instrumentaux / total / bloc
//     + lignes SOUS_TOTAL / TOTAL_PILIER / TOTAL_GENERAL + colonne owner en "NA".
//   - Les CARTES détail viennent de T3_CIRCUIT (verbatims, expl, renfort, profondeur).
//     Nb d'exemples = activation_coeur, plafonné à 4 (5e rapproché géré côté agrégation).
//   - Les TÊTIÈRES / MODES / SYNTHÈSES (4 blocs) / blocs HAUT-MOYEN-FAIBLE viennent de T3_PILIER.
//   - Rôles : socle / amont / aval / fonctionnel (plus de structurant_1/2).
//
// Lectures Airtable :
//   - ETAPE1_T3_BILAN, VISITEUR, ETAPE1_T3_PILIER ×5, ETAPE1_T3_CIRCUIT ×n,
//   - ETAPE1_T2_CIRCUITS_POURBILAN (table figée — tableau + chiffres),
//   - ETAPE1_T2_VENTILATION_PILIERS (nb_reponses pour attestations CH2).

'use strict';

const airtableService = require('../infrastructure/airtableService');
const logger = require('../../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de formatage
// ─────────────────────────────────────────────────────────────────────────────
function safeStr(v) { return (v === null || v === undefined) ? '' : String(v); }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }
function safeJson(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}
// Affichage instrumental : '·' si 0
function svcAff(n) { const v = num(n); return v > 0 ? String(v) : '·'; }

// Rôle → classe CSS couleur (socle rouge, amont orange, aval jaune, fonctionnel vert)
function roleClassFromRole(role) {
  const r = safeStr(role).toLowerCase();
  if (r === 'socle')  return 'role-socle';
  if (r === 'amont')  return 'role-amont';
  if (r === 'aval')   return 'role-aval';
  return 'role-fonctionnel';
}
// Rôle → libellé court de têtière
function roleLabelFromRole(role) {
  const r = safeStr(role).toLowerCase();
  if (r === 'socle')  return 'Socle — il gouverne tout le reste';
  if (r === 'amont')  return 'Amont — il alimente le socle';
  if (r === 'aval')   return 'Aval — il conclut la chaîne';
  return 'Fonctionnel — mobilisé quand la tâche l’exige';
}
// niveau cœur → classe + libellé
function nivCoeurClass(niveau) {
  const n = safeStr(niveau).toUpperCase();
  if (n === 'HAUT')  return 'haut';
  if (n === 'MOYEN') return 'moyen';
  if (n === 'FAIBLE') return 'faible';
  if (n === 'EN_SOUTIEN' || n === 'EN SOUTIEN') return 'soutien';
  return '';
}
function nivLabel(niveau) {
  const n = safeStr(niveau).toUpperCase();
  if (n === 'EN_SOUTIEN') return 'EN SOUTIEN';
  return n || '—';
}
function renfortDiv(text) {
  if (!text) return '';
  let body = safeStr(text).trim();
  if (body.startsWith('En renfort :')) body = body.slice('En renfort :'.length).trim();
  else if (body.startsWith('En renfort:')) body = body.slice('En renfort:'.length).trim();
  return '<div class="cm-renfort"><strong>En renfort :</strong> ' + body + '</div>';
}

const PILIERS = ['P1', 'P2', 'P3', 'P4', 'P5'];

// ─────────────────────────────────────────────────────────────────────────────
// RANGEMENT EN BLOCS — SUR LE TOTAL (figé 23/06/2026)
// Le service Phase 4 ne pose QUE le bloc « occasionnels » (total 1-2). Les
// circuits de total >= 3 arrivent SANS bloc (champ bloc vide) : ils sont rangés
// par total décroissant et c'est l'AGENT du bilan qui leur attribuera ensuite
// « très souvent » / « souvent ». Tant que l'agent n'a pas tranché, on les
// regroupe sous l'intitulé neutre « en attente d'attribution de bloc ».
//   - bloc renseigné « occasionnels » → on l'affiche tel quel.
//   - bloc vide + total >= 3          → groupe « en attente d'attribution de bloc ».
// ─────────────────────────────────────────────────────────────────────────────
const BLOC_EN_ATTENTE = 'en attente d\'attribution de bloc';
const ORDRE_BLOCS = [BLOC_EN_ATTENTE, 'occasionnels'];
function blocRank(b) { const i = ORDRE_BLOCS.indexOf(safeStr(b).toLowerCase()); return i < 0 ? 99 : i; }
// Bloc d'affichage d'un circuit : ce que le service a écrit, sinon déduit du total.
function blocAffichage(r) {
  const b = safeStr(r.bloc).toLowerCase();
  if (b === 'occasionnels') return 'occasionnels';
  if (b) return b;                                   // bloc déjà attribué par l'agent (très souvent/souvent)
  return num(r.total_occurrences) >= 3 ? BLOC_EN_ATTENTE : 'occasionnels';
}

// ─────────────────────────────────────────────────────────────────────────────
// Construire le contexte d'un pilier (têtière + modes + synthèse 4 blocs)
// ─────────────────────────────────────────────────────────────────────────────
function buildPilierMeta(p) {
  if (!p) p = {};
  const role = safeStr(p.role_pilier).toLowerCase();
  return {
    pilier:                  safeStr(p.pilier).toUpperCase(),
    label:                   safeStr(p.pilier_label),
    role:                    role,
    role_class:              roleClassFromRole(role),
    tetiere_roleband:        safeStr(p.pilier_role_label) || roleLabelFromRole(role),
    tetiere_rappel:          safeStr(p.pilier_rappel),
    mode:                    safeStr(p.pilier_mode),
    mode_explication:        safeStr(p.mode_explication),
    intro_eclate:            safeStr(p.intro_eclate),
    // ── SYNTHÈSE DU PILIER — blocs déjà rédigés en base, affichés tels quels ──
    synth_factuelle_coeur:   safeStr(p.synth_factuelle),
    bloc_HAUT_technique:     safeStr(p.bloc_haut_technique),
    bloc_MOYEN_technique:    safeStr(p.bloc_moyen_technique),
    bloc_FAIBLE_technique:   safeStr(p.bloc_faible_technique),
    vue_ensemble:            safeStr(p.synth_interpretee),
    bloc_HAUT_agregat:        safeStr(p.bloc_haut_candidat),
    bloc_HAUT_rattachement:   safeStr(p.bloc_haut_catalogue),
    bloc_MOYEN_agregat:       safeStr(p.bloc_moyen_candidat),
    bloc_MOYEN_rattachement:  safeStr(p.bloc_moyen_catalogue),
    bloc_FAIBLE_agregat:      safeStr(p.bloc_faible_candidat),
    bloc_FAIBLE_rattachement: safeStr(p.bloc_faible_catalogue),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Cartes détail : index circuit → {nom, verbatims, expl, renfort, profondeur}
// Règle exemples : nb = activation_coeur, plafonné à 4.
// ─────────────────────────────────────────────────────────────────────────────
function buildCircuitDetail(c, nbCoeur) {
  const allVerbs = [
    { texte: safeStr(c.verbatim_1), ref: safeStr(c.verbatim_1_ref) },
    { texte: safeStr(c.verbatim_2), ref: safeStr(c.verbatim_2_ref) },
    { texte: safeStr(c.verbatim_3), ref: safeStr(c.verbatim_3_ref) },
    { texte: safeStr(c.verbatim_4), ref: safeStr(c.verbatim_4_ref) },
  ].filter(v => v.texte.trim() !== '');
  const cap = Math.max(1, Math.min(4, num(nbCoeur) || allVerbs.length));
  const verbs = allVerbs.slice(0, cap);
  const profondeur = safeStr(c.profondeur);
  return {
    nom:        safeStr(c.circuit_nom),
    expl:       safeStr(c.n3_nuance),
    courte:     safeStr(c.explication_courte_ch4),
    renfort:    c.en_renfort ? renfortDiv(safeStr(c.en_renfort)) : '',
    a_renfort:  !!safeStr(c.en_renfort).trim(),
    profondeur: profondeur,
    a_profondeur: profondeur.trim() !== '',
    verbs:      verbs,
    a_verbs:    verbs.length > 0,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPayload — point d'entrée
// ─────────────────────────────────────────────────────────────────────────────
async function buildPayload(candidat_id) {
  logger.info('bilanFablePayloadService.buildPayload v2.1', { candidat_id });

  const [bilan, visiteur, piliersRaw, circuitsRaw, pourbilanRaw, ventilationRaw] =
    await Promise.all([
      airtableService.getEtape1T3Bilan(candidat_id),
      airtableService.getVisiteurInfoForVisualisation(candidat_id),
      airtableService.getEtape1T3Piliers(candidat_id),
      airtableService.getEtape1T3Circuits(candidat_id),
      airtableService.getEtape1T2CircuitsPourbilan(candidat_id),  // table figée
      airtableService.getEtape1T2VentilationPiliers(candidat_id),
    ]);

  if (!bilan) {
    logger.warn('bilanFablePayloadService — T3_BILAN introuvable', { candidat_id });
    return null;
  }

  // ── Index piliers par code ────────────────────────────────────────────────
  const pilierByCode = {};
  for (const p of (piliersRaw || [])) {
    const code = safeStr(p.pilier).toUpperCase();
    if (code) pilierByCode[code] = p;
  }

  // ── Index détail circuits T3 par code ─────────────────────────────────────
  const detailByCode = {};
  for (const c of (circuitsRaw || [])) {
    const pilier = safeStr(c.pilier).toUpperCase();
    const cid = safeStr(c.circuit_id).toUpperCase();
    const code = cid.startsWith('ADHOC') ? cid
               : `${pilier}${cid.startsWith('C') ? cid : 'C' + cid}`;
    if (code) detailByCode[code] = c;
  }

  // ── Identification socle / amont / aval (rôles ACTUELS) ───────────────────
  const findByRole = (role) =>
    Object.values(pilierByCode).find(p => safeStr(p.role_pilier).toLowerCase() === role);
  const socle = findByRole('socle');
  const amont = findByRole('amont');
  const aval  = findByRole('aval');
  const socleCode  = safeStr(socle?.pilier).toUpperCase() || 'P3';
  const amontCode  = safeStr(amont?.pilier).toUpperCase();
  const avalCode   = safeStr(aval?.pilier).toUpperCase();
  const socleLabel = safeStr(socle?.pilier_label);
  const avalLabel  = safeStr(aval?.pilier_label);

  // ── Ventilation : nb_reponses pour attestations CH2 ───────────────────────
  const ventByCode = {};
  for (const v of (ventilationRaw || [])) {
    const code = safeStr(v.pilier_coeur).toUpperCase();
    if (code) ventByCode[code] = v;
  }
  const nbRep = (code) => num(ventByCode[code]?.nb_reponses);

  // ═══════════════════════════════════════════════════════════════════════════
  // TABLEAU — à partir de la table figée POURBILAN, dans l'ordre.
  // ═══════════════════════════════════════════════════════════════════════════
  const tableauRows = [];
  const cartesByPilier = {}; // code pilier -> { <bloc>: [cartes] } (blocs dynamiques)

  const circuitsPB = (pourbilanRaw || []).filter(
    r => safeStr(r.type_ligne).toUpperCase() === 'CIRCUIT'
  );

  const byPilier = {}; // P -> { role, circuits: [] }
  for (const r of circuitsPB) {
    const po = safeStr(r.pilier_owner).toUpperCase();
    if (!byPilier[po]) byPilier[po] = { role: safeStr(r.role_pilier).toLowerCase(), circuits: [] };
    byPilier[po].circuits.push(r);
  }

  const ROLE_ORDER = { socle: 0, amont: 1, aval: 2, fonctionnel: 3 };
  const piliersOrdonnes = Object.keys(byPilier).sort(
    (a, b) => (ROLE_ORDER[byPilier[a].role] ?? 9) - (ROLE_ORDER[byPilier[b].role] ?? 9)
  );

  const instruCells = (r, po, blank) => PILIERS.map(P => ({
    pilier: P, na: (P === po),
    val: blank ? (num(r['instru_' + P]) > 0 ? String(num(r['instru_' + P])) : '')
               : svcAff(r['instru_' + P]),
  }));

  const gen = { coeur: 0, total: 0, iP1: 0, iP2: 0, iP3: 0, iP4: 0, iP5: 0 };

  for (const po of piliersOrdonnes) {
    const { role, circuits } = byPilier[po];
    const roleClass = roleClassFromRole(role);

    tableauRows.push({
      kind: 'divider', pilier: po,
      pilier_nom: safeStr(pilierByCode[po]?.pilier_label),
      role, role_class: roleClass, role_label: role,
    });

    // Tri sur le TOTAL : bloc d'abord (en attente avant occasionnels), puis total
    // décroissant, puis cœur en simple départage à total égal.
    circuits.sort((a, b) =>
      blocRank(blocAffichage(a)) - blocRank(blocAffichage(b))
      || num(b.total_occurrences) - num(a.total_occurrences)
      || num(b.activation_coeur) - num(a.activation_coeur)
    );

    const pil = { coeur: 0, total: 0, iP1: 0, iP2: 0, iP3: 0, iP4: 0, iP5: 0 };
    let blocCourant = null;
    let st = null;
    const flushSousTotal = () => {
      if (!st) return;
      tableauRows.push({
        kind: 'sous_total', label: 'Sous-total — bloc « ' + st.bloc + ' »',
        coeur_aff: st.coeur > 0 ? String(st.coeur) : '', total_aff: String(st.total),
        instru: PILIERS.map(P => ({ pilier: P, na: false, val: st['iP' + P.slice(1)] > 0 ? String(st['iP' + P.slice(1)]) : '' })),
        role_class: roleClass,
      });
      st = null;
    };

    for (const r of circuits) {
      const bloc = blocAffichage(r);
      if (bloc !== blocCourant) { flushSousTotal(); blocCourant = bloc; st = { bloc, coeur: 0, total: 0, iP1: 0, iP2: 0, iP3: 0, iP4: 0, iP5: 0 }; }

      const coeurNum = num(r.activation_coeur);
      const totalNum = num(r.total_occurrences);
      const codeAff  = safeStr(r.circuit_code);
      const isAdhoc  = safeStr(r.circuit_origine).toUpperCase() === 'AD_HOC';
      const profondeur = safeStr(detailByCode[codeAff]?.profondeur);

      tableauRows.push({
        kind: 'circuit', adhoc: isAdhoc, code: codeAff,
        nom: safeStr(r.circuit_nom_clair) || safeStr(r.nom_ad_hoc),
        capacite: safeStr(r['capacité']),
        niveau_coeur: nivLabel(r.niveau_coeur), niv_coeur_class: nivCoeurClass(r.niveau_coeur),
        niveau_amplitude: nivLabel(r.niveau_amplitude), niv_ampl_class: nivCoeurClass(r.niveau_amplitude),
        profondeur, a_profondeur: profondeur.trim() !== '',
        coeur_aff: coeurNum > 0 ? String(coeurNum) : '·', coeur_num: coeurNum,
        instru: instruCells(r, po, false),
        total_aff: String(totalNum), bloc, role_class: roleClass, pilier_owner: po,
      });

      for (const acc of [st, pil, gen]) {
        acc.coeur += coeurNum; acc.total += totalNum;
        acc.iP1 += num(r.instru_P1); acc.iP2 += num(r.instru_P2); acc.iP3 += num(r.instru_P3);
        acc.iP4 += num(r.instru_P4); acc.iP5 += num(r.instru_P5);
      }

      // cartes détail — même regroupement que le tableau (en attente / occasionnels)
      const det = detailByCode[codeAff] ? buildCircuitDetail(detailByCode[codeAff], coeurNum) : null;
      if (det) {
        const blocCarte = blocAffichage(r); // 'en attente…' | 'occasionnels' | (agent: très souvent/souvent)
        if (!cartesByPilier[po]) cartesByPilier[po] = {};
        if (!cartesByPilier[po][blocCarte]) cartesByPilier[po][blocCarte] = [];
        cartesByPilier[po][blocCarte].push({
          code: codeAff, capacite: safeStr(r['capacité']),
          coeur_aff: coeurNum > 0 ? String(coeurNum) : '·', total_aff: String(totalNum),
          role_class: roleClass, ...det,
        });
      }
    }
    flushSousTotal();

    tableauRows.push({
      kind: 'total_pilier', label: 'TOTAL PILIER ' + po + ' — ' + safeStr(pilierByCode[po]?.pilier_label),
      coeur_aff: String(pil.coeur), total_aff: String(pil.total),
      instru: PILIERS.map(P => ({ pilier: P, na: false, val: pil['iP' + P.slice(1)] > 0 ? String(pil['iP' + P.slice(1)]) : '' })),
      role_class: roleClass,
    });
  }

  tableauRows.push({
    kind: 'total_general', label: 'TOTAL — toutes les fonctionnalités',
    coeur_aff: String(gen.coeur), total_aff: String(gen.total),
    instru: PILIERS.map(P => ({ pilier: P, na: false, val: gen['iP' + P.slice(1)] > 0 ? String(gen['iP' + P.slice(1)]) : '' })),
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTIONS PILIER (ordre doctrinal : socle, amont, aval, fonctionnels)
  // ═══════════════════════════════════════════════════════════════════════════
  const ORDRE = ['socle', 'amont', 'aval', 'fonctionnel'];
  const piliersMeta = {};
  for (const code of PILIERS) piliersMeta[code] = buildPilierMeta(pilierByCode[code]);

  const sections = [];
  const seen = new Set();
  for (const role of ORDRE) {
    for (const code of PILIERS) {
      const m = piliersMeta[code];
      if (m.role !== role || seen.has(code)) continue;
      seen.add(code);
      const cartes = cartesByPilier[code] || {};
      // Ordre d'affichage des blocs de cartes : ce que l'agent a pu écrire
      // (très souvent, souvent) d'abord, puis « en attente », puis « occasionnels ».
      const ORDRE_CARTES = ['très souvent', 'souvent', BLOC_EN_ATTENTE, 'occasionnels'];
      const nomsBlocs = Object.keys(cartes);
      nomsBlocs.sort((a, b) => {
        const ia = ORDRE_CARTES.indexOf(a); const ib = ORDRE_CARTES.indexOf(b);
        return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib);
      });
      const libelleBloc = (niv) => {
        if (niv === 'très souvent')  return 'Ce que vous faites très souvent';
        if (niv === 'souvent')       return 'Ce que vous faites souvent';
        if (niv === 'occasionnels')  return 'Ce que vous faites occasionnellement';
        if (niv === BLOC_EN_ATTENTE) return 'Vos gestes les plus activés (en attente d\'attribution de bloc)';
        return niv;
      };
      const blocsCartes = [];
      for (const niv of nomsBlocs) {
        if (!cartes[niv] || !cartes[niv].length) continue;
        blocsCartes.push({
          niveau: niv,
          libelle: libelleBloc(niv),
          role_class: m.role_class,
          circuits: cartes[niv],
        });
      }
      const rowsPilier = [];
      let capture = false;
      for (const tr of tableauRows) {
        if (tr.kind === 'divider') capture = (tr.pilier === code);
        if (capture) rowsPilier.push(tr);
        if (capture && tr.kind === 'total_pilier') { capture = false; }
      }
      sections.push({ ...m, blocsCartes, rows: rowsPilier });
    }
  }

  // ── CH2 / CH3 / CH4 (communs) — masqués si absents ────────────────────────
  const present = (s) => safeStr(s).trim() !== '';
  const ch2maillons = [
    { titre: `Tout part de ${socleLabel}`, texte: safeStr(bilan.maillon_m1_depart), attest: present(bilan.maillon_m1_depart) ? `Attesté : ${nbRep(socleCode)} réponses sur 25` : '' },
    { titre: `L'aller-retour ${socleCode}↔${amontCode}`, texte: safeStr(bilan.maillon_m2_dialogue), attest: present(bilan.maillon_m2_dialogue) ? `Attesté : ${nbRep(amontCode)} réponses` : '' },
    { titre: `Le débouché vers ${avalLabel}`, texte: safeStr(bilan.maillon_m3_debouche), attest: present(bilan.maillon_m3_debouche) ? `Attesté : ${nbRep(avalCode)} réponses sur 25` : '' },
    { titre: `Ce qui n'arrive jamais`, texte: safeStr(bilan.maillon_m4_jamais), attest: present(bilan.maillon_m4_jamais) ? `Attesté : 0 réponse` : '' },
  ].filter(m => present(m.texte));

  const registres = (safeJson(bilan.registres) || []).map(r => ({ titre: safeStr(r.titre), texte: safeStr(r.texte) }));
  const parseCout = (raw) => { const c = safeJson(raw) || {}; return { titre: safeStr(c.titre), texte: safeStr(c.texte) }; };
  const couts = [parseCout(bilan.cout_principal), parseCout(bilan.cout_secondaire)].filter(c => present(c.texte));
  const preuves = (safeJson(bilan.ch4_filtre_preuves) || []).map(p => ({ titre: safeStr(p.titre), texte: safeStr(p.texte) })).filter(p => present(p.texte));

  // ── Assemblage final ──────────────────────────────────────────────────────
  const civilite = safeStr(visiteur?.civilite || bilan.civilite);
  const prenom   = safeStr(visiteur?.prenom   || bilan.prenom);
  const nom      = safeStr(visiteur?.nom      || bilan.nom);

  const instruArr = (instru) => PILIERS.map(P => {
    const cell = (instru || []).find(c => c.pilier === P);
    const v = cell ? parseInt(cell.val, 10) : 0;
    return Number.isFinite(v) ? v : 0;
  });
  const tableauJsonObj = {};
  for (const s of sections) {
    const code = s.pilier || s.code;
    const rowsOut = [];
    for (const tr of (s.rows || [])) {
      if (tr.kind === 'circuit') {
        rowsOut.push({
          kind: 'circuit', adhoc: !!tr.adhoc, code: tr.code, nom: tr.nom,
          cap: tr.capacite, nivC: tr.niveau_coeur, nivA: tr.niveau_amplitude,
          coeur: tr.coeur_num || 0, i: instruArr(tr.instru), total: parseInt(tr.total_aff, 10) || 0,
        });
      } else if (tr.kind === 'sous_total') {
        rowsOut.push({ kind: 'soustotal', label: tr.label,
          coeur: parseInt(tr.coeur_aff, 10) || 0, total: parseInt(tr.total_aff, 10) || 0, i: instruArr(tr.instru) });
      } else if (tr.kind === 'total_pilier') {
        rowsOut.push({ kind: 'totalpil', label: tr.label,
          coeur: parseInt(tr.coeur_aff, 10) || 0, total: parseInt(tr.total_aff, 10) || 0, i: instruArr(tr.instru) });
      }
    }
    if (code) tableauJsonObj[code] = rowsOut;
  }

  const ctx = {
    candidat: {
      titre_affichage: `${civilite} ${prenom}`.trim(),
      nom_complet: `${prenom} ${nom}`.trim(),
    },
    bilan: {
      socle_libelle: safeStr(bilan.socle_libelle),
      signature_courte: safeStr(bilan.sig_resultat_ligne1),
    },
    tableau: { rows: tableauRows },
    sections: sections,
    tableau_json: JSON.stringify(tableauJsonObj),
    ch2: { present: ch2maillons.length > 0, maillons: ch2maillons },
    ch3: {
      signaux_present: registres.length > 0,
      s05_intro: safeStr(bilan.s05_intro), s05_cloture: safeStr(bilan.s05_cloture),
      registres,
      couts_present: couts.length > 0,
      s06_intro: safeStr(bilan.s06_intro), s06_cloture: safeStr(bilan.s06_cloture),
      couts,
    },
    ch4: { present: preuves.length > 0, revelation: safeStr(bilan.ch4_filtre_revelation), preuves },
  };

  logger.info('bilanFablePayloadService v2.1 — contexte construit', {
    candidat_id,
    nb_lignes_tableau: tableauRows.length,
    nb_sections: sections.length,
    socle: socleCode,
  });
  return ctx;
}

module.exports = { buildPayload };
