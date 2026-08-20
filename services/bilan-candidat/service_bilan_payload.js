// services/bilan-candidat/service_bilan_payload.js
// TRANSPORT PUR — payload du bilan présenté au candidat.
//
// ⚠ VERSION v3 DU 20/08 — DEUX ESPACES DE NOMS, ne plus jamais les confondre :
//   · les noms AIRTABLE (schéma de la base) ;
//   · les CLÉS DU SERVICE MAISON (airtable.js → *_FIELDS), mappées par fldID.
// CE FICHIER LIT À TRAVERS LE SERVICE MAISON : il emploie donc les CLÉS DU
// SERVICE. Exemples de correspondance (attestés, config lue le 20/08) :
//   verbatim_1 ↔ soleil_verbatim · en_renfort ↔ renfort_phrase ·
//   role_pilier ↔ pilier_role · bloc_tres_souvent_candidat ↔ synth_bloc_… ·
//   s06_intro/s06_cloture ↔ ch3_cout_intro/cloture ·
//   s05_intro/registres/s05_cloture ↔ ch3_signal_intro/registres/cloture.
// Relevé de preuve : AUDIT_V15_CONTRE_BASE_2026-08-20.md (+ rectificatif).
//
// Sources (fonctions du service maison, aucune autre) :
//   getEtape1T3Bilan     → signature, filtre et ses preuves, coûts, affects
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
  // ⚠ amont/aval AVANT socle : les libellés en clair « Pilier amont — ce qui
  // alimente le socle » et « Pilier aval — … » contiennent le mot « socle ».
  // L'ordre inverse a classé P3 en socle le 20/08 et cassé l'enchaînement.
  if (v.includes('amont')) return 'amont';
  if (v.includes('aval'))  return 'aval';
  if (v.includes('socle')) return 'socle';
  return 'fonctionnel';
}

/* Le classement vient de « bloc_final » (ETAPE1_T2_CIRCUITS_POURBILAN) — jamais
   de « bloc », qui reste à BLOC_EN_ATTENTE. Il vaut « très souvent », « souvent »
   ou « occasionnels ».

   RÈGLE DE SÉLECTION, par outil : on retient le bloc le plus fréquent que
   l'outil possède. Très souvent s'il en a ; sinon souvent ; sinon occasionnels.
   Un outil n'est jamais muet : un fonctionnel qui n'a que deux gestes occasionnels
   a tout de même une manière de faire, et le candidat doit la connaître. */
const RANG_BLOC = { 'tres souvent': 0, 'souvent': 1, 'occasionnels': 2 };
const normBloc = v => String(v == null ? '' : v).toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim();

/* Intitulé affiché au candidat — il doit dire la vérité sur la fréquence réelle. */
const INTITULE_BLOC = {
  'tres souvent': 'Ce que vous faites très souvent',
  'souvent':      'Ce que vous faites souvent',
  'occasionnels': 'Ce que vous faites quand vous vous en servez'
};

