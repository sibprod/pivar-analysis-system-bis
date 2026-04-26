// services/algorithmeService.js
// Algorithme v8.3 — Calculs scores profil cognitif
// ZÉRO appel API — calcul mathématique pur
// Écriture RESPONSES : score_question_calcule, score_question_niveau, question_scoree (x25)
// Écriture BILAN    : scores piliers, niveaux, profil global, agregations
//
// CORRECTION v8.3 — SEPARATION STRICTE DES DEUX SYSTEMES DE CALCUL :
//
// SYSTEME 1 : SCORE BAREME (controle qualite interne)
//   → Calcule mais JAMAIS transmis au Certificateur
//   → Sert uniquement au controle qualite et a la detection d aberrations
//   → Stocke dans outputControle (log interne uniquement)
//
// SYSTEME 2 : SCORE CONTENU (le seul qui compte pour le profil)
//   → Base sur l amplitude observee par Agent 2 (realite cognitive)
//   → Transmis au Certificateur via synthese_json_complete
//   → C est ce score qui determine les niveaux, le dominant, le global
//
// Le Certificateur ne recoit que le score CONTENU et les donnees de fond.
// Il ne voit jamais les scores bareme, deltas, plafonds, aberrations.

'use strict';

const airtableService = require('./airtableService');
const logger          = require('../utils/logger');

const PILIERS     = ['P1', 'P2', 'P3', 'P4', 'P5'];
const NOM_PILIERS = { P1: 'COLLECTE', P2: 'TRI', P3: 'ANALYSE', P4: 'SOLUTIONS', P5: 'EXECUTION' };

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

function calculerScoreQuestion(q) {
  const simples     = q.simples       || 0;
  const details     = q.details       || 0;
  const soph        = q.soph          || 0;
  const amplitude   = q.amplitude_max || 1;
  const excellences = q.excellences   || {};
  const bonusExc    = bonusExcellences(excellences);

  // SYSTEME 1 : Score barème — usage interne uniquement, jamais au Certificateur
  const scoreDimsBrut     = round2((simples * 0.30) + (details * 0.20) + (soph * 0.90));
  const scoreDimsPlafonne = Math.min(scoreDimsBrut, 2.75);
  const plafondAtteint    = scoreDimsBrut > 2.75;
  const scoreBareme       = round2(Math.min(scoreDimsPlafonne + bonusExc, 4.00));
  const niveauBareme      = mapNiveau(scoreBareme);

  // SYSTEME 2 : Score contenu — transmis au Certificateur
  const scoreNiveauBase = SCORE_NIVEAU[amplitude] || 0.25;
  const ajustementDims  = round2(((simples * 0.05) + (details * 0.03) + (soph * 0.15)) * 0.5);
  const scoreContenu    = round2(Math.min(scoreNiveauBase + ajustementDims + bonusExc, 4.00));
  const niveauContenu   = mapNiveau(scoreContenu);

  // Delta — usage interne uniquement
  const delta      = round2(scoreContenu - scoreBareme);
  const aberration = (Math.abs(delta) > 0.50) || (amplitude < 3);
  let convergence;
  if (Math.abs(delta) < 0.10)       convergence = 'excellente';
  else if (Math.abs(delta) <= 0.30) convergence = 'acceptable';
  else                              convergence = 'divergence';

  return {
    // Données CONTENU — transmises au Certificateur
    score_contenu:         scoreContenu,
    niveau_contenu:        niveauContenu.niveau,
    nom_niveau_contenu:    niveauContenu.nom,
    score_niveau_base:     round2(scoreNiveauBase),
    ajustement_dimensions: ajustementDims,
    bonus_excellences:     bonusExc,

    // Données BARÈME — usage interne uniquement (préfixe _ = privé)
    _controle: {
      score_bareme:        scoreBareme,
      niveau_bareme:       niveauBareme.niveau,
      nom_niveau_bareme:   niveauBareme.nom,
      score_dims_brut:     scoreDimsBrut,
      score_dims_plafonne: scoreDimsPlafonne,
      plafond_atteint:     plafondAtteint,
      delta,
      convergence,
      aberration
    }
  };
}

