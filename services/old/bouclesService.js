// services/bouclesService.js
// Service de regroupement des boucles par pilier
// ✅ PHASE 2.5 - Code propre pour table BILAN

const logger = require('../utils/logger');

/**
 * Regrouper les boucles par pilier
 * @param {string} session_ID 
 * @param {Array<Object>} responses - 25 réponses
 * @returns {Object} Boucles regroupées par pilier
 */
function regrouperBouclesParPilier(session_ID, responses) {
  const bouclesParPilier = {
    P1: [],
    P2: [],
    P3: [],
    P4: [],
    P5: []
  };
  
  // Pour chaque question
  for (const response of responses) {
    const pilier = response.pilier;
    
    // Parser boucles_detectees (JSON string)
    let boucles = [];
    try {
      if (response.boucles_detectees) {
        boucles = JSON.parse(response.boucles_detectees);
      }
    } catch (error) {
      logger.warn('Failed to parse boucles_detectees', {
        session_ID,
        id_question: response.id_question,
        boucles_detectees: response.boucles_detectees
      });
    }
    
    // Ajouter les boucles au pilier correspondant
    if (Array.isArray(boucles) && boucles.length > 0) {
      bouclesParPilier[pilier].push(...boucles);
    }
  }
  
  logger.debug('Boucles regroupées par pilier', {
    session_ID,
    P1: bouclesParPilier.P1.length,
    P2: bouclesParPilier.P2.length,
    P3: bouclesParPilier.P3.length,
    P4: bouclesParPilier.P4.length,
    P5: bouclesParPilier.P5.length
  });
  
  return bouclesParPilier;
}

/**
 * Formater les boucles pour Airtable (JSON stringifié)
 * @param {Object} bouclesRegroupees 
 * @returns {Object} Prêt pour Airtable
 */
function formaterPourAirtable(bouclesRegroupees) {
  return {
    boucles_detectees_pilier_P1: JSON.stringify(bouclesRegroupees.P1),
    boucles_detectees_pilier_P2: JSON.stringify(bouclesRegroupees.P2),
    boucles_detectees_pilier_P3: JSON.stringify(bouclesRegroupees.P3),
    boucles_detectees_pilier_P4: JSON.stringify(bouclesRegroupees.P4),
    boucles_detectees_pilier_P5: JSON.stringify(bouclesRegroupees.P5)
  };
}

/**
 * Regrouper et sauvegarder dans Airtable
 * @param {string} session_ID 
 * @param {Array<Object>} responses 
 * @param {Object} airtableService 
 */
async function regrouperEtSauvegarder(session_ID, responses, airtableService) {
  try {
    logger.info('Regrouping boucles by pillar', { session_ID });
    
    // Regrouper
    const bouclesRegroupees = regrouperBouclesParPilier(session_ID, responses);
    
    // Formater
    const formatted = formaterPourAirtable(bouclesRegroupees);
    
    // Sauvegarder dans BILAN
    await airtableService.updateBilan(session_ID, formatted);
    
    logger.info('Boucles saved to BILAN', {
      session_ID,
      totalBoucles: Object.values(bouclesRegroupees).flat().length
    });
    
  } catch (error) {
    logger.error('Failed to regroup and save boucles', {
      session_ID,
      error: error.message
    });
    throw error;
  }
}

module.exports = {
  regrouperBouclesParPilier,
  formaterPourAirtable,
  regrouperEtSauvegarder
};
