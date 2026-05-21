// config/airtable.js
// Configuration Airtable v10.4 — Pipeline Profil-Cognitif Étape 1
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (v1.2)
//                       et docs/CONTRAT_ETAPE1.md (v1.10 prévue)
//
// Architecture multi-étapes (Décision n°26) :
//   - VISITEUR, RESPONSES (existantes, intactes)
//   - QUESTIONS PIVAR SCENARIO (référentiel, lecture seule)
//   - ETAPE1_T1, ETAPE1_T2, ETAPE1_T3, ETAPE1_T4_BILAN (Étape 1 active)
//   - VERIFICATEUR_T1 (audit du vérificateur — Décision n°10)
//   - REFERENTIEL_LEXIQUE (15 termes doctrinaux, lue par tous les agents)
//   - BILAN (ancienne, conservée pour Étape 2/3 futures)
//
// PHASE D (2026-04-28) — v10 :
//   - Décision n°5 : `pilier_sortie` ABANDONNÉ (retiré de ETAPE1_T1_FIELDS et ALLOWED_VALUES)
//   - Décision n°10 : `corrections_certificateur` → `corrections_verificateur`
//   - Décision n°10 : ajout table VERIFICATEUR_T1 + VERIFICATEUR_T1_FIELDS
//   - Décision n°16 : ajout champs `validation_humaine_*` + `nombre_tentatives_etape1` dans VISITEUR
//   - Décision n°33 : ajout 6 champs emails (`email_*_envoye`, `date_T0`)
//   - Décision n°10 : ajout 2 champs backups vérificateur dans VISITEUR
//   - Statuts élargis : EN_ATTENTE_VALIDATION_HUMAINE, REPRENDRE_AGENT1, REPRENDRE_VERIFICATEUR1
//
// PHASE v10.3 (2026-05-04) — alignement T1 v3.2 + Vérificateur v1.2 :
//   - Décision n°43 : ajout des 5 champs grille à 3 niveaux dans ETAPE1_T1_FIELDS
//     (pilier_finalite, pilier_finalite_libelle, pilier_coeur,
//      outil_cognitif_libelle, piliers_traverses)
//   - Décision n°45 : conforme_ecart accepte ÉCART (avec accent É) — alignement v1.9
//   - Décision n°42 : ALLOWED_VALUES.statut_analyse_pivar mis à jour avec les 22 statuts
//     réellement présents en Airtable (familles A et B de relances ciblées)
//
// PHASE v10.4 (2026-05-04 soir) — doctrine v2 v3.3 + suppression raisonnement :
//   - DOCTRINE v2 v3.3 : doctrine v2_traite_problematique reformulée par Isabelle
//     en 2 questions binaires séparées (A : répond-il à la question stricte ?
//     B : répond-il à la situation, et laquelle ?)
//     → 3 nouveaux champs ETAPE1_T1 :
//        * v2_repond_question (singleSelect OUI/NON)
//        * v2_repond_situation (singleSelect OUI_TRANSITION/OUI_STORYTELLING/
//          OUI_SITUATION_CONSTRUITE/NON)
//        * v2_analyse (multilineText, justification 1-3 phrases)
//   - Décision n°48 : champ `raisonnement` SUPPRIMÉ de ETAPE1_T1_FIELDS
//     (audit a montré qu'il restait systématiquement vide)
//   - ⚠️ Ces 3 nouveaux champs sont créés en Airtable (Field IDs réels) :
//        v2_repond_question  : fldWXpcV5AmDykzYJ
//        v2_repond_situation : fldN7PHzA4C9Nm0AP
//        v2_analyse          : fldELA2jSu9fHke3c
//   - Note : ces structures sont documentaires (non utilisées par le code en exécution).
//     Elles servent de référence pour les agents IA qui doivent comprendre le schéma.

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

    // ─── Étape 1 — Pipeline d'analyse ──────────────────────────────────────
    ETAPE1_T1:           'ETAPE1_T1',
    VERIFICATEUR_T1:     'VERIFICATEUR_T1',     // ⭐ v10 — audit du vérificateur (Décision n°10)
    ETAPE1_T2:           'ETAPE1_T2',
    ETAPE1_T3:           'ETAPE1_T3',
    ETAPE1_T4_BILAN:     'ETAPE1_T4_BILAN',

    // ─── Référentiels stables ──────────────────────────────────────────────
    REFERENTIEL_LEXIQUE:            'REFERENTIEL_LEXIQUE',
    REFERENTIEL_PILIERS:            'REFERENTIEL_PILIERS',
    REFERENTIEL_PROFILS:            'REFERENTIEL_PROFILS',
    REFERENTIEL_CIRCUITS:           'REFERENTIEL_CIRCUITS',
    REFERENTIEL_CIRCUITS_CANDIDATS: 'REFERENTIEL_CIRCUITS_CANDIDATS'  // ⭐ v10.7 — bac de veille circuits ad hoc (étape 2)
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VISITEUR — suivi candidat
  // ═══════════════════════════════════════════════════════════════════════════
  VISITEUR_FIELDS: {
    candidate_ID:               'candidate_ID',
    Prenom:                     'Prenom',
    Nom:                        'Nom',
    Email:                      'Email',
    civilite_candidat:          'civilite_candidat',  // anonymisation : seule la civilité est transmise aux agents
    statut_test:                'statut_test',
    derniere_question_repondue: 'derniere_question_repondue',
    statut_analyse_pivar:       'statut_analyse_pivar',
    erreur_analyse:             'erreur_analyse',
    derniere_activite:          'derniere_activite',

    // ─── Backups par scénario (conservés) ──────────────────────────────────
    backup_sommeil:             'backup_sommeil',
    backup_weekend:             'backup_weekend',
    backup_animal:              'backup_animal',
    backup_panne:               'backup_panne',

    // ─── Backups pipeline Étape 1 ──────────────────────────────────────────
    backup_before_t1:               'backup_before_t1',
    backup_after_t1:                'backup_after_t1',
    backup_before_t1_verificateur:  'backup_before_t1_verificateur',  // ⭐ v10 (Décision n°10)
    backup_after_t1_verificateur:   'backup_after_t1_verificateur',   // ⭐ v10 (Décision n°10)
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

    // ─── Tentatives Mode 4 (Décision n°24) ─────────────────────────────────
    nombre_tentatives_etape1:       'nombre_tentatives_etape1',

    // ─── Validation humaine Mode 3 (Décision n°16) ─────────────────────────
    validation_humaine_action:      'validation_humaine_action',
    validation_humaine_motif:       'validation_humaine_motif',
    validation_humaine_date:        'validation_humaine_date',
    validation_humaine_etape1:      'validation_humaine_etape1',  // formula concaténée pour polling

    // ─── Communication candidat asynchrone (Décision n°33) ─────────────────
    date_T0:                        'date_T0',
    email_T0_envoye:                'email_T0_envoye',
    email_24h_envoye:               'email_24h_envoye',
    email_48h_envoye:               'email_48h_envoye',
    email_72h_envoye:               'email_72h_envoye',
    email_livraison_envoye:         'email_livraison_envoye'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // RESPONSES — réponses brutes du candidat (frontend)
  // ⚠ LECTURE SEULE pour le pipeline (D7 actée)
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
  // Écrit par : Agent T1 (5 appels par scénario)
  // Patché par : Agent T1 Vérificateur (Mode 2 = corrections directes)
  // Volume : 25 lignes par candidat
  //
  // ⚠️ v10 : champ `pilier_sortie` ABANDONNÉ (Décision n°5 — D-A)
  //         champ `corrections_certificateur` RENOMMÉ en `corrections_verificateur` (Décision n°10)
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T1_FIELDS: {
    // ─── Identité (8) ──────────────────────────────────────────────────────
    candidat_id:             'candidat_id',
    id_question:             'id_question',
    question_id_protocole:   'question_id_protocole',
    scenario:                'scenario',
    pilier_demande:          'pilier_demande',
    question_texte:          'question_texte',
    storytelling:            'storytelling',
    transition:              'transition',

    // ─── Réponse brute (1) ─────────────────────────────────────────────────
    verbatim_candidat:       'verbatim_candidat',

    // ─── Analyse cognitive de base (4) ─────────────────────────────────────
    v1_conforme:                    'v1_conforme',
    v2_traite_problematique:        'v2_traite_problematique',
    verbes_observes:                'verbes_observes',
    verbes_angles_piliers:          'verbes_angles_piliers',

    // ─── Grille à 3 niveaux v10.3 (5) — Décisions n°43 et n°46 ─────────────
    pilier_finalite:                'pilier_finalite',          // ⭐ v10.3 : niveau 1 (recopie pilier_demande)
    pilier_finalite_libelle:        'pilier_finalite_libelle',  // ⭐ v10.3 : nom officiel court
    pilier_coeur:                   'pilier_coeur',             // ⭐ v10.3 : niveau 2 (code court isolé)
    outil_cognitif_libelle:         'outil_cognitif_libelle',   // ⭐ v10.3 : libellé du filtre cognitif
    pilier_coeur_analyse:           'pilier_coeur_analyse',     // niveau 2 description
    piliers_traverses:              'piliers_traverses',        // ⭐ v10.3 : niveau 3 (codes courts)
    piliers_secondaires:            'piliers_secondaires',      // niveau 3 description

    // ─── Verbatim et finalité (3) ──────────────────────────────────────────
    types_verbatim:                 'types_verbatim',
    finalite_reponse:               'finalite_reponse',
    attribution_pilier_signal_brut: 'attribution_pilier_signal_brut',

    // ─── Verdict de conformité (3) ─────────────────────────────────────────
    conforme_ecart:                 'conforme_ecart',
    ecart_detail:                   'ecart_detail',
    signal_limbique:                'signal_limbique',

    // ─── ⭐ v10.4 — Doctrine v2 v3.3 (3 nouveaux champs) ──────────────────
    // Distinction A/B : répond à la question vs répond à la situation
    // (cf. doctrine v2 du 04/05/2026, prompt T1 v3.3)
    v2_repond_question:             'v2_repond_question',       // singleSelect OUI/NON
    v2_repond_situation:            'v2_repond_situation',      // singleSelect OUI_TRANSITION/OUI_STORYTELLING/OUI_SITUATION_CONSTRUITE/NON
    v2_analyse:                     'v2_analyse',               // multilineText (1-3 phrases justification)

    // ⛔ raisonnement : champ SUPPRIMÉ en v10.4.1 (Décision n°48 — 04/05/2026)
    //                   Audit a montré qu'il restait systématiquement vide.
    //                   À supprimer côté Airtable APRÈS déploiement v10.5.

    // ─── Trace vérificateur (1) — Décision n°10 ───────────────────────────
    corrections_verificateur:       'corrections_verificateur'
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // VERIFICATEUR_T1 — Audit du vérificateur T1 (11 colonnes)
  // ⭐ v10 — Nouvelle table (Décision n°10)
  // Écrit par : Agent T1 Vérificateur (1 ligne par exécution)
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
  // VALEURS AUTORISÉES (Single Select Airtable)
  // ═══════════════════════════════════════════════════════════════════════════
  ALLOWED_VALUES: {
    // VISITEUR
    statut_test:             ['en_cours', 'terminé'],
    // ⭐ v10.3 — Liste alignée avec Airtable réel (22 statuts) et Décision n°42
    // Convention Airtable (description du champ statut_analyse_pivar) :
    //   - MAJUSCULES = reprise manuelle (déposée par superviseur Isabelle)
    //   - en_cours / ERREUR = reprise auto par checkpoints (posée par le code)
    //   - terminé = bloqué (pipeline ne touche plus)
    //   - EN_ATTENTE_VALIDATION_HUMAINE = pause superviseur (Mode 4 uniquement — Décision n°39)
    statut_analyse_pivar:    [
      // Statuts génériques (10)
      'NOUVEAU',
      'en_cours',
      'terminé',
      'ERREUR',
      'EN_ATTENTE_VALIDATION_HUMAINE',     // Décision n°16 — uniquement Mode 4 depuis v1.9 (Décision n°39)
      'REPRENDRE_AGENT1',                  // Décisions n°16, n°24 — synonyme de REPRENDRE_T1_DES_SOMMEIL
      'REPRENDRE_VERIFICATEUR1',           // Décision n°16
      'REPRENDRE_AGENT2',
      'REPRENDRE_AGENT3',
      'REPRENDRE_AGENT4',                  // Reprise depuis T4 (4 sous-agents)
      'REPRENDRE_VERIFICATEUR4',           // Reprise depuis T4-Synthèse
      'SUSPENDU MANUELLEMENT',             // Pause manuelle déclenchée par superviseur
      // Famille A — relances ISOLÉES (5) — Décision n°42
      'REPRENDRE_T1_SOMMEIL_SEUL',
      'REPRENDRE_T1_WEEKEND_SEUL',
      'REPRENDRE_T1_ANIMAL1_SEUL',
      'REPRENDRE_T1_ANIMAL2_SEUL',
      'REPRENDRE_T1_PANNE_SEUL',
      // Famille B — relances en CASCADE (5) — Décision n°42
      'REPRENDRE_T1_DES_SOMMEIL',          // équivalent de REPRENDRE_AGENT1
      'REPRENDRE_T1_DES_WEEKEND',
      'REPRENDRE_T1_DES_ANIMAL1',
      'REPRENDRE_T1_DES_ANIMAL2',
      'REPRENDRE_T1_DES_PANNE'
    ],
    validation_humaine_action: [          // ⭐ v10 (Décision n°16)
      'RELANCER_AGENT_T1',
      'RELANCER_VERIFICATEUR_T1',
      'ACCEPTER_TEL_QUEL',
      'ABANDONNER'
    ],

    // ETAPE1_T1 / RESPONSES (pilier_sortie retiré — Décision n°5)
    pilier:                  ['P1', 'P2', 'P3', 'P4', 'P5'],
    scenario_nom:            ['SOMMEIL', 'WEEKEND', 'ANIMAL', 'PANNE'],
    scenario:                ['SOMMEIL', 'WEEKEND', 'ANIMAL', 'PANNE'],
    pilier_demande:          ['P1', 'P2', 'P3', 'P4', 'P5'],
    pilier_finalite:         ['P1', 'P2', 'P3', 'P4', 'P5'],          // ⭐ v10.3
    pilier_coeur:            ['P1', 'P2', 'P3', 'P4', 'P5'],          // ⭐ v10.3 (utilisé en T1 et T2)
    pilier_coeur_analyse:    ['P1', 'P2', 'P3', 'P4', 'P5'],
    conforme_ecart:          ['CONFORME', 'ÉCART'],                   // ⭐ v10.3 — accent É (alignement v1.9)
    // ⭐ v10.4 — Doctrine v2 v3.3 (3 nouveaux champs ETAPE1_T1)
    v1_conforme:                ['OUI', 'NON'],
    v2_traite_problematique:    ['OUI', 'NON'],
    v2_repond_question:         ['OUI', 'NON'],                       // ⭐ v10.4 — Question A
    v2_repond_situation:        ['OUI_TRANSITION', 'OUI_STORYTELLING', 'OUI_SITUATION_CONSTRUITE', 'NON'], // ⭐ v10.4 — Question B

    // VERIFICATEUR_T1
    verdict_global:          ['CONFORME', 'CORRECTION_REQUISE', 'BLOQUANT', 'INDETERMINE'],

    // ETAPE1_T2
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
