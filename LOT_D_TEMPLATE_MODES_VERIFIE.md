# LOT D — TEMPLATE DESCRIPTION DU MODE
## Template #2 · Projet Profil-Cognitif · 23 avril 2026

Template de rédaction du **mode retenu** pour chaque pilier — la manière singulière dont le candidat utilise ce pilier, dérivée de la combinaison de ses circuits dominants.

Le mode est la **synthèse interprétative** qui fait le pont entre :
- La donnée brute (circuits et fréquences)
- La description d'usage singulier

Template utilisé par **Agent 3 — Modes**. Appliqué 5 fois par bilan (un mode par pilier).

Format identique aux Lots A, B, C.

---
---

# TEMPLATE #2 — DESCRIPTION DU MODE RETENU

## 1. NOM DU TEMPLATE

**Template #2 — Description du mode retenu d'un pilier**

Brique rédactionnelle qui décrit le **mode retenu** pour chaque pilier du candidat en **double version** : explication laboratoire (technique, pour analyste/matching) + explication candidat (accessible, pour le lecteur du bilan).

---

## 2. BUT

Permettre à l'agent de rédiger la section « Mode retenu » dans chaque bloc pilier en :

- **Rappelant** ce qu'est un mode (définition inline)
- **Nommant** le mode retenu pour ce pilier chez ce candidat (parmi les 7 modes du référentiel)
- **Produisant l'explication laboratoire** : quelle combinaison spécifique de circuits signe ce mode chez ce candidat
- **Produisant l'explication candidat** : ce que ce mode signifie concrètement pour le lecteur

**Point critique** : plusieurs candidats peuvent partager le **même mode** pour un pilier — mais avec des **signatures subtilement différentes** selon leurs circuits dominants. Le template doit rendre visible cette variance.

---

## 3. QUAND UTILISER CE TEMPLATE

