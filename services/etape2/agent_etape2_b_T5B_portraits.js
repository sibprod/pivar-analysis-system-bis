// services/etape2/agentT5B.js
// Agent T5B — Portraits par excellence (Étape 2)
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md
//
// v2.0 (2026-06-09) — UN SOUS-AGENT PAR EXCELLENCE (4 appels parallèles)
//   AVANT : un seul appel produisait les 4 portraits → sortie ~25k caractères →
//   tronquée (stop_reason max_tokens) → JSON invalide → échec.
//   APRÈS : 4 sous-agents, un par excellence (ANT, DEC, MET, VUE), un PROMPT chacun,
//   lancés EN PARALLÈLE (Promise.all). Chaque sous-agent ne produit qu'UN objet T5B
//   (sa ligne) → aucun risque de saturation, et chaque excellence a tout son espace
//   de raisonnement. Chaque ligne est écrite en base dès qu'elle est produite (upsert
//   par excellence — n'écrase pas les autres lignes).
//
//   Le service Claude reste 'agent_t5b' (mêmes max_tokens/thinking pour les 4).
//   Seul le PROMPT change selon l'excellence ciblée.

'use strict';

const agentBase       = require('../infrastructure/agentBase');
const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

const SERVICE_NAME = 'agent_t5b';

// Les 4 sous-agents : code excellence → prompt dédié.
const SOUS_AGENTS = [
  { exc: 'ANT', prompt: 'etape2/prompt_etape2_b_T5B_ANT.md' },
  { exc: 'DEC', prompt: 'etape2/prompt_etape2_b_T5B_DEC.md' },
  { exc: 'MET', prompt: 'etape2/prompt_etape2_b_T5B_MET.md' },
  { exc: 'VUE', prompt: 'etape2/prompt_etape2_b_T5B_VUE.md' }
];

// Dérive le niveau de densité isolé (matching) si l'agent l'omet.
function deriveNiveauDensite(row) {
  if (row.niveau_densite) return row.niveau_densite;
  if (/non évalué/i.test(String(row.niveau_global || ''))) return 'NON ÉVALUÉE';
  const p = String(row.pattern || '').toUpperCase();
  if (p.includes('ABSENTE')) return 'ABSENTE';
  if (p.includes('OBSERVÉE')) return 'FAIBLE';
  if (p.includes('MODÉRÉ')) return 'MOYENNE';
  if (p.includes('PLEIN') || p.includes('RÉGULIÈRE')) {
    return ((row.nb_eleve || 0) + (row.nb_moyen || 0)) >= 14 ? 'DENSE' : 'MOYENNE';
  }
  return 'FAIBLE';
}

function pick(obj, keys) {
  if (!obj) return null;
  for (const k of keys) if (obj[k] !== undefined) return obj[k];
  return null;
}
function val(v) { return (v && (v.name || v)) || ''; }

// Normalise la sortie d'un sous-agent en une ligne T5B prête pour l'upsert.
function toT5BRow(candidat_id, exc, agentOut) {
  const row = pick(agentOut, ['T5B', 't5b']) || agentOut || {};
  const preuves = row.verbatims_preuves;
  const preuvesStr = typeof preuves === 'string' ? preuves : JSON.stringify(preuves || []);
  return {
    candidat_id,
    excellence:          exc,
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
    // ⭐ Registre candidat (garante, 08/07) : le texte lu par le candidat et
    // l'auto-contrôle déclaré — sans ces deux lignes, l'agent les produit
    // et l'écriture les jette (bug corrigé le 08/07).
    texte_candidat:      row.texte_candidat || '',
    controle_redite:     row.controle_redite || '',
    verbatims_preuves:   preuvesStr
  };
}

