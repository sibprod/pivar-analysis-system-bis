# MAPPING PLACEHOLDERS — bilanFableVisualiseurService.html
# Table source → Placeholder → Field ID Airtable
# v1.0 — 17/06/2026
#
# Usage : si un champ Airtable change de nom ou d'ID,
# chercher son Field ID dans la colonne de droite et
# mettre à jour bilanFablePayloadService.js en conséquence.
#
# Total placeholders uniques : 724
# ─────────────────────────────────────────────────────────────────────────────

═══════════════════════════════════════════════════════════════════════════════
TABLE : VISITEUR (tblslPP9B71FveOX5)
Lu via : airtableService.getVisiteurInfoForVisualisation(candidat_id)
═══════════════════════════════════════════════════════════════════════════════

  Placeholder                │ Field ID Airtable         │ Nom champ Airtable
  ───────────────────────────┼───────────────────────────┼───────────────────
  candidat.civilite          │ fldW0C6TN7EGFULh1         │ civilite_candidat
  candidat.prenom            │ fldqmuzbgbHyqfBeC         │ Prenom
  candidat.nom               │ fldWcwRXpLCxzfgBr (via Nom) │ Nom
  candidat.titre_affichage   │ CALCULÉ (civilite + prenom)
  candidat.nom_complet       │ CALCULÉ (prenom + nom)


═══════════════════════════════════════════════════════════════════════════════
TABLE : ETAPE1_T3_BILAN (tblv775KQrEhsogdI)
Lu via : airtableService.getEtape1T3Bilan(candidat_id)
Filtre : returnFieldsByFieldId:true
═══════════════════════════════════════════════════════════════════════════════

  ─── Données globales ───────────────────────────────────────────────────────

  Placeholder                │ Field ID Airtable         │ Clé service
  ───────────────────────────┼───────────────────────────┼──────────────────
  bilan.socle_libelle        │ fldb8Y9IrrvMP9w0k         │ socle_libelle
  bilan.filtre               │ fld9vAKpKEMIcRiTB         │ filtre
  bilan.filtre_declinaison   │ fld1p9p9Csvyllvcm         │ filtre_declinaison
  bilan.filtre_court         │ fld6uiqUpCtWHfWYf         │ sig_filtre_val
  bilan.finalite             │ fldxNmTAxP5FkqYWz         │ sig_finalite
  bilan.signature_courte     │ fldR2LjSEpCvbS0Uy         │ sig_resultat_ligne1
  bilan.schema_legende_socle │ fldXlpyU1EdUPBtIH         │ schema_legende_socle
  bilan.schema_intro_roles   │ fldm2QaOvI5cKpLwg         │ schema_intro_roles (non dans template actuel)

  ─── CH2 — Boucle cognitive ─────────────────────────────────────────────────

  ch2.m1.texte               │ fldVM2cfim5rBivMt         │ maillon_m1_depart
  ch2.m2.texte               │ fldAZQSbNRxK8ugWo         │ maillon_m2_dialogue
  ch2.m3.texte               │ fldKxUzxHTvZ6d3z5         │ maillon_m3_debouche
  ch2.m4.texte               │ fldzc8cjyygsfbC5N         │ maillon_m4_jamais

  ch2.m1.titre               │ CALCULÉ ("Tout part de {socle_label}")
  ch2.m2.titre               │ CALCULÉ ("L'aller-retour {socle}↔{amont}")
  ch2.m3.titre               │ CALCULÉ ("Le débouché vers la {aval}")
  ch2.m4.titre               │ CALCULÉ ("Ce qui n'arrive jamais...")
  ch2.m1.badge               │ CALCULÉ ("{socle} = point de départ")
  ch2.m4.badge               │ CALCULÉ ("{aval} → {socle} : 0")

  ─── CH3 — Signaux limbiques (champ JSON registres) ─────────────────────────

  ch3.reg1.titre             │ fldgeeC3lg3M89ESA (JSON [0].titre)   │ registres
  ch3.reg1.texte             │ fldgeeC3lg3M89ESA (JSON [0].texte)   │ registres
  ch3.reg1.verbatims         │ fldgeeC3lg3M89ESA (JSON [0].verbatims) │ registres
  ch3.reg2.titre             │ fldgeeC3lg3M89ESA (JSON [1].titre)
  ch3.reg2.texte             │ fldgeeC3lg3M89ESA (JSON [1].texte)
  ch3.reg2.verbatims         │ fldgeeC3lg3M89ESA (JSON [1].verbatims)
  ch3.reg3.titre             │ fldgeeC3lg3M89ESA (JSON [2].titre)
  ch3.reg3.texte             │ fldgeeC3lg3M89ESA (JSON [2].texte)
  ch3.reg3.verbatims         │ fldgeeC3lg3M89ESA (JSON [2].verbatims)
  ch3.s05_intro              │ fldxCNvqR4qyYAYjr         │ s05_intro
  ch3.s05_cloture            │ fld9x0yRmGnAhVFS4         │ s05_cloture

  ─── CH3 — Coûts (champs JSON) ───────────────────────────────────────────────

  ch3.cout1.label            │ fld0nyRitbejCsihG (JSON .label)  │ cout_principal
  ch3.cout1.titre            │ fld0nyRitbejCsihG (JSON .titre)
  ch3.cout1.texte            │ fld0nyRitbejCsihG (JSON .texte)
  ch3.cout1.verbatims        │ fld0nyRitbejCsihG (JSON .verbatims)
  ch3.cout2.label            │ fld7JUPi80iqSKzzV (JSON .label)  │ cout_secondaire
  ch3.cout2.titre            │ fld7JUPi80iqSKzzV (JSON .titre)
  ch3.cout2.texte            │ fld7JUPi80iqSKzzV (JSON .texte)
  ch3.cout2.verbatims        │ fld7JUPi80iqSKzzV (JSON .verbatims)
  ch3.s06_intro              │ fldxZi0jRCWnXsVng         │ s06_intro
  ch3.s06_cloture            │ fld1nB5UqVklCjikE         │ s06_cloture

  ─── CH4 — Filtre et preuves ────────────────────────────────────────────────

  bilan.ch4_filtre_revelation │ fldqDeT7EDov18iTz        │ ch4_filtre_revelation
  bilan.ch4_preuve1_titre    │ fldXGZ5ijlcGPYc16 (JSON [0].titre) │ ch4_filtre_preuves
  bilan.ch4_preuve1_texte    │ fldXGZ5ijlcGPYc16 (JSON [0].texte)
  bilan.ch4_preuve2_titre    │ fldXGZ5ijlcGPYc16 (JSON [1].titre)
  bilan.ch4_preuve2_texte    │ fldXGZ5ijlcGPYc16 (JSON [1].texte)
  bilan.ch4_preuve3_titre    │ fldXGZ5ijlcGPYc16 (JSON [2].titre)
  bilan.ch4_preuve3_texte    │ fldXGZ5ijlcGPYc16 (JSON [2].texte)
  bilan.ch4_preuve4_titre    │ fldXGZ5ijlcGPYc16 (JSON [3].titre)
  bilan.ch4_preuve4_texte    │ fldXGZ5ijlcGPYc16 (JSON [3].texte)
  bilan.ch4_preuve5_titre    │ fldXGZ5ijlcGPYc16 (JSON [4].titre)
  bilan.ch4_preuve5_texte    │ fldXGZ5ijlcGPYc16 (JSON [4].texte)
  ch3.preuve1_label          │ VALEUR DOCTRINALE FIXE ("Preuve 1 · Le volume")
  ch3.preuve2_label          │ VALEUR DOCTRINALE FIXE ("Preuve 2 · Le poids des gestes")
  ch3.preuve3_label          │ VALEUR DOCTRINALE FIXE ("Preuve 3 · La nature de la grille")
  ch3.preuve4_label          │ VALEUR DOCTRINALE FIXE ("Preuve 4 · Les débordements")
  ch3.preuve5_label          │ VALEUR DOCTRINALE FIXE ("Preuve 5 · La force de rappel")


