// services/etape1/bilan_fable/serviceE0_extraction.js
// É0 — EXTRACTION & DÉRIVATIONS (chaîne bilan FABLE) — v1.0 (13/06/2026)
//
// ⚠️ ZÉRO LLM. Tout ce qui est calculable n'est jamais demandé à un agent.
// Ce service lit les SOURCES AUTORITAIRES validées (Airtable) et assemble le
// payload par pilier que consommera P-A (serviceP_A). Reconstruit de zéro à
// partir des tables — n'emprunte rien à l'ancienne génération de bilan.
//
// SOURCES (doctrine « source freeze ») :
//   - cœur / total par circuit ........ ETAPE1_T2_INVENTAIRE_CIRCUITS (AUTORITAIRE)
//   - attribution + verbatims EXACTS .. ETAPE1_T1.types_verbatim_circuits (fldbSyz1ROvIepXgc)
//   - pilier gouvernant par réponse ... ETAPE1_T1.pilier_coeur
//   - architecture (rôles socle/str/fn) ETAPE1_T3_BILAN (pilier_socle / str1 / str2 / fn1 / fn2)
//   - libellés officiels des piliers .. REFERENTIEL_PILIERS (jamais hardcodés)
//
// DÉRIVATIONS :
//   - en_svc_Px (sortants) : COMPUTÉ depuis l'attribution T1 (jamais INVENTAIRE.nb_svc, corrompu).
//       cœur(C)      = activations de C dans une réponse gouvernée par le pilier propriétaire de C
//       en_svc_Pj(C) = activations de C dans une réponse gouvernée par Pj (j ≠ propriétaire)
//       total(C)     = cœur + Σ en_svc
//   - niveau (échelle CŒUR) : HAUT ≥4 · MOYEN 2-3 · FAIBLE 1 · EN_SOUTIEN 0
//   - AUTO-CONTRÔLE : cœur et total computés DOIVENT correspondre à INVENTAIRE_CIRCUITS.
//       En cas d'écart → throw (on ne produit jamais un payload faux en silence).
//
// SORTIE : { candidat_id, piliers: [ { pilier_code, pilier_nom, pilier_role,
//   echelle_classement, sous_totaux_instrumentaux, circuits:[...] }, ... ] }
//   (ordre des piliers = socle → str1 → str2 → fn1 → fn2)

'use strict';

const airtableService = require('../../../infrastructure/airtableService');
const logger          = require('../../../../utils/logger');

// ─── Seuils de niveau (échelle CŒUR) — doctrine ───────────────────────────────
function niveauFromCoeur(coeur) {
  if (coeur >= 4) return 'HAUT';
  if (coeur >= 2) return 'MOYEN';
  if (coeur === 1) return 'FAIBLE';
  return 'EN_SOUTIEN';            // cœur 0 (instrumental pur)
}

// ─── Propriétaire d'un circuit depuis son code (P3C12 → P3 ; ADHOC_C17 → null) ─
function ownerPilier(circuitCode) {
  const m = /^P([1-5])C\d+$/.exec(circuitCode);
  return m ? `P${m[1]}` : null;   // ADHOC_* → pas de propriétaire pilier standard
}

// ─── Parse d'une ligne d'attribution T1 (types_verbatim_circuits) ─────────────
// Format observé en base (fldbSyz1ROvIepXgc), blocs séparés par ligne vide :
//   P3 · C10 · NUANCEE avec [C12]
//      geste : "Retour sélectif par pertinence"
//      verbatim : "je reviens ensuite vers des points précis…"
// Renvoie [ { code:'P3C10', mode:'NUANCEE'|'FRANCHE', geste, verbatim }, ... ]
function parseAttribution(raw) {
  if (!raw || typeof raw !== 'string') return [];
  const blocs = raw.split(/\n\s*\n/);
  const out = [];
  for (const bloc of blocs) {
    const lignes = bloc.split('\n').map(l => l.trim()).filter(Boolean);
    if (lignes.length === 0) continue;
    // 1re ligne : "P3 · C10 · NUANCEE [avec [C12]]"
    const tete = lignes[0];
    const mTete = /^P([1-5])\s*·\s*C(\d+)\s*·\s*(FRANCHE|NUANCEE)/i.exec(tete);
    if (!mTete) continue;          // ligne non conforme → ignorée (pas d'invention)
    const code = `P${mTete[1]}C${mTete[2]}`;
    const mode = mTete[3].toUpperCase();
    let geste = '', verbatim = '';
    for (const l of lignes.slice(1)) {
      const mG = /^geste\s*:\s*"?(.*?)"?$/i.exec(l);
      const mV = /^verbatim\s*:\s*"?(.*?)"?$/i.exec(l);
      if (mG) geste = mG[1];
      if (mV) verbatim = mV[1];
    }
    out.push({ code, mode, geste, verbatim });
  }
  return out;
}

