/**
 * ════════════════════════════════════════════════════════════════════════
 * SERVICE CH4 v2 — CHAPITRE IV §02 « LE FILTRE ET LA FINALITÉ »
 * Profil-Cognitif Sib Prod · 25/06/2026
 *
 * Conforme à DOCTRINE_FILTRE_FINALITE du 25/06. Périme service_ch4.js (v1, cœur≥4).
 *
 * PRINCIPE : le filtre = réglage d'entrée commun du socle, lu en croisant
 *   (A) le bloc le plus haut du socle  ∩  (B) le socle activé en instrumental.
 *   La finalité = le « pour »-but traqué dans les réponses brutes du socle.
 *
 * 4 étapes :
 *   1) BUILDER déterministe — lit socle (T3_PILIER), bloc le plus haut, circuits du
 *      bloc (T3_CIRCUIT, verbatims), débordements instrumentaux (RESPONSES gouvernées
 *      par le socle sur questions d'autres outils), présentation des outils. AUCUN LLM.
 *   2) AGENT — applique le conducteur (T1→T9) : lit, traque, verbalise, calibre. Trace.
 *   3) WRITER — écrit filtre + finalité + preuves dans T3_BILAN.
 *   4) RUN — orchestration + dry-run.
 *
 * USAGE :
 *   node service_etape1_T3_bilan_PB_filtre.js --candidat <id>            → DRY-RUN
 *   node service_etape1_T3_bilan_PB_filtre.js --candidat <id> --write    → écrit §02 dans T3_BILAN
 * ════════════════════════════════════════════════════════════════════════
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs   = require('fs');
const path = require('path');

// Infrastructure prod (lectures/écritures éprouvées, mapping par field ID géré).
// Depuis services/etape1/etape1_t3/bilan_fable/ → services/infrastructure/
const airtableService = require('../../../infrastructure/airtableService');
let logger; try { logger = require('../../../../utils/logger'); } catch(e){ logger = console; }

const BASE_ID = 'appgghhXjYBdFRras';

// ── Tables (vérifiées 25/06) ──────────────────────────────────────────────
const T_PILIER  = 'tblzDIn7P2cOvVvY2';   // ETAPE1_T3_PILIER
const T_CIRCUIT = 'tblLAC4dS25v6IUbs';   // ETAPE1_T3_CIRCUIT (verbatims)
const T_RESP    = 'tblK28GE8RWq9tQMV';   // RESPONSES (réponses brutes intégrales)
const T_POUR    = 'tblV8UBCgEOzJ2Tch';   // POURBILAN (débordements en_svc)
const T_BILAN   = 'tblv775KQrEhsogdI';   // ETAPE1_T3_BILAN

// Chemin du prompt dans le repo : services/etape1/etape1_t3/bilan_fable/  →  new-prompts/etape1/bilan/
const PROMPT_PATH = path.join(__dirname, '../../../../new-prompts/etape1/bilan/prompt_etape1_T3_bilan_PB_filtre.md');

// ── Field IDs T3_PILIER ───────────────────────────────────────────────────
const F_PIL = {
  candidat:        'fldZKruIBDdjAsY47',
  pilier:          'fldVvi5gbKioBmlsQ',
  role:            'fldhFisqhUf9oBLOe',
  label:           'fldbDYECHFEGkh0Ng',
  mode:            'fldoGY71vyiaUeFl6',
  bloc_tres_souv:  'flds6XOIwvYr20iRY',   // synth_technique « très souvent »
  bloc_souvent:    'fld7Sv7LXlZ6XPghN',   // synth_technique « souvent »
};

// ── Field IDs T3_CIRCUIT (verbatims répartis sur 3 champs) ────────────────
const F_CIR = {
  candidat:   'candidat_id',             // fldpQzPEvlNaRXFgg (nom accepté en filtre)
  pilier:     'pilier',
  code:       'fldrnHJtNOWWYJ91t',       // "C12"
  nom:        'fldSGRXf8mi4q1NTd',
  verb1:      'fldLP9juCWCTlCZPt',
  verb2:      'fldhIp3aW72WR2V1t',
  verb3:      'fldSCQD9zvgRQcuq9',
  total:      'fldnFNJm6GP0mAGNm',
  profondeur: 'fldrtUgnSVYlsCgq6',
};

// ── Field IDs RESPONSES ───────────────────────────────────────────────────
const F_RESP = {
  candidat:  'fldD6c9DdWkVpZvMg',
  question:  'fldFgNVoNt5st0CXx',        // "P3Q6"
  gouverne:  'fldVepvgG6umwwG3R',        // pilier qui gouverne
  reponse:   'fldPEHxIIJwYIOs2Q',        // réponse brute INTÉGRALE
};

// ── Field IDs POURBILAN (pour repérer les en_svc du socle) ────────────────
const F_POUR = {
  candidat:  'candidat_id',
  code:      'fldrv1p6mMsjnSTKw',
  pilier:    'fldp5Ue0WF1Mg7kgT',
  total:     'fldcaYuC3ybbwyCpM',
  niveau:    'fldkl5QpuBqTIOmGV',
  bloc:      'fldnsWT41zOsFpuJz',
  role:      'fldxqdHKkM23ORlTf',
};

// ── Field IDs T3_BILAN §02 ────────────────────────────────────────────────
// COMMUN (réutilisé v1, noms config = filtre / ch4_filtre_preuves) + NOUVEAU (créés 25/06).
// ⚠️ NE PAS réutiliser fldKeQsg0PvyQTOWx : c'est filtre_preuve_3 (ancien filtre GELÉ) dans la config.
// Obsolètes v1 NON écrits : fldqDeT7EDov18iTz (ch4_filtre_revelation), fld1p9p9Csvyllvcm (filtre_declinaison).
const F_BILAN = {
  candidat:          'fldk66gddYGCREOV4',
  filtre:            'fld9vAKpKEMIcRiTB',   // COMMUN — config: filtre (permanence)
  filtre_preuves:    'fldXGZ5ijlcGPYc16',   // COMMUN — config: ch4_filtre_preuves
  finalite:          'fldobIgYtfa3Qiy4v',   // OBSOLÈTE v3 — non écrit (finalité abandonnée)
  finalite_preuve:   'fldLe9NPXIVfsNDjU',   // OBSOLÈTE v3 — non écrit
  profil_calibrage:  'fldFjcTlLSUjYR8Qy',   // NOUVEAU — filtre_profil_calibrage
  technique:         'fldFheeASGSqDvqOm',   // NOUVEAU — filtre_technique_v2 (PAS filtre_preuve_3 !)
  analyse_verbalisee:'fldduLP9UN4tVRnPE',   // NOUVEAU — filtre_analyse_verbalisee (trace <analyse> T1→T9, audit, comme PA)
};

// ── Les 8 familles de profils (calibrage) — doctrine 25/06 ────────────────
const PROFILS_FAMILLES = [
  {n:1, famille:'Éclaireur de chemins',      registre:'ouvrir des voies, sortir de l\'impasse',
   variantes:['des voies créatives','du déblocage','des angles neufs','de la sortie d\'impasse']},
  {n:2, famille:'Catalyseur d\'équilibre',    registre:'rétablir l\'harmonie, apaiser',
   variantes:['des tensions','des relations','du climat','de la médiation']},
  {n:3, famille:'Révélateur de potentiels',  registre:'faire émerger des talents ignorés',
   variantes:['des talents','des possibles','des forces cachées','de la valeur ignorée']},
  {n:4, famille:'Bâtisseur de ponts',        registre:'relier ce qui était cloisonné',
   variantes:['des personnes','des idées','des ressources','des silos']},
  {n:5, famille:'Gardien d\'intégrité',       registre:'rétablir la cohérence, la vérité',
   variantes:['de la vérité','de l\'éthique','de la rigueur','de la justesse']},
  {n:6, famille:'Catalyseur de mouvement',   registre:'remettre en marche, débloquer l\'inertie',
   variantes:['de l\'élan','de l\'action','de la décision exécutée','de l\'inertie vaincue']},
  {n:7, famille:'Protecteur des vulnérables',registre:'défendre, sécuriser les fragiles',
   variantes:['des fragiles','du cadre sûr','du soin','de la prévention']},
  {n:8, famille:'Orchestrateur de l\'ordre',  registre:'structurer, organiser ; poser le principe qui régit',
   variantes:['de l\'organisation','des règles et des principes','des systèmes','de la méthode']},
];

// ── helpers ───────────────────────────────────────────────────────────────
function _sel(v){ if(!v) return ''; if(typeof v==='string') return v; if(Array.isArray(v)) return v[0]?.name||''; return v.name||''; }
function _num(v){ return typeof v==='number' ? v : 0; }
function _arg(a,n){ const i=a.indexOf(n); return i>=0 && a[i+1] ? a[i+1] : null; }

// ════════════════════════════════════════════════════════════════════════
// 1) BUILDER DÉTERMINISTE
// ════════════════════════════════════════════════════════════════════════

/** Lit l'architecture via l'infra prod : piliers, rôles, labels, modes, blocs. Trouve le socle. */
async function lireArchitecture(cid){
  const rows = await airtableService.getEtape1T3Piliers(cid);  // mappé par nom de config
  const piliers = {}; let socle = null; let pa_socle = null;
  for(const r of rows){
    const code = _sel(r.pilier);
    const role = _sel(r.role_pilier).toLowerCase();
    piliers[code] = {
      code, role,
      label: _sel(r.pilier_label),
      mode:  r.pilier_mode || '',
      bloc_tres_souvent: r.bloc_tres_souvent_technique || '',
      bloc_souvent:      r.bloc_souvent_technique || '',
    };
    if(role==='socle'){
      socle = code;
      // ⭐ Synthèse PA déjà posée sur le socle : SOURCE du filtre (geste d'ensemble),
      //   l'instrumental viendra l'arbitrer/confirmer (cf. construireEntree).
      pa_socle = {
        verbalisation_gestes: r.analyse_verbalisee || '',  // lecture geste par geste + cassure
        vue_ensemble:         r.synth_interpretee || '',   // le geste d'ensemble + le mode retenu
      };
    }
  }
  return { piliers, socle, pa_socle };
}

