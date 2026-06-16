# INVENTAIRE COMPLET — TOUTES TABLES DU PIPELINE
Base `appgghhXjYBdFRras` · **v3** · 16/06/2026
Remplace toutes versions précédentes.

> Tables documentées : VISITEUR · REFERENTIEL_PILIERS · REFERENTIEL_PROFILS · REFERENTIEL_CIRCUITS · REFERENTIEL_CIRCUITS_CANDIDATS · RESPONSES · ETAPE1_T1 · ETAPE1_T2 · ETAPE1_T2_VENTILATION_PILIERS · ETAPE1_T2_INVENTAIRE_CIRCUITS · ETAPE1_T3_BILAN · ETAPE1_T3_PILIER · ETAPE1_T3_CIRCUIT
> Tables exclues (hors pipeline bilan cognitif) : ETAPE2_*, BILAN/ex_BILAN/Copie de BILAN, MATCHING_*, GRILLE_DRH_*, AUTOTEST_*, ZONES/PROFILS/PILIERS/CONTENUS_PIVAR, BILAN_SOURCING, BILAN_DESALIGNEMENT, BOUTONS_CTA, Table_PRODUITS, Table_TRANSACTIONS, CODES_GRATUITE, DCO_RESULTS, questions_pivar_scenario, old_*, Copie de *

## LÉGENDE STATUTS
- ✅ **É0** — calculé ou copié mécaniquement (script, zéro LLM)
- ✅ **P-A** — `PROMPT_ANALYSE_PILIER_v9.md` (×5 appels)
- ✅ **P-B** — `PROMPT_FILTRE_CH4_v1.md` (×1 appel)
- ✅ **P-C** — `PROMPT_CH2_BOUCLES_v1.md` (×1 appel)
- ✅ **P-D** — `PROMPT_CH3_MARQUEURS_v1.md` (×1 appel)
- 🔵 **SOURCE** — table source lue par le pipeline (jamais écrite par les agents)
- ⚪ **STATIQUE** — champ non rendu dans le template courant ou valeur fixe
- ⚠️ **PÉRIMÉ** — ne pas alimenter
- ❌ **NON UTILISÉ** — champ présent en base mais hors scope pipeline

---

## 1. VISITEUR (`tblslPP9B71FveOX5`) — 152 champs
Table maître des candidats. Lue par É0 pour identité et statut.

| Field ID | Nom | Rôle pipeline | Note |
|---|---|---|---|
| `fldlgXp1LGZQWeDzi` | candidate_ID | 🔵 SOURCE clé | Identifiant unique du candidat — filtrage principal dans TOUTES les tables |
| `fldW0C6TN7EGFULh1` | civilite_candidat | 🔵 SOURCE | Copié dans T3_BILAN.civilite_candidat |
| `fldqmuzbgbHyqfBeC` | Prenom | 🔵 SOURCE | Copié dans T3_BILAN.Prenom |
| `fldWcwRXpLCxzfgBr` | Nom | 🔵 SOURCE | Copié dans T3_BILAN.Nom |
| `fldVWOmmRAnf82oiT` | Entreprise | 🔵 SOURCE | Disponible pour le bilan si besoin |
| `fldPU7W2CPftbNH1m` | Email | 🔵 SOURCE | Envoi bilan |
| `fldtv5fR6y2jFJTfL` | statut_test | 🔵 SOURCE | singleSelect — état du passage du test |
| `fldyMwpcU1v9pwrYp` | statut_analyse_pivar | 🔵 SOURCE | singleSelect — état de l'analyse cognitive |
| `fldZY6FWmg2OXUwKJ` | ETAPE1_T3_BILAN | 🔵 SOURCE | Lien vers T3_BILAN du candidat |
| `fldhHRHJXxfHOafNx` | RESPONSES | 🔵 SOURCE | Lien vers tous les records RESPONSES |
| *autres (140 champs)* | backup_*, lien_*, email_*_envoye, validation_*, DCO_*, MATCHING_*, abonnement_*, etc. | ❌ NON UTILISÉ | Champs opérationnels/CRM hors pipeline analytique |

---

## 2. REFERENTIEL_PILIERS (`tblf4OodQ2Qi5xSXs`) — 14 champs
Source authoritative des noms officiels des piliers. **Ne jamais hard-coder les noms.**

| Field ID | Nom | Rôle pipeline | Note |
|---|---|---|---|
| `fldgf7XGb55eTroKn` | pilier_code | 🔵 SOURCE | P1..P5 |
| `fldI2u7FxkWhdGoot` | pilier_nom | 🔵 **SOURCE CLEF** | Nom officiel complet — source de T3_PILIER.pilier_label et T3_BILAN.pilier_*_label |
| `fldbuAd73rLEIehUC` | pilier_intitule_court | 🔵 SOURCE | Forme courte ("l'Analyse", "la Collecte"…) |
| `fldEgnhkVHLlp8VXO` | verbes_caracteristiques | 🔵 SOURCE | Verbes types du pilier |
| `fldZGofaqQmin073p` | ce_qu_est | 🔵 SOURCE | Définition doctrinale |
| `fldChQNXT7LJo6Qma` | ce_qu_on_peut_faire | 🔵 SOURCE | |
| `fldwGBtPNleyDAgpe` | structure_interne | 🔵 SOURCE | |
| `fldmijqL3FO98Ljux` | nb_modes | 🔵 SOURCE | Nombre de modes possibles |
| `fldN7NUPBmkkMSM0w` | modes_liste | 🔵 SOURCE | Liste des modes — base de suggestion pour P-A CAS B |
| `fldmucO3gwEc98K08` | regles_critiques | 🔵 SOURCE | Règles doctrinales du pilier |
| `fldXNDaygkBLVEdse` | illustrations_terrain | 🔵 SOURCE | |
| `fld8leCY8qoucRfPM` | source_v36_section | 🔵 SOURCE | Référence interne |
| `fldaDoaNkDmBJUVpQ` | version_doctrine | 🔵 SOURCE | |
| `fld3Wqa3WYnFIpcYm` | derniere_mise_a_jour | 🔵 SOURCE | |

