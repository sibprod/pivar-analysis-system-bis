# CONTRAT FONDATEUR — ÉTAPE 1 DU PROTOCOLE PROFIL-COGNITIF

**Version 1.7 · 28 avril 2026 · Sib Prod / Profil-Cognitif**
**Auteur : Isabelle Chenais (doctrine) + Claude (rédaction technique)**

---

## INTENTION DU DOCUMENT

Ce document est le **contrat fondateur** de l'Étape 1 du protocole d'analyse cognitive.

Il décrit ce que l'Étape 1 doit produire, dans quel format, avec quels guards, et comment elle se reprend en cas d'échec. Il est **autonome** : aucun humain ne supervise l'exécution en temps réel — mais le pipeline peut **solliciter une validation humaine asynchrone** dans des cas pathologiques précisément définis (voir Section 17).

Il ne décrit ni la doctrine d'analyse (qui est dans la table `REFERENTIEL_PILIERS` d'Airtable et la v36), ni le détail des prompts (qui sont dans `etape1_t1.txt` et `verificateur_t1.txt`), ni le code (qui est dans `agentT1Service.js` et `agentT1VerificateurService.js`). Il décrit le **contrat** que ces éléments doivent honorer ensemble.

Tout fichier produit pour l'Étape 1 doit être traçable à ce contrat. Toute correction technique doit être justifiée par une clause de ce contrat.

---

## JOURNAL DE VERSION

### v1.7 — 28 avril 2026 (architecture extensible multi-étapes + robustesse + communication candidat)

Modifications par rapport à v1.6 :

- **9 nouvelles décisions actées** (n°26 à n°34) :
  - n°26 : Architecture orchestrateur principal + sous-orchestrateurs par étape
  - n°27 : Structure des dossiers GitHub par étape (`etape1/`, `etape2/`, `etape3/`)
  - n°28 : Pattern de nommage `verificateur{niveau}_t{X}` lié à l'agent vérifié
  - n°29 : Pas de promesse de délai garanti, robustesse garantie
  - n°30 : Polling agressif (60 secondes au lieu de 5 minutes)
  - n°31 : Capacité serveur connue et documentée (10-12 candidats/jour sur Render Starter)
  - n°32 : Vérificateur existant ⇔ vérificateur exécuté (présence du fichier prompt = doctrine)
  - n°33 : Communication candidat asynchrone (emails T0, +24h, +48h, +72h)
  - n°34 : Délai d'engagement client : bilan livré sous 72h max
- **Section 19 nouvelle** : Architecture cible (orchestrateur principal + sous-orchestrateurs par étape)
- **Section 20 nouvelle** : Structure des dossiers GitHub (étape par étape)
- **Section 21 nouvelle** : Tableau d'impact des modifications (carte des dépendances)
- **Section 22 nouvelle** : Protocole de travail "fichier par fichier"
- **Section 23 nouvelle** : Capacité, délais et engagements client
- **Section 24 nouvelle** : Communication candidat asynchrone (templates emails)

### v1.6 — 28 avril 2026 (format d'attribution chaîné avec pilier coeur en MAJUSCULE)

Modifications par rapport à v1.5 :

