// services/certificateurService.js
// Certificateur v1.0 — Pipeline 3 prompts séquentiels
//
// Architecture :
//   Prompt 1 → Portraits piliers + Excellences (etape_1_arbitrage_fond)
//   Prompt 2 → Énigme profil + Diagnostics    (etape_2_lecture_algo + etape_3_diagnostics)
//   Prompt 3 → Livrables candidat              (rapport_markdown_complet + sections)
//
// Chaque prompt reçoit uniquement la matière indispensable à sa mission.
// Le Prompt 2 reçoit le JSON intermédiaire du Prompt 1.
// Le Prompt 3 reçoit les JSON intermédiaires des Prompts 1 et 2.
//
// Règle absolue : l'Algorithme ne transmet JAMAIS ses scores de classement
// au Certificateur — le Certificateur résout l'énigme depuis la matière brute.

'use strict';

const fs   = require('fs').promises;
const path = require('path');
const claudeService  = require('./claudeService');
const airtableService = require('./airtableService');
const logger = require('../utils/logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// ─── Cache prompts ───────────────────────────────────────────────────────────
let cachedPrompt1 = null;
let cachedPrompt2 = null;
let cachedPrompt3 = null;

// ─── Constantes ──────────────────────────────────────────────────────────────

const NOM_PILIERS = {
  P1: 'COLLECTE',
  P2: 'TRI',
  P3: 'ANALYSE',
  P4: 'SOLUTIONS',
  P5: 'EXECUTION'
};

const EXCELLENCE_KEYS = ['anticipation', 'decentration', 'metacognition', 'vue_systemique'];

const SCENARIOS = ['SOMMEIL', 'WEEKEND', 'ANIMAL', 'PANNE'];

// Champs singleSelect BILAN — normalisés avant écriture Airtable
const SINGLE_SELECT_BILAN = [
  'anticipation_niveau', 'decentration_niveau', 'metacognition_niveau', 'vue_systemique_niveau',
  'anticipation_pattern', 'decentration_pattern', 'metacognition_pattern', 'vue_systemique_pattern',
  'excellence_dominante', 'excellence_secondaire',
  'pilier_dominant_certif', 'pilier_structurant_certif', 'pilier_structurant2_certif',
  'type_profil_cognitif', 'nom_niveau_profil_cognitif', 'zone_profil_cognitif',
  'encadrement_verdict', 'management_verdict',
  'statut_certification'
];

// Mapping noms variants → clés normalisées pour les excellences
const EXCELLENCE_MAPPING = {
  'anticipation_spontanee': 'anticipation',
  'anticipation spontanée': 'anticipation',
  'anticipation':           'anticipation',
  'decentration_cognitive': 'decentration',
  'décentration_cognitive': 'decentration',
  'décentration cognitive': 'decentration',
  'decentration':           'decentration',
  'décentration':           'decentration',
  'meta_cognition':         'metacognition',
  'méta_cognition':         'metacognition',
  'métacognition':          'metacognition',
  'metacognition':          'metacognition',
  'vue_systemique':         'vue_systemique',
  'vue systémique':         'vue_systemique',
  'vision_systemique':      'vue_systemique',
  'vision systémique':      'vue_systemique'
};

const PATTERN_VALUES = ['systématique', 'contextuel', 'situationnel'];

const CHAMPS_PROMPT1 = [
  'profil_coché_P1', 'profil_coché_P2', 'profil_coché_P3', 'profil_coché_P4', 'profil_coché_P5',
  'P1_simples_synthese', 'P1_sophistiquees_synthese',
  'P2_simples_synthese', 'P2_sophistiquees_synthese',
  'P3_simples_synthese', 'P3_sophistiquees_synthese',
  'P4_simples_synthese', 'P4_sophistiquees_synthese',
  'P5_simples_synthese', 'P5_sophistiquees_synthese',
  'anticipation_niveau', 'anticipation_pattern', 'anticipation_declencheur',
  'anticipation_synthese', 'anticipation_qualification',
  'decentration_niveau', 'decentration_pattern', 'decentration_declencheur',
  'decentration_synthese', 'decentration_qualification',
  'metacognition_niveau', 'metacognition_pattern', 'metacognition_declencheur',
  'metacognition_synthese', 'metacognition_qualification',
  'vue_systemique_niveau', 'vue_systemique_pattern', 'vue_systemique_declencheur',
  'vue_systemique_synthese', 'vue_systemique_qualification',
  'excellence_dominante', 'excellence_secondaire', 'profil_excellences',
  'etape_1_arbitrage_fond'
];

const CHAMPS_PROMPT2 = [
  'pilier_dominant_certif', 'pilier_structurant_certif', 'pilier_structurant2_certif',
  'piliers_moteurs_certif', 'boucle_cognitive_ordre',
  'type_profil_cognitif', 'niveau_profil_cognitif', 'nom_niveau_profil_cognitif', 'zone_profil_cognitif',
  'encadrement_verdict', 'encadrement_diagnostic', 'encadrement_scenario', 'encadrement_bloquant',
  'management_verdict', 'management_diagnostic', 'management_scenario', 'management_bloquant',
  'tableau_comparatif_encadrer_manager',
  'etape_2_lecture_algo', 'etape_3_diagnostics'
];

const CHAMPS_PROMPT3 = [
  'definition_type_profil_cognitif', 'profil_personnalise',
  'Nom_signature_excellence', 'section_signature_excellence',
  'section_vigilance_limbique', 'section_excellences',
  'section_pilier_P1', 'section_pilier_P2', 'section_pilier_P3', 'section_pilier_P4', 'section_pilier_P5',
  'talent_definition', 'trois_capacites', 'pitch_recruteur',
  'amplitude_deployee', 'pattern_navigation_revele', 'mantra_profil',
  'points_vigilance_complet', 'rapport_markdown_complet',
  'statut_certification', 'notes_certificateur'
];

// ─── Chargement prompts ───────────────────────────────────────────────────────

async function loadPrompts() {
  if (cachedPrompt1 && cachedPrompt2 && cachedPrompt3) {
    return { p1: cachedPrompt1, p2: cachedPrompt2, p3: cachedPrompt3 };
  }
  try {
    const [p1, p2, p3] = await Promise.all([
      fs.readFile(path.join(__dirname, '../prompts/certificateur_prompt1_v3.txt'), 'utf8'),
      fs.readFile(path.join(__dirname, '../prompts/certificateur_prompt2_v3.txt'), 'utf8'),
      fs.readFile(path.join(__dirname, '../prompts/certificateur_prompt3_v3.txt'), 'utf8')
    ]);
    cachedPrompt1 = p1;
    cachedPrompt2 = p2;
    cachedPrompt3 = p3;
    logger.info('Certificateur: 3 prompts chargés', {
      p1_length: p1.length, p2_length: p2.length, p3_length: p3.length
    });
    return { p1, p2, p3 };
  } catch (error) {
    logger.error('Certificateur: échec chargement prompts', { error: error.message });
    throw new Error(`Certificateur: prompts introuvables — ${error.message}`);
  }
}

// ─── Construction input Prompt 1 ─────────────────────────────────────────────
// Reçoit : signaux qualité + dossiers piliers × 5 + dossier excellences
// Ne reçoit PAS : dossier global (moteur/binôme/flou/cloture)

function buildInputPrompt1(algoOutput, agent3Syntheses, agent1Corpus, questionsData) {
  const algo        = algoOutput.output || algoOutput;
  const sg          = algo.synthese_globale       || {};
  const scoresPiliers = algo.scores_par_pilier_reel || {};
  const niveauOrder = { nulle: 0, faible: 1, moyen: 2, 'élevé': 3 };
  const niveauNames = ['nulle', 'faible', 'moyen', 'élevé'];

  function getNiveauExcellence(q, key) {
    const field = key === 'anticipation' ? 'anticipation_niveau'
      : key === 'decentration'  ? 'decentration_niveau'
      : key === 'metacognition' ? 'metacognition_niveau'
      : 'vue_systemique_niveau';
    return (q[field] || 'nulle').toLowerCase();
  }

  function maxNiveau(qs, key) {
    let max = 0;
    for (const q of qs) {
      const niv = getNiveauExcellence(q, key);
      if ((niveauOrder[niv] || 0) > max) max = niveauOrder[niv] || 0;
    }
    return niveauNames[max];
  }

  // ── BLOC 1 : Signaux qualité + Limbique ──
  const statsGlobales = algo.statistiques_globales || {};
  const questionsLimbiques = (questionsData || []).filter(q =>
    q.limbique_detecte === true || q.limbique_detecte === 'vrai'
  );

  const bloc1_signaux = {
    coherence_agents:           algo.signature_cognitive?.coherence_agents || null,
    profil_laconique:           algo.signature_cognitive?.profil_laconique || null,
    taux_repond_question:       statsGlobales.taux_repond_question          || null,
    taux_traite_problematique:  statsGlobales.taux_traite_problematique     || null,
    taux_fait_processus_pilier: statsGlobales.taux_fait_processus_pilier    || null,
    limbique: {
      detecte:      questionsLimbiques.length > 0,
      nb_questions: questionsLimbiques.length,
      intensite_max: questionsLimbiques.length > 0
        ? niveauNames[Math.max(...questionsLimbiques.map(q =>
            niveauOrder[(q.limbique_intensite || 'nulle').toLowerCase()] || 0
          ))]
        : null
    }
  };

  // ── BLOC 2 : Dossiers piliers × 5 ──
  const bloc2_piliers = {};

  for (const [pilier, nom] of Object.entries(NOM_PILIERS)) {
    const key    = `${pilier}_${nom}`;
    const sp     = scoresPiliers[key] || {};
    const synth3 = agent3Syntheses?.[pilier] || {};
    const m7     = synth3.mission_7_bilan_certificateur || {};
    const m5B    = synth3.mission_5B_synthese           || {};

    const qsPilier = (questionsData || []).filter(q =>
      q.pilier_reponse_coeur_confirme === pilier || q.pilier_reponse_coeur === pilier
    );

    // Excellences consolidées par pilier
    const excellencesPilier = {};
    for (const k of EXCELLENCE_KEYS) {
      const verbatims = qsPilier.map(q => q[`${k}_verbatim`]).filter(Boolean);
      const manifests = qsPilier.map(q => q[`${k}_manifestation`]).filter(Boolean);
      const contextes = qsPilier.map(q => q[`${k}_contexte_activation`]).filter(Boolean);
      excellencesPilier[k] = {
        niveau:              maxNiveau(qsPilier, k),
        verbatims_marquants: verbatims.length > 0 ? verbatims : null,
        manifestations:      manifests.length > 0 ? manifests : null,
        contexte_activation: contextes.length > 0 ? contextes : null
      };
    }

    // Dimensions — listes nommées
    const listesSimples    = qsPilier.flatMap(q => q.liste_dimensions_simples
      ? q.liste_dimensions_simples.split(', ') : []).filter(Boolean);
    const listesSoph       = qsPilier.flatMap(q => q.liste_dimensions_sophistiquees
      ? q.liste_dimensions_sophistiquees.split(', ') : []).filter(Boolean);

    bloc2_piliers[`${pilier}_${nom}`] = {
      pilier,
      nom,
      amplitude: {
        niveau_max:          sp.niveau_max          || null,
        niveau_moyen:        sp.niveau_moyen        || null,
        zone:                sp.zone                || null,
        score_contenu_moyen: sp.score_contenu_moyen || null
      },
      dimensions: {
        total_simples:             sp.total_simples || 0,
        total_soph:                sp.total_soph    || 0,
        ratio_soph:                sp.total_simples > 0
          ? `${((sp.total_soph || 0) / sp.total_simples * 100).toFixed(1)}%`
          : '0%',
        listes_dimensions: {
          simples:       [...new Set(listesSimples)],
          sophistiquees: [...new Set(listesSoph)]
        }
      },
      boucles_agregees:        m5B.boucles_agregees || {},
      boucles_detectees_agent1: qsPilier.map(q => q.boucles_detectees_agent1).filter(Boolean).join(' | ') || null,
      boucles_detectees_agent3: qsPilier.map(q => q.boucles_detectees_agent3).filter(Boolean).join(' | ') || null,
      circuits_top3:           m5B.circuits_recurrents_top3 || [],
      lecture_cognitive_enrichie: m7.lecture_cognitive_enrichie || null,
      profil_neuroscientifique:   m7.profil_neuroscientifique   || null,
      capacites_observees:        m7.capacites_observees        || [],
      excellences_consolidees:    excellencesPilier,
      excellences_par_pilier:     m5B.excellences_par_pilier    || null,
      signaux_qualite: {
        coherence_a1_a3:      qsPilier.map(q => q.coherence_agent1_agent3).filter(Boolean),
        profiling_qualifie:   qsPilier.map(q => q.profiling_qualifie).filter(v => v === 'FLAG_REVISION'),
        reserve_eventuelle:   qsPilier.map(q => q.justification_actions_majoritairement_faites).filter(Boolean)
      },
      donnees_granulaires: {
        capacites_detectees_agent2: qsPilier.map(q => q.capacites_detectees).filter(Boolean),
        verification_coeur:         qsPilier.map(q => q.verification_coeur).filter(Boolean),
        limbique_detail:            qsPilier.map(q => ({ id_question: q.id_question, detail: q.limbique_detail })).filter(q => q.detail)
      }
    };
  }

  // ── BLOC 3 : Dossier excellences ──
  const bloc3_excellences = {};

  // Distribution par scénario
  const excellencesParScenario = {};
  for (const sc of SCENARIOS) {
    const qsSc = (questionsData || []).filter(q => q.scenario_nom === sc);
    excellencesParScenario[sc] = {};
    for (const k of EXCELLENCE_KEYS) {
      const counts = { nulle: 0, faible: 0, moyen: 0, 'élevé': 0 };
      for (const q of qsSc) {
        const niv = getNiveauExcellence(q, k);
        if (counts[niv] !== undefined) counts[niv]++;
        else counts['nulle']++;
      }
      excellencesParScenario[sc][k] = {
        nulle:           counts['nulle'],
        faible:          counts['faible'],
        moyen:           counts['moyen'],
        'élevé':         counts['élevé'],
        total_questions: qsSc.length,
        niveau_max:      maxNiveau(qsSc, k)
      };
    }
  }
  bloc3_excellences.excellences_par_scenario = excellencesParScenario;

  // Verbatims agrégés × 4 excellences
  const verbatimsAgreges = {};
  for (const k of EXCELLENCE_KEYS) {
    const allVbs  = (questionsData || []).map(q => q[`${k}_verbatim`]).filter(Boolean);
    const allMani = (questionsData || []).map(q => q[`${k}_manifestation`]).filter(Boolean);
    const allCtx  = (questionsData || []).map(q => q[`${k}_contexte_activation`]).filter(Boolean);
    verbatimsAgreges[k] = {
      verbatims:            allVbs.length  > 0 ? allVbs  : null,
      manifestations:       allMani.length > 0 ? allMani : null,
      contextes_activation: allCtx.length  > 0 ? allCtx  : null
    };
  }
  bloc3_excellences.verbatims_agreges = verbatimsAgreges;

  return {
    session_id:   algo.session_ID,
    candidat:     algo.candidat,
    bloc1_signaux_qualite:  bloc1_signaux,
    bloc2_dossiers_piliers: bloc2_piliers,
    bloc3_dossier_excellences: bloc3_excellences
  };
}

// ─── Construction input Prompt 2 ─────────────────────────────────────────────
// Reçoit : JSON Prompt 1 + dossier global (moteur/binôme/flou/cloture) + scores vérification

function buildInputPrompt2(jsonPrompt1, algoOutput, agent1Corpus) {
  const algo = algoOutput.output || algoOutput;
  const sg   = algo.synthese_globale       || {};
  const scoresPiliers = algo.scores_par_pilier_reel || {};

  // ── BLOC 2 : Dossier global — matière d'enquête pour résoudre l'énigme ──
  const bloc2_dossier_global = {
    signature_cognitive: {
      moteur_cognitif:   agent1Corpus?.section_B?.moteur_cognitif    || null,
      binome_actif:      agent1Corpus?.section_B?.binome_actif       || null,
      reaction_flou:     agent1Corpus?.section_B?.reaction_flou      || null,
      signature_cloture: agent1Corpus?.section_B?.signature_cloture  || null,
      pattern_emergent:  agent1Corpus?.section_C || agent1Corpus?.pattern_emergent || null
    }
  };

  // ── BLOC 3 : Scores vérification (consultation légère) ──
  const bloc3_scores = {
    scores_par_pilier: Object.fromEntries(
      Object.entries(NOM_PILIERS).map(([p, nom]) => {
        const key = `${p}_${nom}`;
        const sp  = scoresPiliers[key] || {};
        return [p, {
          score_contenu:  sp.score_contenu_moyen || null,
          niveau_moyen:   sp.niveau_moyen        || null,
          niveau_max:     sp.niveau_max          || null,
          total_simples:  sp.total_simples       || 0,
          total_soph:     sp.total_soph          || 0
        }];
      })
    )
  };

  return {
    session_id: jsonPrompt1.session_id,
    candidat:   jsonPrompt1.candidat,
    bloc1_json_prompt1:     jsonPrompt1,
    bloc2_dossier_global:   bloc2_dossier_global,
    bloc3_scores_verification: bloc3_scores
  };
}

// ─── Construction input Prompt 3 ─────────────────────────────────────────────
// Reçoit : JSON Prompts 1+2 + matière narrative (LCE + excellences piliers)

function buildInputPrompt3(jsonPrompt1, jsonPrompt2, algoOutput, agent3Syntheses) {
  const algo = algoOutput.output || algoOutput;
  const scoresPiliers = algo.scores_par_pilier_reel || {};

  // Matière narrative par pilier (LCE + excellences consolidées)
  const matiereNarrative = {};
  for (const [pilier, nom] of Object.entries(NOM_PILIERS)) {
    const key    = `${pilier}_${nom}`;
    const sp     = scoresPiliers[key] || {};
    const synth3 = agent3Syntheses?.[pilier] || {};
    const m7     = synth3.mission_7_bilan_certificateur || {};
    const m5B    = synth3.mission_5B_synthese           || {};

    matiereNarrative[`${pilier}_${nom}`] = {
      pilier,
      nom,
      lecture_cognitive_enrichie: m7.lecture_cognitive_enrichie || null,
      profil_neuroscientifique:   m7.profil_neuroscientifique   || null,
      capacites_observees:        m7.capacites_observees        || [],
      circuits_top3:              m5B.circuits_recurrents_top3  || [],
      boucles_agregees:           m5B.boucles_agregees          || {},
      niveau_max:                 sp.niveau_max                 || null,
      zone:                       sp.zone                       || null
    };
  }

  return {
    session_id: jsonPrompt1.session_id,
    candidat:   jsonPrompt1.candidat,
    bloc1_json_prompt1:   jsonPrompt1,
    bloc2_json_prompt2:   jsonPrompt2,
    bloc3_matiere_narrative: matiereNarrative
  };
}

// ─── Normalisation des valeurs sortantes ─────────────────────────────────────

function normalizePattern(value) {
  if (!value) return null;
  const v = value.toString().toLowerCase().trim();
  if (v.includes('systémat') || v.includes('systemat')) return 'systématique';
  if (v.includes('contextuel'))                          return 'contextuel';
  if (v.includes('situationnel') || v.includes('situation')) return 'situationnel';
  if (PATTERN_VALUES.includes(v)) return v;
  if (value.length > 30) return null;
  return value;
}

function cleanSelectValue(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/^"+|"+$/g, '').trim();
}