**Utilisation** : dans chaque bloc pilier, après la section Circuits (Template #1).

**Volume** : 5 fois par bilan (un mode par pilier).

**Obligation** : tous les piliers ont un mode retenu — même les piliers peu activés.

---

## 4. STRUCTURE OBLIGATOIRE

```
┌───────────────────────────────────────────────────────────────┐
│ BLOC 1 — TITRE DE SECTION                                     │
│   • « 🎯 Mode retenu : [nom du mode entre guillemets] »       │
├───────────────────────────────────────────────────────────────┤
│ BLOC 2 — DÉFINITION INLINE                                    │
│   • Qu'est-ce qu'un mode ?                                    │
│   • 2-3 phrases rappelant que 7 modes sont possibles par      │
│     pilier                                                    │
│   • Mention que plusieurs candidats peuvent avoir le même     │
│     mode, subtilement différent selon les circuits            │
├───────────────────────────────────────────────────────────────┤
│ BLOC 3 — DOUBLE EXPLICATION                                   │
│   • 2 colonnes                                                │
│   • Col 1 — 🔬 Explication laboratoire                        │
│   • Col 2 — ✨ Votre mode expliqué (candidat)                  │
└───────────────────────────────────────────────────────────────┘
```

### Contenu détaillé des 2 colonnes

**Colonne 1 — Explication laboratoire**
- Combinaison de circuits qui signe le mode (noms + fréquences)
- Fonction cognitive globale du mode
- Variance spécifique chez ce candidat (ce qui distingue son mode de la même étiquette chez un autre)
- Implication pour le matching

**Colonne 2 — Explication candidat**
- Adresse en « vous »
- Signification du mode dans la pratique quotidienne
- Singularité par rapport à la même étiquette chez d'autres (sans comparer nominativement)
- Lien avec le filtre global si pertinent

---

## 5. SLOTS À REMPLIR

| Slot | Source | Exemple Cécile P3 |
|---|---|---|
| `{pilier_id}`, `{pilier_nom}` | T3 / Référentiel | `"P3"`, `"Analyse"` |
| `{mode_retenu}` | T4 (attribution profil) | `"Contextuel et adaptatif"` |
| `{circuits_dominants_pilier}` | T3 top 3-5 circuits | `[C10, C15, C7, C12, C5]` |
| `{cluster_dominant}` | T3 v4 | `C10 × C15 (6 co-oc)` |
| `{variance_specifique}` | Dérivé de la combinaison de circuits + clusters | Texte à formuler |
| `{interpretation_candidat}` | Dérivé | Texte à formuler |

### Référentiel des 35 modes possibles (5 piliers × 7 modes)

L'agent doit toujours vérifier que le `{mode_retenu}` correspond bien à l'un des 7 modes possibles du pilier concerné dans le `REFERENTIEL_PROFILS`. Si erreur détectée, signaler en auto-contrôle.

---

## 6. RÈGLES DE RÉDACTION

### 6.1 Règle absolue — le mode est une synthèse interprétative

Le mode n'est pas une simple étiquette : c'est une **synthèse de combinaison de circuits**. L'explication laboratoire **doit** citer les circuits qui signent le mode avec leurs fréquences.

Structure-type de l'explication laboratoire :
> « Le mode "[nom]" chez [candidat] se caractérise par la combinaison C[X] ([f1]×) + C[Y] ([f2]×) + C[Z] ([f3]×). [Fonction cognitive de cette combinaison]. [Variance spécifique à ce candidat]. »

### 6.2 Règle — variance spécifique obligatoire

Pour chaque mode, l'agent **doit** produire une phrase qui explique ce qui distingue **cette déclinaison du mode** chez ce candidat par rapport à la même étiquette chez un autre.

Exemples :
- « La particularité de ce mode chez Cécile est la **forte activation de C15** (émotion), qui signale une modulation intégrant systématiquement le signal limbique — distincte d'autres instances de ce même mode où la modulation se ferait par pure priorisation. »
- « La particularité de ce mode chez Rémi est le **couplage serré C6 × C15**, qui signe une diversification toujours orchestrée — distincte d'autres diversifications qui resteraient juxtaposées sans orchestration. »

Cette règle découle directement du **principe de révélation** : deux candidats au même mode ne sont pas interchangeables.

### 6.3 Règle — pas de comparaison avec candidats nommés

Dans l'explication laboratoire, l'agent peut mentionner qu'un mode peut se décliner différemment chez d'autres candidats, **sans jamais nommer un candidat spécifique**.

- ❌ « Contrairement à Rémi, Cécile... »
- ✅ « D'autres instances de ce mode pourraient signer une modulation différente — chez Cécile, [spécificité] »

### 6.4 Règle — adresse et ton

- **Colonne laboratoire** : 3e personne, ton scientifique, chiffres
- **Colonne candidat** : 2e personne « vous », ton posé mais chaleureux, pas de jargon

### 6.5 Règle — longueurs cibles

- Colonne laboratoire : **4-6 phrases**
- Colonne candidat : **4-6 phrases**
- Équilibre visuel entre les deux colonnes

### 6.6 Règle — lien avec filtre (optionnel, selon contexte)

Pour le **pilier socle uniquement**, l'explication candidat peut relier le mode au filtre global. Exemple :
> « Ce mode "contextuel et adaptatif" est la mise en œuvre concrète de votre filtre "lire ce qui est vrai dans la situation" : votre pilier socle ne fonctionne pas en abstraction, il fonctionne toujours dans le contexte spécifique. »

Pour les autres piliers, ce lien est facultatif.

### 6.7 Formulations standardisées

| Contexte | Formulation standard |
|---|---|
| Titre bloc 1 | « 🎯 Mode retenu : "[mode]" » |
| Définition inline | « **Qu'est-ce qu'un mode ?** Le mode est la manière spécifique dont vous utilisez ce pilier. Chaque pilier a 7 modes possibles dans le référentiel — le vôtre est déterminé par la combinaison de vos circuits dominants. Plusieurs candidats peuvent partager le même mode, mais subtilement différent selon leurs circuits propres. » |
| Ouverture col. laboratoire | « Le mode "[nom]" chez [candidat] se caractérise par la combinaison... » |
| Variance spécifique | « La particularité de ce mode chez [candidat] est... » |
| Ouverture col. candidat | « Votre mode d'utilisation de votre pilier [nom] s'appelle "[mode]". Chez vous, cela signifie... » |
| Singularité candidat | « Ce qui rend votre mode singulier parmi les personnes qui partagent ce même mode... » |

---

## 7. EXEMPLE — CÉCILE · P3 ANALYSE

### Données source

```
pilier : P3 Analyse (socle)
mode_retenu : "Contextuel et adaptatif"
circuits_dominants : C10 (16×), C15 (9×), C7 (7×), C12 (6×), C5 (5×)
cluster_dominant : C10 × C15 (6 co-oc)
filtre_global : "Lire ce qui est vrai dans la situation"
```

### Rendu

**BLOC 1 — Titre**
> ### 🎯 Mode retenu : « Contextuel et adaptatif »

**BLOC 2 — Définition inline**
> **Qu'est-ce qu'un mode ?** Le mode est la manière spécifique dont vous utilisez ce pilier. Chaque pilier a 7 modes possibles dans le référentiel — le vôtre est déterminé par la combinaison de vos circuits dominants. Plusieurs candidats peuvent partager le même mode, mais subtilement différent selon leurs circuits propres.

**BLOC 3 — Double explication**

| 🔬 Explication laboratoire | ✨ Votre mode expliqué |
|---|---|
| Le mode « Contextuel et adaptatif » chez Cécile se caractérise par la combinaison spécifique **C10 (16×) + C7 (7×) + C12 (6×) + C5 (5×)** qui soutient **C15 (9×)**. La modulation de profondeur (C10) opère sur chaque situation contextualisée (C7) en intégrant la dimension émotionnelle comme donnée analytique (C15). La priorisation hiérarchique (C12) et la reconnaissance des patterns (C5) donnent à ce mode une forme d'ajustement situationnel diagnostique. La particularité de ce mode chez Cécile tient à la **dominance massive de C10** (16 activations contre 5-9 pour les autres) qui indique une modulation ultra-automatique plutôt que délibérée, et à la présence de **C15 à 9 activations** qui signale une intégration systématique du signal limbique comme donnée. D'autres instances de ce même mode pourraient signer une adaptation plus abstraite ou moins émotionnellement informée. **Pour le matching** : ce mode chez Cécile est bien adapté à des rôles qui exigent une lecture fine de situations changeantes, avec exploitation consciente du signal émotionnel comme information. | Votre mode d'utilisation de votre pilier Analyse s'appelle « Contextuel et adaptatif ». Chez vous, cela signifie que vous lisez chaque situation dans son contexte propre, avec une profondeur d'analyse qui se calibre toute seule à l'enjeu. Vous n'appliquez pas une méthode standard à toutes les situations — vous ajustez votre lecture à chaque cas. Et votre ressenti émotionnel entre dans cette analyse comme une information utile, pas comme un obstacle à écarter. Ce qui rend votre mode singulier parmi les personnes qui partagent ce même mode : votre calibration de l'effort est particulièrement tranchée — vous coupez court quand l'enjeu est faible, vous vous engagez à fond quand il est élevé. Peu de gris, peu d'hésitation. Ce mode « contextuel et adaptatif » est la mise en œuvre concrète de votre filtre « lire ce qui est vrai dans la situation » : votre pilier socle ne fonctionne pas en abstraction, il fonctionne toujours dans le contexte spécifique. |

---

## 8. EXEMPLE — CÉCILE · P1 COLLECTE D'INFORMATION

### Données source

```
pilier : P1 Collecte d'information (structurant 1)
mode_retenu : "Critique et analytique"
circuits_dominants : C2 (4×), C1 (3×), C3 (2×)
pattern : collecte orientée par diagnostic P3
```

### Rendu

**BLOC 1** — 🎯 Mode retenu : « Critique et analytique »

**BLOC 2** — Définition inline (standard)

**BLOC 3 — Double explication**

| 🔬 Explication laboratoire | ✨ Votre mode expliqué |
|---|---|
| Le mode « Critique et analytique » chez Cécile se caractérise par la combinaison **C2 (4×) + C1 (3×) + C3 (2×)**. La diversification stratégique (C2) s'appuie sur une attention sélective préalable (C1) filtrée par une évaluation critique des sources (C3). Ce triptyque signe une collecte **non exploratoire**, pré-orientée par un diagnostic P3 en amont : C1 n'ouvre que les canaux utiles, C2 les parcourt en parallèle, C3 les valide par leur crédibilité. La particularité de ce mode chez Cécile est **la hiérarchisation implicite** des sources (scientifique → médical → alternatif en contexte médical ; expert humain → réseau → internet en contexte social). Ce mode se distingue d'un mode « systématique et méthodique » par **le rejet préalable** de sources non crédibles (forums exclus d'emblée). **Pour le matching** : candidate efficace pour tout rôle exigeant collecte ciblée et prudente, moins adaptée aux collectes exploratoires ouvertes. | Votre mode d'utilisation de votre pilier Collecte d'information s'appelle « Critique et analytique ». Chez vous, cela signifie que vous évaluez vos sources avant même de les consulter — vous filtrez leur fiabilité, vous détectez les biais potentiels, vous hiérarchisez vos canaux (scientifique d'abord, médical ensuite, alternatif en complément ; expert humain avant internet ; jamais les forums). Ce qui rend votre mode singulier parmi les personnes qui partagent ce même mode : votre collecte n'est jamais « exploratoire » — elle est toujours orientée par une question précise que votre Analyse a déjà posée. Vous ne cherchez pas pour trouver, vous cherchez pour vérifier. |

