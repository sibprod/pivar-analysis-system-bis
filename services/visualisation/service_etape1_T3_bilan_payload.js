// services/visualisation/bilanFablePayloadService.js
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
    // Bloc 1 — Profil pur (cœur de l'outil) — langage technique chiffré
    synth_factuelle_coeur:   safeStr(p.synth_factuelle),
    // Bloc 2 — Profil élargi (débordements & emprunts) — langage technique,
    // porté par les 3 champs de détail par niveau (services, capacités, profondeurs, débordements).
    bloc_HAUT_technique:     safeStr(p.bloc_haut_technique),
    bloc_MOYEN_technique:    safeStr(p.bloc_moyen_technique),
    bloc_FAIBLE_technique:   safeStr(p.bloc_faible_technique),
    // Profil — ce que vos gestes disent de vous (vue d'ensemble) — langage candidat,
    // champ pré-assemblé contenant les 3 sous-blocs HAUT/MOYEN/FAIBLE + le mode + "où cet outil revient".
    vue_ensemble:            safeStr(p.synth_interpretee),
    // Blocs "ce que ces gestes disent de vous" sous chaque groupe de cartes (mêmes textes candidat) :
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
  // Verbatims présents (jusqu'à 4)
  const allVerbs = [
    { texte: safeStr(c.verbatim_1), ref: safeStr(c.verbatim_1_ref) },
    { texte: safeStr(c.verbatim_2), ref: safeStr(c.verbatim_2_ref) },
    { texte: safeStr(c.verbatim_3), ref: safeStr(c.verbatim_3_ref) },
    { texte: safeStr(c.verbatim_4), ref: safeStr(c.verbatim_4_ref) },
  ].filter(v => v.texte.trim() !== '');
  // Plafond : min(nbCoeur ou 1, 4, nb dispo). Au moins 1 si un verbatim existe.
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
  logger.info('bilanFablePayloadService.buildPayload v2.0', { candidat_id });

  const [bilan, visiteur, piliersRaw, circuitsRaw, pourbilanRaw, ventilationRaw] =
    await Promise.all([
      airtableService.getEtape1T3Bilan(candidat_id),
      airtableService.getVisiteurInfoForVisualisation(candidat_id),
      airtableService.getEtape1T3Piliers(candidat_id),
      airtableService.getEtape1T3Circuits(candidat_id),
      airtableService.getEtape1T2CircuitsPourbilan(candidat_id),  // ⭐ table figée
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
  // On produit :
  //   - tableau.rows : lignes prêtes pour la boucle (CIRCUIT + totaux + dividers)
  //   - pilierGroupes : par pilier, les circuits groupés par bloc cœur (cartes détail)
  // ═══════════════════════════════════════════════════════════════════════════
  const tableauRows = [];
  let lastPilier = null;

  // accumulation par pilier pour les cartes détail
  const cartesByPilier = {}; // code pilier -> { HAUT:[], MOYEN:[], FAIBLE:[] }

  for (const r of (pourbilanRaw || [])) {
    const type = safeStr(r.type_ligne).toUpperCase();
    const po   = safeStr(r.pilier_owner).toUpperCase();
    const role = safeStr(r.role_pilier).toLowerCase();
    const roleClass = roleClassFromRole(role);

    // Divider de pilier au 1er CIRCUIT d'un nouveau pilier
    if (type === 'CIRCUIT' && po !== lastPilier) {
      tableauRows.push({
        kind: 'divider',
        pilier: po,
        pilier_nom: safeStr(r.circuit_nom_clair) || safeStr(pilierByCode[po]?.pilier_label),
        role: role,
        role_class: roleClass,
        role_label: role,
      });
      lastPilier = po;
    }

    // Cellules instrumentales (NA sur la colonne du pilier owner)
    const instru = PILIERS.map(P => ({
      pilier: P,
      na: (P === po),
      val: svcAff(r['instru_' + P]),
    }));

    const coeurNum = num(r.activation_coeur);
    const totalNum = num(r.total_occurrences);
    const isAdhoc = safeStr(r.circuit_origine).toUpperCase() === 'AD_HOC';
    const codeAff = safeStr(r.circuit_code);

    if (type === 'CIRCUIT') {
      const row = {
        kind: 'circuit',
        adhoc: isAdhoc,
        code: codeAff,
        nom: safeStr(r.circuit_nom_clair) || safeStr(r.nom_ad_hoc),
        capacite: safeStr(r['capacité']),
        niveau_coeur: nivLabel(r.niveau_coeur),
        niv_coeur_class: nivCoeurClass(r.niveau_coeur),
        niveau_amplitude: nivLabel(r.niveau_amplitude),
        niv_ampl_class: nivCoeurClass(r.niveau_amplitude),
        profondeur: safeStr(detailByCode[codeAff]?.profondeur), // profondeur via T3_CIRCUIT
        coeur_aff: coeurNum > 0 ? String(coeurNum) : '·',
        coeur_num: coeurNum,
        instru,
        total_aff: String(totalNum),
        bloc: safeStr(r.bloc),
        role_class: roleClass,
        pilier_owner: po,
      };
      row.a_profondeur = row.profondeur.trim() !== '';
      tableauRows.push(row);

      // Cartes détail — groupées par bloc cœur (HAUT>=4 / MOYEN 2-3 / FAIBLE 1 ; cœur 0 ignoré pour cartes)
      const det = detailByCode[codeAff] ? buildCircuitDetail(detailByCode[codeAff], coeurNum) : null;
      if (det) {
        let bloc = null;
        if (coeurNum >= 4) bloc = 'HAUT';
        else if (coeurNum >= 2) bloc = 'MOYEN';
        else if (coeurNum === 1) bloc = 'FAIBLE';
        if (bloc) {
          if (!cartesByPilier[po]) cartesByPilier[po] = { HAUT: [], MOYEN: [], FAIBLE: [] };
          cartesByPilier[po][bloc].push({
            code: codeAff, capacite: row.capacite,
            coeur_aff: row.coeur_aff, total_aff: row.total_aff,
            role_class: roleClass, ...det,
          });
        }
      }
    } else if (type === 'SOUS_TOTAL') {
      tableauRows.push({
        kind: 'sous_total', label: 'Sous-total — bloc « ' + safeStr(r.bloc) + ' »',
        coeur_aff: coeurNum > 0 ? String(coeurNum) : '', total_aff: String(totalNum),
        instru: PILIERS.map(P => ({ pilier: P, na: false, val: num(r['instru_' + P]) > 0 ? String(num(r['instru_' + P])) : '' })),
        role_class: roleClassFromRole(role),
      });
    } else if (type === 'TOTAL_PILIER') {
      tableauRows.push({
        kind: 'total_pilier', label: 'TOTAL PILIER ' + po + ' — ' + safeStr(pilierByCode[po]?.pilier_label),
        coeur_aff: coeurNum > 0 ? String(coeurNum) : '', total_aff: String(totalNum),
        instru: PILIERS.map(P => ({ pilier: P, na: false, val: num(r['instru_' + P]) > 0 ? String(num(r['instru_' + P])) : '' })),
        role_class: roleClassFromRole(role),
      });
    } else if (type === 'TOTAL_GENERAL') {
      tableauRows.push({
        kind: 'total_general', label: safeStr(r.circuit_nom_clair) || 'TOTAL — toutes les fonctionnalités',
        coeur_aff: coeurNum > 0 ? String(coeurNum) : '', total_aff: String(totalNum),
        instru: PILIERS.map(P => ({ pilier: P, na: false, val: num(r['instru_' + P]) > 0 ? String(num(r['instru_' + P])) : '' })),
      });
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTIONS PILIER (ordre doctrinal : socle, amont, aval, fonctionnels)
  // Chacune : meta (têtière/mode/synthèse) + son sous-tableau + ses cartes par bloc.
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
      const cartes = cartesByPilier[code] || { HAUT: [], MOYEN: [], FAIBLE: [] };
      // blocs de cartes non vides, avec agrégat + rattachement du bon niveau
      const blocsCartes = [];
      for (const niv of ['HAUT', 'MOYEN', 'FAIBLE']) {
        if (!cartes[niv].length) continue;
        blocsCartes.push({
          niveau: niv,
          libelle: niv === 'HAUT' ? 'Ce que vous faites très souvent (activé 4 fois ou plus)'
                 : niv === 'MOYEN' ? 'Ce que vous faites régulièrement (activé 2 à 3 fois)'
                 : 'Ce que vous faites de temps en temps (activé 1 fois)',
          role_class: m.role_class,
          circuits: cartes[niv],
          agregat: m['bloc_' + niv + '_agregat'],
          a_agregat: !!m['bloc_' + niv + '_agregat'],
          rattachement: m['bloc_' + niv + '_rattachement'],
          a_rattachement: !!m['bloc_' + niv + '_rattachement'],
        });
      }
      // sous-tableau du pilier = lignes POURBILAN de ce pilier (divider→total_pilier)
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

  const ctx = {
    candidat: {
      titre_affichage: `${civilite} ${prenom}`.trim(),
      nom_complet: `${prenom} ${nom}`.trim(),
    },
    bilan: {
      socle_libelle: safeStr(bilan.socle_libelle),
      signature_courte: safeStr(bilan.sig_resultat_ligne1),
    },
    // Tableau global (toutes lignes) — disponible si besoin d'une vue complète
    tableau: { rows: tableauRows },
    // Sections pilier (ordre doctrinal) — chacune avec son sous-tableau + cartes
    sections: sections,
    // Communs (masqués si vides)
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

  logger.info('bilanFablePayloadService v2.0 — contexte construit', {
    candidat_id,
    nb_lignes_tableau: tableauRows.length,
    nb_sections: sections.length,
    socle: socleCode,
  });
  return ctx;
}

module.exports = { buildPayload };