function mapExcellenceName(value) {
  if (!value) return null;
  const cleaned = cleanSelectValue(value).toLowerCase();
  return EXCELLENCE_MAPPING[cleaned] || cleaned;
}

function cleanParsedOutput(raw) {
  const cleaned = { ...raw };

  // Extraire depuis champs_bilan_* si le LLM les a encapsulés
  const bilanKey = Object.keys(cleaned).find(k => k.startsWith('champs_bilan'));
  if (bilanKey && typeof cleaned[bilanKey] === 'object') {
    Object.assign(cleaned, cleaned[bilanKey]);
    delete cleaned[bilanKey];
  }

  // Normaliser les singleSelect
  for (const field of SINGLE_SELECT_BILAN) {
    if (cleaned[field] !== undefined && cleaned[field] !== null) {
      cleaned[field] = cleanSelectValue(String(cleaned[field]));
    }
  }

  // Normaliser les excellences
  if (cleaned.excellence_dominante)  cleaned.excellence_dominante  = mapExcellenceName(cleaned.excellence_dominante);
  if (cleaned.excellence_secondaire) cleaned.excellence_secondaire = mapExcellenceName(cleaned.excellence_secondaire);

  // Normaliser les patterns
  const PATTERN_FIELDS = ['anticipation_pattern', 'decentration_pattern', 'metacognition_pattern', 'vue_systemique_pattern'];
  for (const f of PATTERN_FIELDS) {
    if (cleaned[f]) cleaned[f] = normalizePattern(cleaned[f]);
  }

  // vue_systemique_synthese : si c'est un pattern court → le déplacer en qualification
  if (cleaned.vue_systemique_synthese) {
    const normalized = normalizePattern(cleaned.vue_systemique_synthese);
    if (normalized !== null && cleaned.vue_systemique_synthese.length <= 30) {
      cleaned['vue_systemique_qualification'] = cleaned['vue_systemique_qualification'] || cleaned.vue_systemique_synthese;
      cleaned.vue_systemique_synthese = null;
    }
  }

  // Nettoyer les variantes de noms de champs
  for (const key of Object.keys(cleaned)) {
    if (key.includes('angles_morts') || key.includes('anglesmorts')) {
      const newKey = key.replace('angles_morts', 'vue_systemique').replace('anglesmorts', 'vue_systemique');
      cleaned[newKey] = cleaned[key];
      delete cleaned[key];
    }
  }

  // pilier_structurant2_certif : peut arriver sous pilier_structurant1_certif ou pilier_structurant2_certif
  if (!cleaned.pilier_structurant2_certif && cleaned.pilier_structurant1_certif) {
    // pilier_structurant_certif = structurant 1, chercher le 2 dans piliers_moteurs_certif
    const moteurs = cleaned.piliers_moteurs_certif;
    if (moteurs && typeof moteurs === 'string') {
      const parts = moteurs.split(',').map(s => s.trim());
      const dom   = cleaned.pilier_dominant_certif;
      const str1  = cleaned.pilier_structurant_certif;
      const str2  = parts.find(p => p !== dom && p !== str1);
      if (str2) cleaned.pilier_structurant2_certif = str2;
    }
  }

  // encadrement_scenario / management_scenario : s'assurer que c'est un number
  if (cleaned.encadrement_scenario !== undefined) {
    cleaned.encadrement_scenario = parseInt(cleaned.encadrement_scenario, 10) || 0;
  }
  if (cleaned.management_scenario !== undefined) {
    cleaned.management_scenario = parseInt(cleaned.management_scenario, 10) || 0;
  }

  // niveau_profil_cognitif : s'assurer que c'est un number
  if (cleaned.niveau_profil_cognitif !== undefined) {
    cleaned.niveau_profil_cognitif = parseInt(cleaned.niveau_profil_cognitif, 10) || null;
  }

  // etape_*_* : serialiser si objet
  for (const etapeKey of ['etape_1_arbitrage_fond', 'etape_2_lecture_algo', 'etape_3_diagnostics']) {
    if (cleaned[etapeKey] && typeof cleaned[etapeKey] === 'object') {
      cleaned[etapeKey] = JSON.stringify(cleaned[etapeKey]);
    }
  }

  return cleaned;
}