---

## 3. REFERENTIEL_PROFILS (`tblLTxeKoRa9m8io7`) — 5 champs
35 profils-types par pilier. Fournis en entrée P-A comme base de suggestion pour le mode (CAS B).

| Field ID | Nom | Rôle pipeline | Note |
|---|---|---|---|
| `fldSVjfx7fiqmNdJc` | pilier | 🔵 SOURCE | P1..P5 — filtre par pilier |
| `fldT4KInNV3JdfS7A` | profil_id | 🔵 SOURCE | Identifiant numérique |
| `fldGmwZVzaVNts203` | profil_nom | 🔵 SOURCE | Label du profil-type |
| `fldK84i0RPwiXCgYH` | profil_description | 🔵 SOURCE | Description |
| `fldWPovkZEmVaAZXu` | source_v36 | 🔵 SOURCE | Référence doctrine |

---

## 4. REFERENTIEL_CIRCUITS (`tbllMoTjOsILuzR6m`) — 5 champs
75 circuits (15 par pilier). Source des noms officiels et gestes. **Ne jamais hard-coder.**

| Field ID | Nom | Rôle pipeline | Note |
|---|---|---|---|
| `fldYUFKjWvPZWGXva` | pilier | 🔵 SOURCE | P1..P5 |
| `fldLrUbZhzYvYYf1I` | circuit_id | 🔵 SOURCE | C1..C15 |
| `fldaRcdCErwKZfLft` | circuit_nom | 🔵 **SOURCE CLEF** | Nom officiel — copié dans T3_CIRCUIT.circuit_nom |
| `fldS4sVj4FxFofcqJ` | geste | 🔵 SOURCE | Geste défini par le référentiel. Copié dans T3_CIRCUIT.n1_definition (optionnel). **INTERDIT comme base de l'explication P-A** (la LOI ABSOLUE l'interdit) |
| `fld470aw1h3cnh2Ej` | source_v36 | 🔵 SOURCE | Référence doctrine |

---

## 5. REFERENTIEL_CIRCUITS_CANDIDATS (`tblUDy7QTOzMMkhEK`) — 14 champs
Circuits ADHOC créés sur mesure pour un candidat. Lus par É0 et injectés dans l'entrée P-A.

| Field ID | Nom | Rôle pipeline | Note |
|---|---|---|---|
| `fldfFV0F878K5TeI5` | nom_propose | 🔵 SOURCE | Nom du circuit ADHOC |
| `flddidBYNw23L32LN` | pilier_principal | 🔵 SOURCE | Pilier d'appartenance |
| `fldSEi5aVsw0zFTSU` | geste_propose | 🔵 SOURCE | Geste défini sur mesure |
| `fldZt2lGIIUN6Z68K` | occurrences_pilier_principal | 🔵 SOURCE | Fréquence cœur dans le pilier principal |
| `fldiPbu2c8cLY6wRs` | occurrences_autres_piliers | 🔵 SOURCE | Fréquence instrumentale |
| `fldyxdDDkQTyClhSi` | candidats_concernes | 🔵 SOURCE | Liste des candidat_id concernés |
| `fldiLQOTpvuari0yR` | questions_concernees | 🔵 SOURCE | Questions sources |
| `fld0MYA18SXngzwFz` | verbatim_source_premier | 🔵 SOURCE | Verbatim fondateur du circuit ADHOC — cité dans P-A |
| `fldoNY0qoVhA5c7Jh` | circuits_proches_envisages | 🔵 SOURCE | Circuits officiels proches |
| `fldd0CVG9YRrTQwj3` | statut | 🔵 SOURCE | PROMU_AUTO / VALIDE |
| `fldSe5gK7t8KO7LWb` | circuit_officiel_apres_promotion | 🔵 SOURCE | Code circuit si promu |
| `fldFm1geBeL0TEYfD` | date_premiere_detection | 🔵 SOURCE | |
| `fldEpckt6kvaupIzw` | date_derniere_mise_a_jour | 🔵 SOURCE | |
| `fldzwyWjGoeo2UGEo` | commentaire_validation | 🔵 SOURCE | |

---

## 6. RESPONSES (`tblK28GE8RWq9tQMV`) — 32 champs
Réponses brutes aux questions. Lues par É0 pour construire les verbatims et calculs de gouvernance.

