// config/airtable.js
// Configuration Airtable v11.6 — Pipeline Profil-Cognitif Étape 1
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et docs/CONTRAT_ETAPE1.md (v1.10 prévue)
//
// PHASE v11.7 (2026-06-05) — Bilan dynamique des 4 excellences :
//   - ⭐ Ajout des tables ETAPE2_BILAN_EXCELLENCE (T5B, agrégat 4 lignes/candidat)
//     et ETAPE2_BILAN4EXCELLENCES (profil de synthèse, 1 ligne/candidat) dans TABLES.
//     Lues (lecture seule) par la route /api/bilan/:candidat_id via
//     airtableService.getBilanExcellences. Aucun impact sur le pipeline.
//
// PHASE v11.6 (2026-06-05) — Visualisation Étape 2 (les 4 excellences) :
//   - ⭐ Ajout de la table ETAPE2_RESPONSES_EXCELLENCES dans TABLES.
//     Table Airtable = 'ETAPE2_1_RESPONSES pour 4 excellences' (tblLnWhszYAQldZOJ).
//     Lue (lecture seule) par la route
//     /visualiser/etape2_1responsepour4excellences/:candidat_id (mode JSON)
//     via airtableService.getEtape2Excellences. Aucun impact sur le pipeline Étape 1.
//
// (Historique antérieur conservé tel quel ci-dessous.)
//
// Architecture multi-étapes (Décision n°26) :
//   - VISITEUR, RESPONSES (existantes, intactes)
//   - QUESTIONS PIVAR SCENARIO (référentiel, lecture seule)
//   - ETAPE1_T1, ETAPE1_T2, ETAPE1_T3, ETAPE1_T4_BILAN (Étape 1 active)
//   - VERIFICATEUR_T1 (audit du vérificateur — Décision n°10)
//   - REFERENTIEL_LEXIQUE (15 termes doctrinaux, lue par tous les agents)
//   - BILAN (ancienne, conservée pour Étape 2/3 futures)

'use strict';

