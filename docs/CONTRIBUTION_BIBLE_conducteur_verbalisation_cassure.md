# CONTRIBUTION BIBLE — CONDUCTEUR, VERBALISATION, CASSURE PAR NATURE, MICRO-TEXTE
## Bloc à agréger dans la Bible — DOCTRINE FIGÉE (2026-06-25)

> Document de contribution destiné à l'AGRÉGATION FINALE de la Bible (BLOC A).
> Rédigé au format des doctrines figées du projet (cf. CONTRAT_FRONTIERE_BLOCS.md,
> DOCTRINE_ROLES_PILIERS.md), pour intégration en UNE PASSE.
> Couvre quatre doctrines nées du travail du 25/06 sur la chaîne bilan (étape 1.3),
> validées sur le run complet de Rémi (5 piliers, statut BILAN_FABLE_PA_OK).
>
> NE CONTREDIT AUCUN document figé. Complète le §4 du CONTRAT_FRONTIERE_BLOCS
> (la cassure) en précisant SUR QUOI elle se juge. Renvoie aux fichiers existants
> plutôt que de les recopier.

---

## A. DOCTRINE DU CONDUCTEUR DE PROMPT (à systématiser pour TOUT prompt d'agent)

### A.1 Principe
Tout prompt d'agent API s'ouvre par un CONDUCTEUR CHRONOLOGIQUE : l'ordre explicite
des temps de travail, AVANT le détail des champs, lexiques et gabarits. Le reste du
prompt devient la RÉFÉRENCE DÉTAILLÉE que le conducteur appelle, temps par temps.

### A.2 Pourquoi (incident fondateur)
Run de Rémi avec le prompt v11 (25/06, matin) : l'agent, sans ordre de travail imposé,
inventait sa propre séquence et la verbalisait en tête de réponse (« Je vais d'abord
analyser… »). Ce préambule en texte libre, placé avant le JSON, faisait planter le
parsing (`Parse JSON PA raté` — « Unexpected token »). Le bilan ne sortait pas.
→ Cause racine : pas l'agent, mais l'ABSENCE d'un ordre cadré. Un agent sans conducteur
  improvise et expose son improvisation au mauvais endroit.

### A.3 Le conducteur en 7 temps (étape 1.3, agent PA pilier)
1. LIRE (libellé + capacité par terme exact du lexique + chiffres + verbatims de chaque réponse).
2. JUGER LA PROFONDEUR (sur verbatims : effleuré / effectif / plein régime).
3. ÉTABLIR LES BLOCS + VERBALISER l'analyse dans `<analyse>…</analyse>` (cf. section B).
4. RÉDIGER CHAQUE CIRCUIT.
5. RÉDIGER LES BLOCS.
6. ÉTABLIR LE MODE.
7. SYNTHÈSE PILIER.
Format de réponse imposé : bloc `<analyse>` PUIS JSON strict, rien d'autre.

### A.4 Portée
Doctrine GÉNÉRALE, pas limitée à l'étape 1.3. Tout nouvel agent LLM de la chaîne
(y compris l'attribution des rôles à l'étape 1.2 si elle est confiée à un agent —
cf. DOCTRINE_ROLES_PILIERS « point d'analyse ») reçoit un conducteur chronologique
en tête. Sans conducteur, l'agent invente son ordre et le verbalise → chaos de parsing.

---

## B. DOCTRINE DE LA VERBALISATION D'ANALYSE CADRÉE

### B.1 Principe
La verbalisation de l'analyse par l'agent est UTILE et doit être CONSERVÉE — mais CADRÉE,
jamais supprimée. Elle est produite au temps 3 du conducteur, dans un bloc balisé
`<analyse>…</analyse>`, AVANT le JSON.

### B.2 Ce que le bloc contient (et ne contient pas)
Le bloc `<analyse>` est un JOURNAL DE DÉCISION, PAS un brouillon de rédaction :
- IL CONTIENT : la lecture des circuits de tête (geste + capacité + verbatims), le
  jugement de la cassure et son motif, le rangement retenu (très souvent / souvent /
  occasionnels), les points d'attention rédaction (profondeurs plein régime, écarts
  cœur/total marqués, EN_SOUTIEN, ADHOC).
- IL NE CONTIENT PAS : les textes finaux du bilan (ceux-ci sont produits aux temps 4-7,
  dans le JSON).

