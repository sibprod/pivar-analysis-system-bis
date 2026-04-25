# TEMPLATE #1 — DESCRIPTION D'UN CIRCUIT COGNITIF AVEC USAGE SINGULIER

## Projet Profil-Cognitif · Templates de rédaction pour bilan candidat
## Modèle de référence · Format type pour les 15 templates du projet
## Version 1.0 · 23 avril 2026

---

## 1. NOM DU TEMPLATE

**Template #1 — Description d'un circuit avec usage singulier**

Brique rédactionnelle centrale du bilan candidat. Décrit un circuit cognitif activé chez un candidat, en nommant explicitement le circuit et en formulant l'usage singulier que le candidat en fait.

---

## 2. BUT

Ce template permet à l'agent de rédiger **une description de circuit** qui :
- **Nomme explicitement** le circuit (ID + nom du référentiel + fréquence)
- **Révèle l'usage singulier** du circuit chez ce candidat (pas une description générique du circuit lui-même)
- **Absorbe le sens des verbatims** sans les afficher bruts en encart
- **Exploite les clusters T3 v4** pour enrichir la description quand le circuit fait partie d'un cluster

Le circuit devient ainsi **signé par l'usage du candidat** — deux candidats qui ont le même circuit activé auront des descriptions différentes parce que les clusters et verbatims diffèrent.

---

## 3. QUAND UTILISER CE TEMPLATE

**Utilisation** : dans chaque bloc pilier du bilan, section « Vos circuits cognitifs activés ».

**Volume par bilan** :
- Pilier socle : 5 circuits à décrire
- Piliers structurants : 3 circuits chacun
- Piliers nécessaires au moteur : 3 circuits chacun
- **Total par bilan** : 17 descriptions de circuit

**Condition de déclenchement** : le circuit doit être au niveau **HAUT** (≥ 4 activations) OU faire partie des 3 circuits les plus activés du pilier.

**Cas particuliers** :
- Circuit INACTIF → ne pas utiliser ce template (pas de description à faire)
- Circuit MOYEN hors top 3 du pilier → ne pas utiliser ce template

---

## 4. STRUCTURE OBLIGATOIRE

La description d'un circuit suit **5 blocs dans cet ordre strict** :

```
┌───────────────────────────────────────────────────────────────┐
│ BLOC 1 — EN-TÊTE DU CIRCUIT                                   │
│   • Badge ID (C10, C6, etc.)                                  │
│   • Nom exact du référentiel                                  │
│   • Fréquence d'activation                                    │
│   • Interprétation de la fréquence                            │
├───────────────────────────────────────────────────────────────┤
│ BLOC 2 — DESCRIPTION D'USAGE SINGULIER (version candidat)     │
│   • 2 à 4 phrases adressées au candidat ("vous")              │
│   • Absorbe le sens des verbatims (pas d'encart brut)         │
│   • Peut inclure 1-2 verbatims courts en guillemets inline    │
│     SI ils sont emblématiques                                 │
├───────────────────────────────────────────────────────────────┤
│ BLOC 3 — SI CLUSTERS IDENTIFIÉS (optionnel)                   │
│   • Mention du ou des clusters dominants                      │
│   • Formulation accessible du couplage                        │
│   • 1 phrase par cluster majeur, max 2 clusters mentionnés    │
├───────────────────────────────────────────────────────────────┤
│ BLOC 4 — ENCART LABORATOIRE (version technique)               │
│   • Ratio franches/nuancées                                   │
│   • Clusters identifiés avec chiffres                         │
│   • 1 à 3 phrases factuelles                                  │
│   • Ton neutre, 3e personne ou impersonnel                    │
├───────────────────────────────────────────────────────────────┤
│ BLOC 5 — RÉFÉRENCES FACTUELLES (optionnel, en note)           │
│   • Liste des questions où le circuit s'active                │
│   • Accessible en dépliage pour le certificateur              │
└───────────────────────────────────────────────────────────────┘
```

### Blocs obligatoires vs optionnels

| Bloc | Statut | Condition |
|---|---|---|
| 1 — En-tête | **Obligatoire** | Toujours |
| 2 — Description usage | **Obligatoire** | Toujours |
| 3 — Clusters | **Conditionnel** | Si le circuit a au moins 1 cluster identifié en T3 v4 |
| 4 — Encart laboratoire | **Obligatoire** | Toujours |
| 5 — Références | **Optionnel** | Pour traçabilité certificateur |

