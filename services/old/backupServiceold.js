// services/backupService.js
// Service de backup et reprise après crash
// ✅ PHASE 3.2 - Sauvegarde dans colonnes VISITEUR

const airtableService = require('./airtableService');
const logger = require('../utils/logger');

// Mapping étapes → colonnes backup VISITEUR (colonnes existantes)
const BACKUP_COLUMNS = {
  // Backup par scénario (existants, non modifiés)
  'scenario_sommeil': 'backup_sommeil',
  'scenario_weekend': 'backup_weekend',
  'scenario_animal':  'backup_animal',
  'scenario_panne':   'backup_panne',

  // Pipeline v8 — 8 points de sauvegarde
  'before_agent1':    'backup_before_agent1',   // avant Agent 1
  'after_agent1':     'backup_after_agent1',    // après Agent 1 (25Q + appel final)
  'before_agent2':    'backup_before_agent2',   // après Vérificateur
  'after_agent2':     'backup_after_agent2',    // après Agent 2
  'before_algo':      'backup_before_algo',     // après Agent 3
  'after_algo':       'backup_after_algo',      // après Algorithme
  'before_certif':    'backup_before_certif',   // avant Certificateur
  'after_certif':     'backup_after_certif',    // après Certificateur (succès complet)

  'error':            'backup_error'
};

/**
 * Sauvegarder un backup
 * @param {string} session_id 
 * @param {string} step - Nom de l'étape (ex: "after_agent1")
 * @param {Object} data - Données à sauvegarder
 */
async function save(session_id, step, data) {
  try {
    // Vérifier si colonne existe
    const columnName = BACKUP_COLUMNS[step];
    
    if (!columnName) {
      logger.debug('Backup column not configured', { session_id, step });
      return; // Skip silencieusement
    }
    
    // Extraire uniquement les métadonnées clés — jamais les JSONs complets des agents
    // (trop volumineux → tronqués inutilement)
    const metadata = extractMetadata(step, data);

    const jsonData = JSON.stringify({
      step,
      timestamp: new Date().toISOString(),
      data: metadata
    });

    // Vérification de sécurité (ne devrait jamais dépasser avec les métadonnées)
    if (jsonData.length > 10000) {
      logger.warn('Backup metadata unexpectedly large', { session_id, step, size: jsonData.length });
    }

    // Sauvegarder
    await airtableService.updateVisiteur(session_id, {
      [columnName]: jsonData
    });
    
    logger.debug('Backup saved', {
      session_id,
      step,
      size: jsonData.length
    });
    
  } catch (error) {
    // Ne pas crasher si backup fail
    logger.error('Backup failed (non-critical)', {
      session_id,
      step,
      error: error.message
    });
  }
}

/**
 * Charger un backup
 * @param {string} session_id 
 * @param {string} step 
 * @returns {Object|null} Data ou null si pas de backup
 */
async function load(session_id, step) {
  try {
    const columnName = BACKUP_COLUMNS[step];
    
    if (!columnName) {
      logger.debug('Backup column not configured', { session_id, step });
      return null;
    }
    
    // Récupérer visiteur
    const visiteur = await airtableService.getVisiteur(session_id);
    
    if (!visiteur || !visiteur[columnName]) {
      logger.debug('No backup found', { session_id, step });
      return null;
    }
    
    // Parser JSON
    const parsed = JSON.parse(visiteur[columnName]);
    
    logger.debug('Backup loaded', {
      session_id,
      step,
      timestamp: parsed.timestamp
    });
    
    return parsed.data;
    
  } catch (error) {
    logger.error('Failed to load backup', {
      session_id,
      step,
      error: error.message
    });
    return null;
  }
}

/**
 * Trouver la dernière étape réussie
 * @param {string} session_id 
 * @returns {string|null} Nom de l'étape ou null
 */
