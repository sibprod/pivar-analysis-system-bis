// services/infrastructure/backupService.js
// Service de backup et reprise après crash — Profil-Cognitif v10.0
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Principe : avant et après chaque étape critique du pipeline,
// on sauve un snapshot de métadonnées (pas le JSON complet) dans VISITEUR.
// Permet la reprise depuis le dernier point de sauvegarde si crash.
//
// Pipeline Étape 1 — points de sauvegarde :
//   1. Agent T1            (séquentiel)        → ETAPE1_T1
//   2. Vérificateur T1     (séquentiel)        → VERIFICATEUR_T1 + patch ETAPE1_T1   ⭐ v10
//   3. Agent T2            (séquentiel)        → ETAPE1_T2
//   4. Agent T3            (séquentiel)        → ETAPE1_T3
//   5. Agents T4-1/2/3/6   (parallèle)         → ETAPE1_T4_BILAN (partiel)
//   6. Agent T4-4 Synthèse (séquentiel)        → ETAPE1_T4_BILAN
//   7. Agent T4-5 Coûts    (séquentiel)        → ETAPE1_T4_BILAN
//   8. Certificateur       (séquentiel)        → ETAPE1_T4_BILAN.audit_certificateur
//
// PHASE D (2026-04-28) — v10 :
//   - Déplacé dans services/infrastructure/ (Décision n°27)
//   - Ajout des backups before_t1_verificateur et after_t1_verificateur (Décision n°10)
//     → Corrige le bug latent : l'orchestrateur appelait save() avec ces noms mais ils
//       n'existaient pas dans BACKUP_COLUMNS, donc skip silencieux

'use strict';

const airtableService = require('./airtableService');
const logger          = require('../../utils/logger');

// ─── Mapping étapes → colonnes backup VISITEUR ────────────────────────────────
const BACKUP_COLUMNS = {
  // Backups par scénario (existants, conservés tels quels)
  'scenario_sommeil':       'backup_sommeil',
  'scenario_weekend':       'backup_weekend',
  'scenario_animal':        'backup_animal',
  'scenario_panne':         'backup_panne',

  // Pipeline Étape 1 — points de sauvegarde
  'before_t1':                'backup_before_t1',
  'after_t1':                 'backup_after_t1',
  'before_t1_verificateur':   'backup_before_t1_verificateur',  // ⭐ v10 (Décision n°10)
  'after_t1_verificateur':    'backup_after_t1_verificateur',   // ⭐ v10 (Décision n°10)
  'before_t2':                'backup_before_t2',
  'after_t2':                 'backup_after_t2',
  'before_t3':                'backup_before_t3',
  'after_t3':                 'backup_after_t3',
  'before_t4_parallel':       'backup_before_t4_parallel',
  'after_t4_parallel':        'backup_after_t4_parallel',
  'before_t4_synthese':       'backup_before_t4_synthese',
  'after_t4_synthese':        'backup_after_t4_synthese',
  'before_t4_couts':          'backup_before_t4_couts',
  'after_t4_couts':           'backup_after_t4_couts',
  'before_certif':            'backup_before_certif',
  'after_certif':             'backup_after_certif',

  // Erreur
  'error':                    'backup_error'
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
  'after_t1_verificateur',     // ⭐ v10
  'before_t1_verificateur',    // ⭐ v10
  'after_t1',
  'before_t1'
];

// ═══════════════════════════════════════════════════════════════════════════
// SAUVEGARDE
// ═══════════════════════════════════════════════════════════════════════════

