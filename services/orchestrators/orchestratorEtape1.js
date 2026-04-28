// services/orchestrators/orchestratorEtape1.js
// Sous-orchestrateur Étape 1 — Profil-Cognitif v10.0
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md (Section 4.1 Architecture multi-étapes)
//
// Rôle :
//   - Gère le pipeline complet de l'Étape 1 :
//     T1 → vérificateur T1 (si fichier prompt existe) → T2 → vérif T2 → T3 → vérif T3
//        → T4 (4 parallèles + Synthèse + Coûts) → certificateur lexique
//   - Détecte automatiquement les vérificateurs via la présence de leur fichier prompt (Décision n°32)
//   - Gère les 4 modes opérationnels du vérificateur T1 (Décisions n°15, n°16, n°24)
//
// PHASE D (2026-04-28) — v10 :
//   - Fichier NOUVEAU : extrait de orchestratorService.js (Décision n°26)
//   - Détection auto vérificateur via promptExists() (Décision n°32)
//   - Logique tentatives Mode 4 + escalade Mode 3 (Décision n°24)

'use strict';

const airtableService              = require('../infrastructure/airtableService');
const backupService                = require('../infrastructure/backupService');
const agentBase                    = require('../infrastructure/agentBase');
const logger                       = require('../../utils/logger');

// Agents amont
const agentT1Service               = require('../etape1/agentT1Service');
const agentT1VerificateurService   = require('../etape1/agentT1VerificateurService');

// ⚠️ Les agents T2, T3, T4 et certificateur lexique ne sont PAS encore migrés en v10.
// Les requires sont commentés pour Phase D test Cécile T1+Vérificateur.
// À décommenter au fur et à mesure qu'on génère leurs versions v10.
//
// const agentT2Service             = require('../etape1/agentT2Service');
// const agentT3Service             = require('../etape1/agentT3Service');
// const agentT4ArchitectureService = require('../etape1/etape1_t4/agentT4ArchitectureService');
// const agentT4CircuitsService     = require('../etape1/etape1_t4/agentT4CircuitsService');
// const agentT4ModeService         = require('../etape1/etape1_t4/agentT4ModeService');
// const agentT4SyntheseService     = require('../etape1/etape1_t4/agentT4SyntheseService');
// const agentT4CoutsService        = require('../etape1/etape1_t4/agentT4CoutsService');
// const agentT4TransversesService  = require('../etape1/etape1_t4/agentT4TransversesService');
// const certificateurLexiqueService = require('../certificateurs/certificateurLexiqueService');

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE — run
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Exécute le pipeline complet de l'Étape 1 pour un candidat
 * @param {Object} params
 * @param {string} params.candidat_id
 * @param {Object} params.visiteur — données du candidat (déjà lues par orchestratorPrincipal)
 * @returns {Promise<Object>} { success, candidat_id, totalCostUsd, totalElapsedMs, t1Result, t1VerifResult, ... }
 */
