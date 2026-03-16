// config/airtable.js
// Configuration Airtable - Mapping EXACT des tables et champs
// ✅ VERSION 7.0 - Ajout analyse_json_agent1 et analyse_json_agent2

module.exports = {
  // Base Airtable
  BASE_ID: process.env.AIRTABLE_BASE_ID,
  TOKEN: process.env.AIRTABLE_TOKEN,
  
  // Tables
  TABLES: {
    VISITEUR: 'VISITEUR',
    RESPONSES: 'RESPONSES',
    BILAN: 'BILAN'
    // GLOBAL: 'GLOBAL' // ⚠️ À confirmer si cette table existe
  },
  
  // Champs VISITEUR
  VISITEUR_FIELDS: {
    candidate_ID: 'candidate_ID',
    Prenom: 'Prenom',
    Nom: 'Nom',
    Email: 'Email',
    statut_test: 'statut_test',
    derniere_question_repondue: 'derniere_question_repondue',
    statut_analyse_pivar: 'statut_analyse_pivar',
    erreur_analyse: 'erreur_analyse',
    derniere_activite: 'derniere_activite',
    
    // Backup par scénario
    backup_sommeil: 'backup_sommeil',
    backup_weekend: 'backup_weekend',
    backup_animal: 'backup_animal',
    backup_panne: 'backup_panne'
  },
  
  // Champs RESPONSES
  RESPONSES_FIELDS: {
    // Identifiants
    session_ID: 'session_ID',
    id_question: 'id_question',
    numero_global: 'numero_global',
    pilier: 'pilier',
    scenario_nom: 'scenario_nom',
    question_text: 'question_text',
    response_text: 'response_text',
    Prenom: 'Prenom',
    Nom: 'Nom',
    Email: 'Email',
    statut_reponse: 'statut_reponse',
    
    // ═══════════════════════════════════════════════════════════════════════
    // ✅ V7.0 - NOUVEAUX CHAMPS JSON SÉPARÉS
    // ═══════════════════════════════════════════════════════════════════════
    analyse_json_agent1: 'analyse_json_agent1',  // ✅ NOUVEAU - Agent 1
    analyse_json_agent2: 'analyse_json_agent2',  // ✅ NOUVEAU - Agent 2
    
    // ═══════════════════════════════════════════════════════════════════════
    // ANCIEN CHAMP (gardé pour migration progressive)
    // ═══════════════════════════════════════════════════════════════════════
    analyse_json_pivar: 'analyse_json_pivar',  // ⚠️ ANCIEN - Peut être supprimé après migration
    
    // ═══════════════════════════════════════════════════════════════════════
    // Agent 1 - Champs extraits
    // ═══════════════════════════════════════════════════════════════════════
    nombre_mots_reponse: 'nombre_mots_reponse',
    niveau_sophistication: 'niveau_sophistication',
    laconique: 'laconique',
    dimensions_simples: 'dimensions_simples',
    dimensions_sophistiquee: 'dimensions_sophistiquee', // ⚠️ SINGULIER dans Airtable
    liste_dimensions_simples: 'liste_dimensions_simples',  // ✅ V7.0 - Ajouté
    liste_dimensions_sophistiquees: 'liste_dimensions_sophistiquees',  // ✅ V7.0 - Ajouté
    anticipation_spontanee: 'anticipation_spontanee',
    decentration_cognitive: 'decentration_cognitive',
    meta_cognition: 'meta_cognition',
    angles_morts: 'angles_morts',
    nombre_criteres_details: 'nombre_criteres_details',  // ✅ V7.0 - Utilisé par Agent 2 aussi
    
    // ═══════════════════════════════════════════════════════════════════════
    // Agent 2 - Champs extraits
    // ═══════════════════════════════════════════════════════════════════════
    boucles_detectees: 'boucles_detectees',
    nombre_boucles: 'nombre_boucles',
    limbique_detecte: 'limbique_detecte',
    limbique_intensite: 'limbique_intensite',
    limbique_detail: 'limbique_detail',
    profiling_qualifie: 'profiling_qualifie',
    circuits_actives: 'circuits_actives',
    statut_analyse_reponses: 'statut_analyse_reponses',
    question_analysée: 'question_analysée',
    
    // ═══════════════════════════════════════════════════════════════════════
    // Algorithme - Champs calculés
    // ═══════════════════════════════════════════════════════════════════════
    score_question: 'score_question',
    coefficient_reponse: 'coefficient_reponse',
    question_scoree: 'question_scoree'
  },
  
  // Champs BILAN
  BILAN_FIELDS: {
    // Identifiants
    bilan_ID: 'bilan_ID',
    session_ID: 'session_ID',
    
    // Scores globaux
    score_moyen_global: 'score_moyen_global',
    niveau_moyen_global: 'niveau_moyen_global',
    nom_niveau_global: 'nom_niveau_global',
    zone_pivar: 'zone_pivar',
    
    // Scores par pilier
    score_pilier_P1: 'score_pilier_P1',
    score_pilier_P2: 'score_pilier_P2',
    score_pilier_P3: 'score_pilier_P3',
    score_pilier_P4: 'score_pilier_P4',
    score_pilier_P5: 'score_pilier_P5',
    niveau_score_pilier_P1: 'niveau_score_pilier_P1',
    niveau_score_pilier_P2: 'niveau_score_pilier_P2',
    niveau_score_pilier_P3: 'niveau_score_pilier_P3',
    niveau_score_pilier_P4: 'niveau_score_pilier_P4',
    niveau_score_pilier_P5: 'niveau_score_pilier_P5',
    
    // Piliers dominants
    pilier_dominant: 'pilier_dominant',
    pilier_structurant: 'pilier_structurant',
    piliers_moteurs: 'piliers_moteurs',
    
    // Boucles par pilier
    boucles_detectees_pilier_P1: 'boucles_detectees_pilier_P1',
    boucles_detectees_pilier_P2: 'boucles_detectees_pilier_P2',
    boucles_detectees_pilier_P3: 'boucles_detectees_pilier_P3',
    boucles_detectees_pilier_P4: 'boucles_detectees_pilier_P4',
    boucles_detectees_pilier_P5: 'boucles_detectees_pilier_P5',
    nombre_boucles_totales: 'nombre_boucles_totales',
    
    // Métriques
    dimensions_superieures_liste: 'dimensions_superieures_liste',
    dimensions_superieures_count: 'dimensions_superieures_count',
    nombre_marqueurs_limbiques: 'nombre_marqueurs_limbiques',
    interferences_limbiques_globales: 'interferences_limbiques_globales',
    
    // Compteurs
    nombre_reponses_scorees: 'nombre_reponses_scorees',
    nombre_reponses_analysees: 'nombre_reponses_analysees',
    nombre_reponses_analysees_P1: 'nombre_reponses_analysees_P1',
    nombre_reponses_analysees_P2: 'nombre_reponses_analysees_P2',
    nombre_reponses_analysees_P3: 'nombre_reponses_analysees_P3',
    nombre_reponses_analysees_P4: 'nombre_reponses_analysees_P4',
    nombre_reponses_analysees_P5: 'nombre_reponses_analysees_P5',
    
    // Certificateur (36 champs)
    type_pivar: 'type_pivar',
    niveau_pivar: 'niveau_pivar',
    nom_niveau_pivar: 'nom_niveau_pivar',
    definition_type_pivar: 'definition_type_pivar',
    profil_personnalise: 'profil_personnalise',
    boucle_cognitive_ordre: 'boucle_cognitive_ordre',
    section_pilier_P1: 'section_pilier_P1',
    section_pilier_P2: 'section_pilier_P2',
    section_pilier_P3: 'section_pilier_P3',
    section_pilier_P4: 'section_pilier_P4',
    section_pilier_P5: 'section_pilier_P5',
    section_signature_excellence: 'section_signature_excellence',
    mantra_profil: 'mantra_profil',
    section_vigilance_limbique: 'section_vigilance_limbique',
    points_vigilance_complet: 'points_vigilance_complet',
    rapport_markdown_complet: 'rapport_markdown_complet',
    rapport_html_final: 'rapport_html_final',
    synthese_json_complete: 'synthese_json_complete',
    statut_certification: 'statut_certification',
    profil_laconique: 'profil_laconique',
    notes_certificateur: 'notes_certificateur',
    date_generation: 'date_generation'
  },
  
  // Valeurs autorisées
  ALLOWED_VALUES: {
    statut_test: ['en_cours', 'terminé'],
    statut_analyse_pivar: ['NOUVEAU', 'en_cours', 'terminé', 'ERREUR'],
    pilier: ['P1', 'P2', 'P3', 'P4', 'P5'],
    scenario_nom: ['SOMMEIL', 'WEEKEND', 'ANIMAL', 'PANNE'],
    niveau_sophistication: ['faible', 'moyen', 'élevé'],
    limbique_intensite: ['aucune', 'faible', 'modéré', 'forte'], // ⚠️ "modéré" pas "modérée"
    statut_analyse_reponses: ['en_attente', 'analyse_ok', 'erreur'],
    zone_pivar: ['Exécution', 'Opérationnelle', 'Stratégique']
  },
  
  // Mapping pour corriger valeurs
  VALUE_MAPPING: {
    limbique_intensite: {
      'modérée': 'modéré',
      'moderee': 'modéré',
      'aucune': 'aucune',
      'faible': 'faible',
      'forte': 'forte'
    }
  }
};
