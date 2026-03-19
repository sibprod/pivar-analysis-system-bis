// services/algorithmeService.js
// Algorithme v8.5 — Calculs scores profil cognitif
// ZÉRO appel API — calcul mathématique pur
//
// ARCHITECTURE v8.5 :
// - Calculs PAR PILIER CŒUR uniquement (pilier_reponse_coeur arbitré par le Vérificateur)
// - Suppression totale des calculs globaux (niveau_global, dominant, structurant, profil_type...)
// - Ces calculs globaux sont désormais du ressort du CERTIFICATEUR (analyse qualitative)
// - Écriture RESPONSES : score_question_calcule, score_question_niveau, question_scoree (×25)
// - Écriture BILAN : 35 champs par pilier (scores + niveaux + dimensions + details)
//                   + qualité passation + verbatims agrégés + excellences scénarios
//                   + JSON interne consultation

'use strict';

const airtableService = require('./airtableService');
const logger          = require('../utils/logger');

const PILIERS     = ['P1', 'P2', 'P3', 'P4', 'P5'];
const NOM_PILIERS = { P1: 'COLLECTE', P2: 'TRI', P3: 'ANALYSE', P4: 'SOLUTIONS', P5: 'EXÉCUTION' };

const SCORE_NIVEAU = {
  1: 0.25, 2: 0.75, 3: 1.25, 4: 1.75, 5: 2.25,
  6: 2.75, 7: 3.25, 8: 3.65, 9: 3.90
};

const PLAGES_NIVEAU = [
  { min: 0.00, max: 0.49, niveau: 1, nom: 'EXÉCUTEUR',     zone: 'Exécution'      },
  { min: 0.50, max: 0.99, niveau: 2, nom: 'SYSTÉMATIQUE',  zone: 'Exécution'      },
  { min: 1.00, max: 1.49, niveau: 3, nom: 'MÉTHODIQUE',    zone: 'Exécution'      },
  { min: 1.50, max: 1.99, niveau: 4, nom: 'OPTIMISATEUR',  zone: 'Opérationnelle' },
  { min: 2.00, max: 2.49, niveau: 5, nom: 'ADAPTATEUR',    zone: 'Opérationnelle' },
  { min: 2.50, max: 2.99, niveau: 6, nom: 'DÉTECTEUR',     zone: 'Opérationnelle' },
  { min: 3.00, max: 3.49, niveau: 7, nom: 'ORCHESTRATEUR', zone: 'Stratégique'    },
  { min: 3.50, max: 3.79, niveau: 8, nom: 'MAÎTRE',        zone: 'Stratégique'    },
  { min: 3.80, max: 4.00, niveau: 9, nom: 'ARCHITECTE',    zone: 'Stratégique'    }
];

const BONUS_EXCELLENCE = { nulle: 0, faible: 0.08, moyen: 0.15, 'élevé': 0.25 };

function round2(v) { return Math.round((v + Number.EPSILON) * 100) / 100; }

function mapNiveau(score) {
  const s = Math.min(Math.max(score, 0), 4.00);
  for (const p of PLAGES_NIVEAU) { if (s >= p.min && s <= p.max) return p; }
  return PLAGES_NIVEAU[PLAGES_NIVEAU.length - 1];
}

function bonusExcellences(excellences) {
  const keys = ['anticipation_niveau', 'decentration_niveau', 'metacognition_niveau', 'vue_systemique_niveau'];
  let bonus = 0;
  for (const k of keys) {
    const val = (excellences[k] || 'nulle').toLowerCase();
    bonus += BONUS_EXCELLENCE[val] || 0;
  }
  return round2(bonus);
}

// ── SCORE CONTENU par question (Système 2 uniquement — Système 1 barème supprimé) ──
function calculerScoreQuestion(q) {
  const simples     = q.simples       || 0;
  const details     = q.details       || 0;
  const soph        = q.soph          || 0;
  const amplitude   = q.amplitude_max || 1;
  const excellences = q.excellences   || {};
  const bonusExc    = bonusExcellences(excellences);

  const scoreNiveauBase = SCORE_NIVEAU[amplitude] || 0.25;
  const ajustementDims  = round2(((simples * 0.05) + (details * 0.03) + (soph * 0.15)) * 0.5);
  const scoreContenu    = round2(Math.min(scoreNiveauBase + ajustementDims + bonusExc, 4.00));
  const niveauContenu   = mapNiveau(scoreContenu);

  return {
    score_contenu:      scoreContenu,
    niveau_contenu:     niveauContenu.niveau,
    nom_niveau_contenu: niveauContenu.nom,
    bonus_excellences:  bonusExc
  };
}