// ─── Lecture du champ d'attribution quel que soit son nom de clé renvoyé ──────
// airtableService.getEtape1T1 renvoie les fields par NOM (pas par ID). Le champ
// types_verbatim_circuits n'est pas dans ETAPE1_T1_FIELDS de la config : on le
// lit donc directement par son nom de champ tel que stocké en base.
function lireAttributionRow(row) {
  return row.types_verbatim_circuits
      || row['types_verbatim_circuits']
      || '';
}

// ═══════════════════════════════════════════════════════════════════════════
// POINT D'ENTRÉE
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Construit le payload É0 par pilier pour la chaîne bilan FABLE.
 * @param {Object} p
 * @param {string} p.candidat_id
 * @returns {Promise<{candidat_id:string, piliers:Array, verbatims_index:Object}>}
 */
async function buildContexteE0({ candidat_id }) {
  const startTime = Date.now();
  logger.info('É0 extraction — démarrage', { candidat_id });

  // ─── 1. Sources ──────────────────────────────────────────────────────────
  const [inventaire, t1rows, bilan, piliersRef] = await Promise.all([
    airtableService.getEtape1T2InventaireCircuits(candidat_id),
    airtableService.getEtape1T1(candidat_id),
    airtableService.getEtape1T3Bilan(candidat_id),
    airtableService.getReferentielPiliers()
  ]);

  if (!inventaire || inventaire.length === 0) {
    throw new Error(`É0: aucune ligne INVENTAIRE_CIRCUITS pour ${candidat_id}`);
  }
  if (!t1rows || t1rows.length === 0) {
    throw new Error(`É0: aucune ligne ETAPE1_T1 pour ${candidat_id}`);
  }
  if (!bilan) {
    throw new Error(`É0: aucun ETAPE1_T3_BILAN pour ${candidat_id} (architecture des rôles requise)`);
  }

  // ─── 2. Référentiel des libellés de piliers (jamais hardcodé) ─────────────
  const nomParPilier = {};
  for (const p of piliersRef) {
    if (p.pilier_code) nomParPilier[p.pilier_code] = p.pilier_nom || '';
  }

  // ─── 3. Architecture : rôle de chaque pilier + ordre socle→str→fn ─────────
  // T3_BILAN porte pilier_socle / pilier_str1 / pilier_str2 / pilier_fn1 / pilier_fn2.
  const roleParPilier = {};   // rôle « prompt » : socle | amont | aval | fonctionnel
  const slotParPilier = {};   // slot architecture précis : socle | str1 | str2 | fn1 | fn2
  const ordre = [];
  const archMap = [
    ['pilier_socle', 'socle',       'socle'],
    ['pilier_str1',  'amont',       'str1'],
    ['pilier_str2',  'aval',        'str2'],
    ['pilier_fn1',   'fonctionnel', 'fn1'],
    ['pilier_fn2',   'fonctionnel', 'fn2']
  ];
  for (const [champ, role, slot] of archMap) {
    const code = bilan[champ];
    if (code && /^P[1-5]$/.test(code)) {
      roleParPilier[code] = role;
      slotParPilier[code] = slot;
      ordre.push(code);
    }
  }
  // Filet : tout pilier présent dans l'inventaire mais absent de l'architecture
  // est ajouté en fin avec rôle 'fonctionnel' (jamais d'omission silencieuse).
  for (const r of inventaire) {
    const owner = r.pilier_owner;
    if (owner && /^P[1-5]$/.test(owner) && !ordre.includes(owner)) {
      roleParPilier[owner] = 'fonctionnel';
      slotParPilier[owner] = 'fn2';
      ordre.push(owner);
    }
  }

  // ─── 4. INVENTAIRE → table autoritaire cœur/total par circuit ─────────────
  const invByCode = {};
  for (const r of inventaire) {
    const code = r.circuit_id || r.circuit_label;
    if (!code) continue;
    invByCode[code] = {
      code,
      nom:        r.circuit_label || code,
      pilier:     r.pilier_owner || ownerPilier(code),
      origine:    r.circuit_origine || '',
      nom_ad_hoc: r.nom_ad_hoc || '',
      coeur_inv:  Number(r.nb_coeur || 0),
      total_inv:  Number(r.total_activations || 0),
      adhoc:      String(r.circuit_origine || '').toUpperCase().includes('ADHOC')
                    || String(code).toUpperCase().startsWith('ADHOC')
    };
  }

  // ─── 5. Attribution T1 → cœur computé, en_svc computé, verbatims par circuit ─
  const coeurCalc = {};                 // code → n
  const enSvcCalc = {};                 // code → { P1:n, ... }
  const verbatimsByCode = {};           // code → [ { qid, lieu, texte } ]
  const ensure = (code) => {
    if (!coeurCalc[code]) coeurCalc[code] = 0;
    if (!enSvcCalc[code]) enSvcCalc[code] = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
    if (!verbatimsByCode[code]) verbatimsByCode[code] = [];
  };

  for (const row of t1rows) {
    const gov = row.pilier_coeur;       // pilier gouvernant la réponse (ex. 'P3')
    const qid = row.id_question || '';
    const lieu = row.scenario || '';
    const attributions = parseAttribution(lireAttributionRow(row));

    for (const a of attributions) {
      ensure(a.code);
      const owner = ownerPilier(a.code);            // null pour ADHOC_*
      if (owner && gov && owner === gov) {
        coeurCalc[a.code] += 1;                     // activation cœur
      } else if (gov && /^P[1-5]$/.test(gov)) {
        enSvcCalc[a.code][gov] += 1;                // activation en service de gov
      }
      if (a.verbatim) {
        verbatimsByCode[a.code].push({ qid, lieu, texte: a.verbatim });
      }
    }
  }

  // ─── 6. AUTO-CONTRÔLE contre INVENTAIRE (autoritaire) ─────────────────────
  // cœur computé et total computé doivent correspondre à l'inventaire.
  const ecarts = [];
  for (const code of Object.keys(invByCode)) {
    const inv = invByCode[code];
    const coeur = coeurCalc[code] || 0;
    const enSvc = enSvcCalc[code] || { P1:0,P2:0,P3:0,P4:0,P5:0 };
    const totalCalc = coeur + enSvc.P1 + enSvc.P2 + enSvc.P3 + enSvc.P4 + enSvc.P5;
    // Pour les circuits standard (non ADHOC), le cœur est comparable.
    if (!inv.adhoc && inv.coeur_inv !== coeur) {
      ecarts.push(`${code}: cœur computé ${coeur} ≠ INVENTAIRE ${inv.coeur_inv}`);
    }
    if (inv.total_inv !== totalCalc) {
      ecarts.push(`${code}: total computé ${totalCalc} ≠ INVENTAIRE ${inv.total_inv}`);
    }
  }
  if (ecarts.length > 0) {
    logger.error('É0 — écarts vs INVENTAIRE (arrêt, payload non produit)', {
      candidat_id, nb_ecarts: ecarts.length, ecarts: ecarts.slice(0, 20)
    });
    throw new Error(
      `É0: ${ecarts.length} écart(s) entre attribution computée et INVENTAIRE_CIRCUITS ` +
      `(source autoritaire). Premier(s): ${ecarts.slice(0, 5).join(' | ')}`
    );
  }

  // ─── 7. Assemblage du payload par pilier ──────────────────────────────────
  // Un circuit appartient au pilier de son propriétaire (owner) ; les ADHOC sont
  // rattachés à leur pilier_owner d'inventaire.
  const piliers = [];
  for (const code_pilier of ordre) {
    // circuits de ce pilier (depuis INVENTAIRE, source de la liste)
    const circuitsPilier = Object.values(invByCode)
      .filter(inv => (inv.pilier || ownerPilier(inv.code)) === code_pilier);

    // échelle de classement : si aucun cœur sur le pilier → 'total', sinon 'coeur'
    const aDuCoeur = circuitsPilier.some(c => (coeurCalc[c.code] || 0) > 0);
    const echelle = aDuCoeur ? 'coeur' : 'total';

    const circuits = circuitsPilier.map(inv => {
      const coeur = coeurCalc[inv.code] || 0;
      const enSvc = enSvcCalc[inv.code] || { P1:0,P2:0,P3:0,P4:0,P5:0 };
      const sortants = {};
      for (const pj of ['P1','P2','P3','P4','P5']) {
        if (pj !== code_pilier && enSvc[pj] > 0) sortants[pj] = enSvc[pj];
      }
      return {
        code:      inv.code,
        nom:       inv.nom,
        coeur,
        total:     inv.total_inv,
        niveau:    niveauFromCoeur(coeur),
        adhoc:     inv.adhoc,
        sortants,
        verbatims: verbatimsByCode[inv.code] || []
      };
    });

    // tri : cœur décroissant puis total décroissant (classement de lecture)
    circuits.sort((a, b) => (b.coeur - a.coeur) || (b.total - a.total));

    // sous-totaux instrumentaux du pilier : somme des en_svc reçus PAR les autres
    // piliers en service de ce pilier (lecture verticale pour « où l'outil revient »)
    const sousTotaux = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
    for (const code of Object.keys(enSvcCalc)) {
      const ownC = ownerPilier(code);
      if (ownC && ownC !== code_pilier) {
        sousTotaux[ownC] += (enSvcCalc[code][code_pilier] || 0);
      }
    }

    piliers.push({
      pilier_code: code_pilier,
      pilier_nom:  nomParPilier[code_pilier] || '',
      pilier_role: roleParPilier[code_pilier] || 'fonctionnel',
      role_slot:   slotParPilier[code_pilier] || 'fn2',
      echelle_classement: echelle,
      sous_totaux_instrumentaux: sousTotaux,
      circuits
    });
  }

  const elapsedMs = Date.now() - startTime;
  logger.info('É0 extraction — terminée', {
    candidat_id,
    nb_piliers:  piliers.length,
    nb_circuits: Object.keys(invByCode).length,
    elapsedMs
  });

  return { candidat_id, piliers, verbatims_index: verbatimsByCode };
}

module.exports = {
  buildContexteE0,
  // exposés pour tests unitaires
  _internal: { parseAttribution, niveauFromCoeur, ownerPilier }
};
