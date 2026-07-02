// config/airtable.js
// Configuration Airtable v12.1 — Pipeline Profil-Cognitif Étape 1
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et docs/CONTRAT_ETAPE1.md (v1.10 prévue)
//
// ─────────────────────────────────────────────────────────────────────────────
// PHASE v12.2 (2026-06-25) — CHAMP D'AUDIT analyse_verbalisee (T3_PILIER)
// ─────────────────────────────────────────────────────────────────────────────
//   Ajout additif : ETAPE1_T3_PILIER_FIELDS.analyse_verbalisee (fldGLJRqWUxUoDR5e).
//   Stocke la verbalisation de l'agent PA (lecture + jugement de cassure + rangement),
//   produite au temps 3 du conducteur du prompt v12. Sert de mémoire en cas de reprise
//   et de trace de contrôle qualité. AUCUN champ ancien retiré ni renommé.
//
// ─────────────────────────────────────────────────────────────────────────────
// PHASE v12.1 (2026-06-23) — BLOCS RANGÉS SUR LE TOTAL (activation, pas valeur)
// ─────────────────────────────────────────────────────────────────────────────
//   Les 3 groupes de blocs ne sont plus nommés HAUT/MOYEN/FAIBLE (notion de VALEUR)
//   mais très souvent / souvent / occasionnels (notion d'ACTIVATION). La valeur
//   reste portée séparément par la capacité (référentiel) et la profondeur (jugée).
//   ⚠️ Les fldID sont INCHANGÉS : seules les CLÉS de config sont renommées.
//   Mapping : très souvent → ex-HAUT · souvent → ex-MOYEN · occasionnels → ex-FAIBLE.
//   Le 3e texte « catalogue » est renommé « rattachement » (plus parlant).
//   Le renommage des NOMS LISIBLES dans Airtable est à faire dans l'interface
//   (les fldID stables garantissent que le code fonctionne avant/après ce renommage).
//
// ─────────────────────────────────────────────────────────────────────────────
// PHASE v12.0 (2026-06-18) — TABLE FIGÉE CIRCUITS_POURBILAN (Phase 4 étape 1.2)
// ─────────────────────────────────────────────────────────────────────────────
//   ⭐ AJOUT (additif uniquement — AUCUN champ ancien retiré ni renommé) :
//     - TABLES.ETAPE1_T2_CIRCUITS_POURBILAN (tblV8UBCgEOzJ2Tch)
//     - ETAPE1_T2_CIRCUITS_POURBILAN_FIELDS (mapping des colonnes)
//   Table produite par service_etape1_T2_phase4_circuits_pourbilan.js,
//   lue par l'agent PA pilier de l'étape 1.3.
//
// (Historique antérieur conservé tel quel ci-dessous.)
//
// PHASE v11.9 (2026-06-15) — AJOUT 8 CHAMPS VERBATIM T3_CIRCUIT
//   OBJECTIF : exposer dans _mapByFieldIds les 8 champs verbatim écrits par
//   serviceP_A (verbatim_1..4 + verbatim_1_ref..4_ref). Sans ces entrées,
//   getEtape1T3Circuits ne les retournait pas à la lecture.
//
//   ⭐ AJOUT (additif uniquement — AUCUN champ ancien retiré ni renommé) :
//   ETAPE1_T3_CIRCUIT_FIELDS : verbatim_1..4 + verbatim_1_ref..4_ref
//   (8 champs, vérifiés en base le 14/06/2026 sur Cécile).
//
// PHASE v11.8 (2026-06-13) — INTÉGRATION CHAÎNE BILAN « FABLE » (P-A..P-D)
// PHASE v11.7 (2026-06-05) — Bilan dynamique des 4 excellences.
// PHASE v11.6 (2026-06-05) — Visualisation Étape 2 (les 4 excellences).

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
    ETAPE2_RESPONSES_EXCELLENCES: 'ETAPE2_1_RESPONSES pour 4 excellences',  // tblLnWhszYAQldZOJ

    // ─── ⭐ v11.7 (05/06/2026) — Bilan dynamique des 4 excellences ──────────
    ETAPE2_BILAN_EXCELLENCE: 'RESPONSES_ETAPE2_ EXCELLENCE',  // tbldiVcVA52VC53n5 (note : espace dans le nom)
    ETAPE2_BILAN4EXCELLENCES: 'ETAPE2_BILAN4EXCELLENCES',       // tbltn7TVAf3Q87frg (profil de synthèse, 1 ligne/candidat)

    // ─── Étape 1 — Pipeline d'analyse ──────────────────────────────────────
    ETAPE1_T1:           'ETAPE1_T1',
    VERIFICATEUR_T1:     'VERIFICATEUR_T1',
    ETAPE1_T2:           'ETAPE1_T2',
    ETAPE1_T2_FABLE:     'tblaGd3ixAWxbJJp2',    // ⭐ A12 — table verbatims agrégés pour P-A
    ETAPE1_T3:           'ETAPE1_T3',
    ETAPE1_T4_BILAN:     'ETAPE1_T4_BILAN',

    // ─── ⭐ v10.9 (22/05/2026) — Tables Phase 3 (visualisation persistée) ────
    ETAPE1_T2_VENTILATION_PILIERS: 'ETAPE1_T2_VENTILATION_PILIERS',  // tbl4UzvAMQY4nRnI5
    ETAPE1_T2_INVENTAIRE_CIRCUITS: 'ETAPE1_T2_INVENTAIRE_CIRCUITS',  // tblUHZjXIW9jp9nIf (frozen source coeur/total/nb_svc)
    ETAPE1_T2_CIRCUITS_POURBILAN:  'tblV8UBCgEOzJ2Tch',  // ⭐ 18/06/2026 — table figée PRÊTE À LIRE (Phase 4 → agent PA pilier 1.3)

    // ─── ⭐ v11.0 (28/05/2026) — Étape 3 : le bilan (3 tables) ──────────────
    ETAPE1_T3_PILIER:              'ETAPE1_T3_PILIER',              // tblzDIn7P2cOvVvY2
    ETAPE1_T3_CIRCUIT:             'ETAPE1_T3_CIRCUIT',             // tblLAC4dS25v6IUbs
    ETAPE1_T3_BILAN:               'ETAPE1_T3_BILAN',              // tblv775KQrEhsogdI

    // ─── Référentiels stables ──────────────────────────────────────────────
    REFERENTIEL_LEXIQUE:           'REFERENTIEL_LEXIQUE',
    REFERENTIEL_PILIERS:           'REFERENTIEL_PILIERS',           // tblf4OodQ2Qi5xSXs
    REFERENTIEL_PROFILS:           'REFERENTIEL_PROFILS',
    REFERENTIEL_CIRCUITS:          'REFERENTIEL_CIRCUITS',
    REFERENTIEL_CIRCUITS_CANDIDATS: 'REFERENTIEL_CIRCUITS_CANDIDATS'  // ⭐ v10.8 (21/05/2026)  tblUDy7QTOzMMkhEK
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
  // tableId : tblUHZjXIW9jp9nIf  — SOURCE AUTORITAIRE coeur/total/nb_svc
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
  // ⭐ 18/06/2026 — ETAPE1_T2_CIRCUITS_POURBILAN — table figée PRÊTE À LIRE
  // tableId : tblV8UBCgEOzJ2Tch
  // Produite par la Phase 4. Lue par l'agent PA pilier de l'étape 1.3.
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T2_CIRCUITS_POURBILAN_FIELDS: {
    candidat_id:        'candidat_id',
    type_ligne:         'type_ligne',        // CIRCUIT / SOUS_TOTAL / TOTAL_PILIER / TOTAL_GENERAL
    pilier_owner:       'pilier_owner',
    pilier_nom:         'pilier_nom',
    rang_pilier:        'rang_pilier',
    role_pilier:        'role_pilier',       // socle / amont / aval / fonctionnel
    circuit_code:       'circuit_code',      // ex "P3C12" ou "P5·ADHOC"
    circuit_nom_clair:  'circuit_nom_clair',
    capacité:           'capacité',          // ⭐ NOM LITTÉRAL AVEC ACCENT
    bloc:               'bloc',
    ordre_bloc:         'ordre_bloc',
    niveau_coeur:       'niveau_coeur',      // HAUT / MOYEN / FAIBLE / EN_SOUTIEN
    niveau_amplitude:   'niveau_amplitude',  // HAUT / MOYEN / FAIBLE
    activation_coeur:   'activation_coeur',
    instru_P1:          'instru_P1',
    instru_P2:          'instru_P2',
    instru_P3:          'instru_P3',
    instru_P4:          'instru_P4',
    instru_P5:          'instru_P5',
    total_occurrences:  'total_occurrences',
    circuit_origine:    'circuit_origine',   // OFFICIEL / AD_HOC
    nom_ad_hoc:         'nom_ad_hoc',
    rang_dans_pilier:   'rang_dans_pilier',
    // ⭐ 26/06/2026 — AJOUT ADDITIF (maillon visu définitive « tableau3circuitspourbilandef »).
    //   Écrits par l'agent bilan-pilier (étape 1.3) APRÈS rangement. Champs DISTINCTS des
    //   champs d'origine (`bloc` reste BLOC_EN_ATTENTE → lu par la visu AVANT agent).
    //   La visu DÉFINITIVE lit ces 2 champs. AUCUN champ ancien retiré ni renommé.
    bloc_final:           'bloc_final',           // fld5caHteonsyxrji — très souvent / souvent / occasionnels
    profondeur_attribuee: 'profondeur_attribuee'  // fldYEje3RcqSg73FZ — effleuré / effectif / plein régime
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPE1_T3 — Analyse pilier × circuit (15 colonnes) — ANCIENNE (step 1.3)
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
  // ETAPE1_T4_BILAN — Bilan final (66 colonnes) — ANCIENNE GÉNÉRATION
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
    pilier_mode:            'fldoGY71vyiaUeFl6',   // ⭐ FABLE = mode_libelle (réutilisé)
    pilier_rappel:          'fld6qIK9UOZPAE59k',   // ⭐ FABLE = ligne têtière (réutilisé)
    nb_activations:         'fldg5DCdL9U523YfG',
    nb_circuits_actifs:     'fldtUV0KYT0zyjg0J',
    nb_circuits_haut:       'fldUmfMvtMEsADKFX',
    cluster_label:          'fldfpEzRkoHqXHmJ2',
    cluster_detail:         'fldNbdQTQFrL9MmLv',
    tableau_note:           'fldKax0VwI4BhnLKV',
    synth_factuelle:        'fldcGtODAh6b0vZs5',
    synth_interpretee:      'fldho6MPGr5J5QmPu',   // ⭐ FABLE = vue_ensemble (réutilisé)
    liens_circuits:         'fldtZdnuftdhGx2mb',

    // ───────── ⭐ FABLE (13/06/2026) — champs rédactionnels chaîne bilan ─────────
    // ⭐ v12.1 (23/06/2026) — clés renommées HAUT/MOYEN/FAIBLE → très souvent/souvent/occasionnels.
    //   Notion d'ACTIVATION (fréquence), plus de notion de VALEUR. fldID INCHANGÉS.
    //   Mapping : très souvent → ex-HAUT · souvent → ex-MOYEN · occasionnels → ex-FAIBLE.
    mode_explication:               'fld6GtEBRP5UxvHeI',
    intro_eclate:                   'fldomziXNOGf7Ujsb',
    bloc_tres_souvent_candidat:     'fldBLvofzosLTPUOr',   // ex bloc_haut_candidat
    bloc_souvent_candidat:          'flda16lg5Dt1HrXrF',   // ex bloc_moyen_candidat
    bloc_occasionnels_candidat:     'fld68H41z6b9XtFoZ',   // ex bloc_faible_candidat
    bloc_tres_souvent_technique:    'flds6XOIwvYr20iRY',   // ex bloc_haut_technique
    bloc_souvent_technique:         'fld7Sv7LXlZ6XPghN',   // ex bloc_moyen_technique
    bloc_occasionnels_technique:    'fld6BWLEjDMdbYTs6',   // ex bloc_faible_technique
    bloc_tres_souvent_rattachement: 'fldB9fRf8U61z4WZK',   // ex bloc_haut_catalogue
    bloc_souvent_rattachement:      'fldMA46pZRI6Bi0ZU',   // ex bloc_moyen_catalogue
    bloc_occasionnels_rattachement: 'fldZiSdH20uMb5wCY',   // ex bloc_faible_catalogue
    synth_courte:           'fldaSofvHZk2K2SXw',

    // ───────── ⭐ v12.2 (25/06/2026) — champ d'audit verbalisation agent ─────────
    analyse_verbalisee:     'fldGLJRqWUxUoDR5e'   // verbalisation PA (lecture + cassure + rangement), temps 3 du conducteur
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ v11.0 — ETAPE1_T3_CIRCUIT — tableId : tblLAC4dS25v6IUbs
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
    n3_nuance:           'fldSx0VOHYILowFSj',   // ⭐ FABLE = explication longue « 3 temps »
    profondeur:          'fldrtUgnSVYlsCgq6',   // ⭐ 22/06 — profondeur d'activation (effleuré/effectif/plein régime)
    ordre_pilier:        'fldSK79cCYsuICAAy',
    ordre_circuit:       'fld5SPJJXdv9Bo6vT',
    en_svc_P1:           'fldoGZPSxM22pk82R',
    en_svc_P2:           'fldAgQzO8YgqbzUEe',
    en_svc_P3:           'fld56OTFNSTo7OGAE',
    en_svc_P4:           'fldJ76jeasA2KVmdY',
    en_svc_P5:           'fldqMhYYHMy7b2s1n',
    total_activations:   'fldnFNJm6GP0mAGNm',

    // ───────── ⭐ FABLE (13/06/2026) — champs rédactionnels chaîne bilan ─────────
    explication_courte_ch4: 'fld3zZ8SteMWedetW',
    en_renfort:             'fldixMQDcsD7cCyd3',

    // ───────── ⭐ v11.9 (15/06/2026) — verbatims cités par circuit ─────────────
    // Ces 8 champs existent en base (vérifiés sur Cécile le 14/06/2026).
    // Écrits par serviceP_A via fldIDs hardcodés dans VERB_FLD.
    // Ajoutés ici pour que _mapByFieldIds les retourne à la lecture
    // (nécessaire pour serviceP_B qui relit T3_CIRCUIT).
    verbatim_1:     'fldLP9juCWCTlCZPt',
    verbatim_1_ref: 'fldI1DVJiH7EH4zel',
    verbatim_2:     'fldSCQD9zvgRQcuq9',
    verbatim_2_ref: 'fldmVPwfku0vUz6xX',
    verbatim_3:     'fldhIp3aW72WR2V1t',
    verbatim_3_ref: 'fldcQ7hxyRumcc1DO',
    verbatim_4:     'fld4lrLWySRXVmvZe',
    verbatim_4_ref: 'fldQgruSXveuTCLM4'
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

    // ─── ANCIEN filtre (GELÉ) ───
    filtre_label:              'fld6KItM77nOSojnf',
    filtre_preuve_1:           'fldFPhv8r1PtQpzN0',
    filtre_preuve_2:           'fldRCUSIQ8sbx4rM4',
    filtre_preuve_3:           'fldKeQsg0PvyQTOWx',
    filtre_preuve_4:           'fldSEckaqiK0jKXuZ',
    filtre_preuve_5:           'fldgq35VLCUvSa0uu',
    filtre_lecture_candidat:   'fldQlgWGaPg49Xlnv',

    // ─── ANCIEN glissements (GELÉ) ───
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

    // ─── ANCIEN boucle (GELÉ, SAUF boucle_intro réutilisé) ───
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

    // ─── ANCIEN signal (GELÉ) ───
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

    // ─── ANCIEN couts (GELÉ) ───
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

    // ─── ANCIEN signature (GELÉ) ───
    sig_pilier_label:          'fld1PZRqPxejsYc0Z',
    sig_filtre_val:            'fld6uiqUpCtWHfWYf',
    sig_finalite:              'fldxNmTAxP5FkqYWz',
    sig_resultat_ligne1:       'fldR2LjSEpCvbS0Uy',
    sig_resultat_ligne2:       'fldYlaGZTAewseLgK',
    sig_recit:                 'fldiGDaUJ4cO0c0zI',

    liens_piliers:             'fld0i2Xr5A07KJZOC',
    liens_circuits:            'fld8F9KkASvL3Gqet',

    // ═════════ ⭐ FABLE (13/06/2026) — CHAMPS DE LA CHAÎNE BILAN ═════════
    filtre:                    'fld9vAKpKEMIcRiTB',
    filtre_declinaison:        'fld1p9p9Csvyllvcm',
    ch4_filtre_revelation:     'fldqDeT7EDov18iTz',
    ch4_filtre_preuves:        'fldXGZ5ijlcGPYc16',
    schema_intro_roles:        'fldm2QaOvI5cKpLwg',
    schema_legende_socle:      'fldXlpyU1EdUPBtIH',
    socle_libelle:             'fldb8Y9IrrvMP9w0k',
    maillon_m1_depart:         'fldVM2cfim5rBivMt',
    maillon_m2_dialogue:       'fldAZQSbNRxK8ugWo',
    maillon_m3_debouche:       'fldKxUzxHTvZ6d3z5',
    maillon_m4_jamais:         'fldzc8cjyygsfbC5N',
    boucle_intro_texte:        'fldFWT8vtfVuTm4zC',
    boucle_technique:          'fldRRLpspWX6qTx7d',
    s05_intro:                 'fldxCNvqR4qyYAYjr',
    registres:                 'fldgeeC3lg3M89ESA',
    s05_cloture:               'fld9x0yRmGnAhVFS4',
    s06_intro:                 'fldxZi0jRCWnXsVng',
    cout_principal:            'fld0nyRitbejCsihG',
    cout_secondaire:           'fld7JUPi80iqSKzzV',
    s06_cloture:               'fld1nB5UqVklCjikE',
    pd_analyse_verbalisee:     'fld0IrJZ4Pe9dDHhG',   // ⭐ 26/06 — trace <analyse> T1→T? de l'agent PD (audit, comme filtre)

    // ═════════ ⭐ v12.3 (25/06/2026) — CH4 §02 FILTRE & FINALITÉ v2 ═════════
    //   Ajout additif (AUCUN champ ancien retiré ni renommé). Écrits par service_ch4_v2.js.
    //   Le filtre réutilise le champ existant `filtre` (fld9vAKpKEMIcRiTB) et
    //   `ch4_filtre_preuves` (fldXGZ5ijlcGPYc16). Ces 4 champs portent la nouveauté v2 :
    //   la finalité (3e terme de la signature), sa preuve, le profil de calibrage, la trace labo.
    //   ⚠️ La technique v2 a son PROPRE champ (filtre_technique_v2) — ne PAS la mettre dans
    //   filtre_preuve_3 (fldKeQsg0PvyQTOWx), qui est un ancien champ filtre GELÉ.
    filtre_finalite:           'fldobIgYtfa3Qiy4v',   // le « pour »-but (résultat visé)
    filtre_finalite_preuve:    'fldLe9NPXIVfsNDjU',   // verbatim portant le « pour »-but + réf
    filtre_profil_calibrage:   'fldFjcTlLSUjYR8Qy',   // famille + variante (calibrage, jamais écriture)
    filtre_technique_v2:       'fldFheeASGSqDvqOm',   // registre labo : sources A∩B, dénominateur
    filtre_analyse_verbalisee: 'fldduLP9UN4tVRnPE',   // trace <analyse> T1→T9 de l'agent (audit, comme PA)

    // ═════════ ⭐ v12.4 (02/07/2026) — CH3 FILTRE : décodage geste par geste ═════════
    //   Écrits par service_etape1_T3_bilan_PB_filtre v4. Créés en base le 02/07.
    //   filtre_gestes : JSON [{code,nom,coeur,rang,dit[],fait,revele}] (1/circuit bloc très souvent).
    //   filtre_synthese : texte qui pose le filtre APRÈS les gestes décodés.
    filtre_gestes:             'fldQr5PWbmaTH2uwv',
    filtre_synthese:           'fldzYiMkf7HgdBddj'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VALEURS AUTORISÉES (Single Select Airtable)
  // ═══════════════════════════════════════════════════════════════════════════
  ALLOWED_VALUES: {
    statut_test:             ['en_cours', 'terminé'],

    statut_analyse_pivar:    [
      'EN_ATTENTE_VALIDATION_HUMAINE',
      'SUSPENDU MANUELLEMENT',
      'NOUVEAU',
      'en_cours',
      'terminé',
      'ERREUR',
      'REPRENDRE_PROMPT_ETAPE1',
      'REPRENDRE_AGENT1',
      'REPRENDRE_T1_SOMMEIL_SEUL',
      'REPRENDRE_T1_WEEKEND_SEUL',
      'REPRENDRE_T1_ANIMAL1_SEUL',
      'REPRENDRE_T1_ANIMAL2_SEUL',
      'REPRENDRE_T1_PANNE_SEUL',
      'REPRENDRE_T1_DES_SOMMEIL',
      'REPRENDRE_T1_DES_WEEKEND',
      'REPRENDRE_T1_DES_ANIMAL1',
      'REPRENDRE_T1_DES_ANIMAL2',
      'REPRENDRE_T1_DES_PANNE',
      'ETAPE1_TERMINEE',
      'REPRENDRE_AGENT2',
      'REPRENDRE_AGENT2_PHASE1',
      'REPRENDRE_AGENT2_PHASE2',
      'REPRENDRE_AGENT2_PHASE3',
      'ETAPE2_PHASE1_TERMINEE',
      'ETAPE2_PHASE2_TERMINEE',
      'ETAPE2_TERMINEE',
      'ETAPE2_COMPLET',
      'ETAPE2_AGENT_A',
      'ETAPE2_AGENT_B',
      'ETAPE2_AGENT_C',
      'ETAPE2_3BILAN4EXCELLENCES',
      'REPRENDRE_AGENT3',
      'ETAPE3_TERMINEE',
      'REPRENDRE_BILAN_FABLE',
      'REPRENDRE_BILAN_PA',
      'REPRENDRE_BILAN_PB',
      'REPRENDRE_BILAN_PD',
      'BILAN_FABLE_PA_OK',
      'BILAN_FABLE_TERMINE'
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