async function save(candidate_id, step, data) {
  try {
    const columnName = BACKUP_COLUMNS[step];

    if (!columnName) {
      logger.debug('Backup column not configured', { candidate_id, step });
      return;
    }

    const metadata = extractMetadata(step, data);

    const jsonData = JSON.stringify({
      step,
      timestamp: new Date().toISOString(),
      data: metadata
    });

    if (jsonData.length > 10000) {
      logger.warn('Backup metadata unexpectedly large', {
        candidate_id, step, size: jsonData.length
      });
    }

    await airtableService.updateVisiteur(candidate_id, {
      [columnName]: jsonData
    });

    logger.debug('Backup saved', { candidate_id, step, size: jsonData.length });

  } catch (error) {
    logger.error('Backup failed (non-critical)', {
      candidate_id, step, error: error.message
    });
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CHARGEMENT
// ═══════════════════════════════════════════════════════════════════════════

async function load(candidate_id, step) {
  try {
    const columnName = BACKUP_COLUMNS[step];
    if (!columnName) return null;

    const visiteur = await airtableService.getVisiteur(candidate_id);
    if (!visiteur || !visiteur[columnName]) return null;

    const parsed = JSON.parse(visiteur[columnName]);
    return parsed.data;
  } catch (error) {
    logger.error('Failed to load backup', { candidate_id, step, error: error.message });
    return null;
  }
}

async function getLastSuccessfulStep(candidate_id) {
  try {
    const visiteur = await airtableService.getVisiteur(candidate_id);
    if (!visiteur) return null;

    for (const step of STEPS_ORDER) {
      const columnName = BACKUP_COLUMNS[step];
      if (columnName && visiteur[columnName]) {
        try {
          const parsed = JSON.parse(visiteur[columnName]);
          if (parsed && parsed.data) {
            logger.info('Found last successful step', {
              candidate_id, step, timestamp: parsed.timestamp
            });
            return step;
          }
        } catch (e) {
          logger.warn('Corrupted backup found, skipping', { candidate_id, step });
        }
      }
    }

    return null;
  } catch (error) {
    logger.error('Failed to get last successful step', { candidate_id, error: error.message });
    return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// NETTOYAGE
// ═══════════════════════════════════════════════════════════════════════════

async function cleanOldBackups(candidate_id) {
  try {
    logger.info('Cleaning old backups', { candidate_id });

    const columnsToClean = {};
    for (const [step, columnName] of Object.entries(BACKUP_COLUMNS)) {
      if (!step.startsWith('scenario_')) {
        columnsToClean[columnName] = null;
      }
    }

    await airtableService.updateVisiteur(candidate_id, columnsToClean);
    logger.debug('Old backups cleaned', { candidate_id });
  } catch (error) {
    logger.error('Failed to clean backups (non-critical)', { candidate_id, error: error.message });
  }
}

async function hasBackups(candidate_id) {
  try {
    const visiteur = await airtableService.getVisiteur(candidate_id);
    if (!visiteur) return false;

    for (const [step, columnName] of Object.entries(BACKUP_COLUMNS)) {
      if (step.startsWith('scenario_')) continue;
      if (visiteur[columnName]) return true;
    }
    return false;
  } catch (error) {
    logger.error('Failed to check backups', { candidate_id, error: error.message });
    return false;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// EXTRACTION DE MÉTADONNÉES
// ═══════════════════════════════════════════════════════════════════════════

function extractMetadata(step, data) {
  if (!data || typeof data !== 'object') {
    return { value: data };
  }

  const meta = { timestamp: new Date().toISOString() };

  if (step === 'before_t1') {
    return { ...meta, status: 'starting', responses_count: data.responses?.length || 0 };
  }

  if (step === 'after_t1') {
    return {
      ...meta,
      questions_analysees: data.rows?.length || 0,
      ecarts_detectes:    data.rows?.filter(r => r.conforme_ecart === 'ECART').length || 0,
      pilier_coeur_distribution: data.pilier_coeur_distribution || {}
    };
  }

  // ⭐ v10 — Backups vérificateur (Décision n°10)
  if (step === 'before_t1_verificateur') {
    return {
      ...meta,
      lignes_a_verifier: data.lignes_a_verifier || 0
    };
  }

  if (step === 'after_t1_verificateur') {
    return {
      ...meta,
      verdict:          data.verdict || 'INDETERMINE',
      nb_violations:    data.nb_violations || 0,
      nb_corrections:   data.nb_corrections || 0,
      mode_recommande:  data.mode_recommande || null,  // 1/2/3/4 (Décisions n°15, n°24)
      nb_critique:      data.nb_critique || 0,
      nb_doctrinale:    data.nb_doctrinale || 0
    };
  }

  if (step === 'before_t2') {
    return { ...meta, t1_rows: data.t1_rows?.length || 0 };
  }

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

  if (step === 'before_t3') {
    return { ...meta, t1_rows: data.t1_rows || 0, t2_rows: data.t2_rows || 0 };
  }

  if (step === 'after_t3') {
    return {
      ...meta,
      lignes_t3: data.rows?.length || 0,
      circuits_actifs_par_pilier: data.circuits_actifs_par_pilier || {}
    };
  }

  if (step === 'before_t4_parallel') {
    return { ...meta, ready_for_t4: true };
  }

  if (step === 'after_t4_parallel') {
    return {
      ...meta,
      architecture_done: !!data.architecture,
      circuits_done:     !!data.circuits,
      modes_done:        !!data.modes,
      transverses_done:  !!data.transverses
    };
  }

  if (step === 'before_t4_synthese') {
    return { ...meta, t4_parallel_complete: true };
  }

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

  if (step === 'before_t4_couts') {
    return { ...meta, synthese_complete: true };
  }

  if (step === 'after_t4_couts') {
    return {
      ...meta,
      couts_lab_preview:  (data.d5_couts_lab || '').substring(0, 200),
      couts_cand_preview: (data.d5_couts_cand || '').substring(0, 200),
      conclusion_preview: (data.d6_conclusion || '').substring(0, 200)
    };
  }

  if (step === 'before_certif') {
    return { ...meta, bilan_complet: true };
  }

  if (step === 'after_certif') {
    return {
      ...meta,
      statut_global:        data.statut_global || null,
      nb_violations_total:  data.nb_violations_total || 0,
      agents_non_conformes: data.synthese?.agents_non_conformes || []
    };
  }

  if (step === 'error') {
    return {
      ...meta,
      error_message: data.error || data.message || 'Unknown error',
      error_step:    data.step || 'unknown',
      error_agent:   data.agent || null
    };
  }

  // Fallback : champs scalaires uniquement
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
  BACKUP_COLUMNS,
  STEPS_ORDER
};
