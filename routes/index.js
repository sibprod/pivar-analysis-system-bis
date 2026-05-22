// routes/index.js
// Routes HTTP — Profil-Cognitif v10.7
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Endpoints :
//   GET  /health                                     — health check (défini dans server.js)
//   POST /webhook                                    — trigger principal Airtable
//   POST /analyze/:session_id                        — analyse synchrone
//   GET  /status/:session_id                         — statut analyse en cours (enrichi v10)
//   GET  /api/queue/status                           — état queue interne
//   POST /api/recover-from-backup/:session_id        — reprise depuis backup
//   POST /api/retry-missing/:session_id              — legacy v8 (renvoie 410, gardé Décision D-C)
//   GET  /debug/airtable                             — diagnostic permissions
//   GET  /visualiser/etape1/:candidat_id             — visualisation Étape 1.1 (lecture cognitive) ⭐ v10.6
//   GET  /visualiser/t1/:candidat_id                 — visualisation HTML T1 ⭐ v10.7
//                                                       (refonte sur modèle étape1.1 — sendFile + mode JSON)
//   GET  /visualiser/tableau2piliers/:candidat_id    — ⭐ v10.9 — ventilation par pilier cœur (Phase 3 Algorithme A)
//   GET  /visualiser/tableau2circuits/:candidat_id   — ⭐ v10.9 — inventaire complet des circuits (Phase 3 Algorithme A)
//   GET  /visualiser/tableau2parquestion/:candidat_id — ⭐ v10.9b — détail par question (lit ETAPE1_T1 14 champs Phase 3A)
//   GET  /visualiser/t2/:candidat_id                 — visualisation HTML T2 interne ⭐ v10.5
//   GET  /visualiser/t3/:candidat_id                 — visualisation HTML T3 (préparé, désactivé)
//   GET  /visualiser/t4/:candidat_id                 — visualisation HTML T4 (préparé, désactivé)
//
// PHASE v10.7 (2026-05-20) — refonte route T1 :
//   La route /visualiser/t1/ utilisait un service Node `tableauT1HtmlService.js`
//   qui générait le HTML côté serveur (devenu obsolète après refonte systémique
//   de l'architecture en 2 étapes : étape1.1 + T1).
//
//   La route est désormais alignée sur le modèle de /visualiser/etape1/ (Phase
//   HTML-Etape11 v10.6) — architecture à 2 modes (négociation par Accept header) :
//     - Mode JSON  → renvoie les lignes ETAPE1_T1 enrichies des champs RESPONSES
//                    de la zone amont (cog_outils_mobilises, cog_pilier_sortie,
//                    cog_gouverne_commentaire) au format { rows: [...] }
//     - Mode HTML  → sert le fichier statique
//                    services/visualisation/tableauT1HtmlService.html
//                    via res.sendFile (natif Express, asynchrone, robuste).
//
//   Le require obsolète `const tableauT1HtmlService = require(...)` est supprimé.
//   Aucun service Node de visualisation T1 n'est plus nécessaire.
//
// PHASE D (2026-04-28) — v10 :
//   - Chemins require mis à jour vers nouvelle architecture (Décision n°27)
//   - /status enrichi : nombre_tentatives_etape1, validation_humaine, emails_candidat
//   - Alias statut_analyse_pivar gardé (Décision D-B)
//   - Endpoint legacy /api/retry-missing gardé en 410 (Décision D-C)
//
// PHASE HTML-T2 (2026-05-06) — v10.5 :
//   - Ajout route /visualiser/t2/:candidat_id (Phase HTML-T2-1.0.0)
//
// PHASE v10.9 (2026-05-22) — Phase 3 enrichissement Algorithme A v1.1 :
//   - Ajout route /visualiser/tableau2piliers/:candidat_id (négociation Accept JSON/HTML)
//   - Ajout route /visualiser/tableau2circuits/:candidat_id (négociation Accept JSON/HTML)
//   - Pattern identique à /visualiser/t1/ (v10.7) : sendFile sur HTML statique en mode HTML,
//     lecture Airtable directe en mode JSON (helpers getEtape1T2VentilationPiliers
//     et getEtape1T2InventaireCircuits définis dans airtableService.js v10.9).
//   - Aucune modification des routes existantes.
//
// PHASE v10.9b (2026-05-22 soir) — 3e vue Phase 3 :
//   - Ajout route /visualiser/tableau2parquestion/:candidat_id
//     qui lit DIRECTEMENT ETAPE1_T1 (les 14 champs Phase 3A) avec projection
//     côté serveur (~17 champs utiles sur ~40) pour alléger le JSON.
//   - Plus proche de la vérité primaire que les vues 1 et 2 (qui lisent les
//     tables agrégées). Sert d'audit ligne par ligne en parallèle des 2 vues
//     agrégées.
//   - Aucune modification des routes existantes ni du pipeline.

