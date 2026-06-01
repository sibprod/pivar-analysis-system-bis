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
  // v11.1 (29/05) : mapping COMPLET architecture + §01-§07 + linked records
  const bilanRow    = mapBilanToFields(candidat_id, sources, bilanGlobal, profilCognitif, architecture, pilierResults);

  // ─── 7. Écrire BILAN d'abord (on a besoin de son recordId pour les liens) ──
  const bilanRecordId = await airtableService.upsertEtape1T3Bilan(candidat_id, bilanRow);

  // ─── 8. Mapper et écrire PILIER avec bilan_link → recordId BILAN ──────────
  const pilierRows  = pilierResults.map(pr =>
    mapPilierToFields(candidat_id, pr, architecture, bilanRecordId, sources)
  );
  const pilierMap   = await airtableService.writeEtape1T3Piliers(candidat_id, pilierRows);
  const nbP = pilierMap.size;

  // ─── 9. Mapper et écrire CIRCUIT avec bilan_link + pilier_link ───────────
  const circuitRows = circuitResults.map(cr => {
    const pilierRecordId = pilierMap.get(cr.pilier) || null;
    const ordrePilier    = architecture.ordered.findIndex(p => p.pilier === cr.pilier) + 1;
    return mapCircuitToFields(candidat_id, cr, bilanRecordId, pilierRecordId, ordrePilier, sources);
  });
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
    signaux_limbiques: extractSignaux(sources.t1),
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
// v11.1 (29/05/2026) — RÉÉCRITURE COMPLÈTE après audit des champs manquants
// (cf. transcript 29/05 : 71/99 champs vides chez Véronique sur ancienne version)
//
// Conventions de lecture du JSON Claude (déduites du prompt v5.3 et de Rémi) :
//   - Bilan global  : { bilan: { §01_vue_globale, §02_filtre_cognitif, §03_glissements,
//                                §04_boucle_cognitive, §05_signal_limbique, §06_couts, §07_signature } }
//   - Chaque section accepte deux formats (défensif) :
//       a) clés FLAT directement dans la section (ex: gl.glissement_1_titre)
//       b) sous-objets (ex: gl.glissement_1.titre, sl.signal.item1.q, sc.cout1.niveau)
//   - L'architecture §01 vient du SERVICE (computeArchitecture), pas de Claude.
// ═══════════════════════════════════════════════════════════════════════════

// Helper : lecture défensive avec fallback sur sous-objet
function pick(...vals) {
  for (const v of vals) if (v !== undefined && v !== null && v !== '') return v;
  return undefined;
}

// Helper : libellé du rôle pour pilier_role_label
const ROLE_LABELS = {
  socle:           '★ Pilier socle — Cœur de votre moteur',
  structurant_1:   'Pilier structurant 1 — Mise en mouvement du socle',
  structurant_2:   'Pilier structurant 2 — Soutien du moteur',
  fonctionnel_1:   'Pilier fonctionnel 1',
  fonctionnel_2:   'Pilier fonctionnel 2 — Sortie de cycle'
};

// Helper : compteurs cœur depuis l'inventaire de circuits du candidat
function computePilierCounters(pilier, sources) {
  const circuits = (sources.inventaireCircuits || []).filter(c =>
    (c.pilier_owner === pilier) || (c.circuit_label || '').startsWith(pilier)
  );
  let nb_activations = 0, nb_circuits_actifs = 0, nb_circuits_haut = 0;
  for (const c of circuits) {
    const coeur = Number(c.nb_coeur || 0);
    if (coeur > 0) {
      nb_activations    += coeur;
      nb_circuits_actifs += 1;
      if (coeur >= 4) nb_circuits_haut += 1;
    }
  }
  return { nb_activations, nb_circuits_actifs, nb_circuits_haut };
}

// Helper : signal limbique dominant du pilier (depuis T1)
// v11.2 (29/05) FIX : les signaux limbiques sont dans T1.signal_limbique
// (texte libre type "sérénité affichée · \"...\""), filtrés sur le pilier
// du candidat (pilier_demande OU pilier_coeur = pilier ciblé).
function computeSignalLabel(pilier, sources) {
  const sigs = (sources.t1 || [])
    .filter(r => (r.pilier_demande === pilier) || (r.pilier_coeur === pilier))
    .map(r => (r.signal_limbique || '').trim())
    .filter(s => s && s.toLowerCase() !== 'nulle' && s.toLowerCase() !== 'aucun');
  if (sigs.length === 0) return 'NULLE';
  // On extrait le type (avant le ·) pour la tétière compacte
  const first = sigs[0];
  const idx = first.indexOf('·');
  return idx > 0 ? first.slice(0, idx).trim() : first;
}

