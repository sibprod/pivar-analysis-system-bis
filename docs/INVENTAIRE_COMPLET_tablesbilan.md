# INVENTAIRE COMPLET — TABLES T3 + CONSIGNES DE GÉNÉRATION
Base `appgghhXjYBdFRras` · Mis à jour 16/06/2026 · **v3** (remplace v2.1 du 16/06 et v2 du 15/06)

> v3 — amendements intégrés (session 16/06/2026) :
> 1. Prompt référencé : **P-A v9** (remplace v7)
> 2. `soleil_micro` : STATIQUE → **P-A** (Δ11 du prompt v9, ≤15 mots, HAUT+MOYEN seulement)
> 3. `synth_factuelle_elargie` : consigne étendue — **EMPRUNTS REÇUS OBLIGATOIRES**
> 4. `ch4_intro_eclate` : contrainte **≤ 20 mots** ajoutée
> 5. `mode_explication` : amorce **"Ce mode découle directement..."** rendue obligatoire
> 6. `synth_interpretee` : gabarit 5 sections imposé mot pour mot + titre §3 "en renfort" (pas "jamais seul")
> 7. `pilier_socle_mode` (T3_BILAN) : anomalie Rémi **RÉSOLUE** le 16/06 (resynchronisé depuis T3_PILIER)
> 8. `mode_statut` : champ produit par P-A v9 (FOURNI/PROPOSITION) — **absent de la base** (à créer si besoin)
> 9. Règle EN SOUTIEN rétablie : circuit cœur=0 en pilier à échelle cœur = EN_SOUTIEN (pas FAIBLE)
> 10. Emprunts reçus : fournis en entrée P-A dans le champ `emprunts_recus` de l'entrée JSON

## LÉGENDE STATUTS

- ✅ **É0** — calculé ou copié mécaniquement (script, zéro LLM)
- ✅ **P-A** — `PROMPT_ANALYSE_PILIER_v9.md` (×5 appels, 1 par pilier)
- ✅ **P-B** — `PROMPT_FILTRE_CH4_v1.md` (×1 appel)
- ✅ **P-C** — `PROMPT_CH2_BOUCLES_v1.md` (×1 appel)
- ✅ **P-D** — `PROMPT_CH3_MARQUEURS_v1.md` (×1 appel)
- ⚪ **STATIQUE** — valeur fixe ou champ non rendu dans le template courant
- ⚠️ **PÉRIMÉ** — ancien champ remplacé (ne pas alimenter)
- ❌ **NON ASSIGNÉ** — champ sans consigne définie ou absent de la base

---

## TABLE T3_CIRCUIT (`tblLAC4dS25v6IUbs`)
1 record par circuit actif × candidat

