// services/visualisation/bilanFablePayloadService.js
// Payload service — Bilan Fable cognitif complet (chaîne P-A→P-D)
// v2.2 — 30/06/2026
//
// ⭐ v2.2 (30/06/2026) — MAILLON + MIGRATION NOMS :
//   (1) blocAffichage lit bloc_final (bloc réel attribué par l'agent bilan-pilier),
//       repli sur bloc puis sur le total. Le tableau ET les cartes se rangent donc
//       par très souvent / souvent / occasionnels (fini « en attente » pour total>=3).
//   (2) buildPilierMeta lit les noms migrés de la config (bloc_tres_souvent/souvent/
//       occasionnels_*) au lieu des ex-noms HAUT/MOYEN/FAIBLE — qui renvoyaient undefined.
//       Alias rétrocompatibles conservés pour le template de prod actuel.
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
// ⭐ 30/06 — met en forme la vue d'ensemble (synth_interpretee) : les lignes commençant
//   par « ▸ » deviennent des sous-titres en gras ; le reste, des paragraphes.
function formatVueEnsemble(raw) {
  const txt = safeStr(raw).trim();
  if (!txt) return '';
  const lines = txt.split(/\r?\n/);
  let out = '';
  for (let line of lines) {
    const l = line.trim();
    if (!l) continue;
    // on saute le titre générique répété en tête du champ
    if (/^Profil\s*[—-]\s*ce que vos gestes disent/i.test(l)) continue;
    if (l.startsWith('▸')) {
      out += '<div class="sp-sub">' + escapeHtmlLite(l.replace(/^▸\s*/, '')) + '</div>';
    } else {
      out += '<div class="sp-para">' + escapeHtmlLite(l) + '</div>';
    }
  }
  return out;
}
function escapeHtmlLite(s) {
  return safeStr(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}

// ⭐ 01/07 — REGISTRES limbiques : le service PD écrit un TEXTE avec titres « ### titre »,
//   chaque bloc = "### titre\n texte + verbatims", blocs séparés par \n\n. On rend en HTML :
//   ### → sous-titre (.reg-titre), lignes verbatims « ... » → .reg-verb, reste → .reg-texte.
function formatRegistres(raw) {
  const txt = safeStr(raw).trim();
  if (!txt || txt === '(aucun registre atteste)') return '';
  const blocs = txt.split(/\n{2,}/);
  let out = '';
  for (const bloc of blocs) {
    const lines = bloc.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    if (!lines.length) continue;
    out += '<div class="reg-bloc">';
    for (let line of lines) {
      if (line.startsWith('###')) {
        out += '<div class="reg-titre">' + escapeHtmlLite(line.replace(/^#+\s*/, '')) + '</div>';
      } else if (line.startsWith('\u26a0\u26a0')) {
        // vigilance GLOBALE (⚠⚠) : traitée hors bloc (voir plus bas), ignorer ici
        out += '';
      } else if (line.startsWith('\u26a0')) {
        // ⭐ point de vigilance par registre : encadré ambre, n'apparaît que si présent
        out += '<div class="reg-vigilance"><span class="reg-vig-lbl">Point de vigilance</span>' +
               escapeHtmlLite(line.replace(/^\u26a0\s*/, '')) + '</div>';
      } else if (line.startsWith('\u00bb')) {
        // ⭐ « ce que cela signifie pour vous » : strate d'explication distincte
        out += '<div class="reg-signif"><span class="reg-signif-lbl">Ce que cela signifie pour vous</span>' +
               escapeHtmlLite(line.replace(/^\u00bb\s*/, '')) + '</div>';
      } else if (/^«|·\s*«|»$/.test(line) || line.includes('« ')) {
        out += '<div class="reg-verb">' + escapeHtmlLite(line) + '</div>';
      } else {
        out += '<div class="reg-constat">' + escapeHtmlLite(line) + '</div>';
      }
    }
    out += '</div>';
  }
  return out;
}
// Extrait la vigilance globale (⚠⚠) du champ registres brut, pour affichage séparé en fin de §05.
function extractVigilanceGlobale(raw) {
  const m = safeStr(raw).match(/\u26a0\u26a0\s*([^\n]+)/);
  return m ? m[1].trim() : '';
}

// ⭐ 01/07 — BLOC COÛT : le service PD écrit "titre\n texte + verbatims". 1re ligne = titre,
//   lignes « ... » = verbatims, reste = texte courant.
function formatBlocCout(raw) {
  const txt = safeStr(raw).trim();
  if (!txt) return { a: false, html: '' };
  const lines = txt.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (!lines.length) return { a: false, html: '' };
  const titre = lines.shift();
  let corps = '';
  for (let line of lines) {
    if (line.startsWith('\u00bb')) {
      // » = « Comment vous gérez » (la stratégie)
      corps += '<div class="cout-strat"><span class="cout-strat-lbl">Comment vous gérez</span>' +
               escapeHtmlLite(line.replace(/^\u00bb\s*/, '')) + '</div>';
    } else if (line.startsWith('\u26a0')) {
      // ⚠ = point de vigilance sur ce coût
      corps += '<div class="reg-vigilance"><span class="reg-vig-lbl">Point de vigilance</span>' +
               escapeHtmlLite(line.replace(/^\u26a0\s*/, '')) + '</div>';
    } else if (line.startsWith('\u00ab') || line.includes('« ')) {
      corps += '<div class="cout-verb">' + escapeHtmlLite(line) + '</div>';
    } else {
      corps += '<div class="cout-texte">' + escapeHtmlLite(line) + '</div>';
    }
  }
  return { a: true, titre: titre, corps: corps, html: '<div class="cout-titre">' + escapeHtmlLite(titre) + '</div>' + corps };
}
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
// ⭐ 30/06/2026 — MAILLON : l'ordre suit le bloc RÉEL attribué par l'agent bilan-pilier
//   (bloc_final, écrit dans POURBILAN). Ordre doctrinal : très souvent → souvent → occasionnels.
const ORDRE_BLOCS = ['très souvent', 'souvent', BLOC_EN_ATTENTE, 'occasionnels'];
function blocRank(b) { const i = ORDRE_BLOCS.indexOf(safeStr(b).toLowerCase()); return i < 0 ? 99 : i; }
// Bloc d'affichage d'un circuit : on lit EN PRIORITÉ bloc_final (posé par l'agent via le
// maillon), avec repli sur l'ancien champ bloc, puis déduction par le total.
function blocAffichage(r) {
  const bf = safeStr(r.bloc_final).toLowerCase();    // ⭐ maillon : bloc réel attribué par l'agent
  if (bf === 'très souvent' || bf === 'souvent' || bf === 'occasionnels') return bf;
  const b = safeStr(r.bloc).toLowerCase();           // repli : ancien champ bloc
  if (b === 'occasionnels') return 'occasionnels';
  if (b) return b;
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
    // ⭐ 30/06/2026 — la config ETAPE1_T3_PILIER_FIELDS a été migrée le 23/06 :
    //   bloc_haut/moyen/faible_* → bloc_tres_souvent/souvent/occasionnels_*.
    //   On lit DÉSORMAIS les noms réels exposés par getEtape1T3Piliers, avec repli
    //   sur les anciens noms au cas où (rétrocompat défensive).
    synth_factuelle_coeur:   safeStr(p.synth_factuelle),
    // Bloc 2 — Profil élargi (technique, par bloc)
    bloc_TS_technique:       safeStr(p.bloc_tres_souvent_technique  ?? p.bloc_haut_technique),
    bloc_SV_technique:       safeStr(p.bloc_souvent_technique       ?? p.bloc_moyen_technique),
    bloc_OC_technique:       safeStr(p.bloc_occasionnels_technique  ?? p.bloc_faible_technique),
    // Bloc 3 — vue d'ensemble (reprise + mode + où l'outil revient)
    vue_ensemble:            safeStr(p.synth_interpretee),
    vue_ensemble_html:       formatVueEnsemble(p.synth_interpretee),
    // Explications de bloc « ce que ces gestes disent de vous » = narratif + rattachement
    bloc_TS_agregat:         safeStr(p.bloc_tres_souvent_candidat     ?? p.bloc_haut_candidat),
    bloc_TS_rattachement:    safeStr(p.bloc_tres_souvent_rattachement ?? p.bloc_haut_catalogue),
    bloc_SV_agregat:         safeStr(p.bloc_souvent_candidat          ?? p.bloc_moyen_candidat),
    bloc_SV_rattachement:    safeStr(p.bloc_souvent_rattachement      ?? p.bloc_moyen_catalogue),
    bloc_OC_agregat:         safeStr(p.bloc_occasionnels_candidat     ?? p.bloc_faible_candidat),
    bloc_OC_rattachement:    safeStr(p.bloc_occasionnels_rattachement ?? p.bloc_faible_catalogue),
    // ── ALIAS rétrocompatibles : le template de prod actuel lit encore HAUT/MOYEN/FAIBLE.
    //    On expose les deux jeux de noms le temps de la transition (aucune perte). ──
    bloc_HAUT_technique:     safeStr(p.bloc_tres_souvent_technique  ?? p.bloc_haut_technique),
    bloc_MOYEN_technique:    safeStr(p.bloc_souvent_technique       ?? p.bloc_moyen_technique),
    bloc_FAIBLE_technique:   safeStr(p.bloc_occasionnels_technique  ?? p.bloc_faible_technique),
    bloc_HAUT_agregat:       safeStr(p.bloc_tres_souvent_candidat     ?? p.bloc_haut_candidat),
    bloc_HAUT_rattachement:  safeStr(p.bloc_tres_souvent_rattachement ?? p.bloc_haut_catalogue),
    bloc_MOYEN_agregat:      safeStr(p.bloc_souvent_candidat          ?? p.bloc_moyen_candidat),
    bloc_MOYEN_rattachement: safeStr(p.bloc_souvent_rattachement      ?? p.bloc_moyen_catalogue),
    bloc_FAIBLE_agregat:     safeStr(p.bloc_occasionnels_candidat     ?? p.bloc_faible_candidat),
    bloc_FAIBLE_rattachement:safeStr(p.bloc_occasionnels_rattachement ?? p.bloc_faible_catalogue),
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
      if (bloc !== blocCourant) {
        flushSousTotal();
        blocCourant = bloc;
        st = { bloc, coeur: 0, total: 0, iP1: 0, iP2: 0, iP3: 0, iP4: 0, iP5: 0 };
        // ⭐ 30/06 — en-tête de bloc dans le tableau validé (<tr class="bloc-divider">)
        tableauRows.push({ kind: 'bloc_header', bloc, libelle_bloc: bloc, role_class: roleClass, pilier_owner: po });
      }

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
      // ⭐ 30/06 — explication de bloc « Ce que ces gestes disent de vous » (agregat + rattachement),
      //   attachée à CHAQUE bloc selon son libellé (très souvent / souvent / occasionnels).
      const explBlocFor = (niv) => {
        if (niv === 'très souvent') return { agregat: m.bloc_TS_agregat, rattachement: m.bloc_TS_rattachement };
        if (niv === 'souvent')      return { agregat: m.bloc_SV_agregat, rattachement: m.bloc_SV_rattachement };
        if (niv === 'occasionnels') return { agregat: m.bloc_OC_agregat, rattachement: m.bloc_OC_rattachement };
        return { agregat: '', rattachement: '' };
      };
      const blocsCartes = [];
      for (const niv of nomsBlocs) {
        if (!cartes[niv] || !cartes[niv].length) continue;
        const ex = explBlocFor(niv);
        blocsCartes.push({
          niveau: niv,
          libelle: libelleBloc(niv),
          role_class: m.role_class,
          circuits: cartes[niv],
          expl_bloc_agregat: ex.agregat,
          expl_bloc_rattachement: ex.rattachement,
          a_expl_bloc: !!(safeStr(ex.agregat).trim() || safeStr(ex.rattachement).trim()),
        });
      }
      const rowsPilier = [];
      let capture = false;
      for (const tr of tableauRows) {
        if (tr.kind === 'divider') capture = (tr.pilier === code);
        if (capture) {
          // ⭐ booléens pour le moteur Handlebars maison (pas de comparaison d'égalité dans les {{#if}})
          rowsPilier.push({
            ...tr,
            is_divider:      tr.kind === 'divider',
            is_bloc_header:  tr.kind === 'bloc_header',
            is_circuit:      tr.kind === 'circuit',
            is_sous_total:   tr.kind === 'sous_total',
            is_total_pilier: tr.kind === 'total_pilier',
          });
        }
        if (capture && tr.kind === 'total_pilier') { capture = false; }
      }
      // étoile de rôle pour la têtière (★ Socle, Amont, Aval, Fonctionnel)
      const roleStar = m.role === 'socle' ? '★ Socle'
                     : m.role === 'amont' ? 'Amont'
                     : m.role === 'aval'  ? 'Aval'
                     : m.role === 'fonctionnel' ? 'Fonctionnel' : '';
      // ⭐ 01/07 — CIRCUITS DEMO (procédure illustrée « ce qui sort de l'outil », comme le lexique temps 5) :
      //   liste à plat des circuits du pilier, nom + badge niveau (HAUT/MOYEN/FAIBLE) + 1er verbatim.
      const NIV_BADGE = { HAUT:'bh', MOYEN:'bm', FAIBLE:'bf' };
      const circuitsDemo = [];
      // ⭐ 01/07 — bloc le plus élevé disponible : très souvent > souvent > occasionnels
      //   (certains piliers comme P2/P4 n'ont que des « occasionnels »).
      const blocDemo = (cartes['très souvent'] && cartes['très souvent'].length) ? cartes['très souvent']
                     : (cartes['souvent'] && cartes['souvent'].length) ? cartes['souvent']
                     : (cartes['occasionnels'] || []);
      for (const c of blocDemo) {
        const v = (c.verbs && c.verbs[0]) ? c.verbs[0] : null;
        const nivC = safeStr(c.niveau_coeur).toUpperCase() || (num(c.coeur_aff) >= 4 ? 'HAUT' : num(c.coeur_aff) >= 2 ? 'MOYEN' : 'FAIBLE');
        circuitsDemo.push({
          code: safeStr(c.code),
          nom: safeStr(c.nom) || safeStr(c.code),
          niveau: nivC,
          niveau_badge: NIV_BADGE[nivC] || 'bf',
          coeur: safeStr(c.coeur_aff),
          total: safeStr(c.total_aff),
          profondeur: safeStr(c.profondeur),
          capacite: safeStr(c.capacite),
          verbatim: v ? safeStr(v.texte) : '',
          verbatim_ref: v ? safeStr(v.ref) : '',
          a_verbatim: !!(v && safeStr(v.texte).trim()),
        });
      }
      // ⭐ 01/07 — tuile récap pilier (avant l'éclaté) : is_socle + filtre (socle only) pour rappeler filtre/mode
      const estSocle = m.role === 'socle';
      sections.push({
        ...m,
        pilier_lc: safeStr(m.pilier).toLowerCase(),
        role_star: roleStar,
        is_socle: estSocle,
        is_autre: !estSocle,
        is_renfort: (m.role === 'amont' || m.role === 'aval'),
        // ⭐ titre du Temps 2 personnalisé selon le rôle
        titre_temps2: m.role === 'socle'  ? 'Votre signature : un outil que vous préférez'
                    : m.role === 'amont'  ? 'Un outil que vous activez en amont'
                    : m.role === 'aval'   ? 'Un outil que vous activez en aval'
                    :                        'Un outil que vous activez ponctuellement',
        intro_temps2: m.role === 'socle'  ? "Personne ne s'en sert à parts égales. Vous avez un outil que vous attrapez <strong>toujours en premier</strong>, par réflexe : votre <strong>socle</strong>."
                    : m.role === 'amont'  ? "Cet outil n'est pas votre socle, mais il vient <strong>en amont</strong> — il alimente et prépare le travail de votre outil principal."
                    : m.role === 'aval'   ? "Cet outil n'est pas votre socle, mais il vient <strong>en aval</strong> — il prolonge et met en œuvre ce que votre outil principal a décidé."
                    :                        "Cet outil n'est pas votre socle : il s'active <strong>ponctuellement</strong>, quand la situation l'exige.",
        circuits_demo: circuitsDemo,
        a_circuits_demo: circuitsDemo.length > 0,
        // ⭐ la boîte des 5 outils, avec CE pilier marqué comme socle (pour le temps 2 personnalisé)
        boite_tuiles: PILIERS.map(pc => ({ code: pc, est_ce_pilier: pc === code })),
        // ⭐ le filtre en QUESTIONS (temps 4) — champ dédié si présent, sinon vide (pas d'invention)
        filtre_questions: (function(){
          const q = safeStr(bilan.filtre_questions);
          if (!q) return { a: false, liste: [] };
          const liste = q.split(/\s*[?？]\s*/).map(x => x.trim()).filter(Boolean).map(x => x + ' ?');
          return { a: liste.length > 0, liste: liste };
        })(),
        filtre_synthese: estSocle ? (safeStr(bilan.filtre_synthese) || 'appliquez ce réglage à toute situation') : '',
        role_court_tuile: estSocle ? 'socle'
                         : (m.role === 'amont' || m.role === 'aval') ? 'renfort'
                         : 'fonctionnel',
        recap_filtre: estSocle ? safeStr(bilan.filtre) : '',
        blocsCartes,
        rows: rowsPilier
      });
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

  // ⭐ 01/07 — registres/coûts = TEXTE (### / titre en 1re ligne), pas JSON. On formate en HTML.
  const registres_html = formatRegistres(bilan.registres);
  const coutPrincipal  = formatBlocCout(bilan.cout_principal);
  const coutSecondaire = formatBlocCout(bilan.cout_secondaire);
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

  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ 30/06 — CONTENU AVANT CHAPITRE I : page de garde + vue globale
  // ═══════════════════════════════════════════════════════════════════════════
  // Page de garde : civilité + socle + filtre (réels). Finalité/signature masquées si vides.
  const socleLibelleGarde = safeStr(bilan.pilier_socle_label) || safeStr(bilan.socle_libelle) || socleLabel;
  const finaliteGarde     = safeStr(bilan.filtre_finalite) || safeStr(bilan.sig_finalite);
  const signatureGarde    = safeStr(bilan.sig_resultat_ligne1);
  const garde = {
    civilite:         civilite,
    socle_libelle:    socleLibelleGarde,
    filtre:           safeStr(bilan.filtre),
    a_filtre:         safeStr(bilan.filtre).trim() !== '',
    finalite:         finaliteGarde,
    a_finalite:       finaliteGarde.trim() !== '',
    signature_courte: signatureGarde,
    a_signature:      signatureGarde.trim() !== '',
  };

  // Vue globale : 5 têtières condensées, ORDRE BOUCLE NATURELLE P1→P5.
  const vueGlobale = PILIERS.map(code => {
    const m = piliersMeta[code];
    if (!m || !m.pilier) return null;
    return {
      pilier:           m.pilier,
      pilier_lc:        safeStr(m.pilier).toLowerCase(),
      label:            m.label,
      role:             m.role,
      role_class:       m.role_class,
      role_star:        m.role === 'socle' ? '★ Socle'
                       : m.role === 'amont' ? 'Amont'
                       : m.role === 'aval'  ? 'Aval'
                       : m.role === 'fonctionnel' ? 'Fonctionnel' : '',
      tetiere_roleband: m.tetiere_roleband,
      tetiere_rappel:   m.tetiere_rappel,
      mode:             m.mode,
      // ⭐ 01/07 — pour le schéma final personnalisé (dernier chapitre) :
      is_socle:         m.role === 'socle',
      role_court:       m.role === 'socle' ? 'Socle — décide'
                       : m.role === 'amont' ? 'Renfort instrumental'
                       : m.role === 'aval'  ? 'Renfort instrumental'
                       : 'Fonctionnel',
      filtre:           m.role === 'socle' ? safeStr(bilan.filtre) : '',
    };
  }).filter(Boolean);

  // ⭐ 30/06 — REF : noms des 5 outils (pour le lexique 7 temps). Labels réels si présents, sinon défaut doctrinal.
  const NOMS_DEFAUT = { P1:"Collecte d'information", P2:'Tri et organisation', P3:'Analyse et diagnostic', P4:'Création de solutions', P5:'Mise en œuvre et exécution' };
  const ref = {};
  for (const code of PILIERS) {
    ref[code.toLowerCase()] = { nom: safeStr(piliersMeta[code]?.label) || NOMS_DEFAUT[code] };
  }
  // carte_role : libellé court de rôle, par pilier (pour le schéma "boîte complète" du temps 7)
  const carteRoleFromRole = (role) => {
    const r = safeStr(role).toLowerCase();
    if (r === 'socle') return 'décide';
    if (r === 'amont') return 'alimente';
    if (r === 'aval')  return 'conclut';
    return 'en appui';
  };
  const cartesRole = {};
  for (const code of PILIERS) cartesRole[code.toLowerCase()] = { carte_role: carteRoleFromRole(piliersMeta[code]?.role) };

  // ⭐ 01/07 — CHAPITRE FILTRE COGNITIF (les preuves sont un texte "REF : « verbatim » ; REF : « ... »")
  function formatFiltrePreuves(raw) {
    const txt = safeStr(raw).trim();
    if (!txt) return { a: false, html: '' };
    // découper par « ; » entre preuves ; chaque preuve = "REF : « verbatim »"
    const items = txt.split(/\s*;\s*(?=[A-ZP][0-9A-Za-z/]*\s*:)/);
    let html = '';
    for (const it of items) {
      const m = it.match(/^([^:]+):\s*(.*)$/);
      if (m) html += '<div class="fp-item"><div class="fp-ref">' + escapeHtmlLite(m[1].trim()) + '</div><div class="fp-txt">' + escapeHtmlLite(m[2].trim()) + '</div></div>';
      else html += '<div class="fp-item"><div class="fp-txt">' + escapeHtmlLite(it.trim()) + '</div></div>';
    }
    return { a: true, html: html };
  }
  // ⭐ v4 — parse le JSON filtre_gestes → tableau de gestes prêts pour le template.
  //   Chaque geste : { code, nom, coeur, rang, dit:[{texte,ref}], fait, revele }.
  //   dit_html = les verbatims formatés (réutilise le style fp-item). Aucune invention :
  //   si le champ est vide/illisible, renvoie [] (le template masque alors la section).
  function formatFiltreGestes(raw) {
    const arr = safeJson(raw);
    if (!Array.isArray(arr)) return [];
    return arr.map(g => {
      const dit = Array.isArray(g && g.dit) ? g.dit : [];
      let dit_html = '';
      for (const d of dit) {
        const ref = safeStr(d && d.ref).trim();
        const txt = safeStr(d && d.texte).trim();
        if (!txt) continue;
        dit_html += '<div class="fp-item">'
          + (ref ? '<div class="fp-ref">' + escapeHtmlLite(ref) + '</div>' : '')
          + '<div class="fp-txt">' + escapeHtmlLite(txt) + '</div></div>';
      }
      return {
        code:   safeStr(g && g.code),
        nom:    safeStr(g && g.nom),
        coeur:  safeStr(g && g.coeur),
        rang:   safeStr(g && g.rang),
        dit_html: dit_html,
        fait:   safeStr(g && g.fait),
        revele: safeStr(g && g.revele),
      };
    }).filter(g => g.fait || g.dit_html);   // garde les gestes réellement remplis
  }
  const filtrePreuves = formatFiltrePreuves(bilan.filtre_preuves);
  const filtreGestes = formatFiltreGestes(bilan.filtre_gestes);   // ⭐ v4 — décodage 3 strates
  const filtre = {
    present:     present(bilan.filtre),
    enonce:      safeStr(bilan.filtre),
    socle_label: safeStr(bilan.pilier_socle_label) || socleLabel,
    mode_socle:  safeStr(socle?.pilier_mode) || safeStr(piliersMeta[socleCode]?.mode),
    a_preuves:   filtrePreuves.a,
    preuves_html: filtrePreuves.html,
    technique:   safeStr(bilan.filtre_technique_v2 || bilan.technique),
    // ⭐ v4 — décodage geste par geste (3 strates) + synthèse (pose du filtre après)
    a_gestes:    filtreGestes.length > 0,
    sans_gestes: filtreGestes.length === 0,
    gestes:      filtreGestes,
    synthese:    safeStr(bilan.filtre_synthese),
  };

  const ctx = {
    candidat: {
      titre_affichage: `${civilite} ${prenom}`.trim(),
      nom_complet: `${prenom} ${nom}`.trim(),
    },
    garde: garde,
    vueGlobale: vueGlobale,
    filtre: filtre,
    ref: ref,
    p1: cartesRole.p1, p2: cartesRole.p2, p3: cartesRole.p3, p4: cartesRole.p4, p5: cartesRole.p5,
    bilan: {
      socle_libelle: safeStr(bilan.socle_libelle),
      signature_courte: safeStr(bilan.sig_resultat_ligne1),
    },
    tableau: { rows: tableauRows },
    sections: sections,
    tableau_json: JSON.stringify(tableauJsonObj),
    ch2: { present: ch2maillons.length > 0, maillons: ch2maillons },
    ch3: {
      // § 05 signal limbique
      signaux_present: present(registres_html),
      s05_intro:   safeStr(bilan.s05_intro),
      registres_html: registres_html,
      s05_vigilance_globale: extractVigilanceGlobale(bilan.registres),
      s05_cloture: safeStr(bilan.s05_cloture),
      // § 06 zones de coût
      couts_present:   coutPrincipal.a || coutSecondaire.a,
      s06_intro:       safeStr(bilan.s06_intro),
      cout_principal:  coutPrincipal,
      cout_secondaire: coutSecondaire,
      s06_cloture:     safeStr(bilan.s06_cloture),
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
