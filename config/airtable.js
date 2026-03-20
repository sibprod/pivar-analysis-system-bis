// config/airtable.js
// Source de vérité des noms de champs Airtable — Projet Profil Cognitif
//
// ⚠️ RÈGLES ABSOLUES :
//   1. Jamais d'IDs fldXXX ici — uniquement les noms de champs en string
//   2. Toute modification = vérifier organigramme_v2_updated.html
//      ET organigramme_certificateur_v4_1.html AVANT de toucher ce fichier
//   3. Table de production BILAN = "Copie de BILAN 2" (tbljRMIMjM9SwVyox)
//      Ne jamais écrire dans BILAN (tblwDTaLbKaL9OvOq) ni Copie de BILAN (tblEeA4RkBdzxAAA5)
//
// Schéma vérifié directement via MCP Airtable — base appgghhXjYBdFRras
// Dernière vérification : 19 mars 2026
// Version : v8.2 — ajout pilier_structurant2_certif + corrections types Certificateur

'use strict';

// ═══════════════════════════════════════════════════════════════════════════
// IDs DES TABLES (les seuls IDs autorisés dans ce fichier)
// ═══════════════════════════════════════════════════════════════════════════

const TABLES = {
  VISITEUR:  'tblslPP9B71FveOX5',
  RESPONSES: 'tblLnWhszYAQldZOJ',
  BILAN:     'tbljRMIMjM9SwVyox',  // "Copie de BILAN 2" — table de production
};

// ═══════════════════════════════════════════════════════════════════════════
// CHAMPS VISITEUR (tblslPP9B71FveOX5)
// ═══════════════════════════════════════════════════════════════════════════

const VISITEUR_FIELDS = {
  // Identité candidat
  candidate_ID:               'candidate_ID',              // singleLineText — clé primaire
  Prenom:                     'Prenom',                    // singleLineText
  Nom:                        'Nom',                       // singleLineText
  Email:                      'Email',                     // email
  Entreprise:                 'Entreprise',                // singleLineText

  // Statuts pipeline
  statut_analyse_pivar:       'statut_analyse_pivar',      // singleSelect — ⚠️ MANUEL uniquement, jamais via API
  statut_test:                'statut_test',               // singleSelect
  progression_analyse:        'progression_analyse',       // number
  erreur_analyse:             'erreur_analyse',            // multilineText
  nombre_tentatives_analyse:  'nombre_tentatives_analyse', // number
  type_erreur_analyse:        'type_erreur_analyse',       // singleSelect
  derniere_tentative_analyse: 'derniere_tentative_analyse',// dateTime
  derniere_activite:          'derniere_activite',         // dateTime
  derniere_question_repondue: 'derniere_question_repondue',// number

  // Liens vers autres tables
  RESPONSES:                  'RESPONSES',                 // multipleRecordLinks
  BILAN_2:                    'Copie de BILAN 2',          // multipleRecordLinks → table de prod

  // Backups (écrits par l'orchestrateur à chaque étape)
  backup_before_agent1:       'backup_before_agent1',      // multilineText
  backup_after_agent1:        'backup_after_agent1',       // multilineText
  backup_before_agent2:       'backup_before_agent2',      // multilineText
  backup_after_agent2:        'backup_after_agent2',       // multilineText
  backup_before_algo:         'backup_before_algo',        // multilineText
  backup_after_algo:          'backup_after_algo',         // multilineText
  backup_before_boucles:      'backup_before_boucles',     // multilineText
  backup_after_boucles:       'backup_after_boucles',      // multilineText
  backup_before_certif:       'backup_before_certif',      // multilineText
  backup_after_certif:        'backup_after_certif',       // multilineText
  backup_sommeil:             'backup_sommeil',            // multilineText
  backup_weekend:             'backup_weekend',            // multilineText
  backup_animal:              'backup_animal',             // multilineText
  backup_panne:               'backup_panne',              // multilineText
};

// ═══════════════════════════════════════════════════════════════════════════
// CHAMPS RESPONSES (tblLnWhszYAQldZOJ)
// 1 ligne par question — 25 lignes par candidat
// ═══════════════════════════════════════════════════════════════════════════

