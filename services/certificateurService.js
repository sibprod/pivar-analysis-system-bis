// services/certificateurService.js
// Certificateur v8.1 — Arbitrage qualitatif final + rapport narratif
// Corrections v8.1 :
// - pattern_emergent : source corrigée (Section C Agent 1, pas boucle cognitive)
// - excellences_par_scenario : distribution complète NULLE/FAIBLE/MOYEN/ÉLEVÉ construite depuis questionsData
// - verbatims_marquants : TOUS les verbatims + manifestations + contexte_activation par excellence par pilier
// - classement2AOutput : ajouté dans le return final
// - barème supprimé : score_bareme_moyen, delta, convergence retirés de amplitude
// - score_bareme retiré de scores_verification
// - taux qualité passation ajoutés dans synthese_globale
// - limbique consolidé ajouté dans synthese_globale

'use strict';

const fs = require('fs').promises;
const path = require('path');
const claudeService = require('./claudeService');
const airtableService = require('./airtableService');
const logger = require('../utils/logger');

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

let cachedPrompt = null;

const NOM_PILIERS = { P1: 'COLLECTE', P2: 'TRI', P3: 'ANALYSE', P4: 'SOLUTIONS', P5: 'EXÉCUTION' };

const SINGLE_SELECT_FIELDS = [
  'anticipation_niveau', 'decentration_niveau', 'metacognition_niveau', 'vue_systemique_niveau',
  'excellence_dominante', 'excellence_secondaire',
  'type_profil_cognitif', 'nom_niveau_profil_cognitif', 'zone_profil_cognitif',
  'statut_certification'
];

const EXCELLENCE_MAPPING = {
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
  'anticipation':             'anticipation',
  'decentration':             'decentration',
  'décentration':             'decentration',
  'metacognition':            'metacognition',
  'métacognition':            'metacognition'
};

const PATTERN_VALUES = ['systématique', 'contextuel', 'situationnel'];

function normalizePattern(value) {
  if (!value) return null;
  const v = value.toString().toLowerCase().trim();
  if (v.includes('systémat') || v.includes('systemat')) return 'systématique';
  if (v.includes('contextuel')) return 'contextuel';
  if (v.includes('situationnel') || v.includes('situation')) return 'situationnel';
  if (PATTERN_VALUES.includes(v)) return v;
  if (value.length > 30) return null;
  return value;
}

async function loadPrompt() {
  if (cachedPrompt) return cachedPrompt;
  try {
    const promptPath = path.join(__dirname, '../prompts/certificateur_v4.txt');
    cachedPrompt = await fs.readFile(promptPath, 'utf8');
    logger.info('Certificateur: prompt chargé', { length: cachedPrompt.length });
    return cachedPrompt;
  } catch (error) {
    logger.error('Certificateur: échec chargement prompt', { error: error.message });
    throw new Error('Prompt introuvable : prompts/certificateur_v5.txt');
  }
}

