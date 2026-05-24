# MÉCANIQUE DES AD HOC — DOCUMENT DE RÉFÉRENCE
## Comment les circuits ad hoc naissent, vivent et deviennent officiels

**Version** : 1.0
**Date** : 24 mai 2026
**Statut** : document de consultation pour la CTO. À mettre à jour en cas d'évolution du code de promotion.
**Périmètre** : explique le fond doctrinal ET la tuyauterie technique pour permettre à la CTO de faire évoluer le mécanisme en connaissance de cause.

---

## SOMMAIRE

1. Les 2 tables et leur rôle respectif
2. Ce que l'agent Phase 1 reçoit dans son payload
3. Le cycle de vie d'un ad hoc — les 5 statuts
4. Comment un ad hoc se crée en base (cas création)
5. Comment un ad hoc s'incrémente en base (cas mise à jour)
6. Les 2 seuils de promotion et leur logique
7. Le passage d'ad hoc à officiel — pourquoi c'est manuel
8. Routines de surveillance et procédures CTO
9. Pour faire évoluer le mécanisme : où toucher, quoi changer
10. Annexes — états de la base au 24 mai 2026 et identifiants techniques

---

## 1. LES 2 TABLES ET LEUR RÔLE RESPECTIF

Le projet Profil-Cognitif Sib repose sur **deux tables référentielles distinctes** dans la base Airtable `appgghhXjYBdFRras`. Leur rapport est asymétrique et c'est essentiel pour comprendre le mécanisme.

### REFERENTIEL_CIRCUITS — le patrimoine officiel
- Contient les **75 circuits cognitifs validés** (15 par pilier, P1 à P5).
- Identifiés par `circuit_id` au format `PxCy` (ex : `P5C12`).
- **Modifiée uniquement par la CTO**, manuellement, via l'interface Airtable.
- Le pipeline ne l'écrit jamais. Il ne fait que la lire.
- C'est le patrimoine doctrinal stable du projet.

### REFERENTIEL_CIRCUITS_CANDIDATS — le sas des ad hoc
- Contient les **ad hoc créés par l'agent Phase 1** quand un geste cognitif ne matche pas un officiel.
- Identifiés par leur `nom_propose` (chaîne de caractères, ex : *"Endurance passive en attente de clôture contrainte"*).
- **Écrite automatiquement par le pipeline** via la fonction `upsertCircuitAdHoc()` du fichier `airtableService.js`.
- **Lue par la CTO** pour décider de la promotion (ou pas) vers REFERENTIEL_CIRCUITS.
- C'est le sas. Les ad hoc y vivent jusqu'à promotion manuelle (ou rejet, ou fusion).

### Asymétrie fondamentale
- Le pipeline écrit dans CANDIDATS, jamais dans CIRCUITS.
- La CTO écrit dans CIRCUITS quand elle promeut un ad hoc qu'elle a validé.
- La CTO peut aussi écrire dans CANDIDATS pour changer un statut (REJETE, PROMU_MANUEL, FUSIONNE).
- Cette asymétrie est volontaire : **le patrimoine doctrinal officiel reste sous contrôle humain**.

---

## 2. CE QUE L'AGENT PHASE 1 REÇOIT DANS SON PAYLOAD

Quand l'agent T2 Phase 1 démarre l'attribution pour un candidat, son payload contient (entre autres) deux blocs distincts qui correspondent aux 2 tables :

