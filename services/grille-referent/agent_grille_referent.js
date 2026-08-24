// services/grille-referent/agent_grille_referent.js
// Les quatre agents de la grille référent, et l'assemblage de leurs sorties.
//
// ⚠️ AVANT MODIFICATION : lire docs/12-doctrine-preuve-et-mission-agent-grille.md
//                          et docs/16-plan-correction-grille-en-etapes.md
//
// POURQUOI QUATRE AGENTS ET NON UN SEUL
//   Le passage du 20/08 avec un agent unique a produit 51 991 jetons en quinze
//   minutes — 81 % du plafond. Il a bâclé ce qu'il traitait en dernier : les
//   cinq synthèses sont sorties vides et les gestes hors socle dégénérés.
//   Un agent = une mission concentrée (D115). Chacun tient largement dans sa
//   capacité, et une itération ne coûte plus que le quart.
//
// Ce fichier n'écrit AUCUN contenu : il appelle, il normalise, il assemble.
//
'use strict';

const agentBase = require('../infrastructure/agentBase');
const logger    = require('../../utils/logger');

const RACINE = 'grille-referent/';

// Les quatre missions, dans l'ordre d'exécution.
const MISSIONS = [
  { cle: 'PROFIL',     service: 'agent_grille_profil',     prompt: 'prompt_1_profil.md' },
  { cle: 'APPORT',     service: 'agent_grille_apport',     prompt: 'prompt_2_apport.md' },
  { cle: 'DIMENSIONS', service: 'agent_grille_dimensions', prompt: 'prompt_3_dimensions.md' },
  // ⭐ Les vigilances en DEUX missions (21/08) : un agent unique devait
  // sélectionner (jugement, comparatif) ET rédiger (composition). Son
  // raisonnement a consommé tout son quota avant qu'une ligne ne sorte — 27 330
  // caractères de thinking, zéro texte, mission perdue. Deux métiers dans un
  // agent, c'est D115 violé ; relever le plafond n'aurait fait que repousser
  // le mur. La rédaction reçoit la sélection : elle n'a plus à juger.
  { cle: 'SELECTION',  service: 'agent_grille_selection',  prompt: 'prompt_4a_selection.md' },
  { cle: 'VIGILANCES', service: 'agent_grille_redaction',  prompt: 'prompt_4b_redaction.md',
    depend: 'SELECTION' },
  // ⭐ Mission séparée (20/08) : deux passages ont laissé les synthèses vides
  // parce que l'agent du profil avait autre chose à faire et a sauté la recopie.
  // Isolée, elle ne peut plus être esquivée — c'est le seul travail de cet agent.
  { cle: 'SYNTHESES',  service: 'agent_grille_syntheses',  prompt: 'prompt_5_syntheses.md' }
];

function tab(v) { return Array.isArray(v) ? v : []; }

/**
 * Aplatit le référentiel de désalignement en une liste numérotée.
 * Chaque ligne du référentiel porte une liste d'items ; on les déplie tous,
 * en conservant leur outil et leur famille.
 */
function aplatirReferentiel(desalignement) {
  const items = [];
  for (const ligne of tab(desalignement)) {
    const c = ligne.contenu;
    const liste = Array.isArray(c) ? c : (c && Array.isArray(c.items) ? c.items : []);
    const famille = /INJONCTION/i.test(String(ligne.bloc_type || '')) ? 'injonction'
                  : /IMPACT/i.test(String(ligne.bloc_type || ''))     ? 'specifique'
                  : 'general';
    for (const texte of liste) {
      if (String(texte || '').trim()) {
        items.push({ i: items.length + 1, outil: ligne.pilier, bloc_type: ligne.bloc_type, famille, texte });
      }
    }
  }
  return items;
}

/**
 * Réattache à chaque numéro retenu son énoncé d'origine, tel qu'il est en base.
 * C'est ce qui garantit que `item_origine` est EXACT : l'agent n'a jamais eu à
 * le recopier, donc il n'a pas pu le déformer.
 */
