// services/etape1/agentT2_phase2_consolidation_Service.js
// Agent de CONSOLIDATION — ÉTAPE 2 / Phase 2 — v1.0 (21/05/2026)
// Profil-Cognitif — Refonte v10.8
//
// ⚠️ AVANT MODIFICATION : lire docs/PLAN_CORRECTION_v10_8.md
//
// ───────────────────────────────────────────────────────────────────────────
// CONTEXTE DOCTRINAL — Refonte 21/05/2026 (Phase 2)
// ───────────────────────────────────────────────────────────────────────────
//
// Phase 2 de l'étape 2 refondue. Lit la colonne `types_verbatim_circuits` des
// 25 lignes ETAPE1_T1 (remplie par agentT2_phase1_attribution_Service en Phase 1),
// consolide MÉCANIQUEMENT par circuit, et écrit ETAPE1_T2.
//
// AUCUN APPEL CLAUDE. Tout est calculé en Node.js à partir de la trace
// d'attribution déjà décidée en Phase 1.
//
// → Avantage : reproductible à 100%, coût zéro, < 5 secondes, impossible
//   d'inventer ou de perdre un geste.
//
// ───────────────────────────────────────────────────────────────────────────
// CE QUE FAIT LA CONSOLIDATION
// ───────────────────────────────────────────────────────────────────────────
//
//   1. Parse types_verbatim_circuits sur chaque ligne T1 (format texte
//      structuré produit par Phase 1)
//   2. Construit la map { (pilier, circuit_id) → liste d'attributions }
//   3. Pour chaque circuit avec ≥ 1 attribution :
//      - frequence = nombre d'attributions
//      - niveau_activation = HAUT si freq ≥ 4, sinon MOYEN
//      - activations_franches = liste des questions où FRANCHE
//      - activations_nuancees = liste des questions où NUANCEE (+ inflexions)
//      - types_verbatim_detail = compilation verbatims activants
//      - circuit_personnalise = libellé contextualisé 4 ingrédients
//   4. Détection des clusters par pilier :
//      - 2 circuits HAUT du même pilier, co-activés ≥ 3 fois → cluster
//      - Tri par co-occurrences décroissantes (rang 1 = dominant)
//   5. Synthèse par pilier :
//      - total_activations_pilier, score_concentration_pilier
//      - nb_circuits_actifs_pilier
//      - cluster_dominant_* (4 champs lisibles humainement)
//      - nb_signaux_limbiques_pilier (depuis T1.signal_limbique)
//      - candidature_socle_*, candidature_resistant_*
//      - analyse_commentee_pilier (texte narratif)
//   6. Écriture ETAPE1_T2 (delete + create atomique)
//
// ───────────────────────────────────────────────────────────────────────────
// RÈGLES DURES
// ───────────────────────────────────────────────────────────────────────────
//
//   - Zéro invention : si un circuit n'a aucune attribution, il n'apparaît
//     PAS dans ETAPE1_T2 (silence = info).
//   - Cohérence intra-pilier (V5) : les 12 champs synthétiques par pilier
//     sont IDENTIQUES sur toutes les lignes du même pilier.
//   - Symétrie clusters : un cluster (C_X, C_Y) est déclaré dans la ligne
//     de C_X ET dans la ligne de C_Y avec les mêmes chiffres.
//   - Seuils cluster : nb_co_occurrences ≥ 3 ET les 2 circuits HAUT (≥ 4).

'use strict';

const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const SERVICE_NAME = 'agent_consolidation';

// Seuils doctrinaux
const SEUIL_HAUT             = 4;  // freq ≥ 4 → HAUT, sinon MOYEN
const SEUIL_CLUSTER_COOCC    = 3;  // ≥ 3 co-occurrences pour cluster

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute la consolidation mécanique pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {string} [params.session_id]  Optionnel — résolu depuis T1 si absent
 * @returns {Promise<{
 *   rows: Array,
 *   stats: Object,
 *   elapsedMs: number
 * }>}
 */
