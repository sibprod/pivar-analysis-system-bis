# LOT E — TEMPLATES TRANSVERSES
## Templates #11, #12, #13, #15 · Projet Profil-Cognitif · 23 avril 2026

Templates de rédaction **transverses** — réutilisés à plusieurs endroits du bilan ou structurant l'ensemble :

- **Template #11** — Encart de définition inline
- **Template #12** — Cartouche d'attribution (pour le schéma du moteur cognitif)
- **Template #13** — Commentaire d'attribution (sortie T3 v4)
- **Template #15** — Structure globale du bilan (table des matières + navigation)

Ces 4 templates sont utilisés par **Agent 6 — Transverses**, ou en appui des autres agents.

Nommage officiel appliqué : **pilier socle** / **pilier structurant 1 ou 2** / **pilier fonctionnel 1** (entrée de cycle) / **pilier fonctionnel 2** (sortie de cycle) / **pilier résistant** (cas spécial).

Format identique aux Lots A, B, C, D.

---
---

# TEMPLATE #11 — ENCART DE DÉFINITION INLINE

## 1. NOM DU TEMPLATE

**Template #11 — Encart de définition inline**

Brique rédactionnelle qui **pose la définition d'un concept** au moment où il apparaît pour la première fois dans une section du bilan — sans renvoyer le lecteur au glossaire en fin de document.

Principe pédagogique validé : **on définit avant de livrer**. Le lecteur lit linéairement sans jamais perdre le fil.

---

## 2. BUT

Permettre à l'agent de produire, pour chaque concept technique utilisé dans une section, un **encart visuel** (fond jaune pâle, bordure ambre, 3-5 phrases) qui :
- **Nomme** le concept
- **Définit** en langage accessible
- **Ancre** la définition dans le glossaire global (renvoi implicite)

---

## 3. QUAND UTILISER CE TEMPLATE

**Utilisation** : au début de chaque section qui introduit un concept technique nouveau.

**Volume** : variable selon le bilan, typiquement **10 à 15 encarts par bilan** :
- 1 encart « Qu'est-ce qu'un moteur cognitif ? » (avant le schéma)
- 5 encarts « Qu'est-ce qu'un pilier ? » (un par pilier — ou un seul mutualisé)
- 5 encarts « Qu'est-ce qu'un circuit cognitif ? » (dans chaque bloc pilier, section circuits)
- 5 encarts « Qu'est-ce qu'un mode ? » (dans chaque bloc pilier, section mode)
- 1 encart « Qu'est-ce qu'un filtre cognitif ? » (dans la synthèse)
- 1 encart « Qu'est-ce que la boucle cognitive ? » (dans la synthèse)
- 1 encart « Qu'est-ce qu'une finalité cognitive ? » (dans la synthèse)
- 1 encart « Qu'est-ce qu'une signature cognitive ? » (dans la synthèse)
- 1 encart « Qu'est-ce qu'une zone de coût cognitif ? » (dans la synthèse)

### Règle de mutualisation

Pour les concepts répétés (pilier, circuit, mode), **la définition peut être identique** d'un bloc à l'autre — l'agent produit une définition standard stable. Pour les concepts uniques (filtre, finalité, signature), la définition est produite une fois.

---

## 4. STRUCTURE OBLIGATOIRE

```
┌───────────────────────────────────────────────────────────────┐
│ ENCART (fond jaune pâle #fff8e8 · bordure ambre #e0c080)      │
│                                                               │
│   Qu'est-ce qu'un [concept] ?  (en gras)                      │
│                                                               │
│   [Définition en 2-4 phrases, 60-120 mots, adressée au        │
│    candidat en "vous" ou impersonnelle selon contexte]        │
│                                                               │
└───────────────────────────────────────────────────────────────┘
```

### Caractéristiques visuelles

- Fond : **#fff8e8** (jaune très pâle)
- Bordure gauche : **3-4 px**, couleur **#e0c080** (ambre)
- Bordure droite/haut/bas : **1 px**, couleur même ambre à 50% opacité
- Radius : **0 4px 4px 0** (coins carrés à gauche, arrondis à droite)
- Padding intérieur : **12-16 px**
- Typographie : taille légèrement inférieure au corps de texte, couleur **#6a5010**

---

## 5. SLOTS À REMPLIR

| Slot | Source | Exemple |
|---|---|---|
| `{concept}` | Contexte de la section | `"filtre cognitif"` |
| `{definition}` | Référentiel glossaire | Texte de 60-120 mots |

### Définitions standards (référentiel)

Les définitions suivantes sont **validées et stables** pour l'ensemble des bilans. L'agent les utilise telles quelles (adaptées à la 2e personne si pertinent).

**Moteur cognitif**
> L'ensemble des 5 piliers qui, assemblés, constituent la manière dont vous traitez une information pour décider d'agir. Comme un moteur à 5 cylindres, les piliers fonctionnent ensemble mais chacun a son rôle propre. Votre moteur cognitif est unique : la combinaison de vos piliers, de leurs circuits et de leur hiérarchie forme votre signature cognitive personnelle.

**Pilier**
> Une des 5 grandes opérations cognitives fondamentales : la Collecte d'information (P1), le Tri (P2), l'Analyse (P3), la Création de solutions (P4), la Mise en œuvre et exécution (P5). Tout humain les mobilise — ce qui diffère, c'est leur hiérarchie et leur forme chez chaque personne.

**Pilier socle**
> Le pilier qui porte votre signature cognitive. Un pilier socle n'est pas un pilier comme les autres : il est pré-programmé par un filtre. Identifié par la preuve des ÉCART — même quand un autre pilier est demandé par une situation, ce pilier-là s'impose.

