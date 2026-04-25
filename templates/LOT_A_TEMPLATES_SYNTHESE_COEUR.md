# LOT A — TEMPLATES DE SYNTHÈSE CŒUR
## Templates #4, #5, #6, #7 · Projet Profil-Cognitif · 23 avril 2026

Templates de rédaction des 4 sections qui forment le **cœur synthétique** du bilan candidat :
- **Template #4** — Filtre cognitif
- **Template #5** — Enchaînement des piliers (boucle cognitive)
- **Template #6** — Finalité cognitive (grandes lignes)
- **Template #7** — Signature cognitive (synthèse intégrée)

Ces 4 templates sont utilisés par **Agent 4 — Synthèse cœur** qui rédige les 4 sections en une seule passe pour garantir la cohérence narrative entre elles.

Format identique au Template #1 validé. 3 cas illustrés (Cécile, Rémi, Véronique) quand les données sont disponibles.

---
---

# TEMPLATE #4 — FILTRE COGNITIF

## 1. NOM DU TEMPLATE

**Template #4 — Filtre cognitif du pilier socle**

Brique rédactionnelle qui pose la **pré-programmation cognitive** du candidat — la forme particulière sous laquelle toute situation lui apparaît d'emblée, avant tout traitement conscient.

---

## 2. BUT

Permettre à l'agent de rédiger la section « Filtre cognitif » du bilan en :
- **Définissant** ce qu'est un filtre cognitif (rappel glossaire)
- **Nommant le filtre spécifique** du candidat avec une formulation verbale précise
- **Ancrant le filtre dans les preuves du protocole** (clusters T3 v4, nombre d'ÉCART où le pilier socle s'impose, circuits dominants)
- **Produisant une double explication** laboratoire + candidat

---

## 3. QUAND UTILISER CE TEMPLATE

**Utilisation** : dans la synthèse finale du bilan, section #1 (première section après les blocs piliers).

**Volume par bilan** : 1 fois par bilan (un seul filtre par candidat, porté par le pilier socle).

**Condition de déclenchement** : le candidat a un pilier socle identifié (règle générale du protocole).

---

## 4. STRUCTURE OBLIGATOIRE

```
┌───────────────────────────────────────────────────────────────┐
│ BLOC 1 — RÉFÉRENCE AU SCHÉMA                                  │
│   • Cartouche bleu « Dans le schéma du moteur : halo vert     │
│     autour du pilier socle »                                  │
├───────────────────────────────────────────────────────────────┤
│ BLOC 2 — DÉFINITION INLINE                                    │
│   • Encart jaune pâle « Qu'est-ce qu'un filtre cognitif ? »   │
│   • 3-4 phrases, rappel du glossaire                          │
│   • Précise : filtre = intrinsèque au socle, pas séparé       │
├───────────────────────────────────────────────────────────────┤
│ BLOC 3 — FORMULATION DU FILTRE                                │
│   • Phrase-titre : « Votre filtre cognitif : [formulation] »  │
│   • Formulation en verbe à l'infinitif (capter, lire, etc.)   │
│   • Entre guillemets typographiques                           │
├───────────────────────────────────────────────────────────────┤
│ BLOC 4 — EXPLICATION LABORATOIRE                              │
│   • Preuve par les ÉCART : X ÉCART sur Y où P_socle s'impose  │
│   • Preuve par les clusters : clusters dominants              │
│   • Description de la forme spécifique du filtre              │
│   • 3-5 phrases, ton factuel, 3e personne                     │
├───────────────────────────────────────────────────────────────┤
│ BLOC 5 — EXPLICATION CANDIDAT                                 │
│   • Adresse au candidat en « vous »                           │
│   • Révélation de ce qui se passe en lui avant toute décision │
│   • Reformulation accessible de la forme du filtre            │
│   • 4-6 phrases, narratif, personnel                          │
└───────────────────────────────────────────────────────────────┘
```

### Blocs tous obligatoires.

---

## 5. SLOTS À REMPLIR

### Slots factuels (de T3 v4 + T4 + T1)

| Slot | Source | Exemple Cécile |
|---|---|---|
| `{pilier_socle_id}` | T4 / T3 role_pilier | `"P3"` |
| `{pilier_socle_nom}` | Référentiel | `"Analyse"` |
| `{nb_ecart_total}` | T1 | `8` |
| `{nb_ecart_socle_coeur}` | T1 | `6` |
| `{nb_circuits_actifs_socle}` | T3 nb_circuits_actifs_pilier | `14` |
| `{total_activations_socle}` | T3 somme frequences | `78` |
| `{clusters_dominants}` | T3 v4 clusters_identifies | Liste des 3 premiers |
| `{piliers_attendus_ecart}` | T1 | `["P2", "P4", "P5"]` |

### Slots à formuler par l'agent

| Slot | Méthode |
|---|---|
| `{formulation_filtre}` | Formulation en verbe à l'infinitif, dérivée des circuits dominants et de leur fonction. Format : « [verbe à l'infinitif] [objet cognitif] [condition/précision] ». Ne jamais confondre avec un résultat (qui serait une finalité). |
| `{forme_specifique_filtre}` | Description des couches du filtre, dérivée des clusters dominants |
| `{precision_semantique}` | Si un mot-clé du filtre a plusieurs sens possibles, préciser le sens retenu (ex. « vrai = véracité factuelle, pas avoir raison ») |

---

## 6. RÈGLES DE RÉDACTION

### 6.1 Règle absolue — distinction filtre / finalité

**Le filtre est un COMMENT, pas un POUR QUOI.**

| Type | Forme grammaticale | Exemples |
|---|---|---|
| Filtre | Verbe à l'infinitif + complément | « lire », « capter », « extraire », « maintenir », « distinguer » |
| Finalité | Résultat observable | « produire des décisions... », « jamais fermer une option... », « produire des règles... » |

**INTERDIT** de formuler un filtre comme « pour produire X » ou « afin de Y » — ce serait de la finalité contaminant le filtre.

### 6.2 Règle — formulation de verbe à l'infinitif

Le filtre doit toujours se formuler ainsi :