```json
{
  "candidat_id": "pivar_xxx",
  "civilite": "Monsieur Rémi",
  "referentiel_75_par_pilier": {
    "P1": [{ "circuit_id": "P1C1", "circuit_nom": "...", "geste": "..." }, ...],
    "P2": [...],
    "P3": [...],
    "P4": [...],
    "P5": [...]
  },
  "circuits_ad_hoc_existants": {
    "P1": [],
    "P2": [],
    "P3": [],
    "P4": [],
    "P5": [
      { "nom_propose": "Élimination délibérée des données après résolution", "statut": "PROMU_AUTO", "occurrences": 1, ... },
      { "nom_propose": "Exécution contrainte en aversion déclarée", "statut": "PROMU_AUTO", ... },
      { "nom_propose": "Endurance passive en attente de clôture contrainte", "statut": "PROMU_AUTO", ... }
    ]
  },
  "lignes_t1": [...],
  "responses_t1": [...],
  "mapping_doctrinal_P1": "...markdown du mapping...",
  "mapping_doctrinal_P2": "...",
  "mapping_doctrinal_P3": "...",
  "mapping_doctrinal_P4": "...",
  "mapping_doctrinal_P5": "..."
}
```

L'agent voit donc **les 2 tables référentielles**, groupées par pilier. Mais avec une nuance importante :

### Filtrage des ad hoc envoyés à l'agent

La fonction qui charge `circuits_ad_hoc_existants` ne renvoie **que les ad hoc actifs**, c'est-à-dire ceux avec statut :
- `EN_ATTENTE` (en attente d'accumulation d'occurrences ou de décision CTO)
- `PROMU_AUTO` (seuil de 3 atteint sur le même pilier, en attente de promotion manuelle CTO)

Les ad hoc avec statut `PROMU_MANUEL`, `REJETE` ou `FUSIONNE` sont **exclus du payload**. Logique :
- `PROMU_MANUEL` = déjà passé en officiel par la CTO → existe désormais dans REFERENTIEL_CIRCUITS. Le citer comme ad hoc serait redondant.
- `REJETE` = la CTO a dit non. On ne le ressort plus pour éviter qu'il soit recréé.
- `FUSIONNE` = absorbé dans un autre ad hoc ou un officiel. Doublon évité.

### Conséquence pratique
L'agent voit donc l'ensemble `{75 officiels + ad hoc vivants}`. Il choisit dans cet ensemble pour chaque geste à attribuer. S'il ne trouve rien, il a la possibilité de créer un nouvel ad hoc, qui démarrera son propre cycle de vie.

---

## 3. LE CYCLE DE VIE D'UN AD HOC — LES 5 STATUTS

Un ad hoc passe par un parcours strict. Le champ `statut` de REFERENTIEL_CIRCUITS_CANDIDATS prend l'une des 5 valeurs suivantes :

| Statut | Sens | Qui le pose | Conséquence pour le pipeline |
|---|---|---|---|
| `EN_ATTENTE` | Création initiale OU en cours d'accumulation | Pipeline (création) | Visible dans le payload des futurs candidats |
| `PROMU_AUTO` | Seuil de 3 occurrences sur le même pilier atteint | Pipeline (automatique) | Toujours visible dans le payload — CTO doit décider |
| `PROMU_MANUEL` | CTO a créé le circuit officiel correspondant | CTO (manuel) | Plus visible dans le payload — l'officiel le remplace |
| `REJETE` | CTO a refusé la promotion | CTO (manuel) | Plus visible dans le payload — ne sera plus recréé |
| `FUSIONNE` | CTO a fusionné avec un autre circuit | CTO (manuel) | Plus visible dans le payload |

Schéma du cycle de vie :

```
[Geste candidat sans match officiel ni ad hoc existant]
                    ↓
              upsertCircuitAdHoc()
                    ↓
         ┌─────────────────────────┐
         │     EN_ATTENTE          │  ← création, occurrences = 1
         │                         │
         │ (Autre candidat verbalise│
         │  le même nom_propose)   │  ← incrémentation occurrences
         └─────────────────────────┘
                    ↓
        occurrences_pilier_principal ≥ 3 ?
                    ↓
        ┌───────────┴───────────┐
        OUI                     NON
        ↓                       ↓
   PROMU_AUTO              EN_ATTENTE  (sauf cas B)
   (automatique)           (on attend)
        ↓
   [Décision CTO]
        ↓
   ┌────┼────┬─────────────┐
   ↓    ↓    ↓             ↓
 Adopter  Refuser  Fusionner  Ne rien faire
   ↓    ↓    ↓             ↓
 PROMU_  REJETE  FUSIONNE   reste PROMU_AUTO
 MANUEL                     (visible aux candidats)
```

