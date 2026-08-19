// services/bilan-candidat/// services/bilan-candidat/service_bilan_payload.js
// TRANSPORT PUR — payload du bilan présenté au candidat.
//
// Sources (fonctions du service maison, aucune autre) :
//   getEtape1T3Bilan     → signature, filtre et ses preuves, clôture
//   getEtape1T3Piliers   → rôle, mode, synthèse de chaque outil
//   getEtape1T3Circuits  → UN ENREGISTREMENT PAR GESTE : narration, verbatims, renfort
//   MODE_RAPIDE (API)    → formulations parlées + leur verbatim d'ancrage (facultatif)
//
// Doctrine : liste nommée de champs, jamais « tout sauf ».
// N'entrent JAMAIS : nom du référentiel, niveaux, régimes, comptages,
// champs _technique et _rattachement. Ce qui n'est pas ici est inatteignable.

'use strict';

const crypto = require('crypto');

const RANG_ROLE = { socle: 0, amont: 1, aval: 2, fonctionnel: 3 };

function normaliseRole(r) {
  const v = String(r || '').toLowerCase();
  if (v.includes('socle')) return 'socle';
  if (v.includes('amont')) return 'amont';
  if (v.includes('aval'))  return 'aval';
  return 'fonctionnel';
}

/* LE bloc de fréquence est le champ « bloc » de ETAPE1_T2_CIRCUITS_POURBILAN :
   il vaut littéralement « très souvent » · « souvent » · « occasionnels ».
   C'est la colonne « Bloc » des tableaux du bilan. Aucun seuil n'est calculé ici,
   aucun niveau HAUT/MOYEN n'est lu : le classement est déjà fait, on le respecte. */
const estTresSouvent = ligne => String(ligne.bloc ?? '').toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim() === 'tres souvent';

async function construirePayload(candidat_id, airtableService) {
  const bilan = await airtableService.getEtape1T3Bilan(candidat_id);
  if (!bilan) throw new Error(`Aucun bilan T3 pour ${candidat_id}`);

  const piliers  = await airtableService.getEtape1T3Piliers(candidat_id)  || [];
  // Deux sources, jointes sur le code : POURBILAN dit LESQUELS, T3_CIRCUIT dit QUOI.
  const pourbilan = await airtableService.getEtape1T2CircuitsPourbilan(candidat_id) || [];
  const matiere   = await airtableService.getEtape1T3Circuits(candidat_id) || [];

  // Sélection : le bloc « très souvent », tel qu'attribué par l'analyse
  const codesRetenus = pourbilan.filter(estTresSouvent).map(l => String(l.circuit_code));

  // Index de la matière par code complet (P4 + C15 → P4C15)
  const parCode = new Map(matiere.map(g => [`${g.pilier}${g.circuit_id}`, g]));
  const gestesRetenus = codesRetenus.map(code => ({ code, m: parCode.get(code) })).filter(x => x.m);

  // Aucun geste retenu = matière absente : on échoue ici, jamais côté agent.
  if (!gestesRetenus.length) {
    throw new Error(`Aucun geste « très souvent » pour ${candidat_id} — ` +
      `${pourbilan.length} ligne(s) POURBILAN, blocs : ${[...new Set(pourbilan.map(l => l.bloc || '?'))].join(', ')} · ` +
      `${matiere.length} geste(s) en matière`);
  }

  const outils = piliers.map(p => {
    const role = normaliseRole(p.role_pilier || p.pilier_role_label);
    const gestes = gestesRetenus
      .filter(x => String(x.m.pilier) === String(p.pilier))
      .sort((a, b) => (a.m.ordre_circuit || 0) - (b.m.ordre_circuit || 0))
      .map(({ code, m }) => ({
        code,                                        // P4C15 — clé interne, jamais affichée
        narration: m.n1_definition || '',            // le texte rédigé pour le candidat
        resume:    m.explication_courte_ch4 || '',   // la phrase courte du protocole
        renfort:   m.en_renfort || '',
        verbatims: [
          { texte: m.verbatim_1, recit: m.verbatim_1_ref },
          { texte: m.verbatim_2, recit: m.verbatim_2_ref },
          { texte: m.verbatim_3, recit: m.verbatim_3_ref },
          { texte: m.verbatim_4, recit: m.verbatim_4_ref }
        ].filter(v => v.texte)
      }));

    return {
      pilier_code:      p.pilier,
      pilier_libelle:   p.pilier_label,             // substitué AU RENDU (lexique)
      role,
      role_clair:       p.pilier_role_label || '',
      mode_libelle:     p.pilier_mode || '',
      mode_explication: p.mode_explication || '',
      synthese:         p.synth_interpretee || p.synth_courte || '',
      gestes
    };
  }).sort((a, b) => (RANG_ROLE[a.role] ?? 9) - (RANG_ROLE[b.role] ?? 9));

  const payload = {
    candidat_id,
    civilite:          bilan.civilite || '',
    nom:               bilan.nom || '',
    prenom:            bilan.prenom || '',
    socle_code:        bilan.pilier_socle || '',
    socle_libelle:     bilan.pilier_socle_label || '',
    filtre:            bilan.filtre_label || '',
    filtre_preuves:    [bilan.filtre_preuve_1, bilan.filtre_preuve_2, bilan.filtre_preuve_3,
                        bilan.filtre_preuve_4, bilan.filtre_preuve_5].filter(Boolean),
    filtre_revelation: bilan.filtre_lecture_candidat || '',
    outils,
    cout_intro:        bilan.cout_intro || '',
    cout_constat:      bilan.cout_constat || '',
    affects_intro:     bilan.limbique_intro || '',
    affects_registres: bilan.limbique_registres || '',
    affects_synthese:  bilan.limbique_synthese || '',
    signature_ligne:   bilan.note_profil_global || ''
  };

  payload._empreinte = empreinte(payload);
  return payload;
}