// ── Distribution par pilier_reponse_coeur (= pilier_coeur_final arbitré par le Vérificateur, renommé par l'orchestrateur) ──
function calculerDistributionReelle(questionsAvecScores) {
  const dist = { P1: [], P2: [], P3: [], P4: [], P5: [] };
  for (const q of questionsAvecScores) {
    if (dist[q.pilier_reponse_coeur_confirme]) dist[q.pilier_reponse_coeur_confirme].push(q);
  }
  return dist;
}

// ── Règle TOP 5 / exclusion amplitude < 3 ──
function appliquerRegleTop5(questions) {
  if (questions.length === 0) return { retenues: [], regle: 'AUCUNE QUESTION', exclues: [] };
  let retenues, regle;
  if (questions.length >= 5) {
    retenues = [...questions].sort((a, b) => b.scoring.score_contenu - a.scoring.score_contenu).slice(0, 5);
    regle = `TOP 5 (${questions.length} questions >= 5)`;
  } else {
    const filtrees = questions.filter(q => (q.amplitude_max || 0) >= 3);
    retenues = filtrees.length >= 1 ? filtrees : questions;
    regle = filtrees.length >= 1
      ? `Exclusion amplitude < 3 (${filtrees.length} restantes)`
      : 'Toutes retenues (aucune exclusion possible)';
  }
  const idR = new Set(retenues.map(q => q.id_question));
  return { retenues, regle, exclues: questions.filter(q => !idR.has(q.id_question)).map(q => q.id_question) };
}

// ── Calcul par pilier cœur ──
function calculerPilier(pilier, questionsReelles) {
  if (questionsReelles.length === 0) return {
    pilier, nom: NOM_PILIERS[pilier],
    nb_questions_reel: 0,
    score_contenu_moyen: null, niveau_moyen: null, nom_niveau_moyen: null, zone: null,
    niveau_max: null, nom_niveau_max: null,
    total_simples: 0, total_details: 0, total_soph: 0,
    regle_appliquee: 'AUCUNE QUESTION'
  };

  const { retenues, regle } = appliquerRegleTop5(questionsReelles);
  if (retenues.length === 0) return {
    pilier, nom: NOM_PILIERS[pilier],
    nb_questions_reel: questionsReelles.length,
    score_contenu_moyen: null, niveau_moyen: null, nom_niveau_moyen: null, zone: null,
    niveau_max: null, nom_niveau_max: null,
    total_simples: 0, total_details: 0, total_soph: 0,
    regle_appliquee: regle
  };

  const scoreCont   = round2(retenues.reduce((s, q) => s + q.scoring.score_contenu, 0) / retenues.length);
  const niveauMoyen = mapNiveau(scoreCont);
  const ampMax      = Math.max(...questionsReelles.map(q => q.amplitude_max || 1));
  const niveauMax   = mapNiveau(SCORE_NIVEAU[ampMax] || 0.25);

  // Totaux sur TOUTES les questions du pilier cœur (pas seulement TOP 5)
  const totalSimples = questionsReelles.reduce((s, q) => s + (q.simples  || 0), 0);
  const totalDetails = questionsReelles.reduce((s, q) => s + (q.details  || 0), 0);
  const totalSoph    = questionsReelles.reduce((s, q) => s + (q.soph     || 0), 0);

  return {
    pilier, nom: NOM_PILIERS[pilier],
    nb_questions_reel: questionsReelles.length,
    regle_appliquee: regle,
    score_contenu_moyen: scoreCont,
    niveau_moyen: niveauMoyen.niveau, nom_niveau_moyen: niveauMoyen.nom, zone: niveauMoyen.zone,
    niveau_max: ampMax, nom_niveau_max: niveauMax.nom,
    total_simples: totalSimples, total_details: totalDetails, total_soph: totalSoph
  };
}

// ── Agrégations verbatims × 4 excellences ──
function agregerVerbatims(questionsData) {
  const keys = ['anticipation', 'decentration', 'metacognition', 'vue_systemique'];
  const v = {}, m = {};
  keys.forEach(k => { v[k] = []; m[k] = []; });
  for (const q of questionsData) {
    for (const k of keys) {
      if (q[`${k}_verbatim`])      v[k].push(q[`${k}_verbatim`]);
      if (q[`${k}_manifestation`]) m[k].push(q[`${k}_manifestation`]);
    }
  }
  const result = {};
  for (const k of keys) {
    result[`${k}_verbatims_agreges`]      = v[k].length > 0 ? v[k].join(' | ') : null;
    result[`${k}_manifestations_agreges`] = m[k].length > 0 ? m[k].join(' | ') : null;
  }
  return result;
}

