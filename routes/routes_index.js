// routes/index.js
// Routes HTTP — Profil-Cognitif v10.0
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
//   GET  /visualiser/etape1/:candidat_id             — visualisation HTML Étape 1.1 (lecture cognitive) ⭐ v10.6
//                                                       2 modes selon Accept header :
//                                                         - application/json → renvoie {rows:[...]} depuis RESPONSES
//                                                         - text/html        → sert le fichier statique visualisateur_etape1.html
//   GET  /visualiser/t1/:candidat_id                 — visualisation HTML T1 interne
//   GET  /visualiser/t2/:candidat_id                 — visualisation HTML T2 interne ⭐ v10.5
//   GET  /visualiser/t3/:candidat_id                 — visualisation HTML T3 (préparé, désactivé)
//   GET  /visualiser/t4/:candidat_id                 — visualisation HTML T4 (préparé, désactivé)
//
// PHASE D (2026-04-28) — v10 :
//   - Chemins require mis à jour vers nouvelle architecture (Décision n°27)
//   - /status enrichi : nombre_tentatives_etape1, validation_humaine, emails_candidat (Décisions n°16, n°24, n°33)
//   - Alias statut_analyse_pivar gardé (Décision D-B — interne, pas exposé externe)
//   - Endpoint legacy /api/retry-missing gardé en 410 (Décision D-C — pierre tombale propre)
//
// PHASE HTML-T2 (2026-05-06) — v10.5 :
//   - Ajout route /visualiser/t2/:candidat_id (Phase HTML-T2-1.0.0)
//   - Routes T3 et T4 préparées en commentaires — décommenter quand les services
//     tableauT3HtmlService et tableauT4HtmlService seront créés.

'use strict';

const fs                   = require('fs');
const path                 = require('path');
const express              = require('express');
const router               = express.Router();
const orchestratorPrincipal = require('../services/orchestrators/orchestratorPrincipal');  // ⭐ v10
const queueService         = require('../services/flux/queueService');                      // ⭐ v10
const airtableService      = require('../services/infrastructure/airtableService');         // ⭐ v10
const backupService        = require('../services/infrastructure/backupService');           // ⭐ v10
const tableauT1HtmlService = require('../services/visualisation/tableauT1HtmlService');     // ⭐ v10.2 (Phase HTML-1)
const tableauT2HtmlService = require('../services/visualisation/tableauT2HtmlService');     // ⭐ v10.5 (Phase HTML-T2-1.0.0)
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
      statut_analyse_pivar:  visiteur.statut_analyse_pivar,  // alias rétrocompat (Décision D-B)
      statut_analyse:        visiteur.statut_analyse_pivar,
      derniere_activite:     visiteur.derniere_activite,
      erreur_analyse:        visiteur.erreur_analyse,

      // ⭐ v10 — Tentatives Mode 4 (Décision n°24)
      nombre_tentatives_etape1: visiteur.nombre_tentatives_etape1 || 0,

      // ⭐ v10 — Validation humaine (Décision n°16)
      validation_humaine: visiteur.validation_humaine_action ? {
        action: visiteur.validation_humaine_action,
        motif:  visiteur.validation_humaine_motif,
        date:   visiteur.validation_humaine_date
      } : null,

      // ⭐ v10 — Communication candidat (Décision n°33)
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
// POST /api/retry-missing/:session_id — LEGACY v8, retiré en v9 (Décision D-C : gardé en 410)
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
// ⭐ Phase HTML-Etape11 (v10.6 — 2026-05-07)
//
// Architecture à 2 modes (négociation par Accept header) :
//
//   1. Si Accept inclut "application/json" → renvoie les lignes RESPONSES
//      enrichies par l'agent prompt_etape1, au format { rows: [...] }
//      Le HTML statique visualisateur_etape1.html appelle cette URL en fetch
//      pour récupérer ses données.
//
//   2. Sinon → sert le HTML statique visualisateur_etape1.html (à la racine
//      du repo). Le navigateur reçoit la page, qui ensuite appelle elle-même
//      la route en JSON pour s'auto-alimenter.
//
// Avantage : 1 seule URL côté Airtable (lien_visualiser_etape1), 2 contenus
// servis selon le contexte. Pas besoin de servir des fichiers statiques avec
// express.static — c'est cette route qui s'en charge.
//
// Usage :
//   - Depuis Airtable : clic sur lien_visualiser_etape1 → navigateur → HTML
//   - Le HTML fait fetch sur la même URL avec Accept=application/json
//   - La route détecte → renvoie le JSON
//   - Le HTML construit l'affichage côté client