---

## 5. SLOTS À REMPLIR

L'agent reçoit depuis T3 v4 un objet JSON par circuit avec les champs suivants à exploiter :

### Slots factuels (de T3 v4)

| Slot | Source T3 v4 | Type | Exemple |
|---|---|---|---|
| `{circuit_id}` | `circuit_id` | String | `"C10"` |
| `{circuit_nom}` | `circuit_nom` | String | `"Modulation de la profondeur d'analyse selon l'enjeu"` |
| `{frequence}` | `frequence` | Int | `16` |
| `{niveau}` | `niveau_activation` | String | `"HAUT"` |
| `{activations_franches}` | `activations_franches` | Array JSON | `[{"question":"Q11", "libelle":"..."}]` |
| `{activations_nuancees}` | `activations_nuancees` | Array JSON | `[{"question":"Q22", "libelle":"...", "inflexions":["C12"]}]` |
| `{clusters_identifies}` | `clusters_identifies` | Array JSON | `[{"circuit_partenaire":"C15", "nb_co_occurrences":6, "rang":1}]` |
| `{commentaire_attribution}` | `commentaire_attribution` | String | Texte synthétique T3 v4 |

### Slots dérivés (à calculer par l'agent)

| Slot | Calcul | Exemple |
|---|---|---|
| `{interpretation_frequence}` | Si `frequence` ≥ 14 → "ultra-dominant" ; ≥ 9 → "dominant" ; ≥ 6 → "récurrent" ; ≥ 4 → "régulier (seuil HAUT)" ; 1-3 → "présent" | `"ultra-dominant"` |
| `{cluster_dominant_libelle}` | Si rang=1 → formulation accessible du couplage (table ci-dessous) | `"modulation émotionnellement informée"` |
| `{ratio_franches_nuancees}` | `len(franches)` / `len(nuancees)` | `"2 franches / 14 nuancées"` |

### Slots à extraire des verbatims (par l'agent)

| Slot | Méthode | Exemple |
|---|---|---|
| `{verbatim_embleme_1}` | Verbatim court (≤ 10 mots), tiré des activations, emblématique du circuit | `"« ça reste un animal »"` |
| `{verbatim_embleme_2}` | Idem, 2e verbatim optionnel | `"« le truc capital »"` |

---

## 6. RÈGLES DE RÉDACTION

### 6.1 Règles de ton et de personne

| Règle | Obligation |
|---|---|
| **Adresse au candidat** (Bloc 2, 3) | 2e personne « vous » obligatoire |
| **Encart laboratoire** (Bloc 4) | 3e personne ou impersonnel — jamais « vous » |
| **Ton général** | Factuel, posé, scientifique — pas d'emphase, pas d'enthousiasme |
| **Évaluatifs interdits** | « impressionnant », « remarquable », « extraordinaire », « performant », « excellent » → **INTERDITS** partout |
| **Comparaisons interdites** | « contrairement à d'autres », « plus que la moyenne », « moins fréquent chez... » → **INTERDITS** (principe de révélation) |

### 6.2 Règles de longueur

| Bloc | Longueur cible |
|---|---|
| Bloc 1 (en-tête) | 1 ligne structurée |
| Bloc 2 (usage singulier candidat) | 3 à 5 phrases |
| Bloc 3 (clusters accessible) | 1 phrase par cluster, max 2 clusters mentionnés |
| Bloc 4 (encart laboratoire) | 1 à 3 phrases |

### 6.3 Règles pour les verbatims inline

- **Autorisés** : 1 à 3 verbatims très courts (≤ 10 mots chacun), en guillemets français « » inline dans une phrase
- **Interdits** : verbatims longs, verbatims en encart brut, blocs de citation
- **Exception stricte** : un verbatim particulièrement emblématique du candidat peut apparaître une fois (ex. « ça reste un animal » pour Cécile)

### 6.4 Règles pour les clusters

