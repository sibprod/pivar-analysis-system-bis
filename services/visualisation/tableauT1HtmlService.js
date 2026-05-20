// services/visualisation/tableauT1HtmlService.js
// Service de génération HTML — Tableau T1 candidat — Visualisation interne
// Profil-Cognitif v10.7 (Phase HTML-2.0)
//
// PHASE HTML-2.0 (20/05/2026) — REFONTE COMPLÈTE post-architecture systémique :
//
//   Contexte : suite à la refonte de l'architecture en 2 étapes (étape1.1 lecture
//   cognitive amont + T1 analyse technique aval), la table ETAPE1_T1 a été
//   nettoyée (5 calculs morts supprimés, 2 nouveaux cog_* ajoutés) et la
//   visualisation v1.4.1 précédente ne reflétait plus la doctrine.
//
//   Changements majeurs vs v10.6 :
//
//   1. STRUCTURE EN 2 ZONES VISUELLES (lecture séquentielle gauche → droite) :
//      - Zone 1 « Lecture cognitive amont » (fond crème chaud) :
//        v2_repond_question, v2_repond_situation, v2_analyse (descriptif),
//        cog_comprend, cog_outils_mobilises, sortie + commentaire,
//        pilier_coeur, cog_gouverne_commentaire, finalite_reponse
//      - Zone 2 « Analyse technique T1 » (fond grisé, en-tête violet) :
//        pilier_coeur_analyse + outil_cognitif_libelle,
//        piliers_traverses + piliers_secondaires, verbes_observes,
//        verbes_angles_piliers, types_verbatim, signal_limbique, vérif
//      Séparation visuelle : bordure double + fond grisé sur cellules T1.
//
//   2. 19 COLONNES TOTALES (vs 14 en v10.6) :
//      - 3 colonnes Identité (Q, Scénario, Demandé/Finalité)
//      - 9 colonnes Zone 1 (lecture cognitive amont)
//      - 7 colonnes Zone 2 (analyse technique T1)
//
//   3. CHAMPS RETIRÉS (suppressions doctrine systémique) :
//      - v1_conforme (calcul mort, dérivable à la volée)
//      - v2_traite_problematique (dérive de v2_repond_question)
//      - attribution_pilier_signal_brut (reformatage redondant)
//      - conforme_ecart (calcul mort)
//      - ecart_detail (calcul mort)
//
//   4. CHAMPS AJOUTÉS (lecture amont étape1.1 transmise au-delà de T1) :
//      - cog_comprend (interprétation langage simple)
//      - cog_sortie_commentaire (commentaire de clôture)
//      - cog_outils_mobilises (séquence narrative — affichée Zone 1)
//      - cog_pilier_sortie (affiché Zone 1)
//      - cog_gouverne_commentaire (affiché Zone 1)
//      - cog_resultat_vise (= finalite_reponse, recopie)
//
//   5. NOUVEAUX RENDUS SPÉCIALISÉS :
//      - renderTraverses : mini-pills minuscules + position amont/aval
//      - renderAngles : mapping verbe→action avec pill pilier
//      - renderTypesVerbatim : blocs séparés label + citation
//      - renderCoeurAnalyse : outil_cognitif en badge violet + analyse condensée
//      - renderSignalLimbique : encadré orangé si détecté
//
//   6. SOURCE DES DONNÉES — fusion ETAPE1_T1 + RESPONSES :
//      Pour afficher la zone amont, le service doit pouvoir lire les champs
//      cog_* qui restent dans RESPONSES (cog_outils_mobilises, cog_pilier_sortie,
//      cog_gouverne_commentaire, cog_resultat_vise). Plusieurs sont déjà recopiés
//      en ETAPE1_T1 (cog_comprend, cog_sortie_commentaire), les autres sont lus
//      depuis RESPONSES via session_ID + id_question.
//
//   Route appelée par le navigateur :
//     https://pivar-analysis-system-bis.onrender.com/visualiser/t1/{candidate_ID}
//
// PHASE HTML-1.x (avant 20/05) — voir historique git pour les notes précédentes
//   (v10.6 doctrine v1.9 grille 3 niveaux, v10.5 doctrine v2 v3.3, etc.)
//   Ces phases sont obsolètes depuis la refonte systémique v10.7.

'use strict';

const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