async function runConsolidation({ candidat_id, session_id = null }) {
  const startTime = Date.now();
  logger.info('Agent consolidation starting', { candidat_id });

  // ─── 1. Lire les 25 lignes ETAPE1_T1 ──────────────────────────────────
  const lignesT1 = await airtableService.getEtape1T1(candidat_id);
  if (!lignesT1 || lignesT1.length === 0) {
    throw new Error(
      `Agent consolidation — aucune ligne ETAPE1_T1 pour ${candidat_id}. ` +
      `Phase 1 (attribution) doit avoir tourné avant.`
    );
  }

  // ─── 2. Résoudre session_id depuis T1 si pas fourni ───────────────────
  // Doctrine projet : session_id == candidat_id (le visiteur a un identifiant
  // unique partagé entre VISITEUR.candidate_ID et RESPONSES.session_ID).
  if (!session_id) {
    session_id = lignesT1[0].session_ID || lignesT1[0].session_id || candidat_id;
    logger.info('Agent consolidation — session_id résolu', {
      candidat_id, session_id, source: lignesT1[0].session_ID ? 'T1' : 'fallback_candidat_id'
    });
  }

  // ─── 3. Lire les infos VISITEUR (civilité + prénom + nom anonymisés) ──
  // ATTENTION : civilite/prenom/nom NE SONT PAS envoyés à Claude.
  // Ils ne servent que pour ETAPE1_T2 (lecture humaine sur 1500 candidats).
  const visiteurInfo = await airtableService.getVisiteurInfoForVisualisation(candidat_id);

  // ─── 4. Lire le référentiel des 75 circuits officiels ─────────────────
  const referentiel75 = await airtableService.getReferentielCircuits();

  // ─── 5. Lire les ad hoc existants (pour récupérer noms et gestes) ─────
  const adHocEnAttente  = await airtableService.getCircuitsAdHocByStatut('EN_ATTENTE');
  const adHocPromuAuto  = await airtableService.getCircuitsAdHocByStatut('PROMU_AUTO');
  const adHocPromuMan   = await airtableService.getCircuitsAdHocByStatut('PROMU_MANUEL');
  const adHocTous       = [...adHocEnAttente, ...adHocPromuAuto, ...adHocPromuMan];

  // ─── 6. Parser types_verbatim_circuits sur les 25 lignes T1 ───────────
  const attributionsParCircuit = parseAllAttributions({
    lignesT1,
    referentiel75,
    adHocTous,
    candidat_id
  });

  // ─── 7. Détecter les clusters par pilier ──────────────────────────────
  const clustersParPilier = detectClustersByPilier(attributionsParCircuit);

  // ─── 8. Calculer les synthèses par pilier ──────────────────────────────
  const synthesesParPilier = computeSynthesesByPilier({
    attributionsParCircuit,
    clustersParPilier,
    lignesT1,
    referentiel75
  });

  // ─── 9. Construire les rows ETAPE1_T2 ─────────────────────────────────
  const rows = buildEtape1T2Rows({
    attributionsParCircuit,
    clustersParPilier,
    synthesesParPilier,
    candidat_id,
    session_id,
    visiteurInfo,
    referentiel75,
    adHocTous
  });

  // ─── 10. Écrire ETAPE1_T2 (delete + create atomique) ──────────────────
  await airtableService.writeEtape1T2(candidat_id, rows);

  // ─── 11. Stats finales ────────────────────────────────────────────────
  const totalMs = Date.now() - startTime;
  const stats = {
    nb_rows_ecrites:      rows.length,
    nb_piliers_actifs:    Object.keys(synthesesParPilier).filter(p => synthesesParPilier[p].nb_circuits_actifs > 0).length,
    nb_circuits_haut:     rows.filter(r => r.niveau_activation === 'HAUT').length,
    nb_circuits_moyen:    rows.filter(r => r.niveau_activation === 'MOYEN').length,
    nb_clusters_detectes: countClustersTotal(clustersParPilier),
    elapsed_total_ms:     totalMs
  };

  logger.info('Agent consolidation completed', { candidat_id, ...stats });

  return { rows, stats, elapsedMs: totalMs };
}

// ═══════════════════════════════════════════════════════════════════════════
// PARSING DES ATTRIBUTIONS DEPUIS types_verbatim_circuits
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse les attributions de toutes les lignes T1 et les regroupe par circuit.
 *
 * Format attendu de types_verbatim_circuits (texte structuré, multiblocs
 * séparés par double-newline) :
 *
 *   P3 · C10 · FRANCHE
 *      geste : "Identification des volontaires"
 *      verbatim : "Je pense que je sollicite de l'aide..."
 *
 *   P5 · C13 · NUANCEE avec [C1]
 *      geste : "Délégation totale ou partielle"
 *      verbatim : "Si je ne parviens pas..."
 *
 *   P5 · ADHOC "Exécution contrainte en aversion déclarée" · AD_HOC (nouveau)
 *      geste : "Exécution solitaire en dernier recours"
 *      verbatim : "je m'isole..."
 *      circuits_envisages_rejetes : C1 (raison), C11 (raison)
 *
 * @returns {Map<string, Object>} clé = "P{X}::{circuit_key}", valeur = {
 *   pilier, circuit_id_or_nom, circuit_origine, activations: [...]
 * }
 */
