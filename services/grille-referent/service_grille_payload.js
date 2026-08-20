// services/grille-referent/service_grille_payload.js
// Construction du payload de l'agent GRILLE RÉFÉRENT
//
// ⚠️ AVANT MODIFICATION : lire docs/12-doctrine-preuve-et-mission-agent-grille.md
//
// Ce service ne produit AUCUN texte. Il lit, il assemble, il vérifie que la matière
// est complète — et il refuse de construire si elle ne l'est pas.
//
// RÈGLES APPLIQUÉES ICI (les autres vivent dans le prompt) :
//   · toute lecture est filtrée sur candidat_id, JAMAIS sur le contenu
//   · R9 : sélection des gestes sur bloc_final — jamais `bloc` (résidu BLOC_EN_ATTENTE),
//          jamais circuit_niveau (amplitude absolue, pas rang dans le pilier)
//   · R9 : cascade de repli par pilier — très souvent, sinon souvent, sinon occasionnels
//   · D-PREUVE : aucun verbatim n'entre dans le payload
//   · D95 : aucun libellé de circuit du référentiel n'entre dans le payload
//   · les trois référentiels sont chargés INTÉGRALEMENT : ils sont le cadre de l'agent
//
'use strict';

const airtableService = require('../infrastructure/airtableService');
const refGrille       = require('./airtable_grille');   // les 3 lecteurs de référentiels
const logger          = require('../../utils/logger');

// L'ordre du chemin cognitif, pour la présentation.
const ORDRE_PILIERS = ['P4', 'P3', 'P5', 'P1', 'P2'];
// Les trois blocs, du plus fréquent au moins fréquent (R9).
const CASCADE = ['très souvent', 'souvent', 'occasionnels'];
// Composition mécanique de la clé de tuile — aucune interprétation.
const SOCLE_VERS_CLE = { P1: 'COLLECTE', P2: 'TRI', P3: 'ANALYSE', P4: 'SOLUTIONS', P5: 'MEO' };

function val(v) { return (v && (v.name !== undefined ? v.name : v)) || ''; }
function sansAccents(s) { return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }

