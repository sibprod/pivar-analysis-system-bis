# LOT C — TEMPLATES ARCHITECTURE PILIER
## Templates #3, #14 · Projet Profil-Cognitif · 23 avril 2026

Templates de rédaction qui construisent **le squelette d'un bloc pilier** du bilan :
- **Template #14** — En-tête de bloc pilier (identifie le pilier, son rôle, son mode)
- **Template #3** — Pourquoi ce rôle dans le moteur (justifie l'attribution du rôle par les preuves protocolaires)

Ces 2 templates sont utilisés par **Agent 1 — Architecture**. Ils sont **toujours appliqués en binôme** : chaque bloc pilier commence par l'en-tête (Template #14) puis enchaîne immédiatement sur la justification du rôle (Template #3).

Format identique aux Lots A et B.

---
---

# TEMPLATE #14 — EN-TÊTE DE BLOC PILIER

## 1. NOM DU TEMPLATE

**Template #14 — En-tête de bloc pilier**

Brique visuelle et textuelle qui **ouvre chaque bloc pilier** du bilan. Elle identifie le pilier, son rôle dans le moteur du candidat, et son mode retenu.

---

## 2. BUT

Permettre à l'agent de produire **la bannière d'entrée** d'un bloc pilier — l'élément qui :
- Nomme explicitement le pilier (nom complet + abréviation)
- Affiche son rôle dans l'architecture du candidat (socle / structurant / fonctionnel)
- Affiche le mode retenu
- Utilise le code couleur cohérent avec le schéma du moteur (vert / jaune / gris)

Cet en-tête apparaît **5 fois par bilan** — une fois par pilier.

---

## 3. QUAND UTILISER CE TEMPLATE

**Utilisation** : au début de chaque bloc pilier (5 blocs par bilan).