---

## 4. COMMENT UN AD HOC SE CRÉE EN BASE (CAS CRÉATION)

Quand l'agent Phase 1 a décidé que le geste cognitif ne matche **aucun** des 75 officiels ni **aucun** des ad hoc existants, il forge :
- un `nom_propose` (40-60 caractères, forme nominale, doctrinalement transposable)
- un `geste_propose` (1-2 phrases factuelles à la 3e personne)
- une liste `circuits_proches_envisages` (3 circuits officiels du pilier essayés en NUANCEE puis rejetés, avec raison doctrinale ≥ 80 caractères pour chaque)

Le code de Phase 1 appelle alors `upsertCircuitAdHoc()` du fichier `services/infrastructure/airtableService.js`.

Cette fonction cherche d'abord si un record avec le même `nom_propose` existe déjà. **S'il n'existe pas**, le code crée un nouveau record avec les valeurs suivantes :

| Champ Airtable | Valeur posée à la création |
|---|---|
| `nom_propose` | Ce que l'agent a forgé |
| `pilier_principal` | Le pilier du geste (P1, P2, P3, P4 ou P5) |
| `geste_propose` | La description que l'agent a forgée |
| `occurrences_pilier_principal` | **1** (en dur) |
| `occurrences_autres_piliers` | **0** (en dur) |
| `candidats_concernes` | L'ID du candidat courant (ex : `pivar_xxx`) |
| `questions_concernees` | Une entrée du type `"P5Q15 ANIMAL_2 - pivar_xxx"` |
| `verbatim_source_premier` | Le verbatim brut qui a déclenché la création |
| `circuits_proches_envisages` | Les 3 circuits rejetés avec raisons |
| `statut` | **`EN_ATTENTE`** (verrouillé en dur dans le code, ligne 1353) |
| `date_premiere_detection` | Timestamp du jour (ISO) |
| `date_derniere_mise_a_jour` | Timestamp du jour (ISO) |

**Point essentiel** : aucun ad hoc n'est **jamais** créé directement avec un statut autre que `EN_ATTENTE`. Le code l'interdit. Si tu vois en base un ad hoc avec statut `PROMU_AUTO` et `occurrences = 1`, c'est qu'il a été modifié à la main par quelqu'un (typiquement toi pendant des tests), pas par le code.

---

## 5. COMMENT UN AD HOC S'INCRÉMENTE EN BASE (CAS MISE À JOUR)

Quand l'agent Phase 1 traite un nouveau candidat et que ce candidat verbalise un geste qui **correspond exactement à un ad hoc déjà en base** (match strict sur le `nom_propose`), le code prend trois décisions successives.

### Décision 1 — Le statut actuel autorise-t-il l'incrémentation ?

Si le statut existant est `PROMU_AUTO`, `PROMU_MANUEL`, `REJETE` ou `FUSIONNE`, le code **ne fait rien**. L'ad hoc est considéré comme déjà tranché. Aucune incrémentation, aucun update. Dans les logs tu vois `nb_ad_hoc_skipped` augmenter.

Seul le statut `EN_ATTENTE` autorise l'incrémentation.

### Décision 2 — Le candidat courant est-il déjà dans la liste ?

Si l'ID du candidat courant figure déjà dans `candidats_concernes`, le code **ne fait rien**. C'est volontaire : un seul candidat qui mentionnerait le même geste à trois questions différentes ne doit pas faire sauter le seuil de promotion à lui tout seul. La promotion vient de la **convergence inter-candidats**, pas intra-candidat.

### Décision 3 — Incrémentation selon le pilier

