// services/visualisation/tableauT3bilanPayloadService.js
// Service de VISUALISATION du bilan (étape 3) — assemblage du payload
// Profil-Cognitif v11.0 (28/05/2026)
//
// ⚠️ AVANT MODIFICATION : lire docs/ARCHITECTURE_PROFIL_COGNITIF.md + le prompt
//                        new-prompts/etape1/etape1_t3bilan.txt (doctrines D1-D14)
//
// ───────────────────────────────────────────────────────────────────────────
// RÔLE
// ───────────────────────────────────────────────────────────────────────────
// Lit les 3 tables T3 d'un candidat (déjà remplies par agentT3BilanService) et
// assemble l'objet `payload` attendu par le template Handlebars-like
// services/visualisation/tableauT3bilanService.html (v5.5).
//
// Ce service NE génère PAS le bilan (aucun appel Claude). Il transforme les
// données stockées en la structure de rendu. Il est appelé par la route
// GET /visualiser/t3_bilan/:candidat_id en mode JSON.
//
// Le template attend 2 familles de champs :
//   - champs plats (filtre_label, pilier_mode, ...) → recopiés depuis Airtable
//   - champs reconstruits (circuits_groupes, *_html, piliers_dict) → assemblés ici
//
// ───────────────────────────────────────────────────────────────────────────
// DOCTRINES APPLIQUÉES (rappel — le détail est dans le prompt)
//   D1  : tous les circuits actifs affichés, jamais filtrés
//   D2  : socle = role_pilier 'socle' (déjà tranché en base, on recopie)
//   R8  : cluster_label recopié tel quel (jamais réordonné)
//   §2.12 : tableau récap regroupé HAUT/MOYEN/FAIBLE/instrumental/ADHOC
//   §2.11 : pilier_mode recopié à l'identique partout (permanence)
//
// ───────────────────────────────────────────────────────────────────────────

'use strict';

const airtableService = require('../infrastructure/airtableService');
const logger          = require('../../utils/logger');

// Ordre canonique des rôles (pour piliers_dict et l'ordre d'affichage)
// Modèle amont/aval (03/06/2026). Les slots CSS du template restent socle/str1/str2/fn1/fn2 :
//   socle→socle · amont→str1 · aval→str2 · fonctionnels→slots libres (str1 si pas d'amont, fn1, fn2).
const ROLE_ORDER = ['socle', 'amont', 'aval', 'fonctionnel'];

// Les slots CSS techniques du template (inchangés). L'assignation rôle→slot est DYNAMIQUE
// (voir assignSlots ci-dessous) pour gérer l'absence d'amont et le nombre variable de fonctionnels.
const CSS_SLOTS = ['socle', 'str1', 'str2', 'fn1', 'fn2'];

/**
 * Assigne à chaque pilier (selon son rôle) un slot CSS du template.
 * socle→'socle' ; amont→'str1' ; aval→'str2' ; fonctionnels→premiers slots libres
 * parmi ['str1'(si pas d'amont),'fn1','fn2'] dans l'ordre fourni.
 * @param {Array} pilierRows  objets ayant .pilier et .role_pilier
 * @returns {Object} pilier(P1..P5) -> slot CSS
 */
function assignSlots(pilierRows) {
  const map = {};
  const used = new Set();
  // 1er passage : socle, amont, aval (slots fixes)
  for (const pr of pilierRows) {
    const r = pr.role_pilier;
    if (r === 'socle') { map[pr.pilier] = 'socle'; used.add('socle'); }
    else if (r === 'amont') { map[pr.pilier] = 'str1'; used.add('str1'); }
    else if (r === 'aval')  { map[pr.pilier] = 'str2'; used.add('str2'); }
  }
  // 2e passage : fonctionnels → slots libres dans l'ordre str1(si libre), fn1, fn2
  const freeSlots = ['str1', 'fn1', 'fn2'].filter(s => !used.has(s));
  let i = 0;
  for (const pr of pilierRows) {
    if (map[pr.pilier]) continue; // déjà assigné (socle/amont/aval)
    map[pr.pilier] = freeSlots[i] || 'fn2';
    i += 1;
  }
  return map;
}

// Libellés affichés par slot (le template lit ces libellés). amont/aval explicites.
const SLOT_LABELS = {
  socle: '★ Pilier socle',
  str1:  'Amont — ce qui alimente le socle',
  str2:  'Aval — ce par quoi le socle conclut et agit',
  fn1:   'Pilier fonctionnel',
  fn2:   'Pilier fonctionnel',
};

