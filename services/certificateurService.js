// services/certificateurService.js
// Certificateur v8.0 — Arbitrage qualitatif final + rapport narratif
// Prompt : certificateur_v4.txt
// Architecture : 1 appel API unique
// Input : output algo complet + synthèses Agent 3 M7 + corpus Agent 1
// Écriture : ~50 champs dans BILAN

'use strict';

const fs = require('fs').promises;
const path = require('path');
const claudeService = require('./claudeService');
const airtableService = require('./airtableService');
const logger = require('../utils/logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let cachedPrompt = null;

// Noms piliers
const NOM_PILIERS = { P1: 'COLLECTE', P2: 'TRI', P3: 'ANALYSE', P4: 'SOLUTIONS', P5: 'EXÉCUTION' };

// Champs Single Select Airtable (normalisation stricte)
const SINGLE_SELECT_FIELDS = [
  'anticipation_niveau', 'decentration_niveau', 'metacognition_niveau', 'vue_systemique_niveau',
  'excellence_dominante', 'excellence_secondaire',
  'type_profil_cognitif', 'nom_niveau_profil_cognitif', 'zone_profil_cognitif',
  'statut_certification'
];

// Mapping noms d'excellence interne → Airtable
// JAMAIS angles_morts / anglesmorts — toujours vue_systemique
const EXCELLENCE_MAPPING = {
  // Formes longues
  'anticipation_spontanee':   'anticipation',
  'anticipation spontanée':   'anticipation',
  'décentration_cognitive':   'decentration',
  'decentration_cognitive':   'decentration',
  'décentration cognitive':   'decentration',
  'meta_cognition':           'metacognition',
  'méta_cognition':           'metacognition',
  'métacognition':            'metacognition',
  'vue_systemique':           'vue_systemique',
  'vue systémique':           'vue_systemique',
  'vision_systemique':        'vue_systemique',
  'vision systémique':        'vue_systemique',
  'angles_morts':             'vue_systemique',
  // Formes courtes
  'anticipation':  'anticipation',
  'decentration':  'decentration',
  'décentration':  'decentration',
  'metacognition': 'metacognition',
  'métacognition': 'metacognition'
};

// Valeurs valides pour les Single Select pattern dans BILAN
// Airtable : "systématique" / "contextuel" / "situationnel"
const PATTERN_VALUES = ['systématique', 'contextuel', 'situationnel'];

function normalizePattern(value) {
  if (!value) return null;
  const v = value.toString().toLowerCase().trim();
  if (v.includes('systémat') || v.includes('systemat')) return 'systématique';
  if (v.includes('contextuel')) return 'contextuel';
  if (v.includes('situationnel') || v.includes('situation')) return 'situationnel';
  // Si la valeur est déjà exacte
  if (PATTERN_VALUES.includes(v)) return v;
  // Si c'est un texte long (synthèse narrative écrite par erreur dans ce champ), retourner null
  if (value.length > 30) return null;
  return value;
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARGEMENT DU PROMPT
// ═══════════════════════════════════════════════════════════════════════════

async function loadPrompt() {
  if (cachedPrompt) return cachedPrompt;
  try {
    const promptPath = path.join(__dirname, '../prompts/certificateur_v4.txt');
    cachedPrompt = await fs.readFile(promptPath, 'utf8');
    logger.info('Certificateur: prompt chargé', { length: cachedPrompt.length });
    return cachedPrompt;
  } catch (error) {
    logger.error('Certificateur: échec chargement prompt', { error: error.message });
    throw new Error('Prompt introuvable : prompts/certificateur_v4.txt');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION DE L'INPUT JSON POUR LE CERTIFICATEUR
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assembler le JSON d'entrée attendu par le prompt certificateur_v4.txt.
 * 4 blocs : synthese_globale, syntheses_par_pilier, excellences_par_scenario, scores_verification
 */
function buildCertificateurInput(algoOutput, agent3Syntheses, agent1Corpus, questionsData) {
  const algo = algoOutput.output || algoOutput;
  const sg = algo.synthese_globale || {};
  const dist = algo.distribution_cognitive || {};
  const scoresPiliers = algo.scores_par_pilier_reel || {};

  // ── synthese_globale ──────────────────────────────────────────────────────
  // ⚠️ NE PAS inclure pilier_dominant / pilier_structurant / scores ici.
  // Le certificateur fait lui-même le classement en étape 2A depuis syntheses_par_pilier.
  // Les scores sont réservés à l'étape 2 uniquement (scores_verification).
  const syntheseGlobale = {
    // Niveau global (info fond uniquement, pas score)
    niveau_global:      sg.niveau_global,
    nom_niveau_global:  sg.nom_niveau_global,
    zone_globale:       sg.zone_globale || null,

    // Distribution réelle — base de l'arbitrage fond
    profil_type:        dist.profil_type || null,
    distribution_reelle: Object.fromEntries(
      Object.entries(dist.distribution_reelle || {}).map(([p, nb]) => [
        p, { nb_questions: nb, ecart: dist.ecarts?.[p] || '0' }
      ])
    ),
    piliers_forte_concentration:  dist.piliers_forte_concentration || [],
    piliers_faible_concentration: dist.piliers_faible_concentration || [],
    piliers_conformes:            dist.piliers_conformes || [],

    // Signature cognitive (Agent 1 + Agent 3)
    pattern_emergent: algo.signature_cognitive?.pattern_recurrent || null,
    signature_cognitive: {
      pattern_recurrent:    algo.signature_cognitive?.pattern_recurrent || null,
      coherence_agents:     algo.signature_cognitive?.coherence_agents || null,
      moteur_cognitif:      agent1Corpus?.section_B?.moteur_cognitif || null,
      binome_actif:         agent1Corpus?.section_B?.binome_actif || null,
      reaction_flou:        agent1Corpus?.section_B?.reaction_flou || null,
      signature_cloture:    agent1Corpus?.section_B?.signature_cloture || null,
      profil_laconique:     algo.signature_cognitive?.profil_laconique || null
    }
    // pilier_dominant, pilier_structurant, piliers_moteurs, score_global :
    // ABSENTS — le certificateur les détermine lui-même en étape 2A depuis syntheses_par_pilier
  };

  // ── syntheses_par_pilier ──────────────────────────────────────────────────
  const synthesesParPilier = {};
  for (const [pilier, nom] of Object.entries(NOM_PILIERS)) {
    const key = `${pilier}_${nom}`;
    const sp = scoresPiliers[key] || {};
    const synth3 = agent3Syntheses?.[pilier] || {};
    const m7 = synth3.mission_7_bilan_certificateur || {};
    const m5B = synth3.mission_5B_synthese || {};

    // Verbatims marquants depuis les questions du pilier (pilier_question)
    const qsPilier = (questionsData || []).filter(q => q.pilier_reponse_coeur === pilier);
    const verbatims = {};
    for (const k of ['anticipation', 'decentration', 'metacognition', 'vue_systemique']) {
      const vbs = qsPilier.map(q => q[`${k}_verbatim`]).filter(Boolean);
      verbatims[k] = vbs.length > 0 ? vbs[0] : null; // Premier verbatim non-null
    }

    // Niveaux excellences consolidés (max sur les questions réelles du pilier)
    const niveauOrder = { nulle: 0, faible: 1, moyen: 2, 'élevé': 3 };
    const niveauNames = ['nulle', 'faible', 'moyen', 'élevé'];
    const excConsolidees = {};
    for (const k of ['anticipation', 'decentration_niveau', 'metacognition_niveau', 'vue_systemique']) {
      const fieldName = k === 'anticipation' ? 'anticipation_niveau'
        : k === 'decentration_niveau' ? 'decentration_niveau'
        : k === 'metacognition_niveau' ? 'metacognition_niveau'
        : 'vue_systemique_niveau';
      let max = 0;
      for (const q of qsPilier) {
        const niv = ((q[fieldName] || q[`${k}_niveau`] || 'nulle')).toLowerCase();
        if ((niveauOrder[niv] || 0) > max) max = niveauOrder[niv] || 0;
      }
      excConsolidees[k] = niveauNames[max];
    }

    synthesesParPilier[key] = {
      pilier,
      nom,
      nb_questions_reelles: sp.nb_questions_reel || 0,
      ecart_theorique: dist.ecarts?.[pilier] || '0',
      amplitude: {
        niveau_moyen:       sp.niveau_moyen || null,
        nom_niveau_moyen:   sp.nom_niveau_moyen || null,
        niveau_max:         sp.niveau_max || null,
        nom_niveau_max:     sp.nom_niveau_max || null,
        zone:               sp.zone || null,
        score_contenu_moyen: sp.score_contenu_moyen || null,
        score_bareme_moyen: sp.score_bareme_moyen || null,
        delta:              sp.delta_bareme_contenu || null,
        convergence:        sp.convergence || null
      },
      dimensions: {
        total_simples:          sp.total_simples || 0,
        total_details:          sp.total_details || 0,
        total_soph:             sp.total_soph || 0,
        ratio_soph:             sp.total_simples > 0 ? `${((sp.total_soph || 0) / sp.total_simples * 100).toFixed(1)}%` : '0%'
      },
      excellences_consolidees: {
        ...excConsolidees,
        verbatims_marquants: verbatims
      },
      circuits_top3:              m5B.circuits_recurrents_top3 || [],
      boucles_agregees:           m5B.boucles_agregees || {},

      // Boucles des deux méthodes séparées — décision session F3/F4
      boucles_detectees_agent1: qsPilier.map(q => q.boucles_detectees_agent1).filter(Boolean).join(' | ') || null,
      boucles_detectees_agent3: qsPilier.map(q => q.boucles_detectees_agent3).filter(Boolean).join(' | ') || null,

      lecture_cognitive_enrichie: m7.lecture_cognitive_enrichie || null,
      profil_neuroscientifique:   m7.profil_neuroscientifique || null,
      capacites_observees:        m7.capacites_observees || [],
      flag_revision:              m7.flags?.revision_necessaire || false,

      // Signaux qualité par pilier — décisions session D2, D3, B3
      signaux_qualite: {
        coherence_agent1_agent3:          qsPilier.map(q => q.coherence_agent1_agent3).filter(Boolean),
        profiling_qualifie:               qsPilier.map(q => q.profiling_qualifie).filter(v => v === 'FLAG_REVISION'),
        justification_attribution_niveau: qsPilier.map(q => q.justification_attribution_niveau).filter(Boolean)
      },

      // Détail amplitude qualitatif — décisions session C1, C3, C4, C5
      detail_amplitude: {
        zone_amplitude_agent2:  qsPilier.map(q => q.zone_amplitude_max).filter(Boolean)[0] || null,
        plusieurs_niveaux:      qsPilier.some(q => q.plusieurs_niveaux_reponse === true || q.plusieurs_niveaux_reponse === 'true'),
        detail_par_niveaux:     qsPilier.map(q => q.detail_par_niveaux).filter(Boolean),
        niveau_sophistication:  qsPilier.map(q => q.niveau_sophistication).filter(Boolean)
      },

      // Données granulaires par question — décisions session D1, D4, C2, C6, C7, B2, B4
      donnees_granulaires: {
        // ⚠️ circuits_actives = numéros précis de circuits (P3:[1,7,12]) — DISTINCT de circuits_top3 (agrégé) et piliers_actives_final (liste de piliers)
        circuits_actives_par_question:   qsPilier.map(q => ({ id_question: q.id_question, circuits: q.circuits_actives ? JSON.parse(q.circuits_actives) : {} })),
        lecture_cognitive_par_question:  qsPilier.map(q => ({ id_question: q.id_question, lecture: q.lecture_cognitive_m8 })).filter(q => q.lecture),
        listes_dimensions: {
          simples:         qsPilier.flatMap(q => q.liste_dimensions_simples ? q.liste_dimensions_simples.split(', ') : []).filter(Boolean),
          sophistiquees:   qsPilier.flatMap(q => q.liste_dimensions_sophistiquees ? q.liste_dimensions_sophistiquees.split(', ') : []).filter(Boolean),
          criteres:        qsPilier.flatMap(q => q.liste_criteres_details ? q.liste_criteres_details.split(', ') : []).filter(Boolean)
        },
        capacites_detectees_agent2:      qsPilier.map(q => q.capacites_detectees).filter(Boolean),
        limbique_detail:                 qsPilier.map(q => ({ id_question: q.id_question, detail: q.limbique_detail })).filter(q => q.detail),
        verification_coeur:              qsPilier.map(q => q.verification_coeur).filter(Boolean),
        reserve_eventuelle:              qsPilier.map(q => q.justification_actions_majoritairement_faites).filter(Boolean)
      }
    };
  }

  // ── excellences_par_scenario ──────────────────────────────────────────────
  const excellencesParScenario = {};
  for (const sc of ['SOMMEIL', 'WEEKEND', 'ANIMAL', 'PANNE']) {
    const raw = algo.champs_plats_bilan?.[`excellences_${sc}`]
             || algoOutput.bilanFields?.[`excellences_${sc}`];
    if (raw) {
      try { excellencesParScenario[sc] = typeof raw === 'string' ? JSON.parse(raw) : raw; }
      catch { excellencesParScenario[sc] = raw; }
    } else {
      excellencesParScenario[sc] = {};
    }
  }

  // ── scores_verification ───────────────────────────────────────────────────
  const scoresVerification = {
    score_global_contenu: sg.score_global,
    niveau_global:        sg.niveau_global,
    nom_niveau_global:    sg.nom_niveau_global,
    zone_globale:         sg.zone_globale,
    scores_par_pilier: Object.fromEntries(
      Object.entries(NOM_PILIERS).map(([p, nom]) => {
        const key = `${p}_${nom}`;
        const sp = scoresPiliers[key] || {};
        return [p, {
          score_contenu: sp.score_contenu_moyen || null,
          score_bareme:  sp.score_bareme_moyen  || null,
          niveau_moyen:  sp.niveau_moyen         || null,
          niveau_max:    sp.niveau_max           || null
        }];
      })
    ),
    pilier_dominant:    sg.pilier_dominant?.pilier || null,
    pilier_structurant: sg.pilier_structurant?.pilier || null,
    profil_type:        dist.profil_type || null
  };

  // ── classement_2A pré-calculé ─────────────────────────────────────────────
  // Le certificateur doit classer par nb_questions_reel (étape 2A)
  // On le pré-calcule ici pour éviter qu'il utilise synthese_globale.pilier_dominant
  const classement2A = Object.entries(NOM_PILIERS).map(([p, nom]) => {
    const key = `${p}_${nom}`;
    const sp = scoresPiliers[key] || {};
    return {
      pilier: p,
      nom,
      nb_questions_reel: sp.nb_questions_reel || 0,
      total_soph:        sp.total_soph || 0,
      niveau_max:        sp.niveau_max || 0,
      nom_niveau_max:    sp.nom_niveau_max || null
    };
  }).sort((a, b) => {
    // Tri 1 : nb_questions_reel DESC
    if (b.nb_questions_reel !== a.nb_questions_reel) return b.nb_questions_reel - a.nb_questions_reel;
    // Tri 2 : total_soph DESC (départage)
    if (b.total_soph !== a.total_soph) return b.total_soph - a.total_soph;
    // Tri 3 : niveau_max DESC (2ème départage)
    return b.niveau_max - a.niveau_max;
  });

  const [p2ADominant, p2AStructurant, p2A3eme] = classement2A;

  const classement2AOutput = {
    classement: classement2A.map((p, i) => ({ rang: i + 1, ...p })),
    pilier_dominant_2A:    { pilier: p2ADominant.pilier,    niveau_max: p2ADominant.niveau_max,    nb_questions_reel: p2ADominant.nb_questions_reel },
    pilier_structurant_2A: { pilier: p2AStructurant.pilier, niveau_max: p2AStructurant.niveau_max, nb_questions_reel: p2AStructurant.nb_questions_reel },
    pilier_3_2A:           { pilier: p2A3eme.pilier,        niveau_max: p2A3eme.niveau_max,        nb_questions_reel: p2A3eme.nb_questions_reel },
    note: "Classement calculé par nb_questions_reel (étape 2A obligatoire). À utiliser PRIORITAIREMENT sur synthese_globale.pilier_dominant pour identifier les piliers dominant/structurant/3ème."
  };

  return {
    session_id:               algo.session_ID,
    candidat:                 algo.candidat,
    date_analyse:             algo.date_analyse,
    synthese_globale:         syntheseGlobale,
    syntheses_par_pilier:     synthesesParPilier,
    excellences_par_scenario: excellencesParScenario,
    scores_verification:      scoresVerification
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// NETTOYAGE DES VALEURS SINGLE SELECT
// ═══════════════════════════════════════════════════════════════════════════

function cleanSelectValue(value) {
  if (typeof value !== 'string') return value;
  return value.replace(/^"+|"+$/g, '').trim();
}

function mapExcellenceName(value) {
  if (!value) return null;
  const cleaned = cleanSelectValue(value).toLowerCase();
  return EXCELLENCE_MAPPING[cleaned] || cleaned;
}

/**
 * Nettoyer le JSON brut retourné par le certificateur avant écriture Airtable.
 */
function cleanCertificateurResult(raw) {
  const cleaned = { ...raw };

  // Nettoyer les Single Select
  for (const field of SINGLE_SELECT_FIELDS) {
    if (cleaned[field] !== undefined && cleaned[field] !== null) {
      cleaned[field] = cleanSelectValue(cleaned[field]);
    }
  }

  // Mapper les excellences dominante/secondaire
  if (cleaned.excellence_dominante) {
    cleaned.excellence_dominante = mapExcellenceName(cleaned.excellence_dominante);
  }
  if (cleaned.excellence_secondaire) {
    cleaned.excellence_secondaire = mapExcellenceName(cleaned.excellence_secondaire);
  }

  // Normaliser les champs _pattern (Single Select : systématique/contextuel/situationnel)
  // et _synthese (Single Select dans BILAN — ne pas y écrire de texte long)
  const PATTERN_FIELDS = [
    'anticipation_pattern', 'decentration_pattern', 'metacognition_pattern', 'vue_systemique_pattern'
  ];
  const SYNTHESE_AS_SELECT = [
    'vue_systemique_synthese'  // Single Select dans BILAN — seulement le pattern court
  ];
  for (const f of PATTERN_FIELDS) {
    if (cleaned[f]) cleaned[f] = normalizePattern(cleaned[f]);
  }
  for (const f of SYNTHESE_AS_SELECT) {
    if (cleaned[f]) {
      const normalized = normalizePattern(cleaned[f]);
      // Si c'est un texte long (narratif), on le met dans vue_systemique_qualification à la place
      if (normalized === null && cleaned[f].length > 30) {
        cleaned['vue_systemique_qualification'] = cleaned['vue_systemique_qualification'] || cleaned[f];
        cleaned[f] = null;
      } else {
        cleaned[f] = normalized;
      }
    }
  }

  // Garantir que jamais angles_morts / anglesmorts ne passe dans les champs
  // (renommage défensif au cas où le prompt retournerait un ancien nom)
  for (const key of Object.keys(cleaned)) {
    if (key.includes('angles_morts') || key.includes('anglesmorts')) {
      const newKey = key.replace('angles_morts', 'vue_systemique').replace('anglesmorts', 'vue_systemique');
      cleaned[newKey] = cleaned[key];
      delete cleaned[key];
    }
    if (key.includes('type_pivar')) {
      cleaned['type_profil_cognitif'] = cleaned[key];
      delete cleaned[key];
    }
    if (key.includes('niveau_pivar') && !key.includes('nom_')) {
      cleaned['niveau_profil_cognitif'] = cleaned[key];
      delete cleaned[key];
    }
    if (key.includes('zone_pivar')) {
      cleaned['zone_profil_cognitif'] = cleaned[key];
      delete cleaned[key];
    }
    if (key.includes('nom_niveau_pivar')) {
      cleaned['nom_niveau_profil_cognitif'] = cleaned[key];
      delete cleaned[key];
    }
  }

  return cleaned;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DES CHAMPS AIRTABLE DEPUIS LE JSON CERTIFICATEUR
// ═══════════════════════════════════════════════════════════════════════════

function mapToAirtableFields(parsed) {
  // Liste complète des champs attendus dans BILAN (section Certificateur)
  const CHAMPS_CERTIF = [
    'etape_1_arbitrage_fond', 'etape_2_lecture_algo', 'etape_3_diagnostics',
    'profil_coché_P1', 'profil_coché_P2', 'profil_coché_P3', 'profil_coché_P4', 'profil_coché_P5',
    'type_profil_cognitif', 'niveau_profil_cognitif', 'nom_niveau_profil_cognitif', 'zone_profil_cognitif',
    'pilier_dominant_certif', 'pilier_structurant_certif', 'piliers_moteurs_certif', 'boucle_cognitive_ordre',
    'coherence_agents', 'profil_laconique', 'moteur_cognitif', 'binome_actif', 'reaction_flou', 'signature_cloture',
    'anticipation_niveau', 'anticipation_pattern', 'anticipation_declencheur', 'anticipation_synthese', 'anticipation_qualification',
    'decentration_niveau', 'decentration_pattern', 'decentration_declencheur', 'decentration_synthese', 'decentration_qualification',
    'metacognition_niveau', 'metacognition_pattern', 'metacognition_declencheur', 'metacognition_synthese', 'metacognition_qualification',
    'vue_systemique_niveau', 'vue_systemique_pattern', 'vue_systemique_declencheur', 'vue_systemique_synthese', 'vue_systemique_qualification',
    'excellence_dominante', 'excellence_secondaire', 'profil_excellences',
    'encadrement_verdict', 'encadrement_diagnostic', 'encadrement_scenario', 'encadrement_bloquant',
    'management_verdict', 'management_diagnostic', 'management_scenario', 'management_bloquant',
    'tableau_comparatif_encadrer_manager',
    'definition_type_profil_cognitif', 'profil_personnalise',
    'Nom_signature_excellence', 'section_signature_excellence',
    'section_vigilance_limbique', 'section_excellences',
    'section_pilier_P1', 'section_pilier_P2', 'section_pilier_P3', 'section_pilier_P4', 'section_pilier_P5',
    'talent_definition', 'trois_capacites', 'pitch_recruteur',
    'amplitude_deployee', 'pattern_navigation_revele', 'mantra_profil',
    'points_vigilance_complet', 'rapport_markdown_complet',
    'statut_certification', 'notes_certificateur'
  ];

  const fields = {};
  for (const champ of CHAMPS_CERTIF) {
    if (parsed[champ] !== undefined) {
      fields[champ] = parsed[champ];
    }
  }
  return fields;
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pipeline complet Certificateur.
 * 1 appel API → écriture dans BILAN.
 *
 * @param {string} session_id
 * @param {Object} algoOutput - output complet de algorithmeService.run()
 * @param {Object} agent3Syntheses - { P1: synthese, ... } depuis agent3Service.run()
 * @param {Object} agent1Corpus - { section_B, section_C, ... } depuis agent1Service.run()
 * @param {Array} questionsData - 25 questions avec tous les champs plats (verbatims, niveaux, etc.)
 * @returns {Object} { result: Object (JSON certif), totalCost }
 */
async function run(session_id, algoOutput, agent3Syntheses, agent1Corpus, questionsData) {
  const systemPrompt = await loadPrompt();

  // Construire l'input JSON attendu par le prompt
  const inputJson = buildCertificateurInput(algoOutput, agent3Syntheses, agent1Corpus, questionsData);

  const userPrompt = buildUserPrompt(inputJson);

  logger.info('Certificateur: démarrage génération rapport', { session_id });

  let result;
  let attempts = 0;
  const maxAttempts = 3;

  while (attempts < maxAttempts) {
    try {
      const response = await claudeService.callClaude({
        systemPrompt,
        userPrompt,
        service: 'certificateur',
        maxTokens: 32000
      });

      const parsed = claudeService.parseClaudeJSON(response.content);

      if (!parsed || !parsed.statut_certification) {
        throw new Error('Certificateur: réponse invalide — statut_certification manquant');
      }
      if (!parsed.rapport_markdown_complet) {
        throw new Error('Certificateur: réponse invalide — rapport_markdown_complet manquant');
      }

      result = { parsed, cost: response.cost || 0 };
      break;
    } catch (error) {
      attempts++;
      logger.warn(`Certificateur: erreur (tentative ${attempts}/${maxAttempts})`, { error: error.message });
      if (attempts >= maxAttempts) {
        throw new Error(`Certificateur: échec définitif : ${error.message}`);
      }
      await sleep(3000 * attempts);
    }
  }

  // Nettoyer et mapper vers Airtable
  const cleaned = cleanCertificateurResult(result.parsed);
  const fields   = mapToAirtableFields(cleaned);

  // Écriture dans BILAN
  await airtableService.updateBilan(session_id, fields);

  logger.info('Certificateur: BILAN écrit', {
    session_id,
    statut: cleaned.statut_certification,
    type_profil: cleaned.type_profil_cognitif,
    niveau: cleaned.niveau_profil_cognitif
  });

  return {
    result: cleaned,
    totalCost: result.cost
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION DU PROMPT UTILISATEUR
// ═══════════════════════════════════════════════════════════════════════════

function buildUserPrompt(inputJson) {
  return `Génère le rapport de profil cognitif certifié pour ce candidat en suivant STRICTEMENT les étapes du prompt système.

⚠️ RAPPEL ÉTAPE 2A OBLIGATOIRE :
synthese_globale ne contient PAS de pilier_dominant pré-calculé.
Tu dois classer toi-même les 5 piliers par nb_questions_reelles depuis syntheses_par_pilier.
C'est la seule base valide pour identifier dominant / structurant / 3ème pilier.

Voici les données complètes :

${JSON.stringify(inputJson, null, 2)}

Produis UNIQUEMENT le JSON final certifié tel que défini dans la section "OUTPUT FINAL — FORMAT JSON CERTIFIÉ" du prompt système.
Pas de commentaire avant ou après le JSON.
Le champ rapport_markdown_complet doit assembler TOUTES les sections du rapport.`;
}
// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  run,
  buildCertificateurInput,  // exposé pour tests et inspection
  cleanCertificateurResult  // exposé pour tests
};