| Field ID | Nom | Statut | Consigne précise |
|---|---|---|---|
| `fldeaMdgx3WVWgxgv` | circuit_uid | ✅ É0 | Clé primaire générée automatiquement |
| `fldUewcuNizHi3NrW` | bilan_link | ✅ É0 | Lien vers T3_BILAN du candidat |
| `fldPpfFtaCh9wI9IQ` | pilier_link | ✅ É0 | Lien vers T3_PILIER du pilier concerné. **Créé APRÈS T3_PILIER** (contrainte d'ordre absolue) |
| `fldpQzPEvlNaRXFgg` | candidat_id | ✅ É0 | Copie du candidat_id |
| `fld74EvZRf7r4biGh` | pilier | ✅ É0 | P1..P5 — pilier du circuit |
| `fldrnHJtNOWWYJ91t` | circuit_id | ✅ É0 | C1..C15 — code du circuit |
| `fldSGRXf8mi4q1NTd` | circuit_nom | ✅ É0 | Copie de REFERENTIEL_CIRCUITS.circuit_nom (`fldaRcdCErwKZfLft`). ADHOC : REFERENTIEL_CIRCUITS_CANDIDATS.nom_propose |
| `fldrM33rxdYnJ39vz` | circuit_freq | ✅ É0 | = INVENTAIRE_CIRCUITS.nb_coeur (`fld8nEBQqdLqQqe1b`). P5 zéro-cœur : = 0. **Source : nb_coeur, jamais total** |
| `fldwfbNZ0DKsdXray` | circuit_franches | ✅ É0 | = nb_coeur (identique à circuit_freq) |
| `fldDnY9fRw3g62C6o` | circuit_nuancees | ✅ É0 | = 0 (toujours pour ce système) |
| `fldGzHp6ZFEsiIERf` | circuit_cluster | ⚠️ PÉRIMÉ | Concept "cluster" aboli 11/06. Ne pas alimenter. |
| `fldVsySoS1k0yFHgx` | circuit_signal | ⚪ STATIQUE | Non utilisé dans le template courant |
| `fld0LTPI1KfAVHRqI` | circuit_niveau | ✅ É0 | **Calculé depuis nb_coeur.** ⬩ ÉCHELLE CŒUR (pilier ayant ≥1 circuit cœur≥1) : HAUT ≥4 / MOYEN 2-3 / FAIBLE 1 / **EN_SOUTIEN = cœur 0** (PAS FAIBLE — règle doctrine 10/06). ⬩ EXCEPTION pilier entièrement sans cœur (P5) = ÉCHELLE TOTAL : HAUT ≥5 / MOYEN 2-4 / FAIBLE 1 (pas EN_SOUTIEN). Valeur base "EN SOUTIEN" (avec espace) / clé interne "EN_SOUTIEN". |
| `fldKKSpL02oLC8Gwn` | n1_definition | ⚪ STATIQUE | **Non rendu dans le template.** Copie de REFERENTIEL_CIRCUITS.circuit_geste (`fldS4sVj4FxFofcqJ`). **INTERDIT de servir de base à l'explication** (la LOI ABSOLUE l'interdit). Peut être rempli par le builder É0 pour archivage. |
| `fldV3EBlHGUleiifK` | n2_verbatims | ⚪ STATIQUE | Champ source brut. Les verbatims passent par soleil_verbatim + verbatim_2..4 (sélectionnés par P-A dans verbatims_cites). Non rendu directement dans le template. Peut être rempli par le builder depuis les verbatims_cites de la sortie P-A pour traçabilité. |
| `fldSx0VOHYILowFSj` | n3_nuance | ✅ **P-A** | **Explication principale du circuit.** Structure 3 temps : T1 geste en mots simples (1 phrase "Vous + verbe", jamais nominatif) / T2 mécanique fine ancrée sur verbatims (critères, étapes, déclencheur) / T3 portée selon niveau. Longueurs : HAUT 280-420c / MOYEN 180-280c / FAIBLE 120-180c / EN SOUTIEN 80-140c (format dédié "Ce geste ne s'active jamais pour lui-même chez vous…"). **LOI : GESTE → CIRCUIT. Paraphrase pure — zéro guillemets « » dans ce champ.** Méthode des facettes si >4 occ. |
| `fldSK79cCYsuICAAy` | ordre_pilier | ✅ É0 | Rang du circuit dans son pilier (HAUT d'abord, cœur décroissant) |
| `fld5SPJJXdv9Bo6vT` | ordre_circuit | ✅ É0 | Rang global du circuit dans le bilan |
| `fldoGZPSxM22pk82R` | en_svc_P1 | ✅ É0 | Activations instrumentales vers P1. **Règle gravée : source = T3_CIRCUIT uniquement.** Jamais INVENTAIRE.nb_svc_P1 (corrompu prouvé sur P3C12). |
| `fldAgQzO8YgqbzUEe` | en_svc_P2 | ✅ É0 | idem P2 |
| `fld56OTFNSTo7OGAE` | en_svc_P3 | ✅ É0 | idem P3 |
| `fldJ76jeasA2KVmdY` | en_svc_P4 | ✅ É0 | idem P4 |
| `fldqMhYYHMy7b2s1n` | en_svc_P5 | ✅ É0 | idem P5 |
| `fldnFNJm6GP0mAGNm` | total_activations | ✅ É0 | = INVENTAIRE_CIRCUITS.total_activations (`fldzV8udGk3eQ58No`). Source authoritative. |
| `flduJoJnNpHRmh6jg` | soleil_micro | ✅ **P-A** | **Micro-phrase §02bis** (Δ11 v9 — anciennement STATIQUE). ≤ 15 mots, "Vous + verbe", mêmes mots d'action que explication_courte. **HAUT et MOYEN uniquement — FAIBLE et EN SOUTIEN : vide strict ("").** Alimente la visualisation §02bis (profil cognitif). |
| `fldLP9juCWCTlCZPt` | soleil_verbatim | ✅ **P-A** | Verbatim 1 — sélectionné par P-A (verbatims_cites[0]). Facette dominante selon méthode des facettes. Copie EXACTE depuis T2 (coquilles conservées, zéro reformulation). |
| `fldI1DVJiH7EH4zel` | soleil_verbatim_ref | ✅ É0 | Référence du verbatim 1 : format "PqQn Scénario" (ex. "P4Q13 Sommeil"). Depuis verbatims_cites[0].qid + lieu. |
| `fldSCQD9zvgRQcuq9` | verbatim_2 | ✅ **P-A** | Verbatim 2 — sélectionné par P-A (verbatims_cites[1]). Facette distincte, scénario varié. Copie EXACTE. Vide si ≤1 occurrences. |
| `fldmVPwfku0vUz6xX` | verbatim_2_ref | ✅ É0 | Référence du verbatim 2 — depuis verbatims_cites[1].qid + lieu |
| `fldhIp3aW72WR2V1t` | verbatim_3 | ✅ **P-A** | Verbatim 3 — facette distincte. Vide si <3 occurrences. |
| `fldcQ7hxyRumcc1DO` | verbatim_3_ref | ✅ É0 | Référence du verbatim 3 |
| `fld4lrLWySRXVmvZe` | verbatim_4 | ✅ **P-A** | Verbatim 4 — facette distincte. Vide si <4 occurrences. |
| `fldQgruSXveuTCLM4` | verbatim_4_ref | ✅ É0 | Référence du verbatim 4. **⚠️ ID = fldQgru (g pas b) — typo réelle vérifiée** |
| `fldixMQDcsD7cCyd3` | renfort_phrase | ✅ **P-A** | **Phrase "En renfort" — conditionnelle.** Format : "En renfort : ce geste vient aussi appuyer votre [Outil] (Px) — N fois : [phrase rédigée ancrée]." **Règle : rempli SI ET SEULEMENT SI un sortant en_svc_Px ≥ 2. Vide strict ("") sinon** — jamais de placeholder. Plusieurs cibles ≥2 triées par N décroissant. |
| `fld3zZ8SteMWedetW` | explication_courte_ch4 | ✅ **P-A** | **Mini-phrase ch.IV.** Condensé de l'explication longue dans les MÊMES TERMES : ≤ 18 mots, "Vous + verbe". Test : aucun mot d'action absent de l'explication longue. EN SOUTIEN (cœur=0) : format "Jamais en propre : [ce que le geste fait au service de l'autre outil]." |

