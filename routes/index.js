// routes/index.js
// Routes HTTP — Profil-Cognitif v11.6
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// PHASE v11.6 (2026-06-05) — Visualisation Étape 2 (les 4 excellences) :
//   - ⭐ Ajout route GET /visualiser/etape2_1responsepour4excellences/:candidat_id
//     Architecture identique à /visualiser/etape1/ (2 modes via Accept header) :
//       - Mode JSON  → airtableService.getEtape2Excellences → { rows: [...] }
//       - Mode HTML  → res.sendFile(services/visualisation/etape2_4excellences.html)
//     Cible de la formule Airtable VISITEUR.lien_visualiser_t4responsepour4excellences.
//     Aucune modification des routes existantes.
//
// (Historique antérieur conservé.)

'use strict';

const path = require('path');

const express              = require('express');
const router               = express.Router();
const orchestratorPrincipal = require('../services/orchestrators/orchestratorPrincipal');
const queueService         = require('../services/flux/queueService');
const airtableService      = require('../services/infrastructure/airtableService');
const backupService        = require('../services/infrastructure/backupService');
const tableauT3bilanPayloadService = require('../services/visualisation/tableauT3bilanPayloadService');
const logger               = require('../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// POST /webhook — TRIGGER ASYNC depuis Airtable
// ═══════════════════════════════════════════════════════════════════════════

router.post('/webhook', async (req, res) => {
  const { session_id, candidate_id, priority } = req.body || {};
  const id = session_id || candidate_id;

  if (!id) {
    return res.status(400).json({
      error: 'session_id or candidate_id required',
      success: false
    });
  }

  try {
    queueService.addToQueue(id, priority || 'NORMAL');
    logger.info('Candidate added to queue via webhook', { id });

    return res.status(202).json({
      success:    true,
      message:    'Candidate queued for analysis',
      session_id: id
    });
  } catch (error) {
    logger.error('Webhook error', { id, error: error.message });
    return res.status(500).json({ error: error.message, success: false });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /analyze/:session_id — ANALYSE SYNCHRONE (test, relance manuelle)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/analyze/:session_id', async (req, res) => {
  const { session_id } = req.params;

  try {
    const result = await orchestratorPrincipal.processCandidate(session_id);
    return res.json({ success: true, ...result });
  } catch (error) {
    logger.error('Analyze error', { session_id, error: error.message });
    return res.status(500).json({
      error:      error.message,
      session_id,
      success:    false
    });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /status/:session_id — STATUT D'UN CANDIDAT (enrichi v10)
// ═══════════════════════════════════════════════════════════════════════════

router.get('/status/:session_id', async (req, res) => {
  const { session_id } = req.params;

  try {
    const visiteur = await airtableService.getVisiteur(session_id);
    if (!visiteur) {
      return res.status(404).json({ error: 'Candidate not found', session_id });
    }

    const t4Bilan = await airtableService.getEtape1T4Bilan(session_id);

    return res.json({
      session_id,
      statut_test:           visiteur.statut_test,
      statut_analyse_pivar:  visiteur.statut_analyse_pivar,
      statut_analyse:        visiteur.statut_analyse_pivar,
      derniere_activite:     visiteur.derniere_activite,
      erreur_analyse:        visiteur.erreur_analyse,

      nombre_tentatives_etape1: visiteur.nombre_tentatives_etape1 || 0,

      validation_humaine: visiteur.validation_humaine_action ? {
        action: visiteur.validation_humaine_action,
        motif:  visiteur.validation_humaine_motif,
        date:   visiteur.validation_humaine_date
      } : null,

      emails_candidat: {
        date_T0:           visiteur.date_T0 || null,
        T0_envoye:         !!visiteur.email_T0_envoye,
        H24_envoye:        !!visiteur.email_24h_envoye,
        H48_envoye:        !!visiteur.email_48h_envoye,
        H72_envoye:        !!visiteur.email_72h_envoye,
        livraison_envoye:  !!visiteur.email_livraison_envoye
      },

      bilan: t4Bilan ? {
        statut_bilan:      t4Bilan.statut_bilan,
        certifie:          t4Bilan.statut_bilan === 'certifie',
        has_audit_certif:  !!t4Bilan.audit_certificateur
      } : null
    });
  } catch (error) {
    logger.error('Status error', { session_id, error: error.message });
    return res.status(500).json({ error: error.message, session_id });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /api/queue/status — ÉTAT DE LA QUEUE
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
// POST /api/recover-from-backup/:session_id — REPRISE DEPUIS BACKUP
// ═══════════════════════════════════════════════════════════════════════════

router.post('/api/recover-from-backup/:session_id', async (req, res) => {
  const { session_id } = req.params;

  try {
    const lastStep = await backupService.getLastSuccessfulStep(session_id);
    if (!lastStep) {
      return res.status(404).json({
        error:      'No backup found for this candidate',
        session_id,
        success:    false
      });
    }

    queueService.addToQueue(session_id, 'HIGH');

    return res.status(202).json({
      success:    true,
      message:    'Recovery queued',
      session_id,
      last_step:  lastStep
    });
  } catch (error) {
    logger.error('Recover error', { session_id, error: error.message });
    return res.status(500).json({ error: error.message, session_id });
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// POST /api/retry-missing/:session_id — LEGACY v8, retiré en v9 (gardé en 410)
// ═══════════════════════════════════════════════════════════════════════════

router.post('/api/retry-missing/:session_id', (req, res) => {
  return res.status(410).json({
    error:   'This endpoint has been removed in v9. Use POST /api/recover-from-backup/:session_id instead.',
    success: false
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /debug/airtable — DIAGNOSTIC permissions Airtable
// ═══════════════════════════════════════════════════════════════════════════

router.get('/debug/airtable', async (req, res) => {
  const Airtable = require('airtable');
  const airtableConfig = require('../config/airtable');

  const base = new Airtable({ apiKey: process.env.AIRTABLE_TOKEN })
    .base(process.env.AIRTABLE_BASE_ID);

  const results = {};
  const tables = airtableConfig.TABLES;

  for (const [internalKey, tableName] of Object.entries(tables)) {
    try {
      const records = await base(tableName)
        .select({ maxRecords: 1, view: 'Grid view' })
        .firstPage();

      results[internalKey] = {
        tableName,
        ok: true,
        rowsRead: records.length,
        firstRecordId: records[0]?.id || null
      };
    } catch (error) {
      results[internalKey] = {
        tableName,
        ok: false,
        error: error.message,
        statusCode: error.statusCode || null
      };
    }
  }

  return res.json({
    base_id:           process.env.AIRTABLE_BASE_ID,
    token_first_chars: (process.env.AIRTABLE_TOKEN || '').substring(0, 10) + '...',
    results
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/etape1/:candidat_id — VISUALISATION ÉTAPE 1.1 ⭐ v10.6
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

  const acceptHeader  = req.headers.accept || '';
  const fetchMode     = req.headers['sec-fetch-mode'] || '';
  const formatParam   = (req.query && req.query.format) || '';
  const wantsJson =
    acceptHeader.includes('application/json') ||
    formatParam === 'json' ||
    fetchMode === 'cors';

  if (wantsJson) {
    logger.info('Visualisation Étape 1.1 — mode JSON', { candidat_id });
    try {
      const rows = await airtableService.getResponses(candidat_id);
      if (!rows || rows.length === 0) {
        return res.status(404).json({
          error: 'Aucune réponse trouvée pour ce candidat',
          candidat_id: candidat_id
        });
      }
      logger.info('Visualisation Étape 1.1 — JSON renvoyé', {
        candidat_id: candidat_id,
        count: rows.length,
        elapsedMs: Date.now() - startTime
      });
      return res.json({ rows: rows });
    } catch (error) {
      logger.error('Visualisation Étape 1.1 — erreur lecture RESPONSES', {
        candidat_id: candidat_id,
        error: error.message
      });
      return res.status(500).json({
        error: error.message,
        candidat_id: candidat_id
      });
    }
  }

  logger.info('Visualisation Étape 1.1 — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'visualisateur_etape1.html');
  res.sendFile(htmlPath, function(err) {
    if (err) {
      logger.error('Visualisation Étape 1.1 — erreur sendFile', {
        candidat_id: candidat_id,
        error: err.message,
        path: htmlPath
      });
      if (!res.headersSent) {
        res.status(500).type('html').send(
          '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
          '<h1>Erreur de chargement du visualiseur</h1>' +
          '<p>Erreur : ' + (err.message || 'inconnue') + '</p>' +
          '<p style="color:#888;font-size:11px;">Chemin testé : ' + htmlPath + '</p>' +
          '</body></html>'
        );
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v11.6 (05/06/2026) — GET /visualiser/etape2_1responsepour4excellences/:candidat_id
//     VISUALISATION ÉTAPE 2 (les 4 excellences cognitives)
// ═══════════════════════════════════════════════════════════════════════════
//
// Architecture à 2 modes (négociation par Accept header), calquée sur
// /visualiser/etape1/ :
//   1. Accept inclut "application/json" → renvoie les lignes de la table
//      "ETAPE2_1_RESPONSES pour 4 excellences", au format { rows: [...] }
//   2. Sinon → sert le HTML statique
//      services/visualisation/etape2_4excellences.html

router.get('/visualiser/etape2_1responsepour4excellences/:candidat_id', async (req, res) => {
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

  const acceptHeader  = req.headers.accept || '';
  const fetchMode     = req.headers['sec-fetch-mode'] || '';
  const formatParam   = (req.query && req.query.format) || '';
  const wantsJson =
    acceptHeader.includes('application/json') ||
    formatParam === 'json' ||
    fetchMode === 'cors';

  // ─── Mode JSON ────────────────────────────────────────────────────────────
  if (wantsJson) {
    logger.info('Visualisation Étape 2 — mode JSON', { candidat_id });
    try {
      const rows = await airtableService.getEtape2Excellences(candidat_id);
      if (!rows || rows.length === 0) {
        return res.status(404).json({
          error: 'Aucune réponse Étape 2 trouvée pour ce candidat',
          candidat_id: candidat_id
        });
      }
      logger.info('Visualisation Étape 2 — JSON renvoyé', {
        candidat_id: candidat_id,
        count: rows.length,
        elapsedMs: Date.now() - startTime
      });
      return res.json({ rows: rows });
    } catch (error) {
      logger.error('Visualisation Étape 2 — erreur lecture', {
        candidat_id: candidat_id,
        error: error.message
      });
      return res.status(500).json({
        error: error.message,
        candidat_id: candidat_id
      });
    }
  }

  // ─── Mode HTML : sert services/visualisation/etape2_4excellences.html ─────
  logger.info('Visualisation Étape 2 — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'etape2_4excellences.html');
  res.sendFile(htmlPath, function(err) {
    if (err) {
      logger.error('Visualisation Étape 2 — erreur sendFile', {
        candidat_id: candidat_id,
        error: err.message,
        path: htmlPath
      });
      if (!res.headersSent) {
        res.status(500).type('html').send(
          '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
          '<h1>Erreur de chargement du visualiseur Étape 2</h1>' +
          '<p>Erreur : ' + (err.message || 'inconnue') + '</p>' +
          '<p style="color:#888;font-size:11px;">Chemin testé : ' + htmlPath + '</p>' +
          '</body></html>'
        );
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/t1/:candidat_id — VISUALISATION HTML T1 ⭐ v10.7
// ═══════════════════════════════════════════════════════════════════════════

router.get('/visualiser/t1/:candidat_id', async (req, res) => {
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

  const acceptHeader  = req.headers.accept || '';
  const fetchMode     = req.headers['sec-fetch-mode'] || '';
  const formatParam   = (req.query && req.query.format) || '';
  const wantsJson =
    acceptHeader.includes('application/json') ||
    formatParam === 'json' ||
    fetchMode === 'cors';

  if (wantsJson) {
    logger.info('Visualisation T1 — mode JSON', { candidat_id });
    try {
      const rowsT1 = await airtableService.getEtape1T1(candidat_id);
      if (!rowsT1 || rowsT1.length === 0) {
        return res.status(404).json({
          error: 'Aucune analyse T1 trouvée pour ce candidat',
          candidat_id: candidat_id
        });
      }

      let responsesMap = {};
      try {
        const responses = await airtableService.getResponses(candidat_id);
        if (responses && responses.length > 0) {
          for (const r of responses) {
            if (r.id_question) responsesMap[r.id_question] = r;
          }
        }
      } catch (e) {
        logger.warn('Visualisation T1 — lecture RESPONSES échouée (continue avec T1 seul)', {
          candidat_id: candidat_id,
          error: e.message
        });
      }

      const mergedRows = rowsT1.map(t1 => {
        const resp = responsesMap[t1.id_question] || {};
        return {
          ...t1,
          cog_outils_mobilises:    t1.cog_outils_mobilises    || resp.cog_outils_mobilises    || '',
          cog_pilier_sortie:       t1.cog_pilier_sortie       || resp.cog_pilier_sortie       || '',
          cog_gouverne_commentaire: t1.cog_gouverne_commentaire || resp.cog_gouverne_commentaire || ''
        };
      });

      logger.info('Visualisation T1 — JSON renvoyé', {
        candidat_id: candidat_id,
        count: mergedRows.length,
        elapsedMs: Date.now() - startTime
      });
      return res.json({ rows: mergedRows });
    } catch (error) {
      logger.error('Visualisation T1 — erreur lecture ETAPE1_T1', {
        candidat_id: candidat_id,
        error: error.message
      });
      return res.status(500).json({
        error: error.message,
        candidat_id: candidat_id
      });
    }
  }

  logger.info('Visualisation T1 — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'tableauT1HtmlService.html');
  res.sendFile(htmlPath, function(err) {
    if (err) {
      logger.error('Visualisation T1 — erreur sendFile', {
        candidat_id: candidat_id,
        error: err.message,
        path: htmlPath
      });
      if (!res.headersSent) {
        res.status(500).type('html').send(
          '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
          '<h1>Erreur de chargement du visualiseur T1</h1>' +
          '<p>Erreur : ' + (err.message || 'inconnue') + '</p>' +
          '<p style="color:#888;font-size:11px;">Chemin testé : ' + htmlPath + '</p>' +
          '</body></html>'
        );
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v10.9 — VISUALISATIONS PHASE 3
// ═══════════════════════════════════════════════════════════════════════════

router.get('/visualiser/tableau2piliers/:candidat_id', async (req, res) => {
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
  const fetchMode    = req.headers['sec-fetch-mode'] || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson =
    acceptHeader.includes('application/json') ||
    formatParam === 'json' ||
    fetchMode === 'cors';

  if (wantsJson) {
    logger.info('Visualisation tableau2piliers — mode JSON', { candidat_id });
    try {
      const rows = await airtableService.getEtape1T2VentilationPiliers(candidat_id);
      return res.json({ rows: rows || [] });
    } catch (error) {
      logger.error('Visualisation tableau2piliers — erreur lecture', {
        candidat_id: candidat_id,
        error: error.message
      });
      return res.status(500).json({
        error: error.message,
        candidat_id: candidat_id
      });
    }
  }

  logger.info('Visualisation tableau2piliers — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'tableau2piliersHtmlService.html');
  res.sendFile(htmlPath, function(err) {
    if (err) {
      logger.error('Visualisation tableau2piliers — erreur sendFile', {
        candidat_id: candidat_id,
        error: err.message,
        path: htmlPath
      });
      if (!res.headersSent) {
        res.status(500).type('html').send(
          '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
          '<h1>Erreur de chargement du visualiseur tableau2piliers</h1>' +
          '<p>Erreur : ' + (err.message || 'inconnue') + '</p>' +
          '<p style="color:#888;font-size:11px;">Chemin testé : ' + htmlPath + '</p>' +
          '</body></html>'
        );
      }
    }
  });
});

// ─── ⭐ v11.0 — Route bilan étape 3 + mini-moteur Handlebars ───────────────

function _renderT3Template(tpl, ctx) {
  function escapeHtml(s) {
    if (s === undefined || s === null) return '';
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  function resolvePath(scope, path) {
    if (path === 'this' || path === '.') return scope;
    const parts = path.split('.');
    let cur = scope;
    for (const p of parts) {
      if (cur === null || cur === undefined) return undefined;
      cur = cur[p];
    }
    return cur;
  }
  function isTruthy(v) {
    if (Array.isArray(v)) return v.length > 0;
    if (v === null || v === undefined || v === false || v === 0 || v === '') return false;
    return true;
  }
  function stripHtmlComments(str) {
    return str.replace(/<!--[\s\S]*?-->/g, '');
  }
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
        } else {
          out.push(tk);
          i++;
        }
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
      else if (n.type === 'raw') {
        const v = lookup(n.path);
        out += (v === undefined || v === null) ? '' : String(v);
      }
      else if (n.type === 'if') {
        if (isTruthy(lookup(n.path))) out += renderNodes(n.ifBody, scopes);
        else out += renderNodes(n.elseBody, scopes);
      }
      else if (n.type === 'each') {
        const list = lookup(n.path);
        if (Array.isArray(list)) {
          for (const item of list) out += renderNodes(n.body, scopes.concat([item]));
        }
      }
    }
    return out;
  }
  const ast = buildAst(parse(tpl));
  return renderNodes(ast, [ctx]);
}

router.get('/visualiser/t3_bilan/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;

  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send(
      '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
      '<h1>Identifiant candidat invalide</h1>' +
      '<p>Format attendu : <code>pivar_1762094675215_77bg53iz0</code></p>' +
      '</body></html>'
    );
  }

  const acceptHeader = req.headers.accept || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson =
    acceptHeader.includes('application/json') ||
    formatParam === 'json';

  if (wantsJson) {
    logger.info('Visualisation t3_bilan — mode JSON', { candidat_id });
    try {
      const payload = await tableauT3bilanPayloadService.buildPayload(candidat_id);
      if (!payload) {
        return res.status(404).json({
          error: 'Aucun bilan T3 trouvé pour ce candidat (étape 3 non exécutée ?)',
          candidat_id: candidat_id
        });
      }
      return res.json(payload);
    } catch (error) {
      logger.error('Visualisation t3_bilan — erreur assemblage', {
        candidat_id: candidat_id,
        error: error.message
      });
      return res.status(500).json({
        error: error.message,
        candidat_id: candidat_id
      });
    }
  }

  logger.info('Visualisation t3_bilan — mode HTML (rendu serveur)', { candidat_id });
  const fs = require('fs');
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'tableauT3bilanService.html');
  try {
    const payload = await tableauT3bilanPayloadService.buildPayload(candidat_id);
    if (!payload) {
      return res.status(404).type('html').send(
        '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
        '<h1>Aucun bilan T3 trouvé pour ce candidat</h1>' +
        '<p>Étape 3 non exécutée ? candidat_id : <code>' + candidat_id + '</code></p>' +
        '</body></html>'
      );
    }
    const tpl = fs.readFileSync(htmlPath, 'utf8');
    const html = _renderT3Template(tpl, payload);
    res.type('html').send(html);
  } catch (error) {
    logger.error('Visualisation t3_bilan — erreur rendu HTML', {
      candidat_id: candidat_id,
      error: error.message,
      stack: error.stack
    });
    if (!res.headersSent) {
      res.status(500).type('html').send(
        '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
        '<h1>Erreur de rendu t3_bilan</h1>' +
        '<p>Erreur : ' + (error.message || 'inconnue') + '</p>' +
        '<p style="color:#888;font-size:11px;">Chemin testé : ' + htmlPath + '</p>' +
        '</body></html>'
      );
    }
  }
});

router.get('/visualiser/tableau2circuits/:candidat_id', async (req, res) => {
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
  const fetchMode    = req.headers['sec-fetch-mode'] || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson =
    acceptHeader.includes('application/json') ||
    formatParam === 'json' ||
    fetchMode === 'cors';

  if (wantsJson) {
    logger.info('Visualisation tableau2circuits — mode JSON', { candidat_id });
    try {
      const rows = await airtableService.getEtape1T2InventaireCircuits(candidat_id);
      return res.json({ rows: rows || [] });
    } catch (error) {
      logger.error('Visualisation tableau2circuits — erreur lecture', {
        candidat_id: candidat_id,
        error: error.message
      });
      return res.status(500).json({
        error: error.message,
        candidat_id: candidat_id
      });
    }
  }

  logger.info('Visualisation tableau2circuits — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'tableau2circuitsHtmlService.html');
  res.sendFile(htmlPath, function(err) {
    if (err) {
      logger.error('Visualisation tableau2circuits — erreur sendFile', {
        candidat_id: candidat_id,
        error: err.message,
        path: htmlPath
      });
      if (!res.headersSent) {
        res.status(500).type('html').send(
          '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
          '<h1>Erreur de chargement du visualiseur tableau2circuits</h1>' +
          '<p>Erreur : ' + (err.message || 'inconnue') + '</p>' +
          '<p style="color:#888;font-size:11px;">Chemin testé : ' + htmlPath + '</p>' +
          '</body></html>'
        );
      }
    }
  });
});

router.get('/visualiser/tableau2parquestion/:candidat_id', async (req, res) => {
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
  const fetchMode    = req.headers['sec-fetch-mode'] || '';
  const formatParam  = (req.query && req.query.format) || '';
  const wantsJson =
    acceptHeader.includes('application/json') ||
    formatParam === 'json' ||
    fetchMode === 'cors';

  if (wantsJson) {
    logger.info('Visualisation tableau2parquestion — mode JSON', { candidat_id });
    try {
      const rowsT1 = await airtableService.getEtape1T1(candidat_id);
      if (!rowsT1 || rowsT1.length === 0) {
        return res.json({ rows: [] });
      }

      const projected = rowsT1.map(t1 => ({
        id_question:   t1.id_question,
        pilier_coeur:  t1.pilier_coeur,
        nb_activations_coeur:                   t1.nb_activations_coeur,
        detail_circuits_coeur:                  t1.detail_circuits_coeur,
        detail_circuits_instrumentaux:          t1.detail_circuits_instrumentaux,
        nb_activations_par_pilier_instrumental: t1.nb_activations_par_pilier_instrumental,
        nb_P1_instru:     t1.nb_P1_instru,
        nb_P2_instru:     t1.nb_P2_instru,
        nb_P3_instru:     t1.nb_P3_instru,
        nb_P4_instru:     t1.nb_P4_instru,
        nb_P5_instru:     t1.nb_P5_instru,
        detail_P1_instru: t1.detail_P1_instru,
        detail_P2_instru: t1.detail_P2_instru,
        detail_P3_instru: t1.detail_P3_instru,
        detail_P4_instru: t1.detail_P4_instru,
        detail_P5_instru: t1.detail_P5_instru
      }));

      return res.json({ rows: projected });
    } catch (error) {
      logger.error('Visualisation tableau2parquestion — erreur lecture', {
        candidat_id: candidat_id,
        error: error.message
      });
      return res.status(500).json({
        error: error.message,
        candidat_id: candidat_id
      });
    }
  }

  logger.info('Visualisation tableau2parquestion — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'tableau2parquestionHtmlService.html');
  res.sendFile(htmlPath, function(err) {
    if (err) {
      logger.error('Visualisation tableau2parquestion — erreur sendFile', {
        candidat_id: candidat_id,
        error: err.message,
        path: htmlPath
      });
      if (!res.headersSent) {
        res.status(500).type('html').send(
          '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
          '<h1>Erreur de chargement du visualiseur tableau2parquestion</h1>' +
          '<p>Erreur : ' + (err.message || 'inconnue') + '</p>' +
          '<p style="color:#888;font-size:11px;">Chemin testé : ' + htmlPath + '</p>' +
          '</body></html>'
        );
      }
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/t2/:candidat_id — DÉSACTIVÉE (tableauT2HtmlService.js absent)
// ═══════════════════════════════════════════════════════════════════════════
/*
router.get('/visualiser/t2/:candidat_id', async (req, res) => {
  // ... (désactivée en v10.7)
});
*/

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/t3/:candidat_id — PRÉPARÉE / DÉSACTIVÉE
// ═══════════════════════════════════════════════════════════════════════════
/*
router.get('/visualiser/t3/:candidat_id', async (req, res) => {
  // ... (préparée, désactivée)
});
*/

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/t4/:candidat_id — PRÉPARÉE / DÉSACTIVÉE
// ═══════════════════════════════════════════════════════════════════════════
/*
router.get('/visualiser/t4/:candidat_id', async (req, res) => {
  // ... (préparée, désactivée)
});
*/

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ v11.7 (05/06/2026) — BILAN DYNAMIQUE DES 4 EXCELLENCES
// ═══════════════════════════════════════════════════════════════════════════
//
// Deux routes complémentaires :
//   - GET /api/etape2_2bilan4excellences/:candidat_id        → JSON consolidé (T5B + T5C)
//   - GET /visualiser/etape2_2bilan4excellences/:candidat_id → sert la page HTML autonome
//     services/visualisation/etape2_bilan4excellences.html (qui fetch l'API ci-dessus).
//
// La page lit les verbatims-preuves bruts depuis T5B (champ verbatims_preuves) :
// aucune reformulation, aucune sélection côté serveur.

function _isValidCandidatId(id) {
  return id && id.length >= 5 && id.length <= 100;
}

router.get('/api/etape2_2bilan4excellences/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  const startTime = Date.now();

  if (!_isValidCandidatId(candidat_id)) {
    return res.status(400).json({ error: 'Identifiant candidat invalide', candidat_id });
  }

  logger.info('Bilan 4 excellences — API JSON', { candidat_id });
  try {
    const payload = await airtableService.getBilanExcellences(candidat_id);
    if (!payload) {
      return res.status(404).json({
        error: 'Aucun bilan trouvé pour ce candidat (étape 2/3 non exécutée ?)',
        candidat_id
      });
    }
    logger.info('Bilan 4 excellences — JSON renvoyé', {
      candidat_id,
      nb_excellences: (payload.excellences || []).length,
      elapsedMs: Date.now() - startTime
    });
    return res.json(payload);
  } catch (error) {
    logger.error('Bilan 4 excellences — erreur assemblage', { candidat_id, error: error.message });
    return res.status(500).json({ error: error.message, candidat_id });
  }
});

router.get('/visualiser/etape2_2bilan4excellences/:candidat_id', (req, res) => {
  const candidat_id = req.params.candidat_id;

  if (!_isValidCandidatId(candidat_id)) {
    return res.status(400).type('html').send(
      '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
      '<h1>Identifiant candidat invalide</h1>' +
      '<p>Format attendu : <code>pivar_1762094675215_77bg53iz0</code></p>' +
      '</body></html>'
    );
  }

  logger.info('Bilan 4 excellences — mode HTML', { candidat_id });
  const htmlPath = path.join(__dirname, '..', 'services', 'visualisation', 'etape2_bilan4excellences.html');
  res.sendFile(htmlPath, function(err) {
    if (err) {
      logger.error('Bilan 4 excellences — erreur sendFile', {
        candidat_id, error: err.message, path: htmlPath
      });
      if (!res.headersSent) {
        res.status(500).type('html').send(
          '<html><body style="font-family:sans-serif;padding:40px;text-align:center;">' +
          '<h1>Erreur de chargement du bilan</h1>' +
          '<p>Erreur : ' + (err.message || 'inconnue') + '</p>' +
          '<p style="color:#888;font-size:11px;">Chemin testé : ' + htmlPath + '</p>' +
          '</body></html>'
        );
      }
    }
  });
});

module.exports = router;
