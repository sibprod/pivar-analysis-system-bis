// services/backupService.js
// Service de backup et reprise après crash — Profil-Cognitif v9.0
//
// Principe : avant et après chaque étape critique du pipeline,
// on sauve un snapshot de métadonnées (pas le JSON complet) dans VISITEUR.
// Permet la reprise depuis le dernier point de sauvegarde si crash.
//
// Pipeline v9 — 9 agents en 6 étapes :
//   1. Agent T1            (séquentiel)        → ETAPE1_T1
//   2. Agent T2            (séquentiel)        → ETAPE1_T2
//   3. Agent T3            (séquentiel)        → ETAPE1_T3
//   4. Agents T4-1/2/3/6   (parallèle)         → ETAPE1_T4_BILAN (partiel)
//   5. Agent T4-4 Synthèse (séquentiel)        → ETAPE1_T4_BILAN
//   6. Agent T4-5 Coûts    (séquentiel)        → ETAPE1_T4_BILAN
//   7. Certificateur       (séquentiel)        → ETAPE1_T4_BILAN.audit_certificateur

'use strict';

const airtableService = require('./airtableService');
const logger          = require('../utils/logger');

// ─── Mapping étapes → colonnes backup VISITEUR ────────────────────────────────
const BACKUP_COLUMNS = {
  // Backups par scénario (existants, conservés tels quels)
  'scenario_sommeil':       'backup_sommeil',
  'scenario_weekend':       'backup_weekend',
  'scenario_animal':        'backup_animal',
  'scenario_panne':         'backup_panne',

  // Pipeline v9 — 14 points de sauvegarde
  'before_t1':              'backup_before_t1',
  'after_t1':               'backup_after_t1',
  'before_t2':              'backup_before_t2',
  'after_t2':               'backup_after_t2',
  'before_t3':              'backup_before_t3',
  'after_t3':               'backup_after_t3',
  'before_t4_parallel':     'backup_before_t4_parallel',  // avant Agents 1, 2, 3, 6 en parallèle
  'after_t4_parallel':      'backup_after_t4_parallel',
  'before_t4_synthese':     'backup_before_t4_synthese',  // avant Agent 4
  'after_t4_synthese':      'backup_after_t4_synthese',
  'before_t4_couts':        'backup_before_t4_couts',     // avant Agent 5
  'after_t4_couts':         'backup_after_t4_couts',
  'before_certif':          'backup_before_certif',
  'after_certif':           'backup_after_certif',

  // Erreur
  'error':                  'backup_error'
};

// Ordre logique des étapes (du plus récent au plus ancien)
// Utilisé par getLastSuccessfulStep pour identifier où reprendre
const STEPS_ORDER = [
  'after_certif',
  'before_certif',
  'after_t4_couts',
  'before_t4_couts',
  'after_t4_synthese',
  'before_t4_synthese',
  'after_t4_parallel',
  'before_t4_parallel',
  'after_t3',
  'before_t3',
  'after_t2',
  'before_t2',
  'after_t1',
  'before_t1'
];

// ═══════════════════════════════════════════════════════════════════════════
// SAUVEGARDE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Sauvegarder un backup pour une étape du pipeline
 * @param {string} candidate_id
 * @param {string} step - Nom de l'étape (clé dans BACKUP_COLUMNS)
 * @param {Object} data - Données à résumer en métadonnées
 */
