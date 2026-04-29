// services/visualisation/tableauT1HtmlService.js
// Service de génération HTML — Tableau T1 candidat — Visualisation interne
// Profil-Cognitif v10.2 (Phase HTML-1.2.1)
//
// PHASE HTML-1.2.1 (29/04 fin de soirée) — Fix affichage verbes_angles_piliers :
//   - "la flèche touche quasi la bordure donc tout le texte restant est sur 2 lettres" (Isabelle)
//   - Cause : flexbox horizontal trop serré pour la colonne 150px
//   - Fix 1 : élargir colonne c-angles 150 → 180px
//   - Fix 2 : empiler verbe (en haut) / action (en dessous indentée) au lieu de côte-à-côte
//   - Le rendu devient :
//       regarder
//         → consulter des sources internet (P1)
//   - Au lieu de :
//       regarder | → consulter des sources internet (P1)  [tronqué]
//
// PHASE HTML-1.2 (2026-04-29 fin de journée) — Rendu adaptatif par colonne :
//   ⭐ Décomposition des cellules composites en mini-blocs séparés visuellement.
//   Inspiré du template historique tableau1_<candidat>_v3.html.
//
//   Stratégie défensive : tente le parsing du format attendu, fallback en cas
//   de format inattendu. Aucune cassure visuelle même si l'agent T1 produit
//   un format imprévu.
//
//   Fonctions de rendu spécialisées par colonne :
//   - renderVerbesObserves()    : 1 verbe par ligne
//   - renderVerbesAngles()      : 2 colonnes (verbe / action+pilier)
//   - renderPilierCoeur()       : badge pilier + description
//   - renderPiliersSecondaires(): blocs séparés par pilier
//   - renderTypesVerbatim()     : blocs .tl avec label coloré + citation
//   - renderAttribution()       : badges majuscule (cœur) / minuscule (sec)
//   - renderCorrections()       : déjà fait — bloc verif distinct
//
//   Constat doctrinal : la qualité de l'affichage dépend du format de sortie
//   de l'agent T1. Si l'agent produit un format structuré, le HTML montre
//   des blocs séparés. Sinon, fallback en paragraphe simple.
//   → Le HTML devient un outil d'audit du prompt T1 (Phase v10.2g future :
//     durcir le prompt T1 v3.1 → v3.2 selon les résultats observés).
//
// PHASE HTML-1.1 (29/04 fin de journée) — corrections après 1er test :
//   - Ajout d'une ligne d'en-têtes <thead> (sticky)
//   - Élargissement colonne pilier_coeur_analyse : 55px → 200px
//   - Protection anti-débordement globale
//   - Ajustement largeurs des autres colonnes
//
// PHASE HTML-1 (2026-04-29) — v10.2 :
//   - Création initiale du service
//   - Adapté à la doctrine v10.2 (5 agents T1 distincts)
//   - Affiche corrections_verificateur + nb_corrections_verificateur (Décision n°38)
//   - CSS différencié pour le bloc vérificateur (info technique secondaire)

'use strict';

const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

// ─── CSS COMPLET (intégré, pas de fichier externe) ───────────────────────────
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
  /* Vérificateur (CSS DIFFÉRENCIÉ — secondaire/technique) */
  --verif-bg:#f8f6f0; --verif-border:#c8b890; --verif-text:#6a5810;
  --verif-grave:#8a2a10; --verif-moyenne:#8a5a10; --verif-mineure:#4a6a8a;
}

* { box-sizing:border-box; margin:0; padding:0; }
body {
  background:var(--bg); color:var(--text);
  font-family:'IBM Plex Sans',sans-serif; font-size:12px; line-height:1.5; padding:24px;
}

/* ─── HEADER (logo + identité candidat) ────────────────────────────────── */
.page-header {
  background:#000; color:#fff;
  padding:16px 24px; margin:-24px -24px 24px -24px;
  display:flex; align-items:center; gap:20px;
  border-bottom:3px solid var(--pc-pink);
}
.page-header .logo-block {
  display:flex; align-items:center; gap:14px;
}
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
.page-header .candidat-prenom {
  font-size:18px; font-weight:600; color:#fff;
}
.page-header .candidat-id {
  font-size:10px; color:#aaa; margin-top:2px;
}

/* ─── INFOS GLOBALES ───────────────────────────────────────────────────── */
.meta-bar {
  background:var(--s1); border:1px solid var(--border); border-radius:4px;
  padding:14px 18px; margin-bottom:20px;
  display:flex; gap:24px; flex-wrap:wrap;
  font-family:'IBM Plex Mono',monospace; font-size:10px;
}
.meta-bar .item { display:flex; flex-direction:column; gap:2px; }
.meta-bar .label { color:var(--dim); text-transform:uppercase; letter-spacing:.04em; font-size:9px; }
.meta-bar .value { color:var(--text); font-weight:600; font-size:11px; }

