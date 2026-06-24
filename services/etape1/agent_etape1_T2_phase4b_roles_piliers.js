// services/etape1/agent_etape1_T2_phase4b_roles_piliers.js
// Agent d'ATTRIBUTION DES RÔLES DE PILIERS — ÉTAPE 1.2 / Phase 4b — v1.0 (24/06/2026)
// Profil-Cognitif Sib Prod
//
// ⚠️ AVANT MODIFICATION : lire prod_reference/.../DOCTRINE_ROLES_PILIERS.md
//                       et le prompt new-prompts/etape1/prompt_etape1_T2_roles_piliers.txt
//
// ───────────────────────────────────────────────────────────────────────────
// MISSION
// ───────────────────────────────────────────────────────────────────────────
// Pose le RÔLE de chacun des 5 piliers (socle / amont / aval / fonctionnel) par
// LECTURE DE LABORATOIRE de la table figée POURBILAN (déjà remplie par la Phase 4).
//
// Doctrine (figée) :
//   - Socle = DOUBLE SIGNAL : cœur dominant ET colonne instrumentale la plus
//     alimentée (le pilier autour duquel toute l'activité tourne). Les deux doivent
//     converger ; sinon, drapeau.
//   - Structurant vs fonctionnel = NATURE / CAPACITÉ des circuits servant le socle,
//     PAS le volume. Un pilier à cœur élevé peut rester fonctionnel s'il ne sert
//     pas le socle.
//   - Amont vs aval = position dans la boucle cognitive P1→P2→P3→P4→P5 par rapport
//     au socle (avant = amont/alimente ; après = aval/conclut).
//   - Le socle est le seul rôle toujours présent. Profil exécutant = socle + 4 fonctionnels.
//     NE JAMAIS fabriquer un amont/aval non attesté.
//
// PLACE DANS LA CHAÎNE : après la Phase 4 (qui grave POURBILAN), avant la fin de
// l'étape 1.2. Le service NE recalcule aucun chiffre : il LIT POURBILAN, fait
// l'analyse (1 appel Claude), et MET À JOUR la colonne role_pilier des lignes
// POURBILAN (patch ciblé, ne touche QUE role_pilier).
//
// REMPLACE l'ancienne logique RANG_TO_ROLE de la Phase 4 (rang de fréquence,
// fausse) : ici le rôle est lu sur la nature des gestes, pas déduit d'un rang.
//
// ───────────────────────────────────────────────────────────────────────────
// RÈGLES DURES
// ───────────────────────────────────────────────────────────────────────────
//   - SOURCE UNIQUE = POURBILAN (table figée). Aucun recalcul de chiffres.
//   - PATCH CIBLÉ : on n'écrit QUE role_pilier, sur toutes les lignes de chaque pilier.
//   - 1 SEUL APPEL CLAUDE par candidat.
//   - SORTIE STRICTE : un socle, au plus un amont, au plus un aval, le reste fonctionnel.

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const SERVICE_NAME = 'agent_t2_roles';   // clé de config MAX_TOKENS (à déclarer dans la config agent)
const PROMPT_PATH  = 'etape1/prompt_etape1_T2_roles_piliers.txt';

const PILIERS = ['P1', 'P2', 'P3', 'P4', 'P5'];
const ROLES_VALIDES = ['socle', 'amont', 'aval', 'fonctionnel'];

// Position dans la boucle cognitive (pour situer amont/aval vs socle)
const POSITION_BOUCLE = { P1: 1, P2: 2, P3: 3, P4: 4, P5: 5 };

function fname(v) { return (v && typeof v === 'object' && v.name) ? v.name : v; }
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : 0; }

// ═══════════════════════════════════════════════════════════════════════════
// ENTRÉE PRINCIPALE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Attribue les rôles des 5 piliers pour un candidat, par lecture de POURBILAN.
 *
 * @param {Object} params
 * @param {string} params.candidat_id
 * @returns {Promise<{ roles: Object, socle: string, stats: Object, cost: number, elapsedMs: number }>}
 */