---

## 9. EXEMPLE — CÉCILE · P5 MISE EN ŒUVRE ET EXÉCUTION

### Données source

```
pilier : P5 Mise en œuvre et exécution (résistant)
mode_retenu : "Pragmatique et efficace"
circuits_dominants : C1 (6×), C4 (5×), C13 (4×)
particularité : forte activation de C13 (leadership collaboratif)
```

### Rendu

**BLOC 1** — 🎯 Mode retenu : « Pragmatique et efficace »

**BLOC 2** — Définition inline (standard)

**BLOC 3 — Double explication**

| 🔬 Explication laboratoire | ✨ Votre mode expliqué |
|---|---|
| Le mode « Pragmatique et efficace » chez Cécile se caractérise par l'**exécution structurée** (C1, 6×) couplée à la **recalibration rapide** (C4, 5×) et au **leadership collaboratif** (C13, 4×). La particularité de ce mode chez Cécile est la **forte activation de C13** (au-dessus du seuil HAUT), qui signale une préférence pour la **coordination** plutôt que l'exécution solitaire — alors que d'autres instances de ce même mode privilégieraient C2 (préparation systématique), C7 (hiérarchisation priorités) ou C11 (attention détails). Cette combinaison C1+C4+C13 positionne l'exécution comme **orchestration** : Cécile exécute quand elle doit, mais cherche d'abord à coordonner ou déléguer. Le pilier sert de sortie fonctionnelle du moteur (12/25 sorties) sans porter l'excellence cognitive. **Pour le matching** : rôles de coordination et d'animation d'équipe en alignement naturel ; rôles d'exécution solitaire intensive en tension avec la stratégie compensatoire. | Votre mode d'utilisation de votre pilier Mise en œuvre et exécution s'appelle « Pragmatique et efficace ». Chez vous, cela signifie que vous exécutez rapidement et précisément quand c'est nécessaire, vous vérifiez la compréhension, vous finalisez concrètement. Ce qui rend votre mode singulier parmi les personnes qui partagent ce même mode : votre exécution est naturellement orientée vers la **coordination** — vous préférez orchestrer, déléguer, encadrer plutôt qu'exécuter seule. Votre circuit de leadership collaboratif (C13, activé 4 fois) est particulièrement marqué chez vous : face à une tâche d'exécution, votre premier mouvement est souvent « qui peut faire avec moi ? », pas « je commence ». |

