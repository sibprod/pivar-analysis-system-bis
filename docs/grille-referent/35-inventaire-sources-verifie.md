# 35 · INVENTAIRE DES SOURCES — VÉRIFIÉ EN BASE
## 24/08/2026 · corrige et remplace la pièce 11 du 19/08

> **Règle de ce document** : **aucun champ n'y figure sans avoir été lu en base.** Là où je n'ai pas lu, c'est écrit « non lu », pas « n'existe pas ».
>
> ⚠️ **La pièce 11 affirmait, ligne 24 : « Titres des gestes — n'existe pas en base ».** C'était faux. `explication_courte_ch4` existe pour tous les gestes. Cette seule affirmation non vérifiée a engendré R1, puis R1bis, puis trois jours d'échecs de production. **Elle est annulée.**

---

# LE PIÈGE À CONNAÎTRE AVANT TOUT

**Le nom d'un champ dans Airtable ≠ la clé renvoyée par le service.** `airtableService` traduit par identifiant via `config/airtable`, et des préfixes disparaissent au passage.

| Dans Airtable | En sortie du service |
|---|---|
| `synth_bloc_tres_souvent_candidat` | **`bloc_tres_souvent_candidat`** |

**Il faut lire les clés du service**, jamais le schéma Airtable seul :
```
node -e "require('./services/infrastructure/airtableService').<getteur>('<id>').then(r=>console.log(Object.keys(Array.isArray(r)?r[0]:r).join(' | ')))"
```

---

# BLOC PAR BLOC — CE QUI ALIMENTE QUOI

## Cartouche de lecture rapide

| Élément | Source vérifiée | Nature |
|---|---|---|
| Zone | `REFERENTIEL_PROFIL_VS_PILIER` · `zone` | EXPORT |
| Signature | `REFERENTIEL_PROFIL_VS_PILIER` · `titre` | EXPORT |
| Socle | `ETAPE1_T3_BILAN` · `pilier_socle_label` | EXPORT |
| Manière de chaque outil | `ETAPE1_T3_PILIER` · `pilier_mode` | EXPORT |
| Réglage (filtre) | `ETAPE1_T3_BILAN` · `filtre` | EXPORT · transposition de personne |
| Rôles | `ETAPE1_T3_PILIER` · `pilier_role_label` | EXPORT |
| Dimensions + niveau | `RESPONSES_ETAPE2_ EXCELLENCE` · `excellence` + `niveau_global` | DÉRIVÉ |

⛔ **`type_complet` ne doit JAMAIS alimenter la signature** : il contient « ORCHESTRATEUR (7) · Environnement STRATÉGIQUE · Type A » — un rang, un vocabulaire abandonné, et un classement A/F périmé. **Il n'est plus transmis.**

## Bloc 1 · Ce qu'il apporte

| Élément | Source vérifiée | Nature |
|---|---|---|
| Titre de la tuile | `REFERENTIEL_PROFIL_VS_PILIER` · `titre` | EXPORT |
| Définition du type | même table · `definition_type` | EXPORT du lexique |
| Application au socle | même table · `application_au_socle` | EXPORT |
| Atouts · coûts | même table · `atouts` / `couts` | EXPORT + vérification R8 |
| Ce que sa chaîne y ajoute | synthèses de l'amont et de l'aval | **AGENT** |
| Note de portée | — | GABARIT |

**Clé de tuile** : `pilier_socle` + `type_cognitif` → `SOLUTIONS-ORCHESTRATEUR`. Composition mécanique.

## Bloc 2 · Son profil — LE POINT LE PLUS IMPORTANT

| Élément | Source vérifiée | Nature |
|---|---|---|
| Rôle · libellé · manière | `ETAPE1_T3_PILIER` | EXPORT |
| **Synthèse par outil** | `ETAPE1_T3_PILIER` · **`bloc_tres_souvent_candidat`** *(et `bloc_souvent_` / `bloc_occasionnels_` selon le bloc retenu)* | **EXPORT INTÉGRAL** — jamais condensé |
| **Titre d'un geste** | **`ETAPE1_T3_CIRCUIT` · `explication_courte_ch4`**, mis à l'infinitif | **DÉRIVÉ** |
| **Narration d'un geste** | `ETAPE1_T3_BILAN` · `filtre_gestes` → champ `fait` — **socle uniquement** | EXPORT |
| Renfort | `ETAPE1_T3_CIRCUIT` · **`en_renfort`** | EXPORT |
| Sélection des gestes | `ETAPE1_T2_CIRCUITS_POURBILAN` · **`bloc_final`** | mécanique · cascade R9 |
| Ce qui le porte, ce qui le freine | `ETAPE1_T3_BILAN` · **`registres`** | **AGENT** — contient verbatims et situations, à transposer |

