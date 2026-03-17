// config/airtable.js
// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION AIRTABLE
// Source de vérité : noms exacts des champs tels qu'ils existent dans Airtable
// Base : appgghhXjYBdFRras
// Tables : RESPONSES (tblLnWhszYAQldZOJ) + Copie de BILAN 2 (tbljRMIMjM9SwVyox)
// ═══════════════════════════════════════════════════════════════════════════
// RÈGLES ABSOLUES :
// - Jamais meta_cognition → toujours metacognition_niveau
// - Jamais angles_morts / anglesmorts → toujours vue_systemique_niveau
// - Jamais type_pivar / zone_pivar / niveau_pivar
// ═══════════════════════════════════════════════════════════════════════════

'use strict';

module.exports = {

  TOKEN:   process.env.AIRTABLE_API_KEY,
  BASE_ID: 'appgghhXjYBdFRras',

  // ─── IDs des tables ───────────────────────────────────────────────────────
  TABLES: {
    VISITEUR:  'tblslPP9B71FveOX5',
    RESPONSES: 'tblLnWhszYAQldZOJ',
    BILAN:     'tbljRMIMjM9SwVyox'   // Copie de BILAN 2
  },

  // ─── Noms des champs RESPONSES ────────────────────────────────────────────
  // Noms exacts tels qu'ils existent dans Airtable
  FIELDS_RESPONSES: {
    // Identifiants
    session_ID:              'session_ID',
    id_question:             'id_question',
    numero_global:           'numero_global',
    pilier:                  'pilier',
    scenario_nom:            'scenario_nom',
    question_text:           'question_text',
    response_text:           'response_text',

    // Agent 1
    analyse_json_agent1:          'analyse_json_agent1',
    pilier_reponse_coeur:         'pilier_reponse_coeur',
    niveau_amplitude_reponse:     'niveau_amplitude_reponse',
    liste_piliers_actives:        'liste_piliers_actives',
    piliers_actives_final:        'piliers_actives_final',
    boucles_detectees_agent1:     'boucles_detectees_agent1',
    nombre_boucles_agent1:        'nombre_boucles_agent1',
    question_analysee:            'question_analysee',

    // Vérificateur
    analyse_json_verificateur:                    'analyse_json_verificateur',
    verification_coeur:                           'verification_coeur',
    justification_attribution_pilier_coeur:       'justification_attribution_pilier_coeur',
    justification_actions_majoritairement_faites: 'justification_actions_majoritairement_faites',
    justification_attribution_niveau:             'justification_attribution_niveau',
    repond_question:                              'repond_question',
    traite_problematique_situation:               'traite_problematique_situation',
    fait_processus_pilier:                        'fait_processus_pilier',
    coherence:                                    'coherence',

    // Agent 2 — dimensions
    analyse_json_agent2:           'analyse_json_agent2',
    dimensions_simples:            'dimensions_simples',
    liste_dimensions_simples:      'liste_dimensions_simples',
    nombre_criteres_details:       'nombre_criteres_details',
    liste_criteres_details:        'liste_criteres_details',
    dimensions_sophistiquees:      'dimensions_sophistiquees',
    liste_dimensions_sophistiquees:'liste_dimensions_sophistiquees',
    niveau_sophistication:         'niveau_sophistication',

    // Agent 2 — excellences (noms v8 stricts)
    anticipation_niveau:               'anticipation_niveau',
    anticipation_verbatim:             'anticipation_verbatim',
    anticipation_manifestation:        'anticipation_manifestation',
    anticipation_contexte_activation:  'anticipation_contexte_activation',
    decentration_niveau:               'decentration_niveau',
    decentration_verbatim:             'decentration_verbatim',
    decentration_manifestation:        'decentration_manifestation',
    decentration_contexte_activation:  'decentration_contexte_activation',
    metacognition_niveau:              'metacognition_niveau',
    metacognition_verbatim:            'metacognition_verbatim',
    metacognition_manifestation:       'metacognition_manifestation',
    metacognition_contexte_activation: 'metacognition_contexte_activation',
    vue_systemique_niveau:             'vue_systemique_niveau',
    vue_systemique_verbatim:           'vue_systemique_verbatim',
    vue_systemique_manifestation:      'vue_systemique_manifestation',
    vue_systemique_contexte_activation:'vue_systemique_contexte_activation',

    // Agent 2 — amplitude
    niveau_amplitude_max:      'niveau_amplitude_max',
    zone_amplitude_max:        'zone_amplitude_max',
    detail_par_niveaux:        'detail_par_niveaux',
    plusieurs_niveaux_reponse: 'plusieurs_niveaux_reponse',

    // Agent 2 — limbique
    nombre_mots_reponse: 'nombre_mots_reponse',
    laconique:           'laconique',
    limbique_detecte:    'limbique_detecte',
    limbique_intensite:  'limbique_intensite',
    limbique_detail:     'limbique_detail',
    capacites_detectees: 'capacites_detectees',

    // Agent 3 — par question
    analyse_json_agent3:      'analyse_json_agent3',
    circuits_actives:         'circuits_actives',
    boucles_detectees_agent3: 'boucles_detectees_agent3',
    nombre_boucles_agent3:    'nombre_boucles_agent3',
    coherence_agent1_agent3:  'coherence_agent1_agent3',
    profiling_qualifie:       'profiling_qualifie',
    lecture_cognitive_m8:     'lecture_cognitive_m8',

    // Algorithme — par question
    score_question_calcule:  'score_question_calcule',
    score_question_niveau:   'score_question_niveau',
    question_scoree:         'question_scoree',
    statut_analyse_reponses: 'statut_analyse_reponses'
  },

  // ─── Noms des champs BILAN (Copie de BILAN 2) ─────────────────────────────
  FIELDS_BILAN: {
    session_ID: 'session_ID',

    // Algo — profil global
    synthese_json_complete:       'synthese_json_complete',
    niveau_global:                'niveau_global',
    zone_globale:                 'zone_globale',
    score_global:                 'score_global',
    profil_type:                  'profil_type',
    distribution_reelle:          'distribution_reelle',
    pattern_emergent:             'pattern_emergent',
    score_pilier_P1:              'score_pilier_P1',
    niveau_max_P1:                'niveau_max_P1',
    score_pilier_P2:              'score_pilier_P2',
    niveau_max_P2:                'niveau_max_P2',
    score_pilier_P3:              'score_pilier_P3',
    niveau_max_P3:                'niveau_max_P3',
    score_pilier_P4:              'score_pilier_P4',
    niveau_max_P4:                'niveau_max_P4',
    score_pilier_P5:              'score_pilier_P5',
    niveau_max_P5:                'niveau_max_P5',
    type_profil_cognitif:         'type_profil_cognitif',
    niveau_profil_cognitif:       'niveau_profil_cognitif',
    nom_niveau_profil_cognitif:   'nom_niveau_profil_cognitif',
    zone_profil_cognitif:         'zone_profil_cognitif',
    pilier_dominant_certif:       'pilier_dominant_certif',
    pilier_structurant_certif:    'pilier_structurant_certif',
    piliers_moteurs_certif:       'piliers_moteurs_certif',
    boucle_cognitive_ordre:       'boucle_cognitive_ordre',
    taux_repond_question:         'taux_repond_question',
    taux_traite_problematique:    'taux_traite_problematique',
    taux_fait_processus_pilier:   'taux_fait_processus_pilier',
    profil_laconique:             'profil_laconique',

    // Algo — verbatims et excellences agrégés
    anticipation_verbatims_agreges:           'anticipation_verbatims_agreges',
    anticipation_manifestations_agreges:      'anticipation_manifestations_agreges',
    decentration_verbatims_agreges:           'decentration_verbatims_agreges',
    decentration_manifestations_agreges:      'decentration_manifestations_agreges',
    metacognition_verbatims_agreges:          'metacognition_verbatims_agreges',
    metacognition_manifestations_agreges:     'metacognition_manifestations_agreges',
    vue_systemique_verbatims_agreges:         'vue_systemique_verbatims_agreges',
    vue_systemique_manifestations_agreges:    'vue_systemique_manifestations_agreges',
    excellences_SOMMEIL:                      'excellences_SOMMEIL',
    excellences_WEEKEND:                      'excellences_WEEKEND',
    excellences_ANIMAL:                       'excellences_ANIMAL',
    excellences_PANNE:                        'excellences_PANNE',

    // Algo — dimensions par pilier
    P1_simples_total:          'P1_simples_total',
    P1_simples_synthese:       'P1_simples_synthese',
    P1_sophistiquees_total:    'P1_sophistiquees_total',
    P1_sophistiquees_synthese: 'P1_sophistiquees_synthese',
    P2_simples_total:          'P2_simples_total',
    P2_simples_synthese:       'P2_simples_synthese',
    P2_sophistiquees_total:    'P2_sophistiquees_total',
    P2_sophistiquees_synthese: 'P2_sophistiquees_synthese',
    P3_simples_total:          'P3_simples_total',
    P3_simples_synthese:       'P3_simples_synthese',
    P3_sophistiquees_total:    'P3_sophistiquees_total',
    P3_sophistiquees_synthese: 'P3_sophistiquees_synthese',
    P4_simples_total:          'P4_simples_total',
    P4_simples_synthese:       'P4_simples_synthese',
    P4_sophistiquees_total:    'P4_sophistiquees_total',
    P4_sophistiquees_synthese: 'P4_sophistiquees_synthese',
    P5_simples_total:          'P5_simples_total',
    P5_simples_synthese:       'P5_simples_synthese',
    P5_sophistiquees_total:    'P5_sophistiquees_total',
    P5_sophistiquees_synthese: 'P5_sophistiquees_synthese',
    dimensions_simples_json:      'dimensions_simples_json',
    dimensions_sophistiquees_json:'dimensions_sophistiquees_json',
    dimensions_superieures_liste: 'dimensions_superieures_liste',
    dimensions_superieures_count: 'dimensions_superieures_count',

    // Agent 1 — corpus
    moteur_cognitif:   'moteur_cognitif',
    binome_actif:      'binome_actif',
    reaction_flou:     'reaction_flou',
    signature_cloture: 'signature_cloture',
    agent1_rapport:    'agent1_rapport',

    // Agent 3 — BILAN
    coherence_agents:              'coherence_agents',
    circuits_top3_P1:              'circuits_top3_P1',
    circuits_top3_P2:              'circuits_top3_P2',
    circuits_top3_P3:              'circuits_top3_P3',
    circuits_top3_P4:              'circuits_top3_P4',
    circuits_top3_P5:              'circuits_top3_P5',
    boucles_detectees_pilier_P1:   'boucles_detectees_pilier_P1',
    boucles_detectees_pilier_P2:   'boucles_detectees_pilier_P2',
    boucles_detectees_pilier_P3:   'boucles_detectees_pilier_P3',
    boucles_detectees_pilier_P4:   'boucles_detectees_pilier_P4',
    boucles_detectees_pilier_P5:   'boucles_detectees_pilier_P5',
    lecture_cognitive_enrichie_P1: 'lecture_cognitive_enrichie_P1',
    lecture_cognitive_enrichie_P2: 'lecture_cognitive_enrichie_P2',
    lecture_cognitive_enrichie_P3: 'lecture_cognitive_enrichie_P3',
    lecture_cognitive_enrichie_P4: 'lecture_cognitive_enrichie_P4',
    lecture_cognitive_enrichie_P5: 'lecture_cognitive_enrichie_P5',
    profil_neuroscientifique_P1:   'profil_neuroscientifique_P1',
    profil_neuroscientifique_P2:   'profil_neuroscientifique_P2',
    profil_neuroscientifique_P3:   'profil_neuroscientifique_P3',
    profil_neuroscientifique_P4:   'profil_neuroscientifique_P4',
    profil_neuroscientifique_P5:   'profil_neuroscientifique_P5',
    limbique_detecte:              'limbique_detecte',
    limbique_intensite_max:        'limbique_intensite_max',
    nb_questions_limbiques:        'nb_questions_limbiques',

    // Certificateur — BILAN
    profil_coché_P1:               'profil_coché_P1',
    profil_coché_P2:               'profil_coché_P2',
    profil_coché_P3:               'profil_coché_P3',
    profil_coché_P4:               'profil_coché_P4',
    profil_coché_P5:               'profil_coché_P5',
    anticipation_niveau:           'anticipation_niveau',
    anticipation_pattern:          'anticipation_pattern',
    anticipation_declencheur:      'anticipation_declencheur',
    anticipation_synthese:         'anticipation_synthese',
    anticipation_qualification:    'anticipation_qualification',
    decentration_niveau:           'decentration_niveau',
    decentration_pattern:          'decentration_pattern',
    decentration_declencheur:      'decentration_declencheur',
    decentration_synthese:         'decentration_synthese',
    decentration_qualification:    'decentration_qualification',
    metacognition_niveau:          'metacognition_niveau',
    metacognition_pattern:         'metacognition_pattern',
    metacognition_declencheur:     'metacognition_declencheur',
    metacognition_synthese:        'metacognition_synthese',
    metacognition_qualification:   'metacognition_qualification',
    vue_systemique_niveau:         'vue_systemique_niveau',
    vue_systemique_pattern:        'vue_systemique_pattern',
    vue_systemique_declencheur:    'vue_systemique_declencheur',
    vue_systemique_synthese:       'vue_systemique_synthese',
    vue_systemique_qualification:  'vue_systemique_qualification',
    excellence_dominante:          'excellence_dominante',
    excellence_secondaire:         'excellence_secondaire',
    profil_excellences:            'profil_excellences',
    encadrement_verdict:           'encadrement_verdict',
    encadrement_diagnostic:        'encadrement_diagnostic',
    encadrement_scenario:          'encadrement_scenario',
    encadrement_bloquant:          'encadrement_bloquant',
    management_verdict:            'management_verdict',
    management_diagnostic:         'management_diagnostic',
    management_scenario:           'management_scenario',
    management_bloquant:           'management_bloquant',
    tableau_comparatif_encadrer_manager: 'tableau_comparatif_encadrer_manager',
    definition_type_profil_cognitif: 'definition_type_profil_cognitif',
    profil_personnalise:             'profil_personnalise',
    Nom_signature_excellence:        'Nom_signature_excellence',
    section_signature_excellence:    'section_signature_excellence',
    section_vigilance_limbique:      'section_vigilance_limbique',
    section_excellences:             'section_excellences',
    section_pilier_P1:               'section_pilier_P1',
    section_pilier_P2:               'section_pilier_P2',
    section_pilier_P3:               'section_pilier_P3',
    section_pilier_P4:               'section_pilier_P4',
    section_pilier_P5:               'section_pilier_P5',
    talent_definition:               'talent_definition',
    trois_capacites:                 'trois_capacites',
    pitch_recruteur:                 'pitch_recruteur',
    amplitude_deployee:              'amplitude_deployee',
    pattern_navigation_revele:       'pattern_navigation_revele',
    mantra_profil:                   'mantra_profil',
    points_vigilance_complet:        'points_vigilance_complet',
    rapport_markdown_complet:        'rapport_markdown_complet',
    etape_1_arbitrage_fond:          'etape_1_arbitrage_fond',
    etape_2_lecture_algo:            'etape_2_lecture_algo',
    etape_3_diagnostics:             'etape_3_diagnostics',
    statut_certification:            'statut_certification',
    notes_certificateur:             'notes_certificateur'
  },

};
