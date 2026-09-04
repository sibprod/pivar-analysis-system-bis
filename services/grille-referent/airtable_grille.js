// ⟦LOT 2026-09-04 ab⟧ airtable_grille.js — accès Airtable du module grille · correctif DESALIGNEMENT par ID (jurisprudence 04/09)
// services/grille-referent/airtable_grille.js
// Les lecteurs des tables propres à la grille référent.
//
// Pourquoi un fichier séparé : airtableService.js couvre les tables du protocole.
// Les trois référentiels de la grille et la ligne de rendu sont nouveaux — les
// isoler ici évite de toucher un fichier de 93 Ko et garde la greffe réversible.
// Si l'usage se confirme, ces fonctions ont vocation à rejoindre airtableService.
//
// LECTURE SEULE sur les référentiels : ils sont le cadre, ils ne se modifient
// jamais depuis le flux d'analyse.
//
'use strict';

const Airtable       = require('airtable');
const airtableConfig = require('../../config/airtable');
const logger         = require('../../utils/logger');

// MÊME configuration que airtableService : on passe par config/airtable
// (TOKEN + BASE_ID), jamais par process.env en direct — sinon deux sources de
// vérité pour une même connexion, et une panne le jour où l'une des deux change.
let _base = null;
function getBase() {
  if (!_base) {
    _base = new Airtable({ apiKey: airtableConfig.TOKEN }).base(airtableConfig.BASE_ID);
  }
  return _base;
}

const TABLES = {
  REF_PROFIL_VS_PILIER: 'REFERENTIEL_PROFIL_VS_PILIER(bilan pro)',
  REF_TEST_EQUIVALENT:  'REFERENTIEL_TEST_EQUIVALENT_PRO',
  // ⟦LOT 2026-09-04 ab⟧ correctif : la table a été renommée « archive_BILAN_DESALIGNEMENT »
  // le 04/09, l'appel PAR NOM a rendu 403 (« not authorized ») et bloqué les 4 grilles.
  // On référence PAR ID — insensible aux renommages (doctrine D-AIRTABLE).
  DESALIGNEMENT:        'tbluJprmh9AJEJ6qQ',
  BILAN4:               'ETAPE2_BILAN4EXCELLENCES',
  GRILLE_REFERENT:      'GRILLE_REFERENT',
  VERBALISATION:        'GRILLE_VERBALISATION'
};