/**
 * Formulations parlées du MODE RAPIDE, avec leur verbatim d'ancrage.
 * Matière produite SANS le référentiel : langue naturelle, mais aucune hiérarchie.
 * C'est le bilan complet qui dit lesquelles publier — d'où le recoupement par verbatim.
 * Facultatif : si le mode rapide n'a pas tourné, la liste est vide et l'agent rédige tout.
 */
async function lireFormulationsModeRapide(candidat_id) {
  const BASE  = process.env.AIRTABLE_BASE_ID;
  const KEY   = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const TABLE = 'tbltOcRoreIYx0LT2';   // MODE_RAPIDE
  if (!BASE || !KEY) return [];

  try {
    const formule = encodeURIComponent(`{candidat_id}="${String(candidat_id).replace(/"/g, '')}"`);
    const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}?filterByFormula=${formule}&maxRecords=1`,
      { headers: { Authorization: `Bearer ${KEY}` } });
    if (!r.ok) return [];
    const data = await r.json();
    const ligne = data.records && data.records[0] && data.records[0].fields;
    if (!ligne) return [];

    const brut = ligne.gestes_probants_json || ligne.gestes_probants || '[]';
    const liste = typeof brut === 'string' ? JSON.parse(brut) : brut;
    return (Array.isArray(liste) ? liste : [])
      .map(g => ({ formulation: g.nom || g.formulation || '', ancrage: g.verbatim || g.ancrage || '' }))
      .filter(f => f.formulation && f.ancrage);
  } catch {
    return [];   // jamais bloquant : le bilan ne dépend pas de l'autre chaîne
  }
}

function empreinte(objet) {
  const { _empreinte, ...reste } = objet;
  return crypto.createHash('sha256').update(JSON.stringify(reste)).digest('hex');
}

module.exports = { construirePayload, lireFormulationsModeRapide, empreinte, normaliseRole };
