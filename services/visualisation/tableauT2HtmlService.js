// services/visualisation/tableauT2HtmlService.js
// Service de génération HTML — Tableau T2 candidat — Visualisation interne
// Profil-Cognitif v10.5 (Phase HTML-T2-1.0.0)
//
// PHASE HTML-T2-1.0.0 (06/05/2026 — création initiale) :
//
//   Objectif : Reproduire le même pattern de visualisation que T1 (Phase HTML-1.4.1)
//   pour la table ETAPE1_T2 produite par l'agent T2 v3.4.
//
//   Structure de la sortie T2 v3.4 (cf. prompt etape1_t2.txt v3.4) :
//
//   1. SYNTHÈSE candidat — 8 champs IDENTIQUES sur les 25 lignes :
//      - hypothese_pilier_dominant_ecart (P1-P5 ou null)
//      - confiance_socle_par_ecart (HAUTE/MOYENNE/FAIBLE)
//      - pourcentage_concentration_ecart (entier 0-100)
//      - flag_profil_quasi_conforme (boolean)
//      - directive_t3 (lecture_normale / lecture_par_concentration_circuits)
//      - pattern_finalite_pressenti (texte libre — phrase courte)
//      - nb_conformes_total (entier 0-25)
//      - nb_ecart_total (entier 0-25)
//
//   2. 25 LIGNES — 1 ligne par question × candidat, contenant :
//      - candidat_id, id_question, question_id_protocole, scenario
//      - pilier_demande, pilier_coeur (recopiés de T1)
//      - conforme_ecart (CONFORME / ÉCART)
//      - sequence_piliers (recopiée de T1, format "p1 + P3 + p5  Conforme")
//      - analyse_note (rempli si CONFORME, vide si ÉCART)
//      - analyse_ecart_action (rempli si ÉCART, vide si CONFORME)
//      - signal_limbique_detecte (OUI/NON)
//      - signal_limbique_detail (verbatim si OUI, vide si NON)
//      - signal_transversal_candidat (texte transversal — INVARIANT par candidat)
//      - stat_pattern_pilier (statistiques avec flèches — INVARIANT par candidat)
//      - type_contenu (BRUT si CONFORME / ANALYSE si ÉCART)
//
//   Mise en page choisie : option "bloc synthèse héros en haut" (Décision CTO 06/05) :
//
//   - HEADER NOIR (PROFIL COGNITIF + nom candidat) — strictement identique à T1
//   - META-BAR (stats globales) — identique à T1 mais info adaptée T2
//   - BANNIÈRE "T2" en accent cyan pour distinguer visuellement de T1
//   - BLOC SYNTHÈSE HÉROS — 8 champs en cartes avec :
//       * hypothese_pilier_dominant_ecart : badge pilier large (ou "—" si null)
//       * confiance_socle_par_ecart : pastille H/M/F colorée
//       * pourcentage_concentration_ecart : nombre large + barre de progression
//       * flag_profil_quasi_conforme : pastille TRUE/FALSE colorée
//       * directive_t3 : badge cyan/orange selon la valeur
//       * pattern_finalite_pressenti : citation longue mise en avant
//       * nb_conformes_total / nb_ecart_total : compteurs
//   - SIGNAL TRANSVERSAL CANDIDAT (texte transversal, identique sur 25 lignes)
//   - STAT PATTERN PILIER (statistiques mécaniques, identiques sur 25 lignes)
//   - TABLEAU 25 LIGNES — colonnes adaptées à T2 :
//       ID · Scénario · Demande · Cœur · Conforme/Écart · Séquence ·
//       Analyse (note OU ecart_action) · Signal limbique · Type
//   - FOOTER — identique à T1
//
//   Fonctions utilitaires identiques à T1 :
//     escapeHtml, nl2br, pilierBadge, ouiNonBadge, conformeBadge
//
//   Compatibilité doctrinale :
//   - Décision n°4 : la frontière de gouvernance est respectée — la civilité
//     du candidat est lue depuis VISITEUR (pas un payload T2), uniquement pour
//     l'affichage HTML interne.
//   - Décision n°27 : les visualisations sont placées dans services/visualisation/
//
'use strict';

const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

// ─── CSS COMPLET (intégré, pas de fichier externe) ───────────────────────────
// Aligné sur tableauT1HtmlService v10.6 (Phase HTML-1.4.1) avec ajouts T2 :
// - Bannière .t2-banner (cyan, distinctive)
// - Bloc .synthese-hero (cartes des 8 champs)
// - Bloc .signal-transversal et .stat-pattern (textes invariants candidat)
// - Tableau T2 : 9 colonnes (vs 14 pour T1)
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=IBM+Plex+Sans:wght@300;400;500;600&display=swap');

