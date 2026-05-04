ARCHITECTURE_PROFIL_COGNITIF_v1_1_COURANT.md
30.33 Ko •600 lignes
•
Le formatage peut être différent de la source

# ARCHITECTURE PROFIL-COGNITIF

**Document maître de référence pour tous les agents IA travaillant sur ce projet.**

**Version** : 1.1 (29 avril 2026)
**Statut** : ARCHITECTURE v10.2 cible (Phase D-correction — clarifications doctrinales du 29/04)

---

## 📋 JOURNAL DE VERSION DU DOCUMENT

### v1.1 — 29 avril 2026 (clarifications doctrinales + préparation v10.2)

Modifications par rapport à v1.0 :
- Précision : **5 agents T1 distincts** (et non 4) — ANIMAL_1 et ANIMAL_2 sont 2 appels Claude indépendants
- Reformulation des **4 modes du vérificateur** selon doctrine simplifiée Isabelle 29/04 (Mode 3 sans appel humain, Mode 4 = erreur technique pure)
- Ajout des **10 nouveaux statuts** de relance T1 par scénario (Famille A `_SEUL` et Famille B `_DES_<SCENARIO>`)
- Ajout des **4 nouveaux champs Airtable** créés en préparation v10.2 (`nb_corrections_verificateur`, `scenario_relance_demande`, `compteur_relance_scenario`, `tour_verificateur`)
- Inscription des **Décisions n°35-42** + **Section 22 mutuelle** (à intégrer formellement au contrat v1.8)
- Mention explicite de la **règle "le fond prime sur la technique"** (Décision n°35)

### v1.0 — 28 avril 2026 (architecture cible v10 initiale)
Document initial, refonte complète Étape 1, Phase D.

---

## ⛔ NOTE OBLIGATOIRE POUR TOUT AGENT IA QUI INTERVIENT SUR CE PROJET

**Avant toute modification de code**, vous DEVEZ :

1. **Lire ce document en intégralité** — il contient l'architecture cible et les règles non-négociables
2. **Lire `CONTRAT_ETAPE1.md`** dans `/docs/` — c'est la bible doctrinale (1749 lignes, 34 décisions de référence)
3. **Identifier l'impact en cascade** de votre modification via le tableau Section 21 du contrat
4. **Demander à Isabelle Chenais** (gardienne doctrinale unique) la confirmation avant toute action structurelle
5. **Mettre à jour ce document** si votre modification change l'architecture
6. **Mettre à jour le `JOURNAL_PHASE_D.md`** avec ce que vous avez fait/pas fait

---

## 1. PROJET — VUE GLOBALE

**Profil-Cognitif** est une plateforme propriétaire d'évaluation cognitive (15+ ans de doctrine v36). Elle attribue 1 type cognitif sur 9 à un candidat via une analyse de protocole laboratoire conduite par des agents Claude API.

**Stack** :
- Backend : Node.js (Render Starter)
- Base de données : Airtable (`appgghhXjYBdFRras`)
- LLM : Claude Sonnet 4.6 (Anthropic API)
- Emails : Resend (T0, +24h, +48h, +72h, livraison)
- Frontend candidat : externe (saisit les 25 réponses)

**URL Render** : `https://pivar-analysis-system-bis.onrender.com`

**Trois candidats validés** :
- **Cécile** : ADAPTATEUR 5 · OPÉRATIONNEL · Type F
- **Rémi** : ORCHESTRATEUR 7 · STRATÉGIQUE · Type A
- **Véronique** : DÉTECTEUR 6 · OPÉRATIONNEL · Type F

---

## 2. RÈGLES DOCTRINALES NON-NÉGOCIABLES

### 2.1 Doctrine PIVAR (gravée 28/04/2026 14:00)

- Le terme **"PIVAR"** reste en INTERNE uniquement (URL Render, nom package npm, repo GitHub, logs serveur)
- **JAMAIS** dans la communication externe (emails candidats, bilan, marketing, frontend)
- Tout ce qui est exposé candidat dit **"Profil-Cognitif"**

### 2.2 Règle linguistique anonymisation (gravée 28/04/2026 14:05)

| Contexte | Adressage |
|---|---|
| Agents (T1/T2/T3/T4) + données techniques | **JAMAIS de prénom** — utiliser `candidat_id` ou identifiant anonyme |
| Bilan adressé au DRH uniquement | **"candidat" / "candidate"** (selon civilité) |
| Bilan adressé au candidat uniquement | **"vous"** (vouvoiement) |
| Bilan lu par les DEUX (DRH + candidat) | **"candidat" / "candidate"** (forme neutre respectueuse) |

