# 37 · TABLE DE TRAÇABILITÉ DU GABARIT — POUR VÉRIFICATION
## 24/08/2026 · chaque élément, sa source, son identifiant de champ, son producteur

**Base** : `appgghhXjYBdFRras` · **Gabarit** : `services/grille-referent/gabarit_grille.html`

**Comment vérifier une ligne** : ouvrir la table dans Airtable, retrouver le champ par son identifiant `fldXXX`, comparer son contenu à ce que la grille affiche.

⚠️ **Le nom en base ≠ la clé du service.** `synth_bloc_tres_souvent_candidat` (base) devient `bloc_tres_souvent_candidat` en sortie d'`airtableService`. La colonne « champ » donne le nom **en base** ; l'identifiant est l'ancre sûre.

| # | Ancre | Table · champ | Identifiant | Produit par | Aperçu |
|---|---|---|---|---|---|
| 1 | `—` | — | `—` | gabarit | Profil Cognitif · grille de lecture
      <h1 data-s |
| 2 | `civilite` | ETAPE1_T3_BILAN.civilite + nom | `fld8yjgv2jIp2dzvW + fldFjVTaedAE8iXkU` | export | {{civilite}} {{nom}}
      Comment le candidat s'y p |
| 3 | `—` | — | `—` | gabarit | Comment le candidat s'y prend — document destiné au  |
| 4 | `referent_nom` | — | `—` | saisie référent | Référent : {{referent_nom}}
      Entreprise : {{ref |
| 5 | `—` | — | `—` | gabarit | Lecture rapide
    <span class="zone" data-src="REFE |
| 6 | `cartouche.zone` | REFERENTIEL_PROFIL_VS_PILIER.zone | `fldHkqmdEHKGQS12J` | export | {{cartouche.zone}}
    <span class="sig" data-src="R |
| 7 | `cartouche.signature` | REFERENTIEL_PROFIL_VS_PILIER.titre | `fld1kvA9OyzsdMik5` | export | {{cartouche.signature}}
  
  
    <div class="cl soc |
| 8 | `—` | — | `—` | gabarit | ★ Socle
      <span class="nom" data-src="ETAPE1_T3_ |
| 9 | `cartouche.socle.libelle` | ETAPE1_T3_BILAN.pilier_socle_label | `fldUf6rhEyR3MKI1x` | export | {{cartouche.socle.libelle}}
      <span class="mode" |
| 10 | `cartouche.socle.mode` | ETAPE1_T3_PILIER.pilier_mode | `fldoGY71vyiaUeFl6` | export | {{cartouche.socle.mode}}
      <span class="filt" da |
| 11 | `cartouche.socle.filtre` | ETAPE1_T3_BILAN.filtre | `fld9vAKpKEMIcRiTB` | export | Filtre · ON{{cartouche.socle.filtre}}
    
    <div  |
| 12 | `cartouche.amont.libelle` | ETAPE1_T3_PILIER.pilier_label | `fldbDYECHFEGkh0Ng` | export | {{cartouche.amont.libelle}}
      <span class="mode" |
| 13 | `cartouche.amont.mode` | ETAPE1_T3_PILIER.pilier_mode | `fldoGY71vyiaUeFl6` | export | {{cartouche.amont.mode}}
    
    
      <span clas |
| 14 | `cartouche.aval.libelle` | ETAPE1_T3_PILIER.pilier_label | `fldbDYECHFEGkh0Ng` | export | {{cartouche.aval.libelle}}
      <span class="mode"  |
| 15 | `cartouche.aval.mode` | ETAPE1_T3_PILIER.pilier_mode | `fldoGY71vyiaUeFl6` | export | {{cartouche.aval.mode}}
    
    
      Dimensions< |
| 16 | `—` | — | `—` | gabarit | Dimensions
      
      <span class="dch" data-src=" |
| 17 | `nom` | RESPONSES_ETAPE2_EXCELLENCE.excellence + niveau_global | `fldpoyLIgYJ7buqE4 + fldep6lx5NmVJp8qS` | agent_grille_profil | {{nom}}<span dat |
| 18 | `nom` | RESPONSES_ETAPE2_EXCELLENCE.excellence | `fldpoyLIgYJ7buqE4` | export | {{nom}}<span data-src="RESPONSES_ETAPE2_EXCELLENCE.n |
| 19 | `libelle_niveau` | RESPONSES_ETAPE2_EXCELLENCE.niveau_global | `fldep6lx5NmVJp8qS` | agent_grille_profil · traduit | {{libelle_niveau}}
      
    
  


<!-- ═══════════ |
| 20 | `—` | — | `—` | gabarit | Le profil se lit au croisement de deux choses : l'ou |
| 21 | `apport.zone` | REFERENTIEL_PROFIL_VS_PILIER.zone | `fldHkqmdEHKGQS12J` | export | {{apport.zone}}
      <span class="sb" data-src="REF |
| 22 | `apport.socle` | REFERENTIEL_PROFIL_VS_PILIER.socle | `fldizY3Ki8peAutcH` | export | {{apport.socle}}
      <span class="sb" data-src="ET |
| 23 | `apport.type` | ETAPE2_BILAN4EXCELLENCES.type_cognitif | `fld1hwz9INvp5Qyo9` | export | {{apport.type}}
    
    <h3 data-src="REFERENTIEL_P |
| 24 | `apport.titre` | REFERENTIEL_PROFIL_VS_PILIER.titre | `fld1kvA9OyzsdMik5` | export | {{apport.titre}}
    <div class="deft" data-src="REF |
| 25 | `apport.definition_type` | REFERENTIEL_PROFIL_VS_PILIER.definition_type | `fldYyLOdEqCI1WgFF` | export · lexique PROFILS_PIVAR | {{apport.definition_type}}
    <div class="app" data |
| 26 | `apport.application_au_socle` | REFERENTIEL_PROFIL_VS_PILIER.application_au_socle | `fldMfkbgQwxGflMLx` | export | {{apport.application_au_socle}}

    <div class="cha |
| 27 | `apport.chaine_ajoute` | ETAPE1_T3_PILIER.synth_bloc_*_candidat (amont + aval) | `fldBLvofzosLTPUOr` | agent_grille_apport · R6 | Ce que sa chaîne y ajoute{{apport.chaine_ajoute}} |
| 28 | `texte` | REFERENTIEL_PROFIL_VS_PILIER.atouts | `fldAl8WlfdUCMy6Tq` | export | agent_grille_apport si origine=ajuste | {{texte}}
          
        
      
      
         |
| 29 | `texte` | REFERENTIEL_PROFIL_VS_PILIER.couts | `fld1elsdr5rrWSw1O` | export · aucun coût ne peut être retiré (R7) | {{texte}}
          
        
      
    

    <div  |
| 30 | `—` | — | `—` | gabarit | La zone indique une portée, jamais une valeur : un p |
| 31 | `—` | — | `—` | gabarit | Un seul réglage gouverne tout le reste. Chaque outil |
| 32 | `—` | — | `—` | gabarit | Son réglage — il ne sort jamais neutre
    <div clas |
| 33 | `profil.socle_libelle` | ETAPE1_T3_BILAN.pilier_socle_label | `fldUf6rhEyR3MKI1x` | export | {{profil.socle_libelle}}
    <div class="rp" data-sr |
| 34 | `profil.filtre` | ETAPE1_T3_BILAN.filtre | `fld9vAKpKEMIcRiTB` | export | « {{profil.filtre}} »
    Ce réglage se déclenche av |
| 35 | `—` | — | `—` | gabarit | Ce réglage se déclenche avant toute réflexion, dans  |
| 36 | `role` | ETAPE1_T3_PILIER.pilier_role_label | `fld1X3FQYRcxB2Qwy` | export | {{role}}
      {{libe |
| 37 | `libelle` | ETAPE1_T3_PILIER.pilier_label | `fldbDYECHFEGkh0Ng` | export | {{libelle}}
      <span class="m" data-src="ETAPE1_T |
| 38 | `mode` | ETAPE1_T3_PILIER.pilier_mode | `fldoGY71vyiaUeFl6` | export | {{mode}}
    
    
      <div class="synthese" data- |
| 39 | `synthese` | ETAPE1_T3_PILIER.synth_bloc_{{bloc_retenu}}_candidat | `fldBLvofzosLTPUOr | flda16lg5Dt1HrXrF | fld68H41z6b9XtFoZ` | agent_grille_syntheses · transposition | {{synthese}}

      
        Le détail de ses gestes |
| 40 | `—` | ETAPE1_T3_BILAN.filtre_gestes → fait | `fldQr5PWbmaTH2uwv` | export · socle uniquement | <b data-src="ETAPE1_T3_CIRCUIT.explication_courte_ch |
| 41 | `titre` | ETAPE1_T3_CIRCUIT.explication_courte_ch4 | `fld3zZ8SteMWedetW` | agent_grille_profil · dérivé R1 | {{titre}}
            <span data-src="ETAPE1_T3_BILA |
| 42 | `narration` | ETAPE1_T3_BILAN.filtre_gestes → fait | `fldQr5PWbmaTH2uwv` | export · socle uniquement | {{narration}}
            <div class="renfort" data- |
| 43 | `renfort` | ETAPE1_T3_CIRCUIT.en_renfort | `fldixMQDcsD7cCyd3` | export · comptages retirés | En renfort{{renfort}} |
| 44 | `—` | ETAPE1_T3_BILAN.registres | `fldgeeC3lg3M89ESA` | agent_grille_dimensions · verbatims et situations à retirer | Ce qui le porte, ce qui le freine
    <p data-src="E |
| 45 | `profil.registres` | ETAPE1_T3_BILAN.registres | `fldgeeC3lg3M89ESA` | agent_grille_dimensions | {{profil.registres}}
  
  


<!-- ═══════════ 3 · SE |
| 46 | `—` | — | `—` | gabarit | Elles s'ajoutent au fonctionnement décrit ci-dessus  |
| 47 | `portrait` | ETAPE2_BILAN4EXCELLENCES.portrait_un_mot | `fldf6Wdb6eY5c3jSC` | export | « {{portrait}} »
  

  
  <div class="dim" data-src= |
| 48 | `nom` | RESPONSES_ETAPE2_EXCELLENCE.synthese · declencheur · gradient | `fldeNio6Sb6TYvF21 | fldRTSu8grkD5Qu5H | fldpFNQdeOtTTV6SE` | agent_grille_dimensions · comptages et régimes à retirer | {{nom}} |
| 49 | `nom` | RESPONSES_ETAPE2_EXCELLENCE.excellence | `fldpoyLIgYJ7buqE4` | export | {{nom}}
    <p data-src="RESPONSES_ETAPE2_EXCELLENCE |
| 50 | `constat` | RESPONSES_ETAPE2_EXCELLENCE.synthese | `fldeNio6Sb6TYvF21` | agent_grille_dimensions | {{constat}}
    <p data-src="RESPONSES_ETAPE2_EXCELL |
| 51 | `quand` | RESPONSES_ETAPE2_EXCELLENCE.declencheur | `fldRTSu8grkD5Qu5H` | agent_grille_dimensions | Quand cela s'active{{quand}}
    <p data-src="RESPON |
| 52 | `ne_pas_attendre` | RESPONSES_ETAPE2_EXCELLENCE.gradient | `fldpFNQdeOtTTV6SE` | agent_grille_dimensions | Ce qu'il ne faut pas en attendre{{ne_pas_attendre}}
 |
| 53 | `—` | — | `—` | gabarit | Une dimension qui ne s'est pas manifestée ne figure  |
| 54 | `—` | — | `—` | gabarit | Ce qui suit n'énumère pas des faiblesses : chaque po |
| 55 | `—` | — | `—` | gabarit | Ce sont des possibles, selon les situations — pas de |
| 56 | `—` | BILAN_DESALIGNEMENT.contenu_json | `fldTGvpMnG4hqvLlS` | — | <div class="ax" data-src="BILAN_DESALIGNEMENT.bloc_t |
| 57 | `intitule_type` | BILAN_DESALIGNEMENT.bloc_type | `fldJPw1KAK4JbOzrx` | mécanique | {{intitule_type}} · {{outil}}
      {{titre}}
    
  |
| 58 | `titre` | — | `—` | agent_grille_redaction | {{titre}}
    
    {{force}}

    <!--{{#preuve}}- |
| 59 | `force` | — | `—` | agent_grille_redaction | {{force}}

    
    <!-- Un point démontre, il n'aff |
| 60 | `preuve` | ETAPE1_T3_CIRCUIT.explication_courte_ch4 | `fld3zZ8SteMWedetW` | agent_grille_redaction | Ce qui l'établit{{preuve}}
    

    
    <!-- Les i |
| 61 | `—` | BILAN_DESALIGNEMENT.contenu_json → INJONCTIONS | `fldTGvpMnG4hqvLlS` | export mot pour mot | Ce qu'on lui dit
      <q data-src="BILAN_DESALIGNEM |
| 62 | `.` | BILAN_DESALIGNEMENT.contenu_json → INJONCTIONS | `fldTGvpMnG4hqvLlS` | export mot pour mot | {{.}}
    
    

    
      À quel moment |
| 63 | `bascule` | — | `—` | agent_grille_redaction | {{bascule}}
        Au travail{{au_tr |
| 64 | `au_travail` | — | `—` | agent_grille_redaction | Au travail{{au_travail}}
        
          Question |
| 65 | `question` | — | `—` | agent_grille_redaction | {{question}}
          Ce que la réponse indiqu |
| 66 | `ce_que_la_reponse_indique` | — | `—` | agent_grille_redaction | Ce que la réponse indique{{ce_que_la_reponse_indique |
| 67 | `—` | — | `—` | gabarit | Ces deux capacités ne concernent pas tous les postes |
| 68 | `—` | — | `—` | gabarit | Deux métiers dans le même métier
    
      
        |
| 69 | `—` | — | `—` | gabarit | Sur quoi reposent ces constats
  Chaque élément de c |
| 70 | `—` | — | `—` | gabarit | Comment lire ce document. Il décrit comment le candi |
| 71 | `reference` | — | `—` | gabarit | Profil Cognitif · projet SIBPROD — Grille de lecture |

**71 éléments tracés.**

---

## CE QUI EXISTE EN BASE ET NE DOIT JAMAIS S'AFFICHER

| Table · champ | Identifiant | Motif |
|---|---|---|
| `ETAPE1_T2_CIRCUITS_POURBILAN.circuit_nom_clair` | `fld2TDRWOnwCNmG1H` | nom de référentiel — *« Conception multidimensionnelle de solutions complexes »* · coffre (D95) |
| `ETAPE1_T2_CIRCUITS_POURBILAN.bloc` | `fldnsWT41zOsFpuJz` | résidu « BLOC_EN_ATTENTE » — seul `bloc_final` fait foi |
| `ETAPE1_T3_CIRCUIT.circuit_niveau` | — | amplitude absolue, **pas** le rang dans le pilier |
| `ETAPE2_BILAN4EXCELLENCES.type_complet` | `fldZDHd6nlAv7Fk4Y` | « (7) · Environnement · Type A » — rang, vocabulaire abandonné, classement périmé |
| `ETAPE1_T3_BILAN.filtre_gestes → dit` | `fldQr5PWbmaTH2uwv` | les verbatims du candidat (D-PREUVE) |
| `ETAPE1_T3_BILAN.filtre_gestes → nom` · `→ coeur` | `fldQr5PWbmaTH2uwv` | nom de référentiel · comptage (D95) |

## MATIÈRE DISPONIBLE, NON EMPLOYÉE

| Table · champ | Identifiant | Contenu |
|---|---|---|
| `ETAPE1_T3_BILAN.filtre_gestes → revele` | `fldQr5PWbmaTH2uwv` | ce que le geste établit — *« Ce geste est le plus structurant de son entrée dans une situation »* |
| `ETAPE1_T3_BILAN.filtre_gestes → rang` | `fldQr5PWbmaTH2uwv` | *« votre geste le plus fréquent »* |
| `ETAPE2_BILAN4EXCELLENCES.combinaison` | `fldXMasJ4RoJaUjmm` | ce que les dimensions donnent ensemble |
| `ETAPE2_BILAN4EXCELLENCES.reserves_globales` | `fldXOMtejqdUdg7CQ` | réserves de lecture |
| `ETAPE1_T3_BILAN.filtre_finalite` | `fldobIgYtfa3Qiy4v` | à quoi sert le réglage |
| `ETAPE1_T3_BILAN.sig_*` (6 champs) | `fld1PZRqPxejsYc0Z` … | signature cognitive — **vides pour les 4 bilans** |

## ⚠️ LES NIVEAUX DE DIMENSION — LE BILAN FAIT FOI, PAS LES RÉPONSES

Deux tables portent les dimensions, et **elles ne disent pas la même chose** :

| Table | Ce qu'elle contient |
|---|---|
| `RESPONSES_ETAPE2_ EXCELLENCE` | la mesure du parcours principal — **jamais mise à jour** |
| `ETAPE2_BILAN4EXCELLENCES` | la mesure **fusionnée post-test** |

Quand le candidat passe le **test complémentaire de décentration**, la chaîne étape 2 (`agent_etape2_c_TESTDEC`) met le **bilan** à jour. La table des réponses, elle, garde « Non évalué — test à passer ».

**Lire les réponses seules a fait afficher cette mention à un candidat testé un mois plus tôt.**

| Dimension | Champ du bilan | Rémi | Véronique |
|---|---|---|---|
| Anticipation | `fldHMPW083IKtUMb3` | MOYENNE (12/25) | DENSE (15/25) |
| Vue systémique | `fldFyU6yc1bnFsRtJ` | FAIBLE (9/25) | MOYENNE (13/25) |
| **Décentration** | `fld05ugiziwG3jMZY` | OBSERVÉE (1/4 — test complémentaire) | 2/4 — test complémentaire |
| Méta-cognition | `fldRLNC7YpPtXy9Pv` | FAIBLE (0/25) | ABSENTE (4/25) |
| Ordre des dimensions | `fldDHH8ZBF2gGnTpI` | — | — |

**La règle** :
- **le niveau** → `ETAPE2_BILAN4EXCELLENCES` (fusionné) ;
- **les textes** (constat · déclencheur · gradient) → `RESPONSES_ETAPE2_ EXCELLENCE` ;
- **la lecture réconciliée de la décentration** → `ETAPE2_BILAN4EXCELLENCES.reserves_globales` (`fldXOMtejqdUdg7CQ`).

⚠️ Ces champs portent des **comptages** (« 12/25 », « 1/4 ») : la neutralisation les retire (D95).

---

## LA SÉLECTION DES GESTES — cascade R9

`ETAPE1_T2_CIRCUITS_POURBILAN` (`tblV8UBCgEOzJ2Tch`)

| Champ | Identifiant | Rôle |
|---|---|---|
| `bloc_final` | `fld5caHteonsyxrji` | **le seul classement qui fait foi** |
| `circuit_code` | `fldrv1p6mMsjnSTKw` | jointure vers `ETAPE1_T3_CIRCUIT.circuit_id` |
| `pilier_owner` | `fldp5Ue0WF1Mg7kgT` | l'outil auquel le geste appartient |
| `rang_dans_pilier` | `fld3rF69PhfHPcimw` | l'ordre d'affichage |
| `type_ligne` | `fld0fuDYqc7ekPU2a` | « TOTAL_PILIER » n'est **pas** un geste |

**Règle** : pour chaque outil, on prend le bloc le plus haut qui existe — très souvent, sinon souvent, sinon occasionnels. *(Un outil fonctionnel peut n'avoir aucun geste au bloc le plus fréquent : sans repli, sa carte serait vide.)*

## LE PIÈGE DU RÉFÉRENTIEL DE DÉSALIGNEMENT

`BILAN_DESALIGNEMENT.contenu_json` (`fldTGvpMnG4hqvLlS`) est indenté avec des **espaces insécables** (U+00A0), que `JSON.parse` refuse. Sans normalisation, l'analyse échoue **en silence** et le référentiel arrive vide.

Chaque ligne porte une **liste** d'items, pas un item : **151 items** au total pour six outils et quatre familles.
