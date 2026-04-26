// services/prepareT4Inputs.js
// Utilitaire de préparation des payloads pour les 6 agents T4
// Profil-Cognitif v9.0
//
// Les 6 agents T4 ont besoin de données pré-mâchées à partir de T1, T2, T3 :
//   - chiffres clés T1 (nb conformes, nb écarts, ecart_details)
//   - identification du pilier socle, structurants, fonctionnels, résistant
//   - circuits dominants par pilier (top 5)
//   - clusters T3 v4 par pilier
//   - signaux limbiques par pilier
//   - verbatims (pour Agent 5 Coûts)
//
// Cette préparation est faite UNE FOIS par candidat puis distribuée aux 6 agents T4.

'use strict';

const logger = require('../utils/logger');

// ─── Liste ordonnée des piliers ──────────────────────────────────────────────
const PILIERS = ['P1', 'P2', 'P3', 'P4', 'P5'];

const PILIER_NOMS = {
  P1: 'Collecte',
  P2: 'Tri',
  P3: 'Analyse',
  P4: 'Solutions',
  P5: 'Mise en œuvre et exécution'
};

// ─── ROLES — ordre du cycle ──────────────────────────────────────────────────
// Le pilier socle est celui dont T3 a marqué role_pilier='socle'.
// L'ordre de la boucle suit toujours P1→P2→P3→P4→P5 indépendamment du socle.
// Mais la NARRATION du bilan privilégie le socle, puis les structurants, etc.

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Prépare l'ensemble des données dérivées de T1, T2, T3 pour les 6 agents T4.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {string} params.prenom
 * @param {Array} params.t1Rows - lignes ETAPE1_T1
 * @param {Array} params.t2Rows - lignes ETAPE1_T2
 * @param {Array} params.t3Rows - lignes ETAPE1_T3
 * @returns {Object} payloadCommun (à mixer ensuite avec spécificités de chaque agent T4)
 */