function rehydrater(retenus, items) {
  const parNumero = {};
  for (const it of items) parNumero[it.i] = it;
  return tab(retenus).map(r => {
    const src = parNumero[r.i] || parNumero[Number(r.i)];
    if (!src) return null;
    return {
      item_origine: src.texte,
      bloc_type:    src.bloc_type,
      outil:        src.outil,
      famille:      src.famille,
      ancrage:      r.ancrage || ''
    };
  }).filter(Boolean);
}

// ═══════════════════════════════════════════════════════════════════════════
// LA MATIÈRE DE CHAQUE MISSION
// Chaque agent ne reçoit QUE ce dont il a besoin. Lui donner le reste, c'est
// le noyer — et c'est ce qui a fait dépasser sa capacité à l'agent unique.
// ═══════════════════════════════════════════════════════════════════════════
function payloadPour(cle, p, acquis = {}) {
  const commun = {
    candidat_id: p.candidat_id,
    civilite:    p.civilite,
    referentiels: {
      libelles_canoniques:    p.referentiels.libelles_canoniques,
      questions_par_contexte: p.referentiels.questions_par_contexte
    }
  };

  switch (cle) {
    case 'PROFIL':
      return { ...commun,
        socle:   p.socle,
        piliers: p.piliers,
        profil:  { tuile: { titre: p.profil.tuile.titre, zone: p.profil.tuile.zone } },
        dimensions: (p.dimensions || []).map(d => ({ excellence: d.excellence, niveau_global: d.niveau_global }))
      };

    case 'APPORT':
      return { ...commun,
        profil: {
          cle_tuile:    p.profil.cle_tuile,
          type_ecarte:  p.profil.type_ecarte,
          tuile:        p.profil.tuile
        },
        // Seules les synthèses de l'amont et de l'aval : c'est de là que naît
        // le paragraphe « ce que sa chaîne y ajoute ».
        chaine: (p.piliers || [])
          .filter(x => /amont|aval/i.test(x.role || ''))
          .map(x => ({ role: x.role, libelle: x.libelle, mode: x.mode, synthese: x.synthese })),
        socle: { libelle: p.socle.libelle, filtre: p.socle.filtre }
      };

    case 'DIMENSIONS':
      return { ...commun,
        dimensions: p.dimensions,
        synthese_dimensions: { portrait_un_mot: p.synthese_dimensions.portrait_un_mot },
        // Les registres affectifs : « ce qui le porte, ce qui le freine ».
        // Transmis depuis la correction du nom de champ (registres, pas
        // ch3_signal_registres) — et désormais COMMANDÉS, ce qui manquait.
        registres: p.registres_affectifs || ''
      };

    case 'SELECTION':
      return { ...commun,
        // ⚠️ Le référentiel n'est PAS envoyé tel quel : chaque ligne contient une
        //    LISTE de dix à douze items, soit ~200 items au total. Demander à
        //    l'agent de les citer mot pour mot produisait 50 000 caractères et
        //    saturait sa capacité — trois passages perdus là-dessus.
        //    On les aplatit et on les NUMÉROTE : l'agent ne renvoie que des
        //    numéros. Sa sortie tient en quelques lignes, et l'énoncé d'origine
        //    est réattaché ici, à l'identique — plus aucune citation approximative
        //    n'est possible.
        items: aplatirReferentiel(p.referentiels.desalignement),
        // …et de quoi vérifier l'ancrage chez CE candidat.
        piliers: (p.piliers || []).map(x => ({
          pilier: x.pilier, libelle: x.libelle, mode: x.mode,
          gestes: (x.gestes || []).map(g => g.narration)
        })),
        socle: { libelle: p.socle.libelle, filtre: p.socle.filtre }
      };

    case 'VIGILANCES':
      // La rédaction reçoit le résultat de la sélection — pas le référentiel.
      // Elle n'a plus à juger : elle écrit ce qui a été retenu.
      return { ...commun,
        retenus: rehydrater((acquis.SELECTION || {}).retenus,
                            aplatirReferentiel(p.referentiels.desalignement)),
        piliers: (p.piliers || []).map(x => ({
          pilier: x.pilier, libelle: x.libelle, mode: x.mode,
          gestes: (x.gestes || []).map(g => g.narration)
        })),
        socle: { libelle: p.socle.libelle, filtre: p.socle.filtre }
      };

    case 'SYNTHESES':
      // Rien que les cinq textes à transposer. Aucune autre matière : c'est ce
      // qui rend la tâche inesquivable.
      return { ...commun,
        syntheses: (p.piliers || []).map(x => ({
          pilier: x.pilier, libelle: x.libelle, synthese: x.synthese
        })).filter(x => x.synthese)
      };

    default:
      return commun;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
async function executerMission(mission, payloadComplet, acquis = {}) {
  const candidat_id = payloadComplet.candidat_id;
  const payload = payloadPour(mission.cle, payloadComplet, acquis);
  let sortie = null, cout = 0;

  // Deux tentatives — SAUF si l'échec est définitif.
  // Une troncature par dépassement de capacité se reproduira à l'identique :
  // réessayer coûte cinq minutes pour rien. Le 21/08, l'agent des vigilances a
  // ainsi brûlé deux tentatives sur le même mur alors que le diagnostic disait
  // « retry inutile, le prompt doit être réduit ».
  const DEFINITIF = /max_tokens|output_truncated|tronqué|no text content/i;
  for (let essai = 1; essai <= 2 && sortie === null; essai++) {
    try {
      const res = await agentBase.callAgent({
        serviceName: mission.service,
        promptPath:  RACINE + mission.prompt,
        payload,
        candidatId:  candidat_id
      });
      cout += res.cost || 0;
      sortie = res.result;
    } catch (e) {
      logger.warn(`Grille · ${mission.cle} — sortie illisible`, { candidat_id, essai, error: e.message });
      if (DEFINITIF.test(e.message || '')) {
        logger.error(`Grille · ${mission.cle} — échec définitif, seconde tentative abandonnée`, {
          candidat_id,
          action: `relever max_tokens de ${mission.service} dans config/claude.js, ou alléger sa commande`
        });
        break;
      }
    }
  }

  if (!sortie) {
    logger.error(`Grille · ${mission.cle} — aucune sortie exploitable`, { candidat_id });
    return { cle: mission.cle, contenu: null, cost: cout };
  }

  // L'agent peut envelopper sa réponse sous la clé de sa mission, ou non.
  const contenu = sortie[mission.cle] || sortie[mission.cle.toLowerCase()] || sortie;

  // La sélection déclare combien d'items elle a parcourus. Si elle en a examiné
  // moins qu'il n'y en a, elle s'est arrêtée en route — et des points d'attention
  // manquent SANS que rien ne le signale. C'est le genre d'échec silencieux qui
  // coûte des jours : on le rend visible ici.
  if (mission.cle === 'SELECTION') {
    const attendus = (payload.items || []).length;
    const vus = Number(contenu.items_examines || 0);
    const retenus = (contenu.retenus || []).length;
    if (attendus && vus < attendus) {
      logger.warn('Grille · SELECTION — référentiel parcouru en partie', {
        candidat_id, examines: vus, attendus,
        consequence: 'des points d\'attention peuvent manquer'
      });
    }
    logger.info('Grille · SELECTION — bilan', { candidat_id, attendus, examines: vus, retenus });
  }

  logger.info(`Grille · ${mission.cle} — reçu`, { candidat_id, cost_usd: cout.toFixed(4) });
  return { cle: mission.cle, contenu, cost: cout };
}

// ═══════════════════════════════════════════════════════════════════════════
// L'ASSEMBLAGE
// On ne complète RIEN : un bloc absent reste absent et sera vu par les
// contrôles. Le combler ici masquerait la défaillance d'un agent.
// ═══════════════════════════════════════════════════════════════════════════
function assembler(resultats, payload) {
  const par = {};
  for (const r of resultats) par[r.cle] = r.contenu || {};

  const nonTraduites = [];
  for (const r of resultats) nonTraduites.push(...tab((r.contenu || {}).situations_non_traduites));

  const apport = par.APPORT || {};
  const dims   = par.DIMENSIONS || {};
  const prof   = par.PROFIL || {};
  const vig    = par.VIGILANCES || {};
  const synth  = par.SYNTHESES || {};

  // Les synthèses viennent de leur agent dédié : on les repose sur leurs outils.
  // Le rapprochement se fait sur le code de pilier, puis sur le libellé — un
  // agent peut renvoyer l'un ou l'autre.
  const parPilier = {};
  for (const s of tab(synth.syntheses)) {
    if (s.pilier)  parPilier[String(s.pilier).toUpperCase()] = s.synthese || '';
    if (s.libelle) parPilier[String(s.libelle).toLowerCase()] = s.synthese || '';
  }
  const outils = tab((prof.bloc_profil || {}).outils).map((o, i) => {
    const cle1 = String(o.pilier || '').toUpperCase();
    const cle2 = String(o.libelle || '').toLowerCase();
    const trouvee = parPilier[cle1] || parPilier[cle2] || '';
    return { ...o, synthese: o.synthese || trouvee };
  });

  return {
    candidat_id: payload.candidat_id,
    cartouche:   prof.cartouche || {},
    bloc_apport: apport.bloc_apport || {},
    bloc_profil: { ...(prof.bloc_profil || {}), outils },
    bloc_dimensions: tab(dims.bloc_dimensions),
    portrait:        dims.portrait || '',
    registres:       dims.registres || '',
    // « Sa chaîne » : l'ordre des outils et ce qui circule entre eux. Produit par
    // l'agent des synthèses, qui voit passer les débordements en les transposant.
    chaine:          synth.chaine || '',
    bloc_vigilances: tab(vig.bloc_vigilances),
    situations_non_traduites: [...new Set(nonTraduites.map(x =>
      typeof x === 'string' ? x : JSON.stringify(x)))],
    revision_humaine: apport.revision_humaine === true,
    motif_revision:   apport.motif_revision || '',
    manques:          [...tab(prof.manques), ...tab(synth.manques)],
    verbalisations:   tab(apport.verbalisations)
  };
}

/**
 * Exécute les quatre missions et assemble la grille.
 * Séquentiel et non parallèle : les journaux restent lisibles, et un échec
 * précoce évite d'engager les appels suivants.
 * @returns {Promise<{ grille: Object|null, cost: number, manquantes: string[] }>}
 */
async function executer(payload) {
  const candidat_id = payload.candidat_id;
  const resultats = [];
  let cost = 0;

  const acquis = {};
  for (const mission of MISSIONS) {
    // Une mission qui dépend d'une autre ne part pas si celle-ci a échoué :
    // la rédaction sans sélection n'écrirait rien, ou pire, inventerait.
    if (mission.depend && !acquis[mission.depend]) {
      logger.warn(`Grille · ${mission.cle} — non lancée`, {
        candidat_id, motif: `dépend de ${mission.depend}, qui n'a rien rendu`
      });
      resultats.push({ cle: mission.cle, contenu: null, cost: 0 });
      continue;
    }
    const r = await executerMission(mission, payload, acquis);
    if (r.contenu) acquis[r.cle] = r.contenu;
    resultats.push(r);
    cost += r.cost;
  }

  // SELECTION est une étape intermédiaire, pas un bloc de la grille : son échec
  // se lit dans celui de VIGILANCES, qui en dépend. On ne la compte pas deux fois.
  const manquantes = resultats
    .filter(r => !r.contenu && r.cle !== 'SELECTION')
    .map(r => r.cle);
  if (manquantes.length === MISSIONS.length) {
    logger.error('Grille référent — les quatre missions ont échoué', { candidat_id });
    return { grille: null, cost, manquantes };
  }

  const grille = assembler(resultats, payload);
  logger.info('Grille référent — assemblée', {
    candidat_id,
    outils:         (grille.bloc_profil.outils || []).length,
    dimensions:     grille.bloc_dimensions.length,
    vigilances:     grille.bloc_vigilances.length,
    verbalisations: grille.verbalisations.length,
    manquantes:     manquantes.length ? manquantes : 'aucune',
    cost_usd:       cost.toFixed(4)
  });
  return { grille, cost, manquantes };
}

module.exports = { executer, assembler, payloadPour, aplatirReferentiel, rehydrater, MISSIONS };
