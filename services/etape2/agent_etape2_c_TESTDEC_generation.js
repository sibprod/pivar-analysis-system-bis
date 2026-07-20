// services/etape2/agent_etape2_c_TESTDEC_generation.js
// Agent TESTDEC-GEN — Générateur du test complémentaire de décentration (Étape 2c)
//
// Rôle :
//   - Lit le profil Étape 1 du candidat (socle + modes, structurants, fonctionnels)
//     et le référentiel des 7 modes par pilier.
//   - Appelle new-prompts/etape2/prompt_etape2_c_TESTDEC_generation.md qui construit
//     10 mises en situation sur mesure (personnages calibrés par contraste).
//   - Écrit les 10 lignes dans ETAPE2_TEST_DECENTRATION (delete + create).
//
// Déclenché par l'orchestrateur excellences quand le verdict management sort en
// RÉSERVE DE PROTOCOLE (best effort : un échec ici ne bloque pas le bilan).
// Idempotence : si des RÉPONSES existent déjà (test passé ou en cours), on ne
// régénère PAS — une seule passation par candidat.
//
// Pattern : un service par prompt (aligné sur agentT5A / T5B / T5C).

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const PROMPT_PATH  = 'etape2/prompt_etape2_c_TESTDEC_generation.md';
const SERVICE_NAME = 'agent_testdec_gen';

const CHAMPS_REQUIS = ['numero', 'position_candidat', 'compatibilite', 'personnage',
                       'personnage_profil', 'situation_text', 'question_text', 'amorce'];


// ═══════════════════════════════════════════════════════════════════════════
// 🔒 v2.1 « GABARIT + INSERT » (garante, 09/07 — le temps d'attente était
// rédhibitoire). Les 4 moments sont CANONIQUES, validés mot pour mot : ils
// vivent ICI, figés dans le code — instruments standardisés, identiques pour
// tous les candidats. L'IA ne génère plus que la pièce sur mesure : le rappel
// circonstancié (les verbatims du candidat) et les profils internes du codeur.
// Résultat : ~30-60 s de préparation au lieu de plusieurs minutes.
// {{E}} = accord (concerné/concernée). {{RAPPEL}} = verbatims tissés par l'IA.
// {{RACCORD}} = phrase de continuité optionnelle (déjà « . » si vide).
// ═══════════════════════════════════════════════════════════════════════════
// v2.2 (garante, 20/07) : l'ancienne formule (« contribuer au mieux, à votre
// façon ») invitait à la prise en main et biaisait la mesure — constaté sur la
// première passation réelle. L'engagement dit le but, plus la manière.
const ENGAGEMENT = 'Vous vous sentez concerné{{E}} et vous voulez que ce soit une réussite.';

const OUVERTURE_TPL = [
  'Le week-end que vous avez organisé arrive.',
  '',
  'Pour vous remettre dans votre histoire, voici ce que vous aviez répondu en le préparant — vos mots exacts :',
  '',
  '{{RAPPEL}}',
  '',
  'C\'est fait : le week-end est réservé, tout le monde est là. Pendant le séjour, les missions sont réparties — chacun la sienne. Pour bien suivre, on donne un surnom aux amis qui comptent pour la suite :',
  '',
  '• L\'ami « Orga » : celui qui adore organiser — le plus doué du groupe pour ça{{RACCORD}} Il a pris la journée de samedi : « laissez-moi la surprise. »',
  '• L\'amie « Boussole » : elle a vécu près de cette région, elle la connaît de l\'intérieur, sans carte ni programme. Vous construirez la journée de dimanche à deux, elle et vous.',
  '• L\'ami « Vegan Chef » : il adore cuisiner, et il cuisine végétal — c\'est sa façon. Il s\'est proposé pour le repas de samedi soir.',
  '',
  'Et vous : vous avez porté l\'organisation — pendant le séjour, vous veillez à ce qu\'il tienne ses promesses, et vous êtes disponible pour accompagner ceux qui font. L\'objectif : que le week-end soit une réussite pour tout le groupe, du vendredi soir au retour.',
  '',
  'Quatre moments du week-end vont suivre. À chaque fois : ce qui se passe, qui gère quoi, votre objectif — puis racontez ce que vous faites et ce que vous dites, concrètement.',
  '',
  'Dans chacun de ces moments, une mission appartient à quelqu\'un d\'autre, qui a sa façon de faire — et les autres membres du groupe ont chacun la leur. Ce qui nous intéresse, c\'est votre façon d\'agir avec eux tous et avec leurs façons à eux — agir vous-même, les laisser faire, les aider à réussir à leur manière : tout est également légitime. Il n\'y a pas de bonne attitude. Une réponse validée est définitive.'
].join('\n');

