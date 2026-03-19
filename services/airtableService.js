// config/airtable.js
// Configuration Airtable v8.5 — Pipeline profil cognitif
//
// CORRECTIONS v8.4 :
// - pilier_structurant2_certif ajouté dans BILAN (2ème pilier structurant certifié)
// - Algo v8.4 : synthese_json_complete = JSON interne uniquement (jamais transmis au Certificateur)
// - Certificateur lit directement les champs BILAN via airtableService.getBilan()
// - etape_1_arbitrage_fond / etape_2_lecture_algo / etape_3_diagnostics renommés
//   → etape_1_arbitrage_fond / etape_2_lecture_algo / etape_3_diagnostics (Prompt 1)
//   → etape_diagnostics / etape_rapport (Prompt 2)

module.exports = {
  BASE_ID: process.env.AIRTABLE_BASE_ID,
  TOKEN:   process.env.AIRTABLE_TOKEN,

  TABLES: {
    VISITEUR:  'VISITEUR',
    RESPONSES: 'RESPONSES',
    BILAN:     'Copie de BILAN 2'
  },

  // ─── VISITEUR ─────────────────────────────────────────────────────────────
  VISITEUR_FIELDS: {
    candidate_ID:               'candidate_ID',
    Prenom:                     'Prenom',
    Nom:                        'Nom',
    Email:                      'Email',
    statut_test:                'statut_test',
    derniere_question_repondue: 'derniere_question_repondue',
    statut_analyse_pivar:       'statut_analyse_pivar',
    erreur_analyse:             'erreur_analyse',
    derniere_activite:          'derniere_activite',
    backup_sommeil:             'backup_sommeil',
    backup_weekend:             'backup_weekend',
    backup_animal:              'backup_animal',
    backup_panne:               'backup_panne',
    backup_before_agent1:       'backup_before_agent1',
    backup_after_agent1:        'backup_after_agent1',
    backup_before_agent2:       'backup_before_agent2',
    backup_after_agent2:        'backup_after_agent2',
    backup_before_algo:         'backup_before_algo',
    backup_after_algo:          'backup_after_algo',
    backup_before_certif:       'backup_before_certif',
    backup_after_certif:        'backup_after_certif',
    backup_error:               'backup_error'
  },

  // ─── RESPONSES ────────────────────────────────────────────────────────────
  RESPONSES_FIELDS: {

    // Identité (lecture seule)
    session_ID:     'session_ID',
    id_question:    'id_question',
    numero_global:  'numero_global',
    pilier:         'pilier',
    scenario_nom:   'scenario_nom',
    question_text:  'question_text',
    response_text:  'response_text',
    statut_reponse: 'statut_reponse',
    date_response:  'date_response',

    // ── Agent 1 ───────────────────────────────────────────────────────────────
    analyse_json_agent1:      'analyse_json_agent1',
    question_analysee:        'question_analysee',
    pilier_reponse_coeur:              'pilier_reponse_coeur',              // écrit par Agent 1
    pilier_reponse_coeur_confirme:     'pilier_reponse_coeur_confirme',     // arbitré définitivement par le Vérificateur ← BASE DES CALCULS ALGO
    niveau_amplitude_reponse: 'niveau_amplitude_reponse',
    liste_piliers_actives:    'liste_piliers_actives',
    piliers_actives_final:    'piliers_actives_final',
    boucles_detectees_agent1: 'boucles_detectees_agent1',
    nombre_boucles_agent1:    'nombre_boucles_agent1',

    // ── Vérificateur ──────────────────────────────────────────────────────────
    analyse_json_verificateur:                    'analyse_json_verificateur',
    boucles_detectees:                            'boucles_detectees',
    verification_coeur:                           'verification_coeur',
    justification_actions_majoritairement_faites: 'justification_actions_majoritairement_faites',
    justification_attribution_niveau:             'justification_attribution_niveau',
    repond_question:                              'repond_question',
    traite_problematique_situation:               'traite_problematique_situation',
    fait_processus_pilier:                        'fait_processus_pilier',
    coherence:                                    'coherence',

    // ── Agent 2 ───────────────────────────────────────────────────────────────
    analyse_json_agent2:            'analyse_json_agent2',
    dimensions_simples:             'dimensions_simples',
    liste_dimensions_simples:       'liste_dimensions_simples',
    nombre_criteres_details:        'nombre_criteres_details',
    liste_criteres_details:         'liste_criteres_details',
    dimensions_sophistiquees:       'dimensions_sophistiquees',
    liste_dimensions_sophistiquees: 'liste_dimensions_sophistiquees',
    niveau_sophistication:          'niveau_sophistication',
    anticipation_niveau:              'anticipation_niveau',
    anticipation_verbatim:            'anticipation_verbatim',
    anticipation_manifestation:       'anticipation_manifestation',
    anticipation_contexte_activation: 'anticipation_contexte_activation',
    decentration_niveau:              'decentration_niveau',
    decentration_verbatim:            'decentration_verbatim',
    decentration_manifestation:       'decentration_manifestation',
    decentration_contexte_activation: 'decentration_contexte_activation',
    metacognition_niveau:             'metacognition_niveau',
    metacognition_verbatim:           'metacognition_verbatim',
    metacognition_manifestation:      'metacognition_manifestation',
    metacognition_contexte_activation: 'metacognition_contexte_activation',
    vue_systemique_niveau:            'vue_systemique_niveau',
    vue_systemique_verbatim:          'vue_systemique_verbatim',
    vue_systemique_manifestation:     'vue_systemique_manifestation',
    vue_systemique_contexte_activation: 'vue_systemique_contexte_activation',
    niveau_amplitude_max:      'niveau_amplitude_max',
    zone_amplitude_max:        'zone_amplitude_max',
    detail_par_niveaux:        'detail_par_niveaux',
    plusieurs_niveaux_reponse: 'plusieurs_niveaux_reponse',
    nombre_mots_reponse:       'nombre_mots_reponse',
    laconique:                 'laconique',
    limbique_detecte:          'limbique_detecte',
    limbique_intensite:        'limbique_intensite',
    limbique_detail:           'limbique_detail',
    capacites_detectees:       'capacites_detectees',

    // ── Agent 3 ───────────────────────────────────────────────────────────────
    analyse_json_agent3:      'analyse_json_agent3',
    circuits_actives:         'circuits_actives',
    boucles_detectees_agent3: 'boucles_detectees_agent3',
    nombre_boucles_agent3:    'nombre_boucles_agent3',
    coherence_agent1_agent3:  'coherence_agent1_agent3',
    profiling_qualifie:       'profiling_qualifie',
    lecture_cognitive_m8:     'lecture_cognitive_m8',

    // ── Algorithme ────────────────────────────────────────────────────────────
    score_question_calcule:  'score_question_calcule',
    score_question_niveau:   'score_question_niveau',
    question_scoree:         'question_scoree',
    statut_analyse_reponses: 'statut_analyse_reponses'
  },

  // ─── BILAN ────────────────────────────────────────────────────────────────
  BILAN_FIELDS: {

    // Identité
    bilan_ID:   'bilan_ID',
    session_ID: 'session_ID',

    // ── Agent 1 ───────────────────────────────────────────────────────────────
    moteur_cognitif:   'moteur_cognitif',
    binome_actif:      'binome_actif',
    reaction_flou:     'reaction_flou',
    signature_cloture: 'signature_cloture',
    agent1_rapport:    'agent1_rapport',
    pattern_emergent:  'pattern_emergent',

    // ── Agent 3 — synthèses pilier ────────────────────────────────────────────
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
    // Excellences agrégées par pilier — v8.5
    excellences_par_pilier_P1:     'excellences_par_pilier_P1',
    excellences_par_pilier_P2:     'excellences_par_pilier_P2',
    excellences_par_pilier_P3:     'excellences_par_pilier_P3',
    excellences_par_pilier_P4:     'excellences_par_pilier_P4',
    excellences_par_pilier_P5:     'excellences_par_pilier_P5',
    limbique_detecte:              'limbique_detecte',
    limbique_intensite_max:        'limbique_intensite_max',
    nb_questions_limbiques:        'nb_questions_limbiques',
    coherence_agents:              'coherence_agents',

    // ── Algorithme v8.5 — scores CONTENU par pilier cœur uniquement ─────────
    // Calculs globaux supprimés : niveau_global, dominant, structurant → Certificateur
    score_pilier_P1:            'score_pilier_P1',
    niveau_max_P1:              'niveau_max_P1',
    score_pilier_P2:            'score_pilier_P2',
    niveau_max_P2:              'niveau_max_P2',
    score_pilier_P3:            'score_pilier_P3',
    niveau_max_P3:              'niveau_max_P3',
    score_pilier_P4:            'score_pilier_P4',
    niveau_max_P4:              'niveau_max_P4',
    score_pilier_P5:            'score_pilier_P5',
    niveau_max_P5:              'niveau_max_P5',
    pattern_emergent:           'pattern_emergent',
    // Critères détails par pilier cœur (nouveau v8.5)
    PX_details_total_P1:        'PX_details_total_P1',
    PX_details_total_P2:        'PX_details_total_P2',
    PX_details_total_P3:        'PX_details_total_P3',
    PX_details_total_P4:        'PX_details_total_P4',
    PX_details_total_P5:        'PX_details_total_P5',
    taux_repond_question:        'taux_repond_question',
    taux_traite_problematique:   'taux_traite_problematique',
    taux_fait_processus_pilier:  'taux_fait_processus_pilier',
    profil_laconique:            'profil_laconique',
    anticipation_verbatims_agreges:        'anticipation_verbatims_agreges',
    anticipation_manifestations_agreges:   'anticipation_manifestations_agreges',
    decentration_verbatims_agreges:        'decentration_verbatims_agreges',
    decentration_manifestations_agreges:   'decentration_manifestations_agreges',
    metacognition_verbatims_agreges:       'metacognition_verbatims_agreges',
    metacognition_manifestations_agreges:  'metacognition_manifestations_agreges',
    vue_systemique_verbatims_agreges:      'vue_systemique_verbatims_agreges',
    vue_systemique_manifestations_agreges: 'vue_systemique_manifestations_agreges',
    excellences_SOMMEIL:        'excellences_SOMMEIL',
    excellences_WEEKEND:        'excellences_WEEKEND',
    excellences_ANIMAL:         'excellences_ANIMAL',
    excellences_PANNE:          'excellences_PANNE',
    P1_simples_total:           'P1_simples_total',
    P1_simples_synthese:        'P1_simples_synthese',
    P1_sophistiquees_total:     'P1_sophistiquees_total',
    P1_sophistiquees_synthese:  'P1_sophistiquees_synthese',
    P2_simples_total:           'P2_simples_total',
    P2_simples_synthese:        'P2_simples_synthese',
    P2_sophistiquees_total:     'P2_sophistiquees_total',
    P2_sophistiquees_synthese:  'P2_sophistiquees_synthese',
    P3_simples_total:           'P3_simples_total',
    P3_simples_synthese:        'P3_simples_synthese',
    P3_sophistiquees_total:     'P3_sophistiquees_total',
    P3_sophistiquees_synthese:  'P3_sophistiquees_synthese',
    P4_simples_total:           'P4_simples_total',
    P4_simples_synthese:        'P4_simples_synthese',
    P4_sophistiquees_total:     'P4_sophistiquees_total',
    P4_sophistiquees_synthese:  'P4_sophistiquees_synthese',
    P5_simples_total:           'P5_simples_total',
    P5_simples_synthese:        'P5_simples_synthese',
    P5_sophistiquees_total:     'P5_sophistiquees_total',
    P5_sophistiquees_synthese:  'P5_sophistiquees_synthese',
    dimensions_simples_json:       'dimensions_simples_json',
    dimensions_sophistiquees_json: 'dimensions_sophistiquees_json',
    dimensions_superieures_liste:  'dimensions_superieures_liste',
    dimensions_superieures_count:  'dimensions_superieures_count',
    synthese_json_complete:        'synthese_json_complete', // JSON interne algo — consultation uniquement

    // ── Certificateur — Prompt 1 (analyses) ───────────────────────────────────
    'profil_coché_P1':             'profil_coché_P1',
    'profil_coché_P2':             'profil_coché_P2',
    'profil_coché_P3':             'profil_coché_P3',
    'profil_coché_P4':             'profil_coché_P4',
    'profil_coché_P5':             'profil_coché_P5',
    P1_simples_synthese:    'P1_simples_synthese',    // rempli par Certif P1
    P1_sophistiquees_synthese: 'P1_sophistiquees_synthese',
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
    // Pilier socle certifié (étape 2A Prompt 1)
    pilier_structurant2_certif:    'pilier_structurant2_certif', // NOUVEAU v8.4
    piliers_moteurs_certif:        'piliers_moteurs_certif',
    boucle_cognitive_ordre:        'boucle_cognitive_ordre',
    // Calculs globaux remplis par le Certificateur (supprimés de l'Algo v8.5)
    niveau_global:                 'niveau_global',
    zone_globale:                  'zone_globale',
    score_global:                  'score_global',
    profil_type:                   'profil_type',
    distribution_reelle:           'distribution_reelle',
    niveau_profil_cognitif:        'niveau_profil_cognitif',
    nom_niveau_profil_cognitif:    'nom_niveau_profil_cognitif',

    // ── Certificateur — Prompt 2 (rapport) ────────────────────────────────────
    encadrement_verdict:          'encadrement_verdict',
    encadrement_diagnostic:       'encadrement_diagnostic',
    encadrement_scenario:         'encadrement_scenario',
    encadrement_bloquant:         'encadrement_bloquant',
    management_verdict:           'management_verdict',
    management_diagnostic:        'management_diagnostic',
    management_scenario:          'management_scenario',
    management_bloquant:          'management_bloquant',
    tableau_comparatif_encadrer_manager: 'tableau_comparatif_encadrer_manager',
    definition_type_profil_cognitif: 'definition_type_profil_cognitif',
    profil_personnalise:          'profil_personnalise',
    Nom_signature_excellence:     'Nom_signature_excellence',
    section_signature_excellence: 'section_signature_excellence',
    section_vigilance_limbique:   'section_vigilance_limbique',
    section_excellences:          'section_excellences',
    section_pilier_P1:            'section_pilier_P1',
    section_pilier_P2:            'section_pilier_P2',
    section_pilier_P3:            'section_pilier_P3',
    section_pilier_P4:            'section_pilier_P4',
    section_pilier_P5:            'section_pilier_P5',
    talent_definition:            'talent_definition',
    trois_capacites:              'trois_capacites',
    pitch_recruteur:              'pitch_recruteur',
    amplitude_deployee:           'amplitude_deployee',
    pattern_navigation_revele:    'pattern_navigation_revele',
    mantra_profil:                'mantra_profil',
    points_vigilance_complet:     'points_vigilance_complet',
    rapport_markdown_complet:     'rapport_markdown_complet',
    // Étapes certification
    etape_1_arbitrage_fond:      'etape_1_arbitrage_fond',    // champ Airtable existant
    etape_2_lecture_algo:  'etape_2_lecture_algo',      // champ Airtable existant
    etape_3_diagnostics:         'etape_3_diagnostics',       // champ Airtable existant
    statut_certification:         'statut_certification',
    notes_certificateur:          'notes_certificateur',
    date_generation:              'date_generation'
  },

  // ─── VALEURS AUTORISÉES (Single Select Airtable) ──────────────────────────
  ALLOWED_VALUES: {
    statut_test:             ['en_cours', 'terminé'],
    statut_analyse_pivar:    ['NOUVEAU', 'en_cours', 'terminé', 'ERREUR'],
    statut_analyse_reponses: ['en_attente', 'analyse_ok', 'erreur'],
    coherence:               ['CONFIRMÉ', 'CORRIGÉ', 'MAINTENU_AVEC_RÉSERVE'],
    coherence_agent1_agent3: ['TOTALE', 'PARTIELLE', 'FAIBLE'],
    profiling_qualifie:      ['OK', 'FLAG_REVISION'],
    pilier:                  ['P1', 'P2', 'P3', 'P4', 'P5'],
    pilier_dominant_certif:    ['P1', 'P2', 'P3', 'P4', 'P5'],
    pilier_structurant_certif: ['P1', 'P2', 'P3', 'P4', 'P5'],
    pilier_structurant2_certif: ['P1', 'P2', 'P3', 'P4', 'P5'],
    scenario_nom:            ['SOMMEIL', 'WEEKEND', 'ANIMAL', 'PANNE'],
    niveau_sophistication:   ['faible', 'moyen', 'élevé'],
    limbique_intensite:      ['aucune', 'faible', 'modérée', 'forte'],
    zone_profil_cognitif:    ['Exécution', 'Opérationnelle', 'Stratégique'],
    repond_question:         ['oui', 'non'],
    traite_problematique_situation: ['oui', 'non'],
    fait_processus_pilier:   ['oui', 'non']
  },

  // ─── MAPPING VALEURS ──────────────────────────────────────────────────────
  VALUE_MAPPING: {
    limbique_intensite: {
      'moderee':  'modérée',
      'modéree':  'modérée',
      'moderate': 'modérée',
      'aucune':   'aucune',
      'faible':   'faible',
      'forte':    'forte'
    }
  }
};