### 🔴 CE QUE `filtre_gestes` CONTIENT RÉELLEMENT — sept champs, pas un
Vérifié sur **deux candidats** (R. et C.). Chaque geste du socle porte :

| Champ | Contenu réel | Usage |
|---|---|---|
| `code` | `P3C12` | traçabilité — ne s'affiche pas |
| `nom` | *« Priorisation hiérarchique des problématiques »* | ⛔ **coffre (D95)** — nom de référentiel |
| `coeur` | `17` | ⛔ **comptage (D95)** |
| `rang` | *« votre geste le plus fréquent »* | **disponible, non employé** — à arbitrer |
| `dit` | les verbatims, avec leurs références (`P4Q7`) | ⛔ **D-PREUVE** |
| **`fait`** | **le paragraphe** de 200 à 400 caractères | ✅ **la narration** |
| **`revele`** | *« Ce geste est le plus structurant de votre entrée dans une situation : la grille est déjà là avant de traiter quoi que ce soit. »* | **disponible, JAMAIS employé** |

### Et le titre — d'où il vient vraiment
| Champ | Contenu | Existe pour |
|---|---|---|
| `explication_courte_ch4` | **une phrase** — *« Vous allez chercher la personne qui sait, dans votre entourage, avant toute recherche à l'aveugle. »* | **tous les gestes**, socle comme fonctionnels |
| `filtre_gestes` → `fait` | **un paragraphe** | **le socle seulement** |

**Donc** : le titre se dérive de la phrase courte · la narration est le paragraphe · les gestes hors socle n'ont **que** leur phrase.

### ⚠️ Les synthèses portent des comptages
Vérifié chez C. : *« la Priorisation hiérarchique s'active **2 fois** en service de votre Collecte »*, *« l'ajustement lui revient **5 fois** »*. Et des **noms de référentiel** : « Priorisation hiérarchique », « Modulation de la profondeur ».
**L'export ne peut donc PAS être brut** — il faut une transposition qui retire les comptages et les noms de circuits, sans toucher au fond. C'est la mission de l'agent des synthèses, et le contrôle D95 le vérifie.

⛔ **`circuit_nom_clair`** (`ETAPE1_T2_CIRCUITS_POURBILAN`) porte le nom de référentiel — *« Conception multidimensionnelle de solutions complexes »*. **Vocabulaire de laboratoire : reste au coffre (D95).**
⛔ **`bloc`** contient encore « BLOC_EN_ATTENTE » — résidu du pré-classement. **Ne jamais le lire.**
⛔ **`circuit_niveau`** est une amplitude absolue, **pas** le rang dans le pilier. Ne pas confondre avec `bloc_final`.

## Bloc 3 · Ses dimensions d'excellence

### 🔴 UNE DIMENSION PEUT AVOIR DEUX MESURES — vérifié sur trois candidats

| Mesure | Table | Rémi | Véronique | Cécile |
|---|---|---|---|---|
| **1 · fenêtre principale** | `RESPONSES_ETAPE2_ EXCELLENCE` · `niveau_global` | Non évalué — test à passer | 8/20 (40 %) — posé avec réserve | 11/20 (55 %) |
| **2 · test complémentaire** | `tblA6VvPlrTbPWuQG` | 1/4 — OBSERVÉE | 2/4 — MOYENNE | *(non vérifié)* |
| **fusion** | `ETAPE2_BILAN4EXCELLENCES` · `fld05ugiziwG3jMZY` | OBSERVÉE (1/4 — test complémentaire ; fenêtre principale : non évaluée) | 2/4 — test complémentaire (fenêtre principale : 8/20) | — |

**Les quatre niveaux fusionnés**, dans `ETAPE2_BILAN4EXCELLENCES` :

| Dimension | Champ | Rémi | Véronique |
|---|---|---|---|
| Anticipation | `fldHMPW083IKtUMb3` | MOYENNE (12/25) | DENSE (15/25) |
| Vue systémique | `fldFyU6yc1bnFsRtJ` | FAIBLE (9/25) | MOYENNE (13/25) |
| Décentration | `fld05ugiziwG3jMZY` | OBSERVÉE (1/4) | 2/4 |
| Méta-cognition | `fldRLNC7YpPtXy9Pv` | FAIBLE (0/25) | ABSENTE (4/25) |
| Ordre | `fldDHH8ZBF2gGnTpI` | — | — |
| Lecture réconciliée | `fldXOMtejqdUdg7CQ` | — | — |

**La règle** : le **niveau** vient du bilan fusionné · les **textes** viennent des réponses · la **réconciliation** vient de `reserves_globales`.

⚠️ Ces champs portent des comptages (« 12/25 », « 1/4 ») — la neutralisation les retire (D95).