// Mapping rôle → clé piliers_dict (rétro-compat : accepte ancien et nouveau, résolu via slot)
const ROLE_TO_DICT_KEY = {
  socle: 'socle', amont: 'str1', aval: 'str2', fonctionnel: 'fn1',
  structurant_1: 'str1', structurant_2: 'str2', fonctionnel_1: 'fn1', fonctionnel_2: 'fn2',
};
const ROLE_TO_CLASS = {
  socle: 'role-socle', amont: 'role-str1', aval: 'role-str2', fonctionnel: 'role-fn1',
  structurant_1: 'role-str1', structurant_2: 'role-str2', fonctionnel_1: 'role-fn1', fonctionnel_2: 'role-fn2',
};
const ROLE_TO_SHORT = {
  socle: 'socle', amont: 'str1', aval: 'str2', fonctionnel: 'fn1',
  structurant_1: 'str1', structurant_2: 'str2', fonctionnel_1: 'fn1', fonctionnel_2: 'fn2',
};

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Assemble le payload de rendu du bilan pour un candidat.
 * @param {string} candidat_id
 * @returns {Promise<Object|null>} payload prêt pour le template, ou null si pas de bilan.
 */
async function buildPayload(candidat_id) {
  logger.info('T3 Visu — assemblage payload', { candidat_id });

  // ─── 1. Lire les 3 tables T3 ───────────────────────────────────────────────
  const [bilanRow, pilierRows, circuitRows] = await Promise.all([
    airtableService.getEtape1T3Bilan(candidat_id),
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T3Circuits(candidat_id),
  ]);

  if (!bilanRow) {
    logger.warn('T3 Visu — aucun bilan T3 trouvé', { candidat_id });
    return null;
  }
  if (!pilierRows || pilierRows.length === 0) {
    logger.warn('T3 Visu — aucun pilier T3 trouvé', { candidat_id });
    return null;
  }

  // ─── 2. Indexer les circuits par pilier (code P1..P5) ──────────────────────
  const circuitsParPilier = {};
  for (const c of circuitRows || []) {
    const p = c.pilier;
    if (!circuitsParPilier[p]) circuitsParPilier[p] = [];
    circuitsParPilier[p].push(c);
  }

  // ─── 3. Trier les piliers par rôle (socle → str1 → str2 → fn1 → fn2) ───────
  const pilierByRole = {};
  for (const pr of pilierRows) {
    pilierByRole[pr.role_pilier] = pr;
  }
  const pilierOrdered = ROLE_ORDER
    .map(role => pilierByRole[role])
    .filter(Boolean);

  // ─── 4. Construire piliers_dict (pour §01 vue globale) ─────────────────────
  const piliers_dict = {};
  const totalSorties = pilierOrdered.reduce((s, p) => s + (p.nb_sorties || 0), 0) || 25;
  for (const pr of pilierOrdered) {
    const key = ROLE_TO_DICT_KEY[pr.role_pilier];
    if (!key) continue;
    const nbSorties = pr.nb_sorties != null ? pr.nb_sorties : 0;
    piliers_dict[key] = {
      pilier:          pr.pilier,
      pilier_label:    pr.pilier_label,
      pilier_css:      (pr.pilier || '').toLowerCase(),
      role_situation:  pr.pilier_mode || '',
      nb_sorties:      nbSorties,
      nb_sorties_pct:  Math.round((nbSorties / totalSorties) * 100),
    };
  }

  // ─── 5. Construire le tableau piliers[] (sections détaillées) ──────────────
  const piliers = pilierOrdered.map(pr =>
    buildPilierBlock(pr, circuitsParPilier[pr.pilier] || [])
  );

  // ─── 6. Socle pour les champs globaux ──────────────────────────────────────
  const socle = pilierByRole['socle'] || pilierOrdered[0];

  // ─── 7. Assembler le payload final ──────────────────────────────────────────
  const payload = {
    // Globaux
    version_bilan:      bilanRow.version_bilan || 'v1',
    civilite:           bilanRow.civilite || '',
    prenom:             bilanRow.prenom || '',
    nom:                bilanRow.nom || '',
    pilier_socle:       socle ? socle.pilier : '',
    pilier_socle_label: socle ? socle.pilier_label : '',
    socle_code:         socle ? socle.pilier : '',
    filtre_label:       bilanRow.filtre_label || '',
    signal_type:        bilanRow.signal_type || extractSignalType(socle),

    piliers_dict,
    piliers,

    // §01
    note_profil_global: bilanRow.note_profil_global || '',

    // §02 filtre
    filtre_preuve_1:  bilanRow.filtre_preuve_1 || '',
    filtre_preuve_2:  bilanRow.filtre_preuve_2 || '',
    filtre_preuve_3:  bilanRow.filtre_preuve_3 || '',
    filtre_preuve_4:  bilanRow.filtre_preuve_4 || '',
    filtre_preuve_5:  bilanRow.filtre_preuve_5 || '',
    filtre_lecture_candidat: bilanRow.filtre_lecture_candidat || '',

    // §03 glissements (lecture directe : config alignée schéma 29/05)
    glissement_intro:        bilanRow.glissement_intro || '',
    glissement_1_label_html: bilanRow.glissement_1_label || '',
    glissement_1_titre:      bilanRow.glissement_1_titre || '',
    glissement_1_corps:      bilanRow.glissement_1_corps || '',
    glissement_2_label_html: bilanRow.glissement_2_label || '',
    glissement_2_titre:      bilanRow.glissement_2_titre || '',
    glissement_2_corps:      bilanRow.glissement_2_corps || '',
    glissement_3_label_html: bilanRow.glissement_3_label || '',
    glissement_3_titre:      bilanRow.glissement_3_titre || '',
    glissement_3_corps:      bilanRow.glissement_3_corps || '',
    glissement_4_label_html: bilanRow.glissement_4_label || '',
    glissement_4_titre:      bilanRow.glissement_4_titre || '',
    glissement_4_corps:      bilanRow.glissement_4_corps || '',
    glissements_conclusion:  bilanRow.glissements_conclusion || '',

    // §04 boucles
    boucle_intro:     bilanRow.boucle_intro || '',
    boucle_1_label:   bilanRow.boucle_1_label || '',
    boucle_1_scenario:bilanRow.boucle_1_scenario || '',
    boucle_1_reponse: bilanRow.boucle_1_reponse || '',
    boucle_1_sequence:bilanRow.boucle_1_sequence || '',
    boucle_1_labo:    bilanRow.boucle_1_labo || '',
    boucle_2_label:   bilanRow.boucle_2_label || '',
    boucle_2_scenario:bilanRow.boucle_2_scenario || '',
    boucle_2_reponse: bilanRow.boucle_2_reponse || '',
    boucle_2_sequence:bilanRow.boucle_2_sequence || '',
    boucle_2_labo:    bilanRow.boucle_2_labo || '',
    boucle_3_label:   bilanRow.boucle_3_label || '',
    boucle_3_scenario:bilanRow.boucle_3_scenario || '',
    boucle_3_reponse: bilanRow.boucle_3_reponse || '',
    boucle_3_sequence:bilanRow.boucle_3_sequence || '',
    boucle_3_labo:    bilanRow.boucle_3_labo || '',

    // §05 signal limbique (15 champs)
    signal_intro:          bilanRow.signal_intro || '',
    signal_item1_q:        bilanRow.signal_item1_q || '',
    signal_item1_corps:    bilanRow.signal_item1_corps || '',
    signal_item1_verbatim: bilanRow.signal_item1_verbatim || '',
    signal_item2_q:        bilanRow.signal_item2_q || '',
    signal_item2_corps:    bilanRow.signal_item2_corps || '',
    signal_item2_verbatim: bilanRow.signal_item2_verbatim || '',
    signal_item3_q:        bilanRow.signal_item3_q || '',
    signal_item3_corps:    bilanRow.signal_item3_corps || '',
    signal_item3_verbatim: bilanRow.signal_item3_verbatim || '',
    signal_item4_q:        bilanRow.signal_item4_q || '',
    signal_item4_corps:    bilanRow.signal_item4_corps || '',
    signal_item4_verbatim: bilanRow.signal_item4_verbatim || '',
    signal_synthese:       bilanRow.signal_synthese || '',

    // §06 coûts (12 champs)
    cout1_niveau:     bilanRow.cout1_niveau || '',
    cout1_niveau_css: coutNiveauCss(bilanRow.cout1_niveau),
    cout1_titre:    bilanRow.cout1_titre || '',
    cout1_corps:    bilanRow.cout1_corps || '',
    cout1_verbatim: bilanRow.cout1_verbatim || '',
    cout2_niveau:     bilanRow.cout2_niveau || '',
    cout2_niveau_css: coutNiveauCss(bilanRow.cout2_niveau),
    cout2_titre:    bilanRow.cout2_titre || '',
    cout2_corps:    bilanRow.cout2_corps || '',
    cout2_verbatim: bilanRow.cout2_verbatim || '',
    cout3_niveau:     bilanRow.cout3_niveau || '',
    cout3_niveau_css: coutNiveauCss(bilanRow.cout3_niveau),
    cout3_titre:    bilanRow.cout3_titre || '',
    cout3_corps:    bilanRow.cout3_corps || '',
    cout3_verbatim: bilanRow.cout3_verbatim || '',

    // §07 signature
    sig_pilier_label:    bilanRow.sig_pilier_label || (socle ? `${socle.pilier_label} (${socle.pilier})` : ''),
    sig_filtre_val:      bilanRow.sig_filtre_val || bilanRow.filtre_label || '',
    sig_finalite:        bilanRow.sig_finalite || '',
    sig_resultat_ligne1: bilanRow.sig_resultat_ligne1 || '',
    sig_resultat_ligne2: bilanRow.sig_resultat_ligne2 || '',
    sig_recit_html:      bilanRow.sig_recit || '',
  };

  // §02bis Profil cognitif (le Soleil) — désérialisé depuis le champ JSON + HTML assemblé
  // Map pilier (P1..P5) → slot CSS (socle/str1/str2/fn1/fn2), assignation DYNAMIQUE qui gère
  // l'absence d'amont (str1 réutilisé par un fonctionnel) et le nombre variable de fonctionnels.
  const pilierToRoleCss = assignSlots(pilierRows);
  Object.assign(payload, buildSoleil(bilanRow.profil_cognitif_json, socle, bilanRow, pilierToRoleCss));

  logger.info('T3 Visu — payload assemblé', {
    candidat_id,
    nb_piliers: piliers.length,
    nb_circuits: (circuitRows || []).length,
  });

  return payload;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTRUCTION D'UN BLOC PILIER
// ═══════════════════════════════════════════════════════════════════════════

function buildPilierBlock(pr, circuits) {
  const pilier_lower = (pr.pilier || '').toLowerCase();
  const role = pr.role_pilier || 'fonctionnel';

  // Normaliser chaque circuit pour le template
  const circuitsNorm = circuits.map(c => normalizeCircuit(c, pr.pilier));

  // Regrouper par niveau d'usage (§2.12) sur l'échelle CŒUR
  const groupes = buildCircuitsGroupes(circuitsNorm);

  // Sous-listes pour les détails (HAUT / MOYEN / FAIBLE)
  const circuits_haut   = circuitsNorm.filter(c => c.niveau_cible === 'HAUT');
  const circuits_moyen  = circuitsNorm.filter(c => c.niveau_cible === 'MOYEN');
  const circuits_faible = circuitsNorm.filter(c => c.niveau_cible === 'FAIBLE');

  return {
    pilier:            pr.pilier,
    pilier_lower,
    is_socle:          role === 'socle',
    pilier_label:      pr.pilier_label,
    pilier_role:       ROLE_TO_SHORT[role] || 'fn2',          // pour class role-{{pilier_role}}
    role_class:        roleBadgeClass(role),                   // socle/str/fn pour ph-rb
    role_color_class:  ROLE_TO_CLASS[role] || 'role-fn2',
    pilier_role_label: pr.pilier_role_label || '',
    pilier_rappel:     pr.pilier_rappel || '',
    pilier_mode:       pr.pilier_mode || '',                   // §2.11 permanence : recopié tel quel

    circuits_groupes:  groupes,

    nb_activations_coeur:     sumCoeur(circuitsNorm),
    nb_activations_total:     pr.nb_activations != null ? pr.nb_activations : sumTotal(circuitsNorm),
    nb_circuits_actifs:       pr.nb_circuits_actifs != null ? pr.nb_circuits_actifs : circuitsNorm.length,
    nb_circuits_haut_coeur:   circuits_haut.length,
    nb_circuits_moyen_coeur:  circuits_moyen.length,
    cluster_label:            pr.cluster_label || '',
    cluster_detail:           pr.cluster_detail || '',
    signal_label:             extractSignalType(pr) || 'NULLE',

    // Blocs HTML reconstruits (le template les rend via {{{...}}})
    synth_factuelle_coeur_html:    escapeToHtml(pr.tableau_note || ''),
    synth_factuelle_elargie_html:  escapeToHtml(pr.synth_factuelle || ''),
    synth_interpretee_html:        escapeToHtml(pr.synth_interpretee || ''),
    note_doc_ouverte:              '',

    has_circuits_haut:   circuits_haut.length > 0,
    has_circuits_moyen:  circuits_moyen.length > 0,
    has_circuits_faible: circuits_faible.length > 0,
    circuits_haut,
    circuits_moyen,
    circuits_faible,
  };
}

// Normalise un circuit Airtable → objet template
function normalizeCircuit(c, pilier) {
  // v11.1 : circuit_freq = total cœur ; circuit_franches + circuit_nuancees = décomposition
  const nbCoeur = c.circuit_freq != null ? c.circuit_freq
                : (c.nb_coeur != null ? c.nb_coeur : 0);
  // Pour le total mobilisations (cœur + emprunts), à défaut on garde nbCoeur
  const nbTotal = c.circuit_freq_total != null ? c.circuit_freq_total
                : (c.nb_total != null ? c.nb_total : nbCoeur);
  const circuitId = c.circuit_id || '';
  const isAdhoc = circuitId === 'ADHOC' || c.circuit_id === 'ADHOC';

  // Niveau cible = échelle CŒUR (HAUT≥4, MOYEN 2-3, FAIBLE 1, instrumental cœur 0)
  let niveau_cible;
  if (isAdhoc)            niveau_cible = 'ADHOC';
  else if (nbCoeur >= 4)  niveau_cible = 'HAUT';
  else if (nbCoeur >= 2)  niveau_cible = 'MOYEN';
  else if (nbCoeur === 1) niveau_cible = 'FAIBLE';
  else                    niveau_cible = 'INSTRUMENTAL';

  const code_complet = isAdhoc
    ? `${pilier}·ADHOC`
    : `${pilier}${circuitId}`;

  const niveauStr = c.circuit_niveau || c.niveau || niveau_cible;
  const verbatimSrc = c.n2_verbatims || c.verbatim_source || '';

  // Ventilation par pilier (v6, 2026-06-01) — désormais stockée dans T3_CIRCUIT (champs en_svc_P*)
  // Affichage : le chiffre si > 0, sinon '·' (comme la démo). Total = cœur + somme des en_svc.
  const sv = {
    P1: c.en_svc_P1 || 0, P2: c.en_svc_P2 || 0, P3: c.en_svc_P3 || 0,
    P4: c.en_svc_P4 || 0, P5: c.en_svc_P5 || 0,
  };
  const sommeSvc = sv.P1 + sv.P2 + sv.P3 + sv.P4 + sv.P5;
  const nbTotalCalc = nbCoeur + sommeSvc;
  const dash = n => (n && n > 0 ? n : '·');

  return {
    code_complet,
    circuit_id:        circuitId,
    circuit_nom:       c.circuit_nom || '',
    is_adhoc:          isAdhoc,
    niveau_cible,
    niveau_lower:      niveauStr.toLowerCase(),
    circuit_niveau:    niveauStr,
    circuit_freq_coeur:nbCoeur,
    circuit_freq_total:(nbTotal && nbTotal > nbCoeur) ? nbTotal : nbTotalCalc,
    circuit_franches:  c.circuit_franches || 0,
    circuit_nuancees:  c.circuit_nuancees || 0,
    circuit_deborde:   nbTotalCalc > nbCoeur,
    // Ventilation par pilier — lue depuis T3_CIRCUIT (en_svc_P*), '·' si zéro
    ven_p1: dash(sv.P1), ven_p2: dash(sv.P2), ven_p3: dash(sv.P3), ven_p4: dash(sv.P4), ven_p5: dash(sv.P5),
    // Pour les détails
    verbatim_emblematique: extractVerbatim(verbatimSrc),
    verbatim_source:       extractVerbatimSource(verbatimSrc),
    personnalisation:      c.n3_nuance || c.interpretation || '',
  };
}

// Regroupe les circuits en groupes d'usage (§2.12)
function buildCircuitsGroupes(circuitsNorm) {
  const defs = [
    { id: 'haut',         filtre: c => c.niveau_cible === 'HAUT',         label: 'Gestes natifs dominants (cœur ≥ 4)',               expl: "L'identité forte de cet outil chez vous" },
    { id: 'moyen',        filtre: c => c.niveau_cible === 'MOYEN',        label: 'Gestes secondaires (cœur 2-3)',                    expl: 'Utilisés régulièrement, nuancent la signature' },
    { id: 'faible',       filtre: c => c.niveau_cible === 'FAIBLE',       label: 'Gestes ponctuels (cœur 1)',                        expl: 'Présents mais marginaux' },
    { id: 'instrumental', filtre: c => c.niveau_cible === 'INSTRUMENTAL', label: "Instrumentaux purs (cœur 0, en service d'autres outils)", expl: "Gestes mobilisés uniquement en service d'autres outils" },
    { id: 'adhoc',        filtre: c => c.niveau_cible === 'ADHOC',        label: 'Gestes ad-hoc',                                    expl: 'Détectés spécifiquement chez vous' },
  ];
  return defs
    .map(d => ({
      groupe_id: d.id,
      groupe_label: d.label,
      groupe_explication: d.expl,
      circuits: circuitsNorm.filter(d.filtre),
    }))
    .filter(g => g.circuits.length > 0);
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function sumCoeur(circuits)  { return circuits.reduce((s, c) => s + (c.circuit_freq_coeur || 0), 0); }
function sumTotal(circuits)  { return circuits.reduce((s, c) => s + (c.circuit_freq_total || 0), 0); }

function roleBadgeClass(role) {
  if (role === 'socle') return 'socle';
  if (role === 'amont' || role === 'aval') return 'str';
  if (role && role.startsWith('structurant')) return 'str'; // rétro-compat
  return 'fn';
}

// Extrait le type de signal depuis le champ rappel/synthese (best effort)
function extractSignalType(pr) {
  if (!pr) return '';
  const src = (pr.pilier_rappel || '') + ' ' + (pr.tableau_note || '');
  const m = src.match(/Signal\s+(FORTE|FAIBLE positif|FAIBLE négatif|NULLE)/i);
  return m ? m[1] : '';
}

// Le verbatim_source de T3_CIRCUIT a un format markdown :
//   "**P2Q6 PANNE** — P5 · ...\n> \"citation\""  OU  "P5Q15 ANIMAL_2 — « ... »..."
// On extrait la citation (entre « » ou guillemets droits) et la source (QID + scénario).
function extractVerbatim(raw) {
  if (!raw) return '';
  const mGuillemets = raw.match(/[«"]([^»"]+)[»"]/);
  if (mGuillemets) return mGuillemets[1].trim();
  return '';
}

function extractVerbatimSource(raw) {
  if (!raw) return '';
  const mQid = raw.match(/\*?\*?(P\d+Q\d+\s+[A-Z_0-9]+)/);
  if (mQid) return mQid[1].trim();
  return '';
}

// Le contenu Airtable est du texte avec \n. Le template attend du HTML (rendu via {{{}}}).
// On convertit les sauts de ligne en <br> et on échappe le minimum.
function escapeToHtml(txt) {
  if (!txt) return '';
  return String(txt)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n\n/g, '</p><p>')
    .replace(/\n/g, '<br>');
}

// ═══════════════════════════════════════════════════════════════════════════
// §02bis PROFIL COGNITIF — LE SOLEIL (v6, 2026-06-01)
// Désérialise le champ JSON profil_cognitif_json (écrit en bloc par l'agent) et
// assemble le HTML attendu par le template (profil_*). Reproduit la mise en page démo v5.5.
// Le payload NE CALCULE PAS le contenu : il lit l'objet généré par le prompt et le met en forme.
// ═══════════════════════════════════════════════════════════════════════════

// Mappe le niveau de coût (valeurs réelles : principal/secondaire/attention, ou variantes
// fort/élevé/modéré/moyen) vers une classe CSS définie dans le template (.cout-item.fort / .moyen).
// principal/fort/élevé → fort (rouge) ; le reste → moyen (orange).
function coutNiveauCss(niveau) {
  const n = String(niveau || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (!n) return 'moyen';
  if (n.includes('principal') || n.includes('fort') || n.includes('eleve') || n.includes('haut') || n.includes('majeur')) return 'fort';
  return 'moyen';
}

// échappe le texte pour insertion HTML (pas de \n→<br> ici, ce sont des libellés courts)
function esc(s) {
  if (s == null) return '';
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// rôle d'une branche → suffixe CSS (str1/str2/fn1/fn2) selon l'ordre des branches
const BRANCHE_ROLE_ORDER = ['str1', 'str2', 'fn1', 'fn2'];

// Rend un satellite (un circuit qui sert le socle) — bloc identique à la démo
function renderSatellite(sat, roleCss) {
  const coeur = sat.coeur_natif != null ? sat.coeur_natif : (sat.coeur != null ? sat.coeur : 0);
  const enSvc = sat.en_svc_socle != null ? sat.en_svc_socle : 0;
  const vb  = sat.verbatim_emblematique || sat.verbatim || '';
  const src = sat.verbatim_source || '';
  const perso = sat.personnalisation || '';
  return ''
    + `<div style="background:white;border:1px solid var(--role-${roleCss}-edge);border-left:3px solid var(--role-${roleCss});border-radius:4px;padding:10px 12px;margin-bottom:8px;">`
    +   `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:4px;">`
    +     `<div><strong style="font-family:var(--mono);font-size:11px;color:var(--role-${roleCss});">${esc(sat.code)}</strong> &nbsp;<span style="font-size:12px;color:var(--ink);font-weight:500;">${esc(sat.nom_catalogue)}</span></div>`
    +     `<div style="font-family:var(--mono);font-size:9px;color:var(--muted);white-space:nowrap;">cœur natif ${esc(coeur)} · au service du socle : <strong style="color:var(--role-${roleCss});">${esc(enSvc)}×</strong></div>`
    +   `</div>`
    +   (vb ? `<div style="font-size:11px;color:#4b5563;font-style:italic;line-height:1.5;margin-top:3px;">« ${esc(vb)} »<span style="font-family:var(--mono);font-size:9px;color:var(--muted);font-style:normal;"> — ${esc(src)}</span></div>` : '')
    +   (perso ? `<div style="font-size:11px;color:#374151;line-height:1.55;margin-top:3px;">${esc(perso)}</div>` : '')
    + `</div>`;
}

// Rend une branche complète (un pilier non-socle qui sert le socle)
function renderBranche(br, roleCss, roleLabel) {
  const sats = Array.isArray(br.satellites) ? br.satellites : [];
  const nb = sats.length;
  return ''
    + `<div style="background:var(--role-${roleCss}-bg);border:1.5px solid var(--role-${roleCss});border-radius:10px;padding:16px 20px;margin:12px auto;max-width:760px;box-shadow:0 2px 6px rgba(0,0,0,.05);">`
    +   `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px;">`
    +     `<div style="font-family:var(--mono);font-size:11px;text-transform:uppercase;letter-spacing:.12em;color:var(--role-${roleCss});font-weight:700;">☀ ${esc(br.pilier)} — ${esc(br.pilier_label)}</div>`
    +     `<div style="font-family:var(--mono);font-size:9px;text-transform:uppercase;letter-spacing:.1em;color:var(--role-${roleCss});background:white;padding:3px 10px;border-radius:3px;font-weight:600;border:1px solid var(--role-${roleCss}-edge);">${esc(roleLabel)} · ${nb} fonctionnalité${nb > 1 ? 's' : ''} au service du socle</div>`
    +   `</div>`
    +   (br.pilier_role_dans_socle ? `<div style="font-size:12px;color:#374151;font-style:italic;margin-bottom:12px;line-height:1.55;background:white;padding:8px 12px;border-radius:4px;border-left:2px solid var(--role-${roleCss});">${esc(br.pilier_role_dans_socle)}</div>` : '')
    +   `<div>${sats.map(s => renderSatellite(s, roleCss)).join('')}</div>`
    + `</div>`;
}

// Rend la liste des circuits cœur du centre (zone haute) — un bloc par circuit
function renderCentreCircuits(arr) {
  if (!Array.isArray(arr) || arr.length === 0) return '';
  return arr.map(c => {
    const coeur = c.coeur != null ? c.coeur : 0;
    const vb = c.verbatim_emblematique || c.verbatim || '';
    const src = c.verbatim_source || '';
    const perso = c.personnalisation || '';
    return ''
      + `<div style="background:white;border:1px solid var(--role-socle-edge);border-left:3px solid var(--role-socle);border-radius:4px;padding:10px 12px;margin-bottom:8px;">`
      +   `<div style="display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:4px;">`
      +     `<div><strong style="font-family:var(--mono);font-size:11px;color:var(--role-socle);">${esc(c.code)}</strong> &nbsp;<span style="font-size:12px;color:var(--ink);font-weight:500;">${esc(c.nom_catalogue)}</span></div>`
      +     `<div style="font-family:var(--mono);font-size:9px;color:var(--muted);white-space:nowrap;">cœur <strong style="color:var(--role-socle);">${esc(coeur)}</strong></div>`
      +   `</div>`
      +   (vb ? `<div style="font-size:11px;color:#4b5563;font-style:italic;line-height:1.5;margin-top:3px;">« ${esc(vb)} »<span style="font-family:var(--mono);font-size:9px;color:var(--muted);font-style:normal;"> — ${esc(src)}</span></div>` : '')
      +   (perso ? `<div style="font-size:11px;color:#374151;line-height:1.55;margin-top:3px;">${esc(perso)}</div>` : '')
      + `</div>`;
  }).join('');
}

/**
 * Assemble les clés profil_* du template depuis le JSON §02bis.
 * @param {string} jsonStr  contenu de bilanRow.profil_cognitif_json
 * @param {Object} socle    objet pilier socle (pour code/label de secours)
 * @param {Object} bilanRow ligne bilan (pour filtre_label de secours)
 */
function buildSoleil(jsonStr, socle, bilanRow, pilierToRoleCss) {
  const out = {
    profil_intro: '',
    profil_centre_coeur_html: '',
    profil_centre_sortants_html: '',
    profil_branche_tandem_html: '',
    profil_branche_str2_html: '',
    profil_branche_fn1_html: '',
    profil_branche_fn2_html: '',
    profil_bloc1_circuits_haut: [],
    profil_bloc1_circuits_moyen: [],
    profil_tandem: null,
    profil_conclusion_cycle: '',
  };
  if (!jsonStr) return out;

  let p;
  try {
    p = JSON.parse(jsonStr);
    if (p && p['§02bis_profil_cognitif']) p = p['§02bis_profil_cognitif'];
    if (p && p.bilan && p.bilan['§02bis_profil_cognitif']) p = p.bilan['§02bis_profil_cognitif'];
  } catch (e) {
    logger.warn('T3 Visu — profil_cognitif_json illisible (JSON.parse)', { error: e.message });
    return out;
  }
  if (!p || typeof p !== 'object') return out;

  const roleMap = pilierToRoleCss || {};

  // ─── Intro ── (prompt : "intro")
  out.profil_intro = asText(p.intro || p.introduction || '');

  // ─── Conclusion du cycle ── (prompt : string ; on gère aussi l'objet par sécurité)
  out.profil_conclusion_cycle = renderConclusionCycle(p.conclusion_cycle);

  // ─── Centre — circuits cœur du socle ── (prompt : bloc1_circuits_haut/moyen/faible)
  const haut   = Array.isArray(p.bloc1_circuits_haut)   ? p.bloc1_circuits_haut   : [];
  const moyen  = Array.isArray(p.bloc1_circuits_moyen)  ? p.bloc1_circuits_moyen  : [];
  const faible = Array.isArray(p.bloc1_circuits_faible) ? p.bloc1_circuits_faible : [];
  out.profil_bloc1_circuits_haut  = haut;
  out.profil_bloc1_circuits_moyen = moyen;
  out.profil_centre_coeur_html = renderCentreCircuits([...haut, ...moyen, ...faible]);

  // Zone basse (sortants) : portée par les branches ; on met l'intro de bloc1 si présente.
  out.profil_centre_sortants_html = p.bloc1_socle_intro
    ? `<div style="font-size:12px;color:#374151;line-height:1.6;">${esc(p.bloc1_socle_intro)}</div>`
    : '';

  // ─── Branches — bloc2_par_pilier ── placées dans le bon slot du template selon le rôle réel du pilier.
  const branches = Array.isArray(p.bloc2_par_pilier) ? p.bloc2_par_pilier : [];
  const ROLE_LABELS = { str1: 'Amont', str2: 'Aval', fn1: 'Fonctionnel', fn2: 'Fonctionnel' };
  let fallbackIdx = 0;
  const SLOTS = ['str1', 'str2', 'fn1', 'fn2'];
  branches.forEach(br => {
    // rôle réel du pilier de la branche ; sinon on prend le prochain slot libre
    let roleCss = roleMap[br.pilier];
    if (!roleCss || roleCss === 'socle' || !SLOTS.includes(roleCss)) {
      roleCss = SLOTS[fallbackIdx] || 'fn2';
    }
    const html = renderBranche(br, roleCss, ROLE_LABELS[roleCss] || 'Satellite');
    if (roleCss === 'str1')      out.profil_branche_tandem_html = html;
    else if (roleCss === 'str2') out.profil_branche_str2_html  = html;
    else if (roleCss === 'fn1')  out.profil_branche_fn1_html   = html;
    else if (roleCss === 'fn2')  out.profil_branche_fn2_html   = html;
    fallbackIdx++;
  });

  // ─── Tandem socle ↔ P5 ── (prompt : tandem_socle_p5)
  if (p.tandem_socle_p5 && typeof p.tandem_socle_p5 === 'object') {
    const t = p.tandem_socle_p5;
    out.profil_tandem = {
      label: asText(t.label || ''),
      asymetrie_lecture: asText(t.asymetrie_lecture || ''),
      socle_vers_p5_count: t.socle_vers_p5_count != null ? t.socle_vers_p5_count : 0,
      socle_vers_p5_plural: (t.socle_vers_p5_count || 0) > 1,
      p5_vers_socle_count: t.p5_vers_socle_count != null ? t.p5_vers_socle_count : 0,
      p5_vers_socle_plural: (t.p5_vers_socle_count || 0) > 1,
      circuit_pont_socle_vers_p5: t.circuit_pont_socle_vers_p5 || null,
    };
  }

  return out;
}

// Assemble conclusion_cycle en STRING HTML (gère string OU objet, jamais [object Object]).
function renderConclusionCycle(cc) {
  if (!cc) return '';
  if (typeof cc === 'string') return esc(cc);
  if (typeof cc !== 'object') return esc(String(cc));
  const parts = [];
  if (cc.cycle_complet)      parts.push(`<div style="font-family:var(--mono);font-size:12px;color:rgba(255,255,255,.85);margin-bottom:8px;">${esc(cc.cycle_complet)}</div>`);
  if (cc.lecture)            parts.push(`<div style="margin-bottom:8px;">${esc(cc.lecture)}</div>`);
  if (cc.force_structurelle) parts.push(`<div style="margin-bottom:8px;"><strong>Force structurelle —</strong> ${esc(cc.force_structurelle)}</div>`);
  if (cc.point_de_vigilance) parts.push(`<div><strong>Point de vigilance —</strong> ${esc(cc.point_de_vigilance)}</div>`);
  return parts.join('') || esc(asText(cc));
}

// Convertit n'importe quelle valeur (string/objet/array) en texte sûr (garde-fou anti-[object Object]).
function asText(v) {
  if (v == null) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(asText).filter(Boolean).join(' · ');
  if (typeof v === 'object') return Object.values(v).map(asText).filter(Boolean).join(' — ');
  return String(v);
}

module.exports = {
  buildPayload,
  // exposés pour tests
  _internal: {
    buildPilierBlock,
    normalizeCircuit,
    buildCircuitsGroupes,
    extractVerbatim,
    extractVerbatimSource,
    buildSoleil,
    renderBranche,
    renderSatellite,
    renderCentreCircuits,
  },
};
