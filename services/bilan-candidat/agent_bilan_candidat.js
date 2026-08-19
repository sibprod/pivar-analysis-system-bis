/**
 * AGENT — appel à l'API Claude. Dépôt ANALYSE.
 * L'agent sélectionne et assemble ; il ne rédige pas librement (pièce 38 v2).
 */
const fs = require('fs'), path = require('path');

const MODELE  = process.env.CLAUDE_MODELE || 'claude-sonnet-4-6';
const API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
const PROMPT  = fs.readFileSync(path.join(__dirname, 'prompt_bilan_candidat.md'), 'utf8');

async function appelerAgent(payload, referentielVigilance, alertesPrecedentes = [], sortiePrecedente = null, formulations = []) {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY absente');

  const corps = {
    payload: allegerPourAgent(payload),
    formulations_disponibles: formulations,
    referentiel_vigilance: referentielVigilance
  };
  // ⭐ Reprise : on montre à l'agent ce qui a été refusé et pourquoi.
  if (alertesPrecedentes && alertesPrecedentes.length) {
    corps.ta_tentative_precedente = sortiePrecedente;
    corps.motifs_de_rejet = alertesPrecedentes;
    corps.consigne_de_reprise =
      "Ta tentative précédente a été refusée pour les motifs ci-dessus. " +
      "Corrige exactement ces motifs et rends une nouvelle sortie complète. " +
      "Si aucun point de vigilance n'a pu être retenu, c'est que ton critère d'ancrage est trop strict : " +
      "un point est retenu dès qu'une phrase du candidat, dans n'importe lequel de ses gestes, illustre la situation décrite par l'énoncé — " +
      "la phrase n'a pas à contenir les mots de l'énoncé, elle doit montrer le même comportement.";
  }
  const contenu = JSON.stringify(corps, null, 1);

  const r = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({
      model: MODELE, max_tokens: 4000, temperature: 0,
      system: PROMPT,
      messages: [{ role: 'user', content: contenu }]
    })
  });
  if (!r.ok) throw new Error(`API Claude : ${r.status} ${await r.text()}`);

  const data = await r.json();
  const texte = (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('\n');
  const nu = texte.replace(/```json|```/g, '').trim();
  try {
    return JSON.parse(nu);
  } catch {
    // L'agent a répondu en langage naturel : on tente d'extraire l'objet, sinon
    // on rend une sortie vide — les contrôles la refuseront proprement.
    const d = nu.indexOf('{'), f = nu.lastIndexOf('}');
    if (d !== -1 && f > d) { try { return JSON.parse(nu.slice(d, f + 1)); } catch {} }
    return { titres_parles: [], points_vigilance: [], _reponse_non_json: nu.slice(0, 300) };
  }
}

/* L'agent ne reçoit que ce dont il a besoin : ni coûts, ni affects, ni révélation. */
function allegerPourAgent(p) {
  return {
    socle_libelle: p.socle_libelle,
    filtre: p.filtre,
    outils: (p.outils || []).map(o => ({
      pilier_libelle: o.pilier_libelle, role: o.role, mode_libelle: o.mode_libelle,
      gestes: o.gestes
    }))
  };
}

module.exports = { appelerAgent, MODELE };