async function runRolesPiliers({ candidat_id }) {
  const startTime = Date.now();
  logger.info('Agent rôles piliers starting', { candidat_id, service: SERVICE_NAME });

  // ─── 1. Lire la table figée POURBILAN (la matière de laboratoire) ────────
  const pourbilan = await airtableService.getEtape1T2CircuitsPourbilan(candidat_id);
  if (!pourbilan || pourbilan.length === 0) {
    throw new Error(
      `Agent rôles piliers — POURBILAN vide pour ${candidat_id}. ` +
      `La Phase 4 doit avoir gravé la table figée avant.`
    );
  }

  // ─── 2. Construire la matière mâchée (lecture de laboratoire pré-calculée) ─
  const matiere = construireMatiere(pourbilan);
  if (!matiere.socle_pressenti) {
    throw new Error(`Agent rôles piliers — impossible de déterminer le socle pour ${candidat_id} (aucun pilier avec cœur/instrumental).`);
  }

  logger.info('Agent rôles piliers — matière construite', {
    candidat_id,
    socle_pressenti:        matiere.socle_pressenti,
    socle_signal_coeur:     matiere.signal_coeur,
    socle_signal_instru:    matiere.signal_instru,
    signaux_convergent:     matiere.signaux_convergent,
    piliers_servant_socle:  matiere.colonne_socle.filter(p => p.total_sert_socle > 0).map(p => p.pilier).join(',')
  });

  // ─── 3. Appeler Claude (1 seul appel) ────────────────────────────────────
  const payload = { candidat_id, ...matiere };

  const { result, usage, cost, elapsedMs: callMs } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: false,
    candidatId:    candidat_id
  });

  // ─── 4. Extraire et valider la sortie ────────────────────────────────────
  const sortie = extractOutput(result);
  validateRoles(sortie, matiere, candidat_id);

  // ─── 5. Patch ciblé de role_pilier sur les lignes POURBILAN ──────────────
  const patchPlan = buildPatchPlan(pourbilan, sortie.roles);
  await airtableService.patchEtape1T2CircuitsPourbilanRoles(candidat_id, patchPlan);

  // ─── 6. Stats & retour ───────────────────────────────────────────────────
  const totalMs = Date.now() - startTime;
  const stats = {
    socle:               sortie.socle,
    roles:               sortie.roles,
    nb_lignes_patchees:  patchPlan.length,
    signaux_convergent:  matiere.signaux_convergent,
    cost_usd:            cost,
    elapsed_call_ms:     callMs,
    elapsed_total_ms:    totalMs
  };
  logger.info('Agent rôles piliers completed', { candidat_id, ...stats });

  return { roles: sortie.roles, socle: sortie.socle, raisonnement: sortie.raisonnement, stats, cost, elapsedMs: totalMs };
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION DE LA MATIÈRE MÂCHÉE (lecture de laboratoire, déterministe)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * À partir des lignes POURBILAN, construit la matière que l'agent va lire :
 *   - décompte cœur par pilier (TOTAL_PILIER)
 *   - total de la colonne instrumentale de chaque pilier (combien il est servi)
 *   - socle pressenti par double signal (cœur + instrumental)
 *   - pour le socle pressenti : la liste, par pilier, des circuits qui le servent
 *     avec leur capacité (la matière pour juger la nature)
 *   - la boucle cognitive
 */