**Piliers structurants**
> Les deux piliers qui alimentent votre pilier socle et lui permettent de performer. Ils sont présents systématiquement en soutien du socle dans vos Conformes, et apparaissent en entrée ou en soutien dans vos ÉCART.

**Piliers fonctionnels**
> Les deux piliers qui complètent votre cycle cognitif : le pilier fonctionnel 1 à l'entrée du cycle, le pilier fonctionnel 2 à la sortie. Ils sont indispensables au fonctionnement du moteur mais ne portent pas votre excellence — ils sont fonctionnels, pas porteurs de signature.

**Pilier résistant**
> Cas particulier d'un pilier fonctionnel (le plus souvent le pilier fonctionnel 2, de sortie) qui exprime une résistance verbalisée dans les réponses du candidat — signaux limbiques explicites (« ça m'agace », « la pire partie », etc.). Ce pilier fonctionne mais avec un coût cognitif manifeste.

**Circuit cognitif**
> Les outils qu'un pilier mobilise pour fonctionner. Chaque pilier compte 15 circuits possibles (75 au total dans le référentiel). La sélection des circuits activés chez vous et leur fréquence d'activation révèlent la singularité de votre profil — deux candidats qui ont le même pilier socle peuvent mobiliser des circuits très différents.

**Cluster de circuits**
> Un couple de circuits du même pilier qui s'activent systématiquement ensemble dans vos réponses. C'est une signature de combinaison spécifique qui rend votre profil singulier — même par rapport à un autre candidat qui aurait le même pilier socle avec les mêmes circuits dominants.

**Mode (ou profil retenu)**
> La manière spécifique dont vous utilisez un pilier. Chaque pilier a 7 modes possibles dans le référentiel. Le mode retenu pour vous est déterminé par les circuits dominants que vous activez dans ce pilier. Plusieurs candidats peuvent avoir le même mode, mais subtilement différent selon leurs circuits propres.

**Filtre cognitif**
> La pré-programmation automatique de votre pilier socle. Le filtre n'est pas une composante séparée — c'est la caractéristique intrinsèque qui fait qu'un pilier fonctionne comme socle. Un pilier socle est, par définition, un pilier filtré. Le filtre fait que la situation vous apparaît d'emblée sous une forme particulière — avant tout traitement conscient.

**Boucle cognitive**
> La séquence par laquelle vos 5 piliers s'enchaînent pour traiter une situation. Elle peut être séquencée (piliers dans l'ordre linéaire) ou fractionnée (retours sur un pilier précédent avant de poursuivre). Règle structurante du Profil-Cognitif : la boucle sort toujours en P5 (Mise en œuvre et exécution) — car le protocole mesure la cognition de la décision pour agir.

**Finalité cognitive**
> Le résultat attendu quand votre filtre s'active — un objectif cognitif concret, lié à l'action. Principe : la finalité est toujours couplée au filtre — elle existe nécessairement, qu'on l'ait détectée ou non. Seule vous pouvez poser votre finalité précise. Les analyses rendent visibles les grandes lignes, la formulation finale vous revient.

**Signature cognitive**
> Votre identité cognitive, ce qui vous rend singulier dans votre manière de traiter l'information avant d'agir. Formule : **signature cognitive = pilier socle + finalité** (avec le filtre intrinsèque au socle). Le pilier socle définit comment vous traitez, la finalité définit vers quoi vous tendez.

**Zone de coût cognitif**
> Les opérations cognitives que votre moteur doit effectuer mais qui lui coûtent plus d'énergie que d'autres. Ces zones ne sont pas des faiblesses — ce sont des endroits où votre moteur consomme davantage de carburant. Les reconnaître permet de les anticiper, de les compenser, de les déléguer quand c'est possible.

**Conforme / ÉCART**
> Sur chacune des 25 questions de l'entretien, un pilier est attendu (le pilier référent de la question). Si vous répondez dans ce pilier attendu : Conforme. Sinon : ÉCART. Les ÉCART sont précieux — ils révèlent l'enclenchement spontané de votre filtre cognitif et permettent d'identifier votre pilier socle.

---

## 6. RÈGLES DE RÉDACTION

### 6.1 Règle absolue — stabilité des définitions

Les définitions listées ci-dessus sont **le référentiel stable**. L'agent les utilise **telles quelles** — il ne les reformule pas d'un bilan à l'autre.

Raison : la cohérence industrielle exige que tous les candidats lisent la même définition du même concept. Toute variation introduirait du flou dans la marque Profil-Cognitif.

### 6.2 Règle — adaptation 2e personne si pertinent

Certaines définitions sont déjà en 2e personne (« vos piliers »). D'autres sont impersonnelles. L'agent **peut adapter** à la 2e personne pour être cohérent avec le reste de la section, **sans changer le fond**.

Exemple :
- Définition standard : « Tout humain mobilise les 5 piliers... »
- Adaptation 2e personne : « Vous mobilisez les 5 piliers... »

### 6.3 Règle — longueur maîtrisée

Un encart ne dépasse pas **120 mots**. Il doit se lire en 15-20 secondes.

Si un concept nécessite plus, le surplus doit aller **dans la section elle-même**, pas dans l'encart.

### 6.4 Règle — un seul concept par encart

Chaque encart définit **un seul concept**. Si deux concepts doivent être définis, produire deux encarts distincts.

### 6.5 Règle — pas de ponctuation typographique lourde