| Field ID | Nom | Rôle pipeline | Note |
|---|---|---|---|
| `fldD6c9DdWkVpZvMg` | session_ID | 🔵 SOURCE clé | Lien vers VISITEUR.candidate_ID |
| `fldXIGBLwTBHaaLtZ` | scenario_nom | 🔵 SOURCE | Scénario de la question (Sommeil, Weekend, Animal, Panne) |
| `fldFgNVoNt5st0CXx` | id_question | 🔵 SOURCE | Identifiant de la question |
| `fldQrqijKBZPcBD4f` | numero_global | 🔵 SOURCE | Numéro global de la question (1-25) |
| `fldl8bM45ANu5wQ9B` | pilier | 🔵 SOURCE | Pilier gouvernant cette réponse |
| `fldPEHxIIJwYIOs2Q` | response_text | 🔵 **SOURCE VERBATIM** | Texte brut de la réponse du candidat |
| `fldVepvgG6umwwG3R` | cog_pilier_gouverne | 🔵 **SOURCE GOUVERNANCE** | Pilier qui gouverne cette réponse — utilisé pour les comptages P-D (ch3_boucle_technique) |
| `flds9z8tH5Zg0dbfk` | cog_gouverne_commentaire | 🔵 SOURCE | Commentaire sur la gouvernance |
| `fldmiRoHDDJt8pQpx` | cog_pilier_sortie | 🔵 SOURCE | Pilier de sortie |
| `fldcKE6Erz5DWKkcC` | cog_comprend | 🔵 SOURCE | Ce que l'analyse comprend |
| `fldunWgxM8I5RZdAB` | cog_outils_mobilises | 🔵 SOURCE | Outils cognitifs mobilisés |
| `fldmsr4iQXycEfWZA` | cog_resultat_vise | 🔵 SOURCE | Finalité de la réponse |
| `fldSFuJ5ai6OpDkvO` | v2_analyse | 🔵 SOURCE | Analyse v2 |
| *autres* | Prenom, Nom, Email (from links), VISITEUR, BILAN, v2_* | ❌ NON UTILISÉ | Lookups et champs de liaison hors pipeline analytique direct |

---

## 7. ETAPE1_T1 (`tblPzRzaehA7BPkLr`) — 41 champs
Analyse verbatim question par question (étape 1.1). Source du signal limbique et des piliers coeur par réponse.

| Field ID | Nom | Rôle pipeline | Note |
|---|---|---|---|
| `fldS3DReACm4aHCos` | candidat_id | 🔵 SOURCE clé | Filtrage par candidat |
| `fldAiJZUuV837fvjt` | question_id_protocole | 🔵 SOURCE | ID de la question (P1Q1..P5Q5) |
| `fldSld8Vm5Yla57My` | scenario | 🔵 SOURCE | Scénario (Sommeil / Weekend / Animal / Panne) |
| `fldFvvYlbKkpAV6Az` | pilier_demande | 🔵 SOURCE | Pilier sollicité par la question |
| `fld82LIN5yt068XBu` | verbatim_candidat | 🔵 **SOURCE VERBATIM BRUT** | Texte brut de la réponse |
| `fldZCwKuLvVMff2oT` | pilier_coeur | 🔵 **SOURCE PILIER CŒUR** | Pilier qui gouverne cette réponse |
| `fldHU87BYYfx9XTli` | pilier_coeur_analyse | 🔵 SOURCE | Justification du pilier cœur |
| `fldkk2GgfmSl2BLoY` | piliers_secondaires | 🔵 SOURCE | Piliers instrumentaux |
| `fldzmPm3as5AWKNFT` | types_verbatim | 🔵 SOURCE | Types de verbatim détectés |
| `fldbSyz1ROvIepXgc` | types_verbatim_circuits | 🔵 SOURCE | Circuits activés par cette réponse |
| `fldl8GiYTgbGONdnN` | nb_activations_coeur | 🔵 SOURCE | Nb activations cœur dans cette réponse |
| `fld2V54ixKpAPyMor` | detail_circuits_coeur | 🔵 SOURCE | Détail des circuits cœur |
| `fldiA0hLr3LrUbQNC` | detail_circuits_instrumentaux | 🔵 SOURCE | Détail des circuits instrumentaux |
| `fldZA9RVR3XtKEmsI` | signal_limbique | 🔵 **SOURCE SIGNAL** | Signal limbique détecté dans cette réponse — agrégé dans INVENTAIRE_CIRCUITS pour P-A |
| `fldaf2RlRjn5Jr2qX` | finalite_reponse | 🔵 SOURCE | Finalité cognitive de la réponse |
| `fldREMZRIzqUrcQui`..`fldSNPj12xDhgnxiM` | nb_P1_instru..nb_P5_instru | 🔵 SOURCE | Nb activations instrumentales par pilier dans cette réponse |
| `fldnnnF54QlQ59gjd`..`fldSNPj12xDhgnxiM` | detail_P1_instru..detail_P5_instru | 🔵 SOURCE | Détail des activations instrumentales |
| `fldvmO3i3D6AL4Bt3` | pilier_finalite_libelle | 🔵 SOURCE | |
| `fldpDWkzteLxVwOrg` | outil_cognitif_libelle | 🔵 SOURCE | |
| *autres* | question_texte, storytelling, transition, v2_* | ⚪ STATIQUE | Contexte de la question, non utilisé directement dans les agents |

---

## 8. ETAPE1_T2 (`tblaGd3ixAWxbJJp2`) — 35 champs
**TABLE SOURCE PRINCIPALE DE P-A.** 1 record par circuit actif × candidat (verbatims structurés, agrégés depuis T1).
Filtre : `fldbHyiLdkkRU6B0J` (candidat_id) + `fldkByLh883MLtHB3` (pilier).

