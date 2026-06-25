// services/etape1/etape1_t3/bilan_fable/service_etape1_T3_bilan_PA_pilier.js
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

  // ── (v12) EXTRACTION EN DEUX PARTIES : bloc <analyse> + JSON ──
  // L'agent répond désormais : <analyse>…sa verbalisation…</analyse> puis le JSON.
  // 1) On isole l'analyse (journal de décision, à stocker dans T3_PILIER pour la reprise).
  // 2) On extrait le JSON où qu'il commence : premier '{' de niveau racine → dernier '}'.
  //    Cela rend le parsing robuste à tout préambule/texte autour (fini les plantages
  //    « Unexpected token 'J' » quand l'agent met de la prose avant le JSON).
  let analyse = '';
  const mAnalyse = raw.match(/<analyse>([\s\S]*?)<\/analyse>/i);
  if (mAnalyse) analyse = mAnalyse[1].trim();

  // Retirer le bloc analyse du flux avant de chercher le JSON, puis nettoyer un éventuel
  // fence markdown résiduel.
  let reste = raw.replace(/<analyse>[\s\S]*?<\/analyse>/i, '').trim();
  reste = reste.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();

  // Extraction du corps JSON : du premier '{' au dernier '}'.
  const debutJson = reste.indexOf('{');
  const finJson   = reste.lastIndexOf('}');
  if (debutJson === -1 || finJson === -1 || finJson <= debutJson) {
    logger.error('Parse JSON PA — aucun objet JSON trouvé', { pilier: entree.pilier_code, brut: raw.slice(0, 500) });
    throw new Error(`Parse JSON PA: aucun objet JSON détecté (pilier ${entree.pilier_code})`);
  }
  const cleaned = reste.slice(debutJson, finJson + 1);

  try {
    const pa = JSON.parse(cleaned);
    if (!analyse) {
      logger.warn(`PA ${entree.pilier_code} — bloc <analyse> absent (l'agent n'a pas verbalisé). JSON parsé quand même.`);
    }
    return { pa, analyse };
  } catch (err) {
    logger.error('Parse JSON PA raté', { pilier: entree.pilier_code, debut: cleaned.slice(0, 300), err: err.message });
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
  // Pluriel (bloc à plusieurs circuits)
  'sont ce que le protocole nomme',
  'correspondent à ce que le protocole nomme',
  'relèvent de ce que le protocole nomme',
  // Singulier (bloc à UN seul circuit — ex. pilier pauvre : « cette manière de faire EST ce que… »)
  'est ce que le protocole nomme',
  'correspond à ce que le protocole nomme',
  'relève de ce que le protocole nomme',
];
function aUneFormuleRattachement(txt) {
  return FORMULES_RATTACHEMENT.some(f => txt.includes(f));
}

// ── (v11) Lecture des chiffres cités par l'agent dans un synth_technique ──
// L'agent écrit, pour chaque circuit du bloc, une mention de la forme :
//   "P4C8 Nom du circuit (cœur 3, total 4 : svc P5 ×1) — capacité …"
// On extrait, par code de circuit, le cœur et le total tels que l'agent les a ÉCRITS,
// pour les comparer ensuite aux chiffres réels de l'entrée (contrôle d'intangibilité).
// Tolérant sur la ponctuation ("cœur"/"coeur", "total : 4"/"total 4"), strict sur le chiffre.
function lireChiffresCites(synthTechnique) {
  const out = {}; // { "P4C8": { coeur: 3, total: 4, ordreApparition: 0 }, ... }
  if (!synthTechnique) return out;
  // On repère chaque "PxCy" puis on cherche cœur/total dans la portion de texte qui suit,
  // jusqu'au prochain code de circuit (ou la fin).
  const codeRe = /\b(P[1-5]C\d{1,2}|P[1-5]·ADHOC|P[1-5]C?ADHOC)\b/gi;
  const matches = [];
  let m;
  while ((m = codeRe.exec(synthTechnique)) !== null) {
    matches.push({ code: m[1].toUpperCase(), index: m.index });
  }
  for (let i = 0; i < matches.length; i++) {
    const code = matches[i].code;
    const debut = matches[i].index;
    const fin = (i + 1 < matches.length) ? matches[i + 1].index : synthTechnique.length;
    const segment = synthTechnique.slice(debut, fin);
    // cœur : "cœur 3" ou "coeur 3" ou "cœur : 3"
    const mc = segment.match(/c(?:œ|oe)ur\s*:?\s*(\d+)/i);
    // total : "total 4" ou "total : 4"
    const mt = segment.match(/total\s*:?\s*(\d+)/i);
    if (!out[code]) {
      out[code] = {
        coeur: mc ? Number(mc[1]) : null,
        total: mt ? Number(mt[1]) : null,
        ordre: i,
      };
    }
  }
  return out;
}