function mapBilanToFields(candidat_id, sources, bilanGlobal, profilCognitif, architecture, pilierResults) {
  const F = airtableConfig.ETAPE1_T3_BILAN_FIELDS;
  const b  = (bilanGlobal && bilanGlobal.bilan) || {};
  const vg = b['§01_vue_globale']      || {};
  const fc = b['§02_filtre_cognitif']  || {};
  const gl = b['§03_glissements']      || {};
  const bc = b['§04_boucle_cognitive'] || {};
  const sl = b['§05_signal_limbique']  || {};
  const sc = b['§06_couts']            || {};
  const sg = b['§07_signature']        || {};

  // pilierResults = [{ pilierArch: {...}, update: { pilier_mode, ... } }]
  // → on récupère le mode du pilier socle pour le pousser dans T3_BILAN.pilier_socle_mode
  const socleResult = (pilierResults || []).find(pr => pr.pilierArch?.role === 'socle');
  const pilierSocleMode = socleResult?.update?.pilier_mode || '';

  // Sous-objets pour le format imbriqué (signal items + coûts)
  const si1 = sl.item1 || {}; const si2 = sl.item2 || {};
  const si3 = sl.item3 || {}; const si4 = sl.item4 || {};
  const cT1 = sc.cout1 || {}; const cT2 = sc.cout2 || {}; const cT3 = sc.cout3 || {};
  const g1 = gl.glissement_1 || {}; const g2 = gl.glissement_2 || {};
  const g3 = gl.glissement_3 || {}; const g4 = gl.glissement_4 || {};
  const b1 = bc.boucle_1 || {}; const b2 = bc.boucle_2 || {}; const b3 = bc.boucle_3 || {};

  const row = {};

  // ── Identité ──
  row[F.candidat_id]   = candidat_id;
  if (sources.visiteur) {
    row[F.prenom] = sources.visiteur.Prenom || sources.visiteur.prenom || '';
    row[F.nom]    = sources.visiteur.Nom    || sources.visiteur.nom    || '';
  }
  row[F.civilite]      = sources.civilite || '';
  row[F.version_bilan] = 'v2';

  // ── §01 ARCHITECTURE (source : computeArchitecture, PAS Claude) ──
  // Ordre : ordered[0]=socle, [1]=str1, [2]=str2, [3]=fn1, [4]=fn2 (5 piliers garantis)
  const ord = architecture.ordered;
  const pSocle = ord[0], pStr1 = ord[1], pStr2 = ord[2], pFn1 = ord[3], pFn2 = ord[4];
  const sortiesParPilier = {};
  for (const v of (sources.ventilationPiliers || [])) {
    sortiesParPilier[v.pilier_coeur] = v.nb_reponses || 0;
  }
  if (pSocle) {
    row[F.pilier_socle]       = pSocle.pilier;
    row[F.pilier_socle_label] = pSocle.pilier_label;
    row[F.pilier_socle_role]  = ROLE_LABELS[pSocle.role] || pSocle.role;
    row[F.pilier_socle_mode]  = pilierSocleMode || pick(vg.pilier_socle_mode, '');
  }
  if (pStr1) {
    row[F.pilier_str1]         = pStr1.pilier;
    row[F.pilier_str1_label]   = pStr1.pilier_label;
    row[F.pilier_str1_sorties] = sortiesParPilier[pStr1.pilier] || 0;
  }
  if (pStr2) {
    row[F.pilier_str2]         = pStr2.pilier;
    row[F.pilier_str2_label]   = pStr2.pilier_label;
    row[F.pilier_str2_sorties] = sortiesParPilier[pStr2.pilier] || 0;
  }
  if (pFn1) {
    row[F.pilier_fn1]          = pFn1.pilier;
    row[F.pilier_fn1_label]    = pFn1.pilier_label;
    row[F.pilier_fn1_sorties]  = sortiesParPilier[pFn1.pilier] || 0;
  }
  if (pFn2) {
    row[F.pilier_fn2]          = pFn2.pilier;
    row[F.pilier_fn2_label]    = pFn2.pilier_label;
    row[F.pilier_fn2_sorties]  = sortiesParPilier[pFn2.pilier] || 0;
  }
  row[F.sorties_P1] = sortiesParPilier['P1'] || 0;
  row[F.sorties_P2] = sortiesParPilier['P2'] || 0;
  row[F.sorties_P3] = sortiesParPilier['P3'] || 0;
  row[F.sorties_P4] = sortiesParPilier['P4'] || 0;
  row[F.sorties_P5] = sortiesParPilier['P5'] || 0;
  row[F.note_profil_global] = pick(vg.note_profil_global, vg.note, '');

  // ── §02 FILTRE COGNITIF (7 champs) ──
  row[F.filtre_label]            = pick(fc.filtre_label, fc.label, '');
  row[F.filtre_preuve_1]         = pick(fc.filtre_preuve_1, fc.preuve_1, fc.preuves?.[0], '');
  row[F.filtre_preuve_2]         = pick(fc.filtre_preuve_2, fc.preuve_2, fc.preuves?.[1], '');
  row[F.filtre_preuve_3]         = pick(fc.filtre_preuve_3, fc.preuve_3, fc.preuves?.[2], '');
  row[F.filtre_preuve_4]         = pick(fc.filtre_preuve_4, fc.preuve_4, fc.preuves?.[3], '');
  row[F.filtre_preuve_5]         = pick(fc.filtre_preuve_5, fc.preuve_5, fc.preuves?.[4], '');
  row[F.filtre_lecture_candidat] = pick(fc.filtre_lecture_candidat, fc.lecture_candidat, '');

  // ── §03 GLISSEMENTS (14 champs) ──
  row[F.glissement_intro]      = pick(gl.glissement_intro, gl.intro, '');
  row[F.glissement_1_label]    = pick(gl.glissement_1_label, g1.label, '');
  row[F.glissement_1_titre]    = pick(gl.glissement_1_titre, g1.titre, '');
  row[F.glissement_1_corps]    = pick(gl.glissement_1_corps, g1.corps, '');
  row[F.glissement_2_label]    = pick(gl.glissement_2_label, g2.label, '');
  row[F.glissement_2_titre]    = pick(gl.glissement_2_titre, g2.titre, '');
  row[F.glissement_2_corps]    = pick(gl.glissement_2_corps, g2.corps, '');
  row[F.glissement_3_label]    = pick(gl.glissement_3_label, g3.label, '');
  row[F.glissement_3_titre]    = pick(gl.glissement_3_titre, g3.titre, '');
  row[F.glissement_3_corps]    = pick(gl.glissement_3_corps, g3.corps, '');
  row[F.glissement_4_label]    = pick(gl.glissement_4_label, g4.label, '');
  row[F.glissement_4_titre]    = pick(gl.glissement_4_titre, g4.titre, '');
  row[F.glissement_4_corps]    = pick(gl.glissement_4_corps, g4.corps, '');
  row[F.glissements_conclusion]= pick(gl.glissements_conclusion, gl.conclusion, '');

  // ── §04 BOUCLES COGNITIVES (16 champs) ──
  row[F.boucle_intro]      = pick(bc.boucle_intro, bc.intro, '');
  row[F.boucle_1_label]    = pick(bc.boucle_1_label, b1.label, '');
  row[F.boucle_1_scenario] = pick(bc.boucle_1_scenario, b1.scenario, '');
  row[F.boucle_1_reponse]  = pick(bc.boucle_1_reponse, b1.reponse, '');
  row[F.boucle_1_sequence] = pick(bc.boucle_1_sequence, b1.sequence, '');
  row[F.boucle_1_labo]     = pick(bc.boucle_1_labo, b1.labo, '');
  row[F.boucle_2_label]    = pick(bc.boucle_2_label, b2.label, '');
  row[F.boucle_2_scenario] = pick(bc.boucle_2_scenario, b2.scenario, '');
  row[F.boucle_2_reponse]  = pick(bc.boucle_2_reponse, b2.reponse, '');
  row[F.boucle_2_sequence] = pick(bc.boucle_2_sequence, b2.sequence, '');
  row[F.boucle_2_labo]     = pick(bc.boucle_2_labo, b2.labo, '');
  row[F.boucle_3_label]    = pick(bc.boucle_3_label, b3.label, '');
  row[F.boucle_3_scenario] = pick(bc.boucle_3_scenario, b3.scenario, '');
  row[F.boucle_3_reponse]  = pick(bc.boucle_3_reponse, b3.reponse, '');
  row[F.boucle_3_sequence] = pick(bc.boucle_3_sequence, b3.sequence, '');
  row[F.boucle_3_labo]     = pick(bc.boucle_3_labo, b3.labo, '');

  // ── §05 SIGNAL LIMBIQUE (15 champs) ──
  row[F.signal_type]            = pick(sl.signal_type, sl.type, '');
  row[F.signal_intro]           = pick(sl.signal_intro, sl.intro, '');
  row[F.signal_item1_q]         = pick(sl.signal_item1_q, si1.q, si1.question, '');
  row[F.signal_item1_corps]     = pick(sl.signal_item1_corps, si1.corps, '');
  row[F.signal_item1_verbatim]  = pick(sl.signal_item1_verbatim, si1.verbatim, '');
  row[F.signal_item2_q]         = pick(sl.signal_item2_q, si2.q, si2.question, '');
  row[F.signal_item2_corps]     = pick(sl.signal_item2_corps, si2.corps, '');
  row[F.signal_item2_verbatim]  = pick(sl.signal_item2_verbatim, si2.verbatim, '');
  row[F.signal_item3_q]         = pick(sl.signal_item3_q, si3.q, si3.question, '');
  row[F.signal_item3_corps]     = pick(sl.signal_item3_corps, si3.corps, '');
  row[F.signal_item3_verbatim]  = pick(sl.signal_item3_verbatim, si3.verbatim, '');
  row[F.signal_item4_q]         = pick(sl.signal_item4_q, si4.q, si4.question, '');
  row[F.signal_item4_corps]     = pick(sl.signal_item4_corps, si4.corps, '');
  row[F.signal_item4_verbatim]  = pick(sl.signal_item4_verbatim, si4.verbatim, '');
  row[F.signal_synthese]        = pick(sl.signal_synthese, sl.synthese, '');

  // ── §06 COÛTS (12 champs) ──
  row[F.cout1_niveau]   = pick(sc.cout1_niveau, cT1.niveau, '');
  row[F.cout1_titre]    = pick(sc.cout1_titre,  cT1.titre,  '');
  row[F.cout1_corps]    = pick(sc.cout1_corps,  cT1.corps,  '');
  row[F.cout1_verbatim] = pick(sc.cout1_verbatim, cT1.verbatim, '');
  row[F.cout2_niveau]   = pick(sc.cout2_niveau, cT2.niveau, '');
  row[F.cout2_titre]    = pick(sc.cout2_titre,  cT2.titre,  '');
  row[F.cout2_corps]    = pick(sc.cout2_corps,  cT2.corps,  '');
  row[F.cout2_verbatim] = pick(sc.cout2_verbatim, cT2.verbatim, '');
  row[F.cout3_niveau]   = pick(sc.cout3_niveau, cT3.niveau, '');
  row[F.cout3_titre]    = pick(sc.cout3_titre,  cT3.titre,  '');
  row[F.cout3_corps]    = pick(sc.cout3_corps,  cT3.corps,  '');
  row[F.cout3_verbatim] = pick(sc.cout3_verbatim, cT3.verbatim, '');

  // ── §07 SIGNATURE (6 champs) ──
  row[F.sig_pilier_label]    = pick(sg.sig_pilier_label, sg.pilier_label, '');
  row[F.sig_filtre_val]      = pick(sg.sig_filtre_val, sg.filtre_val, fc.filtre_label, '');
  row[F.sig_finalite]        = pick(sg.sig_finalite, sg.finalite, '');
  row[F.sig_resultat_ligne1] = pick(sg.sig_resultat_ligne1, sg.resultat_ligne1, sg.ligne1, '');
  row[F.sig_resultat_ligne2] = pick(sg.sig_resultat_ligne2, sg.resultat_ligne2, sg.ligne2, '');
  row[F.sig_recit]           = pick(sg.sig_recit, sg.recit, '');

  // ── §02bis PROFIL COGNITIF (le Soleil) — stockage JSON en bloc (v6.1, 2026-06-01) ──
  // profilCognitif = res0bis.result. Formes possibles :
  //   { §02bis_profil_cognitif: {...} }  ou  { bilan: { §02bis_profil_cognitif: {...} } }
  // On stocke l'objet §02bis sérialisé en un seul champ pour garantir l'intégrité (5 piliers
  // toujours en perspective, pas de risque d'oubli d'une branche).
  const soleil = (profilCognitif && (
    (profilCognitif.bilan && profilCognitif.bilan['§02bis_profil_cognitif']) ||
    profilCognitif['§02bis_profil_cognitif'] ||
    profilCognitif
  )) || null;
  if (soleil && typeof soleil === 'object') {
    row[F.profil_cognitif_json] = JSON.stringify(soleil);
  }

  return stripUndefined(row);
}