| Field ID | Nom | Rôle pipeline | Note |
|---|---|---|---|
| `fldbHyiLdkkRU6B0J` | candidat_id | 🔵 **SOURCE CLÉ** | **Champ de filtrage principal** — utiliser `returnFieldsByFieldId: true` |
| `fldzG95a4ILqMEbKz` | session_ID | 🔵 SOURCE | |
| `fldxAMTSzWbyHt7qS` | id_question | 🔵 SOURCE | Identifiant question |
| `fldkByLh883MLtHB3` | pilier | 🔵 **SOURCE** | Pilier du circuit (P1..P5) |
| `fldf3Rfux16asTI0I` | circuit_id | 🔵 **SOURCE** | Code circuit (C1..C15 ou ADHOC) |
| `fldWZ4Wjk51XI1bbc` | circuit_nom | 🔵 SOURCE | Nom du circuit |
| `fldNIOH7wzrgEuxle` | frequence | 🔵 SOURCE | Fréquence agrégée |
| `fldSWJbE4YpODAesk` | niveau_activation | 🔵 SOURCE | HAUT / MOYEN / FAIBLE / EN SOUTIEN |
| `fldHd6KNM11jQTcts` | types_verbatim_detail | 🔵 **SOURCE VERBATIMS** | **Verbatims détaillés par question** — source principale pour P-A (textes à citer) |
| `fld7WdC28gujm2ojq` | activations_franches | 🔵 SOURCE | Activations franches |
| `fldkU3FoTtQKtEgLD` | activations_nuancees | 🔵 SOURCE | Activations nuancées |
| `fldWlSKIGYrtvEBCT` | candidature_resistant_score | 🔵 **SOURCE SIGNAL** | = signal limbique du circuit (FORT / MODÉRÉ / NEUTRE / NÉGATIF) |
| `fldnDxnEc3uLoAknN` | candidature_resistant_raison | 🔵 **SOURCE SIGNAL** | = explication du signal limbique |
| `fldIaEHo9KjMfX01h` | circuit_personnalise | 🔵 SOURCE | Flag ADHOC |
| `fldHImIFuOqg0ryPP` | total_activations_pilier | 🔵 SOURCE | Total activations pour ce pilier |
| `fldtm6GkDiTnz5Lce` | actif | 🔵 SOURCE | Flag circuit actif |
| `fldOM5sNXEHBDAv1e` | types_verbatim_brut | 🔵 SOURCE | Verbatims bruts |
| `fldYZIvT2gMtumy6O` | analyse_commentee_pilier | 🔵 SOURCE | Commentaire d'analyse |
| *autres* | cluster_* (concepts abolis 11/06), score_concentration_*, cog_* | ⚠️ PÉRIMÉ / ❌ NON UTILISÉ | Concepts "cluster" abolis — ne pas utiliser |

---

## 9. ETAPE1_T2_VENTILATION_PILIERS (`tbl4UzvAMQY4nRnI5`) — 22 champs
Architecture du candidat : rang de chaque pilier, activations cœur et instrumentales.
**Lue par É0** pour construire l'architecture (socle / amont / aval / fonctionnel) et les totaux.

| Field ID | Nom | Rôle pipeline | Note |
|---|---|---|---|
| `fldElNhexmTf6w73F` | candidat_id | 🔵 **SOURCE CLÉ** | Filtrage |
| `fldMEeJLkjVaYxbCR` | session_ID | 🔵 SOURCE | |
| `fldDzu3P3ryAT5eTt` | pilier_coeur | 🔵 **SOURCE** | Code pilier (P1..P5) |
| `fldQAWYnjCOTFWBGQ` | pilier_coeur_libelle | 🔵 SOURCE | Nom du pilier |
| `fldZqTLiapVQSznq0` | rang_par_frequence | 🔵 **SOURCE CLÉ** | **Rang 1=socle · 2=str1 · 3=str2 · 4=fn1 · 5=fn2** — détermine l'architecture |
| `fldJZFcOK2bwlyM47` | nb_reponses | 🔵 SOURCE | Nb de réponses où ce pilier gouverne |
| `fldSG0wK5sTaENxGZ` | pct_reponses | 🔵 SOURCE | % des réponses |
| `flddntGV77W5qGzeH` | nb_activations_coeur_total | 🔵 **SOURCE** | Total activations cœur du pilier |
| `fld8UKT1TsJo3Bnw2` | nb_activations_instru_total | 🔵 **SOURCE** | Total activations instrumentales du pilier |
| `fld9JryA4ElBgVs7P` | ventilation_circuits_coeur | 🔵 SOURCE | Détail circuits cœur |
| `fldClXcEXZaKRfLMm` | ventilation_P1_instru | 🔵 SOURCE | Détail activations instrumentales reçues de P1 |
| `fld8EBNHIAqtb3wUj` | ventilation_P2_instru | 🔵 SOURCE | idem P2 |
| `fldWwLgex6bg86ObP` | ventilation_P3_instru | 🔵 SOURCE | idem P3 |
| `fldAM2FdMItfIOXDO` | ventilation_P4_instru | 🔵 SOURCE | idem P4 |
| `fld8C6k6451r2psZd` | ventilation_P5_instru | 🔵 SOURCE | idem P5 |
| `fldSRhNuuV0xQOyfO` | nb_P1_instru_total | 🔵 **SOURCE** | Total activations instrumentales reçues de P1 → sert à calculer emprunts_recus pour P-A |
| `fldy0W12fOkasKOhJ` | nb_P2_instru_total | 🔵 **SOURCE** | idem P2 |
| `fldo9QMZ1o4NjtyRq` | nb_P3_instru_total | 🔵 **SOURCE** | idem P3 |
| `fld8G1aMlYcLRNLLc` | nb_P4_instru_total | 🔵 **SOURCE** | idem P4 |
| `fldbsVPd3DxIy0Slv` | nb_P5_instru_total | 🔵 **SOURCE** | idem P5 |
| `fld4ujaBtKaad5Utz` | liste_id_questions | 🔵 SOURCE | Questions concernées |

---

## 10. ETAPE1_T2_INVENTAIRE_CIRCUITS (`tblUHZjXIW9jp9nIf`) — 16 champs
Chiffres cœur/total/instrumental par circuit × candidat. **Source authoritative pour circuit_freq et en_svc_Px.**
⚠️ `nb_svc_P3` (`fldQbwuHBRywn2rzp`) **CORROMPU** — ne jamais utiliser.

