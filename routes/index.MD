# 📋 PROJET PROFIL-COGNITIF — STRUCTURE OFFICIELLE

**Propriétaire** : Sib Prod (Isabelle Chenais)
**CTO technique** : Claude (Anthropic)
**Date d'organisation** : 29/04/2026 fin de soirée
**Source** : consolidation de tous les fichiers éclatés en une structure unique

---

## 🎯 PRINCIPE D'ORGANISATION

Cette structure suit la doctrine d'Isabelle :
- **UN dossier par type de document** (contrat, architecture, doctrine, code, chantiers, journaux, prompts)
- **UNE version courante par type** (jamais de doublons)
- **Versions historiques en `archives/`** (traçabilité)
- **Chaque journée préservée** comme une avancée construite (Section 22 mutuelle)

---

## 📂 ARBORESCENCE OFFICIELLE

```
PROJET_PROFIL_COGNITIF/
│
├── 00_INDEX.md                                       ← VOUS ÊTES ICI
│
├── 01_CONTRAT/                                       ← LE CONTRAT (doctrine officielle)
│   ├── CONTRAT_ETAPE1_v1_8_COURANT.md                ⭐ Version courante (29/04/2026 - 2000 lignes)
│   └── archives/                                      ← Versions historiques
│       ├── CONTRAT_ETAPE1_v1.md
│       ├── CONTRAT_ETAPE1_v1.1.md
│       ├── CONTRAT_ETAPE1_v1.2.md
│       ├── CONTRAT_ETAPE1_v1.3.md
│       ├── CONTRAT_ETAPE1_v1.4.md
│       ├── CONTRAT_ETAPE1_v1.5.md
│       ├── CONTRAT_ETAPE1_v1.6.md
│       ├── CONTRAT_ETAPE1_v1.7.md
│       └── PATCH_v1_7_VERS_v1_8_APPLIQUE.md           (patch appliqué le 29/04 fin de soirée)
│
├── 02_ARCHITECTURE/                                  ← TUYAUTERIE TECHNIQUE
│   ├── ARCHITECTURE_PROFIL_COGNITIF_v1_1_COURANT.md  ⭐ Version courante
│   ├── PATCH_v1_1_VERS_v1_2_A_APPLIQUER.md          📝 Patch à appliquer demain
│   └── ARCHITECTURE_v1_0_ORIGINELLE.md               ← Version originelle
│
├── 03_DOCTRINE/                                      ← DÉCISIONS DOCTRINALES
│   └── DECISIONS_29_04_2026.md                       ⭐ 8 décisions n°35-42 + Section 22
│
├── 04_CODE_PRODUCTION/                               ← CODE DÉPLOYÉ
│   └── v10_1_deploye/                                ← Code actuellement sur Render
│       ├── agentT1VerificateurService.js             (465 lignes)
│       ├── airtableService.js                       (818 lignes)
│       └── orchestratorEtape1.js                     (365 lignes)
│
├── 05_CHANTIERS/                                     ← TRAVAIL À VENIR
│   ├── ETAT_PROJET.md                                ⭐ État courant 22 sections
│   ├── SPEC_PHASE_v10_2b_c.md                        📝 Spec code à écrire demain
│   └── CHANTIER_RELANCE_T1_PAR_SCENARIO.md           (intégré à v10.2b)
│
├── 06_JOURNAUX/                                      ← TRACE HISTORIQUE PAR JOURNÉE
│   ├── 28_avril_2026/                                ← Journée de génération Phase D
│   │   ├── JOURNAL_28_04_PHASE_D.md
│   │   ├── CARTOGRAPHIE_PROJET_PHASE_D.md
│   │   ├── RECAP_MODIFICATIONS_PHASE_D.md
│   │   ├── CLOTURE_28_AVRIL.md
│   │   ├── NOTE_GENERATION_PHASE_D.md
│   │   └── SIMULATION_VERIFICATEUR_3_CANDIDATS.md
│   │
│   └── 29_avril_2026/                                ← Journée de correction v10.1 + doctrine
│       ├── JOURNAL_29_04_COMPLET.md                  ⭐ Journal de la journée
│       ├── DIAGNOSTIC_BUG_INITIAL.md                 (matin — 3 bugs identifiés)
│       ├── INTERVENTION_v10_1.md                     (correction v10.1)
│       ├── AUDIT_IMPACT_v10_1.md                     (audit Section 21)
│       ├── NOTES_CORRECTION_v10_1.md                 (notes techniques)
│       ├── CORRECTION_BUG_ORCHESTRATION.md           (4ème bug post-déploiement)
│       └── JOURNAL_PREPARATION_v10_2.md              (préparation Airtable v10.2)
│
└── 07_PROMPTS/                                       ← PROMPTS DES AGENTS
    ├── etape1_t1_PROMPT_AGENT_v3_1.txt               ⭐ Prompt T1 actuel (v3.1)
    └── verificateur1_t1_PROMPT_AGENT_v1_1.txt        ⭐ Prompt vérificateur actuel (v1.1)
```

