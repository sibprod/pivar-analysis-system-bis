// services/visualisation/bilanFableVisualiseurService.js
// Visualiseur bilan Fable — v1.0 (14/06/2026)
//
// Route : GET /visualiser/bilan-fable/:candidat_id
// Lit T3_BILAN + T3_PILIER (×5) + T3_CIRCUIT (tous) + REFERENTIEL_PILIERS
// Génère le HTML du bilan personnalisé directement (sans template Handlebars).
// Les champs fusionnés sont parsés côté service.
// Les champs calculés (tetiere_roleband, ou_revient, etc.) sont construits ici.

'use strict';

const airtableService = require('../infrastructure/airtableService');

// ════════════════════════════════════════════════════════════════════════════
// CONSTANTES — fldIDs
// ════════════════════════════════════════════════════════════════════════════

const FLD_BILAN = {
  candidat_id:       'fldk66gddYGCREOV4',
  pilier_socle:      'fldfJHsX7A38IYele',
  pilier_str1:       'fldzsZUsyQR7vvbEi',
  pilier_str2:       'fldefRzq9hqbn4gHn',
  pilier_fn1:        'fld5kBccd13uSx9ll',
  pilier_fn2:        'fldyw87BmzorCZ93j',
  filtre:            'fld9vAKpKEMIcRiTB',
  filtre_declinaison:'fld1p9p9Csvyllvcm',
  ch4_revelation:    'fldqDeT7EDov18iTz',
  ch4_preuves:       'fldXGZ5ijlcGPYc16',
  schema_intro_roles:'fldm2QaOvI5cKpLwg',
  schema_legende:    'fldXlpyU1EdUPBtIH',
  boucle_intro:      'fldFWT8vtfVuTm4zC',
  boucle_technique:  'fldRRLpspWX6qTx7d',
  maillon_m1:        'fldVM2cfim5rBivMt',
  maillon_m2:        'fldAZQSbNRxK8ugWo',
  maillon_m3:        'fldKxUzxHTvZ6d3z5',
  maillon_m4:        'fldzc8cjyygsfbC5N',
  s05_intro:         'fldxCNvqR4qyYAYjr',
  registres:         'fldgeeC3lg3M89ESA',
  s05_cloture:       'fld9x0yRmGnAhVFS4',
  s06_intro:         'fldxZi0jRCWnXsVng',
  cout_principal:    'fld0nyRitbejCsihG',
  cout_secondaire:   'fld7JUPi80iqSKzzV',
  s06_cloture:       'fld1nB5UqVklCjikE',
};

const FLD_PILIER = {
  candidat_id:      'fldZKruIBDdjAsY47',
  pilier:           'fldVvi5gbKioBmlsQ',
  pilier_label:     'fldbDYECHFEGkh0Ng',
  pilier_mode:      'fldoGY71vyiaUeFl6',
  mode_explication: 'fld6GtEBRP5UxvHeI',
  intro_eclate:     'fldomziXNOGf7Ujsb',
  bloc_haut_agg:    'fldBLvofzosLTPUOr',
  bloc_haut_tech:   'flds6XOIwvYr20iRY',
  bloc_moyen_agg:   'flda16lg5Dt1HrXrF',
  bloc_moyen_tech:  'fld7Sv7LXlZ6XPghN',
  bloc_faible_agg:  'fld68H41z6b9XtFoZ',
  bloc_faible_tech: 'fld6BWLEjDMdbYTs6',
  synth_interpretee:'fldho6MPGr5J5QmPu',
};

const FLD_CIRCUIT = {
  candidat_id:    'fldpQzPEvlNaRXFgg',
  pilier:         'fld74EvZRf7r4biGh',
  circuit_id:     'fldrnHJtNOWWYJ91t',
  nom:            'fldSGRXf8mi4q1NTd',
  freq:           'fldrM33rxdYnJ39vz',
  niveau:         'fld0LTPI1KfAVHRqI',
  n3_nuance:      'fldSx0VOHYILowFSj',
  expl_courte:    'fld3zZ8SteMWedetW',
  en_renfort:     'fldixMQDcsD7cCyd3',
  verb1_texte:    'fldLP9juCWCTlCZPt',
  verb1_ref:      'fldI1DVJiH7EH4zel',
  verb2_texte:    'fldSCQD9zvgRQcuq9',
  verb2_ref:      'fldmVPwfku0vUz6xX',
  verb3_texte:    'fldhIp3aW72WR2V1t',
  verb3_ref:      'fldcQ7hxyRumcc1DO',
  verb4_texte:    'fld4lrLWySRXVmvZe',
  verb4_ref:      'fldQgruSXveuTCLM4',
  total:          'fldnFNJm6GP0mAGNm',
  svc_p1:         'fldoGZPSxM22pk82R',
  svc_p2:         'fldAgQzO8YgqbzUEe',
  svc_p3:         'fld56OTFNSTo7OGAE',
  svc_p4:         'fldJ76jeasA2KVmdY',
  svc_p5:         'fldqMhYYHMy7b2s1n',
};

const PILIERS_ORDRE = ['P1', 'P2', 'P3', 'P4', 'P5'];
const PILIER_CSS = { P1: 'p1', P2: 'p2', P3: 'p3', P4: 'p4', P5: 'p5' };

// ════════════════════════════════════════════════════════════════════════════
// PARSERS — champs fusionnés
// ════════════════════════════════════════════════════════════════════════════

/**
 * Parse un champ maillon (M1..M4) en { badge, titre, attest, verbatims, texte }.
 * Format attendu :
 *   "BADGE · Titre\nAttest : ...\nVERBATIMS :\n«...»\n...\nTEXTE :\n..."
 */
function parseMaillon(raw) {
  if (!raw) return { badge: '', titre: '', attest: '', verbatims: '', texte: raw || '' };
  const lines = raw.split('\n');
  const ligne1 = lines[0] || '';
  const dotIdx = ligne1.indexOf(' · ');
  const badge = dotIdx > -1 ? ligne1.substring(0, dotIdx) : '';
  const titre = dotIdx > -1 ? ligne1.substring(dotIdx + 3) : ligne1;

  const verbIdx = raw.indexOf('\nVERBATIMS :');
  const texteIdx = raw.indexOf('\nTEXTE :');

  const attest = verbIdx > -1
    ? raw.substring(ligne1.length + 1, verbIdx).trim()
    : '';

  const verbatims = verbIdx > -1
    ? (texteIdx > -1
        ? raw.substring(verbIdx + 13, texteIdx).trim()
        : raw.substring(verbIdx + 13).trim())
    : '';

  const texte = texteIdx > -1 ? raw.substring(texteIdx + 9).trim() : '';

  return { badge, titre, attest, verbatims, texte };
}

/**
 * Parse le champ registres (3 blocs séparés par double-saut de ligne).
 * Format de chaque bloc :
 *   "Titre — Sous-titre\nTexte\n«verbatim» (ref)"
 */
