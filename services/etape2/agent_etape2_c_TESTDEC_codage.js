// services/etape2/agent_etape2_c_TESTDEC_codage.js
// Agent TESTDEC-COD — Codeur du test complémentaire de décentration (Étape 2c)
//
// Rôle :
//   - Lit les 10 situations + réponses du candidat (ETAPE2_TEST_DECENTRATION)
//     et son profil Étape 1 (pour la détection de projection).
//   - Appelle new-prompts/etape2/prompt_etape2_c_TESTDEC_codage.md : codage des
//     10 réponses (grille de l'ancrage, étalon DEC copie conforme T5A v4.1) +
//     recalcul de la ligne DEC (tranches sur 10 validées par la garante).
//   - Écrit les codages dans la table du test + upsert de la ligne T5B DEC
//     (la mesure du test REMPLACE l'évaluation manquante — régime : CONSTAT).
//
// Garde-fou : refuse de coder si les 10 réponses ne sont pas toutes présentes.
// Après cet agent, l'orchestrateur relance l'agent C (verdicts recalculés).

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const PROMPT_PATH  = 'etape2/prompt_etape2_c_TESTDEC_codage.md';
const SERVICE_NAME = 'agent_testdec_cod';

const NIVEAUX = ['ÉLEVÉ', 'MOYEN', 'FAIBLE', 'NULLE'];

async function run({ candidat_id }) {
  logger.info('Agent TESTDEC-COD — démarrage', { candidat_id });

  const rows = await airtableService.getTestDecentrationRows(candidat_id);
  if (!rows || rows.length !== 10) {
    throw new Error(`TESTDEC-COD : ${(rows || []).length}/10 situations en base pour ${candidat_id}`);
  }
  const manquantes = rows.filter(r => !r.response_text || String(r.response_text).trim() === '')
                         .map(r => r.numero);
  if (manquantes.length > 0) {
    throw new Error(`TESTDEC-COD : réponses manquantes pour les situations ${manquantes.join(', ')}`);
  }

  const profil = await airtableService.getEtape1ProfilPourTest(candidat_id);
  const circuits_candidat = await airtableService.getCircuitsTopPourTest(candidat_id).catch(() => []);

  const situations = rows
    .sort((a, b) => (a.numero || 0) - (b.numero || 0))
    .map(r => ({
      numero:            r.numero,
      position_candidat: r.position_candidat || '',
      compatibilite:     r.compatibilite || '',
      personnage:        r.personnage || '',
      personnage_profil: r.personnage_profil || '',
      situation_text:    r.situation_text || '',
      question_text:     r.question_text || '',
      response_text:     r.response_text || ''
    }));

  const { result, cost } = await agentBase.callAgent({
    serviceName: SERVICE_NAME,
    promptPath:  PROMPT_PATH,
    payload: {
      candidat_id,
      prenom:          (profil && profil.prenom) || '',
      profil_candidat: profil ? { socle: profil.socle, structurants: profil.structurants, fonctionnels: profil.fonctionnels } : {},
      circuits_candidat,
      situations
    },
    candidatId: candidat_id
  });

  // ── Validation des codages ────────────────────────────────────────────────
  const codages = (result && result.codages) || [];
  if (!Array.isArray(codages) || codages.length !== 10) {
    throw new Error(`TESTDEC-COD : ${Array.isArray(codages) ? codages.length : 0}/10 codages produits`);
  }
  const compt = { 'ÉLEVÉ': 0, 'MOYEN': 0, 'FAIBLE': 0, 'NULLE': 0 };
  for (const c of codages) {
    const niveau = String(c.DEC_niveau || '').toUpperCase().trim();
    if (!NIVEAUX.includes(niveau)) throw new Error(`TESTDEC-COD : niveau invalide "${c.DEC_niveau}" (situation ${c.numero})`);
    compt[niveau]++;
  }

  // ── Synthèse du test : SECONDE mesure, séparée — la ligne T5B initiale
  //    (fenêtre principale) n'est JAMAIS modifiée (garante, 03/07).
  const ligne = (result && result.ligne_DEC) || {};
  const A = compt['ÉLEVÉ'] + compt['MOYEN'];
  const synthese = {
    candidat_id,
    A_sur_10:        A,
    niveau_global:   `${A}/10 (${A * 10}%) — mesuré par le test complémentaire de décentration`,
    pattern:         derivePattern(A),
    niveau_densite:  A <= 2 ? 'FAIBLE' : (A <= 5 ? 'MOYENNE' : 'DENSE'),
    nb_eleve:  compt['ÉLEVÉ'],
    nb_moyen:  compt['MOYEN'],
    nb_faible: compt['FAIBLE'],
    nb_nulle:  compt['NULLE'],
    synthese:            ligne.synthese || '',
    portrait_excellence: ligne.portrait_excellence || '',
    declencheur:         ligne.declencheur || '',
    gradient:            ligne.gradient || '',
    reserve:             ligne.reserve || '',
    verbatims_preuves:   Array.isArray(ligne.verbatims_preuves)
                           ? JSON.stringify(ligne.verbatims_preuves)
                           : (ligne.verbatims_preuves || ''),
    date_codage: new Date().toISOString()
  };

  await airtableService.patchTestDecentrationCodage(candidat_id, codages);
  await airtableService.writeTestDecSynthese(candidat_id, synthese);

  logger.info('Agent TESTDEC-COD — terminé', {
    candidat_id, activations: `${A}/10`,
    repartition: `E${compt['ÉLEVÉ']}/M${compt['MOYEN']}/F${compt['FAIBLE']}/N${compt['NULLE']}`,
    cost_usd: (cost || 0).toFixed(4)
  });
  return { coded: true, activations: A, cost: cost || 0 };
}

function derivePattern(A) {
  if (A === 0) return 'ABSENTE';
  if (A <= 2)  return 'OBSERVÉE';
  if (A <= 5)  return 'ANCRÉE EN RÉGIME MODÉRÉ';
  if (A <= 8)  return 'RÉGULIÈRE ET ANCRÉE';
  return 'PLEIN RÉGIME';
}

module.exports = { run };