// ─── Extraction champs BILAN depuis résultat nettoyé ─────────────────────────

function mapToAirtableFields(parsed, champsAutorises) {
  const fields = {};
  for (const champ of champsAutorises) {
    const val = parsed[champ];
    if (val !== undefined && val !== null && val !== '') {
      fields[champ] = val;
    }
  }
  return fields;
}

// ─── Appel Claude avec retry ──────────────────────────────────────────────────

async function callCertificateurPrompt(systemPrompt, userPrompt, label, session_id, maxTokens = 16000) {
  const maxAttempts = 3;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      const response = await claudeService.callClaude({
        systemPrompt,
        userPrompt,
        service: `certificateur_${label}`,
        maxTokens
      });

      const parsed = claudeService.parseClaudeJSON(response.content);

      if (!parsed) {
        throw new Error(`Certificateur ${label}: JSON invalide ou vide`);
      }

      logger.info(`Certificateur ${label}: réponse parsée`, {
        session_id, keys: Object.keys(parsed).length, cost: response.cost
      });

      return { parsed, cost: response.cost || 0 };

    } catch (error) {
      attempts++;
      logger.warn(`Certificateur ${label}: erreur (tentative ${attempts}/${maxAttempts})`, {
        session_id, error: error.message
      });
      if (attempts >= maxAttempts) {
        throw new Error(`Certificateur ${label}: échec définitif — ${error.message}`);
      }
      await sleep(3000 * attempts);
    }
  }
}

