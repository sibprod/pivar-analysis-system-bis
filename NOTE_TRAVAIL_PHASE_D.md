# 📋 NOTE DE TRAVAIL — PHASE D GÉNÉRATION TERMINÉE

**Date** : 28 avril 2026, fin de session
**Statut** : ✅ **17 fichiers générés** + utils + docs = 22 fichiers prêts pour GitHub

---

## ✅ CE QUI EST FAIT

### Phase D — Audit (terminé)
- 15 fichiers audités intégralement
- 82 modifications identifiées et tracées dans `RECAP_MODIFICATIONS_PHASE_D.md`
- 3 décisions doctrinales gravées (D-A pilier_sortie, D-B statut_analyse_pivar, D-C endpoint legacy)
- 1 bug latent identifié (backups vérificateur T1 non écrits)

### Phase D — Actions Airtable via MCP (terminé sauf 1)
- ✅ Champ `corrections_certificateur` → `corrections_verificateur` renommé dans ETAPE1_T1
- ✅ 6 champs créés dans VISITEUR : `email_T0_envoye`, `email_24h_envoye`, `email_48h_envoye`, `email_72h_envoye`, `email_livraison_envoye`, `date_T0`
- ✅ 2 champs créés dans VISITEUR : `backup_before_t1_verificateur`, `backup_after_t1_verificateur`
- ⏳ **À FAIRE MANUELLEMENT** : retirer le champ `pilier_sortie` de la table ETAPE1_T1 (fldJy7TrWJSloWnkc) — l'API MCP ne permet pas la suppression de champ

### Phase D — Génération (terminé) — 17 fichiers refondus

