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
  { cle: 'VIGILANCES', service: 'agent_grille_vigilances', prompt: 'prompt_4_vigilances.md' },
  // ⭐ Mission séparée (20/08) : deux passages ont laissé les synthèses vides
  // parce que l'agent du profil avait autre chose à faire et a sauté la recopie.
  // Isolée, elle ne peut plus être esquivée — c'est le seul travail de cet agent.
  { cle: 'SYNTHESES',  service: 'agent_grille_syntheses',  prompt: 'prompt_5_syntheses.md' }
];

function tab(v) { return Array.isArray(v) ? v : []; }

// ═══════════════════════════════════════════════════════════════════════════
// LA MATIÈRE DE CHAQUE MISSION
// Chaque agent ne reçoit QUE ce dont il a besoin. Lui donner le reste, c'est
// le noyer — et c'est ce qui a fait dépasser sa capacité à l'agent unique.
// ═══════════════════════════════════════════════════════════════════════════
function payloadPour(cle, p) {
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
        synthese_dimensions: { portrait_un_mot: p.synthese_dimensions.portrait_un_mot }
      };

    case 'VIGILANCES':
      return { ...commun,
        // Le référentiel où choisir…
        referentiels: { ...commun.referentiels, desalignement: p.referentiels.desalignement },
        // …et de quoi vérifier l'ancrage chez CE candidat.
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
async function executerMission(mission, payloadComplet) {
  const candidat_id = payloadComplet.candidat_id;
  const payload = payloadPour(mission.cle, payloadComplet);
  let sortie = null, cout = 0;

  // Deux tentatives : une sortie illisible est souvent une troncature,
  // pas une erreur de fond.
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
    }
  }

  if (!sortie) {
    logger.error(`Grille · ${mission.cle} — aucune sortie exploitable`, { candidat_id });
    return { cle: mission.cle, contenu: null, cost: cout };
  }

  // L'agent peut envelopper sa réponse sous la clé de sa mission, ou non.
  const contenu = sortie[mission.cle] || sortie[mission.cle.toLowerCase()] || sortie;
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

  for (const mission of MISSIONS) {
    const r = await executerMission(mission, payload);
    resultats.push(r);
    cost += r.cost;
  }

  const manquantes = resultats.filter(r => !r.contenu).map(r => r.cle);
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

module.exports = { executer, assembler, payloadPour, MISSIONS };