Pas de gras dans la définition, pas d'italique (sauf pour noms de concepts), pas de listes à puces dans un encart.

Seule exception : le nom du concept en début peut être en **gras** (« **Qu'est-ce qu'un filtre cognitif ?** »).

### 6.6 Formulations standardisées

| Contexte | Formulation standard |
|---|---|
| Ouverture de chaque encart | « **Qu'est-ce qu'un [concept] ?** [définition] » |
| Précision importante | Phrase courte intégrée dans la définition |

---

## 7. EXEMPLES

### Exemple A — Encart « Qu'est-ce qu'un filtre cognitif ? »

> **Qu'est-ce qu'un filtre cognitif ?** C'est la pré-programmation automatique de votre pilier socle. Ce n'est pas une composante séparée : c'est la caractéristique intrinsèque qui fait qu'un pilier fonctionne comme socle. Un pilier socle est, par définition, un pilier filtré. Le filtre fait que la situation vous apparaît d'emblée sous une forme particulière — avant tout traitement conscient.

(111 mots, définition complète du filtre cognitif, 2e personne)

### Exemple B — Encart « Qu'est-ce qu'un circuit cognitif ? »

> **Qu'est-ce qu'un circuit cognitif ?** Les circuits sont les outils qu'un pilier mobilise pour fonctionner. Chaque pilier compte 15 circuits possibles — les vôtres sont ceux que vos verbatims ont révélés actifs chez vous. La fréquence d'activation mesure à quel point chaque outil revient systématiquement dans votre façon de procéder.

(57 mots, format plus court adapté à un encart de section)

### Exemple C — Encart « Qu'est-ce qu'une finalité cognitive ? »

> **Qu'est-ce qu'une finalité cognitive ?** C'est le résultat attendu quand votre filtre s'active — un objectif cognitif concret, lié à l'action. Principe fondamental : la finalité est toujours couplée au filtre — elle existe nécessairement, qu'on l'ait détectée ou non. Principe de production : seule vous pouvez poser votre finalité. Les analyses rendent visibles les grandes lignes, la formulation précise vous revient.

(73 mots, avec les deux principes fondamentaux)

---

## 8. PIÈGES À ÉVITER

### Piège 1 — Reformuler une définition

❌ Chaque bilan propose une définition légèrement différente du même concept
✅ Toujours la même définition standard pour tous les bilans

### Piège 2 — Mélanger définition et analyse du candidat

❌ *« Qu'est-ce qu'un filtre cognitif ? Le vôtre est la modulation d'effort selon l'enjeu... »*
✅ La définition est **générique** (concept). L'analyse du candidat vient **après** l'encart.

### Piège 3 — Définition trop longue (>120 mots)

❌ Paragraphe de 200+ mots dans un encart
✅ Maximum 120 mots, surplus en dehors de l'encart

### Piège 4 — Concepts non standardisés

❌ Introduire un concept inventé qui n'est pas dans le référentiel
✅ Utiliser uniquement les concepts validés (liste section 5)

---

## 9. CHECK-LIST AUTO-CONTRÔLE

- [ ] Encart utilisé uniquement pour **un concept** à la fois
- [ ] Définition issue du **référentiel stable** (section 5 du template)
- [ ] 120 mots maximum
- [ ] Ouverture « Qu'est-ce qu'un [concept] ? » en gras
- [ ] Pas de listes à puces, pas de gras interne
- [ ] Rendu visuel respecte fond jaune pâle + bordure ambre

---
---

# TEMPLATE #12 — CARTOUCHE D'ATTRIBUTION (SCHÉMA DU MOTEUR)

## 1. NOM DU TEMPLATE

**Template #12 — Cartouche d'attribution pour le schéma du moteur cognitif**

Brique structurelle qui accompagne **le schéma du moteur cognitif** et récapitule les **attributions clés** du candidat en un coup d'œil.

---

## 2. BUT

Permettre à l'agent de produire, à droite du schéma du moteur, **un tableau synthétique** des attributions qui :
- En état **générique** : affiche « à déterminer » pour chaque ligne (pédagogie)
- En état **révélation** : affiche les valeurs réelles du candidat

Ce cartouche est le **résumé instantané** de ce que le protocole a révélé — accessible même sans lire le bilan entier.

---

## 3. QUAND UTILISER CE TEMPLATE

**Utilisation** : dans le schéma du moteur cognitif (2 états : générique + révélation).

**Volume** : 2 fois par bilan (un en générique, un en révélation).

---

## 4. STRUCTURE OBLIGATOIRE

```
┌─────────────────────────────────────┐
│ EN-TÊTE (bandeau bleu foncé)        │
│   « ATTRIBUTIONS »                  │
├─────────────────────────────────────┤
│ LIGNE 1                             │
│   Pilier socle                      │
│   [valeur ou "à déterminer"]        │
├─────────────────────────────────────┤
│ LIGNE 2                             │
│   Filtre cognitif du socle          │
│   [formulation ou "à déterminer"]   │
├─────────────────────────────────────┤
│ LIGNE 3                             │
│   Piliers structurants              │
│   [2 piliers ou "à déterminer"]     │
├─────────────────────────────────────┤
│ LIGNE 4                             │
│   Piliers fonctionnels              │
│   [2 piliers ou "à déterminer"]     │
├─────────────────────────────────────┤
│ LIGNE 5                             │
│   Finalité du moteur                │
│   [grande ligne ou "à déterminer"]  │
└─────────────────────────────────────┘
```

---

## 5. SLOTS À REMPLIR

### État générique (toutes valeurs = "à déterminer")