:root {
  --bg:#f5f4f0; --s1:#ffffff; --s2:#f0ede8; --s3:#e8e4de;
  --border:#d4cfc8; --border2:#c0b8b0;
  --text:#1a1814; --mid:#4a4540; --dim:#8a857e;
  --acc:#1a3a6b; --acc2:#1a5a48;
  --p1:#1a5fa0; --p2:#1a7a60; --p3:#6a2a9a; --p4:#8a5a10; --p5:#8a2a10;
  --oui:#1a6a38; --non:#8a2a10;
  --def-bg:#eae8f5; --def-border:#b0a8d8;
  --row-bg:#fffdf5;
  /* Couleurs Profil-Cognitif (logo) */
  --pc-blue:#3a5fb0; --pc-pink:#e91e63; --pc-cyan:#5ac8fa; --pc-yellow:#ffcc00;
  /* T2 — palette distinctive (cyan dominant) */
  --t2-accent:#1a7a8a; --t2-bg:#e8f4f6; --t2-border:#90c8d0;
  --t2-hero-bg:#f6fbfc; --t2-hero-border:#b0d8e0;
  /* Badges confiance */
  --conf-haute:#1a6a38; --conf-moyenne:#8a5a10; --conf-faible:#8a2a10;
}

* { box-sizing:border-box; margin:0; padding:0; }
body {
  background:var(--bg); color:var(--text);
  font-family:'IBM Plex Sans',sans-serif; font-size:12px; line-height:1.5; padding:24px;
}

/* ─── HEADER (logo + identité candidat) — IDENTIQUE T1 ──────────────────── */
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

/* ─── BANNIÈRE T2 distinctive (cyan) ─────────────────────────────────────── */
.t2-banner {
  background:linear-gradient(90deg, var(--t2-accent) 0%, var(--pc-cyan) 100%);
  color:#fff;
  padding:12px 18px;
  border-radius:4px;
  margin-bottom:18px;
  display:flex; align-items:center; gap:14px;
  box-shadow:0 2px 6px rgba(26,122,138,.18);
}
.t2-banner .t2-tag {
  background:#000; color:#fff;
  font-family:'IBM Plex Mono',monospace;
  font-size:14px; font-weight:600;
  padding:4px 12px; border-radius:3px;
  letter-spacing:.08em;
}
.t2-banner .t2-title {
  font-family:'IBM Plex Mono',monospace;
  font-size:12px; font-weight:500;
  letter-spacing:.04em;
}
.t2-banner .t2-subtitle {
  font-size:11px;
  opacity:0.92;
  margin-left:auto;
  font-style:italic;
}

/* ─── INFOS GLOBALES — IDENTIQUE T1 ──────────────────────────────────────── */
.meta-bar {
  background:var(--s1); border:1px solid var(--border); border-radius:4px;
  padding:14px 18px; margin-bottom:20px;
  display:flex; gap:24px; flex-wrap:wrap;
  font-family:'IBM Plex Mono',monospace; font-size:10px;
}
.meta-bar .item { display:flex; flex-direction:column; gap:2px; }
.meta-bar .label { color:var(--dim); text-transform:uppercase; letter-spacing:.04em; font-size:9px; }
.meta-bar .value { color:var(--text); font-weight:600; font-size:11px; }

/* ─── BLOC SYNTHÈSE HÉROS T2 ─────────────────────────────────────────────── */
.synthese-hero {
  background:var(--t2-hero-bg);
  border:1px solid var(--t2-hero-border);
  border-radius:6px;
  padding:18px;
  margin-bottom:20px;
}
.synthese-hero-title {
  font-family:'IBM Plex Mono',monospace;
  font-size:11px; font-weight:600;
  color:var(--t2-accent);
  text-transform:uppercase; letter-spacing:.06em;
  margin-bottom:14px;
  padding-bottom:8px;
  border-bottom:1px solid var(--t2-border);
  display:flex; align-items:center; gap:8px;
}
.synthese-hero-title::before {
  content:'⊙';
  font-size:16px;
  color:var(--t2-accent);
}
.synthese-hero-grid {
  display:grid;
  grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));
  gap:12px;
}
.hero-card {
  background:#fff;
  border:1px solid var(--border);
  border-radius:4px;
  padding:12px 14px;
  display:flex; flex-direction:column; gap:6px;
}
.hero-card.wide {
  grid-column:span 2;
}
.hero-card-label {
  font-family:'IBM Plex Mono',monospace;
  font-size:9px; font-weight:600;
  color:var(--dim);
  text-transform:uppercase; letter-spacing:.05em;
}
.hero-card-value {
  font-family:'IBM Plex Mono',monospace;
  font-size:18px; font-weight:600;
  color:var(--text);
  line-height:1.2;
}
.hero-card-value.text-md {
  font-size:13px;
  font-family:'IBM Plex Sans',sans-serif;
  font-style:italic;
  font-weight:400;
  color:var(--mid);
  line-height:1.5;
}
.hero-card-sub {
  font-size:10px;
  color:var(--dim);
  font-style:italic;
}

/* Pastilles confiance */
.conf-badge {
  display:inline-block;
  font-family:'IBM Plex Mono',monospace;
  font-size:11px; font-weight:700;
  padding:3px 10px; border-radius:3px;
  letter-spacing:.05em;
  color:#fff;
}
.conf-badge.haute   { background:var(--conf-haute); }
.conf-badge.moyenne { background:var(--conf-moyenne); }
.conf-badge.faible  { background:var(--conf-faible); }

