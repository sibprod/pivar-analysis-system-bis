// services/agentT1CertificateurService.js
// Certificateur T1 — Vérification doctrinale post-production
// Profil-Cognitif v9.1 — DOCTRINE DE PROMPTING APPLIQUÉE (Lot 17)
//
// Rôle :
//   - Lit les 25 lignes T1 produites par l'agent T1
//   - Vérifie l'application stricte des règles critiques (Niveau 1 et 2 de la doctrine)
//   - Flag les lignes douteuses avec raison
//   - Écrit le rapport dans la table CERTIFICATEUR_T1
//
// DOCTRINE APPLIQUÉE :
//   - Pilier 1 : thinking activé pour ce certificateur
//   - Pilier 6 : indépendance — prompt distinct, contexte distinct
//   - Pilier 7 : log complet
//
// Mission UNIQUE : vérifier l'application des règles. Pas de production.

'use strict';

const agentBase       = require('./agentBase');
const airtableService = require('./airtableService');
const logger          = require('../utils/logger');

const SERVICE_NAME = 'agent_t1_certificateur';
const PROMPT_PATH  = 'certificateur_t1.txt';

/**
 * Exécute le certificateur T1 sur les 25 lignes produites par T1
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Array}  params.rows_t1 — les 25 lignes T1 à vérifier
 * @returns {Promise<{verdict: string, violations: Array, usage, cost, elapsedMs}>}
 */
async function runCertificateurT1({ candidat_id, rows_t1 }) {
  const startTime = Date.now();
  logger.info('Certificateur T1 starting', { candidat_id, lignes_a_verifier: rows_t1.length });

  if (!rows_t1 || rows_t1.length === 0) {
    throw new Error(`No T1 rows to certify for ${candidat_id}`);
  }

  // Construction du payload : on ne passe que ce qui est nécessaire à la vérification
  // (allège le contexte, augmente la saillance des règles critiques)
  const payload = {
    candidat_id,
    nb_lignes_a_verifier: rows_t1.length,
    instruction_certificateur: buildCertificateurInstruction(),
    lignes_t1: rows_t1.map(row => ({
      id_question:                   row.id_question,
      question_id_protocole:         row.question_id_protocole,
      scenario:                      row.scenario,
      pilier_demande:                row.pilier_demande,
      verbatim_candidat:             row.verbatim_candidat,
      v1_conforme:                   row.v1_conforme,
      v2_traite_problematique:       row.v2_traite_problematique,
      pilier_coeur_analyse:          row.pilier_coeur_analyse,
      verbes_observes:               row.verbes_observes,
      conforme_ecart:                row.conforme_ecart,
      ecart_detail:                  row.ecart_detail,
      signal_limbique:               row.signal_limbique,
      attribution_pilier_signal_brut: row.attribution_pilier_signal_brut,
      raisonnement:                  row.raisonnement || ''  // doit avoir été produit par T1 doctrinal
    }))
  };

  // Appel Claude (thinking activé)
  const { result, usage, cost } = await agentBase.callAgent({
    serviceName:   SERVICE_NAME,
    promptPath:    PROMPT_PATH,
    payload,
    injectLexique: false,
    candidatId:    candidat_id
  });

  const elapsedMs = Date.now() - startTime;

  const verdict    = result?.verdict_global || 'INDETERMINE';
  const violations = Array.isArray(result?.violations) ? result.violations : [];

  logger.info('Certificateur T1 done', {
    candidat_id,
    verdict,
    nb_violations: violations.length,
    cost_usd:      cost.toFixed(4),
    elapsedMs
  });

  // Écrire le rapport dans Airtable (table CERTIFICATEUR_T1 à créer)
  await writeCertificateurReport({
    candidat_id,
    verdict,
    violations,
    nb_lignes_verifiees: rows_t1.length,
    cost_usd:            cost,
    elapsed_ms:          elapsedMs
  });

  return { verdict, violations, usage, cost, elapsedMs };
}

