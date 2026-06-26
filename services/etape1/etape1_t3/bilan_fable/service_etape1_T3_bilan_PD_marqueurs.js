/**
 * ════════════════════════════════════════════════════════════════════════
 * SERVICE P-D — CHAPITRE III « MARQUEURS LIMBIQUES & ZONES DE COÛT »
 * Profil-Cognitif Sib Prod · 26/06/2026
 *
 * Conforme à l'AMENDEMENT 14 de la Bible (le marqueur limbique = donnée du COMMENT).
 *
 * PRINCIPE : les marqueurs limbiques sont DÉJÀ détectés en étape 1.1 (ETAPE1_T1,
 *   champ signal_limbique, 1 par réponse concernée, au format « <émotion> · "<verbatim>" »).
 *   Le builder les LIT (via getEtape1T1), ajoute rôles/modes/libellés (getEtape1T3Piliers)
 *   et les comptages cœur par pilier (getEtape1T3Circuits) pour situer les coûts.
 *   AUCUNE détection ici, AUCUN chiffre calculé : tout vient de la base.
 *
 * 4 étapes :
 *   1) BUILDER déterministe — lit marqueurs + rôles/modes/libellés + comptages. AUCUN LLM.
 *   2) AGENT — conducteur T1→T6 : lit, rattache au geste, regroupe, situe les coûts,
 *      contrôle le sens. Trace dans <analyse>.
 *   3) WRITER — écrit §05 + §06 + verbalisation dans T3_BILAN via upsertEtape1T3Bilan.
 *   4) RUN — orchestration + dry-run.
 *
 * INFRA RÉELLE UTILISÉE (vérifiée sur airtableService.js v12.1-fable) :
 *   getEtape1T1, getEtape1T3Piliers, getEtape1T3Circuits, upsertEtape1T3Bilan.
 *   Toutes retournent des CLÉS LISIBLES (pas des field IDs).
 *
 * USAGE :
 *   node service_etape1_T3_bilan_PD_marqueurs.js --candidat <id>          → DRY-RUN
 *   node service_etape1_T3_bilan_PD_marqueurs.js --candidat <id> --write  → écrit le chapitre III
 *   run({candidat_id, write}) depuis l'orchestrateur.
 * ════════════════════════════════════════════════════════════════════════
 */

const Anthropic = require('@anthropic-ai/sdk');
const fs   = require('fs');
const path = require('path');

const airtableService = require('../../../infrastructure/airtableService');
let logger; try { logger = require('../../../../utils/logger'); } catch(e){ logger = console; }

// Field IDs T3_BILAN (sortie) — upsertEtape1T3Bilan écrit par field ID
const F_BILAN = {
  s05_intro:             'fldxCNvqR4qyYAYjr',
  registres:             'fldgeeC3lg3M89ESA',
  s05_cloture:           'fld9x0yRmGnAhVFS4',
  s06_intro:             'fldxZi0jRCWnXsVng',
  cout_principal:        'fld0nyRitbejCsihG',
  cout_secondaire:       'fld7JUPi80iqSKzzV',
  s06_cloture:           'fld1nB5UqVklCjikE',
  pd_analyse_verbalisee: 'fld0IrJZ4Pe9dDHhG',   // 26/06 — trace <analyse> de l'agent PD (audit)
};

// Chemin du prompt : services/etape1/etape1_t3/bilan_fable/ -> new-prompts/etape1/bilan/
const PROMPT_PATH = path.join(__dirname, '../../../../new-prompts/etape1/bilan/prompt_etape1_T3_bilan_PD_marqueurs.md');

// helpers
const _val = v => (v && typeof v === 'object' && 'name' in v) ? v.name : (v == null ? '' : v);
const num  = v => { const n = Number(_val(v)); return Number.isFinite(n) ? n : 0; };

// Parse « <émotion> · "<verbatim>" » -> { emotion, verbatim }
function parseSignal(raw){
  const s = String(_val(raw)).trim();
  if(!s) return null;
  const sep = s.indexOf('\u00b7'); // ·
  if(sep === -1) return { emotion: s, verbatim: '' };
  const emotion  = s.slice(0, sep).trim();
  let verbatim = s.slice(sep+1).trim().replace(/^["\u00ab\u00bb\s]+|["\u00ab\u00bb\s]+$/g,'').trim();
  return { emotion, verbatim };
}

// ════════════════════════════════════════════════════════════════════════
// 1) BUILDER
// ════════════════════════════════════════════════════════════════════════
async function builder(cid){
  // a) marqueurs limbiques détectés en 1.1
  const t1 = await airtableService.getEtape1T1(cid);
  const marqueurs = [];
  for(const row of t1){
    const sig = parseSignal(row.signal_limbique);
    if(!sig || !sig.emotion) continue;
    marqueurs.push({
      qid:      _val(row.id_question),
      scenario: _val(row.scenario),
      emotion:  sig.emotion,
      verbatim: sig.verbatim,
      pilier:   _val(row.pilier_coeur),
    });
  }

  // b) rôles / modes / libellés
  const pil = await airtableService.getEtape1T3Piliers(cid);
  const roles = {}, modes = {}, libelles = {};
  for(const p of pil){
    const code = _val(p.pilier);
    if(!code) continue;
    roles[code]    = String(_val(p.role_pilier)).toLowerCase();
    modes[code]    = _val(p.pilier_mode) || '';
    libelles[code] = _val(p.pilier_label) || code;
  }

  // c) comptages cœur par pilier
  const cir = await airtableService.getEtape1T3Circuits(cid);
  const piliers_chiffres = { P1:{coeur:0}, P2:{coeur:0}, P3:{coeur:0}, P4:{coeur:0}, P5:{coeur:0} };
  for(const c of cir){
    const p = _val(c.pilier);
    if(piliers_chiffres[p]) piliers_chiffres[p].coeur += num(c.total_activations);
  }

  return { marqueurs, roles, modes, libelles, piliers_chiffres };
}

