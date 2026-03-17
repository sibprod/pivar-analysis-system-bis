// services/algorithmeService.js
// Algorithme v8.2 — Calculs scores profil cognitif
// ZÉRO appel API — calcul mathématique pur
// Input : mission_6_donnees_algo (×25) depuis Agent 3 + données Vérificateur + Agent 2
// Écriture RESPONSES : score_question_calcule, score_question_niveau, question_scoree (×25)
// Écriture BILAN    : ~50 champs (scores piliers, niveaux, profil global, agrégations)

'use strict';

const airtableService = require('./airtableService');
const logger = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES
// ═══════════════════════════════════════════════════════════════════════════

const PILIERS = ['P1', 'P2', 'P3', 'P4', 'P5'];
const NOM_PILIERS = { P1: 'COLLECTE', P2: 'TRI', P3: 'ANALYSE', P4: 'SOLUTIONS', P5: 'EXÉCUTION' };

// Mapping niveau → score milieu de plage (score contenu)
const SCORE_NIVEAU = {
  1: 0.25, 2: 0.75, 3: 1.25, 4: 1.75, 5: 2.25,
  6: 2.75, 7: 3.25, 8: 3.65, 9: 3.90
};

// Mapping score → niveau (plages)
// 3 zones autorisées : Exécution (1-3) | Opérationnelle (4-6) | Stratégique (7-9)
const PLAGES_NIVEAU = [
  { min: 0.00, max: 0.49, niveau: 1, nom: 'EXÉCUTEUR',     zone: 'Exécution' },
  { min: 0.50, max: 0.99, niveau: 2, nom: 'SYSTÉMATIQUE',  zone: 'Exécution' },
  { min: 1.00, max: 1.49, niveau: 3, nom: 'MÉTHODIQUE',    zone: 'Exécution' },
  { min: 1.50, max: 1.99, niveau: 4, nom: 'OPTIMISATEUR',  zone: 'Opérationnelle' },
  { min: 2.00, max: 2.49, niveau: 5, nom: 'ADAPTATEUR',    zone: 'Opérationnelle' },
  { min: 2.50, max: 2.99, niveau: 6, nom: 'DÉTECTEUR',     zone: 'Opérationnelle' },
  { min: 3.00, max: 3.49, niveau: 7, nom: 'ORCHESTRATEUR', zone: 'Stratégique' },
  { min: 3.50, max: 3.79, niveau: 8, nom: 'MAÎTRE',        zone: 'Stratégique' },
  { min: 3.80, max: 4.00, niveau: 9, nom: 'ARCHITECTE',    zone: 'Stratégique' }
];

// Bonus excellences
const BONUS_EXCELLENCE = { nulle: 0, faible: 0.08, moyen: 0.15, 'élevé': 0.25 };

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function round2(v) {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}