---

## 10. EXEMPLE — RÉMI · P4 CRÉATION DE SOLUTIONS

### Données source (estimées depuis mémoires)

```
pilier : P4 Création de solutions (socle)
mode_retenu : à extraire du T4 Rémi (exemple indicatif : "Diversifié et adaptatif")
circuits_dominants : C6 (7×), C1 (5×), C11 (2×), C9 (3×)
cluster_dominant : C6 × C15 (3 co-oc)
filtre_global : "Maintenir les voies ouvertes"
```

### Rendu (structure)

**BLOC 1** — 🎯 Mode retenu : « [Mode T4 Rémi] »

**BLOC 2** — Définition inline (standard)

**BLOC 3 — Double explication**

| 🔬 Explication laboratoire | ✨ Votre mode expliqué |
|---|---|
| Le mode « [...] » chez Rémi se caractérise par la combinaison **C6 (7×) + C1 (5×) + C9 (3×)** autour du cluster dominant **C6 × C15** (3 co-oc). La diversification méthodique (C6) est couplée à la génération fluide (C1) et au renouvellement créatif (C9). La particularité de ce mode chez Rémi est le **maintien actif des alternatives** — là où d'autres instances du mode pourraient fermer rapidement sur une option préférée. Ce mode se traduit par une production d'options parallèles qui ne se hiérarchisent pas prématurément. **Pour le matching** : bien adapté aux rôles créatifs exigeant ouverture soutenue et gestion d'alternatives en parallèle. | Votre mode d'utilisation de votre pilier Création de solutions s'appelle « [...] ». Chez vous, cela signifie que vous générez plusieurs voies possibles sans en éliminer trop tôt — vous préservez activement la réversibilité. Ce qui rend votre mode singulier parmi les personnes qui partagent ce même mode : votre diversification s'accompagne d'une orchestration — vos options ne sont pas juxtaposées, elles sont articulées pour pouvoir coexister. Ce mode est la mise en œuvre concrète de votre filtre « maintenir les voies ouvertes » : votre pilier socle ne produit pas une solution, il produit un espace de solutions. |

