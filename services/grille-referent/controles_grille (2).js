// ⟦LOT 2026-09-04 ab⟧ controles_grille.js — contrôles de la grille référent · ajout 7bis : cohérence cartouche ↔ blocs de dimensions (jurisprudence 04/09)
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
// Les mots de jugement : ils décrivent la personne au lieu de décrire ce qui se
// passe. Un passage a produit « Difficulté à converger », « Tendance à continuer
// d'enrichir » — trois titres qui font lire un candidat incapable de décider,
// alors que le protocole établit exactement l'inverse.
const JUGEMENT = [
  /\bdifficult[ée]s?\b/i, /\btendance \u00e0\b/i, /\bincapacit[ée]\b/i,
  /\bfaiblesses?\b/i, /\blacunes?\b/i, /\bd[ée]fauts?\b/i,
  /\bprobl[èe]me (?:de|d'|avec)\b/i, /\brisque de ne pas\b/i,
  /\bne sait pas\b/i, /\bn'arrive pas [àa]\b/i, /\bmanque de\b/i
];

const REGIMES = [
  /\bOBSERV[ÉE]E\b/, /\bABSENTE\b/, /\bNULLE\b/, /\bPLEIN R[ÉE]GIME\b/i
];

// Ce qui ne s'affiche jamais au lecteur, et n'a donc pas à passer les filtres
// de langage : traçabilité, motifs internes, verbalisations.
const CHAMPS_INTERNES = new Set([
  'verbalisations', 'situations_non_traduites', 'motif_revision',
  'code', 'pilier', 'item_origine', 'ancrage', 'origine', 'bloc_retenu',
  'cle_tuile', 'candidat_id', 'manques'
]);

function texteVisible(g) {
  const morceaux = [];
  const pousser = v => { if (typeof v === 'string') morceaux.push(v); };
  const parcourir = (o, chemin = '') => {
    if (o == null) return;
    if (typeof o === 'string') { if (!chemin.includes('verbalisations')) pousser(o); return; }
    if (Array.isArray(o)) return o.forEach((x, i) => parcourir(x, `${chemin}[${i}]`));
    if (typeof o === 'object') {
      for (const k of Object.keys(o)) {
        // Champs INTERNES : ils ne sont jamais rendus comme texte — le gabarit
        // les place dans des attributs (data-circuit, data-origine). Les traiter
        // comme du texte visible reviendrait à interdire la traçabilité même
        // qu'on vient d'exiger.
        if (CHAMPS_INTERNES.has(k)) continue;
        parcourir(o[k], `${chemin}.${k}`);
      }
    }
  };
  parcourir(g);
  return morceaux.join('\n');
}

function tabSafe(v) { return Array.isArray(v) ? v : []; }

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

  // ── 3pre-ter · Chaque geste doit être rattachable à sa source ──
  // Sans le code, une narration est indistinguable d'une invention : personne
  // ne peut vérifier qu'elle vient de la base. La traçabilité se perdait à
  // l'écriture — l'agent recevait le code et ne le renvoyait pas.
  const narrationsSource = {};
  for (const pil of (payload?.piliers || [])) {
    for (const g of (pil.gestes || [])) {
      if (g.code) narrationsSource[g.code] = normaliser(g.narration);
    }
  }
  const codesConnus = Object.keys(narrationsSource).length;
  // ⚠️ Sans source à confronter, ce contrôle n'a rien à dire — il doit se taire,
  //    pas bloquer. Le 21/08, un rejeu sur un payload sans piliers a produit
  //    treize blocages faux : « geste absent du payload » alors que c'était le
  //    payload de contrôle qui était vide. Un contrôle sans matière ne conclut pas.
  if (codesConnus) for (const outil of (grille.bloc_profil?.outils || [])) {
    for (const g of (outil.gestes || [])) {
      if (!String(g.code || '').trim()) {
        if (codesConnus) signalements.push(`geste sans code source (${outil.libelle || '?'}) — narration non rattachable`);
        continue;
      }
      const src = narrationsSource[g.code];
      if (src === undefined) {
        bloquants.push(`geste ${g.code} absent du payload — narration sans source (${outil.libelle || '?'})`);
        continue;
      }
      // la narration affichée doit recouper sa source : mots significatifs communs
      const aff = normaliser(g.narration);
      const mots = src.split(' ').filter(w => w.length > 5).slice(0, 6);
      const recoupe = mots.filter(w => aff.includes(w.slice(0, Math.max(5, w.length - 2)))).length;
      if (mots.length >= 3 && recoupe === 0) {
        bloquants.push(`narration du geste ${g.code} sans rapport avec sa source — réécriture libre interdite`);
      }
    }
  }

  // ── 3pre-bis · Un renfort présent à la source doit se retrouver en sortie ──
  // Le champ était transmis mais jamais demandé : tous les gestes sortaient
  // avec « renfort: "" ». La matière existait, personne ne la réclamait.
  const renfortsSource = {};
  for (const pil of (payload?.piliers || [])) {
    for (const g of (pil.gestes || [])) {
      if (g.code && String(g.renfort || '').trim()) renfortsSource[g.code] = true;
    }
  }
  let renfortsPerdus = 0;
  for (const outil of (grille.bloc_profil?.outils || [])) {
    for (const g of (outil.gestes || [])) {
      if (g.code && renfortsSource[g.code] && !String(g.renfort || '').trim()) renfortsPerdus++;
    }
  }
  if (renfortsPerdus) {
    signalements.push(`${renfortsPerdus} renfort(s) présent(s) à la source mais absent(s) de la sortie`);
  }

  // ── 3nonies-bis · Les blocs essentiels ne peuvent pas être vides ──
  // Même raisonnement : un agent qui rend une liste vide n'est pas « manquant »,
  // et passait donc entre les mailles.
  if (!(grille.bloc_profil?.outils || []).length) {
    bloquants.push('aucun outil — le bloc 2 est vide');
  }
  if (!(grille.bloc_dimensions || []).length) {
    signalements.push("aucune dimension d'excellence — à vérifier : le candidat en a-t-il vraiment aucune d'établie ?");
  }
  if (!String(grille.bloc_apport?.titre || '').trim()) {
    bloquants.push('aucun profil au bloc 1 — la tuile n\'a pas été rendue');
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

  // ── 3bis-b · UNE TRANSPOSITION N'EST PAS UNE CONDENSATION ──
  // Un export transposé fait à peu près la longueur de sa source. Le 24/08,
  // les registres ont été rendus en 800 caractères pour une source de 4 500,
  // et la synthèse transversale a purement disparu — sans qu'aucun contrôle
  // ne le voie. On compare désormais les longueurs.
  const SEUIL = 0.55;   // en deçà, c'est un résumé, pas une transposition
  for (const outil of (grille.bloc_profil?.outils || [])) {
    const src = (payload?.piliers || []).find(p => p.pilier === outil.pilier ||
      normaliser(p.libelle) === normaliser(outil.libelle));
    const lSrc = String(src?.synthese || '').length;
    const lOut = String(outil.synthese || '').length;
    if (lSrc > 300 && lOut && lOut < lSrc * SEUIL) {
      bloquants.push(`synthèse condensée pour « ${outil.libelle} » : ${lOut} caractères pour une source de ${lSrc} — c'est un résumé, pas une transposition`);
    }
  }

  // ── 3bis-c · Les registres affectifs ne se perdent pas ──
  const regSrc = String(payload?.registres_affectifs || '');
  if (regSrc.length > 500) {
    const blocs = tabSafe(grille.registres_blocs);
    const lOut = blocs.reduce((n, b) =>
      n + String(b.constat || '').length + String(b.strategie || '').length + String(b.vigilance || '').length, 0)
      + String(grille.registres_synthese || '').length + String(grille.registres || '').length;
    // La source porte des verbatims qu'on retire : on attend environ la moitié.
    if (!lOut) {
      bloquants.push(`registres affectifs absents alors que la source en porte ${regSrc.length} caractères`);
    } else if (lOut < regSrc.length * 0.35) {
      bloquants.push(`registres condensés : ${lOut} caractères pour une source de ${regSrc.length} — chaque registre et sa synthèse transversale doivent être rendus`);
    }
    // La synthèse transversale (⚠⚠) est la plus utile au référent.
    if (regSrc.includes('⚠⚠') && !String(grille.registres_synthese || '').trim()) {
      signalements.push('la synthèse transversale des registres (⚠⚠) est absente de la sortie');
    }
  }

  // ── 3ter-a · Une narration longue DOIT porter un titre (R1bis, critère mesurable) ──
  // Le 21/08, douze gestes sur treize sont sortis sans titre, dont sept
  // paragraphes du socle. La règle « paragraphe ou phrase » laissait trop de
  // place au jugement : elle est devenue un seuil.
  for (const outil of (grille.bloc_profil?.outils || [])) {
    for (const g of (outil.gestes || [])) {
      const n = String(g.narration || '');
      // Le deux-points seul ne suffit pas : une phrase de 90 caractères qui en
      // contient un n'a pas besoin d'un titre — il serait plus long qu'elle.
      // Seule la LONGUEUR décide.
      const longue = n.length > 150;
      // ⚠️ SIGNALEMENT, pas blocage. Un titre absent est un défaut de présentation :
      //    la narration s'affiche seule et reste lisible. Ce n'est ni une fuite,
      //    ni une invention, ni une entorse à la doctrine. Interdire toute la
      //    grille pour cela est disproportionné — le 24/08, sept titres manquants
      //    ont empêché la publication d'une grille par ailleurs complète.
      if (longue && !String(g.titre || '').trim()) {
        signalements.push(`geste sans titre alors que sa narration fait ${n.length} caractères (${outil.libelle || '?'}) — R1bis`);
      }
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

  // ── 3sexies · Un point d'attention est le revers d'une FORCE ──
  // Une bascule sans sa force transforme une qualité en défaut : c'est ce qui
  // trompe le référent sur ce que le protocole a réellement mesuré.
  for (const v of (grille.bloc_vigilances || [])) {
    const nom = v.titre || '?';
    if (!String(v.force || '').trim()) {
      bloquants.push(`point d'attention sans force : « ${nom} » — ce que sa manière apporte doit être écrit AVANT ce qu'elle coûte`);
    }
    if (!String(v.bascule || '').trim() && !String(v.corps || '').trim()) {
      const inj = v.type === 'injonction' || /INJONCTION/i.test(String(v.bloc_type || ''));
      bloquants.push(inj
        ? `injonction sans bascule : « ${nom} » — les citations s'ajoutent aux champs obligatoires, elles ne les remplacent pas ; sans bascule, le référent lit des phrases sans savoir ce qu'elles produisent`
        : `point d'attention sans bascule : « ${nom} »`);
    }
    // Charte §5 : un point DÉMONTRE, il n'affirme pas.
    if (!String(v.preuve || '').trim()) {
      signalements.push(`point sans preuve : « ${nom} » — le geste qui l'établit n'est pas dit`);
    }
    // le titre nomme le mouvement, jamais le défaut
    for (const re of JUGEMENT) {
      const m = String(nom).match(re);
      if (m) bloquants.push(`mot de jugement dans un titre : « ${m[0]} » (${nom}) — nommer le mouvement, pas le défaut`);
    }
  }

  // ── 3septies · Aucun mot de jugement nulle part dans la grille ──
  for (const re of JUGEMENT) {
    const m = visible.match(re);
    if (m) signalements.push(`mot de jugement dans le texte : « ${m[0]} » — décrire ce qui se passe, pas ce qui manquerait`);
  }

  // ── 3octies · L'origine d'un point doit exister dans le RÉFÉRENTIEL ──
  // Un point « bien écrit » adossé à rien n'est pas opposable : deux candidats
  // au même profil recevraient des points différents selon l'humeur du modèle.
  // Le référentiel de désalignement est resté inutilisé pendant quatre passages
  // faute de ce contrôle : l'agent citait une origine qu'il inventait aussi.
  const itemsReferentiel = [];
  for (const d of (payload?.referentiels?.desalignement || [])) {
    const c = d.contenu;
    const liste = Array.isArray(c) ? c : (c && Array.isArray(c.items) ? c.items : []);
    for (const it of liste) itemsReferentiel.push(normaliser(it));
  }
  if (itemsReferentiel.length) {
    for (const v of (grille.bloc_vigilances || [])) {
      const orig = normaliser(v.item_origine);
      if (!orig) continue;   // l'absence est déjà bloquée plus haut
      const connu = itemsReferentiel.some(it =>
        it.includes(orig.slice(0, 22)) || orig.includes(it.slice(0, 22)));
      if (!connu) {
        bloquants.push(`origine introuvable au référentiel : « ${String(v.item_origine).slice(0, 55)}… » (${v.titre || '?'}) — un point inventé n'est pas opposable`);
      }
    }
  }

  // ── 3nonies · Les injonctions se citent, elles ne se reformulent pas ──
  for (const v of (grille.bloc_vigilances || [])) {
    const estInjonction = v.type === 'injonction' ||
      /INJONCTION/i.test(String(v.bloc_type || ''));
    if (estInjonction && !(v.citations || []).length) {
      bloquants.push(`injonction sans citation : « ${v.titre || '?'} » — l'énoncé EST le contenu, il s'affiche mot pour mot (charte §5)`);
    }
    if (!estInjonction && (v.citations || []).length) {
      signalements.push(`citations sur un point qui n'est pas une injonction : « ${v.titre || '?'} »`);
    }
  }

  // ── 3decies · UNE GRILLE SANS POINT D'ATTENTION N'EST PAS UNE GRILLE ──
  // Le 24/08, une grille est partie en base avec ZÉRO point : la rédaction avait
  // rendu une liste vide — non nulle, donc pas « mission manquante », et aucun
  // contrôle n'exigeait qu'elle contînt quelque chose. Un échec silencieux.
  //
  // Le référentiel compte ~198 items. Qu'aucun ne s'accroche à un candidat qui
  // a treize gestes établis n'est pas crédible : c'est le signe que la sélection
  // ou la rédaction a échoué sans le dire.
  if (!(grille.bloc_vigilances || []).length) {
    bloquants.push("aucun point d'attention — le bloc 4 est vide alors que le référentiel compte des centaines d'items : la sélection ou la rédaction a échoué en silence");
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

  // ── 7bis · COHÉRENCE CARTOUCHE ↔ BLOCS DE DIMENSIONS (ajout 04/09/2026) ──
  // Jurisprudence du 04/09 : le cartouche a rendu « non disponible » pour une
  // dimension DONT LE BLOC EXISTAIT, a recopié un exemple du prompt en guise de
  // libellé, et a posé « s'active sous contrainte » sur une dimension dont le
  // constat disait « traverse tous les contextes sans exception ».
  // Aucun contrôle ne l'a vu : c'est l'œil humain qui a rattrapé. Plus jamais.
  {
    const NOMS = { DEC: 'décentration', ANT: 'anticipation', MET: 'méta-cognition', VUE: 'vue systémique' };
    const EXEMPLES_INTERDITS = [
      'très ciblée — réflexion solitaire seulement'   // exemple du prompt_1 : jamais une valeur
    ];
    const blocs = tabSafe(grille.bloc_dimensions);
    const blocPour = (code) => blocs.find(b => normaliser(b.nom || '').includes(normaliser(NOMS[code] || '§')));

    for (const dim of tabSafe(grille.cartouche?.dimensions)) {
      const code = String(dim.nom || '').toUpperCase();
      const lib  = String(dim.libelle_niveau || '').trim();
      const bloc = blocPour(code);

      if (!lib) { signalements.push(`cartouche ${code} : libellé de niveau vide`); continue; }

      // a) un exemple de prompt n'est jamais une valeur de candidat
      if (EXEMPLES_INTERDITS.some(ex => normaliser(lib) === normaliser(ex))) {
        bloquants.push(`cartouche ${code} : libellé recopié d'un exemple du prompt (« ${lib} ») — il doit être dérivé du bloc de cette dimension`);
      }

      // b) « non disponible » est réservé au NON MESURÉ : si le bloc existe, il ment
      if (bloc && /non disponible/i.test(lib)) {
        bloquants.push(`cartouche ${code} : « non disponible » alors que le bloc de cette dimension existe — le libellé doit dire son expression réelle`);
      }

      // c) le libellé ne peut pas contredire le constat de sa propre dimension
      if (bloc) {
        const constat = normaliser(`${bloc.constat || ''} ${bloc.quand || ''}`);
        const ditTransversal = /(tous les contextes|sans exception|transversale|de facon stable|stable dans tous)/.test(constat);
        const ditSousContrainte = /(sous contrainte|urgence|pression)/.test(normaliser(lib));
        if (ditTransversal && ditSousContrainte) {
          signalements.push(`cartouche ${code} : « ${lib} » contredit son constat (activation décrite comme transversale)`);
        }
        const ditNonActifSolitaire = /(ne s.active pas en reflexion solitaire|absente de tout travail solitaire|aucune.{0,20}solitaire)/.test(constat);
        if (ditNonActifSolitaire && /solitaire/.test(normaliser(lib))) {
          signalements.push(`cartouche ${code} : « ${lib} » désigne la réflexion solitaire alors que le constat l'en exclut`);
        }
      }
    }
    // d) un bloc produit sans ligne au cartouche = matière invisible au référent
    for (const b of blocs) {
      const present = tabSafe(grille.cartouche?.dimensions)
        .some(d2 => normaliser(NOMS[String(d2.nom || '').toUpperCase()] || '§') && normaliser(b.nom || '').includes(normaliser(NOMS[String(d2.nom || '').toUpperCase()] || '§')));
      if (!present) signalements.push(`dimension « ${b.nom} » produite mais absente du cartouche`);
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
