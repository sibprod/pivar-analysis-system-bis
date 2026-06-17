// services/visualisation/bilanFablePayloadService.js
// Payload service — Bilan Fable cognitif complet (chaîne P-A→P-D)
// v1.0 — 17/06/2026
//
// Construit l'objet contexte pour bilanFableVisualiseurService.html
// (1 138 placeholders Handlebars rendu côté serveur via _renderT3Template).
//
// Lectures Airtable effectuées :
//   - ETAPE1_T3_BILAN         → données globales bilan (filtre, CH2, CH3, CH4, signature)
//   - VISITEUR                → prenom / nom / civilité
//   - ETAPE1_T3_PILIER × 5   → têtières, modes, synthèses, blocs
//   - ETAPE1_T3_CIRCUIT × n  → circuits (verbatims, niveaux, renforts, explications)
//   - ETAPE1_T2_INVENTAIRE_CIRCUITS → chiffres coeur/svc/total (SOURCE AUTORITAIRE)
//   - ETAPE1_T2_VENTILATION_PILIERS → nb_reponses par pilier (attestations CH2)

'use strict';

const airtableService = require('../infrastructure/airtableService');
const logger = require('../../utils/logger');

// ─────────────────────────────────────────────────────────────────────────────
// Helpers de formatage
// ─────────────────────────────────────────────────────────────────────────────

function coeurAff(n) {
  return String(n != null ? n : 0);
}

function svcAff(n) {
  const v = n != null ? Number(n) : 0;
  return v > 0 ? String(v) : '·';
}

function totalAff(n) {
  return String(n != null ? n : 0);
}

function renfortDiv(text) {
  if (!text) return '';
  let body = String(text).trim();
  if (body.startsWith('En renfort :')) body = body.slice('En renfort :'.length).trim();
  else if (body.startsWith('En renfort:')) body = body.slice('En renfort:'.length).trim();
  return (
    '<div style="font-size:11.5px;color:#374151;line-height:1.55;margin-top:7px;' +
    'padding-top:7px;border-top:1px dashed var(--rl);">' +
    '<strong>En renfort :</strong> ' + body + '</div>'
  );
}

function carteRoleFromRole(rolePilier) {
  if (!rolePilier) return 'disponible';
  const r = String(rolePilier).toLowerCase();
  if (r === 'socle') return '★ socle — décide';
  if (r === 'structurant_1' || r === 'structurant_2') return 'renfort instrumental';
  return 'disponible';
}

function phStarFromRole(rolePilier) {
  if (!rolePilier) return 'Fonctionnel';
  const r = String(rolePilier).toLowerCase();
  if (r === 'socle') return '★ Socle';
  if (r === 'structurant_1') return 'Amont';
  if (r === 'structurant_2') return '';   // P5 aval n'a pas de star
  return 'Fonctionnel';
}

function roleClassFromRole(rolePilier) {
  if (!rolePilier) return 'role-fonctionnel';
  const r = String(rolePilier).toLowerCase();
  if (r === 'socle') return 'role-socle';
  if (r === 'structurant_1') return 'role-amont';
  if (r === 'structurant_2') return 'role-str2';
  return 'role-fonctionnel';
}

function circuitCode(pilier, circuitId) {
  if (!circuitId) return null;
  const cid = String(circuitId).toUpperCase();
  if (cid.startsWith('ADHOC')) return cid;
  const clean = cid.startsWith('C') ? cid : 'C' + cid;
  return `${String(pilier).toUpperCase()}${clean}`;
}

function safeJson(raw) {
  if (!raw) return null;
  if (typeof raw !== 'string') return raw;
  try { return JSON.parse(raw); } catch { return null; }
}

function safeStr(v) {
  if (v === null || v === undefined) return '';
  return String(v);
}

// ─────────────────────────────────────────────────────────────────────────────
// Construire le contexte d'un pilier
// ─────────────────────────────────────────────────────────────────────────────

