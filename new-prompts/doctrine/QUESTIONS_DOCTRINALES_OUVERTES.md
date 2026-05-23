# QUESTIONS DOCTRINALES OUVERTES
## Cas non tranchés dans les mappings v1.1 — à traiter ultérieurement par la CTO

**Version** : v1.0
**Date** : 23 mai 2026
**Statut** : registre vivant, complété au fil de l'usage

---

## OBJET

Certaines questions doctrinales identifiées pendant la rédaction des mappings v1.1 ne peuvent **pas être tranchées par le système** et nécessitent une décision humaine. Elles sont consignées ici pour traitement ultérieur, plutôt que d'être laissées comme zones grises dans les mappings (où elles génèreraient de l'imprévisibilité).

---

## QUESTION 1 — P4 / P3 : la "conception minimaliste assumée"

**Description du cas** : geste où la solution proposée par le candidat consiste **à ne rien créer de nouveau délibérément** ("la meilleure solution est de ne rien changer", "on garde l'existant").

**Signal verbatim possible** :
- "rien à inventer"
- "on garde le système actuel"
- "la solution est de ne pas en avoir"

**Pourquoi c'est ouvert** :
Les 15 circuits P4 supposent tous qu'on **conçoit quelque chose**. Le refus délibéré de concevoir n'est pas couvert. Mais cette posture pourrait aussi être un **jugement P3** (évaluation que l'action n'est pas nécessaire) plutôt qu'une création P4.

**Position provisoire dans la doctrine v1.1** :
Traité comme un **jugement P3** (non-nécessité d'action) — pas d'ad hoc P4. Si Agent T1 a posé P4 sur ce geste, l'agent T2 Phase 1 le marque **NON_ATTRIBUEE avec warn** dans `circuits_proches_envisages` indiquant la suspicion que P3 aurait été plus adapté.

**À trancher par la CTO** :
- Faut-il créer une zone de manque P4 "Anti-design" / "Conception du non-faire" ?
- Ou faut-il enrichir P3 d'un circuit "Jugement de non-nécessité d'action" ?
- Ou faut-il considérer que ce cas est un artefact rare qui ne justifie pas de doctrine ?

**Quand traiter** : si ce cas est observé sur 3+ candidats distincts, déclencher décision CTO.

---

## QUESTION 2 — P3 Zone "analyse par négation/élimination"

**Description du cas** : diagnostic fait **par exclusion** plutôt que par identification positive ("ce n'est pas X, ni Y, donc c'est Z").

**Signal verbatim possible** :
- "ce n'est pas ça"
- "j'élimine les hypothèses une à une"

**Pourquoi c'est ouvert** :
Ce mécanisme cognitif est observable mais pourrait être déjà couvert par **NUANCEE P3C13+P3C14** (construction d'hypothèses + détection d'incohérences). À mesurer.

**Position provisoire dans la doctrine v1.1** :
Pas de zone de manque créée. NUANCEE C13+C14 attendue. Si l'agent crée un ad hoc dans ce cas, c'est qu'il considère la NUANCEE insuffisante — à analyser au cas par cas.

**À trancher par la CTO** : faut-il une zone de manque P3 spécifique ? À décider après observation empirique.

---

## QUESTION 3 — P2 : faut-il enrichir le pilier ou affiner sa définition ?

**Description du cas** : P2 est mobilisé à 7.6% seulement (vs 33% pour P3, 27% pour P5). À la lecture des 15 circuits, P2 porte majoritairement sur la mémoire cognitive (encodage, stockage, récupération) alors que le libellé "Tri / Organisation" suggère un périmètre plus large incluant l'organisation pratique du présent.

**Pourquoi c'est ouvert** :
Trois possibilités :
- **A** : P2 = "Tri/Organisation" au sens large, et il faut **enrichir** les 15 circuits pour mieux couvrir l'organisation du présent (au-delà de la mémoire).
- **B** : P2 = "Mémoire" au sens strict, et il faut **renommer** le pilier pour clarifier la doctrine — au risque de devoir re-traiter les candidats existants.
- **C** : P2 = "Tri/Organisation" tel que défini à l'origine, et la sous-mobilisation est un signal que **peu de questions du protocole interrogent ce pilier** — donc à investiguer côté protocole, pas côté pilier.

**Position provisoire dans la doctrine v1.1** :
Option C par défaut — pas de modification rétroactive. Les attributions P2 existantes (Cécile, Rémi sur "classement", "post-its") restent valides.

**À trancher par la CTO** : nécessite une décision stratégique. À reprendre après 10+ candidats supplémentaires traités.

---

## QUESTION 4 — Métrique "détournement pilier-cible"

**Description du cas** : Opus a observé sur les données réelles que les candidats détournent fréquemment le pilier-cible de la question (Cécile 60%, Véronique 60%, Rémi 44%). Le scénario ANIMAL_2 provoque 80% de détournement.

**Pourquoi c'est ouvert** :
Cette métrique pourrait être une **signature cognitive valorisable** dans le profilage du candidat (capacité à recadrer une situation hors du pilier attendu). Mais elle est aussi un possible signal de **biais de questionnement** dans le protocole pivar (les questions ne testent pas ce qu'elles prétendent tester).

**Position provisoire dans la doctrine v1.1** :
Hors scope de la doctrine de création d'ad hoc. À traiter dans le backlog produit.

**À trancher par la CTO** : explorer en tant que feature produit (1 journée d'étude) avant décision.

---

## PROTOCOLE DE TRAITEMENT DES QUESTIONS OUVERTES

Quand une question doctrinale ouverte rencontre un cas concret en production :

1. L'agent T2 Phase 1 trace le cas dans `circuits_proches_envisages` avec mention "question ouverte n°X"
2. Un log warn est généré dans les logs Render
3. La CTO consulte ce fichier mensuellement pour vérifier si des cas se sont accumulés
4. Si 3+ cas sur une même question, déclencher décision CTO + mise à jour des mappings

---

## NOUVELLES QUESTIONS À AJOUTER

Ce fichier est un **registre vivant**. Toute nouvelle question doctrinale identifiée pendant l'usage doit être ajoutée ici avec :
- Description du cas
- Signal verbatim possible
- Pourquoi c'est ouvert
- Position provisoire adoptée
- Conditions de déclenchement de la décision CTO

---

**Fin du registre.**
