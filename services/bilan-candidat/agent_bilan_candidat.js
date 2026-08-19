/**
 * AGENT — appel à l'API Claude. Dépôt ANALYSE.
 * L'agent sélectionne et assemble ; il ne rédige pas librement (pièce 38 v2).
 */
const fs = require('fs'), path = require('path');

const MODELE  = process.env.CLAUDE_MODELE || 'claude-sonnet-4-6';
const API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
const PROMPT  = fs.readFileSync(path.join(__dirname, 'prompt_bilan_candidat.md'), 'utf8');

async function appelerAgent(payload, referentielVigilance, formulations = []) {
  if (!API_KEY) throw new Error('ANTHROPIC_API_KEY absente');

  const contenu = JSON.stringify({
    payload: allegerPourAgent(payload),
    formulations_disponibles: formulations,
    referentiel_vigilance: referentielVigilance
  }, null, 1);

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
  return JSON.parse(texte.replace(/```json|```/g, '').trim());
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