| Slot | Valeur |
|---|---|
| `{pilier_socle}` | « à déterminer » |
| `{filtre_cognitif}` | « à déterminer » |
| `{piliers_structurants}` | « à déterminer » |
| `{piliers_fonctionnels}` | « à déterminer » |
| `{finalite}` | « à déterminer » |

### État révélation (valeurs réelles depuis T4 et Template #4/#6)

| Slot | Exemple Cécile |
|---|---|
| `{pilier_socle}` | « Analyse (P3) ★ » |
| `{filtre_cognitif}` | « Lire ce qui est vrai dans la situation, depuis l'observation directe » |
| `{piliers_structurants}` | « Collecte d'information (P1) + Création de solutions (P4) » |
| `{piliers_fonctionnels}` | « Tri (P2) + Mise en œuvre et exécution (P5) » |
| `{finalite}` | « grandes lignes : justesse de calibrage, d'arbitrage contextuel, de préservation (à confirmer) » |

---

## 6. RÈGLES DE RÉDACTION

### 6.1 Règle — formulations condensées

Le cartouche est visuel, pas narratif. Chaque ligne contient une **formulation condensée**, pas une phrase complète.

- ✅ « Analyse (P3) ★ » (condensé)
- ❌ « Votre pilier socle est l'Analyse, identifié par la preuve des ÉCART » (trop long)

### 6.2 Règle — état générique explicite

En état générique, toutes les lignes affichent **exactement** « à déterminer » — pas de variation.

### 6.3 Règle — cohérence avec templates détaillés

