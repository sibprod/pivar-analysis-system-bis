# 12 · DOCTRINE DE LA PREUVE + FICHE DE MISSION — AGENT GRILLE RÉFÉRENT
## Gravé le 19/08/2026 · à ne plus remettre en question sans décision expresse de la garante

---

# PARTIE A — DOCTRINE GRAVÉE

## D-PREUVE ✅ PREUVE TRACÉE, PAS PREUVE EXPOSÉE

**Décision de la garante, 19/08/2026.** Les verbatims du test ne figurent PAS dans la grille référent.

### Le raisonnement, en trois temps

**1 · Ce que la réglementation exige réellement.** Le règlement européen (emploi = usage à haut risque) et la CNIL exigent que l'analyse soit **circonstanciée** — située, argumentée, non générique — et **traçable** : chaque affirmation reliée à une preuve conservée et auditable. **Ils n'exigent pas que l'employeur voie la matière brute.**

**2 · Ce que les verbatims exposent en réalité.** Le test se déroule dans des situations de la vie quotidienne. Les réponses contiennent donc, par construction, de la vie privée. Vérifié sur le cas de M. R. : un trouble du sommeil (**donnée de santé**), trois adolescents (**situation familiale**), « ce n'est pas dans mon budget mais je ne veux pas leur dire » (**situation financière**). Transmettre cela à un employeur potentiel :
- échoue sur la **minimisation** (RGPD art. 5.1.c — seulement ce qui est nécessaire à la finalité) ;
- ouvre un risque de **discrimination indirecte** ;
- dépasse le consentement du candidat, qui a accepté un test en situations de vie, pas la transmission de ses phrases privées à un recruteur.

**3 · La règle qui en découle.**

| Destination | Ce qui y figure |
|---|---|
| **Bilan interne (laboratoire)** | Verbatims intégraux avec leur référence de question. C'est là que la preuve vit et s'audite. |
| **Bilan du candidat** | Ses verbatims — ce sont ses mots, il en est propriétaire. |
| **Grille référent** | Le constat circonstancié + sa traduction professionnelle + **la mention de traçabilité** : « chaque constat est adossé à des réponses écrites conservées ; le candidat en dispose et peut les produire ». **Aucun verbatim.** |

### Corollaire — les noms de situations tombent aussi
« Sur la panne », « sur le week-end », « l'animal », « le sommeil » ne sortent jamais vers le référent : ce sont à la fois la recette (D95) et le quotidien du candidat. Ils sont **remplacés par leur équivalent professionnel** via `REFERENTIEL_TEST_EQUIVALENT_PRO`.

### Ce qui rend l'analyse circonstanciée sans exposer
Pour chaque élément affiché : **le constat** · **quand cela s'active** (le déclencheur, traduit en situation de travail) · **ce qu'il ne faut pas en attendre** (la limite honnête). Situé, argumenté, opposable — sans une phrase privée.

---

## D-ENCADRER/MANAGER ✅ LA MÉTAPHORE SPORTIVE — DEUX RÔLES DISTINCTS

**Formulation de la garante, 19/08/2026**, à écrire proprement dans tous les supports référents :

- **ENCADRER — le rôle du directeur technique.** Il organise la saison, prépare les conditions de la performance, sécurise les moyens et la logistique, tient le calendrier et les échéances. Il fait avancer le travail collectif : que tout soit en place pour que l'équipe puisse jouer.
- **MANAGER — le rôle de l'entraîneur.** Il connaît la façon de jouer de chacun, développe les qualités propres de chaque joueur, compose les talents pour qu'ils servent ensemble l'objectif. **Jamais il ne descend sur le terrain jouer à la place d'un joueur.**

C'est la différence entre les deux : **l'un prépare le cadre et les moyens, l'autre fait grandir les personnes à l'intérieur de ce cadre.** Les deux sont nécessaires ; ils ne mobilisent pas les mêmes capacités ; ils s'évaluent séparément.

---

# PARTIE B — FICHE DE MISSION · AGENT GRILLE RÉFÉRENT

