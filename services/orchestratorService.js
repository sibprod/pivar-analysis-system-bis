// services/orchestratorService.js
// Orchestrateur Profil-Cognitif v9.1 — Pipeline complet Étape 1
//
// LOT 17 (2026-04-26) — APPLICATION DE LA DOCTRINE DE PROMPTING :
//   - Étape 3.5 ajoutée : Certificateur T1 entre T1 et T2 (Pilier 6 doctrine)
//   - Si verdict BLOQUANT → arrêt du pipeline avec erreur explicite
//   - Si verdict CORRECTION REQUISE → log warning mais continue (Phase 1)
//
// LOT 21 (2026-04-27) — CERTIFICATEUR T1 ACTIF :
//   - Le certificateur T1 patche désormais ETAPE1_T1 directement (corrections + pilier_sortie)
//   - Aucune modification de l'orchestrateur nécessaire : le certificateur écrit lui-même
//     dans ETAPE1_T1 via airtableService.patchEtape1T1Rows
//
// Pipeline :
//   T1 → T1_CERTIFICATEUR → T2 → T3 → [T4-Architecture, T4-Circuits, T4-Mode, T4-Transverses en parallèle]
//      → T4-Synthèse → T4-Coûts → Certificateur lexique
//
// Signature compatible avec l'ancien orchestrateur :
//   await orchestratorService.processCandidate(session_id)
//
// Garanties :
//   - Statut VISITEUR mis à jour à chaque étape ('en_cours', 'terminé', 'ERREUR')
//   - Backup avant/après chaque étape (résilience)
//   - Reprise depuis dernier backup en cas de crash (via getLastSuccessfulStep)
//   - Lexique chargé une seule fois par candidat
//   - Erreur Claude classifiée → retry intelligent géré par claudeService

'use strict';

const airtableService           = require('./airtableService');
const backupService             = require('./backupService');
const agentBase                 = require('./agentBase');
const logger                    = require('../utils/logger');

// Agents amont
const agentT1Service             = require('./agentT1Service');
const agentT1CertificateurService = require('./agentT1CertificateurService');  // ⭐ LOT 17
const agentT2Service             = require('./agentT2Service');
const agentT3Service             = require('./agentT3Service');

// Agents T4
const agentT4ArchitectureService = require('./agentT4ArchitectureService');
const agentT4CircuitsService     = require('./agentT4CircuitsService');
const agentT4ModeService         = require('./agentT4ModeService');
const agentT4SyntheseService     = require('./agentT4SyntheseService');
const agentT4CoutsService        = require('./agentT4CoutsService');
const agentT4TransversesService  = require('./agentT4TransversesService');

// Certificateur lexique
const agentCertificateurService = require('./agentCertificateurService');

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE — processCandidate
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Pipeline complet d'analyse d'un candidat.
 * Signature compatible v8 : processCandidate(session_id)
 *
 * @param {string} session_id - Identifiant du candidat (= candidate_ID dans VISITEUR)
 * @returns {Promise<Object>} { success, candidat_id, totalCostUsd, totalElapsedMs, certifReport, t1CertReport }
 */
