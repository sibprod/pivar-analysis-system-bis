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
//   · R9 : la sélection des gestes se fait sur bloc_final, jamais sur circuit_niveau,
//          et jamais sur le champ `bloc` (résidu « BLOC_EN_ATTENTE »)
//   · R9 : cascade de repli par pilier — très souvent, sinon souvent, sinon occasionnels
//   · les trois référentiels sont chargés INTÉGRALEMENT : ils sont le cadre de l'agent
//
'use strict';

const airtable = require('../infrastructure/airtableService');
const logger   = require('../../utils/logger');

// ═══════════════════════════════════════════════════════════════════════════
// ADAPTATION AU DÉPÔT — les seules primitives attendues du service Airtable.
// Si les noms diffèrent dans l'infrastructure existante, mapper ICI et nulle part
// ailleurs : le reste du fichier n'y touche pas.
//   selectByFormula(table, formula)  → [{ id, fields }]
//   selectAll(table)                 → [{ id, fields }]
// ═══════════════════════════════════════════════════════════════════════════
const selectByFormula = airtable.selectByFormula || airtable.getRecordsByFormula;
const selectAll       = airtable.selectAll       || airtable.getAllRecords;

const T = {
  VISITEUR:            'VISITEUR',
  T3_BILAN:            'ETAPE1_T3_BILAN',
  T3_PILIER:           'ETAPE1_T3_PILIER',
  T3_CIRCUIT:          'ETAPE1_T3_CIRCUIT',
  CIRCUITS_POURBILAN:  'ETAPE1_T2_CIRCUITS_POURBILAN',
  EXCELLENCE:          'RESPONSES_ETAPE2_ EXCELLENCE',   // l'espace du nom est réel
  BILAN4:              'ETAPE2_BILAN4EXCELLENCES',
  REF_PROFILS:         'REFERENTIEL_PROFIL_VS_PILIER(bilan pro)',
  REF_EQUIVALENCES:    'REFERENTIEL_TEST_EQUIVALENT_PRO',
  REF_DESALIGNEMENT:   'BILAN_DESALIGNEMENT'
};

// L'ordre du chemin cognitif, pour la présentation.
const ORDRE_PILIERS = ['P4', 'P3', 'P5', 'P1', 'P2'];
// Les trois blocs, du plus fréquent au moins fréquent (R9).
const CASCADE = ['très souvent', 'souvent', 'occasionnels'];

