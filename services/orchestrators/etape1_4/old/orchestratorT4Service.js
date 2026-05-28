// services/orchestrators/orchestratorT4.js
// Orchestrateur T4 — Coordination des 6 sous-agents + certificateur lexique
// Profil-Cognitif v10.7
//
// EMPLACEMENT : services/orchestrators/ (à côté de orchestratorEtape1.js
//               et orchestratorPrincipal.js). C'est un orchestrateur, pas
//               un sous-service. Les 6 sous-services T4 vivent dans
//               services/etape1/etape1_t4/.
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et docs/CONTRAT_ETAPE1.md (v1.10 prévue)
//                       et docs/DOCTRINE_T4_4_ALGORITHMES.md (livré 05/05/2026)
//
// RÔLE
// ────
// T4 est l'étape rédactionnelle finale du pipeline Profil-Cognitif. Elle
// produit le bilan complet du candidat dans la table ETAPE1_T4_BILAN
// (66 champs) à partir des sources T1, T2, T3 :
//
//   1. Lit T1 (25 lignes), T2 (synthèse v3.4), T3 (lignes circuits + 12 champs
//      synthétiques par pilier) depuis Airtable
//
//   2. Calcule côté JS 4 algorithmes doctrinaux (cf. DOCTRINE_T4_4_ALGORITHMES.md) :
//        A1 — Calcul des rôles des 5 piliers (socle/structurants/fonctionnels/résistant)
//        A2 — Dérivation du filtre cognitif depuis T1
//        A3 — Préparation des inputs des 3 grandes lignes de finalité
//        A4 — Délégué à Agent 3 (mode_retenu produit par lui)
//
//   3. Construit 6 payloads enrichis (un par sous-agent) avec injection
//      automatique du lexique 15 termes (injectLexique: true)
//
//   4. Lance les sous-agents en 2 phases :
//        Phase 1 (parallèle) : Agent 1 + Agent 2 + Agent 3 + Agent 6
//        Phase 2 (séquentielle) : Agent 4 → Agent 5
//
//      Phase 2 séquentielle parce que :
//        - Agent 4 a besoin du mode_retenu produit par Agent 3
//        - Agent 5 a besoin de la signature produite par Agent 4 pour la conclusion tripartite
//
//   5. Agrège les 56 colonnes de sortie + 6 audits → objet `bilan_t4`
//
//   6. Appelle le certificateur lexique sur `bilan_t4` (à venir — Phase
//      ultérieure ; pour T4 v1 on stocke directement)
//
//   7. Upsert ETAPE1_T4_BILAN avec `bilan_t4`
//
// DOCTRINE APPLIQUÉE
// ──────────────────
//   - Toute la doctrine d'analyse vit dans les 6 prompts T4 v1.1 — PAS dans
//     ce code (règle de gouvernance v10.4 — Décision n°35).
//   - Anonymisation : payload utilise candidat_id + civilite uniquement
//     (Décision n°4). civilite sert aux accords grammaticaux ; les agents
//     produisent du HTML avec placeholder {prenom} (jamais de prénom rédigé).
//   - thinking activé via claude.js THINKING.agent_t4_X = true pour chaque
//     sous-agent (Pilier 1).
//   - Pas de vérificateur T4 dans T4 v1 (futur).
//
// PHASE v10.7 (2026-05-05) — Création initiale
// ────────────────────────────────────────────
//   T4 n'avait jamais été branché en Node.js. La session du 04-05/05 a produit :
//     - 6 prompts T4 v1.1 (alignés sur T2 v3.4 et T3 v4.3)
//     - Audit T4 v2 identifiant 4 trous doctrinaux dans l'orchestrateur
//     - Doctrine technique des 4 algorithmes (DOCTRINE_T4_4_ALGORITHMES.md)
//
//   Décisions doctrinales prises pour T4 v1 (en attente validation Isabelle) :
//     - D1 : si aucun pilier candidature_socle=FORTE → fallback sur MOYENNE
//            avec signature_unifiee=true ; flag socle_par_defaut=true posé
//     - D2 : Phase 1 parallèle = 4 agents (Agents 1+2+3+6)
//            Phase 2 séquentielle = Agent 4 → Agent 5
//     - D3 : pas de REFERENTIEL_MODES.md pour T4 v1 — délégué au prompt Agent 3

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

// ─── Sous-services T4 (dans services/etape1/etape1_t4/) ────────────────────
// Les 6 prompts existent déjà dans new-prompts/etape1/etape1_t4/.
// Les 6 services Node.js seront produits dans un second temps (chacun ~150
// lignes, suivant le même pattern que agentT2Service).
const agentT4_1_architectureService  = require('../etape1/etape1_t4/agentT4_1_architectureService');
const agentT4_2_circuitsService      = require('../etape1/etape1_t4/agentT4_2_circuitsService');
const agentT4_3_modeService          = require('../etape1/etape1_t4/agentT4_3_modeService');
const agentT4_4_syntheseCoeurService = require('../etape1/etape1_t4/agentT4_4_syntheseCoeurService');
const agentT4_5_coutsClotureService  = require('../etape1/etape1_t4/agentT4_5_coutsClotureService');
const agentT4_6_transversesService   = require('../etape1/etape1_t4/agentT4_6_transversesService');

// ─── Constantes ───────────────────────────────────────────────────────────
const PILIERS = ['P1', 'P2', 'P3', 'P4', 'P5'];

const NOMS_PILIERS_COMPLETS = {
  P1: "Collecte d'information",
  P2: "Tri",
  P3: "Analyse",
  P4: "Création de solutions",
  P5: "Mise en œuvre et exécution"
};