function mapPilierToFields(candidat_id, pilierResult, architecture, bilanRecordId, sources) {
  const F  = airtableConfig.ETAPE1_T3_PILIER_FIELDS;
  const u  = pilierResult.update || {};
  const pa = pilierResult.pilierArch;
  const counters = computePilierCounters(pa.pilier, sources);
  const signalLabel = computeSignalLabel(pa.pilier, sources);
  // Tétière "Sortie X/25 · Signal Y · N activations · M circuits actifs · K HAUT"
  const sorties = (sources.ventilationPiliers || []).find(v => v.pilier_coeur === pa.pilier);
  const sortiesN = sorties ? (sorties.nb_reponses || 0) : 0;
  const rappel = `Sortie ${sortiesN}/25 · Signal ${signalLabel} · ${counters.nb_activations} activations · ${counters.nb_circuits_actifs} circuits actifs · ${counters.nb_circuits_haut} HAUT`;

  const row = {};
  row[F.candidat_id]        = candidat_id;
  row[F.cle_composite]      = `${candidat_id}_${pa.pilier}`;
  row[F.pilier]             = pa.pilier;
  row[F.pilier_label]       = pa.pilier_label || '';
  row[F.role_pilier]        = pa.role;
  row[F.pilier_role_label]  = ROLE_LABELS[pa.role] || pa.role;
  row[F.pilier_mode]        = u.pilier_mode || '';
  row[F.pilier_rappel]      = rappel;
  row[F.nb_activations]     = counters.nb_activations;
  row[F.nb_circuits_actifs] = counters.nb_circuits_actifs;
  row[F.nb_circuits_haut]   = counters.nb_circuits_haut;
  row[F.cluster_label]      = u.cluster_label || '';
  row[F.cluster_detail]     = u.cluster_detail || (u.cluster_label ? '' : 'Aucun cluster détecté au seuil protocole.');
  row[F.tableau_note]       = u.tableau_note || u.synth_factuelle_coeur || '';
  row[F.synth_factuelle]    = u.synth_factuelle_elargie || u.synth_factuelle || '';
  row[F.synth_interpretee]  = u.synth_interpretee || '';
  if (bilanRecordId) row[F.bilan_link] = [bilanRecordId];
  return stripUndefined(row);
}