const MOMENTS = [
  {
    numero: 1, position_candidat: 'DISPONIBLE', compatibilite: 'INFO_A_TRANSMETTRE',
    personnage: 'l\'ami Orga · l\'ami Terrien',
    situation: [
      'MOMENT 1 / 4 — Vendredi soir',
      '',
      'Ce qui se passe : la journée de samedi est la mission de l\'ami Orga — il l\'a voulue, c\'est sa surprise, il n\'a rien dévoilé au groupe. Vous, vous savez — une confirmation reçue par erreur, puisque c\'est vous qui gériez les réservations : demain, c\'est un vol en montgolfière. Et vous savez autre chose, que vous êtes seul{{E}} à savoir aussi : l\'ami Terrien a une vraie peur du vide — il ne montera pas. Il n\'en parle jamais. Orga l\'ignore.',
      '',
      'Qui gère quoi : la journée de samedi — et tout ce qui la concerne — est la mission d\'Orga : cette information le regarde, et la décision sur sa journée lui appartient. Vous, vous portez le séjour dans son ensemble — vous veillez au résultat commun, sans autorité sur la journée d\'Orga — et ce soir vous êtes disponible.',
      '',
      'L\'objectif commun — celui que tout le groupe partage depuis la préparation : que ce week-end soit une réussite pour tous, et demain samedi en particulier, Terrien compris. ' + ENGAGEMENT
    ].join('\n'),
    question: 'Que faites-vous, là, ce vendredi soir ? (Parler ou pas — à Orga, à Terrien — préparer quelque chose ; attendre ; ne rien faire : tout est possible, c\'est votre façon de gérer cette situation avec les 2 personnes concernées qui nous intéresse.) Racontez concrètement ce que vous faites et ce que vous dites.',
    amorce: 'Ce vendredi soir, voici ce que je fais :'
  },
  {
    numero: 2, position_candidat: 'DUO', compatibilite: 'OPPOSÉE',
    personnage: 'l\'amie Boussole',
    situation: [
      'MOMENT 2 / 4 — Samedi matin',
      '',
      'Ce qui se passe : la journée de dimanche se construit à deux : vous et l\'amie Boussole. Vous lui présentez votre document — horaires, options, réservations possibles. Elle : « Pas de programme — je vous emmène, je connais, on s\'arrête où c\'est bien. » Deux façons opposées.',
      '',
      'Qui gère quoi : dimanche est votre mission commune, à parts égales — ni la vôtre, ni la sienne : aucune de vous deux ne décide seule, la journée se décide ensemble.',
      '',
      'L\'objectif commun — celui que le groupe vous a confié à toutes les deux : un dimanche prêt ce soir, et réussi pour tout le groupe. ' + ENGAGEMENT
    ].join('\n'),
    question: 'Comment faites-vous, ensemble, ce samedi matin ? (Imposer votre document, adopter sa façon, mélanger, autre chose : tout est possible — c\'est votre façon de construire À DEUX qui nous intéresse.) Racontez concrètement ce que vous faites et ce que vous dites.',
    amorce: 'Avec elle, voici comment je fais :'
  },
  {
    numero: 3, position_candidat: 'DISPONIBLE', compatibilite: 'FAÇON_MARQUÉE',
    personnage: 'l\'ami Vegan Chef',
    situation: [
      'MOMENT 3 / 4 — Samedi, fin d\'après-midi',
      '',
      'Ce qui se passe : le repas de ce soir est la mission de l\'ami Vegan Chef — il s\'est proposé, il adore cuisiner, et il cuisine végétal : c\'est sa façon. Le groupe, lui, a déjà dit son envie : barbecue, viande, frites, planches de fromage — peu de verdure. Départ pour le supermarché : lui et vous, chariot en main.',
      '',
      'Qui gère quoi : le repas de ce soir est sa mission — le menu et la cuisine lui appartiennent, c\'est lui qui décide de la composition. Vous, vous l\'accompagnez aux courses, sans autorité sur son menu ; l\'envie du groupe, vous l\'avez entendue comme tout le monde.',
      '',
      'L\'objectif commun — celui que tout le groupe attend de ce soir : un dîner réussi, convivialité et plaisir pour tous, le chef compris. ' + ENGAGEMENT
    ].join('\n'),
    question: 'Comment gérez-vous ces courses, avec lui ? (Le laisser remplir le chariot à sa façon, pousser la liste barbecue du groupe, composer, autre chose : tout est possible — c\'est votre façon de gérer la situation avec lui et avec l\'envie du groupe qui nous intéresse.) Racontez concrètement ce que vous faites et ce que vous dites, dans les rayons.\n\nEt dans la soirée, il vous envoie ce message : « Pour le dessert, j\'hésite entre deux idées et je tourne en rond. Toi, tu aurais déjà tranché. Dis-moi ce que je devrais faire. » Ajoutez à votre réponse le message que vous lui renvoyez, mot pour mot.',
    amorce: 'Au supermarché, voici comment je fais :'
  },
  {
    numero: 4, position_candidat: 'NARRATION', compatibilite: '—',
    personnage: 'récit — Orga, Boussole, Vegan Chef, Terrien',
    situation: [
      'MOMENT 4 / 4 — Le retour',
      '',
      'Ce qui se passe : dans le train du retour, un proche qui connaît tout le groupe — votre fille, par exemple — vous appelle : « Alors, ce week-end ? Raconte ! » Le séjour est derrière vous : la surprise de samedi (la montgolfière — et le cas Terrien), la journée de dimanche avec Boussole, le dîner de Vegan Chef.',
      '',
      'Vous choisissez de lui raconter le week-end à travers les personnes : avec ce que vous avez vécu dans ces moments, qu\'avez-vous appris et compris de la façon de faire de chacun — Orga, Boussole, Vegan Chef, Terrien ? Comment chacun s\'y prend, à sa manière ; ce qui le fait réussir ; ce qui vous a surpris{{E}} chez lui.'
    ].join('\n'),
    question: 'Racontez, pour chacun des quatre, ce que ce week-end vous a fait connaître et comprendre de SA façon de faire — vivant, concret, comme on parle à quelqu\'un qui les connaît tous.',
    amorce: 'Alors tu sais, avec ce qu\'on a vécu ce week-end, voilà ce que je connais et comprends mieux de la façon de faire de chacun :'
  }
];