═══════════════════════════════════════════════════════════════════════════════
TABLE : ETAPE1_T3_PILIER (tblzDIn7P2cOvVvY2)
Lu via : airtableService.getEtape1T3Piliers(candidat_id)
Filtre : returnFieldsByFieldId:true — 5 records (un par pilier P1..P5)
Clé d'index : champ pilier (fldVvi5gbKioBmlsQ)
═══════════════════════════════════════════════════════════════════════════════

  Ces placeholders existent en 5 versions (p1, p2, p3, p4, p5).
  Même Field ID pour chaque pilier.

  Placeholder (ex: p3.XXX)        │ Field ID Airtable     │ Clé config.js
  ─────────────────────────────────┼───────────────────────┼───────────────
  pX.mode                          │ fldoGY71vyiaUeFl6     │ pilier_mode
  pX.tetiere_rappel                │ fld6qIK9UOZPAE59k     │ pilier_rappel
  pX.tetiere_roleband              │ fld1X3FQYRcxB2Qwy     │ pilier_role_label
  pX.mode_explication              │ fld6GtEBRP5UxvHeI     │ mode_explication
  pX.intro_eclate                  │ fldomziXNOGf7Ujsb     │ intro_eclate
  pX.bloc_HAUT_agregat             │ fldBLvofzosLTPUOr     │ bloc_haut_candidat
  pX.bloc_HAUT_rattachement        │ fldB9fRf8U61z4WZK     │ bloc_haut_catalogue
  pX.bloc_MOYEN_agregat            │ flda16lg5Dt1HrXrF     │ bloc_moyen_candidat
  pX.bloc_MOYEN_rattachement       │ fldMA46pZRI6Bi0ZU     │ bloc_moyen_catalogue
  pX.bloc_FAIBLE_agregat           │ fld68H41z6b9XtFoZ     │ bloc_faible_candidat
  pX.bloc_FAIBLE_rattachement      │ fldZiSdH20uMb5wCY     │ bloc_faible_catalogue
  pX.synth_factuelle_coeur         │ fldcGtODAh6b0vZs5     │ synth_factuelle
  pX.synth_factuelle_elargie       │ fldho6MPGr5J5QmPu     │ synth_interpretee
  pX.ou_revient                    │ fldho6MPGr5J5QmPu     │ synth_interpretee (même champ)
  pX.carte_role                    │ CALCULÉ depuis fldhFisqhUf9oBLOe (role_pilier)
  ref.pX.nom                       │ fldbDYECHFEGkh0Ng     │ pilier_label
  ref.pX.nom_long                  │ fldbDYECHFEGkh0Ng     │ pilier_label (même champ)

  ⚠️ P5 SPÉCIFIQUE — blocs nommés différemment car pilier sans cœur :
  p5.bloc_PLUS_agregat             │ fldBLvofzosLTPUOr     │ bloc_haut_candidat
  p5.bloc_PLUS_rattachement        │ fldB9fRf8U61z4WZK     │ bloc_haut_catalogue
  p5.bloc_REGU_agregat             │ flda16lg5Dt1HrXrF     │ bloc_moyen_candidat
  p5.bloc_REGU_rattachement        │ fldMA46pZRI6Bi0ZU     │ bloc_moyen_catalogue
  p5.bloc_PONCT_agregat            │ fld68H41z6b9XtFoZ     │ bloc_faible_candidat
  p5.bloc_PONCT_rattachement       │ fldZiSdH20uMb5wCY     │ bloc_faible_catalogue
  → NOTE SERVICE : dans buildPilierCtx, ajouter ces alias pour P5.