function buildCertificateurInput(algoOutput, agent3Syntheses, agent1Corpus, questionsData) {
  const algo = algoOutput.output || algoOutput;
  const sg   = algo.synthese_globale       || {};
  const dist = algo.distribution_cognitive || {};
  const scoresPiliers = algo.scores_par_pilier_reel || {};

  const niveauOrder = { nulle: 0, faible: 1, moyen: 2, 'élevé': 3 };
  const niveauNames = ['nulle', 'faible', 'moyen', 'élevé'];
  const EXCELLENCE_KEYS = ['anticipation', 'decentration', 'metacognition', 'vue_systemique'];

  function getNiveauExcellence(q, key) {
    const field = key === 'anticipation'  ? 'anticipation_niveau'
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

  // DOSSIER GLOBAL
  const patternEmergent = agent1Corpus?.section_C
                       || agent1Corpus?.pattern_emergent
                       || null;

  const statsGlobales = algo.statistiques_globales || {};

  const questionsLimbiques = (questionsData || []).filter(q => q.limbique_detecte === true);
  const limbiqueConso = {
    detecte:      questionsLimbiques.length > 0,
    nb_questions: questionsLimbiques.length,
    intensite_max: questionsLimbiques.length > 0
      ? niveauNames[Math.max(...questionsLimbiques.map(q => niveauOrder[(q.limbique_intensite || 'nulle').toLowerCase()] || 0))]
      : null
  };

  const syntheseGlobale = {
    niveau_global:     sg.niveau_global,
    nom_niveau_global: sg.nom_niveau_global,
    zone_globale:      sg.zone_globale || null,
    profil_type:       dist.profil_type || null,
    distribution_reelle: Object.fromEntries(
      Object.entries(dist.distribution_reelle || {}).map(([p, nb]) => [
        p, { nb_questions: nb, ecart: dist.ecarts?.[p] || '0' }
      ])
    ),
    piliers_forte_concentration:  dist.piliers_forte_concentration  || [],
    piliers_faible_concentration: dist.piliers_faible_concentration || [],
    piliers_conformes:            dist.piliers_conformes            || [],
    pattern_emergent: patternEmergent,
    signature_cognitive: {
      pattern_recurrent: algo.signature_cognitive?.pattern_recurrent || null,
      coherence_agents:  algo.signature_cognitive?.coherence_agents  || null,
      moteur_cognitif:   agent1Corpus?.section_B?.moteur_cognitif    || null,
      binome_actif:      agent1Corpus?.section_B?.binome_actif       || null,
      reaction_flou:     agent1Corpus?.section_B?.reaction_flou      || null,
      signature_cloture: agent1Corpus?.section_B?.signature_cloture  || null,
      profil_laconique:  algo.signature_cognitive?.profil_laconique  || null
    },
    signaux_qualite_globaux: {
      coherence_agents:           algo.signature_cognitive?.coherence_agents || null,
      profil_laconique:           algo.signature_cognitive?.profil_laconique || null,
      taux_repond_question:       statsGlobales.taux_repond_question          || null,
      taux_traite_problematique:  statsGlobales.taux_traite_problematique     || null,
      taux_fait_processus_pilier: statsGlobales.taux_fait_processus_pilier    || null
    },
    limbique: limbiqueConso
  };

  // DOSSIER PILIERS
  const synthesesParPilier = {};

  for (const [pilier, nom] of Object.entries(NOM_PILIERS)) {
    const key    = `${pilier}_${nom}`;
    const sp     = scoresPiliers[key] || {};
    const synth3 = agent3Syntheses?.[pilier] || {};
    const m7     = synth3.mission_7_bilan_certificateur || {};
    const m5B    = synth3.mission_5B_synthese           || {};

    const qsPilier = (questionsData || []).filter(q => q.pilier_reponse_coeur === pilier);

    const excellencesPilier = {};
    for (const k of EXCELLENCE_KEYS) {
      const fieldVerb = `${k}_verbatim`;
      const fieldMani = `${k}_manifestation`;
      const fieldCtx  = `${k}_contexte_activation`;
      const verbatims = qsPilier.map(q => q[fieldVerb]).filter(Boolean);
      const manifests = qsPilier.map(q => q[fieldMani]).filter(Boolean);
      const contextes = qsPilier.map(q => q[fieldCtx]).filter(Boolean);
      excellencesPilier[k] = {
        niveau:              maxNiveau(qsPilier, k),
        verbatims_marquants: verbatims.length > 0 ? verbatims : null,
        manifestations:      manifests.length > 0 ? manifests : null,
        contexte_activation: contextes.length > 0 ? contextes : null
      };
    }

    synthesesParPilier[key] = {
      pilier,
      nom,
      nb_questions_reelles: sp.nb_questions_reel || 0,
      ecart_theorique:      dist.ecarts?.[pilier] || '0',
      amplitude: {
        niveau_moyen:        sp.niveau_moyen       || null,
        nom_niveau_moyen:    sp.nom_niveau_moyen   || null,
        niveau_max:          sp.niveau_max         || null,
        nom_niveau_max:      sp.nom_niveau_max     || null,
        zone:                sp.zone               || null,
        score_contenu_moyen: sp.score_contenu_moyen || null
      },
      dimensions: {
        total_simples:          sp.total_simples || 0,
        total_details:          sp.total_details || 0,
        total_soph:             sp.total_soph    || 0,
        ratio_soph:             sp.total_simples > 0
          ? `${((sp.total_soph || 0) / sp.total_simples * 100).toFixed(1)}%`
          : '0%',
        simples_synthese:       `${sp.total_simples || 0} dimensions simples sur ${sp.nb_questions_reel || 0} questions`,
        sophistiquees_synthese: `${sp.total_soph    || 0} dimensions sophistiquées sur ${sp.nb_questions_reel || 0} questions`
      },
      excellences_consolidees: excellencesPilier,
      circuits_top3:    m5B.circuits_recurrents_top3 || [],
      boucles_agregees: m5B.boucles_agregees         || {},
      boucles_detectees_agent1: qsPilier.map(q => q.boucles_detectees_agent1).filter(Boolean).join(' | ') || null,
      boucles_detectees_agent3: qsPilier.map(q => q.boucles_detectees_agent3).filter(Boolean).join(' | ') || null,
      lecture_cognitive_enrichie: m7.lecture_cognitive_enrichie || null,
      profil_neuroscientifique:   m7.profil_neuroscientifique   || null,
      capacites_observees:        m7.capacites_observees        || [],
      flag_revision:              m7.flags?.revision_necessaire || false,
      signaux_qualite: {
        coherence_agent1_agent3:          qsPilier.map(q => q.coherence_agent1_agent3).filter(Boolean),
        profiling_qualifie:               qsPilier.map(q => q.profiling_qualifie).filter(v => v === 'FLAG_REVISION'),
        justification_attribution_niveau: qsPilier.map(q => q.justification_attribution_niveau).filter(Boolean)
      },
      detail_amplitude: {
        zone_amplitude_agent2: qsPilier.map(q => q.zone_amplitude_max).filter(Boolean)[0] || null,
        plusieurs_niveaux:     qsPilier.some(q => q.plusieurs_niveaux_reponse === true || q.plusieurs_niveaux_reponse === 'true'),
        detail_par_niveaux:    qsPilier.map(q => q.detail_par_niveaux).filter(Boolean),
        niveau_sophistication: qsPilier.map(q => q.niveau_sophistication).filter(Boolean)
      },
      donnees_granulaires: {
        circuits_actives_par_question: qsPilier.map(q => ({
          id_question: q.id_question,
          circuits: q.circuits_actives ? (() => { try { return JSON.parse(q.circuits_actives); } catch { return q.circuits_actives; } })() : {}
        })),
        lecture_cognitive_par_question: qsPilier.map(q => ({
          id_question: q.id_question,
          lecture: q.lecture_cognitive_m8
        })).filter(q => q.lecture),
        listes_dimensions: {
          simples:       qsPilier.flatMap(q => q.liste_dimensions_simples       ? q.liste_dimensions_simples.split(', ')       : []).filter(Boolean),
          sophistiquees: qsPilier.flatMap(q => q.liste_dimensions_sophistiquees ? q.liste_dimensions_sophistiquees.split(', ') : []).filter(Boolean),
          criteres:      qsPilier.flatMap(q => q.liste_criteres_details         ? q.liste_criteres_details.split(', ')         : []).filter(Boolean)
        },
        capacites_detectees_agent2: qsPilier.map(q => q.capacites_detectees).filter(Boolean),
        limbique_detail:            qsPilier.map(q => ({ id_question: q.id_question, detail: q.limbique_detail })).filter(q => q.detail),
        verification_coeur:         qsPilier.map(q => q.verification_coeur).filter(Boolean),
        reserve_eventuelle:         qsPilier.map(q => q.justification_actions_majoritairement_faites).filter(Boolean)
      }
    };
  }

  // DOSSIER EXCELLENCES — distribution complète
  const SCENARIOS = ['SOMMEIL', 'WEEKEND', 'ANIMAL', 'PANNE'];
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

  // SCORES VÉRIFICATION — barème supprimé
  const scoresVerification = {
    score_global_contenu: sg.score_global,
    niveau_global:        sg.niveau_global,
    nom_niveau_global:    sg.nom_niveau_global,
    zone_globale:         sg.zone_globale,
    scores_par_pilier: Object.fromEntries(
      Object.entries(NOM_PILIERS).map(([p, nom]) => {
        const key = `${p}_${nom}`;
        const sp  = scoresPiliers[key] || {};
        return [p, {
          score_contenu:  sp.score_contenu_moyen || null,
          niveau_moyen:   sp.niveau_moyen        || null,
          niveau_max:     sp.niveau_max          || null,
          nom_niveau_max: sp.nom_niveau_max      || null
        }];
      })
    ),
    profil_type: dist.profil_type || null
  };

  // CLASSEMENT 2A
  const classement2A = Object.entries(NOM_PILIERS).map(([p, nom]) => {
    const key = `${p}_${nom}`;
    const sp  = scoresPiliers[key] || {};
    return {
      pilier:            p,
      nom,
      nb_questions_reel: sp.nb_questions_reel || 0,
      total_soph:        sp.total_soph        || 0,
      niveau_max:        sp.niveau_max        || 0,
      nom_niveau_max:    sp.nom_niveau_max    || null
    };
  }).sort((a, b) => {
    if (b.nb_questions_reel !== a.nb_questions_reel) return b.nb_questions_reel - a.nb_questions_reel;
    if (b.total_soph        !== a.total_soph)        return b.total_soph        - a.total_soph;
    return b.niveau_max - a.niveau_max;
  });

  const [p2ADominant, p2AStructurant, p2A3eme] = classement2A;

  const classement2AOutput = {
    classement:            classement2A.map((p, i) => ({ rang: i + 1, ...p })),
    pilier_dominant_2A:    { pilier: p2ADominant?.pilier,    niveau_max: p2ADominant?.niveau_max,    nb_questions_reel: p2ADominant?.nb_questions_reel },
    pilier_structurant_2A: { pilier: p2AStructurant?.pilier, niveau_max: p2AStructurant?.niveau_max, nb_questions_reel: p2AStructurant?.nb_questions_reel },
    pilier_3_2A:           { pilier: p2A3eme?.pilier,        niveau_max: p2A3eme?.niveau_max,        nb_questions_reel: p2A3eme?.nb_questions_reel },
    note: 'Classement par nb_questions_reel puis total_soph puis niveau_max. Utiliser PRIORITAIREMENT pour identifier dominant/structurant/3ème.'
  };

  return {
    session_id:               algo.session_ID,
    candidat:                 algo.candidat,
    date_analyse:             algo.date_analyse,
    synthese_globale:         syntheseGlobale,
    syntheses_par_pilier:     synthesesParPilier,
    excellences_par_scenario: excellencesParScenario,
    verbatims_agreges:        verbatimsAgreges,
    classement_2A:            classement2AOutput,
    scores_verification:      scoresVerification
  };
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

function cleanCertificateurResult(raw) {
  const cleaned = { ...raw };

  for (const field of SINGLE_SELECT_FIELDS) {
    if (cleaned[field] !== undefined && cleaned[field] !== null) {
      cleaned[field] = cleanSelectValue(cleaned[field]);
    }
  }

  if (cleaned.excellence_dominante)  cleaned.excellence_dominante  = mapExcellenceName(cleaned.excellence_dominante);
  if (cleaned.excellence_secondaire) cleaned.excellence_secondaire = mapExcellenceName(cleaned.excellence_secondaire);

  const PATTERN_FIELDS = ['anticipation_pattern', 'decentration_pattern', 'metacognition_pattern', 'vue_systemique_pattern'];
  for (const f of PATTERN_FIELDS) {
    if (cleaned[f]) cleaned[f] = normalizePattern(cleaned[f]);
  }

  if (cleaned.vue_systemique_synthese) {
    const normalized = normalizePattern(cleaned.vue_systemique_synthese);
    if (normalized === null && cleaned.vue_systemique_synthese.length > 30) {
      cleaned['vue_systemique_qualification'] = cleaned['vue_systemique_qualification'] || cleaned.vue_systemique_synthese;
      cleaned.vue_systemique_synthese = null;
    } else {
      cleaned.vue_systemique_synthese = normalized;
    }
  }

  for (const key of Object.keys(cleaned)) {
    if (key.includes('angles_morts') || key.includes('anglesmorts')) {
      const newKey = key.replace('angles_morts', 'vue_systemique').replace('anglesmorts', 'vue_systemique');
      cleaned[newKey] = cleaned[key];
      delete cleaned[key];
    }
    if (key.includes('type_pivar'))       { cleaned['type_profil_cognitif']       = cleaned[key]; delete cleaned[key]; }
    if (key.includes('niveau_pivar') && !key.includes('nom_')) { cleaned['niveau_profil_cognitif'] = cleaned[key]; delete cleaned[key]; }
    if (key.includes('zone_pivar'))       { cleaned['zone_profil_cognitif']        = cleaned[key]; delete cleaned[key]; }
    if (key.includes('nom_niveau_pivar')) { cleaned['nom_niveau_profil_cognitif']  = cleaned[key]; delete cleaned[key]; }
  }

  return cleaned;
}

function mapToAirtableFields(parsed) {
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
    if (parsed[champ] !== undefined) fields[champ] = parsed[champ];
  }
  return fields;
}

async function run(session_id, algoOutput, agent3Syntheses, agent1Corpus, questionsData) {
  const systemPrompt = await loadPrompt();
  const inputJson    = buildCertificateurInput(algoOutput, agent3Syntheses, agent1Corpus, questionsData);
  const userPrompt   = buildUserPrompt(inputJson);

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

  const cleaned = cleanCertificateurResult(result.parsed);
  const fields  = mapToAirtableFields(cleaned);

  await airtableService.updateBilan(session_id, fields);

  logger.info('Certificateur: BILAN écrit', {
    session_id,
    statut:      cleaned.statut_certification,
    type_profil: cleaned.type_profil_cognitif,
    niveau:      cleaned.niveau_profil_cognitif
  });

  return { result: cleaned, totalCost: result.cost };
}

function buildUserPrompt(inputJson) {
  return `Génère le rapport de profil cognitif certifié pour ce candidat en suivant STRICTEMENT les étapes du prompt système.

⚠️ RAPPEL ÉTAPE 2A OBLIGATOIRE :
Le dossier classement_2A contient le classement pré-calculé des piliers par nb_questions_reel.
Utilise classement_2A.pilier_dominant_2A, classement_2A.pilier_structurant_2A, classement_2A.pilier_3_2A
pour identifier dominant / structurant / 3ème pilier. C'est la seule base valide.

⚠️ RAPPEL EXCELLENCES :
excellences_par_scenario contient la distribution complète (nb NULLE/FAIBLE/MOYEN/ÉLEVÉ)
pour chaque excellence × chaque scénario. Utilise ces comptes pour calculer les seuils en 1C.
verbatims_agreges contient tous les verbatims + manifestations + contextes_activation par excellence.

Voici les données complètes :

${JSON.stringify(inputJson, null, 2)}

Produis UNIQUEMENT le JSON final certifié tel que défini dans la section "OUTPUT FINAL — FORMAT JSON CERTIFIÉ" du prompt système.
Pas de commentaire avant ou après le JSON.
Le champ rapport_markdown_complet doit assembler TOUTES les sections du rapport.`;
}

module.exports = {
  run,
  buildCertificateurInput,
  cleanCertificateurResult
};