// Exécute UN sous-agent (une excellence) : appel Claude + écriture immédiate de sa ligne.
async function runSousAgent({ exc, prompt }, candidat_id, lignes, contexte) {
  let out = null, cost = 0;
  for (let attempt = 1; attempt <= 2 && out === null; attempt++) {
    try {
      const res = await agentBase.callAgent({
        serviceName: SERVICE_NAME,
        promptPath:  prompt,
        payload:     { candidat_id, excellence_ciblee: exc, lignes_t5a: lignes,
                       // ⭐ Rédaction candidat (garante, 08/07) — POUR LA RÉDACTION UNIQUEMENT
                       profil_etape1:   (contexte && contexte.profil_etape1)   || {},
                       deja_dit_etape1: (contexte && contexte.deja_dit_etape1) || {} },
        candidatId:  candidat_id
      });
      cost += res.cost || 0;
      out = res.result;
    } catch (e) {
      logger.warn('Agent T5B — sous-agent illisible', { candidat_id, exc, attempt, error: e.message });
    }
  }
  // Ne JAMAIS jeter : on renvoie un statut. Un échec sur une excellence ne doit pas
  // faire tomber les 3 autres (sinon cascade ERREUR alors que 3/4 ont réussi).
  if (!out) {
    logger.warn('Agent T5B — sous-agent sans sortie exploitable', { candidat_id, exc });
    return { exc, ok: false, cost };
  }

  try {
    const row = toT5BRow(candidat_id, exc, out);
    // Écriture au fil de l'eau : upsert de CETTE ligne (par excellence, n'écrase pas les autres).
    await airtableService.upsertEtape2T5B(candidat_id, [row]);
    logger.info('Agent T5B — excellence écrite', { candidat_id, exc, niveau: row.niveau_global, cost_usd: cost.toFixed(4) });
    return { exc, ok: true, cost };
  } catch (e) {
    logger.warn('Agent T5B — écriture excellence échouée', { candidat_id, exc, error: e.message });
    return { exc, ok: false, cost };
  }
}

/**
 * Exécute l'agent T5B (4 sous-agents en parallèle).
 * @param {Object} params
 * @param {string} params.candidat_id
 * @returns {Promise<{ t5b: number, cost: number }>}
 */
async function run({ candidat_id }) {
  logger.info('Agent T5B — démarrage (4 sous-agents par excellence)', { candidat_id });

  const t5aRows = await airtableService.getEtape2T5ARows(candidat_id);
  if (!t5aRows || t5aRows.length === 0) {
    throw new Error(`Agent T5B : aucune ligne T5A pour ${candidat_id}`);
  }

  // Projection commune transmise aux 4 sous-agents (les 25 réponses codées).
  const lignes = t5aRows.map(r => ({
    id_question: r.id_question || '',
    scenario:    (r.scenario_nom && (r.scenario_nom.name || r.scenario_nom)) || r.scenario || '',
    numero:      r.numero_global || null,
    ANT: { niveau: val(r.anticipation_niveau),  verbatim: r.anticipation_verbatim || '',  manifestation: r.anticipation_manifestation || '' },
    DEC: { niveau: val(r.decentration_niveau),  verbatim: r.decentration_verbatim || '',  manifestation: r.decentration_manifestation || '' },
    MET: { niveau: val(r.metacognition_niveau), verbatim: r.metacognition_verbatim || '', manifestation: r.metacognition_manifestation || '' },
    VUE: { niveau: val(r.vue_systemique_niveau),verbatim: r.vue_systemique_verbatim || '',manifestation: r.vue_systemique_manifestation || '' }
  }));

  // Les 4 sous-agents tournent EN PARALLÈLE, chacun son prompt, chacun écrit sa ligne.
  // allSettled : un échec isolé ne fait pas tomber les autres.
  // ⭐ Contexte de rédaction (garante, 08/07) : le moteur (modes Étape 1) et le
  // déjà-dit (textes du bilan lus par le candidat) — rédaction seule, jamais codage.
  const contexte = await airtableService.getDejaDitEtape1(candidat_id).catch(() => ({}));

  const settled = await Promise.allSettled(
    SOUS_AGENTS.map(sa => runSousAgent(sa, candidat_id, lignes, contexte))
  );

  const resultats = settled.map(s => s.status === 'fulfilled' ? s.value : { ok: false, cost: 0 });
  const reussies = resultats.filter(r => r.ok).map(r => r.exc);
  const echecs   = resultats.filter(r => !r.ok).map(r => r.exc).filter(Boolean);
  const totalCost = resultats.reduce((s, r) => s + (r.cost || 0), 0);

  // On n'échoue QUE si aucune excellence n'a pu être produite. Sinon on garde l'acquis.
  if (reussies.length === 0) {
    throw new Error('Agent T5B : aucune excellence produite (toutes en échec)');
  }
  if (echecs.length > 0) {
    logger.warn('Agent T5B — excellences en échec (à relancer en ETAPE2_AGENT_B)', { candidat_id, echecs, reussies });
  }
  logger.info('Agent T5B — terminé', {
    candidat_id, t5b: reussies.length, echecs: echecs.length, cost_usd: totalCost.toFixed(4)
  });
  return { t5b: reussies.length, echecs, cost: totalCost };
}

module.exports = { run };
