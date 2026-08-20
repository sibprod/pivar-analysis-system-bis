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
  // AM-16 (20/08) : le mode rapide n'est plus une source de titres — trop
  // risqué pour la fiabilité du profil. L'agent titre depuis le détail complet
  // du geste (bilan complet), déjà transporté dans le payload.
  const formulations = [];

  console.log(`[bilan ${candidatId}] reçu : ${referentiel.length} items de référentiel · ` +
              `${payload.outils.reduce((t,o)=>t+(o.gestes?.length||0),0)} gestes · ` +
              `titres depuis le détail complet (AM-16)`);

  const resultat = await produireAvecControles(payload, referentiel,
    (p, r, alertes, precedente) => appelerAgent(p, r, alertes, precedente, formulations),
    formulations, 3, console);

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
    [F.version]: `prompt v4 · ${MODELE} · ${resultat.tentatives} tentative(s)`
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
  // Table BILAN_DESALIGNEMENT — lecture directe.
  // On ne dépend NI des noms de champs NI de leurs identifiants : on reconnaît
  // chaque valeur à son contenu. C'est la seule lecture qui ne peut pas échouer
  // si la table est renommée ou réorganisée.
  const BASE  = process.env.AIRTABLE_BASE_ID;
  const KEY   = process.env.AIRTABLE_TOKEN || process.env.AIRTABLE_API_KEY;
  const TABLE = 'tbluJprmh9AJEJ6qQ';
  if (!BASE || !KEY || !socleCode) return [];

  // Le pilier y est nommé par son geste : P1=COLLECTE · P2=TRI · P3=ANALYSE · P4=SOLUTIONS · P5=MEO
  const NOM = { P1:'COLLECTE', P2:'TRI', P3:'ANALYSE', P4:'SOLUTIONS', P5:'MEO' };
  const cible = NOM[String(socleCode).toUpperCase()] || String(socleCode).toUpperCase();
  const CATEGORIES = ['EMPECHEMENTS','INJONCTIONS','IMPACTS','SURDEPLOIEMENT'];

  const valeurTexte = v => {
    if (typeof v === 'string') return v;
    if (Array.isArray(v)) return v.map(valeurTexte).join(' ');
    if (v && typeof v === 'object') return v.name || '';
    return '';
  };

  try {
    const r = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}?pageSize=100`,
      { headers: { Authorization: `Bearer ${KEY}` } });
    if (!r.ok) { console.warn(`[referentiel] lecture refusée : ${r.status}`); return []; }
    const data = await r.json();
    console.log(`[referentiel] ${(data.records||[]).length} ligne(s) lue(s), pilier recherché « ${cible} »`);


    const items = [];
    for (const rec of (data.records || [])) {
      const valeurs = Object.values(rec.fields || {}).map(valeurTexte);

      // Cette ligne concerne-t-elle le pilier socle ?
      // « contient » et non « égale » : la valeur peut être SOLUTIONS, SOLUTIONS_IMPACTS, etc.
      const hautes = valeurs.map(v => v.toUpperCase());
      if (!hautes.some(v => v.includes(cible))) continue;

      // Quelle catégorie ? (une valeur contient l'une des quatre)
      const cat = CATEGORIES.find(c => hautes.some(v => v.includes(c)));
      if (!cat) continue;

      // La clé lisible, si elle existe (ex. SOLUTIONS_SURDEPLOIEMENT)
      const cle = valeurs.find(v => v.toUpperCase().startsWith(cible + '_')) || `${cible}_${cat}`;

      // Le contenu : la valeur qui est un JSON portant « items »
      // ⚠ Le JSON stocké contient des ESPACES INSÉCABLES (U+00A0) que JSON.parse refuse.
      // On les remplace par des espaces ordinaires avant analyse — vérifié en base le 20/08.
      let liste = [];
      for (const v of Object.values(rec.fields || {})) {
        if (typeof v !== 'string' || !v.includes('items')) continue;
        try {
          const j = JSON.parse(v.replace(/\u00a0/g, ' '));
          if (Array.isArray(j.items)) { liste = j.items; break; }
          if (Array.isArray(j)) { liste = j; break; }
        } catch (e) { console.warn('[referentiel] JSON illisible :', e.message.slice(0,60)); }
      }

      liste.forEach((texte, i) => {
        if (typeof texte !== 'string' || !texte.trim()) return;
        items.push({
          id: `${cle}_${i + 1}`, categorie: cat, enonce: texte.trim(),
          axe_suggere: (cat === 'SURDEPLOIEMENT' || cat === 'EMPECHEMENTS') ? 'trop' : 'autres'
        });
      });
    }
    console.log(`[referentiel] ${items.length} item(s) retenu(s) pour ${cible}`);
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