---

## 📚 RÔLE DE CHAQUE DOSSIER

### 01_CONTRAT — Doctrine officielle
Le contrat est **la source de vérité unique** (Section 16). Il précise toutes les règles métier, doctrines, décisions.

- **Version courante** (`v1_7_COURANT`) : c'est le contrat actuellement en vigueur
- **Patch à appliquer** : modifications décidées le 29/04 mais pas encore intégrées (sera appliqué demain matin)
- **Archives** : toutes les versions précédentes pour traçabilité

⚠️ **Règle d'or (Décision n°37)** : *"Le contrat est un document vivant. Mise à jour systématique après chaque intervention."*

### 02_ARCHITECTURE — Tuyauterie technique
L'architecture décrit la structure des fichiers, les dépendances entre composants, les flux de données. Elle **oblige à vérifier les interdépendances** avant toute modification (Décision n°36).

- **Version courante** (`v1_1_COURANT`) : architecture actuelle
- **Patch à appliquer** : modifications v10.2 (5 agents T1 distincts, 10 statuts, etc.)
- **Originelle** (`v1_0_ORIGINELLE`) : référence historique

### 03_DOCTRINE — Décisions hors contrat
Quand des décisions doctrinales sont prises mais pas encore intégrées au contrat, elles vivent ici **temporairement**. Une fois le contrat à jour, elles peuvent être archivées.

- **DECISIONS_29_04_2026.md** : les 8 décisions n°35-42 + Section 22 mutuelle, avec citations Isabelle verbatim

### 04_CODE_PRODUCTION — Code déployé sur Render
**UNIQUEMENT** le code actuellement en production. Pas de versions intermédiaires, pas de brouillons.

