// services/agents/etape2/agentT5BC.js
// Agent T5BC — Synthèse des excellences + verdicts des deux faces (Étape 2)
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// Rôle :
//   - Lit les 25 lignes T5A déjà codées (les 4 excellences par réponse).
//   - Appelle le prompt new-prompts/etape2/AGENT_T5BC_prompt.md qui agrège et produit :
//       • T5B : 4 lignes (1 par excellence) avec comptages, régime, densités,
//               synthèse, réserve ET verbatims_preuves (geste prouvé, brut).
//       • T5C : 1 ligne (profil, ordre, portrait, combinaison, verdicts des deux
//               faces, conditions, montée, réserves).
//   - Écrit T5B (upsert sur excellence) et T5C (upsert sur candidat).
//
// Robustesse : si l'agent omet un champ de matching dérivable (niveau_densite,
// verdict_enc_niveau, verdict_man_niveau), on le dérive ici des libellés produits.

'use strict';

const agentBase       = require('../../infrastructure/agentBase');
const airtableService = require('../../infrastructure/airtableService');
const logger          = require('../../../utils/logger');

const PROMPT_PATH  = 'etape2/AGENT_T5BC_prompt.md';
const SERVICE_NAME = 'agent_t5bc';

const VERDICTS = ['TRÈS BON', 'BON', 'SUFFISANT', 'RÉSERVE DE PROTOCOLE', 'DÉFAVORABLE'];

// Dérive le niveau de densité isolé (matching) depuis niveau_global / pattern.
function deriveNiveauDensite(t5bRow) {
  if (t5bRow.niveau_densite) return t5bRow.niveau_densite;
  const pattern = String(t5bRow.pattern || '').toUpperCase();
  if (pattern.includes('ABSENTE')) return 'ABSENTE';
  if (pattern.includes('OBSERVÉE')) return 'FAIBLE';
  if (pattern.includes('MODÉRÉ')) return 'MOYENNE';
  if (pattern.includes('PLEIN') || pattern.includes('RÉGULIÈRE')) {
    // affiner par le compte d'activations si disponible
    const act = (t5bRow.nb_eleve || 0) + (t5bRow.nb_moyen || 0);
    return act >= 14 ? 'DENSE' : 'MOYENNE';
  }
  return 'FAIBLE';
}

// Extrait la valeur de verdict isolée depuis un libellé complet (« ✅ TRÈS BON — … »).
function deriveVerdictNiveau(libelleOuNiveau) {
  const v = String(libelleOuNiveau || '').toUpperCase();
  for (const k of VERDICTS) { if (v.includes(k)) return k; }
  return '';
}

/**
 * Exécute l'agent T5BC pour un candidat.
 * @param {Object} params
 * @param {string} params.candidat_id - session_id du candidat
 * @returns {Promise<{ t5b: number, t5c: boolean, cost: number }>}
 */
async function run({ candidat_id }) {
  logger.info('Agent T5BC — démarrage', { candidat_id });

  // Entrée : les 25 lignes T5A codées (niveaux + verbatims des 4 excellences).
  const t5aRows = await airtableService.getEtape2T5ARows(candidat_id);
  if (!t5aRows || t5aRows.length === 0) {
    throw new Error(`Agent T5BC : aucune ligne T5A pour ${candidat_id}`);
  }

  // On projette uniquement les champs utiles à l'agrégation (réduit le payload).
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

  // L'agent renvoie { T5B: [...], T5C: {...}, PORTRAIT: {...} } (ou variantes de casse).
  const t5bArr = pick(result, ['T5B', 't5b', 'T5B_rows']) || [];
  const t5c    = pick(result, ['T5C', 't5c', 'profil']) || {};

  if (!Array.isArray(t5bArr) || t5bArr.length === 0) {
    throw new Error('Agent T5BC : sortie T5B absente ou vide');
  }

  // ─── Préparer les 4 lignes T5B (avec verbatims_preuves + niveau_densite) ──
  const t5bRows = t5bArr.map(row => {
    const preuves = row.verbatims_preuves;
    const preuvesStr = typeof preuves === 'string' ? preuves : JSON.stringify(preuves || []);
    return {
      candidat_id,
      excellence:        String(row.excellence || '').toUpperCase(),
      niveau_global:     row.niveau_global || '',
      pattern:           row.pattern || '',
      niveau_densite:    deriveNiveauDensite(row),
      nb_eleve:          row.nb_eleve || 0,
      nb_moyen:          row.nb_moyen || 0,
      nb_faible:         row.nb_faible || 0,
      nb_nulle:          row.nb_nulle || 0,
      densite_sommeil:   row.densite_sommeil || '',
      densite_weekend:   row.densite_weekend || '',
      densite_animal:    row.densite_animal || '',
      densite_panne:     row.densite_panne || '',
      declencheur:       row.declencheur || '',
      gradient:          row.gradient || '',
      synthese:          row.synthese || '',
      reserve:           row.reserve || '',
      verbatims_preuves: preuvesStr
    };
  });

  const t5bCount = await airtableService.upsertEtape2T5B(candidat_id, t5bRows);

  // ─── Préparer la ligne T5C (verdicts + champs rédigés + matching) ─────────
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

  logger.info('Agent T5BC — terminé', {
    candidat_id, t5b: t5bCount, t5c: t5cOk, cost_usd: (cost || 0).toFixed(4)
  });
  return { t5b: t5bCount, t5c: t5cOk, cost: cost || 0 };
}

// ── helpers ──────────────────────────────────────────────────────────────
function val(v) { return (v && (v.name || v)) || ''; }
function pick(obj, keys) {
  if (!obj) return null;
  for (const k of keys) { if (obj[k] !== undefined) return obj[k]; }
  return null;
}

module.exports = { run };