/** Présentation des outils = lexique partagé (label, rôle, mode). */
function buildPresentationOutils(piliers){
  const out={};
  for(const code of ['P1','P2','P3','P4','P5']){
    const p=piliers[code]||{};
    out[code]={ label:p.label||code, role:p.role||'', mode:p.mode||'' };
  }
  return out;
}

/**
 * SOURCE A — le bloc le plus haut du socle.
 * Lit la synth_technique "très souvent" (à défaut "souvent"), extrait les codes de circuits,
 * puis récupère leurs verbatims complets via l'infra (getEtape1T3Circuits).
 */
async function lireBlocHautSocle(cid, socle, archSocle){
  let nom_bloc='très souvent', synth=archSocle.bloc_tres_souvent;
  if(!synth || !synth.trim()){ nom_bloc='souvent'; synth=archSocle.bloc_souvent; }

  const codes=[...new Set((synth.match(/P[1-5]C\d{1,2}/g)||[]))];

  // Tous les circuits du candidat (mappés par nom de config), on filtre le socle en mémoire.
  const tous = await airtableService.getEtape1T3Circuits(cid);
  const circuitsByCode={};
  for(const r of tous){
    const pil = _sel(r.pilier);
    if(pil !== socle) continue;
    const c = _sel(r.circuit_id);                 // "C12"
    const full = c.startsWith('P') ? c : `${socle}${c}`;
    const verbs = [r.verbatim_1, r.verbatim_2, r.verbatim_3, r.verbatim_4,
                   r.n2_verbatims].filter(Boolean);
    circuitsByCode[full]={
      code: full,
      libelle: _sel(r.circuit_nom),
      profondeur: _sel(r.profondeur),
      total: _num(r.total_activations),
      verbatims: verbs,
    };
  }

  // Si la synth ne cite aucun code (rare), prendre tous les circuits socle triés par total.
  let circuits;
  if(codes.length){
    circuits = codes.map(code=>{
      const c=circuitsByCode[code]||{code,libelle:'',profondeur:'',total:0,verbatims:[]};
      const capMatch = synth.match(new RegExp(code+'[^;]*?capacité\\s+([^,;]+)','i'));
      return { ...c, capacite: capMatch ? capMatch[1].trim() : '' };
    });
  } else {
    circuits = Object.values(circuitsByCode).map(c=>({ ...c, capacite:'' }));
  }
  circuits.sort((a,b)=>b.total-a.total);
  return { nom_bloc, circuits, synth };
}