async function construirePayload(candidat_id, airtableService) {
  const bilan = await airtableService.getEtape1T3Bilan(candidat_id);
  if (!bilan) throw new Error(`Aucun bilan T3 pour ${candidat_id}`);

  const piliers  = await airtableService.getEtape1T3Piliers(candidat_id)  || [];
  // Deux sources, jointes sur le code : POURBILAN dit LESQUELS, T3_CIRCUIT dit QUOI.
  const pourbilan = await airtableService.getEtape1T2CircuitsPourbilan(candidat_id) || [];
  const matiere   = await airtableService.getEtape1T3Circuits(candidat_id) || [];

  // Index de la matière par code complet (P4 + C15 → P4C15)
  const parCode = new Map(matiere.map(g => [`${g.pilier}${g.circuit_id}`, g]));

  // Par outil : le bloc le plus fréquent qu'il possède, et les gestes de ce bloc.
  const blocParPilier = new Map();
  const gestesParPilier = new Map();
  for (const l of pourbilan) {
    const code = String(l.circuit_code || '');
    const m = parCode.get(code);
    if (!m) continue;                              // pas de matière rédigée → non affichable
    const bloc = normBloc(l.bloc_final);
    if (!(bloc in RANG_BLOC)) continue;            // bloc non attribué → ignoré
    const pil = String(m.pilier);
    const actuel = blocParPilier.get(pil);
    if (actuel === undefined || RANG_BLOC[bloc] < RANG_BLOC[actuel]) {
      blocParPilier.set(pil, bloc);                // un bloc plus fréquent est trouvé
      gestesParPilier.set(pil, []);
    }
    if (blocParPilier.get(pil) === bloc) gestesParPilier.get(pil).push({ code, m });
  }
  const gestesRetenus = [...gestesParPilier.values()].flat();

  // Aucun geste retenu = matière absente : on échoue ici, jamais côté agent.
  if (!gestesRetenus.length) {
    throw new Error(`Aucun geste « très souvent » pour ${candidat_id} — ` +
      `${pourbilan.length} ligne(s) POURBILAN, bloc_final : ${[...new Set(pourbilan.map(l => l.bloc_final || '?'))].join(', ')} · ` +
      `${matiere.length} geste(s) en matière`);
  }

  const outils = piliers.map(p => {
    // Clé du SERVICE : role_pilier (↔ champ Airtable pilier_role, via fldID).
    const role = normaliseRole(p.role_pilier || p.pilier_role_label);
    const blocRetenu = blocParPilier.get(String(p.pilier)) || '';
    const gestes = gestesRetenus
      .filter(x => String(x.m.pilier) === String(p.pilier))
      .sort((a, b) => (a.m.ordre_circuit || 0) - (b.m.ordre_circuit || 0))
      .map(({ code, m }) => ({
        code,                                        // P4C15 — clé interne, jamais affichée
        // ⭐ AM du 20/08 (garante) — le nom du geste dans le bilan complet
        // (libellé de circuit du référentiel, déjà ajusté par la chaîne).
        // Source de titre de PRIORITÉ 2 pour l'agent, après le mode rapide.
        libelle_officiel: m.circuit_nom || '',
        narration: m.n3_nuance || m.n1_definition || '',   // attesté plein : n3_nuance
        resume:    m.explication_courte_ch4 || '',   // la phrase courte du protocole
        // Clé du SERVICE : en_renfort (↔ champ Airtable renfort_phrase).
        // ⚠ Il CONTIENT codes et comptages « (P4) — 4 fois » : le nettoyage
        // (transport ou rendu) est un arbitrage garante OUVERT — transport tel quel.
        renfort:   m.en_renfort || '',
        // Clés du SERVICE : verbatim_1/_ref (↔ soleil_verbatim/_ref), puis 2..4.
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
      // ⚠ mode_explication contient codes et comptages (attesté en base 20/08 :
      // « P4C15, total 4 »). Le nettoyage est un arbitrage garante OUVERT.
      // Transport tel quel en attendant la décision.
      mode_explication: p.mode_explication || '',
      // ⚠ JAMAIS synth_interpretee : c'est la vue d'ensemble INTERNE — elle contient
      // les codes de gestes, les libellés du référentiel et les comptages.
      // La matière candidat vit sous les clés du SERVICE bloc_*_candidat
      // (↔ champs Airtable synth_bloc_*_candidat, via fldID).
      synthese:         ({ 'tres souvent': p.bloc_tres_souvent_candidat,
                           'souvent':      p.bloc_souvent_candidat,
                           'occasionnels': p.bloc_occasionnels_candidat })[blocRetenu] || '',
      bloc:             blocRetenu,                 // très souvent · souvent · occasionnels
      intitule_bloc:    INTITULE_BLOC[blocRetenu] || 'Ce que vous faites',
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
    // Attesté en base le 20/08 : filtre_label, filtre_preuve_* et
    // filtre_lecture_candidat sont VIDES ; les champs remplis sont ceux-ci.
    filtre:            bilan.filtre || '',
    filtre_preuves:    parseListe(bilan.ch4_filtre_preuves),
    // ⚠ La révélation vit dans « filtre_synthese » (attesté plein le 20/08) —
    // ch4_filtre_revelation existe mais est VIDE pour le candidat de référence.
    // On lit les deux, le champ dédié d'abord s'il venait à être servi un jour.
    // Le texte contient les CODES de gestes (P4C15…) : ils sont retirés ici,
    // la barrière du serveur de rendu les rejetterait sinon.
    filtre_revelation: nettoyerCodes(bilan.ch4_filtre_revelation || bilan.filtre_synthese || ''),
    outils,
    // Clés du SERVICE (↔ champs Airtable ch3_cout_* / ch3_signal_*, via fldID) :
    cout_intro:        bilan.s06_intro || '',      // définition de la zone de coût
    cout_constat:      bilan.s06_cloture || '',    // le constat pour ce candidat
    affects_intro:     bilan.s05_intro || '',      // introduction du signal affectif
    affects_registres: bilan.registres || '',      // les registres rédigés
    affects_synthese:  bilan.s05_cloture || '',    // ce que ces registres disent ensemble
    // ⚠ Attesté le 20/08 : sig_recit, sig_resultat_ligne1/2 et note_profil_global
    // sont tous VIDES pour le candidat de référence. Le texte de clôture de la
    // maquette v15 est une COMPOSITION (socle + filtre reformulé) : son sort
    // (gabarit au rendu, ou champ servi en amont) est un arbitrage garante OUVERT.
    signature_ligne:   bilan.sig_recit || bilan.sig_resultat_ligne1 || ''
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
  // Table MODE_RAPIDE. On ne dépend NI des noms de champs NI de leurs identifiants :
  // on reconnaît le bloc des gestes probants à son contenu — un JSON de la forme
  // [{ pilier, nom, qid, verbatim }]. C'est la lecture qui ne peut pas échouer.
  const BASE  = process.env.AIRTABLE_BASE_ID;
  const KEY   = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const TABLE = 'tbltOcRoreIYx0LT2';
  if (!BASE || !KEY) return [];

  try {
    // On lit les lignes du candidat sans filtre de formule (nom de champ non garanti)
    const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}?pageSize=100`,
      { headers: { Authorization: `Bearer ${KEY}` } });
    if (!r.ok) { console.warn(`[mode-rapide] lecture refusée : ${r.status}`); return []; }
    const data = await r.json();

    // La ligne du candidat : une de ses valeurs porte son identifiant
    const ligne = (data.records || []).find(rec =>
      Object.values(rec.fields || {}).some(v => typeof v === 'string' && v === candidat_id));
    if (!ligne) { console.log('[mode-rapide] aucune ligne pour ce candidat'); return []; }

    // Le bloc des gestes : la valeur qui est un tableau JSON avec « nom » et « verbatim »
    let gestes = [];
    for (const v of Object.values(ligne.fields || {})) {
      if (typeof v !== 'string' || !v.trim().startsWith('[')) continue;
      try {
        const j = JSON.parse(v.replace(/\u00a0/g, ' '));
        if (Array.isArray(j) && j.length && j[0] && j[0].nom && j[0].verbatim) { gestes = j; break; }
      } catch {}
    }

    const formulations = gestes
      .map(g => ({ formulation: String(g.nom || '').trim(), ancrage: String(g.verbatim || '').trim(), pilier: g.pilier || '' }))
      .filter(f => f.formulation && f.ancrage);
    console.log(`[mode-rapide] ${formulations.length} formulation(s) disponible(s)`);
    return formulations;
  } catch (e) {
    console.warn('[mode-rapide] échec :', e.message);
    return [];   // jamais bloquant : le bilan ne dépend pas de l'autre chaîne
  }
}

/* Les preuves du filtre sont stockées en JSON ou en texte : on accepte les deux. */
function parseListe(v) {
  if (Array.isArray(v)) return v;
  if (typeof v !== 'string' || !v.trim()) return [];
  try { const j = JSON.parse(v.replace(/\u00a0/g, ' ')); if (Array.isArray(j)) return j; } catch {}
  return v.split('\n').map(x => x.trim()).filter(Boolean);
}

/* Retire les codes de gestes d'un texte destiné au candidat, et recoud la phrase. */
function nettoyerCodes(texte) {
  return String(texte)
    .replace(/\bP[1-5](C\d+|·ADHOC)\b\s*/g, '')
    .replace(/\s{2,}/g, ' ')
    .replace(/\s+([.,;:])/g, '$1')
    .trim();
}

function empreinte(objet) {
  const { _empreinte, ...reste } = objet;
  return crypto.createHash('sha256').update(JSON.stringify(reste)).digest('hex');
}

module.exports = { construirePayload, lireFormulationsModeRapide, empreinte, normaliseRole };