// ─── INSTRUCTION CERTIFICATEUR ────────────────────────────────────────────
function buildCertificateurInstruction() {
  return `
TU ES LE CERTIFICATEUR T1.

Ta mission UNIQUE : vérifier l'application stricte des règles doctrinales sur chaque ligne T1
produite par l'agent. Tu n'es pas l'agent. Tu ne refais pas l'analyse. Tu vérifies seulement.

Pour CHAQUE ligne T1 reçue, applique les vérifications suivantes dans cet ordre :

═══════════════════════════════════════════════════════════════════════════
NIVEAU 1 — RÈGLES MÉCANIQUES (jamais à violer)
═══════════════════════════════════════════════════════════════════════════

V1.1 — Cohérence V1 ↔ conforme_ecart
  - Si v1_conforme = 'OUI' alors conforme_ecart DOIT être 'CONFORME'
  - Si v1_conforme = 'NON' alors conforme_ecart DOIT être 'ECART' (ou 'ÉCART')
  - Toute autre combinaison est une VIOLATION CRITIQUE
  - Règle absolue du prompt T1 : « V1=OUI → toujours Conforme. V1=NON → toujours ÉCART. Sans exception. »

V1.2 — ecart_detail rempli si ECART
  - Si conforme_ecart = 'ECART', alors ecart_detail DOIT être non vide
  - Si conforme_ecart = 'CONFORME', alors ecart_detail DOIT être vide

═══════════════════════════════════════════════════════════════════════════
NIVEAU 2 — RÈGLES DOCTRINALES DE DIFFÉRENCIATION DES PILIERS
═══════════════════════════════════════════════════════════════════════════

V2.1 — Erreur 9 du prompt T1 : ne pas confondre verbe initial et angle d'attaque
  - Si pilier_coeur_analyse commence par P3 :
      Vérifie que le candidat produit bien une analyse causale autonome
      (pas une action conditionnelle, pas de génération multiple, pas d'exécution déguisée)
  - Indice de violation possible : verbatim contenant "j'analyse" ou "j'évalue" en début,
    mais le geste réel est de filtrer (P2), de générer (P4), ou d'agir (P5).

V2.2 — Filtre crédibilité ≠ P3 cœur
  - Règle absolue du prompt T1 : « Évaluer la fiabilité d'une source = P3 au service
    de P1, le cœur reste P1. »
  - Si le verbatim contient "j'analyse qui a produit", "je vérifie la source",
    "pas trop de [type de source]", et que pilier_coeur = P3 :
      → Probable violation. Le geste est filtrer (P2 ou P1 selon contexte), pas analyser.

V2.3 — Solutions conditionnelles = P4 (pas P3)
  - Règle absolue : « Si ... alors X, sinon Y » = P4 (création de solutions différenciées)
  - Si le verbatim contient "si ... alors / si ... je / sinon" et propose des actions
    différenciées, et pilier_coeur = P3 :
      → Probable violation. C'est de la création P4.

V2.4 — Action concrète ≠ P3
  - Règle : « Je consulte un spécialiste », « je m'adapte », « je sacrifie X pour Y »
    = P5 (action), pas P3 (évaluation).
  - Si le verbatim décrit une action immédiate et pilier_coeur = P3 :
      → Probable violation.

═══════════════════════════════════════════════════════════════════════════
NIVEAU 3 — SIGNAL LIMBIQUE
═══════════════════════════════════════════════════════════════════════════

V3.1 — Signal limbique = rupture émotionnelle vive
  - Pour chaque ligne où signal_limbique est rempli, vérifie :
    Le verbatim contient-il une RUPTURE de ton émotionnelle vive ?
    ✅ OUI : "ça me met hors de moi", "j'ai paniqué", "j'enrage", ponctuation expressive
    ❌ NON : préférence stylistique ("pas trop vulgarisateur"), difficulté objective ("la pire partie")
  - Si pas de rupture vive, c'est une violation V3.1 (sur-détection).

═══════════════════════════════════════════════════════════════════════════
RÈGLE DE COMMUNICATION DU VERDICT
═══════════════════════════════════════════════════════════════════════════

Pour CHAQUE violation détectée, produit un objet :
{
  "id_question": "P2Q15",
  "regle_violee": "V1.1 | V2.1 | V2.2 | V2.3 | V2.4 | V3.1",
  "severite": "CRITIQUE | DOCTRINALE | OBSERVATION",
  "details": "ce que tu observes dans la ligne T1",
  "evidence_verbatim": "extrait du verbatim qui prouve la violation",
  "action_recommandee": "ce que l'agent T1 devrait corriger"
}

Sévérités :
- CRITIQUE : violation Niveau 1 (mécanique) — bloque la production
- DOCTRINALE : violation Niveau 2 (différenciation piliers) — corriger avant aval
- OBSERVATION : violation Niveau 3 (signal limbique) — flag sans bloquer

VERDICT GLOBAL :
- Si AUCUNE violation : verdict_global = "CONFORME"
- Si violations CRITIQUE détectées : verdict_global = "BLOQUANT — CORRECTION REQUISE"
- Si violations DOCTRINALE détectées : verdict_global = "CORRECTION REQUISE"
- Si seulement OBSERVATION : verdict_global = "FLAG_OBSERVATIONS"

FORMAT DE SORTIE (uniquement JSON, pas de markdown, pas de préambule) :
{
  "verdict_global": "CONFORME | CORRECTION REQUISE | BLOQUANT — CORRECTION REQUISE | FLAG_OBSERVATIONS",
  "nb_violations_critique": 0,
  "nb_violations_doctrinale": 0,
  "nb_violations_observation": 0,
  "violations": [
    { "id_question": "...", "regle_violee": "...", "severite": "...", "details": "...", "evidence_verbatim": "...", "action_recommandee": "..." }
  ],
  "synthese": "résumé en 2-3 phrases du verdict"
}
  `.trim();
}

// ─── ÉCRITURE DU RAPPORT ──────────────────────────────────────────────────
async function writeCertificateurReport({
  candidat_id,
  verdict,
  violations,
  nb_lignes_verifiees,
  cost_usd,
  elapsed_ms
}) {
  // À implémenter dans airtableService
  // Table CERTIFICATEUR_T1 à créer (voir LOT 17 — schéma Airtable)
  if (typeof airtableService.writeCertificateurT1 === 'function') {
    await airtableService.writeCertificateurT1({
      candidat_id,
      verdict_global:        verdict,
      nb_lignes_verifiees,
      nb_violations_total:   violations.length,
      nb_critique:           violations.filter(v => v.severite === 'CRITIQUE').length,
      nb_doctrinale:         violations.filter(v => v.severite === 'DOCTRINALE').length,
      nb_observation:        violations.filter(v => v.severite === 'OBSERVATION').length,
      violations_json:       JSON.stringify(violations, null, 2),
      cost_usd:              cost_usd.toFixed(4),
      elapsed_ms,
      timestamp:             new Date().toISOString()
    });
  } else {
    logger.warn('airtableService.writeCertificateurT1 not implemented yet — report not persisted');
  }
}

module.exports = {
  runCertificateurT1,
  buildCertificateurInstruction
};
