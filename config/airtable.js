// config/airtable.js
// Configuration Airtable v9.0 — Pipeline Profil-Cognitif Étape 1
//
// Architecture :
//   - VISITEUR, RESPONSES (existantes, intactes)
//   - QUESTIONS PIVAR SCENARIO (référentiel, lecture seule)
//   - BILAN (ancienne, conservée pour Étape 2/3 futures)
//   - ETAPE1_T1, ETAPE1_T2, ETAPE1_T3, ETAPE1_T4_BILAN (nouvelles)
//   - REFERENTIEL_LEXIQUE (15 termes doctrinaux, lue par tous les agents)
//
// LOT 21 (2026-04-27) — AJOUT MINIMAL :
//   - ETAPE1_T1_FIELDS : ajout du champ `corrections_certificateur` (long text)
//     rempli par le certificateur T1 quand il patche une ligne (trace de ses corrections)

'use strict';

module.exports = {
  BASE_ID: process.env.AIRTABLE_BASE_ID,
  TOKEN:   process.env.AIRTABLE_TOKEN,

  // ─── TABLES ────────────────────────────────────────────────────────────────
  TABLES: {
    // Anciennes — conservées intactes
    VISITEUR:           'VISITEUR',
    QUESTIONS_SCENARIO: 'QUESTIONS PIVAR SCENARIO',  // référentiel 25 questions
    RESPONSES:          'RESPONSES',                  // réponses brutes (frontend) — lecture seule pour pipeline v9
    BILAN:              'BILAN',                      // ancien bilan, champs Étape 2/3 vides pour l'instant

    // Nouvelles — pipeline v9
    ETAPE1_T1:          'ETAPE1_T1',                  // analyse pilier-cœur (25 lignes/candidat)
    ETAPE1_T2:          'ETAPE1_T2',                  // synthèse par question (25 lignes/candidat)
    ETAPE1_T3:          'ETAPE1_T3',                  // analyse pilier × circuit (75 lignes/candidat)
    ETAPE1_T4_BILAN:    'ETAPE1_T4_BILAN',            // bilan final (1 ligne/candidat)
    REFERENTIEL_LEXIQUE: 'REFERENTIEL_LEXIQUE'        // 15 termes doctrinaux
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VISITEUR — suivi candidat (inchangé v8 → v9)
  // ═══════════════════════════════════════════════════════════════════════════
  VISITEUR_FIELDS: {
    candidate_ID:               'candidate_ID',
    Prenom:                     'Prenom',
    Nom:                        'Nom',
    Email:                      'Email',
    statut_test:                'statut_test',
    derniere_question_repondue: 'derniere_question_repondue',
    statut_analyse_pivar:       'statut_analyse_pivar',  // Conservé tel quel (D2 actée)
    erreur_analyse:             'erreur_analyse',
    derniere_activite:          'derniere_activite',

    // Backups par scénario (conservés)
    backup_sommeil:             'backup_sommeil',
    backup_weekend:             'backup_weekend',
    backup_animal:              'backup_animal',
    backup_panne:               'backup_panne',

    // Backups pipeline v9 (nouveaux noms — adaptés aux 9 agents)
    backup_before_t1:           'backup_before_t1',
    backup_after_t1:            'backup_after_t1',
    backup_before_t2:           'backup_before_t2',
    backup_after_t2:            'backup_after_t2',
    backup_before_t3:           'backup_before_t3',
    backup_after_t3:            'backup_after_t3',
    backup_before_t4_parallel:  'backup_before_t4_parallel',
    backup_after_t4_parallel:   'backup_after_t4_parallel',
    backup_before_t4_synthese:  'backup_before_t4_synthese',
    backup_after_t4_synthese:   'backup_after_t4_synthese',
    backup_before_t4_couts:     'backup_before_t4_couts',
    backup_after_t4_couts:      'backup_after_t4_couts',
    backup_before_certif:       'backup_before_certif',
    backup_after_certif:        'backup_after_certif',
    backup_error:               'backup_error',

    // Anonymisation — seule la civilité est transmise aux agents
    civilite_candidat:          'civilite_candidat'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RESPONSES — réponses brutes du candidat (frontend)
  // ⚠ LECTURE SEULE pour le pipeline v9 (D7 actée)
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
  // ETAPE1_T1 — Analyse brute des 25 réponses (23 colonnes — Lot 21)
  // Écrit par : Agent T1
  // Patché par : Agent T1 Certificateur (corrections + pilier_sortie + corrections_certificateur)
  // Volume : 25 lignes par candidat
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T1_FIELDS: {
    // Identité (8)
    candidat_id:             'candidat_id',
    id_question:             'id_question',
    question_id_protocole:   'question_id_protocole',
    scenario:                'scenario',
    pilier_demande:          'pilier_demande',
    question_texte:          'question_texte',
    storytelling:            'storytelling',
    transition:              'transition',

    // Réponse brute (1)
    verbatim_candidat:       'verbatim_candidat',

    // Analyse cognitive (13)
    v1_conforme:                    'v1_conforme',
    v2_traite_problematique:        'v2_traite_problematique',
    verbes_observes:                'verbes_observes',
    verbes_angles_piliers:          'verbes_angles_piliers',
    pilier_coeur_analyse:           'pilier_coeur_analyse',
    types_verbatim:                 'types_verbatim',
    piliers_secondaires:            'piliers_secondaires',
    pilier_sortie:                  'pilier_sortie',
    finalite_reponse:               'finalite_reponse',
    attribution_pilier_signal_brut: 'attribution_pilier_signal_brut',
    conforme_ecart:                 'conforme_ecart',
    ecart_detail:                   'ecart_detail',
    signal_limbique:                'signal_limbique',

    // Raisonnement verbalisé (1) — LOT 17 (Pilier 3 doctrine)
    raisonnement:                   'raisonnement',

    // Trace certificateur (1) — LOT 21
    corrections_certificateur:      'corrections_certificateur'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPE1_T2 — Synthèse par question (15 colonnes)
  // Écrit par : Agent T2
  // Volume : 25 lignes par candidat
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T2_FIELDS: {
    // Identité (5)
    candidat_id:           'candidat_id',
    id_question:           'id_question',
    question_id_protocole: 'question_id_protocole',
    scenario:              'scenario',
    pilier_demande:        'pilier_demande',

    // Synthèse (10)
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
  // ETAPE1_T3 — Analyse pilier × circuit (15 colonnes, version v4)
  // Écrit par : Agent T3
  // Volume : 75 lignes par candidat (5 piliers × 15 circuits)
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T3_FIELDS: {
    // Identité (4)
    candidat_id:               'candidat_id',
    pilier:                    'pilier',
    role_pilier:               'role_pilier',
    nb_circuits_actifs_pilier: 'nb_circuits_actifs_pilier',

    // Circuit (5)
    circuit_id:        'circuit_id',
    circuit_nom:       'circuit_nom',
    frequence:         'frequence',
    niveau_activation: 'niveau_activation',
    actif:             'actif',

    // Analyse v4 (6)
    types_verbatim_detail:    'types_verbatim_detail',
    activations_franches:     'activations_franches',
    activations_nuancees:     'activations_nuancees',
    clusters_identifies:      'clusters_identifies',
    commentaire_attribution:  'commentaire_attribution',
    type_contenu:             'type_contenu'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ETAPE1_T4_BILAN — Bilan final (66 colonnes)
  // Écrit par : 6 agents T4 + certificateur
  // Volume : 1 ligne par candidat
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T4_BILAN_FIELDS: {
    // Identité (3)
    candidat_id:    'candidat_id',
    prenom:         'prenom',
    statut_bilan:   'statut_bilan',

    // Section A — Définitions et schémas génériques (Agent 6 Transverses) — 6
    a_definition_moteur:     'a_definition_moteur',
    a_legende_couleurs:      'a_legende_couleurs',
    a_ordre_boucle:          'a_ordre_boucle',
    a_schema_generique:      'a_schema_generique',
    a_schema_revelation:     'a_schema_revelation',
    a_cartouche_attribution: 'a_cartouche_attribution',

    // Section B — Lexique (Agent 6 Transverses) — 1
    b_lexique_html: 'b_lexique_html',

    // Sections P1 à P5 — par pilier (Agents 1, 2, 3) — 7 colonnes × 5 piliers = 35
    // Pilier 1
    p1_entete:           'p1_entete',
    p1_pourquoi_role:    'p1_pourquoi_role',
    p1_circuits_lab:     'p1_circuits_lab',
    p1_circuits_cand:    'p1_circuits_cand',
    p1_mode_lab:         'p1_mode_lab',
    p1_mode_cand:        'p1_mode_cand',
    p1_commentaires_t3:  'p1_commentaires_t3',
    // Pilier 2
    p2_entete:           'p2_entete',
    p2_pourquoi_role:    'p2_pourquoi_role',
    p2_circuits_lab:     'p2_circuits_lab',
    p2_circuits_cand:    'p2_circuits_cand',
    p2_mode_lab:         'p2_mode_lab',
    p2_mode_cand:        'p2_mode_cand',
    p2_commentaires_t3:  'p2_commentaires_t3',
    // Pilier 3
    p3_entete:           'p3_entete',
    p3_pourquoi_role:    'p3_pourquoi_role',
    p3_circuits_lab:     'p3_circuits_lab',
    p3_circuits_cand:    'p3_circuits_cand',
    p3_mode_lab:         'p3_mode_lab',
    p3_mode_cand:        'p3_mode_cand',
    p3_commentaires_t3:  'p3_commentaires_t3',
    // Pilier 4
    p4_entete:           'p4_entete',
    p4_pourquoi_role:    'p4_pourquoi_role',
    p4_circuits_lab:     'p4_circuits_lab',
    p4_circuits_cand:    'p4_circuits_cand',
    p4_mode_lab:         'p4_mode_lab',
    p4_mode_cand:        'p4_mode_cand',
    p4_commentaires_t3:  'p4_commentaires_t3',
    // Pilier 5
    p5_entete:           'p5_entete',
    p5_pourquoi_role:    'p5_pourquoi_role',
    p5_circuits_lab:     'p5_circuits_lab',
    p5_circuits_cand:    'p5_circuits_cand',
    p5_mode_lab:         'p5_mode_lab',
    p5_mode_cand:        'p5_mode_cand',
    p5_commentaires_t3:  'p5_commentaires_t3',

    // Section D — Synthèse cœur (Agent 4) + Coûts/clôture (Agent 5) — 10
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

    // Section E — Header / Navigation / Footer (Agent 6 Transverses) — 3
    e_header:     'e_header',
    e_navigation: 'e_navigation',
    e_footer:     'e_footer',

    // Bilan HTML assemblé final — 1
    bilan_html_complet: 'bilan_html_complet',

    // Audit (sortie JSON brute de chaque agent + certificateur) — 7
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
  // Lue par : tous les agents (injection dynamique) + certificateur
  // ═══════════════════════════════════════════════════════════════════════════
  REFERENTIEL_LEXIQUE_FIELDS: {
    id:                         'id',                          // L01 à L15
    terme:                      'terme',                       // « Pilier socle », « Filtre cognitif »...
    definition:                 'definition',                  // Mot pour mot, non-négociable
    ordre_affichage:            'ordre_affichage',             // 1 à 15
    categorie:                  'categorie',                   // fondateur/hierarchie/description/signature/analyse
    forme_grammaticale:         'forme_grammaticale',          // Optionnel
    precision_semantique:       'precision_semantique',        // Optionnel
    termes_interdits_associes:  'termes_interdits_associes',   // Optionnel
    exemple_cecile:             'exemple_cecile'               // Optionnel
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // BILAN — ancienne table conservée (D3 actée)
  // Champs Étape 2 et Étape 3 conservés vides pour l'instant
  // ⚠ LECTURE SEULE pour le pipeline v9 (le bilan v9 va dans ETAPE1_T4_BILAN)
  // ═══════════════════════════════════════════════════════════════════════════
  BILAN_FIELDS: {
    bilan_ID:   'bilan_ID',
    session_ID: 'session_ID',
    // Les 100+ champs anciens sont conservés tels quels mais pas listés ici
    // car non utilisés par le pipeline v9.
    // Ils seront documentés et utilisés quand l'Étape 2 et l'Étape 3
    // seront implémentées.
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VALEURS AUTORISÉES (Single Select Airtable)
  // ═══════════════════════════════════════════════════════════════════════════
  ALLOWED_VALUES: {
    // VISITEUR
    statut_test:             ['en_cours', 'terminé'],
    statut_analyse_pivar:    ['NOUVEAU', 'en_cours', 'terminé', 'ERREUR'],

    // ETAPE1_T1 / RESPONSES
    pilier:                  ['P1', 'P2', 'P3', 'P4', 'P5'],
    scenario_nom:            ['SOMMEIL', 'WEEKEND', 'ANIMAL', 'PANNE'],
    scenario:                ['SOMMEIL', 'WEEKEND', 'ANIMAL', 'PANNE'],
    pilier_demande:          ['P1', 'P2', 'P3', 'P4', 'P5'],
    pilier_coeur_analyse:    ['P1', 'P2', 'P3', 'P4', 'P5'],
    pilier_sortie:           ['P1', 'P2', 'P3', 'P4', 'P5'],
    conforme_ecart:          ['CONFORME', 'ECART'],

    // ETAPE1_T2
    pilier_coeur:            ['P1', 'P2', 'P3', 'P4', 'P5'],
    type_contenu:            ['ANALYSE', 'BRUT'],

    // ETAPE1_T3
    role_pilier:             ['socle', 'structurant_1', 'structurant_2', 'fonctionnel_1', 'fonctionnel_2', 'résistant'],
    niveau_activation:       ['HAUT', 'MOYEN', 'INACTIF'],
    actif:                   ['OUI', 'NON'],

    // ETAPE1_T4_BILAN
    statut_bilan:            ['en_production', 'produit', 'certifie', 'erreur'],

    // REFERENTIEL_LEXIQUE
    categorie:               ['fondateur', 'hierarchie', 'description', 'signature', 'analyse']
  }
};
