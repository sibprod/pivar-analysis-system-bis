// services/etape1/agentT2_phase3_enrichissement_Service.js
// Agent d'ENRICHISSEMENT — ÉTAPE 2 / Phase 3 — v1.0 (22/05/2026)
// Profil-Cognitif v10.9 — Algorithme A v1.1
//
// ⚠️ AVANT MODIFICATION : lire docs/memo_technique_phase3.md (22/05/2026)
//                       et docs/spec_algorithme_A_enrichissement_T1.md (v1.1)
//
// ───────────────────────────────────────────────────────────────────────────
// CONTEXTE — Refonte v10.9 (22/05/2026)
// ───────────────────────────────────────────────────────────────────────────
//
// Phase 3 ajoutée à l'étape 2 (sans toucher à Phase 1 ni Phase 2).
// Service purement mécanique : 0 appel Claude, < 2 secondes.
//
//   étape 2 (orchestratorEtape2 v10.9) :
//     ├─ Phase 1 (Claude)        — écrit types_verbatim_circuits dans ETAPE1_T1
//     ├─ Phase 2 (mécanique)     — écrit ETAPE1_T2 (consolidation par circuit)
//     └─ Phase 3 (CE SERVICE)    — 3 sous-étapes mécaniques :
//         ├─ 3A : enrichit ETAPE1_T1 avec 14 champs (Algorithme A v1.1)
//         ├─ 3B : écrit ETAPE1_T2_VENTILATION_PILIERS (1-5 lignes/candidat)
//         └─ 3C : écrit ETAPE1_T2_INVENTAIRE_CIRCUITS (~30-60 lignes/candidat)
//
// ───────────────────────────────────────────────────────────────────────────
// RÈGLES DURES NON NÉGOCIABLES
// ───────────────────────────────────────────────────────────────────────────
//
//   - ZÉRO INVENTION : sortie strictement déterministe à partir des entrées.
//   - AD HOC PRÉSERVÉS : nom complet entre guillemets dans tous les champs.
//   - PILIER CŒUR JAMAIS INSTRUMENTAL : nb_P{N}_instru = 0 quand P{N} == pilier_coeur.
//   - ORDRE INSTRUMENTAL : ordre d'apparition dans le verbatim.
//   - FORMAT COMPTEUR : "P1:2/P5:2" (pas d'espace après ":").
//   - NOTATION PxCy : "P3C12" (jamais "C12" sans son pilier).
//   - LIBELLÉS PILIERS : depuis REFERENTIEL_PILIERS (source unique de vérité).
//
// ───────────────────────────────────────────────────────────────────────────
// PATTERN D'ÉCRITURE
// ───────────────────────────────────────────────────────────────────────────
//
//   3A → patchEtape1T1Rows (patch ciblé, ne touche que les 14 champs)
//   3B → writeEtape1T2VentilationPiliers (delete + create atomique)
//   3C → writeEtape1T2InventaireCircuits (delete + create atomique)
//
//   Séquence : 3A puis 3B puis 3C. Si 3A échoue : 3B et 3C non exécutés.
//   En cas d'échec partiel, l'orchestrateur pose ETAPE2_PHASE2_TERMINEE.
//   Phase 3 entière est idempotente : rejouable via REPRENDRE_AGENT2_PHASE3.

'use strict';

const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const SERVICE_NAME = 'agent_t2_phase3_enrichissement';

// ─── Constantes doctrinales ─────────────────────────────────────────────────

const PILIERS = ['P1', 'P2', 'P3', 'P4', 'P5'];