// ─── Validation des outputs ───────────────────────────────────────────────────

function validatePrompt1Output(parsed, session_id) {
  const required = [
    'profil_coché_P1', 'profil_coché_P2', 'profil_coché_P3', 'profil_coché_P4', 'profil_coché_P5',
    'anticipation_niveau', 'metacognition_niveau', 'vue_systemique_niveau',
    'excellence_dominante', 'excellence_secondaire', 'profil_excellences'
  ];
  const missing = required.filter(k => !parsed[k] && parsed[k] !== 0);
  if (missing.length > 0) {
    logger.warn('Certificateur P1: champs manquants', { session_id, missing });
  }
  return missing.length === 0;
}

function validatePrompt2Output(parsed, session_id) {
  const required = [
    'pilier_dominant_certif', 'pilier_structurant_certif',
    'type_profil_cognitif', 'encadrement_verdict', 'management_verdict'
  ];
  const missing = required.filter(k => !parsed[k]);
  if (missing.length > 0) {
    logger.warn('Certificateur P2: champs manquants', { session_id, missing });
  }
  if (!parsed.pilier_dominant_certif) {
    throw new Error('Certificateur P2: pilier_dominant_certif manquant — arrêt pipeline');
  }
  return missing.length === 0;
}

function validatePrompt3Output(parsed, session_id) {
  const required = [
    'rapport_markdown_complet', 'statut_certification',
    'section_pilier_P1', 'talent_definition', 'mantra_profil'
  ];
  const missing = required.filter(k => !parsed[k]);
  if (missing.length > 0) {
    logger.warn('Certificateur P3: champs manquants', { session_id, missing });
  }
  if (!parsed.rapport_markdown_complet) {
    throw new Error('Certificateur P3: rapport_markdown_complet manquant — arrêt pipeline');
  }
  return missing.length === 0;
}

