// utils/logger.js
// Système de logging PIVAR v7.0
// ✅ PHASE 1.1 - Bug ligne 37 corrigé

const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const DEBUG_MODE = process.env.DEBUG_MODE === 'true';

const LEVELS = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const CURRENT_LEVEL = LEVELS[LOG_LEVEL] || LEVELS.info;

/**
 * Logger principal
 */
class Logger {
  
  log(level, message, meta = {}) {
    if (LEVELS[level] > CURRENT_LEVEL) {
      return;
    }
    
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...meta
    };
    
    // Production : JSON formaté
    if (process.env.NODE_ENV === 'production') {
      console.log(JSON.stringify(logEntry));
    } 
    // Développement : Format lisible avec emojis
    else {
      const emoji = this.getEmoji(level);
      // ✅ BUG CORRIGÉ : template literal correct avec parenthèses
      console.log(`${emoji} [${timestamp}] ${level.toUpperCase()}: ${message}`, meta);
    }
  }
  
  getEmoji(level) {
    const emojis = {
      error: '❌',
      warn: '⚠️',
      info: 'ℹ️',
      debug: '🔍'
    };
    return emojis[level] || 'ℹ️';
  }
  
  error(message, meta = {}) {
    this.log('error', message, meta);
  }
  
  warn(message, meta = {}) {
    this.log('warn', message, meta);
  }
  
  info(message, meta = {}) {
    this.log('info', message, meta);
  }
  
  debug(message, meta = {}) {
    if (DEBUG_MODE) {
      this.log('debug', message, meta);
    }
  }
}

module.exports = new Logger();
