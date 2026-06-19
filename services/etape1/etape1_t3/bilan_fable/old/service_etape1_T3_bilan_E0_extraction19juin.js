// services/etape1/etape1_t3/bilan_fable/service_etape1_T3_bilan_E0_extraction.js
// É0 — EXTRACTION & DÉRIVATIONS — v5.2 (17/06/2026)
//
// v5.2 : accès aux données par NOM DE CHAMP (SDK Airtable 0.12.2 retourne r.fields
//        avec les Field IDs comme clés quand returnFieldsByFieldId:true — mais les
//        fonctions airtableService retournent ...r.fields donc clés = noms de champs)

'use strict';

const config          = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const logger          = require('../../../../utils/logger');

// Noms de champs VENTILATION_PILIERS (tels que dans Airtable)
const VENT = {
  candidat_id:    'candidat_id',
  pilier_coeur:   'pilier_coeur',          // singleSelect P1..P5
  rang:           'rang_par_frequence',    // number 1..5
  nb_activations: 'nb_activations_coeur_total',
};

// Noms de champs INVENTAIRE_CIRCUITS
const INV = {
  candidat_id:  'candidat_id',
  pilier:       'pilier_owner',     // singleSelect → string directement
  circuit_id:   'circuit_id',       // "C12"
  code_complet: 'circuit_label',    // "P4C12"
  coeur:        'nb_coeur',
  total:        'total_activations',
  adhoc:        'circuit_origine',  // singleSelect "OFFICIEL" / "AD_HOC"
};

// Noms de champs T3_PILIER
const FLD_PIL_CODE = 'pilier';
const FLD_MODE     = 'pilier_mode';

// Noms de champs T2 Fable
const T2 = {
  pilier:          'pilier',
  signal_limbique: 'signal_limbique',
  synthese_pilier: 'synthese_pilier',
};

// rang → rôle/slot
const RANG_TO_ROLE = {
  1: { role: 'socle',       slot: 'socle' },
  2: { role: 'amont',       slot: 'str1'  },
  3: { role: 'aval',        slot: 'str2'  },
  4: { role: 'fonctionnel', slot: 'fn1'   },
  5: { role: 'fonctionnel', slot: 'fn2'   },
};

function niveauFromCoeur(n) {
  if (n >= 4) return 'HAUT';
  if (n >= 2) return 'MOYEN';
  if (n === 1) return 'FAIBLE';
  return 'EN_SOUTIEN';
}

function extractName(val) {
  if (!val) return '';
  if (typeof val === 'object' && val.name) return val.name;
  return String(val);
}