// ─── User prompts ─────────────────────────────────────────────────────────────

function buildUserPromptP1(inputJson) {
  return `Tu es le Certificateur — Prompt 1 : Investigation cognitive.

Réalise les 4 étapes dans l'ordre strict : 1D (portraits piliers) → 1C (excellences) → 1A (arbitrage pilier) → 1B (arbitrage global).

Produis UNIQUEMENT le JSON final de l'OUTPUT FINAL tel que défini dans le prompt système.
Pas de commentaire avant ou après le JSON.

Données candidat :

${JSON.stringify(inputJson, null, 2)}`;
}

function buildUserPromptP2(inputJson) {
  return `Tu es le Certificateur — Prompt 2 : Énigme du profil + Diagnostics.

Réalise les 5 étapes dans l'ordre strict : 2A (énigme pilier socle) → 2B (tables référence) → 2C (affinage patterns) → 3A (narratifs) → 3B (tableau comparatif).

⚠️ RÈGLE ABSOLUE : Le pilier_dominant_certif est décidé UNE SEULE FOIS en 2A depuis les 3 temps.
Jamais depuis les scores précalculés de l'Algorithme.

Produis UNIQUEMENT le JSON final de l'OUTPUT FINAL PROMPT 2 tel que défini dans le prompt système.
Pas de commentaire avant ou après le JSON.

Données candidat :

${JSON.stringify(inputJson, null, 2)}`;
}

