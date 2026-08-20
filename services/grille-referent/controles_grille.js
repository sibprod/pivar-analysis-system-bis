// services/grille-referent/controles_grille.js
// Les contrôles de sortie de la grille référent.
//
// ⚠️ AVANT MODIFICATION : lire docs/12-doctrine-preuve-et-mission-agent-grille.md
//
// Ces contrôles ne corrigent rien : ils constatent. Une grille qui échoue à un
// contrôle bloquant n'est pas écrite — elle part en révision humaine.
// Principe : rendre une grille fausse est plus grave que ne pas en rendre.
//
'use strict';

const logger = require('../../utils/logger');

// ── Ce qui ne doit JAMAIS apparaître dans une grille (D95 + D-PREUVE) ──
// Les situations du test — en clair ET déguisées.
// ⚠️ Une paraphrase est une fuite : « responsabilité d'un vivant » vaut « l'animal ».
// Cette liste s'est allongée après le passage du 20/08, qui avait laissé filer
// « responsabilité d'un vivant » et « véhicule, logis, évacuation ».
const SCENARIOS = [
  /\bsommeil\b/i, /\bweek-?end\b/i, /\banimal\b/i, /\bpanne\b/i,
  /\bcroquettes?\b/i, /\bv[ée]t[ée]rinaire\b/i,
  /\bvivant\b/i, /\bpropri[ée]taires?\b/i, /\bma[îi]tres?\b/i,
  /\bv[ée]hicule\b/i, /\blogis\b/i, /\b[ée]vacuation\b/i,
  /\bvoiture de location\b/i, /\bses enfants\b/i, /\bson budget\b/i,
  /\bado(?:lescent)?s?\b/i, /\bs[ée]jour\b/i, /\bvacances\b/i
];
const MECANIQUE = [
  /\b\d+\s*\/\s*(?:25|20|10|9|5|4)\b/,          // 12/25, 1/4…
  /\b\d+\s+activations?\b/i,
  /\bdensit[ée]\b/i, /\bpattern d'activation\b/i,
  /\bP[1-5]C\d+\b/,                              // codes de circuits
  /\bP[1-5]Q\d+\b/,                              // identifiants de questions
  /\b(?:tr[èe]s souvent|occasionnels)\b/i,       // blocs de fréquence
  /\b[àa] (?:pleine|demi|faible) intensit[ée]\b/i,
  /\bintensit[ée] partielle\b/i,
  /\bdiagnostique\b/i,                           // « l'absence est diagnostique »
  /\bcette disposition\b/i,
  /\b(?:HAUT|MOYEN|FAIBLE)\b/,                   // amplitudes
  /\bpalier\b/i, /\bniveau\s+[1-9]\b/i           // R5bis : plus de paliers
];
// Les régimes BRUTS qui doivent être traduits avant affichage.
// ⚠️ « régulière et ancrée » et « ancrée en régime modéré » NE SONT PAS ici :
// ce sont les libellés que le bilan du candidat affiche tel quel — même
// vocabulaire des deux côtés, c'est voulu. Seuls les régimes que le bilan
// candidat traduit doivent l'être ici aussi.
const REGIMES = [
  /\bOBSERV[ÉE]E\b/, /\bABSENTE\b/, /\bNULLE\b/, /\bPLEIN R[ÉE]GIME\b/i
];

function texteVisible(g) {
  const morceaux = [];
  const pousser = v => { if (typeof v === 'string') morceaux.push(v); };
  const parcourir = (o, chemin = '') => {
    if (o == null) return;
    if (typeof o === 'string') { if (!chemin.includes('verbalisations')) pousser(o); return; }
    if (Array.isArray(o)) return o.forEach((x, i) => parcourir(x, `${chemin}[${i}]`));
    if (typeof o === 'object') {
      for (const k of Object.keys(o)) {
        // Les verbalisations sont internes : elles peuvent citer la mécanique.
        if (k === 'verbalisations' || k === 'situations_non_traduites' || k === 'motif_revision') continue;
        parcourir(o[k], `${chemin}.${k}`);
      }
    }
  };
  parcourir(g);
  return morceaux.join('\n');
}

function normaliser(s) {
  return String(s || '').toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ').trim();
}