| Field ID | Nom | Rôle pipeline | Note |
|---|---|---|---|
| `fldBdSBJUBvLHYPdo` | candidat_id | 🔵 **SOURCE CLÉ** | Filtrage |
| `fldWInB63lYApVz8G` | session_ID | 🔵 SOURCE | |
| `fldjbr1Ej7Dosb6S6` | circuit_label | 🔵 SOURCE | Label lisible |
| `fldSudlYoCeU2cOqz` | pilier_owner | 🔵 **SOURCE** | Pilier propriétaire du circuit |
| `fldPF1xvYiONGiOAA` | circuit_id | 🔵 **SOURCE** | Code circuit |
| `fld0SuUut21rToKbj` | circuit_origine | 🔵 SOURCE | STANDARD / ADHOC |
| `fldN23mYABvdVE1ok` | nom_ad_hoc | 🔵 SOURCE | Nom si ADHOC |
| `fld8nEBQqdLqQqe1b` | **nb_coeur** | 🔵 **SOURCE CLÉ** | **Activations cœur** → T3_CIRCUIT.circuit_freq et calcul circuit_niveau |
| `fldUFMnbQl8NJAwgl` | nb_svc_P1 | 🔵 **SOURCE** | Activations instrumentales vers P1 → T3_CIRCUIT.en_svc_P1 |
| `fldGyYvWzGiY9jlXb` | nb_svc_P2 | 🔵 **SOURCE** | idem P2 |
| `fldQbwuHBRywn2rzp` | **nb_svc_P3** | ⚠️ **CORROMPU** | **NE JAMAIS UTILISER** — valeur corrompue prouvée. Utiliser T3_CIRCUIT.en_svc_P3 après correction manuelle. |
| `fldgAjStrMoLleMbA` | nb_svc_P4 | 🔵 **SOURCE** | idem P4 |
| `fldBo3HMIhu5Fpn77` | nb_svc_P5 | 🔵 **SOURCE** | idem P5 |
| `fldzV8udGk3eQ58No` | **total_activations** | 🔵 **SOURCE CLÉ** | **Total toutes activations** → T3_CIRCUIT.total_activations |
| `fld76259zIzR6XVRB` | rang_dans_pilier | 🔵 SOURCE | Rang du circuit dans son pilier |
| `fldqh3QexGTa3QXkX` | Name | ⚪ STATIQUE | Champ primaire auto-généré |

---

## 11. ETAPE1_T3_BILAN (`tblv775KQrEhsogdI`) — 138 champs
1 record par candidat. Filtre : `fldk66gddYGCREOV4` (candidat_id).

### Identité & Architecture (É0)

| Field ID | Nom | Statut | Consigne |
|---|---|---|---|
| `fldk66gddYGCREOV4` | candidat_id | ✅ É0 | Champ de filtrage principal |
| `fld8yjgv2jIp2dzvW` | civilite_candidat | ✅ É0 | Depuis VISITEUR |
| `fldFjVTaedAE8iXkU` | Prenom | ✅ É0 | Depuis VISITEUR |
| `fldsOkyWddI15pqgU` | Nom | ✅ É0 | Depuis VISITEUR |
| `fldBlTX1Fuiv81mRc` | version_bilan | ✅ É0 | Version courante |
| `fldfJHsX7A38IYele` | pilier_socle | ✅ É0 | Code pilier socle (P1..P5) |
| `fldUf6rhEyR3MKI1x` | pilier_socle_label | ✅ É0 | Nom officiel depuis REFERENTIEL_PILIERS |
| `fldLt4GhtqRUyl7V4` | pilier_socle_mode | ✅ É0 (resync T3_PILIER) | Source authoritative = T3_PILIER.pilier_mode. **Anomalie Rémi RÉSOLUE 16/06.** |
| `fldBMHWSk6DsnRN2i` | pilier_socle_role | ✅ É0 | "socle" |
| `fldzsZUsyQR7vvbEi` | pilier_str1 | ✅ É0 | Code pilier str1 |
| `fldVwPsne8uUxYbOG` | pilier_str1_label | ✅ É0 | Nom officiel str1 |
| `fld9wiwYRbBf1Eu1s` | pilier_str1_sorties | ✅ É0 | Nb sorties instrumentales str1 |
| `fldefRzq9hqbn4gHn` | pilier_str2 | ✅ É0 | Code pilier str2 |
| `fld1mfPfxoQNXxPR5` | pilier_str2_label | ✅ É0 | Nom officiel str2 |
| `fldad4ntutJO9lesl` | pilier_str2_sorties | ✅ É0 | Nb sorties str2 |
| `fld5kBccd13uSx9ll` | pilier_fn1 | ✅ É0 | Code pilier fonctionnel 1 |
| `fld8vqxt3y7AmvCud` | pilier_fn1_label | ✅ É0 | Nom officiel fn1 |
| `fldcEfmIax60HZZPJ` | pilier_fn1_sorties | ✅ É0 | Nb sorties fn1 |
| `fldyw87BmzorCZ93j` | pilier_fn2 | ✅ É0 | Code pilier fonctionnel 2 |
| `fldexYDVC5sLzBsJH` | pilier_fn2_label | ✅ É0 | Nom officiel fn2 |
| `fldKRf4ixcN7bOE04` | pilier_fn2_sorties | ✅ É0 | Nb sorties fn2 |
| `fld1VX56hmKEE5Jq2` | sorties_P1 | ✅ É0 | Total activations instrumentales sortantes P1 |
| `fldPrsVmktnmYYgQ2` | sorties_P2 | ✅ É0 | idem P2 |
| `fld23tLTuIWHyLcRs` | sorties_P3 | ✅ É0 | idem P3 |
| `fldiTpqZAsWuKiZML` | sorties_P4 | ✅ É0 | idem P4 |
| `fldu2FJSPYmjkFCUt` | sorties_P5 | ✅ É0 | idem P5 |
| `fld0i2Xr5A07KJZOC` | ETAPE1_3_BILAN_PILIER | ✅ É0 | Lien vers les 5 records T3_PILIER |
| `fld8F9KkASvL3Gqet` | ETAPE1_3_BILAN_CIRCUIT | ✅ É0 | Lien vers les N records T3_CIRCUIT |