function construireMatiere(pourbilan) {
  const circuits = pourbilan.filter(r => fname(r.type_ligne) === 'CIRCUIT');
  const totauxPilier = {};
  for (const r of pourbilan) {
    if (fname(r.type_ligne) === 'TOTAL_PILIER') {
      const po = fname(r.pilier_owner);
      if (po) totauxPilier[po] = r;
    }
  }

  // ── Signal 1 : cœur par pilier (depuis TOTAL_PILIER) ──
  const coeurParPilier = {};
  for (const P of PILIERS) {
    coeurParPilier[P] = totauxPilier[P] ? num(totauxPilier[P].activation_coeur) : 0;
  }

  // ── Signal 2 : total de la colonne instrumentale de chaque pilier ──
  // (combien chaque pilier est SERVI par les autres = somme des instru_{P}
  //  des lignes CIRCUIT des AUTRES piliers)
  const sertParPilier = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
  for (const c of circuits) {
    const owner = fname(c.pilier_owner);
    for (const P of PILIERS) {
      if (P === owner) continue;          // un pilier ne se sert pas lui-même
      sertParPilier[P] += num(c['instru_' + P]);
    }
  }

  // ── Socle pressenti par double signal ──
  // DOCTRINE (figée 24/06) : le SIGNAL PRINCIPAL est la COLONNE INSTRUMENTALE
  // (le pilier le plus SERVI par les autres = le centre de gravité autour duquel
  // toute l'activité tourne). Le CŒUR est le signal de CONFIRMATION.
  // Cas Rémi : cœur dominant = P5 (26, car il exécute/teste beaucoup) MAIS socle = P4
  // (servi 28 fois). C'est l'instrumental qui désigne le socle, pas le cœur.
  // Si les deux divergent → on retient l'instrumental ET on lève un drapeau pour
  // que l'agent vérifie sur les circuits/verbatims.
  const piliersPresents = PILIERS.filter(P => totauxPilier[P]);
  const socleParCoeur  = [...piliersPresents].sort((a, b) => coeurParPilier[b] - coeurParPilier[a])[0];
  const socleParInstru = [...piliersPresents].sort((a, b) => sertParPilier[b] - sertParPilier[a])[0];
  const signauxConvergent = (socleParCoeur === socleParInstru);
  const soclePressenti = socleParInstru;   // ⭐ l'INSTRUMENTAL prime ; le cœur confirme

  // ── Pour le socle pressenti : colonne instrumentale détaillée par pilier ──
  // Chaque pilier (≠ socle) : combien il sert le socle, et la liste de ses
  // circuits qui servent le socle, avec leur capacité.
  const colonneSocle = [];
  for (const P of piliersPresents) {
    if (P === soclePressenti) continue;
    const circuitsP = circuits.filter(c => fname(c.pilier_owner) === P);
    const circuitsServants = circuitsP
      .filter(c => num(c['instru_' + soclePressenti]) > 0)
      .map(c => ({
        code:      fname(c.circuit_code) || fname(c.circuit_nom_clair),
        nom:       fname(c.circuit_nom_clair) || fname(c.nom_ad_hoc),
        capacite:  fname(c['capacité']) || '',
        sert_socle: num(c['instru_' + soclePressenti]),
        coeur:     num(c.activation_coeur),
        total:     num(c.total_occurrences)
      }))
      .sort((a, b) => b.sert_socle - a.sert_socle);
    colonneSocle.push({
      pilier:           P,
      position_boucle:  POSITION_BOUCLE[P],
      avant_ou_apres_socle: POSITION_BOUCLE[P] < POSITION_BOUCLE[soclePressenti] ? 'avant' : 'apres',
      coeur_du_pilier:  coeurParPilier[P],
      total_sert_socle: sertParPilier[P],
      circuits_servant_le_socle: circuitsServants
    });
  }

  return {
    boucle_cognitive: 'P1 collecte -> P2 tri -> P3 analyse -> P4 creation -> P5 mise en oeuvre',
    coeur_par_pilier: coeurParPilier,
    instrumental_par_pilier: sertParPilier,   // combien chaque pilier est SERVI
    signal_coeur:     socleParCoeur,
    signal_instru:    socleParInstru,
    signaux_convergent: signauxConvergent,
    socle_pressenti:  soclePressenti,
    position_socle_dans_boucle: POSITION_BOUCLE[soclePressenti],
    colonne_socle:    colonneSocle
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE LA SORTIE CLAUDE
// ═══════════════════════════════════════════════════════════════════════════

function extractOutput(rawResult) {
  if (!rawResult) throw new Error('Agent rôles piliers — sortie Claude vide');

  let parsed;
  if (typeof rawResult === 'string') {
    const cleaned = rawResult
      .replace(/^```json\s*/i, '').replace(/^```\s*/i, '')
      .replace(/```\s*$/, '').trim();
    try { parsed = JSON.parse(cleaned); }
    catch (err) {
      logger.error('Agent rôles piliers — JSON parse failed', { error: err.message });
      throw new Error(`Agent rôles piliers — JSON invalide : ${err.message}`);
    }
  } else if (typeof rawResult === 'object') {
    parsed = rawResult;
  } else {
    throw new Error(`Agent rôles piliers — type de sortie inattendu : ${typeof rawResult}`);
  }

  if (!parsed.roles || typeof parsed.roles !== 'object') {
    throw new Error('Agent rôles piliers — clé `roles` absente ou invalide');
  }
  if (!parsed.socle) {
    throw new Error('Agent rôles piliers — clé `socle` absente');
  }
  return {
    socle:        parsed.socle,
    roles:        parsed.roles,
    raisonnement: parsed.raisonnement || {}
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDATION DOCTRINALE DE LA SORTIE
// ═══════════════════════════════════════════════════════════════════════════

function validateRoles(sortie, matiere, candidat_id) {
  const { socle, roles } = sortie;

  // V1 — chaque pilier présent a un rôle valide
  for (const P of PILIERS) {
    if (roles[P] === undefined) continue;     // pilier absent du profil : toléré
    if (!ROLES_VALIDES.includes(roles[P])) {
      throw new Error(`Agent rôles piliers — rôle invalide "${roles[P]}" pour ${P} (${candidat_id})`);
    }
  }

  // V2 — exactement un socle, et c'est bien `socle`
  const socles = PILIERS.filter(P => roles[P] === 'socle');
  if (socles.length !== 1) {
    throw new Error(`Agent rôles piliers — il faut exactement 1 socle, trouvé ${socles.length} (${candidat_id})`);
  }
  if (socles[0] !== socle) {
    throw new Error(`Agent rôles piliers — incohérence : socle déclaré ${socle} mais rôle socle sur ${socles[0]} (${candidat_id})`);
  }

  // V3 — au plus un amont, au plus un aval
  const amonts = PILIERS.filter(P => roles[P] === 'amont');
  const avals  = PILIERS.filter(P => roles[P] === 'aval');
  if (amonts.length > 1) throw new Error(`Agent rôles piliers — au plus 1 amont, trouvé ${amonts.length} (${candidat_id})`);
  if (avals.length > 1)  throw new Error(`Agent rôles piliers — au plus 1 aval, trouvé ${avals.length} (${candidat_id})`);

  // V4 — cohérence boucle : l'amont est AVANT le socle, l'aval APRÈS
  //      (drapeau non bloquant : on logge si l'agent déroge, car des cas rares
  //       peuvent exister, mais on le signale fortement)
  const posSocle = POSITION_BOUCLE[socle];
  if (amonts.length === 1 && POSITION_BOUCLE[amonts[0]] > posSocle) {
    logger.warn('Agent rôles piliers — AMONT situé APRÈS le socle dans la boucle (atypique)', {
      candidat_id, socle, amont: amonts[0]
    });
  }
  if (avals.length === 1 && POSITION_BOUCLE[avals[0]] < posSocle) {
    logger.warn('Agent rôles piliers — AVAL situé AVANT le socle dans la boucle (atypique)', {
      candidat_id, socle, aval: avals[0]
    });
  }

  // V5 — drapeau si le socle retenu diverge du double signal pré-calculé
  if (!matiere.signaux_convergent) {
    logger.warn('Agent rôles piliers — double signal du socle DIVERGENT (cœur vs instrumental)', {
      candidat_id, signal_coeur: matiere.signal_coeur, signal_instru: matiere.signal_instru, socle_retenu: socle
    });
  }

  logger.info('Agent rôles piliers — validation passée', {
    candidat_id, socle,
    amont: amonts[0] || '(aucun)', aval: avals[0] || '(aucun)',
    fonctionnels: PILIERS.filter(P => roles[P] === 'fonctionnel').join(',')
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION DU PLAN DE PATCH (role_pilier sur toutes les lignes du pilier)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pour chaque ligne POURBILAN qui porte un pilier_owner, on patche role_pilier
 * avec le rôle décidé pour ce pilier. Les lignes TOTAL_GENERAL (sans owner) sont
 * ignorées. On ne touche QUE role_pilier.
 */
function buildPatchPlan(pourbilan, roles) {
  const plan = [];
  for (const r of pourbilan) {
    const po = fname(r.pilier_owner);
    if (!po || !roles[po]) continue;          // pas d'owner (TOTAL_GENERAL) ou pilier sans rôle
    const airtableId = r.airtable_id || r.id;
    if (!airtableId) continue;
    plan.push({ airtable_id: airtableId, role_pilier: roles[po] });
  }
  return plan;
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  runRolesPiliers,
  _internal: {
    construireMatiere,
    extractOutput,
    validateRoles,
    buildPatchPlan,
    POSITION_BOUCLE,
    PILIERS,
    ROLES_VALIDES
  }
};
