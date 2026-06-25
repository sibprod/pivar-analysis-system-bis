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

const Airtable  = require('airtable');
const Anthropic = require('@anthropic-ai/sdk');
const fs   = require('fs');
const path = require('path');

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
  finalite:          'fldobIgYtfa3Qiy4v',   // NOUVEAU — filtre_finalite
  finalite_preuve:   'fldLe9NPXIVfsNDjU',   // NOUVEAU — filtre_finalite_preuve
  profil_calibrage:  'fldFjcTlLSUjYR8Qy',   // NOUVEAU — filtre_profil_calibrage
  technique:         'fldFheeASGSqDvqOm',   // NOUVEAU — filtre_technique_v2 (PAS filtre_preuve_3 !)
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

/** Lit l'architecture : tous les piliers, leurs rôles, labels, modes. Trouve le socle. */
async function lireArchitecture(cid, at){
  const piliers = {}; let socle = null;
  await at(T_PILIER).select({
    filterByFormula:`{candidat_id}="${cid}"`,
    fields:[F_PIL.pilier,F_PIL.role,F_PIL.label,F_PIL.mode,F_PIL.bloc_tres_souv,F_PIL.bloc_souvent],
  }).eachPage((recs,next)=>{
    for(const r of recs){
      const code=_sel(r.get(F_PIL.pilier)); const role=_sel(r.get(F_PIL.role)).toLowerCase();
      piliers[code]={
        code, role,
        label:_sel(r.get(F_PIL.label)),
        mode:r.get(F_PIL.mode)||'',
        bloc_tres_souvent:r.get(F_PIL.bloc_tres_souv)||'',
        bloc_souvent:r.get(F_PIL.bloc_souvent)||'',
      };
      if(role==='socle') socle=code;
    }
    next();
  });
  return { piliers, socle };
}

/** Présentation des outils = lexique partagé (label, rôle, rappel≈mode, mode). */
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
 * Lit le champ synth_technique "très souvent" ; à défaut "souvent".
 * Récupère les circuits du bloc avec leurs verbatims complets (T3_CIRCUIT).
 */
async function lireBlocHautSocle(cid, socle, archSocle, at){
  // déterminer le bloc le plus haut non vide
  let nom_bloc='très souvent', synth=archSocle.bloc_tres_souvent;
  if(!synth || !synth.trim()){ nom_bloc='souvent'; synth=archSocle.bloc_souvent; }

  // extraire les codes de circuits cités dans la synth (PxCy)
  const codes=[...new Set((synth.match(/P[1-5]C\d{1,2}/g)||[]))];

  // charger les circuits du socle dans T3_CIRCUIT
  const circuitsByCode={};
  await at(T_CIRCUIT).select({
    filterByFormula:`AND({candidat_id}="${cid}",{pilier}="${socle}")`,
    fields:[F_CIR.code,F_CIR.nom,F_CIR.verb1,F_CIR.verb2,F_CIR.verb3,F_CIR.total,F_CIR.profondeur],
    pageSize:50,
  }).eachPage((recs,next)=>{
    for(const r of recs){
      const c=_sel(r.get(F_CIR.code)); // "C12"
      const full=`${socle}${c}`;
      circuitsByCode[full]={
        code:full, libelle:_sel(r.get(F_CIR.nom)),
        profondeur:_sel(r.get(F_CIR.profondeur)),
        total:_num(r.get(F_CIR.total)),
        verbatims:[r.get(F_CIR.verb1),r.get(F_CIR.verb2),r.get(F_CIR.verb3)].filter(Boolean),
      };
    }
    next();
  });

  // capacité : extraite du texte de la synth (lexique fermé) par circuit
  const circuits = codes.map(code=>{
    const c=circuitsByCode[code]||{code,libelle:'',profondeur:'',total:0,verbatims:[]};
    const capMatch = synth.match(new RegExp(code+'[^;]*?capacité\\s+([^,;]+(?:distinctes|intégrative|sophistiquée|simple)?)','i'));
    return { ...c, capacite: capMatch ? capMatch[1].trim() : '' };
  }).sort((a,b)=>b.total-a.total);

  return { nom_bloc, circuits, synth };
}