**Volume** : 5 fois par bilan (P1, P2, P3, P4, P5 dans l'ordre du cycle cognitif).

**Obligation** : tous les blocs piliers commencent par cet en-tête, **sans exception**.

---

## 4. STRUCTURE OBLIGATOIRE

```
┌───────────────────────────────────────────────────────────────┐
│ BLOC 1 — BADGE PILIER                                         │
│   • Cercle avec l'abréviation (P1, P2, P3, P4, P5)            │
│   • Couleur de fond selon le rôle                             │
├───────────────────────────────────────────────────────────────┤
│ BLOC 2 — NOM ET RÔLE                                          │
│   • Nom complet du pilier (en premier)                        │
│   • ★ si pilier socle                                         │
│   • Libellé du rôle en dessous (étiquette colorée)            │
├───────────────────────────────────────────────────────────────┤
│ BLOC 3 — MODE RETENU                                          │
│   • Libellé « Mode retenu »                                   │
│   • Nom du mode (aligné à droite)                             │
├───────────────────────────────────────────────────────────────┤
│ BLOC 4 — LIGNE DE RAPPEL STRUCTURELLE (optionnel)             │
│   • 1 ligne qui rappelle la position du pilier dans           │
│     l'architecture                                            │
│   • Ex. « Cœur de votre moteur » pour socle                   │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. SLOTS À REMPLIR

| Slot | Source | Exemple Cécile P3 |
|---|---|---|
| `{pilier_id}` | T3 / T4 | `"P3"` |
| `{pilier_nom}` | Référentiel | `"Analyse"` |
| `{role_pilier_complet}` | T3/T4 | `"Pilier socle"` |
| `{role_pilier_label_court}` | Dérivé | `"Socle"` ou `"Structurant 1"` ou `"Fonctionnel 1"` |
| `{mode_retenu}` | T4 | `"Contextuel et adaptatif"` |
| `{couleur_role}` | Dérivé du rôle | vert / jaune / gris |
| `{marqueur_socle}` | Si socle → `"★"`, sinon vide | `"★"` |
| `{rappel_structurel}` | Selon rôle | `"Cœur de votre moteur"` |

---

## 6. RÈGLES DE RÉDACTION

### 6.1 Règle absolue — nommage des piliers

Utiliser **toujours le nom complet** du référentiel v36 :
- P1 → **Collecte d'information** (pas « Collecte »)
- P2 → **Tri**
- P3 → **Analyse**
- P4 → **Création de solutions** (pas « Solutions »)
- P5 → **Mise en œuvre et exécution** (pas « Exécution »)

Le nom est toujours **en premier**, l'abréviation **en second**. Format :
> **Collecte d'information**
> *(P1)*

### 6.2 Règle — code couleur cohérent

Les couleurs des blocs piliers doivent correspondre exactement au schéma du moteur cognitif :

| Rôle | Couleur | Fond badge | Fond en-tête |
|---|---|---|---|
| **Pilier socle** | Vert | `#d4edbc` | Gradient vert clair → blanc |
| **Pilier structurant 1** ou **2** | Jaune | `#fff0c4` | Gradient jaune clair → blanc |
| **Pilier fonctionnel 1 · entrée de cycle** ou **2 · sortie de cycle** | Gris | `#e5e1d8` | Gradient gris clair → blanc |

### 6.3 Règle — libellé du rôle

Le libellé complet du rôle est affiché en-dessous du nom :

| Rôle | Libellé affiché |
|---|---|
| Pilier socle | `"★ Pilier socle"` |
| Pilier structurant 1 | `"Pilier structurant 1"` |
| Pilier structurant 2 | `"Pilier structurant 2"` |
| Pilier fonctionnel 1 | `"Pilier fonctionnel 1 · entrée de cycle"` |
| Pilier fonctionnel 2 | `"Pilier fonctionnel 2 · sortie de cycle"` |
| Pilier résistant | `"Pilier résistant"` (cas spécial, ex. P5 Cécile) |

### 6.4 Règle — ligne de rappel structurel

Chaque rôle a sa ligne de rappel **optionnelle** :

| Rôle | Rappel structurel |
|---|---|
| Socle | *« Cœur de votre moteur cognitif »* |
| Structurant 1 | *« Premier pilier d'alimentation de votre socle »* |
| Structurant 2 | *« Second pilier d'alimentation de votre socle »* |
| Pilier fonctionnel 1 | *« Pilier fonctionnel qui complète votre cycle »* |
| Pilier fonctionnel 2 | *« Pilier fonctionnel de sortie du cycle »* |
| Résistant | *« Pilier où votre moteur consomme davantage »* |

### 6.5 Règle — le mode retenu est toujours affiché

Même si le pilier est à faible activation, le mode retenu est affiché. Format :
> **Mode retenu**
> *[Nom du mode]*

### 6.6 Formulations standardisées

L'en-tête ne contient pas de phrases rédigées — c'est un bloc **structurel et visuel**. Les formulations s'appliquent aux éléments :

| Élément | Formulation standard |
|---|---|
| Marqueur socle | `"★"` (étoile unique, avant le nom du rôle) |
| Libellé mode | `"Mode retenu"` (jamais « profil retenu » ni autre variante) |

---

## 7. EXEMPLES DES 5 EN-TÊTES POUR CÉCILE

### P1 Collecte d'information (structurant 1)

```
┌──────────────────────────────────────────────────────────────┐
│  ┌───┐  Collecte d'information                Mode retenu    │
│  │P1 │  (P1)                              Critique et         │
│  └───┘  PILIER STRUCTURANT 1                  analytique      │
│         Premier pilier d'alimentation de votre socle          │
└──────────────────────────────────────────────────────────────┘
                Couleur : jaune (structurant)
```

### P2 Tri (Pilier fonctionnel 1)

```
┌──────────────────────────────────────────────────────────────┐
│  ┌───┐  Tri                                 Mode retenu      │
│  │P2 │  (P2)                              Minimaliste et     │
│  └───┘  PILIER FONCTIONNEL 1                essentiel     │
│         Pilier fonctionnel qui complète votre cycle           │
└──────────────────────────────────────────────────────────────┘
                Couleur : gris (fonctionnel)
```

### P3 Analyse (socle)

```
┌──────────────────────────────────────────────────────────────┐
│  ┌───┐  ★ Analyse                           Mode retenu      │
│  │P3 │  (P3)                              Contextuel et      │
│  └───┘  ★ PILIER SOCLE                        adaptatif       │
│         Cœur de votre moteur cognitif                         │
└──────────────────────────────────────────────────────────────┘
                Couleur : vert (socle)
```

### P4 Création de solutions (structurant 2)

```
┌──────────────────────────────────────────────────────────────┐
│  ┌───┐  Création de solutions              Mode retenu       │
│  │P4 │  (P4)                              Adaptatif et       │
│  └───┘  PILIER STRUCTURANT 2               pragmatique        │
│         Second pilier d'alimentation de votre socle           │
└──────────────────────────────────────────────────────────────┘
                Couleur : jaune (structurant)
```

### P5 Mise en œuvre et exécution (résistant)

```
┌──────────────────────────────────────────────────────────────┐
│  ┌───┐  Mise en œuvre et exécution         Mode retenu       │
│  │P5 │  (P5)                              Pragmatique et     │
│  └───┘  PILIER RÉSISTANT                     efficace         │
│         Pilier où votre moteur consomme davantage             │
└──────────────────────────────────────────────────────────────┘
                Couleur : gris (fonctionnel, avec variante résistant)
```

---

## 8. EXEMPLES POUR RÉMI

### P4 Création de solutions (socle chez Rémi)

```
┌──────────────────────────────────────────────────────────────┐
│  ┌───┐  ★ Création de solutions            Mode retenu       │
│  │P4 │  (P4)                              [mode T4 Rémi]     │
│  └───┘  ★ PILIER SOCLE                                        │
│         Cœur de votre moteur cognitif                         │
└──────────────────────────────────────────────────────────────┘
                Couleur : vert
```

### P3 Analyse (structurant 1 chez Rémi)

```
┌──────────────────────────────────────────────────────────────┐
│  ┌───┐  Analyse                             Mode retenu      │
│  │P3 │  (P3)                              [mode T4 Rémi]     │
│  └───┘  PILIER STRUCTURANT 1                                  │
│         Premier pilier d'alimentation de votre socle          │
└──────────────────────────────────────────────────────────────┘
                Couleur : jaune
```

---

## 9. EXEMPLES POUR VÉRONIQUE

### P3 Analyse (socle chez Véronique)

```
┌──────────────────────────────────────────────────────────────┐
│  ┌───┐  ★ Analyse                           Mode retenu      │
│  │P3 │  (P3)                              [mode T4 Véro]     │
│  └───┘  ★ PILIER SOCLE                                        │
│         Cœur de votre moteur cognitif                         │
└──────────────────────────────────────────────────────────────┘
                Couleur : vert
```

---

## 10. PIÈGES À ÉVITER

### Piège 1 — Nom incorrect

❌ « Collecte », « Solutions », « Exécution » (formes tronquées)
✅ « Collecte d'information », « Création de solutions », « Mise en œuvre et exécution »

### Piège 2 — Ordre inversé

❌ Abréviation en premier (P1, puis nom)
✅ Nom en premier (Collecte d'information, puis (P1))

### Piège 3 — Couleur incorrecte

❌ Couleur uniforme pour tous les piliers
✅ Vert pour socle · jaune pour structurants · gris pour fonctionnels

### Piège 4 — Oubli du marqueur socle

❌ Pilier socle sans étoile ★
✅ Pilier socle **toujours** marqué par ★ avant le libellé du rôle

### Piège 5 — « Profil retenu » au lieu de « Mode retenu »

❌ « Profil retenu »
✅ « Mode retenu » (terme protocole unique)

---

## 11. CHECK-LIST AUTO-CONTRÔLE

- [ ] Badge avec abréviation PX présent
- [ ] Nom complet du pilier utilisé (pas de forme tronquée)
- [ ] Nom en premier, (Px) en second
- [ ] Libellé du rôle présent (avec ★ si socle)
- [ ] Couleur correspondant au rôle (vert/jaune/gris)
- [ ] Mode retenu affiché avec le libellé exact « Mode retenu »
- [ ] Rappel structurel (optionnel) cohérent avec le rôle

---
---

# TEMPLATE #3 — POURQUOI CE RÔLE DANS LE MOTEUR

## 1. NOM DU TEMPLATE

**Template #3 — Pourquoi ce rôle dans le moteur cognitif**

Brique rédactionnelle qui **justifie l'attribution du rôle** à un pilier dans l'architecture du candidat — par les preuves protocolaires (ÉCART, Conformes, circuits dominants, clusters).

---

## 2. BUT

Permettre à l'agent de rédiger, **juste après l'en-tête de chaque bloc pilier**, la section qui explique **pourquoi ce pilier joue ce rôle précis** chez le candidat :
- **Preuve par les ÉCART** : quand le pilier socle s'impose face au pilier attendu
- **Preuve par les Conformes** : quand le pilier est présent en soutien
- **Preuve par les clusters** : densité d'activation couplée
- **Cohérence architecturale** : comment ce pilier sert les autres

---

## 3. QUAND UTILISER CE TEMPLATE

**Utilisation** : dans chaque bloc pilier, juste après le Template #14 (en-tête).

**Volume** : 5 fois par bilan (un par pilier).

**Obligation** : tous les piliers doivent avoir leur justification de rôle, **y compris les piliers fonctionnels** (qui sont souvent traités rapidement — à tort).

---

## 4. STRUCTURE OBLIGATOIRE

```
┌───────────────────────────────────────────────────────────────┐
│ BLOC 1 — TITRE DE SECTION                                     │
│   • « 🔬 Pourquoi [nom du rôle] dans votre moteur »           │
│   • Ex. « 🔬 Pourquoi l'Analyse est votre pilier socle »      │
├───────────────────────────────────────────────────────────────┤
│ BLOC 2 — JUSTIFICATION PAR LES PREUVES                        │
│   • Données protocolaires précises avec chiffres              │
│   • ÉCART + Conformes + circuits actifs + clusters            │
│   • 4-7 phrases, ton factuel mais adressé au candidat         │
│   • Cohérence avec le rôle affirmé                            │
└───────────────────────────────────────────────────────────────┘
```

**Note** : contrairement aux templates de synthèse, le Template #3 **n'a pas** de double colonne labo/candidat. La justification est **une seule formulation** adressée au candidat mais chargée de données protocolaires précises.

---

## 5. SLOTS À REMPLIR

### Pour le pilier socle

| Slot | Source |
|---|---|
| `{nb_ecart_total}` | T1 |
| `{nb_ecart_ou_socle_simpose}` | T1 |
| `{piliers_attendus_dans_ecarts}` | T1 |
| `{nb_conformes_avec_socle_en_soutien}` | T1 |
| `{nb_circuits_actifs_pilier}` | T3 |
| `{total_activations_pilier}` | T3 |
| `{cluster_dominant}` | T3 v4 |

### Pour un pilier structurant

| Slot | Source |
|---|---|
| `{nb_circuits_actifs_pilier}` | T3 |
| `{nb_reponses_ou_pilier_en_soutien}` | T1 |
| `{patterns_activation}` | T1 (quel pilier active celui-ci en entrée ou en soutien) |
| `{cluster_dominant}` | T3 v4 |

### Pour un pilier fonctionnel

| Slot | Source |
|---|---|
| `{nb_circuits_actifs_pilier}` | T3 (souvent plus faible que socle/structurants) |
| `{total_activations_pilier}` | T3 |
| `{fonction_dans_cycle}` | Entrée, milieu, sortie |
| `{signaux_limbiques_present}` | T1 (Oui si pilier résistant) |

---

## 6. RÈGLES DE RÉDACTION

### 6.1 Règle absolue — justifier par les données

Chaque affirmation du bloc 2 doit être **sourcée par une donnée protocolaire précise** :
- Nombre exact d'ÉCART (pas d'approximation)
- Nombre exact de circuits actifs (sur 15)
- Nombre exact d'activations totales
- Piliers attendus précis dans les ÉCART (pas « d'autres piliers »)

**INTERDIT** : « vous êtes analytique » sans preuve. **ATTENDU** : « Sur vos 8 ÉCART, 6 ont P3 comme pilier cœur spontané ».

### 6.2 Règle — adresse au candidat mais ton factuel

Le bloc 2 est adressé en **« vous »** (ce n'est pas la version laboratoire), mais le ton reste **factuel et structuré** — pas de narration littéraire.

Formulation-type :
> « Votre pilier [nom] joue le rôle de [rôle] dans votre moteur cognitif. La preuve se trouve dans plusieurs données : [chiffres]. »

### 6.3 Règle — 3 formulations selon le rôle

**Pour le pilier SOCLE** : preuve par les ÉCART est **obligatoire**.

Structure-type :
1. Affirmation du rôle
2. Preuve par les ÉCART (X/Y où le pilier s'impose face aux piliers attendus Z)
3. Preuve par les Conformes (le pilier est présent en entrée ou soutien dans N situations)
4. Densité structurelle (circuits actifs, activations totales)
5. Lien avec le filtre

**Pour un pilier STRUCTURANT** : preuve par les Conformes et patterns d'activation est obligatoire.

Structure-type :
1. Affirmation du rôle (« pilier structurant »)
2. Fonction dans l'architecture : alimente le pilier socle
3. Données : X circuits actifs, présent dans N situations en soutien
4. Pattern d'activation : quand le socle demande cette matière, ce pilier entre en jeu
5. Cluster si présent

**Pour un pilier NÉCESSAIRE AU MOTEUR** : preuve par la fonction dans le cycle.

Structure-type :
1. Affirmation du rôle (« pilier fonctionnel »)
2. Fonction dans le cycle : complète sans porter l'excellence
3. Données : X circuits actifs (souvent plus faible), répartition
4. Stratégie observée (simplification, délégation, etc.)
5. Rappel : ce pilier est indispensable au cycle même s'il ne porte pas l'excellence

### 6.4 Règle — pas de jugement comparatif

Même pour les piliers fonctionnels (souvent moins développés), **pas de jugement implicite** :
- ❌ « Ce pilier est le moins développé »
- ✅ « Ce pilier compte 9 circuits actifs sur 15 — il est fonctionnel sans porter l'excellence »

### 6.5 Formulations standardisées

| Contexte | Formulation standard |
|---|---|
| Titre bloc 1 | « 🔬 Pourquoi [nom du rôle] dans votre moteur » |
| Affirmation du rôle (socle) | « [Pilier] est votre pilier socle — identifié par la preuve des ÉCART. » |
| Preuve ÉCART | « Sur vos [N] ÉCART, [K] ont [P] comme pilier cœur spontané, y compris face à des questions attendant [autres piliers]. » |
| Fonction structurant | « [Pilier] joue un rôle de [premier/second] soutien dans votre architecture cognitive : il alimente votre pilier socle. » |
| Fonction fonctionnelle | « [Pilier] complète votre cycle cognitif sans porter votre excellence : c'est un pilier fonctionnel [1/2]. » |
| Clôture lien filtre | « C'est cette [caractéristique] qui fait de ce pilier votre [rôle]. » |

---

## 7. EXEMPLE — CÉCILE P3 (pilier socle)

### Données source

```
nb_ecart_total : 8
nb_ecart_ou_socle_simpose : 6
piliers_attendus_dans_ecarts : P2, P4, P5
nb_conformes_avec_p3_soutien : 17 (sur 17 Conformes)
nb_circuits_actifs : 14 (sur 15)
total_activations : 78
cluster_dominant : C10 × C15 (6 co-oc)
```

### Rendu

**BLOC 1 — Titre**
> ### 🔬 Pourquoi l'Analyse est votre pilier socle

**BLOC 2 — Justification**
> L'Analyse est votre pilier socle — identifié par la preuve des ÉCART. Le protocole pose toujours ses 25 questions dans un pilier référent précis : à chaque question, un pilier est attendu. Soit vous répondez dans le pilier attendu (c'est un Conforme), soit vous sortez de ce pilier pour traiter avec un autre — c'est un ÉCART.
>
> Sur vos 8 ÉCART, **6 ont P3 comme pilier cœur spontané**, y compris face à des questions attendant la Création de solutions (P4), le Tri (P2) ou la Mise en œuvre et exécution (P5). Cela signifie que dans 6 situations différentes, avec 3 piliers référents différents, votre cognition a enclenché spontanément son filtre — la pré-programmation automatique par l'Analyse.
>
> La densité structurelle confirme cette dominance : **14 circuits actifs sur 15**, **78 activations totales** sur l'ensemble des 25 questions, un cluster dominant C10 × C15 (6 co-occurrences) qui signe une modulation d'effort intégrant systématiquement le signal limbique. Votre Analyse n'est jamais absente — elle est en entrée, en soutien ou en sortie dans quasiment toutes vos réponses.
>
> C'est cette activation automatique et cette densité structurelle qui font de l'Analyse votre pilier socle — le cœur de votre moteur cognitif.

---

## 8. EXEMPLE — CÉCILE P1 (pilier structurant 1)

### Données source

```
nb_circuits_actifs : 10 (sur 15)
nb_reponses_ou_p1_en_soutien : estimé 5-6 réponses en Conforme
pattern_activation : P3 demande, P1 exécute la collecte orientée
cluster : C2 × C1 (éventuel, à vérifier)
```

### Rendu

**BLOC 1 — Titre**
> ### 🔬 Pourquoi la Collecte d'information est votre pilier structurant 1

**BLOC 2 — Justification**
> Votre pilier Collecte d'information joue un rôle de **premier soutien** dans votre architecture cognitive : il alimente votre pilier socle Analyse en lui apportant la matière ciblée dont il a besoin pour lire les situations.
>
> Dans 4 cas sur 5 où la collecte vous est demandée et où vous répondez en Conforme, votre Analyse est déjà en soutien — elle évalue la fiabilité des sources, la gravité d'une situation, la tension principale. Votre collecte n'est jamais exploratoire : elle est orientée par ce que votre Analyse cherche à comprendre.
>
> La densité structurelle confirme ce rôle d'alimentation : **10 circuits actifs sur 15**, avec une concentration sur la diversification stratégique (C2), l'attention sélective aux sources pertinentes (C1) et l'évaluation critique de fiabilité (C3). Votre Collecte est critique et analytique — elle filtre avant même de lire.
>
> C'est cette mise au service permanente du socle qui fait de la Collecte d'information votre pilier structurant 1.

---

## 9. EXEMPLE — CÉCILE P5 (pilier résistant)

### Données source

```
nb_circuits_actifs : 9 (sur 15)
role_pilier : Pilier résistant
signaux_limbiques : 6 questions
circuit_compensation : C13 Leadership collaboratif HAUT
```

### Rendu

**BLOC 1 — Titre**
> ### 🔬 Pourquoi la Mise en œuvre et exécution est votre pilier résistant

**BLOC 2 — Justification**
> Votre pilier Mise en œuvre et exécution complète votre cycle cognitif — 12 de vos 25 réponses se terminent par une action concrète. Il est donc **fonctionnel** dans votre moteur, mais il porte le rôle particulier de **pilier résistant** : c'est là que votre moteur consomme davantage d'énergie.
>
> La preuve se trouve dans les signaux limbiques : **6 de vos verbatims sur ce pilier expriment explicitement une résistance** (« la pire partie pour moi », « ça m'agace », « sans aucun plaisir », « je n'aime pas organiser »). Ces signaux sont concentrés sur les questions Q6, Q8, Q10, Q18, Q19, Q21.
>
> Cependant, la densité structurelle est réelle : **9 circuits actifs sur 15**, avec une stratégie compensatoire claire — le circuit C13 (Leadership collaboratif) est particulièrement actif (4 activations, niveau HAUT). Face à la résistance à l'exécution solitaire, vous avez développé la coordination et la délégation comme mode naturel de mobilisation de ce pilier.
>
> C'est cette combinaison — résistance émotionnelle explicite + stratégie compensatoire par l'orchestration — qui fait de la Mise en œuvre et exécution votre pilier résistant.

---

## 10. EXEMPLE — CÉCILE P2 (Pilier fonctionnel 1)

### Données source

```
nb_circuits_actifs : 7 (sur 15 — plus faible du moteur)
total_activations : 11
pas_de_signaux_limbiques : vérifié
stratégie : simplification silencieuse
```

### Rendu

**BLOC 1 — Titre**
> ### 🔬 Pourquoi le Tri est un pilier fonctionnel de votre moteur

**BLOC 2 — Justification**
> Votre pilier Tri complète votre cycle cognitif sans porter votre excellence : c'est un **pilier fonctionnel 1 · entrée de cycle**. Il est indispensable au bon fonctionnement de votre boucle cognitive, mais il n'est pas le lieu de votre signature.
>
> La densité structurelle le confirme : **7 circuits actifs sur 15** (le plus faible de votre moteur), **11 activations totales**. Les circuits actifs sont concentrés sur l'essentiel : extraction rapide de patterns (C14), catégorisation simple (C1), filtrage des données non-essentielles (C3).
>
> Votre Tri fonctionne selon une stratégie de **simplification silencieuse** : pas de signaux limbiques négatifs dans vos verbatims, pas d'architectures de tri élaborées — vous allez directement à ce qui compte pour la situation. Cette économie cognitive n'est pas un manque : elle sert votre filtre. Votre Analyse a besoin de matière pertinente, pas de matière structurée. En simplifiant le Tri, vous préservez votre capacité analytique.
>
> C'est cette fonction de préparation minimaliste — utile mais non-porteuse d'excellence — qui fait du Tri votre pilier fonctionnel 1 (entrée de cycle).

---

## 11. EXEMPLE — CÉCILE P4 (structurant 2)

### Données source

```
nb_circuits_actifs : 6 (sur 15)
total_activations : 10
role_pilier : Pilier structurant 2
pattern : appelé par P3 pour traduire diagnostic en options
```

### Rendu

**BLOC 1 — Titre**
> ### 🔬 Pourquoi la Création de solutions est votre pilier structurant 2

**BLOC 2 — Justification**
> Votre pilier Création de solutions joue un rôle de **second soutien** dans votre architecture cognitive : il est appelé par votre Analyse pour traduire le diagnostic en options concrètes.
>
> La densité structurelle est maîtrisée : **6 circuits actifs sur 15**, **10 activations totales**. Le pilier s'active peu, mais de façon précise. Les circuits dominants sont la diversification méthodique des options (C6), la génération fluide (C1), l'adaptation dynamique aux circonstances (C11) — un triptyque qui signe une conception **toujours calibrée au contexte**.
>
> Votre Création de solutions n'initie jamais — elle est activée quand votre Analyse a posé le diagnostic. Quand la conception vous est demandée, vous produisez des solutions directement utilisables (scénarios parallèles en arborescence, solutions différenciées selon le type de situation). Mais dans les situations ÉCART, la conception ne se déclenche pas toute seule — elle apparaît quand le chemin passe par elle.
>
> C'est cette activation conditionnelle et précise, au service du socle, qui fait de la Création de solutions votre pilier structurant 2 — pas un moteur autonome.

---

## 12. EXEMPLE — RÉMI P4 (pilier socle)

### Données source (estimées depuis mémoires)

```
nb_ecart : ~7-8 estimé
nb_ecart_ou_p4_simpose : majoritaire
piliers_attendus_dans_ecarts : P3, P5
nb_circuits_actifs : 11 (sur 15)
cluster_dominant : C6 × C15 (3 co-oc)
```

### Rendu

**BLOC 1 — Titre**
> ### 🔬 Pourquoi la Création de solutions est votre pilier socle

**BLOC 2 — Justification**
> La Création de solutions est votre pilier socle — identifié par la preuve des ÉCART. Sur vos ÉCART, P4 s'impose comme pilier cœur spontané dans la majorité des situations, y compris face à des questions attendant l'Analyse (P3) ou la Mise en œuvre (P5).
>
> Cette activation automatique de la création de solutions — indépendamment de ce que la question demande — est la preuve directe de votre filtre « maintenir les voies ouvertes ». Votre cognition ne reste jamais en mode évaluation : elle ouvre immédiatement l'espace des options possibles.
>
> La densité structurelle confirme : **11 circuits actifs sur 15**, avec un cluster identifié C6 × C15 (diversification méthodique couplée à orchestration multidimensionnelle, 3 co-occurrences). La diversification n'est pas solitaire chez vous — elle s'articule systématiquement avec l'orchestration des options pour qu'elles puissent coexister.
>
> C'est cette activation automatique et cette orchestration couplée qui font de la Création de solutions votre pilier socle — le cœur de votre moteur cognitif.

---

## 13. EXEMPLE — VÉRONIQUE P3 (pilier socle)

### Données source (estimées)

```
nb_circuits_actifs : 11 (sur 15)
cluster_dominant_exclusif : C10 × C7 (6 co-oc)
C11 Extraction principes : HAUT
```

### Rendu

**BLOC 1 — Titre**
> ### 🔬 Pourquoi l'Analyse est votre pilier socle

**BLOC 2 — Justification**
> L'Analyse est votre pilier socle — identifié par la preuve des ÉCART. Sur vos ÉCART, P3 s'impose comme pilier cœur spontané dans la majorité des situations, y compris face à des questions attendant d'autres piliers. Cette activation automatique est la preuve directe de votre filtre « extraire le principe logique ».
>
> La forme spécifique de votre socle se lit dans son cluster **dominant et exclusif** : C10 × C7 (modulation d'analyse couplée à contextualisation approfondie, 6 co-occurrences). Contrairement à d'autres profils au même socle qui peuvent présenter plusieurs clusters, le vôtre est **concentré sur une signature unique** — votre modulation d'analyse passe **toujours** par une lecture contextuelle préalable.
>
> La densité structurelle confirme : **11 circuits actifs sur 15**, avec le circuit C11 (Extraction des principes sous-jacents aux phénomènes observés) également en niveau HAUT. Cette combinaison C10 + C7 + C11 signe une Analyse qui part du particulier pour remonter au principe — jamais de l'abstrait déconnecté.
>
> C'est cette exigence d'extraction contextualisée du principe qui fait de l'Analyse votre pilier socle.

---

## 14. PIÈGES À ÉVITER

### Piège 1 — Affirmer le rôle sans le prouver

❌ « Votre Analyse est votre pilier socle parce qu'elle est très active »
✅ « Votre Analyse est votre pilier socle — sur vos 8 ÉCART, 6 ont P3 comme pilier cœur spontané »

### Piège 2 — Prouver par les chiffres sans donner le sens

❌ « 14 circuits actifs, 78 activations, cluster C10×C15 »
✅ Chaque chiffre est accompagné de **ce qu'il signifie** (activation automatique, densité, signature de combinaison)

### Piège 3 — Traiter les piliers fonctionnels avec mépris

❌ « Votre Tri est le moins développé de votre moteur »
✅ « Votre Tri est un pilier fonctionnel — il complète votre cycle sans porter votre excellence »

### Piège 4 — Ne pas traiter un pilier résistant correctement

❌ Décrire P5 Cécile comme un pilier fonctionnel classique
✅ Appliquer le rôle spécifique « pilier résistant » avec signaux limbiques + stratégie compensatoire

### Piège 5 — Contamination par d'autres étapes

❌ Mentionner les excellences, les 9 types, l'axe A/F dans la justification du rôle
✅ Rester strictement dans le registre Étape 1 : circuits, clusters, ÉCART, Conformes

### Piège 6 — Omettre le lien filtre pour le pilier socle

❌ Traiter le socle sans mentionner le filtre cognitif
✅ Toujours clôturer la justification du socle par le lien vers le filtre (qui sera développé en section synthèse)

---

## 15. CHECK-LIST AUTO-CONTRÔLE

### Pour tous les piliers
- [ ] Titre correct avec le rôle exact
- [ ] Chiffres exacts (ÉCART, circuits actifs, activations totales)
- [ ] Pas d'affirmation sans preuve chiffrée
- [ ] Ton factuel en « vous »
- [ ] Pas de contamination inter-étapes
- [ ] Pas de comparaison avec d'autres candidats

### Pour le pilier socle
- [ ] Preuve par les ÉCART présente avec chiffres exacts
- [ ] Piliers attendus dans les ÉCART nommés précisément
- [ ] Cluster dominant cité
- [ ] Lien avec le filtre mentionné en clôture

### Pour les piliers structurants
- [ ] Rôle de soutien au socle explicitement affirmé
- [ ] Pattern d'activation décrit (comment il sert le socle)
- [ ] Densité mesurée (circuits actifs / 15)

### Pour les piliers fonctionnels
- [ ] Mention « pilier fonctionnel 1 · entrée de cycle » ou « pilier fonctionnel 2 · sortie de cycle »
- [ ] Fonction dans le cycle expliquée
- [ ] Absence de jugement (fonctionnel ≠ moindre)
- [ ] Stratégie observée mentionnée

### Pour un pilier résistant
- [ ] Signaux limbiques chiffrés et localisés (questions)
- [ ] Stratégie compensatoire identifiée
- [ ] Distinction claire avec un pilier simplement fonctionnel

---

## FIN DU LOT C