Les valeurs du cartouche doivent **correspondre exactement** à ce qui est posé dans les templates détaillés (Template #4 pour filtre, Template #6 pour finalité, Template #3 pour rôles des piliers).

Si un filtre est posé dans le bloc synthèse comme « Lire ce qui est vrai dans la situation », le cartouche doit reprendre **la même formulation** (ou une version tronquée acceptable).

### 6.4 Règle — finalité en grandes lignes

La finalité n'est jamais tranchée dans le cartouche. Format recommandé :
- « grandes lignes : [résumé en 2-3 angles] (à confirmer) »
- Ou plus court : « à confirmer — 3 grandes lignes proposées »

### 6.5 Règle — marquer le socle

Le pilier socle est toujours marqué par l'étoile ★ dans le cartouche révélation.

---

## 7. EXEMPLES

### Cartouche générique (identique pour tous les candidats)

```
┌─────────────────────────────────────┐
│        ATTRIBUTIONS                 │
├─────────────────────────────────────┤
│ Pilier socle                        │
│ à déterminer                        │
├─────────────────────────────────────┤
│ Filtre cognitif du socle            │
│ à déterminer                        │
├─────────────────────────────────────┤
│ Piliers structurants                │
│ à déterminer                        │
├─────────────────────────────────────┤
│ Piliers fonctionnels                │
│ à déterminer                        │
├─────────────────────────────────────┤
│ Finalité du moteur                  │
│ à déterminer                        │
└─────────────────────────────────────┘
```

### Cartouche révélation — Cécile

```
┌─────────────────────────────────────────────────┐
│             ATTRIBUTIONS                        │
├─────────────────────────────────────────────────┤
│ Pilier socle                                    │
│ ★ Analyse (P3)                                  │
├─────────────────────────────────────────────────┤
│ Filtre cognitif du socle                        │
│ Lire ce qui est vrai dans la situation,         │
│ depuis l'observation directe                    │
├─────────────────────────────────────────────────┤
│ Piliers structurants                            │
│ Collecte d'information (P1)                     │
│ + Création de solutions (P4)                    │
├─────────────────────────────────────────────────┤
│ Piliers fonctionnels                            │
│ Tri (P2) · entrée de cycle                      │
│ + Mise en œuvre et exécution (P5) · sortie      │
│   [résistant]                                   │
├─────────────────────────────────────────────────┤
│ Finalité du moteur                              │
│ Grandes lignes : justesse du calibrage, de      │
│ l'arbitrage contextuel, de la préservation      │
│ (à confirmer avec la candidate)                 │
└─────────────────────────────────────────────────┘
```

### Cartouche révélation — Rémi (structure)

```
┌─────────────────────────────────────────────────┐
│             ATTRIBUTIONS                        │
├─────────────────────────────────────────────────┤
│ Pilier socle                                    │
│ ★ Création de solutions (P4)                    │
├─────────────────────────────────────────────────┤
│ Filtre cognitif du socle                        │
│ Maintenir les voies ouvertes                    │
├─────────────────────────────────────────────────┤
│ Piliers structurants                            │
│ Analyse (P3) + Mise en œuvre et exécution (P5)  │
├─────────────────────────────────────────────────┤
│ Piliers fonctionnels                            │
│ Collecte d'information (P1) · entrée            │
│ + Tri (P2) [ou autre selon T4]                  │
├─────────────────────────────────────────────────┤
│ Finalité du moteur                              │
│ Grandes lignes : préserver la réversibilité,    │
│ orchestrer la coexistence des options           │
│ (à confirmer)                                   │
└─────────────────────────────────────────────────┘
```

### Cartouche révélation — Véronique (structure)

```
┌─────────────────────────────────────────────────┐
│             ATTRIBUTIONS                        │
├─────────────────────────────────────────────────┤
│ Pilier socle                                    │
│ ★ Analyse (P3)                                  │
├─────────────────────────────────────────────────┤
│ Filtre cognitif du socle                        │
│ Extraire le principe logique                    │
├─────────────────────────────────────────────────┤
│ Piliers structurants                            │
│ [Selon T4 Véronique]                            │
├─────────────────────────────────────────────────┤
│ Piliers fonctionnels                            │
│ [Selon T4 Véronique]                            │
├─────────────────────────────────────────────────┤
│ Finalité du moteur                              │
│ Grandes lignes : règles qui tiennent dans le    │
│ contexte, compréhension profonde des mécanismes │
│ (à confirmer)                                   │
└─────────────────────────────────────────────────┘
```

---

## 8. PIÈGES À ÉVITER

### Piège 1 — Formulations trop longues dans le cartouche

❌ Le filtre affiché en 3 lignes dans le cartouche
✅ Formulation condensée 1-2 lignes, version complète dans Template #4

### Piège 2 — Trancher la finalité dans le cartouche

❌ « Finalité : produire des décisions justement calibrées »
✅ « Finalité : grandes lignes [...] (à confirmer) »

### Piège 3 — État générique partiel

❌ Afficher le pilier socle « Analyse » et laisser la finalité « à déterminer »
✅ Soit tout en générique, soit tout en révélation — pas de mélange

### Piège 4 — Oubli du marqueur socle

❌ « Analyse (P3) » sans étoile
✅ « ★ Analyse (P3) »

### Piège 5 — Utilisation de "cylindre"

❌ « Tri (P2) · cylindre 4 »
✅ « Tri (P2) · entrée de cycle » (ou pilier fonctionnel 1)

---

## 9. CHECK-LIST AUTO-CONTRÔLE

- [ ] 5 lignes dans le cartouche (socle, filtre, structurants, fonctionnels, finalité)
- [ ] En-tête « ATTRIBUTIONS » en bandeau bleu foncé
- [ ] État générique : toutes lignes = « à déterminer »
- [ ] État révélation : pilier socle marqué ★
- [ ] Finalité toujours présentée comme à confirmer
- [ ] Formulations condensées (pas de phrases complètes)
- [ ] Cohérence avec les templates détaillés
- [ ] Terme « pilier fonctionnel » (pas « cylindre »)

---
---

# TEMPLATE #13 — COMMENTAIRE D'ATTRIBUTION (SORTIE T3)

## 1. NOM DU TEMPLATE

**Template #13 — Commentaire d'attribution pour la sortie T3 v4**

Brique rédactionnelle qui produit le champ **`commentaire_attribution`** de la sortie T3 v4 — synthèse analytique par circuit × pilier × candidat de la qualité d'attribution (franches vs nuancées + clusters identifiés).

Ce template est utilisé **à l'intérieur du prompt T3 v4** (pas dans le bilan final). Il sert à l'agent T3 pour produire systématiquement des commentaires cohérents, reproductibles et exploitables par les agents en aval (T4_BILAN).

---

## 2. BUT

Permettre à l'agent T3 v4 de produire, pour chaque circuit actif, un commentaire synthétique qui :
- **Qualifie la nature de l'attribution** (franche dominante, nuancée majoritaire, mixte)
- **Identifie les clusters** présents et leur rang
- **Fournit une lecture interprétative** factuelle du pattern révélé
- **Alimente directement** la description d'usage dans le T4_BILAN aval

Principe : le commentaire est **du texte prêt à être injecté** dans les descriptions candidat — il ne doit pas être refait en aval.

---

## 3. QUAND UTILISER CE TEMPLATE

**Utilisation** : dans le prompt T3 v4, pour chaque circuit × pilier × candidat avec `actif = "OUI"`.

**Volume** : jusqu'à 225 commentaires par session T3 v4 (75 circuits × 3 candidats), dont environ 120-150 pour les circuits réellement actifs.

---

## 4. STRUCTURE OBLIGATOIRE

Le commentaire suit **une structure modulaire** de 2 à 4 phrases selon le cas :

```
Phrase 1 — QUALIFICATION DU CIRCUIT
  • Niveau d'activation + position
  • Ex. "Circuit socle ultra-dominant (16 activations)"

Phrase 2 — QUALITÉ D'ATTRIBUTION
  • Ratio franches / nuancées
  • Ex. "rarement activé seul : 2 franches / 14 nuancées"

Phrase 3 — CLUSTER DOMINANT (si présent)
  • Partenaire + nb co-occurrences + interprétation factuelle
  • Ex. "Cluster dominant C10 × C15 (6 co-oc) : la modulation
     d'effort intègre systématiquement la dimension émotionnelle
     comme donnée."

Phrase 4 — CLUSTERS SECONDAIRES ou REMARQUE STRUCTURELLE
  • Mentionner clusters rang 2-3 si présents
  • Ou remarque sur absence de cluster / circuit isolé
  • Ex. "Clusters secondaires avec C12 (priorisation) et C7 
     (contextualisation)."
```

---

## 5. SLOTS À REMPLIR

| Slot | Source | Exemple |
|---|---|---|
| `{circuit_id}` | T3 | `"C10"` |
| `{frequence}` | T3 | `16` |
| `{niveau}` | T3 | `"HAUT"` |
| `{role_pilier}` | T3 | `"socle"` / `"structurant"` / `"fonctionnel"` |
| `{nb_franches}` | T3 v4 | `2` |
| `{nb_nuancees}` | T3 v4 | `14` |
| `{cluster_dominant}` | T3 v4 | `{C15, 6 co-oc}` |
| `{clusters_secondaires}` | T3 v4 | `[{C12, 5}, {C7, 4}]` |

---

## 6. RÈGLES DE RÉDACTION

### 6.1 Règle absolue — factuel uniquement

Le commentaire est **factuel**, pas évaluatif. Aucun adjectif de jugement.

- ❌ « Circuit impressionnant », « utilisation remarquable »
- ✅ « Circuit ultra-dominant », « présence dense »

### 6.2 Règle — interprétation factuelle des clusters

Pour chaque cluster mentionné, l'agent produit **une interprétation cognitive factuelle** du couplage — pas une interprétation psychologique.

Formulations-type pour les clusters les plus fréquents (à utiliser quand le cluster apparaît) :

| Cluster | Interprétation factuelle |
|---|---|
| C10 × C15 (P3) | « la modulation d'effort intègre la dimension émotionnelle comme donnée » |
| C10 × C12 (P3) | « la modulation d'effort passe par la priorisation hiérarchique » |
| C10 × C7 (P3) | « la modulation d'effort s'appuie sur la contextualisation » |
| C6 × C15 (P4) | « la diversification des options s'orchestre en multidimensionnel » |
| C1 × C13 (P5) | « l'exécution structurée passe par le leadership collaboratif » |

Cette liste est **extensible** — l'agent produit une formulation factuelle pour tout cluster non listé.

### 6.3 Règle — longueur maîtrisée

Le commentaire fait **1 à 3 phrases** (pour circuit actif) ou **1 phrase** (pour circuit inactif).

Pour un circuit inactif, formulation standard :
> « Circuit non activé dans les verbatims. Aucune activation, aucun cluster. »

### 6.4 Règle — adresse 3e personne

Le commentaire est **adressé au protocole**, pas au candidat. 3e personne ou impersonnel.

- ❌ « Vous activez ce circuit systématiquement »
- ✅ « Circuit activé systématiquement » ou « Ce circuit est activé systématiquement chez Cécile »

### 6.5 Formulations standardisées pour les cas types

| Cas | Formulation-type |
|---|---|
| Circuit socle ultra-dominant avec clusters | « Circuit socle ultra-dominant ([N] activations) rarement activé seul : [nb_f] franches / [nb_n] nuancées. Cluster dominant [Cx × Cy] ([N] co-oc) : [interprétation]. [Clusters secondaires si présents]. » |
| Circuit structurant HAUT sans cluster fort | « Circuit [niveau] du pilier structurant ([N] activations). [nb_f] franches / [nb_n] nuancées. Pas de cluster identifié au seuil protocole — circuit isolé dans le pilier. » |
| Circuit fonctionnel MOYEN | « Circuit à niveau MOYEN ([N] activations). [nb_f] franches / [nb_n] nuancées. Pas de cluster détectable au seuil protocole. » |
| Circuit INACTIF | « Circuit non activé dans les verbatims. Aucune activation, aucun cluster. » |

---

## 7. EXEMPLES

### Exemple A — Cécile C10 P3 (circuit socle ultra-dominant avec clusters)

**Données :**
- Circuit : C10 · Modulation de la profondeur d'analyse selon l'enjeu
- Fréquence : 16 · Niveau : HAUT
- Franches : 2 · Nuancées : 14
- Cluster dominant : C15 (6 co-oc)
- Clusters secondaires : C12 (5 co-oc), C7 (4 co-oc), C6 (3 co-oc)

**Commentaire produit :**
> *« Circuit socle ultra-dominant (16 activations) rarement activé seul : 2 franches / 14 nuancées. Cluster dominant C10 × C15 (6 co-oc) : la modulation d'effort intègre systématiquement la dimension émotionnelle comme donnée. Clusters secondaires avec C12 (priorisation) et C7 (contextualisation). Ce circuit est le cœur d'un réseau dense d'activations couplées dans le pilier socle. »*

### Exemple B — Cécile C13 P5 (circuit fonctionnel HAUT avec particularité)

**Données :**
- Circuit : C13 · Leadership collaboratif en contexte d'équipe
- Fréquence : 4 · Niveau : HAUT
- Franches : 3 · Nuancées : 1
- Pas de cluster au seuil

**Commentaire produit :**
> *« Circuit niveau HAUT dans le pilier fonctionnel 2 résistant (4 activations) : 3 franches / 1 nuancée. Pas de cluster identifié au seuil protocole. Activation significative compte tenu du rôle résistant du pilier — marque une stratégie compensatoire (coordination plutôt qu'exécution solitaire). »*

### Exemple C — Véronique C10 P3 (circuit socle avec cluster exclusif)

**Données :**
- Circuit : C10 · Modulation de la profondeur d'analyse selon l'enjeu
- Fréquence : 18 · Niveau : HAUT
- Franches : 4 · Nuancées : 14
- Cluster dominant unique : C7 (6 co-oc)

**Commentaire produit :**
> *« Circuit socle ultra-dominant (18 activations). 4 franches / 14 nuancées. Cluster dominant et exclusif C10 × C7 (6 co-oc) : la modulation d'analyse s'opère par contextualisation approfondie préalable. Absence de clusters secondaires — signature de combinaison concentrée sur un seul partenaire, contrastant avec des profils à réseau plus distribué. »*

### Exemple D — Rémi C6 P4 (circuit socle modéré)

**Données :**
- Circuit : C6 · Diversification méthodique des options de solution
- Fréquence : 7 · Niveau : HAUT
- Franches : 4 · Nuancées : 3
- Cluster identifié : C15 (3 co-oc)
- Note : co-occurrence avec C14 présente mais C14 reste MOYEN

**Commentaire produit :**
> *« Circuit socle (pilier P4). 7 activations : 4 franches / 3 nuancées. Cluster C6 × C15 identifié (3 co-oc) : la diversification méthodique s'orchestre en multidimensionnel. Co-occurrence C6 × C14 présente (3 verbatims) mais non retenue comme cluster au seuil protocole — C14 reste MOYEN (3 activations). »*

### Exemple E — Circuit inactif

**Données :**
- Circuit : C3 P3 · Détection des biais cognitifs et informationnels
- Fréquence : 0 · Niveau : INACTIF

**Commentaire produit :**
> *« Circuit non activé dans les verbatims. Aucune activation, aucun cluster. »*

---

## 8. PIÈGES À ÉVITER

### Piège 1 — Commentaire évaluatif

❌ « Excellent usage de ce circuit »
✅ « Circuit ultra-dominant — usage systématique »

### Piège 2 — Interprétation psychologique

❌ « Révèle un besoin de contrôle »
✅ « Révèle un couplage systématique modulation + priorisation »

### Piège 3 — Adresse au candidat

❌ « Vous utilisez ce circuit en couplage »
✅ « Circuit utilisé en couplage avec... » ou « Chez [candidat], ce circuit est couplé à... »

### Piège 4 — Longueur excessive

❌ 5+ phrases avec développement narratif
✅ Maximum 4 phrases, format télégraphique acceptable

### Piège 5 — Absence d'interprétation factuelle du cluster

❌ « Cluster C10 × C15 présent »
✅ « Cluster C10 × C15 (6 co-oc) : [interprétation factuelle du couplage] »

### Piège 6 — Inventer une interprétation de cluster non documentée

❌ L'agent invente une interprétation psychologique d'un couplage
✅ Pour un cluster non listé dans la table, produire une formulation factuelle du type « [circuit A] se couple à [circuit B] dans [N] situations »

---

## 9. CHECK-LIST AUTO-CONTRÔLE

- [ ] Qualification du circuit présente (niveau + position)
- [ ] Ratio franches / nuancées chiffré
- [ ] Cluster dominant cité avec nb co-oc et interprétation factuelle
- [ ] Clusters secondaires mentionnés si présents (sinon « pas de cluster »)
- [ ] 1 à 4 phrases maximum
- [ ] 3e personne ou impersonnel
- [ ] Pas d'évaluatif, pas de psychologisation
- [ ] Formulation standardisée respectée pour les cas types
- [ ] Pour circuit INACTIF : formulation standard unique

---
---

# TEMPLATE #15 — STRUCTURE GLOBALE DU BILAN

## 1. NOM DU TEMPLATE

**Template #15 — Structure globale du bilan**

Brique structurelle qui définit **l'ordre des sections** du bilan complet et produit la **table des matières / navigation** associée.

---

## 2. BUT

Permettre à l'agent orchestrateur de produire :
- **L'ordre des sections** du bilan (identique pour tous les candidats)
- **La navigation** (table des matières cliquable en début de bilan)
- **Les transitions** entre sections (phrases courtes qui relient)

Ce template garantit la **cohérence industrielle** : tous les bilans suivent la même architecture, quel que soit le candidat.

---

## 3. QUAND UTILISER CE TEMPLATE

**Utilisation** : par l'orchestrateur, au moment d'assembler le bilan complet.

**Volume** : 1 fois par bilan.

---

## 4. STRUCTURE GLOBALE DU BILAN (ordre obligatoire)

```
┌───────────────────────────────────────────────────────────────┐
│                  HEADER · BANDEAU D'OUVERTURE                 │
│   • Titre : « Profil Cognitif · Bilan de restitution »        │
│   • Prénom du candidat                                        │
│   • Chiffres clés (N Conformes, N ÉCART, scénarios)           │
├───────────────────────────────────────────────────────────────┤
│                  NAVIGATION FIXE                              │
│   • Table des matières avec ancres cliquables                 │
│   • Sticky en haut de page                                    │
├───────────────────────────────────────────────────────────────┤
│ SECTION A · VOTRE MOTEUR COGNITIF                             │
│   • A.1  Définition inline « Qu'est-ce qu'un moteur ? »       │
│   • A.2  Légende des 3 couleurs (rôles)                       │
│   • A.3  Ordre de la boucle cognitive                         │
│   • A.4  Schéma État 1 · Générique (Template #12 générique)   │
│   • A.5  Schéma État 2 · Révélation (Template #12 révélation) │
├───────────────────────────────────────────────────────────────┤
│ SECTION B · LEXIQUE                                           │
│   • 15 termes définis dans l'ordre logique (Template #11)     │
├───────────────────────────────────────────────────────────────┤
│ SECTION C · ANALYSE DE VOS 5 PILIERS                          │
│   • C.1  Bloc P1 Collecte d'information                       │
│   • C.2  Bloc P2 Tri                                          │
│   • C.3  Bloc P3 Analyse                                      │
│   • C.4  Bloc P4 Création de solutions                        │
│   • C.5  Bloc P5 Mise en œuvre et exécution                   │
│                                                               │
│   Structure de chaque bloc pilier :                           │
│     • En-tête (Template #14)                                  │
│     • Pourquoi ce rôle (Template #3)                          │
│     • Circuits activés (Template #1 × N circuits)             │
│     • Mode retenu (Template #2)                               │
├───────────────────────────────────────────────────────────────┤
│ SECTION D · SYNTHÈSE FINALE                                   │
│   • D.1  Votre filtre cognitif (Template #4)                  │
│   • D.2  Votre boucle cognitive (Template #5)                 │
│   • D.3  Votre finalité · grandes lignes (Template #6)        │
│   • D.4  Votre signature cognitive (Template #7)              │
│   • D.5  Vos zones de coût (Templates #8 et/ou #9)            │
│   • D.6  Ce que votre architecture permet (Template #10)      │
├───────────────────────────────────────────────────────────────┤
│                  FOOTER                                       │
│   • Mention protocole v36                                     │
│   • Note méthodologique                                       │
└───────────────────────────────────────────────────────────────┘
```

---

## 5. RÈGLES STRUCTURELLES

### 5.1 Règle — ordre strict

L'ordre **A → B → C → D** est **obligatoire et non négociable** pour tous les bilans. Rationale :
- **A** pose le cadre visuel (schéma)
- **B** donne le lexique pour lire
- **C** détaille pilier par pilier (du particulier)
- **D** synthétise et relie (vers le général)

### 5.2 Règle — ordre des piliers dans la section C

L'ordre **P1 → P2 → P3 → P4 → P5** est celui du **cycle cognitif**, pas de l'importance. Même si P3 est le pilier socle, il n'est pas présenté en premier — on respecte l'ordre fonctionnel du moteur.

### 5.3 Règle — ordre des sections dans la synthèse D

L'ordre **filtre → boucle → finalité → signature → zones de coût → conclusion** suit la logique « cause → conséquences → synthèse → nuances → clôture ».

### 5.4 Règle — transitions entre sections

L'orchestrateur **n'ajoute pas** de transitions narratives longues entre sections. Chaque section est autonome, la navigation permet au lecteur de passer d'une à l'autre.

Exception : entre la dernière section C (P5) et la section D, une **phrase de transition** est utile :
> *« Maintenant que nous avons détaillé chacun de vos 5 piliers, voici ce que leur assemblage révèle de votre architecture cognitive. »*

---

## 6. NAVIGATION (TABLE DES MATIÈRES)

### Format HTML de la navigation

```html
<nav class="sticky-nav">
  <div class="nav-inner">
    <a href="#moteur">Votre moteur</a>
    <a href="#lexique">Lexique</a>
    <a href="#P1">P1 Collecte d'information</a>
    <a href="#P2">P2 Tri</a>
    <a href="#P3">P3 Analyse ★</a>
    <a href="#P4">P4 Création de solutions</a>
    <a href="#P5">P5 Mise en œuvre et exécution</a>
    <a href="#synthese">Synthèse finale</a>
  </div>
</nav>
```

### Adaptation selon le pilier socle

Le marqueur ★ apparaît à côté du pilier socle dans la navigation, quel qu'il soit :
- Cécile : `#P3 Analyse ★`
- Rémi : `#P4 Création de solutions ★`
- Véronique : `#P3 Analyse ★`

---

## 7. EN-TÊTE (HEADER) TYPE

### Format standard

```html
<header class="hero">
  <div class="hero-inner">
    <div class="hero-tag">Profil Cognitif · Bilan de restitution</div>
    <h1>[Prénom]</h1>
    <div class="hero-sub">Architecture cognitive · Rapport en 3 dimensions : laboratoire · pairs · candidat</div>
    <div class="hero-meta">
      <span>[N] Conformes · [N] ÉCART sur 25 questions</span>
      <span>4 scénarios</span>
      <span>[Pilier socle nommé]</span>
    </div>
  </div>
</header>
```

---

## 8. FOOTER TYPE

### Format standard

```html
<footer class="footer">
  Profil Cognitif · Bilan [Prénom] · Version [X.Y]
  <div class="footer-note">
    Produit à partir du protocole d'analyse v36 · Tous les éléments factuels sont vérifiés · Clusters calculés selon la règle T3 v4 (≥ 3 co-occurrences, ≥ 2 circuits HAUT) · Finalité à confirmer selon règle D12
  </div>
</footer>
```

---

## 9. PIÈGES À ÉVITER

### Piège 1 — Changer l'ordre des sections

❌ Mettre la synthèse avant les blocs piliers pour « captiver le lecteur »
✅ Ordre A → B → C → D strict pour tous les bilans

### Piège 2 — Piliers dans l'ordre d'importance

❌ Commencer par P3 (socle de Cécile) pour « valoriser d'abord »
✅ Toujours P1 → P2 → P3 → P4 → P5 (ordre fonctionnel)

### Piège 3 — Oubli du schéma État 1 générique

❌ Produire uniquement le schéma révélation
✅ Toujours les 2 états : générique puis révélation (pédagogie de la révélation)

### Piège 4 — Transition narrative lourde

❌ Paragraphes entiers de transition entre sections
✅ Sections autonomes, une seule phrase de transition avant la synthèse

### Piège 5 — Pas de marqueur ★ dans la navigation

❌ Navigation sans identifier le pilier socle
✅ Toujours ★ à côté du pilier socle dans la nav

---

## 10. CHECK-LIST AUTO-CONTRÔLE

- [ ] Header présent avec tous les champs (titre, prénom, sous-titre, chiffres)
- [ ] Navigation fixe présente avec 8 ancres (moteur, lexique, 5 piliers, synthèse)
- [ ] Pilier socle marqué ★ dans la navigation
- [ ] Section A présente avec les 2 états du schéma
- [ ] Section B (lexique) présente avec tous les termes du référentiel
- [ ] Section C présente avec les 5 blocs piliers dans l'ordre P1→P5
- [ ] Chaque bloc pilier suit la structure (#14 + #3 + #1 × N + #2)
- [ ] Section D présente avec les 6 sous-sections dans l'ordre (filtre→conclusion)
- [ ] Footer présent avec mention protocole v36
- [ ] Ordre strict respecté A→B→C→D

---

## FIN DU LOT E