/**
 * SOURCE B — le socle activé EN INSTRUMENTAL.
 * Les réponses aux questions d'AUTRES outils que le socle gouverne.
 * Lit les réponses brutes INTÉGRALES.
 */
async function lireSocleInstrumental(cid, socle, at){
  const out=[]; const toutes=[];
  await at(T_RESP).select({
    filterByFormula:`{session_ID}="${cid}"`,
    fields:[F_RESP.question,F_RESP.gouverne,F_RESP.reponse],
    pageSize:50,
  }).eachPage((recs,next)=>{
    for(const r of recs){
      const q=_sel(r.get(F_RESP.question)); const gouv=_sel(r.get(F_RESP.gouverne));
      const rep=r.get(F_RESP.reponse)||'';
      if(gouv!==socle) continue;                 // ne garder que ce que le socle gouverne
      toutes.push({question:q, reponse_brute:rep});
      const outilQ=q.slice(0,2);                  // "P5" pour "P5Q1"
      if(outilQ!==socle){                         // INSTRUMENTAL = question d'un AUTRE outil
        out.push({question:q, outil_question:outilQ, gouverne:socle, reponse_brute:rep});
      }
    }
    next();
  });
  return { instrumental: out, reponses_socle_completes: toutes };
}

// ════════════════════════════════════════════════════════════════════════
// 2) AGENT
// ════════════════════════════════════════════════════════════════════════

function construireEntree(cid, socle, presentation, blocHaut, instr){
  return {
    candidat_id: cid,
    socle,
    presentation_outils: presentation,
    bloc_haut_socle: { nom_bloc: blocHaut.nom_bloc, circuits: blocHaut.circuits.map(c=>({
      code:c.code, libelle:c.libelle, capacite:c.capacite, profondeur:c.profondeur,
      total:c.total, verbatims:c.verbatims,
    })) },
    socle_instrumental: instr.instrumental,
    reponses_socle_completes: instr.reponses_socle_completes,
    profils_familles: PROFILS_FAMILLES,
  };
}

async function appelerAgent(entree){
  const prompt=fs.readFileSync(PROMPT_PATH,'utf-8');
  const client=new Anthropic({apiKey:process.env.CLAUDE_API_KEY||process.env.ANTHROPIC_API_KEY});
  const msg=await client.messages.create({
    model:'claude-sonnet-4-6', max_tokens:4000, system:prompt,
    messages:[{role:'user',content:JSON.stringify(entree,null,2)}],
  });
  const text=msg.content.filter(b=>b.type==='text').map(b=>b.text).join('\n');
  // séparer le bloc <analyse> du JSON
  const analyse=(text.match(/<analyse>([\s\S]*?)<\/analyse>/)||[])[1]||'';
  const jsonPart=text.replace(/<analyse>[\s\S]*?<\/analyse>/,'').replace(/```json|```/g,'').trim();
  let sortie;
  try{ sortie=JSON.parse(jsonPart); }
  catch(e){ throw new Error('Sortie agent non-JSON : '+jsonPart.slice(0,400)); }
  return { sortie, analyse:analyse.trim() };
}

// ════════════════════════════════════════════════════════════════════════
// 3) WRITER
// ════════════════════════════════════════════════════════════════════════

async function ecrire(sortie, bilanRecId, at){
  if(!sortie.filtre) throw new Error('Sortie agent : champ "filtre" manquant');
  const profilTxt = sortie.profil_calibrage
    ? `${sortie.profil_calibrage.famille} — ${sortie.profil_calibrage.variante||''}`.trim()
    : '(aucun profil ne colle)';
  const fields={
    [F_BILAN.filtre]:          sortie.filtre,
    [F_BILAN.filtre_preuves]:  sortie.filtre_preuves||'',
    [F_BILAN.finalite]:        sortie.finalite || '(non exprimée dans les réponses)',
    [F_BILAN.finalite_preuve]: sortie.finalite_preuve||'',
    [F_BILAN.profil_calibrage]: profilTxt,
    [F_BILAN.technique]:       sortie.technique||'',
  };
  await at(T_BILAN).update(bilanRecId, fields);
  return bilanRecId;
}