function assemblerSituations({ rappel, raccord, accordE, profils }) {
  const E = accordE ? 'e' : '';
  const rac = (raccord && String(raccord).trim())
    ? ' — ' + String(raccord).trim().replace(/\.$/, '') + '.'
    : '.';
  const subst = (s) => s.split('{{E}}').join(E).split('{{RAPPEL}}').join(rappel).split('{{RACCORD}}').join(rac);
  return MOMENTS.map((m, i) => ({
    numero:            m.numero,
    position_candidat: m.position_candidat,
    compatibilite:     m.compatibilite,
    personnage:        m.personnage,
    personnage_profil: (profils && profils['m' + m.numero]) || '',
    situation_text:    (m.numero === 1 ? subst(OUVERTURE_TPL) + '\n\n━━━━━━━━\n\n' : '') + subst(m.situation),
    question_text:     subst(m.question),
    amorce:            m.amorce
  }));
}

async function run({ candidat_id }) {
  logger.info('Agent TESTDEC-GEN — démarrage', { candidat_id });

  // Idempotence : ne jamais écraser un test déjà répondu (une passation).
  const existantes = await airtableService.getTestDecentrationRows(candidat_id);
  const dejaRepondu = (existantes || []).some(r => r.response_text && String(r.response_text).trim() !== '');
  if (dejaRepondu) {
    logger.info('Agent TESTDEC-GEN — réponses déjà présentes, génération sautée', { candidat_id });
    return { generated: false, skipped: 'reponses_existantes', cost: 0 };
  }

  // Entrées : profil Étape 1 + référentiel des modes.
  const profil = await airtableService.getEtape1ProfilPourTest(candidat_id);
  if (!profil || !profil.socle || !profil.socle.pilier) {
    throw new Error(`TESTDEC-GEN : profil Étape 1 introuvable ou sans socle pour ${candidat_id}`);
  }
  const referentiel = await airtableService.getReferentielPiliers();
  if (!referentiel || referentiel.length !== 5) {
    throw new Error(`TESTDEC-GEN : référentiel piliers incomplet (${(referentiel || []).length}/5)`);
  }
  const referentiel_modes = {};
  for (const p of referentiel) referentiel_modes[p.pilier_code] = p.modes_liste || '';

  // v1.2 — les circuits : le geste mesuré du candidat par pilier de pensée,
  // et la palette du référentiel dans laquelle le générateur pioche l'opposé.
  // v2.0 — le storytelling réel du candidat : ses 5 réponses week-end (Étape 1).
  const reponses_weekend = await airtableService.getReponsesWeekendPourTest(candidat_id);
  if (!reponses_weekend || reponses_weekend.length === 0) {
    throw new Error(`TESTDEC-GEN v2.0 : aucune réponse WEEKEND Étape 1 pour ${candidat_id}`);
  }
  const circuits_candidat = await airtableService.getCircuitsTopPourTest(candidat_id);
  if (!circuits_candidat || circuits_candidat.length === 0) {
    throw new Error(`TESTDEC-GEN : aucun circuit Étape 1 trouvé pour ${candidat_id}`);
  }
  const referentiel_circuits = await airtableService.getReferentielCircuits();

  // v2.1 — l'IA ne produit QUE la pièce sur mesure (sortie ~1 500 tokens).
  const { result, cost } = await agentBase.callAgent({
    serviceName: SERVICE_NAME,
    promptPath:  PROMPT_PATH,
    payload: {
      candidat_id,
      prenom:            profil.prenom || '',
      reponses_weekend,
      circuits_candidat
    },
    candidatId: candidat_id
  });

  const rappel = result && result.rappel_verbatims;
  if (!rappel || String(rappel).trim().length < 120) {
    throw new Error('TESTDEC-GEN v2.1 : rappel circonstancié manquant ou trop court');
  }
  const situations = assemblerSituations({
    rappel:  String(rappel).trim(),
    raccord: (result && result.raccord_orga) || '',
    accordE: !!(result && result.accord_feminin),
    profils: (result && result.personnage_profils) || {}
  });
  for (const s of situations) {
    for (const c of CHAMPS_REQUIS) {
      if (c === 'personnage_profil') continue; // interne, tolérée vide
      if (s[c] === undefined || s[c] === null || String(s[c]).trim() === '') {
        throw new Error(`TESTDEC-GEN v2.1 : champ "${c}" vide (moment ${s.numero})`);
      }
    }
  }

  const nb = await airtableService.writeTestDecentration(candidat_id, situations);
  logger.info('Agent TESTDEC-GEN — terminé', { candidat_id, situations: nb, cost_usd: (cost || 0).toFixed(4) });
  return { generated: true, situations: nb, cost: cost || 0 };
}

module.exports = { run };
