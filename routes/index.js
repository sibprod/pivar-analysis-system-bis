// routes/index.js
// Routes HTTP — Profil-Cognitif v12.1
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// PHASE v12.1 (2026-06-18) — Visualisation table figée CIRCUITS_POURBILAN :
//   - ⭐ Ajout route GET /visualiser/tableau2circuitspourbilan/:candidat_id
//     Calquée sur /visualiser/tableau2circuits (sa jumelle), mais lit la table
//     figée ETAPE1_T2_CIRCUITS_POURBILAN via
//     airtableService.getEtape1T2CircuitsPourbilan.
//     Mode JSON ({rows}) + mode HTML (sert visu_etape1_T2_circuitspourbilan.html).
//     Vue candidat complète : capacité, niveau cœur + amplitude, profondeur,
//     instrumentaux P1..P5, totaux (sous-totaux, totaux pilier, total général).
//
// PHASE v12.0 (2026-06-17) — Bilan Fable cognitif complet :
//   - ⭐ Ajout require bilanFablePayloadService
//   - ⭐ Ajout route GET /visualiser/t3_bilancognitif/:candidat_id
//     Rendu serveur (même pattern que /visualiser/t3_bilan/:candidat_id) :
//     buildPayload(candidat_id) → _renderT3Template(tpl, payload) → HTML
//     Template : services/visualisation/bilanFableVisualiseurService.html
//
// PHASE v11.6 (2026-06-05) — Visualisation Étape 2 (les 4 excellences) :
//   - ⭐ Ajout route GET /visualiser/etape2_1responsepour4excellences/:candidat_id

'use strict';

const path = require('path');

const express               = require('express');
const router                = express.Router();
const orchestratorPrincipal  = require('../services/orchestrators/orchestrator_principal');
const queueService          = require('../services/flux/queueService');
const airtableService       = require('../services/infrastructure/airtableService');
const backupService         = require('../services/infrastructure/backupService');
const tableauT3bilanPayloadService = require('../services/visualisation/service_etape1_T3_bilan_payload') // ancien tableauT3bilanPayloadService;
// ⭐ v12.0
const bilanFablePayloadService = require('../services/visualisation/service_etape1_T3_bilan_payload');
const logger                = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// POST /webhook
// ═══════════════════════════════════════════════════════════════════════════