Si le candidat est nouveau et le statut EN_ATTENTE, le code :
- Détermine si le `pilier_courant` du geste = `pilier_principal` du record
- Si oui (même pilier) → `occurrences_pilier_principal` est incrémenté de 1
- Si non (autre pilier) → `occurrences_autres_piliers` est incrémenté de 1
- Ajoute l'ID candidat dans `candidats_concernes` (multi-ligne)
- Ajoute la question dans `questions_concernees` (multi-ligne)
- Met à jour `date_derniere_mise_a_jour`

Puis vérifie si l'un des deux seuils de promotion est atteint (voir section suivante).

---

## 6. LES 2 SEUILS DE PROMOTION ET LEUR LOGIQUE

Le code définit deux constantes en dur (lignes 1085-1086 de `airtableService.js`) :

```javascript
const PROMOTION_THRESHOLD_SAME_PILLAR  = 3;   // Cas A
const PROMOTION_THRESHOLD_MULTI_PILLAR = 5;   // Cas B
```

### Cas A — Promotion automatique sur même pilier (seuil 3)

**Condition** : `occurrences_pilier_principal ≥ 3`
**Action** : le statut bascule en `PROMU_AUTO`. Un log warning est généré dans Render :

```
🎯 PROMOTION AUTOMATIQUE DÉCLENCHÉE (Cas A : ≥3 même pilier)
nom_propose: "Endurance passive en attente de clôture contrainte"
pilier_principal: "P5"
occurrences_pilier_principal: 3
candidats_concernes_count: 3
action_requise: "CTO doit créer le circuit officiel dans REFERENTIEL_CIRCUITS sous P{X}·C{16+}"
```

**Sens doctrinal** : trois candidats distincts ont verbalisé le même geste cognitif sur le même pilier. C'est un signal solide que le geste existe vraiment dans la cognition humaine et mérite d'entrer dans le patrimoine officiel.

### Cas B — Arbitrage manuel multi-piliers (seuil 5 + multi-piliers)

**Condition** : `(occurrences_pilier_principal + occurrences_autres_piliers) ≥ 5` ET `occurrences_autres_piliers > 0`
**Action** : le statut **reste** `EN_ATTENTE` (volontairement, parce que le pilier de rattachement est ambigu). Un log warning est généré :

```
⚠️ ARBITRAGE MANUEL REQUIS (Cas B : ≥5 total multi-piliers)
nom_propose: "..."
pilier_principal: "P5"  (le pilier où le record a été créé en premier)
occurrences_pilier_principal: 3
occurrences_autres_piliers: 2
action_requise: "CTO doit décider du pilier de rattachement définitif
                 et basculer manuellement en PROMU_MANUEL"
```

**Sens doctrinal** : cinq candidats ont verbalisé le geste, mais il a été attribué à des piliers différents selon les cas. C'est ambigu, et le code ne se sent pas autorisé à trancher tout seul. C'est à toi de décider quel est le pilier de rattachement définitif.

### Cas C — Sous les deux seuils

Si ni A ni B ne sont remplis, le statut reste `EN_ATTENTE` et on attend que d'autres candidats verbalisent éventuellement le geste.

---

## 7. LE PASSAGE D'AD HOC À OFFICIEL — POURQUOI C'EST MANUEL

**Le code de production n'écrit JAMAIS dans REFERENTIEL_CIRCUITS.** C'est verrouillé.

Même quand un ad hoc atteint `PROMU_AUTO` (cas A), le code se contente d'**alerter** dans les logs Render. La création du record officiel correspondant te revient entièrement.

### Pourquoi cette décision d'architecture

Trois raisons :

1. **Protection du patrimoine doctrinal**. Un référentiel cognitif est un objet de connaissance précieux. Une fois entré, un circuit officiel devient une référence stable utilisée par tous les futurs runs. Le risque d'erreur ou de pollution est non-rattrapable. Le geste humain de validation finale est une assurance.

2. **Possibilité de reformulation**. Quand tu valides la promotion, tu peux retoucher le `nom_propose` ou le `geste_propose` que l'agent a forgé, pour les harmoniser stylistiquement avec les 15 officiels du pilier. Le code automatique ne saurait pas le faire avec ton œil d'experte.

