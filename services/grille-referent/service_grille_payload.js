// services/grille-referent/service_grille_payload.js
// Construction du payload de l'agent GRILLE RÉFÉRENT
//
// ⚠️ AVANT MODIFICATION : lire docs/12-doctrine-preuve-et-mission-agent-grille.md
//
// Ce service ne produit AUCUN texte. Il lit, il assemble, il vérifie que la matière
// est complète — et il refuse de construire si elle ne l'est pas.
//
// RÈGLES APPLIQUÉES ICI (les autres vivent dans le prompt) :
//   · toute lecture est filtrée sur candidat_id, JAMAIS sur le contenu
//   · R9 : sélection des gestes sur bloc_final — jamais `bloc` (résidu BLOC_EN_ATTENTE),
//          jamais circuit_niveau (amplitude absolue, pas rang dans le pilier)
//   · R9 : cascade de repli par pilier — très souvent, sinon souvent, sinon occasionnels
//   · D-PREUVE : aucun verbatim n'entre dans le payload
//   · D95 : aucun libellé de circuit du référentiel n'entre dans le payload
//   · les trois référentiels sont chargés INTÉGRALEMENT : ils sont le cadre de l'agent
//
'use strict';

const airtableService = require('../infrastructure/airtableService');
const refGrille       = require('./airtable_grille');   // les 3 lecteurs de référentiels
const logger          = require('../../utils/logger');

// L'ordre du chemin cognitif, pour la présentation.
const ORDRE_PILIERS = ['P4', 'P3', 'P5', 'P1', 'P2'];
// Les trois blocs, du plus fréquent au moins fréquent (R9).
const CASCADE = ['très souvent', 'souvent', 'occasionnels'];
// Composition mécanique de la clé de tuile — aucune interprétation.
const SOCLE_VERS_CLE = { P1: 'COLLECTE', P2: 'TRI', P3: 'ANALYSE', P4: 'SOLUTIONS', P5: 'MEO' };

function val(v) { return (v && (v.name !== undefined ? v.name : v)) || ''; }