module.exports = {
  BASE_ID: process.env.AIRTABLE_BASE_ID,
  TOKEN:   process.env.AIRTABLE_TOKEN,

  // ═══════════════════════════════════════════════════════════════════════════
  // TABLES
  // ═══════════════════════════════════════════════════════════════════════════
  TABLES: {
    // ─── Anciennes — conservées intactes ───────────────────────────────────
    VISITEUR:           'VISITEUR',
    QUESTIONS_SCENARIO: 'questions_pivar_scenario',
    RESPONSES:          'RESPONSES',
    BILAN:              'BILAN',

    // ─── ⭐ v11.6 (05/06/2026) — Visualisation Étape 2 (les 4 excellences) ───
    // Lue (seule) par la route /visualiser/etape2_1responsepour4excellences/
    // via airtableService.getEtape2Excellences. 25 lignes par candidat.
    ETAPE2_RESPONSES_EXCELLENCES: 'ETAPE2_1_RESPONSES pour 4 excellences',  // tblLnWhszYAQldZOJ

    // ─── ⭐ v11.7 (05/06/2026) — Bilan dynamique des 4 excellences ──────────
    // Lues (seules) par la route /api/bilan/:candidat_id via
    // airtableService.getBilanExcellences. Agrégat par excellence (T5B,
    // 4 lignes/candidat) + profil de synthèse (T5C, 1 ligne/candidat).
    ETAPE2_BILAN_EXCELLENCE: 'RESPONSES_ETAPE2_ EXCELLENCE',  // tbldiVcVA52VC53n5 (note : espace dans le nom)
    ETAPE2_BILAN4EXCELLENCES: 'ETAPE2_BILAN4EXCELLENCES',       // tbltn7TVAf3Q87frg (profil de synthèse, 1 ligne/candidat)

    // ─── Étape 1 — Pipeline d'analyse ──────────────────────────────────────
    ETAPE1_T1:           'ETAPE1_T1',
    VERIFICATEUR_T1:     'VERIFICATEUR_T1',     // ⭐ v10 — audit du vérificateur (Décision n°10)
    ETAPE1_T2:           'ETAPE1_T2',
    ETAPE1_T3:           'ETAPE1_T3',
    ETAPE1_T4_BILAN:     'ETAPE1_T4_BILAN',

    // ─── ⭐ v10.9 (22/05/2026) — Tables Phase 3 (visualisation persistée) ────
    ETAPE1_T2_VENTILATION_PILIERS: 'ETAPE1_T2_VENTILATION_PILIERS',  // 1 ligne / candidat × pilier_coeur
    ETAPE1_T2_INVENTAIRE_CIRCUITS: 'ETAPE1_T2_INVENTAIRE_CIRCUITS',  // 1 ligne / candidat × circuit distinct

    // ─── ⭐ v11.0 (28/05/2026) — Étape 3 : le bilan (3 tables) ──────────────
    ETAPE1_T3_PILIER:              'ETAPE1_T3_PILIER',              // tblzDIn7P2cOvVvY2
    ETAPE1_T3_CIRCUIT:             'ETAPE1_T3_CIRCUIT',
    ETAPE1_T3_BILAN:               'ETAPE1_T3_BILAN',

    // ─── Référentiels stables ──────────────────────────────────────────────
    REFERENTIEL_LEXIQUE:           'REFERENTIEL_LEXIQUE',
    REFERENTIEL_PILIERS:           'REFERENTIEL_PILIERS',
    REFERENTIEL_PROFILS:           'REFERENTIEL_PROFILS',
    REFERENTIEL_CIRCUITS:          'REFERENTIEL_CIRCUITS',
    REFERENTIEL_CIRCUITS_CANDIDATS: 'REFERENTIEL_CIRCUITS_CANDIDATS'  // ⭐ v10.8 (21/05/2026)
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VISITEUR — suivi candidat
  // ═══════════════════════════════════════════════════════════════════════════
  VISITEUR_FIELDS: {
    candidate_ID:               'candidate_ID',
    Prenom:                     'Prenom',
    Nom:                        'Nom',
    Email:                      'Email',
    civilite_candidat:          'civilite_candidat',
    statut_test:                'statut_test',
    derniere_question_repondue: 'derniere_question_repondue',
    statut_analyse_pivar:       'statut_analyse_pivar',
    erreur_analyse:             'erreur_analyse',
    derniere_activite:          'derniere_activite',

    backup_sommeil:             'backup_sommeil',
    backup_weekend:             'backup_weekend',
    backup_animal:              'backup_animal',
    backup_panne:               'backup_panne',

    backup_before_t1:               'backup_before_t1',
    backup_after_t1:                'backup_after_t1',
    backup_before_t1_verificateur:  'backup_before_t1_verificateur',
    backup_after_t1_verificateur:   'backup_after_t1_verificateur',
    backup_before_t2:               'backup_before_t2',
    backup_after_t2:                'backup_after_t2',
    backup_before_t3:               'backup_before_t3',
    backup_after_t3:                'backup_after_t3',
    backup_before_t4_parallel:      'backup_before_t4_parallel',
    backup_after_t4_parallel:       'backup_after_t4_parallel',
    backup_before_t4_synthese:      'backup_before_t4_synthese',
    backup_after_t4_synthese:       'backup_after_t4_synthese',
    backup_before_t4_couts:         'backup_before_t4_couts',
    backup_after_t4_couts:          'backup_after_t4_couts',
    backup_before_certif:           'backup_before_certif',
    backup_after_certif:            'backup_after_certif',
    backup_error:                   'backup_error',

    nombre_tentatives_etape1:       'nombre_tentatives_etape1',

    validation_humaine_action:      'validation_humaine_action',
    validation_humaine_motif:       'validation_humaine_motif',
    validation_humaine_date:        'validation_humaine_date',
    validation_humaine_etape1:      'validation_humaine_etape1',

    date_T0:                        'date_T0',
    email_T0_envoye:                'email_T0_envoye',
    email_24h_envoye:               'email_24h_envoye',
    email_48h_envoye:               'email_48h_envoye',
    email_72h_envoye:               'email_72h_envoye',
    email_livraison_envoye:         'email_livraison_envoye'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RESPONSES — réponses brutes du candidat (frontend) — LECTURE SEULE
  // ═══════════════════════════════════════════════════════════════════════════
  RESPONSES_FIELDS: {
    session_ID:     'session_ID',
    id_question:    'id_question',
    numero_global:  'numero_global',
    pilier:         'pilier',
    scenario_nom:   'scenario_nom',
    question_text:  'question_text',
    response_text:  'response_text',
    statut_reponse: 'statut_reponse',
    date_response:  'date_response'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPE1_T1 — Analyse brute des 25 réponses
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T1_FIELDS: {
    candidat_id:             'candidat_id',
    id_question:             'id_question',
    question_id_protocole:   'question_id_protocole',
    scenario:                'scenario',
    pilier_demande:          'pilier_demande',
    question_texte:          'question_texte',
    storytelling:            'storytelling',
    transition:              'transition',

    verbatim_candidat:       'verbatim_candidat',

    v1_conforme:                    'v1_conforme',
    v2_traite_problematique:        'v2_traite_problematique',
    verbes_observes:                'verbes_observes',
    verbes_angles_piliers:          'verbes_angles_piliers',

    pilier_finalite:                'pilier_finalite',
    pilier_finalite_libelle:        'pilier_finalite_libelle',
    pilier_coeur:                   'pilier_coeur',
    outil_cognitif_libelle:         'outil_cognitif_libelle',
    pilier_coeur_analyse:           'pilier_coeur_analyse',
    piliers_traverses:              'piliers_traverses',
    piliers_secondaires:            'piliers_secondaires',

    types_verbatim:                 'types_verbatim',
    finalite_reponse:               'finalite_reponse',
    attribution_pilier_signal_brut: 'attribution_pilier_signal_brut',

    conforme_ecart:                 'conforme_ecart',
    ecart_detail:                   'ecart_detail',
    signal_limbique:                'signal_limbique',

    v2_repond_question:             'v2_repond_question',
    v2_repond_situation:            'v2_repond_situation',
    v2_analyse:                     'v2_analyse',

    corrections_verificateur:       'corrections_verificateur',

    nb_activations_coeur:                     'nb_activations_coeur',
    detail_circuits_coeur:                    'detail_circuits_coeur',
    detail_circuits_instrumentaux:            'detail_circuits_instrumentaux',
    nb_activations_par_pilier_instrumental:   'nb_activations_par_pilier_instrumental',
    nb_P1_instru:      'nb_P1_instru',
    nb_P2_instru:      'nb_P2_instru',
    nb_P3_instru:      'nb_P3_instru',
    nb_P4_instru:      'nb_P4_instru',
    nb_P5_instru:      'nb_P5_instru',
    detail_P1_instru:  'detail_P1_instru',
    detail_P2_instru:  'detail_P2_instru',
    detail_P3_instru:  'detail_P3_instru',
    detail_P4_instru:  'detail_P4_instru',
    detail_P5_instru:  'detail_P5_instru'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICATEUR_T1 — Audit du vérificateur T1 (11 colonnes)
  // ═══════════════════════════════════════════════════════════════════════════
  VERIFICATEUR_T1_FIELDS: {
    candidat_id:             'candidat_id',
    verdict_global:          'verdict_global',
    nb_lignes_verifiees:     'nb_lignes_verifiees',
    nb_violations_total:     'nb_violations_total',
    nb_critique:             'nb_critique',
    nb_doctrinale:           'nb_doctrinale',
    nb_observation:          'nb_observation',
    violations_json:         'violations_json',
    cost_usd:                'cost_usd',
    elapsed_ms:              'elapsed_ms',
    timestamp:               'timestamp'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPE1_T2 — Synthèse par question (15 colonnes)
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T2_FIELDS: {
    candidat_id:           'candidat_id',
    id_question:           'id_question',
    question_id_protocole: 'question_id_protocole',
    scenario:              'scenario',
    pilier_demande:        'pilier_demande',
    pilier_coeur:                'pilier_coeur',
    conforme_ecart:              'conforme_ecart',
    sequence_piliers:            'sequence_piliers',
    analyse_note:                'analyse_note',
    analyse_ecart_action:        'analyse_ecart_action',
    signal_limbique_detecte:     'signal_limbique_detecte',
    signal_limbique_detail:      'signal_limbique_detail',
    signal_transversal_candidat: 'signal_transversal_candidat',
    stat_pattern_pilier:         'stat_pattern_pilier',
    type_contenu:                'type_contenu'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ v10.9 — ETAPE1_T2_VENTILATION_PILIERS — Tableau 1 (21 colonnes)
  // tableId : tbl4UzvAMQY4nRnI5
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T2_VENTILATION_PILIERS_FIELDS: {
    candidat_id:                  'candidat_id',
    session_ID:                   'session_ID',
    pilier_coeur:                 'pilier_coeur',
    pilier_coeur_libelle:         'pilier_coeur_libelle',
    rang_par_frequence:           'rang_par_frequence',
    nb_reponses:                  'nb_reponses',
    pct_reponses:                 'pct_reponses',
    nb_activations_coeur_total:   'nb_activations_coeur_total',
    nb_activations_instru_total:  'nb_activations_instru_total',
    ventilation_circuits_coeur:   'ventilation_circuits_coeur',
    ventilation_P1_instru:        'ventilation_P1_instru',
    ventilation_P2_instru:        'ventilation_P2_instru',
    ventilation_P3_instru:        'ventilation_P3_instru',
    ventilation_P4_instru:        'ventilation_P4_instru',
    ventilation_P5_instru:        'ventilation_P5_instru',
    nb_P1_instru_total:           'nb_P1_instru_total',
    nb_P2_instru_total:           'nb_P2_instru_total',
    nb_P3_instru_total:           'nb_P3_instru_total',
    nb_P4_instru_total:           'nb_P4_instru_total',
    nb_P5_instru_total:           'nb_P5_instru_total',
    liste_id_questions:           'liste_id_questions'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ v10.9 — ETAPE1_T2_INVENTAIRE_CIRCUITS — Tableau 2 (15 colonnes)
  // tableId : tblUHZjXIW9jp9nIf
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T2_INVENTAIRE_CIRCUITS_FIELDS: {
    candidat_id:         'candidat_id',
    session_ID:          'session_ID',
    circuit_label:       'circuit_label',
    pilier_owner:        'pilier_owner',
    circuit_id:          'circuit_id',
    circuit_origine:     'circuit_origine',
    nom_ad_hoc:          'nom_ad_hoc',
    nb_coeur:            'nb_coeur',
    nb_svc_P1:           'nb_svc_P1',
    nb_svc_P2:           'nb_svc_P2',
    nb_svc_P3:           'nb_svc_P3',
    nb_svc_P4:           'nb_svc_P4',
    nb_svc_P5:           'nb_svc_P5',
    total_activations:   'total_activations',
    rang_dans_pilier:    'rang_dans_pilier'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPE1_T3 — Analyse pilier × circuit (15 colonnes)
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T3_FIELDS: {
    candidat_id:               'candidat_id',
    pilier:                    'pilier',
    role_pilier:               'role_pilier',
    nb_circuits_actifs_pilier: 'nb_circuits_actifs_pilier',
    circuit_id:                'circuit_id',
    circuit_nom:               'circuit_nom',
    frequence:                 'frequence',
    niveau_activation:         'niveau_activation',
    actif:                     'actif',
    types_verbatim_detail:     'types_verbatim_detail',
    activations_franches:      'activations_franches',
    activations_nuancees:      'activations_nuancees',
    clusters_identifies:       'clusters_identifies',
    commentaire_attribution:   'commentaire_attribution',
    type_contenu:              'type_contenu'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPE1_T4_BILAN — Bilan final (66 colonnes)
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T4_BILAN_FIELDS: {
    candidat_id:    'candidat_id',
    prenom:         'prenom',
    statut_bilan:   'statut_bilan',

    a_definition_moteur:     'a_definition_moteur',
    a_legende_couleurs:      'a_legende_couleurs',
    a_ordre_boucle:          'a_ordre_boucle',
    a_schema_generique:      'a_schema_generique',
    a_schema_revelation:     'a_schema_revelation',
    a_cartouche_attribution: 'a_cartouche_attribution',

    b_lexique_html: 'b_lexique_html',

    p1_entete: 'p1_entete', p1_pourquoi_role: 'p1_pourquoi_role', p1_circuits_lab: 'p1_circuits_lab',
    p1_circuits_cand: 'p1_circuits_cand', p1_mode_lab: 'p1_mode_lab', p1_mode_cand: 'p1_mode_cand',
    p1_commentaires_t3: 'p1_commentaires_t3',
    p2_entete: 'p2_entete', p2_pourquoi_role: 'p2_pourquoi_role', p2_circuits_lab: 'p2_circuits_lab',
    p2_circuits_cand: 'p2_circuits_cand', p2_mode_lab: 'p2_mode_lab', p2_mode_cand: 'p2_mode_cand',
    p2_commentaires_t3: 'p2_commentaires_t3',
    p3_entete: 'p3_entete', p3_pourquoi_role: 'p3_pourquoi_role', p3_circuits_lab: 'p3_circuits_lab',
    p3_circuits_cand: 'p3_circuits_cand', p3_mode_lab: 'p3_mode_lab', p3_mode_cand: 'p3_mode_cand',
    p3_commentaires_t3: 'p3_commentaires_t3',
    p4_entete: 'p4_entete', p4_pourquoi_role: 'p4_pourquoi_role', p4_circuits_lab: 'p4_circuits_lab',
    p4_circuits_cand: 'p4_circuits_cand', p4_mode_lab: 'p4_mode_lab', p4_mode_cand: 'p4_mode_cand',
    p4_commentaires_t3: 'p4_commentaires_t3',
    p5_entete: 'p5_entete', p5_pourquoi_role: 'p5_pourquoi_role', p5_circuits_lab: 'p5_circuits_lab',
    p5_circuits_cand: 'p5_circuits_cand', p5_mode_lab: 'p5_mode_lab', p5_mode_cand: 'p5_mode_cand',
    p5_commentaires_t3: 'p5_commentaires_t3',

    d1_filtre_lab:    'd1_filtre_lab',
    d1_filtre_cand:   'd1_filtre_cand',
    d2_boucle_lab:    'd2_boucle_lab',
    d2_boucle_cand:   'd2_boucle_cand',
    d3_finalite_lab:  'd3_finalite_lab',
    d3_finalite_cand: 'd3_finalite_cand',
    d4_signature:     'd4_signature',
    d5_couts_lab:     'd5_couts_lab',
    d5_couts_cand:    'd5_couts_cand',
    d6_conclusion:    'd6_conclusion',

    e_header:     'e_header',
    e_navigation: 'e_navigation',
    e_footer:     'e_footer',

    bilan_html_complet: 'bilan_html_complet',

    audit_agent1:        'audit_agent1',
    audit_agent2:        'audit_agent2',
    audit_agent3:        'audit_agent3',
    audit_agent4:        'audit_agent4',
    audit_agent5:        'audit_agent5',
    audit_agent6:        'audit_agent6',
    audit_certificateur: 'audit_certificateur'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // REFERENTIEL_LEXIQUE — 15 termes doctrinaux (9 colonnes)
  // ═══════════════════════════════════════════════════════════════════════════
  REFERENTIEL_LEXIQUE_FIELDS: {
    id:                         'id',
    terme:                      'terme',
    definition:                 'definition',
    ordre_affichage:            'ordre_affichage',
    categorie:                  'categorie',
    forme_grammaticale:         'forme_grammaticale',
    precision_semantique:       'precision_semantique',
    termes_interdits_associes:  'termes_interdits_associes',
    exemple_cecile:             'exemple_cecile'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ v11.0 — ETAPE1_T3_PILIER — tableId : tblzDIn7P2cOvVvY2
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T3_PILIER_FIELDS: {
    candidat_id:            'fldZKruIBDdjAsY47',
    bilan_link:             'fld4vR7DGcEVCzz32',
    cle_composite:          'fldiL5nkdk50zFwkX',
    pilier:                 'fldVvi5gbKioBmlsQ',
    pilier_label:           'fldbDYECHFEGkh0Ng',
    role_pilier:            'fldhFisqhUf9oBLOe',
    pilier_role_label:      'fld1X3FQYRcxB2Qwy',
    pilier_mode:            'fldoGY71vyiaUeFl6',
    pilier_rappel:          'fld6qIK9UOZPAE59k',
    nb_activations:         'fldg5DCdL9U523YfG',
    nb_circuits_actifs:     'fldtUV0KYT0zyjg0J',
    nb_circuits_haut:       'fldUmfMvtMEsADKFX',
    cluster_label:          'fldfpEzRkoHqXHmJ2',
    cluster_detail:         'fldNbdQTQFrL9MmLv',
    tableau_note:           'fldKax0VwI4BhnLKV',
    synth_factuelle:        'fldcGtODAh6b0vZs5',
    synth_interpretee:      'fldho6MPGr5J5QmPu',
    liens_circuits:         'fldtZdnuftdhGx2mb'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ v11.0 — ETAPE1_T3_CIRCUIT
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T3_CIRCUIT_FIELDS: {
    circuit_uid:         'fldeaMdgx3WVWgxgv',
    bilan_link:          'fldUewcuNizHi3NrW',
    pilier_link:         'fldPpfFtaCh9wI9IQ',
    candidat_id:         'fldpQzPEvlNaRXFgg',
    pilier:              'fld74EvZRf7r4biGh',
    circuit_id:          'fldrnHJtNOWWYJ91t',
    circuit_nom:         'fldSGRXf8mi4q1NTd',
    circuit_freq:        'fldrM33rxdYnJ39vz',
    circuit_franches:    'fldwfbNZ0DKsdXray',
    circuit_nuancees:    'fldDnY9fRw3g62C6o',
    circuit_cluster:     'fldGzHp6ZFEsiIERf',
    circuit_signal:      'fldVsySoS1k0yFHgx',
    circuit_niveau:      'fld0LTPI1KfAVHRqI',
    n1_definition:       'fldKKSpL02oLC8Gwn',
    n2_verbatims:        'fldV3EBlHGUleiifK',
    n3_nuance:           'fldSx0VOHYILowFSj',
    ordre_pilier:        'fldSK79cCYsuICAAy',
    ordre_circuit:       'fld5SPJJXdv9Bo6vT',
    en_svc_P1:           'fldoGZPSxM22pk82R',
    en_svc_P2:           'fldAgQzO8YgqbzUEe',
    en_svc_P3:           'fld56OTFNSTo7OGAE',
    en_svc_P4:           'fldJ76jeasA2KVmdY',
    en_svc_P5:           'fldqMhYYHMy7b2s1n',
    total_activations:   'fldnFNJm6GP0mAGNm'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ v11.1 — ETAPE1_T3_BILAN_FIELDS — tableId : tblv775KQrEhsogdI
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T3_BILAN_FIELDS: {
    candidat_id:               'fldk66gddYGCREOV4',
    civilite:                  'fld8yjgv2jIp2dzvW',
    prenom:                    'fldFjVTaedAE8iXkU',
    nom:                       'fldsOkyWddI15pqgU',
    version_bilan:             'fldBlTX1Fuiv81mRc',

    pilier_socle:              'fldfJHsX7A38IYele',
    pilier_socle_label:        'fldUf6rhEyR3MKI1x',
    pilier_socle_mode:         'fldLt4GhtqRUyl7V4',
    pilier_socle_role:         'fldBMHWSk6DsnRN2i',
    pilier_str1:               'fldzsZUsyQR7vvbEi',
    pilier_str1_label:         'fldVwPsne8uUxYbOG',
    pilier_str1_sorties:       'fld9wiwYRbBf1Eu1s',
    pilier_str2:               'fldefRzq9hqbn4gHn',
    pilier_str2_label:         'fld1mfPfxoQNXxPR5',
    pilier_str2_sorties:       'fldad4ntutJO9lesl',
    pilier_fn1:                'fld5kBccd13uSx9ll',
    pilier_fn1_label:          'fld8vqxt3y7AmvCud',
    pilier_fn1_sorties:        'fldcEfmIax60HZZPJ',
    pilier_fn2:                'fldyw87BmzorCZ93j',
    pilier_fn2_label:          'fldexYDVC5sLzBsJH',
    pilier_fn2_sorties:        'fldKRf4ixcN7bOE04',
    sorties_P1:                'fld1VX56hmKEE5Jq2',
    sorties_P2:                'fldPrsVmktnmYYgQ2',
    sorties_P3:                'fld23tLTuIWHyLcRs',
    sorties_P4:                'fldiTpqZAsWuKiZML',
    sorties_P5:                'fldu2FJSPYmjkFCUt',
    note_profil_global:        'fldXeBlXJ2IpU3diJ',

    filtre_label:              'fld6KItM77nOSojnf',
    filtre_preuve_1:           'fldFPhv8r1PtQpzN0',
    filtre_preuve_2:           'fldRCUSIQ8sbx4rM4',
    filtre_preuve_3:           'fldKeQsg0PvyQTOWx',
    filtre_preuve_4:           'fldSEckaqiK0jKXuZ',
    filtre_preuve_5:           'fldgq35VLCUvSa0uu',
    filtre_lecture_candidat:   'fldQlgWGaPg49Xlnv',

    glissement_intro:          'fldyJliwwvAV2jhFc',
    glissement_1_label:        'fldVeFU4zOLNOtrKh',
    glissement_1_titre:        'fldX0YFp5ELpcy7vT',
    glissement_1_corps:        'fldmOJ9XhFI4KgBvk',
    glissement_2_label:        'fldfIi0nXadtyi0IG',
    glissement_2_titre:        'fldoxKFKjZCPczJfd',
    glissement_2_corps:        'fldhW2RP6P13oZwxJ',
    glissement_3_label:        'fldImdOKR5wB8ns41',
    glissement_3_titre:        'fldUYhsd4CxZJ3WUf',
    glissement_3_corps:        'fldxxT2D5kD1J6SwQ',
    glissement_4_label:        'fldnVsaltgsoJF63c',
    glissement_4_titre:        'fldezsa8t1QMRUAPd',
    glissement_4_corps:        'fld6lWY9dpbwfrqTY',
    glissements_conclusion:    'fldI9PSSEB05HfKLR',

    boucle_intro:              'fldM9qq4vQedoBejk',
    boucle_1_label:            'flduVchzSfMWP5wCF',
    boucle_1_scenario:         'flddgKN52eZZq4jMk',
    boucle_1_reponse:          'fldgCUORgJ7WR7CxZ',
    boucle_1_sequence:         'fldzc7ElJmx5lHxZv',
    boucle_1_labo:             'fldXxBHuZ6GYHvxsN',
    boucle_2_label:            'flduzmUTK4uj0oNT3',
    boucle_2_scenario:         'fldxiIah51ibxBqUJ',
    boucle_2_reponse:          'fldT9VuEZoFUz7mff',
    boucle_2_sequence:         'fld0FFqL5wJuVtVo1',
    boucle_2_labo:             'fld4FT1HOL1DGQMNK',
    boucle_3_label:            'fld0TRj327hFgtIAl',
    boucle_3_scenario:         'fld6bxTiiuQ0byREw',
    boucle_3_reponse:          'fldQYTI8O0DrSW7o9',
    boucle_3_sequence:         'fld9viJ0nWwbR6O8V',
    boucle_3_labo:             'fldb6wCYgGUQ4Uahd',

    signal_type:               'fld4kDga5E9AcrE3V',
    signal_intro:              'fldx4U59bOkoI7MkN',
    signal_item1_q:            'fldtHh4X5LLKxj5d8',
    signal_item1_corps:        'fldJsMUEFQkJ3jbru',
    signal_item1_verbatim:     'fldDLb7kHyvfRwSVQ',
    signal_item2_q:            'fld3DPvqaAWjcjvdv',
    signal_item2_corps:        'fldB4yyZ4yTdzTkwd',
    signal_item2_verbatim:     'fldRyQKzNernSROVA',
    signal_item3_q:            'fldUxgogVIMQTseuK',
    signal_item3_corps:        'fldlYtwIjhGbch7fo',
    signal_item3_verbatim:     'fldISXvpIK4Dan2Q1',
    signal_item4_q:            'fldoET8wzVBlP7t57',
    signal_item4_corps:        'fldVVKDnMuiqf5gGx',
    signal_item4_verbatim:     'fldyLATVAfXhzKTbb',
    signal_synthese:           'flds2JqcNQwKy9pFg',

    cout1_niveau:              'fldUj9AnjGAC6mRA0',
    cout1_titre:               'flda1ghovzGZP61Pi',
    cout1_corps:               'fld98zcU1LR08eyrt',
    cout1_verbatim:            'fldRYcMc9N6bWCiB8',
    cout2_niveau:              'fldtjitVSF0pECezg',
    cout2_titre:               'fldmt53ekFZqbaGXW',
    cout2_corps:               'fldGhXQ8WWxqGOUxA',
    cout2_verbatim:            'fldOi1UiI3EmzhN0H',
    cout3_niveau:              'fldBnBoWIPHW9pki9',
    cout3_titre:               'fldZQPfKAJu0cPvLJ',
    cout3_corps:               'fldRLZNGvUevhxMUn',
    cout3_verbatim:            'fldWqhn5VKJMPSG6s',

    sig_pilier_label:          'fld1PZRqPxejsYc0Z',
    sig_filtre_val:            'fld6uiqUpCtWHfWYf',
    sig_finalite:              'fldxNmTAxP5FkqYWz',
    sig_resultat_ligne1:       'fldR2LjSEpCvbS0Uy',
    sig_resultat_ligne2:       'fldYlaGZTAewseLgK',
    sig_recit:                 'fldiGDaUJ4cO0c0zI',

    liens_piliers:             'fld0i2Xr5A07KJZOC',
    liens_circuits:            'fld8F9KkASvL3Gqet'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VALEURS AUTORISÉES (Single Select Airtable)
  // ═══════════════════════════════════════════════════════════════════════════
  ALLOWED_VALUES: {
    statut_test:             ['en_cours', 'terminé'],
    statut_analyse_pivar:    [
      'NOUVEAU',
      'en_cours',
      'terminé',
      'ERREUR',
      'EN_ATTENTE_VALIDATION_HUMAINE',
      'REPRENDRE_AGENT1',
      'REPRENDRE_VERIFICATEUR1',
      'REPRENDRE_AGENT2',
      'REPRENDRE_AGENT2_PHASE1',
      'REPRENDRE_AGENT2_PHASE2',
      'ETAPE2_PHASE1_TERMINEE',
      'REPRENDRE_AGENT2_PHASE3',
      'ETAPE2_PHASE2_TERMINEE',
      'ETAPE2_TERMINEE',
      'REPRENDRE_AGENT3',
      'REPRENDRE_AGENT4',
      'REPRENDRE_VERIFICATEUR4',
      'SUSPENDU MANUELLEMENT',
      'REPRENDRE_T1_SOMMEIL_SEUL',
      'REPRENDRE_T1_WEEKEND_SEUL',
      'REPRENDRE_T1_ANIMAL1_SEUL',
      'REPRENDRE_T1_ANIMAL2_SEUL',
      'REPRENDRE_T1_PANNE_SEUL',
      'REPRENDRE_T1_DES_SOMMEIL',
      'REPRENDRE_T1_DES_WEEKEND',
      'REPRENDRE_T1_DES_ANIMAL1',
      'REPRENDRE_T1_DES_ANIMAL2',
      'REPRENDRE_T1_DES_PANNE'
    ],
    validation_humaine_action: [
      'RELANCER_AGENT_T1',
      'RELANCER_VERIFICATEUR_T1',
      'ACCEPTER_TEL_QUEL',
      'ABANDONNER'
    ],

    pilier:                  ['P1', 'P2', 'P3', 'P4', 'P5'],
    scenario_nom:            ['SOMMEIL', 'WEEKEND', 'ANIMAL', 'PANNE'],
    scenario:                ['SOMMEIL', 'WEEKEND', 'ANIMAL', 'PANNE'],
    pilier_demande:          ['P1', 'P2', 'P3', 'P4', 'P5'],
    pilier_finalite:         ['P1', 'P2', 'P3', 'P4', 'P5'],
    pilier_coeur:            ['P1', 'P2', 'P3', 'P4', 'P5'],
    pilier_coeur_analyse:    ['P1', 'P2', 'P3', 'P4', 'P5'],
    conforme_ecart:          ['CONFORME', 'ÉCART'],
    v1_conforme:                ['OUI', 'NON'],
    v2_traite_problematique:    ['OUI', 'NON'],
    v2_repond_question:         ['OUI', 'NON'],
    v2_repond_situation:        ['OUI_TRANSITION', 'OUI_STORYTELLING', 'OUI_SITUATION_CONSTRUITE', 'NON'],

    verdict_global:          ['CONFORME', 'CORRECTION_REQUISE', 'BLOQUANT', 'INDETERMINE'],

    type_contenu:            ['ANALYSE', 'BRUT'],

    role_pilier:             ['socle', 'structurant_1', 'structurant_2', 'fonctionnel_1', 'fonctionnel_2', 'résistant'],
    niveau_activation:       ['HAUT', 'MOYEN', 'INACTIF'],
    actif:                   ['OUI', 'NON'],

    statut_bilan:            ['en_production', 'produit', 'certifie', 'erreur'],

    categorie:               ['fondateur', 'hierarchie', 'description', 'signature', 'analyse']
  }
};