### Champs actifs Ch.IV Filtre (P-B)

| Field ID | Nom | Statut | Consigne résumée |
|---|---|---|---|
| `fld9vAKpKEMIcRiTB` | filtre | ✅ **P-B** | Filtre cognitif ≤15 mots. Permanence : §00 + §02 + schéma + §07 |
| `fld1p9p9Csvyllvcm` | filtre_declinaison | ✅ **P-B** | Déclinaison en questions directes |
| `fldqDeT7EDov18iTz` | ch4_filtre_revelation | ✅ **P-B** | Révélation axe par axe ~350-550c |
| `fldXGZ5ijlcGPYc16` | ch4_filtre_preuves | ✅ **P-B** | 5 preuves structurées |
| `fldb8Y9IrrvMP9w0k` | socle_libelle | ✅ É0 | "[Nom pilier socle] ([code])" |
| `fldm2QaOvI5cKpLwg` | schema_intro_roles | ✅ **P-B** | Intro rôles du schéma |
| `fldXlpyU1EdUPBtIH` | schema_legende_socle | ✅ **P-B** | Légende dominance socle |

### Champs actifs Ch.II Boucles (P-C)

| Field ID | Nom | Statut | Consigne résumée |
|---|---|---|---|
| `fldFWT8vtfVuTm4zC` | ch2_boucle_intro | ✅ **P-C** | Intro boucles ~300-450c |
| `fldVM2cfim5rBivMt` | ch2_boucle_maillon1 | ✅ **P-C** | M1 point de départ (socle) |
| `fldAZQSbNRxK8ugWo` | ch2_boucle_maillon2 | ✅ **P-C** | M2 dialogue socle ⇄ amont |
| `fldKxUzxHTvZ6d3z5` | ch2_boucle_maillon3 | ✅ **P-C** | M3 débouché socle → aval |
| `fldzc8cjyygsfbC5N` | ch2_boucle_maillon4 | ✅ **P-C** | M4 ce qui n'arrive jamais |
| `fldRRLpspWX6qTx7d` | ch2_boucle_technique | ✅ **P-C** | Registre technique labo |

### Champs actifs Ch.III Marqueurs (P-D)

| Field ID | Nom | Statut | Consigne résumée |
|---|---|---|---|
| `fldxCNvqR4qyYAYjr` | ch3_signal_intro | ✅ **P-D** | Intro §05 ~250-400c |
| `fldgeeC3lg3M89ESA` | ch3_signal_registres | ✅ **P-D** | 3 registres émotionnels |
| `fld9x0yRmGnAhVFS4` | ch3_signal_cloture | ✅ **P-D** | Clôture §05 ~200-350c |
| `fldxZi0jRCWnXsVng` | ch3_cout_intro | ✅ **P-D** | Intro §06 — définit "zone de coût" |
| `fld0nyRitbejCsihG` | ch3_cout_principal | ✅ **P-D** | Coût principal ~300-500c |
| `fld7JUPi80iqSKzzV` | ch3_cout_secondaire | ✅ **P-D** | Coût secondaire — même format |
| `fld1nB5UqVklCjikE` | ch3_cout_cloture | ✅ **P-D** | Clôture §06 — texte FIGÉ |
| `fldlkVPGScKwBpPQV` | ch3_technique | ✅ **P-D** | Registre technique labo |

### Champs périmés T3_BILAN (⚠️ ne pas alimenter)
filtre_label · filtre_preuve_1..5 · filtre_lecture_candidat · glissement_* · boucle_intro + boucle_1..3 · signal_type + signal_intro + signal_item1..4 + signal_synthese · cout1..3 · sig_* · vueglobale_* · lexique_* · note_profil_global

### Vérifications T3_BILAN (⚪ STATIQUE)
profil_cognitif_json · boucles_json · verif_filtre · verif_soleil · verif_boucles · verif_synthese · verif_pilier_socle_mode · verif_rapport · verif_statut (À FAIRE / EN COURS / CORRIGÉ / VALIDÉ)

---

## 12. ETAPE1_T3_PILIER (`tblzDIn7P2cOvVvY2`) — 41 champs
1 record par pilier × candidat (5 records). **Créé AVANT T3_CIRCUIT** (contrainte absolue).