function buildPilierCtx(p) {
  if (!p) p = {};
  return {
    mode:                    safeStr(p.pilier_mode),
    mode_explication:        safeStr(p.mode_explication),
    tetiere_rappel:          safeStr(p.pilier_rappel),
    tetiere_roleband:        safeStr(p.pilier_role_label),
    carte_role:              carteRoleFromRole(p.role_pilier),
    ph_star:                 phStarFromRole(p.role_pilier),
    role_class:              roleClassFromRole(p.role_pilier),
    synth_factuelle_coeur:   safeStr(p.synth_factuelle),
    synth_factuelle_elargie: safeStr(p.synth_interpretee),
    bloc_HAUT_agregat:       safeStr(p.bloc_haut_candidat),
    bloc_HAUT_rattachement:  safeStr(p.bloc_haut_catalogue),
    bloc_MOYEN_agregat:      safeStr(p.bloc_moyen_candidat),
    bloc_MOYEN_rattachement: safeStr(p.bloc_moyen_catalogue),
    bloc_FAIBLE_agregat:     safeStr(p.bloc_faible_candidat),
    bloc_FAIBLE_rattachement: safeStr(p.bloc_faible_catalogue),
    ou_revient:              safeStr(p.synth_interpretee),
    intro_eclate:            safeStr(p.intro_eclate),
    synth_courte:            safeStr(p.synth_courte),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// buildPayload — point d'entrée
// ─────────────────────────────────────────────────────────────────────────────

async function buildPayload(candidat_id) {
  logger.info('bilanFablePayloadService.buildPayload', { candidat_id });

  // ── 1. Lectures Airtable en parallèle ────────────────────────────────────
  const [bilan, visiteur, piliersRaw, circuitsRaw, inventaireRaw, ventilationRaw] =
    await Promise.all([
      airtableService.getEtape1T3Bilan(candidat_id),
      airtableService.getVisiteurInfoForVisualisation(candidat_id),
      airtableService.getEtape1T3Piliers(candidat_id),
      airtableService.getEtape1T3Circuits(candidat_id),
      airtableService.getEtape1T2InventaireCircuits(candidat_id),
      airtableService.getEtape1T2VentilationPiliers(candidat_id),
    ]);

  if (!bilan) {
    logger.warn('bilanFablePayloadService — T3_BILAN introuvable', { candidat_id });
    return null;
  }

  // ── 2. Index piliers par code P1..P5 ─────────────────────────────────────
  const pilierByCode = {};
  for (const p of (piliersRaw || [])) {
    const code = safeStr(p.pilier).toUpperCase();
    if (code) pilierByCode[code] = p;
  }

  // ── 3. Index inventaire circuits par code ─────────────────────────────────
  const invByCode = {};
  for (const inv of (inventaireRaw || [])) {
    const code = circuitCode(inv.pilier_owner, inv.circuit_id);
    if (code) invByCode[code] = inv;
  }

  // ── 4. Index ventilation piliers par code ─────────────────────────────────
  const ventByCode = {};
  for (const v of (ventilationRaw || [])) {
    const code = safeStr(v.pilier_coeur).toUpperCase();
    if (code) ventByCode[code] = v;
  }

  // ── 5. Candidat ───────────────────────────────────────────────────────────
  const prenom   = safeStr(visiteur.prenom   || bilan.prenom);
  const nom      = safeStr(visiteur.nom      || bilan.nom);
  const civilite = safeStr(visiteur.civilite || bilan.civilite);

  // ── 6. Identification du socle + structurants ─────────────────────────────
  const socleEntry    = Object.entries(pilierByCode).find(([, p]) => p.role_pilier === 'socle');
  const amontEntry    = Object.entries(pilierByCode).find(([, p]) => p.role_pilier === 'structurant_1');
  const avalEntry     = Object.entries(pilierByCode).find(([, p]) => p.role_pilier === 'structurant_2');

  const socleCode  = socleEntry?.[0]  || 'P3';
  const amontCode  = amontEntry?.[0]  || 'P1';
  const avalCode   = avalEntry?.[0]   || 'P5';

  const socleLabel = safeStr(pilierByCode[socleCode]?.pilier_label);
  const avalLabel  = safeStr(pilierByCode[avalCode]?.pilier_label);

  // ── 7. Ventilation : nb_reponses pour attestations CH2 ───────────────────
  const nbRepSocle = Number(ventByCode[socleCode]?.nb_reponses  || 0);
  const nbRepAmont = Number(ventByCode[amontCode]?.nb_reponses  || 0);
  const nbRepAval  = Number(ventByCode[avalCode]?.nb_reponses   || 0);

  // ── 8. Circuits ───────────────────────────────────────────────────────────
  const circuitsCtx = {};
  for (const c of (circuitsRaw || [])) {
    const pilier = safeStr(c.pilier).toUpperCase();
    const cid    = safeStr(c.circuit_id);
    const code   = circuitCode(pilier, cid);
    if (!code) continue;

    const inv     = invByCode[code] || {};
    const isAdhoc = code.startsWith('ADHOC');

    const nbCoeur = Number(inv.nb_coeur         ?? c.circuit_freq ?? 0);
    const svcP1   = Number(inv.nb_svc_P1        ?? c.en_svc_P1   ?? 0);
    const svcP2   = Number(inv.nb_svc_P2        ?? c.en_svc_P2   ?? 0);
    const svcP3   = Number(inv.nb_svc_P3        ?? c.en_svc_P3   ?? 0);
    const svcP4   = Number(inv.nb_svc_P4        ?? c.en_svc_P4   ?? 0);
    const svcP5   = Number(inv.nb_svc_P5        ?? c.en_svc_P5   ?? 0);
    const total   = Number(inv.total_activations ?? c.total_activations
                    ?? (nbCoeur + svcP1 + svcP2 + svcP3 + svcP4 + svcP5));

    let niveau = safeStr(c.circuit_niveau);
    if (niveau === 'EN SOUTIEN') niveau = 'FAIBLE';

    const renfortHtml = c.en_renfort ? renfortDiv(safeStr(c.en_renfort)) : '';

    circuitsCtx[code] = {
      nom:           safeStr(c.circuit_nom),
      coeur_aff:     isAdhoc ? '—' : coeurAff(nbCoeur),
      total_aff:     totalAff(total),
      svc_p1_aff:    svcAff(svcP1),
      svc_p2_aff:    svcAff(svcP2),
      svc_p3_aff:    svcAff(svcP3),
      svc_p4_aff:    svcAff(svcP4),
      svc_p5_aff:    svcAff(svcP5),
      niveau,
      verb1_texte:    safeStr(c.verbatim_1),
      verb1_lieu_aff: safeStr(c.verbatim_1_ref),
      verb2_texte:    safeStr(c.verbatim_2),
      verb2_lieu_aff: safeStr(c.verbatim_2_ref),
      verb3_texte:    safeStr(c.verbatim_3),
      verb3_lieu_aff: safeStr(c.verbatim_3_ref),
      verb4_texte:    safeStr(c.verbatim_4),
      verb4_lieu_aff: safeStr(c.verbatim_4_ref),
      expl:    safeStr(c.n3_nuance),
      renfort: renfortHtml,
      courte:  safeStr(c.explication_courte_ch4),
    };
  }

  // ── 9. Preuves CH4 (champ JSON dans T3_BILAN) ────────────────────────────
  const preuves      = safeJson(bilan.ch4_filtre_preuves) || [];
  // Labels doctrinaux fixes (invariants candidat)
  const preuveLabels = [
    'Preuve 1 · Le volume',
    'Preuve 2 · Le poids des gestes',
    'Preuve 3 · La nature de la grille',
    'Preuve 4 · Les débordements',
    'Preuve 5 · La force de rappel',
  ];

  // ── 10. Registres signaux limbiques (champ JSON registres) ───────────────
  const registres = safeJson(bilan.registres) || [];
  const makeReg = (i) => ({
    titre:    safeStr(registres[i]?.titre),
    texte:    safeStr(registres[i]?.texte),
    verbatims: safeStr(registres[i]?.verbatims),
  });

  // ── 11. Coûts (champs JSON cout_principal / cout_secondaire) ─────────────
  const parseCout = (raw) => {
    const c = safeJson(raw) || {};
    return {
      label:    safeStr(c.label),
      titre:    safeStr(c.titre),
      texte:    safeStr(c.texte),
      verbatims: safeStr(c.verbatims),
    };
  };
  const cout1 = parseCout(bilan.cout_principal);
  const cout2 = parseCout(bilan.cout_secondaire);

  // ── 12. Ref noms officiels des piliers ───────────────────────────────────
  const refNom     = (code) => safeStr(pilierByCode[code]?.pilier_label) || code;
  const refNomLong = (code) => refNom(code);

  // ── 13. Assemblage du contexte final ─────────────────────────────────────
  const ctx = {

    // ─── Candidat ──────────────────────────────────────────────────────────
    candidat: {
      civilite:        civilite,
      prenom:          prenom,
      nom:             nom,
      titre_affichage: `${civilite} ${prenom}`.trim(),
      nom_complet:     `${prenom} ${nom}`.trim(),
    },

    // ─── Références officielles (noms piliers) ─────────────────────────────
    ref: {
      p1: { nom: refNom('P1'),   nom_long: refNomLong('P1') },
      p2: { nom: refNom('P2'),   nom_long: refNomLong('P2') },
      p3: { nom: refNom('P3'),   nom_long: refNomLong('P3') },
      p4: { nom: refNom('P4'),   nom_long: refNomLong('P4') },
      p5: { nom: 'Mise en œuvre', nom_long: refNomLong('P5') },
    },

    // ─── Bilan global ──────────────────────────────────────────────────────
    bilan: {
      socle_libelle:         safeStr(bilan.socle_libelle),
      filtre:                safeStr(bilan.filtre),
      filtre_declinaison:    safeStr(bilan.filtre_declinaison),
      filtre_court:          safeStr(bilan.sig_filtre_val),
      finalite:              safeStr(bilan.sig_finalite),
      signature_courte:      safeStr(bilan.sig_resultat_ligne1),
      schema_intro_roles:    safeStr(bilan.schema_intro_roles),
      schema_legende_socle:  safeStr(bilan.schema_legende_socle),
      ch4_filtre_revelation: safeStr(bilan.ch4_filtre_revelation),
      // Preuves CH4
      ch4_preuve1_titre: safeStr(preuves[0]?.titre || preuveLabels[0]),
      ch4_preuve1_texte: safeStr(preuves[0]?.texte),
      ch4_preuve2_titre: safeStr(preuves[1]?.titre || preuveLabels[1]),
      ch4_preuve2_texte: safeStr(preuves[1]?.texte),
      ch4_preuve3_titre: safeStr(preuves[2]?.titre || preuveLabels[2]),
      ch4_preuve3_texte: safeStr(preuves[2]?.texte),
      ch4_preuve4_titre: safeStr(preuves[3]?.titre || preuveLabels[3]),
      ch4_preuve4_texte: safeStr(preuves[3]?.texte),
      ch4_preuve5_titre: safeStr(preuves[4]?.titre || preuveLabels[4]),
      ch4_preuve5_texte: safeStr(preuves[4]?.texte),
    },

    // ─── Piliers (P1..P5) ──────────────────────────────────────────────────
    p1: buildPilierCtx(pilierByCode['P1']),
    p2: buildPilierCtx(pilierByCode['P2']),
    p3: buildPilierCtx(pilierByCode['P3']),
    p4: buildPilierCtx(pilierByCode['P4']),
    p5: buildPilierCtx(pilierByCode['P5']),

    // ─── Circuits ──────────────────────────────────────────────────────────
    circuits: circuitsCtx,

    // ─── CH2 — Boucle cognitive ────────────────────────────────────────────
    ch2: {
      m1: {
        titre:    `Tout part de ${socleLabel}`,
        attest:   `Attesté : ${nbRepSocle} réponses sur 25`,
        texte:    safeStr(bilan.maillon_m1_depart),
        badge:    `${socleCode} = point de départ`,
        verbatims: '',
      },
      m2: {
        titre:    `L'aller-retour ${socleCode}↔${amontCode}`,
        attest:   `Attesté : ${socleCode}→${amontCode} : ${nbRepAmont} réponses · ${amontCode}→${socleCode} : ${nbRepAmont} réponses`,
        texte:    safeStr(bilan.maillon_m2_dialogue),
        badge:    `${socleCode}↔${amontCode}`,
        verbatims: '',
      },
      m3: {
        titre:    `Le débouché vers la ${avalLabel}`,
        attest:   `Attesté : ${nbRepAval} réponses sur 25`,
        texte:    safeStr(bilan.maillon_m3_debouche),
        badge:    `${socleCode}→${avalCode}`,
        verbatims: '',
      },
      m4: {
        titre:    `Ce qui n'arrive jamais : la ${avalLabel} ne rouvre pas le dossier`,
        attest:   `Attesté : 0 réponse gouvernée par la ${avalLabel}`,
        texte:    safeStr(bilan.maillon_m4_jamais),
        badge:    `${avalCode} → ${socleCode} : 0`,
        verbatims: '',
      },
    },

    // ─── CH3 — Signaux limbiques + Coûts ──────────────────────────────────
    ch3: {
      // Intro / clôture signaux
      s05_intro:   safeStr(bilan.s05_intro),
      s05_cloture: safeStr(bilan.s05_cloture),
      // Registres signaux (objet imbriqué — résolu par le moteur via dot-notation)
      reg1: makeReg(0),
      reg2: makeReg(1),
      reg3: makeReg(2),
      // Intro / clôture coûts
      s06_intro:   safeStr(bilan.s06_intro),
      s06_cloture: safeStr(bilan.s06_cloture),
      // Coûts
      cout1,
      cout2,
      // Labels preuves CH4 (réutilisés dans la section CH3 du template)
      preuve1_label: preuveLabels[0],
      preuve2_label: preuveLabels[1],
      preuve3_label: preuveLabels[2],
      preuve4_label: preuveLabels[3],
      preuve5_label: preuveLabels[4],
    },

  };

  logger.info('bilanFablePayloadService — contexte construit', {
    candidat_id,
    nb_circuits: Object.keys(circuitsCtx).length,
    nb_piliers:  piliersRaw.length,
    socle:       socleCode,
  });

  return ctx;
}

module.exports = { buildPayload };