function mapNiveau(score) {
  const s = Math.min(Math.max(score, 0), 4.00);
  for (const p of PLAGES_NIVEAU) {
    if (s >= p.min && s <= p.max) return p;
  }
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

// ═══════════════════════════════════════════════════════════════════════════
// CALCUL SCORE PAR QUESTION
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calculer score barème et score contenu pour une question.
 * @param {Object} q - données question fusionnées
 * @returns {Object} scoring complet
 */
function calculerScoreQuestion(q) {
  const simples  = q.simples  || 0;
  const details  = q.details  || 0;
  const soph     = q.soph     || 0;
  const amplitude = q.amplitude_max || 1;
  const excellences = q.excellences || {};

  // ── Score barème ──────────────────────────────────────────────────────────
  const scoreDimsBrut = round2((simples * 0.30) + (details * 0.20) + (soph * 0.90));
  const scoreDimsPlafonne = Math.min(scoreDimsBrut, 2.75);
  const bonusExc = bonusExcellences(excellences);
  const scoreBareme = round2(Math.min(scoreDimsPlafonne + bonusExc, 4.00));
  const plafondAtteint = scoreDimsBrut > 2.75;

  // ── Score contenu ─────────────────────────────────────────────────────────
  const scoreNiveauBase = SCORE_NIVEAU[amplitude] || 0.25;
  const ajustementDims = round2(((simples * 0.05) + (details * 0.03) + (soph * 0.15)) * 0.5);
  const scoreContenu = round2(Math.min(scoreNiveauBase + ajustementDims + bonusExc, 4.00));

  // ── Delta et convergence ──────────────────────────────────────────────────
  const delta = round2(scoreContenu - scoreBareme);
  let convergence;
  if (Math.abs(delta) < 0.10) convergence = 'excellente';
  else if (Math.abs(delta) <= 0.30) convergence = 'acceptable';
  else convergence = 'divergence';

  // ── Niveaux ───────────────────────────────────────────────────────────────
  const niveauBareme  = mapNiveau(scoreBareme);
  const niveauContenu = mapNiveau(scoreContenu);

  // ── Aberration ────────────────────────────────────────────────────────────
  const aberration = (Math.abs(delta) > 0.50) || (amplitude < 3);

  return {
    score_dims_brut:       scoreDimsBrut,
    score_dims_plafonne:   scoreDimsPlafonne,
    ajustement_dimensions: ajustementDims,
    bonus_excellences:     bonusExc,
    score_bareme:          scoreBareme,
    score_niveau_base:     round2(scoreNiveauBase),
    score_contenu:         scoreContenu,
    niveau_bareme:         niveauBareme.niveau,
    nom_niveau_bareme:     niveauBareme.nom,
    niveau_contenu:        niveauContenu.niveau,
    nom_niveau_contenu:    niveauContenu.nom,
    delta,
    convergence,
    plafond_atteint:       plafondAtteint,
    note_plafond:          plafondAtteint ? `Score dimensions plafonné à 2.75 (brut: ${scoreDimsBrut})` : null,
    aberration
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// DISTRIBUTION RÉELLE + ÉCARTS
// ═══════════════════════════════════════════════════════════════════════════

function calculerDistributionReelle(questionsAvecScores) {
  const dist = { P1: [], P2: [], P3: [], P4: [], P5: [] };

  for (const q of questionsAvecScores) {
    const coeur = q.pilier_reponse_coeur;
    if (dist[coeur]) dist[coeur].push(q);
  }

  const ecarts = {};
  for (const p of PILIERS) {
    ecarts[p] = dist[p].length - 5;
  }

  return { dist, ecarts };
}

// ═══════════════════════════════════════════════════════════════════════════
// RÈGLE TOP 5 / EXCLUSION AMPLITUDE < 3
// ═══════════════════════════════════════════════════════════════════════════

function appliquerRegleTop5(questions) {
  if (questions.length === 0) return { retenues: [], regle: 'AUCUNE QUESTION', exclues: [] };

  let retenues = questions;
  let regle;

  if (questions.length >= 5) {
    // Trier par score contenu décroissant, prendre TOP 5
    const tries = [...questions].sort((a, b) => b.scoring.score_contenu - a.scoring.score_contenu);
    retenues = tries.slice(0, 5);
    regle = `TOP 5 (${questions.length} questions >= 5)`;
  } else {
    // Exclure amplitude < 3
    const filtrees = questions.filter(q => (q.amplitude_max || 0) >= 3);
    if (filtrees.length >= 2) {
      retenues = filtrees;
      regle = `Exclusion amplitude < 3 (${filtrees.length} questions restantes)`;
    } else if (filtrees.length === 1) {
      retenues = filtrees;
      regle = 'Score unique (1 question après exclusion amplitude < 3)';
    } else {
      retenues = questions; // Aucune exclusion possible
      regle = 'Pas de questions valides — toutes retenues sans exclusion';
    }
  }

  const idRetenues = new Set(retenues.map(q => q.id_question));
  const exclues = questions.filter(q => !idRetenues.has(q.id_question));

  return { retenues, regle, exclues: exclues.map(q => q.id_question) };
}

// ═══════════════════════════════════════════════════════════════════════════
// CALCUL PAR PILIER
// ═══════════════════════════════════════════════════════════════════════════

function calculerPilier(pilier, questionsReelles) {
  if (questionsReelles.length === 0) {
    return {
      pilier,
      nom: NOM_PILIERS[pilier],
      nb_questions_reel: 0,
      score_contenu_moyen: null,
      score_bareme_moyen: null,
      niveau_moyen: null,
      nom_niveau_moyen: null,
      niveau_max: null,
      nom_niveau_max: null,
      total_simples: 0,
      total_details: 0,
      total_soph: 0
    };
  }

  const { retenues, regle, exclues } = appliquerRegleTop5(questionsReelles);

  if (retenues.length === 0) {
    return {
      pilier,
      nom: NOM_PILIERS[pilier],
      nb_questions_reel: questionsReelles.length,
      score_contenu_moyen: null,
      score_bareme_moyen: null,
      niveau_moyen: null,
      nom_niveau_moyen: null,
      niveau_max: null,
      nom_niveau_max: null,
      total_simples: 0,
      total_details: 0,
      total_soph: 0
    };
  }

  // Scores moyens sur les retenues
  const scoreCont = round2(retenues.reduce((s, q) => s + q.scoring.score_contenu, 0) / retenues.length);
  const scoreBar  = round2(retenues.reduce((s, q) => s + q.scoring.score_bareme, 0) / retenues.length);

  const niveauMoyen  = mapNiveau(scoreCont);
  const niveauBareme = mapNiveau(scoreBar);

  // Niveau max = amplitude max observée sur TOUTES les questions réelles
  const ampMax = Math.max(...questionsReelles.map(q => q.amplitude_max || 1));
  const niveauMax = mapNiveau(SCORE_NIVEAU[ampMax] || 0.25);
  const qNiveauMax = questionsReelles.find(q => (q.amplitude_max || 1) === ampMax);

  // Agrégations dimensions (sur TOUTES les questions réelles, pas seulement retenues)
  const totalSimples  = questionsReelles.reduce((s, q) => s + (q.simples || 0), 0);
  const totalDetails  = questionsReelles.reduce((s, q) => s + (q.details || 0), 0);
  const totalSoph     = questionsReelles.reduce((s, q) => s + (q.soph || 0), 0);

  const delta = round2(scoreCont - scoreBar);
  let convergence;
  if (Math.abs(delta) < 0.10) convergence = 'excellente';
  else if (Math.abs(delta) <= 0.30) convergence = 'acceptable';
  else convergence = 'divergence';

  return {
    pilier,
    nom: NOM_PILIERS[pilier],
    nb_questions_reel: questionsReelles.length,
    nb_questions_theorique: 5,
    regle_appliquee: regle,
    questions_retenues: retenues.map(q => q.id_question),
    questions_exclues: exclues,
    score_contenu_moyen: scoreCont,
    score_bareme_moyen: scoreBar,
    niveau_moyen: niveauMoyen.niveau,
    nom_niveau_moyen: niveauMoyen.nom,
    niveau_bareme: niveauBareme.niveau,
    nom_niveau_bareme: niveauBareme.nom,
    zone: niveauMoyen.zone,
    niveau_max: ampMax,
    nom_niveau_max: niveauMax.nom,
    question_niveau_max: qNiveauMax?.id_question || null,
    total_simples: totalSimples,
    total_details: totalDetails,
    total_soph: totalSoph,
    delta_bareme_contenu: delta,
    convergence
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// POIDS COGNITIF
// ═══════════════════════════════════════════════════════════════════════════

function calculerPoidsCognitif(pilierData, ecart) {
  const nb   = pilierData.nb_questions_reel;
  const e    = Math.abs(ecart);
  const dims = (pilierData.total_simples || 0) + (pilierData.total_details || 0) + (pilierData.total_soph || 0);
  const sc   = pilierData.score_contenu_moyen || 0;
  return round2((nb * 100) + (e * 50) + (dims * 1) + (sc * 10));
}

// ═══════════════════════════════════════════════════════════════════════════
// PROFIL TYPE
// ═══════════════════════════════════════════════════════════════════════════

function determinerProfilType(ecarts) {
  const vals = Object.values(ecarts);
  const aFortConcentration = vals.some(e => e >= 2);
  const aFaibleConcentration = vals.some(e => e <= -2);
  if (aFortConcentration && aFaibleConcentration) return 'CONCENTRÉ';
  if (Math.max(...vals.map(Math.abs)) <= 1) return 'STABLE';
  return 'CONCENTRÉ';
}

// ═══════════════════════════════════════════════════════════════════════════
// AGRÉGATIONS VERBATIMS / MANIFESTATIONS
// ═══════════════════════════════════════════════════════════════════════════

function agregerVerbatims(questionsData) {
  const keys = ['anticipation', 'decentration', 'metacognition', 'vue_systemique'];
  const verbatims = { anticipation: [], decentration: [], metacognition: [], vue_systemique: [] };
  const manifestations = { anticipation: [], decentration: [], metacognition: [], vue_systemique: [] };

  for (const q of questionsData) {
    for (const k of keys) {
      if (q[`${k}_verbatim`]) verbatims[k].push(q[`${k}_verbatim`]);
      if (q[`${k}_manifestation`]) manifestations[k].push(q[`${k}_manifestation`]);
    }
  }

  const result = {};
  for (const k of keys) {
    result[`${k}_verbatims_agreges`]       = verbatims[k].length > 0 ? verbatims[k].join(' | ') : null;
    result[`${k}_manifestations_agreges`]  = manifestations[k].length > 0 ? manifestations[k].join(' | ') : null;
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// AGRÉGATIONS EXCELLENCES PAR SCÉNARIO
// ═══════════════════════════════════════════════════════════════════════════

function agregerExcellencesParScenario(questionsData) {
  const scenarios = { SOMMEIL: [], WEEKEND: [], ANIMAL: [], PANNE: [] };
  const keys = ['anticipation_niveau', 'decentration_niveau', 'metacognition_niveau', 'vue_systemique_niveau'];

  for (const q of questionsData) {
    const sc = q.scenario_nom;
    if (scenarios[sc]) scenarios[sc].push(q);
  }

  const result = {};
  for (const [sc, qs] of Object.entries(scenarios)) {
    if (qs.length === 0) { result[`excellences_${sc}`] = null; continue; }

    // Prendre le niveau MAX observé par excellence sur le scénario
    const niveauOrder = { nulle: 0, faible: 1, moyen: 2, 'élevé': 3 };
    const niveauNames = ['nulle', 'faible', 'moyen', 'élevé'];
    const maxNiveaux = {};
    for (const k of keys) {
      let max = 0;
      for (const q of qs) {
        const niv = (q[k] || 'nulle').toLowerCase();
        if ((niveauOrder[niv] || 0) > max) max = niveauOrder[niv] || 0;
      }
      maxNiveaux[k] = niveauNames[max];
    }
    result[`excellences_${sc}`] = JSON.stringify(maxNiveaux);
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// BOUCLE COGNITIVE (ordre dominant → structurant → moteur3)
// ═══════════════════════════════════════════════════════════════════════════

function construireBoucleCognitive(top3) {
  if (!top3 || top3.length === 0) return null;
  return top3.map(p => `${p.pilier} ${p.nom}`).join(' → ');
}

// ═══════════════════════════════════════════════════════════════════════════
// ZONE GLOBALE
// ═══════════════════════════════════════════════════════════════════════════

function zoneGlobale(niveau) {
  if (niveau >= 7) return 'Stratégique';
  if (niveau >= 4) return 'Opérationnelle';
  return 'Exécution';
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pipeline complet Algorithme.
 *
 * @param {string} session_id
 * @param {Object} candidat - { prenom, nom, email }
 * @param {Array} questionsData - 25 objets fusionnant toutes les données par question :
 *   {
 *     id_question, scenario_nom, pilier (= pilier_question),
 *     pilier_reponse_coeur,           ← du Vérificateur (via RESPONSES)
 *     simples, details, soph,         ← Agent 2 M4/M5
 *     amplitude_max,                  ← mission_6_donnees_algo.piliers.amplitudes[pilier_coeur]
 *     excellences: { anticipation_niveau, decentration_niveau, metacognition_niveau, vue_systemique_niveau },
 *     repond_question, traite_problematique_situation, fait_processus_pilier,  ← Vérificateur
 *     laconique,                      ← Agent 2 M8
 *     anticipation_verbatim, anticipation_manifestation,
 *     decentration_verbatim, decentration_manifestation,
 *     metacognition_verbatim, metacognition_manifestation,
 *     vue_systemique_verbatim, vue_systemique_manifestation
 *   }
 * @param {Object} agent3Syntheses - { P1: synthese, P2: ..., P3:..., P4:..., P5:... } depuis agent3Service
 * @param {Object} agent1Corpus - { section_B: { moteur_cognitif, binome_actif, reaction_flou, signature_cloture } }
 * @returns {Object} output complet de l'algorithme (écrit aussi dans Airtable)
 */
async function run(session_id, candidat, questionsData, agent3Syntheses, agent1Corpus) {
  if (!questionsData || questionsData.length !== 25) {
    throw new Error(`Algo: attendu 25 questions, reçu ${questionsData?.length ?? 0}`);
  }

  logger.info('Algorithme: démarrage calculs', { session_id });

  // ── ÉTAPE 1 : Score par question ─────────────────────────────────────────
  const questionsAvecScores = questionsData.map(q => ({
    ...q,
    scoring: calculerScoreQuestion(q)
  }));

  // Écriture dans RESPONSES (score_question_calcule, score_question_niveau, question_scoree)
  for (const q of questionsAvecScores) {
    await airtableService.updateResponse(q.id_question, session_id, {
      score_question_calcule: q.scoring.score_contenu,
      score_question_niveau:  q.scoring.niveau_contenu,
      question_scoree:        true,
      question_analysee:      true,
      statut_analyse_reponses: 'analyse_ok'   // valeur exacte Single Select Airtable
    });
  }

  logger.info('Algorithme: scores questions écrits dans RESPONSES', { session_id });

  // ── ÉTAPE 2 : Distribution réelle ────────────────────────────────────────
  const { dist, ecarts } = calculerDistributionReelle(questionsAvecScores);

  // ── ÉTAPE 3 : Score par pilier ────────────────────────────────────────────
  const scoresPiliers = {};
  for (const p of PILIERS) {
    scoresPiliers[p] = calculerPilier(p, dist[p]);
  }

  // ── ÉTAPE 4 : TOP 3 + Dominant / Structurant ─────────────────────────────
  const piliersValides = PILIERS
    .filter(p => scoresPiliers[p].score_contenu_moyen !== null)
    .sort((a, b) => (scoresPiliers[b].score_contenu_moyen || 0) - (scoresPiliers[a].score_contenu_moyen || 0));

  const top3 = piliersValides.slice(0, 3);
  const exclus = piliersValides.slice(3);

  // Poids cognitif sur le TOP 3
  const top3AvecPoids = top3.map(p => ({
    pilier: p,
    nom: NOM_PILIERS[p],
    score_contenu: scoresPiliers[p].score_contenu_moyen,
    niveau_moyen: scoresPiliers[p].niveau_moyen,
    nom_niveau_moyen: scoresPiliers[p].nom_niveau_moyen,
    niveau_max: scoresPiliers[p].niveau_max,
    nom_niveau_max: scoresPiliers[p].nom_niveau_max,
    nb_questions_reel: scoresPiliers[p].nb_questions_reel,
    poids_cognitif: calculerPoidsCognitif(scoresPiliers[p], ecarts[p])
  }));
  top3AvecPoids.sort((a, b) => b.poids_cognitif - a.poids_cognitif);

  const dominant   = top3AvecPoids[0] || null;
  const structurant = top3AvecPoids[1] || null;
  const moteur3    = top3AvecPoids[2] || null;

  // Piliers moteurs (liste ordonnée par poids cognitif)
  const piliersMoteurs = top3AvecPoids.map((p, i) => ({
    rang: i + 1,
    role: i === 0 ? 'DOMINANT' : i === 1 ? 'STRUCTURANT' : 'MOTEUR',
    pilier: p.pilier,
    nom: p.nom,
    score_contenu: p.score_contenu,
    niveau_moyen: p.niveau_moyen,
    niveau_max: p.niveau_max,
    nb_questions_reel: p.nb_questions_reel,
    poids_cognitif: p.poids_cognitif
  }));

  // ── ÉTAPE 5 : Niveau global ───────────────────────────────────────────────
  const scoreGlobal = top3.length > 0
    ? round2(top3.reduce((s, p) => s + (scoresPiliers[p].score_contenu_moyen || 0), 0) / top3.length)
    : 0;

  const niveauGlobal = mapNiveau(scoreGlobal);

  // ── ÉTAPE 6 : Profil type ─────────────────────────────────────────────────
  const profilType = determinerProfilType(ecarts);
  const piliersFortConc  = PILIERS.filter(p => ecarts[p] >= 2);
  const piliersFaibleConc = PILIERS.filter(p => ecarts[p] <= -2);
  const piliersConformes = PILIERS.filter(p => Math.abs(ecarts[p]) <= 1);

  // ── ÉTAPE 7 : Agrégations qualité passation ───────────────────────────────
  const tauxRepond        = questionsAvecScores.filter(q => q.repond_question === 'OUI' || q.repond_question === true || q.repond_question === 'oui').length;
  const tauxProblematique = questionsAvecScores.filter(q => q.traite_problematique_situation === 'OUI' || q.traite_problematique_situation === true || q.traite_problematique_situation === 'oui').length;
  const tauxProcessus     = questionsAvecScores.filter(q => q.fait_processus_pilier === 'OUI' || q.fait_processus_pilier === true || q.fait_processus_pilier === 'oui').length;
  const nbLaconiques    = questionsAvecScores.filter(q => q.laconique === true).length;

  // ── ÉTAPE 8 : Verbatims et manifestations agrégés ────────────────────────
  const verbatimsAgreges = agregerVerbatims(questionsAvecScores);

  // ── ÉTAPE 9 : Excellences par scénario ───────────────────────────────────
  const excellencesScenario = agregerExcellencesParScenario(questionsAvecScores);

  // ── ÉTAPE 10 : Dimensions par pilier ─────────────────────────────────────
  const dimsBilan = {};
  for (const p of PILIERS) {
    const sp = scoresPiliers[p];
    dimsBilan[`${p}_simples_total`]       = sp.total_simples || 0;
    dimsBilan[`${p}_simples_synthese`]    = `${sp.total_simples || 0} dimensions simples sur ${sp.nb_questions_reel} questions`;
    dimsBilan[`${p}_sophistiquees_total`] = sp.total_soph || 0;
    dimsBilan[`${p}_sophistiquees_synthese`] = `${sp.total_soph || 0} dimensions sophistiquées sur ${sp.nb_questions_reel} questions`;
  }

  const dimensionsSimples = {};
  const dimensionsSoph = {};
  for (const p of PILIERS) {
    dimensionsSimples[p] = scoresPiliers[p].total_simples || 0;
    dimensionsSoph[p]    = scoresPiliers[p].total_soph || 0;
  }

  // Dimensions supérieures = soph >= 3 par question
  const dimsSup = questionsAvecScores.filter(q => (q.soph || 0) >= 3).map(q => q.id_question);

  // ── ÉTAPE 11 : Boucle cognitive ordre ────────────────────────────────────
  const boucleCognitiveOrdre = construireBoucleCognitive(top3AvecPoids);

  // ── CONSTRUCTION OUTPUT COMPLET ──────────────────────────────────────────
  const outputAlgo = {
    session_ID: session_id,
    candidat: { prenom: candidat.prenom, nom: candidat.nom, email: candidat.email || null },
    date_analyse: new Date().toISOString().split('T')[0],
    version_algorithme: '8.2',

    distribution_cognitive: {
      distribution_theorique: { P1: 5, P2: 5, P3: 5, P4: 5, P5: 5 },
      distribution_reelle: Object.fromEntries(PILIERS.map(p => [p, dist[p].length])),
      ecarts: Object.fromEntries(PILIERS.map(p => [p, ecarts[p] >= 0 ? `+${ecarts[p]}` : `${ecarts[p]}`])),
      profil_type: profilType,
      piliers_forte_concentration: piliersFortConc,
      piliers_faible_concentration: piliersFaibleConc,
      piliers_conformes: piliersConformes
    },

    synthese_globale: {
      niveau_global: niveauGlobal.niveau,
      nom_niveau_global: niveauGlobal.nom,
      score_global: scoreGlobal,
      zone_globale: niveauGlobal.zone,
      base_calcul: 'Moyenne TOP 3 piliers réels (scores CONTENU uniquement)',
      pilier_dominant: dominant ? {
        pilier: dominant.pilier, nom: dominant.nom,
        score_contenu: dominant.score_contenu,
        niveau_moyen: dominant.niveau_moyen, nom_niveau_moyen: dominant.nom_niveau_moyen,
        niveau_max: dominant.niveau_max, nom_niveau_max: dominant.nom_niveau_max,
        nb_questions_reel: dominant.nb_questions_reel, poids_cognitif: dominant.poids_cognitif
      } : null,
      pilier_structurant: structurant ? {
        pilier: structurant.pilier, nom: structurant.nom,
        score_contenu: structurant.score_contenu,
        niveau_moyen: structurant.niveau_moyen, nom_niveau_moyen: structurant.nom_niveau_moyen,
        niveau_max: structurant.niveau_max, nom_niveau_max: structurant.nom_niveau_max,
        nb_questions_reel: structurant.nb_questions_reel, poids_cognitif: structurant.poids_cognitif
      } : null,
      piliers_moteurs: piliersMoteurs,
      piliers_exclus: exclus.map(p => ({
        pilier: p, nom: NOM_PILIERS[p],
        score_contenu: scoresPiliers[p].score_contenu_moyen,
        niveau_moyen: scoresPiliers[p].niveau_moyen,
        nom_niveau_moyen: scoresPiliers[p].nom_niveau_moyen,
        nb_questions_reel: scoresPiliers[p].nb_questions_reel,
        raison: 'Hors TOP 3'
      }))
    },

    scores_par_pilier_reel: Object.fromEntries(
      PILIERS.map(p => [`${p}_${NOM_PILIERS[p]}`, scoresPiliers[p]])
    ),

    statistiques_globales: {
      total_questions_analysees: 25,
      profil_type: profilType,
      taux_repond_question: tauxRepond,
      taux_traite_problematique: tauxProblematique,
      taux_fait_processus_pilier: tauxProcessus,
      profil_laconique: round2(nbLaconiques / 25)
    },

    signature_cognitive: {
      profil_type: profilType,
      pattern_recurrent: boucleCognitiveOrdre,
      coherence_agents: agent3Syntheses?.coherence_globale || null,
      profil_laconique: round2(nbLaconiques / 25),
      moteur_cognitif: agent1Corpus?.section_B?.moteur_cognitif || null,
      binome_actif: agent1Corpus?.section_B?.binome_actif || null,
      reaction_flou: agent1Corpus?.section_B?.reaction_flou || null,
      signature_cloture: agent1Corpus?.section_B?.signature_cloture || null
    }
  };

  // ── ÉCRITURE BILAN ────────────────────────────────────────────────────────
  const bilanFields = {
    // Scores et niveaux par pilier
    ...Object.fromEntries(PILIERS.flatMap(p => [
      [`score_pilier_${p}`, scoresPiliers[p].score_contenu_moyen],
      [`niveau_max_${p}`,   scoresPiliers[p].nom_niveau_max]   // nom ex: "MAÎTRE" pas chiffre
    ])),

    // Profil global
    type_profil_cognitif:      niveauGlobal.nom,
    niveau_profil_cognitif:    niveauGlobal.niveau,
    nom_niveau_profil_cognitif: niveauGlobal.nom,
    zone_profil_cognitif:      niveauGlobal.zone,

    // Piliers
    pilier_dominant_certif:    dominant?.pilier || null,
    pilier_structurant_certif: structurant?.pilier || null,
    piliers_moteurs_certif:    piliersMoteurs.map(p => p.pilier).join(', '),
    boucle_cognitive_ordre:    boucleCognitiveOrdre,

    // Qualité passation
    taux_repond_question:       tauxRepond,
    taux_traite_problematique:  tauxProblematique,
    taux_fait_processus_pilier: tauxProcessus,
    profil_laconique:           round2(nbLaconiques / 25),

    // Verbatims et manifestations agrégés
    ...Object.fromEntries(
      ['anticipation', 'decentration', 'metacognition', 'vue_systemique'].flatMap(k => [
        [`${k}_verbatims_agreges`,      verbatimsAgreges[`${k}_verbatims_agreges`]],
        [`${k}_manifestations_agreges`, verbatimsAgreges[`${k}_manifestations_agreges`]]
      ])
    ),

    // Excellences par scénario
    ...excellencesScenario,

    // Dimensions par pilier
    ...Object.fromEntries(PILIERS.flatMap(p => [
      [`P${p.slice(1)}_simples_total`,          dimsBilan[`${p}_simples_total`]],
      [`P${p.slice(1)}_simples_synthese`,        dimsBilan[`${p}_simples_synthese`]],
      [`P${p.slice(1)}_sophistiquees_total`,     dimsBilan[`${p}_sophistiquees_total`]],
      [`P${p.slice(1)}_sophistiquees_synthese`,  dimsBilan[`${p}_sophistiquees_synthese`]]
    ])),

    dimensions_simples_json:     JSON.stringify(dimensionsSimples),
    dimensions_sophistiquees_json: JSON.stringify(dimensionsSoph),
    dimensions_superieures_liste: dimsSup.join(', ') || null,
    dimensions_superieures_count: dimsSup.length,

    // JSON complet
    synthese_json_complete: JSON.stringify(outputAlgo)
  };

  await airtableService.updateBilan(session_id, bilanFields);

  logger.info('Algorithme: BILAN écrit', {
    session_id,
    niveau_global: niveauGlobal.niveau,
    nom_niveau: niveauGlobal.nom,
    dominant: dominant?.pilier,
    structurant: structurant?.pilier
  });

  return {
    output: outputAlgo,
    bilanFields
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  run,
  calculerScoreQuestion,  // exposé pour tests unitaires
  mapNiveau               // exposé pour tests
};
