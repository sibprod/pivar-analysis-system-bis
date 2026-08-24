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
  DESALIGNEMENT:        'BILAN_DESALIGNEMENT',
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

module.exports = {
  getReferentielProfilVsPilier,
  getReferentielTestEquivalentPro,
  getBilanDesalignement,
  getBilan4Profil,
  upsertGrilleReferent,
  insertVerbalisations,
  TABLES
};
