// services/bilan-candidat/service_bilan_payload.js
// TRANSPORT PUR — construit le payload du bilan présenté au candidat.
//
// Utilise EXCLUSIVEMENT les fonctions de airtableService :
//   getEtape1T3Bilan · getEtape1T3Piliers · getEtape1T2CircuitsPourbilan
//
// Doctrine : liste nommée de champs, jamais « tout sauf ».
// Les champs techniques (_technique, _rattachement, synth_factuelle, comptages)
// n'entrent JAMAIS dans le payload : ce qui n'y est pas est inatteignable.

'use strict';

const crypto = require('crypto');

/* Ordre propre du candidat : socle, amont, aval, fonctionnels — jamais P1→P5 */
const RANG_ROLE = { socle: 0, amont: 1, aval: 2, fonctionnel: 3 };

function normaliseRole(r) {
  const v = String(r || '').toLowerCase();
  if (v.includes('socle')) return 'socle';
  if (v.includes('amont')) return 'amont';
  if (v.includes('aval'))  return 'aval';
  return 'fonctionnel';
}

/**
 * @param {string} candidat_id
 * @param {Object} airtableService — le service maison
 */
async function construirePayload(candidat_id, airtableService) {
  const bilan = await airtableService.getEtape1T3Bilan(candidat_id);
  if (!bilan) throw new Error(`Aucun bilan T3 pour ${candidat_id}`);

  const piliers  = await airtableService.getEtape1T3Piliers(candidat_id) || [];
  const circuits = await airtableService.getEtape1T2CircuitsPourbilan(candidat_id) || [];

  // Sélection par la fréquence écrite en clair — aucun seuil manipulé
  const gestesRetenus = circuits.filter(c =>
    String(c.frequence || c.bloc_final || '').toLowerCase().trim().includes('très souvent'));

  const outils = piliers.map(p => {
    const role = normaliseRole(p.role_pilier || p.pilier_role_label);
    return {
      pilier_code:      p.pilier,
      pilier_libelle:   p.pilier_label,              // substitué AU RENDU (lexique)
      role,
      role_clair:       p.pilier_role_label || '',
      mode_libelle:     p.pilier_mode || '',
      mode_explication: p.mode_explication || '',
      synthese:         p.synth_interpretee || p.synth_courte || '',
      // la narration des gestes, rédigée pour le candidat
      gestes: {
        texte_integral: p.bloc_tres_souvent_candidat || '',
        codes_retenus:  gestesRetenus
                          .filter(c => String(c.pilier || c.pilier_code) === String(p.pilier))
                          .map(c => c.circuit_code || c.code)
                          .filter(Boolean)
      }
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
    cout_intro:        bilan.cout_intro || bilan.zone_cout_intro || '',
    cout_constat:      bilan.cout_constat || bilan.zone_cout_candidat || '',
    affects_intro:     bilan.limbique_intro || '',
    affects_registres: bilan.limbique_registres || '',
    affects_synthese:  bilan.limbique_synthese || '',
    signature_ligne:   bilan.note_profil_global || ''
  };

  payload._empreinte = empreinte(payload);
  return payload;
}

/* Empreinte du transporté — le contrôle d'intégrité la compare après l'agent */
function empreinte(objet) {
  const { _empreinte, ...reste } = objet;
  return crypto.createHash('sha256').update(JSON.stringify(reste)).digest('hex');
}

module.exports = { construirePayload, empreinte, normaliseRole };