### 2.3 Termes interdits absolus

- ❌ **"PIVAR"** dans toute communication externe
- ❌ **"cylindre"** (terme abandonné, remplacé par "pilier")
- ❌ **"cylindre 4/5"** (terme obsolète)
- ❌ **"pilier nécessaire au moteur"** (formulation abandonnée)
- ❌ **"ETAPE1_T4_MOTEUR"** (scission abandonnée)

### 2.4 Architecture multi-étapes (Décision n°26)

- L'architecture est **extensible** : Étape 1 (active) + Étape 2 (futur) + Étape 3 (futur)
- Chaque étape a son **propre orchestrateur** (`orchestratorEtape1.js`, `orchestratorEtape2.js`, ...)
- Un **orchestrateur principal** (`orchestratorPrincipal.js`) aiguille les candidats selon leur statut
- Une nouvelle étape **ne touche jamais** aux étapes existantes

### 2.5 Détection automatique des vérificateurs (Décision n°32)

Pour chaque agent T1/T2/T3/T4, le sous-orchestrateur d'étape vérifie si un fichier prompt vérificateur existe :
- Si `new-prompts/etape{N}/verificateur1_t{X}.txt` existe → exécuter le vérificateur correspondant
- Sinon → passer directement à l'agent suivant

C'est une **convention par fichier**, pas par configuration. Aucun changement de code requis pour ajouter un vérificateur.

---

## 3. STRUCTURE DES DOSSIERS GitHub (CIBLE v10)

```
profil-cognitif/                       (racine du repo)
│
├── server.js                           ← point d'entrée Render (HTTP + démarrage polling)
├── package.json                        ← v10.0.0 + resend
├── env.example                         ← modèle des variables d'environnement
├── README.md                           ← documentation projet
├── .gitignore
│
├── docs/
│   ├── CONTRAT_ETAPE1.md               ← bible doctrinale Étape 1 (v1.7+)
│   ├── ARCHITECTURE_PROFIL_COGNITIF.md ← CE DOCUMENT
│   ├── REFERENTIEL_LEXIQUE_BILAN.md    ← doctrine du lexique des 15 termes
│   └── ORCHESTRATEUR_CORRIGE.md        ← documentation T4 (6 sous-agents)
│
├── config/
│   ├── claude.js                       ← config API Claude (modèle, max_tokens, thinking)
│   └── airtable.js                     ← config Airtable (BASE_ID, TABLES, FIELDS)
│
├── routes/
│   └── index.js                        ← endpoints HTTP Express
│
├── services/
│   │
│   ├── orchestrators/                  ← orchestrateurs (chef + sous-chefs)
│   │   ├── orchestratorPrincipal.js   ← chef de cuisine (aiguillage par statut)
│   │   ├── orchestratorEtape1.js      ← sous-chef Étape 1 (T1 → vérif → T2 → T3 → T4 → certif)
│   │   ├── orchestratorEtape2.js      ← futur
│   │   └── orchestratorEtape3.js      ← futur
│   │
│   ├── flux/                           ← gestion débit + sécurité
│   │   ├── queueService.js            ← FIFO + polling Airtable (60s)
│   │   ├── healthcheckService.js      ← vérifie Airtable + Claude API + Resend (anti-spam)
│   │   ├── validationHumaineService.js ← Mode 3 du vérificateur (Resend → superviseur)
│   │   └── notificationCandidatService.js ← emails T0/24h/48h/72h/livraison au candidat
│   │
│   ├── infrastructure/                 ← outils communs partagés entre étapes
│   │   ├── claudeService.js           ← wrapper API Claude (thinking, streaming, retry)
│   │   ├── airtableService.js         ← wrapper Airtable (read/write/upsert/patch)
│   │   ├── backupService.js           ← snapshots de progression
│   │   └── agentBase.js               ← chargement prompts mutualisé pour tous les agents
│   │
│   ├── etape1/                         ← agents et vérificateurs Étape 1
│   │   ├── agentT1Service.js
│   │   ├── agentT1VerificateurService.js
│   │   ├── agentT2Service.js
│   │   ├── agentT2VerificateurService.js   ← futur, si nécessaire
│   │   ├── agentT3Service.js
│   │   ├── agentT3VerificateurService.js   ← futur, si nécessaire
│   │   └── etape1_t4/                       ← T4 = 6 sous-agents (cas spécial)
│   │       ├── agentT4ArchitectureService.js
│   │       ├── agentT4CircuitsService.js
│   │       ├── agentT4ModeService.js
│   │       ├── agentT4SyntheseService.js
│   │       ├── agentT4CoutsService.js
│   │       ├── agentT4TransversesService.js
│   │       └── prepareT4Inputs.js
│   │
│   ├── etape2/                         ← futur
│   ├── etape3/                         ← futur
│   │
│   └── certificateurs/
│       └── certificateurLexiqueService.js  ← certificateur de bilan global (lexique)
│
├── new-prompts/                        ← texte des prompts Claude
│   │
│   ├── etape1/
│   │   ├── etape1_t1.txt
│   │   ├── verificateur1_t1.txt
│   │   ├── etape1_t2.txt
│   │   ├── verificateur1_t2.txt        ← futur, si nécessaire
│   │   ├── etape1_t3.txt
│   │   ├── verificateur1_t3.txt        ← futur, si nécessaire
│   │   └── etape1_t4/
│   │       ├── AGENT_1_ARCHITECTURE.md
│   │       ├── AGENT_2_CIRCUITS.md
│   │       ├── AGENT_3_MODE.md
│   │       ├── AGENT_4_SYNTHESE_COEUR.md
│   │       ├── AGENT_5_COUTS_CLOTURE.md
│   │       ├── AGENT_6_TRANSVERSES.md
│   │       └── verificateur1_t4.md     ← futur, si nécessaire
│   │
│   ├── etape2/                         ← futur
│   ├── etape3/                         ← futur
│   │
│   └── partages/                        ← prompts partagés entre étapes
│       ├── PROMPT_BLOCS_LEXIQUE.md
│       └── PROMPT_CERTIFICATEUR.md
│
├── templates/                          ← templates de bilan HTML/markdown
│   ├── etape1/
│   │   └── etape1_t4/
│   │       ├── LOT_A_TEMPLATES_SYNTHESE.md
│   │       ├── LOT_B_TEMPLATES_COUTS.md
│   │       ├── LOT_C_TEMPLATES_ARCHITECTURE.md
│   │       ├── LOT_D_TEMPLATE_MODES.md
│   │       └── LOT_E_TEMPLATES_TRANSVERSES.md
│   ├── etape2/                         ← futur
│   └── etape3/                         ← futur
│
└── utils/
    ├── logger.js                        ← logger structuré
    └── errorClassifier.js               ← classification des erreurs Claude/Airtable
```