---

## TABLE T3_PILIER (`tblzDIn7P2cOvVvY2`)
1 record par pilier × candidat (5 records)

| Field ID | Nom | Statut | Consigne précise |
|---|---|---|---|
| `fldiL5nkdk50zFwkX` | pilier_uid | ✅ É0 | Clé primaire générée |
| `fld4vR7DGcEVCzz32` | bilan_link | ✅ É0 | Lien vers T3_BILAN |
| `fldZKruIBDdjAsY47` | candidat_id | ✅ É0 | Copie du candidat_id |
| `fldVvi5gbKioBmlsQ` | pilier | ✅ É0 | P1..P5 |
| `fldbDYECHFEGkh0Ng` | pilier_label | ✅ É0 | Nom officiel depuis REFERENTIEL_PILIERS.pilier_nom (`fldI2u7FxkWhdGoot`). Ne jamais hard-coder. |
| `fldhFisqhUf9oBLOe` | pilier_role | ✅ É0 | singleSelect : **socle / amont / aval / fonctionnel** (valeurs corrigées le 16/06). Ne jamais mettre "str1/str2/fn1/fn2" — ces anciens codes sont périmés. |
| `fld1X3FQYRcxB2Qwy` | pilier_role_label | ✅ É0 | Libellé court. Socle : "★ Pilier socle — Cœur de votre moteur" / amont : "Pilier amont — Ce qui alimente le socle" / aval : "Pilier aval — Ce par quoi le socle conclut et agit" / fonctionnel : "Pilier fonctionnel" |
| `fldoGY71vyiaUeFl6` | **pilier_mode** | ✅ **P-A** + [validation Isabelle] | **SOURCE AUTHORITATIVE du mode.** CAS A (fourni en entrée) : recopié tel quel (mode_statut=FOURNI). CAS B (absent) : P-A propose (mode_statut=PROPOSITION). **Règle doctrine v9 : le mode nomme la MANIÈRE DE FAIRE dominante, pas une qualité.** "Analytique et rigoureux" = INTERDIT. "Critérié et tranché · décisionnaire par seuils" = CORRECT. Validé par Isabelle avant toute étape aval. Permanence stricte partout dans le bilan. |
| `fld6qIK9UOZPAE59k` | pilier_rappel | ⚪ STATIQUE | Remplacé par pilier_rappel_detail. Non rendu dans le template. |
| `fldg5DCdL9U523YfG` | nb_activations | ✅ É0 | Total activations cœur du pilier (somme nb_coeur de tous ses circuits) |
| `fldtUV0KYT0zyjg0J` | nb_circuits_actifs | ✅ É0 | Nombre de circuits avec ≥1 activation (cœur≥1 OU total≥1 pour P5) |
| `fldUmfMvtMEsADKFX` | nb_circuits_haut | ✅ É0 | Nombre de circuits avec cœur ≥4 |
| `fldfpEzRkoHqXHmJ2` | cluster_label | ⚠️ PÉRIMÉ | Concept "cluster" aboli 11/06. Ne pas alimenter. |
| `fldNbdQTQFrL9MmLv` | cluster_detail | ⚠️ PÉRIMÉ | Idem. |
| `fldKax0VwI4BhnLKV` | tableau_note | ⚪ STATIQUE | Note ancienne périmée. Non rendu dans le template. |
| `fldcGtODAh6b0vZs5` | synth_factuelle | ⚠️ PÉRIMÉ | Doublon de synth_factuelle_elargie. Non rendu dans le template. Ne pas alimenter. |
| `fldho6MPGr5J5QmPu` | synth_interpretee | ✅ **P-A** | **Vue d'ensemble du pilier — gabarit 5 sections imposé MOT POUR MOT (v9).** Section 1 : "Profil — ce que vos gestes disent de vous (vue d'ensemble)". Section 2 : "▸ Ce que vous faites très souvent (activé 4 fois ou plus)". Section 3 : "▸ Ce que vous faites régulièrement (activé 2 à 3 fois)". Section 4 : **"▸ Ce que vous faites de temps en temps, ou en appui (activé 1 fois ou en renfort)"** — "en renfort" obligatoire, "jamais seul" interdit. Section 5 : "▸ Le mode retenu : [mode]" + "▸ Où cet outil revient (lecture des totaux instrumentaux)". Sens "Où revient" = pilier VA SERVIR les autres (sortants), JAMAIS l'inverse. |
| `fldsT1hJdbYUQuBnv` | note_doc_ouverte | ⚪ STATIQUE | Documentation interne. Non rendu dans le template. |
| `fldtZdnuftdhGx2mb` | ETAPE1_3_BILAN_CIRCUIT | ✅ É0 | Lien vers tous les records T3_CIRCUIT de ce pilier |
| `flduDBhd1fNO6jx9Z` | verif_pilier_mode | ⚪ STATIQUE | Vérification post-production. Non alimenté par les prompts. |
| `fld97CHqsYXmzvsEj` | verif_synth_factuelle | ⚪ STATIQUE | Idem |
| `fldqB1AkrgdaaEbnl` | verif_synth_interpretee | ⚪ STATIQUE | Idem |
| `fldBhaF1059wTcOu2` | verif_tableau_note | ⚪ STATIQUE | Idem |
| `fldCM0X6TsHYLQ0YD` | synth_factuelle_coeur | ✅ **P-A** | **Inventaire factuel cœur (registre A).** CAS 1 (fourni en entrée) : reprendre TEL QUEL. CAS 2 (vide) : construire. Format : "N activations cœur sur M circuits actifs. Circuits HAUT : [PxCy Nom (N cœur)]. Circuits MOYEN : [PxCy (N)]. Circuits FAIBLE : [PxCy (N)]. EN SOUTIEN (cœur=0) : [PxCy (total T)]. Signal limbique : [valeur depuis signal_limbique fourni — JAMAIS inventé]." |
| `fldKkGWMbDy4csrOg` | synth_factuelle_elargie | ✅ **P-A** | **Inventaire factuel élargi (registre A) — DEUX lectures OBLIGATOIRES.** CAS 1 (fourni en entrée) : reprendre TEL QUEL. CAS 2 (vide) : construire. Format : "N activations instrumentales sur M circuits. Débordements sortants : [PxCy sort N× en svc Pq]. Sous-totaux sortants : Pq = N. **Emprunts reçus depuis [Py] : [PyCz (N× en svc ce pilier)].** Depuis [Pr] : [PrCz (N×)]…" Si aucun emprunt reçu : "Aucun emprunt reçu depuis les autres piliers." Les emprunts reçus sont fournis en entrée P-A dans le champ `emprunts_recus`. |
| `fldIzsomwbdploHdS` | pilier_mode_vueglobale | ⚠️ PÉRIMÉ | Doublon de pilier_mode. Vidé le 11/06. **Ne pas alimenter.** |
| `fldk6MQ7KR3n9L5wu` | pilier_role_label_detail | ✅ É0 | Libellé détaillé pour la têtière. Socle : "Socle — le pilier qui gouverne tout le reste" / amont : "Amont — il alimente le socle avant que vous jugiez" / aval : "Aval — il conclut le verdict, jamais déclenché seul" / fonctionnel : "Fonctionnel — mobilisé quand la situation l'exige" |
| `fldaSofvHZk2K2SXw` | pilier_rappel_detail | ✅ É0 | Format : "Activation cœur N · Total occurrences M · K circuits actifs · X HAUT · Y MOYEN · Signal [résumé signal limbique]". Assemblage depuis INVENTAIRE + signal. |
| `flds6XOIwvYr20iRY` | synth_bloc_haut_technique | ✅ **P-A** | **Bloc HAUT — registre A (labo).** Préfixe OBLIGATOIRE : "Bloc HAUT cœur :". Codes, chiffres cœur/total, débordements ≥2. **Facettes dominantes OBLIGATOIRES pour chaque circuit HAUT** : "Facettes dominantes Cy : [facette (N occ.)]". Construites depuis le corpus complet des verbatims. Seules les facettes ≥2 occurrences listées. |
| `fldBLvofzosLTPUOr` | synth_bloc_haut_candidat | ✅ **P-A** | **Bloc HAUT — registre B (candidat).** M1 : fil commun des gestes (lecture d'ensemble, pas une liste). M2 : débordements svc≥2 traduits en gestes concrets. Zéro code circuit dans M1. Zéro chiffre brut isolé. |
| `fldB9fRf8U61z4WZK` | synth_bloc_haut_rattachement | ✅ **P-A** | **Bloc HAUT — rattachement.** Format HAUT/MOYEN : "Ces manières de faire — [gestes] — sont ce que le protocole nomme : « [Nom officiel] » (PxCy) pour [geste court]… Le nom de chaque circuit n'est que l'étiquette du geste que vos réponses montrent." |
| `fld7Sv7LXlZ6XPghN` | synth_bloc_moyen_technique | ✅ **P-A** | Idem HAUT technique, pour circuits MOYEN (cœur 2-3). Préfixe "Bloc MOYEN cœur :" |
| `flda16lg5Dt1HrXrF` | synth_bloc_moyen_candidat | ✅ **P-A** | Idem HAUT candidat, pour circuits MOYEN |
| `fldMA46pZRI6Bi0ZU` | synth_bloc_moyen_rattachement | ✅ **P-A** | Idem HAUT rattachement. Format : "sont ce que le protocole nomme" |
| `fld6BWLEjDMdbYTs6` | synth_bloc_faible_technique | ✅ **P-A** | **Bloc FAIBLE+EN SOUTIEN fusionné — registre A.** Préfixe "Bloc FAIBLE/APPUI :". FAIBLE (cœur=1) et EN SOUTIEN (cœur=0) séparés dans le texte. |
| `fld68H41z6b9XtFoZ` | synth_bloc_faible_candidat | ✅ **P-A** | **Bloc FAIBLE+EN SOUTIEN fusionné — registre B.** Groupe "de temps en temps, ou en appui". EN SOUTIEN distingués par la tournure ("ne s'active jamais pour lui-même"). **Zéro code circuit dans ce champ.** |
| `fldZiSdH20uMb5wCY` | synth_bloc_faible_rattachement | ✅ **P-A** | **Bloc FAIBLE — rattachement.** Format FAIBLE : "Ces gestes ponctuels portent les étiquettes : « [Nom] » (PxCy)… Le nom n'est que l'étiquette du geste." **JAMAIS "sont ce que le protocole nomme" pour FAIBLE.** |
| `fldomziXNOGf7Ujsb` | ch4_intro_eclate | ✅ **P-A** | **Intro d'éclaté ch.IV.** 1 phrase selon le rôle. **≤ 20 mots.** Zéro chiffre. Zéro code circuit. Gabarits : socle → "Au centre, votre outil de cœur : [outil]. C'est par lui que vous entrez dans presque toute situation." / amont → "En amont, [outil] alimente [socle] : [1 geste attesté]." / aval → "En aval, [outil] conclut : quand [socle] a statué, c'est [outil] qui fait…" / fonctionnel → "[outil] s'active sous contrainte : quand [déclencheur attesté], jamais spontanément." |
| `fld6GtEBRP5UxvHeI` | mode_explication | ✅ **P-A** | **Explication du mode en registre candidat.** **Amorce OBLIGATOIRE** : "Ce mode découle [directement] de vos gestes dominants : vous [geste 1 paraphrasé] (PxCy), vous [geste 2] (PxCy)…" La suite relie les 2-3 gestes HAUT/MOYEN au libellé du mode. Conclure : "D'où « [mode exact] »." Jamais de jargon non expliqué. |

> **Note** : le champ `mode_statut` (FOURNI/PROPOSITION) est **produit par P-A v9 mais absent de la base Airtable**. Il est utilisé en sortie terminal pour identifier les piliers à valider avant P-B. À créer en singleSelect si besoin de filtrer dans Airtable.

---

## TABLE T3_BILAN (`tblv775KQrEhsogdI`)
1 record par candidat. **Champ de filtrage : `fldk66gddYGCREOV4`**

### Identité & Architecture motrice (É0)

| Field ID | Nom | Statut | Consigne précise |
|---|---|---|---|
| `fldk66gddYGCREOV4` | candidat_id | ✅ É0 | Copie du candidat_id. Champ de filtrage unique. |
| `fld8yjgv2jIp2dzvW` | civilite_candidat | ✅ É0 | Depuis VISITEUR |
| `fldFjVTaedAE8iXkU` | Prenom | ✅ É0 | Depuis VISITEUR |
| `fldsOkyWddI15pqgU` | Nom | ✅ É0 | Depuis VISITEUR |
| `fldBlTX1Fuiv81mRc` | version_bilan | ✅ É0 | Version courante |
| `fldfJHsX7A38IYele` | pilier_socle | ✅ É0 | Code pilier socle (P1..P5) depuis architecture VENTILATION_PILIERS |
| `fldUf6rhEyR3MKI1x` | pilier_socle_label | ✅ É0 | Nom officiel du pilier socle depuis REFERENTIEL_PILIERS |
| `fldLt4GhtqRUyl7V4` | pilier_socle_mode | ✅ É0 (resync T3_PILIER) | **Source authoritative = T3_PILIER.pilier_mode (`fldoGY71vyiaUeFl6`).** Resynchroniser après chaque validation P-A. Anomalie Rémi "Experimental et iteratif" **RÉSOLUE le 16/06** — valeur correcte "Intuitif et synthétique · Créatif et combinatoire" restaurée. |
| `fldBMHWSk6DsnRN2i` | pilier_socle_role | ✅ É0 | "socle" |
| `fldzsZUsyQR7vvbEi` | pilier_str1 | ✅ É0 | Code pilier str1 |
| `fldVwPsne8uUxYbOG` | pilier_str1_label | ✅ É0 | Nom officiel pilier str1 |
| `fld9wiwYRbBf1Eu1s` | pilier_str1_sorties | ✅ É0 | Nb sorties instrumentales totales du str1 |
| `fldefRzq9hqbn4gHn` | pilier_str2 | ✅ É0 | Code pilier str2 |
| `fld1mfPfxoQNXxPR5` | pilier_str2_label | ✅ É0 | Nom officiel pilier str2 |
| `fldad4ntutJO9lesl` | pilier_str2_sorties | ✅ É0 | Nb sorties |
| `fld5kBccd13uSx9ll` | pilier_fn1 | ✅ É0 | Code pilier fonctionnel 1 |
| `fld8vqxt3y7AmvCud` | pilier_fn1_label | ✅ É0 | Nom officiel |
| `fldcEfmIax60HZZPJ` | pilier_fn1_sorties | ✅ É0 | Nb sorties |
| `fldyw87BmzorCZ93j` | pilier_fn2 | ✅ É0 | Code pilier fonctionnel 2 |
| `fldexYDVC5sLzBsJH` | pilier_fn2_label | ✅ É0 | Nom officiel |
| `fldKRf4ixcN7bOE04` | pilier_fn2_sorties | ✅ É0 | Nb sorties |
| `fld1VX56hmKEE5Jq2` | sorties_P1 | ✅ É0 | Total activations instrumentales sortantes P1 (somme en_svc_P1 de tous les circuits du candidat dans T3_CIRCUIT) |
| `fldPrsVmktnmYYgQ2` | sorties_P2 | ✅ É0 | idem P2 |
| `fld23tLTuIWHyLcRs` | sorties_P3 | ✅ É0 | idem P3 |
| `fldiTpqZAsWuKiZML` | sorties_P4 | ✅ É0 | idem P4 |
| `fldu2FJSPYmjkFCUt` | sorties_P5 | ✅ É0 | idem P5 |
| `fld0i2Xr5A07KJZOC` | ETAPE1_3_BILAN_PILIER | ✅ É0 | Lien vers les 5 records T3_PILIER du candidat |
| `fld8F9KkASvL3Gqet` | ETAPE1_3_BILAN_CIRCUIT | ✅ É0 | Lien vers les N records T3_CIRCUIT du candidat |

### Champs périmés T3_BILAN (ne pas alimenter)

| Champ | Note |
|---|---|
| `fldXeBlXJ2IpU3diJ` note_profil_global | ⚠️ PÉRIMÉ |
| `fld6KItM77nOSojnf` filtre_label | ⚠️ PÉRIMÉ — remplacé par filtre |
| `fldFPhv8r1PtQpzN0`..`fldgq35VLCUvSa0uu` filtre_preuve_1..5 | ⚠️ PÉRIMÉ — remplacé par ch4_filtre_preuves |
| `fldQlgWGaPg49Xlnv` filtre_lecture_candidat | ⚠️ PÉRIMÉ — remplacé par ch4_filtre_revelation |
| glissement_intro + glissement_1..4 + conclusion | ⚠️ PÉRIMÉ — remplacés par preuves 4+5 |
| boucle_intro + boucle_1..3 | ⚠️ PÉRIMÉ — remplacés par ch2_boucle_* |
| signal_type + signal_intro + signal_item1..4 + signal_synthese | ⚠️ PÉRIMÉ — remplacés par ch3_signal_* |
| cout1..3 | ⚠️ PÉRIMÉ — remplacés par ch3_cout_* |
| sig_pilier_label + sig_filtre_val + sig_finalite + sig_resultat_* + sig_recit | ⚠️ PÉRIMÉ |
| vueglobale_intro + vueglobale_lecture_ensemble | ⚠️ PÉRIMÉ |
| lexique_* | ⚠️ PÉRIMÉ — remplacés par §00 statique template |

### Champs actifs — Filtre et Ch.IV (P-B)

| Field ID | Nom | Statut | Consigne précise |
|---|---|---|---|
| `fld9vAKpKEMIcRiTB` | **filtre** | ✅ **P-B** | **FILTRE COGNITIF — phrase maîtresse.** Dérivation en 4 temps : T1 traduire chaque geste HAUT du socle en question / T2 ordonner par fréquence cœur décroissant / T3 valider transversalité ≥2 multi-scénarios / T4 verbaliser ≤15 mots, présent, aucun jargon. Format : "[verbe] toute situation par [axe1], [axe2] et [axe3] — puis [conclusion attestée]". **Permanence : identique en §00, §02, schéma, §07.** |
| `fld1p9p9Csvyllvcm` | filtre_declinaison | ✅ **P-B** | **Déclinaison du filtre en questions directes.** Mêmes axes dans le même ordre. Format : "« [Question 1 ?] [Question 2 ?] [Question 3 ?] » …et [il/elle] [verbe de conclusion], [adverbe]." Troisième personne dans la chute. |
| `fldqDeT7EDov18iTz` | ch4_filtre_revelation | ✅ **P-B** | **Révélation ch.IV.** Déplie le filtre axe par axe. Conclusion : verbatim EXACT du candidat sur sa manière de conclure + ce que ce verbe veut et ne veut pas dire. ~350-550c. |
| `fldXGZ5ijlcGPYc16` | ch4_filtre_preuves | ✅ **P-B** | **5 preuves — format structuré.** 5 blocs séparés par UNE ligne vide. Structure FIXE : 1.Volume / 2.Poids des gestes / 3.Nature de la grille / 4.Débordements / 5.Force de rappel ("N glissements dont M convergent"). **Format "N … dont M convergent" obligatoire en preuve 5.** |
| `fldb8Y9IrrvMP9w0k` | socle_libelle | ✅ É0 | Format : "[Nom officiel pilier socle] ([code])" depuis REFERENTIEL_PILIERS. |
| `fldm2QaOvI5cKpLwg` | schema_intro_roles | ✅ **P-B** | **Intro rôles du schéma personnalisé.** Adapté aux rôles réels du candidat. |
| `fldXlpyU1EdUPBtIH` | schema_legende_socle | ✅ **P-B** | **Légende dominance socle dans le schéma.** Format : "votre [Socle] dépasse — c'est elle/lui qui appelle les renforts, jamais l'inverse". |

### Champs actifs — Ch.II Boucles (P-C)

| Field ID | Nom | Statut | Consigne précise |
|---|---|---|---|
| `fldFWT8vtfVuTm4zC` | ch2_boucle_intro | ✅ **P-C** | **Intro des boucles.** Définit "boucle" (1 phrase), puis l'architecture commune : par quel outil ça commence, avec quel outil ça dialogue, sur quel outil ça débouche, ce qui n'arrive jamais. ~300-450c. |
| `fldVM2cfim5rBivMt` | ch2_boucle_maillon1 | ✅ **P-C** | **M1 : Le point de départ (socle).** Badge "[Px] = point de départ". Format : "BADGE·TITRE / Attesté : N/25 / VERBATIMS : « v » (PqQn Lieu) / TEXTE : [~300-500c ancré sur comptages]" |
| `fldAZQSbNRxK8ugWo` | ch2_boucle_maillon2 | ✅ **P-C** | **M2 : Le dialogue (socle ⇄ amont).** Badge "[Px] ⇄ [Py]". Attesté : "Px→Py : n · Py→Px : m". Texte : aller-retour, ce que révèle le dialogue. |
| `fldKxUzxHTvZ6d3z5` | ch2_boucle_maillon3 | ✅ **P-C** | **M3 : Le débouché (socle → aval).** Badge "[Px] → [Py]". Attesté : "N/25". Texte : comment le verdict débouche sur l'action. |
| `fldzc8cjyygsfbC5N` | ch2_boucle_maillon4 | ✅ **P-C** | **M4 : Ce qui n'arrive jamais.** Badge "[Py] → [Px] : 0". Attesté : "0 réponse gouvernée par [l'aval]". Texte : ce que cette ABSENCE révèle. Pas de verbatims. |
| `fldRRLpspWX6qTx7d` | ch2_boucle_technique | ✅ **P-C** | **Registre technique labo.** Méthode et comptages bruts : dénominateur 25, définition M1-M4 en gouvernance, chiffres exacts, codes piliers. ~300-500c. Non affiché au candidat. |

