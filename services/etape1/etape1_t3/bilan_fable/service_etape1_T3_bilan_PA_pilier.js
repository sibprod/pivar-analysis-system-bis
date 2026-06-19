// services/etape1/etape1_t3/bilan_fable/service_etape1_T3_redaction_PA.js
// RÉDACTION PA — v10 (19/06/2026)
//
// RÔLE : « le cuisinier ». Reçoit le plan de travail dressé par la PRÉPARATION T3,
//   appelle l'agent Claude (prompt v10), valide la sortie, écrit les textes dans T3.
//
// ENTRÉE : le résultat de preparerT3() → { candidat_id, piliers[], pilierMap }
//   piliers[] porte déjà, par circuit : code, nom, capacite, coeur, total,
//   niveau_coeur, niveau_amplitude, bloc, instrumentaux, adhoc, verbatims_source.
//   → AUCUN recalcul de niveau/rôle/emprunt ici. Tout est lu de la préparation.
//
// CE QUI A DISPARU vs ancien service P-A (recalcul supprimé) :
//   - normaliserNiveau() (seuil ≥5 FAUX vs doctrine ≥8) → on lit les niveaux figés
//   - normaliserRole() (mappe str1/fn1) → rôle déjà propre (socle/amont/aval/fonctionnel)
//   - lireEmpruntsRecus() recalculé via en_svc → emprunts lus via instrumentaux figés
//   - relecture de T3_PILIER/T3_CIRCUIT pour les chiffres → fournis par la préparation
//
// CE QUI EST GARDÉ (précieux, issu du P-A v9) :
//   - validation complète de la sortie (enrichie des contrôles v10)
//   - appel Claude en streaming + orchestration retry
//   - écriture T3_PILIER + T3_CIRCUIT
//
// CE QUI EST AJOUTÉ (v10) :
//   - entrée agent : capacite, niveau_coeur, niveau_amplitude, instrumentaux figés
//   - sortie agent : champ "profondeur" écrit dans T3_CIRCUIT (lookup → POURBILAN ensuite)

'use strict';
require('dotenv').config();

const fs   = require('fs');
const path = require('path');
const Anthropic = require('@anthropic-ai/sdk');

const airtableConfig  = require('../../../../config/airtable');
const airtableService = require('../../../infrastructure/airtableService');
const logger          = require('../../../../utils/logger');

const F_PIL = airtableConfig.ETAPE1_T3_PILIER_FIELDS;
const F_CIR = airtableConfig.ETAPE1_T3_CIRCUIT_FIELDS;

// Le prompt v10 (système rédactionnel de l'agent). Chemin ajustable par variable d'env.
// Lecture DIFFÉRÉE (au 1er appel, pas au chargement) : si le fichier manque, le serveur ne
// crashe pas au démarrage — l'erreur n'apparaît qu'au lancement d'un bilan, avec un message clair.
const PROMPT_PATH = process.env.PROMPT_PA_PATH
  || path.join(__dirname, '../../../../new-prompts/etape1/bilan/prompt_etape1_T3_bilan_PA_pilier.md');

let _promptCache = null;
function chargerPrompt() {
  if (_promptCache !== null) return _promptCache;
  try {
    _promptCache = fs.readFileSync(PROMPT_PATH, 'utf8');
  } catch (e) {
    throw new Error(`Prompt PA introuvable au chemin : ${PROMPT_PATH} — vérifier le fichier ou définir PROMPT_PA_PATH. (${e.message})`);
  }
  return _promptCache;
}

const REF = {
  PILIERS:  airtableConfig.TABLES.REFERENTIEL_PILIERS  || 'tblf4OodQ2Qi5xSXs',
  CIRCUITS: airtableConfig.TABLES.REFERENTIEL_CIRCUITS  || 'tbllMoTjOsILuzR6m',
  PROFILS:  airtableConfig.TABLES.REFERENTIEL_PROFILS   || 'tblLTxeKoRa9m8io7',
};

const PILIERS_ORDRE = ['P4', 'P5', 'P1', 'P2', 'P3'];

// ═══════════════════════════════════════════════════════════════
// SECTION 1 — CONSTRUCTION DE L'ENTRÉE AGENT (depuis la préparation, sans recalcul)
// ═══════════════════════════════════════════════════════════════

