// services/grille-referent/rendu_grille_html.js
// Remplit le gabarit de la grille référent avec la grille produite.
//
// ⚠️ LE GABARIT FAIT FOI : gabarit_grille.html, décalqué de la maquette validée.
//    Ce fichier ne contient AUCUN texte de la grille — il ne fait que remplir.
//    Toute modification de forme se fait dans le gabarit, jamais ici.
//
// Deux natures de contenu, et c'est le gabarit qui les distingue :
//   · {{ancre}}      → vient de la grille produite
//   · texte en clair → identique pour tous, écrit une fois
//
'use strict';

const fs   = require('fs');
const path = require('path');

const CHEMIN_GABARIT = path.join(__dirname, 'gabarit_grille.html');
const CHEMIN_STYLE   = path.join(__dirname, 'rendu_grille_style.css');

function e(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function vide(v) {
  if (Array.isArray(v)) return v.length === 0;
  return v == null || String(v).trim() === '';
}
function lire(obj, chemin) {
  return String(chemin).split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
}

// Un manque ne se masque jamais : il se voit, pour qu'on le corrige.
function marqueManque(ancre) {
  return `<span class="manque">${e(ancre)}</span>`;
}

// ═══════════════════════════════════════════════════════════════════════════
// Le moteur : boucles, conditions, ancres. Rien d'autre — un gabarit n'a pas
// besoin d'un langage, il a besoin d'être rempli sans surprise.
// ═══════════════════════════════════════════════════════════════════════════
function rendreBloc(tpl, ctx, racine) {
  // 1 · boucles et conditions : <!--{{#x}}--> … <!--{{/x}}-->
  const re = /<!--\{\{#([a-zA-Z_.]+)\}\}-->([\s\S]*?)<!--\{\{\/\1\}\}-->/;
  let m;
  while ((m = tpl.match(re))) {
    const [tout, cle, corps] = m;
    const val = lire(ctx, cle) !== undefined ? lire(ctx, cle) : lire(racine, cle);
    let remplace = '';
    if (Array.isArray(val)) {
      remplace = val.map(item => rendreBloc(corps, item, racine)).join('');
    } else if (!vide(val)) {
      remplace = rendreBloc(corps, ctx, racine);   // condition : affiché si non vide
    }
    tpl = tpl.replace(tout, remplace);
  }

  // 2 · l'élément courant d'une liste de chaînes : {{.}}
  if (typeof ctx === 'string') tpl = tpl.replace(/\{\{\.\}\}/g, e(ctx));

  // 3 · ancres simples
  tpl = tpl.replace(/\{\{([a-zA-Z_.]+)\}\}/g, (_, cle) => {
    let v = lire(ctx, cle);
    if (v === undefined) v = lire(racine, cle);
    if (vide(v)) {
      // Les attributs de traçabilité et les classes vides ne sont pas des manques.
      return /^(classe|classe_socle|classe_type|origine|ancrage|item_origine|bloc_retenu|code|pilier|lien_espace_referent)$/.test(cle.split('.').pop())
        ? '' : marqueManque(cle);
    }
    return e(v);
  });

  return tpl;
}

// ═══════════════════════════════════════════════════════════════════════════
// Prépare la grille produite pour le gabarit : ce qui relève de la MISE EN
// FORME (classes, intitulés de rubrique) se calcule ici — jamais dans un agent.
// ═══════════════════════════════════════════════════════════════════════════
function preparer(grille, opts) {
  const g = grille || {};
  const c = g.cartouche || {};
  const a = g.bloc_apport || {};
  const p = g.bloc_profil || {};

  return {
    civilite: opts.civilite || '',
    nom: opts.nom || '',
    referent_nom:        opts.referent_nom        || '____________',
    referent_entreprise: opts.referent_entreprise || '____________',
    date_consultation:   opts.date_consultation   || '__ / __ / ____',
    reference:           opts.reference           || ('PC-' + String(g.candidat_id || '').slice(-8)),
    lien_espace_referent: opts.lien_espace_referent || '#',

    cartouche: {
      zone: c.zone, signature: c.signature,
      // Le code de pilier remonte au cartouche : c'est lui qui porte la couleur
      // canonique de la charte. Sans lui, le rôle serait coloré — ce que la
      // charte interdit (le rôle se dit en toutes lettres, jamais par une teinte).
      socle: { ...(c.socle || {}), pilier: (c.socle || {}).pilier || opts.socle_pilier || '' },
      amont: { ...(c.amont || {}), pilier: (c.amont || {}).pilier || opts.amont_pilier || '' },
      aval:  { ...(c.aval  || {}), pilier: (c.aval  || {}).pilier || opts.aval_pilier  || '' },
      dimensions: c.dimensions || []
    },

    apport: {
      zone: a.zone, socle: (opts.socle_libelle || (c.socle || {}).libelle), type: opts.type_cognitif || '',
      titre: a.titre, definition_type: a.definition_type,
      application_au_socle: a.application_au_socle, chaine_ajoute: a.chaine_ajoute,
      atouts: (a.atouts || []).map(x => ({ ...x, classe: x.origine === 'ajuste' ? 'aj' : '' })),
      couts:  a.couts || []
    },

    profil: {
      socle_libelle: (c.socle || {}).libelle,
      filtre: p.filtre,
      chaine: g.chaine || opts.chaine || '',
      registres: g.registres || '',
      outils: (p.outils || []).map(o => ({
        ...o,
        classe_socle: /socle/i.test(o.role || '') ? 's' : '',
        gestes: o.gestes || []
      }))
    },

    portrait: g.portrait || '',
    dimensions: g.bloc_dimensions || [],

    vigilances: (g.bloc_vigilances || []).map(v => ({
      ...v,
      classe_type: v.type === 'specifique' ? 'spe' : '',
      intitule_type: v.type === 'specifique'
        ? "Ce qu'il apporte face à d'autres manières"
        : "Ce que sa manière apporte",
      bascule: v.bascule || v.corps || '',
      // Les citations arrivent en liste de phrases ; le gabarit les parcourt
      // via une boucle imbriquée, d'où l'enveloppe { items }.
      citations: (v.citations && v.citations.length) ? [{ items: v.citations }] : []
    }))
  };
}

/**
 * Rend la grille complète, prête à servir.
 * @param {Object} grille  la grille produite (contenu de grille_json)
 * @param {Object} opts    civilite · nom · referent_nom · … · mode ('interne' affiche la traçabilité)
 * @returns {string} page HTML complète
 */
function rendre(grille, opts = {}) {
  const gabarit = fs.readFileSync(CHEMIN_GABARIT, 'utf8');
  const style   = fs.readFileSync(CHEMIN_STYLE, 'utf8');
  const corps   = rendreBloc(gabarit, preparer(grille, opts), preparer(grille, opts));
  const interne = opts.mode === 'interne';

  return `<!DOCTYPE html>
<html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Grille de lecture — ${e(opts.nom || '')}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@600;700&family=DM+Sans:ital,wght@0,400;0,500;0,700;1,400&family=DM+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>${style}</style></head>
<body class="${interne ? 'interne' : 'production'}"><div class="page">
${corps}
</div></body></html>`;
}

module.exports = { rendre, preparer, CHEMIN_GABARIT };