### B.3 À quoi elle sert (double fonction)
1. MÉMOIRE DE REPRISE : si un pilier doit être repris, l'analyse rejoue la décision
   sans tout recalculer.
2. TRACE DE CONTRÔLE QUALITÉ : elle est stockée et auditable, et fonde un contrôle de
   cohérence analyse↔blocs (cf. B.4).

### B.4 Stockage et contrôle
- Stockée dans T3_PILIER, champ `analyse_verbalisée_agent` = `fldGLJRqWUxUoDR5e`
  (Texte long), clé de config `ETAPE1_T3_PILIER_FIELDS.analyse_verbalisee`.
- Le service compare ce que l'analyse ANNONCE (codes en « très souvent ») à ce que le
  JSON PRODUIT. Divergence → WARNING (non bloquant : l'analyse étant en texte libre, on
  signale pour audit, on ne rejette pas un bilan correct sur une formulation).
- LIMITE CONNUE (à calibrer) : le contrôle peut lire une hésitation intermédiaire du
  raisonnement plutôt que la décision finale (cas P2C1, run Rémi : annoncé puis rangé
  ailleurs). Calibrage souhaitable = ne lire que la section « Rangement retenu ».

### B.5 Preuve (run Rémi)
Les 5 piliers ont produit une analyse verbalisée structurée et exacte. Exemple P4 :
l'agent a écrit « La légère pente (5,4,3,3,3,3) ne reflète pas une hiérarchie de nature
mais une variation d'amplitude. Il n'y a pas de cassure. » — la doctrine de cassure
(section C) refaite seul à partir du prompt.

---

## C. LA CASSURE SE JUGE SUR LA NATURE DU GESTE, JAMAIS SUR LA PROFONDEUR

> Complète le §4 du CONTRAT_FRONTIERE_BLOCS (« la cassure = jugement, jamais calcul »)
> en fixant SUR QUOI porte le jugement. Ne le contredit pas : le total ordonne le rang,
> la cassure tranche la frontière très souvent / souvent.

### C.1 Règle
La frontière « très souvent » / « souvent » se juge sur la NATURE du geste :
libellé + capacité (terme exact du lexique) + verbatims de chaque réponse répertoriée.
Elle ne se juge JAMAIS sur la profondeur d'activation (effleuré / effectif / plein régime).

### C.2 Rôle de chaque dimension (sans recouvrement)
- LE TOTAL ordonne le rang (tri décroissant, cf. CONTRAT_FRONTIERE §3).
- LA NATURE (libellé + capacité + verbatims) tranche la frontière de bloc.
- LA PROFONDEUR nourrit la RÉDACTION (demi-phrase « plein régime » au temps 4), elle
  ne CLASSE pas. Elle est jugée au temps 2, donc disponible au temps 3 — mais on choisit
  DÉLIBÉRÉMENT de ne pas l'utiliser pour ranger.

### C.3 Pourquoi pas la profondeur (preuve par l'absurde, test du 25/06)
Si la profondeur cassait les blocs, deux circuits de MÊME TOTAL mais de profondeur
différente tomberaient dans deux blocs différents → incohérence directe avec « le total
commande le rang » (CONTRAT_FRONTIERE §3 et §5). Le test (version A = nature / version B =
profondeur, joué à la main sur Rémi P4) a tranché pour la nature : version A retenue.

### C.4 Profil compact → un seul bloc
Quand des circuits sophistiqués se COMBINENT dans une même réponse (totaux serrés, collés
au cœur), il n'y a pas de cassure : un seul bloc « très souvent », pas de « souvent ».
Forcer une coupure inventerait une rupture que les verbatims démentent.
- Cas fondateur : Rémi P4 (socle) = 6 circuits combinatoires (totaux 5,4,3,3,3,3),
  un seul bloc « très souvent ». Cohérent avec CONTRAT_FRONTIERE §4 (plateau Rémi P4).