function calculerDistributionReelle(questionsAvecScores) {
  const dist = { P1: [], P2: [], P3: [], P4: [], P5: [] };
  for (const q of questionsAvecScores) {
    if (dist[q.pilier_reponse_coeur]) dist[q.pilier_reponse_coeur].push(q);
  }
  const ecarts = {};
  for (const p of PILIERS) ecarts[p] = dist[p].length - 5;
  return { dist, ecarts };
}

function appliquerRegleTop5(questions) {
  if (questions.length === 0) return { retenues: [], regle: 'AUCUNE QUESTION', exclues: [] };
  let retenues, regle;
  if (questions.length >= 5) {
    retenues = [...questions].sort((a, b) => b.scoring.score_contenu - a.scoring.score_contenu).slice(0, 5);
    regle = `TOP 5 (${questions.length} questions >= 5)`;
  } else {
    const filtrees = questions.filter(q => (q.amplitude_max || 0) >= 3);
    if (filtrees.length >= 1) {
      retenues = filtrees;
      regle = `Exclusion amplitude < 3 (${filtrees.length} restantes)`;
    } else {
      retenues = questions;
      regle = 'Toutes retenues (aucune exclusion possible)';
    }
  }
  const idR = new Set(retenues.map(q => q.id_question));
  return { retenues, regle, exclues: questions.filter(q => !idR.has(q.id_question)).map(q => q.id_question) };
}

function calculerPilier(pilier, questionsReelles) {
  const vide = {
    pilier, nom: NOM_PILIERS[pilier],
    nb_questions_reel: questionsReelles.length, nb_questions_theorique: 5,
    score_contenu_moyen: null, niveau_moyen: null, nom_niveau_moyen: null, zone: null,
    niveau_max: null, nom_niveau_max: null, question_niveau_max: null,
    total_simples: 0, total_details: 0, total_soph: 0,
    regle_appliquee: 'AUCUNE QUESTION', questions_retenues: [], questions_exclues: []
  };
  if (questionsReelles.length === 0) return vide;

  const { retenues, regle, exclues } = appliquerRegleTop5(questionsReelles);
  if (retenues.length === 0) return { ...vide, regle_appliquee: regle, questions_exclues: exclues };

  const scoreCont    = round2(retenues.reduce((s, q) => s + q.scoring.score_contenu, 0) / retenues.length);
  const niveauMoyen  = mapNiveau(scoreCont);
  const ampMax       = Math.max(...questionsReelles.map(q => q.amplitude_max || 1));
  const niveauMax    = mapNiveau(SCORE_NIVEAU[ampMax] || 0.25);
  const qNiveauMax   = questionsReelles.find(q => (q.amplitude_max || 1) === ampMax);
  const totalSimples = questionsReelles.reduce((s, q) => s + (q.simples || 0), 0);
  const totalDetails = questionsReelles.reduce((s, q) => s + (q.details || 0), 0);
  const totalSoph    = questionsReelles.reduce((s, q) => s + (q.soph    || 0), 0);

  return {
    pilier, nom: NOM_PILIERS[pilier],
    nb_questions_reel: questionsReelles.length, nb_questions_theorique: 5,
    regle_appliquee: regle,
    questions_retenues: retenues.map(q => q.id_question),
    questions_exclues: exclues,
    score_contenu_moyen: scoreCont,
    niveau_moyen: niveauMoyen.niveau, nom_niveau_moyen: niveauMoyen.nom, zone: niveauMoyen.zone,
    niveau_max: ampMax, nom_niveau_max: niveauMax.nom,
    question_niveau_max: qNiveauMax?.id_question || null,
    total_simples: totalSimples, total_details: totalDetails, total_soph: totalSoph
  };
}

function calculerPoidsCognitif(sp, ecart) {
  return round2(
    (sp.nb_questions_reel * 100) +
    (Math.abs(ecart) * 50) +
    ((sp.total_simples + sp.total_details + sp.total_soph) * 1) +
    ((sp.score_contenu_moyen || 0) * 10)
  );
}