const RESPONSES_FIELDS = {

  // ── Identité & navigation ─────────────────────────────────────────────
  session_ID:                     'session_ID',                    // singleLineText
  id_question:                    'id_question',                   // singleLineText
  numero_global:                  'numero_global',                 // number (1→25)
  pilier:                         'pilier',                        // singleSelect : P1/P2/P3/P4/P5
  scenario_nom:                   'scenario_nom',                  // singleSelect : SOMMEIL/WEEKEND/ANIMAL/PANNE
  question_text:                  'question_text',                 // multilineText
  response_text:                  'response_text',                 // multilineText
  statut_reponse:                 'statut_reponse',                // singleSelect
  date_response:                  'date_response',                 // dateTime
  statut_analyse_reponses:        'statut_analyse_reponses',       // singleSelect

  // ── Statuts traitement ───────────────────────────────────────────────
  question_analysee:              'question_analysee',             // checkbox — écrit par Agent 1
  question_scoree:                'question_scoree',               // checkbox — écrit par Vérificateur

  // ── AGENT 1 (Observateur cognitif) ──────────────────────────────────
  // Écrits question par question (×25)
  analyse_json_agent1:            'analyse_json_agent1',           // multilineText — JSON complet Agent 1
  pilier_reponse_coeur:           'pilier_reponse_coeur',          // singleSelect — pilier cœur brut Agent 1
  niveau_amplitude_reponse:       'niveau_amplitude_reponse',      // singleSelect "1"→"9" — niveau cœur Agent 1
  liste_piliers_actives:          'liste_piliers_actives',         // multilineText — séquence ex: "P3→P1→P5"
  piliers_actives_final:          'piliers_actives_final',         // multilineText — JSON array ex: ["P3","P1"]
  boucles_detectees_agent1:       'boucles_detectees_agent1',      // multilineText — narratif boucles Agent 1
  nombre_boucles_agent1:          'nombre_boucles_agent1',         // number

  // ── VÉRIFICATEUR (Arbitrage pilier cœur) ────────────────────────────
  // Écrits question par question (×25)
  // pilier_reponse_coeur_confirme = référence absolue pour tout le pipeline aval
  analyse_json_verificateur:      'analyse_json_verificateur',     // multilineText — JSON complet Vérificateur
  pilier_reponse_coeur_confirme:  'pilier_reponse_coeur_confirme', // singleSelect — pilier arbitré FINAL ← Vérificateur
                                                                   // ⚠️ RÉFÉRENCE ABSOLUE — utilisé par Algo + Certificateur
                                                                   // ≠ pilier_reponse_coeur (Agent 1 — observation brute)
  coherence:                      'coherence',                     // singleSelect CONFIRMÉ/CORRIGÉ/MAINTENU_AVEC_RÉSERVE ← Vérificateur
  coherence_agents:               'coherence_agents',              // singleSelect — NE PAS écrire ici — écrit par Agent 3
  verification_coeur:             'verification_coeur',            // multilineText — justification arbitrage ← Vérificateur
  justification_attribution_pilier_coeur: 'justification_attribution_pilier_coeur', // multilineText — SUPPRIMÉ des services (doublon verification_coeur)
  justification_actions_majoritairement_faites: 'justification_actions_majoritairement_faites', // multilineText — reserve_eventuelle ← Vérificateur

  // Qualification réponse ← Vérificateur (options Airtable : "oui" / "non" — confirmé MCP)
  repond_question:                'repond_question',               // singleSelect "oui"/"non" ← Vérificateur
  traite_problematique_situation: 'traite_problematique_situation',// singleSelect "oui"/"non" ← Vérificateur
  fait_processus_pilier:          'fait_processus_pilier',         // singleSelect "oui"/"non" ← Vérificateur

  // ── AGENT 2 (Scoring dimensions) ────────────────────────────────────
  // Écrits question par question (×25)
  analyse_json_agent2:            'analyse_json_agent2',           // multilineText — JSON complet Agent 2

  // M4 — dimensions simples (actions SÉPARÉES des critères)
  dimensions_simples:             'dimensions_simples',            // number — nb actions simples
  liste_dimensions_simples:       'liste_dimensions_simples',      // multilineText — uniquement les ACTIONS
  nombre_criteres_details:        'nombre_criteres_details',       // number — nb critères détaillés (≠ actions)
  liste_criteres_details:         'liste_criteres_details',        // multilineText — uniquement les CRITÈRES

  // M5 — dimensions sophistiquées
  dimensions_sophistiquees:       'dimensions_sophistiquees',      // number
  liste_dimensions_sophistiquees: 'liste_dimensions_sophistiquees',// multilineText
  niveau_sophistication:          'niveau_sophistication',         // singleSelect faible/moyen/élevé/très élevé ← v8.2

  // M7 — amplitude
  niveau_amplitude_max:           'niveau_amplitude_max',          // singleSelect EXÉCUTEUR→ARCHITECTE ← Agent 2 M7
  zone_amplitude_max:             'zone_amplitude_max',            // singleSelect Exécution/Opérationnelle/Stratégique
  detail_par_niveaux:             'detail_par_niveaux',            // multilineText — JSON M7 complet par pilier
  plusieurs_niveaux_reponse:      'plusieurs_niveaux_reponse',     // multipleSelects ['oui']/['non'] ← CORRECTION v8.2
  justification_attribution_niveau: 'justification_attribution_niveau', // multilineText ← Vérificateur difficulte_referentiel

  // M8 — lecture cognitive
  nombre_mots_reponse:            'nombre_mots_reponse',           // number ← Agent 2 M8
  laconique:                      'laconique',                     // checkbox ← Agent 2 M8
  score_question_niveau:          'score_question_niveau',         // number
  score_question_calcule:         'score_question_calcule',        // number

  // ── AGENT 3 (Circuits & boucles) ────────────────────────────────────
  // Écrits question par question (×25)
  analyse_json_agent3:            'analyse_json_agent3',           // multilineText — JSON complet Agent 3
  circuits_actives:               'circuits_actives',              // multilineText — JSON circuits par pilier ← M2
  boucles_detectees_agent3:       'boucles_detectees_agent3',      // multilineText — boucles structurelles M5A
  // ⚠️ ≠ boucles_detectees_agent1 (narratif Agent 1) — deux méthodes indépendantes
  nombre_boucles_agent3:          'nombre_boucles_agent3',         // number
  coherence_agent1_agent3:        'coherence_agent1_agent3',       // singleSelect TOTALE/PARTIELLE/FAIBLE ← M5A
  // ⚠️ liste_piliers_actives N'EST PAS écrit par Agent 3 — valeur Vérificateur préservée
  lecture_cognitive_m8:           'lecture_cognitive_m8',          // multilineText — rempli lors synthèse pilier
  profiling_qualifie:             'profiling_qualifie',            // multilineText — FLAG_REVISION/OK ← M5A
  capacites_detectees:            'capacites_detectees',           // multilineText ← Agent 2 M8

  // Limbique (Agent 2 M8 + Agent 3 M0)
  limbique_detecte:               'limbique_detecte',              // checkbox
  limbique_intensite:             'limbique_intensite',            // singleSelect
  limbique_detail:                'limbique_detail',               // multilineText

  // Dimensions excellence (Agent 2 M6) — par question
  anticipation_niveau:            'anticipation_niveau',           // singleSelect
  anticipation_spontanee:         'anticipation_spontanee',        // singleSelect
  anticipation_verbatim:          'anticipation_verbatim',         // multilineText
  anticipation_manifestation:     'anticipation_manifestation',    // multilineText
  anticipation_contexte_activation: 'anticipation_contexte_activation', // multilineText

  decentration_niveau:            'decentration_niveau',           // singleSelect
  decentration_cognitive:         'decentration_cognitive',        // singleSelect
  decentration_manifestation:     'decentration_manifestation',    // multilineText
  decentration_verbatim:          'decentration_verbatim',         // multilineText
  decentration_contexte_activation: 'decentration_contexte_activation', // multilineText

  metacognition_niveau:           'metacognition_niveau',          // singleSelect
  metacognition_manifestation:    'metacognition_manifestation',   // multilineText
  metacognition_verbatim:         'metacognition_verbatim',        // multilineText
  metacognition_contexte_activation: 'metacognition_contexte_activation', // multilineText

  vue_systemique_niveau:          'vue_systemique_niveau',         // singleSelect
  vue_systemique_verbatim:        'vue_systemique_verbatim',       // multilineText
  vue_systemique_manifestation:   'vue_systemique_manifestation',  // multilineText
  vue_systemique_contexte_activation: 'vue_systemique_contexte_activation', // multilineText
};

