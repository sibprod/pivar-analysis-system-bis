/**
 * SERVICE DE PAYLOAD — BILAN PRÉSENTÉ AU CANDIDAT
 * Dépôt ANALYSE. Transport pur : lit la matière validée, ne transforme rien.
 *
 * Doctrine (pièces 30 v2, 34, 36 v3) :
 *  - liste NOMMÉE de champs, jamais « tout sauf »
 *  - seuls les gestes du bloc « très souvent », dans l'ordre propre du candidat
 *  - suffixe _candidat uniquement (jamais _rattachement ni _technique)
 *  - aucun champ technique n'entre dans le payload : ce qui n'y est pas est inatteignable
 */

const BASE = 'appgghhXjYBdFRras';

/* ── Tables ─────────────────────────────────────────────────────────── */
const T = {
  BILAN:   'tblv775KQrEhsogdI',   // ETAPE1_T3_BILAN
  PILIER:  'tblzDIn7P2cOvVvY2',   // ETAPE1_T3_PILIER
  CIRCUITS:'tblV8UBCgEOzJ2Tch',   // ETAPE1_T2_CIRCUITS_POURBILAN (fréquence en clair)
  DESAL:   'tbluJprmh9AJEJ6qQ',   // BILAN_DESALIGNEMENT
  RAPIDE:  'tbltOcRoreIYx0LT2',   // MODE_RAPIDE (formulations, facultatif)
  CIBLE:   'tbllTlzNbml7AoGZt'    // BILAN_PRESENTE_CANDIDAT
};

/* ── Champs SOURCES — liste nommée, rien d'autre ne sera lu ─────────── */
const SRC_BILAN = {
  candidat_id:        'fldk66gddYGCREOV4',
  civilite:           'fld8yjgv2jIp2dzvW',
  nom:                'fldFjVTaedAE8iXkU',
  socle_code:         'fldfJHsX7A38IYele',
  socle_libelle:      'fldUf6rhEyR3MKI1x',
  filtre:             'fld9vAKpKEMIcRiTB',
  filtre_preuves:     'fldXGZ5ijlcGPYc16',
  filtre_revelation:  'fldzYiMkf7HgdBddj',
  gestes_socle:       'fldQr5PWbmaTH2uwv',  // JSON : code, nom, rang, dit, fait, revele
  mode_socle:         'fldLt4GhtqRUyl7V4',
  cout_intro:         'fldxZi0jRCWnXsVng',
  cout_constat:       'fld1nB5UqVklCjikE',
  affects_intro:      'fldxCNvqR4qyYAYjr',
  affects_registres:  'fldgeeC3lg3M89ESA',
  affects_synthese:   'fld9x0yRmGnAhVFS4',
  piliers_lies:       'fld0i2Xr5A07KJZOC'
};

const SRC_PILIER = {
  pilier_code:      'fldVvi5gbKioBmlsQ',
  pilier_libelle:   'fldbDYECHFEGkh0Ng',
  role:             'fldhFisqhUf9oBLOe',
  role_clair:       'fld1X3FQYRcxB2Qwy',
  accroche:         'fldomziXNOGf7Ujsb',
  mode_libelle:     'fldoGY71vyiaUeFl6',
  mode_explication: 'fld6GtEBRP5UxvHeI',
  gestes_candidat:  'fldBLvofzosLTPUOr',  // bloc_tres_souvent_candidat — narrations + verbatims
  vue_ensemble:     'fldho6MPGr5J5QmPu'
};

/* ── Champs INTERDITS — contrôle de non-lecture ─────────────────────── */
const INTERDITS = [
  'fldB9fRf8U61z4WZK','fldMA46pZRI6Bi0ZU','fldZiSdH20uMb5wCY', // _rattachement : libellés du référentiel
  'flds6XOIwvYr20iRY','fld7Sv7LXlZ6XPghN','fld6BWLEjDMdbYTs6', // _technique : inventaires
  'fldcGtODAh6b0vZs5','fldGLJRqWUxUoDR5e',                     // comptages, trace de raisonnement
  'fld0IrJZ4Pe9dDHhG','fldduLP9UN4tVRnPE','fldFheeASGSqDvqOm', // traces techniques du bilan
  'flda16lg5Dt1HrXrF','fld68H41z6b9XtFoZ',                     // blocs souvent / occasionnels
  'fldFjcTlLSUjYR8Qy'                                          // champ écarté (décision 18/08)
];

/* ── Ordre propre du candidat : socle, amont, aval, fonctionnels ────── */
const RANG_ROLE = { socle: 0, amont: 1, aval: 2, fonctionnel: 3 };
const ordreDesOutils = (a, b) =>
  (RANG_ROLE[normaliseRole(a.role)] ?? 9) - (RANG_ROLE[normaliseRole(b.role)] ?? 9);