/**
 * SOURCE B — les réponses brutes du candidat.
 * RESPONSES ne porte pas de champ « pilier gouvernant » fiable ; on passe donc à l'agent
 * TOUTES les réponses brutes intégrales, en marquant l'outil de la question (PxQn → Px).
 * L'agent isole lui-même le réglage d'entrée du socle et les « pour »-but (cf. conducteur).
 */
async function lireSocleInstrumental(cid, socle){
  const resp = await airtableService.getResponses(cid);   // champs par nom
  const toutes=[]; const instrumental=[];
  for(const r of resp){
    const q   = _sel(r.id_question);                       // "P3Q6"
    const rep = r.response_text || '';
    if(!q || !rep) continue;
    toutes.push({ question:q, reponse_brute:rep });
    const outilQ = q.slice(0,2);                            // "P3"
    if(outilQ !== socle){
      instrumental.push({ question:q, outil_question:outilQ, gouverne:socle, reponse_brute:rep });
    }
  }
  return { instrumental, reponses_socle_completes: toutes };
}

// ════════════════════════════════════════════════════════════════════════
// 2) AGENT
// ════════════════════════════════════════════════════════════════════════

function construireEntree(cid, socle, presentation, blocHaut, instr, pa_socle){
  return {
    candidat_id: cid,
    socle,
    presentation_outils: presentation,
    // ⭐ POINT DE DÉPART DU FILTRE : la lecture PA déjà faite et validée sur le socle.
    //   L'agent reformule le geste d'ensemble en une phrase (filtre), il ne re-déduit pas.
    pa_lecture_socle: pa_socle ? {
      vue_ensemble:        pa_socle.vue_ensemble,        // le geste d'ensemble + mode (source du filtre)
      verbalisation_gestes: pa_socle.verbalisation_gestes, // détail geste par geste (appui)
    } : null,
    bloc_haut_socle: { nom_bloc: blocHaut.nom_bloc, circuits: blocHaut.circuits.map(c=>({
      code:c.code, libelle:c.libelle, capacite:c.capacite, profondeur:c.profondeur,
      total:c.total, verbatims:c.verbatims,
    })) },
    // SOURCE B : l'instrumental ARBITRE le filtre (ce qui domine hors terrain) et le CONFIRME.
    socle_instrumental: instr.instrumental,
    reponses_socle_completes: instr.reponses_socle_completes,
    profils_familles: PROFILS_FAMILLES,
  };
}