async function save(candidate_id, step, data) {
  try {
    const columnName = BACKUP_COLUMNS[step];

    if (!columnName) {
      logger.debug('Backup column not configured', { candidate_id, step });
      return; // Skip silencieusement
    }

    // Extraire uniquement les métadonnées clés — jamais les JSONs complets des agents
    // (trop volumineux → risque de tronquage Airtable)
    const metadata = extractMetadata(step, data);

    const jsonData = JSON.stringify({
      step,
      timestamp: new Date().toISOString(),
      data: metadata
    });

    // Vérification de sécurité (ne devrait jamais dépasser avec les métadonnées)
    if (jsonData.length > 10000) {
      logger.warn('Backup metadata unexpectedly large', {
        candidate_id,
        step,
        size: jsonData.length
      });
    }

    await airtableService.updateVisiteur(candidate_id, {
      [columnName]: jsonData
    });

    logger.debug('Backup saved', {
      candidate_id,
      step,
      size: jsonData.length
    });

  } catch (error) {
    // Ne pas crasher si backup fail — c'est non-critique
    logger.error('Backup failed (non-critical)', {
      candidate_id,
      step,
      error: error.message
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARGEMENT
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Charger un backup
 * @param {string} candidate_id
 * @param {string} step
 * @returns {Object|null} Data ou null si pas de backup
 */
async function load(candidate_id, step) {
  try {
    const columnName = BACKUP_COLUMNS[step];

    if (!columnName) {
      logger.debug('Backup column not configured', { candidate_id, step });
      return null;
    }

    const visiteur = await airtableService.getVisiteur(candidate_id);

    if (!visiteur || !visiteur[columnName]) {
      logger.debug('No backup found', { candidate_id, step });
      return null;
    }

    const parsed = JSON.parse(visiteur[columnName]);

    logger.debug('Backup loaded', {
      candidate_id,
      step,
      timestamp: parsed.timestamp
    });

    return parsed.data;

  } catch (error) {
    logger.error('Failed to load backup', {
      candidate_id,
      step,
      error: error.message
    });
    return null;
  }
}

/**
 * Trouver la dernière étape réussie (pour reprise après crash)
 * @param {string} candidate_id
 * @returns {string|null} Nom de l'étape la plus récente avec backup valide
 */
async function getLastSuccessfulStep(candidate_id) {
  try {
    const visiteur = await airtableService.getVisiteur(candidate_id);

    if (!visiteur) {
      return null;
    }

    // Chercher le premier backup non-null en partant du plus récent
    for (const step of STEPS_ORDER) {
      const columnName = BACKUP_COLUMNS[step];

      if (columnName && visiteur[columnName]) {
        try {
          const parsed = JSON.parse(visiteur[columnName]);

          if (parsed && parsed.data) {
            logger.info('Found last successful step', {
              candidate_id,
              step,
              timestamp: parsed.timestamp
            });
            return step;
          }
        } catch (e) {
          // Backup corrompu, on continue avec l'étape précédente
          logger.warn('Corrupted backup found, skipping', {
            candidate_id,
            step,
            column: columnName
          });
        }
      }
    }

    logger.debug('No successful backup found', { candidate_id });
    return null;

  } catch (error) {
    logger.error('Failed to get last successful step', {
      candidate_id,
      error: error.message
    });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NETTOYAGE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Nettoyer les anciens backups après succès complet du pipeline
 * Préserve les backups par scénario (utiles pour archivage candidat)
 * @param {string} candidate_id
 */
async function cleanOldBackups(candidate_id) {
  try {
    logger.info('Cleaning old backups', { candidate_id });

    // Colonnes à nettoyer (pas les backups par scénario, on les garde)
    const columnsToClean = {};

    for (const [step, columnName] of Object.entries(BACKUP_COLUMNS)) {
      if (!step.startsWith('scenario_')) {
        columnsToClean[columnName] = null;
      }
    }

    await airtableService.updateVisiteur(candidate_id, columnsToClean);

    logger.debug('Old backups cleaned', { candidate_id });

  } catch (error) {
    logger.error('Failed to clean backups (non-critical)', {
      candidate_id,
      error: error.message
    });
  }
}

/**
 * Vérifier si des backups existent pour un candidat
 * @param {string} candidate_id
 * @returns {boolean}
 */
async function hasBackups(candidate_id) {
  try {
    const visiteur = await airtableService.getVisiteur(candidate_id);

    if (!visiteur) {
      return false;
    }

    // Vérifier si au moins un backup pipeline existe (hors scenarios)
    for (const [step, columnName] of Object.entries(BACKUP_COLUMNS)) {
      if (step.startsWith('scenario_')) continue;
      if (visiteur[columnName]) {
        return true;
      }
    }

    return false;

  } catch (error) {
    logger.error('Failed to check backups', {
      candidate_id,
      error: error.message
    });
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE MÉTADONNÉES — adaptées au pipeline v9
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Extrait uniquement les métadonnées pertinentes selon l'étape.
 * Évite de sauvegarder les JSONs complets des agents (trop volumineux).
 *
 * @param {string} step - Étape du pipeline
 * @param {Object} data - Données complètes de l'étape
 * @returns {Object} Métadonnées condensées
 */
function extractMetadata(step, data) {
  if (!data || typeof data !== 'object') {
    return { value: data };
  }

  const meta = {
    timestamp: new Date().toISOString()
  };

  // Avant T1 : juste indiquer qu'on démarre, pas de data
  if (step === 'before_t1') {
    return { ...meta, status: 'starting', responses_count: data.responses?.length || 0 };
  }

  // Après T1 : nombre de questions analysées + écarts détectés
  if (step === 'after_t1') {
    return {
      ...meta,
      questions_analysees: data.rows?.length || 0,
      ecarts_detectes:    data.rows?.filter(r => r.conforme_ecart === 'ECART').length || 0,
      pilier_coeur_distribution: data.pilier_coeur_distribution || {}
    };
  }

  // Avant T2 : confirmer qu'on a bien T1
  if (step === 'before_t2') {
    return { ...meta, t1_rows: data.t1_rows?.length || 0 };
  }

  // Après T2 : nombre de synthèses produites
  if (step === 'after_t2') {
    return {
      ...meta,
      syntheses: data.rows?.length || 0,
      types_contenus: data.rows?.reduce((acc, r) => {
        acc[r.type_contenu] = (acc[r.type_contenu] || 0) + 1;
        return acc;
      }, {}) || {}
    };
  }

  // Avant T3 : confirmer qu'on a T1 + T2
  if (step === 'before_t3') {
    return { ...meta, t1_rows: data.t1_rows || 0, t2_rows: data.t2_rows || 0 };
  }

  // Après T3 : nombre de circuits actifs par pilier
  if (step === 'after_t3') {
    return {
      ...meta,
      lignes_t3: data.rows?.length || 0,
      circuits_actifs_par_pilier: data.circuits_actifs_par_pilier || {}
    };
  }

  // Avant T4 parallèle : confirmer qu'on a T1 + T2 + T3
  if (step === 'before_t4_parallel') {
    return { ...meta, ready_for_t4: true };
  }

  // Après T4 parallèle : confirmer la production des 4 agents
  if (step === 'after_t4_parallel') {
    return {
      ...meta,
      architecture_done: !!data.architecture,
      circuits_done:     !!data.circuits,
      modes_done:        !!data.modes,
      transverses_done:  !!data.transverses
    };
  }

  // Avant Synthèse cœur : confirmer entrées
  if (step === 'before_t4_synthese') {
    return { ...meta, t4_parallel_complete: true };
  }

  // Après Synthèse cœur : extraire le filtre + finalité formulés
  if (step === 'after_t4_synthese') {
    return {
      ...meta,
      filtre_lab_preview:    (data.d1_filtre_lab || '').substring(0, 200),
      filtre_cand_preview:   (data.d1_filtre_cand || '').substring(0, 200),
      finalite_lab_preview:  (data.d3_finalite_lab || '').substring(0, 200),
      finalite_cand_preview: (data.d3_finalite_cand || '').substring(0, 200),
      signature_preview:     (data.d4_signature || '').substring(0, 200)
    };
  }

  // Avant Coûts : confirmer la synthèse
  if (step === 'before_t4_couts') {
    return { ...meta, synthese_complete: true };
  }

  // Après Coûts : preview de la conclusion
  if (step === 'after_t4_couts') {
    return {
      ...meta,
      couts_lab_preview:  (data.d5_couts_lab || '').substring(0, 200),
      couts_cand_preview: (data.d5_couts_cand || '').substring(0, 200),
      conclusion_preview: (data.d6_conclusion || '').substring(0, 200)
    };
  }

  // Avant certificateur : tout est produit
  if (step === 'before_certif') {
    return { ...meta, bilan_complet: true };
  }

  // Après certificateur : verdict CONFORME/NON_CONFORME
  if (step === 'after_certif') {
    return {
      ...meta,
      statut_global:       data.statut_global || null,
      nb_violations_total: data.nb_violations_total || 0,
      agents_non_conformes: data.synthese?.agents_non_conformes || []
    };
  }

  // Erreur : capturer message + étape où c'est arrivé
  if (step === 'error') {
    return {
      ...meta,
      error_message: data.error || data.message || 'Unknown error',
      error_step:    data.step || 'unknown',
      error_agent:   data.agent || null
    };
  }

  // Fallback : garder uniquement les champs scalaires (pas les arrays/objects profonds)
  const simple = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== 'object' || v === null) simple[k] = v;
  }
  return { ...meta, ...simple };
}

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

module.exports = {
  save,
  load,
  getLastSuccessfulStep,
  cleanOldBackups,
  hasBackups,
  // Constantes exportées pour usage par l'orchestrateur
  BACKUP_COLUMNS,
  STEPS_ORDER
};