router.get('/visualiser/etape1/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  const startTime = Date.now();

  // Validation basique
  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h1>⚠ Identifiant candidat invalide</h1>
        <p>Le format attendu est par exemple : <code>pcc_1771077635499_gg1cj7z1q</code></p>
      </body></html>
    `);
  }

  const wantsJson = req.headers.accept && req.headers.accept.includes('application/json');

  // ─── Mode JSON : alimente le HTML qui s'auto-rafraîchit ──────────────────
  if (wantsJson) {
    logger.info('Visualisation Étape 1.1 — mode JSON', { candidat_id, ip: req.ip });
    try {
      const rows = await airtableService.getResponses(candidat_id);
      if (!rows || rows.length === 0) {
        return res.status(404).json({
          error: 'Aucune réponse trouvée pour ce candidat',
          candidat_id
        });
      }
      const elapsed = Date.now() - startTime;
      logger.info('Visualisation Étape 1.1 — JSON renvoyé', {
        candidat_id, count: rows.length, elapsedMs: elapsed
      });
      // Format compatible avec le HTML : { rows: [...] }
      return res.json({ rows });
    } catch (error) {
      logger.error('Visualisation Étape 1.1 — erreur lecture RESPONSES', {
        candidat_id, error: error.message, stack: error.stack
      });
      return res.status(500).json({
        error: error.message,
        candidat_id
      });
    }
  }

  // ─── Mode HTML : sert le fichier statique visualisateur_etape1.html ──────
  logger.info('Visualisation Étape 1.1 — mode HTML', { candidat_id, ip: req.ip });
  try {
    const htmlPath = path.join(__dirname, '..', 'visualisateur_etape1.html');
    const html = fs.readFileSync(htmlPath, 'utf-8');
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(html);
  } catch (error) {
    logger.error('Visualisation Étape 1.1 — erreur lecture HTML', {
      candidat_id, error: error.message
    });
    return res.status(500).type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h1>⚠ Erreur de chargement du visualiseur</h1>
        <p><strong>Erreur :</strong> ${error.message}</p>
        <p style="color:#888;font-size:11px;">Le fichier visualisateur_etape1.html est-il bien à la racine du repo ?</p>
      </body></html>
    `);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/t1/:candidat_id — VISUALISATION HTML T1 INTERNE
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ Phase HTML-1 (v10.2 — 2026-04-29)
// Génère dynamiquement le tableau T1 d'un candidat à partir d'Airtable.
// Visualisation interne uniquement — NON destinée au candidat ni au DRH.
//
// Usage : https://pivar-analysis-system-bis.onrender.com/visualiser/t1/<candidat_id>
// Le lien est disponible directement dans Airtable VISITEUR (champ formule
// `lien_visualiser_t1`).
//
// La page est régénérée à chaque ouverture → toujours à jour avec les
// dernières corrections du vérificateur (Décision n°38).

router.get('/visualiser/t1/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  const startTime = Date.now();

  logger.info('Visualisation T1 demandée', { candidat_id, ip: req.ip });

  // Validation basique du format candidat_id
  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h1>⚠ Identifiant candidat invalide</h1>
        <p>Le format attendu est par exemple : <code>pcc_1771077635499_gg1cj7z1q</code></p>
      </body></html>
    `);
  }

  try {
    const html = await tableauT1HtmlService.generateTableauT1Html(candidat_id);
    const elapsed = Date.now() - startTime;
    logger.info('Visualisation T1 générée', { candidat_id, elapsedMs: elapsed, htmlSize: html.length });

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate'); // toujours frais
    res.send(html);
  } catch (error) {
    logger.error('Erreur génération visualisation T1', { candidat_id, error: error.message, stack: error.stack });
    return res.status(500).type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h1>⚠ Erreur lors de la génération du tableau T1</h1>
        <p><strong>Candidat :</strong> ${candidat_id}</p>
        <p><strong>Erreur :</strong> ${error.message}</p>
        <p style="color:#888;font-size:11px;">Vérifiez que le candidat existe dans Airtable et qu'il a bien une analyse T1 dans ETAPE1_T1.</p>
      </body></html>
    `);
  }
});

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/t2/:candidat_id — VISUALISATION HTML T2 INTERNE ⭐ v10.5
// ═══════════════════════════════════════════════════════════════════════════
//
// ⭐ Phase HTML-T2-1.0.0 (v10.5 — 2026-05-06)
// Génère dynamiquement le tableau T2 (lecture transversale) d'un candidat à
// partir d'Airtable ETAPE1_T2.
// Visualisation interne uniquement — NON destinée au candidat ni au DRH.
//
// Usage : https://pivar-analysis-system-bis.onrender.com/visualiser/t2/<candidat_id>
// Le lien est disponible directement dans Airtable VISITEUR (champ formule
// `lien_visualiser_t2`).
//
// Le tableau affiche :
//   - Bloc synthèse héros : 8 champs identiques sur les 25 lignes (par doctrine
//     v3.4) — hypothese_pilier_dominant_ecart, confiance_socle_par_ecart,
//     pourcentage_concentration_ecart, flag_profil_quasi_conforme,
//     directive_t3, pattern_finalite_pressenti, nb_conformes_total, nb_ecart_total
//   - Signal transversal candidat (texte invariant)
//   - Stat pattern pilier (statistiques mécaniques invariantes)
//   - 25 lignes T2 : ID · Scénario · Demande · Cœur · Conforme/Écart ·
//     Séquence piliers · Analyse (note OU ecart_action) · Signal limbique · Type