async function appelerAgent(entree){
  const prompt=fs.readFileSync(PROMPT_PATH,'utf-8');
  const client=new Anthropic({apiKey:process.env.CLAUDE_API_KEY||process.env.ANTHROPIC_API_KEY});
  const msg=await client.messages.create({
    model:'claude-sonnet-4-6', max_tokens:16000, system:prompt,
    messages:[{role:'user',content:JSON.stringify(entree,null,2)}],
  });
  const text=msg.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');

  // Bloc <analyse> (toléré : balise fermante absente) — purement pour la trace.
  let analyse='';
  const aMatch = text.match(/<analyse>([\s\S]*?)(?:<\/analyse>|$)/);
  if(aMatch) analyse = aMatch[1].trim();

  // JSON = objet {...} après l'analyse. On coupe ce qui précède la fin de l'analyse,
  // puis on prend du 1er '{' au dernier '}' (robuste à l'imbrication profil_calibrage).
  let sortie;
  let zone = text.replace(/```json|```/g,'');
  const endAnalyse = zone.lastIndexOf('</analyse>');
  if(endAnalyse >= 0) zone = zone.slice(endAnalyse + '</analyse>'.length);
  const first = zone.indexOf('{');
  const last  = zone.lastIndexOf('}');
  if(first < 0 || last <= first){
    throw new Error('Sortie agent : aucun objet JSON trouvé après l\'analyse. Réponse : '+text.slice(-400));
  }
  try {
    sortie = JSON.parse(zone.slice(first, last+1));
  } catch(e){
    // fallback : peut-être le JSON est tronqué (max_tokens) → message clair
    throw new Error('Sortie agent : JSON invalide ou tronqué. Fin de réponse : '+text.slice(-400));
  }
  return { sortie, analyse };
}

// ════════════════════════════════════════════════════════════════════════
// 3) WRITER
// ════════════════════════════════════════════════════════════════════════