---

## 4. CONVENTIONS DE NOMMAGE

| Élément | Convention | Exemple |
|---|---|---|
| Prompt agent | `etape{N}_t{X}.txt` | `etape1_t1.txt` |
| Prompt vérificateur | `verificateur{niveau}_t{X}.txt` | `verificateur1_t1.txt` |
| Service agent Node.js | `agentT{X}Service.js` | `agentT1Service.js` |
| Service vérificateur Node.js | `agentT{X}VerificateurService.js` | `agentT1VerificateurService.js` |
| Sous-orchestrateur | `orchestratorEtape{N}.js` | `orchestratorEtape1.js` |
| Dossier d'étape | `etape{N}/` | `etape1/` |
| Dossier T4 (cas spécial) | `etape{N}_t4/` | `etape1_t4/` |

---

## 5. PIPELINE D'EXÉCUTION ÉTAPE 1

```
Frontend candidat ──webhook──> Airtable (statut=NOUVEAU)
                                     │
                                     ▼
Render polling (60s) ──> queueService ──> orchestratorPrincipal.processCandidate()
                                                        │
                                                        ▼
                                          healthcheckService (vérif Airtable+Claude+Resend)
                                                        │
                                                        ▼ (si OK)
                                          orchestratorEtape1.run()
                                                        │
                                                        ▼
            ┌───────────────────────────────────────────┴──────────────────────────────────┐
            │ T1 (5 appels par scénario)                                                    │
            │  ↓                                                                            │
            │ vérificateur T1 (si fichier prompt existe — Décision n°32)                    │
            │  ↓ (4 modes : 1 Conforme / 2 Corrections / 3 Validation humaine / 4 Retry)    │
            │ T2                                                                            │
            │  ↓                                                                            │
            │ (vérificateur T2 si fichier existe)                                           │
            │  ↓                                                                            │
            │ T3                                                                            │
            │  ↓                                                                            │
            │ (vérificateur T3 si fichier existe)                                           │
            │  ↓                                                                            │
            │ T4 = 4 agents en parallèle (Architecture, Circuits, Mode, Transverses)        │
            │  ↓                                                                            │
            │ T4-Synthèse (séquentiel)                                                      │
            │  ↓                                                                            │
            │ T4-Coûts (séquentiel)                                                         │
            │  ↓                                                                            │
            │ certificateur lexique                                                         │
            └───────────────────────────────────────────────────────────────────────────────┘
                                                        │
                                                        ▼
                                  statut_analyse_pivar = 'terminé'
                                  notificationCandidatService → email livraison
```

