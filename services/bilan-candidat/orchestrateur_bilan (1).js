/**
 * ORCHESTRATEUR — dépôt ANALYSE.
 * payload → agent → contrôles → écriture dans BILAN_PRESENTE_CANDIDAT.
 * Aucune validation humaine : le statut est décidé par les contrôles.
 */
const { construirePayload, lireFormulationsModeRapide } = require('./service_bilan_payload');
const { produireAvecControles } = require('./controles_bilan');
const { genererEnchainement }   = require('./generateur_enchainement');
const { appelerAgent, MODELE }  = require('./agent_bilan_candidat');

const BASE_ID = process.env.AIRTABLE_BASE_ID;
const API_KEY = process.env.AIRTABLE_API_KEY;

/* Champs cibles — identifiants relevés le 18/08 */
const F = {
  candidat_id:'fld1MiowhyU35TI1T', civilite:'fld1qvpFqRERvtxhv', nom:'fldNxNtocICKNYGbM', prenom:'fldctpUd455biJpJE',
  socle_code:'fldRxe1XxxITuT4py', socle_libelle:'fldQugQK2bJhgznu2',
  filtre:'fldpxUuTizXKhvKVd', filtre_preuves:'fldYxlBcSnW8Rns7h', filtre_revelation:'fldaTJUTtEWmHDG1F',
  outils_json:'fld8zRzqwbOspcIFx', cout_intro:'fldCMAt4foMrctdtL', cout_constat:'fldvj6A7M9mj3D3wS',
  affects_intro:'fldzduQReukYJ0Icm', affects_registres:'fldPK2Xd0SfBfleLM', affects_synthese:'fldSZM4yZtLlUM2gb',
  signature_ligne:'fldjIaXvQOLARyBF1',
  titres:'fldSTTWq82u2z1hoU', vigilance:'fldjVPX2pMoemeWyt', enchainement:'fldrrClGYct6A3Koi',
  statut:'fld4GxJKCDJTcAith', integrite:'fldITK77nXrgShkIS', empreinte:'fld9FpRcKf8j3IKCi', alertes:'fldkCF1qKuEuj6inC',
  nb_gestes:'fldCAgSwbYItyDdBN', nb_repris:'fldVZ3cwyiNSV1UPG', nb_rediges:'fld3C1V8b8j0MZW3B', nb_vigilance:'fldQDVetAiAufIB4x',
  date:'fldLEws3WjgGH4rUW', version:'fldHAukNos5fCoLAE'
};

async function genererBilan(candidatId, airtable) {
  const payload      = await construirePayload(candidatId, airtable);
  const referentiel  = await lireReferentiel(payload.socle_code, airtable);
  const formulations = await lireFormulationsModeRapide(candidatId);   // peut être vide

  const resultat = await produireAvecControles(payload, referentiel,
    (p, r) => appelerAgent(p, r, formulations));

  const enchainement = genererEnchainement(payload);   // par le code, sans agent
  const titres = resultat.sortie?.titres_parles || [];

  const champs = {
    [F.candidat_id]: candidatId, [F.civilite]: payload.civilite, [F.nom]: payload.nom,
    [F.socle_code]: payload.socle_code, [F.socle_libelle]: payload.socle_libelle,
    [F.filtre]: payload.filtre,
    [F.filtre_preuves]: txt(payload.filtre_preuves), [F.filtre_revelation]: txt(payload.filtre_revelation),
    [F.outils_json]: JSON.stringify(payload.outils),
    [F.cout_intro]: txt(payload.cout_intro), [F.cout_constat]: txt(payload.cout_constat),
    [F.affects_intro]: txt(payload.affects_intro), [F.affects_registres]: txt(payload.affects_registres),
    [F.affects_synthese]: txt(payload.affects_synthese), [F.signature_ligne]: txt(payload.signature_ligne),
    [F.titres]: JSON.stringify(titres),
    [F.vigilance]: JSON.stringify(resultat.sortie?.points_vigilance || []),
    [F.enchainement]: JSON.stringify(enchainement),
    [F.statut]: resultat.statut,                      // publie | anomalie
    [F.integrite]: resultat.statut === 'publie',
    [F.empreinte]: payload._empreinte,
    [F.alertes]: resultat.alertes.join(' · '),
    [F.nb_gestes]: nombreDeGestes(payload),
    [F.nb_repris]: titres.filter(t => t.provenance === 'repris').length,
    [F.nb_rediges]: titres.filter(t => t.provenance === 'redige').length,
    [F.nb_vigilance]: (resultat.sortie?.points_vigilance || []).length,
    [F.date]: new Date().toISOString(),
    [F.version]: `prompt v2 · ${MODELE} · ${resultat.tentatives} tentative(s)`
  };

  await ecrireBilanPresente(airtable, candidatId, champs);
  return { statut: resultat.statut, alertes: resultat.alertes, tentatives: resultat.tentatives };
}

const txt = v => typeof v === 'string' ? v : (v == null ? '' : JSON.stringify(v));
const nombreDeGestes = p => (p.outils || []).reduce((n, o) =>
  n + (Array.isArray(o.gestes) ? o.gestes.length : (o.gestes?.codes_retenus?.length || 0)), 0);

/* Le référentiel du pilier socle, tel qu'il existe en base.
   L'agent y puise les énoncés ; il rédige lui-même titre et transposition,
   sous le contrôle des règles du prompt et des contrôles bloquants.
   titre_court / transposition_pro : facultatifs — s'ils existent, ils font foi
   et l'agent les reprend tels quels (mémoire des formulations validées). */
async function lireReferentiel(socleCode, airtable) {
  const items = (typeof airtable.getBilanDesalignement === 'function')
    ? await airtable.getBilanDesalignement(socleCode)
    : [];   // référentiel absent : l'agent n'aura aucun item, les contrôles le signaleront
  return items.map(i => ({
    id:                i.id,
    categorie:         i.categorie,          // EMPECHEMENTS · INJONCTIONS · IMPACTS · SURDEPLOIEMENT
    enonce:            i.contenu || i.enonce,
    titre_court:       i.titre_court || null,
    transposition_pro: i.transposition_pro || null
  }));
}


module.exports = { genererBilan, F };


/* Écriture dans BILAN_PRESENTE_CANDIDAT — via l'API Airtable, table dédiée */
async function ecrireBilanPresente(airtableService, candidatId, champs) {
  const BASE = process.env.AIRTABLE_BASE_ID;
  const KEY  = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const TABLE = 'tbllTlzNbml7AoGZt';
  const F_ID  = 'fld1MiowhyU35TI1T';
  const entetes = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

  const formule = encodeURIComponent(`{candidat_id}="${String(candidatId).replace(/"/g,'')}"`);
  const rCherche = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}?filterByFormula=${formule}&maxRecords=1`, { headers: entetes });
  const data = rCherche.ok ? await rCherche.json() : { records: [] };
  const existante = data.records && data.records[0];

  const corps = JSON.stringify({
    records: [existante ? { id: existante.id, fields: champs } : { fields: champs }],
    typecast: true
  });
  const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
    method: existante ? 'PATCH' : 'POST', headers: entetes, body: corps
  });
  if (!r.ok) throw new Error(`Écriture BILAN_PRESENTE_CANDIDAT : ${r.status} ${(await r.text()).slice(0,200)}`);
  return true;
}
