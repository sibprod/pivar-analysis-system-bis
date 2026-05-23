// services/etape1/agentT2_phase1_attribution_Service.js
// Agent d'ATTRIBUTION — ÉTAPE 2 / Phase 1 — v1.0 (21/05/2026)
// Profil-Cognitif — Refonte v10.8
//
// ⚠️ AVANT MODIFICATION : lire docs/PLAN_CORRECTION_v10_8.md
//                       et le prompt prompts/etape1/etape1_t2_phase1_attribution.txt (v1.0)
//
// ───────────────────────────────────────────────────────────────────────────
// CONTEXTE DOCTRINAL — Refonte 21/05/2026
// ───────────────────────────────────────────────────────────────────────────
//
// La refonte v10.8 sépare l'ancienne étape 2 monolithique en DEUX services :
//
//   1. agentT2_phase1_attribution_Service (ce service)
//      → Pour chaque entrée de types_verbatim de ETAPE1_T1, attribue UN circuit
//        (FRANCHE / NUANCÉE / AD_HOC / NON_ATTRIBUÉE)
//      → Crée immédiatement les ad hoc nécessaires dans
//        REFERENTIEL_CIRCUITS_CANDIDATS
//      → Écrit la colonne types_verbatim_circuits sur les 25 lignes ETAPE1_T1
//      → 1 appel Claude par candidat
//
//   2. agentT2_phase2_consolidation_Service (autre service)
//      → Lit types_verbatim_circuits des 25 lignes ETAPE1_T1
//      → Consolide mécaniquement par circuit (fréquence, niveau, franches,
//        nuancées, clusters, commentaire)
//      → Écrit ETAPE1_T2
//      → AUCUN appel Claude (purement mécanique)
//
// ───────────────────────────────────────────────────────────────────────────
// POURQUOI CETTE SÉPARATION
// ───────────────────────────────────────────────────────────────────────────
//
// L'analyse comparée Cécile/Rémi/Véronique du 21/05/2026 a révélé 4 faiblesses
// du pipeline monolithique :
//   - Plafond MOYEN suspect (aucun circuit secondaire en HAUT)
//   - Dispersion excessive (gestes similaires fractionnés sur N circuits)
//   - Pilier muet (P5 Rémi : 1 circuit / 2 activations sur 25 questions)
//   - Zéro ad hoc créé (improbable statistiquement)
//
// Cause racine : l'agent T2 unique faisait lecture + attribution + consolidation
// en boîte noire, sans trace intermédiaire vérifiable.
//
// La séparation force :
//   - L'attribution geste par geste avec trace (types_verbatim_circuits)
//   - L'exhaustivité (impossible d'oublier un geste de types_verbatim)
//   - La création d'ad hoc quand aucun circuit officiel ne matche (règle dure)
//   - La consolidation 100% mécanique (impossible d'inventer ou de perdre)
//
// ───────────────────────────────────────────────────────────────────────────
// RÈGLES DURES NON NÉGOCIABLES
// ───────────────────────────────────────────────────────────────────────────
//
//   - EXHAUSTIVITÉ : chaque entrée de types_verbatim reçoit exactement UNE
//     attribution. Aucune omission silencieuse possible.
//   - PILIER IMMUABLE : le pilier d'un geste vient de T1, jamais modifié.
//   - CRÉATION AD HOC IMMÉDIATE : si aucun officiel ne matche, on crée
//     l'ad hoc DURANT le run, immédiatement disponible pour les gestes
//     suivants du même candidat.
//   - SYMÉTRIE DES NUANCES : C_X nuancée avec [C_Y] => C_Y nuancée avec [C_X].
//   - CONVENTIONS STYLISTIQUES AD HOC : nom_propose en forme nominale,
//     transposable, 40-60 caractères, raccord REFERENTIEL_CIRCUITS pour
//     import manuel CTO.

'use strict';

const fs              = require('fs').promises;
const path            = require('path');
const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const SERVICE_NAME = 'agent_t2';  // ⭐ v10.8 — réutilise la clé MAX_TOKENS existante de l'ancien agent T2
const PROMPT_PATH  = 'etape1/etape1_t2_phase1_attribution.txt';

// ⭐ v11.0 (23/05/2026) — Mapping doctrinal injecté dans le payload
// Dossier contenant les 5 mappings doctrinaux par pilier (un .md par pilier).
// Voir new-prompts/doctrine/mapping_P{1,2,3,4,5}.md
const MAPPING_DOCTRINAL_DIR = path.join(__dirname, '../../new-prompts/doctrine');

// Types d'attribution valides
const VALID_TYPE_ATTRIBUTION = ['FRANCHE', 'NUANCEE', 'AD_HOC', 'NON_ATTRIBUEE'];

// Origines de circuit valides
const VALID_CIRCUIT_ORIGINE = ['OFFICIEL', 'AD_HOC_EXISTANT', 'AD_HOC_NOUVEAU', null];

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute l'agent d'attribution pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {string} [params.session_id]  Optionnel — résolu depuis T1 si absent
 * @returns {Promise<{
 *   attributions_par_ligne: Array,
 *   circuits_ad_hoc_nouveaux: Array,
 *   stats: Object,
 *   usage: Object,
 *   cost: number,
 *   elapsedMs: number
 * }>}
 */
