/**
 * CONTRÔLES BLOQUANTS — BILAN PRÉSENTÉ AU CANDIDAT
 * Dépôt ANALYSE. S'exécutent après l'agent, avant écriture.
 * Aucun ne signale : tous rejettent. (Pièce 38 v2 — production autonome, sans relecteur.)
 */

const crypto = require('crypto');

/* Mots de liaison autorisés dans un titre, en plus des mots de la matière */
const LIAISON = new Set([
  // déterminants, pronoms, prépositions, conjonctions
  'votre','vos','le','la','les','un','une','des','de','du','d','l','en','et','ou','a','au','aux',
  'ce','cet','cette','ces','qui','que','quoi','dont','pour','sans','avec','sur','dans','par','vers',
  'plus','moins','ne','pas','se','son','sa','ses','leur','leurs','vous','on','y','il','elle','tout','toute','tous',
  'quand','comme','si','mais','donc','puis','avant','apres','entre','chez','jusqu','meme','autre','autres',
  // verbes et mots-outils du français courant : ils ne portent aucune notion nouvelle
  'est','sont','etre','avoir','fait','faites','faire','aller','va','vont','mettre','met','mis','prendre','prend',
  'laisser','laisse','donner','donne','tenir','tient','venir','vient','passer','passe','rester','reste',
  'chercher','cherche','trouver','trouve','voir','voit','savoir','sait','pouvoir','peut','vouloir','veut',
  'facon','maniere','chose','choses','fois','moment','temps','lieu','place','cas','point','filet','ordre','suite',
  'rien','toujours','jamais','deja','encore','aussi','bien','peu','beaucoup','trop','assez',
  'nos','notre','mes','mon','ma','lui','eux','elles','nous','je','tu','soi'
].map(m => m.normalize('NFD').replace(/[\u0300-\u036f]/g,'')));

/* Termes qui ne doivent jamais figurer dans la sortie */
const INTERDITS_TEXTE = [
  'circuit','instrumental','glissement','signal limbique',
  'pilier dominant','pilier structurant','HAUT','MOYEN','FAIBLE','effleuré','plein régime',
  // libellés du protocole — D2-07 : ils ne sortent jamais
  "Collecte d'information",'Tri et organisation','Analyse et diagnostic',
  'Création de solutions','Mise en œuvre et exécution'
];