function parseAllAttributions({ lignesT1, referentiel75, adHocTous, candidat_id }) {
  const result = new Map();

  // Index référentiel par nom pour résoudre les noms officiels depuis l'ID
  const officielsByPilierCircuit = new Map();
  for (const c of referentiel75) {
    officielsByPilierCircuit.set(`${c.pilier}::${c.circuit_id}`, c);
  }

  // Index ad hoc par nom (pour résoudre depuis le nom_propose)
  const adHocByNom = new Map();
  for (const ad of adHocTous) {
    adHocByNom.set(ad.nom_propose, ad);
  }

  for (const t1 of lignesT1) {
    const tvc = t1.types_verbatim_circuits;
    if (!tvc || typeof tvc !== 'string' || tvc.trim().length === 0) {
      logger.warn('Ligne T1 sans types_verbatim_circuits', {
        candidat_id,
        id_question: t1.id_question
      });
      continue;
    }

    const blocs = parseAttributionBlocs(tvc);
    for (const bloc of blocs) {
      if (!bloc.pilier) continue;

      // Construire la clé unique du circuit
      let circuitKey;
      if (bloc.type_attribution === 'NON_ATTRIBUEE') {
        // Pas de circuit attaché → on saute (l'attribution est tracée en T1
        // mais pas comptée dans T2)
        continue;
      }

      if (bloc.circuit_origine === 'OFFICIEL') {
        circuitKey = `${bloc.pilier}::${bloc.circuit_id}`;
      } else {
        // AD_HOC (nouveau ou existant) — on utilise le nom_propose comme clé
        circuitKey = `${bloc.pilier}::ADHOC::${bloc.nom_ad_hoc}`;
      }

      if (!result.has(circuitKey)) {
        result.set(circuitKey, {
          pilier:           bloc.pilier,
          circuit_id:       bloc.circuit_id,         // null si ad hoc
          circuit_nom:      bloc.circuit_nom,        // résolu plus bas
          circuit_origine:  bloc.circuit_origine,
          nom_ad_hoc:       bloc.nom_ad_hoc,         // null si officiel
          activations:      []
        });
      }

      result.get(circuitKey).activations.push({
        id_question:        t1.id_question,
        scenario:           t1.scenario,
        type_attribution:   bloc.type_attribution,
        inflexions:         bloc.inflexions || [],
        geste:              bloc.geste,
        verbatim:           bloc.verbatim,
        circuits_envisages: bloc.circuits_envisages || null,
        // Contextualisation pour circuit_personnalise (PASSE 3.D originale)
        pilier_coeur:                 extractLookup(t1.pilier_coeur),
        outil_cognitif_libelle:       t1.outil_cognitif_libelle || null,
        attribution_pilier_signal_brut: t1.attribution_pilier_signal_brut || null
      });
    }
  }

  // Résoudre les noms officiels pour ceux qui ont juste un circuit_id
  for (const [key, entry] of result) {
    if (entry.circuit_origine === 'OFFICIEL' && !entry.circuit_nom) {
      const officiel = officielsByPilierCircuit.get(`${entry.pilier}::${entry.circuit_id}`);
      if (officiel) {
        entry.circuit_nom = officiel.circuit_nom;
      } else {
        logger.warn('Circuit officiel introuvable dans le référentiel', {
          candidat_id,
          pilier:     entry.pilier,
          circuit_id: entry.circuit_id
        });
      }
    } else if (entry.circuit_origine !== 'OFFICIEL' && entry.nom_ad_hoc) {
      entry.circuit_nom = entry.nom_ad_hoc;
    }
  }

  return result;
}

/**
 * Parse le contenu d'une cellule types_verbatim_circuits en liste de blocs.
 * Chaque bloc = une attribution. Séparés par lignes vides.
 */
function parseAttributionBlocs(text) {
  const blocs = [];
  const sections = text.split(/\n\s*\n/);  // séparation par double newline

  for (const section of sections) {
    const trimmed = section.trim();
    if (!trimmed) continue;
    const bloc = parseOneAttributionBloc(trimmed);
    if (bloc) blocs.push(bloc);
  }

  return blocs;
}

/**
 * Parse un bloc d'attribution unique.
 *
 * Formats possibles (l'agent doit écrire l'un de ceux-ci) :
 *   P3 · C10 · FRANCHE
 *   P3 · C10 · NUANCEE avec [C12]
 *   P3 · C10 · NUANCEE avec [C12, C15]
 *   P5 · ADHOC "Exécution contrainte en aversion déclarée" · AD_HOC (nouveau)
 *   P5 · ADHOC "Anticipation rétroactive" · AD_HOC (existant)
 *   P2 · NON_ATTRIBUEE
 */
function parseOneAttributionBloc(text) {
  const lines = text.split('\n').map(l => l.trimEnd());
  if (lines.length === 0) return null;

  const header = lines[0].trim();
  const bloc = {
    pilier:           null,
    circuit_id:       null,
    circuit_nom:      null,
    circuit_origine:  null,
    nom_ad_hoc:       null,
    type_attribution: null,
    inflexions:       [],
    geste:            null,
    verbatim:         null,
    circuits_envisages: null,
    raison_non_attribution: null
  };

  // Pilier (toujours en tête)
  const pilierMatch = header.match(/^(P[1-5])\b/);
  if (!pilierMatch) return null;
  bloc.pilier = pilierMatch[1];

  // Type d'attribution + circuit
  if (/·\s*NON_ATTRIBUEE\b/i.test(header)) {
    bloc.type_attribution = 'NON_ATTRIBUEE';
  } else if (/·\s*FRANCHE\b/i.test(header)) {
    bloc.type_attribution = 'FRANCHE';
    const cid = header.match(/·\s*(C\d{1,2})\s*·/);
    if (cid) {
      bloc.circuit_id      = cid[1];
      bloc.circuit_origine = 'OFFICIEL';
    } else {
      const adhoc = header.match(/·\s*ADHOC\s+"([^"]+)"/);
      if (adhoc) {
        bloc.nom_ad_hoc       = adhoc[1];
        bloc.circuit_origine  = /AD_HOC\s*\(nouveau\)/i.test(header)
          ? 'AD_HOC_NOUVEAU' : 'AD_HOC_EXISTANT';
        bloc.type_attribution = 'AD_HOC';
      }
    }
  } else if (/·\s*NUANCEE\b/i.test(header)) {
    bloc.type_attribution = 'NUANCEE';
    const cid = header.match(/·\s*(C\d{1,2})\s*·/);
    if (cid) {
      bloc.circuit_id      = cid[1];
      bloc.circuit_origine = 'OFFICIEL';
    }
    const inflexionsMatch = header.match(/avec\s*\[([^\]]+)\]/i);
    if (inflexionsMatch) {
      bloc.inflexions = inflexionsMatch[1]
        .split(',')
        .map(s => s.trim())
        .filter(s => s.match(/^C\d{1,2}$/));
    }
  } else if (/·\s*AD_HOC\b/i.test(header)) {
    bloc.type_attribution = 'AD_HOC';
    const adhoc = header.match(/·\s*ADHOC\s+"([^"]+)"/);
    if (adhoc) {
      bloc.nom_ad_hoc      = adhoc[1];
      bloc.circuit_origine = /AD_HOC\s*\(nouveau\)/i.test(header)
        ? 'AD_HOC_NOUVEAU' : 'AD_HOC_EXISTANT';
    }
  }

  // Parser les lignes de détail
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const gesteMatch = line.match(/^geste\s*:\s*"([^"]+)"/i);
    if (gesteMatch) { bloc.geste = gesteMatch[1]; continue; }

    const verbatimMatch = line.match(/^verbatim\s*:\s*"(.+)"$/i);
    if (verbatimMatch) { bloc.verbatim = verbatimMatch[1]; continue; }

    const envisagesMatch = line.match(/^circuits_envisages_rejetes\s*:\s*(.+)$/i);
    if (envisagesMatch) { bloc.circuits_envisages = envisagesMatch[1]; continue; }

    const raisonMatch = line.match(/^raison\s*:\s*"(.+)"$/i);
    if (raisonMatch) { bloc.raison_non_attribution = raisonMatch[1]; continue; }
  }

  return bloc;
}