async function ecrire(cid, sortie, analyse){
  if(!sortie.filtre) throw new Error('Sortie agent : champ "filtre" manquant');
  const profilTxt = sortie.profil_calibrage
    ? `${sortie.profil_calibrage.famille} — ${sortie.profil_calibrage.variante||''}`.trim()
    : '(aucun profil ne colle)';
  const fields={
    [F_BILAN.filtre]:            sortie.filtre,
    [F_BILAN.filtre_preuves]:    sortie.filtre_preuves||'',
    [F_BILAN.profil_calibrage]:  profilTxt,
    [F_BILAN.technique]:         sortie.technique||'',
    [F_BILAN.analyse_verbalisee]: analyse || '(verbalisation absente)',
  };
  return await airtableService.upsertEtape1T3Bilan(cid, fields);  // upsert par field ID
}

// ════════════════════════════════════════════════════════════════════════
// 4) RUN — compatible DEUX modes d'appel :
//   • Orchestrateur : run({ candidat_id })  → écrit en base (prod), retourne un résumé.
//   • CLI           : node service… --candidat <id> [--write]  → dry-run sauf --write.
// ════════════════════════════════════════════════════════════════════════

async function run(opts = {}){
  let cid, doWrite;
  if (opts && opts.candidat_id) {
    cid = opts.candidat_id;
    doWrite = opts.write_mode !== false;   // écriture par défaut en prod
  } else {
    const args = process.argv.slice(2);
    cid = _arg(args, '--candidat');
    doWrite = args.includes('--write');
    if (!cid) { console.error('ERREUR : --candidat <id> obligatoire (ou run({candidat_id}))'); process.exit(1); }
  }

  // 1) Architecture + socle (via infra prod)
  const {piliers,socle,pa_socle}=await lireArchitecture(cid);
  if(!socle){ throw new Error('PB filtre : socle introuvable (T3_PILIER.role_pilier) pour '+cid); }
  logger.info?.('[PB filtre] socle', { cid, socle, label: piliers[socle]?.label });
  console.log(`[PB filtre] Socle = ${socle} (${piliers[socle]?.label})`);

  // 2) Builder : présentation + source A + source B
  const presentation=buildPresentationOutils(piliers);
  const blocHaut=await lireBlocHautSocle(cid,socle,piliers[socle]);
  console.log(`[PB filtre] Bloc le plus haut = « ${blocHaut.nom_bloc} » · ${blocHaut.circuits.length} circuits : ${blocHaut.circuits.map(c=>c.code+'('+c.total+')').join(', ')}`);
  const instr=await lireSocleInstrumental(cid,socle);
  console.log(`[PB filtre] Réponses lues : ${instr.reponses_socle_completes.length} · dont ${instr.instrumental.length} sur questions d'autres outils`);

  // 3) Agent
  const entree=construireEntree(cid,socle,presentation,blocHaut,instr,pa_socle);
  const {sortie,analyse}=await appelerAgent(entree);

  // 4) Écriture / dry-run
  if(doWrite){
    const recId = await ecrire(cid, sortie, analyse);
    console.log(`[PB filtre] ✅ Filtre + profil écrits dans T3_BILAN ${recId}`);
    console.log(`[PB filtre]    Filtre : « ${sortie.filtre} »`);
    console.log(`[PB filtre]    Profil : ${sortie.profil_calibrage ? sortie.profil_calibrage.famille+' / '+(sortie.profil_calibrage.variante||'') : '(aucun)'}`);
    return { ok:true, candidat_id:cid, bilanRecId:recId, filtre:sortie.filtre, profil:sortie.profil_calibrage||null };
  } else {
    console.log('\n── <analyse> de l\'agent ──\n'+analyse);
    console.log('\n── JSON agent ──\n'+JSON.stringify(sortie,null,2));
    console.log('\n── Builder (audit) ──');
    console.log(JSON.stringify({bloc_haut:blocHaut.circuits.map(c=>({code:c.code,total:c.total,cap:c.capacite,prof:c.profondeur})), instrumental:instr.instrumental.map(x=>x.question)},null,2));
    return { ok:true, candidat_id:cid, dryRun:true, filtre:sortie.filtre, profil:sortie.profil_calibrage||null };
  }
}

if(require.main===module) run().catch(e=>{console.error(e);process.exit(1);});

module.exports={ lireArchitecture, buildPresentationOutils, lireBlocHautSocle,
  lireSocleInstrumental, construireEntree, appelerAgent, ecrire, run,
  PROFILS_FAMILLES, F_PIL, F_CIR, F_RESP, F_BILAN, BASE_ID };