// ─── CSS COMPLET ─────────────────────────────────────────────────────────────
const CSS = `
*{box-sizing:border-box;margin:0;padding:0;}
:root{
  --p1c:#0C447C;--p1bg:#deedf8;--p1bd:#378ADD;
  --p2c:#27500A;--p2bg:#d8ecbe;--p2bd:#639922;
  --p3c:#633806;--p3bg:#f5ddb0;--p3bd:#BA7517;
  --p4c:#3C3489;--p4bg:#dedcfa;--p4bd:#7F77DD;
  --p5c:#712B13;--p5bg:#f5d4c8;--p5bd:#D85A30;
  --ouic:#085041;--ouibg:#c4edd9;
  --nonc:#791F1F;--nonbg:#fcd4d4;
  --gc:#444441;--gbg:#e8e6df;--gbd:#B4B2A9;
  --text:#2C2C2A;--text2:#5F5E5A;--text3:#888780;
  --bg:#f5f3ee;--white:#fff;--border:#dddad2;
  --zone-amont-bg:#fffefb;
  --zone-t1-bg:#f4f1ec;
  --zone-t1-border:#c8c0b3;
  --zone-t1-header-bg:#3C3489;
  --zone-t1-header-fg:#fff;
}
body{font-family:'Helvetica Neue',Arial,sans-serif;background:var(--bg);color:var(--text);font-size:13px;}
header{background:var(--white);border-bottom:1px solid var(--border);padding:.9rem 1.5rem;position:sticky;top:0;z-index:200;display:flex;align-items:center;gap:1.5rem;flex-wrap:wrap;}
header h1{font-family:Georgia,serif;font-size:17px;font-weight:normal;}
.badge{font-size:10px;background:var(--p4bg);color:var(--p4c);border-radius:4px;padding:2px 8px;font-weight:600;}
.meta{font-size:11px;color:var(--text3);}
.legend{display:flex;gap:8px;flex-wrap:wrap;margin-left:auto;}
.leg{display:flex;align-items:center;gap:4px;font-size:10px;color:var(--text2);}
.ld{width:9px;height:9px;border-radius:2px;}
.filters{background:var(--white);border-bottom:1px solid var(--border);padding:.4rem 1.5rem;display:flex;gap:5px;flex-wrap:wrap;align-items:center;position:sticky;top:52px;z-index:190;}
.filters label{font-size:9.5px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;margin-right:2px;}
.sep{color:var(--border);margin:0 4px;}
.fb{border:1px solid var(--border);background:transparent;border-radius:4px;padding:2px 8px;font-size:10.5px;cursor:pointer;color:var(--text2);font-family:inherit;transition:all .1s;}
.fb:hover{border-color:var(--text2);color:var(--text);}
.fb.on{background:var(--text);color:var(--white);border-color:var(--text);}
.zones-bar{display:flex;padding:.5rem 1.5rem .35rem;font-size:10px;color:var(--text3);text-transform:uppercase;letter-spacing:.05em;gap:8px;align-items:center;}
.zones-bar .zb{padding:3px 10px;border-radius:3px;font-weight:600;}
.zones-bar .zb.amont{background:var(--zone-amont-bg);border:1px solid var(--border);color:var(--text2);}
.zones-bar .zb.t1{background:var(--zone-t1-header-bg);color:var(--white);}
.zones-bar .arrow{color:var(--text3);font-weight:400;}
.stats{display:flex;gap:8px;flex-wrap:wrap;padding:.75rem 1.5rem;}
.stat{background:var(--white);border:1px solid var(--border);border-radius:5px;padding:.4rem .8rem;text-align:center;min-width:90px;}
.stat-n{font-family:Georgia,serif;font-size:20px;line-height:1;}
.stat-l{font-size:9px;color:var(--text3);text-transform:uppercase;letter-spacing:.04em;margin-top:1px;}
.tbl-wrap{padding:0 1.5rem 2rem;overflow-x:auto;}
table{width:100%;border-collapse:collapse;background:var(--white);border:1px solid var(--border);border-radius:6px;overflow:hidden;min-width:3200px;}
thead .zone-head th{text-align:center;padding:5px 8px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;border-bottom:1px solid var(--border);}
thead .zone-head th.zone-id{background:#eceae4;color:var(--text2);}
thead .zone-head th.zone-amont{background:var(--zone-amont-bg);color:var(--text2);}
thead .zone-head th.zone-t1{background:var(--zone-t1-header-bg);color:var(--zone-t1-header-fg);}
thead .cols-head th{text-align:left;padding:6px 8px;font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--text2);border-bottom:1px solid var(--border);white-space:nowrap;}
thead .cols-head th.t1col{background:#1a1430;color:#d8d3ed;}
td{padding:7px 8px;border-bottom:1px solid #edeae4;vertical-align:top;line-height:1.45;}
td.t1col{background:var(--zone-t1-bg);}
td.zone-sep{border-left:3px double var(--zone-t1-border);}
tr:last-child td{border-bottom:none;}
tr.hidden{display:none;}
tr:not(.hidden):hover td{background:#faf8f3;}
tr:not(.hidden):hover td.t1col{background:#ebe7df;}
.pill{display:inline-block;border-radius:3px;padding:1px 6px;font-size:9.5px;font-weight:700;line-height:1.7;white-space:nowrap;vertical-align:middle;}
.p1{background:var(--p1bg);color:var(--p1c);}
.p2{background:var(--p2bg);color:var(--p2c);}
.p3{background:var(--p3bg);color:var(--p3c);}
.p4{background:var(--p4bg);color:var(--p4c);}
.p5{background:var(--p5bg);color:var(--p5c);}
.oui{background:var(--ouibg);color:var(--ouic);}
.non{background:var(--nonbg);color:var(--nonc);}
.gry{background:var(--gbg);color:var(--gc);}
.coeur{background:var(--text);color:var(--white);}
.minip{display:inline-block;border-radius:2px;padding:0 5px;font-size:9px;font-weight:600;line-height:1.6;margin-right:3px;opacity:.75;font-style:italic;}
.minip.p1{background:var(--p1bg);color:var(--p1c);}
.minip.p2{background:var(--p2bg);color:var(--p2c);}
.minip.p3{background:var(--p3bg);color:var(--p3c);}
.minip.p4{background:var(--p4bg);color:var(--p4c);}
.minip.p5{background:var(--p5bg);color:var(--p5c);}
.minip.empty{background:transparent;color:var(--text3);font-style:italic;border:1px dashed var(--border);}
.sc-tag{font-size:9px;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--text3);border:1px solid var(--gbd);border-radius:3px;padding:1px 5px;display:inline-block;}
.qid{font-size:12px;font-weight:700;color:var(--text);}
.s{font-size:11px;}.m{color:var(--text2);}.i{font-style:italic;}
.aln{color:var(--ouic);font-size:11px;}.sft{color:var(--nonc);font-size:11px;}
.outil-libelle{font-size:10px;color:var(--p4c);font-style:italic;background:var(--p4bg);border-left:2px solid var(--p4bd);padding:2px 6px;border-radius:2px;display:inline-block;}
.tv-block{margin-bottom:6px;padding:4px 6px;font-size:10px;background:#fbf9f4;border-left:2px solid var(--gbd);border-radius:2px;}
.tv-block:last-child{margin-bottom:0;}
.tv-label{font-weight:600;font-size:9.5px;display:block;margin-bottom:2px;}
.tv-cite{font-style:italic;color:var(--text2);font-size:10px;line-height:1.4;}
.va-line{margin-bottom:5px;padding-bottom:5px;border-bottom:1px dotted var(--border);font-size:10px;}
.va-line:last-child{margin-bottom:0;padding-bottom:0;border-bottom:none;}
.va-verb{font-weight:600;color:var(--text);}
.va-arrow{color:var(--text3);margin:0 3px;}
.va-action{color:var(--text2);font-style:italic;}
.limbique{background:#fdf2e9;border-left:2px solid #d85a30;padding:4px 6px;font-size:10px;color:var(--p5c);border-radius:2px;}
.limbique-empty{color:var(--text3);font-style:italic;font-size:10px;}
details summary{cursor:pointer;font-size:9.5px;color:var(--p4c);margin-top:3px;list-style:none;}
details summary::before{content:'▶ ';font-size:8px;}
details[open] summary::before{content:'▼ ';}
details p{font-size:10px;color:var(--text2);font-style:italic;margin-top:3px;padding:4px 7px;background:#faf8f3;border-left:2px solid var(--gbd);border-radius:0 3px 3px 0;line-height:1.5;}
.empty-state{padding:60px 30px;text-align:center;background:var(--white);border:1px solid var(--border);border-radius:6px;margin:30px;}
.empty-state h2{font-family:Georgia,serif;color:var(--nonc);margin-bottom:10px;}
.empty-state p{color:var(--text2);font-size:13px;}
`.trim();