function normaliseRole(r) {
  const v = String(r || '').toLowerCase();
  if (v.includes('socle')) return 'socle';
  if (v.includes('amont')) return 'amont';
  if (v.includes('aval'))  return 'aval';
  return 'fonctionnel';
}

/* ── Construction du payload ────────────────────────────────────────── */
async function construirePayload(candidatId, airtable) {
  const bilan = await airtable.premierEnregistrement(T.BILAN, SRC_BILAN.candidat_id, candidatId, Object.values(SRC_BILAN));
  if (!bilan) throw new Error(`Aucun bilan complet pour ${candidatId}`);

  const piliers  = await airtable.enregistrementsLies(T.PILIER, bilan[SRC_BILAN.piliers_lies], Object.values(SRC_PILIER));
  const circuits = await airtable.enregistrements(T.CIRCUITS, { candidat_id: candidatId });

  // fréquence en clair : on ne manipule aucun seuil, on lit le mot
  const gestesRetenus = circuits.filter(c => String(c.frequence || '').toLowerCase().trim() === 'très souvent');

  const outils = piliers.map(p => {
    const role = normaliseRole(p[SRC_PILIER.role]);
    return {
      pilier_code:      p[SRC_PILIER.pilier_code],
      pilier_libelle:   p[SRC_PILIER.pilier_libelle],   // substitué AU RENDU (lexique D2-07)
      role,
      role_clair:       p[SRC_PILIER.role_clair],
      accroche:         p[SRC_PILIER.accroche],
      mode_libelle:     role === 'socle' ? bilan[SRC_BILAN.mode_socle] : p[SRC_PILIER.mode_libelle],
      mode_explication: p[SRC_PILIER.mode_explication],
      gestes:           role === 'socle'
                          ? gestesDuSocle(bilan[SRC_BILAN.gestes_socle], gestesRetenus)
                          : gestesDuPilier(p[SRC_PILIER.gestes_candidat], p[SRC_PILIER.pilier_code], gestesRetenus)
    };
  }).sort(ordreDesOutils);

  return {
    candidat_id:       candidatId,
    civilite:          bilan[SRC_BILAN.civilite],
    nom:               bilan[SRC_BILAN.nom],
    socle_code:        bilan[SRC_BILAN.socle_code],
    socle_libelle:     bilan[SRC_BILAN.socle_libelle],
    filtre:            bilan[SRC_BILAN.filtre],
    filtre_preuves:    bilan[SRC_BILAN.filtre_preuves],
    filtre_revelation: bilan[SRC_BILAN.filtre_revelation],
    outils,
    cout_intro:        bilan[SRC_BILAN.cout_intro],
    cout_constat:      bilan[SRC_BILAN.cout_constat],
    affects_intro:     bilan[SRC_BILAN.affects_intro],
    affects_registres: bilan[SRC_BILAN.affects_registres],
    affects_synthese:  bilan[SRC_BILAN.affects_synthese],
    _empreinte:        empreinte(/* champs transportés */ arguments[0])
  };
}

/* Le socle : JSON structuré, un objet par geste */
function gestesDuSocle(jsonBrut, retenus) {
  const codesRetenus = new Set(retenus.map(c => c.code));
  return (parseJson(jsonBrut) || [])
    .filter(g => codesRetenus.size === 0 || codesRetenus.has(g.code))
    .map(g => ({ code: g.code, rang: g.rang, verbatims: g.dit, narration: g.fait, revele: g.revele }));
}

/* Les autres outils : texte rédigé, transporté tel quel — le rendu le découpe */
function gestesDuPilier(texteCandidat, pilierCode, retenus) {
  return {
    texte_integral: texteCandidat || '',
    codes_retenus:  retenus.filter(c => String(c.pilier_code) === String(pilierCode)).map(c => c.code)
  };
}

function parseJson(v) { try { return typeof v === 'string' ? JSON.parse(v) : v; } catch { return null; } }

/* Empreinte du transporté — sert au contrôle d'intégrité après l'agent */
function empreinte(objet) {
  const crypto = require('crypto');
  return crypto.createHash('sha256').update(JSON.stringify(objet)).digest('hex');
}

/* ── Garde-fou : aucun champ interdit ne doit figurer dans un appel ─── */
function verifierAppel(champsDemandes) {
  const fautifs = champsDemandes.filter(c => INTERDITS.includes(c));
  if (fautifs.length) throw new Error(`Champs interdits au transport : ${fautifs.join(', ')}`);
  return true;
}

module.exports = { construirePayload, verifierAppel, T, SRC_BILAN, SRC_PILIER, INTERDITS, normaliseRole, empreinte };