═══════════════════════════════════════════════════════════════════════════════
TABLE : ETAPE1_T3_CIRCUIT (tblLAC4dS25v6IUbs)
Lu via : airtableService.getEtape1T3Circuits(candidat_id)
Filtre : returnFieldsByFieldId:true — n records (un par circuit actif)
Clé d'index : pilier (fld74EvZRf7r4biGh) + circuit_id (fldrnHJtNOWWYJ91t)
Code résultant : "P3C12", "P1C15", "ADHOC_C18"…
═══════════════════════════════════════════════════════════════════════════════

  Ces placeholders existent pour chaque circuit actif du candidat.
  Ex: circuits.P3C12.XXX — le code "P3C12" = pilier + "C" + circuit_id.

  Placeholder (ex: circuits.P3C12.XXX)  │ Field ID Airtable │ Clé config.js
  ───────────────────────────────────────┼───────────────────┼───────────────
  circuits.PxCy.nom                      │ fldSGRXf8mi4q1NTd │ circuit_nom
  circuits.PxCy.niveau                   │ fld0LTPI1KfAVHRqI │ circuit_niveau
  circuits.PxCy.verb1_texte             │ fldLP9juCWCTlCZPt │ verbatim_1
  circuits.PxCy.verb1_lieu_aff          │ fldI1DVJiH7EH4zel │ verbatim_1_ref
  circuits.PxCy.verb2_texte             │ fldSCQD9zvgRQcuq9 │ verbatim_2
  circuits.PxCy.verb2_lieu_aff          │ fldmVPwfku0vUz6xX │ verbatim_2_ref
  circuits.PxCy.verb3_texte             │ fldhIp3aW72WR2V1t │ verbatim_3
  circuits.PxCy.verb3_lieu_aff          │ fldcQ7hxyRumcc1DO │ verbatim_3_ref
  circuits.PxCy.verb4_texte             │ fld4lrLWySRXVmvZe │ verbatim_4
  circuits.PxCy.verb4_lieu_aff          │ fldQgruSXveuTCLM4 │ verbatim_4_ref
  circuits.PxCy.expl                    │ fldSx0VOHYILowFSj │ n3_nuance
  circuits.PxCy.renfort                 │ fldixMQDcsD7cCyd3 │ en_renfort (→ HTML)
  circuits.PxCy.courte                  │ fld3zZ8SteMWedetW │ explication_courte_ch4


