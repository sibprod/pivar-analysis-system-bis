// services/etape2/agentT5B.js
// Agent T5B — Portrait par excellence (Étape 2)
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Rôle :
//   - Lit les 25 lignes T5A déjà codées (les 4 excellences par réponse).
//   - Appelle le prompt new-prompts/etape2/AGENT_T5B_prompt.md qui agrège et produit
//     les 4 lignes T5B (1 par excellence) : comptages, régime, densités, synthèse,
//     réserve, portrait_excellence (deux niveaux) ET verbatims_preuves.
//   - Écrit T5B (upsert sur excellence).
//
// Pattern : un service par prompt (aligné sur agentT5A / agent_t1 …).
// Découpé de l'ancien agentT5BC (un seul appel saturait max_tokens) : T5B et T5C
// sont désormais deux services distincts, chacun son prompt, chacun son quota.
//
// Robustesse : si l'agent omet niveau_densite (dérivable), on le dérive ici.

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const PROMPT_PATH  = 'etape2/AGENT_T5B_prompt.md';
const SERVICE_NAME = 'agent_t5b';

// Dérive le niveau de densité isolé (matching) depuis niveau_global / pattern.
function deriveNiveauDensite(t5bRow) {
  if (t5bRow.niveau_densite) return t5bRow.niveau_densite;
  // Décentration non concluante (tranche 0-5) : niveau_global porte le texte dédié.
  if (/non évalué/i.test(String(t5bRow.niveau_global || ''))) return 'NON ÉVALUÉE';
  const pattern = String(t5bRow.pattern || '').toUpperCase();
  if (pattern.includes('ABSENTE')) return 'ABSENTE';
  if (pattern.includes('OBSERVÉE')) return 'FAIBLE';
  if (pattern.includes('MODÉRÉ')) return 'MOYENNE';
  if (pattern.includes('PLEIN') || pattern.includes('RÉGULIÈRE')) {
    const act = (t5bRow.nb_eleve || 0) + (t5bRow.nb_moyen || 0);
    return act >= 14 ? 'DENSE' : 'MOYENNE';
  }
  return 'FAIBLE';
}

/**
 * Exécute l'agent T5B pour un candidat.
 * @param {Object} params
 * @param {string} params.candidat_id - session_id du candidat
 * @returns {Promise<{ t5b: number, cost: number }>}
 */
async function run({ candidat_id }) {
  logger.info('Agent T5B — démarrage', { candidat_id });

  // Entrée : les 25 lignes T5A codées (niveaux + verbatims des 4 excellences).
  const t5aRows = await airtableService.getEtape2T5ARows(candidat_id);
  if (!t5aRows || t5aRows.length === 0) {
    throw new Error(`Agent T5B : aucune ligne T5A pour ${candidat_id}`);
  }

  // Projection réduite des champs utiles à l'agrégation.
  const lignes = t5aRows.map(r => ({
    id_question: r.id_question || '',
    scenario:    (r.scenario_nom && (r.scenario_nom.name || r.scenario_nom)) || r.scenario || '',
    numero:      r.numero_global || null,
    ANT: { niveau: val(r.anticipation_niveau),  verbatim: r.anticipation_verbatim || '',  manifestation: r.anticipation_manifestation || '' },
    DEC: { niveau: val(r.decentration_niveau),  verbatim: r.decentration_verbatim || '',  manifestation: r.decentration_manifestation || '' },
    MET: { niveau: val(r.metacognition_niveau), verbatim: r.metacognition_verbatim || '', manifestation: r.metacognition_manifestation || '' },
    VUE: { niveau: val(r.vue_systemique_niveau),verbatim: r.vue_systemique_verbatim || '',manifestation: r.vue_systemique_manifestation || '' }
  }));

  const { result, cost } = await agentBase.callAgent({
    serviceName: SERVICE_NAME,
    promptPath:  PROMPT_PATH,
    payload:     { candidat_id, lignes_t5a: lignes },
    candidatId:  candidat_id
  });

  const t5bArr = pick(result, ['T5B', 't5b', 'T5B_rows']) || [];
  if (!Array.isArray(t5bArr) || t5bArr.length === 0) {
    throw new Error('Agent T5B : sortie T5B absente ou vide');
  }

  const t5bRows = t5bArr.map(row => {
    const preuves = row.verbatims_preuves;
    const preuvesStr = typeof preuves === 'string' ? preuves : JSON.stringify(preuves || []);
    return {
      candidat_id,
      excellence:          String(row.excellence || '').toUpperCase(),
      niveau_global:       row.niveau_global || '',
      pattern:             row.pattern || '',
      niveau_densite:      deriveNiveauDensite(row),
      nb_eleve:            row.nb_eleve || 0,
      nb_moyen:            row.nb_moyen || 0,
      nb_faible:           row.nb_faible || 0,
      nb_nulle:            row.nb_nulle || 0,
      densite_sommeil:     row.densite_sommeil || '',
      densite_weekend:     row.densite_weekend || '',
      densite_animal:      row.densite_animal || '',
      densite_panne:       row.densite_panne || '',
      declencheur:         row.declencheur || '',
      gradient:            row.gradient || '',
      synthese:            row.synthese || '',
      reserve:             row.reserve || '',
      portrait_excellence: row.portrait_excellence || '',
      verbatims_preuves:   preuvesStr
    };
  });

  const t5bCount = await airtableService.upsertEtape2T5B(candidat_id, t5bRows);

  logger.info('Agent T5B — terminé', {
    candidat_id, t5b: t5bCount, cost_usd: (cost || 0).toFixed(4)
  });
  return { t5b: t5bCount, cost: cost || 0 };
}

// ── helpers ──────────────────────────────────────────────────────────────
function val(v) { return (v && (v.name || v)) || ''; }
function pick(obj, keys) {
  if (!obj) return null;
  for (const k of keys) { if (obj[k] !== undefined) return obj[k]; }
  return null;
}

module.exports = { run };