// ═══════════════════════════════════════════════════════════════════════════
// NEUTRALISATION DES SITUATIONS — mécanique, avant tout agent
//
// Les textes sources citent les situations du test : « la voiture de location »,
// « l'animal », « le week-end ». D-PREUVE les interdit côté référent.
//
// ⚠️ POURQUOI ICI ET NON DANS UN PROMPT
//    On l'a demandé aux agents pendant quatre passages. Ils l'ont fait la plupart
//    du temps — et oublié une fois, ce qui a suffi à faire refuser la grille
//    entière. Une substitution est une opération MÉCANIQUE : la confier à un
//    modèle, c'est accepter qu'elle échoue de temps en temps.
//    Le code, lui, ne l'oublie jamais.
//
// Les agents gardent leur consigne : c'est une ceinture, pas un remplacement.
// ═══════════════════════════════════════════════════════════════════════════
const SUBSTITUTIONS = [
  // — l'incident sous contrainte de temps —
  [/\bla voiture de location\b/gi,        'une solution de rechange'],
  [/\bune voiture de location\b/gi,       'une solution de rechange'],
  [/\bde la voiture de location\b/gi,     "d'une solution de rechange"],
  [/\bvoiture de location\b/gi,           'solution de rechange'],
  [/\ble train\b/gi,                      'une option au résultat garanti'],
  [/\bdu train\b/gi,                      "de l'option garantie"],
  [/\ble garage\b/gi,                     'un prestataire'],
  [/\bau garage\b/gi,                     'à un prestataire'],
  [/\bla panne\b/gi,                      'un incident sous contrainte de temps'],
  [/\bde la panne\b/gi,                   "d'un incident sous contrainte de temps"],
  [/\bsur la panne\b/gi,                  'dans un incident sous contrainte de temps'],
  [/\bl'h[ée]bergement\b/gi,              'un repli'],
  [/\bà l'h[ée]bergement\b/gi,            'à un repli'],
  [/\bl'ami\b/gi,                         'un appui personnel'],
  [/\bla d[ée]panneuse\b/gi,              'un secours extérieur'],
  [/\ble banquier\b/gi,                   'un appui extérieur'],

  // — la responsabilité confiée —
  // ⚠️ L'ordre compte : les formes longues d'abord, sinon la courte les mange.
  //    Et l'apostrophe peut être droite (') ou typographique (').
  [/\bde\s+l['’]\s*animal(?:_\d)?\b/gi,   "d'une responsabilité confiée"],
  [/\bsur\s+l['’]\s*animal(?:_\d)?\b/gi,  'sur une responsabilité confiée'],
  [/\bl['’]\s*animal(?:_\d)?\b/gi,         'une responsabilité confiée'],
  [/\bun\s+animal\b/gi,                   'une responsabilité confiée'],
  [/\banimal(?:_\d)?\b/gi,                 'responsabilité confiée'],
  //   Blocage du 26/08 : « propriétaire » passait hors des deux formes traitées
  //   (le singulier et les constructions du/au n'étaient pas couverts). Les
  //   textes du test et de la fusion circulent depuis la réparation des noms —
  //   avec leur vocabulaire de scénario. Couverture totale, repli nu en dernier.
  [/\bses propri[ée]taires\b/gi,          'ceux qui la lui ont confiée'],
  [/\bles propri[ée]taires\b/gi,          'ceux qui la lui ont confiée'],
  [/\bdes\s+propri[ée]taires\b/gi,        'de ceux qui la lui ont confiée'],
  [/\baux\s+propri[ée]taires\b/gi,        'à ceux qui la lui ont confiée'],
  [/\ble\s+propri[ée]taire\b/gi,          'celui qui la lui a confiée'],
  [/\bdu\s+propri[ée]taire\b/gi,          'de celui qui la lui a confiée'],
  [/\bau\s+propri[ée]taire\b/gi,          'à celui qui la lui a confiée'],
  [/\bpropri[ée]taires\b/gi,              'ceux qui la lui ont confiée'],
  [/\bpropri[ée]taire\b/gi,               'celui qui la lui a confiée'],
  [/\ble v[ée]t[ée]rinaire\b/gi,          'un spécialiste'],
  [/\bdu v[ée]t[ée]rinaire\b/gi,          "d'un spécialiste"],
  [/\bles croquettes\b/gi,                'les consignes reçues'],
  //   Blocage du 24/08 18h01 : « vivant » passait hors des trois formes traitées
  //   (« la responsabilité du vivant », « d'un vivant confié »). Les formes
  //   longues d'abord, puis un repli sur le mot nu — le contrôle refuse
  //   TOUT \bvivant\b, la couverture doit donc être totale.
  //   ⚠️ \b est invalide après une lettre accentuée (« confié », « intensité ») :
  //   on emploie (?![a-zà-ÿ]), comme la règle « modéré » plus bas.
  [/\bd['’]un\s+vivant\s+confi[ée]e?s?(?![a-zà-ÿ])/gi, "d'une responsabilité confiée"],
  [/\bun\s+vivant\s+confi[ée]e?s?(?![a-zà-ÿ])/gi,      'une responsabilité confiée'],
  [/\bun [êe]tre vivant\b/gi,             'un tiers qui dépend de lui'],
  [/\bd['’]un vivant\b/gi,                "d'un tiers qui dépend de lui"],
  [/\bun vivant\b/gi,                     'un tiers qui dépend de lui'],
  [/\bdu\s+vivant\b/gi,                   'du tiers qui dépend de lui'],
  [/\bau\s+vivant\b/gi,                   'au tiers qui dépend de lui'],
  [/\ble\s+vivant\b/gi,                   'le tiers qui dépend de lui'],
  [/\bvivant\b/gi,                        'tiers qui dépend de lui'],

  // — le projet collectif —
  [/\ble week-?end\b/gi,                  'un projet collectif'],
  [/\bdu week-?end\b/gi,                  "d'un projet collectif"],
  [/\bsur le week-?end\b/gi,              'dans un projet collectif'],
  [/\ble s[ée]jour\b/gi,                  'le projet'],
  [/\bla location\b/gi,                   'la réservation'],

  // — le sujet de fond traité seul —
  [/\ble sommeil\b/gi,                    'un sujet de fond traité seul'],
  [/\bsur le sommeil\b/gi,                'sur un sujet de fond traité seul'],
  [/\bdu sommeil\b/gi,                    "d'un sujet de fond traité seul"],

  // — vocabulaire de mesure (D95) : les régimes et leurs intensités —
  //   Ces termes sont partout dans les textes de dimensions : « le plein régime
  //   (ÉLEVÉ) est conditionnel », « ancrée en régime modéré », « 10 MOYEN
  //   réguliers ». Ils décrivent l'instrument, pas la personne.
  //   Le référent doit lire ce que la personne fait, jamais comment on l'a mesuré.
  [/\bà\s+plein\s+r[ée]gime\b/gi,        'à sa pleine expression'],
  [/\ble\s+plein\s+r[ée]gime\b/gi,       'sa pleine expression'],
  [/\bplein\s+r[ée]gime\b/gi,            'pleine expression'],
  [/\bancr[ée]e?\s+en\s+r[ée]gime\s+mod[ée]r[ée](?![a-zà-ÿ])/gi, 'régulière et fiable'],
  [/\ben\s+r[ée]gime\s+mod[ée]r[ée](?![a-zà-ÿ])/gi, 'de façon régulière'],
  [/\br[ée]gime\s+mod[ée]r[ée](?![a-zà-ÿ])/gi,      'expression régulière'],
  [/\ben\s+r[ée]gime\s+ordinaire\b/gi,   'en situation courante'],
  [/\ben\s+r[ée]gime\s+courant\b/gi,     'en situation courante'],
  [/\br[ée]gime\s+(ordinaire|courant)\b/gi, 'situation courante'],
  [/\ble\s+r[ée]gime\b/gi,               'le niveau'],
  [/\bs'?allume\b/gi,                    "s'enclenche"],
  //   Les niveaux de mesure eux-mêmes, entre parenthèses ou non.
  [/\s*\((?:ÉLEV[ÉE]E?|MOYENN?E?|FAIBLE|NULLE|ABSENTE)\)/g, ''],
  [/\b\d+\s+(?:[ÉE]LEV[ÉE]S?|MOYENS?|FAIBLES?|NULLES?)\b/gi, ''],
  [/\b(?:[ÉE]LEV[ÉE]E?|MOYENNE?|FAIBLE)\s+r[ée]guliers?\b/gi, ''],
  [/\bau\s+niveau\s+(?:[ÉE]LEV[ÉE]|MOYEN|FAIBLE)\b/gi, 'au même niveau'],
  [/\bniveau\s+(?:[ÉE]LEV[ÉE]|MOYEN|FAIBLE)\b/gi, 'ce niveau'],
  //   Blocage du 24/08 18h01 (« Cette disposition ») + jargon banni par le socle :
  //   « à pleine intensité », « intensité partielle », « diagnostique »,
  //   « disposition », « pattern ». Le socle le demandait aux agents ; un agent
  //   l'a écrit quand même. Désormais mécanique, ici.
  //   ⚠️ \b devant « à » ne matche jamais (accent) : on capture le caractère
  //   précédent et on le restitue.
  [/(^|[^a-zà-ÿ])[àa]\s+pleine\s+intensit[ée](?![a-zà-ÿ])/gi,  '$1à sa pleine expression'],
  [/(^|[^a-zà-ÿ])[àa]\s+(?:demi|faible)\s+intensit[ée](?![a-zà-ÿ])/gi, '$1de façon partielle'],
  [/\bpleine\s+intensit[ée](?![a-zà-ÿ])/gi,  'pleine expression'],
  [/\bintensit[ée]\s+partielle\b/gi,      'expression partielle'],
  [/\b(?:demi|faible)\s+intensit[ée](?![a-zà-ÿ])/gi, 'expression partielle'],
  //   « pattern d'activation » se traite entier, AVANT la règle « activation »,
  //   sinon elle produirait « pattern d'manifestations ».
  [/\bpatterns?\s+d['’]activations?\b/gi, 'fonctionnement récurrent'],
  [/\bpatterns\b/gi,                      'fonctionnements récurrents'],
  [/\bpattern\b/gi,                       'fonctionnement récurrent'],
  [/\bdiagnostiques\b/gi,                 "riches d'enseignement"],
  [/\bdiagnostique\b/gi,                  "riche d'enseignement"],
  //   « disposition » : formes déterminées seulement — le mot nu casserait
  //   « les moyens à sa disposition ». Le contrôle ne refuse que
  //   « cette disposition » : ces formes couvrent le blocage et au-delà.
  [/\bcette\s+disposition\b/gi,           'cette manière de fonctionner'],
  [/\bces\s+dispositions\b/gi,            'ces manières de fonctionner'],
  [/\bune\s+disposition\b/gi,             'une manière de fonctionner'],
  [/\bdispositions\s+cognitives\b/gi,     'manières de fonctionner'],
  [/\bdisposition\s+cognitive\b/gi,       'manière de fonctionner'],
  [/\bdensit[ée]s?\b/gi,                  'fréquence'],
  [/\bactivations?\b/gi,                  'manifestations'],
  [/\b\d+\s+sur\s+\d+\b/g,                ''],
  [/\b\d+\/\d+\b/g,                       ''],

  // — vocabulaire hérité, abandonné par R5bis —
  //   `type_ecarte` dit encore « Pas palier 4 (…) · Pas palier 6 (…) ».
  //   Les paliers n'existent plus : trois zones, des types dedans, aucune
  //   supériorité. Ce champ sert au contrôle de cohérence R8, il n'est jamais
  //   affiché — mais un agent l'a recopié dans un texte visible le 24/08.
  //   Ce qu'il ne reçoit pas, il ne peut pas le répéter.
  [/\bpas\s+palier\s*\d+\b/gi,           'type voisin écarté'],
  [/\bpaliers?\s*\d+\b/gi,               'type voisin'],
  [/\bpaliers?\b/gi,                      'type'],
  [/\bniveau\s+[1-9]\b/gi,                'type'],
  [/\benvironnement\s+(STRAT[ÉE]GIQUE|OP[ÉE]RATIONNEL|EX[ÉE]CUTION)\b/gi, 'zone'],
  [/\s*·?\s*type\s+[AF](?![a-zà-ÿ])/gi,     ''],
  [/\s*\(\s*[1-9]\s*\)\s*·?/g,             ' '],

  // — les noms de situations en majuscules, tels qu'ils apparaissent dans les
  //   textes de mesure : « en ANIMAL », « sur WEEKEND », « SOMMEIL 5/5 » —
  [/\b(?:en|sur|dans)\s+ANIMAL(?:_\d)?\b/g,  'sur une responsabilité confiée'],
  [/\b(?:en|sur|dans)\s+WEEK-?END\b/g,       'dans un projet collectif'],
  [/\b(?:en|sur|dans)\s+SOMMEIL\b/g,         'sur un sujet de fond traité seul'],
  [/\b(?:en|sur|dans)\s+PANNE\b/g,           'dans un incident sous contrainte de temps'],
  [/\bANIMAL(?:_\d)?\b/g,                    'une responsabilité confiée'],
  [/\bWEEK-?END\b/g,                         'un projet collectif'],
  [/\bSOMMEIL\b/g,                           'un sujet de fond traité seul'],
  [/\bPANNE\b/g,                             'un incident sous contrainte de temps'],

  // — les références de question —
  [/\s*\(P[1-5]Q\d+[^)]*\)/g,             ''],
  [/\bP[1-5]Q\d+\b/g,                     ''],
];

/** Retire les situations du test d'un texte destiné au référent. */
function neutraliser(texte) {
  if (!texte || typeof texte !== 'string') return texte;
  let t = texte;
  for (const [motif, remplacement] of SUBSTITUTIONS) t = t.replace(motif, remplacement);
  // Élisions créées par la substitution : « plutôt que une » → « plutôt qu'une ».
  // Uniquement devant un article indéfini — sinon on casse « parce que le… ».
  t = t
    .replace(/\bque\s+(un|une)\b/gi, (m, art) => "qu'" + art)
    .replace(/\bde\s+(un|une)\b/g, (m, art) => (art === 'un' ? "d'un" : "d'une"))
    .replace(/\bà\s+l\s+repli\b/gi, 'à un repli')
    // Répétitions créées par la substitution : « la responsabilité d'une
    // responsabilité confiée » → « la responsabilité qui lui est confiée ».
    .replace(/responsabilit[ée]\s+d['’]une\s+responsabilit[ée]\s+confi[ée]e/gi,
             'responsabilité qui lui est confiée')
    .replace(/(une\s+responsabilit[ée]\s+confi[ée]e)\s+dont\s+vous\s+avez\s+la\s+garde/gi,
             'une responsabilité qui vous est confiée')
    .replace(/(d['’]une\s+)(responsabilit[ée]\s+confi[ée]e)\s+\2/gi, '$1$2')
    .replace(/\bde\s+l\s+(?=[a-zà-ÿ])/gi, "de la ")   // « de l responsabilité » → « de la »
    .replace(/\bl\s+(responsabilit[ée])/gi, 'la $1')
    .replace(/\s*\(\s*\)/g, '')          // parenthèses vidées par les suppressions
    // ── Débris des libellés fusionnés (26/08) — les scores sont effacés par
    //    doctrine, il ne doit rester ni parenthèse au contenu vidé
    //    (« (fenêtre principale : ) »), ni tiret orphelin en tête, ni
    //    « ( — texte » après effacement d'un score en tête de parenthèse.
    .replace(/\s*\([^()]*[:;]\s*\)/g, '')            // « (fenêtre principale : ) » → supprimé
    .replace(/\s*\(\s*\d+\s*%\s*\)/g, '')            // « (40%) » — un score aussi → supprimé
    .replace(/\b\d+\s*%(?=\s|$|[,.;:)])/g, '')       // « 40% » nu                → supprimé
    .replace(/\(\s*[—–-]\s*/g, '(')                  // « ( — test… »           → « (test… »
    .replace(/^\s*[—–-]\s*/g, '')                    // «  — test… » en tête     → « test… »
    .replace(/\s*,\s*(?=[,.;:])/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([,.;:])/g, '$1')
    .replace(/:\s*:/g, ':');
  return t;
}

/** Applique la neutralisation à tous les textes d'un objet, en profondeur. */
function neutraliserTout(o) {
  if (typeof o === 'string') return neutraliser(o);
  if (Array.isArray(o)) return o.map(neutraliserTout);
  if (o && typeof o === 'object') {
    const r = {};
    for (const k of Object.keys(o)) r[k] = neutraliserTout(o[k]);
    return r;
  }
  return o;
}
function sansAccents(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

// ═══════════════════════════════════════════════════════════════════════════
// R9 · LA SÉLECTION DES GESTES
// Pour chaque pilier : le bloc le plus haut qui EXISTE pour lui.
// Un pilier fonctionnel n'est appelé que sous contrainte : il peut n'avoir aucun
// geste au bloc le plus fréquent. Sans repli, sa carte serait vide — ce serait faux.
// ═══════════════════════════════════════════════════════════════════════════
function selectionnerGestes(lignesPourBilan, narrations, anomalies) {
  const parPilier = {};

  for (const l of lignesPourBilan) {
    const pilier = val(l['pilier_owner']);
    const bloc   = val(l['bloc_final']);          // ⚠️ JAMAIS l['bloc']
    const code   = l['circuit_code'];

    // La table mêle deux natures de lignes : les gestes, et des lignes de
    // STRUCTURE (en-tête générale + un séparateur avant chaque bloc de chaque
    // pilier). Ces dernières n'ont pas de code de geste : on les ignore en
    // silence — ce ne sont pas des anomalies, c'est la forme de la table.
    // Vérifié sur M. R. : 50 lignes = 40 gestes + 10 lignes de structure.
    if (!code) continue;

    // En revanche, une ligne QUI PORTE un geste mais à qui il manque son pilier
    // ou son bloc est une vraie anomalie : on ne peut ni la classer ni la placer.
    if (!pilier || !bloc) {
      anomalies.push(`geste non classable : ${code} (pilier=${pilier || '—'} bloc=${bloc || '—'})`);
      continue;
    }
    (parPilier[pilier] = parPilier[pilier] || {});
    (parPilier[pilier][bloc] = parPilier[pilier][bloc] || []).push({
      code, rang: l['rang_dans_pilier'] || 99
    });
  }

  const resultat = {};
  for (const pilier of Object.keys(parPilier)) {
    let blocRetenu = null;
    for (const bloc of CASCADE) {
      if ((parPilier[pilier][bloc] || []).length > 0) { blocRetenu = bloc; break; }
    }
    if (!blocRetenu) { resultat[pilier] = { bloc_retenu: null, gestes: [] }; continue; }

    const gestes = parPilier[pilier][blocRetenu]
      .sort((a, b) => a.rang - b.rang)
      .map(g => {
        const n = narrations[g.code] || null;
        if (!n) { anomalies.push(`narration introuvable pour le geste ${g.code}`); return null; }
        return {
          code: g.code,
          narration: n.narration,
          renfort:   n.renfort
          // circuit_nom (libellé du référentiel) : NON transmis — D95
          // verbatims : NON transmis — D-PREUVE
        };
      })
      .filter(Boolean);

    resultat[pilier] = { bloc_retenu: blocRetenu, gestes };
  }
  return resultat;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION DU PAYLOAD
// ═══════════════════════════════════════════════════════════════════════════
async function construire(candidat_id) {
  logger.info('Payload grille référent — construction', { candidat_id });
  const manques   = [];
  const anomalies = [];

  // ── 1 · Le socle et son réglage
  const t3 = await airtableService.getEtape1T3Bilan(candidat_id);
  if (!t3) throw new Error(`Grille : aucun bilan T3 pour ${candidat_id}`);
  if (!t3.filtre) manques.push('filtre du socle');

  // La civilité commande l'accord. Elle est portée par le bilan lui-même :
  // une source de moins à interroger, et la même que celle du bilan candidat.
  const civilite = t3.civilite || await airtableService.getCiviliteCandidat(candidat_id).catch(() => null);
  if (!civilite) anomalies.push('civilité absente — accord au masculin par défaut');

  const socleCode = val(t3.pilier_socle) || 'P4';

  // Les gestes du socle ont leur source propre : le JSON filtre_gestes.
  let gestesSocle = [];
  try {
    const brut = t3.filtre_gestes;
    const json = typeof brut === 'string' ? JSON.parse(brut) : (brut || []);
    gestesSocle = (Array.isArray(json) ? json : []).map(g => ({
      code:      g.code || '',
      narration: g.fait || '',
      renfort:   ''
      // g.dit (verbatims) volontairement écarté — D-PREUVE
    })).filter(g => g.narration);
  } catch (e) {
    anomalies.push('filtre_gestes illisible — repli sur la source commune');
  }

  // ── 3 · Les cinq piliers
  const piliersRows = await airtableService.getEtape1T3Piliers(candidat_id);
  const piliers = {};
  for (const p of piliersRows) {
    const code = val(p.pilier);
    if (!code) continue;
    piliers[code] = {
      pilier:   code,
      libelle:  p.pilier_label || '',
      role:     p.pilier_role_label || '',
      mode:     p.pilier_mode || '',
      // ⚠️ Le champ s'appelle `bloc_tres_souvent_candidat` — SANS préfixe `synth_`.
      // Un préfixe supposé a fait échouer trois passages : la synthèse sortait
      // vide et on accusait l'agent. Les noms de champs se lisent, ils ne
      // s'inventent pas. Les deux blocs inférieurs servent à la cascade R9.
      synthese: p.bloc_tres_souvent_candidat || '',
      synthese_souvent:      p.bloc_souvent_candidat || '',
      synthese_occasionnels: p.bloc_occasionnels_candidat || ''
    };
  }
  for (const c of ORDRE_PILIERS) {
    if (!piliers[c]) { manques.push(`pilier ${c} absent`); continue; }
    // Une synthèse vide à la source doit se voir ICI, pas trois agents plus loin.
    if (!piliers[c].synthese && !piliers[c].synthese_souvent && !piliers[c].synthese_occasionnels) {
      manques.push(`aucune synthèse pour ${c} — vérifier le nom du champ en base`);
    }
  }

  // ── 4 · Les gestes : classement (T2, bloc_final) + matière (T3_CIRCUIT)
  const pourBilan   = await airtableService.getEtape1T2CircuitsPourbilan(candidat_id);
  const circuitRows = await airtableService.getEtape1T3Circuits(candidat_id);

  const narrations = {};
  for (const c of circuitRows) {
    const pilier = val(c.pilier);
    const cid    = c.circuit_id || '';
    const entree = {
      narration: c.explication_courte_ch4 || c.n1_definition || '',
      // ⚠️ Le champ s'appelle `en_renfort` — pas `renfort_phrase`.
      // Vérifié sur les clés réelles le 20/08 : c'est ce qui faisait sortir
      // « renfort: "" » sur tous les gestes.
      renfort:   c.en_renfort || ''
    };
    // Les codes se présentent sous deux formes selon les tables : « C4 » et « P4C4 ».
    narrations[cid] = entree;
    narrations[`${pilier}${cid}`] = entree;
  }

  const gestesParPilier = selectionnerGestes(pourBilan, narrations, anomalies);
  if (gestesSocle.length) {
    gestesParPilier[socleCode] = { bloc_retenu: 'très souvent', gestes: gestesSocle };
  }
  for (const c of ORDRE_PILIERS) {
    if (!gestesParPilier[c] || !gestesParPilier[c].gestes.length) {
      manques.push(`aucun geste retenu pour ${c}`);
    }
  }

  // ── 5 · Les dimensions
  const t5b = await airtableService.getEtape2T5BRows(candidat_id);
  const dimensions = (t5b || []).map(r => ({
    excellence:    val(r.excellence),
    niveau_global: r.niveau_global || '',
    pattern:       r.pattern || '',
    synthese:      r.synthese || '',
    declencheur:   r.declencheur || '',
    gradient:      r.gradient || ''
  })).filter(d => d.excellence && (d.synthese || d.niveau_global));

  const b4 = await refGrille.getBilan4Profil(candidat_id);
  if (!b4) throw new Error(`Grille : aucun bilan 4 dimensions pour ${candidat_id}`);

  // ── 5bis · LES NIVEAUX DE DIMENSION VIENNENT DU BILAN, PAS DES RÉPONSES ──
  //
  // La chaîne étape 2 (agent_etape2_c_TESTDEC) met le bilan à jour quand le
  // test complémentaire est passé : ETAPE2_BILAN4EXCELLENCES porte alors la
  // mesure fusionnée, tandis que RESPONSES_ETAPE2_ EXCELLENCE garde la mesure
  // d'origine — « Non évalué — test à passer » pour la décentration.
  //
  // ⚠️ Lire les réponses seules affichait « non évalué » à un candidat dont le
  //    test était passé depuis un mois. Le niveau se lit dans le BILAN.
  //    Les textes (constat, déclencheur, gradient) restent dans les réponses ;
  //    pour la décentration, la lecture fusionnée est dans `reserves_globales`.
  const NIVEAUX = {
    ANT: b4.niv_anticipation, ANTICIPATION: b4.niv_anticipation,
    VUE: b4.niv_vue,
    DEC: b4.niv_decentration, DECENTRATION: b4.niv_decentration,
    MET: b4.niv_metacognition, METACOGNITION: b4.niv_metacognition
  };
  for (const d of dimensions) {
    // ⚠️ sansAccents AVANT le filtre A-Z : sinon « Décentration » perd son É
    //    et devient « DCENTRATION » — la clé « DCE » ne matche jamais DEC,
    //    et la dimension garde son libellé d'avant-test. (Piège du 26/08.)
    const cle = sansAccents(String(d.excellence || '')).toUpperCase().replace(/[^A-Z]/g, '');
    const niveau = NIVEAUX[cle] || NIVEAUX[cle.slice(0, 3)];
    if (niveau) {
      d.niveau_global = niveau;          // le niveau fusionné fait foi
      d.niveau_du_bilan = true;
    }
    // La décentration : sa lecture fusionnée vit dans les réserves globales.
    if (/^DEC/.test(cle) && b4.reserves_globales) {
      d.lecture_fusionnee = b4.reserves_globales;
    }
  }
  logger.info('Grille — niveaux de dimension repris du bilan', {
    candidat_id,
    repris: dimensions.filter(d => d.niveau_du_bilan).map(d => d.excellence)
  });

  // ── 5ter · LA DÉCENTRATION A DEUX MESURES — les deux sont transmises ──
  //
  // 1. la fenêtre principale, déjà dans `dimensions` (RESPONSES_ETAPE2_)
  // 2. le test complémentaire, quand il a été passé
  //
  // Le bilan porte leur fusion et la cite : « OBSERVÉE (1/4 — test
  // complémentaire ; fenêtre principale : non évaluée) ». L'agent reçoit donc
  // les DEUX lectures et la réconciliation : il ne choisit pas, il rend compte.
  const testDec = await refGrille.getTestDecentration(candidat_id);
  if (testDec) {
    const iDec = dimensions.findIndex(d =>
      /^DEC/i.test(sansAccents(String(d.excellence || '')).replace(/[^A-Za-z]/g, '')));
    if (iDec >= 0) {
      dimensions[iDec].mesure_complementaire = {
        libelle:     testDec.libelle,
        regime:      testDec.regime,
        synthese:    testDec.synthese,
        declencheur: testDec.declencheur,
        gradient:    testDec.gradient,
        ce_qui_reste: testDec.ce_qui_est
      };
      dimensions[iDec].deux_mesures = true;
    }
    logger.info('Grille — décentration : deux mesures transmises', {
      candidat_id, fenetre_principale: dimensions[iDec]?.niveau_global || '—',
      test_complementaire: testDec.libelle
    });
  }

  // ── 5quater · Cas « test non passé » — mention mécanique (garante, 26/08) ──
  // Exigence : la grille dit toujours l'état le plus à jour du candidat.
  // Si la fenêtre principale est restée sous le seuil et qu'AUCUN résultat de
  // test complémentaire n'existe (jamais passé, ou arrêté en route), la grille
  // doit le dire : la mesure pourra s'affiner, et le profil avec elle.
  // La phrase part d'ici ; l'agent la reprend TELLE QUELLE (prompt_3).
  {
    const iDecM = dimensions.findIndex(d =>
      /^DEC/i.test(sansAccents(String(d.excellence || '')).replace(/[^A-Za-z]/g, '')));
    if (iDecM >= 0) {
      const dM = dimensions[iDecM];
      const niveauM = String(dM.niveau_global || '');
      const sousSeuil = /non [ée]valu[ée]|test [àa] passer|r[ée]serve/i.test(niveauM);
      const dejaFusionne = /test compl[ée]mentaire/i.test(niveauM) || !!dM.mesure_complementaire;
      if (sousSeuil && !dejaFusionne) {
        dM.mention_test_a_venir =
          "La décentration n'a pas encore fait l'objet de sa mesure dédiée : " +
          "un test complémentaire court pourra affiner cette lecture — et, avec elle, " +
          "certaines conclusions du profil.";
        logger.info('Grille — décentration : mention test à venir posée', { candidat_id });
      }
    }
  }

  const type_cognitif = b4.type_cognitif || '';
  if (!type_cognitif) manques.push('type cognitif absent — la tuile ne peut pas être désignée');

  // ── 6 · La clé de tuile — composition MÉCANIQUE
  const cle_tuile = (SOCLE_VERS_CLE[socleCode] && type_cognitif)
    ? `${SOCLE_VERS_CLE[socleCode]}-${sansAccents(type_cognitif).toUpperCase()}`
    : null;
  if (!cle_tuile) manques.push('clé de tuile non composable');

  // ── 7 · Les trois référentiels — chargés INTÉGRALEMENT, ils sont le cadre
  const [tuiles, equivalences, desalignement] = await Promise.all([
    refGrille.getReferentielProfilVsPilier(),
    refGrille.getReferentielTestEquivalentPro(),
    refGrille.getBilanDesalignement()
  ]);

  const tuile = tuiles.find(t => t.cle === cle_tuile) || null;
  if (!tuile) manques.push(`tuile ${cle_tuile} introuvable au référentiel`);

  // ── 8 · Refus de construire sur une matière incomplète (interdit de supposer)
  if (manques.length) {
    logger.error('Payload grille — matière incomplète, construction refusée', { candidat_id, manques, anomalies });
    const err = new Error(`Grille : matière incomplète — ${manques.join(' · ')}`);
    err.manques = manques;
    err.anomalies = anomalies;
    err.revision_humaine = true;
    throw err;
  }
  if (anomalies.length) logger.warn('Payload grille — anomalies non bloquantes', { candidat_id, anomalies });

  // Tout ce qui part vers un agent est d'abord neutralisé : plus aucune
  // situation du test ne peut atteindre un modèle, donc en ressortir.
  const brut = {
    candidat_id,
    civilite: val(civilite) || '',

    profil: {
      cle_tuile,
      socle:         socleCode,
      type_cognitif,
      // ⛔ `type_complet` N'EST PAS TRANSMIS. Il porte trois vestiges de l'ancienne
      //    génération d'un coup : « ORCHESTRATEUR (7) · Environnement STRATÉGIQUE · Type A »
      //      · le numéro (7) → les paliers n'existent plus (R5bis)
      //      · « Environnement » → vocabulaire abandonné
      //      · « Type A » → classement A/F périmé, absent de tous nos référentiels
      //    Un agent l'a recopié tel quel dans la signature. Ce qu'il ne reçoit pas,
      //    il ne peut pas le recopier — c'est plus sûr qu'un contrôle en aval.
      //    La signature est `tuile.titre` (« Orchestrateur de solutions »), et rien d'autre.
      type_ecarte:   b4.type_ecarte  || '',   // contrôle de cohérence R8
      tuile                                    // la tuile ENTIÈRE : elle est le cadre
    },

    socle: {
      pilier:  socleCode,
      libelle: t3.pilier_socle_label || '',
      filtre:  t3.filtre || ''
    },

    piliers: ORDRE_PILIERS.map(c => {
      const bloc = gestesParPilier[c].bloc_retenu;
      // La synthèse doit décrire LE BLOC RETENU, pas un autre : si la cascade
      // est descendue sur « souvent », c'est la synthèse de « souvent » qui
      // explique les gestes affichés.
      const synthese =
        bloc === 'souvent'      ? (piliers[c].synthese_souvent      || piliers[c].synthese) :
        bloc === 'occasionnels' ? (piliers[c].synthese_occasionnels || piliers[c].synthese) :
                                   piliers[c].synthese;
      const { synthese_souvent, synthese_occasionnels, ...reste } = piliers[c];
      return {
        ...reste,
        synthese,
        bloc_retenu: bloc,                            // interne : ne s'affiche jamais (D95)
        gestes:      gestesParPilier[c].gestes
      };
    }),

    // ⚠️ Le champ s'appelle `registres` — pas `ch3_signal_registres`.
    registres_affectifs: t3.registres || '',

    dimensions,
    synthese_dimensions: {
      portrait_un_mot:   b4.portrait_un_mot   || '',
      combinaison:       b4.combinaison       || '',
      reserves_globales: b4.reserves_globales || ''   // lecture seule, jamais affiché
    },

    referentiels: {
      // ── R2 · LES QUATRE LIBELLÉS CANONIQUES — pour NOMMER la situation ──
      // L'agent n'en écrit jamais d'autre : une traduction libre donnerait une
      // formulation différente à chaque bilan.
      libelles_canoniques: [...new Map(
        (equivalences || [])
          .filter(e => e.contexte_test && e.libelle_pro_court)
          .map(e => [e.contexte_test, { contexte: e.contexte_test, libelle: e.libelle_pro_court }])
      ).values()],

      // ── R2bis · LA CLÉ DE TRANSPOSITION — pour transposer le GESTE ──
      // ⚠️ Ces colonnes étaient laissées de côté depuis le 19/08, quand R2 a été
      //    réduite à « quatre libellés et rien d'autre ». C'était une erreur de
      //    ma part : le référentiel a été construit comme une CLÉ DE TRADUCTION
      //    COMPLÈTE (pièce 09), pas comme un dictionnaire de quatre étiquettes.
      //
      //    Sa raison d'être, écrite le 19/08 : « afin qu'aucun constat ne soit
      //    livré sans son équivalent professionnel ». Et son principe fondateur :
      //    « le geste observé dans un contexte EST le geste que la personne
      //    produira dans son équivalent professionnel ».
      //
      //    Sans ces colonnes, l'agent sait remplacer « le week-end » par « un
      //    projet collectif », mais ne sait pas quoi faire de « Google Maps »,
      //    « les Pages jaunes » ou « les post-its » — les objets concrets que
      //    les synthèses citent. C'est ce qui a fait sortir une grille avec
      //    onze objets de la vie privée du candidat.
      //
      //    Usages prévus dès l'origine : les points de vigilance · les questions
      //    d'entretien · le matching.
      cle_transposition: (equivalences || [])
        .filter(e => e.contexte_test && e.outil)
        .map(e => ({
          contexte:      e.contexte_test,
          outil:         e.outil,
          libelle_pro:   e.libelle_pro_court,
          contexte_pro:  e.equivalent_pro_contexte,
          au_travail:    e.ce_que_ca_donne_au_travail
        })),

      // Les questions par contexte, pour retrouver un contexte depuis un identifiant.
      questions_par_contexte: (equivalences || [])
        .filter(e => e.id_question && e.contexte_test)
        .map(e => ({ id: e.id_question, contexte: e.contexte_test })),

      // Vigilances : seuls les blocs qui servent, et leur contenu.
      desalignement: (desalignement || [])
        .filter(d => ['SURDEPLOIEMENT', 'INJONCTIONS', 'IMPACTS'].includes(String(d.bloc_type || '').toUpperCase()))
        .map(d => ({ pilier: d.pilier, bloc_type: d.bloc_type, contenu: d.contenu })),

      version_profils:      new Date().toISOString().slice(0, 10),
      version_equivalences: new Date().toISOString().slice(0, 10)
    },

    anomalies
  };

  // Les référentiels ne contiennent pas de situations : on les préserve tels
  // quels pour que les libellés canoniques et les items restent exacts.
  const referentiels = brut.referentiels;
  const sortie = neutraliserTout({ ...brut, referentiels: null });
  sortie.referentiels = referentiels;

  logger.info('Payload grille — situations neutralisées', { candidat_id });
  return sortie;
}

module.exports = { construire, selectionnerGestes, CASCADE, ORDRE_PILIERS, SOCLE_VERS_CLE };
