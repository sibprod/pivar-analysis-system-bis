/**
 * ═══════════════════════════════════════════════════════════════════════════
 * PROFIL COGNITIF - GRILLE DRH RÉFÉRENT API
 * Version: 3.4.0 - STATIC FILES + CACHE + BRANDING
 * Date: 17/12/2025
 * 
 * NOUVEAUTÉS v3.4.0 :
 * - Static file serving (index.html servi directement)
 * - Cache GRILLE_DRH_CACHE (évite recalculs inutiles)
 * - Branding PROFIL COGNITIF (remplace PIVAR)
 * - Hash MD5 pour détecter changements BILAN
 * ═══════════════════════════════════════════════════════════════════════════
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const fetch = require('node-fetch');
const crypto = require('crypto');
const path = require('path');
const grilleDrh = require('./grilleDrhService');

const app = express();

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

const AIRTABLE_API_KEY = process.env.AIRTABLE_TOKEN;
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
const JWT_SECRET = process.env.JWT_SECRET || 'profil_cognitif_grille_drh_secret_2025';
const AIRTABLE_URL = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}`;
const LINK_TOKEN_SECRET = process.env.LINK_TOKEN_SECRET || 'prcg-7Kx9mWqL2vNfE4sYhB8jR5tZaC3pD6gU';
const airtableHeaders = {
    'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
    'Content-Type': 'application/json'
};

// Middleware
app.use(cors());
app.use(express.json());

// ═══════════════════════════════════════════════════════════════════════════
// STATIC FILES - Servir index.html et assets
// ═══════════════════════════════════════════════════════════════════════════

app.use(express.static(path.join(__dirname, 'public')));
// ═══════════════════════════════════════════════════════════════════════════
// VÉRIFICATION TOKEN SÉCURISÉ (depuis Matching Tool)
// ═══════════════════════════════════════════════════════════════════════════

function verifySecureToken(token) {
    if (!token) return null;
    try {
        let base64 = token.replace(/-/g, '+').replace(/_/g, '/');
        const padding = base64.length % 4;
        if (padding > 0) base64 += '='.repeat(4 - padding);
        
        const decoded = Buffer.from(base64, 'base64').toString('utf8');
        const data = JSON.parse(decoded);
        
        if (!data.payload || !data.signature) return null;
        
        const expectedSignature = crypto
            .createHmac('sha256', LINK_TOKEN_SECRET)
            .update(JSON.stringify(data.payload))
            .digest('hex');
        
        if (expectedSignature !== data.signature) return null;
        if (data.payload.exp < Math.floor(Date.now() / 1000)) return null;
        if (data.payload.type !== 'grille') return null;
        
        console.log('[Token] Valide pour:', data.payload.email);
        return data.payload;
    } catch (e) {
        console.error('[Token] Erreur vérification:', e.message);
        return null;
    }
}
// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTES - LEXIQUES PROFIL COGNITIF
// ═══════════════════════════════════════════════════════════════════════════

const NOMS_PILIERS = {
    P1: 'Collecte',
    P2: 'Tri & Mémorisation',
    P3: 'Analyse',
    P4: 'Solutions',
    P5: 'Mise en œuvre'
};

const NOMS_PILIERS_COURTS = {
    P1: 'Collecte',
    P2: 'Tri',
    P3: 'Analyse',
    P4: 'Solutions',
    P5: 'Exécution'
};

const PROFILS_PILIERS_DEFAUT = {
    P1: 'Stratégique et anticipatif',
    P2: 'Structuré et organisé',
    P3: 'Prospectif et stratégique',
    P4: 'Adaptatif et pragmatique',
    P5: 'Organisé et planificateur'
};

const DEFINITIONS_EXCELLENCES = {
    anticipation: "Capacité à prévoir les événements, blocages ou besoins futurs avant qu'ils ne surviennent.",
    decentration: "Capacité à se mettre à la place de l'autre, à comprendre des perspectives différentes.",
    metacognition: "Conscience de ses propres processus de pensée. Capacité à observer et ajuster sa façon de réfléchir.",
    anglesmorts: "Capacité à identifier ce qu'on ne sait pas, les informations manquantes, les biais potentiels."
};

const NOMS_EXCELLENCES = {
    anticipation: "Anticipation",
    decentration: "Décentration",
    metacognition: "Métacognition", 
    anglesmorts: "Angles morts"
};

const CONTEXTES_EXCELLENCES = {
    anticipation: "Gestion de projet, prévention des risques, planification stratégique, pilotage de transformation",
    decentration: "Management d'équipes, négociation, relation client, gestion de conflits",
    metacognition: "Formation, transmission de savoir-faire, amélioration continue, coaching d'équipe",
    anglesmorts: "Audit, contrôle qualité, due diligence, prise de décision stratégique"
};

// ═══════════════════════════════════════════════════════════════════════════
// FONCTIONS AIRTABLE
// ═══════════════════════════════════════════════════════════════════════════

async function getRecordByFormula(tableName, formula) {
    const url = `${AIRTABLE_URL}/${encodeURIComponent(tableName)}?filterByFormula=${encodeURIComponent(formula)}`;
    try {
        const response = await fetch(url, { headers: airtableHeaders });
        const data = await response.json();
        if (data.error) {
            console.error(`Airtable error [${tableName}]:`, data.error);
            throw new Error(`Airtable: ${data.error.message}`);
        }
        return data.records.length > 0 ? data.records[0] : null;
    } catch (error) {
        console.error(`Fetch error [${tableName}]:`, error.message);
        throw error;
    }
}

async function getRecords(tableName, options = {}) {
    let url = `${AIRTABLE_URL}/${encodeURIComponent(tableName)}`;
    const params = [];
    
    if (options.filterByFormula) {
        params.push(`filterByFormula=${encodeURIComponent(options.filterByFormula)}`);
    }
    if (options.sort) {
        options.sort.forEach((s, i) => {
            params.push(`sort[${i}][field]=${encodeURIComponent(s.field)}`);
            params.push(`sort[${i}][direction]=${s.direction || 'asc'}`);
        });
    }
    if (options.maxRecords) {
        params.push(`maxRecords=${options.maxRecords}`);
    }
    
    if (params.length > 0) url += '?' + params.join('&');
    
    try {
        const response = await fetch(url, { headers: airtableHeaders });
        const data = await response.json();
        if (data.error) {
            console.error(`Airtable error [${tableName}]:`, data.error);
            throw new Error(`Airtable: ${data.error.message}`);
        }
        return data.records;
    } catch (error) {
        console.error(`Fetch error [${tableName}]:`, error.message);
        throw error;
    }
}

async function updateRecord(tableName, recordId, fields) {
    const url = `${AIRTABLE_URL}/${encodeURIComponent(tableName)}/${recordId}`;
    try {
        const response = await fetch(url, {
            method: 'PATCH',
            headers: airtableHeaders,
            body: JSON.stringify({ fields })
        });
        const data = await response.json();
        if (data.error) {
            console.error(`Airtable update error [${tableName}]:`, data.error);
            throw new Error(`Airtable: ${data.error.message}`);
        }
        return data;
    } catch (error) {
        console.error(`Update error [${tableName}]:`, error.message);
        throw error;
    }
}

async function createRecord(tableName, fields) {
    const url = `${AIRTABLE_URL}/${encodeURIComponent(tableName)}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: airtableHeaders,
            body: JSON.stringify({ fields })
        });
        const data = await response.json();
        if (data.error) {
            console.error(`Airtable create error [${tableName}]:`, data.error);
            throw new Error(`Airtable: ${data.error.message}`);
        }
        return data;
    } catch (error) {
        console.error(`Create error [${tableName}]:`, error.message);
        throw error;
    }
}

// Initialiser le service Grille DRH avec les fonctions Airtable
grilleDrh.init({ getRecordByFormula, getRecords, updateRecord });

// ═══════════════════════════════════════════════════════════════════════════
// FONCTIONS CACHE - GRILLE_DRH_CACHE
// ═══════════════════════════════════════════════════════════════════════════

function generateBilanHash(bilanFields) {
    const relevantFields = [
        'niveau_pivar', 'type_pivar', 'zone_pivar',
        'niveau_score_pilier_P1', 'niveau_score_pilier_P2', 'niveau_score_pilier_P3',
        'niveau_score_pilier_P4', 'niveau_score_pilier_P5',
        'anticipation_niveau', 'decentration_niveau', 'metacognition_niveau', 'anglesmorts_niveau',
        'interferences_limbiques_globales',
        'eval_encadrer_verdict', 'eval_manager_verdict'
    ];
    
    const dataToHash = relevantFields.map(f => bilanFields[f] || '').join('|');
    return crypto.createHash('md5').update(dataToHash).digest('hex');
}

async function getCachedGrille(sessionId) {
    try {
        const cached = await getRecordByFormula('GRILLE_DRH_CACHE', `{session_ID} = '${sessionId}'`);
        if (cached && cached.fields.grille_json && cached.fields.statut === 'valide') {
            return {
                record: cached,
                grille: JSON.parse(cached.fields.grille_json),
                hash: cached.fields.hash_bilan
            };
        }
        return null;
    } catch (error) {
        console.error('Erreur lecture cache:', error.message);
        return null;
    }
}

async function saveGrilleToCache(sessionId, grille, bilanHash, visiteurRecordId) {
    try {
        const existing = await getRecordByFormula('GRILLE_DRH_CACHE', `{session_ID} = '${sessionId}'`);
        
        const cacheData = {
            session_ID: sessionId,
            grille_json: JSON.stringify(grille),
            date_generation: new Date().toISOString(),
            version_prompt: '3.4.0',
            statut: 'valide',
            hash_bilan: bilanHash
        };
        
        if (visiteurRecordId) {
            cacheData.VISITEUR = [visiteurRecordId];
        }
        
        if (existing) {
            await updateRecord('GRILLE_DRH_CACHE', existing.id, cacheData);
            console.log(`   📦 Cache mis à jour pour ${sessionId}`);
        } else {
            await createRecord('GRILLE_DRH_CACHE', cacheData);
            console.log(`   📦 Cache créé pour ${sessionId}`);
        }
    } catch (error) {
        console.error('Erreur sauvegarde cache:', error.message);
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTIONS UTILITAIRES - PARSING
// ═══════════════════════════════════════════════════════════════════════════

function parseSectionPilier(section) {
    if (!section) return { profil: '', style: '', verbatim: '', circuits: '', exemple: '' };
    
    const profilMatch = section.match(/##\s*🎯\s*[\w\s&éèêëàâäùûüôöîïç]+\s*-\s*(.+)/i);
    const profil = profilMatch ? profilMatch[1].trim() : '';
    
    const styleMatch = section.match(/\*\*(?:Votre\s+)?style\*\*\s*:\s*(.+?)(?=\n\*\*|$)/is);
    let style = styleMatch ? styleMatch[1].trim() : '';
    
    let verbatim = '';
    const verbatimMatch = section.match(/en disant\s+'([^']*(?:'[^']*)*?)'\./);
    if (verbatimMatch) {
        verbatim = verbatimMatch[1];
    } else {
        const fallbackMatch = section.match(/'([^']{10,}[^'])'\./);
        if (fallbackMatch) {
            verbatim = fallbackMatch[1];
        }
    }
    
    const circuitsMatch = section.match(/\*\*Circuits?\s+activés?\*\*\s*:\s*(.+?)(?=\n\*\*|$)/is);
    const circuits = circuitsMatch ? circuitsMatch[1].trim() : '';
    
    const exempleMatch = section.match(/\*\*Exemple\s+concret\*\*\s*:\s*(.+?)(?=\n\*\*|$)/is);
    const exemple = exempleMatch ? exempleMatch[1].trim() : '';
    
    return { profil, style, verbatim, circuits, exemple };
}

function convertirPersonne(texte, prenom = 'Le candidat') {
    if (!texte) return '';
    
    return texte
        .replace(/\bVous\b/g, prenom)
        .replace(/\bvous\b/g, 'il/elle')
        .replace(/\bVotre\b/g, 'Son')
        .replace(/\bvotre\b/g, 'son')
        .replace(/\bVos\b/g, 'Ses')
        .replace(/\bvos\b/g, 'ses');
}

function parseMarqueursLimbiques(jsonString) {
    if (!jsonString) return { rejet: 0, anxiete: 0, frustration: 0 };
    
    try {
        const data = typeof jsonString === 'string' ? JSON.parse(jsonString) : jsonString;
        return {
            rejet: parseInt(data.emotionnel_rejet) || 0,
            anxiete: parseInt(data.emotionnel_anxiete) || 0,
            frustration: parseInt(data.emotionnel_frustration) || 0
        };
    } catch (e) {
        console.error('Erreur parsing marqueurs:', e.message);
        return { rejet: 0, anxiete: 0, frustration: 0 };
    }
}

function parseVigilances(texte) {
    if (!texte) return [];
    
    const vigilances = [];
    const regex = /\*\*([^*]+)\*\*\s*:\s*([^*\n]+(?:\n(?!\s*-\s*\*\*)[^\n]*)*)/g;
    let match;
    
    while ((match = regex.exec(texte)) !== null) {
        vigilances.push({
            titre: match[1].trim(),
            texte: match[2].trim().replace(/\n/g, ' ')
        });
    }
    
    return vigilances.slice(0, 5);
}

function formatDate(dateString) {
    if (!dateString) return new Date().toLocaleDateString('fr-FR');
    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('fr-FR');
    } catch (e) {
        return new Date().toLocaleDateString('fr-FR');
    }
}

function formatPiliersMoteurs(piliersMoteurs) {
    if (!piliersMoteurs) return '';
    
    return piliersMoteurs.split(',').map(p => {
        const code = p.trim();
        const nom = NOMS_PILIERS_COURTS[code] || '';
        return nom ? `${code} (${nom})` : code;
    }).join(', ');
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTIONS D'ÉVALUATION ENCADRER/MANAGER
// ═══════════════════════════════════════════════════════════════════════════

function evaluerEncadrer(b, totalNegatifs, prenom) {
    const metacognition = (b.metacognition_niveau || 'moyen').toLowerCase();
    const niveauP5 = parseInt(b.niveau_score_pilier_P5) || 0;
    const niveauP2 = parseInt(b.niveau_score_pilier_P2) || 0;
    
    if (b.eval_encadrer_verdict) {
        return {
            verdict: b.eval_encadrer_verdict,
            label: b.eval_encadrer_verdict,
            synthese: b.eval_encadrer_synthese || '',
            criteres: {
                metacognition: { niveau: metacognition, score: metacognition === 'élevé' ? 7 : metacognition === 'faible' ? 3 : 5 },
                P5: { niveau: niveauP5, label: niveauP5 >= 6 ? 'Correct' : 'Attention' },
                P2: { niveau: niveauP2, label: niveauP2 >= 6 ? 'Correct' : 'Attention' }
            }
        };
    }
    
    let verdict = 'À DÉVELOPPER';
    let synthese = '';
    
    const metacogFaible = metacognition === 'faible';
    const metacogEleve = metacognition === 'élevé' || metacognition === 'eleve';
    
    if (metacogFaible && niveauP2 < 5 && niveauP5 < 5) {
        verdict = 'NON RECOMMANDÉ';
        synthese = `La faible métacognition combinée aux niveaux P2 (${niveauP2}/9) et P5 (${niveauP5}/9) bas rend difficile la transmission structurée de méthodes.`;
    } else if (metacogFaible) {
        verdict = 'À DÉVELOPPER';
        synthese = `La faible métacognition rend difficile la transmission explicite de méthodes. ${prenom} fait bien mais peut avoir du mal à expliquer comment.`;
    } else if (metacogEleve && niveauP5 >= 6 && niveauP2 >= 6) {
        verdict = 'FAVORABLE';
        synthese = `Bonne métacognition combinée à des piliers P5 (${niveauP5}/9) et P2 (${niveauP2}/9) solides. Capacité à structurer et transmettre une méthode de travail.`;
    } else if (metacogEleve && (niveauP5 >= 6 || niveauP2 >= 6)) {
        verdict = 'FAVORABLE';
        synthese = `Métacognition élevée avec capacité de structuration. ${prenom} peut transmettre ses méthodes de travail efficacement.`;
    } else {
        synthese = `Capacité d'encadrement à consolider. Métacognition ${metacognition}, P5 ${niveauP5}/9, P2 ${niveauP2}/9.`;
    }
    
    return {
        verdict,
        label: verdict,
        synthese,
        criteres: {
            metacognition: { niveau: metacognition, score: metacogEleve ? 7 : metacogFaible ? 3 : 5 },
            P5: { niveau: niveauP5, label: niveauP5 >= 6 ? 'Correct' : 'Attention' },
            P2: { niveau: niveauP2, label: niveauP2 >= 6 ? 'Correct' : 'Attention' }
        }
    };
}

function evaluerManager(b, totalNegatifs, prenom) {
    const decentration = (b.decentration_niveau || 'moyen').toLowerCase();
    const anticipation = (b.anticipation_niveau || 'moyen').toLowerCase();
    const instable = totalNegatifs >= 5;
    
    if (b.eval_manager_verdict) {
        let stabilite = 'Excellente';
        let stabiliteClasse = 'ok';
        if (totalNegatifs >= 10) {
            stabilite = 'Préoccupante';
            stabiliteClasse = 'danger';
        } else if (totalNegatifs >= 5) {
            stabilite = 'À surveiller';
            stabiliteClasse = 'warning';
        }
        
        return {
            verdict: b.eval_manager_verdict,
            label: b.eval_manager_verdict,
            synthese: b.eval_manager_synthese || '',
            criteres: {
                decentration: { niveau: decentration, score: decentration === 'élevé' ? 7 : decentration === 'faible' ? 3 : 5 },
                anticipation: { niveau: anticipation, score: anticipation === 'élevé' ? 7 : anticipation === 'faible' ? 3 : 5 },
                stabilite: { niveau: stabilite, classe: stabiliteClasse, marqueurs: totalNegatifs }
            }
        };
    }
    
    let verdict = 'À DÉVELOPPER';
    let synthese = '';
    
    const decentEleve = decentration === 'élevé' || decentration === 'eleve';
    const anticEleve = anticipation === 'élevé' || anticipation === 'eleve';
    const decentFaible = decentration === 'faible';
    const anticFaible = anticipation === 'faible';
    
    let stabilite = 'Excellente';
    let stabiliteClasse = 'ok';
    if (totalNegatifs >= 10) {
        stabilite = 'Préoccupante';
        stabiliteClasse = 'danger';
    } else if (totalNegatifs >= 5) {
        stabilite = 'À surveiller';
        stabiliteClasse = 'warning';
    }
    
    if (totalNegatifs >= 10) {
        verdict = 'NON RECOMMANDÉ';
        synthese = `Profil émotionnel instable (${totalNegatifs} marqueurs négatifs). Accompagnement nécessaire avant responsabilités managériales.`;
    } else if (instable) {
        verdict = 'À DÉVELOPPER';
        synthese = `Profil émotionnel à stabiliser avant responsabilités managériales (${totalNegatifs} marqueurs négatifs détectés).`;
    } else if (decentEleve && anticEleve) {
        verdict = 'FAVORABLE';
        synthese = `Combinaison rare Décentration + Anticipation élevées avec stabilité émotionnelle. Capacité naturelle à comprendre les besoins de l'équipe.`;
    } else if (decentFaible && anticFaible) {
        verdict = 'NON RECOMMANDÉ';
        synthese = `Décentration et anticipation toutes deux faibles. Développement significatif requis pour le management d'équipe.`;
    } else if (decentFaible || anticFaible) {
        verdict = 'À DÉVELOPPER';
        const faibles = [];
        if (decentFaible) faibles.push('décentration');
        if (anticFaible) faibles.push('anticipation');
        synthese = `Excellence(s) ${faibles.join(' et ')} à développer pour le management d'équipe.`;
    } else if (decentEleve || anticEleve) {
        verdict = 'FAVORABLE';
        const forte = decentEleve ? 'décentration' : 'anticipation';
        synthese = `${forte.charAt(0).toUpperCase() + forte.slice(1)} élevée avec stabilité émotionnelle. Potentiel managérial solide.`;
    } else {
        synthese = `Potentiel managérial présent. Décentration ${decentration}, Anticipation ${anticipation}. À développer avec accompagnement.`;
    }
    
    return {
        verdict,
        label: verdict,
        synthese,
        criteres: {
            decentration: { niveau: decentration, score: decentEleve ? 7 : decentFaible ? 3 : 5 },
            anticipation: { niveau: anticipation, score: anticEleve ? 7 : anticFaible ? 3 : 5 },
            stabilite: { niveau: stabilite, classe: stabiliteClasse, marqueurs: totalNegatifs }
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTIONS DE GÉNÉRATION DE CONTENU
// ═══════════════════════════════════════════════════════════════════════════

function genererInterpretationMarqueurs(marqueurs, prenom) {
    const total = marqueurs.rejet + marqueurs.anxiete + marqueurs.frustration;
    
    if (total === 0) {
        return `${prenom} présente un profil remarquablement équilibré avec une absence totale de marqueurs limbiques perturbateurs.`;
    } else if (total <= 2) {
        return `${prenom} présente un profil équilibré avec une quasi-absence de marqueurs limbiques perturbateurs (${total}/25).`;
    } else if (total <= 5) {
        return `${prenom} présente quelques marqueurs émotionnels (${total}/25) qui méritent attention sans être préoccupants.`;
    } else if (total <= 10) {
        return `${prenom} présente des marqueurs émotionnels modérés (${total}/25). Un accompagnement peut être bénéfique.`;
    } else {
        return `${prenom} présente des marqueurs émotionnels significatifs (${total}/25). Un accompagnement personnalisé est recommandé.`;
    }
}

function genererSignatureSynergie(b, prenom) {
    const pilierDom = b.pilier_dominant || 'P3';
    const pilierStruct = b.pilier_structurant || 'P4';
    const nomDom = NOMS_PILIERS_COURTS[pilierDom] || pilierDom;
    const nomStruct = NOMS_PILIERS_COURTS[pilierStruct] || pilierStruct;
    
    return `L'excellence de ${prenom} naît de la synergie entre son ${nomDom} (${pilierDom}) et ses ${nomStruct} (${pilierStruct}).`;
}

function genererMissionsRecommandees(b) {
    const pilierDom = b.pilier_dominant || 'P3';
    
    const missions = {
        P1: [
            { titre: 'Veille stratégique', desc: 'Collecte et analyse d\'informations sectorielles' },
            { titre: 'Recherche & développement', desc: 'Exploration de nouvelles opportunités' },
            { titre: 'Benchmark concurrentiel', desc: 'Analyse comparative des pratiques marché' }
        ],
        P2: [
            { titre: 'Organisation documentaire', desc: 'Structuration des bases de connaissances' },
            { titre: 'Process qualité', desc: 'Définition et optimisation des procédures' },
            { titre: 'Formation interne', desc: 'Transmission des savoirs et méthodes' }
        ],
        P3: [
            { titre: 'Analyse stratégique', desc: 'Études d\'impact et recommandations' },
            { titre: 'Gestion de projets complexes', desc: 'Coordination multi-parties prenantes' },
            { titre: 'Conseil interne', desc: 'Accompagnement des décisions importantes' }
        ],
        P4: [
            { titre: 'Innovation produit/service', desc: 'Conception de nouvelles solutions' },
            { titre: 'Résolution de problèmes', desc: 'Traitement des situations complexes' },
            { titre: 'Amélioration continue', desc: 'Optimisation des processus existants' }
        ],
        P5: [
            { titre: 'Pilotage opérationnel', desc: 'Coordination des équipes terrain' },
            { titre: 'Gestion de production', desc: 'Organisation et suivi des livrables' },
            { titre: 'Déploiement de projets', desc: 'Mise en œuvre et suivi des plans d\'action' }
        ]
    };
    
    return missions[pilierDom] || missions.P3;
}

function genererPointsAttention(b) {
    const niveaux = {
        P1: parseInt(b.niveau_score_pilier_P1) || 0,
        P2: parseInt(b.niveau_score_pilier_P2) || 0,
        P3: parseInt(b.niveau_score_pilier_P3) || 0,
        P4: parseInt(b.niveau_score_pilier_P4) || 0,
        P5: parseInt(b.niveau_score_pilier_P5) || 0
    };
    
    const pilierFaible = Object.entries(niveaux).reduce((a, b) => a[1] < b[1] ? a : b)[0];
    
    const attentions = {
        P1: ['Contextes nécessitant une recherche d\'information rapide', 'Missions de veille avec fort volume de données'],
        P2: ['Environnements très procéduriers', 'Postes nécessitant une mémorisation importante'],
        P3: ['Décisions rapides sans temps d\'analyse', 'Contextes où l\'intuition prime'],
        P4: ['Environnements très cadrés', 'Missions répétitives sans composante créative'],
        P5: ['Projets avec échéances très serrées', 'Contextes nécessitant une exécution séquentielle stricte']
    };
    
    return attentions[pilierFaible] || attentions.P3;
}

function getSynthesePositionnement(b, evalEncadrer, evalManager, prenom) {
    if (b.synthese_positionnement) {
        try {
            const synth = typeof b.synthese_positionnement === 'string' 
                ? JSON.parse(b.synthese_positionnement) 
                : b.synthese_positionnement;
            return {
                profil_type: synth.profil_type || `${b.type_pivar || 'PROFIL'} niveau ${b.niveau_pivar || 0}/9`,
                signature: synth.signature || b.Nom_signature_excellence || '',
                forces: synth.forces_distinctives || synth.forces || '',
                positionnement: synth.positionnement || '',
                points_attention: synth.points_attention || ''
            };
        } catch (e) {
            console.error('Erreur parsing synthese_positionnement:', e.message);
        }
    }
    
    const forces = [];
    if ((b.anticipation_niveau || '').toLowerCase() === 'élevé') forces.push('excellence anticipative');
    if ((b.decentration_niveau || '').toLowerCase() === 'élevé') forces.push('décentration cognitive élevée');
    if ((b.metacognition_niveau || '').toLowerCase() === 'élevé') forces.push('métacognition développée');
    
    const zone = b.zone_pivar || 'Opérationnelle';
    let positionnement = '';
    if (zone === 'Stratégique') {
        positionnement = `${prenom} se positionne sur des fonctions de direction stratégique.`;
    } else if (zone === 'Opérationnelle') {
        positionnement = `${prenom} se positionne sur des fonctions opérationnelles avec une bonne capacité d'autonomie.`;
    } else {
        positionnement = `${prenom} nécessite un accompagnement pour développer son potentiel.`;
    }
    
    return {
        profil_type: `${b.type_pivar || 'PROFIL'} niveau ${b.niveau_pivar || 0}/9 – Zone ${zone}`,
        signature: b.Nom_signature_excellence || '',
        forces: forces.join(', '),
        positionnement: positionnement,
        points_attention: b.vigilances_piliers_faibles || ''
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// FONCTION PRINCIPALE - GÉNÉRATION GRILLE
// ═══════════════════════════════════════════════════════════════════════════

function generateGrilleFromBilan(bilan, visiteur) {
    const b = bilan.fields;
    const prenom = visiteur.fields.Prenom || 'Le candidat';
    const sessionId = visiteur.fields.session_ID;

    const niveauxPiliers = {
        P1: parseInt(b.niveau_score_pilier_P1) || 0,
        P2: parseInt(b.niveau_score_pilier_P2) || 0,
        P3: parseInt(b.niveau_score_pilier_P3) || 0,
        P4: parseInt(b.niveau_score_pilier_P4) || 0,
        P5: parseInt(b.niveau_score_pilier_P5) || 0
    };
    
    const minNiveau = Math.min(...Object.values(niveauxPiliers));
    const pilierDominant = b.pilier_dominant || 'P3';
    const pilierStructurant = b.pilier_structurant || 'P4';

    const piliers = {};
    ['P1', 'P2', 'P3', 'P4', 'P5'].forEach(code => {
        const niveau = niveauxPiliers[code];
        
        let role = null;
        if (code === pilierDominant) role = 'dominant';
        else if (code === pilierStructurant) role = 'structurant';
        else if (niveau === minNiveau && niveau < 6) role = 'surveiller';

        const sectionComplete = b[`section_pilier_${code}`] || '';
        const parsed = parseSectionPilier(sectionComplete);
        const profilExtrait = parsed.profil || PROFILS_PILIERS_DEFAUT[code];

        piliers[code] = {
            code: code,
            nom: NOMS_PILIERS[code],
            nom_court: NOMS_PILIERS_COURTS[code],
            niveau: niveau,
            role: role,
            profil: profilExtrait,
            titre_complet: `${NOMS_PILIERS[code]} - ${profilExtrait}`,
            style: convertirPersonne(parsed.style, prenom),
            verbatim: parsed.verbatim,
            circuits: parsed.circuits,
            exemple: parsed.exemple,
            synthese_sophistiquee: b[`${code}_sophistiquees_synthese`] || '',
            dimensions_sophistiquees: parseInt(b[`${code}_sophistiquees_total`]) || 0
        };
    });

    const excellences = {};
    ['anticipation', 'decentration', 'metacognition', 'anglesmorts'].forEach(type => {
        const niveau = (b[`${type}_niveau`] || 'moyen').toLowerCase();
        const synthese = b[`${type}_synthese`] || '';
        
        let role = null;
        if (b.excellence_dominante === type) role = 'dominante';
        else if (b.excellence_secondaire === type) role = 'secondaire';

        excellences[type] = {
            type: type,
            nom: NOMS_EXCELLENCES[type],
            niveau: niveau,
            synthese: synthese,
            role: role,
            definition: DEFINITIONS_EXCELLENCES[type],
            contexte_atout: CONTEXTES_EXCELLENCES[type]
        };
    });

    const marqueurs = parseMarqueursLimbiques(b.interferences_limbiques_globales);
    const totalNegatifs = marqueurs.rejet + marqueurs.frustration;
    
    let profilMarqueurs = { profil: 'stable', label: 'Profil émotionnellement stable', classe: 'success' };
    if (totalNegatifs >= 10) {
        profilMarqueurs = { profil: 'alerte', label: 'Profil en alerte', classe: 'danger' };
    } else if (totalNegatifs >= 5) {
        profilMarqueurs = { profil: 'reactif', label: 'Profil réactif', classe: 'warning' };
    }

    const evalEncadrer = evaluerEncadrer(b, totalNegatifs, prenom);
    const evalManager = evaluerManager(b, totalNegatifs, prenom);
    const synthesePositionnement = getSynthesePositionnement(b, evalEncadrer, evalManager, prenom);
    const interpretationMarqueurs = b.interpretation_marqueurs || genererInterpretationMarqueurs(marqueurs, prenom);

    return {
        candidat: {
            prenom: visiteur.fields.Prenom || '',
            nom: visiteur.fields.Nom || '',
            session_id: sessionId,
            entreprise: visiteur.fields.Entreprise || '',
            date_evaluation: formatDate(b.date_generation)
        },
        profil: {
            type: b.type_pivar || 'PROFIL',
            niveau: parseInt(b.niveau_pivar) || parseInt(b.niveau_moyen_global) || 0,
            zone: b.zone_pivar || 'Standard',
            signature: b.Nom_signature_excellence || '',
            mantra: b.mantra_profil || '',
            boucle_cognitive: b.boucle_cognitive_ordre || '',
            piliers_moteurs: b.piliers_moteurs || '',
            piliers_moteurs_format: formatPiliersMoteurs(b.piliers_moteurs),
            pilier_dominant: pilierDominant,
            pilier_structurant: pilierStructurant,
            pilier_surveiller: Object.entries(niveauxPiliers).reduce((a, b) => a[1] < b[1] ? a : b)[0]
        },
        piliers: piliers,
        excellences: excellences,
        marqueurs_limbiques: {
            rejet: marqueurs.rejet,
            anxiete: marqueurs.anxiete,
            frustration: marqueurs.frustration,
            total_negatifs: totalNegatifs,
            total_reponses: parseInt(b.nombre_reponses_analysees) || 25,
            profil: profilMarqueurs.profil,
            label: profilMarqueurs.label,
            classe: profilMarqueurs.classe
        },
        dimensions: {
            sophistiquees_total: parseInt(b.dimensions_superieures_count) || 0,
            types_dominants: b.dimensions_superieures_liste || '',
            par_pilier: {
                P1: { total: parseInt(b.P1_sophistiquees_total) || 0, synthese: b.P1_sophistiquees_synthese || '' },
                P2: { total: parseInt(b.P2_sophistiquees_total) || 0, synthese: b.P2_sophistiquees_synthese || '' },
                P3: { total: parseInt(b.P3_sophistiquees_total) || 0, synthese: b.P3_sophistiquees_synthese || '' },
                P4: { total: parseInt(b.P4_sophistiquees_total) || 0, synthese: b.P4_sophistiquees_synthese || '' },
                P5: { total: parseInt(b.P5_sophistiquees_total) || 0, synthese: b.P5_sophistiquees_synthese || '' }
            }
        },
        contenus: {
            pitch_recruteur: b.pitch_recruteur || '',
            profil_personnalise: convertirPersonne(b.profil_personnalise, prenom),
            talent_definition: convertirPersonne(b.talent_definition, prenom),
            trois_capacites: b.trois_capacites || '',
            signature_excellence: convertirPersonne(b.section_signature_excellence, prenom),
            vigilances: parseVigilances(b.points_vigilance_complet),
            vigilances_piliers_faibles: b.vigilances_piliers_faibles || '',
            interpretation_marqueurs: interpretationMarqueurs,
            signature_synergie: genererSignatureSynergie(b, prenom)
        },
        evaluations: {
            encadrer: evalEncadrer,
            manager: evalManager
        },
        preconisations: {
            missions: genererMissionsRecommandees(b),
            points_attention: genererPointsAttention(b),
            synthese_positionnement: synthesePositionnement
        }
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// AUTHENTIFICATION
// ═══════════════════════════════════════════════════════════════════════════

function verifyToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Token manquant' });
    }
    try {
        const token = authHeader.split(' ')[1];
        req.referent = jwt.verify(token, JWT_SECRET);
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token invalide ou expiré' });
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES API
// ═══════════════════════════════════════════════════════════════════════════

app.post('/api/auth/login', async (req, res) => {
    try {
        const { prenom, nom, email, entreprise, password } = req.body;
        
        if (!email || !password) {
            return res.status(400).json({ error: 'Email et mot de passe requis' });
        }

        const records = await getRecords('VISITEUR', {
            filterByFormula: `{Email_referent} = '${email.replace(/'/g, "\\'")}'`
        });

        if (records.length === 0) {
            return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        const firstRecord = records[0].fields;
        const codeReferent1 = firstRecord.code_referent_candidat;
        const codeReferent2 = firstRecord.code_referent2_candidat;

        if (password !== codeReferent1 && password !== codeReferent2) {
        return res.status(401).json({ error: 'Identifiants incorrects' });
        }

        const token = jwt.sign({
            email: email,
            prenom: firstRecord.Prenom_referent || prenom || '',
            nom: firstRecord.Nom_referent || nom || '',
            entreprise: firstRecord.Entreprise_referent || entreprise || ''
        }, JWT_SECRET, { expiresIn: '24h' });

        console.log(`✅ Login réussi: ${email}`);

        res.json({
            token,
            referent: {
                prenom: firstRecord.Prenom_referent || prenom || '',
                nom: firstRecord.Nom_referent || nom || '',
                email: email,
                entreprise: firstRecord.Entreprise_referent || entreprise || ''
            },
            candidats_count: records.length
        });

    } catch (error) {
        console.error('❌ Erreur login:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/referent/candidats', verifyToken, async (req, res) => {
    try {
        const email = req.referent.email;

        const visiteurs = await getRecords('VISITEUR', {
            filterByFormula: `{Email_referent} = '${email.replace(/'/g, "\\'")}'`
        });

        const candidats = [];
        
        for (const v of visiteurs) {
            const sessionId = v.fields.candidate_ID;
            
            let bilan = null;
            const analyseTerminee = v.fields.statut_analyse_pivar === 'terminé' || 
                                    v.fields.statut_analyse_pivar === 'termine' ||
                                    v.fields.statut_analyse_pivar === 'Terminé';
            if (analyseTerminee) {
                bilan = await getRecordByFormula('BILAN', `{session_ID} = '${sessionId}'`);
            }
            
            candidats.push({
                session_id: sessionId,
                prenom: v.fields.Prenom || '',
                nom: v.fields.Nom || '',
                email: v.fields.Email || '',
                entreprise: v.fields.Entreprise || '',
                statut_test: v.fields.statut_analyse_pivar || 'en_attente',
                bilan_disponible: analyseTerminee && bilan !== null,
                type_pivar: bilan ? bilan.fields.type_pivar : null,
                niveau: bilan ? (parseInt(bilan.fields.niveau_pivar) || parseInt(bilan.fields.niveau_moyen_global) || null) : null,
                zone: bilan ? bilan.fields.zone_pivar : null
            });
        }

        console.log(`✅ ${candidats.length} candidats récupérés pour ${email}`);
        res.json(candidats);

    } catch (error) {
        console.error('❌ Erreur candidats:', error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/grille/:session_id', verifyToken, async (req, res) => {
    try {
        const { session_id } = req.params;
        const email = req.referent.email;

        console.log(`📊 Chargement grille v5.1: ${session_id}`);

        const visiteur = await getRecordByFormula('VISITEUR', 
            `AND({candidate_ID} = '${session_id}', {Email_referent} = '${email.replace(/'/g, "\\\\'")}')`
        );
        if (!visiteur) {
            return res.status(403).json({ error: 'Accès non autorisé à ce candidat' });
        }

        const bilan = await getRecordByFormula('BILAN', `{session_ID} = '${session_id}'`);
        if (!bilan) {
            return res.status(404).json({ error: 'Bilan non trouvé pour ce candidat' });
        }

        // Construire la grille de base (fonction existante inchangée)
        const grilleBase = generateGrilleFromBilan(bilan, visiteur);

        // ENRICHIR avec RESPONSES + textes 3p + argumentaires (v5.1)
        const grilleComplete = await grilleDrh.enrichGrille(bilan, visiteur, grilleBase);

        // Cache
        const currentHash = generateBilanHash(bilan.fields);
        await saveGrilleToCache(session_id, grilleComplete, currentHash, visiteur.id);

        try {
            await updateRecord('VISITEUR', visiteur.id, {
                bilan_referent_disponible: 'oui'
            });
        } catch (updateError) {
            console.error(`   ⚠️ Erreur mise à jour VISITEUR:`, updateError.message);
        }

        console.log(`✅ Grille v5.1 enrichie pour ${grilleComplete.candidat.prenom} (${session_id})`);
        res.json(grilleComplete);

    } catch (error) {
        console.error('❌ Erreur grille:', error);
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/grille/:session_id/reset', verifyToken, async (req, res) => {
    try {
        await grilleDrh.resetBackup(req.params.session_id);
        res.json({ success: true, message: 'Backup grille réinitialisé' });
    } catch (error) {
        console.error('❌ Erreur reset grille:', error.message);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// ROUTES UTILITAIRES
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════

app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), version: '5.1.0' });
});

app.get('/api-info', (req, res) => {
    res.json({ 
        service: 'PROFIL COGNITIF - Grille DRH Référent API',
        version: '5.1.0',
        status: 'running',
        features: ['Static file serving', 'Cache GRILLE_DRH_CACHE', 'Branding PROFIL COGNITIF', 'Agent IA 3p', 'Backup 16 champs'],
        endpoints: ['GET /', 'POST /api/auth/login', 'GET /api/referent/candidats', 'GET /api/grille/:session_id']
    });
});

// ═══════════════════════════════════════════════════════════════════════════
// GRILLE RÉFÉRENT (nouvelle génération) — affichage lecture seule
// GET /visualiser/grille_rdh/:candidat_id
// Lit GRILLE_REFERENT.grille_json + le nom dans VISITEUR, remplit le gabarit
// validé. Les quatre fichiers de grille-referent-rendu/ restent ensemble.
// ═══════════════════════════════════════════════════════════════════════════
app.use(require('./grille-referent-rendu/route_visualiser_grille'));

// Route par défaut → index.html (DOIT être après les autres routes)
app.get('*', (req, res) => {
    const token = req.query.token;
    
    if (token) {
        const payload = verifySecureToken(token);
        if (payload && payload.code) {
            console.log('[Grille] Accès autorisé via token pour:', payload.email);
            return res.redirect(`/?code=${encodeURIComponent(payload.code)}`);
        } else {
            return res.status(403).send(`
                <html><body style="font-family:sans-serif;text-align:center;padding:50px;background:#f5f5f5;">
                <div style="background:white;padding:40px;border-radius:10px;max-width:400px;margin:0 auto;">
                <h1 style="color:#e74c3c;">🔒 Lien expiré</h1>
                <p>Ce lien n'est plus valide ou a expiré.</p>
                <a href="https://profil-cognitif.fr/matching-tool/referent.html" style="display:inline-block;background:#667eea;color:white;padding:12px 24px;border-radius:6px;text-decoration:none;margin-top:20px;">Retour à mon espace</a>
                </div></body></html>
            `);
        }
    }
    
    res.sendFile(path.join(__dirname, 'index.html'));
});

// ═══════════════════════════════════════════════════════════════════════════
// DÉMARRAGE
// ═══════════════════════════════════════════════════════════════════════════

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log(`  🚀 PROFIL COGNITIF Grille DRH API v3.4.0`);
    console.log(`  📡 Port: ${PORT}`);
    console.log(`  📊 Base Airtable: ${AIRTABLE_BASE_ID ? 'Configurée' : '⚠️ Non configurée'}`);
    console.log(`  📦 Cache: GRILLE_DRH_CACHE activé`);
    console.log(`  🌐 Static files: index.html`);
    console.log('═══════════════════════════════════════════════════════════════');
});