// ═══════════════════════════════════════════════════════════════════════════
// R9 · LA SÉLECTION DES GESTES
// Pour chaque pilier : le bloc le plus haut qui EXISTE pour lui.
// Un pilier fonctionnel n'est appelé que sous contrainte : il peut n'avoir aucun
// geste au bloc le plus fréquent. Sans repli, sa carte serait vide — ce serait faux.
// ═══════════════════════════════════════════════════════════════════════════
function selectionnerGestes(lignesPourBilan, narrations, anomalies) {
  const parPilier = {};

  for (const l of lignesPourBilan) {
    const pilier = val(l['pilier_owner']);
    const bloc   = val(l['bloc_final']);          // ⚠️ JAMAIS l['bloc']
    const code   = l['circuit_code'];

    // La table mêle deux natures de lignes : les gestes, et des lignes de
    // STRUCTURE (en-tête générale + un séparateur avant chaque bloc de chaque
    // pilier). Ces dernières n'ont pas de code de geste : on les ignore en
    // silence — ce ne sont pas des anomalies, c'est la forme de la table.
    // Vérifié sur M. R. : 50 lignes = 40 gestes + 10 lignes de structure.
    if (!code) continue;

    // En revanche, une ligne QUI PORTE un geste mais à qui il manque son pilier
    // ou son bloc est une vraie anomalie : on ne peut ni la classer ni la placer.
    if (!pilier || !bloc) {
      anomalies.push(`geste non classable : ${code} (pilier=${pilier || '—'} bloc=${bloc || '—'})`);
      continue;
    }
    (parPilier[pilier] = parPilier[pilier] || {});
    (parPilier[pilier][bloc] = parPilier[pilier][bloc] || []).push({
      code, rang: l['rang_dans_pilier'] || 99
    });
  }

  const resultat = {};
  for (const pilier of Object.keys(parPilier)) {
    let blocRetenu = null;
    for (const bloc of CASCADE) {
      if ((parPilier[pilier][bloc] || []).length > 0) { blocRetenu = bloc; break; }
    }
    if (!blocRetenu) { resultat[pilier] = { bloc_retenu: null, gestes: [] }; continue; }

    const gestes = parPilier[pilier][blocRetenu]
      .sort((a, b) => a.rang - b.rang)
      .map(g => {
        const n = narrations[g.code] || null;
        if (!n) { anomalies.push(`narration introuvable pour le geste ${g.code}`); return null; }
        return {
          code: g.code,
          narration: n.narration,
          renfort:   n.renfort
          // circuit_nom (libellé du référentiel) : NON transmis — D95
          // verbatims : NON transmis — D-PREUVE
        };
      })
      .filter(Boolean);

    resultat[pilier] = { bloc_retenu: blocRetenu, gestes };
  }
  return resultat;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION DU PAYLOAD
// ═══════════════════════════════════════════════════════════════════════════
async function construire(candidat_id) {
  logger.info('Payload grille référent — construction', { candidat_id });
  const manques   = [];
  const anomalies = [];

  // ── 1 · Identité — la civilité commande l'accord ; l'agent écrit à l'aveugle du genre
  const civilite = await airtableService.getCiviliteCandidat(candidat_id).catch(() => null);
  if (!civilite) anomalies.push('civilité absente — accord au masculin par défaut');

  // ── 2 · Le socle et son réglage
  const t3 = await airtableService.getEtape1T3Bilan(candidat_id);
  if (!t3) throw new Error(`Grille : aucun bilan T3 pour ${candidat_id}`);
  if (!t3.filtre) manques.push('filtre du socle');

  const socleCode = val(t3.pilier_socle) || 'P4';

  // Les gestes du socle ont leur source propre : le JSON filtre_gestes.
  let gestesSocle = [];
  try {
    const brut = t3.filtre_gestes;
    const json = typeof brut === 'string' ? JSON.parse(brut) : (brut || []);
    gestesSocle = (Array.isArray(json) ? json : []).map(g => ({
      code:      g.code || '',
      narration: g.fait || '',
      renfort:   ''
      // g.dit (verbatims) volontairement écarté — D-PREUVE
    })).filter(g => g.narration);
  } catch (e) {
    anomalies.push('filtre_gestes illisible — repli sur la source commune');
  }

  // ── 3 · Les cinq piliers
  const piliersRows = await airtableService.getEtape1T3Piliers(candidat_id);
  const piliers = {};
  for (const p of piliersRows) {
    const code = val(p.pilier);
    if (!code) continue;
    piliers[code] = {
      pilier:   code,
      libelle:  p.pilier_label || '',
      role:     p.pilier_role_label || '',
      mode:     p.pilier_mode || '',
      synthese: p.synth_bloc_tres_souvent_candidat || ''
    };
  }
  for (const c of ORDRE_PILIERS) if (!piliers[c]) manques.push(`pilier ${c} absent`);

  // ── 4 · Les gestes : classement (T2, bloc_final) + matière (T3_CIRCUIT)
  const pourBilan   = await airtableService.getEtape1T2CircuitsPourbilan(candidat_id);
  const circuitRows = await airtableService.getEtape1T3Circuits(candidat_id);

  const narrations = {};
  for (const c of circuitRows) {
    const pilier = val(c.pilier);
    const cid    = c.circuit_id || '';
    const entree = {
      narration: c.explication_courte_ch4 || c.n1_definition || '',
      renfort:   c.renfort_phrase || ''
    };
    // Les codes se présentent sous deux formes selon les tables : « C4 » et « P4C4 ».
    narrations[cid] = entree;
    narrations[`${pilier}${cid}`] = entree;
  }

  const gestesParPilier = selectionnerGestes(pourBilan, narrations, anomalies);
  if (gestesSocle.length) {
    gestesParPilier[socleCode] = { bloc_retenu: 'très souvent', gestes: gestesSocle };
  }
  for (const c of ORDRE_PILIERS) {
    if (!gestesParPilier[c] || !gestesParPilier[c].gestes.length) {
      manques.push(`aucun geste retenu pour ${c}`);
    }
  }

  // ── 5 · Les dimensions
  const t5b = await airtableService.getEtape2T5BRows(candidat_id);
  const dimensions = (t5b || []).map(r => ({
    excellence:    val(r.excellence),
    niveau_global: r.niveau_global || '',
    pattern:       r.pattern || '',
    synthese:      r.synthese || '',
    declencheur:   r.declencheur || '',
    gradient:      r.gradient || ''
  })).filter(d => d.excellence && (d.synthese || d.niveau_global));

  const b4 = await refGrille.getBilan4Profil(candidat_id);
  if (!b4) throw new Error(`Grille : aucun bilan 4 dimensions pour ${candidat_id}`);

  const type_cognitif = b4.type_cognitif || '';
  if (!type_cognitif) manques.push('type cognitif absent — la tuile ne peut pas être désignée');

  // ── 6 · La clé de tuile — composition MÉCANIQUE
  const cle_tuile = (SOCLE_VERS_CLE[socleCode] && type_cognitif)
    ? `${SOCLE_VERS_CLE[socleCode]}-${sansAccents(type_cognitif).toUpperCase()}`
    : null;
  if (!cle_tuile) manques.push('clé de tuile non composable');

  // ── 7 · Les trois référentiels — chargés INTÉGRALEMENT, ils sont le cadre
  const [tuiles, equivalences, desalignement] = await Promise.all([
    refGrille.getReferentielProfilVsPilier(),
    refGrille.getReferentielTestEquivalentPro(),
    refGrille.getBilanDesalignement()
  ]);

  const tuile = tuiles.find(t => t.cle === cle_tuile) || null;
  if (!tuile) manques.push(`tuile ${cle_tuile} introuvable au référentiel`);

  // ── 8 · Refus de construire sur une matière incomplète (interdit de supposer)
  if (manques.length) {
    logger.error('Payload grille — matière incomplète, construction refusée', { candidat_id, manques, anomalies });
    const err = new Error(`Grille : matière incomplète — ${manques.join(' · ')}`);
    err.manques = manques;
    err.anomalies = anomalies;
    err.revision_humaine = true;
    throw err;
  }
  if (anomalies.length) logger.warn('Payload grille — anomalies non bloquantes', { candidat_id, anomalies });

  return {
    candidat_id,
    civilite: val(civilite) || '',

    profil: {
      cle_tuile,
      socle:         socleCode,
      type_cognitif,
      type_complet:  b4.type_complet || '',
      type_ecarte:   b4.type_ecarte  || '',   // contrôle de cohérence R8
      tuile                                    // la tuile ENTIÈRE : elle est le cadre
    },

    socle: {
      pilier:  socleCode,
      libelle: t3.pilier_socle_label || '',
      filtre:  t3.filtre || ''
    },

    piliers: ORDRE_PILIERS.map(c => ({
      ...piliers[c],
      bloc_retenu: gestesParPilier[c].bloc_retenu,   // interne : ne s'affiche jamais (D95)
      gestes:      gestesParPilier[c].gestes
    })),

    registres_affectifs: t3.ch3_signal_registres || '',

    dimensions,
    synthese_dimensions: {
      portrait_un_mot:   b4.portrait_un_mot   || '',
      combinaison:       b4.combinaison       || '',
      reserves_globales: b4.reserves_globales || ''   // lecture seule, jamais affiché
    },

    referentiels: {
      // R2 · la substitution ne demande QUE la correspondance contexte → libellé.
      // Envoyer les 25 lignes entières (situation du test, contrainte, ce que le
      // test demande…) noyait l'agent sous une matière qu'il n'utilise pas — et
      // lui faisait dépasser sa capacité de sortie. On envoie la table réduite.
      libelles_canoniques: [...new Map(
        (equivalences || [])
          .filter(e => e.contexte_test && e.libelle_pro_court)
          .map(e => [e.contexte_test, { contexte: e.contexte_test, libelle: e.libelle_pro_court }])
      ).values()],

      // Les questions par contexte, pour retrouver un contexte depuis un identifiant.
      questions_par_contexte: (equivalences || [])
        .filter(e => e.id_question && e.contexte_test)
        .map(e => ({ id: e.id_question, contexte: e.contexte_test })),

      // Vigilances : seuls les blocs qui servent, et leur contenu.
      desalignement: (desalignement || [])
        .filter(d => ['SURDEPLOIEMENT', 'INJONCTIONS', 'IMPACTS'].includes(String(d.bloc_type || '').toUpperCase()))
        .map(d => ({ pilier: d.pilier, bloc_type: d.bloc_type, contenu: d.contenu })),

      version_profils:      new Date().toISOString().slice(0, 10),
      version_equivalences: new Date().toISOString().slice(0, 10)
    },

    anomalies
  };
}

module.exports = { construire, selectionnerGestes, CASCADE, ORDRE_PILIERS, SOCLE_VERS_CLE };