- **v10_1_deploye/** : code actuel (3 fichiers — corrigé, déployé, validé sur Cécile)

### 05_CHANTIERS — Travail à venir
Liste exhaustive de ce qui reste à faire, par ordre de priorité.

- **ETAT_PROJET.md** : 22 sections — état complet du projet
- **SPEC_PHASE_v10_2b_c.md** : spécifications techniques pour le code à écrire (Phase v10.2b et v10.2c)
- **CHANTIER_RELANCE_T1_PAR_SCENARIO.md** : chantier identifié, intégré à v10.2b

### 06_JOURNAUX — Trace par journée
**Chaque journée est une avancée construite et sécurisée** (votre demande explicite).

- `28_avril_2026/` : journée de génération du code Phase D (création de l'architecture v10)
- `29_avril_2026/` : journée de correction v10.1 + 8 décisions doctrinales + préparation v10.2

→ Demain je créerai `30_avril_2026/`

### 07_PROMPTS — Prompts des agents IA
Les prompts qui pilotent chaque agent (T1, vérificateur). Une seule version courante par prompt.

---

## 🚦 ÉTAT DU PROJET — fin de journée 29/04/2026

### ✅ Ce qui est validé et déployé
- **Code v10.1** sur Render (3 fichiers corrigés, validé sur Cécile à 10:47:51 — `CONFORME_AVEC_OBSERVATIONS`)
- **Modifications Airtable v10.2** : 4 nouveaux champs + 10 nouveaux statuts + ANIMAL→ANIMAL_1/2
- **Contrat v1.8** ⭐ produit fin de soirée 29/04 (intègre les 8 décisions n°35-42 + Section 22 mutuelle + Section 4.4 refondue)

### 📝 Ce qui est à faire demain (30/04)
1. **Codage Phase v10.2b** (5 fichiers — selon SPEC_PHASE_v10_2b_c.md)
2. **Codage Phase v10.2c** (Mode 1 patch + Mode 2 auto + Mode 3 vérificateur impose)
3. **Test Cécile** sur statut `REPRENDRE_T1_SOMMEIL_SEUL`
4. **Application du patch architecture v1.1→v1.2** (en parallèle)

### 🚦 Statut des candidats
| Candidat | Statut |
|---|---|
| **Rémi** | en_cours / terminé (pipeline v10.1) |
| **Véronique** | NOUVEAU / en_cours (en queue) |
| **Cécile** | `REPRENDRE_T1_SOMMEIL_SEUL` (ignorée — Phase v10.2b non codée) |

---

## 🔐 SÉCURITÉ ANTI-COMPRESSION

Si je suis recompressée demain, ce qui me sauve :

1. **Ce fichier `00_INDEX.md`** — point d'entrée unique
2. **`01_CONTRAT/CONTRAT_ETAPE1_v1_8_COURANT.md`** — doctrine officielle à jour ⭐
3. **`06_JOURNAUX/29_avril_2026/CLOTURE_29_04_2026.md`** — engagements + missions du 30/04 ⭐
4. **`03_DOCTRINE/DECISIONS_29_04_2026.md`** — décisions doctrinales avec citations verbatim
5. **`05_CHANTIERS/SPEC_PHASE_v10_2b_c.md`** — spec code à écrire
6. **`05_CHANTIERS/ETAT_PROJET.md`** — 22 sections d'état projet

→ **Téléversez l'ensemble du dossier `PROJET_PROFIL_COGNITIF/` au projet** pour sécuriser.

⚠️ **Procédure obligatoire de reprise demain matin** (selon `CLOTURE_29_04_2026.md`) :
1. Lire `00_INDEX.md`
2. Lire `01_CONTRAT/CONTRAT_ETAPE1_v1_8_COURANT.md` intégralement
3. Lire `02_ARCHITECTURE/ARCHITECTURE_PROFIL_COGNITIF_v1_1_COURANT.md`
4. Lire `05_CHANTIERS/SPEC_PHASE_v10_2b_c.md`
5. Lire `06_JOURNAUX/29_avril_2026/CLOTURE_29_04_2026.md` (engagements)
6. **PUIS SEULEMENT** commencer Mission 2 (audit d'impact)

---

## 📜 RÈGLES DE GOUVERNANCE (gravées 29/04)

### Décision n°35 — Primat du fond sur la technique
*"Le code s'aligne sur le prompt, jamais l'inverse."*

### Décision n°36 — Audit d'impact obligatoire
*"Avant toute modification, audit des interdépendances montantes et descendantes."*

### Décision n°37 — Contrat document vivant
*"Mise à jour systématique du contrat après chaque intervention."*

### Section 22 mutuelle — Une intervention à la fois
*"S'applique à Isabelle ET à Claude. Pas de glissement de sujet."*

### + 5 autres décisions (n°38, 39, 40, 41, 42) — voir `03_DOCTRINE/DECISIONS_29_04_2026.md`

---

## ✍️ SIGNATURE

- **Doctrine** : Isabelle Chenais (Sib Prod / Profil-Cognitif)
- **Exécution technique** : Claude (Anthropic)
- **Date d'organisation** : 29/04/2026 fin de soirée
- **Méthode** : consolidation totale après désastre annoncé de fichiers éparpillés