function mapCircuitToFields(candidat_id, circuitResult, bilanRecordId, pilierRecordId, ordrePilier, sources) {
  const F = airtableConfig.ETAPE1_T3_CIRCUIT_FIELDS;
  const c = circuitResult.circuit || {};
  const pilier = circuitResult.pilier;
  const cid = c.circuit_id || (c.is_adhoc ? 'ADHOC' : '');
  const row = {};
  row[F.circuit_uid]      = `${candidat_id}_${pilier}_${cid}`;
  row[F.candidat_id]      = candidat_id;
  row[F.pilier]           = pilier;
  row[F.circuit_id]       = cid;
  row[F.circuit_nom]      = c.circuit_nom || '';
  row[F.n1_definition]    = c.n1_definition || '';
  row[F.n2_verbatims]     = c.n2_verbatims || '';
  row[F.n3_nuance]        = c.n3_nuance || '';
  row[F.circuit_niveau]   = c.circuit_niveau || '';
  // 3 compteurs distincts : freq=total cœur, franches, nuancees
  row[F.circuit_freq]      = (c.circuit_freq != null) ? c.circuit_freq
                            : (c.circuit_freq_coeur != null) ? c.circuit_freq_coeur : 0;
  row[F.circuit_franches]  = (c.circuit_franches != null) ? c.circuit_franches : 0;
  row[F.circuit_nuancees]  = (c.circuit_nuancees != null) ? c.circuit_nuancees : 0;

  // ── Ventilation par pilier (v6.1, 2026-06-01) — source autoritaire : T2_INVENTAIRE_CIRCUITS ──
  // On retrouve le record d'inventaire de CE circuit (même pilier_owner + circuit_id) et on recopie
  // ses nb_svc_P1..P5. "Plus c'est près de la source, mieux c'est" : la ventilation devient un attribut
  // du circuit dans T3, requêtable pour le matching futur.
  const inv = (sources && Array.isArray(sources.inventaireCircuits)) ? sources.inventaireCircuits : [];
  const invRow = inv.find(ic => {
    const owner = ic.pilier_owner || ic.pilier || '';
    const icid  = ic.circuit_id || (ic.circuit_origine === 'AD_HOC' ? 'ADHOC' : '');
    return owner === pilier && icid === cid;
  }) || {};
  row[F.en_svc_P1] = invRow.nb_svc_P1 != null ? invRow.nb_svc_P1 : 0;
  row[F.en_svc_P2] = invRow.nb_svc_P2 != null ? invRow.nb_svc_P2 : 0;
  row[F.en_svc_P3] = invRow.nb_svc_P3 != null ? invRow.nb_svc_P3 : 0;
  row[F.en_svc_P4] = invRow.nb_svc_P4 != null ? invRow.nb_svc_P4 : 0;
  row[F.en_svc_P5] = invRow.nb_svc_P5 != null ? invRow.nb_svc_P5 : 0;

  row[F.circuit_cluster]   = c.circuit_cluster || c.cluster || '';
  row[F.circuit_signal]    = c.circuit_signal || c.signal_limbique || 'NULLE';
  if (c.rang_dans_pilier != null || c.ordre_circuit != null) {
    row[F.ordre_circuit]   = c.ordre_circuit != null ? c.ordre_circuit : c.rang_dans_pilier;
  }
  if (ordrePilier) row[F.ordre_pilier] = ordrePilier;
  if (bilanRecordId)  row[F.bilan_link]  = [bilanRecordId];
  if (pilierRecordId) row[F.pilier_link] = [pilierRecordId];
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

function extractSignaux(t1) {
  // v11.2 (29/05) FIX CRITIQUE : les signaux limbiques sont stockés dans T1
  // (champ signal_limbique, texte libre format "type · \"verbatim\"") et NON
  // dans T2. L'ancienne version filtrait t.signal_limbique_detecte !== 'NULLE'
  // sur T2 où ce champ n'existe pas → retournait toujours [] → l'agent recevait
  // signaux_limbiques: [] → écrivait "NULLE" / "Aucun signal limbique documenté"
  // même chez des candidats avec des signaux réels (cas Véronique 29/05).
  return (t1 || [])
    .filter(r => {
      const s = (r.signal_limbique || '').trim();
      return s && s.toLowerCase() !== 'nulle' && s.toLowerCase() !== 'aucun';
    })
    .map(r => {
      const raw = (r.signal_limbique || '').trim();
      // Format attendu : "type · \"verbatim\""  ex : "sérénité affichée · \"...\""
      // On sépare type / verbatim si possible, sinon on passe le brut.
      let type = raw, verbatim = '';
      const idx = raw.indexOf('·');
      if (idx > 0) {
        type = raw.slice(0, idx).trim();
        verbatim = raw.slice(idx + 1).trim().replace(/^["«»]+|["«»]+$/g, '').trim();
      }
      return {
        id_question:   r.id_question || '',
        scenario:      r.scenario || '',
        pilier_demande:r.pilier_demande || '',
        pilier_coeur:  r.pilier_coeur || '',
        signal_type:   type,
        signal_verbatim: verbatim,
        signal_raw:    raw,
        verbatim_candidat: r.verbatim_candidat || ''
      };
    });
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