// ─── UTILITAIRES ─────────────────────────────────────────────────────────────

const PILIER_NOMS = {
  P1: "Collecte d'information",
  P2: "Tri et organisation",
  P3: "Analyse et diagnostic",
  P4: "Création de solutions",
  P5: "Mise en œuvre et exécution"
};

const SCENARIO_LABELS = {
  SOMMEIL: 'Sommeil',
  WEEKEND: 'Week-end',
  ANIMAL_1: 'Animal 1',
  ANIMAL_2: 'Animal 2',
  PANNE: 'Panne'
};

const SCENARIO_ORDER = {
  SOMMEIL: 1, WEEKEND: 2, ANIMAL_1: 3, ANIMAL_2: 4, PANNE: 5
};

function escapeHtml(text) {
  if (text === null || text === undefined || text === '') return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function extractLookup(value) {
  if (value === undefined || value === null) return '';
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : '';
  return String(value);
}

function pp(text, cls) {
  return `<span class="pill ${cls}">${escapeHtml(text)}</span>`;
}

function ppill(p) {
  if (!p) return '';
  const code = String(p).toUpperCase().trim();
  const cls = ({ P1: 'p1', P2: 'p2', P3: 'p3', P4: 'p4', P5: 'p5' })[code] || 'gry';
  return pp(code, cls);
}

// ─── RENDUS SPÉCIALISÉS PAR COLONNE ─────────────────────────────────────────

function renderTraverses(traverses, secondaires) {
  if (!traverses && !secondaires) return '<span class="minip empty">—</span>';
  let html = '';
  if (traverses) {
    const matches = String(traverses).match(/[Pp][1-5]/g) || [];
    if (matches.length === 0) {
      html += '<span class="minip empty">monolithique</span>';
    } else {
      const seen = new Set();
      const pills = [];
      for (const m of matches) {
        const norm = m.toLowerCase();
        if (!seen.has(norm)) {
          seen.add(norm);
          const num = norm.charAt(1);
          pills.push(`<span class="minip p${num}">${escapeHtml(norm)}</span>`);
        }
      }
      html += pills.join('');
    }
  } else {
    html += '<span class="minip empty">monolithique</span>';
  }
  let out = `<div style="margin-bottom:4px">${html}</div>`;
  if (secondaires) {
    out += `<div class="s m i" style="font-size:10px;line-height:1.4">${escapeHtml(secondaires)}</div>`;
  }
  return out;
}

function renderAngles(text) {
  if (!text) return '<span class="limbique-empty">—</span>';
  const trimmed = String(text).trim();
  const pilierRegex = /\(([Pp][1-5])\)/g;
  const couples = [];
  let lastEnd = 0;
  let m;
  while ((m = pilierRegex.exec(trimmed)) !== null) {
    const content = trimmed.substring(lastEnd, m.index).trim();
    const pilier = m[1].toUpperCase();
    if (content.length > 0) couples.push({ content, pilier });
    lastEnd = m.index + m[0].length;
  }
  const tail = trimmed.substring(lastEnd).trim();
  if (tail.length > 0) couples.push({ content: tail, pilier: null });

  if (couples.length === 0) {
    return `<div style="font-size:10px;color:var(--text2)">${escapeHtml(trimmed)}</div>`;
  }

  const blocks = [];
  for (const c of couples) {
    const arrowIdx = c.content.search(/(?:→|->)/);
    let verbe = '', action = c.content;
    if (arrowIdx >= 0) {
      verbe = c.content.substring(0, arrowIdx).trim();
      const arrowChar = c.content.charAt(arrowIdx) === '→' ? '→' : '->';
      action = c.content.substring(arrowIdx + arrowChar.length).trim();
    }
    const pTag = c.pilier ? ` <span class="minip ${c.pilier.toLowerCase()}">${c.pilier}</span>` : '';
    if (verbe) {
      blocks.push(
        `<div class="va-line">` +
        `<span class="va-verb">${escapeHtml(verbe)}</span>` +
        `<span class="va-arrow">→</span>` +
        `<span class="va-action">${escapeHtml(action)}</span>${pTag}` +
        `</div>`
      );
    } else {
      blocks.push(`<div class="va-line"><span class="va-action">${escapeHtml(c.content)}</span>${pTag}</div>`);
    }
  }
  return blocks.join('');
}

function renderTypesVerbatim(text) {
  if (!text) return '<span class="limbique-empty">—</span>';
  const trimmed = String(text).trim();
  let chunks = trimmed.split(/(?:^|\n|(?<=[»"”])\s+|(?<=\.)\s+)(?=[Pp][1-5]\s*[·•:.\-])/g)
    .map(c => c.trim()).filter(c => c.length > 0);
  if (chunks.length <= 1) {
    chunks = trimmed.split(/(?=\s[Pp][1-5]\s*[·•:.\-])/g)
      .map(c => c.trim()).filter(c => c.length > 0);
  }
  if (chunks.length === 0) {
    return `<div style="font-size:10px">${escapeHtml(trimmed)}</div>`;
  }
  const blocks = [];
  for (const ch of chunks) {
    const m = ch.match(/^[Pp]([1-5])\s*[·•:.\-]\s*([^\n«"”]+?)(?:\s+[—–]\s+|\s+\-\s+|\n|\s+(?=[«"“]))(.+)$/s);
    if (m) {
      const pNum = m[1];
      const titre = m[2].trim();
      const cite = m[3].trim();
      blocks.push(
        `<div class="tv-block">` +
        `<span class="tv-label"><span class="minip p${pNum}">P${pNum}</span> ${escapeHtml(titre)}</span>` +
        `<span class="tv-cite">${escapeHtml(cite)}</span>` +
        `</div>`
      );
    } else {
      const m2 = ch.match(/^[Pp]([1-5])\s*[·•:.\-]?\s*(.+)$/s);
      if (m2) {
        const pNum = m2[1];
        blocks.push(
          `<div class="tv-block">` +
          `<span class="tv-label"><span class="minip p${pNum}">P${pNum}</span></span>` +
          `<span class="tv-cite">${escapeHtml(m2[2].trim())}</span>` +
          `</div>`
        );
      } else {
        blocks.push(`<div class="tv-block"><span class="tv-cite">${escapeHtml(ch)}</span></div>`);
      }
    }
  }
  return blocks.join('');
}

function renderCoeurAnalyse(row) {
  const coeur = row.pilier_coeur || '';
  const analyse = row.pilier_coeur_analyse || '';
  const outil = row.outil_cognitif_libelle || '';
  if (!analyse && !outil) return '<span class="limbique-empty">—</span>';
  const html = [];
  if (outil) html.push(`<div class="outil-libelle">${escapeHtml(outil)}</div>`);
  if (analyse) {
    let clean = analyse;
    const m = analyse.match(/^[Pp]([1-5])\s*[·•:.\-]\s*(.+)$/s);
    if (m && ('P' + m[1]) === coeur.toUpperCase()) {
      clean = m[2].trim();
    }
    html.push(`<div class="s m" style="margin-top:5px;line-height:1.45">${escapeHtml(clean)}</div>`);
  }
  return html.join('');
}

function renderSignalLimbique(text) {
  if (!text || !String(text).trim()) return '<span class="limbique-empty">— factuel</span>';
  return `<div class="limbique">${escapeHtml(text)}</div>`;
}

function renderVerbesObserves(text) {
  if (!text) return '<span class="limbique-empty">—</span>';
  const verbes = String(text).split(/[\n,;·]+/).map(v => v.trim()).filter(v => v.length > 0);
  if (verbes.length === 0) return '<span class="limbique-empty">—</span>';
  return `<div style="font-family:'Courier New',monospace;font-size:10px;line-height:1.7;color:var(--text2)">${verbes.map(v => escapeHtml(v)).join('<br>')}</div>`;
}

// ─── RENDU D'UNE LIGNE T1 (1 question) ──────────────────────────────────────

function renderRowT1(row) {
  // Champs identité / contexte (depuis ETAPE1_T1)
  const idQuestion = row.id_question || '';
  const scenario = String(row.scenario || '').toUpperCase();
  const demande = row.pilier_demande || '';
  const finaliteLib = row.pilier_finalite_libelle || PILIER_NOMS[demande] || '';

  // Zone 1 — Amont (mix ETAPE1_T1 + lookup RESPONSES)
  const v2Q = row.v2_repond_question || '';
  const v2S = row.v2_repond_situation || '';
  const v2A = row.v2_analyse || '';
  const cogComprend = row.cog_comprend || '';
  const cogOutils = row.cog_outils_mobilises || '';  // lookup depuis RESPONSES
  const cogSortie = row.cog_pilier_sortie || '';     // lookup depuis RESPONSES
  const cogSortieComm = row.cog_sortie_commentaire || '';
  const coeur = row.pilier_coeur || '';
  const cogGouverneComm = row.cog_gouverne_commentaire || '';  // lookup depuis RESPONSES
  const finRep = row.finalite_reponse || '';
  const verbatim = row.verbatim_candidat || '';

  // Alignement
  const aln = demande === coeur;
  const vsClass = v2S.startsWith('OUI') ? 'oui' : 'non';
  const vsLabel = v2S.replace('OUI_', '');

  // Vérificateur
  const nbCorr = parseInt(row.nb_corrections_verificateur, 10) || 0;
  const corrText = row.corrections_verificateur || '';

  return `
    <tr data-sc="${escapeHtml(scenario)}" data-gov="${escapeHtml(coeur)}" data-aln="${aln ? 'yes' : 'no'}">
      <!-- Identité -->
      <td><span class="qid">${escapeHtml(idQuestion)}</span></td>
      <td><span class="sc-tag">${escapeHtml(SCENARIO_LABELS[scenario] || scenario)}</span></td>
      <td>
        ${ppill(demande)}
        ${finaliteLib ? `<div class="s m i" style="margin-top:4px;font-size:10px">${escapeHtml(finaliteLib)}</div>` : ''}
      </td>
      <!-- Zone 1 — Amont -->
      <td>${v2Q ? pp(v2Q, v2Q === 'OUI' ? 'oui' : 'non') : ''}</td>
      <td>${v2S ? pp(vsLabel, vsClass) : ''}</td>
      <td class="s m">${escapeHtml(v2A)}
        ${verbatim ? `<details><summary>verbatim</summary><p>${escapeHtml(verbatim)}</p></details>` : ''}
      </td>
      <td class="s">${escapeHtml(cogComprend)}</td>
      <td class="s m i">${escapeHtml(cogOutils)}</td>
      <td class="s m">
        ${cogSortie ? ppill(cogSortie) : ''}
        ${cogSortieComm ? `<div style="margin-top:3px">${escapeHtml(cogSortieComm)}</div>` : ''}
      </td>
      <td style="text-align:center">
        ${coeur ? pp(coeur, 'coeur pill') : ''}
        <br><span class="${aln ? 'aln' : 'sft'}">${aln ? '✓' : '↗'}</span>
      </td>
      <td class="s">${escapeHtml(cogGouverneComm)}</td>
      <td class="s m">${escapeHtml(finRep)}</td>
      <!-- Zone 2 — Technique T1 -->
      <td class="t1col zone-sep">${renderCoeurAnalyse(row)}</td>
      <td class="t1col">${renderTraverses(row.piliers_traverses, row.piliers_secondaires)}</td>
      <td class="t1col">${renderVerbesObserves(row.verbes_observes)}</td>
      <td class="t1col">${renderAngles(row.verbes_angles_piliers)}</td>
      <td class="t1col">${renderTypesVerbatim(row.types_verbatim)}</td>
      <td class="t1col">${renderSignalLimbique(row.signal_limbique)}</td>
      <td class="t1col" style="text-align:center">
        ${nbCorr > 0
          ? `<span class="pill non" title="${escapeHtml(corrText)}">⚠ ${nbCorr}</span>`
          : '<span class="limbique-empty">—</span>'}
      </td>
    </tr>`;
}

// ─── STATS ───────────────────────────────────────────────────────────────────

function computeStats(rows) {
  const total = rows.length;
  const repOui = rows.filter(r => r.v2_repond_question === 'OUI').length;
  const govCount = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
  let gliss = 0;
  for (const r of rows) {
    const coeur = r.pilier_coeur || '';
    const demande = r.pilier_demande || '';
    if (coeur && govCount.hasOwnProperty(coeur)) govCount[coeur]++;
    if (demande !== coeur) gliss++;
  }
  return { total, repOui, govCount, gliss };
}

function renderStatsBar(stats) {
  const colors = { P1: 'var(--p1c)', P2: 'var(--p2c)', P3: 'var(--p3c)', P4: 'var(--p4c)', P5: 'var(--p5c)' };
  const sorted = Object.entries(stats.govCount).sort((a, b) => b[1] - a[1]);
  let html = `
    <div class="stat"><div class="stat-n">${stats.total}</div><div class="stat-l">Questions</div></div>
    <div class="stat"><div class="stat-n" style="color:var(--ouic)">${stats.repOui}</div><div class="stat-l">Répond Q</div></div>`;
  for (const [p, n] of sorted) {
    if (n > 0) html += `<div class="stat"><div class="stat-n" style="color:${colors[p]}">${n}</div><div class="stat-l">Cœur ${p}</div></div>`;
  }
  html += `<div class="stat"><div class="stat-n" style="color:var(--nonc)">${stats.gliss}</div><div class="stat-l">Glissements</div></div>`;
  return html;
}

// ─── GÉNÉRATION HTML COMPLÈTE ────────────────────────────────────────────────

/**
 * Génère le HTML complet du tableau T1 d'un candidat
 * @param {string} candidat_id
 * @returns {Promise<string>} HTML complet (string)
 */
async function generateTableauT1Html(candidat_id) {
  logger.info('Génération HTML Tableau T1 v10.7 (architecture systémique)', { candidat_id });

  // 1. Infos VISITEUR (prénom + nom + civilité)
  let visiteurInfo = { prenom: '?', nom: '?', civilite: '?', candidate_ID: candidat_id };
  try {
    visiteurInfo = await airtableService.getVisiteurInfoForVisualisation(candidat_id);
  } catch (e) {
    logger.warn('Impossible de lire VISITEUR pour visualisation T1', { candidat_id, error: e.message });
  }

  // 2. Lire les lignes ETAPE1_T1
  let rowsT1 = [];
  try {
    rowsT1 = await airtableService.getEtape1T1(candidat_id);
  } catch (e) {
    logger.error('Erreur lecture ETAPE1_T1', { candidat_id, error: e.message });
    return generateEmptyHtml(visiteurInfo, `Erreur de lecture ETAPE1_T1 : ${e.message}`);
  }

  if (!rowsT1 || rowsT1.length === 0) {
    return generateEmptyHtml(visiteurInfo, "Aucune ligne T1 trouvée pour ce candidat.");
  }

  // 3. Lire les lignes RESPONSES (pour enrichir avec cog_outils_mobilises, cog_pilier_sortie,
  //    cog_gouverne_commentaire qui ne sont pas recopiés en ETAPE1_T1)
  let responsesMap = {};
  try {
    const responses = await airtableService.getResponses(candidat_id);
    if (responses && responses.length > 0) {
      for (const r of responses) {
        if (r.id_question) responsesMap[r.id_question] = r;
      }
    }
  } catch (e) {
    logger.warn('Impossible de lire RESPONSES pour enrichir visualisation T1', { candidat_id, error: e.message });
  }

  // 4. Fusionner ETAPE1_T1 + RESPONSES (pour la zone amont)
  const mergedRows = rowsT1.map(t1 => {
    const resp = responsesMap[t1.id_question] || {};
    return {
      ...t1,
      // Champs RESPONSES non recopiés en ETAPE1_T1 (zone amont étape1.1)
      cog_outils_mobilises:    t1.cog_outils_mobilises    || resp.cog_outils_mobilises    || '',
      cog_pilier_sortie:       t1.cog_pilier_sortie       || resp.cog_pilier_sortie       || '',
      cog_gouverne_commentaire: t1.cog_gouverne_commentaire || resp.cog_gouverne_commentaire || ''
    };
  });

  // 5. Tri par scénario canonique puis id_question
  mergedRows.sort((a, b) => {
    const sa = SCENARIO_ORDER[String(a.scenario || '').toUpperCase()] || 99;
    const sb = SCENARIO_ORDER[String(b.scenario || '').toUpperCase()] || 99;
    if (sa !== sb) return sa - sb;
    return String(a.id_question || '').localeCompare(String(b.id_question || ''));
  });

  // 6. Stats globales
  const stats = computeStats(mergedRows);
  const statsHtml = renderStatsBar(stats);

  // 7. Construire le HTML
  const rowsHtml = mergedRows.map(renderRowT1).join('\n');
  const prenom = visiteurInfo.prenom || candidat_id;
  const nom = visiteurInfo.nom || '';
  const displayName = `${prenom} ${nom}`.trim();

  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Analyse T1 · ${escapeHtml(displayName)}</title>
<style>${CSS}</style>
</head>
<body>

<header>
  <h1>Analyse cognitive T1 · ${escapeHtml(displayName)}</h1>
  <span class="badge">v10.7</span>
  <span class="meta">${mergedRows.length} questions · 5 scénarios · pipeline systémique</span>
  <div class="legend">
    <div class="leg"><div class="ld" style="background:var(--p1bg);border:1px solid var(--p1bd)"></div>P1</div>
    <div class="leg"><div class="ld" style="background:var(--p2bg);border:1px solid var(--p2bd)"></div>P2</div>
    <div class="leg"><div class="ld" style="background:var(--p3bg);border:1px solid var(--p3bd)"></div>P3</div>
    <div class="leg"><div class="ld" style="background:var(--p4bg);border:1px solid var(--p4bd)"></div>P4</div>
    <div class="leg"><div class="ld" style="background:var(--p5bg);border:1px solid var(--p5bd)"></div>P5</div>
    <div class="leg"><div class="ld" style="background:var(--text)"></div>★ Cœur</div>
  </div>
</header>

<div class="filters">
  <label>Scénario</label>
  <button class="fb on" onclick="filt(this,'sc','all')">Tous</button>
  <button class="fb" onclick="filt(this,'sc','SOMMEIL')">Sommeil</button>
  <button class="fb" onclick="filt(this,'sc','WEEKEND')">Week-end</button>
  <button class="fb" onclick="filt(this,'sc','ANIMAL_1')">Animal 1</button>
  <button class="fb" onclick="filt(this,'sc','ANIMAL_2')">Animal 2</button>
  <button class="fb" onclick="filt(this,'sc','PANNE')">Panne</button>
  <span class="sep">|</span>
  <label>Cœur</label>
  <button class="fb on" onclick="filt(this,'gov','all')">Tous</button>
  <button class="fb" onclick="filt(this,'gov','P1')">P1</button>
  <button class="fb" onclick="filt(this,'gov','P2')">P2</button>
  <button class="fb" onclick="filt(this,'gov','P3')">P3</button>
  <button class="fb" onclick="filt(this,'gov','P4')">P4</button>
  <button class="fb" onclick="filt(this,'gov','P5')">P5</button>
  <span class="sep">|</span>
  <label>Alignement</label>
  <button class="fb on" onclick="filt(this,'aln','all')">Tous</button>
  <button class="fb" onclick="filt(this,'aln','yes')">Demandé = cœur</button>
  <button class="fb" onclick="filt(this,'aln','no')">Glissement</button>
</div>

<div class="zones-bar">
  <span class="zb amont">Zone 1 — Lecture cognitive amont (étape1.1, langage simple)</span>
  <span class="arrow">→</span>
  <span class="zb t1">Zone 2 — Analyse technique T1 (verbes, citations, signal)</span>
</div>

<div class="stats">${statsHtml}</div>

<div class="tbl-wrap">
<table>
  <thead>
    <tr class="zone-head">
      <th class="zone-id" colspan="3">Identité</th>
      <th class="zone-amont" colspan="9">Zone 1 — Lecture cognitive amont (étape1.1)</th>
      <th class="zone-t1" colspan="7">Zone 2 — Analyse technique T1</th>
    </tr>
    <tr class="cols-head">
      <th>Q</th>
      <th>Scénario</th>
      <th>Demandé / Finalité</th>
      <th>Répond Q</th>
      <th>Répond Sit.</th>
      <th style="min-width:165px">v2_analyse (descriptif)</th>
      <th style="min-width:165px">cog_comprend</th>
      <th style="min-width:210px">cog_outils_mobilises</th>
      <th style="min-width:145px">Sortie + commentaire</th>
      <th>Cœur ★</th>
      <th style="min-width:210px">cog_gouverne_commentaire</th>
      <th style="min-width:160px">finalite_reponse</th>
      <th class="t1col" style="min-width:200px">pilier_coeur_analyse + outil</th>
      <th class="t1col" style="min-width:140px">Traversés + position</th>
      <th class="t1col" style="min-width:130px">verbes_observes</th>
      <th class="t1col" style="min-width:230px">verbes_angles_piliers</th>
      <th class="t1col" style="min-width:260px">types_verbatim</th>
      <th class="t1col" style="min-width:160px">signal_limbique</th>
      <th class="t1col" style="min-width:100px">Vérif</th>
    </tr>
  </thead>
  <tbody id="TB">
${rowsHtml}
  </tbody>
</table>
</div>

<script>
const S={sc:'all',gov:'all',aln:'all'};
function filt(btn,dim,val){
  S[dim]=val;
  document.querySelectorAll('.fb').forEach(b=>{
    const m=(b.getAttribute('onclick')||'').match(/filt\\(this,'(\\w+)','(\\w+)'\\)/);
    if(m&&m[1]===dim) b.classList.toggle('on',m[2]===val);
  });
  document.querySelectorAll('#TB tr').forEach(tr=>{
    const show=
      (S.sc==='all'||tr.dataset.sc===S.sc)&&
      (S.gov==='all'||tr.dataset.gov===S.gov)&&
      (S.aln==='all'||tr.dataset.aln===S.aln);
    tr.classList.toggle('hidden',!show);
  });
}
</script>
</body>
</html>`;
}

// ─── HTML d'erreur ──────────────────────────────────────────────────────────

function generateEmptyHtml(visiteurInfo, message) {
  const prenom = visiteurInfo.prenom || '?';
  const nom = visiteurInfo.nom || '';
  return `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<title>Analyse T1 · ${escapeHtml(prenom)} ${escapeHtml(nom)}</title>
<style>${CSS}</style>
</head>
<body>
<header>
  <h1>Analyse cognitive T1 · ${escapeHtml(prenom)} ${escapeHtml(nom)}</h1>
  <span class="badge">v10.7</span>
</header>
<div class="empty-state">
  <h2>Aucune donnée à afficher</h2>
  <p>${escapeHtml(message)}</p>
</div>
</body>
</html>`;
}

module.exports = {
  generateTableauT1Html
};