async function buildContexteE0({ candidat_id }) {
  const t = Date.now();
  logger.info('É0 v5.2 — démarrage', { candidat_id });

  const [ventilation, inventaire, t3piliers, t2rows, piliersRef] = await Promise.all([
    airtableService.getEtape1T2VentilationPiliers(candidat_id),
    airtableService.getEtape1T2InventaireCircuits(candidat_id),
    airtableService.getEtape1T3Piliers(candidat_id),
    airtableService.getEtape1T2Fable(candidat_id),
    airtableService.getReferentielPiliers(),
  ]);

  const raw0 = ventilation?.[0] || {};
  logger.info('É0 — données lues', {
    candidat_id,
    nb_ventilation: ventilation?.length,
    nb_inventaire:  inventaire?.length,
    nb_t2rows:      t2rows?.length,
    sample_vent_keys: Object.keys(raw0),
    sample_vent_val:  raw0
  });
  const inv0 = inventaire?.[0] || {};
  logger.info('É0 — inventaire sample', {
    candidat_id,
    inv_keys: Object.keys(inv0),
    inv_val:  inv0
  });

  if (!ventilation?.length) throw new Error(`É0: VENTILATION_PILIERS vide pour ${candidat_id}`);
  if (!inventaire?.length)  throw new Error(`É0: INVENTAIRE_CIRCUITS vide pour ${candidat_id}`);

  // Libellés officiels depuis REFERENTIEL_PILIERS
  const nomParPilier = {};
  for (const p of (piliersRef || [])) {
    if (p.pilier_code && p.pilier_nom) nomParPilier[p.pilier_code] = p.pilier_nom;
  }

  // Architecture rôles depuis VENTILATION_PILIERS
  const roleParPilier = {}, slotParPilier = {}, ordre = [];
  for (const r of ventilation) {
    const code = extractName(r[VENT.pilier_coeur]);
    const rang  = Number(r[VENT.rang] || 0);
    if (!code || !/^P[1-5]$/.test(code)) continue;
    const mapped = RANG_TO_ROLE[rang] || { role: 'fonctionnel', slot: 'fn2' };
    roleParPilier[code] = mapped.role;
    slotParPilier[code] = mapped.slot;
    if (!ordre.includes(code)) ordre.push(code);
  }

  ordre.sort((a, b) => {
    const ra = ventilation.find(r => extractName(r[VENT.pilier_coeur]) === a);
    const rb = ventilation.find(r => extractName(r[VENT.pilier_coeur]) === b);
    return Number(ra?.[VENT.rang] || 99) - Number(rb?.[VENT.rang] || 99);
  });

  // Modes existants depuis T3_PILIER
  const modeParPilier = {};
  for (const p of (t3piliers || [])) {
    const code = p[FLD_PIL_CODE] || p.pilier || '';
    const mode = p[FLD_MODE]     || p.pilier_mode || '';
    if (code) modeParPilier[code] = mode;
  }

  // Signal + synthèse depuis T2 Fable
  const signalParPilier = {}, synthParPilier = {};
  for (const r of (t2rows || [])) {
    const pil = r[T2.pilier] || '';
    if (!pil) continue;
    if (!signalParPilier[pil] && r[T2.signal_limbique]) signalParPilier[pil] = r[T2.signal_limbique];
    if (!synthParPilier[pil]  && r[T2.synthese_pilier]) synthParPilier[pil]  = r[T2.synthese_pilier];
  }

  // INVENTAIRE → coeur/total/adhoc par code circuit
  const invByCode = {};
  for (const r of inventaire) {
    const code   = r[INV.code_complet] || '';
    if (!code) continue;
    const pilier = extractName(r[INV.pilier]);
    invByCode[code] = {
      code,
      circuit_id: String(r[INV.circuit_id] || ''),
      pilier,
      coeur:  Number(r[INV.coeur] || 0),
      total:  Number(r[INV.total] || 0),
      adhoc:  extractName(r[INV.adhoc]) === 'AD_HOC',
    };
    if (pilier && /^P[1-5]$/.test(pilier) && !ordre.includes(pilier)) {
      roleParPilier[pilier] = 'fonctionnel';
      slotParPilier[pilier] = 'fn2';
      ordre.push(pilier);
    }
  }

  logger.info('É0 — invByCode', {
    candidat_id,
    nb_codes: Object.keys(invByCode).length,
    sample:   Object.keys(invByCode).slice(0, 3),
    ordre
  });

  // Assemblage piliers
  const piliers = [];
  for (const pilier_code of ordre) {
    const circuitsInv = Object.values(invByCode).filter(c => c.pilier === pilier_code);
    if (!circuitsInv.length) {
      logger.warn(`É0: aucun circuit pour ${pilier_code}`, { candidat_id });
      continue;
    }

    const aDuCoeur = circuitsInv.some(c => c.coeur > 0);
    const circuits = circuitsInv.map(inv => ({
      code:       inv.code,
      nom:        inv.circuit_id,
      circuit_id: inv.circuit_id,
      coeur:      inv.coeur,
      total:      inv.total,
      niveau:     niveauFromCoeur(inv.coeur),
      adhoc:      inv.adhoc,
      verbatims:  [],
      sortants:   {},
    })).sort((a, b) => (b.coeur - a.coeur) || (b.total - a.total));

    const modeExistant = modeParPilier[pilier_code] || '';
    piliers.push({
      pilier_code,
      pilier_nom:            nomParPilier[pilier_code] || pilier_code,
      pilier_role:           roleParPilier[pilier_code] || 'fonctionnel',
      role_slot:             slotParPilier[pilier_code] || 'fn2',
      pilier_mode:           modeExistant,
      mode_statut:           modeExistant ? 'FOURNI' : 'A_PROPOSER',
      echelle_classement:    aDuCoeur ? 'coeur' : 'total',
      signal_limbique:       signalParPilier[pilier_code] || '',
      synth_factuelle_coeur: synthParPilier[pilier_code]  || '',
      circuits,
    });
  }

  if (!piliers.length) throw new Error(`É0: aucun pilier assemblé pour ${candidat_id}`);

  logger.info('É0 v5.2 — terminée', { candidat_id, nb_piliers: piliers.length, elapsedMs: Date.now() - t });
  return { candidat_id, piliers };
}

module.exports = { buildContexteE0 };