| Field ID | Nom | Statut | Consigne résumée |
|---|---|---|---|
| `fldiL5nkdk50zFwkX` | pilier_uid | ✅ É0 | Clé primaire |
| `fld4vR7DGcEVCzz32` | bilan_link | ✅ É0 | Lien vers T3_BILAN |
| `fldZKruIBDdjAsY47` | candidat_id | ✅ É0 | Copie du candidat_id |
| `fldVvi5gbKioBmlsQ` | pilier | ✅ É0 | P1..P5 |
| `fldbDYECHFEGkh0Ng` | pilier_label | ✅ É0 | Depuis REFERENTIEL_PILIERS.pilier_nom |
| `fldhFisqhUf9oBLOe` | pilier_role | ✅ É0 | **socle / amont / aval / fonctionnel** (valeurs corrigées 16/06) |
| `fld1X3FQYRcxB2Qwy` | pilier_role_label | ✅ É0 | Libellé court pour têtière |
| `fldoGY71vyiaUeFl6` | **pilier_mode** | ✅ **P-A** + [validation] | **SOURCE AUTHORITATIVE du mode.** CAS A : recopié / CAS B : P-A propose |
| `fldg5DCdL9U523YfG` | nb_activations | ✅ É0 | Total activations cœur du pilier |
| `fldtUV0KYT0zyjg0J` | nb_circuits_actifs | ✅ É0 | Circuits avec ≥1 activation |
| `fldUmfMvtMEsADKFX` | nb_circuits_haut | ✅ É0 | Circuits cœur ≥4 |
| `fldCM0X6TsHYLQ0YD` | synth_factuelle_coeur | ✅ **P-A** | Inventaire factuel cœur — CAS 1 repris tel quel / CAS 2 construit |
| `fldKkGWMbDy4csrOg` | synth_factuelle_elargie | ✅ **P-A** | Inventaire factuel élargi — **EMPRUNTS REÇUS OBLIGATOIRES** |
| `fldho6MPGr5J5QmPu` | synth_interpretee | ✅ **P-A** | Vue d'ensemble — **gabarit 5 sections imposé**, titre §3 "en renfort" |
| `flds6XOIwvYr20iRY` | synth_bloc_haut_technique | ✅ **P-A** | "Bloc HAUT cœur :" + Facettes dominantes obligatoires |
| `fldBLvofzosLTPUOr` | synth_bloc_haut_candidat | ✅ **P-A** | M1 + M2 — zéro code |
| `fldB9fRf8U61z4WZK` | synth_bloc_haut_rattachement | ✅ **P-A** | "sont ce que le protocole nomme" |
| `fld7Sv7LXlZ6XPghN` | synth_bloc_moyen_technique | ✅ **P-A** | "Bloc MOYEN cœur :" |
| `flda16lg5Dt1HrXrF` | synth_bloc_moyen_candidat | ✅ **P-A** | M1 + M2 |
| `fldMA46pZRI6Bi0ZU` | synth_bloc_moyen_rattachement | ✅ **P-A** | "sont ce que le protocole nomme" |
| `fld6BWLEjDMdbYTs6` | synth_bloc_faible_technique | ✅ **P-A** | "Bloc FAIBLE/APPUI :" — FAIBLE + EN SOUTIEN fusionnés |
| `fld68H41z6b9XtFoZ` | synth_bloc_faible_candidat | ✅ **P-A** | FAIBLE + EN SOUTIEN fusionnés — zéro code |
| `fldZiSdH20uMb5wCY` | synth_bloc_faible_rattachement | ✅ **P-A** | "portent leur étiquette" (JAMAIS "protocole nomme") |
| `fldomziXNOGf7Ujsb` | ch4_intro_eclate | ✅ **P-A** | 1 phrase **≤ 20 mots** selon le rôle |
| `fld6GtEBRP5UxvHeI` | mode_explication | ✅ **P-A** | Amorce **"Ce mode découle directement..."** obligatoire |
| `fldk6MQ7KR3n9L5wu` | pilier_role_label_detail | ✅ É0 | Libellé détaillé têtière |
| `fldaSofvHZk2K2SXw` | pilier_rappel_detail | ✅ É0 | Format "Activation N · Total M · K circuits..." |
| `fldtZdnuftdhGx2mb` | ETAPE1_3_BILAN_CIRCUIT | ✅ É0 | Lien vers les T3_CIRCUIT de ce pilier |
| `fldIzsomwbdploHdS` | pilier_mode_vueglobale | ⚠️ PÉRIMÉ | Doublon vidé 11/06 — ne pas alimenter |
| `fldfpEzRkoHqXHmJ2` | cluster_label | ⚠️ PÉRIMÉ | Concept aboli 11/06 |
| `fldNbdQTQFrL9MmLv` | cluster_detail | ⚠️ PÉRIMÉ | idem |
| `fldcGtODAh6b0vZs5` | synth_factuelle | ⚠️ PÉRIMÉ | Doublon — ne pas alimenter |
| `fldKax0VwI4BhnLKV` | tableau_note | ⚪ STATIQUE | Non rendu dans le template |
| `fld6qIK9UOZPAE59k` | pilier_rappel | ⚪ STATIQUE | Remplacé par pilier_rappel_detail |
| *verif_** | verif_pilier_mode · verif_synth_factuelle · verif_synth_interpretee · verif_tableau_note | ⚪ STATIQUE | Vérification post-production |

> **Note** : `mode_statut` (FOURNI/PROPOSITION) est produit par P-A v9 mais **absent de la base**. Utilisé en terminal uniquement. À créer en singleSelect si besoin de filtrage Airtable.

---

## 13. ETAPE1_T3_CIRCUIT (`tblLAC4dS25v6IUbs`) — 37 champs
1 record par circuit actif × candidat. **Créé APRÈS T3_PILIER** (pilier_link dépend du rec_id T3_PILIER).