// ── Excellences par scénario ──
function agregerExcellencesParScenario(questionsData) {
  const scenarios = { SOMMEIL: [], WEEKEND: [], ANIMAL: [], PANNE: [] };
  const keys = ['anticipation_niveau', 'decentration_niveau', 'metacognition_niveau', 'vue_systemique_niveau'];
  for (const q of questionsData) { if (scenarios[q.scenario_nom]) scenarios[q.scenario_nom].push(q); }
  const niveauOrder = { nulle: 0, faible: 1, moyen: 2, 'élevé': 3 };
  const niveauNames = ['nulle', 'faible', 'moyen', 'élevé'];
  const result = {};
  for (const [sc, qs] of Object.entries(scenarios)) {
    if (qs.length === 0) { result[`excellences_${sc}`] = null; continue; }
    const mx = {};
    for (const k of keys) {
      let max = 0;
      for (const q of qs) {
        const niv = (q[k] || 'nulle').toLowerCase();
        if ((niveauOrder[niv] || 0) > max) max = niveauOrder[niv] || 0;
      }
      mx[k] = niveauNames[max];
    }
    result[`excellences_${sc}`] = JSON.stringify(mx);
  }
  return result;
}

// ── Excellences agrégées par pilier cœur (niveau max par excellence sur ce pilier) ──
function agregerExcellencesParPilier(dist) {
  const niveauOrder = { nulle: 0, faible: 1, moyen: 2, 'élevé': 3 };
  const niveauNames = ['nulle', 'faible', 'moyen', 'élevé'];
  const keys = ['anticipation', 'decentration', 'metacognition', 'vue_systemique'];
  const result = {};

  for (const [pilier, questions] of Object.entries(dist)) {
    if (questions.length === 0) { result[pilier] = null; continue; }
    const mx = {};
    for (const k of keys) {
      let maxNiv = 0;
      let bestVerbatim = null, bestManifestation = null, bestContexte = null;
      for (const q of questions) {
        const niv = (q[`${k}_niveau`] || 'nulle').toLowerCase();
        const order = niveauOrder[niv] || 0;
        if (order > maxNiv) {
          maxNiv = order;
          bestVerbatim      = q[`${k}_verbatim`]      || null;
          bestManifestation = q[`${k}_manifestation`] || null;
          bestContexte      = q[`${k}_contexte_activation`] || null;
        }
      }
      mx[k] = {
        niveau:              niveauNames[maxNiv],
        verbatim:            bestVerbatim,
        manifestation:       bestManifestation,
        contexte_activation: bestContexte
      };
    }
    result[pilier] = mx;
  }
  return result;
}