// Parse le détail T2_FABLE (texte regroupé) en liste de verbatims {qid, lieu, texte}.
// Repris du P-A v9 (parseVerbatims), inchangé sur le fond.
function parseVerbatims(raw, circuit_code) {
  const result = [];
  if (!raw || !raw.trim()) return result;
  const blocks = raw.split(/\n\n+/);
  const nb_blocs = blocks.filter(b => b.trim().length > 0).length;
  for (const block of blocks) {
    if (!block.trim()) continue;
    const h = block.match(/\*\*(P\d+Q\d+)(?:\s+([A-Z_0-9\-À-Ü][A-Za-zÀ-ü0-9_\-]*))?(?:\s+[^*]*)?\*\*/i);
    const v = block.match(/^>\s*["“«](.+?)["”»]?\s*$/m);
    if (h && v) {
      result.push({
        qid:   h[1],
        lieu:  h[2] ? (h[2].charAt(0).toUpperCase() + h[2].slice(1).toLowerCase()) : '',
        texte: v[1].trim(),
      });
    }
  }
  if (result.length < nb_blocs && circuit_code && nb_blocs <= 4) {
    logger.warn(`parseVerbatims [${circuit_code}] : ${nb_blocs} bloc(s) / ${result.length} capté(s)`);
  }
  return result;
}

// Construit l'objet d'entrée pour un pilier, à partir de la structure préparée.
function construireEntree(pilier, refPiliers, refProfils, civilite) {
  // Sous-totaux instrumentaux du pilier (somme des instrumentaux de ses circuits).
  const sous_totaux = { P1: 0, P2: 0, P3: 0, P4: 0, P5: 0 };
  for (const c of pilier.circuits) {
    for (const px of ['P1', 'P2', 'P3', 'P4', 'P5']) {
      sous_totaux[px] += (c.instrumentaux?.[px] || 0);
    }
  }

  const circuits_input = pilier.circuits.map(c => {
    // sortants = instrumentaux > 0 (déjà figés, aucun recalcul)
    const sortants = {};
    for (const px of ['P1', 'P2', 'P3', 'P4', 'P5']) {
      const v = c.instrumentaux?.[px] || 0;
      if (v > 0) sortants[px] = v;
    }
    return {
      code:             c.code,
      nom:              c.nom,
      capacite:         c.capacite || '',          // v10
      coeur:            c.coeur,
      total:            c.total,
      niveau:           c.niveau_coeur,             // figé (échelle cœur)
      niveau_amplitude: c.niveau_amplitude,         // figé (échelle amplitude) — v10
      adhoc:            !!c.adhoc,
      nom_ad_hoc:       c.nom_ad_hoc || '',
      sortants,
      verbatims:        parseVerbatims(c.verbatims_source || '', c.code),
    };
  });

  // signal limbique : pris du premier circuit qui en porte un (comme le P-A v9).
  const signal = pilier.circuits.map(c => c.signal_limbique).find(s => s && s !== 'NULLE') || '';

  return {
    candidat_civilite:        civilite || '',
    pilier_code:              pilier.pilier_code,
    pilier_nom:               refPiliers[pilier.pilier_code] || pilier.pilier_nom || '',
    pilier_role:              pilier.role_pilier,           // socle/amont/aval/fonctionnel (déjà propre)
    pilier_mode:              pilier.pilier_mode || '',
    profils_types:            refProfils[pilier.pilier_code] || [],
    echelle_classement:       pilier.echelle_classement,    // "coeur" ou "total" (déjà décidé)
    signal_limbique:          signal ? signal : 'Aucun signal limbique détecté.',
    sous_totaux_instrumentaux: sous_totaux,
    circuits:                 circuits_input,
  };
}

// ═══════════════════════════════════════════════════════════════
// SECTION 2 — RÉFÉRENTIELS (noms officiels piliers / profils types)
// ═══════════════════════════════════════════════════════════════