- **Décision n°25 ajoutée** : Nouveau format du champ `attribution_pilier_signal_brut`. Le format reflète désormais la **séquence narrative effective** du verbatim (autant de piliers que parcourus, dans l'ordre littéral, avec retours possibles au même pilier). Le **pilier coeur est noté en MAJUSCULE** pour visibilité immédiate, les piliers secondaires en minuscule. Séparateur unique `+`. Verdict final après double espace : `Conforme`, `Conforme (incarne PX)` pour incarnation par un pilier non parcouru, ou `ÉCART`. Ce format remplace les anciennes formes `PX · PY + PZ Conforme` et `PX → PY Conforme`. [Section 3.4 enrichie + Section 14]
- **Section 3.4 enrichie** : nouveau format détaillé avec exemples.
- **Note sur le champ `verbes_angles_piliers`** : il garde son format narratif `verbe → reformulation (PX)` inchangé. La distinction MAJUSCULE/minuscule n'apparaît QUE dans `attribution_pilier_signal_brut`.

### v1.5 — 28 avril 2026 (healthcheck global + logique de tentatives Mode 4)

Modifications par rapport à v1.4 :

- **Décision n°23 ajoutée** : Healthcheck global préalable de tous les services techniques (Airtable, Claude API, Resend) à chaque cycle de polling Render, AVANT toute tentative de démarrage de pipeline. Si un service est KO, le pipeline est en pause silencieuse, le candidat ne change pas de statut, et un email d'alerte technique est envoyé au superviseur (avec anti-spam : 1 email max par jour). Lorsque le service revient, le polling suivant détecte que tout est OK et démarre normalement. Pas de tokens API gaspillés. [Section 6.4 nouvelle]
- **Décision n°24 ajoutée** : Logique de tentatives sur Mode 4 (erreur système). Tentative 1 = exécution normale. Si Mode 4 → email superviseur + reprise auto T1 (tentative 2). Si Mode 4 à nouveau → statut `ERREUR` définitif, intervention humaine obligatoire (tentative 3+). Compteur géré dans le champ `nombre_tentatives_etape1` de VISITEUR. Reset à 0 quand T1 réussit. Reprise complète T1 = supprimer les lignes ETAPE1_T1 existantes du candidat + relancer les 5 appels. [Section 4.4 enrichie + Section 6.4]
- **Section 4.4 enrichie** : Mode 4 détaillé avec les 3 cas (A, B, C) selon le moment de l'erreur, et la logique de tentatives.
- **Section 6.4 nouvelle** : Healthcheck global préalable et son comportement.
- **Champ Airtable créé dans VISITEUR** : `nombre_tentatives_etape1` (number, précision 0).
- **Section 18 mise à jour** : ajout de la note sur le service `healthcheckService.js` à créer en Phase E.

### v1.4 — 28 avril 2026 (doctrine d'analyse des piliers — pilier coeur unique, piliers secondaires ≠ coeur)

Modifications par rapport à v1.3 :

- **Décision n°19 ajoutée** : Pilier coeur identifié par la **profondeur de compétence cognitive déployée** par le candidat (savoir-faire mobilisé), pas par le volume. Volume et précision sont des indicateurs indirects, pas des critères premiers. [Section 5.5 nouvelle]
- **Décision n°20 ajoutée** : **Un seul pilier est activé à la fois** dans une réponse. Les piliers s'enchaînent dans une **séquence narrative** au fil du verbatim. Pas d'activation parallèle. [Section 5.5]
- **Décision n°21 ajoutée** : **Pilier coeur unique** par réponse. **Piliers secondaires** = uniquement les piliers ≠ pilier coeur, avec leur **position narrative** (en amont du coeur OU en aval du coeur). Pas d'autre position narrative capturée en Étape 1. **Cas vide légitime** : si le verbatim reste dans le pilier coeur du début à la fin, le champ `piliers_secondaires` est vide. [Section 5.5 et Section 3.8 nouvelles]
- **Décision n°22 ajoutée** : **Lecture des `pieges_avertissements` systématique** (avant ET après attribution), pas conditionnelle à la détection d'une "ambiguïté" subjective. Les pièges sont un passage obligé du raisonnement, pas un filet de secours optionnel. [Section 3.8]
- **Section 3.8 nouvelle** : Doctrine d'identification du pilier coeur et des piliers secondaires (mode opératoire concret pour T1).
- **Section 5.5 nouvelle** : Doctrine d'analyse des piliers dans une réponse (transverse au protocole : séquence, profondeur, position narrative).
- **Note importante** : le terme "piliers secondaires" est conservé pour l'Étape 1. Le terme "piliers structurants" sera utilisé dans les étapes ultérieures (T3, T4) pour désigner la même chose dans un contexte d'attribution de signature cognitive.

### v1.3 — 28 avril 2026 (workflow de validation humaine + tolérance pilier_coeur)

Modifications par rapport à v1.2 :

- **Décision n°13 ajoutée** : Traitement individuel exclusif (un candidat à la fois, jamais de comparaison ni traitement parallèle). [Section 14]
- **Décision n°14 ajoutée** : Tolérance pilier_coeur dans résultat final = 0 idéal, 1 toléré. [Section 14]
- **Décision n°15 ajoutée** : Architecture du vérificateur T1 en 4 modes (correction ponctuelle / relance d'agent / validation humaine / erreur système). [Section 4 réécrite]
- **Décision n°16 ajoutée** : Workflow de validation humaine via Airtable + Resend → `sibprod@live.fr`. [Nouvelle Section 17]
- **Décision n°17 ajoutée** : Forme courte de `pilier_coeur_analyse` confirmée (`P3 · description`, sans le nom officiel accolé). [Section 3.4 corrigée + Section 14]
- **Décision n°18 ajoutée** : Tolérance globale 90% sur le résultat final (hors pilier_coeur qui est plus strict). [Section 14]
- **Section 4 réécrite** : architecture en 4 modes du vérificateur T1.
- **Section 12 mise à jour** : ajout du statut `EN_ATTENTE_VALIDATION_HUMAINE`.
- **Nouvelle Section 17** : Workflow de validation humaine asynchrone.
- **Nouvelle Section 18** : Chantiers futurs identifiés (génération HTML dynamique pour toutes les étapes).

### v1.2 — 28 avril 2026 (précision doctrinale signal_limbique)

- Doctrine `signal_limbique` corrigée : zone périphérique cognitive captée. [Section 4.3 Catégorie D et Section 5.4]
- Décision doctrinale n°12 ajoutée : périmètre du profil cognitif et fonction métier du `signal_limbique`. [Section 14]

### v1.1 — 28 avril 2026 (après audit Airtable)

- Renommage `CERTIFICATEUR_T1` → `VERIFICATEUR_T1`. [Section 4]
- Doctrine de nommage des piliers : codes internes vs noms officiels. [Section 5 et 14]
- Architecture d'injection des référentiels : lecture Airtable au démarrage, injection dans le payload. [Section 6]
- Garde-fou d'intégrité référentielle : avant tout appel agent. [Section 7]
- Distinction backups vs points de reprise : clarification structurelle. [Section 8]

### v1.0 — 28 avril 2026 (contrat initial)

Première rédaction du contrat fondateur. 7 décisions doctrinales actées.

---

## 1. DÉCLENCHEUR

L'Étape 1 démarre quand le polling Render trouve un candidat dans la table `VISITEUR` avec `statut_analyse_pivar` ∈ { `NOUVEAU`, `REPRENDRE_AGENT1`, `REPRENDRE_VERIFICATEUR1` }.

Le pipeline lit immédiatement, depuis la ligne `VISITEUR` du candidat :

| Champ Airtable | Usage |
|---|---|
| `candidate_ID` | Identifiant technique unique du candidat |
| `Prenom` | **Usage interne uniquement** — logs, fichiers de backup, email superviseur. Jamais transmis aux agents Claude |
| `civilite_candidat` | Transmise aux agents pour les accords féminin/masculin (`Madame` / `Monsieur`) |
| `statut_analyse_pivar` | Détermine l'étape de départ (voir Section 12) |

Le pipeline passe alors `statut_analyse_pivar = en_cours`.

**Règle d'isolation (Décision n°13)** : à tout moment, le pipeline ne traite **qu'un seul candidat**. Aucune lecture, transmission ou utilisation des données d'autres candidats. Pas de comparaison, pas de batch multi-candidats. Cette règle s'applique à toutes les étapes (T1, vérificateur T1, T2, T3, T4) et à tous les agents.

---

## 2. MISSION DE L'ÉTAPE 1

L'Étape 1 produit **25 lignes d'analyse cognitive** dans la table `ETAPE1_T1`, une par question répondue par le candidat.

Ces 25 lignes sont la **fondation** de toutes les étapes suivantes (T2, T3, T4). Elles doivent être **complètes**, **conformes au format de référence** (`ETAPE1_T1rempli` + références v3 fournies par Isabelle) et **doctrinalement justes**.

L'Étape 1 se compose de **2 sous-étapes** :

1. **T1 — Analyse cognitive** : un agent analyste lit les 25 réponses brutes et produit les 25 lignes d'analyse
2. **Vérificateur T1 — Vérification correctrice** : un agent vérificateur relit les 25 lignes T1, identifie les erreurs doctrinales, **corrige directement dans Airtable** OU **demande la relance d'un agent défaillant** OU **sollicite une validation humaine asynchrone**

**À la sortie de l'Étape 1, les 25 lignes ETAPE1_T1 sont prêtes à être lues par T2.** Pas avant.

---

## 3. SOUS-ÉTAPE T1 — ANALYSE COGNITIVE

### 3.1 Ce que T1 reçoit en entrée

Depuis la table `RESPONSES` filtrée sur le `candidate_ID` du candidat : **25 lignes**.

**Champs RESPONSES lus par T1 (et seulement ceux-là) :**

| Champ RESPONSES | Description |
|---|---|
| `id_question` | Identifiant unique au format `PXQy` (ex : `P1Q2`, `P2Q15`, `P3Q5`) |
| `numero_global` | Position dans le test (1 à 25) |
| `pilier` | Pilier ciblé par la question (`P1` à `P5`) |
| `scenario_nom` | `SOMMEIL`, `WEEKEND`, `ANIMAL` ou `PANNE` |
| `question_text` | Le texte de la question posée au candidat |
| `response_text` | Le verbatim brut de la réponse du candidat |
| `storytelling_general (from question _lien)` | Contexte narratif (lookup) |
| `transition_narrative (from question _lien)` | Phrase de transition (lookup) |

**Note importante — RESPONSES legacy :**
La table RESPONSES contient également 80+ champs d'analyse hérités d'anciennes architectures. **Ces champs ne sont PAS lus par le pipeline actuel.** Ils sont conservés en l'état et seront nettoyés ultérieurement. Le pipeline les ignore.

**Ce que T1 reçoit ÉGALEMENT (injecté par l'orchestrateur) :**

| Donnée injectée | Source | Usage |
|---|---|---|
| `civilite` | `VISITEUR.civilite_candidat` | Accords grammaticaux dans les sorties |
| `referentiel_piliers` | Table `REFERENTIEL_PILIERS` (5 enregistrements) | Doctrine d'analyse complète (voir Section 6) |

### 3.2 Ce que T1 produit en sortie

**25 lignes** dans la table `ETAPE1_T1`, chacune avec **22 colonnes métier** au format strictement identique aux références v3 (Cécile, Rémi, Véronique), **plus 2 colonnes techniques de traçabilité**.

#### Tableau des 22 colonnes métier obligatoires

| Colonne | Format attendu | Type Airtable | Source |
|---|---|---|---|
| `candidat_id` | `pcc_xxxxxxxxx` | multilineText | RESPONSES.candidate_ID |
| `id_question` | **`P1Q2`, `P2Q15`...** (recopié tel quel depuis RESPONSES) | singleSelect | RESPONSES.id_question |
| `question_id_protocole` | Identique à `id_question` | singleSelect | RESPONSES.id_question |
| `scenario` | `SOMMEIL` / `WEEKEND` / `ANIMAL` / `PANNE` | singleSelect | RESPONSES.scenario_nom |
| `pilier_demande` | `P1` à `P5` | singleSelect | RESPONSES.pilier |
| `question_texte` | Texte de la question | multilineText | RESPONSES.question_text |
| `storytelling` | Contexte narratif | multilineText | RESPONSES.storytelling_general |
| `transition` | Phrase de transition | multilineText | RESPONSES.transition_narrative |
| `verbatim_candidat` | Verbatim brut | multilineText | RESPONSES.response_text |
| `v1_conforme` | `OUI` ou `NON` | singleSelect | Analyse |
| `v2_traite_problematique` | `OUI` ou `NON` | singleSelect | Analyse |
| `verbes_observes` | Liste de verbes principaux du verbatim | multilineText | Analyse |
| `verbes_angles_piliers` | **Format narratif** : `verbe → reformulation courte du geste cognitif (PX) verbe → reformulation (PY)...` | multilineText | Analyse |
| `pilier_coeur_analyse` | **Format court (Décision n°17)** : `PX · description du geste cognitif central` | multilineText | Analyse |
| `types_verbatim` | `PX · type de geste "citation verbatim" PY · autre type "autre citation"...` | multilineText | Analyse |
| `piliers_secondaires` | `PX description courte. PY description courte.` | multilineText | Analyse |
| `pilier_sortie` | **Toujours vide** (champ abandonné) | multilineText | — |
| `finalite_reponse` | Phrase courte + citation explicite si présente | multilineText | Analyse |
| `attribution_pilier_signal_brut` | Format chaîné MAJUSCULE/minuscule (voir Section 3.4) — exemples : `P3  Conforme` / `p1 + P3 + p5  Conforme` / `p3 + P5  ÉCART` / `p1 + P3 + p5  Conforme (incarne P2)` | multilineText | Analyse |
| `conforme_ecart` | `CONFORME` ou `ÉCART` | singleSelect | Analyse |
| `ecart_detail` | Vide si CONFORME, sinon nature de l'écart en 1 phrase | multilineText | Analyse |
| `signal_limbique` | Vide si pas de signal détecté, sinon `émotion détectée · "citation verbatim"` | multilineText | Analyse — voir Section 4.3 Catégorie D pour la doctrine complète |

#### Colonnes techniques additionnelles (traçabilité)

| Colonne | Type Airtable | Usage |
|---|---|---|
| `raisonnement` | multilineText | Verbalized reasoning de l'agent T1 (objet JSON sérialisé) — pour audit et debug |
| `corrections_certificateur` | multilineText | Trace des corrections appliquées par le vérificateur T1 — pour audit |

#### Action structurelle requise sur Airtable (uniformisation)

La table `ETAPE1_T1` doit être mise à jour pour aligner les types de champs sur la référence `ETAPE1_T1rempli` :

| Champ | Type actuel | Type cible |
|---|---|---|
| `id_question` | multilineText | singleSelect (avec choix `P1Q1`...`P5Q15`) |
| `scenario` | multilineText | singleSelect (`SOMMEIL`, `WEEKEND`, `ANIMAL`, `PANNE`) |
| `pilier_demande` | multilineText | singleSelect (`P1`, `P2`, `P3`, `P4`, `P5`) |
| `v1_conforme` | multilineText | singleSelect (`OUI`, `NON`) |
| `v2_traite_problematique` | multilineText | singleSelect (`OUI`, `NON`) |
| `conforme_ecart` | multilineText | singleSelect (`CONFORME`, `ÉCART`) |

Cette uniformisation est **non négociable** : elle garantit que l'agent ne peut pas écrire de valeur invalide dans un champ contraint.

### 3.3 Format `verbes_angles_piliers` — clarification doctrinale

**Format narratif** lisible par un humain et par une IA. Pas de format à scores. Pas de cases cochées dans le champ de sortie.

**Format attendu :**
```
regarder → consulter des sources internet (P1) s'orienter → sélectionner selon critère de fiabilité (P1) mettre en place → tester empiriquement (P5)
```

Les grilles à cases cochées peuvent rester un **outil de raisonnement interne** de l'agent (dans son thinking), mais **ne figurent jamais dans le champ `verbes_angles_piliers` de la sortie**.

### 3.4 Format `pilier_coeur_analyse` — décision n°17 (forme courte)

**Format obligatoire :**
```
PX · description du geste cognitif central
```

**Exemples (depuis références v3 Cécile/Rémi/Véronique) :**
```
P1 · collecte hiérarchisée par catégories de sources (scientifique → médical → psychologique → alternatif)
P3 · théorisation analytique sur le rapport symptôme/cause enfouie
P5 · cadrage exécutif et délégation décisionnelle
```

**Important** : la forme longue avec nom officiel (`P1 (Collecte d'information) · ...`) reste valable pour les **bilans publiés** (Étape 4) destinés au candidat ou au DRH. Mais dans `pilier_coeur_analyse` qui est un champ analytique technique, la **forme courte** est utilisée — c'est ce que les références v3 ont validé.

Voir Section 5 pour la doctrine transverse de nommage des piliers.

### 3.4bis Format `attribution_pilier_signal_brut` — décision n°25 (séquence narrative MAJUSCULE/minuscule)

**Principe** : le champ reflète la **séquence narrative effective** du verbatim. Autant de piliers que de piliers parcourus dans l'ordre littéral, avec retours possibles au même pilier si la candidate y revient. Le pilier coeur est noté en **MAJUSCULE** pour visibilité immédiate, les piliers secondaires en **minuscule**.

**Format obligatoire** :
```
piliers_séparés_par_des_+  Verdict
```

- **Piliers en minuscule** (`p1`, `p2`, `p3`, `p4`, `p5`) = piliers traversés en secondaires (≠ pilier coeur)
- **Pilier coeur en MAJUSCULE** (`P1` à `P5`) = visible d'un coup d'œil dans la chaîne
- Séparateur = ` + ` (espace, plus, espace)
- Verdict final après **double espace** : `Conforme`, `ÉCART`, ou `Conforme (incarne PX)` quand le pilier demandé n'apparaît pas dans la séquence mais est incarné cognitivement

**Tableau des cas et exemples** :

| Cas | Format | Exemple concret |
|---|---|---|
| Verbatim monolithique sur le coeur (= pilier_demande) | `PX  Conforme` | `P3  Conforme` (verbatim entièrement P3 sur question P3) |
| Coeur = demandé, séquence avec secondaires | `pilier(s) + COEUR + pilier(s)  Conforme` | `p1 + P3 + p5  Conforme` (passe par P1 collecte, déploie en P3, sort en P5) |
| Coeur ≠ demandé mais incarne la problématique | `... PX ...  Conforme (incarne PY)` | `p1 + P3 + p5  Conforme (incarne P2)` (question P2, coeur P3 qui traite quand même P2) |
| Coeur ≠ demandé, dérive sans incarnation | `... PX ...  ÉCART` | `p3 + P5 + p1  ÉCART` (question P3, dérive vers P5 sans analyse) |
| Retour au même pilier en cours de séquence | `pX + pY + pX + COEUR  Verdict` | `p1 + p2 + p1 + P3  Conforme` (collecte → tri → retour collecte → analyse coeur) |

**Règles de formatage absolues** :
- Toujours **un seul** pilier en MAJUSCULE par chaîne (le coeur unique, Décision n°21)
- Si verbatim monolithique : la chaîne ne contient que le pilier coeur en MAJUSCULE, sans `+`
- Le verdict est précédé de **DEUX espaces** pour séparation visuelle
- Le verdict est exactement `Conforme`, `ÉCART` ou `Conforme (incarne PX)` (pas d'autres formulations)

**Note sur la cohérence avec `piliers_secondaires`** : les piliers minuscules dans `attribution_pilier_signal_brut` correspondent exactement aux piliers présents dans `piliers_secondaires` (Section 3.8.2 — uniquement piliers ≠ coeur, position en amont OU en aval du coeur). Si `piliers_secondaires` est vide (cas monolithique), `attribution_pilier_signal_brut` ne contient que le coeur en MAJUSCULE.

### 3.5 Calibrage technique T1

L'agent T1 traite les 25 questions en **5 appels distincts**, un par scénario, pour respecter le plafond de 64 000 tokens output de Claude Sonnet 4.6 :

| Appel | Scénario | Questions | Volume |
|---|---|---|---|
| 1 | SOMMEIL | 5 | Marge confortable |
| 2 | WEEKEND | 5 | Marge confortable |
| 3 | ANIMAL_1 | 5 (numero_global 11-15) | Marge confortable |
| 4 | ANIMAL_2 | 5 (numero_global 16-20) | Marge confortable |
| 5 | PANNE | 5 | Marge confortable |

**Thinking : ON** (analyse cognitive nécessite raisonnement structuré).

**`max_tokens` : 64 000** par appel (plafond Sonnet 4.6 synchrone).

**Format de sortie attendu : JSON strict dès la première ligne**, sans prose préalable, sans markdown, sans tableau de raisonnement avant le JSON.

### 3.6 Garde-fous T1 (guards)

| Guard | Condition d'échec | Action |
|---|---|---|
| Guard T1.0 | Référentiel piliers incomplet ou corrompu (Section 7) | Statut ERREUR + arrêt avant toute exécution |
| Guard T1.1 | Une réponse RESPONSES manquante (count < 25) | Statut ERREUR + arrêt |
| Guard T1.2 | Un scénario produit moins de lignes que prévu | Statut ERREUR + arrêt |
| Guard T1.3 | Total final ≠ 25 lignes | Statut ERREUR + arrêt |
| Guard T1.4 | Format JSON invalide | Retry une fois max, puis statut ERREUR |
| Guard T1.5 | Une valeur écrite dans un champ singleSelect n'existe pas | Erreur Airtable, statut ERREUR |

### 3.7 Écriture Airtable T1

L'écriture des 25 lignes dans `ETAPE1_T1` se fait **après** que les 5 appels aient tous réussi. Pas pendant. En cas d'échec partiel, rien n'est écrit, et la table `ETAPE1_T1` reste vide pour ce candidat.

Une ligne ETAPE1_T1 est **identifiée de manière unique** par la combinaison `candidat_id + id_question`. Aucune ligne ne doit être dupliquée.

### 3.8 Doctrine d'identification du pilier coeur et des piliers secondaires

Cette section formalise le mode opératoire que T1 doit suivre pour identifier correctement le pilier coeur et les piliers secondaires d'une réponse. Elle complète la Section 5.5 (doctrine transverse) avec les modalités concrètes pour l'Étape 1.

#### 3.8.1 Pilier coeur — un seul pilier par réponse

Le pilier coeur est **unique** dans une réponse. Il correspond au pilier où le candidat **déploie sa compétence cognitive la plus profonde** — son savoir-faire mobilisé.

**Principe sous-jacent** : un candidat qui sait faire et à qui on demande d'expliquer livre spontanément son savoir-faire — sauf chez les candidats laconiques. Le pilier coeur est donc celui sur lequel le candidat **déploie sa compétence** : nuances, conditions, critères, seuils, hypothèses articulées, principes organisateurs, exemples concrets.

**Marqueurs de profondeur de compétence déployée** :
- Articulations conditionnelles ("si X alors Y, sinon Z")
- Hiérarchies argumentées ("d'abord A, puis B parallèlement, ensuite éventuellement C")
- Critères explicites de décision ou de filtrage
- Principes organisateurs stables énoncés
- Hypothèses testables avec seuils de révision
- Exemples concrets qui illustrent le geste

**Indicateurs indirects (pas critères premiers)** : le **volume** (nombre de mots/lignes) et la **précision** sont des indicateurs indirects de la profondeur — pas les critères eux-mêmes. Un candidat peut déployer en 3 phrases en P3 une profondeur supérieure à 5 phrases en P5 d'énumération basique. Le coeur est P3 dans ce cas.

**Tie-break en cas d'égalité réelle de profondeur** :
1. Le pilier qui structure le sens central de la réponse (l'intention dominante du candidat) gagne
2. À sens central équivalent, le pilier développé en plus de mots/lignes gagne
3. À volume égal, le pilier avec plus de précision gagne

**Avertissement** : un verbe isolé en fin de réponse ne fait pas le pilier coeur. Si tout le corps de la réponse développe un pilier X et qu'une phrase de clôture utilise un verbe d'un pilier Y, le pilier coeur reste X.

#### 3.8.2 Piliers secondaires — uniquement piliers ≠ pilier coeur

Les piliers secondaires sont **uniquement les piliers ≠ pilier coeur** présents dans la séquence narrative du verbatim, avec leur **position narrative** par rapport au coeur.

**Position narrative — 2 cas seulement** :
- **En amont du coeur** : le pilier secondaire intervient AVANT le coeur dans la séquence du verbatim (préparation, déclenchement, contexte)
- **En aval du coeur** : le pilier secondaire intervient APRÈS le coeur dans la séquence du verbatim (prolongement, clôture, recours)

**Pas de "fin de réponse"** capturée — c'est source d'erreur pour les agents IA qui pourraient confondre une position de clôture avec un changement de pilier. **Pas de "en parallèle"** — un seul pilier est activé à la fois (Section 5.5).

**Cas vide légitime** : si le verbatim reste dans le pilier coeur du début à la fin (déploiement cognitif monolithique sur ce pilier), le champ `piliers_secondaires` est **vide** (chaîne vide `""`). C'est une information cognitive valide qui sera lue plus tard (T3, T4).

**Format obligatoire** :
```
PX en amont du coeur — <description courte du rôle>. PY en aval du coeur — <description courte>.
```

#### 3.8.3 Lecture systématique des `pieges_avertissements`

La lecture des `pieges_avertissements` du `referentiel_piliers` injecté est **systématique**, pas conditionnelle :

1. **Avant attribution** : T1 lit les `pieges_avertissements` du pilier qu'il envisage, pour cadrer son analyse depuis le départ
2. **Après attribution** : T1 relit les `pieges_avertissements` une seconde fois, pour s'autocorriger si une exclusion s'applique

Cette double lecture transforme les pièges d'un filet de secours optionnel en un **passage obligé du raisonnement**. La notion d'"ambiguïté" est subjective et un agent peu vigilant passerait à côté des pièges — la double lecture systématique élimine cette zone grise.

#### 3.8.4 Exemples doctrinaux pour T1

Le prompt `etape1_t1.txt` (v3.0 et ultérieures) inscrit 4 exemples doctrinaux issus des références v3 d'Isabelle Chenais (Cécile/Rémi/Véronique), couvrant les 4 cas critiques :

| # | Exemple | Source | Ce qu'il enseigne |
|---|---|---|---|
| A | Véronique Q17 (P4 demandé / P3 cœur — ÉCART) | tableau1_veronique_v3.html | Diagnostic par exclusion = P3, pas P4 (règle EXCL-P4.B) |
| B | Cécile Q13 (P2 demandé / P3 cœur — CONFORME par incarnation) | tableau1_cecile_v3.html | Mismatch coeur/demandé peut être CONFORME + cas légitime de `piliers_secondaires` vide |
| C | Cécile Q8 (P3 demandé / P5 cœur — ÉCART + signal_limbique) | tableau1_cecile_v3.html | ÉCART par délégation + détection signal_limbique légitime |
| D | Véronique Q15 (P3 demandé / P3 cœur — CONFORME par théorisation) | tableau1_veronique_v3.html | La forme du récit ne disqualifie pas le fond cognitif |

---

## 4. SOUS-ÉTAPE VÉRIFICATEUR T1 — VÉRIFICATION CORRECTRICE EN 4 MODES

### 4.1 Renommage de la table

La table autrefois nommée `CERTIFICATEUR_T1` est **renommée en `VERIFICATEUR_T1`** (id technique `tbl3Slcbv2RdvhXlz` inchangé). Renommage effectif depuis le 28/04/2026.

### 4.2 Mission

Le vérificateur T1 est un **second analyste contradictoire**. Il relit les 25 lignes T1 produites par l'analyste et vérifie leur conformité à la doctrine.

**Sa mission n'est PAS de refaire toute l'analyse.** Elle est de **détecter les dérives** et d'agir selon la nature de la défaillance détectée.

**Le vérificateur dispose de 4 modes opérationnels** (Décision n°15) qu'il choisit selon le diagnostic qu'il pose sur les 25 lignes T1.

### 4.3 Les 4 catégories de vérification doctrinale

Quel que soit le mode appliqué, le vérificateur examine systématiquement les 4 catégories suivantes :

**Catégorie A — Cohérence interne mécanique**
- `v1_conforme = OUI` → `conforme_ecart` doit être `CONFORME`
- `v1_conforme = NON` → `conforme_ecart` doit être `ÉCART`
- Si `conforme_ecart = ÉCART` → `ecart_detail` doit être non vide
- Si `conforme_ecart = CONFORME` → `ecart_detail` doit être vide

**Catégorie B — Justesse doctrinale du `pilier_coeur_analyse`**

Le vérificateur relit le verbatim et vérifie que le pilier_coeur attribué est cohérent avec le geste cognitif réellement déployé. Pièges principaux à attraper (issus du REFERENTIEL_PILIERS) :

- **Filtre crédibilité ≠ P3 cœur** : "j'analyse qui a produit la vidéo" pour vérifier la fiabilité d'une source = P3 au service de P1, le cœur reste P1
- **Solutions conditionnelles = P4** : "si X alors Y, sinon Z" avec actions différenciées générées par le candidat = P4
- **Action concrète ≠ P3** : "je consulte un spécialiste", "je m'adapte" = P5
- **Énumération catégorielle pour soi ≠ P1** : "chat? chien? lapin?" sans destinataire = P3 (auto-classification)
- **Théorisation au mode normatif ≠ P5** : "il faut que le groupe", "doit être réactif" = P3 méta-théorisation
- **Diagnostic par exclusion = P3, pas P4** : "si tous besoins assouvis → donc problème médical" = raisonnement diagnostique
- **Plan pré-construit = P4, pas P1** : "cas de figure imaginé en amont"
- **Mapping situationnel = P2, pas P5** : "Météo? Parking? Hébergement?" = structuration de rubriques

**Catégorie C — Justesse doctrinale du `conforme_ecart`**

Le vérificateur applique la règle de conformité nuancée :
- `v1_conforme = OUI` si `pilier_coeur == pilier_demande` OU si la réponse traite la problématique du pilier demandé par incarnation cognitive
- `v1_conforme = NON` si la candidate dérive, évite ou ne traite pas la problématique

**Catégorie D — Signal limbique (zone périphérique cognitive)**

Le profil cognitif évalue le **COMMENT cognitif** comme objet central. Il s'arrête à cette frontière : il ne se prononce ni sur le **pourquoi** (motivations, valeurs — domaine psychologique), ni sur les émotions en elles-mêmes (domaine affectif).

**MAIS** le profil cognitif inclut la **zone périphérique cognitive** : l'émotionnel et le psychologique détectables dans le verbatim, qui peuvent **perturber l'action cognitive** du candidat. Cette zone périphérique est captée dans `signal_limbique` à l'Étape 1, et **exploitée dans les vigilances en Étape 4**.

**`signal_limbique` capte donc :**
- Les émotions exprimées (aversion, agacement, lassitude, frustration, fierté, stress, soulagement, irritation, etc.)
- Les préférences fortes affichées ("je n'aime pas", "je déteste", "ça me coûte")
- Les effets observables d'une émotion sur le comment cognitif (raccourcissement, blocage, précipitation)
- Les jugements sur soi ou sur la situation qui colorent l'action

**Format obligatoire :**
```
émotion détectée · "citation verbatim qui la révèle"
```

**`signal_limbique` ne capte PAS :**
- Une émotion qu'il faut inférer ou interpréter (sans citation verbatim qui la prouve)
- Une description purement factuelle sans coloration émotionnelle ou psychologique
- Le comment cognitif lui-même (qui va dans `pilier_coeur_analyse`)

**Reste vide** si le verbatim est purement factuel et ne contient aucune trace émotionnelle ou psychologique observable.

**Fonction métier aval :** le `signal_limbique` alimente directement les **vigilances** produites en Étape 4. C'est un input doctrinal, pas un commentaire informatif.

### 4.4 Les 4 modes opérationnels du vérificateur (Décision n°15)

Après avoir examiné les 25 lignes T1, le vérificateur **diagnostique** la nature de la défaillance et choisit son mode.

#### Étape de diagnostic — distribution des erreurs détectées

Pour chaque scénario (SOMMEIL, WEEKEND, ANIMAL, PANNE), le vérificateur compte les erreurs de pilier_coeur détectées (catégorie B). Le seuil de défaillance d'un agent est : **≥ 3 erreurs sur 5 lignes d'un même scénario** (≥ 60%).

Pour ANIMAL qui contient 10 questions, le seuil reste **≥ 3 erreurs sur les 10 lignes** (les erreurs étant cumulées sur les deux moitiés ANIMAL_1 + ANIMAL_2 puisque c'est le même geste cognitif).

#### MODE 1 — Correction ponctuelle (cas normal)

**Déclencheur :** Aucun scénario n'atteint le seuil de défaillance. Les erreurs sont dispersées (typiquement 0 à 3 sur l'ensemble des 25 lignes).

**Action :**
- Le vérificateur applique les corrections doctrinales directement dans Airtable (champs `pilier_coeur_analyse`, `conforme_ecart`, `ecart_detail`, `signal_limbique`, `attribution_pilier_signal_brut` selon les catégories A/B/C/D)
- Trace de chaque correction inscrite dans `corrections_certificateur` de la ligne corrigée
- Verdict global : `CONFORME` si 0 correction, `CORRECTION REQUISE` si corrections appliquées

**Cible :** 0 erreur résiduelle de pilier_coeur. Si 1 erreur résiduelle subsiste après correction (cas marginal d'incertitude doctrinale réelle), elle est tolérée (Décision n°14).

#### MODE 2 — Relance d'agent (scénario défaillant)

**Déclencheur :** Un scénario unique atteint le seuil de défaillance (≥ 3 erreurs sur ses 5 ou 10 lignes), tandis que les autres scénarios sont propres ou avec erreurs dispersées.

**Action :**
- Le vérificateur **n'écrit pas de corrections de surface** sur le scénario défaillant
- Il signale à l'orchestrateur qu'il faut relancer l'analyse T1 du scénario X
- Statut : `REPRENDRE_AGENT1` (avec précision du scénario dans le journal d'audit)
- L'orchestrateur supprime les lignes ETAPE1_T1 de ce scénario et relance T1 uniquement pour ce scénario
- Pour les autres scénarios avec erreurs dispersées : appliquer simultanément MODE 1 (correction ponctuelle)
- Une fois T1 du scénario relancé, le vérificateur **recommence sa vérification** (avec détection éventuelle d'un Mode 3 ou 4 si le problème persiste)

**Limite de récursion :** au maximum **1 relance par scénario** par exécution. Si après relance, le scénario reste défaillant, bascule en MODE 3.

#### MODE 3 — Validation humaine (cas pathologique persistant)

**Déclencheur :** Après une tentative de Mode 1 ou Mode 2, il reste **plus de 1 erreur de pilier_coeur** dans le résultat final ETAPE1_T1.

**Action :**
- Statut : `EN_ATTENTE_VALIDATION_HUMAINE`
- Le pipeline ne progresse pas vers l'Étape 2
- Email automatique envoyé via Resend à `process.env.SUPERVISOR_EMAIL` (configurée à `sibprod@live.fr`)
- Voir Section 17 pour le détail du workflow de validation humaine

#### MODE 4 — Erreur système (problème en amont)

**Déclencheur :** Plusieurs scénarios atteignent simultanément le seuil de défaillance (≥ 2 scénarios avec ≥ 3 erreurs chacun), OU le contrôle d'intégrité du référentiel échoue, OU le JSON retourné par Claude est tronqué malgré retry, OU une erreur HTTP non récupérable d'un service externe (Airtable, Claude API).

**Diagnostic :** quelque chose ne va pas en amont — référentiel corrompu, prompt cassé, panne API, anomalie système.

**Trois cas selon le moment où l'erreur survient :**

- **Cas 4A — Erreur détectée AVANT écriture Airtable** : T1 a fait quelques appels, l'un échoue après retry. Aucune ligne n'est encore en Airtable (rappel : écriture après que les 5 appels aient tous réussi). Reprise complète depuis le début (statut `REPRENDRE_AGENT1`).
- **Cas 4B — Erreur détectée AU MOMENT de l'écriture Airtable** : les 5 appels ont réussi, JSON valide, mais une valeur de singleSelect n'existe pas. Aucune ligne écrite (transaction qui échoue). Reprise complète depuis le début (le code corrige la valeur fautive ou alerte).
- **Cas 4C — Erreur détectée par le VÉRIFICATEUR sur des lignes écrites** : T1 a écrit ses 25 lignes, le vérificateur lit, détecte que ≥ 2 scénarios ont chacun ≥ 3 erreurs (système cassé). Les 25 lignes T1 sont supprimées + reprise complète T1.

**Logique de tentatives (Décision n°24) :**

Le champ `nombre_tentatives_etape1` (number, précision 0) dans `VISITEUR` pilote la logique :

| Tentative | `nombre_tentatives_etape1` | Action |
|---|---|---|
| Première exécution normale | 0 → 1 | Pipeline T1 → vérificateur |
| Mode 4 détecté (1ère fois) | 1 → 2 | Email superviseur + reprise auto T1 (suppression lignes ETAPE1_T1 existantes + relance 5 appels) |
| Mode 4 détecté (2ème fois) | 2 → 3 | Statut `ERREUR` définitif + email d'alerte au superviseur. Plus de reprise automatique — intervention humaine obligatoire |

**Reset du compteur** : quand T1 réussit définitivement (passage à `terminé` ou progression vers Étape 2), le compteur est remis à 0. Comme ça, si plus tard le candidat repasse par T1 (par exemple via `REPRENDRE_AGENT1` manuel), le cycle de tentatives repart de zéro.

**Action lors d'une détection Mode 4 :**
- Statut : `ERREUR` (final si tentative 2 échoue) OU `REPRENDRE_AGENT1` (auto si tentative 1 échoue, pour relance auto)
- Champ `erreur_analyse` enrichi avec le diagnostic technique (cas 4A/4B/4C, scénarios touchés, raison)
- Champ `nombre_tentatives_etape1` incrémenté
- Email automatique envoyé via Resend à `SUPERVISOR_EMAIL` (alerte technique distincte de Mode 3)
- Si tentative 1 KO et tentative 2 enclenchée auto : pas d'attente humaine, le pipeline relance immédiatement

**Mention dans l'email superviseur :** l'email indique clairement s'il s'agit d'une tentative 1 (reprise auto en cours) ou tentative 2 (blocage définitif, action humaine requise).

### 4.5 Ce que le vérificateur T1 ne fait PAS

- Il ne calcule **plus** le `pilier_sortie` (champ abandonné par doctrine du 27/04/2026)
- Il ne refait pas l'analyse de zéro — il vérifie et corrige les dérives manifestes
- Il n'invente pas de règle — il applique uniquement les 4 catégories A/B/C/D + le REFERENTIEL_PILIERS injecté
- Il ne touche pas aux champs purement descriptifs (verbatim_candidat, question_texte, scenario, etc.)

### 4.6 Calibrage technique Vérificateur T1

Le vérificateur traite les 25 lignes en **2 appels distincts** :

| Appel | Lignes | Volume estimé |
|---|---|---|
| 1 | numero_global 1 à 13 (13 lignes) | ~22 000 tokens / 64 000 |
| 2 | numero_global 14 à 25 (12 lignes) | ~20 000 tokens / 64 000 |

**Thinking : ON**. **`max_tokens` : 64 000** par appel. **JSON strict dès la première ligne.**

### 4.7 Consolidation des verdicts

Les verdicts des 2 batches sont consolidés selon la règle **"le plus sévère gagne"** :

`CONFORME` (0) < `FLAG_OBSERVATIONS` (1) < `CORRECTION REQUISE` (2) < `BLOQUANT — CORRECTION REQUISE` (3)

Pour les modes 2/3/4, le verdict global reflète le mode déclenché.

### 4.8 Journal d'audit dans VERIFICATEUR_T1

À chaque exécution complète du vérificateur, **une ligne est écrite dans la table VERIFICATEUR_T1** avec les champs suivants :

| Champ | Contenu |
|---|---|
| `candidat_id` | identifiant du candidat |
| `verdict_global` | verdict consolidé final ou nom du mode déclenché |
| `nb_lignes_verifiees` | 25 (ou moins si erreur partielle) |
| `nb_violations_total` | somme des violations détectées |
| `nb_critique`, `nb_doctrinale`, `nb_observation` | comptage par sévérité |
| `violations_json` | détail JSON des violations + mode déclenché + scénario en cause si Mode 2 |
| `cost_usd` | coût total des appels Claude |
| `elapsed_ms` | durée totale d'exécution |
| `timestamp` | horodatage ISO |

### 4.9 Garde-fous Vérificateur T1 (guards)

| Guard | Condition d'échec | Action |
|---|---|---|
| Guard V1.0 | Référentiel piliers incomplet ou corrompu | Statut ERREUR + arrêt avant toute exécution |
| Guard V1.1 | Verdict d'un batch hors valeurs autorisées | Statut ERREUR — relance via `REPRENDRE_VERIFICATEUR1` |
| Guard V1.2 | JSON invalide (réponse non parsable, tronquée par max_tokens) | Statut ERREUR — relance via `REPRENDRE_VERIFICATEUR1` |
| Guard V1.3 | Patch Airtable échoue | Statut ERREUR — relance via `REPRENDRE_VERIFICATEUR1` |
| Guard V1.4 | Une correction porte sur une ligne `id_question` qui n'existe pas dans ETAPE1_T1 | Warning + skip de cette correction |
| Guard V1.5 | Écriture du journal d'audit dans VERIFICATEUR_T1 échoue | Warning seul (corrections T1 valides) |

### 4.10 Vérification post-patch

Après application des corrections dans Airtable (Mode 1 ou retour de Mode 2), le pipeline **relit ETAPE1_T1** pour vérifier que les 25 lignes sont bien présentes et que les corrections demandées sont effectivement appliquées.

Si la relecture détecte une incohérence (champ non patché, ligne manquante), statut ERREUR — relance via `REPRENDRE_VERIFICATEUR1`.

---

## 5. DOCTRINE TRANSVERSE DE NOMMAGE DES PILIERS ET PÉRIMÈTRE COGNITIF

### 5.1 Source unique de vérité — noms des piliers

| Code interne | Nom officiel (champ `pilier_nom`) |
|---|---|
| `P1` | **Collecte d'information** |
| `P2` | **Tri et organisation** |
| `P3` | **Analyse et diagnostic** |
| `P4` | **Création de solutions** |
| `P5` | **Mise en œuvre et exécution** |

Toute modification de ces noms se fait **uniquement** dans `REFERENTIEL_PILIERS` Airtable. Aucun nom de pilier ne doit être codé en dur dans un prompt ou un service.

### 5.2 Règle d'usage des noms (Décision n°17 — précision)

| Contexte | Format à utiliser |
|---|---|
| **Tables techniques** (clés, références internes, signatures compactes) | Code court : `P1`...`P5` |
| **Champs descriptifs analytiques d'Étape 1** (`pilier_coeur_analyse`, `types_verbatim`, `piliers_secondaires`) | **Forme courte** : `PX · description` |
| **Bilan publié au candidat ou aux acteurs** (Étape 4) | Nom officiel uniquement |
| **Logs internes** (debug, traçabilité technique) | Code court accepté |

### 5.3 Règle d'explicitation

**Toute abréviation utilisée dans un contenu publié doit être explicitée à minima.** Si un bilan utilise `P3`, il doit y avoir au moins une mention en clair quelque part : "P3 — Analyse et diagnostic".

### 5.4 Périmètre du profil cognitif (frontière doctrinale)

| Domaine | Question posée | Place dans Profil-Cognitif |
|---|---|---|
| **Cognitif** | Le COMMENT — comment la personne fait | ✅ **Objet central du protocole** |
| **Périphérie cognitive** | L'émotionnel et le psychologique détectables qui peuvent perturber l'action cognitive | ✅ **Inclus** — capté dans `signal_limbique` (Étape 1), exploité dans les vigilances (Étape 4) |
| **Psychologique pur** | Le POURQUOI — motivations, valeurs, sens | ❌ **Hors périmètre** |
| **Affectif pur** | Les émotions en elles-mêmes (sans interférence cognitive observable) | ❌ **Hors périmètre** |

### 5.5 Doctrine d'analyse des piliers dans une réponse (transverse au protocole)

Cette doctrine s'applique à toutes les analyses du protocole où des piliers cognitifs sont identifiés à partir d'un verbatim (T1, T3, T4).

#### 5.5.1 Principe d'activation séquentielle

**Un seul pilier cognitif est activé à la fois.** Les piliers s'enchaînent dans une **séquence narrative** au fil du verbatim — ils ne s'activent pas en parallèle. Chaque pilier activé a une **force** (intensité du déploiement, profondeur de compétence cognitive mobilisée).

Cette séquence est lue depuis le verbatim brut. Selon où le candidat dépose le **sens central** de sa réponse (où il déploie sa compétence), l'attribution du pilier coeur change.

#### 5.5.2 Pilier coeur unique vs piliers secondaires

| Concept | Définition | Cardinalité |
|---|---|---|
| **Pilier coeur** | Pilier où le candidat déploie sa compétence cognitive la plus profonde dans la réponse | Toujours **un seul** par réponse |
| **Piliers secondaires** | Piliers ≠ pilier coeur qui apparaissent dans la séquence narrative, avec leur position (en amont OU en aval du coeur) | **0, 1 ou plusieurs** selon la réponse |

**Cas vide légitime des piliers secondaires** : si le verbatim entier reste dans le pilier coeur (déploiement cognitif monolithique), il n'y a aucun pilier secondaire. Le champ correspondant est vide, et c'est une information cognitive valide (signal d'un déploiement focalisé).

#### 5.5.3 Lecture de la séquence et exemples doctrinaux

La séquence cognitive observée dans le verbatim détermine l'attribution. Selon où le candidat dépose le sens central, le même enchaînement P1+P3 peut donner :

| Séquence observée | Selon où le sens central est déposé | Coeur | Secondaire(s) |
|---|---|---|---|
| P1 → P3 | Sens central dans P3 (analyse approfondie après collecte) | P3 | P1 en amont du coeur |
| P1 → P3 | Sens central dans P1 (collecte profonde, P3 contextuel) | P1 | P3 en aval du coeur |
| P3 → P1 | Sens central dans P3 (analyse profonde, retour à la collecte signalé) | P3 | P1 en aval du coeur |
| P3 → P1 | Sens central dans P1 (collecte étoffée, analyse préparatoire) | P1 | P3 en amont du coeur |

**Le sens central tranche, pas l'ordre chronologique.** Le contenu de la réponse — où est déployée la compétence — détermine le coeur.

#### 5.5.4 Application aux Étapes ultérieures

- **Étape 1 (T1)** : identification du pilier coeur et des piliers secondaires de chaque réponse — terminologie utilisée : "pilier coeur" et "piliers secondaires"
- **Étape 3 (T3)** : exploitation transverse des 25 lignes pour identifier les **circuits cognitifs activés**
- **Étape 4 (T4)** : attribution de la **signature cognitive** du candidat — terminologie utilisée alors : "pilier socle" et "piliers structurants"

Le terme "structurant" remplace "secondaire" en Étape 4 car à ce stade, ces piliers ne sont plus seulement des piliers présents dans la séquence d'une réponse — ils deviennent des éléments structurants de la signature cognitive globale du candidat.

---

## 6. ARCHITECTURE D'INJECTION DES RÉFÉRENTIELS

### 6.1 Principe

Le pipeline lit les référentiels Airtable **au démarrage** et les injecte dans le payload de chaque appel Claude. Les agents reçoivent donc la doctrine **dans leur message d'entrée** — ils ne peuvent pas l'ignorer.

### 6.2 Pour l'Étape 1

L'orchestrateur lit, au démarrage du pipeline d'un candidat :

| Référentiel | Table Airtable | Injecté dans |
|---|---|---|
| Doctrine des 5 piliers | `REFERENTIEL_PILIERS` (5 enregistrements) | Payload des agents T1 ET payload du vérificateur T1 |

Le contenu injecté comprend pour chaque pilier : code, nom officiel, verbe d'identification, verbes-marqueurs, geste cognitif, 7 modes opérationnels, 4 dimensions d'analyse, pièges et avertissements, exemples Cécile/Rémi/Véronique, capacités observables.

### 6.3 Bénéfices

1. **Source unique de vérité** : la doctrine vit dans Airtable, pas dans le code
2. **Modifications en temps réel** : Isabelle modifie un piège dans Airtable, le pipeline du run suivant l'utilise
3. **Pas de duplication** : le prompt ne réécrit pas la doctrine, il dit comment l'appliquer
4. **Cohérence garantie** : T1 et le vérificateur T1 reçoivent **exactement** la même doctrine

### 6.4 Healthcheck global préalable au pipeline (Décision n°23)

**Principe :** avant tout démarrage de pipeline, à **chaque cycle de polling Render**, l'orchestrateur vérifie que tous les services techniques nécessaires sont opérationnels. Si un service est KO, le pipeline est en pause silencieuse — aucun candidat ne change de statut, aucun token API n'est gaspillé, et le superviseur reçoit une alerte unique par jour.

#### 6.4.1 Services vérifiés à chaque cycle de polling

| Service | Test à effectuer | Critère de succès |
|---|---|---|
| **Airtable** | `GET` simple sur `REFERENTIEL_PILIERS` (table `tblf4OodQ2Qi5xSXs`) | HTTP 200, ≥ 5 enregistrements retournés |
| **Claude API** | Ping minimal sur Sonnet 4.6 (1 token, prompt trivial) | HTTP 200 + réponse non vide |
| **Resend** | `GET` sur `https://api.resend.com/emails` (vérification de statut, pas envoi) | HTTP 2xx |
| **Render** | Trivial : si le polling tourne, Render est up | (auto-vérifié par exécution) |
| **GitHub** | Non vérifié au runtime — seulement vérifié au déploiement par Render | (hors runtime) |

**Pas de healthcheck pour Render et GitHub** au runtime : Render se vérifie lui-même par le simple fait d'exécuter le polling, et GitHub n'est sollicité qu'au moment du déploiement (vérifié par Render automatiquement à ce moment-là).

#### 6.4.2 Comportement si tous les services sont OK

Le pipeline démarre normalement. Le polling cherche un candidat avec `statut_analyse_pivar` ∈ { `NOUVEAU`, `REPRENDRE_AGENT1`, `REPRENDRE_VERIFICATEUR1`, `EN_ATTENTE_VALIDATION_HUMAINE + validation_humaine_etape1=TRUE` } et démarre l'Étape 1 selon le statut.

#### 6.4.3 Comportement si un service est KO

- Le polling **ne démarre aucun pipeline** sur ce cycle
- **Aucun candidat ne change de statut** (les candidats `NOUVEAU` restent `NOUVEAU`, ils seront traités au prochain cycle quand tout sera OK)
- Le service KO est **logué** dans la sortie console Render
- Email automatique d'alerte technique envoyé à `process.env.SUPERVISOR_EMAIL` :
  - Sujet : `[Profil-Cognitif] ALERTE — service <X> indisponible`
  - Corps : nature de l'erreur, timestamp de la première détection
- **Anti-spam : un email max par jour** par service KO (Décision n°23). Si Claude API tombe à 9h et reste KO toute la journée, vous recevez 1 email à 9h + 1 email "service rétabli" quand il revient. Pas 200 emails.
- Quand le service revient (détecté par le polling suivant), un email `[Profil-Cognitif] Service <X> rétabli` est envoyé, et les pipelines reprennent automatiquement

#### 6.4.4 Bénéfices

1. **Aucun token API gaspillé** dans un pipeline qui ne peut pas aboutir
2. **Aucun candidat dans un état incohérent** (statut `en_cours` figé indéfiniment)
3. **Alerte immédiate** au superviseur dès la détection d'une panne
4. **Reprise automatique** quand le service revient (pas d'intervention humaine nécessaire)
5. **Robustesse en production** : le pipeline reste sain même quand l'écosystème externe est dégradé

### 6.5 Conséquence sur les prompts T1 et vérificateur T1

Les prompts deviennent des **modes d'emploi opérationnels** — pas de duplication de la doctrine.

---

## 7. GARDE-FOU D'INTÉGRITÉ RÉFÉRENTIELLE

### 7.1 Principe

Avant tout appel à un agent Claude (T1 ou vérificateur T1), l'orchestrateur **vérifie l'intégrité du référentiel piliers**. Si une anomalie est détectée, le pipeline s'arrête immédiatement avec une erreur claire, **avant toute exécution coûteuse**.

### 7.2 Contrôles effectués

| Contrôle | Condition validée |
|---|---|
| Existence de la table | `REFERENTIEL_PILIERS` accessible et lisible |
| Nombre d'enregistrements | Exactement 5 |
| Codes piliers | Présence de P1, P2, P3, P4, P5 (un seul de chaque) |
| Champ `pilier_nom` | Non vide pour les 5 enregistrements |
| Champ `verbes_marqueurs` | Non vide pour les 5 enregistrements |
| Champ `description_geste` | Non vide pour les 5 enregistrements |

### 7.3 En cas de non-conformité

- Le pipeline ne démarre pas
- Statut → `ERREUR`
- Champ `erreur_analyse` → message explicite
- Aucun appel Claude n'est effectué

---

## 8. BACKUPS vs POINTS DE REPRISE — CLARIFICATION STRUCTURELLE

### 8.1 Distinction essentielle

| Concept | Nature | Localisation | Usage |
|---|---|---|---|
| **Points de reprise techniques** | Données métier complètes | Tables `ETAPE1_T1`, `ETAPE1_T2`, `ETAPE1_T3`, `ETAPE1_T4_BILAN` | Le pipeline lit ces données pour reprendre à une étape |
| **Backups** | Journaux d'audit (résumés textuels avec timestamps) | Champs `backup_*` de la table `VISITEUR` | Diagnostic après coup |

### 8.2 Mécanisme de reprise réel

Le mécanisme de reprise est **uniquement** basé sur le statut `statut_analyse_pivar` + les données présentes dans les tables `ETAPE1_T*`. Les `backup_*` ne participent pas à ce mécanisme.

### 8.3 Décision

Les `backup_*` sont **conservés tels quels** pour audit. Aucune logique de reprise basée dessus.

---

## 9. ANONYMISATION ET CIVILITÉ — RÈGLES TRANSVERSES ÉTAPE 1

### 9.1 Données envoyées aux agents

L'agent T1 et le vérificateur T1 reçoivent dans leur payload :

✅ `candidat_id` (identifiant technique `pcc_xxxxxxxxx`)
✅ `civilite` (`Madame` ou `Monsieur`)
✅ `referentiel_piliers` (doctrine complète)

❌ **JAMAIS `Prenom`, `Nom`, `Email`, `Telephone`** — interdiction absolue

Le `Prenom` reste utilisable pour les **logs internes**, **fichiers de backup**, et **emails superviseur** (Section 17), mais n'apparaît jamais dans le payload des agents Claude.

### 9.2 Style d'écriture pour T1

T1 produit des champs analytiques **descriptifs et techniques**. Aucune mention du prénom dans aucun champ produit.

---

## 10. SCHÉMA DU FLUX DE L'ÉTAPE 1

```
┌─────────────────────────────────────────────────────────────────┐
│  VISITEUR · statut_analyse_pivar = NOUVEAU                      │
└─────────────────────────────────────────────────────────────────┘
                          │ Polling Render détecte
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  ORCHESTRATEUR — DÉMARRAGE                                      │
│  ─ Lit RESPONSES (25 lignes)                                    │
│  ─ Lit REFERENTIEL_PILIERS (5 enregistrements)                  │
│  ─ Lit civilite_candidat                                        │
│  ─ ⚠ GUARD : intégrité référentiel (Section 7)                  │
│  ─ statut_analyse_pivar = en_cours                              │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  AGENT T1 — 5 APPELS PAR SCÉNARIO                               │
│  Payload : civilite + responses + referentiel_piliers           │
│  ─ Appel 1 SOMMEIL  · Appel 2 WEEKEND                           │
│  ─ Appel 3 ANIMAL_1 · Appel 4 ANIMAL_2 · Appel 5 PANNE          │
│  ─ Vérification Guards T1.0 → T1.5                              │
│  ─ Écriture des 25 lignes dans ETAPE1_T1                        │
└─────────────────────────────────────────────────────────────────┘
                          │ ETAPE1_T1 = 25 lignes brutes
                          ▼
┌─────────────────────────────────────────────────────────────────┐
│  VÉRIFICATEUR T1 — 2 APPELS + DIAGNOSTIC 4 MODES                │
│  Payload : civilite + 25 lignes T1 + referentiel_piliers        │
│  ─ Appel 1 : Q1-Q13   · Appel 2 : Q14-Q25                       │
│  ─ Vérification 4 catégories : A, B, C, D                       │
│  ─ DIAGNOSTIC du mode :                                         │
│      MODE 1 → Correction ponctuelle directe (cas normal)        │
│      MODE 2 → Relance agent T1 d'un scénario défaillant         │
│      MODE 3 → EN_ATTENTE_VALIDATION_HUMAINE (Section 17)        │
│      MODE 4 → ERREUR système                                    │
│  ─ Journal d'audit dans VERIFICATEUR_T1                         │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
       Selon le mode, soit : poursuite vers Étape 2
       OU relance T1 du scénario en cause
       OU attente validation humaine
       OU statut ERREUR
```

---

## 11. CRITÈRE DE RÉUSSITE DE L'ÉTAPE 1

L'Étape 1 est réussie si, et seulement si, **les 5 conditions suivantes sont remplies** :

1. Le référentiel piliers a passé le contrôle d'intégrité au démarrage
2. `ETAPE1_T1` contient exactement 25 lignes pour le candidat
3. Chaque ligne contient les 22 colonnes obligatoires au format des références v3
4. Le verdict du vérificateur T1 est `CONFORME`, `FLAG_OBSERVATIONS`, ou `CORRECTION REQUISE` **avec corrections appliquées**
5. **Tolérance pilier_coeur (Décision n°14) :** au maximum 1 erreur résiduelle de pilier_coeur dans le résultat final, et tolérance globale 90% (Décision n°18) sur les autres champs

Si une seule de ces 5 conditions n'est pas remplie, l'Étape 1 a **échoué** et le pipeline ne passe pas à l'Étape 2.

---

## 12. MACHINE À ÉTATS — STATUT_ANALYSE_PIVAR

| Statut | Signification | Action du polling |
|---|---|---|
| `NOUVEAU` | Candidat fraîchement complété | Démarre Étape 1 depuis T1 |
| `REPRENDRE_AGENT1` | Reprise demandée à T1 (par superviseur ou par MODE 2) | Démarre Étape 1 depuis T1 |
| `REPRENDRE_VERIFICATEUR1` | Reprise demandée au vérificateur T1 | Saute T1 (relit ETAPE1_T1), démarre vérificateur T1 |
| `EN_ATTENTE_VALIDATION_HUMAINE` | Pipeline en pause, validation superviseur requise | Ignoré par le polling normal — voir Section 17 pour le polling de validation |
| `REPRENDRE_AGENT2` | Reprise demandée à T2 | Saute Étape 1, démarre T2 |
| `REPRENDRE_AGENT3` | Reprise demandée à T3 | Saute Étapes 1 et 2, démarre T3 |
| `REPRENDRE_VERIFICATEUR4` | Reprise demandée à T4 | Saute toutes étapes amont, démarre T4 |
| `en_cours` | Pipeline en train de tourner | Ignoré (déjà actif) |
| `terminé` | Pipeline complet réussi | Ignoré |
| `ERREUR` | Échec — diagnostic via `erreur_analyse` | Ignoré (reprise manuelle nécessaire) |

**Règle d'or :** une reprise via `REPRENDRE_*` ne réécrit jamais les données déjà validées. Elle reprend strictement à l'étape demandée et relit les données amont depuis Airtable.

---

## 13. SIMULATION OBLIGATOIRE AVANT DÉPLOIEMENT

Avant tout déploiement de fichiers sur GitHub, le pipeline est **simulé mentalement** sur Cécile :

1. Calcul précis des tokens par appel
2. Vérification que chaque appel reste sous le plafond 64 000
3. Vérification que les 22 colonnes produites correspondent au format des références v3
4. Vérification que les 4 catégories de correction du vérificateur couvrent bien les divergences observées
5. Vérification que le contrôle d'intégrité référentielle bloque bien si donnée manquante
6. Vérification que les 4 modes du vérificateur (Section 4.4) sont distinctement déclenchables

Si la simulation détecte un risque, le contrat est ajusté **avant** la production des fichiers.

---

## 14. DÉCISIONS DOCTRINALES ACTÉES

Ces décisions ont été prises par Isabelle Chenais et sont **inscrites définitivement** dans ce contrat :

1. **`id_question`** produit par T1 = recopié tel quel depuis RESPONSES (`P1Q2`, `P2Q15`...). (27/04/2026)

2. **`pilier_sortie`** = champ abandonné. Reste vide. (27/04/2026)

3. **Vérificateur T1 = vérificateur correcteur**. Corrige directement dans Airtable. Pas de validation humaine intermédiaire en cas normal. (27/04/2026)

4. **Civilité** = lue depuis `VISITEUR.civilite_candidat`, transmise aux agents pour les accords grammaticaux. **Aucun prénom ni nom transmis aux agents.** (27/04/2026)

5. **Format `verbes_angles_piliers`** = narratif. (27/04/2026)

6. **Pas de comparaison entre candidats**, jamais. (27/04/2026)

7. **Anonymisation absolue dans les agents Claude.** (27/04/2026)

8. **Doctrine de nommage des piliers** = source unique de vérité = REFERENTIEL_PILIERS. (28/04/2026)

9. **Architecture d'injection des référentiels** = lecture Airtable au démarrage, injection dans le payload des agents. (28/04/2026)

10. **Renommage CERTIFICATEUR_T1 → VERIFICATEUR_T1** dans Airtable. (28/04/2026)

11. **Uniformisation des types Airtable** : ETAPE1_T1 utilise `singleSelect` sur les champs à valeurs contraintes. (28/04/2026)

12. **Périmètre du profil cognitif et zone périphérique cognitive** : COMMENT cognitif comme objet central + zone périphérique (émotionnel et psychologique détectables) captée dans `signal_limbique`. Le pourquoi (motivations, valeurs) et l'affectif pur restent hors périmètre. (28/04/2026)

13. **Traitement individuel exclusif** : le pipeline traite UN candidat à la fois. Jamais plusieurs candidats simultanément, jamais de comparaison inter-candidats. Chaque profil cognitif est individuel et autonome. Les données des autres candidats ne sont jamais lues, transmises ou utilisées dans le traitement d'un candidat. Cette règle s'applique à toutes les étapes (T1, vérificateur T1, T2, T3, T4) et à tous les agents. (28/04/2026)

14. **Tolérance pilier_coeur dans le résultat final ETAPE1_T1** : 0 erreur idéale, **1 erreur résiduelle tolérée** (le vérificateur n'est pas un agent supérieur infaillible). Si > 1 erreur résiduelle après tentative du vérificateur, bascule en MODE 3 (validation humaine). (28/04/2026)

15. **Architecture du vérificateur T1 en 4 modes** : Mode 1 Correction ponctuelle / Mode 2 Relance d'agent T1 sur scénario défaillant / Mode 3 Validation humaine / Mode 4 Erreur système. Diagnostic basé sur la distribution des erreurs par scénario (seuil de défaillance d'un agent : ≥ 3 erreurs sur les lignes du scénario). (28/04/2026)

16. **Workflow de validation humaine asynchrone** : déclenché par MODE 3 ou MODE 4 du vérificateur. Email automatique via Resend à `process.env.SUPERVISOR_EMAIL` (= `sibprod@live.fr`). Le superviseur arbitre via 4 champs Airtable dans VISITEUR (`validation_humaine_etape1`, `validation_humaine_action`, `validation_humaine_motif`, `validation_humaine_date`). Voir Section 17. (28/04/2026)

17. **Forme courte de `pilier_coeur_analyse`** confirmée : `PX · description du geste cognitif central` (sans le nom officiel accolé), conforme aux références v3 Cécile/Rémi/Véronique. La forme longue avec nom officiel reste valable pour les bilans publiés (Étape 4) destinés au candidat et au DRH. (28/04/2026)

18. **Tolérance globale 90%** sur le résultat final de l'Étape 1 (hors pilier_coeur qui est plus strict, voir Décision n°14). Cette tolérance reflète le fait que le profil cognitif est révélé à 90% de fidélité à la doctrine — les marges d'interprétation marginales ne détruisent pas le profil. (28/04/2026)

19. **Pilier coeur identifié par la profondeur de compétence cognitive déployée** par le candidat (savoir-faire mobilisé), pas par le volume. Un candidat qui sait faire et à qui on demande d'expliquer livre spontanément son savoir-faire — sauf chez les candidats laconiques. Les marqueurs de profondeur sont : articulations conditionnelles, hiérarchies argumentées, critères explicites, principes organisateurs, hypothèses testables, exemples concrets. Le **volume** et la **précision** sont des indicateurs indirects, pas des critères premiers. (28/04/2026)

20. **Un seul pilier est activé à la fois** dans une réponse. Les piliers s'enchaînent dans une **séquence narrative** au fil du verbatim — pas d'activation parallèle. Chaque pilier activé a une force (intensité du déploiement). Le sens central de la réponse (où la compétence est déployée) tranche l'attribution du pilier coeur, pas l'ordre chronologique. (28/04/2026)

21. **Pilier coeur unique par réponse** + **piliers secondaires uniquement ≠ pilier coeur** avec leur **position narrative** (en amont du coeur OU en aval du coeur). Pas d'autre position capturée en Étape 1 (pas de "fin de réponse", pas de "en parallèle" — sources d'erreur pour les agents IA). **Cas vide légitime** : si le verbatim reste dans le pilier coeur du début à la fin, le champ `piliers_secondaires` est vide — c'est un signal cognitif valide. Le terme "piliers secondaires" est utilisé en Étape 1 ; il devient "piliers structurants" à partir de l'Étape 4 (signature cognitive). (28/04/2026)

22. **Lecture des `pieges_avertissements` systématique** (avant ET après attribution du pilier), pas conditionnelle. La notion d'"ambiguïté" est subjective — un agent peu vigilant passerait à côté des pièges. La double lecture systématique des pièges du `referentiel_piliers` injecté est un **passage obligé du raisonnement** de l'agent T1, pas un filet de secours optionnel. (28/04/2026)

23. **Healthcheck global préalable de tous les services techniques** à chaque cycle de polling Render, avant tout démarrage de pipeline. Services vérifiés : Airtable (lecture REFERENTIEL_PILIERS), Claude API (ping 1 token), Resend (statut HTTP). Si un service KO : pause silencieuse (aucun candidat ne change de statut), email d'alerte technique unique par jour à `SUPERVISOR_EMAIL` (anti-spam), reprise automatique quand le service revient. Render et GitHub ne sont pas vérifiés au runtime (Render s'auto-vérifie en exécutant le polling, GitHub n'est sollicité qu'au déploiement). (28/04/2026)

24. **Logique de tentatives sur Mode 4 (erreur système)** : champ `nombre_tentatives_etape1` (number, précision 0) dans VISITEUR. Tentative 1 = exécution normale (compteur 0 → 1). Si Mode 4 → email superviseur + reprise auto T1 (compteur 1 → 2, suppression lignes ETAPE1_T1 existantes + relance 5 appels). Si Mode 4 à nouveau → statut `ERREUR` définitif, intervention humaine obligatoire (compteur 2 → 3+). Reset du compteur à 0 quand T1 réussit (passage à `terminé` ou progression vers Étape 2) — comme ça si plus tard le candidat repasse par T1 manuel, le cycle de tentatives repart de zéro. (28/04/2026)

25. **Format `attribution_pilier_signal_brut` chaîné MAJUSCULE/minuscule** : le champ reflète la **séquence narrative effective** du verbatim avec autant de piliers que de piliers parcourus dans l'ordre littéral (retours possibles au même pilier autorisés). Pilier coeur en **MAJUSCULE** (visible d'un coup d'œil), piliers secondaires en **minuscule**. Séparateur ` + `. Verdict après double espace : `Conforme`, `ÉCART`, ou `Conforme (incarne PX)` pour incarnation par un pilier non parcouru. Cas verbatim monolithique : chaîne réduite au pilier coeur en MAJUSCULE seul, sans `+`. Ce format remplace les anciennes formes `PX · PY + PZ Conforme` et `PX → PY Conforme`. Voir Section 3.4bis pour la doctrine complète. (28/04/2026)

26. **Architecture orchestrateur principal + sous-orchestrateurs par étape** : un seul `orchestratorPrincipal.js` lit le statut du candidat dans VISITEUR et décide quel sous-orchestrateur appeler (`orchestratorEtape1.js`, `orchestratorEtape2.js` futur, `orchestratorEtape3.js` futur). Chaque sous-orchestrateur gère le pipeline complet de SON étape (T1 → vérificateur → T2 → ... → bilan). Les services d'infrastructure (Claude, Airtable, healthcheck) sont mutualisés entre toutes les étapes. Bénéfice : isolation des étapes, pas de cascade d'erreurs, extensibilité multi-étapes sans toucher aux étapes existantes. (28/04/2026)

27. **Structure des dossiers GitHub par étape** : sous-dossiers `etape1/`, `etape2/`, `etape3/` dans `new-prompts/`, `services/`, `templates/`. Chaque étape est un univers indépendant. Pour les agents T4 (qui sont en 6 sous-agents), un sous-dossier dédié `etape{N}_t4/` regroupe les 6 sous-agents. Les futures étapes s'ajoutent en créant un dossier, sans toucher aux étapes existantes. Voir Section 20 pour la structure complète. (28/04/2026)

28. **Pattern de nommage `verificateur{niveau}_t{X}` lié à l'agent vérifié** : un vérificateur est toujours rattaché à un agent précis. Format : `verificateur{niveau}_t{X}.txt` pour le prompt, `agentT{X}VerificateurService.js` pour le service Node.js. Le numéro `{niveau}` indique le **niveau de vérification** (1 = vérification de premier niveau, 2 = vérification d'un vérificateur si jamais nécessaire). Le numéro `{X}` indique l'agent vérifié (T1, T2, T3, T4). Le terme **vérificateur** remplace **certificateur** dans tout le projet (Décision n°10). Le **certificateur** reste un objet distinct, réservé à la certification finale du bilan complet. (28/04/2026)

29. **Pas de promesse de délai garanti, mais robustesse garantie** : la profondeur méthodologique de Profil-Cognitif (analyse cognitive complète, vérification doctrinale, bilan structuré) impose des temps de calcul incompressibles. Le système ne garantit pas un délai fixe (ce serait mensonger). Le système garantit en revanche **la robustesse de bout en bout** : chaque candidat aboutit, jamais bloqué silencieusement, avec backups + vérificateur + healthcheck + Mode 4 reprise auto + Mode 3 validation humaine. Communication client : "Bilan livré sous 72h en moyenne, garanti sous 72h max" (voir Décision n°34). Cette décision conditionne toute l'architecture : robustesse > vitesse. (28/04/2026)

30. **Polling agressif (60 secondes au lieu de 5 minutes)** : variable d'environnement `POLLING_INTERVAL` passe de **300000 ms (5 min)** à **60000 ms (1 min)** par défaut. Gain immédiat : -4 minutes en moyenne par candidat sur le délai d'attente avant démarrage. Aucun risque technique (Airtable supporte largement ce volume de requêtes pour des bases de cette taille). Configurable via env Render. (28/04/2026)

31. **Capacité serveur connue et documentée** : sur Render Starter (1 CPU, MAX_CONCURRENT=1) avec un bilan complet 3 étapes prenant 1h30 en moyenne, la capacité maximale théorique est de **16 candidats/jour**, capacité réaliste **10-12 candidats/jour** (avec marges). Au-delà : upgrade Render nécessaire (plan Standard ou Pro) ou augmentation de `MAX_CONCURRENT` si l'application est conçue pour gérer la concurrence. Surveillance automatique : si la queue dépasse 24 candidats en attente, alerte automatique au superviseur. Phase démarrage commercial (3-6 premiers mois) = capacité actuelle largement suffisante. (28/04/2026)

32. **Vérificateur existant ⇔ vérificateur exécuté** (présence du fichier prompt = doctrine) : à la conception de chaque étape ou de chaque agent, Isabelle décide doctrinalement si un vérificateur est nécessaire. Si oui, elle fournit le prompt `verificateur{niveau}_t{X}.txt` correspondant. Si non, le fichier n'existe pas et l'orchestrateur passe directement à l'agent suivant. **L'orchestrateur détecte la présence du vérificateur par la présence du fichier prompt**, pas par une variable d'environnement. État actuel pour l'Étape 1 : `verificateur1_t1.txt` existe (vérificateur OBLIGATOIRE car T1 = fondement du profiling) ; `verificateur1_t2.txt`, `verificateur1_t3.txt`, `verificateur1_t4.txt` n'existent pas (à créer plus tard si nécessaire). Bénéfice : la doctrine est dans l'arborescence des fichiers, pas dans une configuration cachée. (28/04/2026)

33. **Communication candidat asynchrone** : 4 emails automatiques au candidat selon le calendrier suivant : **Email T0** (à la réception des 25 réponses) confirmation + annonce du délai ; **Email T0+24h** si bilan prêt → livraison, sinon rien ; **Email T0+48h** si bilan prêt → livraison, sinon rappel "en cours d'élaboration approfondie" ; **Email T0+72h** si bilan toujours pas prêt → alerte interne au superviseur pour intervention. Service dédié : `notificationCandidatService.js` qui tourne 1 fois par heure. Tracking dans VISITEUR : champs `email_T0_envoye`, `email_24h_envoye`, `email_48h_envoye`, `email_72h_envoye` (4 booléens). Ton des emails : sobre, professionnel, valorisant le délai comme signal de qualité méthodologique (et non comme une faiblesse). Voir Section 24 pour les templates. (28/04/2026)

34. **Délai d'engagement client : bilan livré sous 72h max** : engagement par défaut communiqué au candidat = "Bilan livré sous 72h". En pratique : 90% des bilans livrés sous 24h, 9% entre 24-48h, 1% nécessitant intervention humaine (Mode 3 du vérificateur ou Mode 4 erreur système). Buffer de 72h permet d'absorber : pic de queue, intervention humaine Mode 3, panne API ponctuelle, retry exponentiel. Si un candidat dépasse 72h, alerte automatique au superviseur (voir Décision n°33). Au-delà de la phase de démarrage, ce délai pourra être ramené à 48h ou 24h une fois la fiabilité statistique mesurée. (28/04/2026)

---

## 15. PRINCIPES DE TRAVAIL POUR L'AGENT QUI EXÉCUTE CE CONTRAT

1. **Aucune décision doctrinale n'est prise sans validation explicite d'Isabelle Chenais.**

2. **Avant toute modification d'un fichier, vérifier que la modification est traçable à une clause du contrat.**

3. **Avant tout déploiement, simuler sur Cécile.**

4. **Si une instruction du contrat semble contradictoire avec une demande en cours, signaler la contradiction.**

5. **Ce contrat est une référence unique.** Quand une nouvelle conversation démarre, ce contrat doit être relu en premier. Il prime sur la mémoire conversationnelle de l'agent.

6. **À chaque avancée, faire le point sur les incidences sur l'existant et sur les conséquences à venir.**

---

## 16. GOUVERNANCE DU CONTRAT

| Acteur | Pouvoirs |
|---|---|
| Isabelle Chenais | Seule autorité de modification doctrinale du contrat |
| Agent technique (Claude) | Propose des ajustements, n'en valide aucun |
| Pipeline (Render) | Exécute le contrat, ne le modifie jamais |

Toute modification du contrat fait l'objet d'une **nouvelle version datée** et est tracée dans le journal de version.

---

## 17. WORKFLOW DE VALIDATION HUMAINE ASYNCHRONE (DÉCISION N°16)

### 17.1 Principe

En cas de défaillance pathologique non rattrapable automatiquement (Mode 3 du vérificateur T1), le pipeline ne plante pas et ne progresse pas non plus. Il **suspend** son exécution et **sollicite une validation humaine asynchrone** du superviseur.

C'est un **filet de sécurité** pour les cas pathologiques rares — pas un mode de fonctionnement normal.

### 17.2 Infrastructure Airtable

**Table `VISITEUR`** — 4 champs créés le 28/04/2026 pour ce workflow :

| Champ | Type | Rôle |
|---|---|---|
| `validation_humaine_etape1` | checkbox | Cochée par le superviseur quand il a arbitré. Le polling Render détecte cette case et déclenche l'action choisie. |
| `validation_humaine_action` | singleSelect (4 choix) | `RELANCER_AGENT_T1` / `RELANCER_VERIFICATEUR_T1` / `ACCEPTER_TEL_QUEL` / `ABANDONNER` |
| `validation_humaine_motif` | multilineText | Texte libre du superviseur expliquant son choix (audit) |
| `validation_humaine_date` | dateTime (Europe/Paris) | Horodatage de la validation |

**Champ `statut_analyse_pivar`** : nouveau choix `EN_ATTENTE_VALIDATION_HUMAINE` ajouté.

### 17.3 Infrastructure Render

**Variables d'environnement déjà configurées :**
- `RESEND_API_KEY` : clé API Resend pour envoi d'emails
- `SUPERVISOR_EMAIL` = `sibprod@live.fr` : destinataire des alertes

### 17.4 Déclenchement (côté pipeline)

Quand le vérificateur T1 bascule en MODE 3 (Section 4.4) :

1. Le pipeline passe `statut_analyse_pivar = EN_ATTENTE_VALIDATION_HUMAINE`
2. Le pipeline **n'écrit rien** dans `validation_humaine_*` (ces champs sont remplis par le superviseur)
3. Le service `validationHumaineService.js` envoie un email via Resend à `SUPERVISOR_EMAIL`
4. Le pipeline s'arrête là pour ce candidat (les autres candidats continuent à être traités normalement)

### 17.5 Format de l'email superviseur

**Sujet** : `[Profil-Cognitif] Validation requise — candidat <Prenom>`

**Corps** :
- **Identification** : Prenom, candidate_ID
- **Diagnostic du vérificateur** : nombre d'erreurs détectées, piliers concernés, scénarios concernés, mode déclenché
- **Lien direct** vers la ligne `VISITEUR` Airtable du candidat (calculé à la volée par le code)
- **Lien direct** vers les 25 lignes `ETAPE1_T1` Airtable filtrées par candidate_ID
- **Lien HTML futur** vers la visualisation Étape 1 (Section 18 — chantier futur)
- **Instructions** : 
  - Cocher `validation_humaine_etape1`
  - Choisir `validation_humaine_action` parmi les 4 options
  - Renseigner `validation_humaine_motif` (recommandé pour audit)
  - La date est remplie automatiquement par le code Render après traitement (le superviseur peut aussi la mettre à la main)

### 17.6 Détection et traitement (côté polling)

Le polling Render, en plus de surveiller les statuts normaux, surveille aussi :

```
filter: statut_analyse_pivar = "EN_ATTENTE_VALIDATION_HUMAINE" 
        AND validation_humaine_etape1 = TRUE
```

Quand un candidat correspond à ce filtre, le service `validationHumaineService.js` :

1. Lit la valeur de `validation_humaine_action`
2. Exécute l'action correspondante :
   - **`RELANCER_AGENT_T1`** : supprime les 25 lignes ETAPE1_T1 du candidat, statut → `REPRENDRE_AGENT1`
   - **`RELANCER_VERIFICATEUR_T1`** : laisse les lignes T1 en place, statut → `REPRENDRE_VERIFICATEUR1`
   - **`ACCEPTER_TEL_QUEL`** : pas de modification des données, statut → `en_cours` (passe à T2)
   - **`ABANDONNER`** : statut → `ERREUR` avec motif "ABANDONNÉ par superviseur le <date> : <motif>"
3. **Décoche `validation_humaine_etape1`** (pour éviter ré-déclenchement)
4. Met à jour `validation_humaine_date` avec horodatage actuel si vide
5. Le pipeline normal reprend à partir du nouveau statut

### 17.7 Cas du MODE 4 (Erreur système)

Pour MODE 4 (erreur système distincte de la validation doctrinale) :

- Statut : `ERREUR` (pas `EN_ATTENTE_VALIDATION_HUMAINE`)
- Email distinct envoyé à `SUPERVISOR_EMAIL` avec sujet `[Profil-Cognitif] ERREUR système — candidat <Prenom>`
- Le corps contient : diagnostic technique (`erreur_analyse`), liens Airtable, indication qu'une intervention dev (et non doctrinale) est requise
- Pas de workflow Airtable de validation — c'est un problème à diagnostiquer puis relancer manuellement

### 17.8 Limites et garde-fous

- **Pas de boucle infinie** : si après une validation humaine, le candidat re-déclenche un MODE 3 (par exemple le superviseur a choisi `RELANCER_AGENT_T1` mais le problème persiste), le compteur `nombre_tentatives_analyse` (champ existant dans VISITEUR) est incrémenté. Au-delà de 3 tentatives, statut → `ERREUR` automatique avec motif "Validation humaine répétée sans résolution".
- **Sécurité Airtable** : aucun autre acteur que le superviseur ne doit cocher `validation_humaine_etape1`. Cette discipline est humaine, pas technique — Airtable n'a pas de permission par champ dans le plan utilisé.
- **Audit complet** : chaque cycle (déclenchement, validation, action) génère une ligne dans `VERIFICATEUR_T1` avec `mode = MODE_3` et trace de l'action choisie.

---

## 18. CHANTIERS FUTURS IDENTIFIÉS (HORS PÉRIMÈTRE ÉTAPE 1)

Ces chantiers sont **identifiés mais ne font PAS partie de la livraison de l'Étape 1**. Ils sont notés ici pour ne pas être oubliés et pour clarifier les attentes.

### 18.1 Génération HTML dynamique pour toutes les étapes

**Contexte :** Isabelle dispose actuellement de 3 fichiers HTML statiques de référence (`tableau1_cecile_v3.html`, `tableau1_remi_v3.html`, `tableau1_veronique_v3.html`) qui constituent la **mise en page cible** pour la visualisation de l'Étape 1.

**Objectif futur :** générer dynamiquement, pour **chaque étape** (T1, T2, T3, T4) et pour **chaque candidat**, une page HTML qui reproduit cette mise en page, alimentée par les données Airtable du candidat.

**Pourquoi c'est important :**
- Permet au superviseur (workflow Section 17) de visualiser **immédiatement et lisiblement** ce qu'a produit le pipeline, sans devoir filtrer manuellement Airtable
- Permet aux DRH/recruteurs/référents (Étape 4) d'accéder à un livrable propre
- Pattern reproductible pour T2, T3, T4 avec leurs propres mises en page

**Architecture cible (à définir précisément lors du chantier) :**
- Route Render : `/etape<N>/<candidate_ID>` qui sert un HTML
- Lecture des données Airtable correspondantes au candidat
- Application du template HTML de référence
- Retour HTML stylé prêt à être visualisé dans navigateur

**Champ Airtable à créer plus tard dans VISITEUR :**
- `lien_html_etape1`, `lien_html_etape2`, `lien_html_etape3`, `lien_html_etape4` (formules calculant l'URL)
- Pattern unifié pour les 4 étapes

**Pourquoi ce chantier est REPORTÉ :**
1. La priorité actuelle est de **stabiliser fonctionnellement l'Étape 1** (T1 + vérificateur correctement orchestrés, validation humaine opérationnelle)
2. La génération HTML est cosmétique tant que le moteur d'analyse n'est pas robuste
3. En attendant, le superviseur peut accéder aux 25 lignes ETAPE1_T1 directement via Airtable (vue filtrée par `candidat_id`)

**Quand ce chantier démarrera :**
Après que :
- Les prompts T1 et vérificateur T1 sont produits et validés
- Les services Node.js correspondants sont produits et validés
- Le déploiement de l'Étape 1 a eu lieu et fonctionne sur Cécile, Rémi, Véronique

**Engagement :** ce chantier sera fait. Il est **noté ici dans le contrat** pour qu'il ne soit pas oublié quand l'Étape 1 sera stabilisée.

### 18.2 Nettoyage des champs legacy de RESPONSES

Les 80+ champs d'analyse legacy de RESPONSES (`analyse_json_agent1`, `pilier_reponse_coeur`, `circuits_actives`, etc.) ne sont pas utilisés par le pipeline actuel. À nettoyer ultérieurement par Isabelle pour clarifier la base.

### 18.3 Pattern HTML pour validation humaine multi-étapes

Quand la génération HTML sera en place, étendre le workflow de validation humaine (Section 17) à toutes les étapes T2, T3, T4. Les champs `validation_humaine_etape<N>` seront créés selon le pattern de l'Étape 1.

### 18.4 Services Node.js à créer ou mettre à jour en Phase E

Pour rappel des services à produire en Phase E (refonte du code) :

| Service | État | Rôle |
|---|---|---|
| `healthcheckService.js` | **À créer** (lié à Décision n°23) | Vérifie Airtable, Claude API, Resend à chaque cycle de polling. Gère l'anti-spam (1 email par jour par service KO). |
| `validationHumaineService.js` | **À créer** (lié à Décision n°16) | Envoi des emails Resend Mode 3/4. Polling de la case `validation_humaine_etape1`. Application des actions selon `validation_humaine_action`. |
| `agentT1Service.js` | À refondre | 5 appels par scénario, injection référentiel piliers, écriture des 25 lignes après succès complet. |
| `agentT1VerificateurService.js` | À refondre | 4 modes opérationnels, journal d'audit dans VERIFICATEUR_T1, gestion `nombre_tentatives_etape1`. |
| `orchestratorService.js` | À refondre en deux fichiers (Décision n°26) | Devient `orchestratorPrincipal.js` (chef d'orchestre) + `orchestratorEtape1.js` (sous-chef Étape 1). |
| `notificationCandidatService.js` | **À créer** (lié à Décision n°33) | Service d'envoi automatique des emails T0, +24h, +48h, +72h au candidat. |

---

## 19. ARCHITECTURE CIBLE — ORCHESTRATEUR PRINCIPAL + SOUS-ORCHESTRATEURS PAR ÉTAPE

(Décision n°26)

### 19.1 Principe — métaphore de la cuisine

Pour la robustesse et l'extensibilité multi-étapes (Étape 1, Étape 2, Étape 3), l'architecture suit le modèle d'une cuisine de restaurant :

- 🍴 **Le chef de cuisine** = `orchestratorPrincipal.js`
  - Lit le statut du candidat dans VISITEUR
  - Décide à quel sous-chef envoyer le candidat selon où il en est dans le pipeline
  - Surveille la santé globale (healthcheck préalable, Décision n°23)
  - Sait quand arrêter pour ne pas surcharger Render ou Claude API

- 👨‍🍳 **Les sous-chefs** = un orchestrateur par étape
  - `orchestratorEtape1.js` : sait gérer T1 → vérificateur T1 → T2 → (vérif T2 si existe) → T3 → (vérif T3 si existe) → T4 → certificateur lexique
  - `orchestratorEtape2.js` (futur) : sait gérer le pipeline complet de l'Étape 2
  - `orchestratorEtape3.js` (futur) : idem pour l'Étape 3

- 🔧 **Les outils communs** = services d'infrastructure mutualisés
  - `claudeService.js` (les couteaux : appel API Claude)
  - `airtableService.js` (le frigo : lecture/écriture Airtable)
  - `backupService.js` (le carnet de bord : snapshots de progression)
  - `agentBase.js` (la table de travail : chargement des prompts mutualisé pour tous les agents)
  - `healthcheckService.js` (le poste de garde : vérifie Airtable + Claude API + Resend avant chaque cycle)
  - `validationHumaineService.js` (le téléphone vers Isabelle : Mode 3 du vérificateur)
  - `notificationCandidatService.js` (les emails au candidat : Décision n°33)
  - `errorClassifier.js` + `logger.js` (les utilitaires)

### 19.2 Flux d'exécution complet

```
┌─────────────────────────────────────────────────────────────────────┐
│ Frontend candidat ──webhook──> Airtable                             │
│                    statut_analyse = NOUVEAU                          │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Render polling (toutes les 60 secondes — Décision n°30)             │
│ ──> queueService.runPollingCycle()                                  │
│      └── lit Airtable, ajoute candidats à la queue                  │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ healthcheckService (Décision n°23)                                  │
│ ──> Airtable OK ? Claude API OK ? Resend OK ?                       │
│ ──> Si KO : pause silencieuse + alerte technique                    │
│ ──> Si OK : poursuite                                               │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ orchestratorPrincipal.processCandidate(session_id)                  │
│ ──> Lit statut VISITEUR.statut_analyse_pivar                        │
│ ──> Aiguille vers le bon sous-orchestrateur                         │
└─────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
        ┌─────────────────────────┼─────────────────────────┐
        ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ orchestrator    │    │ orchestrator    │    │ orchestrator    │
│ Etape1.run()    │    │ Etape2.run()    │    │ Etape3.run()    │
│                 │    │ (futur)         │    │ (futur)         │
│ T1              │    │ T1              │    │ ...             │
│ ↓               │    │ ↓               │    │                 │
│ verif T1*       │    │ verif T1*       │    │                 │
│ ↓               │    │ ↓               │    │                 │
│ T2              │    │ T2              │    │                 │
│ ↓               │    │                 │    │                 │
│ (verif T2 si    │    │                 │    │                 │
│  fichier existe)│    │                 │    │                 │
│ ↓               │    │                 │    │                 │
│ T3              │    │                 │    │                 │
│ ↓               │    │                 │    │                 │
│ T4 (6 sous-     │    │                 │    │                 │
│  agents)        │    │                 │    │                 │
│ ↓               │    │                 │    │                 │
│ certif lexique  │    │                 │    │                 │
└─────────────────┘    └─────────────────┘    └─────────────────┘
        │                         │                         │
        └─────────────────────────┼─────────────────────────┘
                                  ▼
┌─────────────────────────────────────────────────────────────────────┐
│ statut_analyse_pivar = 'terminé' ou 'ERREUR'                        │
│ Email candidat livraison (notificationCandidatService)              │
└─────────────────────────────────────────────────────────────────────┘
```

*\* Le vérificateur n'est exécuté que si son fichier prompt existe (Décision n°32).*

### 19.3 Bénéfices

1. **Isolation des étapes** : si l'Étape 1 plante, l'Étape 2 ne tente rien (pas de cascade d'erreurs)
2. **Extensibilité** : ajout de l'Étape 2 = créer un fichier `orchestratorEtape2.js`, ne pas toucher à l'Étape 1
3. **Lisibilité** : chaque sous-orchestrateur a une responsabilité unique et claire
4. **Robustesse** : `MAX_CONCURRENT=1` garanti, healthcheck préalable, backups par étape
5. **Pas de microservices** : un seul process Node.js sur Render, pas de complexité externe

### 19.4 Détection automatique des vérificateurs (Décision n°32)

Le sous-orchestrateur d'étape applique cette logique pour chaque agent :

```
Pour chaque agent à exécuter dans le pipeline de l'étape :
  1. Exécuter l'agent (ex. T1, T2, T3, T4, ...)
  
  2. Vérifier si le fichier prompt vérificateur existe dans le système de fichiers :
     "new-prompts/etape{N}/verificateur1_t{X}.txt"
  
  3a. Si OUI → exécuter agentT{X}VerificateurService (modes 1/2/3/4 du contrat v1.6)
  3b. Si NON → passer directement à l'agent suivant
```

C'est une **convention par fichier**, pas par configuration. Quand Isabelle décide d'ajouter un vérificateur sur T2, elle conçoit le prompt `verificateur1_t2.txt`, le pousse dans GitHub, et l'orchestrateur le détecte automatiquement au prochain run. Aucun changement de code requis.

---

## 20. STRUCTURE DES DOSSIERS GitHub (DÉCISION n°27)

### 20.1 Structure cible globale

```
profil-cognitif/                       (racine du repo GitHub)
│
├── server.js                           ← point d'entrée Render (HTTP + démarrage polling)
├── package.json                        ← métadonnées Node.js + dépendances npm
├── env.example                         ← modèle des variables d'environnement
├── README.md                           ← documentation projet (à créer)
├── .gitignore                          ← exclusions Git
│
├── docs/                               ← Documentation et contrats
│   ├── CONTRAT_ETAPE1.md                ← contrat doctrinal Étape 1 (v1.7+)
│   ├── CONTRAT_ETAPE2.md                ← futur (à concevoir)
│   ├── CONTRAT_ETAPE3.md                ← futur
│   ├── REFERENTIEL_LEXIQUE_BILAN.md     ← doctrine du lexique
│   └── ORCHESTRATEUR_CORRIGE.md         ← documentation technique de l'orchestrateur
│
├── config/                             ← Configuration (constantes)
│   ├── claude.js                        ← config API Claude (modèle, max_tokens, thinking)
│   └── airtable.js                      ← config Airtable (BASE_ID, TABLES, FIELDS)
│
├── routes/                             ← Couche HTTP Express
│   └── index.js                         ← endpoints /webhook /analyze /status /api/...
│
├── services/                           ← Logique métier
│   │
│   ├── orchestrators/                   ← Orchestrateurs (chef + sous-chefs)
│   │   ├── orchestratorPrincipal.js    ← chef de cuisine
│   │   ├── orchestratorEtape1.js       ← sous-chef Étape 1
│   │   ├── orchestratorEtape2.js       ← futur
│   │   └── orchestratorEtape3.js       ← futur
│   │
│   ├── flux/                            ← Gestion débit + sécurité
│   │   ├── queueService.js             ← FIFO + polling Airtable
│   │   ├── healthcheckService.js       ← (à créer) vérifie services externes
│   │   ├── validationHumaineService.js ← (à créer) Mode 3 vérificateur
│   │   └── notificationCandidatService.js ← (à créer) emails candidat
│   │
│   ├── infrastructure/                  ← Outils communs partagés entre étapes
│   │   ├── claudeService.js            ← wrapper API Claude
│   │   ├── airtableService.js          ← wrapper Airtable
│   │   ├── backupService.js            ← snapshots de progression
│   │   └── agentBase.js                ← chargement prompts mutualisé
│   │
│   ├── etape1/                          ← Agents et vérificateurs Étape 1
│   │   ├── agentT1Service.js
│   │   ├── agentT1VerificateurService.js
│   │   ├── agentT2Service.js
│   │   ├── agentT2VerificateurService.js   ← (futur, si nécessaire)
│   │   ├── agentT3Service.js
│   │   ├── agentT3VerificateurService.js   ← (futur, si nécessaire)
│   │   └── etape1_t4/                       ← T4 = 6 sous-agents
│   │       ├── agentT4ArchitectureService.js
│   │       ├── agentT4CircuitsService.js
│   │       ├── agentT4ModeService.js
│   │       ├── agentT4SyntheseService.js
│   │       ├── agentT4CoutsService.js
│   │       ├── agentT4TransversesService.js
│   │       ├── agentT4VerificateurService.js   ← (futur, si nécessaire)
│   │       └── prepareT4Inputs.js
│   │
│   ├── etape2/                          ← futur
│   │   └── ...
│   │
│   ├── etape3/                          ← futur
│   │   └── ...
│   │
│   └── certificateurs/                  ← Certificateurs de bilan global
│       └── certificateurLexiqueService.js  ← certifie le bilan complet
│
├── new-prompts/                        ← Texte des prompts Claude
│   │
│   ├── etape1/                          ← Prompts Étape 1
│   │   ├── etape1_t1.txt
│   │   ├── verificateur1_t1.txt
│   │   ├── etape1_t2.txt
│   │   ├── verificateur1_t2.txt        ← (futur, si nécessaire)
│   │   ├── etape1_t3.txt
│   │   ├── verificateur1_t3.txt        ← (futur, si nécessaire)
│   │   └── etape1_t4/
│   │       ├── AGENT_1_ARCHITECTURE.md
│   │       ├── AGENT_2_CIRCUITS.md
│   │       ├── AGENT_3_MODE.md
│   │       ├── AGENT_4_SYNTHESE_COEUR.md
│   │       ├── AGENT_5_COUTS_CLOTURE.md
│   │       ├── AGENT_6_TRANSVERSES.md
│   │       └── verificateur1_t4.md      ← (futur, si nécessaire)
│   │
│   ├── etape2/                          ← futur
│   │   └── ...
│   │
│   ├── etape3/                          ← futur
│   │   └── ...
│   │
│   └── partages/                        ← Prompts partagés entre étapes
│       ├── PROMPT_BLOCS_LEXIQUE.md     ← doctrine partagée du lexique
│       └── PROMPT_CERTIFICATEUR.md     ← certificateur lexique global
│
├── templates/                          ← Templates de bilan (HTML/markdown)
│   │
│   ├── etape1/
│   │   └── etape1_t4/
│   │       ├── LOT_A_TEMPLATES_SYNTHESE.md
│   │       ├── LOT_B_TEMPLATES_COUTS.md
│   │       ├── LOT_C_TEMPLATES_ARCHITECTURE.md
│   │       ├── LOT_D_TEMPLATE_MODES.md
│   │       ├── LOT_E_TEMPLATES_TRANSVERSES.md
│   │       └── TEMPLATE_01_DESCRIPTION.md
│   │
│   ├── etape2/                          ← futur
│   └── etape3/                          ← futur
│
└── utils/                              ← Utilitaires bas niveau
    ├── logger.js                        ← logger structuré
    └── errorClassifier.js               ← classification erreurs Claude/Airtable
```

### 20.2 Conventions de nommage

| Élément | Convention | Exemples |
|---|---|---|
| Prompt agent | `etape{N}_t{X}.txt` | `etape1_t1.txt`, `etape2_t1.txt` |
| Prompt vérificateur | `verificateur{niveau}_t{X}.txt` | `verificateur1_t1.txt`, `verificateur2_t1.txt` (futur) |
| Service agent Node.js | `agentT{X}Service.js` | `agentT1Service.js`, `agentT2Service.js` |
| Service vérificateur Node.js | `agentT{X}VerificateurService.js` | `agentT1VerificateurService.js` |
| Sous-orchestrateur | `orchestratorEtape{N}.js` | `orchestratorEtape1.js` |
| Dossier d'étape | `etape{N}/` | `etape1/`, `etape2/`, `etape3/` |
| Dossier T4 (cas spécial) | `etape{N}_t4/` | `etape1_t4/` (regroupe 6 sous-agents) |

### 20.3 Règle d'or de l'extensibilité

**Une nouvelle étape ne touche jamais aux étapes existantes.** Quand on ajoutera l'Étape 2 :

1. Créer `services/etape2/` avec les agents
2. Créer `services/orchestrators/orchestratorEtape2.js`
3. Créer `new-prompts/etape2/` avec les prompts
4. Créer `templates/etape2/` si bilan
5. Créer `docs/CONTRAT_ETAPE2.md`
6. Modifier UN seul fichier existant : `orchestratorPrincipal.js` (pour aiguiller vers le nouveau sous-orchestrateur)

**Aucune autre modification dans les fichiers d'Étape 1.**

---

## 21. TABLEAU D'IMPACT — CARTE DES DÉPENDANCES

(Outil de contrôle pour Isabelle : si on modifie X, vérifier Y, Z, W)

### 21.1 Modifications de prompts

| Fichier modifié | Vérifier également |
|---|---|
| `new-prompts/etape{N}/etape{N}_t{X}.txt` | `services/etape{N}/agentT{X}Service.js` (parsing JSON cohérent ?), `services/infrastructure/airtableService.js` (champs cohérents ?), `config/airtable.js` (FIELDS à jour ?), `config/claude.js` (config `agent_t{X}`) |
| `new-prompts/etape{N}/verificateur1_t{X}.txt` | `services/etape{N}/agentT{X}VerificateurService.js`, `airtableService.js` (méthodes patch), `config/claude.js` (config `agent_t{X}_verificateur`) |
| `new-prompts/etape{N}/etape{N}_t4/AGENT_*.md` | `services/etape{N}/etape{N}_t4/agentT4*Service.js` correspondant, `prepareT4Inputs.js`, `airtableService.js`, `config/claude.js` |
| `new-prompts/partages/PROMPT_BLOCS_LEXIQUE.md` | `services/infrastructure/agentBase.js` (chargement lexique), tous les agents qui injectent le lexique |

### 21.2 Modifications de services agents

| Fichier modifié | Vérifier également |
|---|---|
| `services/etape{N}/agentT{X}Service.js` | `services/orchestrators/orchestratorEtape{N}.js` (signature cohérente ?), `services/infrastructure/agentBase.js`, `airtableService.js` (méthodes d'écriture), prompt correspondant, `config/claude.js` |
| `services/etape{N}/agentT{X}VerificateurService.js` | `services/orchestrators/orchestratorEtape{N}.js` (require + appel), `airtableService.js` (méthodes patch), prompt vérificateur, `config/claude.js` |

### 21.3 Modifications de services infrastructure

| Fichier modifié | Vérifier également |
|---|---|
| `services/orchestrators/orchestratorPrincipal.js` | `routes/index.js` (signature `processCandidate` cohérente ?), tous les sous-orchestrateurs (require + signature), `services/flux/queueService.js`, `airtableService.js` (statuts) |
| `services/orchestrators/orchestratorEtape1.js` | `orchestratorPrincipal.js` (require), TOUS les agents Étape 1 (signatures cohérentes), `airtableService.js` (machine à états), `backupService.js` (étapes backup) |
| `services/infrastructure/agentBase.js` | **TOUS les agents** (impact massif !), `claudeService.js`, `airtableService.js` (lecture lexique). Modification très critique. |
| `services/infrastructure/claudeService.js` | TOUS les agents indirectement (via `agentBase`), `config/claude.js`, `errorClassifier.js` |
| `services/infrastructure/airtableService.js` | **TOUS les agents** (écriture/lecture), tous les orchestrateurs, `backupService.js`, `queueService.js`, `routes/index.js`, `config/airtable.js` |
| `services/flux/queueService.js` | `server.js` (démarrage polling cohérent ?), `orchestratorPrincipal.js`, `routes/index.js`, `errorClassifier.js`, `airtableService.js` |
| `services/flux/healthcheckService.js` | `orchestratorPrincipal.js` (appel à chaque cycle), `claudeService.js`, `airtableService.js`, ENV (`SUPERVISOR_EMAIL`, `RESEND_API_KEY`) |
| `services/flux/validationHumaineService.js` | `orchestratorEtape1.js` (déclenchement Mode 3), `airtableService.js` (champs `validation_humaine_*`), ENV |
| `services/flux/notificationCandidatService.js` | `orchestratorPrincipal.js` (déclenchement T0), `airtableService.js` (champs `email_*_envoye`), ENV |

### 21.4 Modifications de configuration

| Fichier modifié | Vérifier également |
|---|---|
| `config/claude.js` | `claudeService.js`, TOUS les agents (configs par agent : `agent_t1`, `agent_t1_verificateur`, etc.) |
| `config/airtable.js` | `airtableService.js`, `routes/index.js` (endpoint /debug/airtable) |
| `package.json` | Si dépendance ajoutée → vérifier que tous les fichiers qui en ont besoin la requirent. Si version Node bumpée → vérifier compatibilité Render. |
| `env.example` | Documenter tout nouveau env var dans Render (settings) ET dans `.env` local |
| `server.js` | Si nouveaux env vars vérifiés au démarrage : ajouter au tableau `requiredEnv`. Si polling activé/désactivé : `ENABLE_POLLING`. |

### 21.5 Modifications Airtable (schéma de base)

| Modification Airtable | Vérifier également dans le code |
|---|---|
| Ajout d'un champ dans VISITEUR | `config/airtable.js` (`VISITEUR_FIELDS`), `airtableService.js` (méthodes), peut-être `orchestratorPrincipal.js` si statut, peut-être `routes/index.js` si exposé via `/status` |
| Ajout d'un champ dans ETAPE1_T1 | `config/airtable.js` (`ETAPE1_T1_FIELDS`), `airtableService.js` (méthodes T1), `agentT1Service.js` (le prompt produit-il ce champ ?), `agentT1VerificateurService.js`, prompts correspondants |
| Ajout d'un statut dans `statut_analyse_pivar` | `config/airtable.js` (si liste énumérée), `orchestratorPrincipal.js` (machine à états), `queueService.js` (polling reconnaît ?), `routes/index.js` |
| Renommage d'une table | `config/airtable.js` (table renommée), `airtableService.js` (toutes les références), tous les services qui utilisent cette table |

### 21.6 Groupes de fichiers critiques à traiter ensemble

| Groupe | Fichiers à modifier ensemble |
|---|---|
| **A — Agent T1 + écosystème** | prompt T1 + service T1 + config Claude + config Airtable + service Airtable |
| **B — Vérificateur T1 + écosystème** | prompt vérificateur + service vérificateur + config Claude + service Airtable + sous-orchestrateur Étape 1 |
| **C — Orchestration globale** | orchestrator principal + sous-orchestrateurs + queue + routes + server |
| **D — Infrastructure Airtable** | config Airtable + service Airtable + tous les agents (transversal) |
| **E — Infrastructure Claude** | config Claude + service Claude + agentBase (transversal) |
| **F — Communication candidat** | notificationCandidatService + airtableService (champs `email_*`) + templates emails + ENV |
| **G — Validation humaine** | validationHumaineService + airtableService (champs `validation_humaine_*`) + orchestrateur Étape 1 + ENV |
| **H — Healthcheck** | healthcheckService + orchestratorPrincipal + claudeService + airtableService + ENV |

---

## 22. PROTOCOLE DE TRAVAIL "FICHIER PAR FICHIER"

### 22.1 Méthode validée par Isabelle (28/04/2026)

Pour reprendre le contrôle de l'architecture après plusieurs cycles de refonte par des agents IA précédents (qui ont laissé des incohérences et des fichiers obsolètes), la méthode de travail suivante s'applique pour la Phase D et au-delà :

1. **Le projet de travail Claude est vidé** au démarrage de chaque session (Isabelle a déjà vidé le sien le 28/04/2026 — seuls restent les 2 prompts et le contrat v1.6).
2. **Les fichiers GitHub sont remis dans le projet UN PAR UN**, à la demande de Claude, en fonction du fichier à modifier dans le tableau d'impact.
3. **Pour chaque fichier transmis** :
   - Claude **lit le fichier complet** avant toute proposition
   - Claude **identifie les fichiers liés** via le tableau d'impact (Section 21)
   - Claude **demande les fichiers liés** avant de proposer une refonte
   - Claude **propose la modification** avec un diagnostic précis
   - Isabelle **valide ou amende**
   - Claude **produit le fichier modifié** et l'expose en sortie
4. **Au passage**, Isabelle **nettoie GitHub** :
   - Supprime les fichiers `Old`, doublons, fichiers obsolètes
   - Renomme selon les conventions de Section 20.2
   - Restructure dans les dossiers selon Section 20.1

### 22.2 Règles strictes pour Claude

**Règle 1 — Toujours afficher le tableau d'impact AVANT de modifier**

Avant de proposer une modification, Claude affiche :
> "Je m'apprête à modifier `X`. Selon la cartographie (Section 21), voici les fichiers que je vais aussi vérifier ou potentiellement modifier : [...]. J'ai besoin que vous me transmettiez : [...]."

**Règle 2 — Lecture avant modification**

Toujours lire le fichier complet AVANT de proposer une refonte. Pas de réécriture en aveugle. Si le fichier n'est pas dans le projet, le demander à Isabelle.

**Règle 3 — Pas de modification d'un agent sans relire son orchestrateur**

L'orchestrateur (principal ou sous-orchestrateur) est le point central. Toute modification d'un agent doit être validée contre les attentes de l'orchestrateur (signature, retour, statut Airtable, gestion d'erreur).

**Règle 4 — Pas de modification de `agentBase.js` sans avis explicite d'Isabelle**

C'est le fichier mutualisé qui touche TOUS les agents. Très haute criticité. Toute proposition de modification doit être présentée à Isabelle avec un audit d'impact détaillé.

**Règle 5 — Pas de modification de `config/*.js` sans tester tous les agents impactés**

Une simple ligne modifiée dans `config/claude.js` peut casser un ou plusieurs agents. Lister tous les agents impactés avant modification.

**Règle 6 — Toujours simuler avant de déclarer "prêt à déployer"**

Avant de proposer un déploiement Render, Claude effectue toujours une simulation locale (sur Cécile, Rémi, ou Véronique) et présente le résultat à Isabelle. Pas de "c'est prêt, teste sur le serveur".

### 22.3 Posture d'Isabelle pendant la Phase D

Isabelle **n'a pas besoin d'être technique**. Elle a :
- Le contrat v1.7 (avec le tableau d'impact Section 21)
- L'autorité doctrinale absolue
- Le réflexe de demander : *"Tu modifies X, mais selon ma cartographie tu dois aussi vérifier Y et Z. Tu les as regardés ?"*

C'est suffisant pour contrôler la qualité du travail de tout agent IA, sans avoir à comprendre le code Node.js.

---

## 23. CAPACITÉ, DÉLAIS ET ENGAGEMENTS CLIENT

(Décisions n°29, n°31, n°34)

### 23.1 Temps de calcul incompressible

La profondeur méthodologique de Profil-Cognitif impose des temps de calcul Claude API qu'on ne peut pas réduire sans dégrader la qualité. Détail typique pour un bilan complet 3 étapes :

| Phase | Appels Claude | Temps cible |
|---|---|---|
| Étape 1 — T1 (5 appels par scénario) | 5 | 15-25 min |
| Étape 1 — Vérificateur T1 (2 batches) | 2 | 4-8 min |
| Étape 1 — T2 | 1 | 3-5 min |
| Étape 1 — Vérificateur T2 (si fichier existe) | 1-2 | 0-5 min |
| Étape 1 — T3 | 1 | 3-5 min |
| Étape 1 — Vérificateur T3 (si fichier existe) | 1-2 | 0-5 min |
| Étape 1 — T4 (6 sous-agents, 4 en parallèle) | 6 | 10-15 min |
| Étape 1 — Certificateur lexique | 1 | 2-3 min |
| **TOTAL Étape 1** | 17-20 | **40-70 min** |
| Étape 2 (T1 + T2 + vérificateurs si existants) | ~5-8 | 20-40 min |
| Étape 3 (à concevoir) | ~3-5 | 15-30 min |
| **TOTAL bilan complet 3 étapes** | **25-33 appels** | **75 min — 2h20** |

### 23.2 Capacité serveur (Décision n°31)

| Configuration | Capacité théorique | Capacité réaliste |
|---|---|---|
| Render Starter (1 CPU, MAX_CONCURRENT=1), bilan moyen 1h30 | 16 candidats/jour | **10-12 candidats/jour** |
| Render Standard (upgrade futur) | À évaluer | À évaluer |

**Surveillance automatique** : si la queue dépasse 24 candidats en attente, alerte automatique au superviseur (Isabelle).

**Phase démarrage commercial** (3-6 premiers mois) : capacité actuelle largement suffisante (typiquement 1-5 candidats/jour).

### 23.3 Engagements client (Décision n°34)

**Engagement par défaut communiqué au candidat : "Bilan livré sous 72h"**

Distribution réelle attendue :
- 90% des bilans livrés sous 24h
- 9% entre 24-48h
- 1% nécessitant intervention humaine (Mode 3 du vérificateur ou Mode 4 erreur système)

Le buffer de 72h permet d'absorber : pic de queue, intervention humaine Mode 3, panne API ponctuelle, retry exponentiel.

**Évolution future** : une fois la fiabilité statistique mesurée sur les 100 premiers candidats, ce délai pourra être ramené à 48h ou 24h dans la communication client.

### 23.4 Robustesse > vitesse (Décision n°29)

L'arbitrage est clair : **un bilan livré en 1h30 mais qui aboutit toujours** vaut mieux qu'**un bilan livré en 30 min mais qui plante 1 fois sur 3**. La crédibilité méthodologique de Profil-Cognitif repose sur la robustesse, pas sur la vitesse.

Mécanismes de robustesse en place :
- Healthcheck préalable à chaque cycle (Décision n°23)
- Backups par étape (résilience après crash)
- Tentatives Mode 4 (Décision n°24)
- Validation humaine Mode 3 (Décision n°16)
- Retry intelligent avec backoff (errorClassifier)
- Streaming Claude (pas de mémoire saturée)
- MAX_CONCURRENT=1 (pas de surcharge serveur)

---

## 24. COMMUNICATION CANDIDAT ASYNCHRONE

(Décision n°33)

### 24.1 Calendrier des emails

| Moment | Trigger | Action |
|---|---|---|
| **T0** | Candidat termine ses 25 réponses (`statut_test = terminé`) | **Envoi Email 1** : confirmation réception + annonce délai |
| **T0+24h** | Cron horaire vérifie | Si bilan prêt → Email "Votre bilan est prêt" + lien. Sinon → rien. |
| **T0+48h** | Cron horaire vérifie | Si bilan prêt → Email "Votre bilan est prêt" + lien. Sinon → **Envoi Email 2** : rappel "en cours d'élaboration approfondie" |
| **T0+72h** | Cron horaire vérifie | Si bilan prêt → Email "Votre bilan est prêt" + lien. Sinon → **Email superviseur** alerte interne pour intervention manuelle |

### 24.2 Service technique (`notificationCandidatService.js`)

Service à créer en Phase D :
- Tourne **1 fois par heure** (cron interne ou polling)
- Lit VISITEUR pour identifier les candidats à notifier
- Tracking dans VISITEUR :
  - `email_T0_envoye` (booléen)
  - `email_24h_envoye` (booléen)
  - `email_48h_envoye` (booléen)
  - `email_72h_envoye` (booléen)
  - `email_livraison_envoye` (booléen — quand bilan prêt)
- Anti-doublons : ne renvoie jamais un email déjà envoyé

### 24.3 Templates des emails

#### Email 1 — T0 — Confirmation réception

**Sujet** : `Vos réponses ont été reçues — Profil-Cognitif`

```
Madame [civilité],

Nous avons bien reçu vos 25 réponses au protocole d'évaluation Profil-Cognitif.

Votre profil cognitif personnalisé est désormais en cours d'élaboration.

Notre méthode, contrairement aux tests de personnalité standards, repose sur une 
analyse approfondie de chacune de vos réponses par notre équipe et nos systèmes 
d'analyse cognitive. Cette qualité d'analyse demande du temps — c'est ce qui fait 
la valeur de votre bilan.

Votre bilan complet vous parviendra par email **sous 72h maximum**, généralement 
sous 24h.

Nous vous remercions de votre patience.

Cordialement,
L'équipe Profil-Cognitif
```

#### Email 2 — T0+48h — Rappel si bilan pas encore prêt

**Sujet** : `Votre bilan Profil-Cognitif est en cours d'élaboration approfondie`

```
Madame [civilité],

Nous tenons à vous tenir informée de l'avancement de votre bilan Profil-Cognitif.

Votre profil cognitif est actuellement en cours d'élaboration approfondie. Notre 
méthode demande du temps pour poser une analyse personnelle de qualité — c'est ce 
qui distingue notre approche des tests de personnalité standards.

Votre bilan vous parviendra **sous 24h maximum**.

Nous vous remercions de votre patience.

Cordialement,
L'équipe Profil-Cognitif
```

#### Email superviseur — T0+72h — Alerte interne

**Sujet** : `[ALERTE] Candidat dépassant 72h — intervention requise`

```
Bonjour Isabelle,

Le candidat [candidat_id] a dépassé le délai de 72h sans que son bilan soit livré.

État actuel :
- Statut analyse : [statut_analyse_pivar]
- Date réception réponses : [date_T0]
- Étape en cours : [étape]
- Erreur éventuelle : [erreur_analyse]

Action requise : intervention manuelle pour débloquer ou contacter le candidat.

Lien Airtable : [lien direct vers fiche candidat]
```

#### Email livraison — Quand bilan prêt

**Sujet** : `Votre bilan Profil-Cognitif est prêt`

```
Madame [civilité],

Votre bilan Profil-Cognitif personnalisé est désormais disponible.

Il est le fruit d'une analyse approfondie qui a permis de dégager votre profil 
cognitif unique, vos modes de fonctionnement et vos zones d'excellence.

[Lien d'accès au bilan]

Nous vous souhaitons une lecture éclairante.

Cordialement,
L'équipe Profil-Cognitif
```

### 24.4 Doctrine du ton

Tous les emails respectent les principes :
- **Sobre et professionnel** (jamais familier)
- **Valorise le délai** comme signal de qualité méthodologique
- **Ne s'excuse jamais du temps de calcul** — le présenter comme une force
- **Anonymisation absolue** : aucune mention du prénom dans les emails (utilise uniquement la civilité, conformément à la Décision n°4)
- **Accords grammaticaux** selon la civilité (Décision n°4 : `Madame` → féminin, `Monsieur` → masculin)

### 24.5 Nouveaux champs Airtable VISITEUR à créer (Phase D)

| Champ | Type | Description |
|---|---|---|
| `email_T0_envoye` | Checkbox | Email de confirmation envoyé à T0 |
| `email_24h_envoye` | Checkbox | Email envoyé à T0+24h (livraison ou rien) |
| `email_48h_envoye` | Checkbox | Email envoyé à T0+48h (livraison ou rappel) |
| `email_72h_envoye` | Checkbox | Email envoyé à T0+72h (livraison ou alerte superviseur) |
| `email_livraison_envoye` | Checkbox | Email de livraison du bilan envoyé |
| `date_T0` | dateTime (Europe/Paris) | Date à laquelle le candidat a terminé ses 25 réponses |

---

**FIN DU CONTRAT v1.7**

*Document à conserver dans le projet GitHub Profil-Cognitif comme référence fondatrice de l'Étape 1 et de l'architecture multi-étapes.*