function determinerProfilType(ecarts) {
  const vals = Object.values(ecarts);
  if (vals.some(e => e >= 2) && vals.some(e => e <= -2)) return 'CONCENTRÉ';
  if (Math.max(...vals.map(Math.abs)) <= 1) return 'STABLE';
  return 'CONCENTRÉ';
}

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

async function run(session_id, candidat, questionsData, agent3Syntheses, agent1Corpus) {
  if (!questionsData || questionsData.length !== 25) {
    throw new Error(`Algo: attendu 25 questions, reçu ${questionsData?.length ?? 0}`);
  }
  logger.info('Algorithme: démarrage calculs', { session_id });

  // ÉTAPE 1 : Score par question (les deux systèmes)
  const questionsAvecScores = questionsData.map(q => ({ ...q, scoring: calculerScoreQuestion(q) }));

  // Écriture RESPONSES — score CONTENU uniquement
  for (const q of questionsAvecScores) {
    await airtableService.updateResponse(q.id_question, session_id, {
      score_question_calcule:  q.scoring.score_contenu,
      score_question_niveau:   q.scoring.niveau_contenu,
      question_scoree:         true,
      question_analysee:       true,
      statut_analyse_reponses: 'analyse_ok'
    });
  }

  // ÉTAPE 2 : Distribution réelle
  const { dist, ecarts } = calculerDistributionReelle(questionsAvecScores);

  // ÉTAPE 3 : Score CONTENU par pilier
  const scoresPiliers = {};
  for (const p of PILIERS) scoresPiliers[p] = calculerPilier(p, dist[p]);

  // ÉTAPE 4 : TOP 3 + Dominant / Structurant
  const piliersValides = PILIERS
    .filter(p => scoresPiliers[p].score_contenu_moyen !== null)
    .sort((a, b) => (scoresPiliers[b].score_contenu_moyen || 0) - (scoresPiliers[a].score_contenu_moyen || 0));
  const top3  = piliersValides.slice(0, 3);
  const exclus = piliersValides.slice(3);

  const top3AvecPoids = top3.map(p => ({
    pilier: p, nom: NOM_PILIERS[p],
    score_contenu:    scoresPiliers[p].score_contenu_moyen,
    niveau_moyen:     scoresPiliers[p].niveau_moyen,
    nom_niveau_moyen: scoresPiliers[p].nom_niveau_moyen,
    niveau_max:       scoresPiliers[p].niveau_max,
    nom_niveau_max:   scoresPiliers[p].nom_niveau_max,
    nb_questions_reel: scoresPiliers[p].nb_questions_reel,
    poids_cognitif:   calculerPoidsCognitif(scoresPiliers[p], ecarts[p])
  }));
  top3AvecPoids.sort((a, b) => b.poids_cognitif - a.poids_cognitif);

  const dominant    = top3AvecPoids[0] || null;
  const structurant = top3AvecPoids[1] || null;
  const piliersMoteurs = top3AvecPoids.map((p, i) => ({
    rang: i + 1,
    role: i === 0 ? 'DOMINANT' : i === 1 ? 'STRUCTURANT' : 'MOTEUR',
    pilier: p.pilier, nom: p.nom,
    score_contenu: p.score_contenu,
    niveau_moyen: p.niveau_moyen, nom_niveau_moyen: p.nom_niveau_moyen,
    niveau_max: p.niveau_max, nom_niveau_max: p.nom_niveau_max,
    nb_questions_reel: p.nb_questions_reel, poids_cognitif: p.poids_cognitif
  }));

  // ÉTAPE 5 : Niveau global (TOP 3 scores CONTENU)
  const scoreGlobal  = top3.length > 0
    ? round2(top3.reduce((s, p) => s + (scoresPiliers[p].score_contenu_moyen || 0), 0) / top3.length)
    : 0;
  const niveauGlobal = mapNiveau(scoreGlobal);
  const profilType   = determinerProfilType(ecarts);

  // ÉTAPE 6 : Qualité passation
  const tauxRepond        = questionsAvecScores.filter(q => ['OUI', 'oui', true].includes(q.repond_question)).length;
  const tauxProblematique = questionsAvecScores.filter(q => ['OUI', 'oui', true].includes(q.traite_problematique_situation)).length;
  const tauxProcessus     = questionsAvecScores.filter(q => ['OUI', 'oui', true].includes(q.fait_processus_pilier)).length;
  const nbLaconiques      = questionsAvecScores.filter(q => q.laconique === true).length;

  // ÉTAPE 7 : Agrégations
  const verbatimsAgreges    = agregerVerbatims(questionsAvecScores);
  const excellencesScenario = agregerExcellencesParScenario(questionsAvecScores);
  const boucleCognitive     = top3AvecPoids.map(p => `${p.pilier} ${p.nom}`).join(' → ');
  const dimsSup             = questionsAvecScores.filter(q => (q.soph || 0) >= 3).map(q => q.id_question);
  const dimsBilan           = {};
  for (const p of PILIERS) {
    const sp = scoresPiliers[p];
    dimsBilan[`${p}_simples_total`]          = sp.total_simples || 0;
    dimsBilan[`${p}_simples_synthese`]        = `${sp.total_simples || 0} dim simples sur ${sp.nb_questions_reel} questions`;
    dimsBilan[`${p}_sophistiquees_total`]    = sp.total_soph || 0;
    dimsBilan[`${p}_sophistiquees_synthese`] = `${sp.total_soph || 0} dim sophistiquées sur ${sp.nb_questions_reel} questions`;
  }

  // ══════════════════════════════════════════════════════════════════════════
  // OUTPUT CERTIFICATEUR — score CONTENU uniquement
  // Pas de score_bareme, pas de delta, pas de plafond, pas d'aberration
  // ══════════════════════════════════════════════════════════════════════════
  const outputCertificateur = {
    session_ID: session_id,
    candidat: { prenom: candidat.prenom, nom: candidat.nom, email: candidat.email || null },
    date_analyse: new Date().toISOString().split('T')[0],
    version_algorithme: '8.3',

    distribution_cognitive: {
      distribution_theorique:       { P1: 5, P2: 5, P3: 5, P4: 5, P5: 5 },
      distribution_reelle:          Object.fromEntries(PILIERS.map(p => [p, dist[p].length])),
      ecarts:                       Object.fromEntries(PILIERS.map(p => [p, ecarts[p] >= 0 ? `+${ecarts[p]}` : `${ecarts[p]}`])),
      profil_type:                  profilType,
      piliers_forte_concentration:  PILIERS.filter(p => ecarts[p] >= 2),
      piliers_faible_concentration: PILIERS.filter(p => ecarts[p] <= -2),
      piliers_conformes:            PILIERS.filter(p => Math.abs(ecarts[p]) <= 1)
    },

    synthese_globale: {
      niveau_global:     niveauGlobal.niveau,
      nom_niveau_global: niveauGlobal.nom,
      score_global:      scoreGlobal,
      zone_globale:      niveauGlobal.zone,
      base_calcul:       'Moyenne TOP 3 piliers réels (scores CONTENU uniquement)',
      pilier_dominant:   dominant ? {
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
      piliers_exclus:  exclus.map(p => ({
        pilier: p, nom: NOM_PILIERS[p],
        score_contenu:    scoresPiliers[p].score_contenu_moyen,
        niveau_moyen:     scoresPiliers[p].niveau_moyen,
        nom_niveau_moyen: scoresPiliers[p].nom_niveau_moyen,
        nb_questions_reel: scoresPiliers[p].nb_questions_reel,
        raison: 'Hors TOP 3'
      }))
    },

    // Scores par pilier — CONTENU uniquement, score_bareme intentionnellement absent
    scores_par_pilier_reel: Object.fromEntries(PILIERS.map(p => [`${p}_${NOM_PILIERS[p]}`, {
      pilier: scoresPiliers[p].pilier, nom: scoresPiliers[p].nom,
      nb_questions_reel:   scoresPiliers[p].nb_questions_reel,
      regle_appliquee:     scoresPiliers[p].regle_appliquee,
      questions_retenues:  scoresPiliers[p].questions_retenues,
      questions_exclues:   scoresPiliers[p].questions_exclues,
      score_contenu_moyen: scoresPiliers[p].score_contenu_moyen,
      niveau_moyen:        scoresPiliers[p].niveau_moyen,
      nom_niveau_moyen:    scoresPiliers[p].nom_niveau_moyen,
      zone:                scoresPiliers[p].zone,
      niveau_max:          scoresPiliers[p].niveau_max,
      nom_niveau_max:      scoresPiliers[p].nom_niveau_max,
      question_niveau_max: scoresPiliers[p].question_niveau_max,
      total_simples:       scoresPiliers[p].total_simples,
      total_details:       scoresPiliers[p].total_details,
      total_soph:          scoresPiliers[p].total_soph
    }])),

    classement_par_score_contenu: piliersValides.map((p, i) => ({
      rang: i + 1, pilier: p, nom: NOM_PILIERS[p],
      score_contenu:    scoresPiliers[p].score_contenu_moyen,
      niveau_moyen:     scoresPiliers[p].niveau_moyen,
      nom_niveau_moyen: scoresPiliers[p].nom_niveau_moyen,
      niveau_max:       scoresPiliers[p].niveau_max,
      nom_niveau_max:   scoresPiliers[p].nom_niveau_max,
      nb_questions_reel: scoresPiliers[p].nb_questions_reel
    })),

    detail_25_questions: questionsAvecScores.map(q => ({
      id_question:          q.id_question,
      scenario_nom:         q.scenario_nom,
      pilier_question:      q.pilier,
      pilier_reponse_coeur: q.pilier_reponse_coeur,
      conforme:             q.pilier === q.pilier_reponse_coeur,
      simples:              q.simples  || 0,
      details:              q.details  || 0,
      soph:                 q.soph     || 0,
      amplitude_max:        q.amplitude_max || 1,
      bonus_excellences:    q.scoring.bonus_excellences,
      score_niveau_base:    q.scoring.score_niveau_base,
      ajustement_dimensions: q.scoring.ajustement_dimensions,
      score_contenu:        q.scoring.score_contenu,
      niveau_contenu:       q.scoring.niveau_contenu,
      nom_niveau_contenu:   q.scoring.nom_niveau_contenu,
      excellences: {
        anticipation_niveau:   q.anticipation_niveau   || 'nulle',
        decentration_niveau:   q.decentration_niveau   || 'nulle',
        metacognition_niveau:  q.metacognition_niveau  || 'nulle',
        vue_systemique_niveau: q.vue_systemique_niveau || 'nulle'
      }
      // _controle (score_bareme, delta, plafond) : intentionnellement absent
    })),

    statistiques_globales: {
      total_questions_analysees: 25,
      profil_type:               profilType,
      taux_repond_question:      tauxRepond,
      taux_traite_problematique: tauxProblematique,
      taux_fait_processus_pilier: tauxProcessus,
      profil_laconique:          round2(nbLaconiques / 25)
    },

    signature_cognitive: {
      profil_type:       profilType,
      pattern_recurrent: boucleCognitive,
      coherence_agents:  agent3Syntheses?.coherence_globale || null,
      profil_laconique:  round2(nbLaconiques / 25),
      moteur_cognitif:   agent1Corpus?.section_B?.moteur_cognitif   || null,
      binome_actif:      agent1Corpus?.section_B?.binome_actif       || null,
      reaction_flou:     agent1Corpus?.section_B?.reaction_flou      || null,
      signature_cloture: agent1Corpus?.section_B?.signature_cloture  || null
    }
  };

  // ══════════════════════════════════════════════════════════════════════════
  // OUTPUT CONTRÔLE QUALITÉ — usage interne uniquement, jamais au Certificateur
  // ══════════════════════════════════════════════════════════════════════════
  const outputControle = {
    session_ID:         session_id,
    date_analyse:       new Date().toISOString().split('T')[0],
    version_algorithme: '8.3',
    usage:              'CONTRÔLE QUALITÉ INTERNE — NE PAS TRANSMETTRE AU CERTIFICATEUR',
    controle_par_question: questionsAvecScores.map(q => ({
      id_question:   q.id_question,
      amplitude_max: q.amplitude_max,
      score_contenu: q.scoring.score_contenu,
      ...q.scoring._controle
    })),
    nb_aberrations: questionsAvecScores.filter(q => q.scoring._controle.aberration).length
  };

  logger.info('Algorithme: contrôle qualité barème', {
    session_id,
    nb_aberrations: outputControle.nb_aberrations
  });

  // ── ÉCRITURE BILAN ────────────────────────────────────────────────────────
  const bilanFields = {
    // Scores et niveaux par pilier — score CONTENU uniquement
    ...Object.fromEntries(PILIERS.flatMap(p => [
      [`score_pilier_${p}`, scoresPiliers[p].score_contenu_moyen],
      [`niveau_max_${p}`,   scoresPiliers[p].nom_niveau_max]
    ])),

    type_profil_cognitif:       niveauGlobal.nom,
    niveau_profil_cognitif:     niveauGlobal.niveau,
    nom_niveau_profil_cognitif: niveauGlobal.nom,
    zone_profil_cognitif:       niveauGlobal.zone,

    pilier_dominant_certif:    dominant?.pilier    || null,
    pilier_structurant_certif: structurant?.pilier  || null,
    piliers_moteurs_certif:    piliersMoteurs.map(p => p.pilier).join(', '),
    boucle_cognitive_ordre:    boucleCognitive,

    taux_repond_question:       tauxRepond,
    taux_traite_problematique:  tauxProblematique,
    taux_fait_processus_pilier: tauxProcessus,
    profil_laconique:           round2(nbLaconiques / 25),

    ...Object.fromEntries(
      ['anticipation', 'decentration', 'metacognition', 'vue_systemique'].flatMap(k => [
        [`${k}_verbatims_agreges`,      verbatimsAgreges[`${k}_verbatims_agreges`]],
        [`${k}_manifestations_agreges`, verbatimsAgreges[`${k}_manifestations_agreges`]]
      ])
    ),

    ...excellencesScenario,

    ...Object.fromEntries(PILIERS.flatMap(p => [
      [`P${p.slice(1)}_simples_total`,         dimsBilan[`${p}_simples_total`]],
      [`P${p.slice(1)}_simples_synthese`,       dimsBilan[`${p}_simples_synthese`]],
      [`P${p.slice(1)}_sophistiquees_total`,    dimsBilan[`${p}_sophistiquees_total`]],
      [`P${p.slice(1)}_sophistiquees_synthese`, dimsBilan[`${p}_sophistiquees_synthese`]]
    ])),

    dimensions_simples_json:       JSON.stringify(Object.fromEntries(PILIERS.map(p => [p, scoresPiliers[p].total_simples || 0]))),
    dimensions_sophistiquees_json: JSON.stringify(Object.fromEntries(PILIERS.map(p => [p, scoresPiliers[p].total_soph    || 0]))),
    dimensions_superieures_liste:  dimsSup.join(', ') || null,
    dimensions_superieures_count:  dimsSup.length,

    niveau_global:       niveauGlobal.niveau,
    zone_globale:        niveauGlobal.zone,
    score_global:        round2(scoreGlobal),
    profil_type:         profilType,
    distribution_reelle: JSON.stringify(Object.fromEntries(
      PILIERS.map(p => [p, { nb_questions: dist[p].length, ecart: (ecarts[p] >= 0 ? '+' : '') + ecarts[p] }])
    )),
    pattern_emergent: agent1Corpus?.section_C || agent1Corpus?.pattern_emergent || null,

    // JSON transmis au Certificateur — score CONTENU uniquement, jamais barème
    synthese_json_complete: JSON.stringify(outputCertificateur)
  };

  await airtableService.updateBilan(session_id, bilanFields);

  logger.info('Algorithme: BILAN écrit', {
    session_id,
    niveau_global: niveauGlobal.niveau,
    nom_niveau:    niveauGlobal.nom,
    dominant:      dominant?.pilier,
    structurant:   structurant?.pilier,
    score_global:  scoreGlobal
  });

  return {
    output:         outputCertificateur,  // transmis au Certificateur
    outputControle,                        // usage interne uniquement
    bilanFields
  };
}

module.exports = { run, calculerScoreQuestion, mapNiveau };