═══════════════════════════════════════════════════════════════════════════════
TABLE : ETAPE1_T2_INVENTAIRE_CIRCUITS (tblUHZjXIW9jp9nIf) — SOURCE AUTORITAIRE
Lu via : airtableService.getEtape1T2InventaireCircuits(candidat_id)
Filtre : champs nommés (sans returnFieldsByFieldId)
═══════════════════════════════════════════════════════════════════════════════

  Placeholder (ex: circuits.P3C12.XXX)  │ Champ Airtable    │ Calcul
  ───────────────────────────────────────┼───────────────────┼───────────────
  circuits.PxCy.coeur_aff               │ nb_coeur          │ String(nb_coeur)
  circuits.PxCy.total_aff               │ total_activations │ String(total)
  circuits.PxCy.coeur        (brut)      │ nb_coeur          │ Number (pour {{#if}})
  circuits.PxCy.total        (brut)      │ total_activations │ Number (pour {{#if}})
  circuits.PxCy.svc_p1_aff              │ nb_svc_P1         │ n>0 ? String(n) : "·"
  circuits.PxCy.svc_p2_aff              │ nb_svc_P2         │ n>0 ? String(n) : "·"
  circuits.PxCy.svc_p3_aff              │ nb_svc_P3         │ n>0 ? String(n) : "·"
  circuits.PxCy.svc_p4_aff              │ nb_svc_P4         │ n>0 ? String(n) : "·"
  circuits.PxCy.svc_p5_aff              │ nb_svc_P5         │ n>0 ? String(n) : "·"

  ⚠️ NOTE : circuits.PxCy.coeur et .total (sans _aff) sont utilisés dans
  les {{#if circuits.PxCy.coeur}} du template pour les conditionnels.
  Le service doit les exposer comme valeurs numériques, pas comme strings.


═══════════════════════════════════════════════════════════════════════════════
TABLE : ETAPE1_T2_VENTILATION_PILIERS (tbl4UzvAMQY4nRnI5)
Lu via : airtableService.getEtape1T2VentilationPiliers(candidat_id)
═══════════════════════════════════════════════════════════════════════════════

  Placeholder          │ Champ Airtable  │ Calcul
  ─────────────────────┼─────────────────┼──────────────────────────────────
  ch2.m1.attest        │ nb_reponses     │ "Attesté : {nb} réponses sur 25"
                       │ (pilier socle)  │
  ch2.m2.attest        │ nb_reponses     │ calculé depuis amont
                       │ (pilier amont)  │
  ch2.m3.attest        │ nb_reponses     │ calculé depuis aval
                       │ (pilier aval)   │
  ch2.m4.attest        │ CALCULÉ         │ "Attesté : 0 réponse gouvernée..."


═══════════════════════════════════════════════════════════════════════════════
CIRCUITS PAR PILIER — liste exacte des codes câblés dans le template
(spécifique à l'architecture de Cécile Chénais — à adapter par candidat)
═══════════════════════════════════════════════════════════════════════════════

  P3 (socle) :
    HAUT   : P3C12, P3C10, P3C4
    MOYEN  : P3C15, P3C13, P3C5, P3C9, P3C6, P3C3
    FAIBLE : P3C11, P3C1, P3C14
    SOUTIEN: P3C7

  P1 (amont) :
    HAUT   : P1C15, P1C1, P1C2, P1C3, P1C8, P1C13
    MOYEN  : P1C6, P1C11, P1C14
    SOUTIEN: P1C5, P1C10, P1C7

  P5 (aval) :
    INSTRU : P5C4, P5C13, P5C1, P5C7, P5C12, P5C3, P5C14, P5C2, P5C6
    ADHOC  : ADHOC_C18, ADHOC_C17

  P2 (fn1) :
    MOYEN  : P2C1, P2C6
    SOUTIEN: P2C10

  P4 (fn2) :
    HAUT   : P4C15, P4C1, P4C10, P4C5, P4C13, P4C6
    SOUTIEN: P4C2, P4C11


═══════════════════════════════════════════════════════════════════════════════
ANOMALIES À CORRIGER DANS bilanFablePayloadService.js
═══════════════════════════════════════════════════════════════════════════════

  1. P5 blocs nommés PLUS/REGU/PONCT (non HAUT/MOYEN/FAIBLE) :
     Le service retourne bloc_HAUT_agregat mais P5 attend bloc_PLUS_agregat.
     → Ajouter dans buildPilierCtx pour P5 :
       bloc_PLUS_agregat    = p.bloc_haut_candidat
       bloc_PLUS_rattachement = p.bloc_haut_catalogue
       bloc_REGU_agregat    = p.bloc_moyen_candidat
       bloc_REGU_rattachement = p.bloc_moyen_catalogue
       bloc_PONCT_agregat   = p.bloc_faible_candidat
       bloc_PONCT_rattachement = p.bloc_faible_catalogue

  2. circuits.PxCy.coeur et .total (bruts, sans _aff) :
     Utilisés dans {{#if circuits.P3C12.coeur}} pour les conditionnels.
     → Ajouter dans circuitsCtx[code] :
       coeur: isAdhoc ? 0 : nbCoeur,
       total: total,
