// services/algorithmeService.js
// Algorithme v8.7 — Calculs scores profil cognitif
// ZÉRO appel API — calcul mathématique pur
//
// ARCHITECTURE v8.5 :
// - Calculs PAR PILIER CŒUR uniquement (pilier_reponse_coeur arbitré par le Vérificateur)
// - Suppression totale des calculs globaux (niveau_global, dominant, structurant, profil_type...)
// - Ces calculs globaux sont désormais du ressort du CERTIFICATEUR (analyse qualitative)
// - Écriture RESPONSES : score_question_calcule, score_question_niveau, statut_analyse_reponses (×25)
// - Écriture BILAN : scores + niveaux + dimensions par pilier + JSON interne consultation
//
// CORRECTION v8.7 — 20/03/2026 :
// - calculerDistributionReelle : lecture pilier_reponse_coeur (clé réelle passée par orchestrateur)
//   avec fallback pilier_reponse_coeur_confirme — corrige nb_q:0 sur tous les piliers
//
// CORRECTION v8.6 — audit 19/03/2026 :
// - agregerExcellencesParPilier() SUPPRIMÉE — pas du ressort de l'Algo (calculatrice pure)
// - excellences_par_pilier_PX SUPPRIMÉ du bilanFields — produit par Agent 3 M5B
// - question_scoree et question_analysee SUPPRIMÉS de l'écriture RESPONSES
//   → ces checkboxes appartiennent respectivement au Vérificateur et à Agent 1

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
    const pilierCoeur = q.pilier_reponse_coeur || q.pilier_reponse_coeur_confirme;
    if (pilierCoeur && dist[pilierCoeur]) dist[pilierCoeur].push(q);
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

// agregerVerbatims supprimée — pas du ressort de l'Algo

// agregerExcellencesParScenario supprimée — pas du ressort de l'Algo

// agregerExcellencesParPilier supprimée v8.6 — pas du ressort de l'Algo
// Ce champ est produit par Agent 3 M5B (analyse qualitative narrative par circuits)
// L'Algo est une calculatrice — il ne produit pas de contenu analytique sur les excellences


async function run(session_id, candidat, questionsData, agent3Syntheses, agent1Corpus) {
  if (!questionsData || questionsData.length !== 25) {
    throw new Error(`Algo: attendu 25 questions, reçu ${questionsData?.length ?? 0}`);
  }
  logger.info('Algorithme v8.5: démarrage calculs par pilier cœur', { session_id });

  // ÉTAPE 1 : Score contenu par question
  const questionsAvecScores = questionsData.map(q => ({ ...q, scoring: calculerScoreQuestion(q) }));

  // Écriture RESPONSES (score CONTENU uniquement)
  // ⚠️ question_scoree appartient au Vérificateur — ne pas réécrire
  // ⚠️ question_analysee appartient à Agent 1 — ne pas réécrire
  for (const q of questionsAvecScores) {
    await airtableService.updateResponse(q.id_question, session_id, {
      score_question_calcule:  q.scoring.score_contenu,
      score_question_niveau:   q.scoring.niveau_contenu,
      statut_analyse_reponses: 'analyse_ok'
    });
  }

  // ÉTAPE 2 : Distribution par pilier_reponse_coeur (pilier_coeur_final du Vérificateur)
  const dist = calculerDistributionReelle(questionsAvecScores);

  // ÉTAPE 3 : Score CONTENU par pilier cœur
  const scoresPiliers = {};
  for (const p of PILIERS) scoresPiliers[p] = calculerPilier(p, dist[p]);

  // ÉTAPE 4 : (qualité passation supprimée — pas du ressort de l'Algo)

  // ÉTAPE 5 : (excellences par pilier supprimées v8.6 — pas du ressort de l'Algo)
  // excellences_par_pilier_PX est produit par Agent 3 M5B (analyse qualitative narrative)

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



  // ── ÉCRITURE BILAN — champs calculatrice pure ──────────────────────────
  const bilanFields = {

    // Scores et niveaux par pilier (× 5)
    ...Object.fromEntries(PILIERS.flatMap(p => [
      [`score_pilier_${p}`, scoresPiliers[p].score_contenu_moyen],
      [`niveau_max_${p}`,   scoresPiliers[p].nom_niveau_max]
    ])),

    // Dimensions par pilier — champs plats (× 5 × 5 = 25 champs)
    ...dimsBilan,

    // NOTE v8.6 : excellences_par_pilier_PX SUPPRIMÉ de l'Algo
    // → produit exclusivement par Agent 3 M5B (analyse qualitative narrative par circuits)
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