router.post('/webhook', async (req, res) => {
  const { session_id, candidate_id, priority } = req.body || {};
  const id = session_id || candidate_id;

  if (!id) {
    return res.status(400).json({ error: 'session_id or candidate_id required', success: false });
  }

  try {
    queueService.addToQueue(id, priority || 'NORMAL');
    logger.info('Candidate added to queue via webhook', { id });
    return res.status(202).json({ success: true, message: 'Candidate queued for analysis', session_id: id });
  } catch (error) {
    logger.error('Webhook error', { id, error: error.message });
    return res.status(500).json({ error: error.message, success: false });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /analyze/:session_id
// ═══════════════════════════════════════════════════════════════════════════

router.post('/analyze/:session_id', async (req, res) => {
  const { session_id } = req.params;
  try {
    const result = await orchestratorPrincipal.processCandidate(session_id);
    return res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Analyze error', { session_id, error: error.message });
    return res.status(500).json({ error: error.message, session_id, success: false });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /status/:session_id
// ═══════════════════════════════════════════════════════════════════════════

router.get('/status/:session_id', async (req, res) => {
  const { session_id } = req.params;
  try {
    const visiteur = await airtableService.getVisiteur(session_id);
    if (!visiteur) return res.status(404).json({ error: 'Candidate not found', session_id });

    const t4Bilan = await airtableService.getEtape1T4Bilan(session_id);

    return res.json({
      session_id,
      statut_test:          visiteur.statut_test,
      statut_analyse_pivar: visiteur.statut_analyse_pivar,
      statut_analyse:       visiteur.statut_analyse_pivar,
      derniere_activite:    visiteur.derniere_activite,
      erreur_analyse:       visiteur.erreur_analyse,
      nombre_tentatives_etape1: visiteur.nombre_tentatives_etape1 || 0,
      validation_humaine: visiteur.validation_humaine_action ? {
        action: visiteur.validation_humaine_action,
        motif:  visiteur.validation_humaine_motif,
        date:   visiteur.validation_humaine_date
      } : null,
      emails_candidat: {
        date_T0:          visiteur.date_T0 || null,
        T0_envoye:        !!visiteur.email_T0_envoye,
        H24_envoye:       !!visiteur.email_24h_envoye,
        H48_envoye:       !!visiteur.email_48h_envoye,
        H72_envoye:       !!visiteur.email_72h_envoye,
        livraison_envoye: !!visiteur.email_livraison_envoye
      },
      bilan: t4Bilan ? {
        statut_bilan:     t4Bilan.statut_bilan,
        certifie:         t4Bilan.statut_bilan === 'certifie',
        has_audit_certif: !!t4Bilan.audit_certificateur
      } : null
    });
  } catch (error) {
    logger.error('Status error', { session_id, error: error.message });
    return res.status(500).json({ error: error.message, session_id });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/queue/status
// ═══════════════════════════════════════════════════════════════════════════

router.get('/api/queue/status', (req, res) => {
  try {
    const status = queueService.getQueueStatus();
    return res.json({ success: true, ...status });
  } catch (error) {
    logger.error('Queue status error', { error: error.message });
    return res.status(500).json({ error: error.message, success: false });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/recover-from-backup/:session_id
// ═══════════════════════════════════════════════════════════════════════════

router.post('/api/recover-from-backup/:session_id', async (req, res) => {
  const { session_id } = req.params;
  try {
    const lastStep = await backupService.getLastSuccessfulStep(session_id);
    if (!lastStep) return res.status(404).json({ error: 'No backup found', session_id, success: false });
    queueService.addToQueue(session_id, 'HIGH');
    return res.status(202).json({ success: true, message: 'Recovery queued', session_id, last_step: lastStep });
  } catch (error) {
    logger.error('Recover error', { session_id, error: error.message });
    return res.status(500).json({ error: error.message, session_id });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/retry-missing/:session_id — LEGACY v8 (410)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/api/retry-missing/:session_id', (req, res) => {
  return res.status(410).json({
    error: 'Removed in v9. Use POST /api/recover-from-backup/:session_id instead.',
    success: false
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /debug/airtable
// ═══════════════════════════════════════════════════════════════════════════

router.get('/debug/airtable', async (req, res) => {
  const Airtable = require('airtable');
  const airtableConfig = require('../config/airtable');
  const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN }).base(process.env.AIRTABLE_BASE_ID);
  const results = {};
  for (const [internalKey, tableName] of Object.entries(airtableConfig.TABLES)) {
    try {
      const records = await base(tableName).select({ maxRecords: 1, view: 'Grid view' }).firstPage();
      results[internalKey] = { tableName, ok: true, rowsRead: records.length, firstRecordId: records[0]?.id || null };
    } catch (error) {
      results[internalKey] = { tableName, ok: false, error: error.message, statusCode: error.statusCode || null };
    }
  }
  return res.json({
    base_id: process.env.AIRTABLE_BASE_ID,
    token_first_chars: (process.env.AIRTABLE_TOKEN || '').substring(0, 10) + '...',
    results
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/etape1/:candidat_id
// ═══════════════════════════════════════════════════════════════════════════

router.get('/visualiser/etape1/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  const startTime = Date.now();

  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send(
      '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
      '<h1>Identifiant candidat invalide</h1>' +
      '<p>Format attendu : <code>pcc_1771077635499_gg1cj7z1q</code></p>' +
      '</body></html>'
    );
  }

  const acceptHeader = req.headers.accept || '';
  const fetchMode    = req.headers['sec-fetch-mode'] || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson = acceptHeader.includes('application/json') || formatParam === 'json' || fetchMode === 'cors';

  if (wantsJson) {
    logger.info('Visualisation Étape 1.1 — mode JSON', { candidat_id });
    try {
      const rows = await airtableService.getResponses(candidat_id);
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Aucune réponse trouvée', candidat_id });
      logger.info('Visualisation Étape 1.1 — JSON renvoyé', { candidat_id, count: rows.length, elapsedMs: Date.now() - startTime });
      return res.json({ rows });
    } catch (error) {
      logger.error('Visualisation Étape 1.1 — erreur lecture RESPONSES', { candidat_id, error: error.message });
      return res.status(500).json({ error: error.message, candidat_id });
    }
  }

  logger.info('Visualisation Étape 1.1 — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'visu_etape1_responses.html');
  res.sendFile(htmlPath, function(err) {
    if (err) {
      logger.error('Visualisation Étape 1.1 — erreur sendFile', { candidat_id, error: err.message, path: htmlPath });
      if (!res.headersSent) res.status(500).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Erreur de chargement</h1><p>' + (err.message || 'inconnue') + '</p></body></html>');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/etape2_1responsepour4excellences/:candidat_id — v11.6
// ═══════════════════════════════════════════════════════════════════════════

router.get('/visualiser/etape2_1responsepour4excellences/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  const startTime = Date.now();

  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Identifiant candidat invalide</h1></body></html>');
  }

  const acceptHeader = req.headers.accept || '';
  const fetchMode    = req.headers['sec-fetch-mode'] || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson = acceptHeader.includes('application/json') || formatParam === 'json' || fetchMode === 'cors';

  if (wantsJson) {
    logger.info('Visualisation Étape 2 — mode JSON', { candidat_id });
    try {
      const rows = await airtableService.getEtape2Excellences(candidat_id);
      if (!rows || rows.length === 0) return res.status(404).json({ error: 'Aucune réponse Étape 2 trouvée', candidat_id });
      logger.info('Visualisation Étape 2 — JSON renvoyé', { candidat_id, count: rows.length, elapsedMs: Date.now() - startTime });
      return res.json({ rows });
    } catch (error) {
      logger.error('Visualisation Étape 2 — erreur lecture', { candidat_id, error: error.message });
      return res.status(500).json({ error: error.message, candidat_id });
    }
  }

  logger.info('Visualisation Étape 2 — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'visu_etape2_b_T5A_detail.html');
  res.sendFile(htmlPath, function(err) {
    if (err) {
      logger.error('Visualisation Étape 2 — erreur sendFile', { candidat_id, error: err.message, path: htmlPath });
      if (!res.headersSent) res.status(500).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Erreur Étape 2</h1><p>' + (err.message || '') + '</p></body></html>');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/t1/:candidat_id — v10.7
// ═══════════════════════════════════════════════════════════════════════════

router.get('/visualiser/t1/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  const startTime = Date.now();

  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Identifiant candidat invalide</h1></body></html>');
  }

  const acceptHeader = req.headers.accept || '';
  const fetchMode    = req.headers['sec-fetch-mode'] || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson = acceptHeader.includes('application/json') || formatParam === 'json' || fetchMode === 'cors';

  if (wantsJson) {
    logger.info('Visualisation T1 — mode JSON', { candidat_id });
    try {
      const rowsT1 = await airtableService.getEtape1T1(candidat_id);
      if (!rowsT1 || rowsT1.length === 0) return res.status(404).json({ error: 'Aucune analyse T1 trouvée', candidat_id });

      let responsesMap = {};
      try {
        const responses = await airtableService.getResponses(candidat_id);
        if (responses && responses.length > 0) {
          for (const r of responses) { if (r.id_question) responsesMap[r.id_question] = r; }
        }
      } catch (e) {
        logger.warn('Visualisation T1 — lecture RESPONSES échouée (continue)', { candidat_id, error: e.message });
      }

      const mergedRows = rowsT1.map(t1 => {
        const resp = responsesMap[t1.id_question] || {};
        return {
          ...t1,
          cog_outils_mobilises:     t1.cog_outils_mobilises     || resp.cog_outils_mobilises     || '',
          cog_pilier_sortie:        t1.cog_pilier_sortie        || resp.cog_pilier_sortie        || '',
          cog_gouverne_commentaire: t1.cog_gouverne_commentaire || resp.cog_gouverne_commentaire || ''
        };
      });

      logger.info('Visualisation T1 — JSON renvoyé', { candidat_id, count: mergedRows.length, elapsedMs: Date.now() - startTime });
      return res.json({ rows: mergedRows });
    } catch (error) {
      logger.error('Visualisation T1 — erreur lecture ETAPE1_T1', { candidat_id, error: error.message });
      return res.status(500).json({ error: error.message, candidat_id });
    }
  }

  logger.info('Visualisation T1 — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'visu_etape1_T1.html');
  res.sendFile(htmlPath, function(err) {
    if (err) {
      logger.error('Visualisation T1 — erreur sendFile', { candidat_id, error: err.message, path: htmlPath });
      if (!res.headersSent) res.status(500).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Erreur T1</h1><p>' + (err.message || '') + '</p></body></html>');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/tableau2piliers/:candidat_id — v10.9
// ═══════════════════════════════════════════════════════════════════════════

router.get('/visualiser/tableau2piliers/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Identifiant candidat invalide</h1></body></html>');
  }
  const acceptHeader = req.headers.accept || '';
  const fetchMode    = req.headers['sec-fetch-mode'] || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson = acceptHeader.includes('application/json') || formatParam === 'json' || fetchMode === 'cors';

  if (wantsJson) {
    logger.info('Visualisation tableau2piliers — mode JSON', { candidat_id });
    try {
      const rows = await airtableService.getEtape1T2VentilationPiliers(candidat_id);
      return res.json({ rows: rows || [] });
    } catch (error) {
      logger.error('Visualisation tableau2piliers — erreur', { candidat_id, error: error.message });
      return res.status(500).json({ error: error.message, candidat_id });
    }
  }

  logger.info('Visualisation tableau2piliers — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'visu_etape1_T2_piliers.html');
  res.sendFile(htmlPath, function(err) {
    if (err && !res.headersSent) res.status(500).type('html').send('<html><body><h1>Erreur tableau2piliers</h1></body></html>');
  });
});

// ─── Mini-moteur Handlebars (rendu serveur) ────────────────────────────────

function _renderT3Template(tpl, ctx) {
  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }
  function resolvePath(scope, path) {
    if (path === 'this' || path === '.') return scope;
    const parts = path.split('.');
    let cur = scope;
    for (const p of parts) { if (cur === null || cur === undefined) return undefined; cur = cur[p]; }
    return cur;
  }
  function isTruthy(v) {
    if (Array.isArray(v)) return v.length > 0;
    if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
    return true;
  }
  function stripHtmlComments(str) { return str.replace(/<!--[\s\S]*?-->/g, ''); }
  function parse(str) {
    str = stripHtmlComments(str);
    const tokens = [];
    const re = /\{\{\{?[#/^!]?\s*[^{}]+?\s*\}?\}\}/g;
    let last = 0, m;
    while ((m = re.exec(str)) !== null) {
      if (m.index > last) tokens.push({ type: 'text', value: str.slice(last, m.index) });
      const raw = m[0];
      const inner = raw.replace(/^\{\{\{?[#/^!]?\s*/, '').replace(/\s*\}?\}\}$/, '').trim();
      if (raw.startsWith('{{{')) tokens.push({ type: 'raw', path: inner });
      else if (raw.startsWith('{{#if ')) tokens.push({ type: 'if_open', path: inner.replace(/^if\s+/, '') });
      else if (raw.startsWith('{{#each ')) tokens.push({ type: 'each_open', path: inner.replace(/^each\s+/, '') });
      else if (raw === '{{else}}') tokens.push({ type: 'else' });
      else if (raw === '{{/if}}') tokens.push({ type: 'if_close' });
      else if (raw === '{{/each}}') tokens.push({ type: 'each_close' });
      else if (raw.startsWith('{{!')) { /* commentaire Handlebars — ignoré */ }
      else tokens.push({ type: 'var', path: inner });
      last = m.index + raw.length;
    }
    if (last < str.length) tokens.push({ type: 'text', value: str.slice(last) });
    return tokens;
  }
  function buildAst(tokens) {
    let i = 0;
    function readBlock(stopTypes) {
      const out = [];
      while (i < tokens.length) {
        const tk = tokens[i];
        if (stopTypes.includes(tk.type)) return out;
        if (tk.type === 'if_open') {
          i++;
          const ifBody = readBlock(['else', 'if_close']);
          let elseBody = [];
          if (tokens[i] && tokens[i].type === 'else') { i++; elseBody = readBlock(['if_close']); }
          if (tokens[i] && tokens[i].type === 'if_close') i++;
          out.push({ type: 'if', path: tk.path, ifBody, elseBody });
        } else if (tk.type === 'each_open') {
          i++;
          const body = readBlock(['each_close']);
          if (tokens[i] && tokens[i].type === 'each_close') i++;
          out.push({ type: 'each', path: tk.path, body });
        } else { out.push(tk); i++; }
      }
      return out;
    }
    return readBlock([]);
  }
  function renderNodes(nodes, scopes) {
    function lookup(path) {
      for (let i = scopes.length - 1; i >= 0; i--) {
        const v = resolvePath(scopes[i], path);
        if (v !== undefined) return v;
      }
      return undefined;
    }
    let out = '';
    for (const n of nodes) {
      if (n.type === 'text') out += n.value;
      else if (n.type === 'var') out += escapeHtml(lookup(n.path));
      else if (n.type === 'raw') { const v = lookup(n.path); out += (v === undefined || v === null) ? '' : String(v); }
      else if (n.type === 'if') { if (isTruthy(lookup(n.path))) out += renderNodes(n.ifBody, scopes); else out += renderNodes(n.elseBody, scopes); }
      else if (n.type === 'each') { const list = lookup(n.path); if (Array.isArray(list)) for (const item of list) out += renderNodes(n.body, scopes.concat([item])); }
    }
    return out;
  }
  const ast = buildAst(parse(tpl));
  return renderNodes(ast, [ctx]);
}

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/t3_bilan/:candidat_id — v11.0
// ═══════════════════════════════════════════════════════════════════════════

router.get('/visualiser/t3_bilan/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Identifiant candidat invalide</h1></body></html>');
  }
  const acceptHeader = req.headers.accept || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson = acceptHeader.includes('application/json') || formatParam === 'json';

  if (wantsJson) {
    logger.info('Visualisation t3_bilan — mode JSON', { candidat_id });
    try {
      const payload = await tableauT3bilanPayloadService.buildPayload(candidat_id);
      if (!payload) return res.status(404).json({ error: 'Aucun bilan T3 trouvé', candidat_id });
      return res.json(payload);
    } catch (error) {
      logger.error('Visualisation t3_bilan — erreur assemblage', { candidat_id, error: error.message });
      return res.status(500).json({ error: error.message, candidat_id });
    }
  }

  logger.info('Visualisation t3_bilan — mode HTML (rendu serveur)', { candidat_id });
  const fs = require('fs');
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'visu_etape1_T3_bilan.html');
  try {
    const payload = await tableauT3bilanPayloadService.buildPayload(candidat_id);
    if (!payload) {
      return res.status(404).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Aucun bilan T3 trouvé</h1><p>candidat_id : <code>' + candidat_id + '</code></p></body></html>');
    }
    const tpl = fs.readFileSync(htmlPath, 'utf8');
    const html = _renderT3Template(tpl, payload);
    res.type('html').send(html);
  } catch (error) {
    logger.error('Visualisation t3_bilan — erreur HTML', { candidat_id, error: error.message });
    if (!res.headersSent) res.status(500).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Erreur rendu t3_bilan</h1><p>' + (error.message || '') + '</p></body></html>');
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/tableau2circuits/:candidat_id — v10.9
// ═══════════════════════════════════════════════════════════════════════════

router.get('/visualiser/tableau2circuits/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Identifiant candidat invalide</h1></body></html>');
  }
  const acceptHeader = req.headers.accept || '';
  const fetchMode    = req.headers['sec-fetch-mode'] || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson = acceptHeader.includes('application/json') || formatParam === 'json' || fetchMode === 'cors';

  if (wantsJson) {
    logger.info('Visualisation tableau2circuits — mode JSON', { candidat_id });
    try {
      const rows = await airtableService.getEtape1T2InventaireCircuits(candidat_id);
      return res.json({ rows: rows || [] });
    } catch (error) {
      logger.error('Visualisation tableau2circuits — erreur', { candidat_id, error: error.message });
      return res.status(500).json({ error: error.message, candidat_id });
    }
  }

  logger.info('Visualisation tableau2circuits — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'visu_etape1_T2_circuits.html');
  res.sendFile(htmlPath, function(err) {
    if (err && !res.headersSent) res.status(500).type('html').send('<html><body><h1>Erreur tableau2circuits</h1></body></html>');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v12.1 (18/06/2026) — GET /visualiser/tableau2circuitspourbilan/:candidat_id
// Vue candidat complète de la table figée ETAPE1_T2_CIRCUITS_POURBILAN.
// Jumelle de tableau2circuits, mais lit la table figée (Phase 4) et affiche
// capacité, niveau cœur + amplitude, profondeur, instrumentaux et totaux.
// ═══════════════════════════════════════════════════════════════════════════

router.get('/visualiser/tableau2circuitspourbilan/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Identifiant candidat invalide</h1></body></html>');
  }
  const acceptHeader = req.headers.accept || '';
  const fetchMode    = req.headers['sec-fetch-mode'] || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson = acceptHeader.includes('application/json') || formatParam === 'json' || fetchMode === 'cors';

  if (wantsJson) {
    logger.info('Visualisation tableau2circuitspourbilan — mode JSON', { candidat_id });
    try {
      const rows = await airtableService.getEtape1T2CircuitsPourbilan(candidat_id);
      return res.json({ rows: rows || [] });
    } catch (error) {
      logger.error('Visualisation tableau2circuitspourbilan — erreur', { candidat_id, error: error.message });
      return res.status(500).json({ error: error.message, candidat_id });
    }
  }

  logger.info('Visualisation tableau2circuitspourbilan — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'visu_etape1_T2_circuitspourbilan.html');
  res.sendFile(htmlPath, function(err) {
    if (err && !res.headersSent) res.status(500).type('html').send('<html><body><h1>Erreur tableau2circuitspourbilan</h1></body></html>');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ (30/06/2026) — GET /visualiser/tableau3circuitspourbilandef/:candidat_id
// VUE DÉFINITIVE de la table figée ETAPE1_T2_CIRCUITS_POURBILAN.
// Jumelle EXACTE de /visualiser/tableau2circuitspourbilan, MÊME source de données
// (getEtape1T2CircuitsPourbilan → rows brutes, dont bloc_final + profondeur_attribuee).
// Seule différence : sert le HTML « def » qui groupe par bloc_final (bloc réel attribué
// par l'agent bilan-pilier) et affiche profondeur_attribuee, au lieu du regroupement
// par seuil de total. La route tableau2circuitspourbilan (avant-agent) reste intacte.
// ═══════════════════════════════════════════════════════════════════════════

router.get('/visualiser/tableau3circuitspourbilandef/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Identifiant candidat invalide</h1></body></html>');
  }
  const acceptHeader = req.headers.accept || '';
  const fetchMode    = req.headers['sec-fetch-mode'] || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson = acceptHeader.includes('application/json') || formatParam === 'json' || fetchMode === 'cors';

  if (wantsJson) {
    logger.info('Visualisation tableau3circuitspourbilandef — mode JSON', { candidat_id });
    try {
      const rows = await airtableService.getEtape1T2CircuitsPourbilan(candidat_id);
      return res.json({ rows: rows || [] });
    } catch (error) {
      logger.error('Visualisation tableau3circuitspourbilandef — erreur', { candidat_id, error: error.message });
      return res.status(500).json({ error: error.message, candidat_id });
    }
  }

  logger.info('Visualisation tableau3circuitspourbilandef — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'visu_etape1_T3_circuitspourbilandef.html');
  res.sendFile(htmlPath, function(err) {
    if (err && !res.headersSent) res.status(500).type('html').send('<html><body><h1>Erreur tableau3circuitspourbilandef</h1></body></html>');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/tableau2parquestion/:candidat_id — v10.9
// ═══════════════════════════════════════════════════════════════════════════

router.get('/visualiser/tableau2parquestion/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Identifiant candidat invalide</h1></body></html>');
  }
  const acceptHeader = req.headers.accept || '';
  const fetchMode    = req.headers['sec-fetch-mode'] || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson = acceptHeader.includes('application/json') || formatParam === 'json' || fetchMode === 'cors';

  if (wantsJson) {
    logger.info('Visualisation tableau2parquestion — mode JSON', { candidat_id });
    try {
      const rowsT1 = await airtableService.getEtape1T1(candidat_id);
      if (!rowsT1 || rowsT1.length === 0) return res.json({ rows: [] });
      const projected = rowsT1.map(t1 => ({
        id_question: t1.id_question, pilier_coeur: t1.pilier_coeur,
        nb_activations_coeur: t1.nb_activations_coeur, detail_circuits_coeur: t1.detail_circuits_coeur,
        detail_circuits_instrumentaux: t1.detail_circuits_instrumentaux,
        nb_activations_par_pilier_instrumental: t1.nb_activations_par_pilier_instrumental,
        nb_P1_instru: t1.nb_P1_instru, nb_P2_instru: t1.nb_P2_instru, nb_P3_instru: t1.nb_P3_instru,
        nb_P4_instru: t1.nb_P4_instru, nb_P5_instru: t1.nb_P5_instru,
        detail_P1_instru: t1.detail_P1_instru, detail_P2_instru: t1.detail_P2_instru,
        detail_P3_instru: t1.detail_P3_instru, detail_P4_instru: t1.detail_P4_instru,
        detail_P5_instru: t1.detail_P5_instru
      }));
      return res.json({ rows: projected });
    } catch (error) {
      logger.error('Visualisation tableau2parquestion — erreur', { candidat_id, error: error.message });
      return res.status(500).json({ error: error.message, candidat_id });
    }
  }

  logger.info('Visualisation tableau2parquestion — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'visu_etape1_T2_questions.html');
  res.sendFile(htmlPath, function(err) {
    if (err && !res.headersSent) res.status(500).type('html').send('<html><body><h1>Erreur tableau2parquestion</h1></body></html>');
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v11.7 — BILAN DYNAMIQUE DES 4 EXCELLENCES
// ═══════════════════════════════════════════════════════════════════════════

function _isValidCandidatId(id) {
  return id && id.length >= 5 && id.length <= 100;
}

router.get('/api/etape2_2bilan4excellences/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  const startTime = Date.now();
  if (!_isValidCandidatId(candidat_id)) return res.status(400).json({ error: 'Identifiant candidat invalide', candidat_id });
  logger.info('Bilan 4 excellences — API JSON', { candidat_id });
  try {
    const payload = await airtableService.getBilanExcellences(candidat_id);
    if (!payload) return res.status(404).json({ error: 'Aucun bilan trouvé', candidat_id });
    logger.info('Bilan 4 excellences — JSON renvoyé', { candidat_id, nb_excellences: (payload.excellences || []).length, elapsedMs: Date.now() - startTime });
    return res.json(payload);
  } catch (error) {
    logger.error('Bilan 4 excellences — erreur', { candidat_id, error: error.message });
    return res.status(500).json({ error: error.message, candidat_id });
  }
});

router.get('/visualiser/etape2_2bilan4excellences/:candidat_id', (req, res) => {
  const candidat_id = req.params.candidat_id;
  if (!_isValidCandidatId(candidat_id)) return res.status(400).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Identifiant candidat invalide</h1></body></html>');
  logger.info('Bilan 4 excellences — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'visu_etape2_b_bilan.html');
  res.sendFile(htmlPath, function(err) {
    if (err) {
      logger.error('Bilan 4 excellences — erreur sendFile', { candidat_id, error: err.message, path: htmlPath });
      if (!res.headersSent) res.status(500).type('html').send('<html><body><h1>Erreur chargement bilan</h1></body></html>');
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v12.0 (17/06/2026) — BILAN FABLE COGNITIF COMPLET
// ═══════════════════════════════════════════════════════════════════════════

router.get('/visualiser/t3_bilancognitif/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;

  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send(
      '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
      '<h1>Identifiant candidat invalide</h1>' +
      '<p>Format attendu : <code>pcc_1771077635499_gg1cj7z1q</code></p>' +
      '</body></html>'
    );
  }

  const acceptHeader = req.headers.accept || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson    = acceptHeader.includes('application/json') || formatParam === 'json';

  if (wantsJson) {
    logger.info('Bilan Fable cognitif — mode JSON', { candidat_id });
    try {
      const payload = await bilanFablePayloadService.buildPayload(candidat_id);
      if (!payload) return res.status(404).json({ error: 'Bilan Fable introuvable — étape 3 non exécutée ?', candidat_id });
      return res.json(payload);
    } catch (error) {
      logger.error('Bilan Fable cognitif — erreur JSON', { candidat_id, error: error.message });
      return res.status(500).json({ error: error.message, candidat_id });
    }
  }

  logger.info('Bilan Fable cognitif — mode HTML (rendu serveur)', { candidat_id });
  const fs = require('fs');
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'visu_etape1_T3_bilan.html');
  try {
    const payload = await bilanFablePayloadService.buildPayload(candidat_id);
    if (!payload) {
      return res.status(404).type('html').send(
        '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
        '<h1>Bilan Fable introuvable pour ce candidat</h1>' +
        '<p>Étape 3 non exécutée ? candidat_id : <code>' + candidat_id + '</code></p>' +
        '</body></html>'
      );
    }
    const tpl  = fs.readFileSync(htmlPath, 'utf8');
    const html = _renderT3Template(tpl, payload);
    res.type('html').send(html);
  } catch (error) {
    logger.error('Bilan Fable cognitif — erreur HTML', { candidat_id, error: error.message });
    if (!res.headersSent) {
      res.status(500).type('html').send(
        '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
        '<h1>Erreur de rendu — Bilan Fable cognitif</h1>' +
        '<p>' + (error.message || 'inconnue') + '</p>' +
        '</body></html>'
      );
    }
  }
});


// ═══════════════════════════════════════════════════════════════════════════
// ⭐ ÉTAPE 2c (02/07/2026) — TEST COMPLÉMENTAIRE DE DÉCENTRATION
// ═══════════════════════════════════════════════════════════════════════════

router.get('/api/test-decentration/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  if (!_isValidCandidatId(candidat_id)) return res.status(400).json({ error: 'Identifiant candidat invalide' });
  try {
    const rows = await airtableService.getTestDecentrationRows(candidat_id);
    if (!rows || rows.length === 0) return res.status(404).json({ error: 'Aucun test généré pour ce candidat', candidat_id });
    const dejaRepondu = rows.every(r => r.response_text && String(r.response_text).trim() !== '');
    const situations = rows
      .sort((a, b) => (a.numero || 0) - (b.numero || 0))
      .map(r => ({
        numero:         r.numero,
        situation_text: r.situation_text || '',
        question_text:  r.question_text || '',
        amorce:         r.amorce || ''
      }));
    // Ni personnage_profil, ni position, ni compatibilité : le candidat ne voit que la situation.
    return res.json({ candidat_id, deja_repondu: dejaRepondu, situations });
  } catch (error) {
    logger.error('TESTDEC — erreur GET', { candidat_id, error: error.message });
    return res.status(500).json({ error: error.message, candidat_id });
  }
});

router.post('/api/test-decentration/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  if (!_isValidCandidatId(candidat_id)) return res.status(400).json({ error: 'Identifiant candidat invalide' });
  try {
    const reponses = (req.body && req.body.reponses) || [];
    if (!Array.isArray(reponses) || reponses.length !== 10) {
      return res.status(400).json({ error: 'Il faut exactement 10 réponses.' });
    }
    for (const r of reponses) {
      if (!r || r.numero === undefined || !r.response_text || String(r.response_text).trim().length < 10) {
        return res.status(400).json({ error: `Réponse manquante ou trop courte (situation ${r && r.numero}).` });
      }
    }
    // Une seule passation : refuser si des réponses existent déjà.
    const rows = await airtableService.getTestDecentrationRows(candidat_id);
    if (!rows || rows.length !== 10) return res.status(404).json({ error: 'Test non généré pour ce candidat.' });
    if (rows.some(r => r.response_text && String(r.response_text).trim() !== '')) {
      return res.status(409).json({ error: 'Ce test a déjà été passé.' });
    }
    await airtableService.saveTestDecentrationReponses(candidat_id, reponses);
    await airtableService.updateVisiteur(candidat_id, {
      statut_analyse_pivar: 'ETAPE2_TESTDEC_COMPLET',
      derniere_activite:    new Date().toISOString()
    });
    logger.info('TESTDEC — réponses reçues, analyse lancée', { candidat_id });
    return res.json({ success: true, message: 'Réponses transmises — votre bilan sera actualisé sous peu.' });
  } catch (error) {
    logger.error('TESTDEC — erreur POST', { candidat_id, error: error.message });
    return res.status(500).json({ error: error.message, candidat_id });
  }
});

router.get('/visualiser/test-decentration/:candidat_id', (req, res) => {
  const candidat_id = req.params.candidat_id;
  if (!_isValidCandidatId(candidat_id)) return res.status(400).type('html').send('<html><body style="font-family:sans-serif;padding:40px;text-align:center;"><h1>Identifiant candidat invalide</h1></body></html>');
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'visu_etape2_c_testdec.html');
  res.sendFile(htmlPath, function(err) {
    if (err && !res.headersSent) res.status(500).type('html').send('<html><body><h1>Erreur chargement test</h1></body></html>');
  });
});

module.exports = router;
