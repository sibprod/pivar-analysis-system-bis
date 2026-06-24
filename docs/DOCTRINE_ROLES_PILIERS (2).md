# DOCTRINE D'ATTRIBUTION DES RÔLES DE PILIERS (figée — source : Bible §4, 18/06)

> Retrouvée et confirmée le 24/06. Remplace la règle mécanique fausse RANG_TO_ROLE
> de la Phase 4. Les rôles se lisent sur la POSITION dans la chaîne cognitive,
> PAS sur la fréquence de gouvernance seule.

## LES 4 RÔLES (Bible §4, verbatim)
- SOCLE       : le pilier qui gouverne, pris en premier, qui porte le filtre.
- AMONT       : pilier structurant qui ALIMENTE le socle → vient AVANT dans la chaîne.
- AVAL        : pilier structurant qui CONCLUT → vient APRÈS le socle dans la chaîne.
- FONCTIONNEL : pilier mobilisé au service des autres, sans gouverner.

## LA LECTURE (signaux posés par l'étape 1.1, déjà en base)
Tout est déjà écrit par les agents 1.1, réponse par réponse, dans RESPONSES / ETAPE1_T1 :
- `cog_pilier_gouverne` : quel pilier pilote la réponse (→ donne le SOCLE = le plus fréquent).
- `cog_pilier_sortie`   : sur quel pilier le candidat CLÔT le process (→ donne l'AVAL).
- `cog_outils_mobilises`: la séquence ordonnée des piliers (→ donne la POSITION amont/aval).
- `piliers_secondaires` (T1) : déjà formaté « PX en amont du cœur / PY en aval du cœur ».

## RÈGLE D'ATTRIBUTION
1. SOCLE = le pilier le plus souvent `cog_pilier_gouverne` (le filtre de cœur dominant).
2. AVAL  = le pilier le plus souvent `cog_pilier_sortie` (≠ socle) : le process se clôt sur lui.
           PEUT avoir un cœur 0 (la Bible dit « conclut », pas « gouverne »). Vient après le socle.
3. AMONT = le pilier qui alimente le socle, situé AVANT lui dans la séquence (piliers_secondaires
           « en amont »), avec une présence réelle.
4. FONCTIONNEL = les piliers restants, mobilisés ponctuellement au service des autres.

## CE QUI ÉTAIT FAUX (à remplacer)
service_etape1_T2_phase4_circuits_pourbilan.js :
  const RANG_TO_ROLE = { 1:'socle', 2:'amont', 3:'aval', 4:'fonctionnel', 5:'fonctionnel' };
  → basé sur rang_par_frequence (VENTILATION), trié sur nb_reponses (fréquence de gouvernance).
  → IGNORE cog_pilier_sortie et la position dans la chaîne.
  → Un pilier cœur 0 (ex. P5 Véronique/Cécile) n'a pas de rang → tombe en 'fonctionnel' par défaut,
    alors qu'il est l'AVAL (le process se clôt sur lui).
  → C'est la cause de : Véronique P2 aval (faux) / P5 fonctionnel (faux).
    Correct attendu : Véronique P5 aval, P2 fonctionnel.

## CAS DE RÉFÉRENCE (à vérifier après correction)
- Rémi    : P4 socle (gouverne le plus, fabrique des dispositifs), P5 aval (clôt/exécute),
            P1 amont (collecte qui alimente), P2 + P3 fonctionnels. (à confirmer sur sortie/séquence)
- Cécile  : P3 socle, P5 aval (« conclut, jamais déclenché pour lui-même » — Bible/prompt PA),
            P1 amont, P2 + P4 fonctionnels.
- Véronique : P3 socle, P5 aval, + amont/fonctionnels à lire sur la séquence.

## MÉTHODE DE VÉRIFICATION (figée — la lecture de laboratoire, pas une décision)
Le rôle ne se DÉCIDE pas, il se LIT dans l'expérience (les 25 réponses + verbatims).
Personne ne tranche selon sa préférence : on lit ce que le candidat a réellement fait.

### Étape 1 — Socle (DOUBLE SIGNAL DE CONFIRMATION — sécurité absolue)
Le socle se confirme par la CONVERGENCE de deux signaux indépendants qui doivent
pointer le MÊME pilier :
  (1) CŒUR le plus haut : le pilier qui gouverne le plus (cog_pilier_gouverne dominant,
      activation cœur la plus élevée).
  (2) COLONNE INSTRUMENTALE la plus alimentée : le pilier le plus SERVI par les autres
      — le total de sa colonne svc-{pilier} est le plus élevé des cinq. C'est le pilier
      autour duquel TOUTE l'activité inter-piliers tourne.
Quand les deux convergent → socle certain.
  Rémi : cœur dominant P4 ET svc-P4 = 26 (le plus haut) → socle P4.
  Cécile : cœur dominant P3 ET svc-P3 le plus haut → socle P3.
  Véronique : cœur dominant P3 ET svc-P3 = 22 (le plus haut) → socle P3.
SI LES DEUX SIGNAUX DIVERGENT (cas atypique) : c'est un drapeau. Ne pas conclure vite ;
descendre lire les circuits/verbatims pour comprendre l'architecture avant de poser le socle.
NB : ce n'est PAS « le cœur le plus haut » seul. La colonne instrumentale est la preuve
structurelle (l'architecture converge vers le socle) ; le cœur la confirme.

### Étape 2 — VÉRIFICATION VISUELLE par la colonne instrumentale du socle (CLÉ)
Une fois le socle connu, on se positionne dans la table figée POURBILAN, sur la
COLONNE INSTRUMENTALE DU SOCLE (svc-{socle}), et on lit, pour chacun des 4 autres
piliers, combien il sert le socle (ligne TOTAL_PILIER, colonne svc-socle).
  - Le pilier qui sert FORTEMENT le socle = STRUCTURANT (amont ou aval).
  - Le pilier qui ne le sert que peu = FONCTIONNEL.
Cette lecture visuelle est ce qui SÉCURISE l'attribution et évite de se tromper
une fois le socle posé. (Démonstration faite sur captures, 24/06.)
  Exemples lus sur la colonne svc-P3 :
   - Cécile : P5 sert P3 = 21 · P1 = 10 · P2 = 3 · P4 = 2 → P5 et P1 structurants, P2/P4 fonctionnels.
   - Véronique : P5 sert P3 = 13 · P1 = 6 · P2 = 3 · P4 ≈ 0 → P5 et P1 structurants, P2/P4 fonctionnels.

### Étape 3 — Amont vs aval = position dans la BOUCLE COGNITIVE
Boucle : P1 collecte → P2 tri → P3 analyse → P4 création → P5 mise en œuvre.
Par rapport au socle :
  - structurant situé AVANT le socle dans la boucle → l'alimente → AMONT.
  - structurant situé APRÈS le socle dans la boucle → le conclut → AVAL.
Confirmation : cog_pilier_sortie (l'aval = là où ça clôt) + cog_outils_mobilises (séquence).
  Cécile / Véronique : P1 (avant P3) = amont · P5 (après P3) = aval.

### Étape 4 — CAS EX ÆQUO : lecture des circuits + verbatims (cas Rémi)
Quand la colonne instrumentale ne tranche pas nettement (plusieurs piliers servent
le socle à un niveau proche), on DESCEND lire les CIRCUITS de chaque pilier et leurs
VERBATIMS pour voir CE QU'ILS FONT au service du socle.
  Cas Rémi (socle P4) : svc-P4 ≈ P1:7, P3:7, P5:6 → ex æquo, la colonne ne suffit pas.
  Lecture des circuits/verbatims :
   - P5 : « il teste en exécutant », la mise en œuvre ÉPROUVE ses créations puis ajuste
     (P4Q7 « décision finale au dernier moment » ; P2Q11 « application → observation →
     ajustement ») → P5 = AVAL (conclut/éprouve la création, après P4 dans la boucle).
   - P1 : il RECALIBRE ses créations en retournant COLLECTER de la matière
     (P3Q8 « → P1 nouvelles recherches » ; P3Q1 « P1 multi-sources → P4 test ») → P1 = AMONT.
   - P3 : filtre bref (« je sens », critère de risque) ; P2 : tri résiduel → FONCTIONNELS.
  NB Rémi : P5 a du cœur (il gouverne aussi), mais reste l'AVAL par sa position de
  clôture/test après la création. Le cœur ne change pas le rôle ; la position le fixe.

## ★ CORRECTION DE FOND (24/06) — LA NATURE/CAPACITÉ DES CIRCUITS PRIME SUR LE VOLUME
La vérité = ce que le candidat VERBALISE dans ses réponses. Un circuit = le libellé
d'un GESTE + une CAPACITÉ. Le rôle ne se lit donc NI au volume de gouvernance, NI au
volume de service au socle, mais dans la NATURE et la CAPACITÉ des circuits qu'un pilier
active au service du socle.

RÈGLE AFFINÉE :
- Un pilier est STRUCTURANT (amont/aval) quand il apporte au socle des gestes de FORTE
  CAPACITÉ COGNITIVE qui l'alimentent/recadrent (amont) ou le concluent/éprouvent (aval).
- Un pilier qui n'apporte que des gestes SIMPLES ou CONTEXTUELS, même en volume, reste
  FONCTIONNEL.
- AMONT vs AVAL = position dans la boucle cognitive (P1→P2→P3→P4→P5) par rapport au socle :
  avant = alimente/recadre (amont) ; après = conclut/éprouve (aval).

DÉMONSTRATION RÉMI (socle P4) — pourquoi P3 amont et NON P1 :
- svc-P4 : P3=11, P1=7, P2=2 (P5 sert aussi mais est en aval, après P4).
- P3 sert P4 par 3 circuits HAUT et SOPHISTIQUÉS : P3C12 (priorisation hiérarchique,
  sophistiquée intégrative), P3C10 (modulation de la profondeur d'analyse selon l'enjeu,
  sophistiquée), P3C6 (anticipation des conséquences, sophistiquée intégrative).
  → des gestes qui RECADRENT le contexte pour relancer la création → AMONT.
- P1 sert P4 surtout par P1C15 (optimisation des réseaux humains, « simple avec détails/
  variantes sur le même geste ») : collecte CONTEXTUELLE à la situation, qui ne recadre
  PAS pour relancer la création → FONCTIONNEL.
- Conclusion : ce qui alimente/recalibre la création de Rémi, c'est l'ANALYSE (P3), pas
  la collecte (P1). La capacité des circuits le prouve.

PROFIL COMPACT (clé de lecture Rémi) : Rémi est un humain TRÈS COMPACT — peu de scores
en nombre, mais chaque circuit activé CONCENTRE une multitude de gestes. Sa signature
est dans la DENSITÉ cognitive de ses circuits, pas dans le volume. Lire au volume trompe ;
il faut lire la nature et la capacité des gestes. (Vérité = le geste verbalisé + sa capacité.)

## ★ NUANCE CAPITALE (24/06) — LA NATURE DE L'AMONT DÉPEND DU SOCLE
Vérifié sur Cécile : ses circuits P1 servant P3 sont surtout SIMPLES (P1C1 attention
sélective simple sert P3 3×, P1C5 gestion des flux simple 2×). Pourtant P1 EST son
amont légitime. Pourquoi ? Parce que le TYPE d'alimentation attendu dépend du SOCLE :
- Socle ANALYTIQUE (P3) : ce qui l'alimente en amont, c'est la COLLECTE (P1) — aller
  chercher la matière à analyser. Une collecte simple est le BON geste d'amont pour P3.
  → P1 alimente P3 = AMONT valide (Cécile, Véronique).
- Socle CRÉATIF (P4) : ce qui l'alimente/recadre, c'est l'ANALYSE sophistiquée (P3) —
  prioriser, anticiper pour relancer la création. Une collecte (P1) ne recadre PAS une
  création → fonctionnel. → P3 recadre P4 = AMONT (Rémi) ; P1 = fonctionnel.

DONC la règle n'est PAS « P1 est toujours amont ». L'agent doit juger si le geste qui
sert le socle est le BON TYPE d'alimentation POUR CE SOCLE :
- ne pas regarder la capacité dans l'absolu seulement, mais en RELATION au socle ;
- demander : « ce geste apporte-t-il au socle ce dont CE socle a besoin en amont
  (matière à traiter / recadrage / etc.) ? » Si oui → structurant amont. Sinon → fonctionnel.
La boucle cognitive cadre l'attente : un socle en position N attend de l'amont les gestes
des positions < N (qui le nourrissent) et de l'aval les gestes des positions > N (qui le concluent).

## ★ PIÈGE À DÉJOUER — UN PILIER À CŒUR ÉLEVÉ PEUT RESTER FONCTIONNEL
Vérifié sur Véronique (verbatims) : son P2 a un cœur élevé (P2C1 cœur 10), elle gouverne
de vrais épisodes de tri autonome (catégorisation par axes, mémento par rubriques,
checklists). MAIS ce P2 ne sert JAMAIS le socle analytique : colonne svc-P3 de P2 ≈ 3
(et son gros circuit P2C1 sert P3 = 0) ; et dans ses réponses P2-gouvernées, aucune
remontée vers l'analyse — le tri se suffit à lui-même. Donc P2 = FONCTIONNEL malgré son cœur.
RÈGLE : le cœur dit qu'un pilier SAIT FAIRE ce geste ; le rôle structurant dit qu'il
ALIMENTE ou CONCLUT le socle. Ne JAMAIS promouvoir un pilier sur la seule force de son
cœur. Toujours vérifier ce qu'il APPORTE AU SOCLE — colonne instrumentale (svc-socle)
ET nature des verbatims (le geste pointe-t-il vers le socle, ou tourne-t-il pour lui-même ?).
NB : quand le tri P2 sert vraiment l'analyse chez Véronique, c'est P3 qui gouverne la
réponse (P2 instrumental à P3) — donc ces cas sont déjà dans la gouvernance P3, pas P2.

## TROIS CAS ÉTALONS (vérifiés sur pièces + capacité des circuits + verbatims, 24/06)
- Rémi    : P4 socle · P3 amont · P5 aval · P1 + P2 fonctionnels. (vérifié circuits+capacité+verbatims)
- Cécile  : P3 socle · P1 amont · P5 aval · P2 + P4 fonctionnels. (svc-P3 net ; nature circuits à confirmer)
- Véronique : P3 socle · P1 amont · P5 aval · P2 + P4 fonctionnels. (svc-P3 net ; nature circuits à confirmer)

NB : pour Cécile/Véronique l'amont est P1 (collecte qui alimente l'analyse), pour Rémi
l'amont est P3 (analyse qui recadre la création). L'amont dépend du SOCLE et de la NATURE
des gestes qui l'alimentent — il n'est pas toujours le même pilier. À reconfirmer sur la
nature des circuits de Cécile/Véronique (svc-P3) pour être rigoureux comme pour Rémi.

## CONSÉQUENCE D'ARCHITECTURE
Le rôle EXIGE de lire la capacité/nature des circuits servant le socle (donnée du
référentiel) ET leur sens. Ce n'est PAS un comptage déterministe pur : c'est un POINT
D'ANALYSE. Implémentation à l'étape 1.2 — emplacement et nature (agent LLM lisant les
circuits, ou calcul intégrant la capacité du référentiel) à arrêter par Claude (tuyauterie),
sans perdre ce principe : la nature/capacité prime sur le volume.

## ★ CAS-LIMITE À POSER — LE PROFIL EXÉCUTANT (socle + 4 fonctionnels)
Tout candidat a FORCÉMENT un socle (il entre toujours dans une situation par un geste
dominant). MAIS amont et aval ne sont PAS obligatoires. Certains profils — exécutants,
faible amplitude cognitive, « je fais ce qu'on me dit » — ne montrent dans leurs verbatims
AUCUN appel structurant à d'autres piliers : pas d'analyse qui recadre, pas de collecte
qui alimente, pas de pilier qui conclut en propre.
Dans ce cas, le résultat VALIDE est : SOCLE + 4 FONCTIONNELS. Ce n'est pas une erreur
d'analyse, c'est un profil réduit (qui sera très faible, mais existe).

RÈGLE ABSOLUE (garde-fou anti-invention) :
- On n'attribue un AMONT ou un AVAL que si les CIRCUITS LE DÉMONTRENT (un pilier qui
  sert le socle par des gestes structurants attestés). Pas de démonstration → pas de
  rôle structurant. (Cohérent Bible §9 : le silence n'est pas une donnée ; on ne profile
  jamais à l'imagination.)
- L'agent ne DOIT JAMAIS fabriquer un amont/aval pour « compléter » l'architecture.
  Mieux vaut 4 fonctionnels honnêtes qu'un structurant inventé.
- Cas possibles selon ce que montrent les verbatims :
    socle + amont + aval + 2 fonctionnels  (cas riche : Rémi, Cécile, Véronique)
    socle + amont + 3 fonctionnels          (alimenté mais ne conclut pas en propre)
    socle + aval + 3 fonctionnels           (conclut mais n'est pas alimenté en propre)
    socle + 4 fonctionnels                   (exécutant pur : aucun appel structurant)
  Le socle est le SEUL rôle toujours présent.

## OÙ CORRIGER (DÉCIDÉ avec Isabelle, 24/06)
Le rôle DOIT être posé à l'ÉTAPE 1.2 (attribution des piliers), pour que l'étape bilan
récupère des éléments déjà posés et fiables. NE PAS le laisser à l'agent du bilan.
NE PAS garder RANG_TO_ROLE. Le point d'analyse lit : cog_pilier_gouverne (socle),
la colonne instrumentale du socle dans l'inventaire (structurant vs fonctionnel),
la position dans la boucle cognitive + cog_pilier_sortie (amont vs aval), et descend
aux verbatims des circuits en cas d'ex æquo.