router.get('/visualiser/t2/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  const startTime = Date.now();

  logger.info('Visualisation T2 demandée', { candidat_id, ip: req.ip });

  // Validation basique du format candidat_id
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
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate'); // toujours frais
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

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/t3/:candidat_id — VISUALISATION HTML T3 (PRÉPARÉE — DÉSACTIVÉE)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⏳ Préparée pour Phase HTML-T3 — décommenter quand tableauT3HtmlService
//    sera créé dans services/visualisation/.
//
// Pour activer :
//   1. Créer services/visualisation/tableauT3HtmlService.js
//   2. Décommenter le require en haut de ce fichier
//   3. Décommenter le bloc router.get ci-dessous
//   4. Créer dans Airtable VISITEUR un champ formule `lien_visualiser_t3` :
//      IF({candidate_ID}, CONCATENATE("https://pivar-analysis-system-bis.onrender.com/visualiser/t3/", {candidate_ID}), "")

/*
router.get('/visualiser/t3/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  const startTime = Date.now();

  logger.info('Visualisation T3 demandée', { candidat_id, ip: req.ip });

  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h1>⚠ Identifiant candidat invalide</h1>
      </body></html>
    `);
  }

  try {
    const html = await tableauT3HtmlService.generateTableauT3Html(candidat_id);
    const elapsed = Date.now() - startTime;
    logger.info('Visualisation T3 générée', { candidat_id, elapsedMs: elapsed, htmlSize: html.length });

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(html);
  } catch (error) {
    logger.error('Erreur génération visualisation T3', { candidat_id, error: error.message, stack: error.stack });
    return res.status(500).type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h1>⚠ Erreur lors de la génération du tableau T3</h1>
        <p><strong>Candidat :</strong> ${candidat_id}</p>
        <p><strong>Erreur :</strong> ${error.message}</p>
      </body></html>
    `);
  }
});
*/

// ═══════════════════════════════════════════════════════════════════════════
// GET /visualiser/t4/:candidat_id — VISUALISATION HTML T4 (PRÉPARÉE — DÉSACTIVÉE)
// ═══════════════════════════════════════════════════════════════════════════
//
// ⏳ Préparée pour Phase HTML-T4 — décommenter quand tableauT4HtmlService
//    sera créé. T4 est en 6 sous-agents (cf. Décision n°39 — Contrat v1.9
//    section 16) : la page T4 affichera le bilan synthétique des 6 sorties
//    + le résultat du certificateur lexique.
//
// Pour activer : voir procédure T3 ci-dessus.

/*
router.get('/visualiser/t4/:candidat_id', async (req, res) => {
  const candidat_id = req.params.candidat_id;
  const startTime = Date.now();

  logger.info('Visualisation T4 demandée', { candidat_id, ip: req.ip });

  if (!candidat_id || candidat_id.length < 5 || candidat_id.length > 100) {
    return res.status(400).type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h1>⚠ Identifiant candidat invalide</h1>
      </body></html>
    `);
  }

  try {
    const html = await tableauT4HtmlService.generateTableauT4Html(candidat_id);
    const elapsed = Date.now() - startTime;
    logger.info('Visualisation T4 générée', { candidat_id, elapsedMs: elapsed, htmlSize: html.length });

    res.set('Content-Type', 'text/html; charset=utf-8');
    res.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.send(html);
  } catch (error) {
    logger.error('Erreur génération visualisation T4', { candidat_id, error: error.message, stack: error.stack });
    return res.status(500).type('html').send(`
      <html><body style="font-family:sans-serif;padding:40px;text-align:center;">
        <h1>⚠ Erreur lors de la génération du tableau T4</h1>
        <p><strong>Candidat :</strong> ${candidat_id}</p>
        <p><strong>Erreur :</strong> ${error.message}</p>
      </body></html>
    `);
  }
});
*/

module.exports = router;
