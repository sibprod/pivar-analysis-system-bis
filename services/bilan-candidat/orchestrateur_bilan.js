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
  const referentiel  = await lireReferentiel(payload.socle_code);
  const formulations = await lireFormulationsModeRapide(candidatId);   // peut être vide

  console.log(`[bilan ${candidatId}] reçu : ${referentiel.length} items de référentiel · ` +
              `${payload.outils.reduce((t,o)=>t+(o.gestes?.length||0),0)} gestes · ` +
              `${formulations.length} formulations`);

  const resultat = await produireAvecControles(payload, referentiel,
    (p, r, alertes, precedente) => appelerAgent(p, r, alertes, precedente, formulations),
    3, console);

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
async function lireReferentiel(socleCode) {
  // Table BILAN_DESALIGNEMENT — non exposée par airtableService : lecture directe.
  // Lue PAR IDENTIFIANTS DE CHAMPS (les noms ne sont pas garantis) :
  //   fld0eLhf6YOT9SWgb pilier · fldJPw1KAK4JbOzrx catégorie
  //   fldTGvpMnG4hqvLlS contenu JSON { items: [...] } · fld07wYsiauIXgD45 clé
  const BASE  = process.env.AIRTABLE_BASE_ID;
  const KEY   = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const TABLE = 'tbluJprmh9AJEJ6qQ';
  const F = { pilier:'fld0eLhf6YOT9SWgb', categorie:'fldJPw1KAK4JbOzrx',
              contenu:'fldTGvpMnG4hqvLlS', cle:'fld07wYsiauIXgD45' };
  if (!BASE || !KEY || !socleCode) return [];

  // Le pilier y est nommé par son geste : P1=COLLECTE · P2=TRI · P3=ANALYSE · P4=SOLUTIONS · P5=MEO
  const NOM = { P1:'COLLECTE', P2:'TRI', P3:'ANALYSE', P4:'SOLUTIONS', P5:'MEO' };
  const nom = NOM[String(socleCode).toUpperCase()] || String(socleCode).toUpperCase();

  // Catégories servies au candidat. SURDEPLOIEMENT et EMPECHEMENTS nourrissent l'axe
  // « le trop » ; INJONCTIONS et IMPACTS l'axe « la rencontre avec d'autres manières ».
  const RETENUES = ['EMPECHEMENTS','INJONCTIONS','IMPACTS','SURDEPLOIEMENT'];

  try {
    // Table courte : on la lit entière et on filtre en mémoire (aucun nom de champ requis).
    const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}?pageSize=100&returnFieldsByFieldId=true`,
      { headers: { Authorization: `Bearer ${KEY}` } });
    if (!r.ok) { console.warn(`[referentiel] lecture refusée : ${r.status} ${await r.text().catch(()=>'')}`.slice(0,200)); return []; }
    const data = await r.json();
    console.log(`[referentiel] ${(data.records||[]).length} ligne(s) lue(s), recherche du pilier « ${nom} »`);

    const items = [];
    for (const rec of (data.records || [])) {
      const f = rec.fields || {};
      const pil = (f[F.pilier] && f[F.pilier].name) || f[F.pilier] || '';
      if (String(pil).toUpperCase() !== nom) continue;

      const cat = (f[F.categorie] && f[F.categorie].name) || f[F.categorie] || '';
      if (!RETENUES.some(c => String(cat).toUpperCase().includes(c))) continue;

      const cle = f[F.cle] || rec.id;
      let liste = [];
      try {
        const brut = f[F.contenu];
        const j = typeof brut === 'string' ? JSON.parse(brut) : (brut || {});
        liste = Array.isArray(j) ? j : (j.items || []);
      } catch { liste = []; }

      liste.forEach((texte, i) => {
        if (typeof texte !== 'string' || !texte.trim()) return;
        items.push({ id: `${cle}_${i + 1}`, categorie: cat, enonce: texte.trim(),
                     axe_suggere: /SURDEPLOIEMENT|EMPECHEMENTS/i.test(cat) ? 'trop' : 'autres' });
      });
    }
    return items;
  } catch (e) { console.warn('[referentiel] échec :', e.message); return []; }
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
