// services/visualisation/tableauT3HtmlService.js
// Service de génération HTML — Tableau T3 candidat — Visualisation interne
// Profil-Cognitif v10.5 (Phase HTML-T3-1.0.0)
//
// PHASE HTML-T3-1.0.0 (06/05/2026 — création initiale) :
//
//   Objectif : Reproduire le pattern de visualisation T1/T2 pour la table
//   ETAPE1_T3 produite par l'Agent T3 (à venir en prod).
//
//   Structure de la sortie T3 (cf. config/airtable.js ETAPE1_T3_FIELDS) :
//
//   1 ligne = 1 pilier × 1 circuit. Pour un candidat :
//     - 5 piliers (P1-P5)
//     - Chaque pilier a N circuits (variable selon doctrine)
//     - Donc typiquement 15 à 30 lignes par candidat
//
//   15 colonnes :
//     - candidat_id, pilier, role_pilier, nb_circuits_actifs_pilier
//     - circuit_id, circuit_nom, frequence, niveau_activation, actif
//     - types_verbatim_detail (multiline), activations_franches, activations_nuancees
//     - clusters_identifies, commentaire_attribution, type_contenu
//
//   Mise en page choisie : option 3 — "1 bloc par pilier avec ses circuits"
//   (Décision CTO 06/05) :
//
//   - HEADER NOIR (PROFIL COGNITIF + nom candidat) — strictement identique à T1/T2
//   - BANNIÈRE T3 distinctive (couleur violette, distincte du cyan T2)
//   - META-BAR (stats globales)
//   - 5 SECTIONS PILIERS (P1 → P5), chacune contenant :
//       * Header pilier : badge P{N} large + role_pilier + nb_circuits_actifs
//       * Tableau des circuits du pilier :
//         circuit_id · circuit_nom · frequence · niveau_activation · actif ·
//         types_verbatim_detail · activations · clusters · commentaire · type
//   - FOOTER — identique à T1/T2
//
//   Compatibilité doctrinale :
//   - Décision n°4 : civilité lue depuis VISITEUR pour affichage uniquement
//   - Décision n°27 : placement dans services/visualisation/
//
//   Méthodes Airtable utilisées :
//   - airtableService.getVisiteurInfoForVisualisation(candidat_id)
//   - airtableService.getEtape1T3(candidat_id)  ⚠️ doit exister dans airtableService

'use strict';

const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

// ─── CSS COMPLET — palette violette pour T3 (distincte du cyan T2) ──────────
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

:root {
  --bg:#f5f4f0; --s1:#ffffff; --s2:#f0ede8; --s3:#e8e4de;
  --border:#d4cfc8; --border2:#c0b8b0;
  --text:#1a1814; --mid:#4a4540; --dim:#8a857e;
  --acc:#1a3a6b; --acc2:#1a5a48;
  --p1:#1a5fa0; --p2:#1a7a60; --p3:#6a2a9a; --p4:#8a5a10; --p5:#8a2a10;
  --oui:#1a6a38; --non:#8a2a10;
  --row-bg:#fffdf5;
  /* Couleurs Profil-Cognitif (logo) */
  --pc-blue:#3a5fb0; --pc-pink:#e91e63; --pc-cyan:#5ac8fa; --pc-yellow:#ffcc00;
  /* T3 — palette distinctive (violet dominant) */
  --t3-accent:#6a2a9a; --t3-bg:#f3e8fb; --t3-border:#c8a8e0;
  --t3-section-bg:#faf5ff;
  /* Niveaux activation */
  --niv-haut:#1a6a38; --niv-moyen:#8a7a10; --niv-inactif:#8a857e;
  /* Rôles piliers */
  --role-socle:#1a3a6b; --role-struct:#1a5fa0; --role-fonct:#1a7a60; --role-resist:#8a2a10;
}

* { box-sizing:border-box; margin:0; padding:0; }
body {
  background:var(--bg); color:var(--text);
  font-family:'IBM Plex Sans',sans-serif; font-size:12px; line-height:1.5; padding:24px;
}