async function runAttribution({ candidat_id, session_id = null }) {
  const startTime = Date.now();
  logger.info('Agent attribution starting', { candidat_id });

  // ─── 1. Récupérer la civilité (anonymisation) ─────────────────────────
  const civilite = await airtableService.getCiviliteCandidat(candidat_id);

  // ─── 2. Lire les 25 lignes ETAPE1_T1 ──────────────────────────────────
  const lignesT1 = await airtableService.getEtape1T1(candidat_id);
  if (!lignesT1 || lignesT1.length === 0) {
    throw new Error(
      `Agent attribution — aucune ligne ETAPE1_T1 pour ${candidat_id}. ` +
      `T1 doit avoir tourné avant l'attribution.`
    );
  }
  if (lignesT1.length < 25) {
    logger.warn('Agent attribution — moins de 25 lignes T1', {
      candidat_id, count: lignesT1.length
    });
  }

  // ─── 3. Résoudre session_id depuis T1 si pas fourni ───────────────────
  // Doctrine projet : session_id == candidat_id (le visiteur a un identifiant
  // unique partagé entre VISITEUR.candidate_ID et RESPONSES.session_ID).
  // Donc si le champ n'existe pas dans ETAPE1_T1, on retombe sur candidat_id.
  if (!session_id) {
    session_id = lignesT1[0].session_ID || lignesT1[0].session_id || candidat_id;
    logger.info('Agent attribution — session_id résolu', {
      candidat_id, session_id, source: lignesT1[0].session_ID ? 'T1' : 'fallback_candidat_id'
    });
  }

  // ─── 4. Lire les 25 lignes RESPONSES (pour les 6 champs cog_*) ─────────
  const responses = await airtableService.getResponsesBySession(session_id);
  if (!responses || responses.length === 0) {
    throw new Error(
      `Agent attribution — aucune ligne RESPONSES pour session ${session_id}.`
    );
  }

  // ─── 5. Lire le référentiel des 75 circuits officiels ─────────────────
  const referentiel75 = await airtableService.getReferentielCircuits();
  if (!referentiel75 || referentiel75.length === 0) {
    throw new Error(
      'Agent attribution — REFERENTIEL_CIRCUITS vide ou inaccessible.'
    );
  }
  if (referentiel75.length !== 75) {
    logger.warn('Agent attribution — REFERENTIEL_CIRCUITS ne contient pas 75 records', {
      count: referentiel75.length
    });
  }

  // ─── 6. Lire les ad hoc existants (EN_ATTENTE + PROMU_AUTO) ───────────
  // Les EN_ATTENTE sont en cours de veille. Les PROMU_AUTO ont passé le seuil
  // de promotion mais n'ont pas encore été créés en circuit officiel par
  // la CTO — on les considère comme disponibles pour réutilisation.
  const adHocEnAttente = await airtableService.getCircuitsAdHocByStatut('EN_ATTENTE');
  const adHocPromuAuto = await airtableService.getCircuitsAdHocByStatut('PROMU_AUTO');
  const adHocExistants = [...adHocEnAttente, ...adHocPromuAuto];

  // ─── 7. Construire le payload pour Claude ─────────────────────────────
  const payload = await buildPayload({
    candidat_id,
    civilite,
    lignesT1,
    responses,
    referentiel75,
    adHocExistants
  });

  // ─── 8. Appeler Claude (1 seul appel) ─────────────────────────────────
  const { result, usage, cost, elapsedMs: callMs } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: false,
    candidatId:    candidat_id
  });

  // ─── 9. Extraire et valider la sortie ─────────────────────────────────
  const { attributions_par_ligne, circuits_ad_hoc_nouveaux } = extractOutput(result);
  validateAttributionOutput({
    attributions_par_ligne,
    circuits_ad_hoc_nouveaux,
    lignesT1,
    referentiel75,
    adHocExistants,
    candidat_id
  });

  // ─── 10. Créer les ad hoc nouveaux dans REFERENTIEL_CIRCUITS_CANDIDATS ─
  // On crée tous les ad hoc avant d'écrire dans ETAPE1_T1, pour que la
  // référence vers un ad hoc nouveau soit déjà valide (et pour incrémenter
  // les compteurs / déclencher la promotion automatique si seuil franchi).
  const adHocCreationMap = new Map(); // id_temporaire → { nom_propose, ... }
  for (const adHocNouveau of circuits_ad_hoc_nouveaux) {
    adHocCreationMap.set(adHocNouveau.id_temporaire, adHocNouveau);
  }
  const adHocStats = await processAdHocCreations({
    candidat_id,
    circuits_ad_hoc_nouveaux,
    attributions_par_ligne
  });

  // ─── 11. Formatter types_verbatim_circuits par ligne T1 ───────────────
  const updatesT1 = formatAttributionsForT1Update({
    attributions_par_ligne,
    lignesT1,
    adHocCreationMap
  });

  // ─── 12. Écrire types_verbatim_circuits sur les 25 lignes T1 ─────────
  await airtableService.updateTypesVerbatimCircuits(updatesT1);

  // ─── 13. Stats finales ────────────────────────────────────────────────
  const totalMs = Date.now() - startTime;
  const totalAttributions = attributions_par_ligne.reduce(
    (sum, ligne) => sum + (ligne.attributions || []).length, 0
  );
  const stats = {
    nb_lignes_t1_traitees:        attributions_par_ligne.length,
    nb_attributions_totales:      totalAttributions,
    nb_attributions_franches:     countByType(attributions_par_ligne, 'FRANCHE'),
    nb_attributions_nuancees:     countByType(attributions_par_ligne, 'NUANCEE'),
    nb_attributions_ad_hoc:       countByType(attributions_par_ligne, 'AD_HOC'),
    nb_attributions_non_attr:     countByType(attributions_par_ligne, 'NON_ATTRIBUEE'),
    nb_ad_hoc_nouveaux_crees:     adHocStats.crees,
    nb_ad_hoc_increment_principal: adHocStats.incrementes_principal,
    nb_ad_hoc_increment_autres:   adHocStats.incrementes_autres,
    nb_ad_hoc_skipped:            adHocStats.skipped,
    nb_promotions_auto:           adHocStats.promotions_auto,
    nb_flags_arbitrage:           adHocStats.flags_arbitrage,
    nb_erreurs_ad_hoc:            adHocStats.erreurs,
    elapsed_call_ms:              callMs,
    elapsed_total_ms:             totalMs,
    cost_usd:                     cost
  };

  logger.info('Agent attribution completed', { candidat_id, ...stats });

  return {
    attributions_par_ligne,
    circuits_ad_hoc_nouveaux,
    stats,
    usage,
    cost,
    elapsedMs: totalMs
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION DU PAYLOAD
// ═══════════════════════════════════════════════════════════════════════════

/**
 * ⭐ v11.0 (23/05/2026) — Extrait les piliers (P1..P5) présents dans les gestes
 * des 25 lignes T1 d'un candidat, en parsant les chaînes `types_verbatim`.
 *
 * Format attendu d'une cellule `types_verbatim` (chaîne libre produite par T1) :
 *   "P4 · Exploration d'angles inhabituels — \"verbatim...\" P1 · Consultation du réseau — \"verbatim...\""
 *
 * On extrait simplement les codes P1..P5 par regex `/\bP[1-5]\b/g`,
 * puis on déduplique. La granularité par geste n'est pas nécessaire :
 * on ne charge un mapping pilier que si au moins un geste y est présent.
 *
 * @param {Array<Object>} lignesT1
 * @returns {Array<string>} Piliers présents, ex : ['P1', 'P4', 'P5']
 */
function extractPiliersFromLignesT1(lignesT1) {
  const piliers = new Set();
  for (const t1 of lignesT1) {
    const tv = t1.types_verbatim;
    if (typeof tv === 'string' && tv.length > 0) {
      const matches = tv.match(/\bP[1-5]\b/g);
      if (matches) {
        for (const m of matches) piliers.add(m);
      }
    }
  }
  return [...piliers].sort();  // ordre déterministe : P1, P2, P3, P4, P5
}

/**
 * ⭐ v11.0 (23/05/2026) — Charge les mappings doctrinaux des piliers présents.
 *
 * Les mappings sont versionnés dans le dépôt sous doctrine/mappings/.
 * Chargement à l'exécution (pas de mise en cache global) — coût négligeable
 * (~5 lectures de fichier Markdown par run de candidat).
 *
 * Comportement défensif : si un fichier de mapping est absent, on log un warn
 * mais on ne bloque pas le pipeline — le payload contiendra simplement
 * `mapping_doctrinal_P{x}: null` pour ce pilier.
 *
 * @param {Array<string>} piliersPresents Ex : ['P1', 'P4', 'P5']
 * @returns {Promise<Object>} Ex : { mapping_doctrinal_P1: "...", mapping_doctrinal_P4: "...", ... }
 */
async function loadMappingsDoctrinaux(piliersPresents) {
  const mappings = {};
  for (const pilier of piliersPresents) {
    const filePath = path.join(MAPPING_DOCTRINAL_DIR, `mapping_${pilier}.md`);
    try {
      mappings[`mapping_doctrinal_${pilier}`] = await fs.readFile(filePath, 'utf8');
    } catch (err) {
      logger.warn('Mapping doctrinal absent — payload sans mapping pour ce pilier', {
        pilier,
        filePath,
        error: err.message
      });
      mappings[`mapping_doctrinal_${pilier}`] = null;
    }
  }
  return mappings;
}

/**
 * Construit le payload JSON envoyé à Claude pour l'attribution.
 *
 * Le prompt etape1_t2_phase1_attribution.txt attend cette structure exacte.
 *
 * ⭐ v11.0 (23/05/2026) — Devient async pour permettre l'injection des mappings
 * doctrinaux des piliers présents (lecture des .md dans doctrine/mappings/).
 */
async function buildPayload({
  candidat_id,
  civilite,
  lignesT1,
  responses,
  referentiel75,
  adHocExistants
}) {
  // ─── Sélection des champs T1 nécessaires pour l'attribution ──────────
  const lignes_t1 = lignesT1.map(t1 => ({
    id_question:                   t1.id_question || null,
    question_id_protocole:         t1.question_id_protocole || t1.id_question || null,
    scenario:                      t1.scenario || null,
    pilier_demande:                t1.pilier_demande || null,
    verbatim_candidat:             t1.verbatim_candidat || null,
    pilier_coeur:                  extractLookup(t1.pilier_coeur),
    pilier_coeur_analyse:          t1.pilier_coeur_analyse || null,
    outil_cognitif_libelle:        t1.outil_cognitif_libelle || null,
    piliers_traverses:             t1.piliers_traverses || null,
    piliers_secondaires:           t1.piliers_secondaires || null,
    types_verbatim:                t1.types_verbatim || null,
    attribution_pilier_signal_brut: t1.attribution_pilier_signal_brut || null,
    verbes_angles_piliers:         t1.verbes_angles_piliers || null,
    signal_limbique:               t1.signal_limbique || null,
    finalite_reponse:              t1.finalite_reponse || null,
    pilier_finalite:               extractLookup(t1.pilier_finalite)
  }));

  // ─── Sélection des champs RESPONSES nécessaires (6 cog_* + texte) ────
  const responses_t1 = responses.map(r => ({
    session_ID:               r.session_ID || r.session_id || null,
    id_question:              r.id_question || null,
    scenario_nom:             r.scenario_nom || r.scenario || null,
    pilier:                   r.pilier || null,
    question_text:            r.question_text || null,
    response_text:            r.response_text || null,
    cog_comprend:             r.cog_comprend || null,
    cog_outils_mobilises:     r.cog_outils_mobilises || null,
    cog_pilier_gouverne:      r.cog_pilier_gouverne || null,
    cog_gouverne_commentaire: r.cog_gouverne_commentaire || null,
    cog_pilier_sortie:        r.cog_pilier_sortie || null,
    cog_sortie_commentaire:   r.cog_sortie_commentaire || null,
    cog_resultat_vise:        r.cog_resultat_vise || null
  }));

  // ─── Référentiel des 75 circuits (forme compacte avec geste doctrinal) ─
  // On groupe par pilier pour faciliter le matching de Claude.
  const referentiel_75_par_pilier = { P1: [], P2: [], P3: [], P4: [], P5: [] };
  for (const c of referentiel75) {
    const pilier = c.pilier;
    if (pilier && referentiel_75_par_pilier[pilier]) {
      referentiel_75_par_pilier[pilier].push({
        circuit_id:  c.circuit_id,
        circuit_nom: c.circuit_nom,
        geste:       c.geste || null
      });
    }
  }

  // ─── Circuits ad hoc existants groupés par pilier ────────────────────
  // Inclut EN_ATTENTE + PROMU_AUTO (réutilisables avant promotion officielle).
  const circuits_ad_hoc_existants = { P1: [], P2: [], P3: [], P4: [], P5: [] };
  for (const ad of (adHocExistants || [])) {
    const pilier = extractLookup(ad.pilier_principal);
    if (pilier && circuits_ad_hoc_existants[pilier]) {
      circuits_ad_hoc_existants[pilier].push({
        nom_propose:                  ad.nom_propose,
        geste_propose:                ad.geste_propose || null,
        occurrences_pilier_principal: ad.occurrences_pilier_principal || 0,
        occurrences_autres_piliers:   ad.occurrences_autres_piliers   || 0,
        statut:                       ad.statut
      });
    }
  }

  // ─── ⭐ v11.0 — Mappings doctrinaux des piliers présents ──────────────
  // On parse les chaînes types_verbatim des 25 lignes T1 pour identifier
  // les piliers (P1..P5) effectivement mobilisés par ce candidat. On charge
  // ensuite uniquement les mappings des piliers présents (évite d'envoyer
  // les 5 mappings systématiquement si certains piliers ne sont pas utilisés).
  //
  // Surcoût en tokens : ~2000 tokens par pilier mappé. Sur un candidat qui
  // mobilise les 5 piliers, ~10 000 tokens injectés en plus dans le payload.
  // Acceptable au regard du coût total d'un appel (~30-40 k tokens).
  const piliersPresents       = extractPiliersFromLignesT1(lignesT1);
  const mappings_doctrinaux   = await loadMappingsDoctrinaux(piliersPresents);

  logger.info('Mappings doctrinaux injectés dans le payload', {
    candidat_id,
    piliers_presents: piliersPresents,
    nb_mappings_charges: Object.values(mappings_doctrinaux).filter(v => v !== null).length
  });

  return {
    candidat_id,
    civilite:                civilite || null,
    referentiel_75_par_pilier,
    circuits_ad_hoc_existants,
    lignes_t1,
    responses_t1,
    ...mappings_doctrinaux   // mapping_doctrinal_P1..P5 (selon piliers présents)
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE LA SORTIE CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrait le JSON unique de la sortie Claude.
 * Le prompt impose une réponse qui commence par { et finit par }.
 */
function extractOutput(rawResult) {
  if (!rawResult) {
    throw new Error('Agent attribution — sortie Claude vide');
  }

  let parsed;
  if (typeof rawResult === 'string') {
    // Nettoie d'éventuels code fences markdown
    const cleaned = rawResult
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/```\s*$/, '')
      .trim();
    try {
      parsed = JSON.parse(cleaned);
    } catch (err) {
      logger.error('Agent attribution — JSON parse failed', { error: err.message });
      throw new Error(`Agent attribution — JSON invalide : ${err.message}`);
    }
  } else if (typeof rawResult === 'object') {
    parsed = rawResult;
  } else {
    throw new Error(`Agent attribution — type de sortie inattendu : ${typeof rawResult}`);
  }

  if (!parsed.attributions_par_ligne || !Array.isArray(parsed.attributions_par_ligne)) {
    throw new Error('Agent attribution — clé `attributions_par_ligne` absente ou non-array');
  }
  if (!parsed.circuits_ad_hoc_nouveaux || !Array.isArray(parsed.circuits_ad_hoc_nouveaux)) {
    // Tolérance : si zéro ad hoc, le tableau peut être absent
    parsed.circuits_ad_hoc_nouveaux = [];
  }

  return {
    attributions_par_ligne:   parsed.attributions_par_ligne,
    circuits_ad_hoc_nouveaux: parsed.circuits_ad_hoc_nouveaux
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATIONS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Vérifie la cohérence doctrinale de la sortie Claude.
 * Lève une exception si une règle dure est violée.
 */
function validateAttributionOutput({
  attributions_par_ligne,
  circuits_ad_hoc_nouveaux,
  lignesT1,
  referentiel75,
  adHocExistants,
  candidat_id
}) {
  // V1 — Volumétrie : autant de lignes que dans ETAPE1_T1
  if (attributions_par_ligne.length !== lignesT1.length) {
    logger.warn('Agent attribution — nb lignes attributions ≠ nb lignes T1', {
      candidat_id,
      nb_attributions: attributions_par_ligne.length,
      nb_t1:           lignesT1.length
    });
    // On ne bloque pas — c'est un warn, pas un fail (cas T1 < 25 toléré)
  }

  // V2 — Chaque ligne a au moins 1 attribution
  for (const ligne of attributions_par_ligne) {
    if (!ligne.attributions || ligne.attributions.length === 0) {
      throw new Error(
        `Agent attribution — ligne ${ligne.id_question || '?'} sans aucune attribution. ` +
        `Violation de l'exhaustivité.`
      );
    }
  }

  // V3 — Index des circuits officiels par pilier (pour valider circuit_id)
  const officielsParPilier = { P1: new Set(), P2: new Set(), P3: new Set(), P4: new Set(), P5: new Set() };
  for (const c of referentiel75) {
    if (officielsParPilier[c.pilier]) {
      officielsParPilier[c.pilier].add(c.circuit_id);
    }
  }

  // V4 — Index des ad hoc existants par pilier (par nom)
  const adHocExistantsParPilierNom = { P1: new Set(), P2: new Set(), P3: new Set(), P4: new Set(), P5: new Set() };
  for (const ad of (adHocExistants || [])) {
    const pilier = extractLookup(ad.pilier_principal);
    if (pilier && adHocExistantsParPilierNom[pilier]) {
      adHocExistantsParPilierNom[pilier].add(ad.nom_propose);
    }
  }

  // V5 — Index des ad hoc nouveaux créés dans ce run (par id_temporaire)
  const adHocNouveauxIds = new Set();
  for (const adHoc of circuits_ad_hoc_nouveaux) {
    if (!adHoc.id_temporaire) {
      throw new Error('Agent attribution — circuit ad hoc nouveau sans id_temporaire');
    }
    if (!adHoc.nom_propose || !adHoc.pilier_origine || !adHoc.geste_propose) {
      throw new Error(
        `Agent attribution — ad hoc nouveau ${adHoc.id_temporaire} mal défini ` +
        `(manque nom_propose, pilier_origine ou geste_propose)`
      );
    }
    adHocNouveauxIds.add(adHoc.id_temporaire);
  }

  // V6 — Validation de chaque attribution
  let totalAttributions = 0;
  for (const ligne of attributions_par_ligne) {
    for (const attr of ligne.attributions) {
      totalAttributions++;

      // Type valide
      if (!VALID_TYPE_ATTRIBUTION.includes(attr.type_attribution)) {
        throw new Error(
          `Agent attribution — type_attribution invalide "${attr.type_attribution}" ` +
          `sur ligne ${ligne.id_question} attribution #${attr.ordre || '?'}`
        );
      }

      // Pilier valide
      if (!['P1', 'P2', 'P3', 'P4', 'P5'].includes(attr.pilier)) {
        throw new Error(
          `Agent attribution — pilier invalide "${attr.pilier}" sur ligne ${ligne.id_question}`
        );
      }

      // Si NON_ATTRIBUEE → pas de circuit
      if (attr.type_attribution === 'NON_ATTRIBUEE') {
        continue;  // on tolère sans validation supplémentaire
      }

      // Origine de circuit valide
      if (!VALID_CIRCUIT_ORIGINE.includes(attr.circuit_origine)) {
        throw new Error(
          `Agent attribution — circuit_origine invalide "${attr.circuit_origine}" ` +
          `sur ligne ${ligne.id_question}`
        );
      }

      // Vérification croisée circuit_origine ↔ identifiant
      if (attr.circuit_origine === 'OFFICIEL') {
        if (!officielsParPilier[attr.pilier].has(attr.circuit_id)) {
          throw new Error(
            `Agent attribution — circuit_id "${attr.circuit_id}" prétendu OFFICIEL ` +
            `mais absent du référentiel ${attr.pilier} (ligne ${ligne.id_question})`
          );
        }
      } else if (attr.circuit_origine === 'AD_HOC_EXISTANT') {
        if (!adHocExistantsParPilierNom[attr.pilier].has(attr.circuit_nom)) {
          throw new Error(
            `Agent attribution — circuit_nom "${attr.circuit_nom}" prétendu ad hoc existant ` +
            `mais absent de circuits_ad_hoc_existants[${attr.pilier}] (ligne ${ligne.id_question})`
          );
        }
      } else if (attr.circuit_origine === 'AD_HOC_NOUVEAU') {
        if (!adHocNouveauxIds.has(attr.circuit_id)) {
          throw new Error(
            `Agent attribution — circuit_id "${attr.circuit_id}" prétendu ad hoc nouveau ` +
            `mais absent de circuits_ad_hoc_nouveaux (ligne ${ligne.id_question})`
          );
        }
      }
    }
  }

  // V7 — Symétrie des nuances (au sein d'une même ligne T1)
  for (const ligne of attributions_par_ligne) {
    const nuanceesByVerbatim = new Map();  // verbatim → [{circuit_id, inflexions}]
    for (const attr of ligne.attributions) {
      if (attr.type_attribution === 'NUANCEE') {
        const key = attr.verbatim || attr.geste_t1;
        if (!nuanceesByVerbatim.has(key)) nuanceesByVerbatim.set(key, []);
        nuanceesByVerbatim.get(key).push({
          circuit_id: attr.circuit_id,
          inflexions: attr.inflexions || []
        });
      }
    }
    // Vérifie que pour chaque inflexion déclarée, le partenaire existe
    for (const [key, nuances] of nuanceesByVerbatim) {
      for (const n of nuances) {
        for (const infl of n.inflexions) {
          const partenaire = nuances.find(x => x.circuit_id === infl);
          if (!partenaire) {
            logger.warn('Agent attribution — asymétrie de nuance détectée', {
              candidat_id,
              ligne: ligne.id_question,
              circuit_source:      n.circuit_id,
              inflexion_orpheline: infl,
              verbatim_extrait:    String(key).substring(0, 80)
            });
            // On ne bloque pas — on signale (l'agent peut commettre des erreurs)
          } else if (!partenaire.inflexions.includes(n.circuit_id)) {
            logger.warn('Agent attribution — symétrie incomplète', {
              candidat_id,
              ligne: ligne.id_question,
              circuit_a: n.circuit_id,
              circuit_b: infl
            });
          }
        }
      }
    }
  }

  logger.info('Agent attribution — validation passée', {
    candidat_id,
    nb_lignes_t1:            attributions_par_ligne.length,
    nb_attributions_totales: totalAttributions,
    nb_ad_hoc_nouveaux:      circuits_ad_hoc_nouveaux.length
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CRÉATION DES AD HOC DANS REFERENTIEL_CIRCUITS_CANDIDATS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pour chaque circuit ad hoc nouveau créé par l'agent + chaque attribution
 * réutilisant un ad hoc existant, on appelle upsertCircuitAdHoc qui :
 *   - Crée le record si nom_propose nouveau
 *   - Incrémente les compteurs (pilier_principal ou autres_piliers)
 *   - Déclenche la promotion automatique si seuil franchi (Cas A / Cas B)
 *
 * Note importante : un ad hoc nouveau créé pour Q3 peut être réutilisé sur
 * Q15 (l'agent fait alors AD_HOC_EXISTANT sur la même question). Mais comme
 * les deux référencent le MÊME nom_propose, upsertCircuitAdHoc fonctionne
 * de manière idempotente (skip si même candidat déjà présent).
 */
async function processAdHocCreations({
  candidat_id,
  circuits_ad_hoc_nouveaux,
  attributions_par_ligne
}) {
  const stats = {
    crees:                     0,
    incrementes_principal:     0,
    incrementes_autres:        0,
    skipped:                   0,
    promotions_auto:           0,
    flags_arbitrage:           0,
    erreurs:                   0
  };

  // ─── 1. Pour chaque ad hoc nouveau : appel upsert ──────────────────────
  // On parcourt les attributions pour trouver la première occurrence de
  // chaque id_temporaire (question_source, verbatim_source_premier).
  const adHocFirstOccurrence = new Map();  // id_temporaire → { id_question, verbatim }
  for (const ligne of attributions_par_ligne) {
    for (const attr of ligne.attributions) {
      if (attr.circuit_origine === 'AD_HOC_NOUVEAU' && attr.circuit_id) {
        if (!adHocFirstOccurrence.has(attr.circuit_id)) {
          adHocFirstOccurrence.set(attr.circuit_id, {
            id_question:       ligne.id_question,
            scenario:          ligne.scenario,
            verbatim_premier:  attr.verbatim,
            pilier_origine:    attr.pilier
          });
        }
      }
    }
  }

  // Création (= upsert) de chaque ad hoc nouveau
  for (const adHocNouveau of circuits_ad_hoc_nouveaux) {
    const firstOcc = adHocFirstOccurrence.get(adHocNouveau.id_temporaire);
    if (!firstOcc) {
      logger.warn('Agent attribution — ad hoc nouveau sans occurrence trouvée', {
        candidat_id,
        id_temporaire: adHocNouveau.id_temporaire,
        nom_propose:   adHocNouveau.nom_propose
      });
      stats.erreurs++;
      continue;
    }

    try {
      const result = await airtableService.upsertCircuitAdHoc({
        candidat_id,
        nom_propose:                adHocNouveau.nom_propose,
        pilier_courant:             adHocNouveau.pilier_origine,
        geste_propose:              adHocNouveau.geste_propose,
        verbatim_source:            adHocNouveau.verbatim_source_premier || firstOcc.verbatim_premier,
        question_source:            adHocNouveau.question_source || `${firstOcc.id_question} ${firstOcc.scenario || ''}`.trim(),
        circuits_proches_envisages: adHocNouveau.circuits_proches_envisages || null
      });

      switch (result.action) {
        case 'created':
          stats.crees++;
          logger.info('Ad hoc nouveau créé', {
            candidat_id,
            nom_propose:      adHocNouveau.nom_propose,
            pilier_principal: adHocNouveau.pilier_origine
          });
          break;
        case 'incremented_principal':
          stats.incrementes_principal++;
          break;
        case 'incremented_autres':
          stats.incrementes_autres++;
          break;
        case 'skipped':
          stats.skipped++;
          break;
      }

      if (result.promotion_triggered === 'auto') {
        stats.promotions_auto++;
      } else if (result.promotion_triggered === 'flag_arbitrage') {
        stats.flags_arbitrage++;
      }
    } catch (err) {
      stats.erreurs++;
      logger.error('Échec upsert ad hoc nouveau', {
        candidat_id,
        nom_propose: adHocNouveau.nom_propose,
        error:       err.message
      });
    }
  }

  // ─── 2. Pour chaque AD_HOC_EXISTANT réutilisé : upsert pour incrémenter ─
  // Quand l'agent attribue à un ad hoc EXISTANT, ça veut dire qu'on a un
  // nouveau candidat qui active ce circuit ad hoc → on doit incrémenter le
  // compteur dans REFERENTIEL_CIRCUITS_CANDIDATS.
  const adHocExistantsReutilises = new Map();  // nom_propose → { pilier, question, verbatim }
  for (const ligne of attributions_par_ligne) {
    for (const attr of ligne.attributions) {
      if (attr.circuit_origine === 'AD_HOC_EXISTANT' && attr.circuit_nom) {
        if (!adHocExistantsReutilises.has(attr.circuit_nom)) {
          adHocExistantsReutilises.set(attr.circuit_nom, {
            pilier_courant:   attr.pilier,
            question:         ligne.id_question,
            scenario:         ligne.scenario,
            verbatim:         attr.verbatim
          });
        }
      }
    }
  }

  for (const [nom_propose, info] of adHocExistantsReutilises) {
    try {
      const result = await airtableService.upsertCircuitAdHoc({
        candidat_id,
        nom_propose,
        pilier_courant: info.pilier_courant,
        verbatim_source: info.verbatim,
        question_source: `${info.question} ${info.scenario || ''}`.trim()
      });

      switch (result.action) {
        case 'incremented_principal':
          stats.incrementes_principal++;
          break;
        case 'incremented_autres':
          stats.incrementes_autres++;
          break;
        case 'skipped':
          stats.skipped++;
          break;
      }

      if (result.promotion_triggered === 'auto') {
        stats.promotions_auto++;
      } else if (result.promotion_triggered === 'flag_arbitrage') {
        stats.flags_arbitrage++;
      }
    } catch (err) {
      stats.erreurs++;
      logger.error('Échec upsert ad hoc existant réutilisé', {
        candidat_id,
        nom_propose,
        error: err.message
      });
    }
  }

  return stats;
}

// ═══════════════════════════════════════════════════════════════════════════
// FORMATAGE DES ATTRIBUTIONS POUR ÉCRITURE DANS ETAPE1_T1
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pour chaque ligne T1, formate les attributions en texte structuré lisible
 * (cf. décision 1 du PLAN_CORRECTION_v10_8 : multilineText structuré).
 *
 * Format pour une attribution :
 *
 *   P3 · C10 · FRANCHE
 *      geste : "Identification des volontaires"
 *      verbatim : "Je pense que je sollicite de l'aide..."
 *
 * Cas NUANCEE :
 *   P3 · C10 · NUANCEE avec [C12]
 *      geste : "..."
 *      verbatim : "..."
 *
 * Cas AD_HOC :
 *   P5 · ADHOC "Exécution contrainte en aversion déclarée" · AD_HOC
 *      geste : "..."
 *      verbatim : "..."
 *      circuits_envisages_rejetes : C1 (raison), C11 (raison)
 *
 * Cas NON_ATTRIBUEE :
 *   P2 · NON_ATTRIBUEE
 *      geste : "..."
 *      verbatim : "..."
 *      raison : "..."
 *
 * @returns {Array<{record_id, types_verbatim_circuits}>}
 */
function formatAttributionsForT1Update({
  attributions_par_ligne,
  lignesT1,
  adHocCreationMap
}) {
  // Indexer les lignes T1 par id_question pour pouvoir matcher
  const t1ByIdQuestion = new Map();
  for (const t1 of lignesT1) {
    t1ByIdQuestion.set(t1.id_question, t1);
  }

  const updates = [];

  for (const ligne of attributions_par_ligne) {
    const t1Row = t1ByIdQuestion.get(ligne.id_question);
    if (!t1Row) {
      logger.warn('Ligne attribution sans T1 correspondante', {
        id_question: ligne.id_question
      });
      continue;
    }

    const blocs = ligne.attributions.map(attr => formatOneAttribution(attr, adHocCreationMap));
    const types_verbatim_circuits = blocs.join('\n\n');

    updates.push({
      record_id:                t1Row.airtable_id || t1Row.id,
      types_verbatim_circuits
    });
  }

  return updates;
}

/**
 * Formate une attribution unique en bloc texte structuré.
 */
function formatOneAttribution(attr, adHocCreationMap) {
  const lines = [];

  // Ligne d'en-tête selon le type
  if (attr.type_attribution === 'FRANCHE') {
    lines.push(`${attr.pilier} · ${attr.circuit_id} · FRANCHE`);
  } else if (attr.type_attribution === 'NUANCEE') {
    const inflexions = (attr.inflexions || []).join(', ');
    lines.push(`${attr.pilier} · ${attr.circuit_id} · NUANCEE avec [${inflexions}]`);
  } else if (attr.type_attribution === 'AD_HOC') {
    if (attr.circuit_origine === 'AD_HOC_NOUVEAU') {
      const nom = (adHocCreationMap.get(attr.circuit_id) || {}).nom_propose || attr.circuit_nom;
      lines.push(`${attr.pilier} · ADHOC "${nom}" · AD_HOC (nouveau)`);
    } else {
      lines.push(`${attr.pilier} · ADHOC "${attr.circuit_nom}" · AD_HOC (existant)`);
    }
  } else if (attr.type_attribution === 'NON_ATTRIBUEE') {
    lines.push(`${attr.pilier} · NON_ATTRIBUEE`);
  }

  // Détails
  if (attr.geste_t1) {
    lines.push(`   geste : "${escapeQuotes(attr.geste_t1)}"`);
  }
  if (attr.verbatim) {
    lines.push(`   verbatim : "${escapeQuotes(attr.verbatim)}"`);
  }
  if (attr.type_attribution === 'AD_HOC' && attr.circuit_origine === 'AD_HOC_NOUVEAU') {
    const adHocInfo = adHocCreationMap.get(attr.circuit_id);
    if (adHocInfo && adHocInfo.circuits_proches_envisages) {
      lines.push(`   circuits_envisages_rejetes : ${adHocInfo.circuits_proches_envisages}`);
    }
  }
  if (attr.type_attribution === 'NON_ATTRIBUEE' && attr.raison_non_attribution) {
    lines.push(`   raison : "${escapeQuotes(attr.raison_non_attribution)}"`);
  }

  return lines.join('\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function extractLookup(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : null;
  return String(value);
}

function escapeQuotes(s) {
  if (s === null || s === undefined) return '';
  return String(s).replace(/"/g, '\\"');
}

function countByType(attributions_par_ligne, type) {
  let count = 0;
  for (const ligne of attributions_par_ligne) {
    for (const attr of (ligne.attributions || [])) {
      if (attr.type_attribution === type) count++;
    }
  }
  return count;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runAttribution,

  // Exports internes pour tests unitaires
  _internal: {
    buildPayload,
    extractOutput,
    validateAttributionOutput,
    processAdHocCreations,
    formatAttributionsForT1Update,
    formatOneAttribution,
    VALID_TYPE_ATTRIBUTION,
    VALID_CIRCUIT_ORIGINE
  }
};