async function run({ candidat_id, visiteur }) {
  const startTime = Date.now();

  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
  logger.info('Pipeline Étape 1 starting', { candidat_id });
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

  const usages = [];
  const costs = [];

  try {
    // ─── 1. Charger le lexique UNE FOIS pour tout le pipeline ───────────────
    agentBase.resetLexiqueCache();
    await agentBase.loadLexique();
    logger.info('Lexique loaded for pipeline', { candidat_id });

    // ─── 2. Pipeline : T1 (DOCTRINAL — 5 appels par scénario) ───────────────
    await backupService.save(candidat_id, 'before_t1', { responses_count: 25 });

    const t1Result = await agentT1Service.runAgentT1({
      candidat_id,
      session_id: candidat_id
    });
    trackUsage(usages, costs, t1Result);

    await backupService.save(candidat_id, 'after_t1', { rows: t1Result.rows });
    logger.info('✅ T1 done', {
      candidat_id,
      rows: t1Result.rows.length,
      cost: t1Result.cost.toFixed(4)
    });

    // ─── 2.5 Pipeline : Vérificateur T1 (Décision n°32 — détection auto) ───
    const verifT1Exists = agentBase.promptExists('etape1/verificateur1_t1.txt');

    let t1VerifResult = null;
    if (verifT1Exists) {
      logger.info('Vérificateur T1 prompt detected — running verification', { candidat_id });

      const tentatives_actuelles = parseInt(visiteur?.nombre_tentatives_etape1 || 0, 10);

      await backupService.save(candidat_id, 'before_t1_verificateur', {
        lignes_a_verifier: t1Result.rows.length,
        tentatives_actuelles
      });

      t1VerifResult = await agentT1VerificateurService.runVerificateurT1({
        candidat_id,
        rows_t1: t1Result.rows,
        tentatives_actuelles
      });
      trackUsage(usages, costs, t1VerifResult);

      await backupService.save(candidat_id, 'after_t1_verificateur', {
        verdict:          t1VerifResult.verdict,
        nb_violations:    t1VerifResult.violations.length,
        nb_corrections:   (t1VerifResult.corrections || []).length,
        mode_recommande:  t1VerifResult.mode_recommande,
        nb_critique:      t1VerifResult.nb_critique,
        nb_doctrinale:    t1VerifResult.nb_doctrinale
      });

      logger.info('✅ Vérificateur T1 done', {
        candidat_id,
        verdict:          t1VerifResult.verdict,
        mode_recommande:  t1VerifResult.mode_recommande,
        nb_violations:    t1VerifResult.violations.length,
        nb_corrections:   (t1VerifResult.corrections || []).length,
        cost:             t1VerifResult.cost.toFixed(4)
      });

      // ⭐ Aiguillage selon le mode recommandé (Décisions n°15, n°16, n°24)
      const aiguillageResult = await traiterModeVerificateur({
        candidat_id,
        mode: t1VerifResult.mode_recommande,
        verdict: t1VerifResult.verdict,
        nb_critique: t1VerifResult.nb_critique,
        tentatives_actuelles
      });

      // Si le mode demande l'arrêt du pipeline (Mode 3 ou Mode 4), on retourne tôt
      if (aiguillageResult.stopPipeline) {
        const totalElapsedMs = Date.now() - startTime;
        const totalCostUsd   = costs.reduce((s, c) => s + c, 0);

        return {
          success:        false,
          stopReason:     aiguillageResult.reason,
          candidat_id,
          totalCostUsd,
          totalElapsedMs,
          t1Result,
          t1VerifResult,
          usages
        };
      }
      // Sinon, Mode 1 (conforme) ou Mode 2 (corrections appliquées) → on continue
    } else {
      logger.info('Vérificateur T1 prompt NOT detected — skipping verification', { candidat_id });
    }

    // ─── 3. Pipeline : T2, T3, T4, certificateur lexique ─────────────────────
    // ⚠️ NON MIGRÉ EN v10 : ces agents seront migrés progressivement.
    //   Pour le test Cécile T1+Vérificateur (Phase D), on s'arrête ici.
    //   Le statut sera mis à 'terminé' par orchestratorPrincipal après le retour.
    //
    // Quand on migrera T2 :
    //   await backupService.save(candidat_id, 'before_t2', {...});
    //   const t2Result = await agentT2Service.runAgentT2({ candidat_id });
    //   trackUsage(usages, costs, t2Result);
    //   await backupService.save(candidat_id, 'after_t2', {...});
    //   ... etc
    //
    //   Idem pour T3, T4 (4 parallèles + synthèse + coûts), certificateur lexique.

    logger.info('⚠️ Étape 1 partielle — seuls T1 + Vérificateur T1 ont été exécutés', {
      candidat_id,
      message: 'T2/T3/T4/certificateur lexique non encore migrés en v10'
    });

    // ─── Statut final ────────────────────────────────────────────────────────
    const totalElapsedMs = Date.now() - startTime;
    const totalCostUsd   = costs.reduce((s, c) => s + c, 0);

    // Reset compteur tentatives après succès (Décision n°24)
    await airtableService.resetTentativesEtape1(candidat_id);

    logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
    logger.info('🎉 Étape 1 (T1+Vérif) completed', {
      candidat_id,
      totalElapsedMs,
      totalElapsedSec:    (totalElapsedMs / 1000).toFixed(1),
      totalCostUsd:       totalCostUsd.toFixed(4),
      t1_rows:            t1Result.rows.length,
      t1_verdict:         t1VerifResult?.verdict || 'N/A',
      t1_mode:            t1VerifResult?.mode_recommande || 'N/A'
    });
    logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

    return {
      success:        true,
      candidat_id,
      totalCostUsd,
      totalElapsedMs,
      t1Result,
      t1VerifResult,
      usages
    };

  } catch (error) {
    logger.error('Pipeline Étape 1 failed', {
      candidat_id,
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });

    await backupService.save(candidat_id, 'error', {
      error: error.message,
      step:  identifyFailedStep(error),
      orchestrateur: 'etape1'
    });

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// AIGUILLAGE SELON LE MODE DU VÉRIFICATEUR (Décisions n°15, n°16, n°24)
// ═══════════════════════════════════════════════════════════════════════════

async function traiterModeVerificateur({ candidat_id, mode, verdict, nb_critique, tentatives_actuelles }) {
  switch (mode) {
    case 1:
      // Mode 1 — Conforme : pas d'action, le pipeline continue
      logger.info('Mode 1 — Conforme, pipeline continue', { candidat_id });
      return { stopPipeline: false };

    case 2:
      // Mode 2 — Corrections directes : déjà appliquées par le vérificateur, le pipeline continue
      logger.info('Mode 2 — Corrections appliquées, pipeline continue', { candidat_id });
      return { stopPipeline: false };

    case 3:
      // Mode 3 — Validation humaine : statut EN_ATTENTE_VALIDATION_HUMAINE + alerte superviseur
      logger.warn('Mode 3 — Validation humaine requise, pipeline arrêté', {
        candidat_id,
        verdict,
        nb_critique,
        tentatives_actuelles
      });

      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: 'EN_ATTENTE_VALIDATION_HUMAINE',
        derniere_activite:    new Date().toISOString()
      });

      // L'envoi d'email superviseur est délégué à validationHumaineService.js (à créer Phase D-2)
      // Pour le test Cécile, on log juste l'alerte
      logger.warn('⚠️ Action superviseur requise — vérificateur T1 BLOQUANT après tentatives épuisées', {
        candidat_id,
        url_airtable: 'https://airtable.com/<base>/<table>/<recordId>'  // construire dynamiquement plus tard
      });

      return { stopPipeline: true, reason: 'mode_3_validation_humaine' };

    case 4:
      // Mode 4 — Erreur système : incrémenter tentatives + REPRENDRE_AGENT1
      const newTentatives = await airtableService.incrementTentativesEtape1(candidat_id);

      logger.warn('Mode 4 — Erreur système, T1 sera relancé', {
        candidat_id,
        verdict,
        nb_critique,
        new_tentatives: newTentatives
      });

      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: 'REPRENDRE_AGENT1',
        derniere_activite:    new Date().toISOString()
      });

      return { stopPipeline: true, reason: 'mode_4_relance_t1' };

    default:
      logger.error('Mode vérificateur inconnu', { candidat_id, mode });
      return { stopPipeline: true, reason: 'mode_inconnu' };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS INTERNES
// ═══════════════════════════════════════════════════════════════════════════

function trackUsage(usages, costs, agentResult) {
  if (agentResult?.usage) usages.push(agentResult.usage);
  if (typeof agentResult?.cost === 'number') costs.push(agentResult.cost);
}

function identifyFailedStep(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('vérificateur t1') || msg.includes('verificateur t1')) return 't1_verificateur';
  if (msg.includes('agent t1') || msg.includes('etape1_t1')) return 't1';
  if (msg.includes('responses')) return 'responses_loading';
  return 'unknown';
}

module.exports = {
  run,
  determinerMode: agentT1VerificateurService.determinerMode,
  identifyFailedStep
};