| # | Fichier | Statut |
|---|---|---|
| 1 | `package.json` | ✅ v10.0.0 + resend ^3.2.0 |
| 2 | `config/claude.js` | ✅ renommage agent_t1_verificateur |
| 3 | `config/airtable.js` | ✅ table VERIFICATEUR_T1 + champs validation_humaine + emails + ALLOWED_VALUES élargis + pilier_sortie retiré |
| 4 | `services/infrastructure/agentBase.js` | ✅ PROMPTS_ROOT 2 niveaux + promptExists() (Décision n°32) |
| 5 | `services/infrastructure/claudeService.js` | ✅ chemins require ../../config/* + ../../utils/* |
| 6 | `services/infrastructure/airtableService.js` | ✅ +7 nouvelles fonctions (writeVerificateurT1, getCandidatsEnAttenteValidation, appliquerValidationHumaine, incrementTentativesEtape1, resetTentativesEtape1, getCandidatsAEmailler, markerEmailCandidatEnvoye, setDateT0) |
| 7 | `services/infrastructure/backupService.js` | ✅ +backups vérificateur T1 (corrige bug latent) |
| 8 | `services/etape1/agentT1Service.js` | ✅ promptPath: 'etape1/etape1_t1.txt', pilier_sortie retiré |
| 9 | `services/etape1/agentT1VerificateurService.js` | ✅ RENOMMÉ + 4 modes via determinerMode() + écriture VERIFICATEUR_T1 + buildVerificateurPatchPlan |
| 10 | `services/orchestrators/orchestratorEtape1.js` | ✅ NOUVEAU sous-chef Étape 1, détection auto vérificateur, aiguillage 4 modes |
| 11 | `services/orchestrators/orchestratorPrincipal.js` | ✅ NOUVEAU chef de cuisine, aiguillage par statut |
| 12 | `services/flux/queueService.js` | ✅ chemins + polling 60s + statuts élargis (NOUVEAU/REPRENDRE_AGENT1/REPRENDRE_VERIFICATEUR1) |
| 13 | `services/flux/healthcheckService.js` | ✅ NOUVEAU squelette minimal |
| 14 | `services/flux/validationHumaineService.js` | ✅ NOUVEAU squelette fonctionnel (polling OK, pas d'envoi email) |
| 15 | `services/flux/notificationCandidatService.js` | ✅ NOUVEAU squelette fonctionnel (polling OK, pas d'envoi email) |
| 16 | `routes/index.js` | ✅ chemins require + /status enrichi (tentatives, validation_humaine, emails_candidat) |
| 17 | `server.js` | ✅ RESEND vars + polling 60s + démarrage 3 services flux |

---

## ⚠️ CE QUI N'EST PAS FAIT (POINTS DE VIGILANCE)

### 1. Action Airtable manuelle (1 minute)
**À faire dans Airtable** : ouvrir la table **ETAPE1_T1**, supprimer le champ **`pilier_sortie`** (fldJy7TrWJSloWnkc). L'API MCP ne permet pas la suppression de champs.

### 2. Pipeline T2 / T3 / T4 / certificateur lexique non encore migré en v10
**État** : `orchestratorEtape1.run()` ne lance que **T1 + Vérificateur T1** pour le test Cécile. Les `require()` de T2/T3/T4 sont commentés dans `orchestratorEtape1.js` (lignes 27-37).

**Pourquoi c'est OK pour le test Cécile** : on veut valider que le nouveau pipeline (architecture v10 + vérificateur T1 → 4 modes) fonctionne avant de migrer le reste. Le statut sera mis à `terminé` après T1+Vérif pour le test.

**À faire plus tard** :
1. Migrer `agentT2Service.js` (déplacer dans `services/etape1/`)
2. Migrer `agentT3Service.js` (idem)
3. Migrer les 6 sous-agents T4 (créer `services/etape1/etape1_t4/`)
4. Migrer `certificateurLexiqueService.js` (créer `services/certificateurs/`)
5. Décommenter les `require()` dans `orchestratorEtape1.js`
6. Ajouter les blocs de pipeline correspondants dans `orchestratorEtape1.run()`

### 3. Envoi d'emails Resend non implémenté (squelettes)
**État** : les 3 services flux nouveaux (`healthcheckService`, `validationHumaineService`, `notificationCandidatService`) sont des **squelettes minimaux fonctionnels** — la logique de polling marche, mais l'envoi d'emails via Resend n'est pas implémenté. Tous les blocs Resend sont commentés en `// Phase D-2 :` dans le code.

**Pourquoi c'est OK pour le test Cécile** : le pipeline T1+Vérificateur n'a pas besoin d'envoyer d'emails. Ces services tournent en arrière-plan et logent leurs détections sans rien envoyer.

**À faire plus tard (Phase D-2)** :
1. Implémenter `healthcheckService.checkAirtable/Claude/Resend` (vrais checks)
2. Implémenter `validationHumaineService.envoyerEmailSuperviseur` (Resend → Isabelle)
3. Implémenter `notificationCandidatService.envoyerEmail` avec templates HTML par type (T0, 24h, 48h, 72h, livraison)

### 4. Architecture cible des dossiers GitHub
**À respecter scrupuleusement lors de l'upload** (cf. `docs/ARCHITECTURE_PROFIL_COGNITIF.md` Section 3) :

```
profil-cognitif/                       (racine du repo)
├── server.js
├── package.json
├── docs/                              ← contient ARCHITECTURE_PROFIL_COGNITIF.md
├── config/
├── routes/
├── services/
│   ├── orchestrators/
│   ├── flux/
│   ├── infrastructure/
│   ├── etape1/
│   └── certificateurs/                ← futur
├── new-prompts/                       ← à créer aussi !
│   ├── etape1/
│   │   ├── etape1_t1.txt
│   │   └── verificateur1_t1.txt
│   └── partages/                      ← futur
└── utils/
```

**⚠️ Important** : il faut aussi déplacer les **prompts** dans la nouvelle structure :
- `etape1_t1.txt` → `new-prompts/etape1/etape1_t1.txt`
- `verificateur1_t1.txt` → `new-prompts/etape1/verificateur1_t1.txt`

Sans ça, `agentBase.loadPrompt()` ne pourra pas charger les prompts (car PROMPTS_ROOT pointe vers `new-prompts/` à la racine).

---

## 🚀 ÉTAPES SUIVANTES (PLAN VALIDÉ AVEC ISABELLE)

### Étape B — Upload sur GitHub (Isabelle)
1. Cloner ou ouvrir le repo `pivar-analysis-system-bis`
2. Créer la nouvelle structure de dossiers (cf. arborescence ci-dessus)
3. Copier les 22 fichiers de `/mnt/user-data/outputs/PHASE_D_GENERATION/` dans le repo
4. Déplacer les 2 prompts (`etape1_t1.txt` et `verificateur1_t1.txt`) dans `new-prompts/etape1/`
5. Commit + push

### Étape C — Render auto-déploiement
- Render détecte le push GitHub
- Build automatique
- Health check → server.js démarre
- Polling 60s + validation humaine + notification candidat tous démarrent

### Étape D — Test sur Cécile (Étape 1 partielle)
- Mettre Cécile en `statut_analyse_pivar = NOUVEAU` dans Airtable
- Render polling la prend → orchestratorPrincipal → orchestratorEtape1
- T1 (5 appels par scénario) → écrit ETAPE1_T1
- Vérificateur T1 → mode 1/2/3/4 + écrit VERIFICATEUR_T1
- Si Mode 1 ou 2 : statut → `terminé` (test partiel — pipeline T2/T3/T4 non migré)
- Si Mode 3 ou 4 : statut → `EN_ATTENTE_VALIDATION_HUMAINE` ou `REPRENDRE_AGENT1`

### Étape E — Pendant que Render tourne sur Cécile
Claude (instance suivante) attaque le **chantier HTML** :
- Refonte de la structure `b_lexique_html` du bilan référence Cécile
- Templates HTML par lot (LOT_A à LOT_E)
- Référentiel `REFERENTIEL_BILANT4` à produire

---

## 📦 LIVRABLES SUR DISQUE

Tous les documents sont sécurisés dans `/home/claude/PHASE_D_BACKUP/` :
- `ARCHITECTURE_PROFIL_COGNITIF.md` — document maître pour agents IA futurs
- `CONTRAT_ETAPE1_v1.7.md` — bible doctrinale (1749 lignes, 34 décisions)
- `RECAP_MODIFICATIONS_PHASE_D.md` — récap des 82 modifications par fichier
- `JOURNAL_PHASE_D.md` — journal de bord anti-compression
- `ORCHESTRATEUR_CORRIGE.md` — doctrine T4 (à utiliser plus tard)
- `etape1_t1_PROMPT_GITHUB.txt` — prompt T1 v3.1 actuel
- `verificateur1_t1_PROMPT_GITHUB.txt` — prompt vérificateur v1.1 actuel
- `generated/` — **les 22 fichiers générés** organisés selon l'architecture cible

Tout est aussi exposé dans `/mnt/user-data/outputs/`.

---

## 🎯 EN UNE PHRASE

**Phase D Génération terminée avec rigueur. 22 fichiers prêts pour GitHub. 1 action Airtable manuelle restante. Test Cécile T1+Vérificateur prêt à lancer dès l'upload. Le reste du pipeline (T2/T3/T4) sera migré plus tard, et les emails Resend en Phase D-2.**

---

**Posture pour les agents IA suivants** :
1. **TOUJOURS LIRE `docs/ARCHITECTURE_PROFIL_COGNITIF.md`** avant toute modification
2. **TOUJOURS LIRE `docs/CONTRAT_ETAPE1.md`** pour comprendre la doctrine
3. **NE PAS** réinventer ce qui a été décidé (34 décisions gravées dans le contrat v1.7)
4. **NE PAS** utiliser le terme "PIVAR" en externe
5. **NE PAS** passer le prénom du candidat à un agent Claude (anonymisation Décision n°4)
6. **DEMANDER** Isabelle Chenais (gardienne doctrinale) avant toute action structurelle