### Champs actifs — Ch.III Marqueurs (P-D)

| Field ID | Nom | Statut | Consigne précise |
|---|---|---|---|
| `fldxCNvqR4qyYAYjr` | ch3_signal_intro | ✅ **P-D** | **Intro §05.** Définit "signal limbique" (trace émotionnelle dans les propres mots du candidat). Annonce le paysage émotionnel. ~250-400c. |
| `fldgeeC3lg3M89ESA` | ch3_signal_registres | ✅ **P-D** | **3 registres émotionnels récurrents.** Format : 3 blocs séparés par UNE ligne vide. Chaque bloc : "TITRE (Émotion — domaine) / TEXTE (~150-300c) / « verbatim EXACT » (PqQn Lieu)". Seuls registres récurrents et multi-situations. |
| `fld9x0yRmGnAhVFS4` | ch3_signal_cloture | ✅ **P-D** | **Clôture §05.** Lecture d'ensemble du paysage émotionnel : où ça coule, où ça frotte. ~200-350c. |
| `fldxZi0jRCWnXsVng` | ch3_cout_intro | ✅ **P-D** | **Intro §06.** Définit "zone de coût" : pas un manque — là où le moteur dépense plus parce que l'outil sollicité n'est pas celui qui gouverne. ~200-350c. |
| `fld0nyRitbejCsihG` | ch3_cout_principal | ✅ **P-D** | **Coût principal.** Format : "Coût principal / [Titre] / TEXTE : [~300-500c] / VERBATIMS : « verbatim EXACT » (PqQn Lieu)". Source : signal négatif récurrent × pilier faible × séquences de gouvernance. |
| `fld7JUPi80iqSKzzV` | ch3_cout_secondaire | ✅ **P-D** | **Coût secondaire.** Même format. |
| `fld1nB5UqVklCjikE` | ch3_cout_cloture | ✅ **P-D** | **Clôture §06 — texte FIGÉ** (3 messages : coût ≠ incapacité / stratégies existantes / savoir où ça coûte). **Aucune prescription, aucun conseil.** |
| `fldlkVPGScKwBpPQV` | ch3_technique | ✅ **P-D** | **Registre technique labo §03.** Comptages depuis T1 + signaux par valence/domaine + chiffres de gouvernance. Non affiché dans le template courant. |