---

## 11. EXEMPLE — VÉRONIQUE · P3 ANALYSE

### Données source (estimées)

```
pilier : P3 Analyse (socle)
mode_retenu : à extraire T4 Véronique (exemple indicatif : "Systémique et structurel")
circuits_dominants : C10 (18×), C7 (8×), C1 (5×), C11 (6×)
cluster_dominant exclusif : C10 × C7 (6 co-oc)
filtre_global : "Extraire le principe logique"
```

### Rendu (structure)

**BLOC 1** — 🎯 Mode retenu : « [Mode T4 Véronique] »

**BLOC 2** — Définition inline (standard)

**BLOC 3 — Double explication**

| 🔬 Explication laboratoire | ✨ Votre mode expliqué |
|---|---|
| Le mode « [...] » chez Véronique se caractérise par la combinaison **C10 (18×) + C7 (8×) + C11 (6×) + C1 (5×)** autour du cluster **dominant et exclusif** C10 × C7 (6 co-oc). La modulation d'analyse (C10) passe systématiquement par la contextualisation (C7) avant d'extraire le principe (C11). La particularité de ce mode chez Véronique tient à la **concentration du cluster sur un seul partenaire** (contrairement à d'autres instances du mode qui présenteraient plusieurs clusters dispersés) : l'analyse est **structurellement orientée** vers l'extraction de règles qui tiennent dans leur contexte. **Pour le matching** : bien adapté aux rôles exigeant abstraction structurée ancrée dans le réel, moins adapté aux contextes d'urgence où la contextualisation préalable est un coût. | Votre mode d'utilisation de votre pilier Analyse s'appelle « [...] ». Chez vous, cela signifie que vous cherchez toujours la règle de fonctionnement sous-jacente d'une situation — mais en partant du contexte spécifique, pas de l'abstrait. Ce qui rend votre mode singulier parmi les personnes qui partagent ce même mode : votre analyse n'approfondit pas à l'aveugle — elle prend d'abord le temps de comprendre les mécanismes en jeu, puis elle extrait le principe qui explique. Ce mode est la mise en œuvre concrète de votre filtre « extraire le principe logique » : votre pilier socle ne cherche pas à comprendre pour comprendre, il cherche à formuler des règles qui tiennent dans le réel. |

---

## 12. PIÈGES À ÉVITER

### Piège 1 — Mode décrit sans les circuits qui le signent

❌ *« Le mode Contextuel et adaptatif signifie que vous adaptez votre analyse au contexte. »*
→ Description générique, pas spécifique à ce candidat

✅ *« Le mode "Contextuel et adaptatif" chez Cécile se caractérise par la combinaison C10 (16×) + C7 (7×) + C12 (6×)... »*

### Piège 2 — Variance spécifique absente

❌ Décrire le mode sans dire **ce qui le rend différent chez ce candidat** par rapport à la même étiquette chez d'autres
✅ Toujours inclure « La particularité de ce mode chez [candidat] est... »

### Piège 3 — Comparaison nominative avec un candidat spécifique

❌ *« Contrairement à Rémi qui utilise ce mode différemment... »*
✅ *« D'autres instances de ce mode pourraient signer... chez Cécile, [spécificité] »*

### Piège 4 — Noms de circuits approximatifs

❌ *« le circuit de modulation »*
✅ *« C10 — Modulation de la profondeur d'analyse selon l'enjeu »* (nom exact du référentiel)

### Piège 5 — Oubli de la double colonne

❌ Une seule formulation qui mélange laboratoire et candidat
✅ Toujours **2 colonnes distinctes** avec les styles respectifs

### Piège 6 — Contamination avec d'autres étapes

❌ Mentionner les excellences (ANT, DEC, MET, VUE) ou les 9 types dans la description du mode
✅ Rester strictement dans le registre circuits + clusters + mode

### Piège 7 — Jargon inaccessible dans la colonne candidat

❌ *« La combinatoire de vos circuits dénote une calibration adaptative... »* (colonne candidat)
✅ *« Vous lisez chaque situation dans son contexte propre... »* (langage accessible, pas de jargon)

### Piège 8 — Rupture de ton entre colonnes

❌ Colonne laboratoire en « vous » / colonne candidat en 3e personne
✅ Laboratoire = 3e personne · Candidat = 2e personne. Strict.

---

## 13. CHECK-LIST AUTO-CONTRÔLE

### Structure
- [ ] Titre de section avec le nom du mode entre guillemets
- [ ] Définition inline présente (encart)
- [ ] Double colonne laboratoire + candidat

### Colonne laboratoire
- [ ] Combinaison de circuits citée avec **noms exacts** et **fréquences**
- [ ] Cluster dominant mentionné si présent
- [ ] Variance spécifique explicite (« La particularité de ce mode chez [candidat] est... »)
- [ ] Implication matching mentionnée
- [ ] 3e personne, ton factuel
- [ ] Pas de comparaison nominative avec un candidat

### Colonne candidat
- [ ] Ouverture avec « Votre mode d'utilisation... s'appelle... »
- [ ] 2e personne (« vous »)
- [ ] Langage accessible, pas de jargon
- [ ] Singularité explicitée (« Ce qui rend votre mode singulier... »)
- [ ] Lien avec le filtre global si pilier socle
- [ ] Pas d'évaluatif

### Cohérence globale
- [ ] Le mode retenu existe bien dans le référentiel des 7 modes du pilier
- [ ] Pas de contamination inter-étapes
- [ ] Équilibre visuel entre les 2 colonnes (longueur proche)

---

## FIN DU LOT D