function val(v) { return (v && (v.name !== undefined ? v.name : v)) || ''; }
function puces(t) {
  return String(t || '').split('\n').map(x => x.replace(/^•\s*/, '').trim()).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════════════
// LES TROIS RÉFÉRENTIELS — chargés intégralement, ils sont le cadre de l'agent
// ═══════════════════════════════════════════════════════════════════════════

/** Les 45 tuiles socle × type. */
async function getReferentielProfilVsPilier() {
  try {
    const records = await getBase()(TABLES.REF_PROFIL_VS_PILIER).select().all();
    return records.map(r => {
      const f = r.fields || {};
      return {
        cle:                  f['cle'] || '',
        socle:                val(f['socle']),
        type:                 val(f['type']),
        zone:                 val(f['zone']),
        titre:                f['titre'] || '',
        definition_type:      val(f['definition_type']),
        application_au_socle: f['application_au_socle'] || '',
        atouts:               puces(f['atouts']),
        couts:                puces(f['couts']),
        statut:               val(f['statut'])
      };
    });
  } catch (error) {
    logger.error('Grille — échec lecture REFERENTIEL_PROFIL_VS_PILIER', { error: error.message });
    throw error;
  }
}

/** Les 25 équivalences test → monde du travail (R2). */
async function getReferentielTestEquivalentPro() {
  try {
    const records = await getBase()(TABLES.REF_TEST_EQUIVALENT).select().all();
    return records.map(r => {
      const f = r.fields || {};
      return {
        cle:                        f['cle'] || '',
        contexte_test:              val(f['contexte_test']),
        outil:                      val(f['outil']),
        id_question:                f['id_question'] || '',
        libelle_pro_court:          val(f['libelle_pro_court']),   // R2 · nommer la situation
        // ── La clé de transposition (pièce 09) — ce qui manquait ──
        equivalent_pro_contexte:    val(f['equivalent_pro_contexte']),
        contrainte_contexte:        val(f['contrainte_contexte']),
        ce_que_le_test_demande:     f['ce_que_le_test_demande'] || '',
        ce_que_ca_donne_au_travail: f['ce_que_ca_donne_au_travail'] || '',
        situation_test:             f['situation_test'] || ''
      };
    });
  } catch (error) {
    logger.error('Grille — échec lecture REFERENTIEL_TEST_EQUIVALENT_PRO', { error: error.message });
    throw error;
  }
}

/** Le référentiel générique des désalignements, par outil. */
async function getBilanDesalignement() {
  try {
    const records = await getBase()(TABLES.DESALIGNEMENT)
      .select({ filterByFormula: '{actif} = 1' })
      .all();
    return records.map(r => {
      const f = r.fields || {};
      // ⚠️ Le contenu_json de cette table est indenté avec des ESPACES INSÉCABLES
      //    (U+00A0). Ce n'est pas un caractère d'espacement valide en JSON :
      //    JSON.parse échoue silencieusement et le contenu reste une chaîne.
      //    Résultat le 24/08 : zéro item transmis à la sélection, aucun point
      //    d'attention produit, et une grille écrite en base sans son bloc 4.
      //    On normalise avant d'analyser, et on garde un repli si l'analyse échoue.
      let contenu = f['contenu_json'];
      if (typeof contenu === 'string') {
        const propre = contenu
          .replace(/\u00a0/g, ' ')      // espace insécable
          .replace(/\u202f/g, ' ')      // espace fine insécable
          .replace(/\u2028|\u2029/g, '\n');
        try {
          contenu = JSON.parse(propre);
        } catch (e) {
          // Repli : on extrait les items entre guillemets, ligne à ligne.
          const items = (propre.match(/"([^"]{4,})"/g) || [])
            .map(s => s.slice(1, -1))
            .filter(s => s !== 'items');
          logger.warn('Désalignement — contenu_json illisible, extraction de secours', {
            pilier: val(f['pilier']), bloc_type: val(f['bloc_type']), items: items.length
          });
          contenu = { items };
        }
      }
      return {
        pilier:    val(f['pilier']),
        bloc_type: val(f['bloc_type']),
        sous_bloc: val(f['sous_bloc']),
        contenu
      };
    });
  } catch (error) {
    logger.error('Grille — échec lecture BILAN_DESALIGNEMENT', { error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LE PROFIL DU CANDIDAT — type, zone et textes de synthèse
// ═══════════════════════════════════════════════════════════════════════════
async function getBilan4Profil(candidat_id) {
  try {
    const records = await getBase()(TABLES.BILAN4)
      .select({ filterByFormula: `{candidat_id} = "${candidat_id}"`, maxRecords: 1 })
      .firstPage();
    if (!records.length) return null;
    const f = records[0].fields || {};
    return {
      airtable_id:       records[0].id,
      type_cognitif:     val(f['type_cognitif']),
      type_complet:      f['type_complet'] || '',
      type_ecarte:       f['type_ecarte']  || '',
      portrait_un_mot:   f['portrait_un_mot'] || '',
      // ── LES QUATRE NIVEAUX DE DIMENSION — déjà fusionnés post-test ──
      // La chaîne agent_etape2_c_TESTDEC met le bilan à jour quand le test
      // complémentaire est passé. C'est donc ICI que les niveaux font foi,
      // pas dans RESPONSES_ETAPE2_ EXCELLENCE, qui garde la mesure d'origine.
      // Vérifié sur deux candidats : les comptages correspondent exactement.
      // ⚠️ Le SDK Airtable indexe les champs par NOM — jamais par identifiant
      //    fld… : les anciennes clés renvoyaient du vide en silence, et les
      //    noms de secours étaient supposés. Noms PROUVÉS en base le 26/08
      //    (résolution nom → identifiant vérifiée sur candidat réel) :
      niv_anticipation:  f['ANT_densite'] || '',       // fldHMPW083IKtUMb3
      niv_vue:           f['VUE_densite'] || '',       // fldFyU6yc1bnFsRtJ
      niv_decentration:  f['DEC_densite'] || '',       // fld05ugiziwG3jMZY
      niv_metacognition: f['MET_densite'] || '',       // fldRLNC7YpPtXy9Pv
      ordre_dimensions:  f['ordre_excellences'] || '', // même champ que ci-dessous
      combinaison:       f['combinaison'] || '',
      reserves_globales: f['reserves_globales'] || '',
      ordre_excellences: f['ordre_excellences'] || ''
    };
  } catch (error) {
    logger.error('Grille — échec lecture ETAPE2_BILAN4EXCELLENCES', { candidat_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ÉCRITURE — la grille produite et ses verbalisations
// ═══════════════════════════════════════════════════════════════════════════

/** Écrit ou remplace la grille du candidat. Le rendu est CONSERVÉ, jamais régénéré. */
async function upsertGrilleReferent(candidat_id, champs) {
  try {
    const base = getBase();
    const existants = await base(TABLES.GRILLE_REFERENT)
      .select({ filterByFormula: `{candidat_id} = "${candidat_id}"`, maxRecords: 1 })
      .firstPage();
    const payload = { candidat_id, ...champs };

    // typecast : Airtable refuse une valeur de liste déroulante qui ne correspond
    // pas EXACTEMENT à un choix configuré — un espace en trop dans un libellé
    // suffit à faire échouer l'écriture. Sans cette tolérance, un détail de
    // configuration ferait tomber une production entière. L'écart reste visible
    // en base (un choix supplémentaire apparaît) : il se voit et se corrige.
    const OPTIONS = { typecast: true };

    if (existants.length) {
      await base(TABLES.GRILLE_REFERENT).update([{ id: existants[0].id, fields: payload }], OPTIONS);
      logger.info('Grille référent — mise à jour', { candidat_id });
    } else {
      await base(TABLES.GRILLE_REFERENT).create([{ fields: payload }], OPTIONS);
      logger.info('Grille référent — créée', { candidat_id });
    }
    return true;
  } catch (error) {
    logger.error('Grille — échec écriture GRILLE_REFERENT', { candidat_id, error: error.message });
    throw error;
  }
}

/**
 * Écrit les verbalisations d'ajustement (R8).
 * Une grille sans sa verbalisation d'ajustements n'est pas validable.
 */
async function insertVerbalisations(candidat_id, lignes) {
  if (!lignes || !lignes.length) return 0;
  try {
    const base = getBase();
    const horodatage = new Date().toISOString();
    const records = lignes.map(l => ({ fields: {
      candidat_id,
      cle_tuile:           l.cle_tuile || '',
      version_referentiel: l.version_referentiel || '',
      element_concerne:    l.element_concerne || '',
      verdict:             l.verdict || '',
      motif_et_preuve:     l.motif_et_preuve || '',
      formulation_retenue: l.formulation_retenue || '',
      elements_ecartes:    l.elements_ecartes || '',
      horodatage
    }}));
    for (let i = 0; i < records.length; i += 10) {
      await base(TABLES.VERBALISATION).create(records.slice(i, i + 10), { typecast: true });
    }
    logger.info('Grille — verbalisations écrites', { candidat_id, count: records.length });
    return records.length;
  } catch (error) {
    logger.error('Grille — échec écriture GRILLE_VERBALISATION', { candidat_id, error: error.message });
    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// LE TEST COMPLÉMENTAIRE DE DÉCENTRATION — tblA6VvPlrTbPWuQG
//
// LA DÉCENTRATION A DEUX MESURES, et les deux comptent :
//   1. la fenêtre principale — RESPONSES_ETAPE2_ EXCELLENCE
//      (Rémi : « Non évalué — test à passer » · Véronique : « 8/20 — posé avec
//       réserve » · Cécile : « 11/20 »)
//   2. le test complémentaire — CETTE TABLE
//      (Rémi : 1/4 OBSERVÉE · Véronique : 2/4 MOYENNE)
//
// ETAPE2_BILAN4EXCELLENCES porte leur FUSION, et la cite explicitement :
//   « OBSERVÉE (1/4 — test complémentaire ; fenêtre principale : non évaluée) »
//
// ⛔ DEUX CHAMPS NE SORTENT JAMAIS
//    fldImdWGAFOt0isZb — verbatims bruts du candidat (D-PREUVE)
//    fldmsBtAXDECwV0Fl — journal de laboratoire : fréquences, verdicts internes,
//                        prénoms de scénario (D95)
// ═══════════════════════════════════════════════════════════════════════════
const T_DECENTRATION = 'tblA6VvPlrTbPWuQG';
const F_DEC = {
  // ⚠️ Le SDK Airtable indexe les champs par NOM — jamais par identifiant fld….
  //    Noms PROUVÉS en base le 26/08 (résolution nom → identifiant vérifiée) ;
  //    les identifiants restent en commentaire pour la traçabilité.
  candidat:    'candidat_id',          // fldLE2jxEAd6S96uC
  niveau:      'A_sur_10',             // fldITxKSvyuFvzZnI — 1 à 4
  libelle:     'niveau_global',        // fldEARFIM9tl974iT — « 2/4 — mesuré par le test complémentaire »
  regime:      'pattern',              // flddOosL6deFoEo7H — « ANCRÉE EN RÉGIME MODÉRÉ »
  intensite:   'niveau_densite',       // fldS5KkaaJgH10SRS — MOYENNE · FAIBLE
  synthese:    'synthese',             // fldeYyzP6sTRDb8iT — l'analyse complète
  ce_qui_est:  'portrait_excellence',  // fld0NcuYf7uYf93rT — ce qu'il fait · ce qui reste à explorer
  declencheur: 'declencheur',          // fldDQ9wHHZGKh8ZOQ — quand cela s'active, quand cela faiblit
  gradient:    'gradient'              // fldBv7tvjxsCi4Emm — là où c'est solide, là où ça cède
};

/**
 * La seconde mesure de la décentration, si le test complémentaire a été passé.
 * @returns {Object|null} null si le test n'a pas été passé — ce n'est pas une
 *                        anomalie : il n'est demandé que lorsque la fenêtre
 *                        principale reste sous le seuil.
 */
async function getTestDecentration(candidat_id) {
  try {
    const records = await getBase()(T_DECENTRATION)
      .select({ filterByFormula: `{${F_DEC.candidat}} = "${candidat_id}"`, maxRecords: 1 })
      .firstPage();
    if (!records.length) return null;
    const f = records[0].fields || {};
    return {
      niveau:      f[F_DEC.niveau] ?? null,
      libelle:     val(f[F_DEC.libelle]),
      regime:      val(f[F_DEC.regime]),
      intensite:   val(f[F_DEC.intensite]),
      synthese:    f[F_DEC.synthese]    || '',
      ce_qui_est:  f[F_DEC.ce_qui_est]  || '',
      declencheur: f[F_DEC.declencheur] || '',
      gradient:    f[F_DEC.gradient]    || ''
    };
  } catch (e) {
    logger.warn('Test complémentaire de décentration — lecture impossible', {
      candidat_id, error: e.message,
      consequence: 'seule la fenêtre principale sera lue'
    });
    return null;
  }
}

module.exports = {
  getTestDecentration,
  getReferentielProfilVsPilier,
  getReferentielTestEquivalentPro,
  getBilanDesalignement,
  getBilan4Profil,
  upsertGrilleReferent,
  insertVerbalisations,
  TABLES
};