### ❓ CE QUE JE NE SAIS PAS
La garante mentionne que l'agent d'étape 2 « a repris toutes ses conclusions sur les 4 dimensions **par exigence et par incidence** ». **Ces deux notions ne figurent ni dans la doctrine dont je dispose, ni dans les champs que j'ai lus.** Elles sont probablement définies dans les prompts `prompt_etape2_b_T5B_*`. **À lire avant d'aller plus loin sur ce point.**

---

## Bloc 3 · Ses dimensions d'excellence — les champs

| Élément | Source vérifiée | Nature |
|---|---|---|
| Constat · quand · limite | `RESPONSES_ETAPE2_ EXCELLENCE` · `synthese` · `declencheur` · `gradient` | **AGENT** — la source porte comptages et scénarios, interdits (D95) |
| Portrait en un mot | `ETAPE2_BILAN4EXCELLENCES` · `portrait_un_mot` | EXPORT |
| Note « dimension non manifestée » | — | GABARIT |

*Lus mais non employés : `combinaison`, `reserves_globales`. Disponibles si tu veux les exploiter.*

## Bloc 4 · À quoi s'attendre au travail

| Élément | Source vérifiée | Nature |
|---|---|---|
| Sélection des points | `BILAN_DESALIGNEMENT` · `contenu_json` — **151 items** répartis en listes | **AGENT** · ancrage obligatoire |
| Origine de chaque point | même table — **réattachée par le serveur**, jamais recopiée par l'agent | mécanique |
| Force · preuve · bascule · scène · question · clé | — | **AGENT** |
| Injonctions | `BILAN_DESALIGNEMENT` · `bloc_type = INJONCTIONS` | **EXPORT mot pour mot** — l'énoncé EST le contenu |
| Réserve d'activation | — | GABARIT |

### 🔴 Le piège de cette table
Le `contenu_json` est indenté avec des **espaces insécables** (U+00A0), que `JSON.parse` refuse. Sans normalisation, l'analyse échoue en silence et **le référentiel arrive vide** — c'est ce qui a produit `attendus: 0` et une grille sans son bloc 4.

## Bloc 5 et pieds
Encadrer/manager, bloc de preuve, rappel de lecture : **GABARIT intégral**. Aucun agent ne les produit — c'est ce qui garantit qu'ils ne varient ni ne disparaissent.

---

# CE QUI EXISTE ET N'EST PAS EXPLOITÉ

| Champ | Contenu | État |
|---|---|---|
| `sig_pilier_label` · `sig_filtre_val` · `sig_finalite` · `sig_resultat_ligne1/2` · `sig_recit` | la signature cognitive du bilan candidat | **VIDES pour les quatre bilans** — aucune étape ne les alimente |
| `cout1_titre/corps/verbatim` → `cout3` | les zones de coût personnelles | **VIDES pour les quatre bilans** |
| `cout_principal` · `cout_secondaire` | zones de coût rédigées | **renseignés chez C.**, vides chez R. |
| `combinaison` · `reserves_globales` | textes rédigés | disponibles, non employés |
| `filtre_finalite` · `filtre_profil_calibrage` | à quoi sert le réglage · « Éclaireur de chemins » | disponibles, non employés |

---

# LES QUATRE BILANS EN BASE

| Identifiant | Socle | Créé |
|---|---|---|
| `pivar_1762094675215_77bg53iz0` | Création de solutions | 25/06 |
| `pivar_1762101819725_oy1yr4h28` | Analyse et diagnostic | 25/06 |
| `pcc_1771077635499_gg1cj7z1q` | Analyse et diagnostic | 25/06 |
| `pcc_1786375017158_p3caz8zma` | Création de solutions | 12/08 · marqué **test** |

---

---

# VÉRIFICATION CROISÉE — deux candidats

Cet inventaire a été établi sur **M. R.** (socle Création de solutions) puis **vérifié sur Mme C.** (socle Analyse et diagnostic), qui n'avait servi à rien de sa construction.

| Élément | R. | C. |
|---|---|---|
| `pilier_socle_label` | Création de solutions | **Analyse et diagnostic** ✅ |
| `filtre` | rempli | **rempli** ✅ |
| `civilite` | Monsieur | **Madame** ✅ |
| `filtre_gestes` → `fait` | paragraphes | **paragraphes** ✅ |
| `explication_courte_ch4` | une phrase par geste | **une phrase par geste** ✅ |
| `bloc_tres_souvent_candidat` | rempli | **rempli** ✅ |
| `registres` | 2 registres | **3 registres + synthèse transversale** ✅ |
| `sig_recit` | vide | **vide** ✅ |
| `cout_principal` | vide | **rempli** ⚠️ *(varie selon le candidat)* |

**Aucun écart de structure entre les deux.** Les champs sont les mêmes, aux mêmes endroits, avec les mêmes natures de contenu.

---

*Établi le 24/08/2026 par lecture directe en base, sur deux candidats de socles différents. Chaque champ cité a été lu ; aucune absence n'est affirmée sans vérification.*