async function _findBilan(cid, at){
  return new Promise((res,rej)=>{
    at(T_BILAN).select({filterByFormula:`{candidat_id}="${cid}"`,maxRecords:1,fields:[F_BILAN.candidat]})
      .firstPage((e,r)=> e?rej(e):res(r&&r[0]?r[0]:null));
  });
}

// ════════════════════════════════════════════════════════════════════════
// 4) RUN — compatible DEUX modes d'appel :
//   • Orchestrateur : run({ candidat_id })  → écrit en base (prod), retourne un résumé.
//   • CLI           : node service… --candidat <id> [--write]  → dry-run sauf --write.
// ════════════════════════════════════════════════════════════════════════

async function run(opts = {}){
  // Résolution des arguments selon le mode d'appel
  let cid, doWrite;
  if (opts && opts.candidat_id) {
    // Appel par l'orchestrateur (comme PA/PC/PD) → on traite et on ÉCRIT.
    cid = opts.candidat_id;
    doWrite = opts.write_mode !== false;   // écriture par défaut en prod
  } else {
    // Appel en ligne de commande.
    const args = process.argv.slice(2);
    cid = _arg(args, '--candidat');
    doWrite = args.includes('--write');
    if (!cid) { console.error('ERREUR : --candidat <id> obligatoire (ou run({candidat_id}))'); process.exit(1); }
  }

  const at=new Airtable({apiKey:process.env.AIRTABLE_TOKEN||process.env.AIRTABLE_API_KEY}).base(BASE_ID);

  // 1) Architecture + socle
  const {piliers,socle}=await lireArchitecture(cid,at);
  if(!socle){ throw new Error('PB filtre : socle introuvable (T3_PILIER.role_pilier) pour '+cid); }
  console.log(`[PB filtre] Socle = ${socle} (${piliers[socle]?.label})`);

  // 2) Builder : présentation + source A + source B
  const presentation=buildPresentationOutils(piliers);
  const blocHaut=await lireBlocHautSocle(cid,socle,piliers[socle],at);
  console.log(`[PB filtre] Bloc le plus haut = « ${blocHaut.nom_bloc} » · ${blocHaut.circuits.length} circuits : ${blocHaut.circuits.map(c=>c.code+'('+c.total+')').join(', ')}`);
  const instr=await lireSocleInstrumental(cid,socle,at);
  console.log(`[PB filtre] Socle gouverne ${instr.reponses_socle_completes.length} réponses · dont ${instr.instrumental.length} en instrumental`);

  // 3) Agent
  const entree=construireEntree(cid,socle,presentation,blocHaut,instr);
  const {sortie,analyse}=await appelerAgent(entree);

  // 4) Écriture / dry-run
  if(doWrite){
    const bilan=await _findBilan(cid,at);
    if(!bilan){ throw new Error('PB filtre : record T3_BILAN introuvable pour '+cid); }
    await ecrire(sortie,bilan.id,at);
    console.log(`[PB filtre] ✅ Filtre + finalité écrits dans T3_BILAN ${bilan.id}`);
    console.log(`[PB filtre]    Filtre   : « ${sortie.filtre} »`);
    console.log(`[PB filtre]    Finalité : ${sortie.finalite ? '« '+sortie.finalite+' »' : '(non exprimée)'}`);
    return { ok:true, candidat_id:cid, bilanRecId:bilan.id, filtre:sortie.filtre, finalite:sortie.finalite||null };
  } else {
    console.log('\n── <analyse> de l\'agent ──\n'+analyse);
    console.log('\n── JSON agent ──\n'+JSON.stringify(sortie,null,2));
    console.log('\n── Builder (audit) ──');
    console.log(JSON.stringify({bloc_haut:blocHaut.circuits.map(c=>({code:c.code,total:c.total,cap:c.capacite,prof:c.profondeur})), instrumental:instr.instrumental.map(x=>x.question)},null,2));
    return { ok:true, candidat_id:cid, dryRun:true, filtre:sortie.filtre, finalite:sortie.finalite||null };
  }
}

if(require.main===module) run().catch(e=>{console.error(e);process.exit(1);});

module.exports={ lireArchitecture, buildPresentationOutils, lireBlocHautSocle,
  lireSocleInstrumental, construireEntree, appelerAgent, ecrire, run,
  PROFILS_FAMILLES, F_PIL, F_CIR, F_RESP, F_BILAN, BASE_ID };