async function chargerReferentiels() {
  let piliers = {}, profils = {};
  try {
    const refP = await airtableService.getReferentielPiliers();
    for (const p of (refP || [])) {
      if (p.pilier_code && p.pilier_nom) piliers[p.pilier_code] = p.pilier_nom;
    }
  } catch (e) { logger.warn('Réf piliers indisponible', { error: e.message }); }
  try {
    const refPr = await airtableService.getReferentielProfils();
    for (const r of (refPr || [])) {
      const code = r.pilier;
      if (code) { if (!profils[code]) profils[code] = []; if (r.nom) profils[code].push(r.nom); }
    }
  } catch (e) { logger.warn('Réf profils indisponible', { error: e.message }); }
  return { piliers, profils };
}

// ═══════════════════════════════════════════════════════════════
// SECTION 3 — APPEL CLAUDE (prompt v10), streaming
// ═══════════════════════════════════════════════════════════════

async function appellerClaude(entree, opts = {}) {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error('CLAUDE_API_KEY / ANTHROPIC_API_KEY manquante');
  const client = new Anthropic({ apiKey });

  // ⭐ OPTIMISATION 19/06 — CACHE DE PROMPT.
  // Le prompt v10 (~20k tokens) est identique à chaque pilier. On le marque cache_control
  // ephemeral pour qu'il ne soit facturé/encodé qu'une fois, puis relu à prix réduit sur les
  // 4 piliers suivants (les 5 appels s'enchaînent dans la fenêtre de cache de 5 min).
  // Syntaxe vérifiée sur la doc Anthropic : system = tableau de blocs, cache_control sur le bloc.
  // ⚠️ Le prompt DOIT rester figé (aucune date/variable interpolée) sinon le cache est invalidé.
  const stream = await client.messages.stream({
    model:      'claude-sonnet-4-6',
    max_tokens: opts.max_tokens || 16000,
    system: [
      { type: 'text', text: chargerPrompt(), cache_control: { type: 'ephemeral' } }
    ],
    messages:   [{ role: 'user', content: JSON.stringify(entree, null, 2) }],
  });
  const response = await stream.finalMessage();

  if (response.stop_reason === 'max_tokens') {
    throw new Error(`PA tronqué (max_tokens) — pilier ${entree.pilier_code}. Augmenter max_tokens.`);
  }
  const raw = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  const cleaned = raw.replace(/^```(?:json)?\s*/m, '').replace(/```\s*$/m, '').trim();
  try { return JSON.parse(cleaned); }
  catch (err) {
    logger.error('Parse JSON PA raté', { debut: raw.slice(0, 300) });
    throw new Error(`Parse JSON PA: ${err.message}`);
  }
}

// ═══════════════════════════════════════════════════════════════
// SECTION 4 — VALIDATION (reprise du P-A v9 + contrôles v10)
// ═══════════════════════════════════════════════════════════════

const MOTS_INTERDITS = ['impressionnant','impressionnante','remarquable','performant','performante',
  'précieux','précieuse','à mobiliser sur','cluster','aucun cluster'];
const QUALITES_INTERDITES_MODE = ['analytique','rigoureux','rigoureuse','méthodique','organisé',
  'organisée','curieux','curieuse','créatif','créative','précis','précise','efficace','polyvalent'];
const PROFONDEURS_VALIDES = ['effleuré','effectif','plein régime'];
// Rattachement HAUT/MOYEN (assoupli 19/06) : liste FERMÉE de 3 formules autorisées (le pont vers le
// référentiel reste garanti, mais sans fragilité d'une seule formule au mot près). L'agent doit en utiliser UNE.
const FORMULES_RATTACHEMENT = [
  'sont ce que le protocole nomme',
  'correspondent à ce que le protocole nomme',
  'relèvent de ce que le protocole nomme',
];
function aUneFormuleRattachement(txt) {
  return FORMULES_RATTACHEMENT.some(f => txt.includes(f));
}