function esc(v) { return String(v || '').replace(/'/g, "\\'"); }
function val(v) { return (v && (v.name || v)) || ''; }

// ═══════════════════════════════════════════════════════════════════════════
// R9 · LA SÉLECTION DES GESTES
// Pour chaque pilier : on prend le bloc le plus haut qui EXISTE pour lui.
// Un pilier fonctionnel n'est appelé que sous contrainte : il peut n'avoir aucun
// geste au bloc le plus fréquent. Sans repli, sa carte serait vide — ce serait faux.
// ═══════════════════════════════════════════════════════════════════════════
function selectionnerGestes(lignesPourBilan, narrations) {
  const parPilier = {};

  for (const l of lignesPourBilan) {
    const pilier = val(l.fields['pilier_owner']);
    const bloc   = val(l.fields['bloc_final']);          // ⚠️ JAMAIS l.fields['bloc']
    const code   = l.fields['circuit_code'];

    // Ligne incomplète (ni code, ni bloc) : on l'ignore et on la signale.
    if (!pilier || !bloc || !code) continue;

    (parPilier[pilier] = parPilier[pilier] || {});
    (parPilier[pilier][bloc] = parPilier[pilier][bloc] || []).push({
      code,
      rang: l.fields['rang_dans_pilier'] || 99
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
        const n = narrations[`${pilier}|${g.code}`] || narrations[g.code] || null;
        return n ? {
          code: g.code,
          narration: n.explication_courte_ch4 || n.n1_definition || '',
          renfort:   n.renfort_phrase || ''
          // Le libellé de référentiel (circuit_nom) N'EST PAS transmis : D95.
          // Les verbatims NE SONT PAS transmis : D-PREUVE.
        } : null;
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
  const f = `{candidat_id} = '${esc(candidat_id)}'`;
  const manques = [];

  // ── 1 · Identité (la civilité commande l'accord — l'agent écrit à l'aveugle du genre)
  const [visiteur] = await selectByFormula(T.VISITEUR, `{candidate_ID} = '${esc(candidat_id)}'`);
  if (!visiteur) throw new Error(`Grille : aucun visiteur pour ${candidat_id}`);

  // ── 2 · Le socle et son réglage
  const [t3] = await selectByFormula(T.T3_BILAN, f);
  if (!t3) throw new Error(`Grille : aucun bilan T3 pour ${candidat_id}`);
  if (!t3.fields['filtre']) manques.push('filtre du socle');

  let gestesSocle = [];
  try {
    const brut = t3.fields['filtre_gestes'];
    const json = typeof brut === 'string' ? JSON.parse(brut) : (brut || []);
    gestesSocle = (Array.isArray(json) ? json : []).map(g => ({
      code: g.code || '', narration: g.fait || '', revele: g.revele || ''
      // g.dit (les verbatims) volontairement écarté : D-PREUVE
    }));
  } catch (e) {
    manques.push('gestes du socle illisibles (filtre_gestes)');
  }

  // ── 3 · Les cinq piliers
  const piliersRows = await selectByFormula(T.T3_PILIER, f);
  const piliers = {};
  for (const p of piliersRows) {
    const code = val(p.fields['pilier']);
    if (!code) continue;
    piliers[code] = {
      pilier:     code,
      libelle:    p.fields['pilier_label'] || '',
      role:       p.fields['pilier_role_label'] || '',
      mode:       p.fields['pilier_mode'] || '',
      synthese:   p.fields['synth_bloc_tres_souvent_candidat'] || ''
      // Les synthèses « souvent » et « occasionnels » ne sont pas transmises :
      // la grille affiche UNE synthèse par outil, celle du bloc retenu.
    };
  }
  for (const c of ORDRE_PILIERS) if (!piliers[c]) manques.push(`pilier ${c} absent`);

  // ── 4 · Les gestes : classement (T2) + matière (T3_CIRCUIT), jointure sur le code
  const pourBilan   = await selectByFormula(T.CIRCUITS_POURBILAN, f);
  const circuitRows = await selectByFormula(T.T3_CIRCUIT, f);
  const narrations  = {};
  for (const c of circuitRows) {
    const pilier = val(c.fields['pilier']);
    const cid    = c.fields['circuit_id'] || '';
    const entree = {
      explication_courte_ch4: c.fields['explication_courte_ch4'] || '',
      n1_definition:          c.fields['n1_definition'] || '',
      renfort_phrase:         c.fields['renfort_phrase'] || ''
    };
    narrations[`${pilier}|${pilier}${cid}`] = entree;  // P4 + C4 → « P4C4 »
    narrations[`${pilier}|${cid}`] = entree;
    narrations[cid] = entree;
  }
  const gestesParPilier = selectionnerGestes(pourBilan, narrations);

  // Le socle a sa propre source (filtre_gestes) : on la préfère si elle est fournie.
  const socleCode = val(t3.fields['pilier_socle']) || 'P4';
  if (gestesSocle.length) {
    gestesParPilier[socleCode] = { bloc_retenu: 'très souvent', gestes: gestesSocle };
  }
  for (const c of ORDRE_PILIERS) {
    if (!gestesParPilier[c] || !gestesParPilier[c].gestes.length) {
      manques.push(`aucun geste retenu pour ${c}`);
    }
  }

  // ── 5 · Les dimensions
  const excRows = await selectByFormula(T.EXCELLENCE, f);
  const dimensions = excRows.map(r => ({
    excellence:    val(r.fields['excellence']),
    niveau_global: r.fields['niveau_global'] || '',
    pattern:       r.fields['pattern'] || '',
    synthese:      r.fields['synthese'] || '',
    declencheur:   r.fields['declencheur'] || '',
    gradient:      r.fields['gradient'] || ''
  })).filter(d => d.excellence);

  const [b4] = await selectByFormula(T.BILAN4, f);
  if (!b4) throw new Error(`Grille : aucun bilan 4 dimensions pour ${candidat_id}`);

  const type_cognitif = b4.fields['type_cognitif'] || '';
  if (!type_cognitif) manques.push('type cognitif absent — la tuile ne peut pas être désignée');

  // ── 6 · La clé de tuile : composition MÉCANIQUE, aucune interprétation
  const SOCLE_VERS_CLE = { P1: 'COLLECTE', P2: 'TRI', P3: 'ANALYSE', P4: 'SOLUTIONS', P5: 'MEO' };
  const cle_tuile = (SOCLE_VERS_CLE[socleCode] && type_cognitif)
    ? `${SOCLE_VERS_CLE[socleCode]}-${type_cognitif.normalize('NFD').replace(/[\u0300-\u036f]/g, '')}`
    : null;
  if (!cle_tuile) manques.push('clé de tuile non composable');

  // ── 7 · Les trois référentiels — chargés INTÉGRALEMENT, ils sont le cadre
  const [refProfils, refEquivalences, refDesalignement] = await Promise.all([
    selectAll(T.REF_PROFILS), selectAll(T.REF_EQUIVALENCES), selectAll(T.REF_DESALIGNEMENT)
  ]);

  const tuile = refProfils.find(t => t.fields['cle'] === cle_tuile);
  if (!tuile) manques.push(`tuile ${cle_tuile} introuvable au référentiel`);

  // ── 8 · Refus de construire sur une matière incomplète (règle : interdit de supposer)
  if (manques.length) {
    logger.error('Payload grille — matière incomplète, construction refusée', { candidat_id, manques });
    const err = new Error(`Grille : matière incomplète — ${manques.join(' · ')}`);
    err.manques = manques;
    err.revision_humaine = true;
    throw err;
  }

  return {
    candidat_id,
    civilite: val(visiteur.fields['Civilite']) || val(visiteur.fields['civilite']) || '',

    profil: {
      cle_tuile,
      socle: socleCode,
      type_cognitif,
      type_complet: b4.fields['type_complet'] || '',
      type_ecarte:  b4.fields['type_ecarte'] || '',   // sert au contrôle de cohérence (R8)
      tuile: tuile.fields                              // la tuile ENTIÈRE : elle est le cadre
    },

    socle: {
      pilier:  socleCode,
      libelle: t3.fields['pilier_socle_label'] || '',
      filtre:  t3.fields['filtre'] || ''
    },

    piliers: ORDRE_PILIERS.map(c => ({
      ...piliers[c],
      bloc_retenu: gestesParPilier[c].bloc_retenu,     // interne : ne s'affiche jamais (D95)
      gestes:      gestesParPilier[c].gestes
    })),

    registres_affectifs: t3.fields['ch3_signal_registres'] || '',

    dimensions,
    synthese_dimensions: {
      portrait_un_mot:   b4.fields['portrait_un_mot'] || '',
      combinaison:       b4.fields['combinaison'] || '',
      reserves_globales: b4.fields['reserves_globales'] || ''  // lecture, jamais affichage
    },

    referentiels: {
      equivalences: refEquivalences.map(r => r.fields),   // R2 · libellés canoniques
      desalignement: refDesalignement.map(r => r.fields), // vigilances par outil
      version_profils:      new Date().toISOString().slice(0, 10),
      version_equivalences: new Date().toISOString().slice(0, 10)
    }
  };
}

module.exports = { construire, selectionnerGestes, CASCADE, ORDRE_PILIERS };