async function processCandidate(session_id) {
  const candidat_id = session_id;  // dans v9 on uniformise (D7 actée)
  const startTime = Date.now();

  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
  logger.info('Pipeline v9.1 starting (DOCTRINAL)', { candidat_id });
  logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

  // Tracking global
  const usages = [];
  const costs = [];
  let visiteur = null;
  let prenom = '';

  try {
    // ─── 1. Lecture VISITEUR & vérifications préalables ─────────────────────
    visiteur = await airtableService.getVisiteur(candidat_id);
    if (!visiteur) {
      throw new Error(`Visiteur ${candidat_id} not found in Airtable`);
    }

    prenom = visiteur.Prenom || visiteur.prenom || candidat_id;

    // Marquer en cours
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: 'en_cours',
      erreur_analyse:        '',
      derniere_activite:     new Date().toISOString()
    });

    // ─── 2. Charger le lexique UNE FOIS pour tout le pipeline ───────────────
    agentBase.resetLexiqueCache();
    await agentBase.loadLexique();
    logger.info('Lexique loaded for pipeline', { candidat_id });

    // ─── 3. Pipeline : T1 (DOCTRINAL — 4 appels par scénario) ──────────────
    await backupService.save(candidat_id, 'before_t1', { responses_count: 25 });
    const t1Result = await agentT1Service.runAgentT1({ candidat_id, session_id: candidat_id });
    trackUsage(usages, costs, t1Result);
    await backupService.save(candidat_id, 'after_t1', {
      rows: t1Result.rows
    });
    logger.info('✅ T1 done', {
      candidat_id,
      rows: t1Result.rows.length,
      cost: t1Result.cost.toFixed(4)
    });

    // ─── 3.5 Pipeline : T1 CERTIFICATEUR (DOCTRINE Pilier 6) ⭐ LOT 17 ──────
    // ⭐ LOT 21 : le certificateur T1 patche directement ETAPE1_T1 (corrections + pilier_sortie).
    // On lui passe les rows fraîchement écrites par T1 ; il ira chercher leurs airtable_id
    // depuis Airtable lui-même (re-lecture interne) pour le PATCH.
    await backupService.save(candidat_id, 'before_t1_certificateur', {
      lignes_a_verifier: t1Result.rows.length
    });
    const t1CertResult = await agentT1CertificateurService.runCertificateurT1({
      candidat_id,
      rows_t1: t1Result.rows
    });
    trackUsage(usages, costs, t1CertResult);
    await backupService.save(candidat_id, 'after_t1_certificateur', {
      verdict:        t1CertResult.verdict,
      violations:     t1CertResult.violations,
      nb_corrections: (t1CertResult.corrections || []).length
    });
    logger.info('✅ T1 Certificateur done', {
      candidat_id,
      verdict:           t1CertResult.verdict,
      nb_violations:     t1CertResult.violations.length,
      nb_corrections:    (t1CertResult.corrections || []).length,
      cost:              t1CertResult.cost.toFixed(4)
    });

    // Décision selon verdict (Pilier 6 — bloquer le pipeline si nécessaire)
    if (t1CertResult.verdict && t1CertResult.verdict.includes('BLOQUANT')) {
      const errMsg = `T1 Certificateur BLOQUANT — ${t1CertResult.violations.length} violation(s) critique(s)`;
      logger.error(errMsg, {
        candidat_id,
        violations: t1CertResult.violations.filter(v => v.severite === 'CRITIQUE')
      });
      throw new Error(errMsg);
    }
    if (t1CertResult.verdict === 'CORRECTION REQUISE') {
      logger.warn('T1 Certificateur — CORRECTION REQUISE (continue but flagged)', {
        candidat_id,
        doctrinale_violations: t1CertResult.violations.filter(v => v.severite === 'DOCTRINALE').length
      });
      // Les corrections ont été appliquées sur ETAPE1_T1 par le certificateur lui-même (Lot 21).
      // En Lot 22, on pourra ajouter une boucle de reprise automatique sur lignes flaggées.
    }

    // ─── 4. Pipeline : T2 ─────────────────────────────────────────────────────
    await backupService.save(candidat_id, 'before_t2', { t1_rows: t1Result.rows.length });
    const t2Result = await agentT2Service.runAgentT2({ candidat_id });
    trackUsage(usages, costs, t2Result);
    await backupService.save(candidat_id, 'after_t2', { rows: t2Result.rows });
    logger.info('✅ T2 done', { candidat_id, rows: t2Result.rows.length, cost: t2Result.cost.toFixed(4) });

    // ─── 5. Pipeline : T3 ─────────────────────────────────────────────────────
    await backupService.save(candidat_id, 'before_t3', { t1_rows: t1Result.rows.length, t2_rows: t2Result.rows.length });
    const t3Result = await agentT3Service.runAgentT3({ candidat_id });
    trackUsage(usages, costs, t3Result);
    await backupService.save(candidat_id, 'after_t3', { rows: t3Result.rows });
    logger.info('✅ T3 done', { candidat_id, rows: t3Result.rows.length, cost: t3Result.cost.toFixed(4) });

    // ─── 6. Pipeline : T4 PARALLÈLE (Architecture, Circuits, Mode, Transverses) ─
    await backupService.save(candidat_id, 'before_t4_parallel', { ready_for_t4: true });

    const t1Rows = t1Result.rows;
    const t2Rows = t2Result.rows;
    const t3Rows = t3Result.rows;
    const sharedT4Args = { candidat_id, prenom, t1Rows, t2Rows, t3Rows };

    logger.info('🔀 T4 parallel agents starting (4 in parallel)', { candidat_id });

    const t4ParallelStart = Date.now();
    const [archResult, circResult, modeResult, transResult] = await Promise.all([
      agentT4ArchitectureService.runAgentT4Architecture(sharedT4Args),
      agentT4CircuitsService.runAgentT4Circuits(sharedT4Args),
      agentT4ModeService.runAgentT4Mode(sharedT4Args),
      agentT4TransversesService.runAgentT4Transverses(sharedT4Args)
    ]);
    const t4ParallelMs = Date.now() - t4ParallelStart;

    trackUsage(usages, costs, archResult);
    trackUsage(usages, costs, circResult);
    trackUsage(usages, costs, modeResult);
    trackUsage(usages, costs, transResult);

    await backupService.save(candidat_id, 'after_t4_parallel', {
      architecture: !!archResult.result,
      circuits:     !!circResult.result,
      modes:        !!modeResult.result,
      transverses:  !!transResult.result
    });
    logger.info('✅ T4 parallel done', {
      candidat_id,
      elapsedMs: t4ParallelMs,
      total_cost: (archResult.cost + circResult.cost + modeResult.cost + transResult.cost).toFixed(4)
    });

    // ─── 7. Pipeline : T4 Synthèse ─────────────────────────────────────────────
    await backupService.save(candidat_id, 'before_t4_synthese', { t4_parallel_complete: true });
    const synthResult = await agentT4SyntheseService.runAgentT4Synthese(sharedT4Args);
    trackUsage(usages, costs, synthResult);
    await backupService.save(candidat_id, 'after_t4_synthese', synthResult.result);
    logger.info('✅ T4 Synthèse done', { candidat_id, cost: synthResult.cost.toFixed(4) });

    // ─── 8. Pipeline : T4 Coûts (a besoin de la synthèse) ────────────────────
    await backupService.save(candidat_id, 'before_t4_couts', { synthese_complete: true });
    const coutsResult = await agentT4CoutsService.runAgentT4Couts({
      ...sharedT4Args,
      synthese: synthResult.result
    });
    trackUsage(usages, costs, coutsResult);
    await backupService.save(candidat_id, 'after_t4_couts', coutsResult.result);
    logger.info('✅ T4 Coûts done', { candidat_id, cost: coutsResult.cost.toFixed(4) });

    // ─── 9. Pipeline : Certificateur lexique ─────────────────────────────────
    await backupService.save(candidat_id, 'before_certif', { bilan_complet: true });
    const certifResult = await agentCertificateurService.runAgentCertificateur({ candidat_id, prenom });
    trackUsage(usages, costs, certifResult);
    await backupService.save(candidat_id, 'after_certif', {
      statut_global:       certifResult.report.statut_global,
      nb_violations_total: certifResult.report.nb_violations_total,
      synthese:            certifResult.report.synthese
    });
    logger.info('✅ Certificateur lexique done', {
      candidat_id,
      statut: certifResult.report.statut_global,
      violations: certifResult.report.nb_violations_total,
      cost: certifResult.cost.toFixed(4)
    });

    // ─── 10. Statut final VISITEUR ───────────────────────────────────────────
    const totalElapsedMs = Date.now() - startTime;
    const totalCostUsd   = costs.reduce((s, c) => s + c, 0);

    // Si conforme : statut "terminé". Sinon : statut "terminé" mais bilan reste 'erreur'
    // (l'orchestrateur ne relance pas automatiquement — c'est un choix produit)
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: 'terminé',
      erreur_analyse:        '',
      derniere_activite:     new Date().toISOString()
    });

    // Nettoyage des backups intermédiaires (on garde audit_certificateur et statut_bilan)
    await backupService.cleanOldBackups(candidat_id);

    logger.info('═══════════════════════════════════════════════════════════', { candidat_id });
    logger.info('🎉 Pipeline v9.1 completed', {
      candidat_id,
      totalElapsedMs,
      totalElapsedSec:    (totalElapsedMs / 1000).toFixed(1),
      totalCostUsd:       totalCostUsd.toFixed(4),
      t1_cert_verdict:    t1CertResult.verdict,
      t1_cert_violations: t1CertResult.violations.length,
      t1_cert_corrections: (t1CertResult.corrections || []).length,
      certif_statut:      certifResult.report.statut_global,
      certif_violations:  certifResult.report.nb_violations_total
    });
    logger.info('═══════════════════════════════════════════════════════════', { candidat_id });

    return {
      success:        true,
      candidat_id,
      totalCostUsd,
      totalElapsedMs,
      t1CertReport:   t1CertResult,         // ⭐ LOT 17
      certifReport:   certifResult.report,
      usages
    };

  } catch (error) {
    // Gestion erreur — backup + statut ERREUR
    logger.error('Pipeline v9.1 failed', {
      candidat_id,
      error: error.message,
      stack: error.stack?.substring(0, 500)
    });

    await backupService.save(candidat_id, 'error', {
      error: error.message,
      step:  identifyFailedStep(error)
    });

    try {
      await airtableService.updateVisiteur(candidat_id, {
        statut_analyse_pivar: 'ERREUR',
        erreur_analyse:        (error.message || '').substring(0, 1000),
        derniere_activite:     new Date().toISOString()
      });
    } catch (e) {
      logger.error('Failed to update VISITEUR error status', { candidat_id, error: e.message });
    }

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// REPRISE APRÈS CRASH — recoverCandidate
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Reprend l'analyse d'un candidat depuis le dernier backup réussi
 * @param {string} session_id
 */
async function recoverCandidate(session_id) {
  const candidat_id = session_id;

  const lastStep = await backupService.getLastSuccessfulStep(candidat_id);

  if (!lastStep) {
    logger.info('No backup found, running full pipeline', { candidat_id });
    return processCandidate(session_id);
  }

  logger.info('Recovering from backup', { candidat_id, lastStep });

  // Pour la v9, on relance simplement le pipeline complet — les tables ETAPE1_T*
  // sont écrasées en pattern overwrite, donc pas de risque de doublons.
  // Une vraie reprise sélective serait possible mais ajoute beaucoup de complexité.
  return processCandidate(session_id);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS INTERNES
// ═══════════════════════════════════════════════════════════════════════════

function trackUsage(usages, costs, agentResult) {
  if (agentResult?.usage) usages.push(agentResult.usage);
  if (typeof agentResult?.cost === 'number') costs.push(agentResult.cost);
}

/**
 * Devine l'étape où le pipeline a échoué (best effort, basé sur le message d'erreur)
 */
function identifyFailedStep(error) {
  const msg = (error?.message || '').toLowerCase();
  if (msg.includes('agent t1 certificateur') || msg.includes('t1 certificateur')) return 't1_certificateur';
  if (msg.includes('agent t1') || msg.includes('etape1_t1')) return 't1';
  if (msg.includes('agent t2') || msg.includes('etape1_t2')) return 't2';
  if (msg.includes('agent t3') || msg.includes('etape1_t3')) return 't3';
  if (msg.includes('agent t4-architecture')) return 't4_architecture';
  if (msg.includes('agent t4-circuits')) return 't4_circuits';
  if (msg.includes('agent t4-mode')) return 't4_mode';
  if (msg.includes('agent t4-synthese')) return 't4_synthese';
  if (msg.includes('agent t4-couts')) return 't4_couts';
  if (msg.includes('agent t4-transverses')) return 't4_transverses';
  if (msg.includes('certificateur')) return 'certificateur';
  if (msg.includes('lexique')) return 'lexique';
  if (msg.includes('responses')) return 'responses_loading';
  if (msg.includes('visiteur')) return 'visiteur_loading';
  return 'unknown';
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  processCandidate,
  recoverCandidate,
  // Helpers exportés pour tests
  identifyFailedStep
};