### Vérifications T3_BILAN

| Field ID | Nom | Statut |
|---|---|---|
| `fldqZRT8LeETc2fx8` | profil_cognitif_json | ⚪ STATIQUE |
| `fldpqKcbU6KNVQhCF` | boucles_json | ⚪ STATIQUE |
| `fldfnxt1vq3VtlIpz` | verif_filtre | ⚪ STATIQUE |
| `fldzwtQvLNbCueLpV` | verif_soleil | ⚪ STATIQUE |
| `fldrTEo2LFQaAwZwd` | verif_boucles | ⚪ STATIQUE |
| `fldweZHoK0IxMVrmp` | verif_synthese | ⚪ STATIQUE |
| `fldWHMHUeEUNjqsDW` | verif_pilier_socle_mode | ⚪ STATIQUE |
| `fldexc6OHEKSUh8pb` | verif_rapport | ⚪ STATIQUE |
| `fld9gPxIxyVdWDaXz` | verif_statut | ⚪ STATIQUE — singleSelect : À FAIRE / EN COURS / CORRIGÉ / VALIDÉ |

---

## RÉCAPITULATIF COUVERTURE PROMPTS

| Prompt | Fichier | Champs produits | Nb |
|---|---|---|---|
| É0 | scripts | Identité, architecture, têtières, chiffres, verbatim_refs, circuit_nom, en_svc_Px, total, ordre, socle_libelle, liens | ~35 |
| **P-A** | **PROMPT_ANALYSE_PILIER_v9.md** | n3_nuance, explication_courte_ch4, **soleil_micro**, soleil_verbatim, verbatim_2..4, renfort_phrase, synth_bloc_×9 (technique+candidat+rattachement), synth_interpretee, synth_factuelle_coeur, synth_factuelle_elargie (+ emprunts reçus), pilier_mode, mode_explication, ch4_intro_eclate | **21** |
| P-B | PROMPT_FILTRE_CH4_v1.md | filtre, filtre_declinaison, ch4_filtre_revelation, ch4_filtre_preuves, schema_intro_roles, schema_legende_socle | 6 |
| P-C | PROMPT_CH2_BOUCLES_v1.md | ch2_boucle_intro, ch2_boucle_maillon1..4, ch2_boucle_technique | 6 |
| P-D | PROMPT_CH3_MARQUEURS_v1.md | ch3_signal_intro, ch3_signal_registres, ch3_signal_cloture, ch3_cout_intro, ch3_cout_principal, ch3_cout_secondaire, ch3_cout_cloture, ch3_technique | 8 |

