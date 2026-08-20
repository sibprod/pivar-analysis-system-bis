#!/usr/bin/env node
// scripts/rejouer_controles.js
// Rejoue les contrôles sur une sortie d'agent déjà produite.
//
// USAGE : node scripts/rejouer_controles.js pivar_1762094675215_77bg53iz0
//
// Pourquoi : l'appel d'agent coûte ~16 minutes et ~0,90 $. Ce script relit la
// sauvegarde de travail (/tmp/grille_<id>.json) et rejoue les contrôles autant
// de fois qu'il le faut — sans rappeler l'agent.
//
'use strict';

const fs        = require('fs');
const controles = require('../services/grille-referent/controles_grille');

const id = process.argv[2];
if (!id) { console.error('\n  Usage : node scripts/rejouer_controles.js <candidat_id>\n'); process.exit(1); }

const fichier = `/tmp/grille_${id}.json`;
if (!fs.existsSync(fichier)) {
  console.error(`\n  Aucune sauvegarde : ${fichier}`);
  console.error('  Lance d\'abord une production complète.\n');
  process.exit(1);
}

const { grille, tuile } = JSON.parse(fs.readFileSync(fichier, 'utf8'));
const verdict = controles.controler(grille, { profil: { tuile }, piliers: [] });

console.log(`\n\x1b[1mCONTRÔLES\x1b[0m  ${id}\n`);
if (verdict.conforme) {
  console.log('  \x1b[32m✓ CONFORME\x1b[0m — la grille passerait à l\'écriture.\n');
} else {
  console.log(`  \x1b[31m✗ ${verdict.bloquants.length} blocage(s)\x1b[0m\n`);
  verdict.bloquants.forEach(b => console.log(`    ⛔ ${b}`));
  console.log('');
}
if (verdict.signalements.length) {
  console.log(`  \x1b[33m! ${verdict.signalements.length} signalement(s)\x1b[0m`);
  verdict.signalements.forEach(s => console.log(`    · ${s}`));
  console.log('');
}

// Un aperçu de ce que l'agent a produit, pour juger sur pièce.
console.log('\x1b[1m  APERÇU DE LA SORTIE\x1b[0m');
console.log(`  · outils : ${(grille.bloc_profil?.outils || []).length}`);
for (const o of (grille.bloc_profil?.outils || [])) {
  console.log(`      ${o.libelle || '?'} — ${(o.gestes || []).length} geste(s)`);
  for (const g of (o.gestes || [])) console.log(`        « ${g.titre} »`);
}
console.log(`  · atouts : ${(grille.bloc_apport?.atouts || []).length} · coûts : ${(grille.bloc_apport?.couts || []).length}`);
console.log(`  · dimensions : ${(grille.bloc_dimensions || []).length}`);
console.log(`  · vigilances : ${(grille.bloc_vigilances || []).length}`);
console.log(`  · verbalisations : ${(grille.verbalisations || []).length}`);
console.log(`  · situations non traduites : ${(grille.situations_non_traduites || []).length}`);
(grille.situations_non_traduites || []).forEach(s =>
  console.log(`      ${typeof s === 'string' ? s : JSON.stringify(s)}`));
console.log('');