// ═══════════════════════════════════════════════════════════════════════════
// CHAMPS BILAN — "Copie de BILAN 2" (tbljRMIMjM9SwVyox)
// 1 ligne par candidat
// ═══════════════════════════════════════════════════════════════════════════

const BILAN_FIELDS = {

  // ── Identité ─────────────────────────────────────────────────────────
  bilan_ID:                       'bilan_ID',                      // singleLineText
  session_ID:                     'session_ID',                    // singleLineText
  date_generation:                'date_generation',               // dateTime

  // Liens
  VISITEUR:                       'VISITEUR',                      // multipleRecordLinks
  RESPONSES:                      'RESPONSES',                     // multipleRecordLinks

  // Données internes Algo — consultation uniquement
  // ⚠️ JAMAIS transmises au Certificateur
  synthese_json_complete:         'synthese_json_complete',        // multilineText

  // ── AGENT 1 → BILAN ──────────────────────────────────────────────────
  // Écrits 1 seule fois après les 25 questions (appel corpus)
  moteur_cognitif:                'moteur_cognitif',               // multilineText ← Section B
  binome_actif:                   'binome_actif',                  // multilineText ← Section B
  reaction_flou:                  'reaction_flou',                 // multilineText ← Section B
  signature_cloture:              'signature_cloture',             // multilineText ← Section B
  pattern_emergent:               'pattern_emergent',              // multilineText ← Section C
  agent1_rapport:                 'agent1_rapport',                // multilineText — rapport lisible humain

  // ── ALGO → BILAN (calculs mathématiques purs) ────────────────────────
  // Signaux qualité
  coherence_agents:               'coherence_agents',              // singleSelect ← Agent 3 M5A
  profil_laconique:               'profil_laconique',              // number
  taux_repond_question:           'taux_repond_question',          // number
  taux_traite_problematique:      'taux_traite_problematique',     // number
  taux_fait_processus_pilier:     'taux_fait_processus_pilier',    // number

  // Profil global
  niveau_global:                  'niveau_global',                 // number
  zone_globale:                   'zone_globale',                  // singleSelect
  score_global:                   'score_global',                  // number
  profil_type:                    'profil_type',                   // singleSelect
  distribution_reelle:            'distribution_reelle',           // multilineText

  // Scores & niveaux par pilier
  score_pilier_P1:                'score_pilier_P1',               // number
  niveau_max_P1:                  'niveau_max_P1',                 // singleSelect
  score_pilier_P2:                'score_pilier_P2',               // number
  niveau_max_P2:                  'niveau_max_P2',                 // singleSelect
  score_pilier_P3:                'score_pilier_P3',               // number
  niveau_max_P3:                  'niveau_max_P3',                 // singleSelect
  score_pilier_P4:                'score_pilier_P4',               // number
  niveau_max_P4:                  'niveau_max_P4',                 // singleSelect
  score_pilier_P5:                'score_pilier_P5',               // number
  niveau_max_P5:                  'niveau_max_P5',                 // singleSelect

  // Dimensions par pilier
  P1_simples_total:               'P1_simples_total',              // number
  P1_simples_synthese:            'P1_simples_synthese',           // multilineText
  PX_details_total_P1:            'PX_details_total_P1',           // number
  P1_sophistiquees_total:         'P1_sophistiquees_total',        // number
  P1_sophistiquees_synthese:      'P1_sophistiquees_synthese',     // multilineText

  P2_simples_total:               'P2_simples_total',              // number
  P2_simples_synthese:            'P2_simples_synthese',           // multilineText
  PX_details_total_P2:            'PX_details_total_P2',           // number
  P2_sophistiquees_total:         'P2_sophistiquees_total',        // number
  P2_sophistiquees_synthese:      'P2_sophistiquees_synthese',     // multilineText

  P3_simples_total:               'P3_simples_total',              // number
  P3_simples_synthese:            'P3_simples_synthese',           // multilineText
  PX_details_total_P3:            'PX_details_total_P3',           // number
  P3_sophistiquees_total:         'P3_sophistiquees_total',        // number
  P3_sophistiquees_synthese:      'P3_sophistiquees_synthese',     // multilineText

  P4_simples_total:               'P4_simples_total',              // number
  P4_simples_synthese:            'P4_simples_synthese',           // multilineText
  PX_details_total_P4:            'PX_details_total_P4',           // number
  P4_sophistiquees_total:         'P4_sophistiquees_total',        // number
  P4_sophistiquees_synthese:      'P4_sophistiquees_synthese',     // multilineText

  P5_simples_total:               'P5_simples_total',              // number
  P5_simples_synthese:            'P5_simples_synthese',           // multilineText
  PX_details_total_P5:            'PX_details_total_P5',           // number
  P5_sophistiquees_total:         'P5_sophistiquees_total',        // number
  P5_sophistiquees_synthese:      'P5_sophistiquees_synthese',     // multilineText

  dimensions_simples_json:        'dimensions_simples_json',       // multilineText
  dimensions_sophistiquees_json:  'dimensions_sophistiquees_json', // multilineText
  dimensions_superieures_liste:   'dimensions_superieures_liste',  // multilineText
  dimensions_superieures_count:   'dimensions_superieures_count',  // number

  // Boucles par pilier ← Agent 3 M5B
  boucles_detectees_agent1:       'boucles_detectees_agent1',      // multilineText (agrégé)
  boucles_detectees_agent3:       'boucles_detectees_agent3',      // multilineText (agrégé)
  nombre_boucles_agent1:          'nombre_boucles_agent1',         // number
  nombre_boucles_agent3:          'nombre_boucles_agent3',         // number
  boucles_detectees_pilier_P1:    'boucles_detectees_pilier_P1',   // multilineText
  boucles_detectees_pilier_P2:    'boucles_detectees_pilier_P2',   // multilineText
  boucles_detectees_pilier_P3:    'boucles_detectees_pilier_P3',   // multilineText
  boucles_detectees_pilier_P4:    'boucles_detectees_pilier_P4',   // multilineText
  boucles_detectees_pilier_P5:    'boucles_detectees_pilier_P5',   // multilineText

  // Circuits top3 par pilier ← Agent 3 M5B
  circuits_top3_P1:               'circuits_top3_P1',              // multilineText
  circuits_top3_P2:               'circuits_top3_P2',              // multilineText
  circuits_top3_P3:               'circuits_top3_P3',              // multilineText
  circuits_top3_P4:               'circuits_top3_P4',              // multilineText
  circuits_top3_P5:               'circuits_top3_P5',              // multilineText

  // Analyse narrative ← Agent 3 M7
  lecture_cognitive_enrichie_P1:  'lecture_cognitive_enrichie_P1', // multilineText
  lecture_cognitive_enrichie_P2:  'lecture_cognitive_enrichie_P2', // multilineText
  lecture_cognitive_enrichie_P3:  'lecture_cognitive_enrichie_P3', // multilineText
  lecture_cognitive_enrichie_P4:  'lecture_cognitive_enrichie_P4', // multilineText
  lecture_cognitive_enrichie_P5:  'lecture_cognitive_enrichie_P5', // multilineText
  profil_neuroscientifique_P1:    'profil_neuroscientifique_P1',   // multilineText
  profil_neuroscientifique_P2:    'profil_neuroscientifique_P2',   // multilineText
  profil_neuroscientifique_P3:    'profil_neuroscientifique_P3',   // multilineText
  profil_neuroscientifique_P4:    'profil_neuroscientifique_P4',   // multilineText
  profil_neuroscientifique_P5:    'profil_neuroscientifique_P5',   // multilineText

  // Profil coché par pilier ← Certificateur
  profil_coché_P1:                'profil_coché_P1',               // multilineText
  profil_coché_P2:                'profil_coché_P2',               // multilineText
  profil_coché_P3:                'profil_coché_P3',               // multilineText
  profil_coché_P4:                'profil_coché_P4',               // multilineText
  profil_coché_P5:                'profil_coché_P5',               // multilineText

  // Excellences par pilier ← Algo agrégation
  excellences_par_pilier_P1:      'excellences_par_pilier_P1',     // multilineText
  excellences_par_pilier_P2:      'excellences_par_pilier_P2',     // multilineText
  excellences_par_pilier_P3:      'excellences_par_pilier_P3',     // multilineText
  excellences_par_pilier_P4:      'excellences_par_pilier_P4',     // multilineText
  excellences_par_pilier_P5:      'excellences_par_pilier_P5',     // multilineText

  // Limbique agrégé ← Algo
  limbique_detecte:               'limbique_detecte',              // singleSelect
  limbique_intensite_max:         'limbique_intensite_max',        // singleSelect
  nb_questions_limbiques:         'nb_questions_limbiques',        // number

  // Dimensions excellence agrégées ← Algo
  anticipation_niveau:            'anticipation_niveau',           // singleSelect
  anticipation_pattern:           'anticipation_pattern',          // singleSelect
  anticipation_declencheur:       'anticipation_declencheur',      // multilineText
  anticipation_synthese:          'anticipation_synthese',         // multilineText
  anticipation_qualification:     'anticipation_qualification',    // multilineText
  anticipation_verbatims_agreges: 'anticipation_verbatims_agreges',// multilineText
  anticipation_manifestations_agreges: 'anticipation_manifestations_agreges', // multilineText

  decentration_niveau:            'decentration_niveau',           // singleSelect
  decentration_pattern:           'decentration_pattern',          // singleSelect
  decentration_declencheur:       'decentration_declencheur',      // multilineText
  decentration_synthese:          'decentration_synthese',         // multilineText
  decentration_qualification:     'decentration_qualification',    // multilineText
  decentration_verbatims_agreges: 'decentration_verbatims_agreges',// multilineText
  decentration_manifestations_agreges: 'decentration_manifestations_agreges', // multilineText

  metacognition_niveau:           'metacognition_niveau',          // singleSelect
  metacognition_pattern:          'metacognition_pattern',         // singleSelect
  metacognition_declencheur:      'metacognition_declencheur',     // multilineText
  metacognition_synthese:         'metacognition_synthese',        // multilineText
  metacognition_qualification:    'metacognition_qualification',   // multilineText
  metacognition_verbatims_agreges:'metacognition_verbatims_agreges',// multilineText
  metacognition_manifestations_agreges: 'metacognition_manifestations_agreges', // multilineText

  vue_systemique_niveau:          'vue_systemique_niveau',         // singleSelect
  vue_systemique_pattern:         'vue_systemique_pattern',        // singleSelect
  vue_systemique_declencheur:     'vue_systemique_declencheur',    // multilineText
  vue_systemique_synthese:        'vue_systemique_synthese',       // multilineText ← corrigé v8.2 (était singleSelect, type réel = multilineText)
  vue_systemique_qualification:   'vue_systemique_qualification',  // multilineText
  vue_systemique_verbatims_agreges: 'vue_systemique_verbatims_agreges', // multilineText
  vue_systemique_manifestations_agreges: 'vue_systemique_manifestations_agreges', // multilineText

  // Excellences par scénario ← Algo
  excellences_SOMMEIL:            'excellences_SOMMEIL',           // multilineText
  excellences_WEEKEND:            'excellences_WEEKEND',           // multilineText
  excellences_ANIMAL:             'excellences_ANIMAL',            // multilineText
  excellences_PANNE:              'excellences_PANNE',             // multilineText
  excellence_dominante:           'excellence_dominante',          // singleSelect
  excellence_secondaire:          'excellence_secondaire',         // singleSelect
  profil_excellences:             'profil_excellences',            // multilineText

  // ── CERTIFICATEUR → BILAN ─────────────────────────────────────────────
  // Produits par le Certificateur (3 prompts) — JAMAIS par l'Algo
  // P1 : profil_coché + synthèses dimensions + excellences
  // P2 : piliers certifiés + diagnostics encadrement/management
  // P3 : sections narratives + rapport complet
  type_profil_cognitif:           'type_profil_cognitif',          // multilineText
  niveau_profil_cognitif:         'niveau_profil_cognitif',        // number
  nom_niveau_profil_cognitif:     'nom_niveau_profil_cognitif',    // singleSelect
  zone_profil_cognitif:           'zone_profil_cognitif',          // singleSelect
  pilier_dominant_certif:         'pilier_dominant_certif',        // singleSelect
  pilier_structurant_certif:      'pilier_structurant_certif',     // singleSelect P1-P5 ← Certificateur
  pilier_structurant2_certif:     'pilier_structurant2_certif',    // singleSelect P1→P5 ← Certificateur — options P1/P2/P3/P4/P5 (fldUXIuetnVGjCiAR)
  piliers_moteurs_certif:         'piliers_moteurs_certif',        // multilineText
  boucle_cognitive_ordre:         'boucle_cognitive_ordre',        // multilineText
  definition_type_profil_cognitif:'definition_type_profil_cognitif',// multilineText
  profil_personnalise:            'profil_personnalise',           // multilineText

  // Diagnostics encadrement/management ← Certificateur
  encadrement_verdict:            'encadrement_verdict',           // singleSelect
  encadrement_diagnostic:         'encadrement_diagnostic',        // multilineText
  encadrement_scenario:           'encadrement_scenario',          // number
  encadrement_bloquant:           'encadrement_bloquant',          // multilineText
  management_verdict:             'management_verdict',            // singleSelect
  management_diagnostic:          'management_diagnostic',         // multilineText
  management_scenario:            'management_scenario',           // number
  management_bloquant:            'management_bloquant',           // multilineText
  tableau_comparatif_encadrer_manager: 'tableau_comparatif_encadrer_manager', // multilineText

  // Sections narratives rapport ← Certificateur
  Nom_signature_excellence:       'Nom_signature_excellence',      // singleLineText
  section_signature_excellence:   'section_signature_excellence',  // multilineText
  section_vigilance_limbique:     'section_vigilance_limbique',    // multilineText ✓
  section_excellences:            'section_excellences',           // multilineText
  section_pilier_P1:              'section_pilier_P1',             // multilineText
  section_pilier_P2:              'section_pilier_P2',             // multilineText
  section_pilier_P3:              'section_pilier_P3',             // multilineText
  section_pilier_P4:              'section_pilier_P4',             // multilineText
  section_pilier_P5:              'section_pilier_P5',             // multilineText
  talent_definition:              'talent_definition',             // multilineText
  trois_capacites:                'trois_capacites',               // multilineText
  pitch_recruteur:                'pitch_recruteur',               // multilineText
  amplitude_deployee:             'amplitude_deployee',            // multilineText
  pattern_navigation_revele:      'pattern_navigation_revele',     // multilineText
  mantra_profil:                  'mantra_profil',                 // multilineText
  points_vigilance_complet:       'points_vigilance_complet',      // multilineText
  rapport_markdown_complet:       'rapport_markdown_complet',      // multilineText

  // Étapes arbitrage Certificateur
  etape_1_arbitrage_fond:         'etape_1_arbitrage_fond',        // multilineText
  etape_2_lecture_algo:           'etape_2_lecture_algo',          // multilineText
  etape_3_diagnostics:            'etape_3_diagnostics',           // multilineText
  statut_certification:           'statut_certification',          // singleSelect
  notes_certificateur:            'notes_certificateur',           // multilineText
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  TABLES,
  VISITEUR_FIELDS,
  RESPONSES_FIELDS,
  BILAN_FIELDS,
};
