// grille-referent-rendu/route_visualiser_grille.js
// Affichage de la grille référent (nouvelle génération) — lecture seule.
//
// GET /visualiser/grille_rdh/:candidat_id
//
// Ce que fait la route, et rien d'autre :
//   1. lit GRILLE_REFERENT.grille_json pour ce candidat (la grille produite) ;
//   2. lit VISITEUR.Prenom / Nom / civilite_candidat — c'est LÀ que vivent les
//      vrais prénom et nom, pas dans la grille (elle n'en contient aucun,
//      par construction) ;
//   3. remplit le gabarit validé (rendu_grille_html.js, à côté de ce fichier)
//      et sert la page.
//
// ⚠️ Les quatre fichiers de ce dossier restent ENSEMBLE : le moteur lit le
//    gabarit et la feuille de style à côté de lui (__dirname).
//
'use strict';

const express = require('express');
const fetch = require('node-fetch');
const rendu = require('./rendu_grille_html');

const router = express.Router();

function baseUrl() { return `https://api.airtable.com/v0/${process.env.AIRTABLE_BASE_ID}`; }
function headers() { return { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` }; }

/** Lit le premier enregistrement d'une table qui satisfait la formule. */
async function premiere(table, formule, champs) {
  const p = new URLSearchParams();
  p.set('filterByFormula', formule);
  p.set('maxRecords', '1');
  for (const c of champs) p.append('fields[]', c);
  const r = await fetch(`${baseUrl()}/${encodeURIComponent(table)}?${p}`, { headers: headers() });
  if (!r.ok) throw new Error(`Airtable ${table} : HTTP ${r.status}`);
  const d = await r.json();
  return (d.records && d.records[0]) ? d.records[0].fields : null;
}

/** Petite page de message, aux couleurs du service. */
function pageMessage(titre, texte) {
  return `<!DOCTYPE html><html lang="fr"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${titre}</title></head>
<body style="font-family:sans-serif;background:#f5f5f4;padding:60px 20px;text-align:center;">
<div style="background:#fff;border-radius:10px;max-width:460px;margin:0 auto;padding:36px;">
<h1 style="font-size:20px;color:#1c1917;margin:0 0 12px;">${titre}</h1>
<p style="color:#57534e;margin:0;">${texte}</p></div></body></html>`;
}

// Les identifiants candidats : lettres_chiffres_alphanum (pivar_…, pcc_…).
const ID_VALIDE = /^[a-z]+_\d+_[a-z0-9]+$/i;

router.get('/visualiser/grille_rdh/:candidat_id', async (req, res) => {
  const id = String(req.params.candidat_id || '').trim();
  if (!ID_VALIDE.test(id)) {
    return res.status(400).send(pageMessage('Identifiant invalide', "L'adresse demandée n'est pas correcte."));
  }

  try {
    // ── 1 · La grille produite ──
    const g = await premiere(
      'GRILLE_REFERENT',
      `{candidat_id}="${id}"`,
      ['candidat_id', 'grille_json', 'statut', 'date_generation']
    );
    if (!g || !g.grille_json) {
      return res.status(404).send(pageMessage(
        'Grille non disponible',
        "La grille de lecture de ce candidat n'a pas encore été produite."
      ));
    }

    let grille;
    try {
      grille = JSON.parse(g.grille_json);
    } catch (e) {
      console.error('[grille_rdh] grille_json illisible', id, e.message);
      return res.status(500).send(pageMessage(
        'Grille illisible',
        "Le contenu enregistré ne peut pas être affiché — la grille est à régénérer."
      ));
    }

    // ── 2 · Le nom, depuis VISITEUR ──
    // Le nom est un confort d'affichage, jamais une condition : si la lecture
    // échoue, la grille s'affiche quand même, sans nom.
    let civilite = '';
    let nom = '';
    try {
      const v = await premiere(
        'VISITEUR',
        `{candidate_ID}="${id}"`,
        ['Prenom', 'Nom', 'civilite_candidat']
      );
      if (v) {
        civilite = v.civilite_candidat || '';
        nom = [v.Prenom, v.Nom].filter(Boolean).join(' ');
      }
    } catch (e) {
      console.warn('[grille_rdh] nom VISITEUR non lu', id, e.message);
    }

    // ── 3 · Le rendu, par le gabarit validé ──
    // ?mode=interne affiche les traçabilités de source (data-src → Airtable),
    // pour la vérification par la garante. Sans lui : version référent, propre.
    const mode = req.query.mode === 'interne' ? 'interne' : undefined;
    res.set('Cache-Control', 'no-store');
    res.send(rendu.rendre(grille, { civilite, nom, mode }));
  } catch (e) {
    console.error('[grille_rdh]', id, e.message);
    res.status(502).send(pageMessage(
      'Affichage impossible',
      'La lecture des données a échoué. Réessayez dans un instant.'
    ));
  }
});

module.exports = router;