// ════════════════════════════════════════════════════════════════════════
// 2) AGENT
// ════════════════════════════════════════════════════════════════════════
function chargerPrompt(){
  try { return fs.readFileSync(PROMPT_PATH, 'utf8'); }
  catch(e){ throw new Error('Prompt P-D introuvable : ' + PROMPT_PATH); }
}

async function appelerAgent(entree){
  const prompt = chargerPrompt();
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const resp = await client.messages.create({
    model:'claude-sonnet-4-6', max_tokens:16000, system:prompt,
    messages:[{ role:'user', content: JSON.stringify(entree, null, 2) }],
  });
  let txt = (resp.content||[]).map(b=>b.text||'').join('');

  let analyse = '';
  const mA = txt.match(/<analyse>([\s\S]*?)<\/analyse>/i);
  if(mA) analyse = mA[1].trim();

  let jsonPart = txt;
  const close = txt.toLowerCase().indexOf('</analyse>');
  if(close !== -1) jsonPart = txt.slice(close + '</analyse>'.length);
  const i = jsonPart.indexOf('{'), j = jsonPart.lastIndexOf('}');
  if(i === -1 || j === -1 || j < i){
    throw new Error('Sortie agent : aucun JSON apres l\'analyse. Debut recu : ' + txt.slice(0,400));
  }
  let sortie;
  try { sortie = JSON.parse(jsonPart.slice(i, j+1)); }
  catch(e){ throw new Error('JSON agent invalide : ' + e.message + ' - extrait : ' + jsonPart.slice(i, i+300)); }
  return { sortie, analyse };
}

// ════════════════════════════════════════════════════════════════════════
// 3) WRITER
// ════════════════════════════════════════════════════════════════════════
function blocRegistres(registres){
  if(!Array.isArray(registres) || !registres.length) return '(aucun registre atteste)';
  return registres.map(r => '### ' + r.titre + '\n' + r.texte + '\n' + (r.verbatims||'')).join('\n\n');
}
function blocCout(c){
  if(!c) return '';
  return ((c.titre||'') + '\n' + (c.texte||'') + '\n' + (c.verbatims||'')).trim();
}

async function ecrire(cid, sortie, analyse){
  const fields = {
    [F_BILAN.s05_intro]:       sortie.s05_intro || '',
    [F_BILAN.registres]:       blocRegistres(sortie.registres),
    [F_BILAN.s05_cloture]:     sortie.s05_cloture || '',
    [F_BILAN.s06_intro]:       sortie.s06_intro || '',
    [F_BILAN.cout_principal]:  blocCout(sortie.cout_principal),
    [F_BILAN.cout_secondaire]: sortie.cout_secondaire ? blocCout(sortie.cout_secondaire) : '',
    [F_BILAN.s06_cloture]:     sortie.s06_cloture || '',
    [F_BILAN.pd_analyse_verbalisee]: analyse || '(verbalisation absente)',
  };
  const recId = await airtableService.upsertEtape1T3Bilan(cid, fields);
  return recId;
}

// ════════════════════════════════════════════════════════════════════════
// 4) RUN
// ════════════════════════════════════════════════════════════════════════
async function run(opts){
  opts = opts || {};
  const argv = process.argv.slice(2);
  const cid = opts.candidat_id
           || (argv.includes('--candidat') ? argv[argv.indexOf('--candidat')+1] : null);
  const doWrite = opts.write === true || argv.includes('--write');
  if(!cid) throw new Error('run : candidat_id requis (opts.candidat_id ou --candidat <id>)');

  console.log('[PD marqueurs] Candidat ' + cid);
  const b = await builder(cid);
  console.log('[PD marqueurs] Marqueurs limbiques detectes (1.1) : ' + b.marqueurs.length);

  const entree = {
    candidat_prenom: '',
    piliers_libelles: b.libelles,
    roles: b.roles, modes_valides: b.modes,
    marqueurs: b.marqueurs,
    piliers_chiffres: b.piliers_chiffres,
  };

  const r = await appelerAgent(entree);
  const sortie = r.sortie, analyse = r.analyse;

  if(doWrite){
    const recId = await ecrire(cid, sortie, analyse);
    console.log('[PD marqueurs] OK Chapitre III ecrit dans T3_BILAN ' + recId);
    console.log('[PD marqueurs]    Registres : ' + (sortie.registres||[]).length + ' - Cout sec. : ' + (sortie.cout_secondaire ? 'oui' : 'non'));
    if(sortie.alerte) console.log('[PD marqueurs]    Alerte : ' + sortie.alerte);
    return { ok:true, candidat_id:cid, bilanRecId:recId, nb_registres:(sortie.registres||[]).length };
  } else {
    console.log('\n-- <analyse> de l\'agent --\n'+analyse);
    console.log('\n-- JSON agent --\n'+JSON.stringify(sortie,null,2));
    console.log('\n-- Builder (audit) --');
    console.log(JSON.stringify({ nb_marqueurs:b.marqueurs.length, marqueurs:b.marqueurs.map(m=>m.qid+' '+m.emotion), piliers_chiffres:b.piliers_chiffres }, null, 2));
    return { ok:true, candidat_id:cid, dryRun:true, nb_registres:(sortie.registres||[]).length };
  }
}

module.exports = { run, builder };

if(require.main===module) run().catch(e=>{console.error(e);process.exit(1);});