## Doctrine applicable (relue au journal, 19/08)
- **D02 — autonomie graduée** : lecture et enrichissement en autonomie ; **toute sortie vers l'extérieur passe par une validation humaine** (statut Brouillon → Validé).
- **D95 — la recette ne se donne pas** : aucun comptage, aucun régime, aucun code de circuit, aucun nom de scénario, aucun seuil, aucun nom d'agent ou d'étape.
- **D115 — un agent, une mission concentrée.**
- **D119 — lire avant d'écrire** : la source réelle est lue avant toute production ; un geste à la fois, numéroté, avec son contrôle.
- **D123 / D125 — vérification à destination, trois niveaux** : écrite → relue → à destination.
- **D-PREUVE** (ci-dessus) : preuve tracée, pas preuve exposée.
- **Règle de lecture** : toute extraction est filtrée sur `candidat_id`, jamais sur le contenu. *(Jurisprudence : une recherche par mot-clé a remonté le record d'un autre candidat — il a failli lui être attribué.)*
- **Interdit de supposer** : ce qui n'est pas lu n'est pas écrit ; pas de mention « à vérifier » dans un livrable.

## Entrées de l'agent
| Source | Ce qu'il y prend |
|---|---|
| `ETAPE1_T3_BILAN` | `pilier_socle_label` · `filtre` · `filtre_gestes` (JSON : *fait* et *dit* par geste) · `ch3_signal_registres` |
| `ETAPE1_T3_PILIER` (5 lignes) | `pilier_role_label` · `pilier_label` · `pilier_mode` · `synth_bloc_tres_souvent_candidat` |
| `ETAPE1_T2_CIRCUITS_POURBILAN` / `ETAPE1_3_BILAN_CIRCUIT` | narrations de gestes des piliers hors socle |
| `RESPONSES_ETAPE2_ EXCELLENCE` (4 lignes) | `synthese` · `declencheur` · `gradient` · `niveau_global` · `pattern` |
| `ETAPE2_BILAN4EXCELLENCES` | `portrait_un_mot` · `combinaison` · densités par dimension · `reserves_globales` (lecture, pas affichage) |
| `BILAN_DESALIGNEMENT` | référentiel générique par outil : *surdéploiement*, *injonctions*, *impacts* — les 5 outils sont couverts |
| `REFERENTIEL_TEST_EQUIVALENT_PRO` | **clé de traduction obligatoire** : 25 lignes, contexte × outil → équivalent professionnel |

## Ce que l'agent EXPORTE (mot pour mot, seule la personne change)
Le réglage du socle · les rôles, libellés et manières des cinq outils · les cinq synthèses « ce que ces gestes établissent » · les narrations de gestes (*fait*) · le portrait en un mot.
**Règle d'export** : longueur préservée, aucune condensation, aucune reformulation. Seules deux opérations sont autorisées : transposition de personne (« vous » → « il/elle », accordé par la civilité) et **retrait de la mécanique** (comptages, noms de scénarios) avec substitution par l'équivalent professionnel.

## Ce que l'agent PRODUIT
1. **Les titres de gestes**, en langage professionnel — un acte décrit, jamais une formule imagée, jamais un libellé du référentiel (D95).
2. **La transposition des dimensions** — trois temps imposés : le constat · quand cela s'active · ce qu'il ne faut pas en attendre. Le fond reste intégral, la mécanique disparaît.
3. **La sélection des points de vigilance** — dans le référentiel générique, **ne retenir que les items accrochés à un geste réel du candidat**, chacun traduit en situation de travail via le référentiel d'équivalence. Généraux et spécifiques.
4. **Les questions de vérification** — une par point de vigilance retenu, jamais inventée hors de ce lien, accompagnée de « ce que la réponse indique » (le bon signe ET le signe contraire).

## Ce que l'agent N'ÉCRIT JAMAIS
Aucun verbatim · aucun nom de situation du test · aucun comptage, seuil, régime, densité, code de circuit · aucun libellé du référentiel de circuits · aucune étiquette de personnalité · aucun terme disqualifiant sur la personne · aucune dimension non établie présentée comme un manque.

## Sortie attendue
Un objet structuré par bloc, chaque élément portant **sa nature** (export / produit / gabarit) et **son champ source**. La grille est ensuite rendue avec ces marqueurs en interne, sans eux en production.

## Contrôles avant validation
1. Aucun verbatim, aucun nom de scénario, aucun chiffre de mesure dans la sortie.
2. Chaque texte marqué « export » est identique à la source, à la personne près.
3. Chaque question de vérification est rattachée à un point de vigilance nommé.
4. Chaque point de vigilance est rattaché à un geste réel du candidat.
5. Les dimensions affichées sont celles qui sont établies ; les autres ne figurent pas.
6. Vérification à destination (D125) : la sortie est lue là où le référent la lira.

---

*Gravé le 19/08/2026. Ces deux doctrines — preuve tracée et métaphore des deux rôles — ne se rediscutent pas : elles s'appliquent.*

---

# PARTIE C — RÈGLES DE PRODUCTION GRAVÉES (19/08, second temps)

## R1 ✅ LES TITRES DE GESTES SE DÉRIVENT, ILS NE S'INVENTENT PAS

**Problème posé par la garante :** plus on réécrit, plus on augmente le risque d'erreurs de libellés au fil des générations. Question : de quelle source l'agent tire-t-il les gestes ?

**Sources disponibles et pourquoi elles ne conviennent pas :**
| Source | Nature | Pourquoi elle est écartée |
|---|---|---|
| `circuit_nom_clair` du référentiel de circuits | stable, professionnel, zéro dérive | **c'est la recette** — libellés exclus (D95) |
| Le titre parlé du bilan candidat | déjà produit | registre simplifié (« gadget » en contexte pro), et c'est déjà une production |
| Un titre écrit librement par l'agent | adaptable | **une génération nouvelle à chaque bilan = dérive garantie** |

**RÈGLE : le titre est DÉRIVÉ MÉCANIQUEMENT de la narration source.**
Le champ `fait` (JSON `filtre_gestes`, et équivalents des autres piliers) commence par la proposition principale, suivie de deux-points ou d'un tiret. **Cette première proposition EST le titre**, mise à l'infinitif.

- *« Vous menez de front plusieurs raisonnements distincts : vous identifiez des options… »* → **Mener de front plusieurs raisonnements distincts**
- *« Vous ne repartez pas de zéro : une tentative déjà faite… »* → **Ne pas repartir de zéro**
- *« Vous cherchez délibérément ce qui n'est pas la voie évidente : … »* → **Chercher ce qui n'est pas la voie évidente**

**C'est de l'extraction, pas de la production.** Conséquences : le titre est professionnel puisque la narration l'est · il est identique d'une génération à l'autre · il ne peut pas contredire le contenu puisqu'il en est la première phrase. **Zéro invention, zéro dérive.**

---

## R2 ✅ LA TRANSPOSITION TEST → PRO SE FAIT PAR LIBELLÉS CANONIQUES FIGÉS

Même risque de dérive : si l'agent traduit librement, chaque bilan aura sa formulation.

**RÈGLE : quatre libellés canoniques, et rien d'autre.** À ajouter en colonne `libelle_pro_court` de `REFERENTIEL_TEST_EQUIVALENT_PRO`.

| Contexte | Libellé canonique — l'agent n'écrit rien d'autre |
|---|---|
| SOMMEIL | **un sujet de fond traité seul, sans urgence** |
| WEEKEND | **la conduite d'un projet collectif** |
| ANIMAL | **une mission confiée sur un périmètre mal connu, sous double consigne** |
| PANNE | **un incident sous contrainte de temps** |

**La substitution se fait par l'IDENTIFIANT DE QUESTION** (`P4Q7`, `P2Q11`…), qui donne le contexte de façon certaine — **jamais par la reconnaissance d'un mot dans la prose**. Contrôle de sortie : aucune autre expression que les quatre libellés ne doit apparaître à cet emplacement.

---

## R3 ✅ SITUATION ABSENTE DU RÉFÉRENTIEL — LA RÈGLE DE REPLI

**Cas prévus** (question de la garante : « et si le référentiel n'a pas la situation ? ») :
1. **Le test évolue** — un scénario ajouté ou modifié après le figement du référentiel.
2. **Le texte source nomme la situation autrement** — « la garde », « le chien » là où le référentiel connaît ANIMAL.
3. **Un bilan ancien** — passé sous une version antérieure du test.

**INTERDIT ABSOLU : inventer une traduction.** C'est le mécanisme qui a déjà coûté cher — combler un trou plutôt que le signaler.

**RÈGLE DE REPLI — ne jamais traduire à l'aveugle, ne jamais bloquer non plus :**
- **Situation non trouvée** → l'agent **retire la mention de situation** et conserve la phrase sans elle. Le constat survit toujours : *« Face à un incident sous contrainte de temps, il retient l'option garantie… »* devient *« Il retient l'option dont le résultat est garanti… »* **Le fond est intact, seule l'illustration disparaît.**
- **Et il consigne l'anomalie** dans un champ de sortie `situations_non_traduites` : la mention rencontrée + le bilan concerné.

**Trois effets** : la grille reste juste et livrable · aucune invention n'est possible · **le référentiel se complète par les remontées** — chaque anomalie signalée devient une ligne à ajouter, décidée par la garante, jamais par l'agent.

**SEUIL D'ALERTE** : si plus d'une mention sur cinq n'est pas traduite dans un même bilan, l'agent **ne valide pas sa sortie** et la remonte en révision humaine — signe que le bilan vient d'une version non couverte par le référentiel.

---

## R4 ✅ ENCADRER / MANAGER — TEXTE SOURCE, MÉTAPHORE EN ILLUSTRATION

Le texte du protocole fait foi. La métaphore sportive vient **après**, en illustration — elle n'est pas une définition et ne remplace jamais le texte source.

> **« Faire avancer le travail »** (ENCADREMENT, référentiel MÉTIER) : superviser et sécuriser l'exécution du travail collectif.
>
> *— le rôle du **directeur technique** : il est **expert du geste métier**. C'est de là que vient le mot « technique » : son autorité tient à la maîtrise du métier lui-même. Il transmet, il forme, il montre comment le geste se fait, il veille à la qualité de son exécution.*

> **« Révéler le potentiel de chacun »** (MANAGEMENT, référentiel PERSONNE) : faire grandir les personnes, partir de leur fonctionnement propre.
>
> *— le rôle de l'**entraîneur** : il définit l'objectif et la mission — du groupe comme de chacun —, il pose le cadre d'exécution de cette mission, il prend en compte les individualités, et il organise le travail de l'équipe et les synergies entre ses membres. Jamais il ne descend sur le terrain jouer à la place d'un joueur.*

**La différence tient en une phrase :** l'un est expert du **geste** et le transmet ; l'autre fixe l'**objectif**, tient le **cadre**, et compose avec les personnes telles qu'elles sont.

⚠️ **Formulation à ne pas dériver** (correction garante du 19/08) : ne jamais réduire le directeur technique à la logistique, aux moyens ou au calendrier — son territoire est le geste métier et sa transmission. Ne jamais réduire le manager au développement individuel seul — il porte d'abord l'objectif, le cadre et l'organisation collective.

---

## PRINCIPE GÉNÉRAL QUI RÉUNIT R1, R2 ET R3

**Moins l'agent écrit, moins il dérive.** Chaque fois qu'un contenu peut être *dérivé* d'une source plutôt que *produit*, il est dérivé. Chaque fois qu'une traduction peut être *figée dans un référentiel* plutôt que formulée, elle est figée. Et quand rien ne permet de dériver ni de substituer, l'agent **retire et signale** — il ne comble jamais.

---

# PARTIE D — LE RÉFÉRENTIEL DES PROFILS (gravé le 19/08)

## R5 ✅ LE PROFIL = SOCLE × TYPE, EN 45 CELLULES PRÉ-ÉCRITES

**Problème posé par la garante :** la grille dit COMMENT le candidat fonctionne, mais jamais **ce qu'il apporte** — le référent ne sait pas dans quelles situations appeler ce profil. L'ancien référentiel PIVAR (9 types : SYSTÉMATIQUE · MÉTHODIQUE · OPTIMISATEUR · ADAPTATEUR · ORCHESTRATEUR · EXÉCUTEUR · ARCHITECTE · DÉTECTEUR · MAÎTRE) jouait ce rôle mais par **classification** — une case parmi neuf, adossée à une échelle de niveaux.

**RÈGLE : on ne classe pas, on croise.**
- Le **socle** dit *quel type de contribution* la personne apporte (5 valeurs : Collecte · Tri · Analyse · Solutions · Mise en œuvre).
- Le **type** dit *sous quel régime* elle l'exerce (9 valeurs, issues du référentiel PIVAR).
- **5 × 9 = 45 cellules**, écrites une fois, définitives. L'agent ne fait que désigner la bonne.

**Pourquoi le croisement et non l'addition** — arbitrage tranché sur épreuve (versions A et B comparées sur le cas de M. R.) : l'addition « socle + type » ne produit qu'une phrase générique (*« il construit des réponses en menant plusieurs pistes »*) qui ne dit pas au référent QUAND appeler la personne. Le croisement révèle ce qu'aucune des deux briques ne contient : pour l'orchestrateur de solutions, que sa valeur n'est pas d'avoir la bonne idée mais de **tenir l'incertitude ouverte sans bloquer l'action**.

## Format d'une cellule — six colonnes

| Colonne | Rôle |
|---|---|
| `cle` | SOCLE-TYPE (ex. SOLUTIONS-ORCHESTRATEUR) |
| `socle` · `type` | les deux axes |
| `titre` | « Orchestrateur de solutions » |
| **`en_une_ligne`** | **la phrase qui positionne — elle doit être limpide SEULE.** *(Jurisprudence : une première version de la cellule n'était comprise qu'après explication orale — preuve que la synthèse manquait. Elle est désormais obligatoire et en tête.)* |
| `ce_qu_il_apporte` | 2 phrases : la valeur réelle, jamais l'évidence du socle |
| `atouts` | 4 à 6 situations d'emploi |
| `couts` | 3 situations où le même trait devient charge |

## Règle d'écriture — le test des trois secteurs
**Aucune situation ne doit pouvoir être rattachée à un métier.** Test opposable : la formulation doit se lire aussi bien dans **un cabinet d'avocats, une usine et une DSI**. Si elle ne passe pas, elle est trop concrète et doit être remontée d'un cran. *(Exemple validé : « un dossier bloqué parce que la voie unique a été épuisée ».)*

## R6 ✅ L'APPORT DE LA CHAÎNE — amont et aval complètent le profil

La cellule dit le **régime** ; la chaîne du candidat dit sa **couleur réelle**. Un paragraphe **« ce que sa chaîne y ajoute »** s'insère après `ce_qu_il_apporte`, construit sur l'amont et l'aval réels — avec **son revers**.

*Exemple sur M. R. (socle Solutions, amont Analyse, aval Mise en œuvre) :* ses ouvertures ne sont pas de la dispersion — **son amont les ordonne** (il classe selon un critère constant avant de construire) ; elles ne restent pas sur le papier — **son aval les porte en parallèle** (plusieurs flux sans que l'un bloque l'autre). *Revers : son analyse travaille pour décider, pas pour comprendre — sur un sujet qui exige une compréhension approfondie sans décision à la clé, ce n'est pas son terrain.*

## R7 ✅ CE QUE L'AGENT PEUT AFFINER — ET CE QU'IL NE PEUT PAS

**Le cadre est figé.** Les 45 cellules sont écrites une fois. L'agent ne réécrit ni le titre, ni la ligne de positionnement, ni les atouts et coûts génériques.

**L'agent peut faire trois choses, et trois seulement :**
1. **Écrire le paragraphe « ce que sa chaîne y ajoute »** à partir de l'amont et de l'aval réels, avec leur revers.
2. **Ajouter une ou deux situations d'atout** issues de la chaîne, **marquées comme telles** — jamais en retirer.
3. **Nuancer un coût** quand la chaîne le compense réellement (ex. : un aval très structurant atténue le risque de non-décision).

**Il ne peut jamais :** supprimer un coût · transformer un coût en atout · ajouter une situation rattachable à un métier · inventer un croisement hors des 45 cellules.

## R5bis ✅ LES PALIERS N'EXISTENT PLUS — TROIS ZONES, DES TYPES DEDANS

**Correction de la garante, 19/08 — annule une déduction erronée de ma part.** J'avais conclu, en lisant le champ `ordre_global` (1-9) de l'ancien référentiel, que « le type EST le niveau ». **C'est faux.**

**La structure réelle : trois zones, et des types à l'intérieur. AUCUN lien de supériorité entre eux.** Ce sont des boîtes, pas des échelons.

| Zone | Types qu'elle contient | Ce que la zone décrit |
|---|---|---|
| **ZONE EXÉCUTION** | Exécuteur · Systématique | des types qui travaillent **dans un cadre donné** |
| **ZONE OPÉRATIONNELLE** | Méthodique · Optimisateur · Adaptateur · Détecteur | des types qui **construisent ou ajustent** le cadre |
| **ZONE STRATÉGIQUE** | Orchestrateur · Maître · Architecte | des types qui agissent **sur le cadre lui-même** ou sur plusieurs systèmes |

**Interdits qui en découlent :**
- aucun chiffre de rang n'est affiché, ni stocké comme « niveau » — la colonne `niveau` est **retirée** du référentiel ;
- aucune formulation de progression (« palier », « niveau supérieur », « monter en zone ») ;
- une zone ne vaut pas mieux qu'une autre : un exécuteur n'est pas « en dessous » d'un architecte, ils ne sont simplement pas appelés dans les mêmes situations ;
- l'agent ne peut jamais présenter un type comme un degré atteint ou à atteindre.

⚠️ **Vocabulaire hérité à corriger dans la chaîne** : le champ `type_ecarte` de `ETAPE2_BILAN4EXCELLENCES` emploie encore « Pas palier 6 », « Pas palier 5 » — c'est l'ancienne génération. Le contenu reste utile (il justifie l'écartement des types voisins), **la formulation est à reprendre**. Et `type_numero` ne doit **jamais** être utilisé comme un rang par l'agent : il ne sert qu'à retrouver le type.

---

## R8 ✅ LA VÉRIFICATION TUILE PAR TUILE — ET SA VERBALISATION OBLIGATOIRE

**Décision de la garante, 19/08.** L'agent ne prend jamais une tuile pour argent comptant. Il **lit chaque élément** de la tuile désignée et **vérifie qu'il s'applique à SON candidat**, sur pièce.

### Le protocole, élément par élément
Pour la tuile désignée (socle × type), l'agent examine séparément : l'**application au socle** · chaque **situation d'atout** · chaque **situation de coût**. Pour chacun, il tranche :

| Verdict | Ce que fait l'agent |
|---|---|
| **S'APPLIQUE** | il conserve la formulation du référentiel, sans y toucher |
| **S'APPLIQUE AVEC AJUSTEMENT** | il reste **dans** la tuile et ajuste — et il **verbalise obligatoirement** |
| **NE S'APPLIQUE PAS DU TOUT** | il **ne réécrit rien** : c'est le signe que l'attribution socle × type est peut-être fausse → **remontée en révision humaine** |

### Ce qu'« ajuster dans la tuile » autorise — et interdit
**Autorisé :** nuancer une formulation pour coller au geste réel · préciser une condition d'activation · retirer une situation qui ne se vérifie pas chez ce candidat · ajouter une situation issue de sa chaîne amont/aval (R6), marquée comme telle.
**Interdit :** modifier la définition du type (export du lexique) · changer le titre · transformer un coût en atout ou l'inverse · sortir du croisement désigné · introduire une situation rattachable à un métier.

### La verbalisation — champ obligatoire, jamais facultatif
Dès qu'il y a **ajustement** ou **non-application**, l'agent écrit son analyse. Contenu imposé :
1. **la clé de la tuile** et la **version du référentiel** utilisée ;
2. **l'élément concerné**, cité tel qu'il est au référentiel ;
3. **le verdict** (ajusté / non applicable) ;
4. **le motif, adossé à une pièce** : quel geste, quel mode, quelle donnée du bilan justifie l'écart — avec sa référence interne (jamais le verbatim exposé, D-PREUVE) ;
5. **la formulation retenue**, telle qu'elle apparaîtra dans la grille ;
6. **ce qui a été écarté** et pourquoi.

### Pourquoi c'est structurant — deux raisons, pas une
- **Qualité** : sans verbalisation, un ajustement est indistinguable d'une dérive. Avec elle, chaque écart est relisible et corrigible — et les écarts récurrents sur une même tuile signalent que **la tuile elle-même doit être révisée**.
- **Conformité** : le règlement européen et la CNIL exigent qu'une analyse produite par un système automatisé soit explicable et traçable. La verbalisation **est** cette traçabilité : elle documente le chemin qui va du référentiel au document remis, candidat par candidat.

### Stockage — table dédiée
`GRILLE_VERBALISATION` : `candidat_id` · `cle_tuile` · `version_referentiel` · `element_concerne` · `verdict` (s'applique / ajusté / non applicable) · `motif_et_preuve` · `formulation_retenue` · `elements_ecartes` · `horodatage`.

**Règle de conservation** : la verbalisation se conserve avec le bilan. Une grille sans sa verbalisation d'ajustements n'est pas validable.

### Contrôle de sortie ajouté
7. Tout élément de la grille qui diffère du référentiel a sa ligne de verbalisation. Aucun écart silencieux.

---

## R9 ✅ LES GESTES — OÙ LES LIRE, LESQUELS RETENIR

**Deux tables se complètent. Les deux sont COMPLÈTES.** *(Jurisprudence : j'ai cru à un trou de données en lisant le mauvais champ, et il a fallu que la garante me reprenne deux fois.)*

| Table | Ce qu'elle porte |
|---|---|
| `ETAPE1_T2_CIRCUITS_POURBILAN` (tblV8UBCgEOzJ2Tch) | **`bloc_final`** (fld5caHteonsyxrji) = très souvent / souvent / occasionnels · `rang_dans_pilier` · `circuit_code` · `pilier_owner` |
| `ETAPE1_T3_CIRCUIT` (tblLAC4dS25v6IUbs) | **la matière** : `explication_courte_ch4` (narration) · `n1_definition` · `renfort_phrase` · verbatims · `circuit_niveau` · `circuit_freq` · `profondeur` |

**Jointure** : `candidat_id` + code du geste (`circuit_code` côté T2, `circuit_id` côté T3).

### ⚠️ Deux pièges, tous deux vérifiés sur pièce

**1 · Le champ `bloc` est un résidu.** Il contient encore « BLOC_EN_ATTENTE » : c'est le pré-classement, remplacé par `bloc_final` et jamais nettoyé. **Ne jamais le lire.** Seul `bloc_final` fait foi.

**2 · `circuit_niveau` n'est PAS le bloc.**
- `circuit_niveau` (HAUT ≥4 · MOYEN 2-3 · FAIBLE 1) = une **amplitude absolue** ;
- `bloc_final` = un **rang relatif au pilier**.

*Preuve chez M. R. : ses sept gestes de création sont tous à `circuit_niveau = MOYEN` (fréquence 3), et pourtant ils forment son bloc « très souvent » — parce qu'au sein de son socle, c'est le sommet. Inversement un geste de collecte à HAUT peut être classé « souvent » si d'autres le dépassent dans son pilier.*

**→ La sélection se fait sur `bloc_final`, JAMAIS sur `circuit_niveau`.** Sinon on compare des piliers entre eux, ce qui n'a aucun sens.

### La règle de sélection — cascade de repli
Pour **chaque outil**, on affiche **le bloc le plus haut qui existe pour lui** :
1. s'il a des gestes en **« très souvent »** → on prend ceux-là et on s'arrête ;
2. sinon → on descend sur **« souvent »** ;
3. sinon → on prend les **« occasionnels »**.

**Pourquoi la cascade est nécessaire** : un pilier fonctionnel n'est appelé que sous contrainte ; il peut n'avoir aucun geste au bloc le plus fréquent. Sans repli, sa carte serait **vide** alors que la personne a bien des gestes — ce serait faux.

*(Arbitrage pris au plus prudent : on s'arrête au premier bloc non vide. À confirmer par la garante — l'autre option étant de prendre les deux crans inférieurs ensemble quand on descend.)*

**Le niveau retenu ne se dit pas au référent** : c'est de la mécanique de mesure (D95), et l'afficher introduirait une hiérarchie entre outils. La carte dit ce que la personne fait avec cet outil, pas à quelle fréquence.

**Les gestes hors référentiel** (code `·ADHOC`) sont réels et documentés : ils entrent dans la sélection comme les autres, selon leur `bloc_final`.

**Les titres** se dérivent de la narration selon **R1**, pour tous les piliers sans exception. Les libellés du référentiel de circuits (`circuit_nom`) restent au coffre (D95).

---

# ════════ DOCTRINES DU 20/08/2026 ════════
*Gravées après une journée où six défauts sont passés en production faute d'avoir vérifié avant d'écrire.*

## D-LIRE ✅ UN NOM DE CHAMP SE LIT, IL NE S'INVENTE JAMAIS

**Trois passages perdus, une heure de la garante, deux dollars — pour trois noms supposés.**

| Ce que le code lisait | Ce qui existe | Effet |
|---|---|---|
| `synth_bloc_tres_souvent_candidat` | **`bloc_tres_souvent_candidat`** | cinq synthèses vides pendant trois passages |
| `renfort_phrase` | **`en_renfort`** | tous les renforts vides |
| `ch3_signal_registres` | **`registres`** | registres affectifs jamais transmis |

**Deux pièges techniques, à connaître :**
1. **Le nom Airtable ≠ la clé du service.** Le service traduit par identifiant via `config/airtable` : `synth_bloc_tres_souvent_candidat` en base devient `bloc_tres_souvent_candidat` en sortie. **Il faut lire les clés du service**, pas le schéma Airtable.
2. **`Object.keys(records[0])` ment** sur les tables à lignes hétérogènes : il ne montre que les champs *remplis* du premier enregistrement. Sur `ETAPE1_T2_CIRCUITS_POURBILAN`, la première ligne est une ligne de structure — `bloc_final` semblait absent alors qu'il existe partout ailleurs.

**La règle :** *avant d'écrire tout code qui lit une table, en lister les clés réelles ET les montrer à la garante.* Pas « je suppose que le champ s'appelle X », mais « voici les clés, je prends celle-ci ».

```
node -e "require('./services/infrastructure/airtableService').<getteur>('<id>').then(r=>console.log(Object.keys(Array.isArray(r)?r[0]:r).join(' | ')))"
```
Dix secondes. À passer **avant** chaque nouveau lecteur.

---

## D-MAQUETTE ✅ LA MAQUETTE VALIDÉE EST LA SPÉCIFICATION — ON L'OUVRE, ON NE S'EN SOUVIENT PAS

Les quatre prompts ont été écrits **de mémoire**, sans confronter la maquette élément par élément. Résultat : ce dont l'agent se souvenait a été commandé, le reste n'existait pas. Quatre blocs manquaient, trois champs transmis n'étaient réclamés par personne.

**La règle :** avant d'écrire une commande d'agent, **ouvrir la maquette et dresser la table de correspondance** — pour chaque élément visible : sa source, son producteur, le contrôle qui en vérifie la présence. Aucune ligne de prompt avant cette table.

---

## D-GABARIT ✅ CE QUI NE VARIE JAMAIS N'EST JAMAIS PRODUIT

Une maquette contient deux natures de contenu :
- **ce qui vient du candidat** → produit par les agents ;
- **ce qui est identique pour tous** — annonce encadrer/manager, bloc de preuve, rappel de lecture, notes de cadrage → **écrit une fois dans le gabarit**.

Faire produire à un agent un texte qui ne doit jamais varier, c'est prendre le risque qu'il varie — ou qu'il disparaisse. Les quatre blocs « perdus » sont revenus intacts dès que la couche d'affichage a existé.

**Fichiers** : `gabarit_grille.html` (la maquette avec ses ancres) · `rendu_grille_html.js` (le moteur, qui ne contient aucun texte de grille) · `rendu_grille_style.css` (la charte).

---

## D-DESTINATION ✅ ON VÉRIFIE CE QUE LE LECTEUR VOIT, PAS CE QU'ON A ÉCRIT

La garante a signalé **trois fois** que la grille était vide. Trois fois la réponse a été « elle est pleine » — en vérifiant *le contenu du fichier* au lieu de *ce que le navigateur en fait*. Le visualiseur était cassé : une variable JavaScript mal échappée arrêtait le script, la page restait blanche.

**Corollaire de D125.** Un fichier correct qui ne s'affiche pas est un fichier faux.

**Et sa cause directe :** *un fichier généré ne se rapièce pas — il se régénère.* Deux fichiers ont été cassés en les modifiant par expressions régulières. Régénérer entièrement, puis **vérifier l'intégrité du résultat** (JSON relu, script exécuté), coûte moins cher qu'un rapiéçage silencieux.

---

## D-EXHAUSTIF ✅ LA SÉLECTION SE FAIT PAR LA PREUVE, JAMAIS PAR LE GOÛT

*(Charte §5, appliquée le 20/08.)* Tout item d'un référentiel accroché à un geste réel est retenu. **Aucun quota, aucun « les plus intéressants ».**

**Pourquoi** : une sélection éditoriale varie d'un juge à l'autre — deux candidats au même profil recevraient des points différents. Un test de preuve ne varie pas. C'est ce qui rend le document opposable.

**Corollaire — l'origine se vérifie.** Chaque point cite l'item dont il vient, et un contrôle vérifie que cet item **existe dans le référentiel**. Sans ce contrôle, un agent cite une origine qu'il invente aussi : c'est exactement ce qui s'est produit pendant quatre passages, et le référentiel de désalignement — 42 entrées — est resté inutilisé.

---

## D-REVERS ✅ UN POINT D'ATTENTION EST LE REVERS D'UNE FORCE NOMMÉE

*(Décision garante du 20/08 ; la charte a été rectifiée en conséquence.)*

Un passage a produit trois titres qui nommaient des défauts — « Difficulté à converger », « Tendance à continuer d'enrichir », « Friction dans les environnements ». Un référent y lit un candidat incapable de décider, de s'arrêter et de s'intégrer. **C'est le contraire de ce que le protocole établit.**

**La forme imposée :**
- **l'axe** nomme ce que la personne apporte : « Ce que sa manière apporte » / « Ce qu'il apporte face à d'autres manières » ;
- **le titre** nomme le mouvement, jamais le défaut — « L'éventail qui ne se referme pas », pas « difficulté à converger » ;
- **`force`** s'affiche · **`preuve`** s'affiche (le geste réel qui l'établit — *un point démontre, il n'affirme pas*) · **`bascule`** se déplie ;
- **mots interdits** : difficulté · tendance à · incapacité · faiblesse · lacune · défaut · manque de · n'arrive pas à · ne sait pas.

**Exception : les injonctions.** Là, l'énoncé EST le contenu — ce sont les phrases que l'entourage dit. Elles s'affichent **mot pour mot** dans leur cadre « Ce qu'on lui dit », détectées mécaniquement sur `bloc_type = INJONCTIONS`.

---

## D-TRACE ✅ UNE PHRASE SANS SON CODE EST INDISTINGUABLE D'UNE INVENTION

L'agent recevait le code de chaque geste et ne le renvoyait pas : le lien avec la source se perdait à l'écriture. Plus personne ne pouvait vérifier qu'une narration venait de la base.

**La règle :** le code voyage jusqu'à la sortie, un contrôle vérifie que **la narration recoupe sa source**, et le gabarit le place dans un attribut — traçable, jamais affiché.

**Corollaire :** les champs internes (code, origine, ancrage, verbalisations) sont **exclus des filtres de langage** — sinon on interdirait la traçabilité même qu'on vient d'exiger.

---

## D-ALARME ✅ ON VÉRIFIE AVANT D'ALARMER

Une « découverte » de versions concurrentes du bilan a provoqué un coup de stress inutile chez la garante : c'étaient quatre candidats différents, plus un rejeu de test dûment marqué. **Deux requêtes de plus auraient suffi.**

**La règle :** avant d'annoncer une anomalie qui touche l'intégrité des données, **lire tous les enregistrements concernés**. Une alerte fausse coûte plus qu'une vérification.
