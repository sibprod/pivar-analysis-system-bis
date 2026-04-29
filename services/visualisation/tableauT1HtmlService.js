// services/visualisation/tableauT1HtmlService.js
// Service de génération HTML — Tableau T1 candidat — Visualisation interne
// Profil-Cognitif v10.2 (Phase HTML-1.1)
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Rôle :
//   - Lit les 25 lignes ETAPE1_T1 + infos VISITEUR depuis Airtable
//   - Génère un HTML autonome (CSS intégré) pour visualiser le tableau T1
//   - Affiche les 24 colonnes ETAPE1_T1 + corrections du vérificateur (CSS différencié)
//   - Visualisation interne uniquement (pas pour le candidat)
//
// PHASE HTML-1 (2026-04-29) — v10.2 :
//   - Création initiale du service
//   - Adapté à la doctrine v10.2 (5 agents T1 distincts : SOMMEIL, WEEKEND, ANIMAL_1, ANIMAL_2, PANNE)
//   - Affiche corrections_verificateur + nb_corrections_verificateur (Décision n°38)
//   - CSS différencié pour le bloc vérificateur (info technique secondaire)
//
// PHASE HTML-1.1 (2026-04-29 fin de journée) — corrections après 1er test :
//   - ⭐ Ajout d'une ligne d'en-têtes <thead> avec nom des colonnes (sticky en haut)
//     → "il manque les noms des colonnes, on ne sait pas ce que l'on lit" (Isabelle)
//   - ⭐ Élargissement colonne pilier_coeur_analyse : 55px → 200px
//     → contient une analyse riche (~300 caractères), pas juste un code "P1"
//     → bug d'affichage avec débordement sur les colonnes voisines détecté
//   - ⭐ Protection anti-débordement globale : word-wrap/overflow-wrap/word-break
//     sur toutes les cellules <td> et <th>
//   - Ajustement largeurs des autres colonnes pour rééquilibrer le tableau
//
// Inspiré du template historique tableau1_<candidat>_v3.html
// Adapté aux colonnes ETAPE1_T1 réelles v10.2 (24 champs).

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
col.c-angles  { width:150px; }
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

/* ⭐ v1.1 — Protection anti-débordement sur TOUTES les cellules */
table td, table th {
  word-wrap: break-word;
  overflow-wrap: break-word;
  word-break: break-word;
  hyphens: auto;
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

/* Verbatim */
.verbatim {
  font-family:'IBM Plex Sans',sans-serif; font-size:11px; line-height:1.5;
  color:var(--text); font-style:italic;
  max-height:120px; overflow-y:auto;
  padding:4px 6px; background:#fbf9f4; border-left:2px solid var(--border2);
}

/* Verbes */
.verbes {
  font-family:'IBM Plex Mono',monospace; font-size:10px; line-height:1.7;
}

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

  // Ligne données T1 (14 cellules)
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
  <td><div class="verbes">${nl2br(row.verbes_observes)}</div></td>
  <td>${nl2br(row.verbes_angles_piliers)}</td>
  <td>${pilierBadge(row.pilier_coeur_analyse)}</td>
  <td>${nl2br(row.piliers_secondaires)}</td>
  <td>${nl2br(row.types_verbatim)}</td>
  <td>${nl2br(row.finalite_reponse)}</td>
  <td style="font-family:'IBM Plex Mono',monospace;font-size:10px;">${nl2br(row.attribution_pilier_signal_brut)}</td>
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
