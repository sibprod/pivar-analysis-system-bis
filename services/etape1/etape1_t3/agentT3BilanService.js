// services/etape1/agentT3BilanService.js
// Agent Bilan — ÉTAPE 3 — Génération du bilan cognitif
// Profil-Cognitif v11.0 (28/05/2026)
//
// ⚠️ AVANT MODIFICATION : lire new-prompts/etape1/etape1_t3bilan.txt (prompt v5.3,
//                        toutes les doctrines D1-D14, §2.8-2.14) + docs/ARCHITECTURE.
//
// ───────────────────────────────────────────────────────────────────────────
// RÔLE
// ───────────────────────────────────────────────────────────────────────────
// Service UNIQUE de l'étape 3 (décision Isabelle 28/05 : 1 prompt / 1 service,
// abandon de l'ancienne architecture à 6 sous-agents).
//
// Produit le bilan cognitif d'un candidat en rejouant le MÊME prompt
// (etape1_t3bilan.txt) en 7 appels segmentés (cf. §3.3 du prompt) :
//   Appel 0    → sections globales §01-§07 (sauf synthèses piliers) → ETAPE1_T3_BILAN
//   Appel 0bis → §02bis profil cognitif (soleil)                     → ETAPE1_T3_BILAN
//   Appels 1-5 → un par pilier (socle→str1→str2→fn1→fn2) :
//                synth_factuelle + synth_interpretee + pilier_mode    → ETAPE1_T3_PILIER
//                circuits[] du pilier                                 → ETAPE1_T3_CIRCUIT
//
// Le service assemble les sorties JSON et écrit dans les 3 tables T3.
//
// ───────────────────────────────────────────────────────────────────────────
// SOURCES injectées dans chaque appel (cf. §3 du prompt) — toutes consolidées
// depuis Airtable AVANT les appels (le prompt n'interroge jamais de DB) :
//   - ETAPE1_T2_VENTILATION_PILIERS  (architecture moteur, socle, stats)
//   - ETAPE1_T2_INVENTAIRE_CIRCUITS  (ventilation 7 valeurs/circuit — autoritaire)
//   - ETAPE1_T2                       (noms catalogues, verbatims_viz, signal, cluster)
//   - ETAPE1_T1                       (séquences, lecture_labo, glissements)
//   - RESPONSES                       (verbatims bruts)
//   - REFERENTIEL_PROFILS             (35 profils-types — cadrage pilier_mode, D8)
//   - REFERENTIEL_CIRCUITS_CANDIDATS  (ADHOC promus — §2.13)
//
// ⚠️ Anonymisation (Décision n°4) : on n'envoie JAMAIS le prénom à Claude.
//    Le prénom/nom sont écrits dans T3_BILAN par le service, hors appel Claude.
//
// PATTERN : aligné sur agentPromptEtape1Service / agentT1Service
//   (agentBase.callAgent, injectLexique, parsing tolérant).
// ───────────────────────────────────────────────────────────────────────────

'use strict';

const agentBase       = require('../../infrastructure/agentBase');
const airtableService = require('../../infrastructure/airtableService');
const airtableConfig  = require('../../../config/airtable');
const logger          = require('../../../utils/logger');

const SERVICE_NAME = 'agent_t3_bilan';
const PROMPT_PATH  = 'etape1/etape1_t3bilan.txt';

// Ordre canonique des piliers par rôle (le service le calcule depuis T2_VENTILATION)
const ROLE_ORDER = ['socle', 'structurant_1', 'structurant_2', 'fonctionnel_1', 'fonctionnel_2'];

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Génère le bilan complet d'un candidat (7 appels Claude + écriture 3 tables T3).
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Object} [params.visiteur]   — déjà lu par l'orchestrateur (prénom/nom/civilité)
 * @returns {Promise<Object>} { success, candidat_id, nb_piliers, nb_circuits, totalCostUsd, totalElapsedMs }
 */