function parseRegistres(raw) {
  if (!raw) return [];
  const blocs = raw.split(/\n\n+/);
  return blocs.filter(b => b.trim()).map(bloc => {
    const lines = bloc.split('\n');
    const titre = lines[0] || '';
    // Verbatim = ligne(s) commençant par « ou contenant »
    const verbLines = lines.filter(l => l.includes('«') || l.includes('»'));
    const verbatims = verbLines.join(' ');
    const texteLines = lines.slice(1).filter(l => !l.includes('«') && !l.includes('»'));
    const texte = texteLines.join('\n').trim();
    return { titre, texte, verbatims };
  });
}

/**
 * Parse un champ coût.
 * Format : "Coût X\nTitre du coût\nTEXTE :\n...\nVERBATIMS :\n..."
 */
function parseCout(raw) {
  if (!raw) return { label: '', titre: '', texte: '', verbatims: '' };
  const lines = raw.split('\n');
  const label = lines[0] || '';
  const titre = lines[1] || '';
  const texteIdx = raw.indexOf('\nTEXTE :');
  const verbIdx = raw.indexOf('\nVERBATIMS :');
  const texte = texteIdx > -1
    ? (verbIdx > -1
        ? raw.substring(texteIdx + 8, verbIdx).trim()
        : raw.substring(texteIdx + 8).trim())
    : '';
  const verbatims = verbIdx > -1 ? raw.substring(verbIdx + 12).trim() : '';
  return { label, titre, texte, verbatims };
}

/**
 * Parse le champ ch4_preuves (5 preuves numérotées).
 * Format : "Preuve 1 · Titre\nTexte...\n\nPreuve 2 · ..."
 */
function parsePreuves(raw) {
  if (!raw) return [];
  const parts = raw.split(/\nPreuve \d+ ·\s*/);
  // Le premier split peut donner une partie vide ou "Preuve 1 · ..." directement
  const first = raw.match(/^Preuve \d+ ·\s*(.+)/m);
  const result = [];
  const segments = raw.split(/(?=Preuve \d+ ·)/);
  for (const seg of segments) {
    if (!seg.trim()) continue;
    const match = seg.match(/^Preuve \d+ ·\s*(.+?)(?:\n([\s\S]*))?$/);
    if (match) {
      result.push({ titre: (match[1] || '').trim(), texte: (match[2] || '').trim() });
    }
  }
  // Garantir 5 entrées
  while (result.length < 5) result.push({ titre: '', texte: '' });
  return result.slice(0, 5);
}

/**
 * Extrait "ou_revient" depuis synth_interpretee.
 * Cherche la section "▸ Où cet outil revient".
 */