// ═══════════════════════════════════════════════════════════════════════════
// DÉTECTION DES CLUSTERS PAR PILIER
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Détecte les clusters dans chaque pilier.
 * Un cluster = couple de circuits HAUT du même pilier, co-activés ≥ 3 fois.
 *
 * @returns {Object} { P1: [...], P2: [...], ..., P5: [...] }
 *   Chaque entrée = { circuit_a, circuit_b, nb_co_occurrences, questions, rang }
 */
function detectClustersByPilier(attributionsParCircuit) {
  // Grouper les circuits par pilier
  const circuitsByPilier = { P1: [], P2: [], P3: [], P4: [], P5: [] };
  for (const [key, entry] of attributionsParCircuit) {
    if (circuitsByPilier[entry.pilier]) {
      circuitsByPilier[entry.pilier].push({ key, entry });
    }
  }

  const clustersByPilier = { P1: [], P2: [], P3: [], P4: [], P5: [] };

  for (const pilier of ['P1', 'P2', 'P3', 'P4', 'P5']) {
    const circuits = circuitsByPilier[pilier];

    // Construire la map { circuit_key → Set des questions où il est activé }
    const questionsByCircuit = new Map();
    for (const { key, entry } of circuits) {
      const questions = new Set();
      for (const act of entry.activations) {
        questions.add(act.id_question);
      }
      questionsByCircuit.set(key, questions);
    }

    // Tester chaque paire (X, Y) avec X != Y, en s'assurant qu'on ne compte
    // pas (X, Y) et (Y, X) deux fois
    const clusters = [];
    for (let i = 0; i < circuits.length; i++) {
      for (let j = i + 1; j < circuits.length; j++) {
        const a = circuits[i];
        const b = circuits[j];

        // Seuil HAUT pour les 2 circuits
        if (a.entry.activations.length < SEUIL_HAUT) continue;
        if (b.entry.activations.length < SEUIL_HAUT) continue;

        // Calcul co-occurrences (intersection des questions activantes)
        const qA = questionsByCircuit.get(a.key);
        const qB = questionsByCircuit.get(b.key);
        const coOccQuestions = [];
        for (const q of qA) {
          if (qB.has(q)) coOccQuestions.push(q);
        }

        if (coOccQuestions.length >= SEUIL_CLUSTER_COOCC) {
          clusters.push({
            circuit_a:         a.entry,
            circuit_b:         b.entry,
            nb_co_occurrences: coOccQuestions.length,
            questions:         coOccQuestions.sort()
          });
        }
      }
    }

    // Tri par nb_co_occurrences décroissant
    clusters.sort((x, y) => y.nb_co_occurrences - x.nb_co_occurrences);
    clusters.forEach((c, idx) => { c.rang = idx + 1; });

    clustersByPilier[pilier] = clusters;
  }

  return clustersByPilier;
}

// ═══════════════════════════════════════════════════════════════════════════
// SYNTHÈSE PAR PILIER (les 12 champs synthétiques + analyse commentée)
// ═══════════════════════════════════════════════════════════════════════════

