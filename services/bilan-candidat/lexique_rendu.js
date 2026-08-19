/**
 * LEXIQUE DE SUBSTITUTION — appliqué AU RENDU (D2-07, tranché le 18/08).
 * Filtre de sortie déterministe : la matière en base n'est jamais modifiée.
 * Ordre : du plus long au plus court, pour éviter les substitutions partielles.
 */
const SUBSTITUTIONS = [
  ["Mise en œuvre et exécution", "l'outil qui met en œuvre le plan et l'exécute"],
  ["Création de solutions",      "l'outil qui crée les solutions"],
  ["Analyse et diagnostic",      "l'outil qui analyse"],
  ["Collecte d'information",     "l'outil qui cherche l'info"],
  ["Tri et organisation",        "l'outil qui range"],
  ["Mise en œuvre",              "l'outil qui met en œuvre le plan et l'exécute"]
];
const TOURNURES = [["votre l'outil qui","votre outil qui"],["Votre l'outil qui","Votre outil qui"]];

function appliquerLexique(texte) {
  let t = String(texte ?? '');
  for (const [avant, apres] of SUBSTITUTIONS) t = t.split(avant).join(apres);
  for (const [avant, apres] of TOURNURES)    t = t.split(avant).join(apres);
  return t;
}

function appliquerLexiqueProfond(valeur) {
  if (typeof valeur === 'string') return appliquerLexique(valeur);
  if (Array.isArray(valeur))      return valeur.map(appliquerLexiqueProfond);
  if (valeur && typeof valeur === 'object')
    return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, appliquerLexiqueProfond(v)]));
  return valeur;
}

/* Contrôle final avant affichage : aucun libellé ne doit subsister */
function verifierAucunLibelle(objet) {
  const texte = JSON.stringify(objet);
  const restants = SUBSTITUTIONS.map(([l]) => l).filter(l => texte.includes(l));
  if (restants.length) throw new Error(`Libellés du protocole présents au rendu : ${restants.join(', ')}`);
  return true;
}

module.exports = { appliquerLexique, appliquerLexiqueProfond, verifierAucunLibelle, SUBSTITUTIONS };