/* ─── HEADER (logo + identité candidat) — IDENTIQUE T1/T2 ───────────────── */
.page-header {
  background:#000; color:#fff;
  padding:16px 24px; margin:-24px -24px 24px -24px;
  display:flex; align-items:center; gap:20px;
  border-bottom:3px solid var(--pc-pink);
}
.page-header .logo-block { display:flex; align-items:center; gap:14px; }
.page-header h1 {
  font-family:'IBM Plex Mono',monospace; font-size:14px; font-weight:600;
  letter-spacing:.06em; text-transform:uppercase;
  color:#fff;
}
.page-header h1 .pc-blue  { color:var(--pc-blue); }
.page-header h1 .pc-pink  { color:var(--pc-pink); }
.page-header .candidat-block {
  margin-left:auto; text-align:right;
  font-family:'IBM Plex Mono',monospace;
}
.page-header .candidat-prenom { font-size:18px; font-weight:600; color:#fff; }
.page-header .candidat-id { font-size:10px; color:#aaa; margin-top:2px; }

/* ─── BANNIÈRE T3 distinctive (violet) ──────────────────────────────────── */
.t3-banner {
  background:linear-gradient(90deg, var(--t3-accent) 0%, #9a4ac8 100%);
  color:#fff;
  padding:12px 18px;
  border-radius:4px;
  margin-bottom:18px;
  display:flex; align-items:center; gap:14px;
  box-shadow:0 2px 6px rgba(106,42,154,.18);
}
.t3-banner .t3-tag {
  background:#000; color:#fff;
  font-family:'IBM Plex Mono',monospace;
  font-size:14px; font-weight:600;
  padding:4px 12px; border-radius:3px;
  letter-spacing:.08em;
}
.t3-banner .t3-title {
  font-family:'IBM Plex Mono',monospace;
  font-size:12px; font-weight:500;
  letter-spacing:.04em;
}
.t3-banner .t3-subtitle {
  font-size:11px;
  opacity:0.92;
  margin-left:auto;
  font-style:italic;
}

/* ─── META-BAR ──────────────────────────────────────────────────────────── */
.meta-bar {
  background:var(--s1); border:1px solid var(--border); border-radius:4px;
  padding:14px 18px; margin-bottom:20px;
  display:flex; gap:24px; flex-wrap:wrap;
  font-family:'IBM Plex Mono',monospace; font-size:10px;
}
.meta-bar .item { display:flex; flex-direction:column; gap:2px; }
.meta-bar .label { color:var(--dim); text-transform:uppercase; letter-spacing:.04em; font-size:9px; }
.meta-bar .value { color:var(--text); font-weight:600; font-size:11px; }

/* ─── SECTION PILIER ────────────────────────────────────────────────────── */
.pilier-section {
  background:var(--t3-section-bg);
  border:1px solid var(--t3-border);
  border-radius:6px;
  margin-bottom:24px;
  overflow:hidden;
}
.pilier-section-header {
  padding:14px 18px;
  border-bottom:1px solid var(--t3-border);
  background:#fff;
  display:flex; align-items:center; gap:14px; flex-wrap:wrap;
}
.pilier-section-pNum {
  font-family:'IBM Plex Mono',monospace;
  font-size:22px; font-weight:700;
  padding:6px 16px; border-radius:5px;
  letter-spacing:.04em;
  display:inline-block;
}
.pilier-section-pNum.p1 { background:#ddeeff; color:var(--p1); border:2px solid var(--p1); }
.pilier-section-pNum.p2 { background:#ddf5ee; color:var(--p2); border:2px solid var(--p2); }
.pilier-section-pNum.p3 { background:#f0e0ff; color:var(--p3); border:2px solid var(--p3); }
.pilier-section-pNum.p4 { background:#fff0d0; color:var(--p4); border:2px solid var(--p4); }
.pilier-section-pNum.p5 { background:#ffe8e0; color:var(--p5); border:2px solid var(--p5); }

.pilier-section-meta {
  display:flex; gap:18px; flex-wrap:wrap;
}
.pilier-meta-item {
  display:flex; flex-direction:column; gap:2px;
  font-family:'IBM Plex Mono',monospace;
}
.pilier-meta-label {
  font-size:9px; color:var(--dim);
  text-transform:uppercase; letter-spacing:.04em;
}
.pilier-meta-value {
  font-size:13px; color:var(--text);
  font-weight:600;
}

/* Badge rôle pilier */
.role-badge {
  display:inline-block;
  font-family:'IBM Plex Mono',monospace;
  font-size:11px; font-weight:600;
  padding:3px 10px; border-radius:3px;
  letter-spacing:.04em;
  text-transform:uppercase;
}
.role-badge.socle         { background:#1a3a6b; color:#fff; }
.role-badge.structurant   { background:#1a5fa0; color:#fff; }
.role-badge.fonctionnel   { background:#1a7a60; color:#fff; }
.role-badge.resistant     { background:#8a2a10; color:#fff; }
.role-badge.unknown       { background:#e0e0e0; color:#666; }

/* Tableau des circuits du pilier */
.circuits-tbl-wrap {
  overflow-x:auto;
  background:#fff;
}
.circuits-tbl {
  width:100%; min-width:1400px; border-collapse:collapse; table-layout:fixed;
}
.circuits-tbl col.c-cid     { width:90px; }
.circuits-tbl col.c-cname   { width:180px; }
.circuits-tbl col.c-freq    { width:80px; }
.circuits-tbl col.c-niv     { width:100px; }
.circuits-tbl col.c-actif   { width:60px; }
.circuits-tbl col.c-types   { width:280px; }
.circuits-tbl col.c-actfr   { width:160px; }
.circuits-tbl col.c-actnu   { width:160px; }
.circuits-tbl col.c-clust   { width:160px; }
.circuits-tbl col.c-comm    { width:200px; }
.circuits-tbl col.c-tcont   { width:80px; }

.circuits-tbl thead th {
  background:var(--t3-accent); color:#fff;
  font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:600;
  letter-spacing:.04em; text-transform:uppercase;
  padding:8px 6px; vertical-align:middle;
  border:1px solid #4a1080;
  text-align:left;
}
.circuits-tbl thead th .col-sub {
  display:block; font-size:8px; font-weight:400; color:#d8b8e8;
  margin-top:2px; letter-spacing:.02em; text-transform:none;
}

.circuits-tbl td {
  background:var(--row-bg); border:1px solid var(--border);
  padding:8px 9px; vertical-align:top;
  font-size:11px; color:var(--mid); line-height:1.55;
  word-wrap:break-word; overflow-wrap:break-word; word-break:break-word;
}
.circuits-tbl tr.is-inactif td {
  opacity:0.55;
  background:#f5f5f5;
}

/* Badges activation */
.niv-badge {
  display:inline-block;
  font-family:'IBM Plex Mono',monospace;
  font-size:10px; font-weight:700;
  padding:2px 8px; border-radius:3px;
  letter-spacing:.04em;
  color:#fff;
}
.niv-badge.haut    { background:var(--niv-haut); }
.niv-badge.moyen   { background:var(--niv-moyen); }
.niv-badge.inactif { background:var(--niv-inactif); }

/* Badge actif/inactif boolean */
.actif-badge {
  display:inline-block;
  font-family:'IBM Plex Mono',monospace;
  font-size:10px; font-weight:600;
  padding:2px 6px; border-radius:2px;
  letter-spacing:.05em;
}
.actif-badge.true  { background:#e0f0e4; color:#1a6a38; border:1px solid #90c890; }
.actif-badge.false { background:#f0e0e0; color:#8a2a10; border:1px solid #d8a8a8; }

/* Type contenu BRUT/ANALYSE — IDENTIQUE T2 */
.type-badge {
  display:inline-block;
  font-family:'IBM Plex Mono',monospace;
  font-size:9px; font-weight:600;
  padding:2px 7px; border-radius:2px;
  letter-spacing:.05em;
}
.type-badge.brut    { background:#e8f0e4; color:#3a6a30; border:1px solid #a0c890; }
.type-badge.analyse { background:#fbe8d0; color:#8a5000; border:1px solid #e0b070; }

/* Cellules détaillées */
.cell-multiline {
  font-size:11px;
  line-height:1.5;
  color:var(--text);
}
.cell-empty {
  color:var(--dim);
  font-style:italic;
  font-size:10px;
}
.cell-types-detail {
  font-size:10px;
  line-height:1.5;
  white-space:pre-wrap;
}

/* Section vide (aucune donnée pour ce pilier) */
.pilier-empty {
  padding:30px;
  text-align:center;
  color:var(--dim);
  font-style:italic;
  background:#fff;
  font-size:11px;
}

/* Footer — IDENTIQUE T1/T2 */
.page-footer {
  margin-top:30px; padding-top:14px; border-top:1px solid var(--border);
  font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--dim);
  text-align:center;
}

/* Scrollbar — IDENTIQUE T1/T2 */
::-webkit-scrollbar { height:6px; width:6px; }
::-webkit-scrollbar-track { background:var(--bg); }
::-webkit-scrollbar-thumb { background:var(--border2); border-radius:3px; }
`.trim();

// ─── UTILITAIRES (alignés sur tableauT1HtmlService et tableauT2HtmlService) ─

function escapeHtml(text) {
  if (text === null || text === undefined || text === '') return '';
  const s = String(text);
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function nl2br(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/**
 * Badge rôle pilier (socle / structurant_X / fonctionnel_X / résistant)
 */
function roleBadge(role) {
  if (!role) return '<span class="role-badge unknown">—</span>';
  const r = String(role).toLowerCase().trim();
  // Normalisation : "résistant" → "resistant" (pas d'accent dans la classe CSS)
  if (r === 'socle') return `<span class="role-badge socle">${escapeHtml(role)}</span>`;
  if (r.startsWith('structurant')) return `<span class="role-badge structurant">${escapeHtml(role)}</span>`;
  if (r.startsWith('fonctionnel')) return `<span class="role-badge fonctionnel">${escapeHtml(role)}</span>`;
  if (r === 'résistant' || r === 'resistant') return `<span class="role-badge resistant">${escapeHtml(role)}</span>`;
  return `<span class="role-badge unknown">${escapeHtml(role)}</span>`;
}

/**
 * Badge niveau d'activation (HAUT / MOYEN / INACTIF)
 */
function niveauBadge(niveau) {
  if (!niveau) return '<span class="niv-badge inactif">—</span>';
  const n = String(niveau).toUpperCase().trim();
  if (n === 'HAUT')    return '<span class="niv-badge haut">HAUT</span>';
  if (n === 'MOYEN')   return '<span class="niv-badge moyen">MOYEN</span>';
  if (n === 'INACTIF') return '<span class="niv-badge inactif">INACTIF</span>';
  return `<span class="niv-badge inactif">${escapeHtml(niveau)}</span>`;
}

/**
 * Badge actif true/false (boolean Airtable)
 */
function actifBadge(value) {
  if (value === true || String(value).toLowerCase() === 'true') {
    return '<span class="actif-badge true">✓ actif</span>';
  }
  if (value === false || String(value).toLowerCase() === 'false') {
    return '<span class="actif-badge false">✗ inactif</span>';
  }
  return '<span class="cell-empty">—</span>';
}

/**
 * Badge type contenu BRUT/ANALYSE — IDENTIQUE T2
 */
function typeContenuBadge(value) {
  if (!value) return '';
  const v = String(value).toUpperCase().trim();
  if (v === 'BRUT')    return '<span class="type-badge brut">BRUT</span>';
  if (v === 'ANALYSE') return '<span class="type-badge analyse">ANALYSE</span>';
  return escapeHtml(value);
}

/**
 * Affichage simple d'un texte multiline (avec fallback "vide")
 */
function multilineCell(text, classExtra) {
  if (!text || String(text).trim() === '') {
    return '<span class="cell-empty">—</span>';
  }
  const cls = classExtra ? `cell-multiline ${classExtra}` : 'cell-multiline';
  return `<div class="${cls}">${nl2br(text)}</div>`;
}

// ─── EN-TÊTES DES COLONNES DU TABLEAU CIRCUITS ────────────────────────────

const CIRCUITS_HEADERS_HTML = `<thead>
  <tr>
    <th>Circuit ID<span class="col-sub">circuit_id</span></th>
    <th>Nom du circuit<span class="col-sub">circuit_nom</span></th>
    <th>Fréq.<span class="col-sub">frequence</span></th>
    <th>Activation<span class="col-sub">niveau_activation</span></th>
    <th>Actif<span class="col-sub">actif</span></th>
    <th>Types verbatim<span class="col-sub">types_verbatim_detail</span></th>
    <th>Activations franches<span class="col-sub">activations_franches</span></th>
    <th>Activations nuancées<span class="col-sub">activations_nuancees</span></th>
    <th>Clusters<span class="col-sub">clusters_identifies</span></th>
    <th>Commentaire<span class="col-sub">commentaire_attribution</span></th>
    <th>Type<span class="col-sub">type_contenu</span></th>
  </tr>
</thead>`;

// ═══════════════════════════════════════════════════════════════════════════
// RENDU D'UNE LIGNE CIRCUIT (1 circuit pour un pilier donné)
// ═══════════════════════════════════════════════════════════════════════════

function renderCircuitRow(row) {
  const isActif = (row.actif === true || String(row.actif).toLowerCase() === 'true');
  const niveau = String(row.niveau_activation || '').toUpperCase();
  const isInactif = niveau === 'INACTIF' || !isActif;

  const trClass = isInactif ? 'is-inactif' : '';

  return `
<tr class="${trClass}">
  <td style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;">${escapeHtml(row.circuit_id || '—')}</td>
  <td style="font-weight:500;color:var(--text);">${escapeHtml(row.circuit_nom || '—')}</td>
  <td style="font-family:'IBM Plex Mono',monospace;font-size:11px;font-weight:600;text-align:center;">${escapeHtml(row.frequence !== null && row.frequence !== undefined ? String(row.frequence) : '—')}</td>
  <td>${niveauBadge(row.niveau_activation)}</td>
  <td>${actifBadge(row.actif)}</td>
  <td>${multilineCell(row.types_verbatim_detail, 'cell-types-detail')}</td>
  <td>${multilineCell(row.activations_franches)}</td>
  <td>${multilineCell(row.activations_nuancees)}</td>
  <td>${multilineCell(row.clusters_identifies)}</td>
  <td>${multilineCell(row.commentaire_attribution)}</td>
  <td>${typeContenuBadge(row.type_contenu)}</td>
</tr>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDU D'UNE SECTION PILIER (P1, P2, P3, P4 ou P5)
// ═══════════════════════════════════════════════════════════════════════════

function renderPilierSection(pilier, circuits) {
  // Extraction du num pilier (1-5)
  const pStr = String(pilier).toUpperCase().trim();
  const pNum = pStr.replace(/[^1-5]/g, '');
  const pClass = pNum ? `p${pNum}` : 'p1';

  // On lit le rôle et le nb_circuits depuis la 1ère ligne (ces champs sont
  // identiques sur toutes les lignes d'un même pilier d'un même candidat)
  const firstCircuit = circuits[0] || {};
  const rolePilier = firstCircuit.role_pilier || '';
  const nbActifs = firstCircuit.nb_circuits_actifs_pilier !== null &&
                   firstCircuit.nb_circuits_actifs_pilier !== undefined
                   ? firstCircuit.nb_circuits_actifs_pilier
                   : '?';

  // Tri des circuits : actifs (HAUT > MOYEN) en premier, INACTIF à la fin
  const sortedCircuits = circuits.slice().sort((a, b) => {
    const order = { 'HAUT': 1, 'MOYEN': 2, 'INACTIF': 3 };
    const na = order[String(a.niveau_activation || '').toUpperCase()] || 99;
    const nb = order[String(b.niveau_activation || '').toUpperCase()] || 99;
    if (na !== nb) return na - nb;
    return String(a.circuit_id || '').localeCompare(String(b.circuit_id || ''));
  });

  let circuitsHtml;
  if (sortedCircuits.length === 0) {
    circuitsHtml = `<div class="pilier-empty">Aucun circuit T3 enregistré pour ce pilier.</div>`;
  } else {
    const rowsHtml = sortedCircuits.map(renderCircuitRow).join('\n');
    circuitsHtml = `
<div class="circuits-tbl-wrap">
<table class="circuits-tbl">
<colgroup>
  <col class="c-cid"><col class="c-cname"><col class="c-freq">
  <col class="c-niv"><col class="c-actif"><col class="c-types">
  <col class="c-actfr"><col class="c-actnu"><col class="c-clust">
  <col class="c-comm"><col class="c-tcont">
</colgroup>
${CIRCUITS_HEADERS_HTML}
<tbody>
${rowsHtml}
</tbody>
</table>
</div>`;
  }

  return `
<div class="pilier-section">
  <div class="pilier-section-header">
    <span class="pilier-section-pNum ${pClass}">${escapeHtml(pStr)}</span>
    <div class="pilier-section-meta">
      <div class="pilier-meta-item">
        <span class="pilier-meta-label">Rôle du pilier</span>
        <span class="pilier-meta-value">${roleBadge(rolePilier)}</span>
      </div>
      <div class="pilier-meta-item">
        <span class="pilier-meta-label">Circuits actifs</span>
        <span class="pilier-meta-value">${nbActifs}</span>
      </div>
      <div class="pilier-meta-item">
        <span class="pilier-meta-label">Total circuits T3</span>
        <span class="pilier-meta-value">${circuits.length}</span>
      </div>
    </div>
  </div>
  ${circuitsHtml}
</div>`;
}

// ─── GÉNÉRATION HTML COMPLÈTE ───────────────────────────────────────────────

/**
 * Génère le HTML complet du tableau T3 d'un candidat
 * @param {string} candidat_id
 * @returns {Promise<string>}
 */
async function generateTableauT3Html(candidat_id) {
  logger.info('Génération HTML Tableau T3', { candidat_id });

  // 1. Lire les infos VISITEUR
  let visiteurInfo = { prenom: '?', nom: '?', civilite: '?', candidate_ID: candidat_id };
  try {
    visiteurInfo = await airtableService.getVisiteurInfoForVisualisation(candidat_id);
  } catch (e) {
    logger.warn('Impossible de lire VISITEUR pour visualisation T3', { candidat_id, error: e.message });
  }

  // 2. Lire les lignes ETAPE1_T3
  let rows = [];
  try {
    rows = await airtableService.getEtape1T3(candidat_id);
  } catch (e) {
    logger.error('Impossible de lire ETAPE1_T3', { candidat_id, error: e.message });
    return generateEmptyHtml(candidat_id, visiteurInfo,
      `Erreur de lecture des données T3 : ${e.message}. La méthode airtableService.getEtape1T3 existe-t-elle ?`);
  }

  if (!rows || rows.length === 0) {
    return generateEmptyHtml(candidat_id, visiteurInfo,
      'Aucune ligne T3 trouvée pour ce candidat. T3 a-t-il bien été exécuté ?');
  }

  // 3. Grouper par pilier (P1, P2, P3, P4, P5)
  const grouped = { 'P1': [], 'P2': [], 'P3': [], 'P4': [], 'P5': [] };
  for (const row of rows) {
    const pStr = String(row.pilier || '').toUpperCase().trim();
    const num = pStr.replace(/[^1-5]/g, '');
    if (num) {
      const key = `P${num}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(row);
    }
  }

  // 4. Statistiques globales
  const stats = computeStats(rows, grouped);

  // 5. Construire les sections piliers (toujours dans l'ordre P1 → P5)
  const sectionsHtml = ['P1', 'P2', 'P3', 'P4', 'P5']
    .map(p => renderPilierSection(p, grouped[p] || []))
    .join('\n');

  const generationTime = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Tableau T3 — ${escapeHtml(visiteurInfo.prenom)} ${escapeHtml(visiteurInfo.nom || '')} — Profil-Cognitif</title>
<style>${CSS}</style>
</head>
<body>

<div class="page-header">
  <div class="logo-block">
    <h1><span class="pc-blue">PROFIL</span> <span class="pc-pink">COGNITIF</span></h1>
  </div>
  <div class="candidat-block">
    <div class="candidat-prenom">${escapeHtml(visiteurInfo.prenom)} ${escapeHtml(visiteurInfo.nom || '')}</div>
    <div class="candidat-id">${escapeHtml(visiteurInfo.candidate_ID)}</div>
  </div>
</div>

<div class="t3-banner">
  <span class="t3-tag">T3</span>
  <span class="t3-title">Analyse pilier × circuit · Lecture détaillée des activations cognitives</span>
  <span class="t3-subtitle">Étape 1 · Tableau 3</span>
</div>

<div class="meta-bar">
  <div class="item"><span class="label">Tableau</span><span class="value">T3 — Pilier × circuit</span></div>
  <div class="item"><span class="label">Candidat</span><span class="value">${escapeHtml(visiteurInfo.civilite || '—')} ${escapeHtml(visiteurInfo.prenom || '?')} ${escapeHtml(visiteurInfo.nom || '')}</span></div>
  <div class="item"><span class="label">Lignes T3</span><span class="value">${rows.length}</span></div>
  <div class="item"><span class="label">Piliers couverts</span><span class="value">${stats.piliersCouverts.join(' · ')}</span></div>
  <div class="item"><span class="label">Circuits HAUT / MOYEN / INACTIF</span><span class="value">${stats.nbHaut} / ${stats.nbMoyen} / ${stats.nbInactif}</span></div>
  <div class="item"><span class="label">Généré le</span><span class="value">${generationTime}</span></div>
</div>

${sectionsHtml}

<div class="page-footer">
  Profil-Cognitif · Visualisation interne · Tableau T3 v10.5 (Phase HTML-T3-1.0.0) · Généré dynamiquement depuis Airtable
</div>

</body>
</html>`;
}

// ─── HTML d'erreur ───────────────────────────────────────────────────────────

function generateEmptyHtml(candidat_id, visiteurInfo, message) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Tableau T3 — ${escapeHtml(visiteurInfo.prenom || candidat_id)} ${escapeHtml(visiteurInfo.nom || '')} — Profil-Cognitif</title>
<style>${CSS}</style>
</head>
<body>
<div class="page-header">
  <div class="logo-block">
    <h1><span class="pc-blue">PROFIL</span> <span class="pc-pink">COGNITIF</span></h1>
  </div>
  <div class="candidat-block">
    <div class="candidat-prenom">${escapeHtml(visiteurInfo.prenom || '?')} ${escapeHtml(visiteurInfo.nom || '')}</div>
    <div class="candidat-id">${escapeHtml(candidat_id)}</div>
  </div>
</div>
<div class="t3-banner">
  <span class="t3-tag">T3</span>
  <span class="t3-title">Analyse pilier × circuit</span>
</div>
<div style="background:#fff8e0;border:1px solid #c8a020;padding:30px;border-radius:4px;text-align:center;color:#6a5010;">
  <h2 style="margin-bottom:10px;">Aucune donnée T3 à afficher</h2>
  <p>${escapeHtml(message)}</p>
</div>
</body>
</html>`;
}

// ─── Statistiques globales ──────────────────────────────────────────────────

function computeStats(rows, grouped) {
  const piliersCouverts = ['P1', 'P2', 'P3', 'P4', 'P5'].filter(p => (grouped[p] || []).length > 0);
  let nbHaut = 0, nbMoyen = 0, nbInactif = 0;
  for (const r of rows) {
    const niv = String(r.niveau_activation || '').toUpperCase();
    if (niv === 'HAUT')    nbHaut++;
    else if (niv === 'MOYEN')   nbMoyen++;
    else if (niv === 'INACTIF') nbInactif++;
  }
  return { piliersCouverts, nbHaut, nbMoyen, nbInactif };
}

module.exports = {
  generateTableauT3Html
};