async function runAgentT3Bilan({ candidat_id, visiteur = null }) {
  const startTime = Date.now();
  const usages = [];
  const costs = [];

  logger.info('Agent T3 Bilan — démarrage', { candidat_id });

  // ─── 1. Charger toutes les sources Airtable (une seule fois) ───────────────
  const sources = await loadAllSources(candidat_id, visiteur);
  if (!sources.ventilationPiliers || sources.ventilationPiliers.length === 0) {
    throw new Error(
      `Agent T3 Bilan — ETAPE1_T2_VENTILATION_PILIERS vide pour ${candidat_id}. ` +
      `L'étape 2 (Phase 3) doit avoir tourné avant l'étape 3.`
    );
  }

  // ─── 2. Calculer l'architecture moteur (ordre des piliers par rôle) ────────
  const architecture = computeArchitecture(sources.ventilationPiliers);
  logger.info('Agent T3 Bilan — architecture moteur', {
    candidat_id,
    socle: architecture.socle?.pilier,
    ordre: architecture.ordered.map(p => `${p.pilier}:${p.role}`).join(' → '),
  });

  // ─── 3. APPEL 0 — sections globales §01-§07 ────────────────────────────────
  const payload0 = buildPayloadAppel0(candidat_id, sources, architecture);
  const res0 = await agentBase.callAgent({
    serviceName: SERVICE_NAME,
    promptPath:  PROMPT_PATH,
    payload:     { ...payload0, _consigne: CONSIGNE_APPEL_0 },
    injectLexique: true,
    candidatId:  candidat_id,
  });
  trackUsage(usages, costs, res0);
  const bilanGlobal = res0.result; // { candidat, bilan: {§01..§07} }

  // ─── 4. APPEL 0bis — §02bis profil cognitif (soleil) ───────────────────────
  const payload0bis = buildPayloadAppel0bis(candidat_id, sources, architecture);
  const res0bis = await agentBase.callAgent({
    serviceName: SERVICE_NAME,
    promptPath:  PROMPT_PATH,
    payload:     { ...payload0bis, _consigne: CONSIGNE_APPEL_0BIS },
    injectLexique: true,
    candidatId:  candidat_id,
  });
  trackUsage(usages, costs, res0bis);
  const profilCognitif = res0bis.result; // { §02bis_profil_cognitif: {...} }

  // ─── 5. APPELS 1-5 — un par pilier dans l'ordre des rôles ──────────────────
  const pilierResults = [];   // pour ETAPE1_T3_PILIER
  const circuitResults = [];  // pour ETAPE1_T3_CIRCUIT
  for (let i = 0; i < architecture.ordered.length; i++) {
    const pilierArch = architecture.ordered[i];
    const payloadP = buildPayloadAppelPilier(candidat_id, sources, architecture, pilierArch);
    const resP = await agentBase.callAgent({
      serviceName: SERVICE_NAME,
      promptPath:  PROMPT_PATH,
      payload:     { ...payloadP, _consigne: consigneAppelPilier(pilierArch) },
      injectLexique: true,
      candidatId:  candidat_id,
    });
    trackUsage(usages, costs, resP);

    // resP.result = { piliers_update: {...}, circuits: [...] }
    pilierResults.push({ pilierArch, update: resP.result.piliers_update || {} });
    for (const c of (resP.result.circuits || [])) {
      circuitResults.push({ pilier: pilierArch.pilier, circuit: c });
    }

    logger.info('Agent T3 Bilan — pilier traité', {
      candidat_id, pilier: pilierArch.pilier, role: pilierArch.role,
      nb_circuits: (resP.result.circuits || []).length,
    });
  }

  // ─── 6. Mapper les résultats → lignes Airtable (field IDs) ─────────────────
  const bilanRow    = mapBilanToFields(candidat_id, sources, bilanGlobal, profilCognitif);
  const pilierRows  = pilierResults.map(pr => mapPilierToFields(candidat_id, pr, architecture));
  const circuitRows = circuitResults.map(cr => mapCircuitToFields(candidat_id, cr));

  // ─── 7. Écrire les 3 tables (BILAN upsert, PILIER/CIRCUIT delete+create) ───
  await airtableService.upsertEtape1T3Bilan(candidat_id, bilanRow);
  const nbP = await airtableService.writeEtape1T3Piliers(candidat_id, pilierRows);
  const nbC = await airtableService.writeEtape1T3Circuits(candidat_id, circuitRows);

  const totalElapsedMs = Date.now() - startTime;
  const totalCostUsd = costs.reduce((s, c) => s + c, 0);

  logger.info('Agent T3 Bilan — terminé', {
    candidat_id, nb_piliers: nbP, nb_circuits: nbC,
    totalCostUsd: totalCostUsd.toFixed(4), totalElapsedMs,
  });

  return {
    success: true,
    candidat_id,
    nb_piliers: nbP,
    nb_circuits: nbC,
    totalCostUsd,
    totalElapsedMs,
    usages,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARGEMENT DES SOURCES
// ═══════════════════════════════════════════════════════════════════════════
async function loadAllSources(candidat_id, visiteur) {
  const [
    ventilationPiliers, inventaireCircuits, t2, t1, responses,
    referentielProfils, referentielCircuits, adhocCircuits, civilite,
  ] = await Promise.all([
    airtableService.getEtape1T2VentilationPiliers(candidat_id),
    airtableService.getEtape1T2InventaireCircuits(candidat_id),
    airtableService.getEtape1T2(candidat_id),
    airtableService.getEtape1T1(candidat_id),
    airtableService.getResponses(candidat_id),
    airtableService.getReferentielProfils(),
    airtableService.getReferentielCircuits(),
    safeGetAdhoc(candidat_id),
    airtableService.getCiviliteCandidat(candidat_id),
  ]);

  return {
    candidat_id,
    visiteur,
    civilite,
    ventilationPiliers, inventaireCircuits, t2, t1, responses,
    referentielProfils, referentielCircuits, adhocCircuits,
  };
}

async function safeGetAdhoc(candidat_id) {
  try {
    // Filtre côté service : on ne garde que les ADHOC promus de ce candidat
    const all = await airtableService.getCircuitsAdHocByStatut('PROMU_AUTO');
    return (all || []).filter(a =>
      (a.candidats_concernes || '').includes(candidat_id) ||
      (Array.isArray(a.candidats_concernes) && a.candidats_concernes.includes(candidat_id))
    );
  } catch (e) {
    logger.warn('Agent T3 Bilan — lecture ADHOC échouée (continue sans)', { candidat_id, error: e.message });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ARCHITECTURE MOTEUR — calcul de l'ordre des piliers (D2/D2bis)
// Source autoritaire : nb_questions_coeur dans ETAPE1_T2_VENTILATION_PILIERS.
// ⚠️ La table peut ne contenir que les piliers avec ≥ 1 cœur. On complète avec
//    les piliers absents (0 cœur) en queue pour TOUJOURS avoir les 5 piliers.
// ═══════════════════════════════════════════════════════════════════════════
function computeArchitecture(ventilationPiliers) {
  const PILIERS_TOUS = ['P1', 'P2', 'P3', 'P4', 'P5'];
  const PILIER_LABELS = {
    P1: "Collecte d'information",
    P2: 'Tri et organisation',
    P3: 'Analyse et diagnostic',
    P4: 'Création de solutions',
    P5: 'Mise en œuvre et exécution'
  };

  // Trie par nb_questions_coeur décroissant ; départage par activations totales.
  const sorted = [...ventilationPiliers].sort((a, b) => {
    const ca = a.nb_questions_coeur || a.nb_reponses || 0;
    const cb = b.nb_questions_coeur || b.nb_reponses || 0;
    if (cb !== ca) return cb - ca;
    return (b.nb_activations_coeur_total || 0) - (a.nb_activations_coeur_total || 0);
  });

  // Construire les piliers présents
  const ordered = sorted.map((p, idx) => ({
    pilier: p.pilier_coeur,
    pilier_label: p.pilier_coeur_libelle || PILIER_LABELS[p.pilier_coeur] || p.pilier_coeur,
    role: ROLE_ORDER[idx] || 'fonctionnel_2',
    raw: p
  }));

  // Compléter avec les piliers ABSENTS de la ventilation (0 cœur)
  const presents = new Set(ordered.map(o => o.pilier));
  const absents = PILIERS_TOUS.filter(p => !presents.has(p));
  for (const p of absents) {
    ordered.push({
      pilier: p,
      pilier_label: PILIER_LABELS[p] || p,
      role: ROLE_ORDER[ordered.length] || 'fonctionnel_2',
      raw: { pilier_coeur: p, nb_questions_coeur: 0, nb_reponses: 0, nb_activations_coeur_total: 0 }
    });
  }

  return { ordered, socle: ordered[0] || null };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION DES PAYLOADS (sections délimitées — cf. §3.2 du prompt)
// NOTE : ces fonctions consolident les sources en texte structuré. Le détail
//        exact du formatage suit le §3 du prompt. Versions initiales ci-dessous ;
//        à affiner avec un candidat de test réel.
// ═══════════════════════════════════════════════════════════════════════════
function buildPayloadAppel0(candidat_id, sources, architecture) {
  return {
    candidat: identiteAnonyme(sources),
    distribution_sorties: sources.ventilationPiliers.map(p => ({
      pilier: p.pilier_coeur, sorties: p.nb_reponses, coeur: p.nb_questions_coeur,
    })),
    architecture_moteur: architecture.ordered.map(p => ({ pilier: p.pilier, role: p.role })),
    glissements_precalcules: extractGlissements(sources.t1),
    boucles_top3: extractBouclesTop3(sources.t1, sources.responses),
    signaux_limbiques: extractSignaux(sources.t2),
    tableau_t1_compact: sources.t1.map(compactT1Row),
  };
}

function buildPayloadAppel0bis(candidat_id, sources, architecture) {
  return {
    candidat: identiteAnonyme(sources),
    architecture_moteur: architecture.ordered.map(p => ({ pilier: p.pilier, role: p.role })),
    inventaire_circuits_complet: sources.inventaireCircuits,  // table complète (autoritaire)
    referentiel_circuits: sources.referentielCircuits,
    responses: sources.responses,
  };
}

function buildPayloadAppelPilier(candidat_id, sources, architecture, pilierArch) {
  const pilier = pilierArch.pilier;
  const circuitsPilier = sources.inventaireCircuits.filter(c =>
    (c.pilier_owner === pilier) || (c.circuit_label || '').startsWith(pilier)
  );
  return {
    candidat: identiteAnonyme(sources),
    pilier_en_cours: { pilier, role: pilierArch.role, label: pilierArch.pilier_label },
    ventilation_pilier: circuitsPilier,
    ventilation_inverse: sources.inventaireCircuits,  // pour les emprunts vers ce pilier
    circuits_haut_t2: sources.t2.filter(t => (t.circuit_id || '').startsWith(pilier)),
    verbatims_par_question: sources.responses,
    referentiel_profils_pilier: sources.referentielProfils.filter(p => p.pilier === pilier),
    adhoc_pilier: sources.adhocCircuits.filter(a => (a.pilier_principal || '') === pilier),
  };
}

function identiteAnonyme(sources) {
  // Anonymisation : civilité seulement, pas de prénom envoyé à Claude
  return { candidat_id: sources.candidat_id, civilite: sources.civilite || 'Madame/Monsieur' };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSIGNES FINALES PAR APPEL (ce que l'agent doit retourner — cf. §11 prompt)
// ═══════════════════════════════════════════════════════════════════════════
const CONSIGNE_APPEL_0 =
  "Produis UNIQUEMENT l'objet JSON { candidat, bilan: { §01_vue_globale, " +
  "§02_filtre_cognitif, §03_glissements, §04_boucle_cognitive, §05_signal_limbique, " +
  "§06_couts, §07_signature } }. Pas de §02bis, pas de piliers[], pas de circuits[]. " +
  "JSON pur, commence par { finit par }.";

const CONSIGNE_APPEL_0BIS =
  "Produis UNIQUEMENT l'objet JSON { bilan: { §02bis_profil_cognitif: {...} } } " +
  "selon le §5.3bis du prompt (bloc1 socle + bloc2 satellites + tandem + conclusion_cycle). " +
  "JSON pur.";

function consigneAppelPilier(pilierArch) {
  return (
    `Produis UNIQUEMENT { piliers_update: { pilier: "${pilierArch.pilier}", ` +
    `pilier_mode, synth_factuelle_coeur, synth_factuelle_elargie, synth_interpretee }, ` +
    `circuits: [...] } pour le pilier ${pilierArch.pilier} (rôle ${pilierArch.role}). ` +
    `Applique la doctrine PILIER_MODE (§2.11) et TABLEAU RÉCAP (§2.12). JSON pur.`
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAPPING JSON Claude → lignes Airtable (field IDs des 3 tables T3)
// ═══════════════════════════════════════════════════════════════════════════
function mapBilanToFields(candidat_id, sources, bilanGlobal, profilCognitif) {
  const F = airtableConfig.ETAPE1_T3_BILAN_FIELDS;
  const b = (bilanGlobal && bilanGlobal.bilan) || {};
  const vg = b['§01_vue_globale'] || {};
  const fc = b['§02_filtre_cognitif'] || {};
  const gl = b['§03_glissements'] || {};
  const bc = b['§04_boucle_cognitive'] || {};
  const sl = b['§05_signal_limbique'] || {};
  const sg = b['§07_signature'] || {};

  const row = {};
  // Identité
  row[F.candidat_id]   = candidat_id;
  if (sources.visiteur) {
    row[F.prenom]   = sources.visiteur.Prenom || sources.visiteur.prenom || '';
    row[F.nom]      = sources.visiteur.Nom || sources.visiteur.nom || '';
  }
  row[F.civilite]      = sources.civilite || '';
  row[F.version_bilan] = 'v1';

  // §01 / filtre / glissements / boucles / signal / signature (best effort — clés du prompt)
  row[F.note_profil_global]   = vg.note_profil_global || '';
  row[F.filtre_titre_court]   = sg.sig_resultat_ligne1 || '';
  row[F.filtre_developpe]     = fc.filtre_lecture_candidat || '';
  row[F.filtre_label]         = fc.filtre_label || '';
  row[F.glissement_intro]     = gl.glissement_intro || '';
  row[F.glissement_1_label]   = gl.glissement_1_label || '';
  row[F.glissement_2_label]   = gl.glissement_2_label || '';
  row[F.glissement_3_label]   = gl.glissement_3_label || '';
  row[F.glissement_4_label]   = gl.glissement_4_label || '';
  row[F.glissement_convergence] = gl.glissements_conclusion || '';
  row[F.boucle_intro]         = bc.boucle_intro || '';
  row[F.boucle1_label]        = bc.boucle_1_label || '';
  row[F.boucle1_sequence]     = bc.boucle_1_sequence || '';
  row[F.boucle1_analyse]      = bc.boucle_1_labo || '';
  row[F.boucle1_reponse]      = bc.boucle_1_reponse || '';
  row[F.boucle2_label]        = bc.boucle_2_label || '';
  row[F.boucle2_sequence]     = bc.boucle_2_sequence || '';
  row[F.boucle2_analyse]      = bc.boucle_2_labo || '';
  row[F.boucle2_reponse]      = bc.boucle_2_reponse || '';
  row[F.boucle3_label]        = bc.boucle_3_label || '';
  row[F.boucle3_sequence]     = bc.boucle_3_sequence || '';
  row[F.boucle3_analyse]      = bc.boucle_3_labo || '';
  row[F.boucle3_reponse]      = bc.boucle_3_reponse || '';
  row[F.signal_synthese_socle]= sl.signal_synthese || '';
  row[F.signature_finalite]   = sg.sig_finalite || '';
  row[F.sig_resultat_l2]      = sg.sig_resultat_ligne2 || '';

  // Nettoyage des undefined
  return stripUndefined(row);
}

function mapPilierToFields(candidat_id, pilierResult, architecture) {
  const F = airtableConfig.ETAPE1_T3_PILIER_FIELDS;
  const u = pilierResult.update || {};
  const pa = pilierResult.pilierArch;
  const row = {};
  row[F.candidat_id]           = candidat_id;
  row[F.cle_composite]         = `${candidat_id}_${pa.pilier}`;
  row[F.pilier]                = pa.pilier;
  row[F.pilier_label]          = pa.pilier_label || '';
  row[F.role_pilier]           = pa.role;
  row[F.pilier_mode]           = u.pilier_mode || '';
  row[F.synthese_technique]    = u.synth_factuelle_coeur || '';
  row[F.synthese_technique_det]= u.synth_factuelle_elargie || '';
  row[F.synthese_interpretee]  = u.synth_interpretee || '';
  return stripUndefined(row);
}

function mapCircuitToFields(candidat_id, circuitResult) {
  const F = airtableConfig.ETAPE1_T3_CIRCUIT_FIELDS;
  const c = circuitResult.circuit || {};
  const pilier = circuitResult.pilier;
  const cid = c.circuit_id || (c.is_adhoc ? 'ADHOC' : '');
  const row = {};
  row[F.cle_composite]    = `${candidat_id}_${pilier}_${cid}`;
  row[F.candidat_id]      = candidat_id;
  row[F.pilier]           = pilier;
  row[F.circuit_id]       = cid;
  row[F.circuit_nom]      = c.circuit_nom || '';
  row[F.circuit_nom_detail] = c.n1_definition || '';
  row[F.niveau]           = c.circuit_niveau || '';
  row[F.nb_coeur]         = c.circuit_freq_coeur != null ? c.circuit_freq_coeur : 0;
  row[F.nb_total]         = c.circuit_freq_total != null ? c.circuit_freq_total : 0;
  row[F.cluster_label]    = c.circuit_cluster || '';
  row[F.signal_limbique]  = c.circuit_signal || 'NULLE';
  row[F.interpretation]   = c.n3_nuance || '';
  row[F.verbatim_source]  = c.n2_verbatims || '';
  return stripUndefined(row);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS d'extraction des sources (versions initiales — à affiner)
// ═══════════════════════════════════════════════════════════════════════════
function extractGlissements(t1) {
  // Compte les patterns pilier_demande → pilier_gouverne ≠
  const counts = {};
  for (const r of t1 || []) {
    const dem = r.pilier_demande || r.pilier_finalite;
    const gouv = r.pilier_coeur;
    if (dem && gouv && dem !== gouv) {
      const k = `${dem}→${gouv}`;
      counts[k] = (counts[k] || 0) + 1;
    }
  }
  return Object.entries(counts)
    .map(([pattern, count]) => ({ pattern, count }))
    .sort((a, b) => b.count - a.count);
}

function extractBouclesTop3(t1, responses) {
  // Sélection naïve : 3 premières questions avec séquence riche. À affiner.
  return (t1 || []).slice(0, 3).map(r => ({
    id_question: r.id_question, scenario: r.scenario,
    resume_geste: r.resume_geste || r.attribution_pilier_signal_brut || '',
  }));
}

function extractSignaux(t2) {
  return (t2 || [])
    .filter(t => t.signal_limbique_detecte && t.signal_limbique_detecte !== 'NULLE')
    .map(t => ({ circuit: t.circuit_id, signal: t.signal_limbique_detecte, detail: t.signal_limbique_detail }));
}

function compactT1Row(r) {
  return {
    qid: r.id_question, pilier_q: r.pilier_demande, coeur: r.pilier_coeur,
    scenario: r.scenario, resume: r.resume_geste || '',
  };
}

function stripUndefined(obj) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined && v !== null && k !== 'undefined') out[k] = v;
  }
  return out;
}

function trackUsage(usages, costs, res) {
  if (res?.usage) usages.push(res.usage);
  if (typeof res?.cost === 'number') costs.push(res.cost);
}

module.exports = {
  runAgentT3Bilan,
  _internal: {
    computeArchitecture, extractGlissements,
    mapBilanToFields, mapPilierToFields, mapCircuitToFields,
  },
};
