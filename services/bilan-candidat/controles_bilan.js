/**
 * CONTRÔLES BLOQUANTS — BILAN PRÉSENTÉ AU CANDIDAT
 * Dépôt ANALYSE. S'exécutent après l'agent, avant écriture.
 * Aucun ne signale : tous rejettent. (Pièce 38 v2 — production autonome, sans relecteur.)
 */

const crypto = require('crypto');

/* Mots de liaison autorisés dans un titre, en plus des mots de la matière */
const LIAISON = new Set(['votre','vos','le','la','les','un','une','des','de','du','d','l','en','et',
  'a','au','aux','ce','cet','cette','qui','que','pour','sans','avec','sur','dans','par','plus','ne','pas','se','son','sa','ses',
  'vous','votre','ou','on','y','il','elle','est','sont','fait','faites'].map(m => m.normalize('NFD').replace(/[\u0300-\u036f]/g,'')));

/* Termes qui ne doivent jamais figurer dans la sortie */
const INTERDITS_TEXTE = [
  'circuit','instrumental','glissement','signal limbique','capacité','amplitude','profondeur',
  'pilier dominant','pilier structurant','HAUT','MOYEN','FAIBLE','effleuré','plein régime',
  // libellés du protocole — D2-07 : ils ne sortent jamais
  "Collecte d'information",'Tri et organisation','Analyse et diagnostic',
  'Création de solutions','Mise en œuvre et exécution'
];

const normalise = s => String(s||'').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[’']/g," ").replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(Boolean);

/* C1 — chaque mot porteur d'un titre doit venir de la matière du geste */
function controleTitres(sortie, payload) {
  const echecs = [];
  const matiereParCode = new Map();
  for (const o of payload.outils) {
    const g = o.gestes;
    if (Array.isArray(g)) g.forEach(x => matiereParCode.set(x.code, [x.narration, x.resume, x.renfort, JSON.stringify(x.verbatims)].join(' ')));
    else (g.codes_retenus||[]).forEach(c => matiereParCode.set(c, g.texte_integral));
  }
  for (const t of (sortie.titres_parles||[])) {
    const matiere = new Set(normalise(matiereParCode.get(t.code_geste)));
    // Un mot du titre est admis s'il figure dans la matière, ou s'il en partage
    // la racine (accords et conjugaisons : « vagabonder » → « vagabonde »).
    // Ce qui reste interdit : une notion qui n'existe nulle part dans la matière.
    const racines = [...matiere].map(m => m.slice(0, 5));
    const connu = m => matiere.has(m) || (m.length >= 5 && racines.includes(m.slice(0, 5)));
    const orphelins = normalise(t.titre).filter(m => !LIAISON.has(m) && !connu(m));
    if (orphelins.length) echecs.push(`titre « ${t.titre} » : mots absents de la matière → ${orphelins.join(', ')}`);
  }
  if ((sortie.titres_parles||[]).length !== matiereParCode.size)
    echecs.push(`nombre de titres (${(sortie.titres_parles||[]).length}) ≠ nombre de gestes (${matiereParCode.size})`);
  return echecs;
}

/* C2 — chaque point de vigilance : item source présent au référentiel + verbatim du candidat */
function controleVigilance(sortie, payload, referentiel) {
  const echecs = [];
  const pts = sortie.points_vigilance || [];
  if (pts.length < 3 || pts.length > 5) echecs.push(`points de vigilance : ${pts.length} (attendu 3 à 5)`);
  const axes = new Set(pts.map(p => p.axe));
  if (!(axes.has('trop') && axes.has('autres'))) echecs.push('les deux axes ne sont pas représentés');
  const tousVerbatims = JSON.stringify(payload.outils);
  for (const p of pts) {
    if (!p.source_referentiel || !referentiel.includes(p.source_referentiel))
      echecs.push(`point « ${p.titre} » : item source absent du référentiel`);
    const cite = (p.verbatims||[]).filter(v => v && tousVerbatims.includes(v.slice(0, Math.min(30, v.length))));
    if (!cite.length) echecs.push(`point « ${p.titre} » : aucun verbatim du candidat`);
    if (!p.transposition) echecs.push(`point « ${p.titre} » : transposition professionnelle manquante`);
    // registre : pas de futur, pas de probabilité, pas de diagnostic
    const texte = [p.titre, p.ancrage, p.transposition].join(' ');
    for (const interdit of [/\bvous (finirez|serez|deviendrez|allez)\b/i, /\b\d+\s?%/, /\b(probabilité|risque élevé|risque faible)\b/i, /\bvous (souffrez|êtes en (souffrance|burn))\b/i]) {
      if (interdit.test(texte)) echecs.push(`point « ${p.titre} » : registre interdit (prédiction, probabilité ou diagnostic)`);
    }
  }
  return echecs;
}

/* C3 — intégrité du transporté.
   L'agent ne renvoie QUE ses productions : toute autre clé signifie qu'il a
   touché à la matière. C'est cela qu'on vérifie — pas une empreinte de payload,
   qu'il ne renvoie jamais. */
const CLES_AUTORISEES = new Set(['titres_parles', 'points_vigilance']);
function controleIntegrite(sortie) {
  const intruses = Object.keys(sortie || {}).filter(k => !CLES_AUTORISEES.has(k));
  return intruses.length
    ? [`intégrité : l'agent a renvoyé des champs qui ne lui appartiennent pas (${intruses.join(', ')})`]
    : [];
}

/* C4 — aucun terme interdit dans la sortie produite */
function controleEtancheite(sortie) {
  const texte = JSON.stringify([sortie.titres_parles, sortie.points_vigilance, sortie.enchainement]);
  return INTERDITS_TEXTE.filter(t => new RegExp(`\\b${t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}\\b`,'i').test(texte))
    .map(t => `terme interdit dans la sortie : « ${t} »`);
}

/* Orchestration : 3 tentatives, puis anomalie */
async function produireAvecControles(payload, referentiel, appelerAgent, maxTentatives = 3, journal = console) {
  let dernieresAlertes = [];
  let derniereSortie = null;
  for (let n = 1; n <= maxTentatives; n++) {
    // ⭐ On redonne à l'agent ce qu'il a mal fait, plutôt que de le relancer à l'aveugle.
    const sortie = await appelerAgent(payload, referentiel, dernieresAlertes, derniereSortie);
    derniereSortie = sortie;
    const alertes = [
      ...controleIntegrite(sortie),
      ...controleTitres(sortie, payload),
      ...controleVigilance(sortie, payload, referentiel.map(r => r.id)),
      ...controleEtancheite(sortie)
    ];
    if (!alertes.length) return { statut: 'publie', sortie, tentatives: n, alertes: [] };
    dernieresAlertes = alertes;
    journal.warn?.('Tentative rejetée — alertes renvoyées à l\'agent', {
      tentative: n, alertes,
      recu: { items_referentiel: referentiel.length, gestes: payload.outils.reduce((t,o)=>t+(o.gestes?.length||0),0) },
      produit: { titres: (sortie.titres_parles||[]).length, vigilance: (sortie.points_vigilance||[]).length }
    });
  }
  return { statut: 'anomalie', sortie: null, tentatives: maxTentatives, alertes: dernieresAlertes };
}

module.exports = { produireAvecControles, controleTitres, controleVigilance, controleIntegrite, controleEtancheite, INTERDITS_TEXTE, LIAISON };
