#!/usr/bin/env node
// scripts/verifier_payload_grille.js
// Vérifie le payload de la grille référent AVANT tout appel d'agent.
//
// USAGE :
//   node scripts/verifier_payload_grille.js pivar_1762094675215_77bg53iz0
//   node scripts/verifier_payload_grille.js pivar_1762094675215_77bg53iz0 --json
//
// Ce script n'écrit RIEN en base. Il lit, il assemble, il contrôle, il affiche.
// C'est le dernier endroit où une erreur de lecture se rattrape sans conséquence.
//
'use strict';

const payloadService = require('../services/grille-referent/service_grille_payload');

const candidat_id = process.argv[2];
const enJson      = process.argv.includes('--json');

if (!candidat_id) {
  console.error('\n  Usage : node scripts/verifier_payload_grille.js <candidat_id> [--json]\n');
  process.exit(1);
}

const V = '\x1b[32m✓\x1b[0m';
const X = '\x1b[31m✗\x1b[0m';
const A = '\x1b[33m!\x1b[0m';
const t = (s) => `\x1b[1m${s}\x1b[0m`;
const d = (s) => `\x1b[2m${s}\x1b[0m`;

function ligne(ok, libelle, detail) {
  console.log(`  ${ok ? V : X} ${libelle}${detail ? d('  — ' + detail) : ''}`);
  return ok;
}

(async () => {
  console.log(`\n${t('PAYLOAD GRILLE RÉFÉRENT')}  ${d(candidat_id)}\n`);

  let p;
  try {
    p = await payloadService.construire(candidat_id);
  } catch (e) {
    console.log(`  ${X} ${t('construction refusée')}\n`);
    console.log(`     ${e.message}\n`);
    if (e.manques && e.manques.length) {
      console.log(`     ${t('Ce qui manque :')}`);
      e.manques.forEach(m => console.log(`       · ${m}`));
    }
    if (e.anomalies && e.anomalies.length) {
      console.log(`\n     ${t('Anomalies relevées :')}`);
      e.anomalies.forEach(m => console.log(`       · ${m}`));
    }
    console.log('\n  Le payload refuse de se construire sur une matière incomplète.');
    console.log('  C\'est le comportement attendu : rien n\'est comblé, tout est signalé.\n');
    process.exit(2);
  }

  if (enJson) { console.log(JSON.stringify(p, null, 2)); process.exit(0); }

  let tout = true;

  // ── 1 · Les cinq piliers ──
  console.log(t('  1 · Les cinq outils'));
  const attendus = ['P4', 'P3', 'P5', 'P1', 'P2'];
  for (const code of attendus) {
    const pil = (p.piliers || []).find(x => x.pilier === code);
    tout &= ligne(!!(pil && pil.libelle && pil.mode),
      `${code} ${pil ? pil.libelle : '—'}`,
      pil ? `${pil.role} · ${pil.mode}` : 'absent');
  }

  // ── 2 · Les gestes et leur bloc retenu (R9) ──
  console.log(`\n${t('  2 · Les gestes retenus')} ${d('(cascade R9)')}`);
  for (const pil of (p.piliers || [])) {
    const n = (pil.gestes || []).length;
    tout &= ligne(n > 0,
      `${pil.pilier} — ${n} geste${n > 1 ? 's' : ''}`,
      pil.bloc_retenu ? `bloc « ${pil.bloc_retenu} »` : 'aucun bloc');
    for (const g of (pil.gestes || [])) {
      const extrait = String(g.narration || '').slice(0, 70).replace(/\s+/g, ' ');
      console.log(d(`       ${g.code || '?'} · ${extrait}…`));
    }
  }

  // ── 3 · La clé de tuile et la tuile ──
  console.log(`\n${t('  3 · Le profil')}`);
  tout &= ligne(!!p.profil.cle_tuile, `clé de tuile : ${p.profil.cle_tuile || '—'}`,
    `${p.profil.socle} × ${p.profil.type_cognitif}`);
  tout &= ligne(!!(p.profil.tuile && p.profil.tuile.titre),
    `tuile trouvée : ${(p.profil.tuile && p.profil.tuile.titre) || '—'}`,
    p.profil.tuile ? `${p.profil.tuile.zone} · ${(p.profil.tuile.atouts || []).length} atouts · ${(p.profil.tuile.couts || []).length} coûts` : 'introuvable au référentiel');
  tout &= ligne(!!p.socle.filtre, 'réglage du socle présent',
    String(p.socle.filtre || '').slice(0, 60) + '…');

  // ── 4 · Les référentiels ──
  console.log(`\n${t('  4 · Les référentiels')}`);
  const eq = (p.referentiels.equivalences || []).length;
  const de = (p.referentiels.desalignement || []).length;
  tout &= ligne(eq >= 25, `équivalences test → pro : ${eq}`, eq >= 25 ? '' : 'attendu : 25');
  tout &= ligne(de > 0, `désalignement : ${de} entrées`);
  const canoniques = new Set((p.referentiels.equivalences || []).map(x => x.libelle_pro_court).filter(Boolean));
  tout &= ligne(canoniques.size === 4, `libellés canoniques : ${canoniques.size}`, [...canoniques].join(' · '));

  // ── 5 · Les dimensions ──
  console.log(`\n${t('  5 · Les dimensions')}`);
  const dims = (p.dimensions || []).filter(x => x.synthese);
  ligne(dims.length > 0, `${dims.length} dimension${dims.length > 1 ? 's' : ''} avec matière`,
    dims.map(x => x.excellence).join(' · '));
  ligne(!!p.synthese_dimensions.portrait_un_mot, 'portrait en un mot présent');

  // ── 6 · Les anomalies ──
  console.log(`\n${t('  6 · Anomalies')}`);
  if (!(p.anomalies || []).length) {
    ligne(true, 'aucune');
  } else {
    for (const a of p.anomalies) console.log(`  ${A} ${a}`);
    console.log(d('     (non bloquantes — le payload s\'est construit)'));
  }

  console.log(`\n  ${tout ? V + ' ' + t('PAYLOAD CONFORME') : X + ' ' + t('PAYLOAD À CORRIGER')}`);
  console.log(d(`  Pour voir le détail : node scripts/verifier_payload_grille.js ${candidat_id} --json\n`));
  process.exit(tout ? 0 : 3);
})();