/* Pastilles flag boolean */
.flag-badge {
  display:inline-block;
  font-family:'IBM Plex Mono',monospace;
  font-size:11px; font-weight:700;
  padding:3px 10px; border-radius:3px;
  letter-spacing:.05em;
}
.flag-badge.true  { background:#fff0d0; color:#8a5a10; border:1px solid #e0b860; }
.flag-badge.false { background:#e8f0e4; color:#3a6a30; border:1px solid #a0c890; }

/* Badge directive T3 */
.directive-badge {
  display:inline-block;
  font-family:'IBM Plex Mono',monospace;
  font-size:10px; font-weight:600;
  padding:3px 8px; border-radius:3px;
  letter-spacing:.03em;
}
.directive-badge.normale     { background:#e0eef8; color:var(--p1); border:1px solid #a0c8e0; }
.directive-badge.concentration { background:#fbe8d0; color:#8a5000; border:1px solid #e0b070; }

/* Barre de progression % concentration */
.concentration-bar {
  width:100%;
  height:6px;
  background:#e0e0e0;
  border-radius:3px;
  margin-top:4px;
  overflow:hidden;
}
.concentration-bar-fill {
  height:100%;
  background:linear-gradient(90deg, var(--p1) 0%, var(--p3) 100%);
  border-radius:3px;
  transition:width 0.3s;
}

/* Compteurs jumeaux conformes/écarts */
.counter-pair {
  display:flex; gap:12px; align-items:baseline;
}
.counter-pair .counter {
  display:flex; flex-direction:column; align-items:flex-start;
}
.counter-pair .counter-num {
  font-family:'IBM Plex Mono',monospace;
  font-size:20px; font-weight:600;
  line-height:1.1;
}
.counter-pair .counter-label {
  font-family:'IBM Plex Mono',monospace;
  font-size:8px;
  color:var(--dim);
  letter-spacing:.05em;
  text-transform:uppercase;
  margin-top:2px;
}
.counter-pair .counter-num.conf  { color:var(--oui); }
.counter-pair .counter-num.ecart { color:#8a5000; }
.counter-pair .sep {
  color:var(--dim);
  font-size:18px;
  align-self:center;
}

/* ─── BLOC SIGNAL TRANSVERSAL et STAT PATTERN ───────────────────────────── */
.invariant-block {
  background:#fff;
  border:1px solid var(--border);
  border-left:3px solid var(--t2-accent);
  border-radius:3px;
  padding:14px 16px;
  margin-bottom:14px;
}
.invariant-block-label {
  font-family:'IBM Plex Mono',monospace;
  font-size:9px; font-weight:600;
  color:var(--t2-accent);
  text-transform:uppercase; letter-spacing:.06em;
  margin-bottom:8px;
}
.invariant-block-content {
  font-size:11px;
  line-height:1.6;
  color:var(--text);
}
.invariant-block-content.mono {
  font-family:'IBM Plex Mono',monospace;
  font-size:11px;
  line-height:1.7;
}

/* ─── TABLEAU PRINCIPAL T2 ──────────────────────────────────────────────── */
.tbl-wrap {
  overflow-x:auto;
  border:1px solid var(--border); border-radius:4px;
  box-shadow:0 1px 4px rgba(0,0,0,.08);
}
table { width:auto; min-width:1640px; border-collapse:collapse; table-layout:fixed; }

/* Largeurs des colonnes T2 (9 colonnes vs 14 pour T1) */
col.c-id        { width:80px; }
col.c-scen      { width:90px; }
col.c-demande   { width:80px; }
col.c-coeur     { width:80px; }
col.c-conf      { width:110px; }
col.c-seq       { width:170px; }
col.c-analyse   { width:520px; }
col.c-limbique  { width:340px; }
col.c-type      { width:90px; }

/* En-têtes de colonnes RÉPÉTÉS avant chaque question (héritage T1 v1.2.3) */
tr.col-headers-row th {
  background:var(--t2-accent); color:#fff;
  font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:600;
  letter-spacing:.04em; text-transform:uppercase;
  padding:8px 6px; vertical-align:middle;
  border:1px solid #105058;
  text-align:left;
}
tr.col-headers-row th .col-sub {
  display:block; font-size:8px; font-weight:400; color:#a0d0d8;
  margin-top:2px; letter-spacing:.02em; text-transform:none;
}

/* Protection anti-débordement */
table td, table th {
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
}

/* Couleurs piliers pour texte */
.p1c { color:var(--p1); font-weight:600; }
.p2c { color:var(--p2); font-weight:600; }
.p3c { color:var(--p3); font-weight:600; }
.p4c { color:var(--p4); font-weight:600; }
.p5c { color:var(--p5); font-weight:600; }

/* PILIERS — IDENTIQUE T1 */
.pb {
  font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:600;
  padding:1px 6px; border-radius:2px; display:inline-block;
}
.pb1 { background:#ddeeff; color:var(--p1); border:1px solid #a0c8f0; }
.pb2 { background:#ddf5ee; color:var(--p2); border:1px solid #90d8c0; }
.pb3 { background:#f0e0ff; color:var(--p3); border:1px solid #c890e8; }
.pb4 { background:#fff0d0; color:var(--p4); border:1px solid #e0b860; }
.pb5 { background:#ffe8e0; color:var(--p5); border:1px solid #e0a090; }

/* Badge large pour le bloc héros */
.pb-large {
  font-family:'IBM Plex Mono',monospace; font-size:18px; font-weight:700;
  padding:6px 14px; border-radius:4px; display:inline-block;
  letter-spacing:.04em;
}
.pb-large.pb1 { background:#ddeeff; color:var(--p1); border:2px solid var(--p1); }
.pb-large.pb2 { background:#ddf5ee; color:var(--p2); border:2px solid var(--p2); }
.pb-large.pb3 { background:#f0e0ff; color:var(--p3); border:2px solid var(--p3); }
.pb-large.pb4 { background:#fff0d0; color:var(--p4); border:2px solid var(--p4); }
.pb-large.pb5 { background:#ffe8e0; color:var(--p5); border:2px solid var(--p5); }
.pb-large.empty {
  background:#f0eee8; color:var(--dim);
  border:2px dashed var(--border2);
  font-style:italic; font-size:14px;
  font-weight:400;
}

/* OUI/NON — IDENTIQUE T1 */
.v-oui { color:var(--oui); font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:11px; }
.v-non { color:var(--non); font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:11px; }

/* CONFORME / ÉCART — IDENTIQUE T1 */
.conforme { color:var(--oui); font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:10px; }
.ecart    { color:#8a5000; font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:10px; }

/* Type contenu BRUT/ANALYSE */
.type-badge {
  display:inline-block;
  font-family:'IBM Plex Mono',monospace;
  font-size:9px; font-weight:600;
  padding:2px 7px; border-radius:2px;
  letter-spacing:.05em;
}
.type-badge.brut    { background:#e8f0e4; color:#3a6a30; border:1px solid #a0c890; }
.type-badge.analyse { background:#fbe8d0; color:#8a5000; border:1px solid #e0b070; }

/* Question header (1 par question) */
.row-qheader td {
  background:var(--t2-bg); border:1px solid var(--t2-border);
  padding:8px 12px;
}
.qh-title {
  font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:600;
  color:var(--t2-accent);
}
.qh-context {
  font-size:11px; color:var(--mid); margin-top:4px; line-height:1.5;
  font-style:italic;
}

/* Ligne candidat (les données T2) */
.row-data td {
  background:var(--row-bg); border:1px solid var(--border);
  padding:9px 9px; vertical-align:top;
  font-size:11px; color:var(--mid); line-height:1.55;
}
.row-data.is-ecart td {
  border-left:3px solid #d09040;
}

/* Cellule analyse (note ou ecart_action) */
.analyse-cell {
  font-size:11px;
  line-height:1.55;
  color:var(--text);
}
.analyse-cell.note {
  color:var(--text);
}
.analyse-cell.ecart-action {
  color:var(--text);
  font-weight:500;
}
.analyse-empty {
  color:var(--dim);
  font-style:italic;
  font-size:10px;
}

/* Cellule signal limbique */
.limbique-cell {
  display:flex; flex-direction:column; gap:6px;
}
.limbique-detail {
  font-size:10px;
  color:var(--mid);
  font-style:italic;
  line-height:1.5;
  padding:4px 6px;
  background:#fbf9f4;
  border-left:2px solid var(--border2);
}

/* Séquence piliers (recopie T1) */
.sequence-piliers {
  font-family:'IBM Plex Mono',monospace;
  font-size:10px;
  color:var(--mid);
  display:flex; flex-direction:column; gap:4px;
}

/* Ligne séparatrice — IDENTIQUE T1 */
.row-sep td {
  background:transparent; border:none;
  padding:6px 0;
}

/* ID question — IDENTIQUE T1 */
.id-main { font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:600; color:var(--text); }
.id-sub  { font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--dim); margin-top:2px; }

/* Footer — IDENTIQUE T1 */
.page-footer {
  margin-top:30px; padding-top:14px; border-top:1px solid var(--border);
  font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--dim);
  text-align:center;
}

/* Scrollbar — IDENTIQUE T1 */
::-webkit-scrollbar { height:6px; width:6px; }
::-webkit-scrollbar-track { background:var(--bg); }
::-webkit-scrollbar-thumb { background:var(--border2); border-radius:3px; }
`.trim();

// ─── UTILITAIRES (alignés sur tableauT1HtmlService) ──────────────────────────

/**
 * Échappe le HTML pour éviter les injections XSS et préserver l'affichage
 */
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

/**
 * Convertit un texte multiligne en HTML avec <br>
 */
function nl2br(text) {
  return escapeHtml(text).replace(/\n/g, '<br>');
}

/**
 * Badge de pilier coloré (P1-P5) — taille standard
 */
function pilierBadge(pilier) {
  if (!pilier) return '';
  const p = String(pilier).toUpperCase().trim();
  const num = p.replace(/[^1-5]/g, '');
  if (!num) return escapeHtml(pilier);
  return `<span class="pb pb${num}">${escapeHtml(p)}</span>`;
}

/**
 * Badge de pilier LARGE pour le bloc héros (avec gestion du cas null)
 */
function pilierBadgeLarge(pilier) {
  if (!pilier || pilier === 'null') {
    return `<span class="pb-large empty">aucun</span>`;
  }
  const p = String(pilier).toUpperCase().trim();
  const num = p.replace(/[^1-5]/g, '');
  if (!num) return `<span class="pb-large empty">${escapeHtml(pilier)}</span>`;
  return `<span class="pb-large pb${num}">${escapeHtml(p)}</span>`;
}

/**
 * Badge OUI/NON coloré
 */
function ouiNonBadge(value) {
  if (!value) return '<span class="v-non">—</span>';
  const v = String(value).toUpperCase().trim();
  if (v === 'OUI') return '<span class="v-oui">OUI</span>';
  if (v === 'NON') return '<span class="v-non">NON</span>';
  return escapeHtml(value);
}

/**
 * Badge CONFORME/ÉCART — IDENTIQUE T1
 */
function conformeBadge(value) {
  if (!value) return '';
  const v = String(value).toUpperCase().trim();
  if (v === 'CONFORME') return '<span class="conforme">CONFORME</span>';
  if (v === 'ECART' || v === 'ÉCART') return '<span class="ecart">ÉCART</span>';
  return escapeHtml(value);
}

/**
 * Badge type contenu BRUT/ANALYSE
 */
function typeContenuBadge(value) {
  if (!value) return '';
  const v = String(value).toUpperCase().trim();
  if (v === 'BRUT')    return '<span class="type-badge brut">BRUT</span>';
  if (v === 'ANALYSE') return '<span class="type-badge analyse">ANALYSE</span>';
  return escapeHtml(value);
}

/**
 * Badge confiance HAUTE/MOYENNE/FAIBLE
 */
function confianceBadge(value) {
  if (!value) return '<span class="conf-badge faible">—</span>';
  const v = String(value).toUpperCase().trim();
  if (v === 'HAUTE')   return '<span class="conf-badge haute">HAUTE</span>';
  if (v === 'MOYENNE') return '<span class="conf-badge moyenne">MOYENNE</span>';
  if (v === 'FAIBLE')  return '<span class="conf-badge faible">FAIBLE</span>';
  return escapeHtml(value);
}

/**
 * Badge flag boolean true/false
 */
function flagBadge(value) {
  // Détecte true/false sous formes diverses (boolean Airtable, string, undefined)
  if (value === true || String(value).toLowerCase() === 'true') {
    return '<span class="flag-badge true">TRUE — quasi-conforme</span>';
  }
  if (value === false || String(value).toLowerCase() === 'false') {
    return '<span class="flag-badge false">FALSE — pas quasi-conforme</span>';
  }
  return '<span class="flag-badge false">—</span>';
}

/**
 * Badge directive T3
 */
function directiveBadge(value) {
  if (!value) return '<span class="directive-badge normale">—</span>';
  const v = String(value).toLowerCase().trim();
  if (v === 'lecture_normale') {
    return '<span class="directive-badge normale">lecture_normale</span>';
  }
  if (v === 'lecture_par_concentration_circuits') {
    return '<span class="directive-badge concentration">lecture_par_concentration_circuits</span>';
  }
  return `<span class="directive-badge normale">${escapeHtml(value)}</span>`;
}

// ─── EN-TÊTES DE COLONNES — répétés AVANT CHAQUE QUESTION ─────────────────
// (héritage T1 v1.2.3 : "je vais pas remonter à chaque fois" — Isabelle)

const COL_HEADERS_HTML = `<tr class="col-headers-row">
  <th>ID<span class="col-sub">id_question</span></th>
  <th>Scénario<span class="col-sub">scenario</span></th>
  <th>Demande<span class="col-sub">pilier_demande</span></th>
  <th>Cœur<span class="col-sub">pilier_coeur</span></th>
  <th>Conforme/Écart<span class="col-sub">conforme_ecart</span></th>
  <th>Séquence piliers<span class="col-sub">sequence_piliers</span></th>
  <th>Analyse<span class="col-sub">analyse_note (CONFORME) · analyse_ecart_action (ÉCART)</span></th>
  <th>Signal limbique<span class="col-sub">signal_limbique_detecte · signal_limbique_detail</span></th>
  <th>Type<span class="col-sub">type_contenu</span></th>
</tr>`;

// ─── RENDU SPÉCIALISÉ PAR COLONNE ─────────────────────────────────────────

/**
 * Rendu de la cellule analyse (note OU ecart_action)
 * - Si conforme_ecart = CONFORME : afficher analyse_note
 * - Si conforme_ecart = ÉCART    : afficher analyse_ecart_action
 */
function renderAnalyseCell(row) {
  const isEcart = String(row.conforme_ecart || '').toUpperCase().trim().includes('ÉCART') ||
                  String(row.conforme_ecart || '').toUpperCase().trim() === 'ECART';
  const note = row.analyse_note || '';
  const ecartAction = row.analyse_ecart_action || '';

  if (isEcart) {
    if (!ecartAction) {
      return '<span class="analyse-empty">— (champ analyse_ecart_action vide)</span>';
    }
    return `<div class="analyse-cell ecart-action">${nl2br(ecartAction)}</div>`;
  } else {
    if (!note) {
      return '<span class="analyse-empty">— (champ analyse_note vide)</span>';
    }
    return `<div class="analyse-cell note">${nl2br(note)}</div>`;
  }
}

/**
 * Rendu de la cellule signal limbique
 * - Affiche le badge OUI/NON
 * - Si OUI : affiche le détail (verbatim) en italique
 */
function renderSignalLimbiqueCell(row) {
  const detect = row.signal_limbique_detecte || '';
  const detail = row.signal_limbique_detail || '';

  const html = ['<div class="limbique-cell">'];
  html.push(`<div>${ouiNonBadge(detect)}</div>`);
  if (detail) {
    html.push(`<div class="limbique-detail">${nl2br(detail)}</div>`);
  }
  html.push('</div>');
  return html.join('');
}

/**
 * Rendu de la cellule sequence_piliers
 * Format attendu : "p1 + P3 + p5  Conforme" ou "P3  ÉCART"
 * (recopie de T1 par doctrine T2 v3.4)
 */
function renderSequencePiliers(text) {
  if (!text) return '<span class="analyse-empty">—</span>';
  // Affichage simple avec couleurs piliers
  const escaped = escapeHtml(text)
    .replace(/\bP1\b/g, '<span class="p1c">P1</span>')
    .replace(/\bP2\b/g, '<span class="p2c">P2</span>')
    .replace(/\bP3\b/g, '<span class="p3c">P3</span>')
    .replace(/\bP4\b/g, '<span class="p4c">P4</span>')
    .replace(/\bP5\b/g, '<span class="p5c">P5</span>')
    .replace(/\bp1\b/g, '<span class="p1c" style="opacity:0.7;">p1</span>')
    .replace(/\bp2\b/g, '<span class="p2c" style="opacity:0.7;">p2</span>')
    .replace(/\bp3\b/g, '<span class="p3c" style="opacity:0.7;">p3</span>')
    .replace(/\bp4\b/g, '<span class="p4c" style="opacity:0.7;">p4</span>')
    .replace(/\bp5\b/g, '<span class="p5c" style="opacity:0.7;">p5</span>');
  return `<div class="sequence-piliers">${escaped}</div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDU D'UNE LIGNE T2 (1 question)
// ═══════════════════════════════════════════════════════════════════════════

function renderRowT2(row, index) {
  const isEcart = String(row.conforme_ecart || '').toUpperCase().includes('ÉCART') ||
                  String(row.conforme_ecart || '').toUpperCase() === 'ECART';

  const rowClasses = ['row-data'];
  if (isEcart) rowClasses.push('is-ecart');

  const html = [];

  // Répétition des en-têtes AVANT CHAQUE qheader (héritage T1 v1.2.3)
  html.push(COL_HEADERS_HTML);

  // Question header (1 ligne mergée)
  html.push(`
<tr class="row-qheader">
  <td colspan="9">
    <span class="qh-title">Q${index + 1} · ${escapeHtml(row.id_question || '')} · ${escapeHtml(row.scenario || '')} · Pilier demandé : ${escapeHtml(row.pilier_demande || '')}</span>
    <div class="qh-context">
      Question protocolaire : <strong>${escapeHtml(row.question_id_protocole || '—')}</strong>
    </div>
  </td>
</tr>`);

  // Ligne données T2 (9 cellules)
  html.push(`
<tr class="${rowClasses.join(' ')}">
  <td>
    <div class="id-main">Q${index + 1}</div>
    <div class="id-sub">${escapeHtml(row.id_question || '')}</div>
    <div class="id-sub">${escapeHtml(row.question_id_protocole || '')}</div>
  </td>
  <td style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;">${escapeHtml(row.scenario || '')}</td>
  <td>${pilierBadge(row.pilier_demande)}</td>
  <td>${pilierBadge(row.pilier_coeur)}</td>
  <td>${conformeBadge(row.conforme_ecart)}</td>
  <td>${renderSequencePiliers(row.sequence_piliers)}</td>
  <td>${renderAnalyseCell(row)}</td>
  <td>${renderSignalLimbiqueCell(row)}</td>
  <td>${typeContenuBadge(row.type_contenu)}</td>
</tr>`);

  // Séparateur
  html.push(`<tr class="row-sep"><td colspan="9"></td></tr>`);

  return html.join('\n');
}

// ─── BLOC SYNTHÈSE HÉROS ─────────────────────────────────────────────────────

/**
 * Génère le bloc héros qui affiche les 8 champs synthese candidat.
 * Les champs sont extraits de la première ligne des 25 (par doctrine v3.4,
 * ils sont identiques sur les 25 lignes).
 */
function renderSyntheseHero(synthese) {
  const hypothese = synthese.hypothese_pilier_dominant_ecart || null;
  const confiance = synthese.confiance_socle_par_ecart || '';
  const concentration = (synthese.pourcentage_concentration_ecart === null ||
                         synthese.pourcentage_concentration_ecart === undefined)
                        ? null
                        : Number(synthese.pourcentage_concentration_ecart);
  const flagQuasi = synthese.flag_profil_quasi_conforme;
  const directive = synthese.directive_t3 || '';
  const pattern = synthese.pattern_finalite_pressenti || '';
  const nbConformes = (synthese.nb_conformes_total === null || synthese.nb_conformes_total === undefined)
                      ? '?' : Number(synthese.nb_conformes_total);
  const nbEcart = (synthese.nb_ecart_total === null || synthese.nb_ecart_total === undefined)
                  ? '?' : Number(synthese.nb_ecart_total);

  return `
<div class="synthese-hero">
  <div class="synthese-hero-title">Synthèse candidat · résultats T2</div>
  <div class="synthese-hero-grid">
    <div class="hero-card">
      <div class="hero-card-label">Pilier dominant en ÉCART</div>
      <div>${pilierBadgeLarge(hypothese)}</div>
      <div class="hero-card-sub">hypothese_pilier_dominant_ecart · à confirmer comme socle en Étape 4</div>
    </div>
    <div class="hero-card">
      <div class="hero-card-label">Confiance socle</div>
      <div class="hero-card-value">${confianceBadge(confiance)}</div>
      <div class="hero-card-sub">confiance_socle_par_ecart</div>
    </div>
    <div class="hero-card">
      <div class="hero-card-label">Concentration ÉCART</div>
      <div class="hero-card-value">${concentration === null ? '—' : concentration + '%'}</div>
      ${concentration === null
        ? '<div class="hero-card-sub">pourcentage_concentration_ecart</div>'
        : `<div class="concentration-bar"><div class="concentration-bar-fill" style="width:${Math.min(100, Math.max(0, concentration))}%;"></div></div>
           <div class="hero-card-sub">pourcentage_concentration_ecart</div>`}
    </div>
    <div class="hero-card">
      <div class="hero-card-label">Profil quasi-conforme ?</div>
      <div>${flagBadge(flagQuasi)}</div>
      <div class="hero-card-sub">flag_profil_quasi_conforme</div>
    </div>
    <div class="hero-card">
      <div class="hero-card-label">Directive T3</div>
      <div>${directiveBadge(directive)}</div>
      <div class="hero-card-sub">directive_t3</div>
    </div>
    <div class="hero-card">
      <div class="hero-card-label">Comptage</div>
      <div class="counter-pair">
        <div class="counter">
          <span class="counter-num conf">${nbConformes}</span>
          <span class="counter-label">conformes</span>
        </div>
        <span class="sep">/</span>
        <div class="counter">
          <span class="counter-num ecart">${nbEcart}</span>
          <span class="counter-label">écarts</span>
        </div>
      </div>
      <div class="hero-card-sub">nb_conformes_total · nb_ecart_total</div>
    </div>
    <div class="hero-card wide">
      <div class="hero-card-label">Pattern de finalité pressenti</div>
      <div class="hero-card-value text-md">${pattern ? '« ' + escapeHtml(pattern) + ' »' : '<span style="color:var(--dim);font-style:italic;">— (champ vide)</span>'}</div>
      <div class="hero-card-sub">pattern_finalite_pressenti · invariant candidat</div>
    </div>
  </div>
</div>`;
}

// ─── GÉNÉRATION HTML COMPLÈTE ───────────────────────────────────────────────

/**
 * Génère le HTML complet du tableau T2 d'un candidat
 * @param {string} candidat_id
 * @returns {Promise<string>} HTML complet (string)
 */
async function generateTableauT2Html(candidat_id) {
  logger.info('Génération HTML Tableau T2', { candidat_id });

  // 1. Lire les infos VISITEUR (prénom + nom + civilité) — affichage interne v10.6
  let visiteurInfo = { prenom: '?', nom: '?', civilite: '?', candidate_ID: candidat_id };
  try {
    visiteurInfo = await airtableService.getVisiteurInfoForVisualisation(candidat_id);
  } catch (e) {
    logger.warn('Impossible de lire VISITEUR pour visualisation T2', { candidat_id, error: e.message });
  }

  // 2. Lire les 25 lignes ETAPE1_T2
  const rows = await airtableService.getEtape1T2(candidat_id);
  if (!rows || rows.length === 0) {
    return generateEmptyHtml(candidat_id, visiteurInfo, 'Aucune ligne T2 trouvée pour ce candidat. T2 a-t-il bien été exécuté ?');
  }

  // 3. Trier par scenario canonique puis id_question
  rows.sort((a, b) => {
    const scenarioOrder = { 'SOMMEIL':1, 'WEEKEND':2, 'ANIMAL_1':3, 'ANIMAL_2':4, 'ANIMAL':3, 'PANNE':5 };
    const sa = scenarioOrder[String(a.scenario || '').toUpperCase()] || 99;
    const sb = scenarioOrder[String(b.scenario || '').toUpperCase()] || 99;
    if (sa !== sb) return sa - sb;
    return String(a.id_question || '').localeCompare(String(b.id_question || ''));
  });

  // 4. Extraire la synthèse depuis la première ligne (par doctrine v3.4 : identique sur les 25)
  const firstRow = rows[0];
  const synthese = {
    hypothese_pilier_dominant_ecart:    firstRow.hypothese_pilier_dominant_ecart,
    confiance_socle_par_ecart:          firstRow.confiance_socle_par_ecart,
    pourcentage_concentration_ecart:    firstRow.pourcentage_concentration_ecart,
    flag_profil_quasi_conforme:         firstRow.flag_profil_quasi_conforme,
    directive_t3:                       firstRow.directive_t3,
    pattern_finalite_pressenti:         firstRow.pattern_finalite_pressenti,
    nb_conformes_total:                 firstRow.nb_conformes_total,
    nb_ecart_total:                     firstRow.nb_ecart_total
  };

  // 5. Extraire les champs invariants candidat depuis la première ligne
  const signalTransversal = firstRow.signal_transversal_candidat || '';
  const statPattern = firstRow.stat_pattern_pilier || '';

  // 6. Statistiques globales
  const stats = computeStats(rows);

  // 7. Construire le HTML
  const rowsHtml = rows.map((r, i) => renderRowT2(r, i)).join('\n');
  const generationTime = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Tableau T2 — ${escapeHtml(visiteurInfo.prenom)} ${escapeHtml(visiteurInfo.nom || '')} — Profil-Cognitif</title>
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

<div class="t2-banner">
  <span class="t2-tag">T2</span>
  <span class="t2-title">Lecture transversale · Conforme/Écart + Hypothèse pilier dominant + Pattern de finalité inconsciente</span>
  <span class="t2-subtitle">Étape 1 · Tableau 2</span>
</div>

<div class="meta-bar">
  <div class="item"><span class="label">Tableau</span><span class="value">T2 — Lecture transversale (25 lignes)</span></div>
  <div class="item"><span class="label">Candidat</span><span class="value">${escapeHtml(visiteurInfo.civilite || '—')} ${escapeHtml(visiteurInfo.prenom || '?')} ${escapeHtml(visiteurInfo.nom || '')}</span></div>
  <div class="item"><span class="label">Scénarios</span><span class="value">${stats.scenarios.join(' · ')}</span></div>
  <div class="item"><span class="label">Lignes T2</span><span class="value">${rows.length}</span></div>
  <div class="item"><span class="label">CONFORME / ÉCART</span><span class="value">${stats.nbConforme} / ${stats.nbEcart}</span></div>
  <div class="item"><span class="label">Signaux limbiques</span><span class="value">${stats.nbSignal} sur ${rows.length}</span></div>
  <div class="item"><span class="label">Généré le</span><span class="value">${generationTime}</span></div>
</div>

${renderSyntheseHero(synthese)}

${signalTransversal ? `
<div class="invariant-block">
  <div class="invariant-block-label">⊕ Signal transversal candidat — invariant sur les 25 lignes</div>
  <div class="invariant-block-content">${nl2br(signalTransversal)}</div>
</div>` : ''}

${statPattern ? `
<div class="invariant-block">
  <div class="invariant-block-label">∑ Stat pattern pilier — calcul mécanique invariant</div>
  <div class="invariant-block-content mono">${nl2br(statPattern)}</div>
</div>` : ''}

<div class="tbl-wrap">
<table>
<colgroup>
  <col class="c-id"><col class="c-scen"><col class="c-demande">
  <col class="c-coeur"><col class="c-conf"><col class="c-seq">
  <col class="c-analyse"><col class="c-limbique"><col class="c-type">
</colgroup>
${rowsHtml}
</table>
</div>

<div class="page-footer">
  Profil-Cognitif · Visualisation interne · Tableau T2 v10.5 (Phase HTML-T2-1.0.0) · Généré dynamiquement depuis Airtable
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
<title>Tableau T2 — ${escapeHtml(visiteurInfo.prenom || candidat_id)} ${escapeHtml(visiteurInfo.nom || '')} — Profil-Cognitif</title>
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
<div class="t2-banner">
  <span class="t2-tag">T2</span>
  <span class="t2-title">Lecture transversale</span>
</div>
<div style="background:#fff8e0;border:1px solid #c8a020;padding:30px;border-radius:4px;text-align:center;color:#6a5010;">
  <h2 style="margin-bottom:10px;">Aucune donnée T2 à afficher</h2>
  <p>${escapeHtml(message)}</p>
</div>
</body>
</html>`;
}

// ─── Statistiques globales ──────────────────────────────────────────────────

function computeStats(rows) {
  const scenarios = [...new Set(rows.map(r => String(r.scenario || '').toUpperCase()).filter(Boolean))];
  let nbConforme = 0;
  let nbEcart = 0;
  let nbSignal = 0;
  for (const r of rows) {
    const ce = String(r.conforme_ecart || '').toUpperCase();
    if (ce === 'CONFORME') nbConforme++;
    else if (ce === 'ÉCART' || ce === 'ECART') nbEcart++;
    if (String(r.signal_limbique_detecte || '').toUpperCase() === 'OUI') nbSignal++;
  }
  return { scenarios, nbConforme, nbEcart, nbSignal };
}

module.exports = {
  generateTableauT2Html
};