function buildT4Inputs({ candidat_id, prenom, t1Rows, t2Rows, t3Rows }) {
  logger.debug('Building T4 inputs', {
    candidat_id,
    t1: t1Rows.length,
    t2: t2Rows.length,
    t3: t3Rows.length
  });

  // 1. Chiffres clés T1
  const chiffres_t1 = computeChiffresT1(t1Rows);

  // 2. Identification des rôles par pilier (depuis T3)
  const roles_par_pilier = identifyRolesParPilier(t3Rows);

  // 3. Données par pilier (circuits actifs, activations, dominants)
  const piliers_data = buildPiliersData(t3Rows, t1Rows);

  // 4. Pilier socle détaillé
  const pilier_socle = buildPilierSocle(roles_par_pilier, piliers_data, t3Rows);

  // 5. Clusters T3 du pilier socle
  const clusters_socle = extractClustersSocle(t3Rows, pilier_socle.id);

  // 6. Signaux limbiques par pilier
  const signaux_limbiques = extractSignauxLimbiques(t1Rows);

  // 7. Données complètes par pilier (pour Agent 5 Coûts)
  const piliers_pour_couts = buildPiliersPourCouts(roles_par_pilier, piliers_data, signaux_limbiques);

  return {
    candidat_id,
    prenom,
    chiffres_t1,
    roles_par_pilier,
    piliers_data,
    pilier_socle,
    clusters_socle,
    signaux_limbiques,
    piliers_pour_couts
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. CHIFFRES CLÉS T1
// ═══════════════════════════════════════════════════════════════════════════

function computeChiffresT1(t1Rows) {
  const conformes = t1Rows.filter(r => normalizeConformeEcart(r.conforme_ecart) === 'CONFORME');
  const ecarts    = t1Rows.filter(r => normalizeConformeEcart(r.conforme_ecart) === 'ECART');

  const ecart_details = ecarts.map(r => ({
    question_id:           `${r.id_question}${r.pilier_demande || ''}`,
    pilier_attendu:        r.pilier_demande || '',
    pilier_coeur_reponse:  extractPilierCoeurFromAnalyse(r.pilier_coeur_analyse)
  }));

  return {
    nb_total:     t1Rows.length,
    nb_conformes: conformes.length,
    nb_ecart:     ecarts.length,
    ecart_details
  };
}

function normalizeConformeEcart(v) {
  if (!v) return '';
  if (v === 'ÉCART') return 'ECART';
  return v;
}

function extractPilierCoeurFromAnalyse(value) {
  // pilier_coeur_analyse a la forme "P3 · collecte hiérarchisée..."
  // → on extrait juste le P + chiffre
  if (!value) return '';
  const match = value.match(/^(P[1-5])/);
  return match ? match[1] : '';
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. IDENTIFICATION DES ROLES PAR PILIER
// ═══════════════════════════════════════════════════════════════════════════

function identifyRolesParPilier(t3Rows) {
  // T3 v4 indique role_pilier sur chaque ligne, mais c'est le même pour toutes
  // les lignes d'un même pilier → on prend la première ligne de chaque pilier
  const roles = {};
  for (const pilier of PILIERS) {
    const ligne = t3Rows.find(r => r.pilier === pilier);
    roles[pilier] = ligne ? (ligne.role_pilier || '') : '';
  }
  return roles;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. DONNÉES PAR PILIER (circuits actifs, activations, dominants)
// ═══════════════════════════════════════════════════════════════════════════

function buildPiliersData(t3Rows, t1Rows) {
  const data = {};

  for (const pilier of PILIERS) {
    const lignes = t3Rows.filter(r => r.pilier === pilier);
    const actifs = lignes.filter(r => r.actif === 'OUI');

    const totalActivations = actifs.reduce((sum, r) => {
      const f = parseInt(r.frequence, 10) || 0;
      return sum + f;
    }, 0);

    // Top 5 circuits par fréquence
    const top5 = [...actifs]
      .sort((a, b) => (parseInt(b.frequence, 10) || 0) - (parseInt(a.frequence, 10) || 0))
      .slice(0, 5)
      .map(r => ({
        id:        r.circuit_id,
        nom:       r.circuit_nom,
        frequence: parseInt(r.frequence, 10) || 0,
        niveau:    r.niveau_activation
      }));

    // Tous les circuits actifs (avec leurs détails)
    const circuits_actifs_detail = actifs.map(r => ({
      id:                       r.circuit_id,
      nom:                      r.circuit_nom,
      frequence:                parseInt(r.frequence, 10) || 0,
      niveau_activation:        r.niveau_activation,
      types_verbatim_detail:    r.types_verbatim_detail || '',
      activations_franches:     parseJSONField(r.activations_franches),
      activations_nuancees:     parseJSONField(r.activations_nuancees),
      clusters_identifies:      parseJSONField(r.clusters_identifies),
      commentaire_attribution:  r.commentaire_attribution || ''
    }));

    data[pilier] = {
      nom:                      PILIER_NOMS[pilier],
      nb_circuits_actifs:       actifs.length,
      total_activations:        totalActivations,
      circuits_dominants_top5:  top5,
      circuits_actifs_detail:   circuits_actifs_detail
    };
  }

  return data;
}

/**
 * Parse un champ JSON sérialisé en string (depuis Airtable Long text)
 * Retourne [] si vide ou erreur
 */
function parseJSONField(value) {
  if (!value) return [];
  if (typeof value !== 'string') return Array.isArray(value) ? value : [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    logger.warn('Failed to parse JSON field', { error: e.message, valuePreview: value.substring(0, 100) });
    return [];
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. PILIER SOCLE
// ═══════════════════════════════════════════════════════════════════════════

function buildPilierSocle(roles, piliersData, t3Rows) {
  // Le pilier socle est celui avec role='socle'
  const socleId = Object.keys(roles).find(p => roles[p] === 'socle');

  if (!socleId) {
    logger.warn('No pilier socle identified in T3');
    return null;
  }

  return {
    id:                      socleId,
    nom:                     PILIER_NOMS[socleId],
    nb_circuits_actifs:      piliersData[socleId].nb_circuits_actifs,
    total_activations:       piliersData[socleId].total_activations,
    circuits_dominants_top5: piliersData[socleId].circuits_dominants_top5
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. CLUSTERS DU PILIER SOCLE
// ═══════════════════════════════════════════════════════════════════════════

function extractClustersSocle(t3Rows, socleId) {
  if (!socleId) return [];

  // Les clusters sont stockés ligne par ligne — on extrait ceux du circuit dominant
  // (le 1er du pilier socle par fréquence)
  const lignesSocle = t3Rows.filter(r => r.pilier === socleId && r.actif === 'OUI');

  const tousClusters = [];

  for (const ligne of lignesSocle) {
    const clusters = parseJSONField(ligne.clusters_identifies);
    for (const c of clusters) {
      tousClusters.push({
        c1:        ligne.circuit_id,
        c2:        c.circuit_partenaire,
        nb_co:     c.nb_co_occurrences,
        questions: c.questions || [],
        rang:      c.rang
      });
    }
  }

  // Dédupliquer (même paire C1×C2 peut apparaître dans les deux sens)
  const seen = new Set();
  const dedup = [];
  for (const c of tousClusters) {
    const key1 = `${c.c1}-${c.c2}`;
    const key2 = `${c.c2}-${c.c1}`;
    if (!seen.has(key1) && !seen.has(key2)) {
      seen.add(key1);
      dedup.push(c);
    }
  }

  // Trier par rang puis par nb_co descendant
  dedup.sort((a, b) => {
    if (a.rang !== b.rang) return (a.rang || 99) - (b.rang || 99);
    return (b.nb_co || 0) - (a.nb_co || 0);
  });

  return dedup;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. SIGNAUX LIMBIQUES PAR PILIER
// ═══════════════════════════════════════════════════════════════════════════

function extractSignauxLimbiques(t1Rows) {
  const signaux = { P1: [], P2: [], P3: [], P4: [], P5: [] };

  for (const r of t1Rows) {
    if (!r.signal_limbique || !r.signal_limbique.trim()) continue;

    // Le signal limbique est lié au pilier_demande (par défaut) — mais peut concerner
    // un autre pilier selon le contenu. Pour la production T4, on utilise pilier_demande
    // qui est le plus fiable.
    const pilier = r.pilier_demande;
    if (!pilier || !signaux[pilier]) continue;

    signaux[pilier].push({
      question: r.id_question,
      verbatim: r.signal_limbique
    });
  }

  return signaux;
}

// ═══════════════════════════════════════════════════════════════════════════
// 7. DONNÉES PILIERS POUR L'AGENT 5 (COÛTS)
// ═══════════════════════════════════════════════════════════════════════════

function buildPiliersPourCouts(roles, piliersData, signauxLimbiques) {
  const result = {};

  for (const pilier of PILIERS) {
    const sigs = signauxLimbiques[pilier] || [];

    result[pilier] = {
      nom:                              PILIER_NOMS[pilier],
      role:                             mapRoleAgent5(roles[pilier]),
      nb_circuits_actifs:               piliersData[pilier].nb_circuits_actifs,
      total_activations:                piliersData[pilier].total_activations,
      nb_signaux_limbiques:             sigs.length,
      questions_avec_signaux_limbiques: sigs.map(s => s.question),
      verbatims_limbiques:              sigs,
      circuits_compensation_haut:       piliersData[pilier].circuits_dominants_top5
        .filter(c => c.niveau === 'HAUT')
        .map(c => ({
          id:                c.id,
          nom:               c.nom,
          frequence:         c.frequence,
          role_compensation: ''  // texte libre, l'agent le remplit lui-même
        }))
    };
  }

  return result;
}

/**
 * Convertit le role T3 ('socle', 'structurant_1', etc.) en format Agent 5
 * ('pilier_socle', 'pilier_structurant_1', 'pilier_resistant', ...)
 */
function mapRoleAgent5(roleT3) {
  if (!roleT3) return '';
  if (roleT3 === 'socle')         return 'pilier_socle';
  if (roleT3 === 'structurant_1') return 'pilier_structurant_1';
  if (roleT3 === 'structurant_2') return 'pilier_structurant_2';
  if (roleT3 === 'fonctionnel_1') return 'pilier_fonctionnel_1';
  if (roleT3 === 'fonctionnel_2') return 'pilier_fonctionnel_2';
  if (roleT3 === 'résistant' || roleT3 === 'resistant') return 'pilier_resistant';
  return roleT3;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  buildT4Inputs,
  // exports utilitaires
  PILIERS,
  PILIER_NOMS,
  parseJSONField,
  normalizeConformeEcart,
  computeChiffresT1,
  identifyRolesParPilier,
  buildPiliersData,
  buildPilierSocle,
  extractClustersSocle,
  extractSignauxLimbiques,
  mapRoleAgent5
};