| Field ID | Nom | Statut | Consigne résumée |
|---|---|---|---|
| `fldeaMdgx3WVWgxgv` | circuit_uid | ✅ É0 | Clé primaire |
| `fldUewcuNizHi3NrW` | bilan_link | ✅ É0 | Lien vers T3_BILAN |
| `fldPpfFtaCh9wI9IQ` | pilier_link | ✅ É0 | Lien vers T3_PILIER — **req rec_id du T3_PILIER créé avant** |
| `fldpQzPEvlNaRXFgg` | candidat_id | ✅ É0 | |
| `fld74EvZRf7r4biGh` | pilier | ✅ É0 | P1..P5 |
| `fldrnHJtNOWWYJ91t` | circuit_id | ✅ É0 | C1..C15 ou ADHOC |
| `fldSGRXf8mi4q1NTd` | circuit_nom | ✅ É0 | Depuis REFERENTIEL_CIRCUITS.circuit_nom |
| `fldrM33rxdYnJ39vz` | circuit_freq | ✅ É0 | = nb_coeur — **jamais total** |
| `fldwfbNZ0DKsdXray` | circuit_franches | ✅ É0 | = nb_coeur |
| `fldDnY9fRw3g62C6o` | circuit_nuancees | ✅ É0 | = 0 |
| `fld0LTPI1KfAVHRqI` | circuit_niveau | ✅ É0 | HAUT/MOYEN/FAIBLE/**EN_SOUTIEN** (cœur=0 ≠ FAIBLE) |
| `fldoGZPSxM22pk82R` | en_svc_P1 | ✅ É0 | Depuis INVENTAIRE_CIRCUITS.nb_svc_P1 |
| `fldAgQzO8YgqbzUEe` | en_svc_P2 | ✅ É0 | idem P2 |
| `fld56OTFNSTo7OGAE` | en_svc_P3 | ✅ É0 | idem P3 |
| `fldJ76jeasA2KVmdY` | en_svc_P4 | ✅ É0 | idem P4 |
| `fldqMhYYHMy7b2s1n` | en_svc_P5 | ✅ É0 | idem P5 |
| `fldnFNJm6GP0mAGNm` | total_activations | ✅ É0 | Depuis INVENTAIRE_CIRCUITS.total_activations |
| `fldSK79cCYsuICAAy` | ordre_pilier | ✅ É0 | Rang dans le pilier |
| `fld5SPJJXdv9Bo6vT` | ordre_circuit | ✅ É0 | Rang global |
| `fldSx0VOHYILowFSj` | n3_nuance | ✅ **P-A** | Explication 3 temps — GESTE→CIRCUIT, paraphrase pure |
| `flduJoJnNpHRmh6jg` | soleil_micro | ✅ **P-A** | ≤15 mots, HAUT+MOYEN seulement (Δ11 v9) |
| `fldLP9juCWCTlCZPt` | soleil_verbatim | ✅ **P-A** | verbatims_cites[0] — copie EXACTE |
| `fldI1DVJiH7EH4zel` | soleil_verbatim_ref | ✅ É0 | "PqQn Lieu" |
| `fldSCQD9zvgRQcuq9` | verbatim_2 | ✅ **P-A** | verbatims_cites[1] |
| `fldmVPwfku0vUz6xX` | verbatim_2_ref | ✅ É0 | |
| `fldhIp3aW72WR2V1t` | verbatim_3 | ✅ **P-A** | verbatims_cites[2] |
| `fldcQ7hxyRumcc1DO` | verbatim_3_ref | ✅ É0 | |
| `fld4lrLWySRXVmvZe` | verbatim_4 | ✅ **P-A** | verbatims_cites[3] |
| `fldQgruSXveuTCLM4` | verbatim_4_ref | ✅ É0 | **⚠️ fldQgru (g pas b)** |
| `fldixMQDcsD7cCyd3` | renfort_phrase | ✅ **P-A** | "En renfort…" — vide si aucun sortant ≥2 |
| `fld3zZ8SteMWedetW` | explication_courte_ch4 | ✅ **P-A** | ≤18 mots, "Vous+verbe" |
| `fldKKSpL02oLC8Gwn` | n1_definition | ⚪ STATIQUE | Copie geste référentiel — non rendu template. **INTERDIT comme base P-A** |
| `fldV3EBlHGUleiifK` | n2_verbatims | ⚪ STATIQUE | Non rendu directement |
| `fldGzHp6ZFEsiIERf` | circuit_cluster | ⚠️ PÉRIMÉ | Concept aboli |
| `fldVsySoS1k0yFHgx` | circuit_signal | ⚪ STATIQUE | Non utilisé |

---

## RÈGLES CRITIQUES PERMANENTES

1. `verbatim_4_ref` = `fldQgruSXveuTCLM4` — **g pas b** (erreur typographique réelle)
2. `nb_svc_P3` INVENTAIRE (`fldQbwuHBRywn2rzp`) — **CORROMPU, jamais utiliser**
3. `circuit_freq` = nb_coeur — **jamais total_activations**
4. `en_svc_Px` source = T3_CIRCUIT — **jamais INVENTAIRE.nb_svc_Px directement**
5. T3_PILIER créé **AVANT** T3_CIRCUIT — pilier_link dépend du rec_id T3_PILIER
6. `signal limbique` = donnée É0 fournie en entrée P-A — **NE PAS analyser ni inventer**
7. EN SOUTIEN = cœur 0 en échelle cœur (**PAS FAIBLE**) ; exception pilier entièrement sans cœur (échelle TOTAL)
8. Méthode des facettes **OBLIGATOIRE** si >4 verbatims disponibles
9. Emprunts reçus **OBLIGATOIRES** dans synth_factuelle_elargie
10. `cluster` **INTERDIT** partout y compris "aucun cluster détecté"
11. `pilier_role` valeurs valides = **socle / amont / aval / fonctionnel** (str1/str2/fn1/fn2 = anciens codes périmés)
12. `mode_statut` produit par P-A v9 mais **absent de la base** Airtable