- Contre-cas (cassure réelle) : Rémi P5 (aval) = « très souvent » P5C4/P5C6/P5C7 (le
  mouvement d'adaptation en action, qui se combine), « souvent » P5C2/P5C1/P5C15
  (préparation / procédure / finalisation, gestes d'une AUTRE nature). La cassure tombe
  au changement de nature, pas au décroché de chiffre.

### C.5 Garde-fou (intangibilité, rappel)
Les chiffres cités (total, cœur) viennent de POURBILAN, jamais réécrits pour homogénéiser
un groupe ou justifier un rangement (cf. CONTRAT_FRONTIERE §5 et §8). Un circuit à total 4
est cité « 4 », quel que soit son bloc.

---

## D. LE MICRO-TEXTE (soleil_micro) EST OBLIGATOIRE POUR CHAQUE CIRCUIT

### D.1 Règle
`soleil_micro` (T3_CIRCUIT, `flduJoJnNpHRmh6jg`) est OBLIGATOIRE et NON VIDE pour CHAQUE
circuit de la liste, quel que soit le niveau (HAUT, MOYEN, FAIBLE, EN_SOUTIEN). Sans
exception. ≤ 15 mots.

### D.2 Nature du texte
C'est le GESTE du circuit en format court, fondé sur le VERBATIM de l'explication du geste
— JAMAIS une paraphrase du libellé du circuit. Mêmes mots d'action que `explication_courte`.
Cohérent avec la LOI ABSOLUE GESTE→CIRCUIT : le libellé est une étiquette de classement,
il ne fournit pas le vocabulaire.

### D.3 Pourquoi obligatoire partout (raison d'architecture)
Le micro-texte est RÉUTILISÉ dans une phase ULTÉRIEURE du bilan. Chaque circuit doit donc
porter le sien, sinon le texte manque en aval. La règle ancienne (« HAUT+MOYEN seulement,
vide pour FAIBLE/EN_SOUTIEN ») était FAUSSE au regard de cet usage : corrigée le 25/06,
au prompt (CHAMP 4bis + gabarit JSON + contrôle 20) ET au service (validation), alignés.

---

## E. JURISPRUDENCE — TROIS FAUX NÉGATIFS DE VALIDATION À NE PAS RÉINTRODUIRE

Le run de Rémi a révélé trois contrôles trop rigides qui rejetaient des productions
CORRECTES de l'agent et gaspillaient des retries. Principe directeur : quand l'agent a
raison sur le fond, c'est le CONTRÔLE qu'on assouplit, pas l'agent qu'on durcit
(cf. CONTRAT_FRONTIERE §C6 : « ne pas durcir l'agent — recalibrer les contrôles »).

### E.1 Amorce ADHOC
Un circuit ADHOC (geste sur mesure, propre au candidat) commence légitimement par
« Ce geste est propre… ». Cette amorce DOIT figurer dans la liste autorisée du contrôle
n3_nuance.

### E.2 Formule de rattachement au singulier
Un bloc qui ne contient QU'UN circuit (pilier pauvre) s'écrit grammaticalement au
singulier : « cette manière de faire EST ce que le protocole nomme ». Le contrôle doit
accepter le singulier (« est / correspond à / relève de ») EN PLUS du pluriel
(« sont / correspondent à / relèvent de »).

### E.3 Micro-texte des FAIBLE/EN_SOUTIEN
Cf. section D : le micro-texte est obligatoire partout. Tout contrôle qui l'INTERDIT pour
FAIBLE/EN_SOUTIEN est faux et doit être retiré (remplacé par : rejet si VIDE).

---

## F. CE QUI NE CHANGE PAS (rappels de cohérence)
- Le rangement sur le TOTAL, la ligne de partage service/agent, les 3 valeurs POURBILAN :
  inchangés (CONTRAT_FRONTIERE §1, §2).
- La doctrine des rôles (socle/amont/aval/fonctionnel par lecture de laboratoire,
  nature/capacité prime sur le volume, posée à l'étape 1.2) : inchangée
  (DOCTRINE_ROLES_PILIERS).
- Capacité (lue) et profondeur (jugée) = deux axes séparés de la valeur, jamais une note.
- Le silence n'est pas une donnée ; on ne profile jamais à l'imagination (Bible §9).

---

## G. POINTS LAISSÉS OUVERTS (à trancher avant l'agrégation finale)
Ces points ne sont PAS de mon ressort seul ; je les signale pour l'agrégation :
- B3 / A1b (TODO consolidée) : rédige-t-on un MODE pour un pilier FONCTIONNEL ? Le run de
  Rémi a produit un mode pour P1/P2/P3 (fonctionnels). À confirmer comme doctrine, ou à
  restreindre.
- Calibrage du contrôle de cohérence analyse↔blocs (cf. B.4) : ne lire que « Rangement
  retenu ».
- A1a (TODO consolidée) : conflit de chiffres Cécile P3 (21/13 vs 20/12) à trancher sur
  pièce avant intégration de l'amendement 13.8.
