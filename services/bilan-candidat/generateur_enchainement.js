/**
 * GÉNÉRATEUR D'ENCHAÎNEMENT — par le code, sans agent (pièce 38 v2, verrou n° 3).
 * Ce qui n'est pas produit par un modèle ne peut pas déraper.
 */
function genererEnchainement(payload) {
  const par = r => payload.outils.filter(o => o.role === r);
  const socle = par('socle')[0], amont = par('amont')[0], aval = par('aval')[0];
  const fonctionnels = par('fonctionnel');
  if (!socle) throw new Error('enchaînement : aucun outil socle');

  const chaine = [amont, socle, aval].filter(Boolean)
    .map(o => ({ role: o.role, pilier_libelle: o.pilier_libelle }));

  // Chaque phrase s'appuie sur un renfort réel ; sans renfort, pas de phrase.
  const liens = [];
  for (const o of payload.outils) {
    if (o.role === 'socle') continue;
    const renfort = extraireRenfort(o, socle.pilier_libelle);
    if (renfort) liens.push(renfort);
  }

  return {
    chaine,
    appeles_au_besoin: fonctionnels.map(o => o.pilier_libelle),
    liens,
    cloture: `Tout revient à votre ${socle.pilier_libelle}, et tout en repart.`
  };
}

function extraireRenfort(outil, libelleSocle) {
  const texte = Array.isArray(outil.gestes)
    ? outil.gestes.map(g => [g.renfort, g.narration].filter(Boolean).join(' ')).join(' ')
    : (outil.gestes?.texte_integral || '');
  if (!texte || !texte.includes(libelleSocle)) return null;   // aucun renfort attesté → aucune phrase
  return { depuis: outil.pilier_libelle, vers: libelleSocle, role: outil.role };
}

module.exports = { genererEnchainement };