async function run(session_id, candidat, questionsData, agent3Syntheses, agent1Corpus) {
  if (!questionsData || questionsData.length !== 25) {
    throw new Error(`Algo: attendu 25 questions, reçu ${questionsData?.length ?? 0}`);
  }
  logger.info('Algorithme v8.5: démarrage calculs par pilier cœur', { session_id });

  // ÉTAPE 1 : Score contenu par question
  const questionsAvecScores = questionsData.map(q => ({ ...q, scoring: calculerScoreQuestion(q) }));

  // Écriture RESPONSES (score CONTENU uniquement)
  for (const q of questionsAvecScores) {
    await airtableService.updateResponse(q.id_question, session_id, {
      score_question_calcule:  q.scoring.score_contenu,
      score_question_niveau:   q.scoring.niveau_contenu,
      question_scoree:         true,
      question_analysee:       true,
      statut_analyse_reponses: 'analyse_ok'
    });
  }

  // ÉTAPE 2 : Distribution par pilier_reponse_coeur (pilier_coeur_final du Vérificateur)
  const dist = calculerDistributionReelle(questionsAvecScores);

  // ÉTAPE 3 : Score CONTENU par pilier cœur
  const scoresPiliers = {};
  for (const p of PILIERS) scoresPiliers[p] = calculerPilier(p, dist[p]);

  // ÉTAPE 4 : Qualité passation
  const tauxRepond        = questionsAvecScores.filter(q => ['OUI', 'oui', true].includes(q.repond_question)).length;
  const tauxProblematique = questionsAvecScores.filter(q => ['OUI', 'oui', true].includes(q.traite_problematique_situation)).length;
  const tauxProcessus     = questionsAvecScores.filter(q => ['OUI', 'oui', true].includes(q.fait_processus_pilier)).length;
  const nbLaconiques      = questionsAvecScores.filter(q => q.laconique === true).length;

  // ÉTAPE 5 : Agrégations
  const verbatimsAgreges         = agregerVerbatims(questionsAvecScores);
  const excellencesScenario      = agregerExcellencesParScenario(questionsAvecScores);
  const excellencesParPilier     = agregerExcellencesParPilier(dist);

  // Dimensions par pilier (champs plats BILAN)
  const dimsBilan = {};
  for (const p of PILIERS) {
    const sp = scoresPiliers[p];
    const px = `P${p.slice(1)}`;
    dimsBilan[`${px}_simples_total`]          = sp.total_simples || 0;
    dimsBilan[`${px}_simples_synthese`]        = `${sp.total_simples || 0} dim simples sur ${sp.nb_questions_reel} questions`;
    dimsBilan[`${px}_sophistiquees_total`]    = sp.total_soph || 0;
    dimsBilan[`${px}_sophistiquees_synthese`] = `${sp.total_soph || 0} dim sophistiquées sur ${sp.nb_questions_reel} questions`;
    dimsBilan[`PX_details_total_${p}`]        = sp.total_details || 0;
  }

  // JSON interne — consultation uniquement, JAMAIS transmis au Certificateur
  const jsonInterne = {
    session_ID:         session_id,
    candidat:           { prenom: candidat.prenom, nom: candidat.nom },
    date_analyse:       new Date().toISOString().split('T')[0],
    version_algorithme: '8.5',
    usage:              'CONSULTATION INTERNE UNIQUEMENT',
    scores_par_pilier:  Object.fromEntries(PILIERS.map(p => [p, scoresPiliers[p]])),
    nb_questions_par_pilier: Object.fromEntries(PILIERS.map(p => [p, dist[p].length])),
    statistiques_qualite: {
      taux_repond_question:       tauxRepond,
      taux_traite_problematique:  tauxProblematique,
      taux_fait_processus_pilier: tauxProcessus,
      profil_laconique:           round2(nbLaconiques / 25)
    }
  };

  // ── ÉCRITURE BILAN ──────────────────────────────────────────────────────
  const bilanFields = {
    // Scores et niveaux par pilier cœur — BILAN interne uniquement, jamais transmis au Certificateur
    ...Object.fromEntries(PILIERS.flatMap(p => [
      [`score_pilier_${p}`, scoresPiliers[p].score_contenu_moyen],
      [`niveau_max_${p}`,   scoresPiliers[p].nom_niveau_max]
    ])),

    // Qualité passation
    taux_repond_question:       tauxRepond,
    taux_traite_problematique:  tauxProblematique,
    taux_fait_processus_pilier: tauxProcessus,
    profil_laconique:           round2(nbLaconiques / 25),

    // Verbatims agrégés × 4 excellences
    ...Object.fromEntries(
      ['anticipation', 'decentration', 'metacognition', 'vue_systemique'].flatMap(k => [
        [`${k}_verbatims_agreges`,      verbatimsAgreges[`${k}_verbatims_agreges`]],
        [`${k}_manifestations_agreges`, verbatimsAgreges[`${k}_manifestations_agreges`]]
      ])
    ),

    // Excellences par scénario
    ...excellencesScenario,

    // Excellences agrégées par pilier cœur — transmises au Certif dans dossier pilier
    ...Object.fromEntries(
      PILIERS
        .filter(p => excellencesParPilier[p] !== null)
        .map(p => [`excellences_par_pilier_${p}`, JSON.stringify(excellencesParPilier[p])])
    ),

    // Dimensions par pilier cœur (simples + details + soph)
    ...dimsBilan,

    // Agent 1 corpus
    pattern_emergent: agent1Corpus?.section_C || agent1Corpus?.pattern_emergent || null,

    // JSON interne — consultation uniquement
    synthese_json_complete: JSON.stringify(jsonInterne)
  };

  await airtableService.updateBilan(session_id, bilanFields);

  logger.info('Algorithme v8.5: BILAN écrit (calculs par pilier cœur)', {
    session_id,
    piliers: Object.fromEntries(PILIERS.map(p => [p, {
      nb_q: dist[p].length,
      score: scoresPiliers[p].score_contenu_moyen,
      niveau_max: scoresPiliers[p].nom_niveau_max
    }]))
  });

  return {
    // Les champs globaux (niveau_global, dominant, structurant...) sont remplis par le Certificateur
    nom_niveau:     null,
    score_global:   null,
    dominant:       null,
    structurant:    null
  };
}

module.exports = { run, calculerScoreQuestion, mapNiveau };