function computeSynthesesByPilier({ attributionsParCircuit, clustersParPilier, lignesT1, referentiel75 }) {
  const synthese = { P1: null, P2: null, P3: null, P4: null, P5: null };

  // Index : circuits par pilier
  const circuitsByPilier = { P1: [], P2: [], P3: [], P4: [], P5: [] };
  for (const [key, entry] of attributionsParCircuit) {
    if (circuitsByPilier[entry.pilier]) {
      circuitsByPilier[entry.pilier].push({ key, entry });
    }
  }

  // Index : signaux limbiques par pilier (depuis ETAPE1_T1.signal_limbique)
  // Le champ signal_limbique de T1 peut contenir un texte comme :
  //   "aversion déclarée · "la pire partie pour moi""
  // Si vide ou null → pas de signal pour cette ligne.
  const limbiquesByPilier = { P1: [], P2: [], P3: [], P4: [], P5: [] };
  for (const t1 of lignesT1) {
    const sig = t1.signal_limbique;
    if (sig && typeof sig === 'string' && sig.trim().length > 0 && sig.trim().toLowerCase() !== 'aucun' && sig.trim().toLowerCase() !== 'rien') {
      // Le signal limbique est attaché au pilier d'origine de la ligne.
      // On utilise pilier_coeur (le pilier qui gouverne la réponse) — c'est
      // le plus parlant doctrinalement.
      const pilier = extractLookup(t1.pilier_coeur);
      if (pilier && limbiquesByPilier[pilier]) {
        limbiquesByPilier[pilier].push({
          id_question: t1.id_question,
          signal:      sig.trim()
        });
      }
    }
  }

  for (const pilier of ['P1', 'P2', 'P3', 'P4', 'P5']) {
    const circuits = circuitsByPilier[pilier];
    if (circuits.length === 0) {
      // Pilier muet — synthèse minimale
      synthese[pilier] = {
        total_activations:                          0,
        score_concentration:                        0,
        nb_circuits_actifs:                         0,
        nb_circuits_haut:                           0,
        cluster_dominant_circuits:                  null,
        cluster_dominant_co_occurrences:            0,
        cluster_dominant_signature_unifiee:         false,
        cluster_dominant_lecture:                   null,
        nb_signaux_limbiques:                       limbiquesByPilier[pilier].length,
        questions_avec_signaux_limbiques:           limbiquesByPilier[pilier].map(l => l.id_question).join(', '),
        candidature_socle_score:                    'NULLE',
        candidature_socle_raison:                   'Pilier muet, aucun circuit activé.',
        candidature_resistant_score:                'NULLE',
        candidature_resistant_raison:               'Pas de signal de résistance détectable (pilier non mobilisé).',
        analyse_commentee:                          `${pilier} : pilier muet, aucun circuit activé chez ce candidat.`
      };
      continue;
    }

    // Calculs
    const totalActivations = circuits.reduce((sum, { entry }) => sum + entry.activations.length, 0);
    const nbCircuitsActifs = circuits.length;
    const nbCircuitsHaut   = circuits.filter(({ entry }) => entry.activations.length >= SEUIL_HAUT).length;

    // Score de concentration = freq du circuit le + haut / total activations
    const freqMax = Math.max(...circuits.map(({ entry }) => entry.activations.length));
    const scoreConcentration = totalActivations > 0
      ? Number((freqMax / totalActivations).toFixed(2))
      : 0;

    // Cluster dominant du pilier (rang 1)
    const clusters = clustersParPilier[pilier];
    const clusterDom = clusters[0] || null;

    let clusterDomCircuits = null;
    let clusterDomCoOcc    = 0;
    let clusterDomUnifiee  = false;
    let clusterDomLecture  = null;

    if (clusterDom) {
      const idA = clusterDom.circuit_a.circuit_id || `ADHOC[${clusterDom.circuit_a.nom_ad_hoc}]`;
      const idB = clusterDom.circuit_b.circuit_id || `ADHOC[${clusterDom.circuit_b.nom_ad_hoc}]`;
      clusterDomCircuits = `${idA}+${idB}`;
      clusterDomCoOcc    = clusterDom.nb_co_occurrences;

      // Signature unifiée : tous les circuits HAUT du pilier sont dans CE cluster
      const circuitsHautKeys = new Set(
        circuits
          .filter(({ entry }) => entry.activations.length >= SEUIL_HAUT)
          .map(({ key }) => key)
      );
      const clusterKeys = new Set([
        `${clusterDom.circuit_a.pilier}::${clusterDom.circuit_a.circuit_id || 'ADHOC::' + clusterDom.circuit_a.nom_ad_hoc}`,
        `${clusterDom.circuit_b.pilier}::${clusterDom.circuit_b.circuit_id || 'ADHOC::' + clusterDom.circuit_b.nom_ad_hoc}`
      ]);
      // Unifiée si exactement les mêmes que les circuits HAUT
      clusterDomUnifiee = (
        circuitsHautKeys.size === clusterKeys.size &&
        [...circuitsHautKeys].every(k => clusterKeys.has(k))
      );

      clusterDomLecture =
        `Cluster ${idA}×${idB} (${clusterDom.nb_co_occurrences} co-occurrences sur ${clusterDom.questions.join(', ')}) — ` +
        `${clusterDom.circuit_a.circuit_nom} couplé avec ${clusterDom.circuit_b.circuit_nom}.`;
    }

    // Candidature socle (mécanique)
    const { score: socleScore, raison: socleRaison } = computeCandidatureSocle({
      nbCircuitsHaut, totalActivations, scoreConcentration, clusterDom, clusterDomUnifiee
    });

    // Candidature résistant (mécanique)
    const limbiques = limbiquesByPilier[pilier];
    const { score: resistantScore, raison: resistantRaison } = computeCandidatureResistant({
      nbSignauxLimbiques: limbiques.length,
      questionsLimbiques: limbiques.map(l => l.id_question),
      circuits
    });

    // Analyse commentée (texte narratif)
    const analyseCommentee = buildAnalyseCommentee({
      pilier,
      circuits,
      totalActivations,
      nbCircuitsActifs,
      nbCircuitsHaut,
      scoreConcentration,
      clusterDom,
      nbSignauxLimbiques: limbiques.length
    });

    synthese[pilier] = {
      total_activations:                  totalActivations,
      score_concentration:                scoreConcentration,
      nb_circuits_actifs:                 nbCircuitsActifs,
      nb_circuits_haut:                   nbCircuitsHaut,
      cluster_dominant_circuits:          clusterDomCircuits,
      cluster_dominant_co_occurrences:    clusterDomCoOcc,
      cluster_dominant_signature_unifiee: clusterDomUnifiee,
      cluster_dominant_lecture:           clusterDomLecture,
      nb_signaux_limbiques:               limbiques.length,
      questions_avec_signaux_limbiques:   limbiques.map(l => l.id_question).join(', '),
      candidature_socle_score:            socleScore,
      candidature_socle_raison:           socleRaison,
      candidature_resistant_score:        resistantScore,
      candidature_resistant_raison:       resistantRaison,
      analyse_commentee:                  analyseCommentee
    };
  }

  return synthese;
}