function buildUserPromptP3(inputJson) {
  return `Tu es le Certificateur — Prompt 3 : Livrables candidat.

Réalise les étapes dans l'ordre : 4B (profils piliers) → 4A (type + navigation) → 4C (signature) → 4D (excellences) → 4E (talent/pitch/mantra) → 4F (vigilances) → Certification.

⚠️ RÈGLE ABSOLUE : Le vocabulaire doit correspondre au niveau du candidat.
Aucun chiffre, aucun score visible pour le candidat.
Minimum 2 verbatims du candidat par section.

Produis UNIQUEMENT le JSON final de l'OUTPUT FINAL PROMPT 3 tel que défini dans le prompt système.
Pas de commentaire avant ou après le JSON.

Données candidat :

${JSON.stringify(inputJson, null, 2)}`;
}

// ─── Fonction principale ──────────────────────────────────────────────────────

async function run(session_id, algoOutput, agent3Syntheses, agent1Corpus, questionsData) {
  logger.info('Certificateur: démarrage pipeline 3 prompts', { session_id });

  const { p1: sysP1, p2: sysP2, p3: sysP3 } = await loadPrompts();

  let totalCost = 0;
  let jsonP1, jsonP2, jsonP3;

  // ════════════════════════════════════════════════════════════
  // PROMPT 1 — Portraits piliers + Excellences
  // ════════════════════════════════════════════════════════════
  logger.info('Certificateur P1: construction input', { session_id });
  const inputP1    = buildInputPrompt1(algoOutput, agent3Syntheses, agent1Corpus, questionsData);
  const userPromP1 = buildUserPromptP1(inputP1);

  const resultP1 = await callCertificateurPrompt(sysP1, userPromP1, 'P1', session_id, 16000);
  totalCost += resultP1.cost;

  const cleanedP1 = cleanParsedOutput(resultP1.parsed);
  validatePrompt1Output(cleanedP1, session_id);

  // Écriture immédiate en BILAN après P1
  const fieldsP1 = mapToAirtableFields(cleanedP1, CHAMPS_PROMPT1);
  await airtableService.updateBilan(session_id, fieldsP1);
  logger.info('Certificateur P1: BILAN mis à jour', { session_id, nb_champs: Object.keys(fieldsP1).length });

  // JSON intermédiaire P1 (transmis à P2 et P3)
  jsonP1 = {
    session_id,
    candidat:             inputP1.candidat,
    etape_1D_portraits:   cleanedP1.design_cognitif_piliers || cleanedP1.etape_1D_portraits || {},
    etape_1C_excellences: cleanedP1.analyse_excellences     || cleanedP1.etape_1C_excellences || {
      nb_excellences_actives: countActiveExcellences(cleanedP1)
    },
    etape_1A_arbitrage_piliers: cleanedP1.arbitrage_1A || cleanedP1.etape_1A_arbitrage_piliers || {},
    etape_1B_arbitrage_global:  cleanedP1.arbitrage_1B || cleanedP1.etape_1B_arbitrage_global  || {},
    champs_bilan_prompt1: fieldsP1
  };

  // ════════════════════════════════════════════════════════════
  // PROMPT 2 — Énigme profil + Diagnostics
  // ════════════════════════════════════════════════════════════
  logger.info('Certificateur P2: construction input', { session_id });
  const inputP2    = buildInputPrompt2(jsonP1, algoOutput, agent1Corpus);
  const userPromP2 = buildUserPromptP2(inputP2);

  const resultP2 = await callCertificateurPrompt(sysP2, userPromP2, 'P2', session_id, 12000);
  totalCost += resultP2.cost;

  const cleanedP2 = cleanParsedOutput(resultP2.parsed);
  validatePrompt2Output(cleanedP2, session_id);

  // Écriture immédiate en BILAN après P2
  const fieldsP2 = mapToAirtableFields(cleanedP2, CHAMPS_PROMPT2);
  await airtableService.updateBilan(session_id, fieldsP2);
  logger.info('Certificateur P2: BILAN mis à jour', { session_id, nb_champs: Object.keys(fieldsP2).length });

  // JSON intermédiaire P2 (transmis à P3)
  jsonP2 = {
    session_id,
    etape_2A_pilier_socle: cleanedP2.enigme_pilier_socle || cleanedP2.etape_2A_pilier_socle || {},
    diagnostics_3A:        cleanedP2.diagnostics_3A      || {},
    champs_bilan_prompt2:  fieldsP2
  };

  // ════════════════════════════════════════════════════════════
  // PROMPT 3 — Livrables candidat
  // ════════════════════════════════════════════════════════════
  logger.info('Certificateur P3: construction input', { session_id });
  const inputP3    = buildInputPrompt3(jsonP1, jsonP2, algoOutput, agent3Syntheses);
  const userPromP3 = buildUserPromptP3(inputP3);

  const resultP3 = await callCertificateurPrompt(sysP3, userPromP3, 'P3', session_id, 20000);
  totalCost += resultP3.cost;

  const cleanedP3 = cleanParsedOutput(resultP3.parsed);
  validatePrompt3Output(cleanedP3, session_id);

  // Écriture finale en BILAN après P3
  const fieldsP3 = mapToAirtableFields(cleanedP3, CHAMPS_PROMPT3);
  await airtableService.updateBilan(session_id, fieldsP3);
  logger.info('Certificateur P3: BILAN mis à jour', { session_id, nb_champs: Object.keys(fieldsP3).length });

  // ════════════════════════════════════════════════════════════
  // Résultat final consolidé
  // ════════════════════════════════════════════════════════════
  const finalResult = {
    ...cleanedP1,
    ...cleanedP2,
    ...cleanedP3
  };

  logger.info('Certificateur: pipeline terminé', {
    session_id,
    statut:               cleanedP3.statut_certification,
    pilier_dominant:      cleanedP2.pilier_dominant_certif,
    type_profil:          cleanedP2.type_profil_cognitif,
    niveau:               cleanedP2.niveau_profil_cognitif,
    encadrement_verdict:  cleanedP2.encadrement_verdict,
    management_verdict:   cleanedP2.management_verdict,
    totalCost
  });

  return {
    result: finalResult,
    totalCost
  };
}

// ─── Helper : compter les excellences actives (niveau ≥ moyen) ───────────────

function countActiveExcellences(parsed) {
  const niveaux = ['moyen', 'élevé'];
  let count = 0;
  for (const k of EXCELLENCE_KEYS) {
    const niveau = parsed[`${k}_niveau`];
    if (niveau && niveaux.includes(niveau.toLowerCase())) count++;
  }
  return count;
}

// ─── Exports ──────────────────────────────────────────────────────────────────

module.exports = {
  run,
  buildInputPrompt1,
  buildInputPrompt2,
  buildInputPrompt3,
  cleanParsedOutput
};