// Regex de parsing — capture (pilier, circuit, type) pour chaque attribution
// dans types_verbatim_circuits.
//   - Pilier : P1 à P5
//   - Circuit : C{N} (officiel) OU ADHOC "..." (ad hoc, nom préservé)
//   - Type : FRANCHE, NUANCEE, AD_HOC, NON_ATTRIBUEE (suffixe "(nouveau)" ignoré)
//   - Séparateur : · (U+00B7 MIDDLE DOT) obligatoire
const ATTRIBUTION_PATTERN = /(P[1-5])\s*·\s*(C\d+|ADHOC\s*(?:"[^"]+")?)\s*·\s*([A-Z_]+)(?:\s*\(nouveau\))?/g;

// Fallback si REFERENTIEL_PILIERS retourne un libellé vide.
const PILIER_LIBELLES_FALLBACK = {
  P1: 'Collecte d\'information',
  P2: 'Tri et organisation',
  P3: 'Analyse et diagnostic',
  P4: 'Création de solutions',
  P5: 'Mise en œuvre et exécution'
};

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute la Phase 3 complète (3A + 3B + 3C) pour un candidat.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {string} [params.session_id]  Résolu depuis T1 si absent
 * @returns {Promise<{
 *   nb_lignes_t1_enrichies: number,
 *   nb_lignes_ventilation:  number,
 *   nb_lignes_inventaire:   number,
 *   stats: Object,
 *   elapsedMs: number
 * }>}
 */
async function runEnrichissement({ candidat_id, session_id = null }) {
  const startTime = Date.now();
  logger.info('Agent enrichissement Phase 3 starting', { candidat_id, service: SERVICE_NAME });

  // ─── 1. Lire les 25 lignes ETAPE1_T1 (lecture UNIQUE pour 3A + 3B + 3C) ──
  const lignesT1 = await airtableService.getEtape1T1(candidat_id);
  if (!lignesT1 || lignesT1.length === 0) {
    throw new Error(
      `Agent enrichissement Phase 3 — aucune ligne ETAPE1_T1 pour ${candidat_id}. ` +
      `Phase 1 (attribution) doit avoir tourné avant.`
    );
  }

  // ─── 2. Résoudre session_id depuis T1 si pas fourni ──────────────────────
  if (!session_id) {
    session_id = lignesT1[0].session_ID || lignesT1[0].session_id || candidat_id;
  }

  // ─── 3. Charger les libellés piliers depuis REFERENTIEL_PILIERS ──────────
  const pilierLibelles = await loadPilierLibelles();

  // ═════════════════════════════════════════════════════════════════════════
  // SOUS-ÉTAPE 3A — Enrichissement ETAPE1_T1 (14 champs par ligne)
  // ═════════════════════════════════════════════════════════════════════════
  logger.info('Phase 3A — Enrichissement ETAPE1_T1 starting', { candidat_id, nb_lignes: lignesT1.length });

  const stats3A = {
    nb_lignes_traitees:      0,
    nb_lignes_sans_tvc:      0,
    nb_lignes_sans_coeur:    0,
    nb_attributions_totales: 0,
    nb_attributions_coeur:   0,
    nb_attributions_instru:  0
  };

  // Stocker les attributions parsées par ligne pour réutilisation en 3B et 3C
  // (évite de re-parser les mêmes données 3 fois)
  const attributionsParLigneT1 = new Map();  // id_question → { pilier_coeur, attributions[] }

  const patchPlan = [];

  for (const t1 of lignesT1) {
    const id_question = t1.id_question;
    const tvc         = t1.types_verbatim_circuits;
    const pilier_coeur = t1.pilier_coeur;

    // Validation : pilier_coeur obligatoire
    if (!pilier_coeur || !PILIERS.includes(pilier_coeur)) {
      logger.warn('Phase 3A — Ligne T1 sans pilier_coeur valide, skip enrichissement', {
        candidat_id,
        id_question,
        pilier_coeur_observe: pilier_coeur
      });
      stats3A.nb_lignes_sans_coeur++;
      attributionsParLigneT1.set(id_question, { pilier_coeur: null, attributions: [] });
      continue;
    }

    // Parser types_verbatim_circuits (vide → liste vide, OK)
    let attributions = [];
    if (tvc && typeof tvc === 'string' && tvc.trim().length > 0) {
      attributions = parseAttributions(tvc);
    } else {
      logger.warn('Phase 3A — Ligne T1 sans types_verbatim_circuits, valeurs par défaut', {
        candidat_id,
        id_question
      });
      stats3A.nb_lignes_sans_tvc++;
    }

    // Stocker pour réutilisation en 3B et 3C
    attributionsParLigneT1.set(id_question, { pilier_coeur, attributions });

    // Calculer les 14 champs
    const enrichissement = calculer14Champs(attributions, pilier_coeur);

    // Stats
    stats3A.nb_lignes_traitees++;
    stats3A.nb_attributions_totales += attributions.length;
    stats3A.nb_attributions_coeur   += enrichissement.nb_activations_coeur;
    stats3A.nb_attributions_instru  += (attributions.length - enrichissement.nb_activations_coeur);

    // Construire l'entrée de patch (pattern airtableService.patchEtape1T1Rows)
    patchPlan.push({
      airtable_id:      t1.airtable_id || t1.record_id || t1.id,
      id_question,
      nb_corrections:   14,
      fields_to_patch:  enrichissement
    });
  }

  if (patchPlan.length === 0) {
    throw new Error(
      `Phase 3A — Aucune ligne à enrichir pour ${candidat_id} ` +
      `(toutes les lignes T1 ont un pilier_coeur invalide).`
    );
  }

  // Écriture batch (utilise le helper existant patchEtape1T1Rows)
  await airtableService.patchEtape1T1Rows(candidat_id, patchPlan);

  logger.info('Phase 3A — Enrichissement ETAPE1_T1 terminé', {
    candidat_id,
    nb_lignes_enrichies: patchPlan.length,
    ...stats3A
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SOUS-ÉTAPE 3B — Ventilation par pilier cœur (table 1)
  // ═════════════════════════════════════════════════════════════════════════
  logger.info('Phase 3B — Ventilation par pilier cœur starting', { candidat_id });

  const rowsVentilation = buildVentilationPiliers({
    attributionsParLigneT1,
    candidat_id,
    session_id,
    pilierLibelles,
    nbLignesT1Total: lignesT1.length
  });

  await airtableService.writeEtape1T2VentilationPiliers(candidat_id, rowsVentilation);

  logger.info('Phase 3B — Ventilation par pilier cœur terminée', {
    candidat_id,
    nb_lignes_ventilation: rowsVentilation.length,
    piliers_observes:      rowsVentilation.map(r => r.pilier_coeur).join(',')
  });

  // ═════════════════════════════════════════════════════════════════════════
  // SOUS-ÉTAPE 3C — Inventaire circuits (table 2)
  // ═════════════════════════════════════════════════════════════════════════
  logger.info('Phase 3C — Inventaire circuits starting', { candidat_id });

  const rowsInventaire = buildInventaireCircuits({
    attributionsParLigneT1,
    candidat_id,
    session_id
  });

  await airtableService.writeEtape1T2InventaireCircuits(candidat_id, rowsInventaire);

  // Stats finales pour 3C
  const nb_ad_hoc = rowsInventaire.filter(r => r.circuit_origine === 'AD_HOC').length;

  logger.info('Phase 3C — Inventaire circuits terminé', {
    candidat_id,
    nb_lignes_inventaire: rowsInventaire.length,
    nb_circuits_officiels: rowsInventaire.length - nb_ad_hoc,
    nb_ad_hoc
  });

  // ═════════════════════════════════════════════════════════════════════════
  // Stats finales et retour
  // ═════════════════════════════════════════════════════════════════════════
  const totalMs = Date.now() - startTime;

  const stats = {
    ...stats3A,
    nb_piliers_actifs:      rowsVentilation.length,
    nb_circuits_distincts:  rowsInventaire.length,
    nb_ad_hoc,
    elapsed_total_ms:       totalMs
  };

  logger.info('Agent enrichissement Phase 3 completed', { candidat_id, ...stats });

  return {
    nb_lignes_t1_enrichies: patchPlan.length,
    nb_lignes_ventilation:  rowsVentilation.length,
    nb_lignes_inventaire:   rowsInventaire.length,
    stats,
    elapsedMs: totalMs
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARGEMENT DES LIBELLÉS PILIERS (REFERENTIEL_PILIERS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Charge les libellés piliers depuis REFERENTIEL_PILIERS (source de vérité).
 * Utilise le helper existant airtableService.getReferentielPiliers().
 * Fallback sur PILIER_LIBELLES_FALLBACK si lecture impossible ou libellé manquant.
 */
async function loadPilierLibelles() {
  const result = {};
  try {
    const referentiel = await airtableService.getReferentielPiliers();
    for (const p of referentiel) {
      const code = p.pilier_code;
      const lib  = p.pilier_intitule_court;
      if (code && PILIERS.includes(code)) {
        result[code] = lib || PILIER_LIBELLES_FALLBACK[code];
        if (!lib) {
          logger.warn('Phase 3 — pilier_intitule_court manquant dans REFERENTIEL_PILIERS', { pilier_code: code });
        }
      }
    }
  } catch (e) {
    logger.warn('Phase 3 — échec lecture REFERENTIEL_PILIERS, fallback sur libellés par défaut', { error: e.message });
  }

  // Complétion avec fallback pour tout pilier manquant
  for (const P of PILIERS) {
    if (!result[P]) result[P] = PILIER_LIBELLES_FALLBACK[P];
  }
  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// PARSING DES ATTRIBUTIONS (depuis types_verbatim_circuits)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Parse types_verbatim_circuits en liste d'attributions ordonnées.
 * Format attendu (multi-lignes, peut contenir métadonnées geste/verbatim) :
 *
 *   P3 · C12 · FRANCHE
 *      geste : "..."
 *      verbatim : "..."
 *
 *   P5 · ADHOC "Élimination délibérée des données" · AD_HOC (nouveau)
 *      geste : "..."
 *
 * Extrait UNIQUEMENT les lignes d'attribution dans l'ordre d'apparition.
 *
 * @param {string} texte
 * @returns {Array<{pilier: string, circuit: string, type: string}>}
 */
function parseAttributions(texte) {
  if (!texte || typeof texte !== 'string') return [];

  const results = [];
  ATTRIBUTION_PATTERN.lastIndex = 0;  // reset regex globale

  let m;
  while ((m = ATTRIBUTION_PATTERN.exec(texte)) !== null) {
    results.push({
      pilier:  m[1],
      circuit: m[2].trim(),
      type:    m[3].trim()
    });
  }

  return results;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3A — CALCUL DES 14 CHAMPS D'ENRICHISSEMENT T1
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Calcule les 14 champs d'enrichissement à partir des attributions ordonnées
 * et du pilier_coeur de la ligne.
 *
 * @param {Array<{pilier, circuit, type}>} attributions
 * @param {string} pilier_coeur  P1, P2, P3, P4 ou P5
 * @returns {Object} 14 champs à patcher dans ETAPE1_T1
 */
function calculer14Champs(attributions, pilier_coeur) {
  const coeur  = attributions.filter(a => a.pilier === pilier_coeur);
  const instru = attributions.filter(a => a.pilier !== pilier_coeur);

  // Champ 1 : nb_activations_coeur
  const nb_activations_coeur = coeur.length;

  // Champ 2 : detail_circuits_coeur — "P3 · C12 · FRANCHE/P3 · C4 · FRANCHE/..."
  const detail_circuits_coeur = coeur
    .map(a => `${a.pilier} · ${a.circuit} · ${a.type}`)
    .join('/');

  // Champ 3 : detail_circuits_instrumentaux
  // Regroupé par pilier dans l'ordre d'apparition. '/' intra-pilier, ' + ' inter-piliers.
  const piliersOrdreApparition = [];
  const instruParPilier = {};
  for (const a of instru) {
    if (!instruParPilier[a.pilier]) {
      piliersOrdreApparition.push(a.pilier);
      instruParPilier[a.pilier] = [];
    }
    instruParPilier[a.pilier].push(`${a.pilier} · ${a.circuit} · ${a.type}`);
  }
  const detail_circuits_instrumentaux = piliersOrdreApparition
    .map(p => instruParPilier[p].join('/'))
    .join(' + ');

  // Champ 4 : nb_activations_par_pilier_instrumental — "P1:2/P5:2"
  const nb_activations_par_pilier_instrumental = piliersOrdreApparition
    .map(p => `${p}:${instruParPilier[p].length}`)
    .join('/');

  // Champs 5-14 : décomposition par pilier
  const result = {
    nb_activations_coeur,
    detail_circuits_coeur,
    detail_circuits_instrumentaux,
    nb_activations_par_pilier_instrumental
  };

  for (const P of PILIERS) {
    if (P === pilier_coeur) {
      // Pilier cœur : colonnes instrumentales vides par construction
      result[`nb_${P}_instru`]     = 0;
      result[`detail_${P}_instru`] = '';
    } else {
      const circuits = (instruParPilier[P] || []);
      result[`nb_${P}_instru`]     = circuits.length;
      result[`detail_${P}_instru`] = circuits.join('/');
    }
  }

  return result;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3B — VENTILATION PAR PILIER CŒUR (table ETAPE1_T2_VENTILATION_PILIERS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construit les rows de ETAPE1_T2_VENTILATION_PILIERS.
 * 1 ligne par (candidat × pilier_coeur observé), max 5 par candidat.
 */
function buildVentilationPiliers({ attributionsParLigneT1, candidat_id, session_id, pilierLibelles, nbLignesT1Total }) {
  // ─── 1. Grouper les lignes T1 par pilier_coeur ──────────────────────────
  const blocsParPilier = {};

  for (const [id_question, data] of attributionsParLigneT1) {
    const pc = data.pilier_coeur;
    if (!pc) continue;  // Ligne sans pilier_coeur valide → skip

    if (!blocsParPilier[pc]) {
      blocsParPilier[pc] = { pilier_coeur: pc, lignes: [] };
    }
    blocsParPilier[pc].lignes.push({ id_question, attributions: data.attributions });
  }

  // ─── 2. Construire une ligne par bloc ───────────────────────────────────
  const blocs = [];

  for (const pc of Object.keys(blocsParPilier)) {
    const bloc = blocsParPilier[pc];

    let nbActivationsCoeur = 0;
    let nbActivationsInstru = 0;
    const compteursCoeur = new Map();   // "P3C12" → 5
    const compteursInstru = {
      P1: new Map(), P2: new Map(), P3: new Map(), P4: new Map(), P5: new Map()
    };

    for (const ligne of bloc.lignes) {
      for (const attr of ligne.attributions) {
        const label = buildCircuitLabel(attr);
        if (attr.pilier === pc) {
          nbActivationsCoeur++;
          compteursCoeur.set(label, (compteursCoeur.get(label) || 0) + 1);
        } else {
          nbActivationsInstru++;
          compteursInstru[attr.pilier].set(label, (compteursInstru[attr.pilier].get(label) || 0) + 1);
        }
      }
    }

    const nbReponses = bloc.lignes.length;
    const pctReponses = nbLignesT1Total > 0 ? Math.round(100 * nbReponses / nbLignesT1Total) : 0;

    const row = {
      candidat_id,
      session_ID:                   session_id,
      pilier_coeur:                 pc,
      pilier_coeur_libelle:         pilierLibelles[pc] || pc,
      // rang_par_frequence : assigné après tri
      nb_reponses:                  nbReponses,
      pct_reponses:                 pctReponses,
      nb_activations_coeur_total:   nbActivationsCoeur,
      nb_activations_instru_total:  nbActivationsInstru,
      ventilation_circuits_coeur:   formatVentilation(compteursCoeur),
      ventilation_P1_instru:        formatVentilation(compteursInstru.P1),
      ventilation_P2_instru:        formatVentilation(compteursInstru.P2),
      ventilation_P3_instru:        formatVentilation(compteursInstru.P3),
      ventilation_P4_instru:        formatVentilation(compteursInstru.P4),
      ventilation_P5_instru:        formatVentilation(compteursInstru.P5),
      nb_P1_instru_total:           sumCounters(compteursInstru.P1),
      nb_P2_instru_total:           sumCounters(compteursInstru.P2),
      nb_P3_instru_total:           sumCounters(compteursInstru.P3),
      nb_P4_instru_total:           sumCounters(compteursInstru.P4),
      nb_P5_instru_total:           sumCounters(compteursInstru.P5),
      liste_id_questions:           bloc.lignes.map(l => l.id_question).join(', ')
    };

    blocs.push(row);
  }

  // ─── 3. Calculer rang_par_frequence (tri par nb_reponses DESC, tie-break alpha) ──
  blocs.sort((a, b) => {
    if (b.nb_reponses !== a.nb_reponses) return b.nb_reponses - a.nb_reponses;
    return a.pilier_coeur.localeCompare(b.pilier_coeur);
  });
  blocs.forEach((b, i) => { b.rang_par_frequence = i + 1; });

  return blocs;
}

/**
 * Formate un compteur (Map) en chaîne "P3C12(11) · P3C4(5) · P3C8(3)"
 * Tri par occurrence décroissante, tie-break alphabétique.
 */
function formatVentilation(counterMap) {
  if (!counterMap || counterMap.size === 0) return '';
  const entries = Array.from(counterMap.entries());
  entries.sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  return entries.map(([label, count]) => `${label}(${count})`).join(' · ');
}

function sumCounters(counterMap) {
  let total = 0;
  for (const c of counterMap.values()) total += c;
  return total;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3C — INVENTAIRE CIRCUITS (table ETAPE1_T2_INVENTAIRE_CIRCUITS)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construit les rows de ETAPE1_T2_INVENTAIRE_CIRCUITS.
 * 1 ligne par (candidat × circuit distinct), ~30-60 par candidat.
 */
function buildInventaireCircuits({ attributionsParLigneT1, candidat_id, session_id }) {
  // ─── 1. Agréger les compteurs par circuit_label ─────────────────────────
  const circuits = new Map();  // "P1C15" → entrée détaillée

  for (const [id_question, data] of attributionsParLigneT1) {
    const pc = data.pilier_coeur;
    if (!pc) continue;

    for (const attr of data.attributions) {
      const label = buildCircuitLabel(attr);

      if (!circuits.has(label)) {
        circuits.set(label, {
          circuit_label:     label,
          pilier_owner:      attr.pilier,
          circuit_id:        extractCircuitId(attr.circuit),
          circuit_origine:   isAdHoc(attr.circuit) ? 'AD_HOC' : 'OFFICIEL',
          nom_ad_hoc:        isAdHoc(attr.circuit) ? extractAdHocName(attr.circuit) : '',
          nb_coeur:          0,
          nb_svc_P1:         0,
          nb_svc_P2:         0,
          nb_svc_P3:         0,
          nb_svc_P4:         0,
          nb_svc_P5:         0
        });
      }

      const entry = circuits.get(label);
      if (attr.pilier === pc) {
        // Le circuit appartient au pilier_coeur de la ligne → rôle cœur
        entry.nb_coeur++;
      } else {
        // Le circuit est en service du pilier_coeur de la ligne → rôle instrumental
        entry[`nb_svc_${pc}`]++;
      }
    }
  }

  // ─── 2. Construire les rows avec total_activations ───────────────────────
  const rows = [];
  for (const entry of circuits.values()) {
    const total = entry.nb_coeur +
      entry.nb_svc_P1 + entry.nb_svc_P2 + entry.nb_svc_P3 +
      entry.nb_svc_P4 + entry.nb_svc_P5;

    rows.push({
      candidat_id,
      session_ID:        session_id,
      circuit_label:     entry.circuit_label,
      pilier_owner:      entry.pilier_owner,
      circuit_id:        entry.circuit_id,
      circuit_origine:   entry.circuit_origine,
      nom_ad_hoc:        entry.nom_ad_hoc,
      nb_coeur:          entry.nb_coeur,
      nb_svc_P1:         entry.nb_svc_P1,
      nb_svc_P2:         entry.nb_svc_P2,
      nb_svc_P3:         entry.nb_svc_P3,
      nb_svc_P4:         entry.nb_svc_P4,
      nb_svc_P5:         entry.nb_svc_P5,
      total_activations: total
      // rang_dans_pilier calculé en step 3
    });
  }

  // ─── 3. Calculer rang_dans_pilier (par pilier_owner, tri total DESC) ─────
  const parPilier = { P1: [], P2: [], P3: [], P4: [], P5: [] };
  for (const r of rows) {
    if (parPilier[r.pilier_owner]) parPilier[r.pilier_owner].push(r);
  }
  for (const P of PILIERS) {
    parPilier[P].sort((a, b) => {
      if (b.total_activations !== a.total_activations) return b.total_activations - a.total_activations;
      return a.circuit_label.localeCompare(b.circuit_label);
    });
    parPilier[P].forEach((r, i) => { r.rang_dans_pilier = i + 1; });
  }

  return rows;
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS — Construction de circuit_label / extraction circuit_id / ad hoc
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construit l'identifiant unique d'un circuit.
 *   - Officiel : "P3C12" (concaténation pilier + circuit_id)
 *   - Ad hoc   : "P5·ADHOC \"Élimination délibérée\""
 */
function buildCircuitLabel(attr) {
  if (isAdHoc(attr.circuit)) {
    return `${attr.pilier}·${attr.circuit}`;
  }
  return `${attr.pilier}${attr.circuit}`;
}

function isAdHoc(circuit) {
  return typeof circuit === 'string' && circuit.startsWith('ADHOC');
}

function extractCircuitId(circuit) {
  if (isAdHoc(circuit)) return 'ADHOC';
  return circuit;
}

function extractAdHocName(circuit) {
  const match = circuit.match(/ADHOC\s*"([^"]+)"/);
  return match ? match[1] : '';
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runEnrichissement,

  // Exposé pour tests unitaires
  _internal: {
    parseAttributions,
    calculer14Champs,
    buildVentilationPiliers,
    buildInventaireCircuits,
    buildCircuitLabel,
    formatVentilation,
    sumCounters,
    isAdHoc,
    extractCircuitId,
    extractAdHocName,
    PILIERS,
    ATTRIBUTION_PATTERN,
    PILIER_LIBELLES_FALLBACK
  }
};
