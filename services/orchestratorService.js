// services/orchestratorService.js
// Orchestrateur v8.0 — Coordinateur principal du pipeline profil cognitif
// Chaîne : Agent1 (25+1) → Vérificateur (25) → Agent2 (25) → Agent3 (25+5) → Algo → Certificateur
// Comportement : checkpoint par étape, retry granulaire, log structuré

'use strict';

const airtableService    = require('./airtableService');
const agent1Service      = require('./agent1Service');
const verificateurService = require('./verificateurService');
const agent2Service      = require('./agent2Service');
const agent3Service      = require('./agent3Service');
const algorithmeService  = require('./algorithmeService');
const certificateurService = require('./certificateurService');
const backupService      = require('./backupService');
const logger             = require('../utils/logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS CHECKPOINT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Vérifier si une étape est déjà complète pour éviter de la rejouer.
 * Logique : si le champ indicateur est non-null dans Airtable, l'étape est faite.
 */
function etapeDejaFaite(questions, champ) {
  // Toutes les questions doivent avoir le champ renseigné
  return questions.every(q => q[champ] !== null && q[champ] !== undefined && q[champ] !== '');
}

function bilanChampRenseigne(bilan, champ) {
  return bilan[champ] !== null && bilan[champ] !== undefined && bilan[champ] !== '';
}

// ═══════════════════════════════════════════════════════════════════════════
// FUSION DES DONNÉES POUR L'ALGORITHME
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construire le tableau questionsData attendu par algorithmeService.run().
 * Fusionne : questions brutes + résultats Vérificateur + résultats Agent 2 + mission_6_donnees_algo (Agent 3)
 */
function buildQuestionsDataPourAlgo(questions, verifArbitrages, agent2Analyses, agent3Analyses) {
  // Indexer par id_question
  const verifIdx  = {};
  const a2Idx     = {};
  const a3Idx     = {};

  for (const a of verifArbitrages)  verifIdx[a.id_question]  = a.result;
  for (const a of agent2Analyses)   a2Idx[a.id_question]     = a.result;
  for (const a of agent3Analyses)   a3Idx[a.id_question]     = a.result;

  return questions.map(q => {
    const verif   = verifIdx[q.id_question]  || {};
    const a2      = a2Idx[q.id_question]     || {};
    const a3      = a3Idx[q.id_question]     || {};

    const arbitrage   = verif.verificateur_arbitrage || {};
    const mesure      = a2.agent2_mesure || {};
    const m4          = mesure.mission_4_dimensions_simples?.par_pilier || {};
    const m5          = mesure.mission_5_dimensions_sophistiquees?.par_pilier || {};
    const m6          = mesure.mission_6_excellences || {};
    const m8          = mesure.mission_8_lecture_cognitive || {};
    const m6Algo      = a3.agent3_verification?.mission_6_donnees_algo || {};

    // Pilier cœur final (du Vérificateur)
    const pilierCoeur = arbitrage.pilier_coeur_final || q.pilier;

    // Amplitude max depuis mission_6_donnees_algo (amplitude du pilier cœur)
    const amplitudeMax = m6Algo.piliers?.amplitudes?.[pilierCoeur]
      || m6Algo.piliers?.paliers_grilles?.[pilierCoeur]
      || arbitrage.niveau_coeur_final
      || 1;

    // Dimensions sur le pilier cœur
    // M4 output : { total_dimensions_simples, nombre_criteres, liste_actions, liste_criteres }
    // M5 output : { nombre, liste }
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
      id_question:     q.id_question,
      scenario_nom:    q.scenario_nom,
      pilier:          q.pilier,          // pilier_question
      pilier_reponse_coeur: pilierCoeur,  // pilier_coeur_final arbitré

      simples:      simplesCoeur,
      details:      detailsCoeur,
      soph:         sophCoeur,
      amplitude_max: amplitudeMax,

      excellences,

      // Qualification passation — Single Select Airtable : "oui"/"non"
      repond_question:                  q.repond_question === 'oui' || q.repond_question === true || q.repond_question === 'OUI' ? 'OUI' : 'NON',
      traite_problematique_situation:   q.traite_problematique_situation === 'oui' || q.traite_problematique_situation === true || q.traite_problematique_situation === 'OUI' ? 'OUI' : 'NON',
      fait_processus_pilier:            q.fait_processus_pilier === 'oui' || q.fait_processus_pilier === true || q.fait_processus_pilier === 'OUI' ? 'OUI' : 'NON',

      // Laconique (Agent 2 M8)
      laconique: m8.laconique || false,

      // Verbatims et manifestations (Agent 2 M6)
      anticipation_verbatim:            m6.anticipation_niveau?.verbatim || null,
      anticipation_manifestation:       m6.anticipation_niveau?.manifestation || null,
      decentration_verbatim:            m6.decentration_niveau?.verbatim || null,
      decentration_manifestation:       m6.decentration_niveau?.manifestation || null,
      metacognition_verbatim:           m6.metacognition_niveau?.verbatim || null,
      metacognition_manifestation:      m6.metacognition_niveau?.manifestation || null,
      vue_systemique_verbatim:          m6.vue_systemique_niveau?.verbatim || null,
      vue_systemique_manifestation:     m6.vue_systemique_niveau?.manifestation || null,

      // Niveaux excellences à plat (pour certificateur)
      anticipation_niveau:    excellences.anticipation_niveau,
      decentration_niveau:    excellences.decentration_niveau,
      metacognition_niveau:   excellences.metacognition_niveau,
      vue_systemique_niveau:  excellences.vue_systemique_niveau
    };
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// PROCESSUS PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Traiter un candidat complet — pipeline 7 étapes.
 * @param {string} session_id
 */
async function processCandidate(session_id) {
  const startTime = Date.now();

  logger.info('Orchestrateur: démarrage pipeline', { session_id });

  // ── Récupérer le visiteur et le bilan ────────────────────────────────────
  let visiteur;
  try {
    visiteur = await airtableService.getVisiteur(session_id);
    if (!visiteur) throw new Error(`Visiteur introuvable pour session ${session_id}`);
  } catch (error) {
    logger.error('Orchestrateur: visiteur introuvable', { session_id, error: error.message });
    throw error;
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
    // Trier par numero_global pour garantir l'ordre
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

  // ── Récupérer le bilan (pour checkpoints) ────────────────────────────────
  let bilan = await airtableService.getBilan(session_id) || {};

  // Résultats inter-étapes (en mémoire)
  let agent1Result, verifResult, agent2Result, agent3Result, algoResult;

  // ═══════════════════════════════════════════════════════════════════════
  // ÉTAPE 1 — AGENT 1 : 25 appels question par question
  // Checkpoint : analyse_json_agent1 non-null sur toutes les questions
  // ═══════════════════════════════════════════════════════════════════════
  const step1Start = Date.now();

  if (etapeDejaFaite(questions, 'analyse_json_agent1') && bilanChampRenseigne(bilan, 'moteur_cognitif')) {
    logger.info('Orchestrateur: ÉTAPE 1 déjà faite — skip', { session_id });
    // Reconstruire agent1Result depuis Airtable
    agent1Result = {
      analyses: questions.map(q => ({
        id_question: q.id_question,
        result: safeParseJSON(q.analyse_json_agent1)
      })),
      corpus: {
        section_B: {
          moteur_cognitif:   bilan.moteur_cognitif || null,
          binome_actif:      bilan.binome_actif || null,
          reaction_flou:     bilan.reaction_flou || null,
          signature_cloture: bilan.signature_cloture || null
        }
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
  // ÉTAPE 2 — AGENT 1 APPEL FINAL (Sections A/B/C + rapport)
  // Checkpoint : moteur_cognitif non-null dans BILAN
  // (Déjà exécuté dans agent1Service.run() — checkpoint ici pour cohérence)
  // ═══════════════════════════════════════════════════════════════════════
  // Note : agent1Service.run() exécute les 25 appels ET l'appel final en une seule passe.
  // Le checkpoint ÉTAPE 1 couvre donc les deux.

  // ═══════════════════════════════════════════════════════════════════════
  // ÉTAPE 3 — VÉRIFICATEUR : 25 arbitrages
  // Checkpoint : pilier_reponse_coeur non-null sur toutes les questions
  // ═══════════════════════════════════════════════════════════════════════
  const step3Start = Date.now();

  // Recharger les questions pour avoir les données fraîches d'Airtable
  questions = await airtableService.getResponsesBySession(session_id);
  questions.sort((a, b) => (a.numero_global || 0) - (b.numero_global || 0));

  if (etapeDejaFaite(questions, 'pilier_reponse_coeur')) {
    logger.info('Orchestrateur: ÉTAPE 3 déjà faite — skip', { session_id });
    verifResult = {
      arbitrages: questions.map(q => ({
        id_question: q.id_question,
        result: {
          verificateur_arbitrage: {
            pilier_coeur_final: q.pilier_reponse_coeur,
            niveau_coeur_final: null
          },
          piliers_actives:              safeParseJSON(q.circuits_actives_pilier_coeur) || [],
          boucles_finales:              [],
          sequence_finale:              '',
          repond_question:              q.repond_question,
          traite_problematique_situation: q.traite_problematique_situation,
          fait_processus_pilier:        q.fait_processus_pilier,
          verificateur_statut:          q.coherence_agents || 'CONFIRMÉ'
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
  // Checkpoint : analyse_json_agent2 non-null sur toutes les questions
  // ═══════════════════════════════════════════════════════════════════════
  const step4Start = Date.now();

  questions = await airtableService.getResponsesBySession(session_id);
  questions.sort((a, b) => (a.numero_global || 0) - (b.numero_global || 0));

  if (etapeDejaFaite(questions, 'analyse_json_agent2')) {
    logger.info('Orchestrateur: ÉTAPE 4 déjà faite — skip', { session_id });
    agent2Result = {
      analyses: questions.map(q => ({
        id_question: q.id_question,
        result: safeParseJSON(q.analyse_json_agent2)
      }))
    };
  } else {
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
  // Checkpoint : analyse_json_agent3 non-null sur toutes les questions
  // ═══════════════════════════════════════════════════════════════════════
  const step5Start = Date.now();

  questions = await airtableService.getResponsesBySession(session_id);
  questions.sort((a, b) => (a.numero_global || 0) - (b.numero_global || 0));
  bilan = await airtableService.getBilan(session_id) || {};

  if (etapeDejaFaite(questions, 'analyse_json_agent3') && bilanChampRenseigne(bilan, 'circuits_top3_P1')) {
    logger.info('Orchestrateur: ÉTAPE 5 déjà faite — skip', { session_id });
    agent3Result = {
      analyses: questions.map(q => ({
        id_question: q.id_question,
        result: safeParseJSON(q.analyse_json_agent3)
      })),
      syntheses: {
        P1: safeParseJSON(bilan.circuits_top3_P1) ? buildSyntheseFromBilan(bilan, 'P1') : {},
        P2: buildSyntheseFromBilan(bilan, 'P2'),
        P3: buildSyntheseFromBilan(bilan, 'P3'),
        P4: buildSyntheseFromBilan(bilan, 'P4'),
        P5: buildSyntheseFromBilan(bilan, 'P5')
      }
    };
  } else {
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
  // ═══════════════════════════════════════════════════════════════════════
  const step6Start = Date.now();

  bilan = await airtableService.getBilan(session_id) || {};

  if (bilanChampRenseigne(bilan, 'synthese_json_complete')) {
    logger.info('Orchestrateur: ÉTAPE 6 déjà faite — skip', { session_id });
    algoResult = {
      output: safeParseJSON(bilan.synthese_json_complete),
      bilanFields: {}
    };
  } else {
    try {
      logger.info('Orchestrateur: ÉTAPE 6 — Algorithme', { session_id });

      // Recharger questions fraîches (tous les champs écrits par les étapes précédentes)
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
        nom_niveau: algoResult.output?.synthese_globale?.nom_niveau_global
      });
    } catch (error) {
      await markError(session_id, 'ÉTAPE 6 Algorithme', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ÉTAPE 7 — CERTIFICATEUR : rapport final
  // Checkpoint : statut_certification non-null dans BILAN
  // ═══════════════════════════════════════════════════════════════════════
  const step7Start = Date.now();

  bilan = await airtableService.getBilan(session_id) || {};

  if (bilanChampRenseigne(bilan, 'statut_certification') && bilan.statut_certification === 'certifie') {
    logger.info('Orchestrateur: ÉTAPE 7 déjà faite — skip', { session_id });
  } else {
    try {
      logger.info('Orchestrateur: ÉTAPE 7 — Certificateur', { session_id });
      await backupService.save(session_id, 'before_certif', { step: 'debut_certif', timestamp: new Date().toISOString() });

      // Recharger questions pour avoir tous les verbatims
      questions = await airtableService.getResponsesBySession(session_id);
      questions.sort((a, b) => (a.numero_global || 0) - (b.numero_global || 0));

      // questionsData pour le certificateur (avec tous les champs plats nécessaires)
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
    duree_s: Math.round(dureeTotal / 1000)
  });

  return {
    session_id,
    candidat,
    statut: 'TERMINÉ',
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
 * Reconstruire une structure synthèse minimale depuis les champs BILAN
 * pour le cas où l'étape 5 est skippée via checkpoint.
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
      statut_analyse_pivar: 'ERREUR',                          // valeur Single Select autorisée
      erreur_analyse: `${etape}: ${error.message}`             // détail dans champ texte
    });
  } catch (e) {
    logger.warn('Orchestrateur: impossible de marquer ERREUR dans VISITEUR', { error: e.message });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// TRAITEMENT D'UNE LISTE DE SESSIONS (queue)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Traiter plusieurs sessions en séquence.
 * @param {Array<string>} sessionIds
 */
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

    // Pause entre sessions pour éviter la surcharge
    if (sessionIds.indexOf(session_id) < sessionIds.length - 1) {
      await sleep(2000);
    }
  }

  logger.info('Orchestrateur: batch terminé', {
    total: sessionIds.length,
    ok: results.filter(r => r.statut === 'OK').length,
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