const normalise = s => String(s||'').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g,'')
  .replace(/[’']/g,"'").replace(/\b[a-z]'/g,' ').replace(/[^a-z0-9\s]/g,' ').split(/\s+/).filter(m => m.length > 1);

/* C1 — chaque mot porteur d'un titre doit venir du DÉTAIL COMPLET du geste
   (AM-16, 20/08, qui remplace AM-14) : libellé officiel, narration, résumé,
   renfort et phrases du candidat. Le titre est composé — le plus compréhensible
   possible — mais jamais avec une notion étrangère à cette matière. */
function controleTitres(sortie, payload, formulations = []) {   // formulations : conservé pour compatibilité, inutilisé (AM-16)
  const echecs = [];
  const matiereParCode = new Map();
  for (const o of payload.outils) {
    const g = o.gestes;
    if (Array.isArray(g)) g.forEach(x => matiereParCode.set(x.code,
      [x.libelle_officiel, x.narration, x.resume, x.renfort, JSON.stringify(x.verbatims)].join(' ')));
    else (g.codes_retenus||[]).forEach(c => matiereParCode.set(c, g.texte_integral));
  }
  for (const t of (sortie.titres_parles||[])) {
    const matiere = new Set(normalise(matiereParCode.get(t.code_geste)));
    // Un mot du titre est admis s'il figure dans la matière, ou s'il en partage
    // la racine — accords ET conjugaisons : « vagabonder » → « vagabonde »,
    // « ouvrant » → « ouvre ». Le radical est obtenu en ôtant les terminaisons
    // usuelles du français ; deux mots au même radical (≥ 4 lettres) sont le
    // même mot. Ce qui reste interdit : une notion étrangère à la matière.
    const radical = m => {
      // v3.6 : les NOMS D'ACTION rejoignent leur verbe — « passage » ↔ « passez »,
      // « ajustement » ↔ « ajustez » (constaté sur le candidat V, run 15:58).
      const r = m.replace(/(issements?|issant|issons|assent|ements?|ations?|aient|erait|erions|erons|antes?|ants?|ages?|ions|ent|ant|ees?|es|er|ez|e|s)$/,'');
      // v3.7 : racine minimale abaissée à 3 — les verbes courts (poser, loger,
      // jeter…) ont une racine de 3 lettres ; la garde à 4 empêchait « posée »
      // de retrouver « posez » (constaté sur Cécile et R test, runs du 20/08).
      return r.length >= 3 ? r : m;
    };
    const racines  = new Set([...matiere].filter(m => m.length >= 5).map(m => m.slice(0, 5)));
    const radicaux = new Set([...matiere].map(radical));
    const connu = m => matiere.has(m)
      || (m.length >= 5 && racines.has(m.slice(0, 5)))
      || radicaux.has(radical(m));
    const orphelins = normalise(t.titre).filter(m => !LIAISON.has(m) && !connu(m));
    if (orphelins.length) echecs.push(`titre « ${t.titre} » : mots absents du détail du geste → ${orphelins.join(', ')}`);
    // Plafond de longueur (v3.1) : le compréhensible prime, mais au-delà de
    // quinze mots ce n'est plus un titre. Le motif dit exactement quoi corriger.
    const nbMots = String(t.titre||'').trim().split(/\s+/).filter(Boolean).length;
    if (nbMots > 15) echecs.push(`titre « ${t.titre} » : trop long (${nbMots} mots, plafond 15) — raccourcis-le en gardant les mots du candidat`);
  }
  if ((sortie.titres_parles||[]).length !== matiereParCode.size)
    echecs.push(`nombre de titres (${(sortie.titres_parles||[]).length}) ≠ nombre de gestes (${matiereParCode.size})`);
  return echecs;
}

/* C2 — chaque point de vigilance : item source présent au référentiel + verbatim du candidat */
function controleVigilance(sortie, payload, referentiel) {
  const echecs = [];
  const pts = sortie.points_vigilance || [];
  // AM-17 (20/08) : plus de sélection — TOUS les items prouvés sont retenus.
  // Aucun plafond, aucun équilibre d'axes imposé : le seul contrôle est la
  // preuve, point par point. Un bilan sans aucun point reste suspect.
  if (pts.length < 1) echecs.push('points de vigilance : aucun retenu — au moins un item du référentiel devrait être prouvé par la matière');
  const tousVerbatims = JSON.stringify(payload.outils);
  for (const p of pts) {
    // L'item source n'est exigé que si un référentiel a pu être lu.
    // Sans référentiel, l'agent produit sur la seule matière du candidat :
    // l'ancrage par verbatim et le contrôle de registre suffisent alors.
    if (referentiel && referentiel.length) {
      if (!p.source_referentiel || !referentiel.includes(p.source_referentiel))
        echecs.push(`point « ${p.titre} » : item source absent du référentiel`);
    }
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

/* C5 — registre (garante, 20/08) : le bilan vouvoie. Aucun tutoiement dans ce
   que l'agent COMPOSE — titres et transpositions. L'ancrage est exempté : un
   énoncé d'injonction cite la voix de l'entourage, encadrée comme telle au
   rendu. Le « il/elle » désignant le candidat relève de la relecture de
   l'agent (consigne au prompt) : indétectable mécaniquement sans faux rejets. */
/* ⚠ v3.5 — la détection doit connaître l'alphabet français : avec les
   frontières de mots standard (\b, ASCII), le « ê » de « tête » casse le mot
   et « te » déclenchait un faux tutoiement (constaté au run du 20/08 14:39).
   La frontière est donc définie sur TOUTE lettre Unicode. Deux protections
   de plus : « ton » précédé d'un article est le nom commun (« un ton sec »),
   et les citations entre guillemets « … » sont la voix de l'entourage. */
const TUTOIEMENT = /(?:^|[^\p{L}])(tu|te|toi|ton|ta|tes)(?![\p{L}])/iu;
const horsCitations = s => String(s || '').replace(/«[^»]*»/g, ' ').replace(/\u00ab[^\u00bb]*\u00bb/g, ' ');
const sansTonNom = s => s.replace(/\b(un|le|ce|du|au|quel|leur|son)\s+ton(?![\p{L}])/giu, ' ');
const tutoie = s => TUTOIEMENT.test(sansTonNom(horsCitations(s)));
function controleRegistre(sortie) {
  const echecs = [];
  for (const t of (sortie.titres_parles || [])) {
    if (tutoie(t.titre)) echecs.push(`titre « ${t.titre} » : tutoiement — le bilan vouvoie`);
  }
  for (const p of (sortie.points_vigilance || [])) {
    if (tutoie(p.titre)) echecs.push(`point « ${p.titre} » : tutoiement dans le titre — le bilan vouvoie`);
    if (tutoie(p.transposition)) echecs.push(`point « ${p.titre} » : tutoiement dans la transposition — le bilan vouvoie`);
  }
  return echecs;
}

/* C3 — intégrité du transporté.
   L'agent ne renvoie QUE ses productions : toute autre clé signifie qu'il a
   touché à la matière. C'est cela qu'on vérifie — pas une empreinte de payload,
   qu'il ne renvoie jamais. */
const CLES_AUTORISEES = new Set(['titres_parles', 'points_vigilance', '_reponse_non_json']);
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
async function produireAvecControles(payload, referentiel, appelerAgent, formulations = [], maxTentatives = 3, journal = console) {
  let dernieresAlertes = [];
  let derniereSortie = null;
  let meilleure = null, meilleuresAlertes = [];
  for (let n = 1; n <= maxTentatives; n++) {
    // ⭐ On redonne à l'agent ce qu'il a mal fait, plutôt que de le relancer à l'aveugle.
    const sortie = await appelerAgent(payload, referentiel, dernieresAlertes, derniereSortie);
    derniereSortie = sortie;
    const alertes = [
      ...controleIntegrite(sortie),
      ...controleTitres(sortie, payload, formulations),
      ...controleVigilance(sortie, payload, referentiel.map(r => r.id)),
      ...controleEtancheite(sortie),
      ...controleRegistre(sortie)
    ];
    if (sortie._reponse_non_json) alertes.unshift(`l'agent a répondu hors format : « ${sortie._reponse_non_json.slice(0,120)}… »`);
    if (!alertes.length) return { statut: 'publie', sortie, tentatives: n, alertes: [] };

    // Si la meilleure tentative précédente était plus complète, on la garde :
    // inutile de repartir de zéro quand l'agent régresse.
    const score = s => (s?.titres_parles?.length || 0) + (s?.points_vigilance?.length || 0) * 3;
    if (meilleure === null || score(sortie) > score(meilleure)) { meilleure = sortie; meilleuresAlertes = alertes; }
    dernieresAlertes = alertes;
    journal.warn?.('Tentative rejetée — alertes renvoyées à l\'agent', {
      tentative: n, alertes,
      recu: { items_referentiel: referentiel.length, gestes: payload.outils.reduce((t,o)=>t+(o.gestes?.length||0),0) },
      produit: { titres: (sortie.titres_parles||[]).length, vigilance: (sortie.points_vigilance||[]).length }
    });
  }
  return { statut: 'anomalie', sortie: meilleure, tentatives: maxTentatives, alertes: meilleuresAlertes.length ? meilleuresAlertes : dernieresAlertes };
}

module.exports = { produireAvecControles, controleTitres, controleVigilance, controleIntegrite, controleEtancheite, controleRegistre, INTERDITS_TEXTE, LIAISON };