/**
 * Calcule la candidature socle d'un pilier.
 * Critères doctrinaux (formule mécanique stabilisée) :
 *   FORTE   : >= 3 circuits HAUT ET (concentration >= 0.35 OU cluster unifié)
 *   MOYENNE : 2 circuits HAUT OU (1 HAUT + concentration >= 0.40)
 *   FAIBLE  : 1 circuit HAUT
 *   NULLE   : 0 circuit HAUT
 */
function computeCandidatureSocle({ nbCircuitsHaut, totalActivations, scoreConcentration, clusterDom, clusterDomUnifiee }) {
  if (nbCircuitsHaut === 0) {
    return {
      score:  'NULLE',
      raison: `Aucun circuit HAUT (${totalActivations} activations dispersées). Pas de manière propre dans cet outil.`
    };
  }
  if (nbCircuitsHaut === 1) {
    return {
      score:  'FAIBLE',
      raison: `1 circuit HAUT seulement (concentration ${scoreConcentration}). Présence d'une dominance simple sans réseau.`
    };
  }
  if (nbCircuitsHaut === 2 || (nbCircuitsHaut >= 1 && scoreConcentration >= 0.40)) {
    return {
      score:  'MOYENNE',
      raison: `${nbCircuitsHaut} circuits HAUT, concentration ${scoreConcentration}${clusterDom ? `, cluster dominant ${clusterDom.nb_co_occurrences} co-oc` : ''}.`
    };
  }
  if (nbCircuitsHaut >= 3 && (scoreConcentration >= 0.35 || clusterDomUnifiee)) {
    return {
      score:  'FORTE',
      raison: `${nbCircuitsHaut} circuits HAUT, concentration ${scoreConcentration}${clusterDomUnifiee ? ', signature unifiée' : ''}${clusterDom ? `, cluster dominant ${clusterDom.nb_co_occurrences} co-oc` : ''}.`
    };
  }
  return {
    score:  'MOYENNE',
    raison: `${nbCircuitsHaut} circuits HAUT, concentration ${scoreConcentration}. Signature présente mais dispersée.`
  };
}

/**
 * Calcule la candidature résistant d'un pilier.
 * Critères doctrinaux :
 *   FORTE  : >= 3 signaux limbiques (seuil agent 5 de l'étape 3)
 *   FAIBLE : 1-2 signaux limbiques
 *   NULLE  : 0 signal limbique
 */
function computeCandidatureResistant({ nbSignauxLimbiques, questionsLimbiques, circuits }) {
  if (nbSignauxLimbiques >= 3) {
    return {
      score:  'FORTE',
      raison: `${nbSignauxLimbiques} signaux limbiques détectés sur questions ${questionsLimbiques.join(', ')}. Aversion verbalisée constante.`
    };
  }
  if (nbSignauxLimbiques >= 1) {
    return {
      score:  'FAIBLE',
      raison: `${nbSignauxLimbiques} signal(aux) limbique(s) détecté(s) sur ${questionsLimbiques.join(', ')}. Signal présent mais insuffisant pour FORTE.`
    };
  }
  return {
    score:  'NULLE',
    raison: 'Aucun signal limbique détecté.'
  };
}

/**
 * Construit l'analyse commentée du pilier (texte narratif lisant le pilier
 * en référence aux noms exacts des circuits du référentiel REFERENTIEL_CIRCUITS).
 */