function valider(pa, entree) {
  const errors = [], warnings = [];

  const codes_attendus = (entree.circuits || []).map(c => c.code);
  const codes_sortie = new Set((pa.circuits || []).map(c => c.code));
  for (const code of codes_attendus) if (!codes_sortie.has(code)) errors.push(`Circuit ${code} absent de la sortie`);

  for (const c of (pa.circuits || [])) {
    const code = c.code;
    const expl    = c.explication || '';
    const expl_c  = c.explication_courte || '';
    const renfort = c.en_renfort || '';
    const micro   = c.soleil_micro || '';
    const prof    = c.profondeur || '';

    const ic = (entree.circuits || []).find(x => x.code === code) || {};
    const max_svc = Math.max(0, ...Object.values(ic.sortants || {}));
    const niveau  = ic.niveau || 'FAIBLE';

    // T1 : "Vous + verbe" ou amorces autorisées (assoupli 19/06 : + Dès que/Pendant que/Lorsque/Une fois/Chaque fois)
    if (!expl.match(/^(Vous\s|Dès que vous |Pendant que vous |Lorsque |Lorsqu'|Une fois |Chaque fois |Dans |Avant |Ponctuellement|À l'occasion|Il vous arrive|Ce geste ne s'active|Quand |En |Depuis )/i)) {
      errors.push(`[${code}] n3_nuance ne commence pas par "Vous + verbe" ou une amorce autorisée. Début : "${expl.slice(0,50)}"`);
    }
    // Guillemets interdits dans n3_nuance (v10, strict)
    if (/[«»]/.test(expl)) errors.push(`[${code}] n3_nuance contient des guillemets «» — paraphrase pure obligatoire`);

    // explication_courte ≤ 18 mots
    const nbm = (expl_c.match(/\S+/g) || []).length;
    if (!expl_c) errors.push(`[${code}] explication_courte vide`);
    if (nbm > 18) errors.push(`[${code}] explication_courte : ${nbm} mots (max 18)`);

    // EN SOUTIEN (cœur 0)
    if (ic.coeur === 0 && expl_c && !expl_c.toLowerCase().startsWith('jamais en propre')) {
      errors.push(`[${code}] explication_courte cœur=0 doit commencer par "Jamais en propre :"`);
    }

    // en_renfort
    if (max_svc < 2 && renfort.trim()) errors.push(`[${code}] en_renfort devrait être vide (aucun sortant ≥2)`);
    if (renfort.trim() && !renfort.trim().startsWith('En renfort :')) errors.push(`[${code}] en_renfort doit commencer par "En renfort :"`);

    // soleil_micro : HAUT+MOYEN seulement, ≤15 mots
    if (micro) {
      if (niveau === 'FAIBLE' || niveau === 'EN_SOUTIEN') errors.push(`[${code}] soleil_micro non vide pour ${niveau}`);
      if ((micro.match(/\S+/g) || []).length > 15) errors.push(`[${code}] soleil_micro > 15 mots`);
    }

    // v10 — profondeur : toujours remplie, valeur du lexique fermé
    if (!prof) errors.push(`[${code}] profondeur manquante (effleuré/effectif/plein régime)`);
    else if (!PROFONDEURS_VALIDES.includes(prof)) errors.push(`[${code}] profondeur invalide : "${prof}"`);

    // v10 — capacité montrée si démontrée : si capacite ≠ simple ET phrase capacité absente, simple warning
    // (on ne peut pas trancher automatiquement la "démonstration" → warning informatif, pas un blocage)

    // Mots interdits
    for (const mot of MOTS_INTERDITS) {
      if ((expl + ' ' + expl_c + ' ' + renfort).toLowerCase().includes(mot)) errors.push(`[${code}] mot interdit : "${mot}"`);
    }

    // Longueurs n3_nuance (souples = warnings)
    const seuils = { HAUT:{min:250,max:480}, MOYEN:{min:160,max:320}, FAIBLE:{min:100,max:210}, EN_SOUTIEN:{min:70,max:170} };
    const s = seuils[niveau] || seuils.FAIBLE;
    if (expl.length < s.min) warnings.push(`[${code}] n3_nuance courte pour ${niveau} (${expl.length}c)`);
    if (expl.length > s.max) warnings.push(`[${code}] n3_nuance longue pour ${niveau} (${expl.length}c)`);
  }

  // Blocs
  for (const bloc of (pa.blocs || [])) {
    const n = (bloc.niveau || '').toUpperCase();
    const tech = bloc.synth_technique || '';
    const cand = bloc.synth_candidat || '';
    const rattach = bloc.synth_rattachement || '';
    const prefixe = n === 'HAUT' ? 'Bloc HAUT cœur' : n === 'MOYEN' ? 'Bloc MOYEN cœur' : 'Bloc FAIBLE';
    if (!tech.trim().startsWith(prefixe)) errors.push(`[Bloc ${n}] synth_technique doit commencer par "${prefixe}"`);
    if (n === 'FAIBLE' && /P[1-5]C\d{1,2}/i.test(cand)) errors.push(`[Bloc FAIBLE] synth_candidat contient un code circuit`);
    if ((n === 'HAUT' || n === 'MOYEN') && rattach && !aUneFormuleRattachement(rattach)) {
      errors.push(`[Bloc ${n}] rattachement doit contenir une formule autorisée (ex. "sont ce que le protocole nomme")`);
    }
    if (n === 'FAIBLE' && aUneFormuleRattachement(rattach)) {
      errors.push(`[Bloc FAIBLE] rattachement ne doit PAS contenir de formule de rattachement au protocole`);
    }
  }

  // Synthèse pilier
  const sp = pa.synthese_pilier || {};
  if (!sp.mode_libelle) errors.push('mode_libelle vide');
  if (!['FOURNI','PROPOSITION'].includes(sp.mode_statut)) errors.push(`mode_statut invalide : "${sp.mode_statut}"`);
  if (!(sp.mode_explication_candidat || '').startsWith('Ce mode découle')) errors.push('mode_explication_candidat doit commencer par "Ce mode découle"');
  if (sp.mode_statut === 'PROPOSITION' && sp.mode_libelle) {
    const q = QUALITES_INTERDITES_MODE.find(x => sp.mode_libelle.toLowerCase().includes(x));
    if (q) errors.push(`[mode_libelle] qualité interdite "${q}"`);
  }
  const vue = sp.vue_ensemble || '';
  for (const titre of ['Profil — ce que vos gestes disent de vous','▸','Le mode retenu','Où cet outil revient']) {
    if (!vue.includes(titre)) errors.push(`vue_ensemble : titre manquant "${titre}"`);
  }
  const intro = sp.intro_eclate || '';
  if (!intro) errors.push('intro_eclate vide');
  if (/\d/.test(intro)) errors.push('intro_eclate contient un chiffre');
  if (/P[1-5]C\d/i.test(intro)) errors.push('intro_eclate contient un code circuit');
  if ((intro.match(/\S+/g) || []).length > 40) errors.push('intro_eclate > 40 mots');

  return { ok: errors.length === 0, errors, warnings };
}

// ═══════════════════════════════════════════════════════════════
// SECTION 5 — ÉCRITURE T3 (via pilierMap fourni par la préparation)
// ═══════════════════════════════════════════════════════════════

async function ecrireT3(pa, pilier, pilierRecId, circuitRecByCode, opts) {
  // ── T3_PILIER ──
  const fp = {};
  for (const bloc of (pa.blocs || [])) {
    const n = (bloc.niveau || '').toUpperCase();
    const rattach = bloc.synth_rattachement || '';
    if (n === 'HAUT') {
      fp[F_PIL.bloc_haut_candidat]  = bloc.synth_candidat  || '';
      fp[F_PIL.bloc_haut_technique] = bloc.synth_technique || '';
      fp[F_PIL.bloc_haut_catalogue] = rattach;
    } else if (n === 'MOYEN') {
      fp[F_PIL.bloc_moyen_candidat]  = bloc.synth_candidat  || '';
      fp[F_PIL.bloc_moyen_technique] = bloc.synth_technique || '';
      fp[F_PIL.bloc_moyen_catalogue] = rattach;
    } else if (n === 'FAIBLE') {
      fp[F_PIL.bloc_faible_candidat]  = bloc.synth_candidat  || '';
      fp[F_PIL.bloc_faible_technique] = bloc.synth_technique || '';
      fp[F_PIL.bloc_faible_catalogue] = rattach;
    }
  }
  const sp = pa.synthese_pilier || {};
  fp[F_PIL.synth_interpretee] = sp.vue_ensemble || '';
  fp[F_PIL.mode_explication]  = sp.mode_explication_candidat || '';
  fp[F_PIL.intro_eclate]      = sp.intro_eclate || '';
  if (sp.profil_pur)    fp[F_PIL.synth_factuelle] = sp.profil_pur;
  // mode : écrit seulement si autorisé (validation manuelle)
  if (opts.write_mode && sp.mode_libelle) fp[F_PIL.pilier_mode] = sp.mode_libelle;

  await airtableService.updateRecordById
    ? await airtableService.updateRecordById(airtableConfig.TABLES.ETAPE1_T3_PILIER, pilierRecId, fp)
    : await updateViaSDK(airtableConfig.TABLES.ETAPE1_T3_PILIER, pilierRecId, fp);

  // ── T3_CIRCUIT (1 update par circuit) ──
  for (const c of (pa.circuits || [])) {
    const recId = circuitRecByCode[c.code];
    if (!recId) { logger.warn(`Rédaction PA : rec T3_CIRCUIT introuvable pour ${c.code}`); continue; }
    const fc = {
      [F_CIR.n3_nuance]:              c.explication || '',
      [F_CIR.explication_courte_ch4]: c.explication_courte || '',
      [F_CIR.en_renfort]:             c.en_renfort || '',
    };
    if (c.n2_verbatims && F_CIR.n2_verbatims) fc[F_CIR.n2_verbatims] = c.n2_verbatims;
    if (c.soleil_micro && F_CIR.soleil_micro) fc[F_CIR.soleil_micro] = c.soleil_micro;
    // v10 — profondeur écrite par l'agent (le lookup la recopiera vers POURBILAN)
    if (c.profondeur && F_CIR.profondeur) fc[F_CIR.profondeur] = c.profondeur;

    // verbatims cités
    const vbs = c.verbatims_cites || [];
    const refMap = ['verbatim_1','verbatim_2','verbatim_3','verbatim_4'];
    const refMapRef = ['verbatim_1_ref','verbatim_2_ref','verbatim_3_ref','verbatim_4_ref'];
    vbs.slice(0, 4).forEach((v, i) => {
      if (F_CIR[refMap[i]])    fc[F_CIR[refMap[i]]]    = v.texte || '';
      if (F_CIR[refMapRef[i]]) fc[F_CIR[refMapRef[i]]] = `${v.qid || ''} ${v.lieu || ''}`.trim();
    });

    await airtableService.updateRecordById
      ? await airtableService.updateRecordById(airtableConfig.TABLES.ETAPE1_T3_CIRCUIT, recId, fc)
      : await updateViaSDK(airtableConfig.TABLES.ETAPE1_T3_CIRCUIT, recId, fc);
  }
}

// Repli si airtableService n'expose pas updateRecordById : update direct via SDK.
async function updateViaSDK(tableId, recId, fields) {
  const Airtable = require('airtable');
  const token = airtableConfig.TOKEN || process.env.AIRTABLE_TOKEN;
  const base  = new Airtable({ apiKey: token }).base(airtableConfig.BASE_ID || 'appgghhXjYBdFRras');
  return new Promise((resolve, reject) => {
    base(tableId).update(recId, fields, { typecast: true }, (err, rec) => err ? reject(err) : resolve(rec));
  });
}

// ═══════════════════════════════════════════════════════════════
// SECTION 6 — ORCHESTRATION
// ═══════════════════════════════════════════════════════════════

// Récupère les rec_ids des circuits créés par la préparation, indexés par code "PxCy".
async function indexerCircuitsCrees(candidat_id, pilier_code) {
  const circuits = await airtableService.getEtape1T3Circuits(candidat_id);
  const map = {};
  for (const r of (circuits || [])) {
    const pil = (typeof r[F_CIR.pilier] === 'object' ? r[F_CIR.pilier]?.name : r[F_CIR.pilier]) || r.pilier;
    const cid = r[F_CIR.circuit_id] || r.circuit_id;
    if (pil === pilier_code && cid) map[`${pil}${cid}`] = r.airtable_id || r.id;
  }
  return map;
}

async function redigerPilier(prep, pilier, refs, opts) {
  const entree = construireEntree(pilier, refs.piliers, refs.profils, opts.civilite);

  if (opts.dry_run) {
    logger.info(`[DRY-RUN] entrée ${pilier.pilier_code}`, { circuits: entree.circuits.length });
    return { pilier_code: pilier.pilier_code, dry_run: true, entree };
  }

  const MAX_RETRY = opts.max_retries || 2;
  let pa, validation;
  for (let t = 1; t <= MAX_RETRY; t++) {
    pa = await appellerClaude(entree, opts);
    validation = valider(pa, entree);
    if (validation.ok) break;
    logger.warn(`Rédaction PA ${pilier.pilier_code} — ${validation.errors.length} erreur(s), tentative ${t}/${MAX_RETRY}`,
      { errors: validation.errors });
    if (t === MAX_RETRY && opts.strict) throw new Error(`Validation PA échouée (${pilier.pilier_code})`);
  }
  for (const w of (validation.warnings || [])) logger.info(`PA ${pilier.pilier_code} ⚠️ ${w}`);

  const pilierRecId = prep.pilierMap.get(pilier.pilier_code);
  const circuitRecByCode = await indexerCircuitsCrees(prep.candidat_id, pilier.pilier_code);
  await ecrireT3(pa, pilier, pilierRecId, circuitRecByCode, opts);

  return {
    pilier_code:  pilier.pilier_code,
    mode_libelle: pa.synthese_pilier?.mode_libelle || '',
    mode_statut:  pa.synthese_pilier?.mode_statut  || '?',
    erreurs:      validation.errors,
  };
}

// Point d'entrée : reçoit le résultat de preparerT3() et rédige les piliers demandés.
async function redigerBilan(prep, opts = {}) {
  if (!prep || !prep.candidat_id || !Array.isArray(prep.piliers)) {
    throw new Error('Rédaction PA : entrée invalide (attendu le résultat de preparerT3).');
  }
  logger.info('Rédaction PA — démarrage', { candidat_id: prep.candidat_id, nb_piliers: prep.piliers.length });

  const refs = await chargerReferentiels();
  const ordre = opts.piliers || PILIERS_ORDRE;
  const piliersAFaire = ordre
    .map(code => prep.piliers.find(p => p.pilier_code === code))
    .filter(Boolean);

  // ⭐ OPTIMISATION 19/06 — REPRISE SANS REPAYER.
  // Si un bilan a planté en cours de route, les piliers déjà rédigés sont écrits en base
  // (leur vue d'ensemble = champ synth_interpretee est remplie). À la relance, on les SAUTE :
  // on ne renvoie à l'agent que les piliers dont la vue d'ensemble est encore vide.
  // opts.force = true rejoue tout (utile pour régénérer un bilan volontairement).
  let dejaFaits = new Set();
  if (!opts.force) {
    try {
      const t3piliers = await airtableService.getEtape1T3Piliers(prep.candidat_id);
      for (const p of (t3piliers || [])) {
        const code = (typeof p.pilier === 'object' ? p.pilier?.name : p.pilier);
        const vue  = p.synth_interpretee;
        if (code && vue && String(vue).trim().length > 0) dejaFaits.add(code);
      }
    } catch (e) {
      logger.warn('Rédaction PA — lecture état T3_PILIER impossible (on traite tout)', { error: e.message });
    }
  }

  const resultats = [];
  for (const pilier of piliersAFaire) {
    if (dejaFaits.has(pilier.pilier_code)) {
      logger.info(`Rédaction PA — ${pilier.pilier_code} déjà rédigé, sauté (pas de réappel agent)`, { candidat_id: prep.candidat_id });
      resultats.push({ pilier_code: pilier.pilier_code, saute: true, mode_statut: 'DEJA_FAIT' });
      continue;
    }
    try {
      const res = await redigerPilier(prep, pilier, refs, opts);
      resultats.push(res);
    } catch (err) {
      logger.error(`Rédaction PA — ${pilier.pilier_code} : ${err.message}`);
      if (opts.strict) throw err;
    }
  }
  logger.info('Rédaction PA — terminée', {
    candidat_id: prep.candidat_id,
    nb_traites: resultats.filter(r => !r.saute).length,
    nb_sautes:  resultats.filter(r => r.saute).length
  });
  return resultats;
}

module.exports = { redigerBilan, construireEntree, valider };