function extraireOuRevient(synth) {
  if (!synth) return '';
  const marker = '▸ Où cet outil revient';
  const idx = synth.indexOf(marker);
  if (idx === -1) return '';
  return synth.substring(idx + marker.length).trim().replace(/^\(.*?\)\n?/, '').trim();
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS — rôles
// ════════════════════════════════════════════════════════════════════════════

function calculerRoles(bilan) {
  // bilan contient les codes pilier pour chaque rôle
  const roles = {};
  const socle = bilan.pilier_socle;
  roles[socle] = 'socle';
  if (bilan.pilier_str1) roles[bilan.pilier_str1] = 'str1';
  if (bilan.pilier_str2) roles[bilan.pilier_str2] = 'str2';
  if (bilan.pilier_fn1) roles[bilan.pilier_fn1] = 'fn1';
  if (bilan.pilier_fn2) roles[bilan.pilier_fn2] = 'fn2';
  return roles;
}

function roleLabel(role) {
  const labels = {
    socle: '★ Socle',
    str1:  'Amont — il alimente le socle',
    str2:  'Aval — il conclut ce que le socle a décidé',
    fn1:   'Fonctionnel — mobilisé quand la tâche l\'exige',
    fn2:   'Fonctionnel — mobilisé quand la tâche l\'exige',
  };
  return labels[role] || 'Disponible';
}

function roleCarteLabel(role) {
  const labels = { socle: 'votre socle', str1: 'amont', str2: 'aval', fn1: 'disponible', fn2: 'disponible' };
  return labels[role] || 'disponible';
}

function roleCssClass(role) {
  const map = { socle: 'role-socle', str1: 'role-str1', str2: 'role-str2', fn1: 'role-fn1', fn2: 'role-fn2' };
  return map[role] || 'role-fn2';
}

// ════════════════════════════════════════════════════════════════════════════
// HELPERS — HTML
// ════════════════════════════════════════════════════════════════════════════

function esc(s) {
  if (s === null || s === undefined) return '';
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nl2br(s) {
  return esc(s).replace(/\n/g, '<br>');
}

// Nombre d'activations affiché : 0 = '·', sinon le nombre
function affNum(n) { return (!n || n === 0) ? '·' : String(n); }

// ════════════════════════════════════════════════════════════════════════════
// CONSTRUCTEURS HTML — sections
// ════════════════════════════════════════════════════════════════════════════

function htmlTetiere(pCode, pilierData, roles, refNoms, bilan) {
  const role = roles[pCode] || 'fn2';
  const roleL = roleLabel(role);
  const roleCss = roleCssClass(role);
  const pCss = PILIER_CSS[pCode] || 'p3';
  const mode = pilierData ? (pilierData[FLD_PILIER.pilier_mode] || '') : '';
  const label = pilierData ? (pilierData[FLD_PILIER.pilier_label] || '') : '';

  // tetiere_rappel : construit depuis synth_interpretee bloc1
  const synth = pilierData ? (pilierData[FLD_PILIER.synth_interpretee] || '') : '';
  const bloc1Match = synth.match(/▸ Bloc 1[^▸]*/);
  const rappel = bloc1Match ? bloc1Match[0].replace('▸ Bloc 1 — Profil pur (cœur de l\'outil)', '').trim().substring(0, 200) : '';

  const nomLong = refNoms[pCode] || pCode;
  const starLine = role === 'socle' ? '★ Socle' : (role === 'str1' ? 'Amont' : (role === 'str2' ? 'Aval' : 'Fonctionnel'));

  return `<div class="ph">
  <div class="ph-badge ${pCss}"><div class="ph-id">${pCode}</div></div>
  <div class="ph-body">
    <div class="ph-star">${esc(starLine)}</div>
    <div class="ph-nom">${esc(nomLong)}</div>
    <span class="ph-rb ${roleCss}">${esc(roleL)}</span>
    <div class="ph-rappel">${esc(rappel)}</div>
  </div>
  <div class="ph-mode">
    <span class="ph-mlbl">Mode retenu</span>
    <span class="ph-mval">${esc(mode)}</span>
  </div>
</div>`;
}

function htmlTableauCircuits(pCode, circuits) {
  const svcCols = PILIERS_ORDRE.map(P => {
    const isOwn = P === pCode;
    const label = isOwn
      ? `<th class="num" style="background:repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 5px,#e9eaec 5px,#e9eaec 10px);color:#c0c2c6;">Pilier instrumental ${P}</th>`
      : `<th class="num">Pilier instrumental ${P}</th>`;
    return label;
  }).join('');

  const header = `<table class="circuits-table"><thead><tr>
    <th>Circuits</th>
    <th class="num">Niveau d'activation</th>
    <th class="num">Activation cœur</th>
    ${svcCols}
    <th class="num">Total occurrences (5 piliers)</th>
  </tr></thead><tbody>`;

  // Grouper les circuits par niveau
  const haut   = circuits.filter(c => (c.niveau || '') === 'HAUT');
  const moyen  = circuits.filter(c => (c.niveau || '') === 'MOYEN');
  const faible = circuits.filter(c => (c.niveau || '') === 'FAIBLE' && (c.coeur || 0) >= 1);
  const soutien = circuits.filter(c => (c.coeur || 0) === 0 && (c.total || 0) > 0);
  const adhoc  = circuits.filter(c => c.is_adhoc);

  function ligneCircuit(c) {
    const badgeClass = c.niveau === 'HAUT' ? 'nb-haut' : (c.niveau === 'MOYEN' ? 'nb-moyen' : 'nb-bas');
    const niveauAff = c.coeur === 0 ? '' : `<span class="niveau-badge ${badgeClass}">${esc(c.niveau || 'FAIBLE')}</span>`;
    const coeurAff = c.coeur === 0 ? '·' : `<strong>${c.coeur}</strong>`;
    const codeLabel = c.is_adhoc
      ? `<strong style="font-family:var(--mono);color:#c2410c;">${esc(pCode)}·ADHOC</strong>`
      : `<strong style="font-family:var(--mono);">${esc(pCode + c.circuit_id)}</strong>`;

    const svcCells = PILIERS_ORDRE.map(P => {
      if (P === pCode) return `<td style="background:repeating-linear-gradient(45deg,#f3f4f6,#f3f4f6 5px,#e9eaec 5px,#e9eaec 10px);color:#c0c2c6;" class="num-c">·</td>`;
      const n = c[`svc_${P.toLowerCase()}`] || 0;
      return `<td class="num-c">${affNum(n)}</td>`;
    }).join('');

    return `<tr>
      <td class="nom-c">${codeLabel} — ${esc(c.nom)}</td>
      <td class="num-c">${niveauAff}</td>
      <td class="num-c">${coeurAff}</td>
      ${svcCells}
      <td class="num-c"><strong>${affNum(c.total)}</strong></td>
    </tr>`;
  }

  function ligneGroupe(titre, items) {
    if (!items.length) return '';
    return `<tr class="circuits-group-header"><td colspan="9" style="background:#f3f4f6;font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink);font-weight:700;padding:8px 10px;border-top:1px solid var(--rl);">▸ ${esc(titre)}</td></tr>`
      + items.map(ligneCircuit).join('');
  }

  const body = [
    ligneGroupe('Ce que vous faites très souvent (activé 4 fois ou plus) — vos gestes les plus caractéristiques', haut),
    ligneGroupe('Ce que vous faites régulièrement (activé 2 à 3 fois)', moyen),
    ligneGroupe('Ce que vous faites de temps en temps (activé 1 fois)', faible),
    ligneGroupe('Ce que vous faites avec cet outil uniquement au service d\'un autre outil', soutien),
    adhoc.length ? ligneGroupe('Des gestes bien à vous, ajoutés sur mesure', adhoc) : '',
  ].join('');

  return header + body + '</tbody></table>';
}

function htmlDetailCircuit(c, pCode) {
  const pCss = PILIER_CSS[pCode] || 'p3';
  const verbatims = [
    { texte: c.verb1_texte, ref: c.verb1_ref },
    { texte: c.verb2_texte, ref: c.verb2_ref },
    { texte: c.verb3_texte, ref: c.verb3_ref },
    { texte: c.verb4_texte, ref: c.verb4_ref },
  ].filter(v => v.texte);

  const header = c.is_adhoc
    ? `<span style="font-family:var(--mono);font-size:9px;font-weight:700;color:#c2410c;background:#fff7ed;border:1px solid #fdba74;border-radius:3px;padding:1px 6px;margin-right:6px;">Geste sur mesure · AD-HOC</span> · <span style="font-size:13px;font-weight:500;">${esc(c.nom)}</span>`
    : `<strong style="font-family:var(--mono);font-size:12px;color:var(--${pCss});">${esc(pCode + c.circuit_id)}</strong> &nbsp;·&nbsp; <span style="font-size:13px;font-weight:500;">${esc(c.nom)}</span>`;

  const coeurInfo = c.coeur === 0
    ? `instrumental ${affNum(c.total)}`
    : `cœur ${c.coeur}${c.total > c.coeur ? ` · total ${c.total}` : ''}`;

  const verbLines = verbatims.map(v =>
    `<div style="font-size:12px;font-style:italic;background:#fafafa;border-left:2px solid var(--rl);padding:6px 10px;margin:4px 0;line-height:1.55;">
      « ${esc(v.texte)} »
      <span style="display:block;font-family:var(--mono);font-size:9px;color:var(--muted);font-style:normal;margin-top:2px;">${esc(v.ref)}</span>
    </div>`
  ).join('');

  const renfort = c.en_renfort ? `<div style="font-size:11.5px;color:#374151;line-height:1.55;margin-top:7px;padding-top:7px;border-top:1px dashed var(--rl);"><strong>En renfort :</strong> ${esc(c.en_renfort)}</div>` : '';

  return `<div class="circuit-mini" style="background:white;border:1px solid var(--rl);border-left:4px solid var(--${pCss});border-radius:5px;padding:12px 16px;margin-bottom:10px;">
    <div style="display:flex;justify-content:space-between;align-items:baseline;">
      <div>${header}</div>
      <div style="font-family:var(--mono);font-size:10px;color:var(--muted);">${coeurInfo}</div>
    </div>
    <div style="font-size:11.5px;color:var(--muted);margin:6px 0 4px;font-style:italic;">${verbatims.length > 1 ? 'Ce que vous faites, à travers plusieurs situations différentes :' : 'Ce que vous faites :'}</div>
    ${verbLines}
    <div style="font-size:12px;color:#374151;line-height:1.6;">${nl2br(c.n3_nuance || c.expl_courte)}</div>
    ${renfort}
  </div>`;
}

function htmlBlocAgregatAvecTitre(titre, agg, pCode) {
  if (!agg) return '';
  const pCss = PILIER_CSS[pCode] || 'p3';
  return `<div style="font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.12em;color:var(--${pCss});font-weight:700;margin-top:24px;margin-bottom:12px;border-bottom:1px solid var(--rl);padding-bottom:6px;">▸ ${esc(titre)}</div>
    <div style="background:#f9fafb;border-left:3px solid var(--${pCss});border-radius:4px;padding:12px 16px;margin:6px 0 8px;font-size:12.5px;color:#374151;line-height:1.65;">${nl2br(agg)}</div>`;
}

function htmlSynthesePilier(pCode, pilierData, refNoms) {
  if (!pilierData) return '';
  const pCss = PILIER_CSS[pCode] || 'p3';
  const synth = pilierData[FLD_PILIER.synth_interpretee] || '';
  const mode = pilierData[FLD_PILIER.pilier_mode] || '';
  const modeExpl = pilierData[FLD_PILIER.mode_explication] || '';
  const nomLong = refNoms[pCode] || pCode;
  const ouRevient = extraireOuRevient(synth);

  return `<div class="synthese-pilier ${pCss}">
    <div class="sp-header">
      <div class="sp-icon ${pCss}">${pCode}</div>
      <div>
        <div class="sp-title">${esc(nomLong)} — Synthèse du pilier</div>
        <div class="sp-subtitle">Une vue complète en une lecture : l'inventaire, ce que vos gestes disent, et où l'outil revient</div>
      </div>
    </div>
    <div class="sp-tech-block">
      <div class="sp-tech-label">▸ Profil complet — ce que vos gestes disent de vous</div>
      <div class="sp-tech-content">${nl2br(synth)}</div>
    </div>
    ${ouRevient ? `<div class="sp-tech-block">
      <div class="sp-tech-label">▸ Où cet outil revient (lecture des totaux instrumentaux)</div>
      <div class="sp-tech-content">${nl2br(ouRevient)}</div>
    </div>` : ''}
    <div class="sp-interprete-block ${roleCssClass('fn1')}">
      <div class="sp-interprete-label">Mode retenu : ${esc(mode)}</div>
      <div class="sp-interprete-content">${nl2br(modeExpl)}</div>
    </div>
  </div>`;
}

function htmlSectionPilier(pCode, pilierData, circuits, roles, refNoms) {
  const role = roles[pCode] || 'fn2';
  const roleCss = roleCssClass(role);
  const pCss = PILIER_CSS[pCode] || 'p3';

  const circuitsHaut   = circuits.filter(c => c.niveau === 'HAUT');
  const circuitsMoyen  = circuits.filter(c => c.niveau === 'MOYEN');
  const circuitsFaible = circuits.filter(c => c.niveau === 'FAIBLE' && c.coeur >= 1);
  const circuitsSoutien= circuits.filter(c => c.coeur === 0 && c.total > 0);

  const blocHautAgg  = pilierData ? (pilierData[FLD_PILIER.bloc_haut_agg]  || '') : '';
  const blocMoyenAgg = pilierData ? (pilierData[FLD_PILIER.bloc_moyen_agg] || '') : '';
  const blocFaibleAgg= pilierData ? (pilierData[FLD_PILIER.bloc_faible_agg]|| '') : '';
  const introEclate  = pilierData ? (pilierData[FLD_PILIER.intro_eclate]   || '') : '';

  // Détails par groupe
  const detailHaut = circuitsHaut.map(c => htmlDetailCircuit(c, pCode)).join('');
  const detailMoyen = circuitsMoyen.map(c => htmlDetailCircuit(c, pCode)).join('');
  const detailFaibleEtSoutien = [...circuitsFaible, ...circuitsSoutien].map(c => htmlDetailCircuit(c, pCode)).join('');

  return `<div class="section ${roleCss}" id="${pCode.toLowerCase()}">
    ${htmlTetiere(pCode, pilierData, roles, refNoms)}
    ${introEclate ? `<div style="font-size:14px;font-weight:300;color:#374151;line-height:1.7;margin-bottom:16px;">${nl2br(introEclate)}</div>` : ''}
    ${htmlTableauCircuits(pCode, circuits)}
    ${circuitsHaut.length ? htmlBlocAgregatAvecTitre('Ce que vous faites très souvent (activé 4 fois ou plus)', '', pCode) : ''}
    ${detailHaut}
    ${blocHautAgg ? `<div style="background:#f9fafb;border-left:3px solid var(--${pCss});border-radius:4px;padding:12px 16px;margin:6px 0 8px;font-size:12.5px;color:#374151;line-height:1.65;"><strong>Ce que ces gestes disent de vous —</strong> ${nl2br(blocHautAgg)}</div>` : ''}
    ${circuitsMoyen.length ? htmlBlocAgregatAvecTitre('Ce que vous faites régulièrement (activé 2 à 3 fois)', '', pCode) : ''}
    ${detailMoyen}
    ${blocMoyenAgg ? `<div style="background:#f9fafb;border-left:3px solid var(--${pCss});border-radius:4px;padding:12px 16px;margin:6px 0 8px;font-size:12.5px;color:#374151;line-height:1.65;"><strong>Ce que ces gestes disent de vous —</strong> ${nl2br(blocMoyenAgg)}</div>` : ''}
    ${(circuitsFaible.length || circuitsSoutien.length) ? htmlBlocAgregatAvecTitre('Ce que vous faites de temps en temps, ou en appui (activé 1 fois ou en renfort)', '', pCode) : ''}
    ${detailFaibleEtSoutien}
    ${blocFaibleAgg ? `<div style="background:#f9fafb;border-left:3px solid var(--${pCss});border-radius:4px;padding:12px 16px;margin:6px 0 8px;font-size:12.5px;color:#374151;line-height:1.65;"><strong>Ce que ces gestes disent de vous —</strong> ${nl2br(blocFaibleAgg)}</div>` : ''}
    ${htmlSynthesePilier(pCode, pilierData, refNoms)}
  </div>`;
}

function htmlBoucles(bilan) {
  const intro      = bilan[FLD_BILAN.boucle_intro] || '';
  const technique  = bilan[FLD_BILAN.boucle_technique] || '';
  const m1Raw = parseMaillon(bilan[FLD_BILAN.maillon_m1]);
  const m2Raw = parseMaillon(bilan[FLD_BILAN.maillon_m2]);
  const m3Raw = parseMaillon(bilan[FLD_BILAN.maillon_m3]);
  const m4Raw = parseMaillon(bilan[FLD_BILAN.maillon_m4]);

  function htmlMaillon(m, idx) {
    if (!m.titre && !m.texte) return '';
    return `<div class="boucle-item" style="margin-bottom:14px;border:1px solid var(--rl);border-radius:5px;overflow:hidden;">
      <div style="background:#f9fafb;padding:10px 14px;border-bottom:1px solid var(--rl);">
        ${m.badge ? `<span style="font-family:var(--mono);font-size:13px;font-weight:700;color:var(--p3);">${esc(m.badge)}</span> &nbsp;·&nbsp; ` : ''}
        <strong style="font-size:13px;">${esc(m.titre)}</strong>
        ${m.attest ? `<span style="display:block;font-family:var(--mono);font-size:10px;color:var(--muted);margin-top:3px;">${esc(m.attest)}</span>` : ''}
      </div>
      <div style="padding:12px 14px;">
        ${m.verbatims ? `<div style="font-size:11.5px;color:var(--muted);font-style:italic;margin-bottom:5px;">Ce que vous dites :</div>
        <div style="font-size:12px;font-style:italic;background:#fafafa;border-left:2px solid var(--rl);padding:6px 10px;margin:4px 0;line-height:1.55;">${nl2br(m.verbatims)}</div>` : ''}
        <div style="font-size:12px;color:#374151;line-height:1.6;margin-top:6px;">${nl2br(m.texte)}</div>
      </div>
    </div>`;
  }

  return `<div class="section" id="boucle">
    <div class="s-label">§ 04</div>
    <div class="s-title">Boucle cognitive</div>
    <div style="font-size:14px;font-weight:300;color:#374151;line-height:1.7;margin-bottom:20px;">${nl2br(intro)}</div>
    <div style="margin-top:18px;">
      ${htmlMaillon(m1Raw, 1)}
      ${htmlMaillon(m2Raw, 2)}
      ${htmlMaillon(m3Raw, 3)}
      ${htmlMaillon(m4Raw, 4)}
    </div>
    ${technique ? `<div style="background:#f9fafb;border-left:3px solid var(--rl);border-radius:4px;padding:12px 16px;margin-top:16px;font-size:11.5px;color:var(--muted);line-height:1.6;">${nl2br(technique)}</div>` : ''}
  </div>`;
}

function htmlMarqueurs(bilan) {
  const s05intro   = bilan[FLD_BILAN.s05_intro]   || '';
  const s05cloture = bilan[FLD_BILAN.s05_cloture] || '';
  const s06intro   = bilan[FLD_BILAN.s06_intro]   || '';
  const s06cloture = bilan[FLD_BILAN.s06_cloture] || '';
  const registres  = parseRegistres(bilan[FLD_BILAN.registres] || '');
  const cout1      = parseCout(bilan[FLD_BILAN.cout_principal]  || '');
  const cout2      = parseCout(bilan[FLD_BILAN.cout_secondaire] || '');

  function htmlRegistre(r) {
    if (!r) return '';
    return `<div class="li">
      <div class="li-q">${esc(r.titre)}</div>
      <div class="li-content">${nl2br(r.texte)}</div>
      ${r.verbatims ? `<div class="li-v">${nl2br(r.verbatims)}</div>` : ''}
    </div>`;
  }

  function htmlCout(c, accentColor) {
    if (!c.titre) return '';
    return `<div style="background:white;border:1px solid var(--rl);border-left:4px solid ${accentColor};border-radius:5px;padding:14px 18px;">
      <div class="cout-lbl" style="color:${accentColor};">${esc(c.label)}</div>
      <div class="cout-titre">${esc(c.titre)}</div>
      <div class="cout-txt">${nl2br(c.texte)}</div>
      ${c.verbatims ? `<div class="cout-v">${nl2br(c.verbatims)}</div>` : ''}
    </div>`;
  }

  return `
    <div class="section" id="signal">
      <div class="s-label">§ 05</div>
      <div class="s-title">Signal limbique</div>
      <div style="font-size:14px;font-weight:300;color:#374151;line-height:1.7;margin-bottom:18px;">${nl2br(s05intro)}</div>
      <div class="limb-section">
        <div class="limb-items">
          ${registres.map(htmlRegistre).join('')}
        </div>
        ${s05cloture ? `<div style="font-size:13px;color:#374151;line-height:1.7;margin-top:14px;border-top:1px solid var(--rl);padding-top:12px;">${nl2br(s05cloture)}</div>` : ''}
      </div>
    </div>
    <div class="section" id="cout">
      <div class="s-label">§ 06</div>
      <div class="s-title">Zones de coût cognitif</div>
      <div style="font-size:14px;font-weight:300;color:#374151;line-height:1.7;margin-bottom:18px;">${nl2br(s06intro)}</div>
      <div style="display:flex;flex-direction:column;gap:12px;">
        ${htmlCout(cout1, 'var(--p5)')}
        ${htmlCout(cout2, 'var(--p4)')}
      </div>
      ${s06cloture ? `<div style="font-size:13px;color:#374151;line-height:1.7;margin-top:14px;border-top:1px solid var(--rl);padding-top:12px;">${nl2br(s06cloture)}</div>` : ''}
    </div>`;
}

function htmlChapitre4(bilan, roles, refNoms, piliersMap) {
  const filtre    = bilan[FLD_BILAN.filtre]         || '';
  const revelation= bilan[FLD_BILAN.ch4_revelation] || '';
  const preuves   = parsePreuves(bilan[FLD_BILAN.ch4_preuves] || '');
  const socleCode = bilan.pilier_socle;
  const legende   = bilan[FLD_BILAN.schema_legende]  || '';
  const intro     = bilan[FLD_BILAN.schema_intro_roles] || '';
  const filtreDeclMax = bilan[FLD_BILAN.filtre_declinaison] || '';

  function htmlPreuve(p, i) {
    if (!p || !p.titre) return '';
    return `<div class="pr">
      <div class="pr-n">Preuve ${i + 1} · ${esc(p.titre)}</div>
      <div class="pr-x">${nl2br(p.texte)}</div>
    </div>`;
  }

  // Boîte signature finale
  const socleMode = (piliersMap[socleCode] ? (piliersMap[socleCode][FLD_PILIER.pilier_mode] || '') : '');
  const str1Code  = bilan.pilier_str1;
  const str2Code  = bilan.pilier_str2;
  const str1Mode  = str1Code && piliersMap[str1Code] ? (piliersMap[str1Code][FLD_PILIER.pilier_mode] || '') : '';
  const str2Mode  = str2Code && piliersMap[str2Code] ? (piliersMap[str2Code][FLD_PILIER.pilier_mode] || '') : '';

  return `
    <div class="section" id="filtre">
      <div class="s-label">§ 02</div>
      <div class="s-title">Votre filtre cognitif — la révélation</div>
      <div class="fr-enc">
        <div class="fr-l">Votre filtre</div>
        <div class="fr-t">« ${esc(filtre)} »</div>
        <div class="fr-x">${nl2br(revelation)}</div>
      </div>
      <div class="pr-list">
        ${preuves.map((p, i) => htmlPreuve(p, i)).join('')}
      </div>
    </div>
    <div class="section" id="schema">
      <div class="s-label">§ Votre boîte complète</div>
      <div class="s-title">Votre signature cognitive</div>
      <div style="font-size:14px;font-weight:300;color:#374151;line-height:1.7;margin-bottom:16px;">${nl2br(intro)}</div>
      <div class="sg">
        <div class="sg-l">Votre signature cognitive</div>
        <div class="sg-r"><strong>VOTRE SOCLE</strong> — ${esc(refNoms[socleCode] || socleCode)} (${socleCode}) · mode : ${esc(socleMode)}</div>
        ${str1Code ? `<div class="sg-r"><strong>EN RENFORT</strong> — ${esc(refNoms[str1Code] || str1Code)} (${str1Code}, amont) · mode : ${esc(str1Mode)}</div>` : ''}
        ${str2Code ? `<div class="sg-r">${esc(refNoms[str2Code] || str2Code)} (${str2Code}, aval) · mode : ${esc(str2Mode)}</div>` : ''}
        <div class="sg-r"><strong>VOTRE FILTRE</strong> — « ${esc(filtre)} »</div>
        ${legende ? `<div class="sg-r" style="font-size:11.5px;color:var(--muted);font-style:italic;">${esc(legende)}</div>` : ''}
      </div>
    </div>`;
}

// ════════════════════════════════════════════════════════════════════════════
// CSS (extrait de BILAN_COMPLET_CECILE_v1.html — version condensée)
// ════════════════════════════════════════════════════════════════════════════

function getCss() {
  return `
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:ital,wght@0,400;0,600;0,700;1,400&family=DM+Sans:wght@300;400;500&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
:root{
  --ink:#1a1a18;--paper:#faf8f3;--paper2:#f0ece0;--rule:#d8d0bc;--rl:#e8e2d4;
  --p1:#2563eb;--p1b:#eff6ff;--p1e:#bfdbfe;
  --p2:#7c3aed;--p2b:#f5f3ff;--p2e:#ddd6fe;
  --p3:#059669;--p3b:#ecfdf5;--p3e:#a7f3d0;
  --p4:#d97706;--p4b:#fffbeb;--p4e:#fde68a;
  --p5:#dc2626;--p5b:#fef2f2;--p5e:#fecaca;
  --role-socle:#dc2626;--role-socle-bg:#fef2f2;--role-socle-edge:#fecaca;
  --role-str1:#ea580c;--role-str1-bg:#fff7ed;--role-str1-edge:#fed7aa;
  --role-str2:#ca8a04;--role-str2-bg:#fefce8;--role-str2-edge:#fde68a;
  --role-fn1:#16a34a;--role-fn1-bg:#f0fdf4;--role-fn1-edge:#bbf7d0;
  --role-fn2:#84cc16;--role-fn2-bg:#f7fee7;--role-fn2-edge:#d9f99d;
  --sans:'DM Sans',sans-serif;--serif:'Playfair Display',serif;--mono:'DM Mono',monospace;
  --muted:#6b7280;
}
*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--paper);color:var(--ink);font-family:var(--sans);font-size:14px;line-height:1.75;max-width:900px;margin:0 auto;}
.chapitre-divider{padding:32px 64px 28px;border-top:2px solid var(--ink);border-bottom:1px solid var(--rule);background:linear-gradient(180deg,var(--paper2) 0%,var(--paper) 100%);text-align:center;margin-top:24px;}
.chapitre-divider .chapitre-tag{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.2em;color:var(--muted);margin-bottom:8px;font-weight:600;}
.chapitre-divider .chapitre-titre{font-family:var(--serif);font-size:24px;font-weight:500;color:var(--ink);line-height:1.3;margin-bottom:6px;}
.chapitre-divider .chapitre-soustitre{font-size:13px;font-style:italic;color:var(--muted);}
.role-socle{--c:var(--role-socle);--cb:var(--role-socle-bg);--ce:var(--role-socle-edge);}
.role-str1{--c:var(--role-str1);--cb:var(--role-str1-bg);--ce:var(--role-str1-edge);}
.role-str2{--c:var(--role-str2);--cb:var(--role-str2-bg);--ce:var(--role-str2-edge);}
.role-fn1{--c:var(--role-fn1);--cb:var(--role-fn1-bg);--ce:var(--role-fn1-edge);}
.role-fn2{--c:var(--role-fn2);--cb:var(--role-fn2-bg);--ce:var(--role-fn2-edge);}
.role-badge{background:var(--c);color:white;font-family:var(--mono);font-size:11px;font-weight:600;padding:3px 8px;border-radius:3px;display:inline-block;}
.cover{padding:56px 64px 40px;border-bottom:3px solid var(--ink);position:relative;}
.cover::before{content:'';position:absolute;top:0;left:0;right:0;height:6px;background:repeating-linear-gradient(90deg,var(--p4) 0,var(--p4) 8px,transparent 8px,transparent 16px);}
.cover-tag{font-family:var(--mono);font-size:10px;letter-spacing:.15em;text-transform:uppercase;color:var(--muted);margin-bottom:16px;}
.cover-nom{font-family:var(--serif);font-size:46px;font-weight:700;line-height:1.05;margin-bottom:6px;}
.cover-titre{font-family:var(--serif);font-size:17px;font-style:italic;color:var(--muted);margin-bottom:28px;}
.toc{padding:20px 64px;background:var(--paper2);border-bottom:1px solid var(--rule);}
.toc-title{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:8px;}
.toc-items{display:flex;flex-wrap:wrap;gap:5px;}
.toc-item{font-size:12px;padding:3px 10px;border:1px solid var(--rule);border-radius:10px;cursor:pointer;background:white;text-decoration:none;color:var(--ink);}
.section{padding:36px 64px;border-bottom:1px solid var(--rule);}
.s-label{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.15em;color:var(--muted);margin-bottom:3px;}
.s-title{font-family:var(--serif);font-size:25px;font-weight:700;margin-bottom:18px;line-height:1.2;}
.ph{display:grid;grid-template-columns:68px 1fr 155px;gap:0;border-radius:7px;overflow:hidden;margin-bottom:18px;border:1px solid var(--rule);}
.ph-badge{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:12px;}
.ph-badge.p1{background:var(--p1);}.ph-badge.p2{background:var(--p2);}.ph-badge.p3{background:var(--p3);}.ph-badge.p4{background:var(--p4);}.ph-badge.p5{background:var(--p5);}
.ph-id{font-family:var(--mono);font-size:20px;font-weight:700;color:white;}
.ph-star{font-size:13px;color:rgba(255,255,255,.75);}
.ph-body{padding:13px 17px;background:white;}
.ph-nom{font-family:var(--serif);font-size:17px;font-weight:700;margin-bottom:3px;}
.ph-rb{display:inline-flex;align-items:center;gap:4px;font-size:11px;font-weight:500;padding:2px 9px;border-radius:9px;margin-bottom:4px;}
.ph-rb.role-socle{background:var(--role-socle-bg);color:var(--role-socle);border:1px solid var(--role-socle-edge);}
.ph-rb.role-str1{background:var(--role-str1-bg);color:var(--role-str1);border:1px solid var(--role-str1-edge);}
.ph-rb.role-str2{background:var(--role-str2-bg);color:var(--role-str2);border:1px solid var(--role-str2-edge);}
.ph-rb.role-fn1{background:var(--role-fn1-bg);color:var(--role-fn1);border:1px solid var(--role-fn1-edge);}
.ph-rb.role-fn2{background:var(--role-fn2-bg);color:var(--role-fn2);border:1px solid var(--role-fn2-edge);}
.ph-rappel{font-size:11px;color:var(--muted);font-style:italic;}
.ph-mode{padding:13px 14px;background:var(--paper2);border-left:1px solid var(--rule);display:flex;flex-direction:column;justify-content:center;}
.ph-mlbl{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:3px;}
.ph-mval{font-family:var(--serif);font-size:13px;font-style:italic;line-height:1.4;}
.circuits-table{width:100%;border-collapse:collapse;margin:8px 0;font-size:12px;}
.circuits-table thead tr{background:var(--ink);}
.circuits-table thead th{color:white;padding:7px 10px;text-align:left;font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.07em;font-weight:500;}
.circuits-table thead th.num{text-align:center;width:60px;}
.circuits-table tbody tr{border-bottom:1px solid var(--rl);}
.circuits-table tbody tr:nth-child(even){background:var(--paper2);}
.circuits-table td{padding:7px 10px;vertical-align:middle;}
.circuits-table td.nom-c{font-size:12px;font-weight:400;color:var(--ink);}
.circuits-table td.num-c{text-align:center;font-family:var(--mono);font-size:11px;font-weight:500;}
.niveau-badge{display:inline-block;font-family:var(--mono);font-size:9px;padding:1px 6px;border-radius:2px;font-weight:500;}
.nb-haut{background:var(--p4b);color:var(--p4);border:1px solid var(--p4e);}
.nb-moyen{background:#fef3c7;color:#92400e;border:1px solid var(--p4e);}
.nb-bas{background:#f3f4f6;color:#6b7280;border:1px solid #d1d5db;}
.circuits-group-header td{background:#f3f4f6;font-family:var(--mono);font-size:9.5px;text-transform:uppercase;letter-spacing:.1em;color:var(--ink);font-weight:700;padding:8px 10px;border-top:1px solid var(--rl);}
.synthese-pilier{border-radius:6px;padding:20px 22px;margin-top:16px;}
.synthese-pilier.p1{background:linear-gradient(135deg,var(--p1b) 0%,white 100%);border:1px solid var(--p1e);}
.synthese-pilier.p2{background:linear-gradient(135deg,var(--p2b) 0%,white 100%);border:1px solid var(--p2e);}
.synthese-pilier.p3{background:linear-gradient(135deg,var(--p3b) 0%,white 100%);border:1px solid var(--p3e);}
.synthese-pilier.p4{background:linear-gradient(135deg,var(--p4b) 0%,white 100%);border:1px solid var(--p4e);}
.synthese-pilier.p5{background:linear-gradient(135deg,var(--p5b) 0%,white 100%);border:1px solid var(--p5e);}
.sp-header{display:flex;align-items:center;gap:10px;margin-bottom:14px;padding-bottom:10px;border-bottom:1px solid rgba(0,0,0,.07);}
.sp-icon{width:36px;height:36px;border-radius:6px;display:flex;align-items:center;justify-content:center;font-family:var(--mono);font-size:13px;font-weight:700;color:white;flex-shrink:0;}
.sp-icon.p1{background:var(--p1);}.sp-icon.p2{background:var(--p2);}.sp-icon.p3{background:var(--p3);}.sp-icon.p4{background:var(--p4);}.sp-icon.p5{background:var(--p5);}
.sp-title{font-family:var(--serif);font-size:16px;font-weight:700;}
.sp-subtitle{font-size:11px;color:var(--muted);font-style:italic;}
.sp-tech-block{background:#f7f7f5;border-left:3px solid var(--rl);border-radius:0 4px 4px 0;padding:12px 16px;margin-top:10px;}
.sp-tech-label{font-family:var(--mono);font-size:10px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);font-weight:600;margin-bottom:6px;}
.sp-tech-content{font-size:13px;font-weight:300;color:#374151;line-height:1.65;}
.sp-interprete-block{border-radius:6px;padding:18px 22px;margin-top:16px;border:1.5px solid;}
.sp-interprete-block.role-fn1{background:var(--role-fn1-bg);border-color:var(--role-fn1);color:var(--role-fn1);}
.sp-interprete-label{font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.12em;font-weight:700;margin-bottom:10px;}
.sp-interprete-content{font-size:14px;font-weight:400;color:var(--ink);line-height:1.75;}
.limb-section{background:var(--p4b);border:1px solid var(--p4e);border-radius:6px;padding:16px 18px;margin-bottom:16px;}
.limb-items{display:flex;flex-direction:column;gap:8px;}
.li{display:flex;flex-direction:column;gap:4px;}
.li-q{display:inline-block;align-self:flex-start;font-family:var(--mono);font-size:10px;padding:2px 8px;border-radius:3px;background:var(--paper2);border:1px solid var(--rule);}
.li-content{font-size:12px;font-weight:300;color:#374151;line-height:1.55;}
.li-v{font-style:italic;color:#92400e;margin-top:2px;font-size:12px;}
.cout-lbl{font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--muted);margin-bottom:3px;}
.cout-titre{font-size:13px;font-weight:500;margin-bottom:4px;}
.cout-txt{font-size:13px;font-weight:300;color:#374151;line-height:1.65;}
.cout-v{font-size:12px;font-style:italic;color:var(--muted);margin-top:4px;}
.fr-enc{border:1.5px solid #b91c1c;border-radius:8px;padding:14px 18px;background:#fff;margin-bottom:18px;}
.fr-l{font-family:var(--mono);font-size:10px;letter-spacing:.12em;color:#b91c1c;text-transform:uppercase;margin-bottom:5px;}
.fr-t{font-size:15px;font-weight:600;color:#1f2937;line-height:1.5;}
.fr-x{font-size:13px;color:#374151;line-height:1.65;margin-top:8px;}
.pr-list{display:flex;flex-direction:column;gap:10px;}
.pr{background:white;border:1px solid var(--rl);border-left:3px solid var(--p3);border-radius:5px;padding:11px 15px;}
.pr-n{font-family:var(--mono);font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--p3);margin-bottom:4px;}
.pr-x{font-size:12.5px;color:#374151;line-height:1.6;}
.sg{border:2px solid #1a1a18;border-radius:8px;padding:15px 19px;margin-top:16px;background:#fff;}
.sg-l{font-family:var(--mono);font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:#1a1a18;margin-bottom:8px;}
.sg-r{font-size:13px;color:#1f2937;line-height:1.7;margin-top:6px;}
.gen-band{padding:8px 64px;background:#1a1a18;color:#faf8f3;font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.08em;}
.boucle-item{margin-bottom:14px;border:1px solid var(--rule);border-radius:5px;overflow:hidden;}
@media(max-width:700px){.section{padding:24px 18px;}.gen-band{padding:8px 18px;}}
</style>`;
}

// ════════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE PRINCIPAL
// ════════════════════════════════════════════════════════════════════════════

/**
 * Génère le HTML complet du bilan Fable pour un candidat.
 * @param {string} candidat_id
 * @returns {Promise<string>} HTML complet
 */
async function genererBilanFableHtml(candidat_id) {
  // ── 1. Récupération des données en parallèle ──────────────────────────────
  const [
    bilanRecords,
    pilierRecords,
    circuitRecords,
    refPiliersRecords,
    visiteurRecords,
  ] = await Promise.all([
    airtableService.getEtape1T3Bilan(candidat_id),
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T3Circuits(candidat_id),
    airtableService.getReferentielPiliers(),
    airtableService.getVisiteur(candidat_id),
  ]);

  // Bilan (1 record)
  if (!bilanRecords || bilanRecords.length === 0) {
    return `<html><body><h1>Bilan introuvable pour ${candidat_id}</h1></body></html>`;
  }
  const bilan = bilanRecords[0];

  // Extraire les codes pilier depuis les champs singleSelect
  bilan.pilier_socle = (bilan[FLD_BILAN.pilier_socle]?.name || '').trim();
  bilan.pilier_str1  = (bilan[FLD_BILAN.pilier_str1]?.name  || '').trim() || null;
  bilan.pilier_str2  = (bilan[FLD_BILAN.pilier_str2]?.name  || '').trim() || null;
  bilan.pilier_fn1   = (bilan[FLD_BILAN.pilier_fn1]?.name   || '').trim() || null;
  bilan.pilier_fn2   = (bilan[FLD_BILAN.pilier_fn2]?.name   || '').trim() || null;

  // ── 2. Référentiel piliers → map code → nom ───────────────────────────────
  // REFERENTIEL_PILIERS : field pilier_nom = fldI2u7FxkWhdGoot
  // field pilier_code (P1..P5) = à trouver depuis les records
  const refNoms = {};
  for (const r of (refPiliersRecords || [])) {
    // Le code pilier est stocké différemment selon l'implémentation ; on essaie les champs connus
    const code = r.pilier_code || r['pilier_code'] || '';
    const nom  = r.pilier_nom  || r['pilier_nom']  || r['fldI2u7FxkWhdGoot'] || '';
    if (code) refNoms[code] = nom;
  }
  // Fallback si getReferentielPiliers ne retourne pas les bons champs
  if (Object.keys(refNoms).length === 0) {
    const fallbacks = {
      P1: "Collecte d'information",
      P2: 'Tri et organisation',
      P3: 'Analyse et diagnostic',
      P4: 'Création de solutions',
      P5: 'Mise en œuvre et exécution',
    };
    Object.assign(refNoms, fallbacks);
  }

  // ── 3. Piliers → map code → record ───────────────────────────────────────
  const piliersMap = {};
  for (const p of (pilierRecords || [])) {
    const code = (p[FLD_PILIER.pilier]?.name || p.pilier || '').trim();
    if (code) piliersMap[code] = p;
  }

  // ── 4. Circuits → map code → tableau de circuits ──────────────────────────
  // getEtape1T3Circuits utilise _mapByFieldIds → champs par clé lisible
  const circuitsParPilier = {};
  for (const c of (circuitRecords || [])) {
    const pCode = (c.pilier?.name || c.pilier || '').trim();
    const cId   = c.circuit_id || '';
    const isAdhoc = !cId; // circuits ADHOC n'ont pas de circuit_id standard
    if (!pCode) continue;
    if (!circuitsParPilier[pCode]) circuitsParPilier[pCode] = [];
    circuitsParPilier[pCode].push({
      circuit_id:  cId,
      nom:         c.circuit_nom || c.nom || '',
      coeur:       Number(c.circuit_freq  || c.freq  || 0),
      total:       Number(c.total_activations || c.total || 0),
      niveau:      (c.circuit_niveau?.name || c.niveau || ''),
      n3_nuance:   c.n3_nuance   || c.explication || '',
      expl_courte: c.explication_courte_ch4 || c.expl_courte || '',
      en_renfort:  c.en_renfort  || '',
      verb1_texte: c.verbatim_1  || c.verb1_texte || '',
      verb1_ref:   c.verbatim_1_ref || c.verb1_ref || '',
      verb2_texte: c.verbatim_2  || c.verb2_texte || '',
      verb2_ref:   c.verbatim_2_ref || c.verb2_ref || '',
      verb3_texte: c.verbatim_3  || c.verb3_texte || '',
      verb3_ref:   c.verbatim_3_ref || c.verb3_ref || '',
      verb4_texte: c.verbatim_4  || c.verb4_texte || '',
      verb4_ref:   c.verbatim_4_ref || c.verb4_ref || '',
      svc_p1:      Number(c.en_svc_P1 || 0),
      svc_p2:      Number(c.en_svc_P2 || 0),
      svc_p3:      Number(c.en_svc_P3 || 0),
      svc_p4:      Number(c.en_svc_P4 || 0),
      svc_p5:      Number(c.en_svc_P5 || 0),
      is_adhoc:    isAdhoc,
    });
  }

  // ── 5. Rôles ──────────────────────────────────────────────────────────────
  const roles = calculerRoles(bilan);

  // ── 6. Ordre d'affichage des piliers : socle en premier, puis str1/str2, puis fn1/fn2
  const ordreAffichage = [
    bilan.pilier_socle,
    bilan.pilier_str1,
    bilan.pilier_str2,
    bilan.pilier_fn1,
    bilan.pilier_fn2,
  ].filter(Boolean);

  // Nom du candidat
  const prenom = visiteurRecords?.Prenom || visiteurRecords?.prenom || candidat_id;

  // ── 7. Assemblage HTML ────────────────────────────────────────────────────
  const socleCode = bilan.pilier_socle;
  const filtre    = bilan[FLD_BILAN.filtre] || '';

  // Vue globale — têtières
  const vueGlobale = `<div class="section" id="vue-globale">
    <div class="s-label">Vue globale</div>
    <div class="s-title">Vos 5 outils en un coup d'œil</div>
    <p style="font-size:13px;color:#374151;line-height:1.7;margin-bottom:16px;">Les cinq têtières qui suivent résument chaque outil — son rôle dans votre boîte, ses chiffres, son mode.</p>
    ${ordreAffichage.map(pCode => htmlTetiere(pCode, piliersMap[pCode], roles, refNoms, bilan)).join('')}
  </div>`;

  // Sections pilier CH1
  const sectionsPiliers = ordreAffichage
    .map(pCode => htmlSectionPilier(
      pCode,
      piliersMap[pCode],
      circuitsParPilier[pCode] || [],
      roles,
      refNoms
    ))
    .join('');

  const date = new Date().toLocaleDateString('fr-FR');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bilan cognitif — ${esc(prenom)}</title>
${getCss()}
</head>
<body>
<div class="gen-band">BILAN COGNITIF · ${esc(prenom.toUpperCase())} · Profil-Cognitif Sib Prod · ${date}</div>

<!-- COUVERTURE -->
<div class="cover">
  <div class="cover-tag">Bilan cognitif personnel</div>
  <div class="cover-nom">${esc(prenom)}</div>
  <div class="cover-titre">Cartographie de votre architecture cognitive</div>
</div>

<!-- SOMMAIRE -->
<div class="toc">
  <div class="toc-title">Sommaire</div>
  <div class="toc-items">
    <a class="toc-item" href="#vue-globale">Vue globale</a>
    ${ordreAffichage.map(pCode => `<a class="toc-item" href="#${pCode.toLowerCase()}">${esc(refNoms[pCode] || pCode)}</a>`).join('')}
    <a class="toc-item" href="#boucle">Chapitre II — Boucle</a>
    <a class="toc-item" href="#signal">Chapitre III — Marqueurs</a>
    <a class="toc-item" href="#filtre">Chapitre IV — Révélation</a>
  </div>
</div>

<!-- VUE GLOBALE -->
${vueGlobale}

<!-- CHAPITRE I -->
<div class="chapitre-divider">
  <div class="chapitre-tag">Chapitre I — Vos 5 outils en détail</div>
  <div class="chapitre-titre">Outil par outil : circuits, tableaux et analyses</div>
  <div class="chapitre-soustitre">Le détail complet de chaque pilier</div>
</div>
${sectionsPiliers}

<!-- CHAPITRE II -->
<div class="chapitre-divider">
  <div class="chapitre-tag">Chapitre II</div>
  <div class="chapitre-titre">Votre boucle cognitive en action</div>
  <div class="chapitre-soustitre">Comment vos outils s'enchaînent dans une même situation</div>
</div>
${htmlBoucles(bilan)}

<!-- CHAPITRE III -->
<div class="chapitre-divider">
  <div class="chapitre-tag">Chapitre III</div>
  <div class="chapitre-titre">Marqueurs affectifs et zones de coût</div>
  <div class="chapitre-soustitre">Ce que ressent votre cerveau pendant qu'il fonctionne</div>
</div>
${htmlMarqueurs(bilan)}

<!-- CHAPITRE IV -->
<div class="chapitre-divider">
  <div class="chapitre-tag">Chapitre IV — La révélation</div>
  <div class="chapitre-titre">Votre filtre, votre boîte, votre signature</div>
  <div class="chapitre-soustitre">La synthèse de tout ce qui précède</div>
</div>
${htmlChapitre4(bilan, roles, refNoms, piliersMap)}

</body>
</html>`;

  return html;
}

module.exports = { genererBilanFableHtml };
