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
//
// PHASE v10.9 (2026-05-22) — Phase 3 enrichissement étape 2 (Algorithme A v1.1) :
//   - ⭐ NOUVELLE PHASE 3 ajoutée à l'étape 2 (sans toucher Phase 1 ni Phase 2).
//     Service responsable : agentT2_phase3_enrichissement_Service.js
//     Orchestration : orchestratorEtape2.js v10.9 (modes COMPLET / PHASE3_ISOLEE)
//
//   - ⭐ 14 NOUVEAUX CHAMPS dans ETAPE1_T1 (Algorithme A v1.1) :
//     • 4 champs synthèse :
//        nb_activations_coeur                     : fldl8GiYTgbGONdnN (number)
//        detail_circuits_coeur                    : fld2V54ixKpAPyMor (longText)
//        detail_circuits_instrumentaux            : fldiA0hLr3LrUbQNC (longText)
//        nb_activations_par_pilier_instrumental   : fldyqI3ja6iwBRg8w (singleLineText)
//     • 10 champs décomposés par pilier instrumental (5 nb + 5 detail) :
//        nb_P1_instru     : fldREMZRIzqUrcQui (number)
//        nb_P2_instru     : fldYrLUW55qLP9CYy (number)
//        nb_P3_instru     : fldsEyNl33eGGSdSe (number)
//        nb_P4_instru     : fldhIklhv8wHPYS9L (number)
//        nb_P5_instru     : fldQ32LUzRpPE0m9M (number)
//        detail_P1_instru : fldnnnF54QlK59gjd (multilineText)
//        detail_P2_instru : fldAHU1Ueidrk7bIN (multilineText)
//        detail_P3_instru : fldNiXqOwSrAnu6Gc (multilineText)
//        detail_P4_instru : fldijxZse0h1Wdvwb (multilineText)
//        detail_P5_instru : fldSNPj12xDhgnxiM (multilineText)
//
//   - ⭐ 2 NOUVELLES TABLES créées (persistance des 2 tableaux d'analyse) :
//
//     1) ETAPE1_T2_VENTILATION_PILIERS  (tableId : tbl4UzvAMQY4nRnI5)
//        Granularité : 1 ligne par (candidat × pilier_coeur), max 5 par candidat
//        21 colonnes documentées dans ETAPE1_T2_VENTILATION_PILIERS_FIELDS
//
//     2) ETAPE1_T2_INVENTAIRE_CIRCUITS  (tableId : tblUHZjXIW9jp9nIf)
//        Granularité : 1 ligne par (candidat × circuit distinct), ~30-60 par candidat
//        15 colonnes documentées dans ETAPE1_T2_INVENTAIRE_CIRCUITS_FIELDS
//
//   - ⭐ 2 NOUVEAUX STATUTS ajoutés dans ALLOWED_VALUES.statut_analyse_pivar :
//        REPRENDRE_AGENT2_PHASE3   : déclenche orchestratorEtape2 en mode PHASE3_ISOLEE
//        ETAPE2_PHASE2_TERMINEE    : sentinelle Phase 1+2 OK / Phase 3 KO (Phase 3 rejouable)
//
//   - ⚠️ ACTION MANUELLE REQUISE POUR LE DÉPLOIEMENT :
//     Les 2 nouvelles valeurs de statut_analyse_pivar doivent être ajoutées
//     dans le singleSelect Airtable VISITEUR.statut_analyse_pivar (UI Airtable),
//     sinon les écritures de statut échoueront.

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

    // ─── ⭐ v10.9 (22/05/2026) — Tables Phase 3 (visualisation persistée) ────
    // Données dérivées de l'étape 2 Phase 3 (Algorithme A v1.1).
    // Calculées mécaniquement par agentT2_phase3_enrichissement_Service.
    // Lues par les routes /visualiser/tableau2piliers et /visualiser/tableau2circuits.
    ETAPE1_T2_VENTILATION_PILIERS: 'ETAPE1_T2_VENTILATION_PILIERS',  // 1 ligne / candidat × pilier_coeur
    ETAPE1_T2_INVENTAIRE_CIRCUITS: 'ETAPE1_T2_INVENTAIRE_CIRCUITS',  // 1 ligne / candidat × circuit distinct

    // ─── ⭐ v11.0 (28/05/2026) — Étape 3 : le bilan (3 tables) ──────────────
    // L'architecture du bilan (= étape1_t3) repose sur 3 tables dédiées,
    // écrites par agentT3BilanService et lues par /visualiser/t3_bilan/.
    //   - ETAPE1_T3_PILIER  (5 lignes/candidat)   — sections piliers + pilier_mode
    //   - ETAPE1_T3_CIRCUIT (~47 lignes/candidat) — circuits détaillés + ADHOC
    //   - ETAPE1_T3_BILAN   (1 ligne/candidat)    — sections transverses (soleil,
    //                                                filtre, glissements, boucles, signature)
    ETAPE1_T3_PILIER:              'ETAPE1_T3_PILIER',              // tblzDIn7P2cOvVvY2
    ETAPE1_T3_CIRCUIT:             'ETAPE1_T3_CIRCUIT',
    ETAPE1_T3_BILAN:               'ETAPE1_T3_BILAN',

    // ─── Référentiels stables ──────────────────────────────────────────────
    REFERENTIEL_LEXIQUE:           'REFERENTIEL_LEXIQUE',
    REFERENTIEL_PILIERS:           'REFERENTIEL_PILIERS',
    REFERENTIEL_PROFILS:           'REFERENTIEL_PROFILS',
    REFERENTIEL_CIRCUITS:          'REFERENTIEL_CIRCUITS',
    REFERENTIEL_CIRCUITS_CANDIDATS: 'REFERENTIEL_CIRCUITS_CANDIDATS'  // ⭐ v10.8 (21/05/2026) — table manquante de la config, référencée par airtableService.getCircuitsAdHocByStatut / upsertCircuitAdHoc
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
    corrections_verificateur:       'corrections_verificateur',

    // ─── ⭐ v10.9 (22/05/2026) — Phase 3 enrichissement (Algorithme A v1.1) ──
    // 14 champs calculés mécaniquement par agentT2_phase3_enrichissement_Service
    // à partir de pilier_coeur + types_verbatim_circuits.
    // Lus par les routes de visualisation /visualiser/tableau2piliers et /tableau2circuits.
    //
    // 4 champs synthèse :
    nb_activations_coeur:                     'nb_activations_coeur',                     // number — nb attributions du pilier cœur
    detail_circuits_coeur:                    'detail_circuits_coeur',                    // longText — liste séquentielle séparée par /
    detail_circuits_instrumentaux:            'detail_circuits_instrumentaux',            // longText — / intra-pilier, " + " inter-piliers
    nb_activations_par_pilier_instrumental:   'nb_activations_par_pilier_instrumental',   // singleLineText — synthèse "P1:2/P5:2"
    //
    // 10 champs décomposés par pilier instrumental (5 nb + 5 detail) :
    //   Par construction : nb_P{N}_instru = 0 et detail_P{N}_instru = "" quand P{N} == pilier_coeur
    //   (un circuit ne peut pas être en service de son propre pilier — il serait alors cœur).
    nb_P1_instru:      'nb_P1_instru',      // number
    nb_P2_instru:      'nb_P2_instru',      // number
    nb_P3_instru:      'nb_P3_instru',      // number
    nb_P4_instru:      'nb_P4_instru',      // number
    nb_P5_instru:      'nb_P5_instru',      // number
    detail_P1_instru:  'detail_P1_instru',  // multilineText
    detail_P2_instru:  'detail_P2_instru',  // multilineText
    detail_P3_instru:  'detail_P3_instru',  // multilineText
    detail_P4_instru:  'detail_P4_instru',  // multilineText
    detail_P5_instru:  'detail_P5_instru'   // multilineText
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
  // ⭐ v10.9 (22/05/2026) — ETAPE1_T2_VENTILATION_PILIERS — Tableau 1 (21 colonnes)
  // Écrit par : agentT2_phase3_enrichissement_Service (Phase 3 étape 2)
  // Lue par : route /visualiser/tableau2piliers/:candidat_id (mode JSON)
  // Pattern d'écriture : delete + create atomique par candidat_id
  // Granularité : 1 ligne par (candidat × pilier_coeur), max 5 par candidat
  // tableId : tbl4UzvAMQY4nRnI5
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T2_VENTILATION_PILIERS_FIELDS: {
    // ─── Identité (2) ──────────────────────────────────────────────────────
    candidat_id:                  'candidat_id',                  // fldElNhexmTf6w73F
    session_ID:                   'session_ID',                   // fldMEeJLkjVaYxbCR

    // ─── Pilier cœur du bloc (3) ───────────────────────────────────────────
    pilier_coeur:                 'pilier_coeur',                 // fldDzu3P3ryAT5eTt (singleSelect P1-P5)
    pilier_coeur_libelle:         'pilier_coeur_libelle',         // fldQAWYnjCOTFWBGQ
    rang_par_frequence:           'rang_par_frequence',           // fldZqTLiapVQSznq0 (number)

    // ─── Compteurs globaux du bloc (4) ─────────────────────────────────────
    nb_reponses:                  'nb_reponses',                  // fldJZFcOK2bwlyM47 (number)
    pct_reponses:                 'pct_reponses',                 // fldSG0wK5sTaENxGZ (number, 0-100)
    nb_activations_coeur_total:   'nb_activations_coeur_total',   // flddntGV77W5qGzeH (number)
    nb_activations_instru_total:  'nb_activations_instru_total',  // fld8UKT1TsJo3Bnw2 (number)

    // ─── Ventilation détaillée — cœur + 5 piliers instrumentaux (6) ────────
    // Format : "P3C12(11) · P3C10(11) · P3C4(5) · ..." (tri par occurrence décroissante)
    ventilation_circuits_coeur:   'ventilation_circuits_coeur',   // fld9JryA4ElBgVs7P
    ventilation_P1_instru:        'ventilation_P1_instru',        // fldClXcEXZaKRfLMm
    ventilation_P2_instru:        'ventilation_P2_instru',        // fld8EBNHIAqtb3wUj
    ventilation_P3_instru:        'ventilation_P3_instru',        // fldWwLgex6bg86ObP
    ventilation_P4_instru:        'ventilation_P4_instru',        // fldAM2FdMItfIOXDO
    ventilation_P5_instru:        'ventilation_P5_instru',        // fld8C6k6451r2psZd

    // ─── Compteurs par pilier instrumental (5) ─────────────────────────────
    // nb_P{N}_instru_total = 0 par construction quand P{N} == pilier_coeur du bloc
    nb_P1_instru_total:           'nb_P1_instru_total',           // fldSRhNuuV0xQOyfO
    nb_P2_instru_total:           'nb_P2_instru_total',           // fldy0W12fOkasKOhJ
    nb_P3_instru_total:           'nb_P3_instru_total',           // fldo9QMZ1o4NjtyRq
    nb_P4_instru_total:           'nb_P4_instru_total',           // fld8G1aMlYcLRNLLc
    nb_P5_instru_total:           'nb_P5_instru_total',           // fldbsVPd3DxIy0Slv

    // ─── Traçabilité (1) ───────────────────────────────────────────────────
    liste_id_questions:           'liste_id_questions'            // fld4ujaBtKaad5Utz (ex: "P3Q1, P3Q5, P3Q8")
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ v10.9 (22/05/2026) — ETAPE1_T2_INVENTAIRE_CIRCUITS — Tableau 2 (15 colonnes)
  // Écrit par : agentT2_phase3_enrichissement_Service (Phase 3 étape 2)
  // Lue par : route /visualiser/tableau2circuits/:candidat_id (mode JSON)
  // Pattern d'écriture : delete + create atomique par candidat_id
  // Granularité : 1 ligne par (candidat × circuit distinct), ~30-60 par candidat
  // tableId : tblUHZjXIW9jp9nIf
  //
  // Convention sémantique :
  //   - Un circuit P{X}C{Y} appartient au pilier P{X}.
  //   - nb_coeur = occurrences où le pilier_coeur de la ligne T1 = pilier_owner du circuit.
  //   - nb_svc_P{Z} = occurrences où pilier_coeur de la ligne T1 = P{Z} ET pilier_owner ≠ P{Z}.
  //   - Par construction : nb_svc_P{X} = 0 pour un circuit dont pilier_owner = P{X}.
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T2_INVENTAIRE_CIRCUITS_FIELDS: {
    // ─── Identité (2) ──────────────────────────────────────────────────────
    candidat_id:         'candidat_id',         // fldBdSBJUBvLHYPdo
    session_ID:          'session_ID',          // fldWInB63lYApVz8G

    // ─── Identité du circuit (5) ───────────────────────────────────────────
    circuit_label:       'circuit_label',       // fldjbr1Ej7Dosb6S6 — "P1C15" ou "P5·ADHOC \"...\""
    pilier_owner:        'pilier_owner',        // fldSudlYoCeU2cOqz (singleSelect P1-P5)
    circuit_id:          'circuit_id',          // fldPF1xvYiONGiOAA — "C15", "C12" ou "ADHOC"
    circuit_origine:     'circuit_origine',     // fld0SuUut21rToKbj (singleSelect OFFICIEL/AD_HOC)
    nom_ad_hoc:          'nom_ad_hoc',          // fldN23mYABvdVE1ok — nom complet ad hoc (vide si officiel)

    // ─── Compteurs (7) ─────────────────────────────────────────────────────
    nb_coeur:            'nb_coeur',            // fld8nEBQqdLqQqe1b
    nb_svc_P1:           'nb_svc_P1',           // fldUFMnbQl8NJAwgl
    nb_svc_P2:           'nb_svc_P2',           // fldGyYvWzGiY9jlXb
    nb_svc_P3:           'nb_svc_P3',           // fldQbwuHBRywn2rzp
    nb_svc_P4:           'nb_svc_P4',           // fldgAjStrMoLleMbA
    nb_svc_P5:           'nb_svc_P5',           // fldBo3HMIhu5Fpn77
    total_activations:   'total_activations',   // fldzV8udGk3eQ58No

    // ─── Tri (1) ───────────────────────────────────────────────────────────
    rang_dans_pilier:    'rang_dans_pilier'     // fld76259zIzR6XVRB
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
  // ⭐ v11.0 (28/05/2026) — ETAPE1_T3_PILIER — Sections piliers du bilan
  // Écrit par : agentT3BilanService (appels 1-5, un par pilier)
  // Lue par   : route /visualiser/t3_bilan/:candidat_id (assemblage payload)
  // Granularité : 5 lignes par candidat (socle → str1 → str2 → fn1 → fn2)
  // tableId : tblzDIn7P2cOvVvY2
  // ⚠️ Clé candidat = champ "candidat_id" (minuscule, sans 'e' contrairement à VISITEUR).
  // Schéma vérifié via list_tables_for_base le 28/05/2026.
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T3_PILIER_FIELDS: {
    candidat_id:            'fldZKruIBDdjAsY47',  // texte "pivar_..." (clé candidat)
    bilan_link:             'fld4vR7DGcEVCzz32',  // linked → ETAPE1_T3_BILAN (récupère recordId BILAN)
    cle_composite:          'fldiL5nkdk50zFwkX',  // "{cid}_P{N}" (primaire, alias pilier_uid)
    pilier:                 'fldVvi5gbKioBmlsQ',  // singleSelect P1-P5
    pilier_label:           'fldbDYECHFEGkh0Ng',  // "Création de solutions", "Tri", ...
    role_pilier:            'fldhFisqhUf9oBLOe',  // singleSelect socle/structurant_1/2/fonctionnel_1/2
    pilier_role_label:      'fld1X3FQYRcxB2Qwy',  // "★ Pilier socle — Cœur de votre moteur"
    pilier_mode:            'fldoGY71vyiaUeFl6',  // ⭐ DOCTRINE PILIER_MODE
    pilier_rappel:          'fld6qIK9UOZPAE59k',  // tétière "Sortie 9/25 · Signal ... · X activations · Y circuits · Z HAUT"
    nb_activations:         'fldg5DCdL9U523YfG',  // number — échelle TOTALE
    nb_circuits_actifs:     'fldtUV0KYT0zyjg0J',  // number
    nb_circuits_haut:       'fldUmfMvtMEsADKFX',  // number
    cluster_label:          'fldfpEzRkoHqXHmJ2',  // "C4+C9" (vide si aucun)
    cluster_detail:         'fldNbdQTQFrL9MmLv',  // texte long
    tableau_note:           'fldKax0VwI4BhnLKV',  // tableau récap doctrine §2.12
    synth_factuelle:        'fldcGtODAh6b0vZs5',  // synthèse factuelle (élargie/détaillée)
    synth_interpretee:      'fldho6MPGr5J5QmPu',  // ⭐ "Ce que ça signifie pour vous" + § DRH
    liens_circuits:         'fldtZdnuftdhGx2mb'   // linked → ETAPE1_T3_CIRCUIT du pilier
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ v11.0 (28/05/2026) — ETAPE1_T3_CIRCUIT — Circuits détaillés du bilan
  // Écrit par : agentT3BilanService (circuits[] de chaque appel pilier)
  // Granularité : ~47 lignes par candidat (1 par circuit actif + ADHOC)
  // ⚠️ Clé candidat = champ "candidat_id" (sans 'e')
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T3_CIRCUIT_FIELDS: {
    circuit_uid:         'fldeaMdgx3WVWgxgv',  // "{cid}_P{N}_C{M}" ou "..._P5_ADHOC" (primaire)
    bilan_link:          'fldUewcuNizHi3NrW',  // linked → ETAPE1_T3_BILAN (récupère recordId BILAN)
    pilier_link:         'fldPpfFtaCh9wI9IQ',  // linked → ETAPE1_T3_PILIER parent
    candidat_id:         'fldpQzPEvlNaRXFgg',  // texte (clé candidat)
    pilier:              'fld74EvZRf7r4biGh',  // singleSelect P1-P5
    circuit_id:          'fldrnHJtNOWWYJ91t',  // "C4", "C7", "ADHOC"
    circuit_nom:         'fldSGRXf8mi4q1NTd',  // nom catalogue
    circuit_freq:        'fldrM33rxdYnJ39vz',  // number — nb total d'activations cœur
    circuit_franches:    'fldwfbNZ0DKsdXray',  // number — nb activations franches
    circuit_nuancees:    'fldDnY9fRw3g62C6o',  // number — nb activations nuancées
    circuit_cluster:     'fldGzHp6ZFEsiIERf',  // "C4+C7" (vide si aucun)
    circuit_signal:      'fldVsySoS1k0yFHgx',  // singleSelect NULLE/FAIBLE positif/...
    circuit_niveau:      'fld0LTPI1KfAVHRqI',  // singleSelect HAUT/MOYEN/FAIBLE
    n1_definition:       'fldKKSpL02oLC8Gwn',  // définition catalogue générique
    n2_verbatims:        'fldV3EBlHGUleiifK',  // manifestation candidat + séquence T1
    n3_nuance:           'fldSx0VOHYILowFSj',  // "Chez vous, ce circuit..."
    ordre_pilier:        'fldSK79cCYsuICAAy',  // number 1=socle, 2=str1, 3=str2, 4=fn1, 5=fn2
    ordre_circuit:       'fld5SPJJXdv9Bo6vT',  // number — rang dans le pilier
    // ⭐ Ventilation (les colonnes existaient déjà ; leurs field IDs manquaient ici → en_svc jamais écrits).
    en_svc_P1:           'fldoGZPSxM22pk82R',  // number — activations en service de P1
    en_svc_P2:           'fldAgQzO8YgqbzUEe',  // number — en service de P2
    en_svc_P3:           'fld56OTFNSTo7OGAE',  // number — en service de P3
    en_svc_P4:           'fldJ76jeasA2KVmdY',  // number — en service de P4
    en_svc_P5:           'fldqMhYYHMy7b2s1n',  // number — en service de P5
    total_activations:   'fldnFNJm6GP0mAGNm'   // number — total = cœur + somme(en_svc)
  },

  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ v11.0 (28/05/2026) — ETAPE1_T3_BILAN — Sections transverses du bilan
  // Écrit par : agentT3BilanService (appels 0 et 0bis)
  // Lue par   : route /visualiser/t3_bilan/:candidat_id
  // Granularité : 1 ligne par candidat. Table large (~100 champs).
  // ⚠️ Clé candidat = champ "candidat_id" (sans 'e')
  // Mapping des champs utilisés par le template v5.5. Les champs non encore mappés
  // (preuves filtre détaillées, items signal, coûts) seront complétés après lecture
  // exhaustive du schéma — non bloquant pour la visualisation des champs principaux.
  // ═══════════════════════════════════════════════════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ v11.1 (29/05/2026) — ETAPE1_T3_BILAN_FIELDS — RÉÉCRITURE COMPLÈTE
  // Tous les noms et field IDs vérifiés via list_tables_for_base (Airtable schéma).
  // La précédente version inventait des noms et mappait plusieurs field IDs sur
  // les MAUVAISES clés (ex: fldZQPfKAJu0cPvLJ étiqueté "signature_finalite" alors
  // que c'est en réalité cout3_titre). Tout est restauré ici sur le vrai schéma.
  // tableId : tblv775KQrEhsogdI
  // ═══════════════════════════════════════════════════════════════════════════
  ETAPE1_T3_BILAN_FIELDS: {
    // ── Identité ──
    candidat_id:               'fldk66gddYGCREOV4',
    civilite:                  'fld8yjgv2jIp2dzvW',
    prenom:                    'fldFjVTaedAE8iXkU',
    nom:                       'fldsOkyWddI15pqgU',
    version_bilan:             'fldBlTX1Fuiv81mRc',

    // ── §01 Architecture moteur (21 champs) ──
    pilier_socle:              'fldfJHsX7A38IYele',  // singleSelect P1-P5
    pilier_socle_label:        'fldUf6rhEyR3MKI1x',
    pilier_socle_mode:         'fldLt4GhtqRUyl7V4',
    pilier_socle_role:         'fldBMHWSk6DsnRN2i',  // "★ Pilier socle"
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

    // ── §02 Filtre cognitif (7 champs) ──
    filtre_label:              'fld6KItM77nOSojnf',
    filtre_preuve_1:           'fldFPhv8r1PtQpzN0',
    filtre_preuve_2:           'fldRCUSIQ8sbx4rM4',
    filtre_preuve_3:           'fldKeQsg0PvyQTOWx',
    filtre_preuve_4:           'fldSEckaqiK0jKXuZ',
    filtre_preuve_5:           'fldgq35VLCUvSa0uu',
    filtre_lecture_candidat:   'fldQlgWGaPg49Xlnv',

    // ── §03 Glissements (14 champs : intro + 4×(label/titre/corps) + conclusion) ──
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

    // ── §04 Boucles cognitives (16 champs : intro + 3×(label/scenario/reponse/sequence/labo)) ──
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

    // ── §05 Signal limbique (15 champs : type + intro + 4×(q/corps/verbatim) + synthese) ──
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

    // ── §06 Coûts (12 champs : 3 × (niveau/titre/corps/verbatim)) ──
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

    // ── §07 Signature (6 champs) ──
    sig_pilier_label:          'fld1PZRqPxejsYc0Z',
    sig_filtre_val:            'fld6uiqUpCtWHfWYf',
    sig_finalite:              'fldxNmTAxP5FkqYWz',
    sig_resultat_ligne1:       'fldR2LjSEpCvbS0Uy',
    sig_resultat_ligne2:       'fldYlaGZTAewseLgK',
    sig_recit:                 'fldiGDaUJ4cO0c0zI',

    // ── Linked records ──
    liens_piliers:             'fld0i2Xr5A07KJZOC',  // linked → 5 ETAPE1_T3_PILIER
    liens_circuits:            'fld8F9KkASvL3Gqet'   // linked → tous les ETAPE1_T3_CIRCUIT
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
      // ⭐ v10.8 (21/05/2026) — Refonte étape 2 en 2 phases (Phase 1 attribution + Phase 2 consolidation)
      'REPRENDRE_AGENT2_PHASE1',           // Mode PHASE1_ISOLEE (attribution seule)
      'REPRENDRE_AGENT2_PHASE2',           // Mode PHASE2_ISOLEE (consolidation seule, coût zéro)
      'ETAPE2_PHASE1_TERMINEE',            // Sentinelle : Phase 1 OK (avec ou sans Phase 2 KO)
      // ⭐ v10.9 (22/05/2026) — Phase 3 enrichissement Algorithme A v1.1
      'REPRENDRE_AGENT2_PHASE3',           // Mode PHASE3_ISOLEE (enrichissement seul, coût zéro)
      'ETAPE2_PHASE2_TERMINEE',            // Sentinelle : Phase 1+2 OK, Phase 3 KO (rejouable via REPRENDRE_AGENT2_PHASE3)
      'ETAPE2_TERMINEE',                   // Sentinelle : étape 2 complète terminée (tant que étape 3 non prête)
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