// Position des piliers dans le cycle cognitif (P1→P2→P3→P4→P5)
const POSITION_CYCLE = {
  P1: 'entree_cycle',
  P2: 'entree_cycle',
  P3: 'central',
  P4: 'sortie_cycle',
  P5: 'sortie_cycle'
};

// ─── Table de référence : filtres validés pour les 3 candidats référents ──
// Cf. DOCTRINE_T4_4_ALGORITHMES.md §A2 — garde-fou pour les candidats validés
// pendant la session doctrinale du 04-05/05/2026.
const FILTRES_VALIDES_REFERENTS = {
  'pcc_1771077635499_gg1cj7z1q': {  // Cécile
    formulation:           "Lire ce qui est vrai dans la situation, depuis l'observation directe",
    precision_semantique:  "« vrai » signifie ici véracité factuelle (informations sourcées, documentées, circonstanciées, contextualisées) — pas volonté d'avoir raison"
  },
  'pivar_1762101819725_oy1yr4h28': {  // Véronique
    formulation:           "Réduire la situation à son enjeu critique, depuis un seuil de gravité",
    precision_semantique:  null
  },
  'pivar_1762094675215_77bg53iz0': {  // Rémi
    formulation:           "Hiérarchiser ce qui demande examen, depuis l'hypothèse interprétative que la situation appelle",
    precision_semantique:  null
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute le pipeline T4 complet pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @returns {Promise<{
 *   success: boolean,
 *   candidat_id: string,
 *   bilan_t4: Object,           // 56 colonnes + 6 audits = 62 champs
 *   roles: Object,              // mapping pilier → rôle
 *   filtre: Object,             // {formulation, precision_semantique}
 *   usage: Object,              // tokens cumulés
 *   cost: number,               // USD cumulé
 *   elapsedMs: number,
 *   subAgents: Object           // détail par sous-agent
 * }>}
 */
async function runOrchestratorT4({ candidat_id }) {
  const startTime = Date.now();
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
  logger.info('Orchestrateur T4 starting (6 sous-agents + 4 algorithmes JS)', { candidat_id });
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

  const usages = [];
  const costs = [];
  const subAgentsResults = {};

  // ─── 1. Lecture des sources T1, T2, T3 + civilité ─────────────────────
  const sources = await chargerSources(candidat_id);
  logger.info('T4 — sources lues', {
    candidat_id,
    count_t1:                 sources.lignesT1.length,
    count_t2:                 sources.lignesT2.length,
    count_t3:                 sources.lignesT3.length,
    nb_piliers_avec_circuits: Object.keys(sources.t3ParPilier).length
  });

  // ─── 2. Algorithmes JS doctrinaux ─────────────────────────────────────
  // A1 — Calcul des rôles
  const { roles, pilierSocle, pilierResistant, socleParDefaut } = calculerRolesPiliers({
    syntheseT2: sources.syntheseT2,
    t3ParPilier: sources.t3ParPilier
  });

  if (!pilierSocle) {
    throw new Error(
      `T4 — A1 a échoué : aucun pilier candidat au socle pour ${candidat_id}. ` +
      `Vérifier que T3 a produit des candidatures_socle_score valides.`
    );
  }

  logger.info('T4 — A1 calculRoles', {
    candidat_id,
    pilier_socle:        pilierSocle,
    pilier_resistant:    pilierResistant || 'aucun',
    socle_par_defaut:    socleParDefaut,
    roles
  });

  // A2 — Dérivation du filtre cognitif
  const filtre = deriverFiltreCognitif({
    candidat_id,
    pilierSocle,
    syntheseT3PilierSocle: sources.t3ParPilier[pilierSocle]
  });

  logger.info('T4 — A2 deriverFiltre', {
    candidat_id,
    formulation: filtre.formulation.slice(0, 80),
    precision_semantique_presente: !!filtre.precision_semantique
  });

  // A3 — Préparation des inputs des 3 grandes lignes de finalité
  const finaliteInputs = preparerInputsFinalite({
    syntheseT2: sources.syntheseT2,
    syntheseT3PilierSocle: sources.t3ParPilier[pilierSocle],
    pilierResistant
  });

  logger.info('T4 — A3 preparerInputsFinalite', {
    candidat_id,
    pattern_t2_present:     !!finaliteInputs.grande_ligne_1.pattern_t2,
    nb_clusters_ancrage:    finaliteInputs.grande_ligne_1.cluster_ancrage ? 3 : 0,
    pilier_resistant_actif: !!pilierResistant
  });

  // ─── 3. Construction des payloads pour les 6 sous-agents ──────────────
  const payloads = construirePayloadsSubAgents({
    candidat_id,
    civilite:        sources.civilite,
    sources,
    roles,
    pilierSocle,
    pilierResistant,
    socleParDefaut,
    filtre,
    finaliteInputs
  });

  // ─── 4. PHASE 1 PARALLÈLE — Agents 1 + 2 + 3 + 6 ──────────────────────
  logger.info('T4 — Phase 1 parallèle (Agents 1, 2, 3, 6)', { candidat_id });
  const phase1Start = Date.now();

  const [a1Result, a2Result, a3Result, a6Result] = await Promise.all([
    agentT4_1_architectureService.runAgentT4_1({ candidat_id, payload: payloads.agent1 })
      .then(r => { trackUsage(usages, costs, r); return r; }),
    agentT4_2_circuitsService.runAgentT4_2({ candidat_id, payload: payloads.agent2 })
      .then(r => { trackUsage(usages, costs, r); return r; }),
    agentT4_3_modeService.runAgentT4_3({ candidat_id, payload: payloads.agent3 })
      .then(r => { trackUsage(usages, costs, r); return r; }),
    agentT4_6_transversesService.runAgentT4_6({ candidat_id, payload: payloads.agent6 })
      .then(r => { trackUsage(usages, costs, r); return r; })
  ]);

  subAgentsResults.agent1 = a1Result;
  subAgentsResults.agent2 = a2Result;
  subAgentsResults.agent3 = a3Result;
  subAgentsResults.agent6 = a6Result;

  const phase1ElapsedMs = Date.now() - phase1Start;
  logger.info('T4 — Phase 1 done', {
    candidat_id,
    phase1ElapsedMs,
    cost_phase1: (a1Result.cost + a2Result.cost + a3Result.cost + a6Result.cost).toFixed(4)
  });

  // ─── 5. Récupérer mode_retenu de Agent 3 → enrichir payloads Agents 4, 5 ─
  const modesRetenus = extraireModesRetenus(a3Result);
  payloads.agent4.modes_retenus = modesRetenus;
  payloads.agent5.modes_retenus = modesRetenus;

  // ─── 6. PHASE 2 SÉQUENTIELLE — Agent 4 → Agent 5 ──────────────────────
  logger.info('T4 — Phase 2 séquentielle (Agent 4 puis Agent 5)', { candidat_id });

  const a4Result = await agentT4_4_syntheseCoeurService.runAgentT4_4({
    candidat_id,
    payload: payloads.agent4
  });
  trackUsage(usages, costs, a4Result);
  subAgentsResults.agent4 = a4Result;
  logger.info('T4 — Agent 4 done', {
    candidat_id,
    cost: a4Result.cost.toFixed(4)
  });

  // Agent 5 reçoit la signature/conclusion produite par Agent 4
  payloads.agent5.signature_recit_agent4 = a4Result.result?.d4_signature || '';
  payloads.agent5.filtre_cand_agent4     = a4Result.result?.d1_filtre_cand || '';
  payloads.agent5.finalite_lab_agent4    = a4Result.result?.d3_finalite_lab || '';

  const a5Result = await agentT4_5_coutsClotureService.runAgentT4_5({
    candidat_id,
    payload: payloads.agent5
  });
  trackUsage(usages, costs, a5Result);
  subAgentsResults.agent5 = a5Result;
  logger.info('T4 — Agent 5 done', {
    candidat_id,
    cost: a5Result.cost.toFixed(4)
  });

  // ─── 7. Agrégation des 56 colonnes + 6 audits → bilan_t4 ──────────────
  const bilan_t4 = agregerBilanT4({
    a1: a1Result.result,
    a2: a2Result.result,
    a3: a3Result.result,
    a4: a4Result.result,
    a5: a5Result.result,
    a6: a6Result.result
  });

  // ─── 8. Validation cohérence cross-agents (V1-V5) ─────────────────────
  validerCoherenceBilan({ bilan_t4, candidat_id });

  // ─── 9. Upsert ETAPE1_T4_BILAN ────────────────────────────────────────
  await airtableService.upsertEtape1T4Bilan(candidat_id, bilan_t4);
  logger.info('T4 — bilan upserté dans ETAPE1_T4_BILAN', {
    candidat_id,
    nb_champs: Object.keys(bilan_t4).length
  });

  // ─── 10. Retour ───────────────────────────────────────────────────────
  const elapsedMs = Date.now() - startTime;
  const totalCost = costs.reduce((s, c) => s + c, 0);

  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
  logger.info('🎉 Orchestrateur T4 terminé', {
    candidat_id,
    pilier_socle:     pilierSocle,
    pilier_resistant: pilierResistant || 'aucun',
    socle_par_defaut: socleParDefaut,
    nb_champs_bilan:  Object.keys(bilan_t4).length,
    totalCost:        totalCost.toFixed(4),
    elapsedMs
  });
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

  return {
    success: true,
    candidat_id,
    bilan_t4,
    roles,
    pilier_socle: pilierSocle,
    pilier_resistant: pilierResistant,
    socle_par_defaut: socleParDefaut,
    filtre,
    usage: agregerUsages(usages),
    cost: totalCost,
    elapsedMs,
    subAgents: subAgentsResults
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARGEMENT DES SOURCES T1, T2, T3
// ═══════════════════════════════════════════════════════════════════════════

async function chargerSources(candidat_id) {
  const lignesT1 = await airtableService.getEtape1T1(candidat_id);
  if (!lignesT1 || lignesT1.length === 0) {
    throw new Error(`T4 — aucune ligne ETAPE1_T1 pour ${candidat_id}. T1 doit avoir tourné.`);
  }

  const lignesT2 = await airtableService.getEtape1T2(candidat_id);
  if (!lignesT2 || lignesT2.length === 0) {
    throw new Error(`T4 — aucune ligne ETAPE1_T2 pour ${candidat_id}. T2 doit avoir tourné.`);
  }

  const lignesT3 = await airtableService.getEtape1T3(candidat_id);
  if (!lignesT3 || lignesT3.length === 0) {
    throw new Error(`T4 — aucune ligne ETAPE1_T3 pour ${candidat_id}. T3 doit avoir tourné.`);
  }

  // Synthèse T2 (recopiée sur les 25 lignes — on lit la 1ère)
  const first = lignesT2[0];
  const syntheseT2 = {
    hypothese_pilier_dominant_ecart: first.hypothese_pilier_dominant_ecart,
    confiance_socle_par_ecart:       first.confiance_socle_par_ecart,
    pourcentage_concentration_ecart: first.pourcentage_concentration_ecart || 0,
    flag_profil_quasi_conforme:      first.flag_profil_quasi_conforme === true,
    directive_t3:                    first.directive_t3,
    pattern_finalite_pressenti:      first.pattern_finalite_pressenti || '',
    signal_transversal_candidat:     first.signal_transversal_candidat || '',
    nb_conformes_total:              first.nb_conformes_total || 0,
    nb_ecart_total:                  first.nb_ecart_total || 0
  };

  // T3 par pilier : on regroupe les lignes T3 par pilier, on extrait la
  // synthèse (recopiée sur toutes les lignes du pilier) + les circuits actifs
  const t3ParPilier = {};
  for (const pilier of PILIERS) {
    const lignesP = lignesT3.filter(r => r.pilier === pilier);
    if (lignesP.length === 0) {
      logger.warn(`T4 — pilier ${pilier}: aucune ligne T3`, { candidat_id });
      t3ParPilier[pilier] = null;
      continue;
    }

    const ref = lignesP[0];
    t3ParPilier[pilier] = {
      pilier,
      nom: NOMS_PILIERS_COMPLETS[pilier],
      // Synthèse par pilier (12 champs)
      nb_circuits_actifs_pilier:              parseInt(ref.nb_circuits_actifs_pilier, 10) || 0,
      total_activations_pilier:               ref.total_activations_pilier || 0,
      score_concentration_pilier:             ref.score_concentration_pilier || 0,
      cluster_dominant_circuits:              ref.cluster_dominant_circuits || '',
      cluster_dominant_co_occurrences:        ref.cluster_dominant_co_occurrences || 0,
      cluster_dominant_signature_unifiee:     ref.cluster_dominant_signature_unifiee === true,
      cluster_dominant_lecture:               ref.cluster_dominant_lecture || '',
      nb_signaux_limbiques_pilier:            ref.nb_signaux_limbiques_pilier || 0,
      questions_avec_signaux_limbiques_pilier: ref.questions_avec_signaux_limbiques_pilier || '',
      candidature_socle_score:                ref.candidature_socle_score || 'NULLE',
      candidature_socle_raison:               ref.candidature_socle_raison || '',
      candidature_resistant_score:            ref.candidature_resistant_score || 'NULLE',
      candidature_resistant_raison:           ref.candidature_resistant_raison || '',
      // Lignes circuits du pilier (triées par fréquence décroissante)
      circuits: lignesP
        .map(r => ({
          circuit_id:           r.circuit_id,
          circuit_nom:          r.circuit_nom,
          frequence:            parseInt(r.frequence, 10) || 0,
          niveau_activation:    r.niveau_activation,
          types_verbatim_detail: r.types_verbatim_detail || '',
          activations_franches:  parseJsonField(r.activations_franches),
          activations_nuancees:  parseJsonField(r.activations_nuancees),
          clusters_identifies:   parseJsonField(r.clusters_identifies),
          commentaire_attribution: r.commentaire_attribution || ''
        }))
        .sort((a, b) => b.frequence - a.frequence)
    };
  }

  // Civilité depuis VISITEUR
  let civilite = await airtableService.getCiviliteCandidat(candidat_id);
  if (!civilite) {
    logger.warn('T4 — civilité non trouvée, fallback "Madame"', { candidat_id });
    civilite = 'Madame';
  }

  return {
    lignesT1,
    lignesT2,
    lignesT3,
    syntheseT2,
    t3ParPilier,
    civilite
  };
}

function parseJsonField(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  if (typeof value === 'string') {
    try { return JSON.parse(value); } catch { return []; }
  }
  return [];
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHME A1 — CALCUL DES RÔLES DES 5 PILIERS
// (cf. DOCTRINE_T4_4_ALGORITHMES.md §A1)
// ═══════════════════════════════════════════════════════════════════════════

function calculerRolesPiliers({ syntheseT2, t3ParPilier }) {
  const candidatures = {};
  for (const pilier of PILIERS) {
    if (!t3ParPilier[pilier]) {
      candidatures[pilier] = null;
      continue;
    }
    candidatures[pilier] = {
      pilier,
      socle_score:           t3ParPilier[pilier].candidature_socle_score,
      resistant_score:       t3ParPilier[pilier].candidature_resistant_score,
      signature_unifiee:     t3ParPilier[pilier].cluster_dominant_signature_unifiee === true,
      score_concentration:   t3ParPilier[pilier].score_concentration_pilier || 0,
      nb_circuits_actifs:    t3ParPilier[pilier].nb_circuits_actifs_pilier || 0,
      nb_signaux_limbiques:  t3ParPilier[pilier].nb_signaux_limbiques_pilier || 0
    };
  }

  // ─── ÉTAPE 1 : Désigner le pilier socle (1 seul) ──────────────────────
  const piliersForte = PILIERS.filter(p => candidatures[p]?.socle_score === 'FORTE');
  const piliersForteUnifies = piliersForte.filter(p => candidatures[p].signature_unifiee);
  const hypotheseT2 = syntheseT2.hypothese_pilier_dominant_ecart;
  const flagQuasiConforme = syntheseT2.flag_profil_quasi_conforme;

  let pilierSocle = null;
  let socleParDefaut = false;

  if (piliersForteUnifies.length === 1) {
    // Cas idéal — 1 seul pilier FORTE+unifié
    pilierSocle = piliersForteUnifies[0];
  } else if (piliersForteUnifies.length > 1) {
    // Plusieurs FORTE+unifiés — préférer celui désigné par T2 si match
    if (hypotheseT2 && piliersForteUnifies.includes(hypotheseT2)) {
      pilierSocle = hypotheseT2;
    } else {
      // Sinon : score_concentration max
      pilierSocle = piliersForteUnifies
        .sort((a, b) => candidatures[b].score_concentration - candidatures[a].score_concentration)[0];
    }
  } else if (piliersForte.length >= 1) {
    // Aucun FORTE+unifié, mais des FORTE non-unifiés — anomalie doctrinale
    // (cf. V8 du service T3) — on prend quand même le top concentration
    logger.warn('T4 — A1: aucun pilier FORTE+unifié, fallback sur FORTE max concentration', {
      piliers_forte: piliersForte
    });
    pilierSocle = piliersForte
      .sort((a, b) => candidatures[b].score_concentration - candidatures[a].score_concentration)[0];
    socleParDefaut = true;
  } else {
    // D1 — Aucun FORTE → fallback MOYENNE+unifié
    const piliersMoyenneUnifies = PILIERS.filter(p =>
      candidatures[p]?.socle_score === 'MOYENNE' && candidatures[p].signature_unifiee
    );
    if (piliersMoyenneUnifies.length > 0) {
      pilierSocle = piliersMoyenneUnifies
        .sort((a, b) => candidatures[b].score_concentration - candidatures[a].score_concentration)[0];
      socleParDefaut = true;
      logger.warn('T4 — A1: aucun FORTE, fallback sur MOYENNE+unifié', {
        pilier_socle_par_defaut: pilierSocle,
        piliers_moyenne_unifies: piliersMoyenneUnifies
      });
    }
    // Sinon pilierSocle reste null → l'orchestrateur lèvera une erreur
  }

  // ─── ÉTAPE 2 : Désigner le pilier résistant (0 ou 1) ──────────────────
  const piliersResistantForte = PILIERS.filter(p => candidatures[p]?.resistant_score === 'FORTE');
  let pilierResistant = null;
  if (piliersResistantForte.length === 1) {
    pilierResistant = piliersResistantForte[0];
  } else if (piliersResistantForte.length > 1) {
    // Plusieurs FORTE → prendre celui avec max nb_signaux_limbiques
    pilierResistant = piliersResistantForte
      .sort((a, b) => candidatures[b].nb_signaux_limbiques - candidatures[a].nb_signaux_limbiques)[0];
    logger.warn('T4 — A1: plusieurs piliers résistant FORTE — prudence', {
      piliers_resistant_forte: piliersResistantForte,
      pilier_resistant_retenu: pilierResistant
    });
  }

  // ─── ÉTAPES 3-4 : Structurants et fonctionnels ────────────────────────
  const roles = {};
  if (pilierSocle) roles[pilierSocle] = 'pilier_socle';

  // Tri des autres piliers par "proximité du socle"
  const autresPiliers = PILIERS.filter(p => p !== pilierSocle);
  const tri = autresPiliers
    .filter(p => candidatures[p] !== null)
    .sort((a, b) => {
      const scoreA = candidatures[a];
      const scoreB = candidatures[b];
      // 1. socle_score (FORTE > MOYENNE > FAIBLE > NULLE)
      const ordre = { FORTE: 4, MOYENNE: 3, FAIBLE: 2, NULLE: 1 };
      const diff = (ordre[scoreB.socle_score] || 0) - (ordre[scoreA.socle_score] || 0);
      if (diff !== 0) return diff;
      // 2. score_concentration décroissant
      const diff2 = scoreB.score_concentration - scoreA.score_concentration;
      if (diff2 !== 0) return diff2;
      // 3. nb_circuits_actifs décroissant
      return scoreB.nb_circuits_actifs - scoreA.nb_circuits_actifs;
    });

  // Les 2 premiers du tri = structurants 1 et 2
  if (tri.length >= 1) roles[tri[0]] = 'pilier_structurant_1';
  if (tri.length >= 2) roles[tri[1]] = 'pilier_structurant_2';

  // Les 2 (ou 1 si 4 piliers) suivants = fonctionnels selon position cycle
  const restants = tri.slice(2);
  for (const p of restants) {
    if (POSITION_CYCLE[p] === 'entree_cycle') {
      roles[p] = 'pilier_fonctionnel_1';
    } else if (POSITION_CYCLE[p] === 'sortie_cycle') {
      roles[p] = 'pilier_fonctionnel_2';
    } else {
      // P3 fonctionnel = cas spécial — position relative au socle
      const indexSocle = PILIERS.indexOf(pilierSocle);
      const indexP = PILIERS.indexOf(p);
      roles[p] = (indexP < indexSocle) ? 'pilier_fonctionnel_1' : 'pilier_fonctionnel_2';
    }
  }

  // S'il n'y a qu'1 fonctionnel (5 piliers - 1 socle - 2 structurants = 2 restants
  // donc on a normalement 2 fonctionnels) on est OK. Les piliers manquants
  // (t3ParPilier[p] === null) sont ignorés.

  return { roles, pilierSocle, pilierResistant, socleParDefaut };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHME A2 — DÉRIVATION DU FILTRE COGNITIF
// (cf. DOCTRINE_T4_4_ALGORITHMES.md §A2)
// ═══════════════════════════════════════════════════════════════════════════

function deriverFiltreCognitif({ candidat_id, pilierSocle, syntheseT3PilierSocle }) {
  // Garde-fou : si candidat dans la table de référence, retourner le filtre validé
  if (FILTRES_VALIDES_REFERENTS[candidat_id]) {
    logger.info('T4 — A2: filtre depuis table de référence', {
      candidat_id,
      pilier_socle: pilierSocle
    });
    return FILTRES_VALIDES_REFERENTS[candidat_id];
  }

  // Sinon : dérivation depuis cluster_dominant_lecture (T3)
  // C'est un point de départ ; le prompt Agent 4 affinera la formulation.
  // Verbe-pivot par pilier socle (heuristique de démarrage) :
  const VERBES_PAR_PILIER = {
    P1: 'Capter',
    P2: 'Réduire',
    P3: 'Lire',
    P4: 'Construire',
    P5: 'Mettre en œuvre'
  };

  const verbe = VERBES_PAR_PILIER[pilierSocle] || 'Lire';
  const lecture = syntheseT3PilierSocle?.cluster_dominant_lecture || '';

  // Formulation candidate (à raffiner par Agent 4)
  const formulation = `${verbe} ce qui prime dans la situation, depuis ${lecture.toLowerCase().slice(0, 60) || 'l\'observation'}`;

  return {
    formulation,
    precision_semantique: null,
    derive_par_algorithme: true  // marqueur : Agent 4 doit valider/affiner
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ALGORITHME A3 — INPUTS DES 3 GRANDES LIGNES DE FINALITÉ
// (cf. DOCTRINE_T4_4_ALGORITHMES.md §A3)
// ═══════════════════════════════════════════════════════════════════════════

function preparerInputsFinalite({ syntheseT2, syntheseT3PilierSocle, pilierResistant }) {
  const clusterDominant = syntheseT3PilierSocle?.cluster_dominant_circuits || '';
  const clusterLecture = syntheseT3PilierSocle?.cluster_dominant_lecture || '';

  // Pour les clusters secondaires, on regarde les circuits du pilier socle
  // (top 2 et top 3 par fréquence — déjà triés dans chargerSources)
  const circuits = syntheseT3PilierSocle?.circuits || [];
  const clustersSecondaires = circuits
    .slice(0, 3)
    .flatMap(c => c.clusters_identifies || [])
    .filter(cl => cl.rang === 1 || cl.rang === 2 || cl.rang === 3);

  return {
    grande_ligne_1: {
      // Grande ligne 1 : alignée sur le pattern T2 + cluster T3 rang 1
      pattern_t2:        syntheseT2.pattern_finalite_pressenti,
      cluster_ancrage:   clusterDominant,
      cluster_lecture:   clusterLecture,
      ancrage_pattern_t2: true
    },
    grande_ligne_2: {
      // Grande ligne 2 : 2ème cluster du pilier socle
      cluster_ancrage:   clustersSecondaires[1]?.circuit_partenaire || '',
      cluster_lecture:   '',
      ancrage_pattern_t2: false
    },
    grande_ligne_3: {
      // Grande ligne 3 : préservation/contrepartie
      pilier_resistant_present: !!pilierResistant,
      cluster_ancrage: pilierResistant
        ? 'modulation + signaux limbiques'
        : (clustersSecondaires[2]?.circuit_partenaire || ''),
      ancrage_pattern_t2: false
    }
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION DES PAYLOADS DES 6 SOUS-AGENTS
// ═══════════════════════════════════════════════════════════════════════════

function construirePayloadsSubAgents(params) {
  const {
    candidat_id, civilite, sources, roles, pilierSocle, pilierResistant,
    socleParDefaut, filtre, finaliteInputs
  } = params;

  // Section commune (anonymisée — candidat_id + civilite uniquement)
  const sectionCommune = { candidat_id, civilite };

  // Chiffres clés T1
  const chiffresT1 = {
    nb_conformes:  sources.syntheseT2.nb_conformes_total,
    nb_ecart:      sources.syntheseT2.nb_ecart_total,
    nb_scenarios:  5,
    ecart_details: sources.lignesT1
      .filter(r => r.conforme_ecart === 'ÉCART' || r.conforme_ecart === 'ECART')
      .map(r => ({
        question_id:           r.id_question,
        pilier_attendu:        r.pilier_demande,
        pilier_coeur_reponse:  r.pilier_coeur
      }))
  };

  // Section "attributions par pilier" — utilisée par plusieurs agents
  const attributionsParPilier = {};
  for (const pilier of PILIERS) {
    const t3 = sources.t3ParPilier[pilier];
    if (!t3) continue;
    attributionsParPilier[pilier] = {
      nom:                  NOMS_PILIERS_COMPLETS[pilier],
      role:                 roles[pilier] || null,
      mode_retenu:          '',  // sera rempli par Agent 3
      ...t3,
      circuits_dominants_top5: (t3.circuits || []).slice(0, 5)
    };
  }

  // Synthèse T2 enrichie pour chaque agent qui en a besoin
  const syntheseT2Complete = {
    ...sources.syntheseT2,
    pattern_finalite_pressenti: sources.syntheseT2.pattern_finalite_pressenti
  };

  // ─── Payload Agent 1 (Architecture) ───────────────────────────────────
  const agent1 = {
    ...sectionCommune,
    ...chiffresT1,
    synthese_t2: syntheseT2Complete,
    attributions_par_pilier: attributionsParPilier
    // Note : pas de mode_retenu ici (Agent 1 reçoit role + chiffres T1/T2/T3)
  };

  // ─── Payload Agent 2 (Circuits) ───────────────────────────────────────
  const agent2 = {
    ...sectionCommune,
    attributions_par_pilier: attributionsParPilier,
    // Lignes T3 par pilier (jusqu'à 15 par pilier)
    t3_lignes_par_pilier: Object.fromEntries(
      PILIERS.map(p => [p, (sources.t3ParPilier[p]?.circuits) || []])
    )
  };

  // ─── Payload Agent 3 (Modes) — calcule mode_retenu via son prompt ─────
  const agent3 = {
    ...sectionCommune,
    attributions_par_pilier: attributionsParPilier,
    filtre,
    synthese_t2: syntheseT2Complete
  };

  // ─── Payload Agent 4 (Synthèse cœur) — Phase 2, modes_retenus ajoutés ─
  const agent4 = {
    ...sectionCommune,
    ...chiffresT1,
    pilier_socle: {
      id: pilierSocle,
      nom: NOMS_PILIERS_COMPLETS[pilierSocle],
      ...sources.t3ParPilier[pilierSocle]
    },
    pilier_resistant: pilierResistant ? {
      id: pilierResistant,
      nom: NOMS_PILIERS_COMPLETS[pilierResistant],
      ...sources.t3ParPilier[pilierResistant]
    } : null,
    clusters_socle_top3: extraireTop3ClustersSocle(sources.t3ParPilier[pilierSocle]),
    sequences: extraireSequencesT1(sources.lignesT1, pilierSocle),
    filtre,
    synthese_t2: syntheseT2Complete,
    finalite_grandes_lignes: finaliteInputs,
    socle_par_defaut: socleParDefaut
    // modes_retenus sera ajouté entre Phase 1 et Phase 2 (cf. orchestrateur)
  };

  // ─── Payload Agent 5 (Coûts/Clôture) — Phase 2, modes + signature A4 ──
  const agent5 = {
    ...sectionCommune,
    attributions_par_pilier: attributionsParPilier,
    synthese_t2: syntheseT2Complete,
    filtre_formulation:                filtre.formulation,
    filtre_precision_semantique:       filtre.precision_semantique,
    grande_ligne_finalite_principale:  '',  // sera rempli depuis sortie Agent 4 (à raffiner)
    pilier_socle: {
      id: pilierSocle,
      nom: NOMS_PILIERS_COMPLETS[pilierSocle]
    },
    pilier_resistant: pilierResistant ? {
      id: pilierResistant,
      nom: NOMS_PILIERS_COMPLETS[pilierResistant],
      ...sources.t3ParPilier[pilierResistant]
    } : null
    // modes_retenus, signature_recit_agent4, etc. ajoutés entre Phase 1 et 2
  };

  // ─── Payload Agent 6 (Transverses) ─────────────────────────────────────
  const agent6 = {
    ...sectionCommune,
    nb_conformes:  sources.syntheseT2.nb_conformes_total,
    nb_ecart:      sources.syntheseT2.nb_ecart_total,
    nb_scenarios:  5,
    pilier_socle: {
      id: pilierSocle,
      nom: NOMS_PILIERS_COMPLETS[pilierSocle],
      score_concentration_pilier:      sources.t3ParPilier[pilierSocle]?.score_concentration_pilier || 0,
      cluster_dominant_circuits:       sources.t3ParPilier[pilierSocle]?.cluster_dominant_circuits || '',
      cluster_dominant_co_occurrences: sources.t3ParPilier[pilierSocle]?.cluster_dominant_co_occurrences || 0
    },
    piliers_structurants: PILIERS
      .filter(p => roles[p] === 'pilier_structurant_1' || roles[p] === 'pilier_structurant_2')
      .sort((a, b) => roles[a] === 'pilier_structurant_1' ? -1 : 1)
      .map((p, i) => ({ id: p, nom: NOMS_PILIERS_COMPLETS[p], rang: i + 1 })),
    piliers_fonctionnels: PILIERS
      .filter(p => roles[p] === 'pilier_fonctionnel_1' || roles[p] === 'pilier_fonctionnel_2')
      .map(p => ({
        id: p,
        nom: NOMS_PILIERS_COMPLETS[p],
        position: roles[p] === 'pilier_fonctionnel_1' ? 'entree_cycle' : 'sortie_cycle',
        resistant: p === pilierResistant
      })),
    filtre_formulation:           filtre.formulation,
    filtre_precision_semantique:  filtre.precision_semantique,
    grandes_lignes_finalite: [
      // Les formulations finales viendront d'Agent 4 ; ici on injecte juste
      // des placeholders pour le cartouche
      finaliteInputs.grande_ligne_1.pattern_t2,
      'À formuler par Agent 4',
      'À formuler par Agent 4'
    ],
    synthese_t2: syntheseT2Complete
  };

  return { agent1, agent2, agent3, agent4, agent5, agent6 };
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function extraireTop3ClustersSocle(t3PilierSocle) {
  if (!t3PilierSocle?.circuits) return [];
  const allClusters = t3PilierSocle.circuits
    .flatMap(c => (c.clusters_identifies || []).map(cl => ({
      ...cl,
      from_circuit: c.circuit_id
    })));
  // Dédupliquer (même paire) en gardant max nb_co_occurrences
  const seen = new Map();
  for (const cl of allClusters) {
    const key = [cl.from_circuit, cl.circuit_partenaire].sort().join('×');
    if (!seen.has(key) || seen.get(key).nb_co_occurrences < cl.nb_co_occurrences) {
      seen.set(key, cl);
    }
  }
  return [...seen.values()]
    .sort((a, b) => b.nb_co_occurrences - a.nb_co_occurrences)
    .slice(0, 3);
}

function extraireSequencesT1(lignesT1, pilierSocle) {
  // Compter combien de fois pilier_coeur == pilierSocle (réponses entrant par socle)
  const nbReponsesEntreeSocle = lignesT1.filter(r => r.pilier_coeur === pilierSocle).length;
  return {
    pilier_entree_dominant: pilierSocle,
    nb_reponses_entree_socle: nbReponsesEntreeSocle,
    sequences_types_observees: [
      // Note : la dérivation fine des séquences typiques est faite par
      // Agent 4 via son prompt, pas algorithmiquement ici
    ],
    tendance: 'à analyser par Agent 4'
  };
}

function extraireModesRetenus(a3Result) {
  // Agent 3 produit pX_mode_lab et pX_mode_cand. On extrait le mode retenu
  // de pX_mode_lab par regex sur le titre HTML.
  const modes = {};
  for (const pilier of PILIERS) {
    const lab = a3Result.result?.[`${pilier.toLowerCase()}_mode_lab`] || '';
    const match = lab.match(/Mode retenu\s*:\s*[«"]([^»"]+)[»"]/i);
    modes[pilier] = match ? match[1].trim() : '';
  }
  return modes;
}

function trackUsage(usages, costs, agentResult) {
  if (agentResult?.usage) usages.push(agentResult.usage);
  if (typeof agentResult?.cost === 'number') costs.push(agentResult.cost);
}

function agregerUsages(usages) {
  return usages.reduce((acc, u) => ({
    input_tokens:                (acc.input_tokens || 0) + (u.input_tokens || 0),
    output_tokens:               (acc.output_tokens || 0) + (u.output_tokens || 0),
    cache_read_input_tokens:     (acc.cache_read_input_tokens || 0) + (u.cache_read_input_tokens || 0),
    cache_creation_input_tokens: (acc.cache_creation_input_tokens || 0) + (u.cache_creation_input_tokens || 0)
  }), {});
}

// ═══════════════════════════════════════════════════════════════════════════
// AGRÉGATION DU BILAN — 56 colonnes + 6 audits = 62 champs
// ═══════════════════════════════════════════════════════════════════════════

function agregerBilanT4({ a1, a2, a3, a4, a5, a6 }) {
  const bilan = {};
  // Agent 1 — 11 champs (10 contenus + audit)
  Object.assign(bilan, a1 || {});
  // Agent 2 — 16 champs (15 + audit)
  Object.assign(bilan, a2 || {});
  // Agent 3 — 11 champs (10 + audit)
  Object.assign(bilan, a3 || {});
  // Agent 4 — 8 champs (7 + audit)
  Object.assign(bilan, a4 || {});
  // Agent 5 — 4 champs (3 + audit)
  Object.assign(bilan, a5 || {});
  // Agent 6 — 11 champs (10 + audit)
  Object.assign(bilan, a6 || {});

  return bilan;
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION COHÉRENCE CROSS-AGENTS
// ═══════════════════════════════════════════════════════════════════════════

function validerCoherenceBilan({ bilan_t4, candidat_id }) {
  const errors = [];

  // V1 — Présence des audits des 6 agents
  for (const i of [1, 2, 3, 4, 5, 6]) {
    if (!bilan_t4[`audit_agent${i}`]) {
      errors.push(`V1: audit_agent${i} manquant`);
    }
  }

  // V2 — Présence des champs critiques par agent
  const champsCritiques = [
    // Agent 1
    'p3_entete', 'p3_pourquoi_role',
    // Agent 2
    'p3_circuits_lab', 'p3_circuits_cand', 'p3_commentaires_t3',
    // Agent 3
    'p3_mode_lab', 'p3_mode_cand',
    // Agent 4 — cœur doctrinal
    'd1_filtre_lab', 'd1_filtre_cand', 'd2_boucle_lab', 'd2_boucle_cand',
    'd3_finalite_lab', 'd3_finalite_cand', 'd4_signature',
    // Agent 5
    'd5_couts_lab', 'd5_couts_cand', 'd6_conclusion',
    // Agent 6
    'a_cartouche_attribution', 'b_lexique_html', 'e_header', 'e_navigation', 'e_footer'
  ];
  for (const champ of champsCritiques) {
    if (!bilan_t4[champ] || bilan_t4[champ].length < 50) {
      errors.push(`V2: champ critique ${champ} manquant ou anormalement court`);
    }
  }

  // V3 — Pas de prénom rédigé en clair (anonymisation)
  // (Best-effort — détection de patterns « Bonjour <Mot Capitalisé> »)
  const champsHumains = ['e_header', 'e_footer', 'd1_filtre_cand', 'd6_conclusion'];
  for (const champ of champsHumains) {
    const html = bilan_t4[champ] || '';
    // Cherche des balises h1/h2/h3 contenant un mot capitalisé sans placeholder
    const m = html.match(/<h[1-3][^>]*>([A-Z][a-zà-ÿ]+)<\/h[1-3]>/);
    if (m && !m[1].includes('{') && m[1] !== 'Pour' && m[1] !== 'Votre') {
      errors.push(`V3 ${champ}: possible prénom en clair "${m[1]}" — vérifier anonymisation`);
    }
  }

  if (errors.length > 0) {
    logger.error('T4 — validation cohérence bilan échouée', { candidat_id, errors });
    throw new Error(
      `T4 — validation cohérence bilan échouée:\n  - ${errors.join('\n  - ')}`
    );
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORT
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runOrchestratorT4,
  // Exports pour tests/debug
  calculerRolesPiliers,
  deriverFiltreCognitif,
  preparerInputsFinalite,
  construirePayloadsSubAgents,
  agregerBilanT4,
  validerCoherenceBilan,
  PILIERS,
  NOMS_PILIERS_COMPLETS,
  POSITION_CYCLE,
  FILTRES_VALIDES_REFERENTS
};