async function getLastSuccessfulStep(session_id) {
  try {
    const visiteur = await airtableService.getVisiteur(session_id);
    
    if (!visiteur) {
      return null;
    }
    
    // Ordre des étapes (du plus récent au plus ancien)
    const stepsOrder = [
      'after_certif',
      'before_certif',
      'after_boucles',
      'before_boucles',
      'after_algo',
      'before_algo',
      'after_agent2',
      'before_agent2',
      'after_agent1',
      'before_agent1'
    ];
    
    // Chercher le premier backup non-null
    for (const step of stepsOrder) {
      const columnName = BACKUP_COLUMNS[step];
      
      if (columnName && visiteur[columnName]) {
        try {
          const parsed = JSON.parse(visiteur[columnName]);
          
          if (parsed && parsed.data && !parsed.data.truncated) {
            logger.info('Found last successful step', {
              session_id,
              step,
              timestamp: parsed.timestamp
            });
            return step;
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    }
    
    logger.debug('No successful backup found', { session_id });
    return null;
    
  } catch (error) {
    logger.error('Failed to get last successful step', {
      session_id,
      error: error.message
    });
    return null;
  }
}

/**
 * Nettoyer les anciens backups après succès complet
 * @param {string} session_id 
 */
async function cleanOldBackups(session_id) {
  try {
    logger.info('Cleaning old backups', { session_id });
    
    // Colonnes à nettoyer (pas les backups par scénario, on les garde)
    const columnsToClean = {};
    
    for (const [step, columnName] of Object.entries(BACKUP_COLUMNS)) {
      if (!step.startsWith('scenario_')) {
        columnsToClean[columnName] = null;
      }
    }
    
    await airtableService.updateVisiteur(session_id, columnsToClean);
    
    logger.debug('Old backups cleaned', { session_id });
    
  } catch (error) {
    logger.error('Failed to clean backups (non-critical)', {
      session_id,
      error: error.message
    });
  }
}

/**
 * Vérifier si des backups existent
 * @param {string} session_id 
 * @returns {boolean}
 */
async function hasBackups(session_id) {
  try {
    const visiteur = await airtableService.getVisiteur(session_id);
    
    if (!visiteur) {
      return false;
    }
    
    // Vérifier si au moins un backup existe
    for (const columnName of Object.values(BACKUP_COLUMNS)) {
      if (visiteur[columnName]) {
        return true;
      }
    }
    
    return false;
    
  } catch (error) {
    logger.error('Failed to check backups', {
      session_id,
      error: error.message
    });
    return false;
  }
}

// Extraire uniquement les métadonnées pertinentes selon l'étape
// Évite de sauvegarder les JSONs complets des agents (trop volumineux)
function extractMetadata(step, data) {
  if (!data || typeof data !== 'object') return { value: data };

  // Métadonnées communes
  const meta = {
    timestamp: new Date().toISOString()
  };

  // Extraire selon l'étape
  if (step.includes('agent1'))    return { ...meta, analyses: data.analyses?.length, corpus_ok: !!data.corpus };
  if (step.includes('agent2'))    return { ...meta, analyses: data.analyses?.length };
  if (step.includes('boucles'))   return { ...meta, syntheses: Object.keys(data.syntheses || {}).length };
  if (step.includes('algo'))      return { ...meta, niveau_global: data.output?.synthese_globale?.niveau_global, nom_niveau: data.output?.synthese_globale?.nom_niveau_global };
  if (step.includes('certif'))    return { ...meta, statut: data.statut, type_profil: data.type_profil_cognitif };
  if (step === 'error')           return { ...meta, error: data.error || data };

  // Fallback : garder uniquement les champs scalaires (pas les arrays/objects profonds)
  const simple = {};
  for (const [k, v] of Object.entries(data)) {
    if (typeof v !== 'object' || v === null) simple[k] = v;
  }
  return { ...meta, ...simple };
}

module.exports = {
  save,
  load,
  getLastSuccessfulStep,
  cleanOldBackups,
  hasBackups
};