**[Verbe à l'infinitif] + [objet cognitif] + [condition/précision optionnelle]**

Exemples :
- Cécile : « Lire ce qui est vrai dans la situation depuis l'observation directe »
- Rémi : « Maintenir les voies ouvertes »
- Véronique : « Extraire le principe logique »

### 6.3 Règle — précisions sémantiques obligatoires

Si un mot-clé du filtre a **plusieurs sens possibles**, l'agent DOIT préciser le sens retenu pour ce candidat, dans le bloc 4 (laboratoire) ou 5 (candidat).

Exemple critique : « vrai » peut signifier :
- (a) véracité factuelle (faits sourcés, documentés)
- (b) avoir raison (posture de gagnant d'un débat)

**Ce n'est pas la même chose.** L'agent doit trancher d'après les verbatims du candidat. Pour Cécile : sens (a), précisé par la récurrence des circuits C3 (évaluation fiabilité sources), C7 (contextualisation), C4 (évaluation fiabilité informations) dans son profil.

### 6.4 Règle — interdits habituels

- Pas d'évaluatif (« impressionnant », « performant »)
- Pas de comparaison entre candidats
- Pas de contamination inter-étapes (pas d'excellences ANT/DEC/MET/VUE, pas de 9 types)
- Pas d'interprétation psychologique (le filtre est cognitif, pas motivationnel)

### 6.5 Formulations standardisées « marque Profil-Cognitif »

| Contexte | Formulation standard |
|---|---|
| Titre du bloc 3 | « Votre filtre cognitif : [formulation] » |
| Introduction bloc 4 | « **Lecture laboratoire** : [données factuelles] » |
| Introduction bloc 5 | « Votre filtre cognitif est la manière dont toute situation vous apparaît d'abord. » |
| Mention de l'automaticité | « Cette [opération] ne se décide pas — elle est automatique. » |
| Précision sémantique | « Précision : [mot-clé] signifie ici [sens retenu] — pas [sens rejeté]. » |

---

## 7. EXEMPLE — CÉCILE (P3 Analyse socle)

### Données source

```
pilier_socle : P3 Analyse
nb_ecart_total : 8
nb_ecart_socle_coeur : 6
nb_circuits_actifs_socle : 14
total_activations_socle : 78
clusters_dominants : [
  {C10 × C15, 6 co-oc, modulation + émotion},
  {C10 × C12, 5 co-oc, modulation + priorisation},
  {C10 × C7, 4 co-oc, modulation + contextualisation}
]
```

### Rendu

**BLOC 1 — Référence au schéma**
> 📍 *Dans le schéma du moteur : halo vert autour du pilier Analyse (P3)*

**BLOC 2 — Définition inline**
> **Qu'est-ce qu'un filtre cognitif ?** C'est la pré-programmation automatique du pilier socle. Ce n'est pas une composante séparée : c'est la caractéristique intrinsèque qui fait qu'un pilier fonctionne comme socle. Un pilier socle est, par définition, un pilier filtré. Le filtre fait que la situation apparaît d'emblée à la personne sous une forme particulière — avant tout traitement conscient.

**BLOC 3 — Formulation du filtre**
> ### Votre filtre cognitif : « Lire ce qui est vrai dans la situation, depuis l'observation directe »

**BLOC 4 — Explication laboratoire**
> **Lecture laboratoire** : le filtre cognitif de Cécile est porté par son pilier socle Analyse (P3) qui compte 14 circuits actifs sur 15 et totalise 78 activations. Sur les 8 ÉCART de Cécile (questions où le pilier attendu n'a pas été celui de sa réponse spontanée), 6 ÉCART sur 8 ont P3 comme pilier cœur spontané, y compris face à des questions attendant P2 (Tri), P4 (Création de solutions) ou P5 (Mise en œuvre et exécution). Cette activation automatique du pilier Analyse, indépendamment du pilier attendu, est la preuve directe du filtre.
>
> La forme spécifique du filtre se lit dans l'analyse des clusters T3 du pilier socle. Le cluster dominant C10 × C15 (6 co-occurrences) révèle une modulation d'effort systématiquement informée par le signal limbique. Le cluster C10 × C12 (5 co-occurrences) révèle une modulation couplée à la priorisation hiérarchique. Le cluster C10 × C7 (4 co-occurrences) révèle une modulation ancrée dans la contextualisation. Le filtre opère donc sur trois couches simultanément : émotionnelle, priorisante et contextualisante.
>
> **Précision** : « vrai » signifie ici véracité factuelle (informations sourcées, documentées, circonstanciées, contextualisées) — pas volonté d'avoir raison. Cette lecture est confirmée par la présence systématique des circuits d'évaluation de fiabilité (C4 P3) et de détection des biais dans le profil.

**BLOC 5 — Explication candidat**
> Votre filtre cognitif est la manière dont toute situation vous apparaît d'abord. Avant même que vous ayez décidé quoi faire, la situation **se présente à vous comme quelque chose à évaluer** — c'est automatique, c'est vous, c'est votre signature la plus profonde.
>
> Concrètement, chez vous ce filtre a trois couches qui fonctionnent toujours ensemble : vous captez immédiatement le signal émotionnel de la situation (la vôtre, celle des autres, l'ambiance), vous identifiez ce qui prime (« le truc capital c'est... »), et vous lisez le contexte spécifique avant de généraliser. Ces trois mouvements sont **inséparables** chez vous — c'est ce que nos analyses des clusters de vos circuits révèlent.
>
> **Important** : quand nous disons « lire ce qui est vrai », nous parlons de véracité factuelle — vous cherchez des informations sourcées, documentées, circonstanciées, contextualisées. Vous ne cherchez pas à avoir raison. C'est pour cela que vous collectez encore et encore : pour affiner la finesse de la véracité que vous cherchez.
>
> Cette opération ne se décide pas — elle est automatique. C'est ce qui se passe en vous avant toute décision, avant toute action.

---

## 8. EXEMPLE — RÉMI (P4 Création de solutions socle)

### Données source

```
pilier_socle : P4 Création de solutions
nb_ecart_total : estimé 7-8
nb_ecart_socle_coeur : estimé 5-6
nb_circuits_actifs_socle : 11
clusters_dominants : [
  {C6 × C15, 3 co-oc, diversification + orchestration}
]
filtre_pose_memoire_7 : "Maintenir les voies ouvertes"
```

### Rendu

**BLOC 1 — Référence au schéma**
> 📍 *Dans le schéma du moteur : halo vert autour du pilier Création de solutions (P4)*

**BLOC 2 — Définition inline**
> [même définition standard, identique à Cécile]

**BLOC 3 — Formulation du filtre**
> ### Votre filtre cognitif : « Maintenir les voies ouvertes »

**BLOC 4 — Explication laboratoire**
> **Lecture laboratoire** : le filtre cognitif de Rémi est porté par son pilier socle Création de solutions (P4) qui compte 11 circuits actifs sur 15. Sur ses ÉCART, le pilier P4 s'impose comme pilier cœur spontané dans la majorité des cas, y compris face à des questions attendant d'autres piliers. Cette activation automatique de la création de solutions est la preuve directe du filtre.
>
> La forme spécifique du filtre se lit dans le cluster identifié C6 × C15 (3 co-occurrences) : la diversification méthodique des options (C6) se couple systématiquement à l'orchestration de solutions multidimensionnelles (C15). Chez Rémi, la création de solutions n'est jamais exclusive — elle s'accompagne toujours d'une gestion parallèle des alternatives et d'une orchestration de leur coexistence.
>
> **Précision** : « maintenir les voies ouvertes » signifie ici refuser la clôture prématurée des options — pas éviter de décider. Rémi décide, mais il préserve activement la réversibilité et la multiplicité des chemins possibles tant que l'irréversibilité n'est pas atteinte.

**BLOC 5 — Explication candidat**
> Votre filtre cognitif est la manière dont toute situation vous apparaît d'abord. Avant même que vous ayez décidé quoi faire, la situation **se présente à vous comme un champ d'options à explorer** — c'est automatique, c'est vous, c'est votre signature la plus profonde.
>
> Concrètement, chez vous ce filtre a une forme claire : face à toute situation, vous générez immédiatement plusieurs voies possibles, et vous travaillez activement pour **garder ces voies ouvertes** aussi longtemps que possible. Vous ne voulez pas fermer trop tôt. Vos analyses montrent que votre diversification n'est jamais solitaire — elle s'accompagne systématiquement d'une orchestration des options pour qu'elles puissent coexister.
>
> **Important** : « maintenir les voies ouvertes » ne veut pas dire éviter de décider. Vous décidez — mais vous préservez la réversibilité et la multiplicité tant que ce n'est pas irréversible.
>
> Cette opération ne se décide pas — elle est automatique. C'est ce qui se passe en vous avant toute décision, avant toute action.

---

## 9. EXEMPLE — VÉRONIQUE (P3 Analyse socle)

### Données source

```
pilier_socle : P3 Analyse
nb_ecart_total : estimé
nb_ecart_socle_coeur : estimé majoritaire
nb_circuits_actifs_socle : 11
clusters_dominants : [
  {C10 × C7, 6 co-oc, modulation + contextualisation}
]
filtre_pose_memoire_7 : "Extraire le principe logique"
```

### Rendu

**BLOC 1 — Référence au schéma**
> 📍 *Dans le schéma du moteur : halo vert autour du pilier Analyse (P3)*

**BLOC 2 — Définition inline**
> [même définition standard]

**BLOC 3 — Formulation du filtre**
> ### Votre filtre cognitif : « Extraire le principe logique »

**BLOC 4 — Explication laboratoire**
> **Lecture laboratoire** : le filtre cognitif de Véronique est porté par son pilier socle Analyse (P3) qui compte 11 circuits actifs sur 15. Sur ses ÉCART, le pilier P3 s'impose comme pilier cœur spontané dans la majorité des cas, y compris face à des questions attendant d'autres piliers.
>
> La forme spécifique du filtre se lit dans le cluster dominant et exclusif C10 × C7 (6 co-occurrences) : la modulation d'analyse (C10) passe systématiquement par une contextualisation approfondie préalable (C7). Le circuit C11 (Extraction des principes sous-jacents) est également présent à niveau HAUT, confirmant la direction cognitive vers l'abstraction logique.
>
> **Précision** : « principe logique » signifie ici règle de fonctionnement qui tient dans toutes les situations similaires — pas raisonnement déductif abstrait. Véronique cherche la structure sous-jacente d'un phénomène, pas une démonstration formelle.

**BLOC 5 — Explication candidat**
> Votre filtre cognitif est la manière dont toute situation vous apparaît d'abord. Avant même que vous ayez décidé quoi faire, la situation **se présente à vous comme quelque chose dont il faut extraire le principe** — c'est automatique, c'est vous, c'est votre signature la plus profonde.
>
> Concrètement, chez vous ce filtre a une forme précise : face à toute situation, vous cherchez **la règle de fonctionnement** — ce qui explique le phénomène, ce qui le fait tenir, ce qui va pouvoir s'appliquer à d'autres situations similaires. Vos analyses montrent que votre extraction passe toujours par une lecture contextuelle préalable : vous ne généralisez pas abstraitement, vous partez du particulier pour remonter au principe.
>
> **Important** : par « principe logique », nous ne parlons pas de raisonnement abstrait déconnecté du réel. Vous cherchez une règle qui tient — qui explique vraiment, qui fonctionne dans le réel.
>
> Cette opération ne se décide pas — elle est automatique. C'est ce qui se passe en vous avant toute décision, avant toute action.

---

## 10. PIÈGES À ÉVITER

### Piège 1 — Confondre filtre et finalité

❌ Filtre : « Produire des décisions justement calibrées »
→ C'est de la finalité (résultat visé), pas du filtre (mode de captation)

✅ Filtre : « Lire ce qui est vrai dans la situation »
→ Verbe à l'infinitif, mode de captation

### Piège 2 — Formulation vague ou générique

❌ « Analyser en profondeur »
→ Trop générique, ne distingue pas le candidat

✅ « Lire ce qui est vrai dans la situation, depuis l'observation directe »
→ Précis, ancré dans les circuits dominants du candidat

### Piège 3 — Ne pas préciser le sens des mots-clés ambigus

❌ « Votre filtre est de lire le vrai » (sans préciser)
→ « Vrai » peut être mal compris

✅ Ajout systématique d'une précision sémantique : « "vrai" = véracité factuelle, pas avoir raison »

### Piège 4 — Introduire une interprétation psychologique

❌ « Votre filtre révèle votre besoin profond de contrôle »
→ Interprétation psychologique hors champ

✅ Rester strictement cognitif : description de l'opération, pas inférence sur des motivations

### Piège 5 — Oublier la preuve par les ÉCART

❌ Simplement affirmer « votre pilier socle est P3 »
→ Pas de preuve protocolaire

✅ « Sur vos 8 ÉCART, 6 ont P3 comme pilier cœur spontané — preuve directe du filtre »

---

## 11. CHECK-LIST AUTO-CONTRÔLE

- [ ] Filtre formulé en **verbe à l'infinitif** (pas en « pour... »)
- [ ] Pas de confusion avec la finalité
- [ ] **Précision sémantique** ajoutée si mot-clé ambigu (vrai, maintenir, etc.)
- [ ] **Preuve par les ÉCART** citée avec chiffres exacts
- [ ] **Clusters dominants** cités avec nombre de co-occurrences
- [ ] **Double explication** laboratoire + candidat présente
- [ ] Pas d'évaluatif, pas de comparaison, pas de contamination
- [ ] Formulation standardisée « Lecture laboratoire : » présente en bloc 4
- [ ] Bloc 5 adressé en « vous » uniquement

---
---

# TEMPLATE #5 — BOUCLE COGNITIVE (ENCHAÎNEMENT DES PILIERS)

## 1. NOM DU TEMPLATE

**Template #5 — Enchaînement des piliers · la boucle cognitive**

Brique rédactionnelle qui décrit **comment les 5 piliers du candidat s'enchaînent** pour traiter une situation — séquencée ou fractionnée, avec sortie toujours en P5.

---

## 2. BUT

Permettre à l'agent de rédiger la section « Boucle cognitive » du bilan en :
- **Définissant** ce qu'est la boucle cognitive (rappel glossaire)
- **Posant la règle structurante** : sortie toujours P5 (cognition orientée décision pour agir)
- **Décrivant les patterns observés** chez le candidat (séquences types, fractionnements)
- **Reliant la boucle au filtre** (la boucle est la mise en œuvre du filtre)

---

## 3. QUAND UTILISER CE TEMPLATE

**Utilisation** : dans la synthèse finale du bilan, section #2 (après le filtre cognitif).

**Volume** : 1 fois par bilan.

---

## 4. STRUCTURE OBLIGATOIRE

```
┌───────────────────────────────────────────────────────────────┐
│ BLOC 1 — RÉFÉRENCE AU SCHÉMA                                  │
│   • « Dans le schéma du moteur : flèches du cycle entre       │
│     les 5 piliers »                                           │
├───────────────────────────────────────────────────────────────┤
│ BLOC 2 — DÉFINITION INLINE                                    │
│   • Qu'est-ce que la boucle cognitive ?                       │
│   • Séquencée vs fractionnée                                  │
│   • RÈGLE ABSOLUE : sortie toujours P5                        │
├───────────────────────────────────────────────────────────────┤
│ BLOC 3 — EXPLICATION LABORATOIRE                              │
│   • Pattern d'entrée dominant (quel pilier en premier)        │
│   • Exemples de séquences types observées chez le candidat    │
│   • Caractérisation : boucle plutôt séquencée ou fractionnée  │
│   • Confirmation règle protocole : toutes sorties en P5       │
├───────────────────────────────────────────────────────────────┤
│ BLOC 4 — EXPLICATION CANDIDAT                                 │
│   • Où commence votre boucle                                  │
│   • Comment elle se déroule (séquences typiques)              │
│   • Adaptabilité : quand vous fractionnez, quand vous         │
│     raccourcissez                                             │
│   • La sortie par l'action (P5) comme marque du protocole     │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. SLOTS À REMPLIR

| Slot | Source |
|---|---|
| `{pilier_entree_dominant}` | T1 verbes_angles_piliers — pilier qui apparaît en premier dans la majorité des réponses |
| `{nb_reponses_entree_socle}` | T1 — compter sur 25 réponses combien commencent par le pilier socle |
| `{sequences_types}` | T1 — patterns récurrents de piliers dans les réponses |
| `{nb_fractionnements}` | T1 — nombre de réponses où un pilier est activé puis ré-activé |
| `{nb_sequences_courtes}` | T1 — nombre de réponses avec ≤ 3 piliers |
| `{nb_sequences_longues}` | T1 — nombre de réponses avec 4-5 piliers |

---

## 6. RÈGLES DE RÉDACTION

### 6.1 Règle absolue — sortie toujours P5

Dans **tous les bilans**, sans exception, la boucle cognitive doit mentionner explicitement que la sortie est **toujours en P5** (Mise en œuvre et exécution). C'est la règle structurante du Profil-Cognitif : le protocole mesure la cognition de la décision pour agir — P5 est le moment où l'analyse devient action.

**Phrase-type obligatoire en bloc 3** :
> « Règle protocole respectée : toutes les boucles observées sortent par P5. »

**Phrase-type obligatoire en bloc 4** :
> « Toutes vos boucles, courtes ou fractionnées, sortent par l'action (P5). Votre cognition n'est jamais contemplative — elle est orientée décision. »

### 6.2 Règle — caractériser la nature de la boucle

Chaque candidat a une **tendance dominante** :
- Boucle **majoritairement séquencée** : les piliers s'activent dans l'ordre linéaire, peu de retours en arrière
- Boucle **majoritairement fractionnée** : le candidat revient sur des piliers déjà activés
- Boucle **adaptative** : le candidat alterne entre les deux selon les enjeux

L'agent doit identifier la tendance dominante et la nommer.

### 6.3 Règle — relier au filtre

Le bloc 4 doit faire le lien avec le filtre précédemment posé. Phrase-type :
> « Cette manière de boucler est la mise en œuvre concrète de votre filtre cognitif : votre pilier socle oriente l'entrée, les autres piliers se mettent au service de cette lecture initiale. »

---

## 7. EXEMPLE — CÉCILE

### Données observées

- Pilier d'entrée dominant : P3 (Analyse) dans 19/25 réponses
- Séquences types observées : P3→P1→P3→P4→P5 (fractionnée), P3→P4→P5 (séquencée courte), P3→P5 (ultra-courte)
- Tendance : adaptative — fractionne quand l'enjeu le demande, raccourcit quand l'expérience suffit

### Rendu

**BLOC 1** — 📍 *Dans le schéma du moteur : flèches du cycle entre les 5 piliers*

**BLOC 2** — Définition inline standard

**BLOC 3** — Explication laboratoire
> **Lecture laboratoire** : la boucle cognitive de Cécile s'observe au travers des séquences des piliers dans ses 25 réponses. Pattern dominant : P3 (Analyse) en entrée systématique — 19 réponses sur 25 commencent par le pilier socle, y compris dans les réponses où la question attendait un autre pilier.
>
> Séquences typiques observées :
> • P3 → P1 → P3 → P4 → P5 (Q3, Q9, Q21) — séquence **fractionnée** : Cécile diagnostique, collecte pour confirmer, rediagnostique, conçoit, exécute
> • P3 → P4 → P5 (Q18, Q22, Q24) — séquence **séquencée courte** : Cécile diagnostique, conçoit directement, exécute
> • P3 → P5 (Q11, Q13) — séquence **ultra-courte** : expérience suffisante, pas de passage par collecte ou conception
>
> Caractérisation : boucle **adaptative** — Cécile fractionne quand l'enjeu le demande, raccourcit quand son expérience suffit. Cette modulation de la longueur de la boucle est elle-même une manifestation du cluster C10 × C15 (modulation d'effort informée par le signal limbique).
>
> Règle protocole respectée : toutes les boucles observées sortent par P5. Aucun cas de sortie prématurée ou de boucle non close.

**BLOC 4** — Explication candidat
> Votre boucle cognitive, c'est la séquence que vous enclenchez automatiquement à chaque situation. Chez vous, **elle commence presque toujours par votre Analyse (P3)** — c'est votre filtre qui opère. Avant même d'avoir collecté ou trié quoi que ce soit, vous avez déjà commencé à évaluer la situation.
>
> Ensuite, votre boucle s'adapte à ce que l'enjeu demande. Dans les situations complexes, vous **fractionnez** : vous analysez, vous allez chercher une information précise, vous ré-analysez avec cette nouvelle donnée, vous concevez, et vous exécutez. Dans les situations où votre expérience a déjà fourni la matière, vous **raccourcissez** : analyse et décision d'agir s'enchaînent directement.
>
> Cette manière de boucler est la mise en œuvre concrète de votre filtre cognitif : votre pilier socle oriente l'entrée, les autres piliers se mettent au service de cette lecture initiale.
>
> **Un point important** : toutes vos boucles, courtes ou fractionnées, **sortent par l'action (P5)**. Votre cognition n'est jamais contemplative — elle est orientée décision. C'est la marque du Profil-Cognitif : il mesure précisément la cognition qui conduit à l'acte.

---

## 8. EXEMPLE — RÉMI

### Données observées

- Pilier d'entrée dominant : P3 (structurant 1) ou P4 (socle) selon situation
- Séquences types : P3 → P4 → P4' → P4'' → P5 (diversification multiple avant action)
- Tendance : séquences **souvent longues** avec nombreuses alternatives en P4

### Rendu

**BLOC 3** — Explication laboratoire
> **Lecture laboratoire** : la boucle cognitive de Rémi entre typiquement par P3 (Analyse, structurant 1) pour une lecture rapide, puis **s'épanouit en P4** (Création de solutions, socle) où plusieurs options sont générées et orchestrées en parallèle avant la sortie.
>
> Séquence dominante observée : P3 → P4 → [retour P4 pour alternative] → P5. Cécile statue et exécute ; Rémi **maintient plusieurs voies ouvertes dans P4 avant de sortir**.
>
> Caractérisation : boucle **densifiée en P4** — le pilier socle est le lieu où la boucle s'attarde le plus. Cette densification en P4 est cohérente avec le filtre « maintenir les voies ouvertes » et se lit dans le cluster C6 × C15 (diversification couplée à orchestration).
>
> Règle protocole respectée : toutes les boucles observées sortent par P5, après que les alternatives en P4 ont été suffisamment orchestrées.

**BLOC 4** — Explication candidat
> Votre boucle cognitive, c'est la séquence que vous enclenchez automatiquement à chaque situation. Chez vous, **la boucle s'ouvre rapidement vers la création d'options**. Après une lecture initiale de la situation, vous entrez dans votre zone de force : générer plusieurs voies possibles, les orchestrer, les faire coexister.
>
> Vos séquences sont **densifiées dans la création de solutions** : vous ne sortez pas tant que les alternatives n'ont pas été suffisamment explorées et orchestrées. C'est la manifestation concrète de votre filtre « maintenir les voies ouvertes ».
>
> **Toutes vos boucles sortent par l'action (P5)** — vous décidez et agissez. Mais vous préservez la réversibilité aussi longtemps que possible avant cette sortie.

---

## 9. EXEMPLE — VÉRONIQUE

### Données observées

- Pilier d'entrée : P3 (Analyse socle) dans la majorité des cas
- Séquences types : P3 → P5 (souvent directe) ou P3 → P1 → P3 → P5 (collecte fine avant action)
- Tendance : **analyse approfondie puis action** — peu de création de solutions (P4 sous-développé)

### Rendu

**BLOC 3** — Explication laboratoire
> **Lecture laboratoire** : la boucle cognitive de Véronique entre systématiquement par P3 (Analyse socle), avec 11 circuits actifs. Pattern dominant : séquences **analyse → action** directes, avec passage par P1 (Collecte) quand la matière manque.
>
> Séquences typiques observées :
> • P3 → P5 — séquence directe quand l'analyse aboutit à une règle applicable
> • P3 → P1 → P3 → P5 — séquence avec collecte intermédiaire pour affiner le principe
>
> Caractérisation : boucle **centrée sur l'analyse profonde**, courte vers l'action quand le principe est extrait. Peu d'activité en P4 (Création de solutions) — Véronique ne génère pas d'alternatives multiples, elle applique le principe qu'elle a extrait.
>
> Règle protocole respectée : toutes les boucles observées sortent par P5.

**BLOC 4** — Explication candidat
> Votre boucle cognitive, c'est la séquence que vous enclenchez automatiquement à chaque situation. Chez vous, **tout commence par une analyse profonde** — vous lisez la situation, vous cherchez le principe qui l'explique, et c'est sur la base de ce principe que vous agissez.
>
> Votre boucle est souvent **courte et directe** : analyse → action. Quand la matière initiale est insuffisante, vous ajoutez une étape de collecte ciblée, puis vous revenez à l'analyse pour affiner le principe. Vous passez peu de temps à générer des alternatives — une fois le principe extrait, l'action découle naturellement.
>
> **Toutes vos boucles sortent par l'action (P5)** — votre cognition n'est pas spéculative, elle est orientée application du principe.

---

## 10. PIÈGES À ÉVITER

### Piège 1 — Oublier la règle « sortie toujours P5 »

❌ Décrire la boucle sans mentionner la sortie P5
✅ Toujours poser la règle explicitement dans bloc 3 et bloc 4

### Piège 2 — Confondre « boucle » et « liste de piliers actifs »

❌ « Tous vos piliers sont actifs »
✅ La boucle décrit un **ordre temporel** d'activation, pas une liste

### Piège 3 — Inventer des séquences non observées

❌ Décrire des séquences types sans les ancrer dans les données T1
✅ Chaque séquence citée doit être issue des `verbes_angles_piliers` de réponses précises

---

## 11. CHECK-LIST AUTO-CONTRÔLE

- [ ] Pilier d'entrée dominant identifié avec chiffres exacts
- [ ] Au moins 2-3 séquences types citées avec numéros de questions
- [ ] Caractérisation de la tendance (séquencée / fractionnée / adaptative / densifiée)
- [ ] **Règle sortie P5** mentionnée explicitement (phrase-type présente)
- [ ] Lien avec le filtre fait dans le bloc 4
- [ ] Pas d'invention de séquence non observée

---
---

# TEMPLATE #6 — FINALITÉ COGNITIVE (GRANDES LIGNES)

## 1. NOM DU TEMPLATE

**Template #6 — Finalité cognitive en grandes lignes**

Brique rédactionnelle qui **propose les grandes lignes** de la finalité du candidat sans la trancher — conformément au principe de production autonome du protocole : la finalité finale est posée par le candidat lui-même, en autonomie ou en tutorat.

---

## 2. BUT

Permettre à l'agent de rédiger la section « Finalité cognitive » du bilan en :
- **Définissant** ce qu'est une finalité cognitive (rappel glossaire)
- **Rappelant le principe fondamental** : la finalité est toujours couplée au filtre (elle existe nécessairement)
- **Proposant 3 grandes lignes** dérivées des clusters T3 v4
- **Invitant le candidat** à poser sa finalité (autonomie ou tutorat)

---

## 3. QUAND UTILISER CE TEMPLATE

**Utilisation** : synthèse finale du bilan, section #3 (après la boucle cognitive).

**Volume** : 1 fois par bilan.

---

## 4. STRUCTURE OBLIGATOIRE

```
┌───────────────────────────────────────────────────────────────┐
│ BLOC 1 — RÉFÉRENCE AU SCHÉMA                                  │
│   • « Dans le schéma du moteur : flèche de sortie à droite »  │
├───────────────────────────────────────────────────────────────┤
│ BLOC 2 — DÉFINITION INLINE                                    │
│   • Qu'est-ce qu'une finalité cognitive ?                     │
│   • Principe : toujours couplée au filtre                     │
│   • Posée par le candidat, pas par le protocole               │
├───────────────────────────────────────────────────────────────┤
│ BLOC 3 — EXPLICATION LABORATOIRE                              │
│   • Méthodologie de dérivation depuis les clusters            │
│   • Ce que les clusters dessinent chez ce candidat            │
│   • 3 grandes lignes formulées en résultats observables       │
│   • Précision sur le statut : à confirmer par le candidat     │
├───────────────────────────────────────────────────────────────┤
│ BLOC 4 — EXPLICATION CANDIDAT                                 │
│   • « Votre finalité existe déjà »                            │
│   • 3 grandes lignes reformulées pour le candidat             │
│   • Invitation à poser sa formulation                         │
│   • Options : autonomie ou tutorat                            │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. SLOTS À REMPLIR

| Slot | Source |
|---|---|
| `{clusters_dominants}` | T3 v4 |
| `{grande_ligne_1}` | Dérivée du cluster dominant, formulée en résultat observable |
| `{grande_ligne_2}` | Dérivée d'un autre cluster ou angle éthique |
| `{grande_ligne_3}` | Dérivée d'un 3e angle (contextualisation, anticipation, etc.) |
| `{justification_cluster}` | Pour chaque grande ligne, le cluster source |

---

## 6. RÈGLES DE RÉDACTION

### 6.1 Règle absolue — ne jamais trancher

Le template ne pose **JAMAIS** la finalité comme un fait. Il propose des **grandes lignes** et **invite** le candidat à formuler la sienne.

**INTERDIT** :
- « Votre finalité est : [formulation fermée] »
- « Vous cherchez à produire... » (trop affirmatif)

**ATTENDU** :
- « Les analyses dessinent plusieurs grandes lignes »
- « Voici ce qui se dégage — à vous de reconnaître celle qui résonne »

### 6.2 Règle — les 3 grandes lignes sont des résultats, pas des filtres

Chaque grande ligne doit être formulée comme un **résultat observable** — pas comme un mode de captation (qui serait du filtre).

| Filtre (INTERDIT en finalité) | Finalité (ATTENDU) |
|---|---|
| « Moduler son effort selon l'enjeu » | « Produire des décisions justement calibrées » |
| « Lire le vrai dans la situation » | « Ne pas se contenter de décisions génériques » |
| « Maintenir les voies ouvertes » | « Jamais fermer une option avant l'irréversibilité » |

### 6.3 Règle — ancrage dans les clusters

Chaque grande ligne doit être **traçable** à un cluster T3 v4 spécifique. L'agent cite le cluster source dans le bloc 3 (laboratoire).

### 6.4 Règle — invitation au candidat

Le bloc 4 doit systématiquement :
- Rappeler que la finalité existe déjà en lui
- Présenter les 3 grandes lignes comme des propositions
- Inviter à la formulation personnelle
- Mentionner les 2 options : **autonomie** (s'il se reconnaît immédiatement) ou **tutorat** (s'il souhaite affiner avec un tiers)

### 6.5 Formulations standardisées

| Contexte | Formulation standard |
|---|---|
| Ouverture bloc 4 | « Votre finalité cognitive existe déjà. Elle est présente en vous depuis longtemps — le moteur a été construit autour d'elle. » |
| Introduction grandes lignes | « Voici les grandes lignes que les analyses de vos circuits dessinent chez vous : » |
| Clôture | « Cette formulation, vous pouvez la poser seule, ou avec un accompagnement (tutorat Profil-Cognitif) si vous souhaitez affiner avec un regard tiers. » |

---

## 7. EXEMPLE — CÉCILE

### Grandes lignes posées (validées par Isabelle)

**Ordre : 1 → 3 → 2**

1. « Produire des décisions justement calibrées — qui répondent aux enjeux réels et qui valent l'effort qu'on y met »
2. « Ne jamais se contenter de décisions génériques — produire des arbitrages qui tiennent dans leur contexte spécifique »
3. « Préserver ses facultés cognitives pour ce qui le mérite — ne pas les polluer sur ce qui ne le mérite pas »

### Rendu

**BLOC 1** — 📍 *Dans le schéma du moteur : flèche de sortie à droite du moteur*

**BLOC 2** — Définition inline
> **Qu'est-ce qu'une finalité cognitive ?** C'est le résultat attendu quand le filtre s'active — un objectif cognitif concret, lié à l'action. Principe fondamental : **la finalité est toujours couplée au filtre** — elle existe nécessairement, qu'on l'ait détectée ou non. Sans finalité, un filtre n'aurait pas de direction.
>
> Principe de production du protocole : **seule vous pouvez poser votre finalité**. Les analyses rendent visibles les grandes lignes, mais la formulation précise vous revient — en autonomie ou en tutorat.

**BLOC 3** — Explication laboratoire
> **Lecture laboratoire** : la méthodologie du protocole identifie les grandes lignes de finalité par croisement des clusters T3 v4 du pilier socle. Chaque cluster révèle une couche du mode opératoire du filtre — et donc une direction vers laquelle le filtre tend.
>
> Pour Cécile, les clusters dominants dessinent trois grandes lignes cohérentes :
>
> **Grande ligne 1** — *« Produire des décisions justement calibrées, qui répondent aux enjeux réels et qui valent l'effort qu'on y met »*
> Ancrage : cluster dominant C10 × C15 (modulation + émotion, 6 co-oc) et cluster C10 × C12 (modulation + priorisation, 5 co-oc). La justesse du calibrage est le résultat vers lequel ces clusters convergent.
>
> **Grande ligne 3** — *« Ne jamais se contenter de décisions génériques — produire des arbitrages qui tiennent dans leur contexte spécifique »*
> Ancrage : cluster C10 × C7 (modulation + contextualisation, 4 co-oc) et présence systématique de C7 (contextualisation approfondie) à niveau HAUT. L'exigence de spécificité contextuelle est la direction.
>
> **Grande ligne 2** — *« Préserver ses facultés cognitives pour ce qui le mérite — ne pas les polluer sur ce qui ne le mérite pas »*
> Ancrage : la présence de modulation d'effort (C10 dominant) couplée aux signaux limbiques (C15) révèle une dimension d'économie éthique de l'effort cognitif. Cette formulation porte la dimension de justice intrinsèque — rendre justice à ce qui mérite l'engagement.
>
> Statut : ces trois grandes lignes sont cohérentes entre elles (elles se renforcent mutuellement). La formulation précise qui synthétise ces trois angles reste à poser par la candidate, soit en autonomie, soit en tutorat.

**BLOC 4** — Explication candidat
> Votre finalité cognitive existe déjà. Elle est présente en vous depuis longtemps — votre moteur a été construit autour d'elle, elle n'est pas à inventer, elle est à reconnaître et à mettre en mots.
>
> Les analyses de votre moteur nous permettent de vous proposer des grandes lignes. Voici ce qu'elles dessinent chez vous :
>
> **1.** *Produire des décisions justement calibrées — qui répondent aux enjeux réels et qui valent l'effort qu'on y met*
>
> **2.** *Ne jamais se contenter de décisions génériques — produire des arbitrages qui tiennent dans leur contexte spécifique*
>
> **3.** *Préserver vos facultés cognitives pour ce qui le mérite — ne pas les polluer sur ce qui ne le mérite pas*
>
> Ces trois formulations ne sont pas trois finalités différentes. Ce sont trois angles d'une même intention profonde : votre moteur cherche **la justesse** — la justesse du calibrage, la justesse contextuelle, la justesse de l'investissement.
>
> Laquelle de ces formulations vous semble la plus proche de ce que vous cherchez au fond ? Pouvez-vous les combiner en une phrase qui soit la vôtre ? Cette formulation, vous pouvez la poser **seule**, si vous vous reconnaissez immédiatement dans ces grandes lignes — ou **avec un accompagnement** (tutorat Profil-Cognitif), si vous souhaitez affiner avec un regard tiers. Votre finalité est la dernière pièce de votre signature cognitive.

---

## 8. EXEMPLE — RÉMI (à l'échelle)

### Dérivation depuis clusters

- Cluster C6 × C15 (diversification + orchestration)
- Filtre posé : « maintenir les voies ouvertes »
- Finalité probable (mémoire #7) : « jamais fermer une option avant l'irréversibilité »

### Grandes lignes proposées

**Grande ligne 1** — *« Jamais fermer une option avant l'irréversibilité »*
Ancrage : cluster dominant C6 × C15. La préservation active des alternatives est le résultat visé.

**Grande ligne 2** — *« Produire des solutions qui s'enrichissent des alternatives plutôt qu'elles ne les éliminent »*
Ancrage : C15 (orchestration multidimensionnelle). La coexistence des voies est une finalité en elle-même.

**Grande ligne 3** — *« Rester libre de bifurquer jusqu'au dernier moment utile »*
Ancrage : cohérence filtre + boucle densifiée en P4.

[Le rendu suit la même structure que pour Cécile — adapté aux grandes lignes de Rémi.]

---

## 9. EXEMPLE — VÉRONIQUE (à l'échelle)

### Dérivation

- Cluster C10 × C7 (modulation + contextualisation)
- C11 (extraction des principes) en HAUT
- Filtre posé : « extraire le principe logique »
- Finalité probable (mémoire #7) : « produire des règles qui tiennent »

### Grandes lignes proposées

**Grande ligne 1** — *« Produire des règles qui tiennent — qui expliquent vraiment et qui fonctionnent dans le réel »*
Ancrage : cluster dominant C10 × C7 + C11 HAUT.

**Grande ligne 2** — *« Comprendre en profondeur plutôt que réagir en surface »*
Ancrage : modulation d'analyse couplée à la contextualisation.

**Grande ligne 3** — *« Ne pas appliquer de solutions génériques — toujours adapter le principe au contexte concret »*
Ancrage : C7 HAUT, prudence du passage à l'action.

---

## 10. PIÈGES À ÉVITER

### Piège 1 — Formuler une grande ligne en filtre

❌ *« Moduler son effort selon l'enjeu »* (c'est le filtre)
✅ *« Produire des décisions justement calibrées »* (c'est le résultat)

### Piège 2 — Trancher la finalité à la place du candidat

❌ *« Votre finalité est : produire des décisions justement calibrées »*
✅ *« Voici les grandes lignes — à vous de poser votre formulation »*

### Piège 3 — Proposer des grandes lignes non ancrées

❌ Proposer des grandes lignes vagues, sans cluster source
✅ Chaque grande ligne doit être traçable à un cluster ou à une combinaison de circuits dominants

### Piège 4 — Oublier l'invitation autonomie/tutorat

❌ Terminer sans inviter à la formulation
✅ Proposer systématiquement les 2 options : autonomie ou tutorat

---

## 11. CHECK-LIST AUTO-CONTRÔLE

- [ ] 3 grandes lignes proposées
- [ ] Chaque grande ligne est un **résultat observable** (pas un filtre)
- [ ] Chaque grande ligne est **ancrée dans un cluster T3 v4** ou un circuit dominant
- [ ] Aucune des formulations n'est présentée comme tranchée
- [ ] Invitation au candidat (autonomie ou tutorat) présente en bloc 4
- [ ] Principe « finalité toujours couplée au filtre » rappelé en bloc 2
- [ ] Formulations standardisées utilisées

---
---

# TEMPLATE #7 — SIGNATURE COGNITIVE (SYNTHÈSE INTÉGRÉE)

## 1. NOM DU TEMPLATE

**Template #7 — Signature cognitive · synthèse intégrée**

Brique rédactionnelle qui **assemble** pilier socle et finalité en une signature cognitive complète, posée comme **l'identité cognitive** du candidat.

---

## 2. BUT

Permettre à l'agent de rédiger la section « Signature cognitive » du bilan en :
- **Définissant** ce qu'est une signature cognitive
- **Assemblant explicitement** pilier socle (+ filtre intrinsèque) + finalité
- **Présentant l'équation** visuelle de la signature
- **Mettant en récit** la signature intégrée dans une formulation unique

Contrairement aux templates #4, #5, #6, ce template produit **une formulation intégrée simple** (pas de double colonne labo/candidat) — la signature est une synthèse, elle doit se lire d'un trait.

---

## 3. QUAND UTILISER CE TEMPLATE

**Utilisation** : synthèse finale, section #4 (après la finalité).

**Volume** : 1 fois par bilan.

---

## 4. STRUCTURE OBLIGATOIRE

```
┌───────────────────────────────────────────────────────────────┐
│ BLOC 1 — RÉFÉRENCE AU SCHÉMA                                  │
│   • « Dans le schéma : équation en pied — signature           │
│     cognitive = pilier socle + finalité »                     │
├───────────────────────────────────────────────────────────────┤
│ BLOC 2 — DÉFINITION INLINE                                    │
│   • Qu'est-ce qu'une signature cognitive ?                    │
│   • Formule : socle + finalité (filtre intrinsèque au socle)  │
├───────────────────────────────────────────────────────────────┤
│ BLOC 3 — ÉQUATION VISUELLE                                    │
│   • Encart visuel dans un cadre                               │
│   • Pilier socle nommé (avec filtre)                          │
│   • Signe +                                                   │
│   • Finalité (en « grandes lignes à finaliser »)              │
│   • Signe =                                                   │
│   • Signature cognitive complète                              │
├───────────────────────────────────────────────────────────────┤
│ BLOC 4 — MISE EN RÉCIT                                        │
│   • Paragraphe intégré décrivant la signature en action       │
│   • Comment le socle et la finalité se combinent              │
│   • 4-6 phrases, adressées au candidat en « vous »            │
├───────────────────────────────────────────────────────────────┤
│ BLOC 5 — DIFFÉRENCIATION                                      │
│   • Ce qui distingue cette signature d'une autre              │
│   • Référence aux clusters dominants                          │
│   • Pas de comparaison avec candidats spécifiques             │
│   • 2-3 phrases                                               │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. SLOTS À REMPLIR

| Slot | Source |
|---|---|
| `{pilier_socle_nom}` | T4 / T3 |
| `{pilier_socle_id}` | T4 / T3 |
| `{filtre_formulation}` | Template #4 précédent |
| `{grande_ligne_principale}` | Template #6, grande ligne 1 (la plus directe) |
| `{clusters_dominants}` | T3 v4 |

---

## 6. RÈGLES DE RÉDACTION

### 6.1 Règle absolue — pas de double colonne

Ce template produit une **formulation intégrée unique** — pas la double explication labo/candidat qu'on utilise dans les autres templates de synthèse.

**Raison** : la signature cognitive est par nature une **synthèse** — la fractionner en deux versions casserait son unité.

### 6.2 Règle — statut ouvert de la finalité

Dans l'équation (bloc 3), la finalité est présentée comme **« à finaliser par le candidat »** — pas comme tranchée. Format :

```
Finalité : [grande ligne principale]
(formulation à confirmer lors de la restitution)
```

### 6.3 Règle — pas de comparaison avec candidats spécifiques

Dans le bloc 5 (différenciation), l'agent dit ce qui rend la signature singulière **par les clusters spécifiques** — il ne compare pas à « la moyenne » ou à « d'autres candidats nommés ».

### 6.4 Formulations standardisées

| Contexte | Formulation standard |
|---|---|
| Ouverture bloc 4 | « Cette signature, mise en récit, c'est ceci : » |
| Ouverture bloc 5 | « Ce qui vous distingue d'une autre personne au même pilier socle : la forme spécifique de votre filtre. » |
| Clôture de la section | « C'est votre façon singulière d'être [nom du pilier socle en adjectif]. » |

---

## 7. EXEMPLE — CÉCILE

### Rendu

**BLOC 1** — 📍 *Dans le schéma : équation en pied — SIGNATURE COGNITIVE = Pilier socle + Finalité*

**BLOC 2** — Définition inline
> **Qu'est-ce qu'une signature cognitive ?** C'est l'identité cognitive d'une personne, ce qui la rend singulière dans sa manière de traiter l'information avant d'agir. Formule : **signature cognitive = pilier socle + finalité**, avec le filtre intrinsèque au pilier socle. Le pilier socle (qui porte son filtre) définit comment on traite, la finalité définit vers quoi on tend.

**BLOC 3** — Équation visuelle
> ```
> ╔═══════════════════════════════════════════════════════╗
> ║                                                       ║
> ║   PILIER SOCLE                                        ║
> ║   Analyse (P3)                                        ║
> ║   qui porte son filtre intrinsèque :                  ║
> ║   « lire ce qui est vrai dans la situation,           ║
> ║      depuis l'observation directe »                   ║
> ║                                                       ║
> ║              +                                        ║
> ║                                                       ║
> ║   FINALITÉ                                            ║
> ║   « produire des décisions justement calibrées,       ║
> ║      qui répondent aux enjeux réels »                 ║
> ║   (grande ligne principale, à finaliser)              ║
> ║                                                       ║
> ║              =                                        ║
> ║                                                       ║
> ║   VOTRE SIGNATURE COGNITIVE                           ║
> ║                                                       ║
> ╚═══════════════════════════════════════════════════════╝
> ```

**BLOC 4** — Mise en récit
> Cette signature, mise en récit, c'est ceci : **face à toute situation, vous captez automatiquement ce qui se passe vraiment — contexte factuel, signal émotionnel, priorité dominante — et vous calibrez votre engagement cognitif à la mesure de ce que la situation mérite vraiment**. Votre Analyse précède tout : collecte, tri, création de solutions, exécution se mettent ensuite au service de ce diagnostic initial.
>
> Ce n'est pas une posture choisie — c'est une pré-programmation. Votre moteur fonctionne ainsi, automatiquement, depuis longtemps.

**BLOC 5** — Différenciation
> Ce qui vous distingue d'une autre personne au même pilier socle : la forme spécifique de votre filtre. Vos clusters de circuits montrent que votre Analyse intègre systématiquement trois dimensions (émotion, priorisation, contextualisation) — et cette combinaison particulière n'est pas la même que celle d'un autre profil au même socle. C'est votre façon singulière d'être analytique.

---

## 8. EXEMPLE — RÉMI (structure)

**BLOC 3** — Équation visuelle
> ```
> ╔═══════════════════════════════════════════════════════╗
> ║   PILIER SOCLE                                        ║
> ║   Création de solutions (P4)                          ║
> ║   filtre : « maintenir les voies ouvertes »           ║
> ║                                                       ║
> ║              +                                        ║
> ║                                                       ║
> ║   FINALITÉ                                            ║
> ║   « jamais fermer une option avant l'irréversibilité »║
> ║                                                       ║
> ║              =                                        ║
> ║                                                       ║
> ║   VOTRE SIGNATURE COGNITIVE                           ║
> ╚═══════════════════════════════════════════════════════╝
> ```

**BLOC 4** — Mise en récit
> Cette signature, mise en récit, c'est ceci : **face à toute situation, vous générez automatiquement plusieurs voies possibles, et vous les gardez ouvertes aussi longtemps que la réversibilité le permet**. Votre Création de solutions précède tout — l'analyse elle-même se met au service de la multiplication des options, pas de leur réduction.

**BLOC 5** — Différenciation
> Ce qui vous distingue d'une autre personne au même pilier socle : la combinaison C6 × C15 (diversification couplée à orchestration) signe votre capacité à **maintenir la coexistence** des options, pas seulement leur génération. C'est votre façon singulière d'être créatif.

---

## 9. EXEMPLE — VÉRONIQUE (structure)

**BLOC 3** — Équation visuelle
> ```
> ╔═══════════════════════════════════════════════════════╗
> ║   PILIER SOCLE                                        ║
> ║   Analyse (P3)                                        ║
> ║   filtre : « extraire le principe logique »           ║
> ║                                                       ║
> ║              +                                        ║
> ║                                                       ║
> ║   FINALITÉ                                            ║
> ║   « produire des règles qui tiennent »                ║
> ║                                                       ║
> ║              =                                        ║
> ║                                                       ║
> ║   VOTRE SIGNATURE COGNITIVE                           ║
> ╚═══════════════════════════════════════════════════════╝
> ```

**BLOC 4** — Mise en récit
> Cette signature, mise en récit, c'est ceci : **face à toute situation, vous cherchez automatiquement la règle de fonctionnement sous-jacente, et vous ne passez à l'action que lorsque vous avez extrait un principe qui tient**. Votre Analyse précède tout — et votre exigence de principe applicable oriente tout le reste du moteur.

**BLOC 5** — Différenciation
> Ce qui vous distingue d'une autre personne au même pilier socle : le cluster dominant exclusif C10 × C7 (modulation couplée à contextualisation) signe une analyse qui **part toujours du particulier pour remonter au principe** — jamais de l'abstrait déconnecté. C'est votre façon singulière d'être analytique.

---

## 10. PIÈGES À ÉVITER

### Piège 1 — Double colonne

❌ Utiliser la structure labo/candidat dans ce template
✅ Formulation intégrée simple

### Piège 2 — Trancher la finalité dans l'équation

❌ « FINALITÉ : [formulation posée comme définitive] »
✅ « FINALITÉ : [grande ligne] (formulation à finaliser) »

### Piège 3 — Comparer à d'autres candidats nommés

❌ « Contrairement à Rémi qui... »
✅ « Ce qui vous distingue d'une autre personne au même pilier socle... »

### Piège 4 — Signature trop abstraite

❌ « Vous êtes une personne analytique »
✅ Formulation précise avec clusters et automatismes

---

## 11. CHECK-LIST AUTO-CONTRÔLE

- [ ] Formulation intégrée (pas de double colonne)
- [ ] Équation visuelle présente (bloc 3)
- [ ] Finalité présentée comme « à finaliser » dans l'équation
- [ ] Mise en récit adressée au candidat en « vous »
- [ ] Différenciation par les clusters dominants (pas par comparaison)
- [ ] Pas d'évaluatif
- [ ] Formulations standardisées utilisées

---

## FIN DU LOT A