/* ─── TABLEAU PRINCIPAL ────────────────────────────────────────────────── */
.tbl-wrap {
  overflow-x:auto;
  border:1px solid var(--border); border-radius:4px;
  box-shadow:0 1px 4px rgba(0,0,0,.08);
}
table { width:100%; border-collapse:collapse; table-layout:fixed; }

/* Largeurs des colonnes — v1.1 (29/04 17h) : pilier_coeur élargi 55→200px car contient analyse riche */
col.c-id      { width:72px; }
col.c-scen    { width:80px; }
col.c-pilq    { width:50px; }
col.c-v1      { width:42px; }
col.c-v2      { width:42px; }
col.c-verbatim{ width:220px; }
col.c-verbes  { width:110px; }
col.c-angles  { width:180px; }
col.c-coeur   { width:200px; }
col.c-sec     { width:140px; }
col.c-types   { width:220px; }
col.c-fin     { width:130px; }
col.c-attrib  { width:120px; }
col.c-conf    { width:90px; }

/* ⭐ v1.1 — Ligne d'en-têtes (thead, sticky) */
thead.col-headers th {
  background:#1a3a6b; color:#fff;
  font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:600;
  letter-spacing:.04em; text-transform:uppercase;
  padding:8px 6px; vertical-align:middle;
  border:1px solid #0a1a4b;
  position:sticky; top:0; z-index:10;
  text-align:left;
}
thead.col-headers th .col-sub {
  display:block; font-size:8px; font-weight:400; color:#a0c0e0;
  margin-top:2px; letter-spacing:.02em; text-transform:none;
}

/* ⭐ v1.2 — Protection anti-débordement sur TOUTES les cellules */
table td, table th {
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
}

/* ⭐ v1.2 — Couleurs piliers pour texte */
.p1c { color:var(--p1); font-weight:600; }
.p2c { color:var(--p2); font-weight:600; }
.p3c { color:var(--p3); font-weight:600; }
.p4c { color:var(--p4); font-weight:600; }
.p5c { color:var(--p5); font-weight:600; }

/* ⭐ v1.2 — Blocs Type Verbatim (.tl) — 1 bloc par type avec label + citation */
.tl {
  margin-bottom:7px;
  padding-bottom:7px;
  border-bottom:1px solid var(--border);
}
.tl:last-child {
  margin-bottom:0;
  padding-bottom:0;
  border-bottom:none;
}
.tl-label {
  font-family:'IBM Plex Mono',monospace;
  font-size:10px;
  font-weight:600;
  display:block;
  margin-bottom:3px;
}
.tl-demo {
  font-style:italic;
  font-size:10px;
  color:var(--dim);
  line-height:1.5;
  display:block;
}

/* ⭐ v1.2 — Action verbale (verbe / geste) — empilage vertical pour cellules étroites */
.av-line {
  font-size:10px;
  margin-bottom:7px;
  padding-bottom:6px;
  border-bottom:1px dotted var(--border);
  line-height:1.5;
}
.av-line:last-child {
  margin-bottom:0;
  padding-bottom:0;
  border-bottom:none;
}
.av-verb {
  font-family:'IBM Plex Mono',monospace;
  font-weight:600;
  color:var(--text);
  display:block;
  margin-bottom:2px;
}
.av-geste {
  color:var(--mid);
  display:block;
  padding-left:8px;
}

/* ⭐ v1.2 — Liste verbes simples (1 par ligne) */
.verbes-list {
  font-family:'IBM Plex Mono',monospace;
  font-size:10px;
  line-height:1.8;
  color:var(--mid);
}

/* ⭐ v1.2 — Bloc pilier (badge en haut + description en dessous) */
.pilier-block {
  margin-bottom:6px;
  padding-bottom:6px;
  border-bottom:1px solid var(--border);
}
.pilier-block:last-child {
  margin-bottom:0;
  padding-bottom:0;
  border-bottom:none;
}
.pilier-block-label {
  display:block;
  margin-bottom:4px;
}
.pilier-block-desc {
  font-size:10px;
  color:var(--mid);
  line-height:1.5;
  display:block;
}

/* ⭐ v1.2 — Verbatim (citation candidat) */
.verbatim {
  font-family:'IBM Plex Sans',sans-serif;
  font-size:11px;
  line-height:1.5;
  color:var(--text);
  font-style:italic;
  padding:4px 6px;
  background:#fbf9f4;
  border-left:2px solid var(--border2);
}

/* ⭐ v1.2 — Attribution piliers (badges + statut) */
.attribution-line {
  font-family:'IBM Plex Mono',monospace;
  font-size:10px;
  display:flex;
  flex-wrap:wrap;
  gap:3px;
  align-items:center;
  margin-bottom:4px;
}
.attribution-status {
  font-family:'IBM Plex Mono',monospace;
  font-size:10px;
  font-weight:700;
  margin-top:4px;
  display:block;
}

/* Question header (1 par question, 14 colonnes mergées) */
.row-qheader td {
  background:#e8eef8; border:1px solid #b0c0d8;
  padding:8px 12px;
}
.qh-title {
  font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:600;
  color:var(--acc);
}
.qh-context {
  font-size:11px; color:var(--mid); margin-top:5px; line-height:1.5;
  font-style:italic;
}
.qh-context strong { font-style:normal; color:var(--text); font-weight:600; }