### 5.1 Modes opérationnels du vérificateur (Décisions n°15, n°16, n°24, n°38, n°39, n°41)

⚠️ **DOCTRINE SIMPLIFIÉE 29/04/2026** : Mode 3 ne fait plus appel humain. Seul Mode 4 peut nécessiter une validation humaine, et seulement après 2 tentatives techniques infructueuses.

#### Critère de fiabilité d'un agent T1 (Décision n°41)

Un agent T1 (= un appel Claude pour un scénario) est jugé **fiable** s'il commet ≤ 2 erreurs de pilier_coeur sur ses 5 analyses. Au-delà (≥ 3 erreurs sur les 5), l'agent est jugé **non fiable** sur ce scénario et doit être relancé (Mode 2).

#### Tableau des 4 modes

| Mode | Déclencheur | Action |
|---|---|---|
| **1 — Corrections doctrinales appliquées** | ≤ 2 erreurs par agent (max ~10 sur 25 si tous à leur seuil) | Le vérificateur **applique les corrections directement dans ETAPE1_T1** (champ par champ + `corrections_verificateur` rempli avec l'explication doctrinale). Pipeline continue. |
| **2 — Relance d'un agent défaillant** | ≥ 3 erreurs de pilier_coeur sur les 5 analyses d'**un seul agent** | Le vérificateur **n'applique PAS les corrections** sur l'agent défaillant. Pour les autres agents (≤2 erreurs) : applique simultanément Mode 1. L'orchestrateur supprime les 5 lignes du scénario défaillant et relance T1 uniquement sur ce scénario. Le vérificateur refait son analyse uniquement sur les 5 nouvelles lignes. |
| **3 — Vérificateur impose sa lecture** | Échec Mode 2 : la 2ème analyse trouve à nouveau ≥ 3 erreurs sur le scénario relancé | Le vérificateur **applique ses propres analyses** (celles qu'il avait proposées au tour 2). Marque dans `corrections_verificateur` : *"⚠️ Analyses posées par le vérificateur en 2ème passage (Mode 3)"*. Pipeline continue. **Pas d'arrêt, pas d'email.** |
| **4 — Erreur technique** | Référentiel cassé / JSON Claude tronqué / panne API / structure cassée | 1ère détection → relance complète automatique (T1 entier). 2ème détection → statut `ERREUR` + email superviseur + arrêt définitif. |

#### Conséquence doctrinale

**Le vérificateur est producteur de vérité (Décision n°38)** : ses corrections sont systématiquement appliquées dans ETAPE1_T1 (Mode 1 et Mode 3), car cette table est lue par tous les agents aval (T2, T3, T4) et doit contenir la vérité corrigée.

#### Statuts associés (Décision n°42)

L'orchestrateur déclenche automatiquement les statuts suivants selon le mode :

| Mode | Action statut | Statut résultant |
|---|---|---|
| Mode 1 | Continue pipeline | `terminé` (en absence d'agents aval) |
| Mode 2 | Relance scénario défaillant | `REPRENDRE_T1_<SCENARIO>_SEUL` (auto), puis `REPRENDRE_VERIFICATEUR1` après relance |
| Mode 3 | Applique sa lecture, continue | `terminé` |
| Mode 4 (1ère fois) | Relance T1 complet | `REPRENDRE_AGENT1` (= synonyme de `REPRENDRE_T1_DES_SOMMEIL`) |
| Mode 4 (2ème fois) | Stop pipeline | `ERREUR` + email superviseur |

---

### 5.1 bis — Statuts de relance manuelle T1 par scénario (Décision n°42)

Isabelle peut piloter manuellement la relance de T1 par scénario via 10 nouveaux statuts.

#### Famille A — Relances ISOLÉES (un seul scénario)

*Cas d'usage : "Le scénario X a mal travaillé, je relance uniquement celui-ci, les autres sont bons."*

| Statut | Action |
|---|---|
| `REPRENDRE_T1_SOMMEIL_SEUL` | Relance UNIQUEMENT SOMMEIL (5 lignes), garde les 20 autres intactes |
| `REPRENDRE_T1_WEEKEND_SEUL` | Relance UNIQUEMENT WEEKEND (5 lignes) |
| `REPRENDRE_T1_ANIMAL1_SEUL` | Relance UNIQUEMENT ANIMAL_1 (5 lignes) |
| `REPRENDRE_T1_ANIMAL2_SEUL` | Relance UNIQUEMENT ANIMAL_2 (5 lignes) |
| `REPRENDRE_T1_PANNE_SEUL` | Relance UNIQUEMENT PANNE (5 lignes) |

→ Mécanisme partagé avec le **Mode 2 automatique** du vérificateur.

#### Famille B — Relances en CASCADE à partir d'un scénario

*Cas d'usage : "Je veux reprendre depuis un point dans la séquence, et tout ce qui suit doit aussi être refait."*

L'ordre d'exécution T1 est : SOMMEIL → WEEKEND → ANIMAL_1 → ANIMAL_2 → PANNE.

| Statut | Action |
|---|---|
| `REPRENDRE_T1_DES_SOMMEIL` | Relance les 5 scénarios (= T1 complet, équivalent `REPRENDRE_AGENT1`) |
| `REPRENDRE_T1_DES_WEEKEND` | Relance WEEKEND + ANIMAL_1 + ANIMAL_2 + PANNE (garde SOMMEIL) |
| `REPRENDRE_T1_DES_ANIMAL1` | Relance ANIMAL_1 + ANIMAL_2 + PANNE |
| `REPRENDRE_T1_DES_ANIMAL2` | Relance ANIMAL_2 + PANNE |
| `REPRENDRE_T1_DES_PANNE` | Relance PANNE seul |

#### Sort de `REPRENDRE_AGENT1`

Conservé comme **synonyme historique** de `REPRENDRE_T1_DES_SOMMEIL`. Reste utilisé par le Mode 4 du vérificateur pour la relance auto. Les nouveaux statuts précis (Famille A et B) sont pour les interventions manuelles d'Isabelle.

---

### 5.2 Communication candidat asynchrone (Décision n°33)

| Moment | Trigger | Action |
|---|---|---|
| **T0** | `statut_test = 'terminé'` | Email confirmation réception + annonce délai 72h |
| **T0+24h** | Cron horaire | Si bilan prêt → email livraison. Sinon → rien. |
| **T0+48h** | Cron horaire | Si bilan prêt → email livraison. Sinon → email "élaboration approfondie" |
| **T0+72h** | Cron horaire | Si bilan prêt → email livraison. Sinon → alerte superviseur |

---

## 6. ÉTAT À DATE (28/04/2026)

### 6.1 Phase D — Audit terminé ✅

15 fichiers audités, 82 modifications identifiées, 7 nouvelles fonctions Airtable, 3 décisions doctrinales gravées (D-A pilier_sortie abandonné, D-B statut_analyse_pivar gardé, D-C endpoint legacy gardé). Voir `RECAP_MODIFICATIONS_PHASE_D.md`.

### 6.2 Phase D — Génération en cours 🟡

**FAIT** :
- ✅ 3 actions Airtable via MCP (renommage corrections_verificateur + 6 champs emails + 2 backups vérificateur)
- ⏳ 1 action manuelle pour Isabelle : retirer `pilier_sortie` de ETAPE1_T1 dans Airtable (API MCP ne permet pas la suppression)

**À FAIRE** dans cet ordre :
1. `package.json` (v10.0.0 + resend)
2. `config/claude.js`
3. `config/airtable.js`
4. `services/infrastructure/` × 4 fichiers
5. `services/etape1/` × 2 fichiers
6. `services/orchestrators/` × 2 fichiers
7. `services/flux/` × 4 fichiers (1 modif + 3 nouveaux squelettes)
8. `routes/index.js`
9. `server.js`

### 6.3 Phase F — Déploiement Render Cécile ⏳

Test sur Cécile pour T1 + Vérificateur T1 (Étape 1 partielle).

### 6.4 Phase G — Chantier HTML ⏳

Génération HTML dynamique des bilans, à lancer pendant que Cécile tourne sur Render.

---

## 7. DÉPENDANCES NPM

| Package | Version | Rôle |
|---|---|---|
| express | ^4.18.2 | Serveur HTTP |
| airtable | ^0.12.2 | SDK Airtable |
| axios | ^1.6.2 | HTTP vers Claude API |
| dotenv | ^16.3.1 | Variables d'env |
| cors | ^2.8.5 | CORS HTTP |
| body-parser | ^1.20.2 | Parsing JSON |
| **resend** | **^3.2.0** | **NOUVEAU v10 — emails** |

---

## 8. VARIABLES D'ENVIRONNEMENT RENDER

| Variable | Rôle | Statut |
|---|---|---|
| `CLAUDE_API_KEY` | Anthropic API | Configurée |
| `AIRTABLE_TOKEN` | Airtable PAT | Configurée |
| `AIRTABLE_BASE_ID` | Base Airtable | Configurée (`appgghhXjYBdFRras`) |
| `RESEND_API_KEY` | Resend (emails) | **Configurée** |
| `SUPERVISOR_EMAIL` | Email superviseur (Isabelle) | **Configurée** (`sibprod@live.fr`) |
| `CLAUDE_MODEL` | (optionnel) | `claude-sonnet-4-6` par défaut |
| `MAX_RETRIES` | (optionnel) | 3 par défaut |
| `ENABLE_POLLING` | (optionnel) | `true` par défaut |

---

## 9. SCHÉMA AIRTABLE (base appgghhXjYBdFRras)

### 9.1 Tables principales

| Table | ID | Description |
|---|---|---|
| **VISITEUR** | `tblslPP9B71FveOX5` | Suivi candidat (~120 champs) |
| **questions_pivar_scenario** | `tblplgCMOqQYBd40o` | 25 questions du protocole |
| **RESPONSES** | `tblLnWhszYAQldZOJ` | 25 réponses par candidat (frontend) |
| **REFERENTIEL_PILIERS** | `tblf4OodQ2Qi5xSXs` | 5 piliers cognitifs (référentiel stable) |
| **REFERENTIEL_PROFILS** | `tblLTxeKoRa9m8io7` | 35 profils (référentiel stable) |
| **REFERENTIEL_CIRCUITS** | `tbllMoTjOsILuzR6m` | 75 circuits (référentiel stable) |
| **REFERENTIEL_LEXIQUE** | `tblMsX5DMSNcUnwQK` | 15 termes lexique bilan |
| **ETAPE1_T1** | `tblPzRzaehA7BPkLr` | Analyse brute des 25 réponses (24 champs) |
| **VERIFICATEUR_T1** | `tbl3Slcbv2RdvhXlz` | Audit du vérificateur T1 (11 champs) |
| **ETAPE1_T2** | `tblyERG7VpaRul1zZ` | Synthèse par question (15 champs) |
| **ETAPE1_T3** | `tblaGd3ixAWxbJJp2` | Analyse pilier × circuit (15 champs) |
| **ETAPE1_T4_BILAN** | `tblfWEAllu6Rf9ltD` | Bilan final (66 champs) |

### 9.2 Statuts pivar (champ `statut_analyse_pivar`) — version v10.2

⚠️ **MISE À JOUR 29/04/2026** : 10 nouveaux statuts ajoutés pour relance T1 par scénario (Décision n°42).

#### Statuts du pipeline normal

| Statut | Sens | Trigger |
|---|---|---|
| `NOUVEAU` | Reset complet | Frontend — webhook |
| `en_cours` | Pipeline en cours | Orchestrateur |
| `EN_ATTENTE_VALIDATION_HUMAINE` | Mode 4 du vérificateur (2ème tentative) | Vérificateur T1 |
| `terminé` | Pipeline OK | Orchestrateur (succès) |
| `ERREUR` | Pipeline échec | Orchestrateur (catch) |

#### Statuts de reprise génériques (héritage v10)

| Statut | Sens | Trigger |
|---|---|---|
| `REPRENDRE_AGENT1` | Synonyme de `REPRENDRE_T1_DES_SOMMEIL` (relance T1 complet) | Mode 4 ou Isabelle |
| `REPRENDRE_VERIFICATEUR1` | Saute T1, lit ETAPE1_T1 existant, lance vérificateur | Isabelle |
| `REPRENDRE_AGENT2` | Relance T2 | Vérificateur T2 (futur) |
| `REPRENDRE_AGENT3` | Relance T3 | Vérificateur T3 (futur) |
| `REPRENDRE_AGENT4` | Relance T4 | Vérificateur T4 (futur) |
| `REPRENDRE_VERIFICATEUR4` | Saute T4, lance vérificateur T4 | Isabelle (futur) |

#### Statuts de relance T1 par scénario — Famille A (ISOLÉE)

*Cas d'usage : un seul scénario à refaire, garder les autres intacts.*

| Statut | Sens |
|---|---|
| `REPRENDRE_T1_SOMMEIL_SEUL` | Relance UNIQUEMENT SOMMEIL |
| `REPRENDRE_T1_WEEKEND_SEUL` | Relance UNIQUEMENT WEEKEND |
| `REPRENDRE_T1_ANIMAL1_SEUL` | Relance UNIQUEMENT ANIMAL_1 |
| `REPRENDRE_T1_ANIMAL2_SEUL` | Relance UNIQUEMENT ANIMAL_2 |
| `REPRENDRE_T1_PANNE_SEUL` | Relance UNIQUEMENT PANNE |

→ Trigger : Isabelle manuel **OU** Mode 2 auto du vérificateur

#### Statuts de relance T1 par scénario — Famille B (CASCADE)

*Cas d'usage : reprendre la séquence à partir d'un point, tout ce qui suit doit être refait.*

| Statut | Sens |
|---|---|
| `REPRENDRE_T1_DES_SOMMEIL` | Relance les 5 scénarios = T1 complet (= `REPRENDRE_AGENT1`) |
| `REPRENDRE_T1_DES_WEEKEND` | Relance WEEKEND + ANIMAL_1 + ANIMAL_2 + PANNE |
| `REPRENDRE_T1_DES_ANIMAL1` | Relance ANIMAL_1 + ANIMAL_2 + PANNE |
| `REPRENDRE_T1_DES_ANIMAL2` | Relance ANIMAL_2 + PANNE |
| `REPRENDRE_T1_DES_PANNE` | Relance PANNE seul |

→ Trigger : Isabelle manuel uniquement

### 9.3 Champs validation humaine (Décision n°16)

Dans VISITEUR :
- `validation_humaine_action` (singleSelect : `RELANCER_AGENT_T1` / `RELANCER_VERIFICATEUR_T1` / `ACCEPTER_TEL_QUEL` / `ABANDONNER`)
- `validation_humaine_motif` (multilineText)
- `validation_humaine_date` (dateTime)
- `validation_humaine_etape1` (formula concatène les 3 ci-dessus pour polling)
- `nombre_tentatives_etape1` (number, max 2 — Décision n°24)

### 9.4 Champs emails candidat (Décision n°33 — créés en Phase D)

Dans VISITEUR :
- `email_T0_envoye` (checkbox) — `fld9evp52UpAaGYj9`
- `email_24h_envoye` (checkbox) — `fldbjbXkK3tBbRsM3`
- `email_48h_envoye` (checkbox) — `fldeoGMc9juQrpwYI`
- `email_72h_envoye` (checkbox) — `fldvKt3BcNuS1LUPs`
- `email_livraison_envoye` (checkbox) — `fldYcfXYIhQ2H2pnr`
- `date_T0` (dateTime Europe/Paris) — `fldpjfBFjHKgjfo8c`

### 9.5 Champs backups vérificateur (Décision n°10 — créés en Phase D)

Dans VISITEUR :
- `backup_before_t1_verificateur` (multilineText) — `fldBddprGh8f223FN`
- `backup_after_t1_verificateur` (multilineText) — `fldJA6bFsWYTYXGkR`

### 9.6 Champs vérificateur enrichis v10.2 (créés le 29/04/2026)

⭐ **NOUVEAU 29/04/2026** — Préparation v10.2.

#### Dans ETAPE1_T1

| Champ | ID | Type | Sémantique |
|---|---|---|---|
| `nb_corrections_verificateur` | `fldO05FAoU638xzR5` | number (0) | 0 = ligne non touchée. 1 = corrigée tour 1 (Mode 1). 2 = corrigée tour 2 (Mode 3, vérificateur impose) |

#### Dans VERIFICATEUR_T1

| Champ | ID | Type | Sémantique |
|---|---|---|---|
| `scenario_relance_demande` | `fldfNqncWgum82usG` | singleSelect | Scénario identifié comme défaillant en Mode 2. Valeurs : SOMMEIL/WEEKEND/ANIMAL_1/ANIMAL_2/PANNE. Vide quand pas de relance |
| `compteur_relance_scenario` | `flddS5XJTEzdTRBsx` | number (0) | Compteur de relances Mode 2 par run. 0 = aucune. 1 = une relance. 2 = bascule Mode 3 (garde-fou anti-boucle infinie) |
| `tour_verificateur` | `flds78z6rdsfwTLs6` | number (0) | Numéro du tour. 1 = run normal. 2 = post-relance Mode 2 |

---

## 11. DÉCISIONS DOCTRINALES ACTÉES LE 29/04/2026

(À intégrer formellement au contrat v1.8 — actuellement consignées ici en référence)

### Décision n°35 — Primat du fond sur la technique
Quand il existe un écart entre le prompt doctrinal (le fond) et le code technique (la tuyauterie), c'est la tuyauterie qui s'aligne sur le prompt, jamais l'inverse.

### Décision n°36 — Audit d'impact obligatoire
Avant toute modification de fichier de code ou de configuration, un audit d'impact conforme Section 21 est obligatoire et tracé dans un document dédié.

### Décision n°37 — Contrat document vivant
Le contrat est mis à jour après chaque intervention significative. Une intervention non documentée dans le contrat est une intervention non terminée.

### Décision n°38 — Vérificateur producteur de vérité
Le vérificateur applique ses corrections directement dans ETAPE1_T1 en Mode 1 et Mode 3. ETAPE1_T1 est la table de référence lue par tous les agents aval (T2, T3, T4) et doit contenir la vérité corrigée.

### Décision n°39 — Mode 3 sans appel humain
Le Mode 3 ne fait plus appel humain. Le vérificateur impose sa lecture après échec Mode 2. Seul Mode 4 (erreur technique) peut nécessiter une validation humaine.

### Décision n°40 — 5 agents T1 distincts
ANIMAL_1 et ANIMAL_2 sont 2 appels Claude distincts. La machine compte 5 agents T1 : SOMMEIL, WEEKEND, ANIMAL_1, ANIMAL_2, PANNE.

### Décision n°41 — Critère de fiabilité d'un agent T1
Un agent T1 est jugé non fiable si ≥ 3 erreurs de pilier_coeur sur ses 5 analyses. Sous ce seuil (≤ 2 erreurs), il est fiable mais imparfait — ses erreurs sont corrigées ponctuellement (Mode 1).

### Décision n°42 — Deux familles de statuts de relance T1
Famille A (`_SEUL`) pour relance isolée. Famille B (`_DES_<SCENARIO>`) pour relance en cascade. `REPRENDRE_AGENT1` conservé comme synonyme historique de `REPRENDRE_T1_DES_SOMMEIL`.

### Section 22 mutuelle (Isabelle + Claude)
La règle "une intervention à la fois, validée avant la suivante" s'applique à Isabelle ET à Claude. Pas de glissement de sujet. Les nouvelles demandes sont notées en chantier et traitées après stabilisation.

---

## 10. POSTURE DE TRAVAIL POUR LES AGENTS IA

### 10.1 Isabelle est l'autorité doctrinale unique

Elle a :
- Le contrat v1.7 (avec le tableau d'impact Section 21)
- L'autorité doctrinale absolue
- Le réflexe de demander : *"Tu modifies X, mais selon ma cartographie tu dois aussi vérifier Y et Z. Tu les as regardés ?"*

### 10.2 Règles strictes pour tout agent IA intervenant

**Règle 1** : Toujours afficher le tableau d'impact AVANT de modifier

**Règle 2** : Lecture complète du fichier AVANT toute proposition de refonte

**Règle 3** : Pas de modification d'un agent sans relire son orchestrateur

**Règle 4** : Pas de modification de `agentBase.js` sans avis explicite d'Isabelle (TRÈS critique)

**Règle 5** : Pas de modification de `config/*.js` sans tester tous les agents impactés

**Règle 6** : Toujours simuler sur Cécile/Rémi/Véronique AVANT de déclarer "prêt à déployer"

### 10.3 Drapeaux rouges (forbidden patterns)

- ❌ Inventer du contenu cognitif (seul Isabelle est dépositaire de la doctrine)
- ❌ Multiplier les options (méthodologie simple, 1 décision = 1 chemin)
- ❌ Réécrire en aveugle un fichier sans le lire
- ❌ Donner des leçons à Isabelle sur sa propre méthodologie (15+ ans de travail)
- ❌ Utiliser le terme "PIVAR" dans la communication externe
- ❌ Passer le prénom du candidat à un agent Claude

---

**FIN DU DOCUMENT MAÎTRE**

*Document à mettre à jour au fil des phases. Toute évolution structurelle doit être tracée ici.*