'use strict';

const path = require('path');

const express              = require('express');
const router               = express.Router();
const orchestratorPrincipal = require('../services/orchestrators/orchestratorPrincipal');
const queueService         = require('../services/flux/queueService');
const airtableService      = require('../services/infrastructure/airtableService');
const backupService        = require('../services/infrastructure/backupService');
// ⛔ v10.7 — Le require `tableauT1HtmlService` est SUPPRIMÉ.
//           La route T1 utilise désormais res.sendFile sur un HTML statique
//           (modèle étape1.1). Aucun service Node n'est plus nécessaire.
// ⛔ v10.7 (20/05) — T2 temporairement désactivé : le fichier
//                   services/visualisation/tableauT2HtmlService.js est absent
//                   du repo. À réactiver quand le fichier sera restauré.
// const tableauT2HtmlService = require('../services/visualisation/tableauT2HtmlService');
// ⭐ Décommenter quand les services T3/T4 seront créés :
// const tableauT3HtmlService = require('../services/visualisation/tableauT3HtmlService');
// const tableauT4HtmlService = require('../services/visualisation/tableauT4HtmlService');
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
//
// Architecture à 2 modes (négociation par Accept header) :
//   1. Si Accept inclut "application/json" → renvoie les lignes RESPONSES
//      enrichies par l'agent prompt_etape1, au format { rows: [...] }
//   2. Sinon → sert le HTML statique services/visualisation/visualisateur_etape1.html

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

  // ─── Mode JSON ────────────────────────────────────────────────────────────
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

  // ─── Mode HTML : sert services/visualisation/visualisateur_etape1.html ────
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
// GET /visualiser/t1/:candidat_id — VISUALISATION HTML T1 ⭐ v10.7
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ Phase v10.7 (2026-05-20) — Refonte sur modèle étape1.1
//
// Architecture identique à /visualiser/etape1/ — 2 modes selon Accept header :
//
//   1. Si Accept inclut "application/json" → renvoie les lignes ETAPE1_T1
//      du candidat enrichies des champs RESPONSES de la zone amont
//      (cog_outils_mobilises, cog_pilier_sortie, cog_gouverne_commentaire
//      qui ne sont pas recopiés en ETAPE1_T1).
//
//   2. Sinon → sert le HTML statique
//      services/visualisation/tableauT1HtmlService.html
//      qui fait lui-même un fetch JSON sur la même URL (avec Accept: application/json).

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

  // ─── Mode JSON ────────────────────────────────────────────────────────────
  if (wantsJson) {
    logger.info('Visualisation T1 — mode JSON', { candidat_id });
    try {
      // 1. Lire les lignes ETAPE1_T1
      const rowsT1 = await airtableService.getEtape1T1(candidat_id);
      if (!rowsT1 || rowsT1.length === 0) {
        return res.status(404).json({
          error: 'Aucune analyse T1 trouvée pour ce candidat',
          candidat_id: candidat_id
        });
      }

      // 2. Lire RESPONSES pour enrichir avec les champs cog_* non recopiés
      //    en ETAPE1_T1 (cog_outils_mobilises, cog_pilier_sortie,
      //    cog_gouverne_commentaire). Best-effort : si la lecture RESPONSES
      //    échoue, on continue avec les données ETAPE1_T1 seules.
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

      // 3. Fusionner ETAPE1_T1 + RESPONSES pour la zone amont
      const mergedRows = rowsT1.map(t1 => {
        const resp = responsesMap[t1.id_question] || {};
        return {
          ...t1,
          // Champs RESPONSES non recopiés en ETAPE1_T1 (zone amont étape1.1)
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

  // ─── Mode HTML : sert services/visualisation/tableauT1HtmlService.html ────
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
// ⭐ v10.9 (22/05/2026) — VISUALISATIONS PHASE 3 (Algorithme A v1.1)
// ═══════════════════════════════════════════════════════════════════════════
//
// 2 nouvelles routes pour les vues issues de la Phase 3 enrichissement :
//
//   GET /visualiser/tableau2piliers/:candidat_id
//       → JSON  : lignes ETAPE1_T2_VENTILATION_PILIERS du candidat (1-5 lignes)
//       → HTML  : sert services/visualisation/tableau2piliersHtmlService.html
//
//   GET /visualiser/tableau2circuits/:candidat_id
//       → JSON  : lignes ETAPE1_T2_INVENTAIRE_CIRCUITS du candidat (~30-60 lignes)
//       → HTML  : sert services/visualisation/tableau2circuitsHtmlService.html
//
// Architecture identique à /visualiser/t1/ (pattern v10.7) :
//   - Négociation Accept header (json explicite vs html par défaut)
//   - Le HTML statique fait un fetch sur la même URL avec Accept: application/json
//   - Pas d'authentification (cohérent avec les autres routes /visualiser/)
//   - Données calculées par agentT2_phase3_enrichissement_Service en Phase 3
//
// Pour Isabelle : ces URLs peuvent être posées en formules Airtable dans VISITEUR
// (champs lien_tableau2piliers et lien_tableau2circuits).

// ─── Route 1 : Tableau ventilation par pilier cœur ──────────────────────────
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

  // ─── Mode JSON ────────────────────────────────────────────────────────────
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

  // ─── Mode HTML : sert services/visualisation/tableau2piliersHtmlService.html ────
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

// ─── Route 2 : Tableau inventaire circuits ──────────────────────────────────
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

  // ─── Mode JSON ────────────────────────────────────────────────────────────
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

  // ─── Mode HTML : sert services/visualisation/tableau2circuitsHtmlService.html ────
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

// ─── Route 3 : Tableau détail par question ──────────────────────────────────
// ⭐ v10.9b (22/05/2026) — 3e vue de la Phase 3 enrichissement.
//
// Différence avec les routes 1 et 2 :
//   - Routes 1 et 2 lisent les tables agrégées ETAPE1_T2_VENTILATION_PILIERS
//     et ETAPE1_T2_INVENTAIRE_CIRCUITS (écrites par Phase 3B/3C).
//   - Route 3 lit DIRECTEMENT ETAPE1_T1 (les 14 champs Phase 3A) — donc
//     plus proche de la vérité primaire, granularité ligne par ligne.
//
// Projection côté serveur : on ne renvoie que les ~17 champs utiles pour
// alléger le JSON (le record T1 complet contient ~40 champs avec verbatim
// brut, raisonnement Claude, scoring, etc., dont la vue n'a pas besoin).
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

  // ─── Mode JSON ────────────────────────────────────────────────────────────
  if (wantsJson) {
    logger.info('Visualisation tableau2parquestion — mode JSON', { candidat_id });
    try {
      const rowsT1 = await airtableService.getEtape1T1(candidat_id);
      if (!rowsT1 || rowsT1.length === 0) {
        return res.json({ rows: [] });
      }

      // Projection des champs utiles uniquement (~17 champs sur ~40)
      // pour alléger le JSON et la bande passante.
      const projected = rowsT1.map(t1 => ({
        id_question:   t1.id_question,
        pilier_coeur:  t1.pilier_coeur,
        // 4 champs synthèse Phase 3A
        nb_activations_coeur:                   t1.nb_activations_coeur,
        detail_circuits_coeur:                  t1.detail_circuits_coeur,
        detail_circuits_instrumentaux:          t1.detail_circuits_instrumentaux,
        nb_activations_par_pilier_instrumental: t1.nb_activations_par_pilier_instrumental,
        // 10 champs décomposés par pilier instrumental
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

  // ─── Mode HTML : sert services/visualisation/tableau2parquestionHtmlService.html ────
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
// GET /visualiser/t2/:candidat_id — VISUALISATION HTML T2 INTERNE
// ⛔ v10.7 — DÉSACTIVÉE temporairement : tableauT2HtmlService.js absent du repo
// ═══════════════════════════════════════════════════════════════════════════

/*
router.get('/visualiser/t2/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  const startTime = Date.now();

  logger.info('Visualisation T2 demandée', { candidat_id, ip: req.ip });

  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h1>⚠ Identifiant candidat invalide</h1>
        <p>Le format attendu est par exemple : <code>pcc_1771077635499_gg1cj7z1q</code></p>
      </body></html>
    `);
  }

  try {
    const html = await tableauT2HtmlService.generateTableauT2Html(candidat_id);
    const elapsed = Date.now() - startTime;
    logger.info('Visualisation T2 générée', { candidat_id, elapsedMs: elapsed, htmlSize: html.length });

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(html);
  } catch (error) {
    logger.error('Erreur génération visualisation T2', { candidat_id, error: error.message, stack: error.stack });
    return res.status(500).type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h1>⚠ Erreur lors de la génération du tableau T2</h1>
        <p><strong>Candidat :</strong> ${candidat_id}</p>
        <p><strong>Erreur :</strong> ${error.message}</p>
        <p style="color:#888;font-size:11px;">Vérifiez que le candidat existe dans Airtable et qu'il a bien une analyse T2 dans ETAPE1_T2 (T2 doit avoir été exécuté avec succès).</p>
      </body></html>
    `);
  }
});
*/

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/t3/:candidat_id — VISUALISATION HTML T3 (PRÉPARÉE — DÉSACTIVÉE)
// ═══════════════════════════════════════════════════════════════════════════

/*
router.get('/visualiser/t3/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  const startTime = Date.now();
  logger.info('Visualisation T3 demandée', { candidat_id, ip: req.ip });
  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send('<html><body><h1>⚠ Identifiant candidat invalide</h1></body></html>');
  }
  try {
    const html = await tableauT3HtmlService.generateTableauT3Html(candidat_id);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(html);
  } catch (error) {
    return res.status(500).type('html').send('<html><body><h1>⚠ Erreur T3</h1><p>' + error.message + '</p></body></html>');
  }
});
*/

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/t4/:candidat_id — VISUALISATION HTML T4 (PRÉPARÉE — DÉSACTIVÉE)
// ═══════════════════════════════════════════════════════════════════════════

/*
router.get('/visualiser/t4/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  const startTime = Date.now();
  logger.info('Visualisation T4 demandée', { candidat_id, ip: req.ip });
  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send('<html><body><h1>⚠ Identifiant candidat invalide</h1></body></html>');
  }
  try {
    const html = await tableauT4HtmlService.generateTableauT4Html(candidat_id);
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(html);
  } catch (error) {
    return res.status(500).type('html').send('<html><body><h1>⚠ Erreur T4</h1><p>' + error.message + '</p></body></html>');
  }
});
*/

module.exports = router;