/* Ligne candidat (les données T1) */
.row-data td {
  background:var(--row-bg); border:1px solid var(--border);
  padding:9px 9px; vertical-align:top;
  font-size:11px; color:var(--mid); line-height:1.55;
}
.row-data.has-corrections td {
  border-left:3px solid var(--verif-moyenne);
}
.row-data.has-grave td {
  border-left:3px solid var(--verif-grave);
}

/* Bloc vérificateur (sous la ligne, CSS DIFFÉRENCIÉ — secondaire) */
.row-verif td {
  background:var(--verif-bg);
  border:1px dashed var(--verif-border);
  border-top:none;
  padding:8px 12px;
  font-family:'IBM Plex Mono',monospace; font-size:10px; line-height:1.6;
  color:var(--verif-text);
}
.verif-header {
  font-weight:600; color:var(--verif-grave); margin-bottom:4px;
  text-transform:uppercase; letter-spacing:.05em; font-size:9px;
}
.verif-content { color:var(--mid); white-space:pre-wrap; font-size:10px; }
.verif-tag {
  display:inline-block; padding:1px 6px; border-radius:2px;
  font-weight:600; font-size:9px; margin-right:4px;
  background:#fff; border:1px solid var(--verif-border);
}
.verif-tag.grave   { color:var(--verif-grave);   border-color:var(--verif-grave); }
.verif-tag.moyenne { color:var(--verif-moyenne); border-color:var(--verif-moyenne); }
.verif-tag.mineure { color:var(--verif-mineure); border-color:var(--verif-mineure); }

/* Ligne séparatrice entre questions */
.row-sep td {
  background:transparent; border:none;
  padding:6px 0;
}

