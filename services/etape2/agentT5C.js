// services/etape2/agentT5C.js
// Agent T5C — Profil global + verdicts des deux faces du métier (Étape 2)
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Rôle :
//   - Lit les 4 lignes T5B déjà produites en base (comptages, régimes, densités,
//     synthèses, réserves par excellence).
//   - Appelle le prompt new-prompts/etape2/AGENT_T5C_prompt.md qui en déduit le profil
//     global + les verdicts des deux faces (« Faire avancer le travail » /
//     « Révéler le potentiel de chacun »).
//   - Écrit T5C (upsert sur candidat).
//
// Pattern : un service par prompt (aligné sur agentT5A / agentT5B …).
// Pré-requis : T5B doit avoir été produit (agent B) avant d'appeler cet agent.
//
// Robustesse : si l'agent omet un verdict_*_niveau (dérivable), on le dérive ici.

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const PROMPT_PATH  = 'etape2/AGENT_T5C_prompt.md';
const SERVICE_NAME = 'agent_t5c';

const VERDICTS = ['TRÈS BON', 'BON', 'SUFFISANT', 'RÉSERVE DE PROTOCOLE', 'DÉFAVORABLE'];

// Extrait la valeur de verdict isolée depuis un libellé complet (« ✅ TRÈS BON — … »).
function deriveVerdictNiveau(libelleOuNiveau) {
  const v = String(libelleOuNiveau || '').toUpperCase();
  for (const k of VERDICTS) { if (v.includes(k)) return k; }
  return '';
}

/**
 * Exécute l'agent T5C pour un candidat.
 * @param {Object} params
 * @param {string} params.candidat_id - session_id du candidat
 * @returns {Promise<{ t5c: boolean, cost: number }>}
 */
async function run({ candidat_id }) {
  logger.info('Agent T5C — démarrage', { candidat_id });

  // Entrée : les 4 lignes T5B déjà produites en base.
  const t5bRowsRaw = await airtableService.getEtape2T5BRows(candidat_id);
  if (!t5bRowsRaw || t5bRowsRaw.length === 0) {
    throw new Error(`Agent T5C : aucune ligne T5B pour ${candidat_id} (lancer l'agent B d'abord)`);
  }

  // Vue compacte transmise à l'agent (comptages / régimes / densités / synthèses).
  // On ne transmet pas les portraits longs ni les verbatims_preuves : T5C raisonne
  // sur les agrégats, pas sur le détail rédactionnel.
  const lignes_t5b = t5bRowsRaw.map(r => ({
    excellence:      val(r.excellence),
    niveau_global:   r.niveau_global || '',
    pattern:         r.pattern || '',
    niveau_densite:  val(r.niveau_densite),
    nb_eleve:        r.nb_eleve || 0,
    nb_moyen:        r.nb_moyen || 0,
    nb_faible:       r.nb_faible || 0,
    nb_nulle:        r.nb_nulle || 0,
    densite_sommeil: r.densite_sommeil || '',
    densite_weekend: r.densite_weekend || '',
    densite_animal:  r.densite_animal || '',
    densite_panne:   r.densite_panne || '',
    declencheur:     r.declencheur || '',
    synthese:        r.synthese || '',
    reserve:         r.reserve || ''
  }));

  const { result, cost } = await agentBase.callAgent({
    serviceName: SERVICE_NAME,
    promptPath:  PROMPT_PATH,
    payload:     { candidat_id, lignes_t5b },
    candidatId:  candidat_id
  });

  const t5c = pick(result, ['T5C', 't5c', 'profil']) || {};

  const t5cFields = {
    candidat_id,
    profil_dominant:        t5c.profil_dominant || '',
    portrait_un_mot:        t5c.portrait_un_mot || '',
    combinaison:            t5c.combinaison || '',
    ordre_excellences:      t5c.ordre_excellences || '',
    ANT_densite:            t5c.ANT_densite || '',
    DEC_densite:            t5c.DEC_densite || '',
    MET_densite:            t5c.MET_densite || '',
    VUE_densite:            t5c.VUE_densite || '',
    verdict_encadrement:    t5c.verdict_encadrement || '',
    verdict_management:     t5c.verdict_management || '',
    verdict_enc_niveau:     t5c.verdict_enc_niveau || deriveVerdictNiveau(t5c.verdict_encadrement),
    verdict_man_niveau:     t5c.verdict_man_niveau || deriveVerdictNiveau(t5c.verdict_management),
    B4_conclusions_enc:     t5c.B4_conclusions_enc || '',
    B4_conclusions_man:     t5c.B4_conclusions_man || '',
    conditions_encadrement: t5c.conditions_encadrement || '',
    conditions_management:  t5c.conditions_management || '',
    montee_autre_face:      t5c.montee_autre_face || '',
    reserves_globales:      t5c.reserves_globales || ''
  };

  const t5cOk = await airtableService.upsertEtape2T5C(candidat_id, t5cFields);

  logger.info('Agent T5C — terminé', {
    candidat_id, t5c: t5cOk, cost_usd: (cost || 0).toFixed(4)
  });
  return { t5c: t5cOk, cost: cost || 0 };
}

// ── helpers ──────────────────────────────────────────────────────────────
function val(v) { return (v && (v.name || v)) || ''; }
function pick(obj, keys) {
  if (!obj) return null;
  for (const k of keys) { if (obj[k] !== undefined) return obj[k]; }
  return null;
}

module.exports = { run };
