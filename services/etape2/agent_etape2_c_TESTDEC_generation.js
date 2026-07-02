// services/etape2/agent_etape2_c_TESTDEC_generation.js
// Agent TESTDEC-GEN — Générateur du test complémentaire de décentration (Étape 2c)
//
// Rôle :
//   - Lit le profil Étape 1 du candidat (socle + modes, structurants, fonctionnels)
//     et le référentiel des 7 modes par pilier.
//   - Appelle new-prompts/etape2/prompt_etape2_c_TESTDEC_generation.md qui construit
//     10 mises en situation sur mesure (personnages calibrés par contraste).
//   - Écrit les 10 lignes dans ETAPE2_TEST_DECENTRATION (delete + create).
//
// Déclenché par l'orchestrateur excellences quand le verdict management sort en
// RÉSERVE DE PROTOCOLE (best effort : un échec ici ne bloque pas le bilan).
// Idempotence : si des RÉPONSES existent déjà (test passé ou en cours), on ne
// régénère PAS — une seule passation par candidat.
//
// Pattern : un service par prompt (aligné sur agentT5A / T5B / T5C).

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const PROMPT_PATH  = 'etape2/prompt_etape2_c_TESTDEC_generation.md';
const SERVICE_NAME = 'agent_testdec_gen';

const CHAMPS_REQUIS = ['numero', 'position_candidat', 'compatibilite', 'personnage',
                       'personnage_profil', 'situation_text', 'question_text', 'amorce'];

async function run({ candidat_id }) {
  logger.info('Agent TESTDEC-GEN — démarrage', { candidat_id });

  // Idempotence : ne jamais écraser un test déjà répondu (une passation).
  const existantes = await airtableService.getTestDecentrationRows(candidat_id);
  const dejaRepondu = (existantes || []).some(r => r.response_text && String(r.response_text).trim() !== '');
  if (dejaRepondu) {
    logger.info('Agent TESTDEC-GEN — réponses déjà présentes, génération sautée', { candidat_id });
    return { generated: false, skipped: 'reponses_existantes', cost: 0 };
  }

  // Entrées : profil Étape 1 + référentiel des modes.
  const profil = await airtableService.getEtape1ProfilPourTest(candidat_id);
  if (!profil || !profil.socle || !profil.socle.pilier) {
    throw new Error(`TESTDEC-GEN : profil Étape 1 introuvable ou sans socle pour ${candidat_id}`);
  }
  const referentiel = await airtableService.getReferentielPiliers();
  if (!referentiel || referentiel.length !== 5) {
    throw new Error(`TESTDEC-GEN : référentiel piliers incomplet (${(referentiel || []).length}/5)`);
  }
  const referentiel_modes = {};
  for (const p of referentiel) referentiel_modes[p.pilier_code] = p.modes_liste || '';

  const { result, cost } = await agentBase.callAgent({
    serviceName: SERVICE_NAME,
    promptPath:  PROMPT_PATH,
    payload: {
      candidat_id,
      prenom:            profil.prenom || '',
      profil_candidat: {
        socle:        profil.socle,
        structurants: profil.structurants,
        fonctionnels: profil.fonctionnels
      },
      referentiel_modes
    },
    candidatId: candidat_id
  });

  const situations = (result && result.situations) || [];
  if (!Array.isArray(situations) || situations.length !== 10) {
    throw new Error(`TESTDEC-GEN : ${Array.isArray(situations) ? situations.length : 0}/10 situations produites`);
  }
  const numeros = new Set();
  for (const s of situations) {
    for (const c of CHAMPS_REQUIS) {
      if (s[c] === undefined || s[c] === null || String(s[c]).trim() === '') {
        throw new Error(`TESTDEC-GEN : champ "${c}" manquant (situation ${s.numero})`);
      }
    }
    numeros.add(Number(s.numero));
  }
  if (numeros.size !== 10) throw new Error('TESTDEC-GEN : numéros de situations non uniques 1-10');

  const nb = await airtableService.writeTestDecentration(candidat_id, situations);
  logger.info('Agent TESTDEC-GEN — terminé', { candidat_id, situations: nb, cost_usd: (cost || 0).toFixed(4) });
  return { generated: true, situations: nb, cost: cost || 0 };
}

module.exports = { run };