/* ─── PILIERS ──────────────────────────────────────────────────────────── */
.pb {
  font-family:'IBM Plex Mono',monospace; font-size:10px; font-weight:600;
  padding:1px 6px; border-radius:2px; display:inline-block;
}
.pb1 { background:#ddeeff; color:var(--p1); border:1px solid #a0c8f0; }
.pb2 { background:#ddf5ee; color:var(--p2); border:1px solid #90d8c0; }
.pb3 { background:#f0e0ff; color:var(--p3); border:1px solid #c890e8; }
.pb4 { background:#fff0d0; color:var(--p4); border:1px solid #e0b860; }
.pb5 { background:#ffe8e0; color:var(--p5); border:1px solid #e0a090; }

/* OUI/NON */
.v-oui { color:var(--oui); font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:11px; }
.v-non { color:var(--non); font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:11px; }

/* CONFORME / ÉCART */
.conforme { color:var(--oui); font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:10px; }
.ecart    { color:#8a5000; font-family:'IBM Plex Mono',monospace; font-weight:700; font-size:10px; }

/* ID question */
.id-main { font-family:'IBM Plex Mono',monospace; font-size:11px; font-weight:600; color:var(--text); }
.id-sub  { font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--dim); margin-top:2px; }

/* Footer */
.page-footer {
  margin-top:30px; padding-top:14px; border-top:1px solid var(--border);
  font-family:'IBM Plex Mono',monospace; font-size:10px; color:var(--dim);
  text-align:center;
}

/* Scrollbar */
::-webkit-scrollbar { height:6px; width:6px; }
::-webkit-scrollbar-track { background:var(--bg); }
::-webkit-scrollbar-thumb { background:var(--border2); border-radius:3px; }
`.trim();

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────

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
 * Badge de pilier coloré (P1-P5)
 */
function pilierBadge(pilier) {
  if (!pilier) return '';
  const p = String(pilier).toUpperCase().trim();
  const num = p.replace(/[^1-5]/g, '');
  if (!num) return escapeHtml(pilier);
  return `<span class="pb pb${num}">${escapeHtml(p)}</span>`;
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
 * Badge CONFORME/ÉCART
 */
function conformeBadge(value) {
  if (!value) return '';
  const v = String(value).toUpperCase().trim();
  if (v === 'CONFORME') return '<span class="conforme">CONFORME</span>';
  if (v === 'ECART' || v === 'ÉCART') return '<span class="ecart">ÉCART</span>';
  return escapeHtml(value);
}

/**
 * Formate les corrections du vérificateur (extrait gravité [GRAVE/TYPE] champ:...)
 */
function renderCorrectionsVerificateur(text) {
  if (!text) return '';
  // Format attendu : [GRAVITE/TYPE] champ: "ancienne" → "nouvelle" · raison
  // On peut avoir plusieurs corrections séparées par \n
  return escapeHtml(text)
    .replace(/\[GRAVE\/([^\]]+)\]/g,    '<span class="verif-tag grave">GRAVE/$1</span>')
    .replace(/\[MOYENNE\/([^\]]+)\]/g,  '<span class="verif-tag moyenne">MOYENNE/$1</span>')
    .replace(/\[MINEURE\/([^\]]+)\]/g,  '<span class="verif-tag mineure">MINEURE/$1</span>')
    .replace(/\n/g, '<br>');
}

/**
 * Détermine si la ligne contient une correction GRAVE
 */
function hasGraveCorrection(corrections) {
  if (!corrections) return false;
  return /\[GRAVE\//.test(corrections);
}

// ─── RENDU D'UNE LIGNE T1 (1 question) ───────────────────────────────────────

// ═══════════════════════════════════════════════════════════════════════════
// FONCTIONS DE RENDU SPÉCIALISÉES PAR COLONNE (v1.2)
// ═══════════════════════════════════════════════════════════════════════════
// Stratégie défensive : tente le parsing du format attendu, fallback en cas
// de format inattendu. Aucune cassure visuelle même si l'agent T1 produit
// un format imprévu.

/**
 * Extrait le numéro de pilier depuis une chaîne ("P1", "p2", "P3 · ...", etc.)
 * Retourne 1-5 ou null
 */
function extractPilierNum(text) {
  if (!text) return null;
  const m = String(text).trim().match(/^[Pp]([1-5])\b/);
  return m ? parseInt(m[1], 10) : null;
}

/**
 * Rendu : verbes_observes
 * Format attendu : verbes séparés par virgule, retour ligne, point-virgule
 * Fallback : texte brut avec retours à la ligne
 */
function renderVerbesObserves(text) {
  if (!text) return '<span style="color:var(--dim);font-style:italic;">—</span>';
  // Détection multi-formats : virgule, retour ligne, point-virgule
  const verbes = String(text)
    .split(/[\n,;]+/)
    .map(v => v.trim())
    .filter(v => v.length > 0);
  if (verbes.length === 0) return '<span style="color:var(--dim);">—</span>';
  return `<div class="verbes-list">${verbes.map(v => escapeHtml(v)).join('<br>')}</div>`;
}

/**
 * Rendu : verbes_angles_piliers
 * Format attendu : "verbe → action (Pilier)" sur chaque ligne
 * Fallback : texte brut avec retours à la ligne
 */
function renderVerbesAngles(text) {
  if (!text) return '<span style="color:var(--dim);font-style:italic;">—</span>';
  const lines = String(text).split('\n').map(l => l.trim()).filter(l => l.length > 0);
  if (lines.length === 0) return '<span style="color:var(--dim);">—</span>';

  // Tente de parser chaque ligne au format "verbe → action (P{N})"
  const blocks = [];
  let parseSuccess = 0;
  for (const line of lines) {
    // Pattern : "verbe → action (P1)" ou "verbe -> action (P1)"
    const m = line.match(/^(.+?)\s*(?:→|->)\s*(.+?)(?:\s*\((P[1-5])\))?\s*$/i);
    if (m) {
      parseSuccess++;
      const verbe = m[1].trim();
      const action = m[2].trim();
      const pilier = m[3] ? m[3].toUpperCase() : null;
      const pilierTag = pilier ? ` <strong>(${pilier})</strong>` : '';
      blocks.push(
        `<div class="av-line">` +
        `<span class="av-verb">${escapeHtml(verbe)}</span>` +
        `<span class="av-geste">→ ${escapeHtml(action)}${pilierTag}</span>` +
        `</div>`
      );
    } else {
      // Ligne ne matche pas → fallback ligne simple
      blocks.push(`<div class="av-line"><span class="av-geste">${escapeHtml(line)}</span></div>`);
    }
  }
  // Si parsing a réussi sur >50% des lignes, on garde le rendu structuré
  // Sinon on bascule en fallback complet
  if (parseSuccess === 0) {
    return `<div style="font-size:10px;line-height:1.6;">${nl2br(text)}</div>`;
  }
  return blocks.join('');
}

/**
 * Rendu : pilier_coeur_analyse
 * Format attendu : "P{N} · description longue..."
 * Fallback : texte brut
 */
function renderPilierCoeur(text) {
  if (!text) return '<span style="color:var(--dim);font-style:italic;">—</span>';
  const trimmed = String(text).trim();
  // Tente d'extraire "P{N} · " du début
  const m = trimmed.match(/^[Pp]([1-5])\s*[·•:.\-]\s*(.+)$/s);
  if (m) {
    const pNum = m[1];
    const desc = m[2].trim();
    return `<div class="pilier-block-label">${pilierBadge('P' + pNum)}</div>` +
           `<div class="pilier-block-desc">${escapeHtml(desc)}</div>`;
  }
  // Fallback : tente juste un badge si commence par P{N}
  const pNum = extractPilierNum(trimmed);
  if (pNum) {
    const rest = trimmed.replace(/^[Pp][1-5]\s*[·•:.\-]?\s*/, '');
    return `<div class="pilier-block-label">${pilierBadge('P' + pNum)}</div>` +
           `<div class="pilier-block-desc">${escapeHtml(rest)}</div>`;
  }
  // Aucun format reconnu → texte brut
  return `<div class="pilier-block-desc">${nl2br(text)}</div>`;
}

/**
 * Rendu : piliers_secondaires
 * Format attendu : descriptions par pilier mentionné (P2 ..., P5 ...)
 * Stratégie : split sur "P{N}" en début de phrase pour faire des blocs
 * Fallback : texte brut
 */
function renderPiliersSecondaires(text) {
  if (!text) return '<span style="color:var(--dim);font-style:italic;">—</span>';
  const trimmed = String(text).trim();

  // Tente de splitter sur les mentions "P{N}" en début (phrase ou paragraphe)
  // Pattern : un P{N} qui commence une nouvelle "section"
  const blocks = [];
  // Split sur retour ligne d'abord, puis sur les "P{N}" en début si pas de retour ligne
  let parts = trimmed.split(/\n+/).map(p => p.trim()).filter(p => p.length > 0);

  // Si une seule ligne avec plusieurs P{N}, on tente de splitter intelligemment
  if (parts.length === 1) {
    const single = parts[0];
    // Cherche "P{N}" précédé d'un espace ou point (séparateur de section)
    const splitted = single.split(/(?=\s[Pp][1-5]\s)/);
    if (splitted.length > 1) {
      parts = splitted.map(p => p.trim()).filter(p => p.length > 0);
    }
  }

  let parseSuccess = 0;
  for (const part of parts) {
    const m = part.match(/^[Pp]([1-5])\s+(.+)$/s);
    if (m) {
      parseSuccess++;
      const pNum = m[1];
      const rest = m[2].trim();
      blocks.push(
        `<div class="pilier-block">` +
        `<div class="pilier-block-label">${pilierBadge('P' + pNum)}</div>` +
        `<div class="pilier-block-desc">${escapeHtml(rest)}</div>` +
        `</div>`
      );
    } else {
      blocks.push(`<div class="pilier-block"><div class="pilier-block-desc">${escapeHtml(part)}</div></div>`);
    }
  }

  if (parseSuccess === 0 && blocks.length === 0) {
    return `<div style="font-size:10px;">${nl2br(text)}</div>`;
  }
  return blocks.join('');
}

/**
 * Rendu : types_verbatim
 * Format attendu : multiples blocs "P{N} · titre — citation"
 * Stratégie : split sur les "P{N} ·" même quand tout est sur une seule ligne
 * Fallback : texte brut
 */
function renderTypesVerbatim(text) {
  if (!text) return '<span style="color:var(--dim);font-style:italic;">—</span>';
  const trimmed = String(text).trim();

  // Stratégie de split robuste :
  // - Cherche tous les "P{N} ·" (ou "P{N} -", "P{N}:", "P{N} ·") qu'ils soient
  //   en début de ligne OU précédés d'un guillemet fermant + espace
  //   (transition d'un bloc citation au suivant)
  // - Découpe sur ces marqueurs pour faire des blocs

  // Regex : capture la position de chaque "P{N} [·•:.\-]" qui suit soit :
  //   - un retour ligne / début de chaîne
  //   - un guillemet fermant »"
  //   - un point / fin de citation suivi d'espace(s)
  const splitRegex = /(?:^|\n|(?<=[»"”])\s+|(?<=\.)\s+)(?=[Pp][1-5]\s*[·•:.\-])/g;
  let chunks = trimmed.split(splitRegex).map(c => c.trim()).filter(c => c.length > 0);

  // Si on a trouvé un seul chunk, on tente une stratégie plus permissive :
  // splitter directement sur "P{N} ·" partout dans le texte
  if (chunks.length <= 1) {
    chunks = trimmed.split(/(?=\s[Pp][1-5]\s*[·•:.\-])/g)
                    .map(c => c.trim())
                    .filter(c => c.length > 0);
  }

  // Si toujours rien, fallback
  if (chunks.length === 0) {
    return `<div style="font-size:10px;">${nl2br(text)}</div>`;
  }

  const blocks = [];
  let parseSuccess = 0;

  for (const chunk of chunks) {
    // Pattern attendu :
    //   P{N} · titre court
    //   "citation entre guillemets"
    // (peut être collé ou avec retours à la ligne)
    // Le titre s'arrête au tiret long ENTOURÉ d'espaces, retour ligne, ou guillemet ouvrant
    // (ne pas couper sur les tirets de mots composés type "sous-thèmes")
    const m = chunk.match(/^[Pp]([1-5])\s*[·•:.\-]\s*([^\n«"”]+?)(?:\s+[—–]\s+|\s+\-\s+|\n|\s+(?=[«"“]))(.+)$/s);
    if (m) {
      parseSuccess++;
      const pNum = m[1];
      const titre = m[2].trim();
      const citation = m[3].trim();
      blocks.push(
        `<div class="tl">` +
        `<span class="tl-label p${pNum}c">P${pNum} · ${escapeHtml(titre)}</span>` +
        `<span class="tl-demo">${escapeHtml(citation)}</span>` +
        `</div>`
      );
    } else {
      // Tente extraction P{N} seul + reste
      const m2 = chunk.match(/^[Pp]([1-5])\s*[·•:.\-]?\s*(.+)$/s);
      if (m2) {
        parseSuccess++;
        const pNum = m2[1];
        const rest = m2[2].trim();
        blocks.push(
          `<div class="tl">` +
          `<span class="tl-label p${pNum}c">P${pNum}</span>` +
          `<span class="tl-demo">${escapeHtml(rest)}</span>` +
          `</div>`
        );
      } else {
        // Aucun pattern reconnu → bloc fallback
        blocks.push(`<div class="tl"><span class="tl-demo">${escapeHtml(chunk)}</span></div>`);
      }
    }
  }

  if (parseSuccess === 0) {
    return `<div style="font-size:10px;">${nl2br(text)}</div>`;
  }
  return blocks.join('');
}

/**
 * Rendu : attribution_pilier_signal_brut
 * Format attendu : "p3 + P1 + p5  Conforme" ou "P1 · P3+P5  Conforme"
 * Convention : majuscule = pilier cœur (badge plein), minuscule = pilier secondaire
 * Fallback : texte brut
 */
function renderAttribution(text) {
  if (!text) return '<span style="color:var(--dim);font-style:italic;">—</span>';
  const trimmed = String(text).trim();

  // Tente de séparer la partie piliers et le statut Conforme/Écart
  const statusMatch = trimmed.match(/(.+?)\s+(Conforme|Ecart|Écart|ECART|CONFORME|ÉCART)\s*$/i);
  let pilierPart = trimmed;
  let statut = '';
  if (statusMatch) {
    pilierPart = statusMatch[1].trim();
    statut = statusMatch[2];
  }

  // Extraction des piliers (P1, p2, P3+P5, etc.)
  const tokens = pilierPart.match(/[Pp][1-5]|\+|·|•|\s+/g) || [];
  if (tokens.length === 0) {
    return `<div style="font-family:'IBM Plex Mono',monospace;font-size:10px;">${nl2br(text)}</div>`;
  }

  const badges = [];
  for (const tok of tokens) {
    const trimmedTok = tok.trim();
    if (trimmedTok === '+' || trimmedTok === '·' || trimmedTok === '•') {
      badges.push(`<span style="color:var(--dim);">${trimmedTok}</span>`);
    } else if (/^[Pp][1-5]$/.test(trimmedTok)) {
      const pNum = trimmedTok[1];
      const isCoeur = trimmedTok[0] === 'P'; // majuscule = cœur
      if (isCoeur) {
        badges.push(`<span class="pb pb${pNum}">P${pNum}</span>`);
      } else {
        // minuscule = secondaire (rendu plus discret)
        badges.push(`<span class="pb pb${pNum}" style="opacity:0.65;font-style:italic;">p${pNum}</span>`);
      }
    }
  }

  let statutHtml = '';
  if (statut) {
    const statutUpper = statut.toUpperCase();
    if (statutUpper === 'CONFORME') {
      statutHtml = `<span class="attribution-status conforme">${statut}</span>`;
    } else {
      statutHtml = `<span class="attribution-status ecart">${statut}</span>`;
    }
  }

  return `<div class="attribution-line">${badges.join(' ')}</div>${statutHtml}`;
}

/**
 * Rendu : finalite_reponse
 * Format souvent : description + parfois citation entre guillemets
 * Stratégie : sépare description et citation si guillemets détectés
 */
function renderFinalite(text) {
  if (!text) return '<span style="color:var(--dim);font-style:italic;">—</span>';
  const trimmed = String(text).trim();

  // Tente d'extraire une citation entre guillemets à la fin
  const m = trimmed.match(/^(.+?)[\s—–\-]+([«"][^»"]+[»"].*)$/s);
  if (m) {
    return `<div>${escapeHtml(m[1].trim())}</div>` +
           `<div style="font-style:italic;font-size:10px;color:var(--dim);margin-top:4px;">${escapeHtml(m[2].trim())}</div>`;
  }
  return `<div>${nl2br(text)}</div>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// RENDU D'UNE LIGNE T1 (1 question) — v1.2 avec fonctions spécialisées
// ═══════════════════════════════════════════════════════════════════════════

function renderRowT1(row, index) {
  const corrections = row.corrections_verificateur || '';
  const nbCorr = parseInt(row.nb_corrections_verificateur, 10) || 0;
  const isGrave = hasGraveCorrection(corrections);

  const rowClasses = ['row-data'];
  if (nbCorr > 0) rowClasses.push('has-corrections');
  if (isGrave) rowClasses.push('has-grave');

  const html = [];

  // Question header (1 ligne mergée)
  html.push(`
<tr class="row-qheader">
  <td colspan="14">
    <span class="qh-title">Q${index + 1} · ${escapeHtml(row.id_question || '')} · ${escapeHtml(row.scenario || '')} · Pilier demandé : ${escapeHtml(row.pilier_demande || '')}</span>
    <div class="qh-context">
      <strong>Question :</strong> ${escapeHtml(row.question_texte || '—')}<br>
      <strong>Storytelling :</strong> ${escapeHtml(row.storytelling || '—')}<br>
      <strong>Transition :</strong> ${escapeHtml(row.transition || '—')}
    </div>
  </td>
</tr>`);

  // Ligne données T1 (14 cellules) — v1.2 : rendu adaptatif par colonne
  html.push(`
<tr class="${rowClasses.join(' ')}">
  <td>
    <div class="id-main">Q${index + 1}</div>
    <div class="id-sub">${escapeHtml(row.id_question || '')}</div>
    <div class="id-sub">${escapeHtml(row.question_id_protocole || '')}</div>
  </td>
  <td style="font-family:'IBM Plex Mono',monospace;font-size:10px;font-weight:600;">${escapeHtml(row.scenario || '')}</td>
  <td>${pilierBadge(row.pilier_demande)}</td>
  <td>${ouiNonBadge(row.v1_conforme)}</td>
  <td>${ouiNonBadge(row.v2_traite_problematique)}</td>
  <td><div class="verbatim">${nl2br(row.verbatim_candidat)}</div></td>
  <td>${renderVerbesObserves(row.verbes_observes)}</td>
  <td>${renderVerbesAngles(row.verbes_angles_piliers)}</td>
  <td>${renderPilierCoeur(row.pilier_coeur_analyse)}</td>
  <td>${renderPiliersSecondaires(row.piliers_secondaires)}</td>
  <td>${renderTypesVerbatim(row.types_verbatim)}</td>
  <td>${renderFinalite(row.finalite_reponse)}</td>
  <td>${renderAttribution(row.attribution_pilier_signal_brut)}</td>
  <td>
    ${conformeBadge(row.conforme_ecart)}
    ${row.ecart_detail ? `<div style="font-size:10px;color:var(--dim);margin-top:4px;font-style:italic;">${nl2br(row.ecart_detail)}</div>` : ''}
    ${row.signal_limbique ? `<div style="font-size:10px;color:var(--mid);margin-top:6px;padding-top:4px;border-top:1px dotted var(--border);"><strong style="font-family:'IBM Plex Mono',monospace;font-size:9px;color:var(--dim);">SIGNAL :</strong> ${nl2br(row.signal_limbique)}</div>` : ''}
  </td>
</tr>`);

  // Bloc vérificateur (CSS différencié — affiché seulement si corrections)
  if (nbCorr > 0 && corrections) {
    html.push(`
<tr class="row-verif">
  <td colspan="14">
    <div class="verif-header">⚠ Vérificateur T1 — ${nbCorr} correction${nbCorr > 1 ? 's' : ''} appliquée${nbCorr > 1 ? 's' : ''}</div>
    <div class="verif-content">${renderCorrectionsVerificateur(corrections)}</div>
  </td>
</tr>`);
  }

  // Séparateur
  html.push(`<tr class="row-sep"><td colspan="14"></td></tr>`);

  return html.join('\n');
}

// ─── GÉNÉRATION HTML COMPLÈTE ─────────────────────────────────────────────────

/**
 * Génère le HTML complet du tableau T1 d'un candidat
 * @param {string} candidat_id
 * @returns {Promise<string>} HTML complet (string)
 */
async function generateTableauT1Html(candidat_id) {
  logger.info('Génération HTML Tableau T1', { candidat_id });

  // 1. Lire les infos VISITEUR (prénom + civilité)
  let visiteurInfo = { prenom: '?', civilite: '?', candidate_ID: candidat_id };
  try {
    visiteurInfo = await airtableService.getVisiteurInfoForVisualisation(candidat_id);
  } catch (e) {
    logger.warn('Impossible de lire VISITEUR pour visualisation', { candidat_id, error: e.message });
  }

  // 2. Lire les 25 lignes ETAPE1_T1
  const rows = await airtableService.getEtape1T1(candidat_id);
  if (!rows || rows.length === 0) {
    return generateEmptyHtml(candidat_id, visiteurInfo, 'Aucune ligne T1 trouvée pour ce candidat.');
  }

  // 3. Trier par numero_global ou par id_question protocolaire
  rows.sort((a, b) => {
    // Tri d'abord par scenario dans l'ordre canonique, puis par id_question
    const scenarioOrder = { 'SOMMEIL':1, 'WEEKEND':2, 'ANIMAL_1':3, 'ANIMAL_2':4, 'ANIMAL':3, 'PANNE':5 };
    const sa = scenarioOrder[String(a.scenario || '').toUpperCase()] || 99;
    const sb = scenarioOrder[String(b.scenario || '').toUpperCase()] || 99;
    if (sa !== sb) return sa - sb;
    return String(a.id_question || '').localeCompare(String(b.id_question || ''));
  });

  // 4. Statistiques globales
  const stats = computeStats(rows);

  // 5. Construire le HTML
  const rowsHtml = rows.map((r, i) => renderRowT1(r, i)).join('\n');
  const generationTime = new Date().toISOString();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Tableau T1 — ${escapeHtml(visiteurInfo.prenom)} — Profil-Cognitif</title>
<style>${CSS}</style>
</head>
<body>

<div class="page-header">
  <div class="logo-block">
    <h1><span class="pc-blue">PROFIL</span> <span class="pc-pink">COGNITIF</span></h1>
  </div>
  <div class="candidat-block">
    <div class="candidat-prenom">${escapeHtml(visiteurInfo.prenom)}</div>
    <div class="candidat-id">${escapeHtml(visiteurInfo.candidate_ID)}</div>
  </div>
</div>

<div class="meta-bar">
  <div class="item"><span class="label">Tableau</span><span class="value">T1 — Analyse cognitive (25 questions)</span></div>
  <div class="item"><span class="label">Civilité</span><span class="value">${escapeHtml(visiteurInfo.civilite || '—')}</span></div>
  <div class="item"><span class="label">Scénarios</span><span class="value">${stats.scenarios.join(' · ')}</span></div>
  <div class="item"><span class="label">Lignes</span><span class="value">${rows.length}</span></div>
  <div class="item"><span class="label">Corrections vérificateur</span><span class="value">${stats.totalCorrections} sur ${stats.lignesAvecCorrections} lignes</span></div>
  <div class="item"><span class="label">Généré le</span><span class="value">${generationTime}</span></div>
</div>

<div class="tbl-wrap">
<table>
<colgroup>
  <col class="c-id"><col class="c-scen"><col class="c-pilq">
  <col class="c-v1"><col class="c-v2">
  <col class="c-verbatim"><col class="c-verbes"><col class="c-angles">
  <col class="c-coeur"><col class="c-sec">
  <col class="c-types"><col class="c-fin"><col class="c-attrib">
  <col class="c-conf">
</colgroup>
<thead class="col-headers">
<tr>
  <th>ID<span class="col-sub">id_question</span></th>
  <th>Scénario<span class="col-sub">scenario</span></th>
  <th>P⊕<span class="col-sub">pilier_demande</span></th>
  <th>V1<span class="col-sub">v1_conforme</span></th>
  <th>V2<span class="col-sub">v2_traite_problematique</span></th>
  <th>Verbatim<span class="col-sub">verbatim_candidat</span></th>
  <th>Verbes<span class="col-sub">verbes_observes</span></th>
  <th>Angles piliers<span class="col-sub">verbes_angles_piliers</span></th>
  <th>Pilier cœur<span class="col-sub">pilier_coeur_analyse</span></th>
  <th>Piliers sec.<span class="col-sub">piliers_secondaires</span></th>
  <th>Types verbatim<span class="col-sub">types_verbatim</span></th>
  <th>Finalité<span class="col-sub">finalite_reponse</span></th>
  <th>Attribution<span class="col-sub">attribution_pilier_signal_brut</span></th>
  <th>Conforme/Écart<span class="col-sub">conforme_ecart · ecart_detail · signal_limbique</span></th>
</tr>
</thead>
${rowsHtml}
</table>
</div>

<div class="page-footer">
  Profil-Cognitif · Visualisation interne · Tableau T1 v10.2 · Généré dynamiquement depuis Airtable
</div>

</body>
</html>`;
}

// ─── HTML d'erreur (candidat introuvable, pas de données, etc.) ──────────────

function generateEmptyHtml(candidat_id, visiteurInfo, message) {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Tableau T1 — ${escapeHtml(visiteurInfo.prenom || candidat_id)} — Profil-Cognitif</title>
<style>${CSS}</style>
</head>
<body>
<div class="page-header">
  <div class="logo-block">
    <h1><span class="pc-blue">PROFIL</span> <span class="pc-pink">COGNITIF</span></h1>
  </div>
  <div class="candidat-block">
    <div class="candidat-prenom">${escapeHtml(visiteurInfo.prenom || '?')}</div>
    <div class="candidat-id">${escapeHtml(candidat_id)}</div>
  </div>
</div>
<div style="background:#fff8e0;border:1px solid #c8a020;padding:30px;border-radius:4px;text-align:center;color:#6a5010;">
  <h2 style="margin-bottom:10px;">Aucune donnée à afficher</h2>
  <p>${escapeHtml(message)}</p>
</div>
</body>
</html>`;
}

// ─── Statistiques globales ───────────────────────────────────────────────────

function computeStats(rows) {
  const scenarios = [...new Set(rows.map(r => String(r.scenario || '').toUpperCase()).filter(Boolean))];
  let totalCorrections = 0;
  let lignesAvecCorrections = 0;
  for (const r of rows) {
    const nb = parseInt(r.nb_corrections_verificateur, 10) || 0;
    if (nb > 0) {
      lignesAvecCorrections++;
      totalCorrections += nb;
    }
  }
  return { scenarios, totalCorrections, lignesAvecCorrections };
}

module.exports = {
  generateTableauT1Html
};