function valider(pa, entree, analyse = '') {
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

    // T1 : "Vous + verbe" ou amorces autorisées (assoupli 23/06 : "Dès " couvre Dès que/Dès la/Dès le/Dès lors ; + Face à/Au moment)
    if (!expl.match(/^(Vous\s|Dès |Pendant que vous |Lorsque |Lorsqu'|Une fois |Chaque fois |Dans |Avant |Ponctuellement|À l'occasion|Il vous arrive|Ce geste ne s'active|Ce geste est propre|Quand |En |Depuis |Face à |Au moment )/i)) {
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

    // soleil_micro : OBLIGATOIRE pour CHAQUE circuit (quel que soit le niveau, y compris
    // FAIBLE et EN_SOUTIEN). C'est le geste du circuit en format court, fondé sur le verbatim
    // de l'explication du geste — jamais une paraphrase du libellé. Réutilisé en phase aval,
    // donc ne peut JAMAIS être vide. ≤15 mots.
    if (!micro || !micro.trim()) {
      errors.push(`[${code}] soleil_micro vide — obligatoire pour chaque circuit, quel que soit le niveau`);
    } else if ((micro.match(/\S+/g) || []).length > 15) {
      errors.push(`[${code}] soleil_micro > 15 mots`);
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

    // Longueurs n3_nuance (souples = warnings). Seuils max relevés le 23/06 (décision A : n3_nuance plus riches, doctrine facettes).
    const seuils = { HAUT:{min:250,max:1100}, MOYEN:{min:160,max:700}, FAIBLE:{min:100,max:400}, EN_SOUTIEN:{min:70,max:300} };
    const s = seuils[niveau] || seuils.FAIBLE;
    if (expl.length < s.min) warnings.push(`[${code}] n3_nuance courte pour ${niveau} (${expl.length}c)`);
    if (expl.length > s.max) warnings.push(`[${code}] n3_nuance longue pour ${niveau} (${expl.length}c)`);
  }

  // Blocs (vocabulaire ACTIVATION : très souvent / souvent / occasionnels)
  const PREFIXE_BLOC = {
    'très souvent': 'Bloc très souvent', 'tres souvent': 'Bloc très souvent',
    'souvent':      'Bloc souvent',
    'occasionnels': 'Bloc occasionnels', 'occasionnel': 'Bloc occasionnels',
  };
  for (const bloc of (pa.blocs || [])) {
    const nb = (bloc.niveau || '').trim().toLowerCase();
    const tech = bloc.synth_technique || '';
    const cand = bloc.synth_candidat || '';
    const rattach = bloc.synth_rattachement || '';
    const prefixe = PREFIXE_BLOC[nb];
    if (!prefixe) { errors.push(`[Bloc] niveau inconnu "${bloc.niveau}" (attendu très souvent/souvent/occasionnels)`); continue; }
    if (!tech.trim().startsWith(prefixe)) errors.push(`[Bloc ${nb}] synth_technique doit commencer par "${prefixe}"`);
    // « occasionnels » (ex-FAIBLE) : pas de code circuit dans le texte candidat, pas de formule de rattachement.
    if (nb.startsWith('occasionnel') && /P[1-5]C\d{1,2}/i.test(cand)) errors.push(`[Bloc occasionnels] synth_candidat contient un code circuit`);
    // « très souvent » / « souvent » (ex-HAUT/MOYEN) : portent la formule de rattachement au protocole.
    if (nb.includes('souvent') && rattach && !aUneFormuleRattachement(rattach)) {
      errors.push(`[Bloc ${nb}] rattachement doit contenir une formule autorisée (ex. "sont ce que le protocole nomme")`);
    }
    if (nb.startsWith('occasionnel') && aUneFormuleRattachement(rattach)) {
      errors.push(`[Bloc occasionnels] rattachement ne doit PAS contenir de formule de rattachement au protocole`);
    }

    // ── (v11) CONTRÔLE 29 — INTANGIBILITÉ DES CHIFFRES CITÉS ──
    // Les cœur/total écrits dans synth_technique doivent correspondre EXACTEMENT aux
    // chiffres de l'entrée. Empêche l'agent de réécrire un total pour homogénéiser un
    // groupe (erreur attestée : P4C8 total 4 cité « total 3 »).
    const chiffresCites = lireChiffresCites(tech);
    for (const code of Object.keys(chiffresCites)) {
      const ic = (entree.circuits || []).find(x => (x.code || '').toUpperCase() === code);
      if (!ic) continue; // code non reconnu dans l'entrée : pas de comparaison possible
      const cite = chiffresCites[code];
      if (cite.total !== null && Number(ic.total) !== cite.total) {
        errors.push(`[Bloc ${nb}] ${code} : total cité ${cite.total} ≠ total réel ${ic.total} (chiffre intangible, ne pas réécrire)`);
      }
      if (cite.coeur !== null && Number(ic.coeur) !== cite.coeur) {
        errors.push(`[Bloc ${nb}] ${code} : cœur cité ${cite.coeur} ≠ cœur réel ${ic.coeur} (chiffre intangible, ne pas réécrire)`);
      }
    }

    // ── (v12.2) VERROU 3 — TOTAL ≥3 INTERDIT EN OCCASIONNELS ──
    // Le bloc « occasionnels » est réservé aux total 1-2 (posé par le service). Un circuit
    // de total ≥3 ne doit JAMAIS s'y trouver : il doit être réparti par l'agent en « très
    // souvent » ou « souvent ». Le contrôle de tri interne (30) n'attrape cette faute que
    // si l'ordre est faux ; ce verrou l'attrape TOUJOURS, en lisant le total réel de l'entrée.
    // (Cf. CONTRAT_FRONTIERE_BLOCS §6, VERROU 3. Faute attestée : P4C8 total 4 en occasionnels.)
    if (nb.startsWith('occasionnel')) {
      for (const code of Object.keys(chiffresCites)) {
        const ic = (entree.circuits || []).find(x => (x.code || '').toUpperCase() === code);
        if (!ic) continue;
        if (Number(ic.total) >= 3) {
          errors.push(`[Bloc occasionnels] ${code} (total ${ic.total}) a un total ≥3 — il ne peut PAS être en occasionnels ; il doit être réparti en « très souvent » ou « souvent ».`);
        }
      }
    }

    // ── (v11) CONTRÔLE 30 — TRI INTERNE PAR TOTAL DÉCROISSANT ──
    // Dans chaque bloc, les circuits doivent être cités du plus grand total au plus petit.
    // On lit l'ordre d'apparition des circuits dans synth_technique et on vérifie que les
    // totaux RÉELS (de l'entrée) ne remontent jamais.
    const ordreCodes = Object.keys(chiffresCites).sort((a, b) => chiffresCites[a].ordre - chiffresCites[b].ordre);
    let totalPrecedent = Infinity;
    for (const code of ordreCodes) {
      const ic = (entree.circuits || []).find(x => (x.code || '').toUpperCase() === code);
      if (!ic) continue;
      const t = Number(ic.total);
      if (t > totalPrecedent) {
        errors.push(`[Bloc ${nb}] tri interne : ${code} (total ${t}) cité après un circuit de total ${totalPrecedent} — ranger par total décroissant`);
        break; // une seule alerte de tri par bloc suffit
      }
      totalPrecedent = t;
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

  // ── (v12) CONTRÔLE DE COHÉRENCE analyse ↔ blocs (warning, non bloquant) ──
  // L'agent verbalise son rangement dans <analyse>. On vérifie que ce qu'il y a DÉCIDÉ
  // correspond grossièrement à ce qu'il PRODUIT dans les blocs JSON. L'analyse étant du
  // texte libre, on reste tolérant : on ne lève qu'un WARNING (signal pour audit), jamais
  // un rejet — un bilan correct ne doit pas être bloqué sur une formulation d'analyse.
  if (analyse && analyse.trim()) {
    // (v12.2) On ne lit QUE la décision finale de l'agent, pas tout son raisonnement.
    // Le conducteur fait écrire à l'agent une section « Rangement retenu : très souvent = … ;
    // souvent = … ; occasionnels = … ». On compare cette DÉCISION au JSON, pas les hésitations
    // intermédiaires (« on pourrait mettre X… finalement non »), qui faisaient des faux
    // positifs (cas P5C2/P5C1/P5C15, run 25/06 : annoncés dans le raisonnement, rangés
    // correctement en « souvent » dans le JSON). Repli : si la section « Rangement retenu »
    // est absente, on ne lève RIEN (mieux vaut rater une incohérence rare que crier au loup).
    const blocTS = (pa.blocs || []).find(b => /tr[èe]s souvent/i.test(b.niveau || ''));
    const mRangement = analyse.match(/rangement\s+retenu\s*:?([\s\S]*)$/i);
    if (blocTS && mRangement) {
      const codesJsonTS = new Set(
        (lireChiffresCites(blocTS.synth_technique || '')) ? Object.keys(lireChiffresCites(blocTS.synth_technique || '')) : []
      );
      // Dans la section "Rangement retenu", isoler la seule ligne "très souvent = …"
      // (jusqu'au prochain mot-clé de bloc), et n'y relever que les codes décidés.
      const mZone = mRangement[1].match(/tr[èe]s souvent[^]*?(?=souvent\b|occasionnel|$)/i);
      if (mZone) {
        const codesAnalyseTS = (mZone[0].match(/P[1-5]C\d{1,2}/gi) || []).map(c => c.toUpperCase());
        for (const code of codesAnalyseTS) {
          if (codesJsonTS.size && !codesJsonTS.has(code)) {
            warnings.push(`[cohérence] ${code} décidé "très souvent" dans le Rangement retenu mais absent du bloc très souvent du JSON`);
          }
        }
      }
    }
    // (pas de section "Rangement retenu" → pas de contrôle : repli silencieux assumé)
  } else {
    warnings.push('[cohérence] bloc <analyse> vide ou absent — verbalisation non fournie (vérifier le prompt/agent)');
  }

  return { ok: errors.length === 0, errors, warnings };
}

// ═══════════════════════════════════════════════════════════════
// SECTION 5 — ÉCRITURE T3 (via pilierMap fourni par la préparation)
// ═══════════════════════════════════════════════════════════════

async function ecrireT3(pa, pilier, pilierRecId, circuitRecByCode, opts, analyse = '') {
  // ── T3_PILIER ──
  // Niveau de bloc = ACTIVATION (fréquence) : « très souvent / souvent / occasionnels »
  // (rangement sur le total). Mappé vers les 3 groupes de colonnes T3_PILIER
  // (clés renommées v12.1 ; fldID inchangés ; ex-HAUT/MOYEN/FAIBLE).
  const SLOT_BLOC = {
    'très souvent': 'tres_souvent', 'tres souvent': 'tres_souvent',
    'souvent':      'souvent',
    'occasionnels': 'occasionnels', 'occasionnel': 'occasionnels',
  };
  const fp = {};
  for (const bloc of (pa.blocs || [])) {
    const slot = SLOT_BLOC[(bloc.niveau || '').trim().toLowerCase()];
    const rattach = bloc.synth_rattachement || '';
    if (slot === 'tres_souvent') {
      fp[F_PIL.bloc_tres_souvent_candidat]     = bloc.synth_candidat  || '';
      fp[F_PIL.bloc_tres_souvent_technique]    = bloc.synth_technique || '';
      fp[F_PIL.bloc_tres_souvent_rattachement] = rattach;
    } else if (slot === 'souvent') {
      fp[F_PIL.bloc_souvent_candidat]     = bloc.synth_candidat  || '';
      fp[F_PIL.bloc_souvent_technique]    = bloc.synth_technique || '';
      fp[F_PIL.bloc_souvent_rattachement] = rattach;
    } else if (slot === 'occasionnels') {
      fp[F_PIL.bloc_occasionnels_candidat]     = bloc.synth_candidat  || '';
      fp[F_PIL.bloc_occasionnels_technique]    = bloc.synth_technique || '';
      fp[F_PIL.bloc_occasionnels_rattachement] = rattach;
    } else {
      logger.warn(`Rédaction PA : bloc niveau inconnu "${bloc.niveau}" — ignoré (attendu très souvent/souvent/occasionnels)`);
    }
  }
  const sp = pa.synthese_pilier || {};
  fp[F_PIL.synth_interpretee] = sp.vue_ensemble || '';
  fp[F_PIL.mode_explication]  = sp.mode_explication_candidat || '';
  fp[F_PIL.intro_eclate]      = sp.intro_eclate || '';
  if (sp.profil_pur)    fp[F_PIL.synth_factuelle] = sp.profil_pur;
  // mode : écrit seulement si autorisé (validation manuelle)
  if (opts.write_mode && sp.mode_libelle) fp[F_PIL.pilier_mode] = sp.mode_libelle;

  // ── (v12) ANALYSE VERBALISÉE de l'agent → champ d'audit T3_PILIER ──
  // Journal de décision produit au temps 3 du conducteur (lecture + cassure + rangement).
  // Stocké pour servir de mémoire si le pilier est repris, et de trace de contrôle qualité.
  // Field ID lu depuis la config (clé analyse_verbalisee) ; repli sur l'ID direct si la
  // clé n'est pas encore définie dans airtableConfig.
  const FIELD_ANALYSE = (F_PIL && F_PIL.analyse_verbalisee) || 'fldGLJRqWUxUoDR5e';
  if (analyse && analyse.trim()) fp[FIELD_ANALYSE] = analyse.trim();

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
  let pa, analyse = '', validation;
  for (let t = 1; t <= MAX_RETRY; t++) {
    ({ pa, analyse } = await appellerClaude(entree, opts));
    validation = valider(pa, entree, analyse);
    if (validation.ok) break;
    logger.warn(`Rédaction PA ${pilier.pilier_code} — ${validation.errors.length} erreur(s), tentative ${t}/${MAX_RETRY}`,
      { errors: validation.errors });
    if (t === MAX_RETRY && opts.strict) throw new Error(`Validation PA échouée (${pilier.pilier_code})`);
  }
  for (const w of (validation.warnings || [])) logger.info(`PA ${pilier.pilier_code} ⚠️ ${w}`);

  const pilierRecId = prep.pilierMap.get(pilier.pilier_code);
  const circuitRecByCode = await indexerCircuitsCrees(prep.candidat_id, pilier.pilier_code);
  await ecrireT3(pa, pilier, pilierRecId, circuitRecByCode, opts, analyse);

  return {
    pilier_code:  pilier.pilier_code,
    pilier_role:  pilier.role_pilier,        // socle/amont/aval/fonctionnel — pour report mode socle dans T3_BILAN
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

  // ⭐ 23/06 — Permanence du mode : reporter le mode du pilier SOCLE dans T3_BILAN
  // (champ pilier_socle_mode), pour qu'il soit identique partout (têtière du bilan incluse).
  try {
    const socle = resultats.find(r => r.pilier_role === 'socle' && r.mode_libelle);
    if (socle && opts.write_mode !== false) {
      const F_BILAN = airtableConfig.ETAPE1_T3_BILAN_FIELDS;
      const bilan = await airtableService.getEtape1T3Bilan(prep.candidat_id);
      if (bilan && bilan.airtable_id) {
        await airtableService.upsertEtape1T3Bilan(prep.candidat_id, {
          [F_BILAN.pilier_socle_mode]: socle.mode_libelle
        });
        logger.info('Mode socle reporté dans T3_BILAN', { candidat_id: prep.candidat_id, mode: socle.mode_libelle });
      }
    }
  } catch (e) {
    logger.warn('Report mode socle T3_BILAN échoué (non bloquant)', { error: e.message });
  }

  return resultats;
}

module.exports = { redigerBilan, construireEntree, valider };