3. **Numérotation maîtrisée**. Quand tu crées le record officiel dans REFERENTIEL_CIRCUITS, tu choisis le `circuit_id` (par exemple `P5C16` parce que les C1 à C15 existent déjà). Cette numérotation est ton choix doctrinal, pas un automatisme.

### La procédure manuelle pas à pas

Quand tu vois en base un ou plusieurs ad hoc avec statut `PROMU_AUTO`, voici la procédure :

**Étape 1 — Diagnostic**

Pour chaque ad hoc en `PROMU_AUTO`, tu examines :
- `nom_propose` — est-ce qu'il est bien formé doctrinalement ? (test du miroir : insère-le mentalement dans la liste des 15 officiels du pilier)
- `geste_propose` — la description est-elle conforme au style des officiels (3e personne, factuel, transposable) ?
- `circuits_proches_envisages` — les 3 rejets sont-ils doctrinalement solides ?
- `verbatim_source_premier` et `candidats_concernes` — qui l'a verbalisé et dans quel contexte ?

**Étape 2 — Décision**

Quatre options possibles :

| Décision | Conséquence |
|---|---|
| **Adopter** | Créer record dans REFERENTIEL_CIRCUITS + passer statut à `PROMU_MANUEL` |
| **Rejeter** | Passer statut à `REJETE` + remplir `motif_rejet` |
| **Fusionner** | Passer statut à `FUSIONNE` + indiquer cible de fusion |
| **Reformuler avant d'adopter** | Modifier le `nom_propose` puis adopter (cf ci-dessus) |

**Étape 3 — Si adopter, création du record officiel**