- **Cluster dominant** (rang=1) : toujours mentionné si présent
- **Cluster rang 2** : mentionné si le circuit est HAUT et que le bloc Bloc 3 n'est pas trop long
- **Clusters rang 3+** : ne pas mentionner dans la description candidat (les garder pour l'encart laboratoire)

### 6.5 Règle absolue — zéro invention

- **Toutes les affirmations** doivent être **dérivées** des données T3 v4 ou des verbatims du candidat
- **Aucune généralisation** du type « les personnes avec ce circuit... » ou « ce circuit permet généralement... »
- **Aucune interprétation psychologique** — uniquement description cognitive d'usage

### 6.6 Contaminations interdites

L'agent **ne doit pas** mentionner dans la description d'un circuit :
- Les excellences cognitives (ANT, DEC, MET, VUE) → appartiennent à l'Étape 2 (T5)
- Les 9 types cognitifs, l'axe A/F → appartiennent à l'Étape 3
- Des notions de matching candidat↔offre → post-bilan

### 6.7 Formulations standardisées « marque Profil-Cognitif »

Ces formulations type **doivent apparaître** pour garantir la signature laboratoire du bilan :

| Contexte | Formulation standard |
|---|---|
| Introduction d'une description usage | « Chez vous, ce circuit [se manifeste / se traduit / prend la forme de]... » |
| Introduction d'un cluster accessible | « Ce circuit ne fonctionne pas seul chez vous — il est systématiquement couplé à... » |
| Mention de l'automaticité du circuit | « Cette [opération cognitive] ne se décide pas, elle est automatique. » |
| Ouverture de l'encart laboratoire | « **Lecture laboratoire** : [données factuelles] » |
| Clôture de l'encart laboratoire | « [Affirmation finale factuelle]. » (pas d'ouverture vers l'interprétation) |

---

## 7. EXEMPLE — CÉCILE · P3 · C10

### Données source (T3 v4)

```json
{
  "candidat_id": "cecile",
  "pilier": "P3",
  "circuit_id": "C10",
  "circuit_nom": "Modulation de la profondeur d'analyse selon l'enjeu",
  "frequence": 16,
  "niveau_activation": "HAUT",
  "activations_franches": [
    {"question": "Q11", "libelle": "Évaluation de sa propre compétence"},
    {"question": "Q13", "libelle": "Sélection par pertinence intuitive"}
  ],
  "activations_nuancees": [
    /* ... 14 entrées ... */
  ],
  "clusters_identifies": [
    {"circuit_partenaire": "C15", "nb_co_occurrences": 6, "rang": 1,
     "questions": ["Q6","Q9","Q13","Q18","Q19","Q20"]},
    {"circuit_partenaire": "C12", "nb_co_occurrences": 5, "rang": 2,
     "questions": ["Q17","Q18","Q19","Q22","Q25"]}
  ],
  "commentaire_attribution": "Circuit socle ultra-dominant (16 activations) rarement activé seul : 2 franches / 14 nuancées. Cluster dominant C10 × C15 (6 co-oc) : la modulation d'effort intègre systématiquement la dimension émotionnelle comme donnée."
}
```

### Rendu du template appliqué

**BLOC 1 — En-tête**
> **C10 — Modulation de la profondeur d'analyse selon l'enjeu** · 16 activations · circuit ultra-dominant (mobilisé dans la majorité de vos réponses)

**BLOC 2 — Description d'usage singulier (candidat)**
> Chez vous, ce circuit se manifeste par une calibration automatique de votre effort d'analyse à l'enjeu réel de la situation. Trois mots peuvent suffire quand l'enjeu est faible (« ça reste un animal »), une phrase suffit à statuer sur ce qui prime quand l'enjeu est fort (« le truc capital c'est qu'il soit en bonne santé »). Cette modulation ne se décide pas — elle est automatique, et elle est tranchée : votre analyse ne s'étale pas, elle clôt la question au bon niveau.

**BLOC 3 — Clusters identifiés (candidat)**
> Ce circuit ne fonctionne pas seul chez vous — il est systématiquement couplé à votre circuit d'intégration émotionnelle (cluster dominant, 6 situations partagées) et à votre priorisation hiérarchique (cluster secondaire, 5 situations). Votre modulation d'effort intègre donc toujours deux couches : ce que la situation vous fait ressentir, et ce qui prime dans cette situation.

**BLOC 4 — Encart laboratoire**
> **Lecture laboratoire** : C10 niveau HAUT (16 activations), 2 franches / 14 nuancées. Cluster dominant C10 × C15 (6 co-occurrences : Q6, Q9, Q13, Q18, Q19, Q20). Cluster secondaire C10 × C12 (5 co-occurrences : Q17, Q18, Q19, Q22, Q25). Ce circuit est rarement isolé — il constitue le cœur d'un réseau dense d'activations couplées dans le pilier socle.

**BLOC 5 — Références factuelles (dépliable)**
> *Activations franches* : Q11, Q13
> *Activations nuancées* : Q3, Q6, Q9, Q12, Q17 (×2), Q18, Q19, Q20 (×2), Q22, Q24, Q25

---

## 8. EXEMPLE — RÉMI · P4 · C6

### Données source (T3 v4)

```json
{
  "candidat_id": "remi",
  "pilier": "P4",
  "circuit_id": "C6",
  "circuit_nom": "Diversification méthodique des options de solution",
  "frequence": 7,
  "niveau_activation": "HAUT",
  "activations_franches": [...],
  "activations_nuancees": [...],
  "clusters_identifies": [
    {"circuit_partenaire": "C15", "nb_co_occurrences": 3, "rang": 1,
     "questions": ["Q8","Q10","Q23"]}
  ],
  "commentaire_attribution": "Circuit socle (pilier P4 de Rémi). Cluster avec C15 (3 co-oc, orchestration multi-solutions) : la diversification s'appuie sur une lecture systémique des options."
}
```

### Rendu du template appliqué

**BLOC 1 — En-tête**
> **C6 — Diversification méthodique des options de solution** · 7 activations · circuit récurrent (bien installé dans votre pilier de création de solutions)

**BLOC 2 — Description d'usage singulier (candidat)**
> Chez vous, ce circuit prend la forme d'une génération simultanée d'options — pas séquentielle. Quand vous créez des solutions, vous ne testez pas une possibilité après l'autre : vous envisagez plusieurs scénarios en même temps, comme « une arborescence » où chaque branche reste ouverte. Votre diversification n'est pas un inventaire exhaustif — c'est un maintien actif de plusieurs voies pour ne pas en fermer prématurément.

**BLOC 3 — Clusters identifiés (candidat)**
> Ce circuit se couple systématiquement à votre circuit d'orchestration multi-solutions (cluster dominant, 3 situations partagées). Vous ne diversifiez pas pour le plaisir de la diversité — vous organisez les options pour qu'elles puissent coexister et se compléter.

**BLOC 4 — Encart laboratoire**
> **Lecture laboratoire** : C6 niveau HAUT (7 activations), circuit central du pilier socle P4. Cluster identifié C6 × C15 (3 co-occurrences : Q8, Q10, Q23). Co-occurrence C6 × C14 présente (3 verbatims partagés) mais non retenue comme cluster au seuil protocole — C14 reste au niveau MOYEN (3 activations).

**BLOC 5 — Références factuelles (dépliable)**
> *Activations* : Q4, Q8, Q10, Q14, Q16, Q23, Q24

---

## 9. EXEMPLE — VÉRONIQUE · P3 · C10

### Données source (T3 v4)

```json
{
  "candidat_id": "veronique",
  "pilier": "P3",
  "circuit_id": "C10",
  "circuit_nom": "Modulation de la profondeur d'analyse selon l'enjeu",
  "frequence": 18,
  "niveau_activation": "HAUT",
  "activations_franches": [...],
  "activations_nuancees": [...],
  "clusters_identifies": [
    {"circuit_partenaire": "C7", "nb_co_occurrences": 6, "rang": 1,
     "questions": ["Q2","Q3","Q4","Q7","Q9","Q11"]}
  ],
  "commentaire_attribution": "Circuit socle ultra-dominant (18 activations). Cluster dominant et exclusif avec C7 (6 co-oc) : la modulation d'analyse chez Véronique s'opère par contextualisation approfondie préalable."
}
```

### Rendu du template appliqué

**BLOC 1 — En-tête**
> **C10 — Modulation de la profondeur d'analyse selon l'enjeu** · 18 activations · circuit ultra-dominant (mobilisé dans la majorité de vos réponses)

**BLOC 2 — Description d'usage singulier (candidat)**
> Chez vous, ce circuit se traduit par une profondeur d'analyse qui s'ajuste à la situation — mais toujours après que vous avez lu le contexte précisément. Vous ne calibrez pas à l'aveugle : vous prenez d'abord le temps de comprendre les mécanismes en jeu (« je recherche à comprendre »), puis votre analyse s'approfondit ou reste à un niveau général selon ce que la compréhension contextuelle vous révèle. Votre modulation est informée par ce que vous avez compris, pas par l'urgence ou l'humeur.

**BLOC 3 — Clusters identifiés (candidat)**
> Ce circuit ne fonctionne pas seul chez vous — il est exclusivement couplé à votre circuit de contextualisation approfondie (cluster dominant, 6 situations partagées). Votre modulation d'effort passe toujours par une lecture contextuelle préalable : la profondeur d'analyse que vous choisissez dépend directement de ce que le contexte vous a appris.

**BLOC 4 — Encart laboratoire**
> **Lecture laboratoire** : C10 niveau HAUT (18 activations), circuit socle ultra-dominant. Cluster dominant et exclusif C10 × C7 (6 co-occurrences : Q2, Q3, Q4, Q7, Q9, Q11). Aucun autre cluster identifié sur C10 dans le pilier socle — signature de combinaison concentrée sur un seul partenaire.

**BLOC 5 — Références factuelles (dépliable)**
> *Activations* : Q2, Q3, Q4, Q5, Q7, Q9, Q11, [...] (18 questions au total)

---

## 10. LECTURE COMPARATIVE DES 3 CAS

**Ce que les 3 exemples démontrent** :

### Même template, 3 candidats, 3 descriptions distinctes

| Candidat | Circuit | Cluster dominant | Signature du circuit chez le candidat |
|---|---|---|---|
| **Cécile** | C10 (16×) | C10 × C15 (émotion) | Modulation intégrant le signal émotionnel comme donnée |
| **Rémi** | C6 (7×) | C6 × C15 (orchestration) | Diversification couplée à l'orchestration |
| **Véronique** | C10 (18×) | C10 × C7 (contextualisation) | Modulation après lecture contextuelle |

**Le même circuit C10** (Cécile et Véronique) donne **deux descriptions fondamentalement différentes** parce que les clusters diffèrent. C'est exactement ce que la règle T3 v4 rend possible : la singularité du candidat apparaît sans effort d'improvisation — elle émerge mécaniquement des clusters.

### Variance acceptable du template

Le template autorise :
- Des longueurs légèrement différentes selon la complexité du cas (C10 Cécile plus long car 2 clusters dominants, C10 Véronique plus concis car 1 seul cluster exclusif)
- Des formulations d'usage différentes selon les verbatims propres au candidat
- Un nombre variable de clusters mentionnés (1 ou 2 en Bloc 3)

Le template **impose** :
- La même structure (5 blocs)
- Les mêmes formulations d'introduction (« Chez vous... », « Lecture laboratoire... »)
- Le même ton factuel
- Les mêmes interdits (pas d'évaluatif, pas de comparaison, pas d'invention)

---

## 11. PIÈGES À ÉVITER

### Piège 1 — Description générique du circuit (pas singulière)

❌ *« Ce circuit permet de moduler la profondeur d'analyse. Il est activé quand l'enjeu varie selon les situations. »*

→ C'est la définition du circuit, pas son usage chez ce candidat. **À proscrire.**

✅ *« Chez vous, ce circuit se manifeste par une calibration automatique de votre effort d'analyse à l'enjeu réel [...] »*

### Piège 2 — Formulation évaluative

❌ *« Vous êtes remarquablement performante dans la modulation de votre effort. »*

→ Évaluatif, subjectif, contraire au principe de révélation.

✅ *« Cette modulation ne se décide pas — elle est automatique, et elle est tranchée. »*

### Piège 3 — Comparaison avec d'autres candidats

❌ *« Contrairement à la plupart des candidats, Cécile ne... »*

→ Comparaison interdite (principe de révélation).

✅ *« Votre modulation d'effort intègre systématiquement la dimension émotionnelle [...] »*

### Piège 4 — Verbatim brut en encart

❌
```
C10 — Modulation de la profondeur d'analyse selon l'enjeu · 16 activations

Verbatim Q20 : « ça reste un animal »
Verbatim Q18 : « le truc capital c'est qu'il soit en bonne santé »
```

→ Verbatims affichés bruts — pédagogie faible, homogénéisation.

✅ Verbatims **absorbés** dans la description, avec exception sobre inline : *« Trois mots peuvent suffire quand l'enjeu est faible (« ça reste un animal »)... »*

### Piège 5 — Contamination inter-étapes

❌ *« Votre modulation d'effort (circuit C10) est une des manifestations de votre excellence Anticipation. »*

→ Mention des excellences = contamination depuis Étape 2. **Interdit en Étape 1.**

✅ Rester strictement dans le registre circuits + clusters, sans mentionner les excellences, les 9 types, les zones de matching.

### Piège 6 — Généralisation théorique

❌ *« Les personnes qui activent fortement le circuit C10 ont généralement une capacité à... »*

→ Généralisation — pas de référence à « les personnes qui... ». Parler uniquement du candidat à partir de ses données.

✅ *« Chez vous, ce circuit prend la forme... »* (toujours ancré sur le candidat spécifique)

### Piège 7 — Ouverture vers l'interprétation psychologique

❌ *« Cette modulation révèle votre besoin de contrôle et votre recherche d'équilibre. »*

→ Interprétation psychologique — hors champ du protocole cognitif.

✅ Rester **cognitif uniquement** : description de l'opération, pas inférence sur des besoins ou motivations.

---

## 12. CHECK-LIST AUTO-CONTRÔLE

Avant de livrer la description d'un circuit, l'agent doit vérifier **les 12 points** suivants :

### Structure

- [ ] 1. **Bloc 1 (en-tête)** est présent avec ID + nom + fréquence + interprétation
- [ ] 2. **Bloc 2 (usage singulier)** est présent, adressé en « vous », 3 à 5 phrases
- [ ] 3. **Bloc 3 (clusters)** est présent SI des clusters existent dans les données T3 v4
- [ ] 4. **Bloc 4 (encart laboratoire)** est présent, ton factuel, 3e personne ou impersonnel

### Contenu

- [ ] 5. **Nom du circuit** exactement celui du référentiel (mot pour mot, aucune reformulation)
- [ ] 6. **Fréquence** correspond à la donnée T3 v4
- [ ] 7. **Clusters mentionnés** correspondent aux clusters déclarés dans T3 v4 (rang 1 et éventuellement rang 2)
- [ ] 8. **Chiffres dans l'encart laboratoire** correspondent aux données T3 v4 (ratio franches/nuancées, nb de co-occurrences, questions partagées)

### Rédaction

- [ ] 9. **Aucun évaluatif** dans l'ensemble de la description (« impressionnant », « remarquable », « performant », etc.)
- [ ] 10. **Aucune comparaison** avec d'autres candidats ou avec une moyenne
- [ ] 11. **Aucune contamination** : pas de mention d'excellences, de 9 types, d'axe A/F
- [ ] 12. **Formulation standardisée présente** : « Chez vous... » ou équivalent · « Lecture laboratoire : » en Bloc 4

Si un seul point échoue, l'agent **reprend la rédaction** avant livraison.

---

## 13. TABLE DE FORMULATION DES CLUSTERS (accessible pour candidat)

Quand un cluster est mentionné en Bloc 3, l'agent traduit le partenariat en formulation accessible. Voici la table de référence pour les clusters les plus fréquents :

| Cluster | Formulation accessible |
|---|---|
| C10 × C15 (Modulation × Émotion) | « votre modulation d'effort intègre votre ressenti émotionnel comme donnée » |
| C10 × C12 (Modulation × Priorisation) | « votre modulation d'effort s'accompagne d'une hiérarchisation de ce qui prime » |
| C10 × C7 (Modulation × Contextualisation) | « votre modulation d'effort passe par une lecture contextuelle préalable » |
| C10 × C6 (Modulation × Anticipation) | « votre modulation d'effort anticipe les conséquences » |
| C6 × C15 (P4 Diversification × Orchestration) | « votre diversification d'options s'appuie sur une orchestration systémique » |
| C15 × C7 (Émotion × Contextualisation) | « votre intégration émotionnelle passe par une lecture contextuelle » |

*Note* : cette table est à enrichir au fur et à mesure que d'autres clusters apparaissent dans les bilans. Pour un cluster non listé, l'agent doit produire une formulation accessible à partir des noms de circuits.

---

## 14. STATUT DU TEMPLATE

| Statut | Information |
|---|---|
| **Version** | 1.0 |
| **Date** | 23 avril 2026 |
| **Projet** | Profil-Cognitif · Sib Prod |
| **Validation Isabelle** | En attente |
| **Templates suivants** | 14 templates à produire dans le même format, après validation de celui-ci |
| **Intégration agent** | Après validation du format, conversion en instructions d'agent Sonnet 4 |

---

## FIN DU TEMPLATE #1
