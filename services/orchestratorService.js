// services/orchestratorService.js
// Orchestrateur v8.1 — Coordinateur principal du pipeline profil cognitif
// Chaîne stricte : Agent1 (25+1) → Vérificateur (25) → Agent2 (25) → Agent3 (25+5) → Algo → Certificateur
//
// CORRECTIONS v8.1 :
// - Checkpoint étape 3 (Vérificateur) : utilise 'coherence' au lieu de 'pilier_reponse_coeur'
//   → 'pilier_reponse_coeur' est écrit par Agent 1, pas par le Vérificateur
//   → 'coherence' est écrit UNIQUEMENT par le Vérificateur (CONFIRMÉ/CORRIGÉ/MAINTENU_AVEC_RÉSERVE)
// - Skip Vérificateur reconstruit depuis les vrais champs v8 (piliers_actives_final, verification_coeur)
//   au lieu de l'ancien champ 'circuits_actives_pilier_coeur' inexistant dans Airtable
// - Gardes séquentielles : chaque étape vérifie que la précédente est réellement complète
//   avant de démarrer — pas de skip silencieux sur données incomplètes

'use strict';

const airtableService     = require('./airtableService');
const agent1Service       = require('./agent1Service');
const verificateurService = require('./verificateurService');
const agent2Service       = require('./agent2Service');
const agent3Service       = require('./agent3Service');
const algorithmeService   = require('./algorithmeService');
const certificateurService = require('./certificateurService');
const backupService       = require('./backupService');
const logger              = require('../utils/logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS CHECKPOINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Vérifie si une étape est déjà complète sur TOUTES les 25 questions.
 * Le champ doit être non-null ET non-vide sur chaque question.
 */
function etapeDejaFaite(questions, champ) {
  return questions.every(q => q[champ] !== null && q[champ] !== undefined && q[champ] !== '');
}

function bilanChampRenseigne(bilan, champ) {
  return bilan[champ] !== null && bilan[champ] !== undefined && bilan[champ] !== '';
}

/**
 * Garde séquentielle : si le champ requis est absent, lève une erreur explicite.
 * Empêche une étape de tourner sur des données incomplètes de l'étape précédente.
 */
function verifierPrerequisEtape(questions, champRequis, etapePrecedente) {
  if (!etapeDejaFaite(questions, champRequis)) {
    throw new Error(
      `Prérequis manquant pour démarrer : '${champRequis}' absent sur certaines questions. ` +
      `L'étape '${etapePrecedente}' doit être complète avant de continuer.`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// FUSION DES DONNÉES POUR L'ALGORITHME ET LE CERTIFICATEUR
// ═══════════════════════════════════════════════════════════════════════════

function buildQuestionsDataPourAlgo(questions, verifArbitrages, agent2Analyses, agent3Analyses) {
  const verifIdx = {};
  const a2Idx    = {};
  const a3Idx    = {};

  for (const a of verifArbitrages) verifIdx[a.id_question] = a.result;
  for (const a of agent2Analyses)  a2Idx[a.id_question]    = a.result;
  for (const a of agent3Analyses)  a3Idx[a.id_question]    = a.result;

  return questions.map(q => {
    const verif = verifIdx[q.id_question] || {};
    const a2    = a2Idx[q.id_question]    || {};
    const a3    = a3Idx[q.id_question]    || {};

    const arbitrage = verif.verificateur_arbitrage || {};
    const mesure    = a2.agent2_mesure || {};
    const m4        = mesure.mission_4_dimensions_simples?.par_pilier || {};
    const m5        = mesure.mission_5_dimensions_sophistiquees?.par_pilier || {};
    const m6        = mesure.mission_6_excellences || {};
    const m8        = mesure.mission_8_lecture_cognitive || {};
    const m6Algo    = a3.agent3_verification?.mission_6_donnees_algo || {};

    // Pilier cœur final arbitré par le Vérificateur
    const pilierCoeur = arbitrage.pilier_coeur_final || q.pilier_reponse_coeur || q.pilier;

    // Amplitude max depuis mission_6_donnees_algo (interface Agent3 → Algo)
    const amplitudeMax = m6Algo.piliers?.amplitudes?.[pilierCoeur]
      || m6Algo.piliers?.paliers_grilles?.[pilierCoeur]
      || arbitrage.niveau_coeur_final
      || 1;

    // Dimensions sur le pilier cœur
    const simplesCoeur = m4[pilierCoeur]?.total_dimensions_simples || m4[pilierCoeur]?.total || 0;
    const detailsCoeur = m4[pilierCoeur]?.nombre_criteres || 0;
    const sophCoeur    = m5[pilierCoeur]?.nombre || m5[pilierCoeur]?.total || 0;

    // Excellences
    const excellences = {
      anticipation_niveau:   (m6.anticipation_niveau?.niveau   || 'nulle').toLowerCase(),
      decentration_niveau:   (m6.decentration_niveau?.niveau   || 'nulle').toLowerCase(),
      metacognition_niveau:  (m6.metacognition_niveau?.niveau  || 'nulle').toLowerCase(),
      vue_systemique_niveau: (m6.vue_systemique_niveau?.niveau || 'nulle').toLowerCase()
    };

    return {
      id_question:          q.id_question,
      scenario_nom:         q.scenario_nom,
      pilier:               q.pilier,
      pilier_reponse_coeur: pilierCoeur,

      simples:       simplesCoeur,
      details:       detailsCoeur,
      soph:          sophCoeur,
      amplitude_max: amplitudeMax,

      excellences,

      // Qualification passation (Vérificateur)
      repond_question:                q.repond_question === 'oui' || q.repond_question === 'OUI' || q.repond_question === true ? 'OUI' : 'NON',
      traite_problematique_situation: q.traite_problematique_situation === 'oui' || q.traite_problematique_situation === 'OUI' || q.traite_problematique_situation === true ? 'OUI' : 'NON',
      fait_processus_pilier:          q.fait_processus_pilier === 'oui' || q.fait_processus_pilier === 'OUI' || q.fait_processus_pilier === true ? 'OUI' : 'NON',

      // Laconique (Agent 2 M8)
      laconique: m8.laconique || false,

      // Verbatims et manifestations (Agent 2 M6)
      anticipation_verbatim:       m6.anticipation_niveau?.verbatim || null,
      anticipation_manifestation:  m6.anticipation_niveau?.manifestation || null,
      decentration_verbatim:       m6.decentration_niveau?.verbatim || null,
      decentration_manifestation:  m6.decentration_niveau?.manifestation || null,
      metacognition_verbatim:      m6.metacognition_niveau?.verbatim || null,
      metacognition_manifestation: m6.metacognition_niveau?.manifestation || null,
      vue_systemique_verbatim:     m6.vue_systemique_niveau?.verbatim || null,
      vue_systemique_manifestation: m6.vue_systemique_niveau?.manifestation || null,

      // Niveaux excellences à plat
      anticipation_niveau:    excellences.anticipation_niveau,
      decentration_niveau:    excellences.decentration_niveau,
      metacognition_niveau:   excellences.metacognition_niveau,
      vue_systemique_niveau:  excellences.vue_systemique_niveau,

      // Boucles séparées Agent1 (narratif) vs Agent3 (circuits)
      boucles_detectees_agent1: q.boucles_detectees_agent1 || null,
      boucles_detectees_agent3: q.boucles_detectees_agent3 || null,

      // Signaux qualité
      coherence_agent1_agent3:          q.coherence_agent1_agent3 || null,
      profiling_qualifie:               q.profiling_qualifie || null,
      justification_attribution_niveau: q.justification_attribution_niveau || null,

      // Données Vérificateur
      verification_coeur:                           q.verification_coeur || null,
      justification_actions_majoritairement_faites: q.justification_actions_majoritairement_faites || null,

      // Données Agent 2 granulaires
      niveau_sophistication:          q.niveau_sophistication || null,
      liste_dimensions_simples:       q.liste_dimensions_simples || null,
      liste_dimensions_sophistiquees: q.liste_dimensions_sophistiquees || null,
      liste_criteres_details:         q.liste_criteres_details || null,
      zone_amplitude_max:             q.zone_amplitude_max || null,
      detail_par_niveaux:             q.detail_par_niveaux || null,
      plusieurs_niveaux_reponse:      q.plusieurs_niveaux_reponse || null,
      limbique_detail:                q.limbique_detail || null,
      capacites_detectees:            q.capacites_detectees || null,

      // Données Agent 3 granulaires
      circuits_actives:    q.circuits_actives || null,
      lecture_cognitive_m8: q.lecture_cognitive_m8 || null
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RESET — Effacer toutes les analyses précédentes
// ═══════════════════════════════════════════════════════════════════════════

async function resetAnalyses(session_id) {
  logger.info('Orchestrateur: reset analyses', { session_id });

  try {
    const questions = await airtableService.getResponsesBySession(session_id);

    const resetFields = {
      analyse_json_agent1:          null,
      analyse_json_verificateur:    null,
      analyse_json_agent2:          null,
      analyse_json_agent3:          null,
      verification_coeur:           null,
      justification_attribution_pilier_coeur: null,
      justification_actions_majoritairement_faites: null,
      justification_attribution_niveau: null,
      piliers_actives_final:        null,
      circuits_actives:             null,
      boucles_detectees_agent1:     null,
      boucles_detectees_agent3:     null,
      nombre_boucles_agent1:        null,
      nombre_boucles_agent3:        null,
      liste_piliers_actives:        null,
      lecture_cognitive_m8:         null,
      profiling_qualifie:           null,
      coherence_agent1_agent3:      null,
      statut_analyse_reponses:      null,
      limbique_intensite:           null,
      anticipation_niveau:          null,
      decentration_niveau:          null,
      metacognition_niveau:         null,
      vue_systemique_niveau:        null,
      repond_question:              null,
      traite_problematique_situation: null,
      fait_processus_pilier:        null,
      pilier_reponse_coeur:         null,
      coherence:                    null,
      niveau_amplitude_reponse:     null,
      niveau_amplitude_max:         null,
      zone_amplitude_max:           null,
      question_analysee:            false,
      question_scoree:              false,
      limbique_detecte:             false,
      dimensions_simples:           null,
      nombre_criteres_details:      null,
      dimensions_sophistiquees:     null,
      score_question_niveau:        null,
      score_question_calcule:       null
    };

    for (const q of questions) {
      await airtableService.updateResponse(q.id_question, session_id, resetFields);
    }

    const bilan = await airtableService.getBilan(session_id);
    if (bilan) {
      const bilanResetFields = {};
      const bilanFieldsToClear = [
        'synthese_json_complete','coherence_agents','profil_laconique',
        'niveau_global','zone_globale','score_global','profil_type','distribution_reelle','pattern_emergent',
        'taux_repond_question','taux_traite_problematique','taux_fait_processus_pilier',
        'moteur_cognitif','binome_actif','reaction_flou','signature_cloture',
        'score_pilier_P1','niveau_max_P1','score_pilier_P2','niveau_max_P2',
        'score_pilier_P3','niveau_max_P3','score_pilier_P4','niveau_max_P4',
        'score_pilier_P5','niveau_max_P5',
        'type_profil_cognitif','niveau_profil_cognitif','nom_niveau_profil_cognitif',
        'zone_profil_cognitif','pilier_dominant_certif','pilier_structurant_certif',
        'piliers_moteurs_certif','boucle_cognitive_ordre',
        'profil_coché_P1','profil_coché_P2','profil_coché_P3','profil_coché_P4','profil_coché_P5',
        'limbique_detecte','limbique_intensite_max','nb_questions_limbiques',
        'anticipation_niveau','anticipation_pattern','anticipation_declencheur','anticipation_synthese','anticipation_qualification',
        'decentration_niveau','decentration_pattern','decentration_declencheur','decentration_synthese','decentration_qualification',
        'metacognition_niveau','metacognition_pattern','metacognition_declencheur','metacognition_synthese','metacognition_qualification',
        'vue_systemique_niveau','vue_systemique_pattern','vue_systemique_declencheur','vue_systemique_synthese','vue_systemique_qualification',
        'anticipation_verbatims_agreges','anticipation_manifestations_agreges',
        'decentration_verbatims_agreges','decentration_manifestations_agreges',
        'metacognition_verbatims_agreges','metacognition_manifestations_agreges',
        'vue_systemique_verbatims_agreges','vue_systemique_manifestations_agreges',
        'excellences_SOMMEIL','excellences_WEEKEND','excellences_ANIMAL','excellences_PANNE',
        'excellence_dominante','excellence_secondaire','profil_excellences',
        'circuits_top3_P1','circuits_top3_P2','circuits_top3_P3','circuits_top3_P4','circuits_top3_P5',
        'boucles_detectees_pilier_P1','boucles_detectees_pilier_P2','boucles_detectees_pilier_P3','boucles_detectees_pilier_P4','boucles_detectees_pilier_P5',
        'lecture_cognitive_enrichie_P1','lecture_cognitive_enrichie_P2','lecture_cognitive_enrichie_P3','lecture_cognitive_enrichie_P4','lecture_cognitive_enrichie_P5',
        'profil_neuroscientifique_P1','profil_neuroscientifique_P2','profil_neuroscientifique_P3','profil_neuroscientifique_P4','profil_neuroscientifique_P5',
        'definition_type_profil_cognitif','profil_personnalise','Nom_signature_excellence','section_signature_excellence',
        'section_vigilance_limbique','section_excellences',
        'section_pilier_P1','section_pilier_P2','section_pilier_P3','section_pilier_P4','section_pilier_P5',
        'talent_definition','trois_capacites','pitch_recruteur','amplitude_deployee',
        'pattern_navigation_revele','mantra_profil','points_vigilance_complet','rapport_markdown_complet',
        'agent1_rapport','etape_1_arbitrage_fond','etape_2_lecture_algo','etape_3_diagnostics',
        'statut_certification','notes_certificateur',
        'encadrement_verdict','encadrement_diagnostic','encadrement_scenario','encadrement_bloquant',
        'management_verdict','management_diagnostic','management_scenario','management_bloquant',
        'tableau_comparatif_encadrer_manager',
        'P1_simples_total','P1_simples_synthese','P1_sophistiquees_total','P1_sophistiquees_synthese',
        'P2_simples_total','P2_simples_synthese','P2_sophistiquees_total','P2_sophistiquees_synthese',
        'P3_simples_total','P3_simples_synthese','P3_sophistiquees_total','P3_sophistiquees_synthese',
        'P4_simples_total','P4_simples_synthese','P4_sophistiquees_total','P4_sophistiquees_synthese',
        'P5_simples_total','P5_simples_synthese','P5_sophistiquees_total','P5_sophistiquees_synthese',
        'dimensions_simples_json','dimensions_sophistiquees_json','dimensions_superieures_liste','dimensions_superieures_count'
      ];
      for (const f of bilanFieldsToClear) bilanResetFields[f] = null;
      await airtableService.updateBilan(session_id, bilanResetFields);
    }

    await airtableService.updateVisiteur(session_id, {
      backup_before_agent1: null, backup_after_agent1: null,
      backup_before_agent2: null, backup_after_agent2: null,
      backup_before_algo:   null, backup_after_algo:   null,
      backup_before_certif: null, backup_after_certif: null,
      backup_error:         null
    });

    logger.info('Orchestrateur: reset terminé', { session_id, questions: questions.length });
  } catch (error) {
    logger.warn('Orchestrateur: reset partiel (non bloquant)', { session_id, error: error.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSUS PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

async function processCandidate(session_id) {
  const startTime = Date.now();

  logger.info('Orchestrateur: démarrage pipeline', { session_id });

  // ── Récupérer le visiteur ────────────────────────────────────────────────
  let visiteur;
  try {
    visiteur = await airtableService.getVisiteur(session_id);
    if (!visiteur) throw new Error(`Visiteur introuvable pour session ${session_id}`);
  } catch (error) {
    logger.error('Orchestrateur: visiteur introuvable', { session_id, error: error.message });
    throw error;
  }

  if (visiteur.statut_analyse_pivar === 'terminé') {
    logger.info('Orchestrateur: statut terminé — pipeline bloqué', { session_id });
    return { session_id, statut: 'skip_terminé', duree_ms: 0 };
  }

    if (visiteur.statut_analyse_pivar === 'NOUVEAU') {
    const questionsCheck = await airtableService.getResponsesBySession(session_id);
    const dejaCommence = questionsCheck.some(q => q.analyse_json_agent1);
    if (dejaCommence) {
      logger.info('Orchestrateur: statut NOUVEAU mais analyses partielles détectées — reprise sans reset', { session_id });
    } else {
      logger.info('Orchestrateur: statut NOUVEAU — reset des analyses précédentes', { session_id });
      await resetAnalyses(session_id);
    }
  }

  const candidat = {
    prenom: visiteur.Prenom || visiteur.prenom || '',
    nom:    visiteur.Nom    || visiteur.nom    || '',
    email:  visiteur.Email  || visiteur.email  || ''
  };

  // ── Récupérer les 25 réponses ────────────────────────────────────────────
  let questions;
  try {
    questions = await airtableService.getResponsesBySession(session_id);
    if (!questions || questions.length !== 25) {
      throw new Error(`Attendu 25 questions, reçu ${questions?.length ?? 0}`);
    }
    questions.sort((a, b) => (a.numero_global || 0) - (b.numero_global || 0));
  } catch (error) {
    logger.error('Orchestrateur: erreur chargement questions', { session_id, error: error.message });
    throw error;
  }

  logger.info('Orchestrateur: données chargées', {
    session_id,
    candidat: `${candidat.prenom} ${candidat.nom}`,
    questions: questions.length
  });

  let bilan = await airtableService.getBilan(session_id) || {};
  let agent1Result, verifResult, agent2Result, agent3Result, algoResult;

  // ═══════════════════════════════════════════════════════════════════════
  // ÉTAPE 1 — AGENT 1 : 25 appels question + 1 appel corpus
  // Checkpoint : analyse_json_agent1 non-null sur les 25 questions
  //            + moteur_cognitif non-null dans BILAN (appel corpus fait)
  // ═══════════════════════════════════════════════════════════════════════
  const step1Start = Date.now();

  if (etapeDejaFaite(questions, 'analyse_json_agent1') && bilanChampRenseigne(bilan, 'moteur_cognitif')) {
    logger.info('Orchestrateur: ÉTAPE 1 (Agent 1) déjà faite — skip', { session_id });
    agent1Result = {
      analyses: questions.map(q => ({
        id_question: q.id_question,
        result: safeParseJSON(q.analyse_json_agent1)
      })),
      corpus: {
        section_B: {
          moteur_cognitif:   bilan.moteur_cognitif   || null,
          binome_actif:      bilan.binome_actif       || null,
          reaction_flou:     bilan.reaction_flou      || null,
          signature_cloture: bilan.signature_cloture  || null
        },
        section_C: bilan.pattern_emergent || null
      }
    };
  } else {
    try {
      logger.info('Orchestrateur: ÉTAPE 1 — Agent 1', { session_id });
      await backupService.save(session_id, 'before_agent1', { step: 'debut_agent1', timestamp: new Date().toISOString() });
      agent1Result = await agent1Service.run(session_id, candidat, questions);
      await backupService.save(session_id, 'after_agent1', { analyses: agent1Result.analyses.length, step: 'agent1_ok' });
      logger.info('Orchestrateur: ÉTAPE 1 terminée', {
        session_id,
        duree_ms: Date.now() - step1Start,
        cout: agent1Result.totalCost
      });
    } catch (error) {
      await markError(session_id, 'ÉTAPE 1 Agent 1', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ÉTAPE 3 — VÉRIFICATEUR : 25 arbitrages
  //
  // CORRECTION v8.1 :
  // Checkpoint : 'coherence' non-null sur les 25 questions
  // → 'coherence' est écrit UNIQUEMENT par le Vérificateur
  //   (valeurs : CONFIRMÉ / CORRIGÉ / MAINTENU_AVEC_RÉSERVE)
  // → 'pilier_reponse_coeur' NE PEUT PAS servir de checkpoint
  //   car Agent 1 l'écrit déjà — le Vérificateur serait toujours sauté
  //
  // Skip reconstruit depuis les vrais champs v8 :
  // → piliers_actives_final (écrit par le Vérificateur, liste des piliers)
  // → verification_coeur (justification arbitrage)
  // → repond_question / traite_problematique_situation / fait_processus_pilier
  // ═══════════════════════════════════════════════════════════════════════
  const step3Start = Date.now();

  questions = await airtableService.getResponsesBySession(session_id);
  questions.sort((a, b) => (a.numero_global || 0) - (b.numero_global || 0));

  if (etapeDejaFaite(questions, 'coherence')) {
    logger.info('Orchestrateur: ÉTAPE 3 (Vérificateur) déjà faite — skip', { session_id });
    verifResult = {
      arbitrages: questions.map(q => ({
        id_question: q.id_question,
        result: {
          verificateur_arbitrage: {
            pilier_coeur_final:       q.pilier_reponse_coeur,
            niveau_coeur_final:       safeParseJSON(q.analyse_json_verificateur)?.verificateur_arbitrage?.niveau_coeur_final || null,
            justification_arbitrage:  q.verification_coeur || null,
            reserve_eventuelle:       q.justification_actions_majoritairement_faites || null,
            difficulte_referentiel:   q.justification_attribution_niveau || null
          },
          verificateur_statut:          q.coherence,
          piliers_actives:              safeParseJSON(q.piliers_actives_final) || [],
          boucles_finales:              safeParseJSON(q.analyse_json_verificateur)?.boucles_finales || [],
          sequence_finale:              safeParseJSON(q.analyse_json_verificateur)?.sequence_finale || '',
          repond_question:              q.repond_question,
          traite_problematique_situation: q.traite_problematique_situation,
          fait_processus_pilier:        q.fait_processus_pilier
        }
      }))
    };
  } else {
    try {
      logger.info('Orchestrateur: ÉTAPE 3 — Vérificateur', { session_id });
      verifResult = await verificateurService.run(session_id, questions, agent1Result.analyses);
      await backupService.save(session_id, 'before_agent2', { arbitrages: verifResult.arbitrages.length, step: 'verificateur_ok' });
      logger.info('Orchestrateur: ÉTAPE 3 terminée', {
        session_id,
        duree_ms: Date.now() - step3Start,
        cout: verifResult.totalCost
      });
    } catch (error) {
      await markError(session_id, 'ÉTAPE 3 Vérificateur', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ÉTAPE 4 — AGENT 2 : mesures (25 questions)
  // Checkpoint : analyse_json_agent2 non-null sur les 25 questions
  // Garde : 'coherence' doit être rempli (Vérificateur terminé)
  // ═══════════════════════════════════════════════════════════════════════
  const step4Start = Date.now();

  questions = await airtableService.getResponsesBySession(session_id);
  questions.sort((a, b) => (a.numero_global || 0) - (b.numero_global || 0));

  if (etapeDejaFaite(questions, 'analyse_json_agent2')) {
    logger.info('Orchestrateur: ÉTAPE 4 (Agent 2) déjà faite — skip', { session_id });
    agent2Result = {
      analyses: questions.map(q => ({
        id_question: q.id_question,
        result: safeParseJSON(q.analyse_json_agent2)
      }))
    };
  } else {
    // Garde séquentielle : Vérificateur doit être complet
    verifierPrerequisEtape(questions, 'coherence', 'Vérificateur (ÉTAPE 3)');

    try {
      logger.info('Orchestrateur: ÉTAPE 4 — Agent 2', { session_id });
      agent2Result = await agent2Service.run(session_id, questions, verifResult.arbitrages);
      await backupService.save(session_id, 'after_agent2', { analyses: agent2Result.analyses.length, step: 'agent2_ok' });
      logger.info('Orchestrateur: ÉTAPE 4 terminée', {
        session_id,
        duree_ms: Date.now() - step4Start,
        cout: agent2Result.totalCost
      });
    } catch (error) {
      await markError(session_id, 'ÉTAPE 4 Agent 2', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ÉTAPE 5 — AGENT 3 : circuits + synthèses pilier (25 + 5 appels)
  // Checkpoint : analyse_json_agent3 non-null sur les 25 questions
  //            + circuits_top3_P1 non-null dans BILAN (synthèses faites)
  // Garde : 'analyse_json_agent2' doit être rempli (Agent 2 terminé)
  // ═══════════════════════════════════════════════════════════════════════
  const step5Start = Date.now();

  questions = await airtableService.getResponsesBySession(session_id);
  questions.sort((a, b) => (a.numero_global || 0) - (b.numero_global || 0));
  bilan = await airtableService.getBilan(session_id) || {};

  if (etapeDejaFaite(questions, 'analyse_json_agent3') && bilanChampRenseigne(bilan, 'circuits_top3_P1')) {
    logger.info('Orchestrateur: ÉTAPE 5 (Agent 3) déjà faite — skip', { session_id });
    agent3Result = {
      analyses: questions.map(q => ({
        id_question: q.id_question,
        result: safeParseJSON(q.analyse_json_agent3)
      })),
      syntheses: {
        P1: buildSyntheseFromBilan(bilan, 'P1'),
        P2: buildSyntheseFromBilan(bilan, 'P2'),
        P3: buildSyntheseFromBilan(bilan, 'P3'),
        P4: buildSyntheseFromBilan(bilan, 'P4'),
        P5: buildSyntheseFromBilan(bilan, 'P5')
      }
    };
  } else {
    // Garde séquentielle : Agent 2 doit être complet
    verifierPrerequisEtape(questions, 'analyse_json_agent2', 'Agent 2 (ÉTAPE 4)');

    try {
      logger.info('Orchestrateur: ÉTAPE 5 — Agent 3', { session_id });
      agent3Result = await agent3Service.run(
        session_id, questions, verifResult.arbitrages, agent2Result.analyses
      );
      await backupService.save(session_id, 'before_algo', {
        analyses: agent3Result.analyses.length,
        syntheses: Object.keys(agent3Result.syntheses).length,
        step: 'agent3_ok'
      });
      logger.info('Orchestrateur: ÉTAPE 5 terminée', {
        session_id,
        duree_ms: Date.now() - step5Start,
        cout: agent3Result.totalCost
      });
    } catch (error) {
      await markError(session_id, 'ÉTAPE 5 Agent 3', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ÉTAPE 6 — ALGORITHME : calculs purs
  // Checkpoint : synthese_json_complete non-null dans BILAN
  // Garde : circuits_top3_P1 doit être rempli dans BILAN (Agent 3 terminé)
  // ═══════════════════════════════════════════════════════════════════════
  const step6Start = Date.now();

  bilan = await airtableService.getBilan(session_id) || {};

  if (bilanChampRenseigne(bilan, 'synthese_json_complete')) {
    logger.info('Orchestrateur: ÉTAPE 6 (Algorithme) déjà faite — skip', { session_id });
    algoResult = {
      output: safeParseJSON(bilan.synthese_json_complete),
      bilanFields: {}
    };
  } else {
    // Garde séquentielle : Agent 3 doit être complet (synthèses dans BILAN)
    if (!bilanChampRenseigne(bilan, 'circuits_top3_P1')) {
      throw new Error(
        'Prérequis manquant pour ÉTAPE 6 : circuits_top3_P1 absent dans BILAN. ' +
        'Agent 3 (ÉTAPE 5) doit être complet avant de lancer l\'Algorithme.'
      );
    }

    try {
      logger.info('Orchestrateur: ÉTAPE 6 — Algorithme', { session_id });

      questions = await airtableService.getResponsesBySession(session_id);
      questions.sort((a, b) => (a.numero_global || 0) - (b.numero_global || 0));

      const questionsDataPourAlgo = buildQuestionsDataPourAlgo(
        questions,
        verifResult.arbitrages,
        agent2Result.analyses,
        agent3Result.analyses
      );

      algoResult = await algorithmeService.run(
        session_id,
        candidat,
        questionsDataPourAlgo,
        agent3Result.syntheses,
        agent1Result.corpus
      );

      await backupService.save(session_id, 'after_algo', {
        niveau_global: algoResult.output?.synthese_globale?.niveau_global,
        step: 'algorithme_ok'
      });

      logger.info('Orchestrateur: ÉTAPE 6 terminée', {
        session_id,
        duree_ms: Date.now() - step6Start,
        niveau_global: algoResult.output?.synthese_globale?.niveau_global,
        nom_niveau:    algoResult.output?.synthese_globale?.nom_niveau_global
      });
    } catch (error) {
      await markError(session_id, 'ÉTAPE 6 Algorithme', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ÉTAPE 7 — CERTIFICATEUR : rapport final
  // Checkpoint : statut_certification = 'certifie' dans BILAN
  // Garde : synthese_json_complete doit être rempli dans BILAN (Algo terminé)
  // ═══════════════════════════════════════════════════════════════════════
  const step7Start = Date.now();

  bilan = await airtableService.getBilan(session_id) || {};

  if (bilanChampRenseigne(bilan, 'statut_certification') && bilan.statut_certification === 'certifie') {
    logger.info('Orchestrateur: ÉTAPE 7 (Certificateur) déjà faite — skip', { session_id });
  } else {
    // Garde séquentielle : Algo doit être complet
    if (!bilanChampRenseigne(bilan, 'synthese_json_complete')) {
      throw new Error(
        'Prérequis manquant pour ÉTAPE 7 : synthese_json_complete absent dans BILAN. ' +
        'Algorithme (ÉTAPE 6) doit être complet avant de lancer le Certificateur.'
      );
    }

    try {
      logger.info('Orchestrateur: ÉTAPE 7 — Certificateur', { session_id });
      await backupService.save(session_id, 'before_certif', { step: 'debut_certif', timestamp: new Date().toISOString() });

      questions = await airtableService.getResponsesBySession(session_id);
      questions.sort((a, b) => (a.numero_global || 0) - (b.numero_global || 0));

      const questionsDataPourCertif = buildQuestionsDataPourAlgo(
        questions,
        verifResult.arbitrages,
        agent2Result.analyses,
        agent3Result.analyses
      );

      await certificateurService.run(
        session_id,
        algoResult,
        agent3Result.syntheses,
        agent1Result.corpus,
        questionsDataPourCertif
      );

      await backupService.save(session_id, 'after_certif', { statut: 'certifie' });

      logger.info('Orchestrateur: ÉTAPE 7 terminée', {
        session_id,
        duree_ms: Date.now() - step7Start
      });
    } catch (error) {
      await markError(session_id, 'ÉTAPE 7 Certificateur', error);
      throw error;
    }
  }

  // ── Finalisation ─────────────────────────────────────────────────────────
  const dureeTotal = Date.now() - startTime;

  logger.info('Orchestrateur: pipeline complet terminé', {
    session_id,
    candidat: `${candidat.prenom} ${candidat.nom}`,
    duree_ms: dureeTotal,
    duree_s:  Math.round(dureeTotal / 1000)
  });

  return {
    session_id,
    candidat,
    statut:   'TERMINÉ',
    duree_ms: dureeTotal
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS INTERNES
// ═══════════════════════════════════════════════════════════════════════════

function safeParseJSON(value) {
  if (!value) return null;
  if (typeof value === 'object') return value;
  try { return JSON.parse(value); }
  catch { return null; }
}

/**
 * Reconstruire la structure synthèse Agent 3 depuis les champs BILAN
 * (utilisé uniquement quand l'étape 5 est skippée via checkpoint).
 */
function buildSyntheseFromBilan(bilan, pilier) {
  return {
    mission_5B_synthese: {
      circuits_recurrents_top3: safeParseJSON(bilan[`circuits_top3_${pilier}`]) || [],
      boucles_agregees:         safeParseJSON(bilan[`boucles_detectees_pilier_${pilier}`]) || {}
    },
    mission_7_bilan_certificateur: {
      lecture_cognitive_enrichie: bilan[`lecture_cognitive_enrichie_${pilier}`] || null,
      profil_neuroscientifique:   safeParseJSON(bilan[`profil_neuroscientifique_${pilier}`]) || {},
      capacites_observees:        [],
      flags: { revision_necessaire: false, alertes: [] }
    }
  };
}

/**
 * Marquer une erreur dans VISITEUR et logger.
 */
async function markError(session_id, etape, error) {
  logger.error(`Orchestrateur: ERREUR ${etape}`, { session_id, error: error.message });
  try {
    await airtableService.updateVisiteur(session_id, {
      statut_analyse_pivar: 'ERREUR',
      erreur_analyse: `${etape}: ${error.message}`
    });
  } catch (e) {
    logger.warn('Orchestrateur: impossible de marquer ERREUR dans VISITEUR', { error: e.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRAITEMENT D'UN BATCH DE SESSIONS
// ═══════════════════════════════════════════════════════════════════════════

async function processBatch(sessionIds) {
  const results = [];

  for (const session_id of sessionIds) {
    try {
      const result = await processCandidate(session_id);
      results.push({ session_id, statut: 'OK', ...result });
    } catch (error) {
      logger.error('Orchestrateur: session échouée', { session_id, error: error.message });
      results.push({ session_id, statut: 'ERREUR', error: error.message });
    }

    if (sessionIds.indexOf(session_id) < sessionIds.length - 1) {
      await sleep(2000);
    }
  }

  logger.info('Orchestrateur: batch terminé', {
    total:   sessionIds.length,
    ok:      results.filter(r => r.statut === 'OK').length,
    erreurs: results.filter(r => r.statut === 'ERREUR').length
  });

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  processCandidate,
  processBatch
};