function buildAnalyseCommentee({
  pilier, circuits, totalActivations, nbCircuitsActifs, nbCircuitsHaut,
  scoreConcentration, clusterDom, nbSignauxLimbiques
}) {
  // Tri par fréquence descendante pour mettre en avant les circuits HAUT
  const sorted = [...circuits].sort((a, b) => b.entry.activations.length - a.entry.activations.length);

  const PILIER_NOMS = {
    P1: 'Collecte d\'information',
    P2: 'Tri et organisation',
    P3: 'Analyse et diagnostic',
    P4: 'Création de solutions',
    P5: 'Mise en œuvre et exécution'
  };

  // Qualification globale du pilier
  let qualif;
  if (nbCircuitsHaut >= 3) qualif = 'outil fortement structurant';
  else if (nbCircuitsHaut === 2) qualif = 'outil structurant';
  else if (nbCircuitsHaut === 1) qualif = 'outil mobilisé avec une dominance';
  else if (nbCircuitsActifs >= 3) qualif = 'outil de service (dispersé sans dominance)';
  else qualif = 'outil de passage (faible mobilisation)';

  const parts = [];
  parts.push(`${pilier} (${PILIER_NOMS[pilier]}) — ${qualif}.`);
  parts.push(`${totalActivations} activations sur ${nbCircuitsActifs} circuits, ${nbCircuitsHaut} HAUT. Concentration ${scoreConcentration}.`);

  // Énumération des circuits HAUT avec leurs noms exacts du référentiel
  const hauts = sorted.filter(({ entry }) => entry.activations.length >= SEUIL_HAUT);
  if (hauts.length > 0) {
    const enumeration = hauts.map(({ entry }) => {
      const nom = entry.circuit_nom || (entry.nom_ad_hoc ? `[ad hoc] ${entry.nom_ad_hoc}` : entry.circuit_id);
      return `${nom} (${entry.activations.length}×)`;
    }).join(', ');
    parts.push(`Circuits HAUT : ${enumeration}.`);
  }

  // Lecture du cluster dominant
  if (clusterDom) {
    const nomA = clusterDom.circuit_a.circuit_nom || `[ad hoc] ${clusterDom.circuit_a.nom_ad_hoc}`;
    const nomB = clusterDom.circuit_b.circuit_nom || `[ad hoc] ${clusterDom.circuit_b.nom_ad_hoc}`;
    parts.push(`Cluster dominant : ${nomA} × ${nomB} sur ${clusterDom.nb_co_occurrences} questions.`);
  }

  // Signal limbique
  if (nbSignauxLimbiques >= 1) {
    parts.push(`${nbSignauxLimbiques} signal(aux) limbique(s) détecté(s) dans cet outil — possible signal de résistance.`);
  }

  return parts.join(' ');
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION DES ROWS ETAPE1_T2
// ═══════════════════════════════════════════════════════════════════════════

function buildEtape1T2Rows({
  attributionsParCircuit,
  clustersParPilier,
  synthesesParPilier,
  candidat_id,
  session_id,
  visiteurInfo,
  referentiel75,
  adHocTous
}) {
  const rows = [];

  // Pour chaque circuit ayant ≥ 1 attribution, produire une ligne
  for (const [key, entry] of attributionsParCircuit) {
    const pilier   = entry.pilier;
    const synthese = synthesesParPilier[pilier];
    if (!synthese) continue;

    const frequence = entry.activations.length;
    const niveau    = frequence >= SEUIL_HAUT ? 'HAUT' : 'MOYEN';

    // Activations franches / nuancées (JSON stringifiés)
    const franches = entry.activations
      .filter(a => a.type_attribution === 'FRANCHE')
      .map(a => ({ question: a.id_question, libelle: a.geste || '' }));
    const nuancees = entry.activations
      .filter(a => a.type_attribution === 'NUANCEE')
      .map(a => ({
        question:   a.id_question,
        libelle:    a.geste || '',
        inflexions: a.inflexions || []
      }));

    // Clusters identifiés (côté de CE circuit) — JSON stringifié
    const clustersOfThisCircuit = (clustersParPilier[pilier] || [])
      .filter(c => c.circuit_a === entry || c.circuit_b === entry)
      .map(c => {
        const autre = c.circuit_a === entry ? c.circuit_b : c.circuit_a;
        return {
          circuit_partenaire: autre.circuit_id || `ADHOC[${autre.nom_ad_hoc}]`,
          nb_co_occurrences:  c.nb_co_occurrences,
          questions:          c.questions,
          rang:               c.rang
        };
      })
      .sort((a, b) => b.nb_co_occurrences - a.nb_co_occurrences);

    // id_question = liste des questions où ce circuit a été activé
    const idQuestions = [...new Set(entry.activations.map(a => a.id_question))].sort();

    // types_verbatim_detail = compilation des verbatims activants
    const verbatimDetail = entry.activations.map(a => {
      const lib = a.geste || '';
      const verb = a.verbatim || '';
      const sce = a.scenario ? ` ${a.scenario}` : '';
      return `**${a.id_question}${sce}** — ${pilier} · ${lib}\n> "${verb}"`;
    }).join('\n\n');

    // circuit_personnalise (4 ingrédients)
    const circuitPerso = buildCircuitPersonnalise(entry, pilier);

    // commentaire_attribution (1-3 phrases factuelles)
    const commentaire = buildCommentaireAttribution({
      circuit:        entry,
      frequence,
      nbFranches:     franches.length,
      nbNuancees:     nuancees.length,
      clusters:       clustersOfThisCircuit
    });

    const circuit_id  = entry.circuit_id || (entry.nom_ad_hoc ? `ADHOC` : null);
    const circuit_nom = entry.circuit_nom || entry.nom_ad_hoc || null;

    rows.push({
      // Identifiants
      candidat_id,
      session_ID:   session_id,
      civilite:     visiteurInfo?.civilite || null,
      prenom:       visiteurInfo?.prenom   || null,
      nom:          visiteurInfo?.nom      || null,
      id_question:  idQuestions.join(', '),

      // Données circuit
      pilier,
      role_pilier:           '',  // chasse gardée étape 3
      circuit_id,
      circuit_nom,
      circuit_personnalise:  circuitPerso,
      frequence,
      niveau_activation:     niveau,
      actif:                 'OUI',
      types_verbatim_detail: verbatimDetail,
      type_contenu:          'ANALYSE',

      // Activations doctrinales (JSON stringifiés)
      activations_franches:  JSON.stringify(franches),
      activations_nuancees:  JSON.stringify(nuancees),
      clusters_identifies:   JSON.stringify(clustersOfThisCircuit),
      commentaire_attribution: commentaire,

      // Synthèse par pilier (identique sur toutes les lignes du même pilier)
      nb_circuits_actifs_pilier:           String(synthese.nb_circuits_actifs),
      total_activations_pilier:            synthese.total_activations,
      score_concentration_pilier:          synthese.score_concentration,
      cluster_dominant_circuits:           synthese.cluster_dominant_circuits,
      cluster_dominant_co_occurrences:     synthese.cluster_dominant_co_occurrences,
      cluster_dominant_signature_unifiee:  synthese.cluster_dominant_signature_unifiee,
      cluster_dominant_lecture:            synthese.cluster_dominant_lecture,
      nb_signaux_limbiques_pilier:         synthese.nb_signaux_limbiques,
      questions_avec_signaux_limbiques_pilier: synthese.questions_avec_signaux_limbiques,
      candidature_socle_score:             synthese.candidature_socle_score,
      candidature_socle_raison:            synthese.candidature_socle_raison,
      candidature_resistant_score:         synthese.candidature_resistant_score,
      candidature_resistant_raison:        synthese.candidature_resistant_raison,
      analyse_commentee_pilier:            synthese.analyse_commentee
    });
  }

  return rows;
}

/**
 * Construit le libellé `circuit_personnalise` (format 4 ingrédients).
 *
 *   Ingrédient 1 : nom court du circuit officiel/ad hoc
 *   Ingrédient 2 : position narrative (gouvernant / en aval / instrumental / clôture)
 *                  → déduite depuis cog_outils_mobilises / attribution_pilier_signal_brut
 *   Ingrédient 3 : nuance qualitative (normatif, conditionnel, exhaustif...)
 *                  → déduite depuis outil_cognitif_libelle
 *   Ingrédient 4 : spécificité du geste (nuance propre à CETTE activation)
 *                  → libellé du geste extrait par T1
 *
 * Format : "{nom court circuit} — {position} {nuance} : {spécificité}"
 *
 * Sur N activations, on produit une liste à puces (1 puce par activation).
 */
function buildCircuitPersonnalise(circuit, pilier) {
  const nom = circuit.circuit_nom || circuit.nom_ad_hoc || '';
  const lines = [];
  for (const act of circuit.activations) {
    const position = derivePositionNarrative(act);
    const nuance   = act.outil_cognitif_libelle || '';
    const specif   = act.geste || '';
    const sce      = act.scenario || '';
    const ligne    = `• ${act.id_question}${sce ? ' ' + sce : ''} : ${nom} — ${position}${nuance ? ' (' + nuance + ')' : ''} : ${specif}`;
    lines.push(ligne);
  }
  return lines.join('\n');
}

/**
 * Déduit la position narrative du circuit dans la séquence cognitive de la
 * réponse (gouvernant / en aval / instrumental / clôture / dans le cours du PX).
 */
function derivePositionNarrative(activation) {
  const seq = activation.attribution_pilier_signal_brut || '';
  if (!seq) return 'mobilisé';

  // Pattern simple : on regarde si le pilier de l'activation est en MAJUSCULE
  // (cœur) ou en minuscule (traversé) dans la chaîne
  const pilier = activation.pilier_coeur;  // pilier_coeur de la ligne T1
  if (pilier && seq.includes(pilier)) {
    return 'gouvernant';
  }
  return 'en aval';
}

/**
 * Construit le commentaire d'attribution (1-3 phrases factuelles).
 */
function buildCommentaireAttribution({ circuit, frequence, nbFranches, nbNuancees, clusters }) {
  const parts = [];
  parts.push(`Circuit activé ${frequence}× chez ce candidat (${nbFranches} franches / ${nbNuancees} nuancées).`);

  if (clusters.length === 0) {
    if (frequence >= SEUIL_HAUT) {
      parts.push('Aucun cluster détecté au seuil protocole — circuit isolé en niveau HAUT.');
    } else {
      parts.push('Niveau MOYEN, pas de cluster détectable.');
    }
  } else {
    const dom = clusters[0];
    parts.push(`Cluster dominant avec ${dom.circuit_partenaire} (${dom.nb_co_occurrences} co-occurrences).`);
    if (clusters.length > 1) {
      const secondaires = clusters.slice(1).map(c => `${c.circuit_partenaire} (${c.nb_co_occurrences})`).join(', ');
      parts.push(`Cluster(s) secondaire(s) : ${secondaires}.`);
    }
  }

  return parts.join(' ');
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function extractLookup(value) {
  if (value === null || value === undefined) return null;
  if (Array.isArray(value)) return value.length > 0 ? String(value[0]) : null;
  return String(value);
}

function countClustersTotal(clustersParPilier) {
  let total = 0;
  for (const p of ['P1', 'P2', 'P3', 'P4', 'P5']) {
    total += (clustersParPilier[p] || []).length;
  }
  return total;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runConsolidation,

  // Exports internes pour tests unitaires
  _internal: {
    parseAllAttributions,
    parseAttributionBlocs,
    parseOneAttributionBloc,
    detectClustersByPilier,
    computeSynthesesByPilier,
    computeCandidatureSocle,
    computeCandidatureResistant,
    buildAnalyseCommentee,
    buildEtape1T2Rows,
    buildCircuitPersonnalise,
    buildCommentaireAttribution,
    SEUIL_HAUT,
    SEUIL_CLUSTER_COOCC
  }
};