---

## ANOMALIES

| # | Table | Champ | Description | Statut |
|---|---|---|---|---|
| A | T3_BILAN | `fldLt4GhtqRUyl7V4` pilier_socle_mode | Rémi : "Experimental et iteratif" (stale) vs "Intuitif et synthétique · Créatif et combinatoire" | ✅ **RÉSOLUE 16/06** |
| B | T3_PILIER | `fldhFisqhUf9oBLOe` pilier_role | Rémi P5 = "structurant_1" (faux) / P1 = "structurant_2" (faux) | ✅ **RÉSOLUE 16/06** — corrigés en "aval" et "amont" |

---

## RÈGLES CRITIQUES PERMANENTES

1. `verbatim_4_ref` = `fldQgruSXveuTCLM4` — **g pas b** (typo réelle vérifiée)
2. `nb_svc_P3` INVENTAIRE = `fldQbwuHBRywn2rzp` — **CORROMPU**, jamais utiliser
3. `circuit_freq` = nb_coeur (jamais total_activations)
4. `en_svc_Px` source = T3_CIRCUIT (jamais INVENTAIRE.nb_svc_Px)
5. T3_PILIER créé AVANT T3_CIRCUIT (pilier_link dépend du rec_id du T3_PILIER)
6. `signal limbique` = donnée É0 depuis ETAPE1_T2 — NE PAS analyser dans P-A
7. `cluster` interdit partout, y compris "aucun cluster détecté"
8. `pilier_mode` = manière de faire, pas une qualité
9. EN SOUTIEN = cœur 0 en échelle cœur (PAS FAIBLE) ; exception pilier entièrement sans cœur (échelle TOTAL)
10. Méthode des facettes OBLIGATOIRE pour >4 verbatims disponibles
11. Emprunts reçus OBLIGATOIRES dans synth_factuelle_elargie (fournis en entrée P-A)