// ═══════════════════════════════════════════════════════════════════════════
function controler(grille, payload) {
  const bloquants = [];
  const signalements = [];
  const visible = texteVisible(grille);

  // ── 1 · Aucune situation du test, aucune mécanique de mesure ──
  for (const re of SCENARIOS) {
    const m = visible.match(re);
    if (m) bloquants.push(`situation du test affichée : « ${m[0]} » (D-PREUVE)`);
  }
  for (const re of [...MECANIQUE, ...REGIMES]) {
    const m = visible.match(re);
    if (m) bloquants.push(`mécanique de mesure affichée : « ${m[0]} » (D95)`);
  }

  // ── 2 · Aucun verbatim ──
  // Un verbatim se reconnaît à la première personne : le candidat parle de lui.
  const je = visible.match(/(?:^|[\s«"'])j['e]\s|\bje\s+(?:me|le|la|les|lui|vais|peux|fais|mets|prends)\b/i);
  if (je) bloquants.push(`verbatim probable dans la grille : « ${je[0].trim()} » (D-PREUVE)`);

  // ── 3 · R1 · chaque titre de geste se retrouve dans sa narration SOURCE ──
  // ⚠️ Le titre est la première proposition de la narration source, et cette
  // proposition est RETIRÉE de la narration affichée. Comparer le titre au texte
  // affiché produirait un faux positif systématique : on compare à la SOURCE.
  const sourceParOutil = {};
  for (const p of (payload?.piliers || [])) {
    sourceParOutil[normaliser(p.libelle)] =
      (p.gestes || []).map(g => normaliser(g.narration)).join(' ');
  }
  for (const outil of (grille.bloc_profil?.outils || [])) {
    const source = sourceParOutil[normaliser(outil.libelle)] || '';
    for (const g of (outil.gestes || [])) {
      const t = normaliser(g.titre);
      // ⚠️ R1bis : un titre VIDE est légitime — c'est même la règle quand la
      // narration tient en une seule phrase. Ne jamais bloquer là-dessus.
      // (Ce contrôle bloquait auparavant, en contradiction avec la règle.)
      if (!t) continue;
      if (!source) continue;                       // pas de source à confronter
      const mots = t.split(' ').filter(w => w.length > 4).slice(0, 3);
      const recoupe = mots.filter(w => source.includes(w.slice(0, Math.max(5, w.length - 2)))).length;
      if (mots.length && recoupe === 0) {
        bloquants.push(`titre introuvable dans la narration source : « ${g.titre} » — production libre interdite (R1)`);
      }
    }
  }

  // ── 3pre · Une narration vide est une faute (le titre, lui, peut l'être) ──
  for (const outil of (grille.bloc_profil?.outils || [])) {
    for (const g of (outil.gestes || [])) {
      if (!String(g.narration || '').trim()) {
        bloquants.push(`geste sans narration (${outil.libelle || '?'}) — le geste n'existe pas sans son texte`);
      }
    }
  }

  // ── 3bis · Aucune synthèse d'outil ne peut être vide ──
  // Le passage du 20/08 les a toutes laissées vides : la grille perdait ce qui
  // justifie la manière de chaque outil. C'est le défaut le plus grave possible,
  // parce qu'il ne se voit pas — la grille a l'air complète.
  for (const outil of (grille.bloc_profil?.outils || [])) {
    if (!String(outil.synthese || '').trim()) {
      bloquants.push(`synthèse vide pour « ${outil.libelle || '?'} » — ce que ses gestes établissent ensemble manque`);
    }
  }

  // ── 3ter · Un titre ne recopie jamais sa narration (R1bis) ──
  for (const outil of (grille.bloc_profil?.outils || [])) {
    for (const g of (outil.gestes || [])) {
      const t = normaliser(g.titre), n = normaliser(g.narration);
      if (t && n && (t === n || n.startsWith(t) && n.length - t.length < 12)) {
        bloquants.push(`titre redondant avec sa narration : « ${g.titre} » — laisser le titre vide (R1bis)`);
      }
    }
  }

  // ── 3quater · La signature n'est pas un champ brut ──
  const sig = String(grille.cartouche?.signature || '');
  if (/type\s+[AF]\b|environnement\s+[A-ZÉ]{4,}|\(\d\)/i.test(sig)) {
    bloquants.push(`signature brute : « ${sig} » — attendu : le titre de la tuile`);
  }

  // ── 3quinquies · Chaque vigilance est ancrée dans le référentiel ──
  // Le passage du 20/08 a produit trois points élégants qu'aucun référentiel ne
  // contenait. Un point inventé n'est adossé à rien : il n'est pas opposable.
  for (const v of (grille.bloc_vigilances || [])) {
    if (!String(v.item_origine || '').trim()) {
      bloquants.push(`point de vigilance sans origine : « ${v.titre || '?'} » — l'item du référentiel doit être cité`);
    }
    if (!String(v.ancrage || '').trim()) {
      signalements.push(`point de vigilance sans ancrage déclaré : « ${v.titre || '?'} »`);
    }
  }

  // ── 4 · chaque question est rattachée à un point de vigilance ──
  for (const v of (grille.bloc_vigilances || [])) {
    if (!v.titre) bloquants.push('point de vigilance sans titre');
    if (!v.question) bloquants.push(`point de vigilance sans question de vérification : « ${v.titre} »`);
    if (v.question && !v.ce_que_la_reponse_indique) {
      bloquants.push(`question sans clé de lecture : « ${v.titre} »`);
    }
    if (!v.au_travail) signalements.push(`point de vigilance non transposé au travail : « ${v.titre} »`);
  }

  // ── 5 · aucun écart au référentiel sans verbalisation ──
  const tuile = payload?.profil?.tuile || {};
  // ⚠️ Les atouts et coûts de la tuile arrivent en LISTE (airtable_grille les
  // découpe déjà). Les traiter comme du texte faisait échouer toute comparaison
  // et signalait chaque élément comme un écart. On accepte les deux formes.
  const enListe = (v) => (Array.isArray(v) ? v : String(v || '').split('\n'))
    .map(x => normaliser(String(x).replace(/^•\s*/, ''))).filter(Boolean);
  const refAtouts = enListe(tuile.atouts);
  const refCouts  = enListe(tuile.couts);
  const verbalises = (grille.verbalisations || []).map(v => normaliser(v.element_concerne));

  const ecartsSilencieux = [];
  for (const a of (grille.bloc_apport?.atouts || [])) {
    if (a.origine === 'referentiel' && !refAtouts.includes(normaliser(a.texte))) {
      ecartsSilencieux.push(a.texte);
    }
    if (a.origine === 'ajuste' && !verbalises.some(v => v && normaliser(a.texte).slice(0, 25).includes(v.slice(0, 25)) === false ? false : true)) {
      // un ajusté doit avoir SA ligne : contrôle par présence d'au moins une verbalisation
      if (!(grille.verbalisations || []).length) ecartsSilencieux.push(a.texte);
    }
  }
  for (const c of (grille.bloc_apport?.couts || [])) {
    if (c.origine === 'referentiel' && !refCouts.includes(normaliser(c.texte))) {
      ecartsSilencieux.push(c.texte);
    }
  }
  for (const e of ecartsSilencieux) {
    bloquants.push(`écart au référentiel sans verbalisation : « ${String(e).slice(0, 60)}… » (R8)`);
  }

  // ── 6 · aucun coût retiré, aucun coût retourné en atout (R7) ──
  if ((grille.bloc_apport?.couts || []).length < refCouts.length) {
    bloquants.push(`coût(s) retiré(s) de la tuile : ${refCouts.length} au référentiel, ${(grille.bloc_apport?.couts || []).length} en sortie (R7)`);
  }

  // ── 7 · R3 · seuil de non-traduction ──
  const nonTraduites = (grille.situations_non_traduites || []).length;
  if (nonTraduites > 0) {
    signalements.push(`${nonTraduites} situation(s) non traduite(s) — le référentiel doit être complété`);
    if (nonTraduites >= 5) {
      const liste = (grille.situations_non_traduites || []).map(x =>
        typeof x === 'string' ? x : JSON.stringify(x)).join(' · ');
      bloquants.push(`seuil de non-traduction franchi (${nonTraduites}) : ${liste} (R3)`);
    }
  }

  // ── 8 · la demande de révision de l'agent est souveraine ──
  if (grille.revision_humaine) {
    bloquants.push(`révision demandée par l'agent : ${grille.motif_revision || 'motif non précisé'}`);
  }

  const conforme = bloquants.length === 0;
  if (!conforme) logger.error('Grille référent — contrôles bloquants', { candidat_id: grille.candidat_id, bloquants });
  else if (signalements.length) logger.warn('Grille référent — signalements', { candidat_id: grille.candidat_id, signalements });

  return { conforme, bloquants, signalements };
}

module.exports = { controler };