Dans REFERENTIEL_CIRCUITS :
- Créer un nouveau record
- `pilier` = `P5` (par exemple, selon le pilier_principal de l'ad hoc)
- `circuit_id` = `P5C16` (premier numéro libre dans le pilier)
- `circuit_nom` = copier ou reformuler le `nom_propose`
- `geste` = copier ou reformuler le `geste_propose`

**Étape 4 — Mise à jour de l'ad hoc**

Retourner dans REFERENTIEL_CIRCUITS_CANDIDATS sur le record promu :
- `statut` = `PROMU_MANUEL`
- `circuit_officiel_apres_promotion` = la référence du nouveau circuit officiel (ex : `P5C16`)

**Étape 5 — Vérification**

Au prochain run du pipeline, vérifier dans les logs Phase 1 :
- L'ad hoc promu n'apparaît plus dans `circuits_ad_hoc_existants` du payload (parce que filtré sur statut PROMU_MANUEL)
- Le nouveau circuit officiel apparaît dans `referentiel_75_par_pilier` (qui devient 76 puis 77, etc.)
- Les candidats qui verbalisent désormais ce geste l'attribuent en FRANCHE au circuit officiel (et non plus en AD_HOC)

---

## 8. ROUTINES DE SURVEILLANCE ET PROCÉDURES CTO

### Routine hebdomadaire ou mensuelle (selon volume)

**Vue Airtable conseillée n°1 — "Ad hoc à valider"**
- Filtre : `statut = PROMU_AUTO`
- Tri : `occurrences_pilier_principal` décroissant
- Champs visibles : `nom_propose`, `pilier_principal`, `occurrences_pilier_principal`, `candidats_concernes`, `geste_propose`, `circuits_proches_envisages`

**Vue Airtable conseillée n°2 — "Arbitrage requis (Cas B)"**
- Filtre : `statut = EN_ATTENTE` ET `occurrences_pilier_principal + occurrences_autres_piliers ≥ 5`
- Tri : par total occurrences décroissant
- Champs : tous les précédents + `occurrences_autres_piliers`

**Vue Airtable conseillée n°3 — "Historique"**
- Filtre : `statut` est l'un de [`PROMU_MANUEL`, `REJETE`, `FUSIONNE`]
- Sert au suivi historique et à la traçabilité.

### Surveillance des logs Render

Deux messages clés à surveiller (filtrable par `grep` dans les logs Render) :

- `"🎯 PROMOTION AUTOMATIQUE DÉCLENCHÉE"` → un ad hoc vient de basculer en PROMU_AUTO. À traiter dans ta prochaine session de validation.
- `"⚠️ ARBITRAGE MANUEL REQUIS"` → un cas B vient d'apparaître. Tu dois trancher le pilier de rattachement.

### Surveillance complémentaire

Dans les logs Phase 1, à chaque run de candidat :
- `nb_ad_hoc_nouveaux_crees` — combien d'ad hoc nouveaux ce candidat a fait naître
- `nb_ad_hoc_increment_principal` — combien d'ad hoc existants ont été incrémentés sur leur pilier principal
- `nb_ad_hoc_skipped` — combien d'ad hoc PROMU_AUTO réutilisés sans incrémentation

Signaux de dérive :
- Si `nb_ad_hoc_nouveaux_crees > 3` sur un seul candidat → suspect, vérifier la qualité doctrinale de la création.
- Si plusieurs candidats successifs créent le même `nom_propose` à quelques caractères près → la déduplication échoue, à analyser.

---

## 9. POUR FAIRE ÉVOLUER LE MÉCANISME — OÙ TOUCHER, QUOI CHANGER

Cette section te liste les points de levier exacts dans le code, au cas où tu voudrais modifier le comportement.

### 9.1 — Changer les seuils de promotion

**Fichier** : `services/infrastructure/airtableService.js`
**Lignes** : 1085-1086

```javascript
const PROMOTION_THRESHOLD_SAME_PILLAR  = 3;
const PROMOTION_THRESHOLD_MULTI_PILLAR = 5;
```

Tu peux passer le seuil même-pilier à 4 ou 5 si tu veux que la promotion automatique soit plus exigeante. Tu peux baisser à 2 si tu veux qu'elle soit plus rapide. Le coût : une modification de cette ligne suffit, pas besoin de toucher au prompt.

**Attention** : si tu modifies pendant qu'il y a déjà des ad hoc dans le sas avec occurrences = 3, le prochain run risque de promouvoir un ad hoc qui était en cours d'observation. Préférer modifier quand le sas est en état stable.

### 9.2 — Ajouter ou retirer un statut

**Fichier** : `services/infrastructure/airtableService.js`
**Lignes** : 1219 (liste des statuts qui bloquent l'incrémentation), 1098 (statut par défaut du filtre)

Tu peux par exemple créer un statut `EN_OBSERVATION` (intermédiaire entre EN_ATTENTE et PROMU_AUTO) pour permettre une revue avant promotion automatique. Cela impliquerait :
1. Ajouter l'option dans Airtable sur le champ `statut`
2. Modifier la liste ligne 1219 pour inclure le nouveau statut comme "bloquant"
3. Modifier la fonction `getCircuitsAdHocByStatut` ou son appel pour décider si `EN_OBSERVATION` apparaît ou pas dans le payload

### 9.3 — Filtrer plus finement les ad hoc envoyés à l'agent

**Fichier** : `services/etape1/agentT2_phase1_attribution_Service.js`
**Lignes** : autour de la construction du `circuits_ad_hoc_existants` (recherche par grep)

Tu peux par exemple décider de n'envoyer à l'agent que les ad hoc avec occurrences ≥ 2 (pour éviter qu'il les considère comme déjà acquis dès la première mention). Modification rapide.

### 9.4 — Changer la doctrine de création (mappings et prompt)

**Fichiers** : `new-prompts/doctrine/mapping_P{1-5}.md` et `prompts/etape1/etape1_t2_phase1_attribution.txt`

C'est là que tu modifies :
- Les paires à discriminer dans chaque pilier
- Les zones de manque autorisées
- Les règles de nommage
- Les arbres de décision
- Les 5 règles absolues du prompt v1.1

Modification possible sans toucher au code. Le service les recharge à chaque appel.

### 9.5 — Ajouter une validation automatique (validateAdHocCreation)

Idée prévue mais non implémentée : ajouter dans le code une fonction qui vérifie le format du `nom_propose` avant `upsertCircuitAdHoc` (longueur, forme nominale, pas de prénom, pas de verbatim). Ce serait un garde-fou mécanique en plus de la discipline du prompt.

**Fichier** : `services/etape1/agentT2_phase1_attribution_Service.js`
**Quand** : avant l'appel à `upsertCircuitAdHoc()`

À envisager si tu observes des ad hoc mal formés malgré le prompt v1.1.

### 9.6 — Anti-doublon sémantique

Idée prévue mais non implémentée : pour éviter qu'un même geste soit créé sous deux noms légèrement différents (ex : *"Élimination délibérée des données"* et *"Suppression volontaire après résolution"*), un appel API à Claude Haiku peut comparer chaque nouveau `nom_propose` aux ad hoc existants.

**Coût** : ~0.002$ par création d'ad hoc.

À envisager si tu observes des doublons sémantiques.

### 9.7 — Promotion semi-automatique (option avancée)

Si à terme la confiance dans le mécanisme automatique est élevée, on pourrait imaginer que la promotion PROMU_AUTO crée **directement** le record officiel dans REFERENTIEL_CIRCUITS (au lieu de seulement logger l'alerte). Ce serait une évolution lourde qui touche au principe d'asymétrie du système (section 1). À ne pas faire avant d'avoir accumulé une statistique de 50+ promotions montrant que le code ne se trompe jamais sur la qualité.

---

## 10. ANNEXES

### 10.1 — État de la base au 24 mai 2026

**REFERENTIEL_CIRCUITS** : 75 records officiels + 1 record fantôme (`rech9N78hUUzUFmrz`, vide, créé le 22/05/2026 par erreur — à supprimer manuellement).

**REFERENTIEL_CIRCUITS_CANDIDATS** : 3 records, tous en PROMU_AUTO, tous sur pilier P5, tous avec `occurrences_pilier_principal = 1`.

| nom_propose | pilier | occ. | circuit_officiel_apres_promotion (anticipé) |
|---|---|---|---|
| Élimination délibérée des données après résolution | P5 | 1 | P5C16 |
| Exécution contrainte en aversion déclarée | P5 | 1 | P5C17 |
| Endurance passive en attente de clôture contrainte | P5 | 1 | P5C18 |

**Note importante** : ces 3 ad hoc sont en PROMU_AUTO avec occurrences = 1 parce qu'ils ont été modifiés manuellement le 21 mai pendant des tests, **pas** parce que le code aurait promu à occurrences = 1. Le code respecte sa propre doctrine du seuil 3.

Le champ `circuit_officiel_apres_promotion` est rempli (P5C16, P5C17, P5C18) mais **les records officiels correspondants n'existent pas encore dans REFERENTIEL_CIRCUITS**. Il s'agit d'une numérotation anticipée. Quand tu décideras de promouvoir ces 3 ad hoc (ou pas), il faudra :
1. Soit créer les 3 records officiels (P5C16, P5C17, P5C18) dans REFERENTIEL_CIRCUITS et passer les statuts à PROMU_MANUEL
2. Soit rejeter et passer les statuts à REJETE

### 10.2 — Identifiants techniques utiles

**Base Airtable** : `appgghhXjYBdFRras`

**Tables** :
- REFERENTIEL_CIRCUITS : `tbl???` (à compléter en consultant Airtable)
- REFERENTIEL_CIRCUITS_CANDIDATS : `tbl???` (à compléter en consultant Airtable)

**Champs clés de REFERENTIEL_CIRCUITS_CANDIDATS** (extraits des records existants) :
- `nom_propose` : `fldfFV0F878K5TeI5`
- `pilier_principal` : `flddidBYNw23L32LN`
- `geste_propose` : `fldSEi5aVsw0zFTSU`
- `occurrences_pilier_principal` : `fldZt2lGIIUN6Z68K`
- `occurrences_autres_piliers` : `fldiPbu2c8cLY6wRs`
- `statut` : `fldd0CVG9YRrTQwj3`
- `verbatim_source_premier` : `fld0MYA18SXngzwFz`
- `circuits_proches_envisages` : `fldoNY0qoVhA5c7Jh`
- `candidats_concernes` : `fldyxdDDkQTyClhSi`
- `questions_concernees` : `fldiLQOTpvuari0yR`
- `circuit_officiel_apres_promotion` : `fldSe5gK7t8KO7LWb`
- `date_premiere_detection` : `fldEpckt6kvaupIzw`
- `date_derniere_mise_a_jour` : `fldFm1geBeL0TEYfD`

### 10.3 — Fichiers du projet impactés par ce mécanisme

| Fichier | Rôle |
|---|---|
| `services/infrastructure/airtableService.js` | Contient la fonction `upsertCircuitAdHoc` (lignes 1043-1390) et les seuils de promotion |
| `services/etape1/agentT2_phase1_attribution_Service.js` | Construit le payload de l'agent, injecte les mappings doctrinaux |
| `prompts/etape1/etape1_t2_phase1_attribution.txt` | Prompt de l'agent (section 5 = doctrine ad hoc v1.1) |
| `new-prompts/doctrine/mapping_P{1-5}.md` | Mappings doctrinaux par pilier (lus à l'exécution) |
| `new-prompts/doctrine/QUESTIONS_DOCTRINALES_OUVERTES.md` | Registre des questions doctrinales non tranchées |
| `new-prompts/doctrine/MECANIQUE_AD_HOC.md` | Ce document |

### 10.4 — Historique des évolutions du mécanisme

| Date | Version | Changement |
|---|---|---|
| 21/05/2026 | v10.7-v10.9 | Mise en production du mécanisme automatique (création EN_ATTENTE + promotion auto seuil 3) |
| 23/05/2026 | v11.0 | Ajout de l'injection des mappings doctrinaux dans le payload Phase 1 + prompt v1.1 avec section 5 doctrine ad hoc |
| 24/05/2026 | — | Rédaction de ce document de référence |

---

## 11. SYNTHÈSE — LES POINTS À RETENIR ABSOLUMENT

Si tu ne dois retenir que dix lignes, ce sont celles-ci :

1. Deux tables référentielles : **REFERENTIEL_CIRCUITS** (officiels, contrôle CTO) et **REFERENTIEL_CIRCUITS_CANDIDATS** (sas des ad hoc, écrit par le pipeline).
2. L'agent Phase 1 lit les **deux** dans son payload, groupées par pilier. Il choisit dans cet ensemble.
3. Création d'ad hoc : statut **toujours EN_ATTENTE** au départ, occurrences = 1. Le code l'impose.
4. Incrémentation des occurrences seulement si **nouveau candidat** sur un ad hoc en **EN_ATTENTE**.
5. Promotion automatique en **PROMU_AUTO** dès que `occurrences_pilier_principal ≥ 3`.
6. Arbitrage manuel signalé en log dès que `total ≥ 5` et multi-piliers.
7. **Le code ne touche jamais à REFERENTIEL_CIRCUITS**. Toute promotion vers le patrimoine officiel est manuelle.
8. Pour faire évoluer les seuils : modifier deux constantes en haut de `airtableService.js`.
9. Pour faire évoluer la doctrine de création : modifier les mappings `.md` et le prompt — pas besoin de toucher au code.
10. Pour ajouter des garde-fous mécaniques (validation format, anti-doublon sémantique) : à envisager si la qualité empirique se dégrade.

---

**Fin du document. À mettre à jour si une évolution touche les seuils, les statuts ou l'architecture d'injection.**
