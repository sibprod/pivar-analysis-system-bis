// services/backupService.js
// Service de backup et reprise après crash
// ✅ PHASE 3.2 - Sauvegarde dans colonnes VISITEUR

const airtableService = require('./airtableService');
const logger = require('../utils/logger');

// Mapping étapes → colonnes backup
const BACKUP_COLUMNS = {
  // Backup par scénario (existants)
  'scenario_sommeil': 'backup_sommeil',
  'scenario_weekend': 'backup_weekend',
  'scenario_animal': 'backup_animal',
  'scenario_panne': 'backup_panne',
  
  // Backup par étape workflow (si colonnes ajoutées dans Airtable)
  'before_agent1': 'backup_before_agent1',
  'after_agent1': 'backup_after_agent1',
  'before_agent2': 'backup_before_agent2',
  'after_agent2': 'backup_after_agent2',
  'before_algo': 'backup_before_algo',
  'after_algo': 'backup_after_algo',
  'before_boucles': 'backup_before_boucles',
  'after_boucles': 'backup_after_boucles',
  'before_certif': 'backup_before_certif',
  'after_certif': 'backup_after_certif',
  'error': 'backup_error'
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
    
    // Stringify data
    const jsonData = JSON.stringify({
      step: step,
      timestamp: new Date().toISOString(),
      data: data
    });
    
    // Limiter taille (Airtable max 100,000 chars par field)
    if (jsonData.length > 100000) {
      logger.warn('Backup data too large, truncating', {
        session_id,
        step,
        originalSize: jsonData.length
      });
      
      // Sauvegarder version tronquée avec métadonnées seulement
      const truncatedData = JSON.stringify({
        step: step,
        timestamp: new Date().toISOString(),
        data: {
          truncated: true,
          originalSize: jsonData.length,
          summary: 'Data too large for backup'
        }
      });
      
      await airtableService.updateVisiteur(session_id, {
        [columnName]: truncatedData
      });
      
      return;
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

module.exports = {
  save,
  load,
  getLastSuccessfulStep,
  cleanOldBackups,
  hasBackups
};
