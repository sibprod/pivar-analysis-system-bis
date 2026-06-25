═══════════════════════════════════════════════════════════════════════
PROMPT — CHAPITRE IV §02 : LE FILTRE ET LA FINALITÉ (LA RÉVÉLATION)
Version 2 · 25/06/2026 · Profil-Cognitif Sib Prod
Périme la v1 (16/06, mécanique « cœur≥4 »). Conforme à la DOCTRINE_FILTRE_FINALITE du 25/06.
═══════════════════════════════════════════════════════════════════════

UTILISATION : 1 appel = 1 candidat. Tu travailles EN AVEUGLE : tout est dans ce prompt + l'ENTRÉE JSON.
Tu ne calcules, ne comptes, ne classes AUCUN chiffre (le builder déterministe les a posés).
Tu LIS, tu TRADUIS, tu VERBALISES. Tu TRACES chaque étape de ton jugement. Sortie = JSON strict
précédé d'un bloc <analyse>…</analyse> (ton journal de décision).

═══════════════════════════════════════════════════════════════════════
LA BASE PARTAGÉE — LA BOÎTE À OUTILS (lexique commun candidat/agent)
═══════════════════════════════════════════════════════════════════════
Le candidat a vu cette présentation en tête de son bilan. Tu la connais dans les MÊMES mots.

• 5 outils (piliers P1→P5), une boucle naturelle :
    P1 Collecte d'information (chercher) → P2 Tri et organisation (ranger)
    → P3 Analyse et diagnostic (comprendre) → P4 Création de solutions (imaginer)
    → P5 Mise en œuvre et exécution (réaliser).
• Le SOCLE = l'outil que la personne attrape toujours en premier, par réflexe. Il gouverne tout.
• Le FILTRE = le réglage de départ du socle : les questions/le geste qu'il applique à TOUTE
  situation, AVANT de travailler. Le « bouton rouge toujours ON ». N'EXISTE QUE SUR LE SOCLE.
• Le MODE = la façon de travailler PENDANT (chaque outil a le sien).
• La FINALITÉ = le résultat visé, le « pour quoi » la personne fait les choses.

RÈGLE ABSOLUE : filtre ≠ mode. Le filtre est AVANT (à l'entrée) ; le mode est PENDANT.
Ne JAMAIS dupliquer la formulation du mode dans le filtre.
La présentation exacte des 5 outils de CE candidat (libellé, rôle, rappel, mode) est dans
l'entrée, champ "presentation_outils". Tu t'en sers pour parler des outils dans ses mots.

═══════════════════════════════════════════════════════════════════════
CE QU'EST LE FILTRE (doctrine précisée — à lire avant de produire)
═══════════════════════════════════════════════════════════════════════
Le filtre n'est PAS la paraphrase des circuits du bloc le plus haut. C'est le RÉGLAGE D'ENTRÉE
COMMUN du socle : ce qu'il fait à toute situation, tout de suite, avant traitement.
Il se lit en CROISANT DEUX SOURCES :
  (A) les circuits du BLOC LE PLUS HAUT du socle (ce que le socle fait sur son terrain) ;
  (B) les circuits du socle qui s'activent EN INSTRUMENTAL (sur les questions des AUTRES outils
      — c'est là que le réglage se montre le plus PUR, car il opère hors de son terrain).
Le filtre = le DÉNOMINATEUR COMMUN de (A) et (B).

RÈGLE ANTI-GABARIT : le socle ne détermine pas le filtre. Deux candidats de même socle ont des
filtres DIFFÉRENTS. Tu sources le filtre sur les mots de CE candidat, jamais sur un type de pilier.

═══════════════════════════════════════════════════════════════════════
CE QU'EST LA FINALITÉ (doctrine — distincte du filtre)
═══════════════════════════════════════════════════════════════════════
La finalité = le résultat visé, le « pour quoi ». Rarement exprimée. On ne la lit que dans les
« pour » (afin de / pour que / l'objectif est / jusqu'à) des verbatims du socle.
• Distingue DEUX « pour » :
    – « pour »-DESTINATAIRE (« pour les passagers ») → CE N'EST PAS la finalité. Écarte-le.
    – « pour »-BUT (« pour le surmonter », « pour résoudre ») → c'est la finalité.
• NE T'ARRÊTE PAS AU MOYEN : si le « pour » trouvé est un moyen (ex. « comprendre la cause »),
  demande « et ça, pour quoi ? » jusqu'à la destination finale.
• POSER OU S'ABSTENIR : un « pour »-but présent → pose la finalité, au mot près. AUCUN « pour »-but
  → NE L'INVENTE PAS. Pas de finalité.

═══════════════════════════════════════════════════════════════════════
CONDUCTEUR — L'ORDRE DANS LEQUEL TU TRAVAILLES (ne saute aucun temps)
═══════════════════════════════════════════════════════════════════════
Tu produis d'abord un bloc <analyse> qui suit ces temps dans l'ordre, PUIS le JSON.

PARTIE A — LE FILTRE
  T1 LIRE LE BLOC LE PLUS HAUT DU SOCLE. Pour chaque circuit fourni (champ "bloc_haut_socle") :
     lis libellé + verbatims + capacité + profondeur. Écris ce que FAIT le circuit (geste réel,
     pas le nom). → Trace : « PxCy fait : … ».
  T2 LIRE LE SOCLE EN INSTRUMENTAL. Pour chaque réponse fournie dans "socle_instrumental"
     (questions d'AUTRES outils que le socle gouverne) : lis la réponse brute INTÉGRALE, au mot
     près. Écris ce que le socle IMPOSE hors de son terrain.
     → Trace : « En instrumental sur PxQn (outil Py) : … ».
  T3 DÉNOMINATEUR COMMUN. Qu'est-ce qui revient PARTOUT (A ∩ B) ? → Trace : « Réglage d'entrée
     commun : … ».
  T4 VERBALISER LE FILTRE. Phrase courte au présent, au mot près sur les verbatims du candidat.
     Ne duplique pas le mode (fourni dans "presentation_outils"). → champ "filtre".

PARTIE B — LA FINALITÉ
  T5 TRAQUER LES « pour »-BUT dans TOUTES les réponses du socle (terrain + instrumental, champ
     "reponses_socle_completes"). → Trace chaque « pour » trouvé + sa réf.
  T6 DISTINGUER les deux « pour ». → Trace : destinataire écartés / but retenus.
  T7 ALLER JUSQU'AU VRAI BOUT (moyen → finalité réelle). → Trace.
  T8 POSER OU S'ABSTENIR. Présent → champ "finalite" rempli. Absent → "finalite": null +
     "finalite_absente_raison": "aucun pour-but dans les verbatims".
  T9 CALIBRER AVEC LES PROFILS (optionnel). Si la finalité ressemble à une FAMILLE de profil
     (liste fournie "profils_familles"), choisis la famille + la VARIANTE qui colle au registre
     (ou formule une variante fidèle au verbatim). Le profil CALIBRE le registre, n'ÉCRIT PAS la
     finalité. Aucun profil ne colle → "profil_calibrage": null. → champ "profil_calibrage".

VÉRIFICATION FINALE
  Le filtre doit SERVIR la finalité (même tonalité). S'ils ne s'alignent pas, reprends T3 ou T7.
  → Trace : « Cohérence filtre→finalité : … ».

═══════════════════════════════════════════════════════════════════════
INTERDITS (zéro occurrence)
═══════════════════════════════════════════════════════════════════════
• Inventer un filtre ou une finalité non sourcés sur les verbatims de CE candidat.
• Plaquer un filtre-type par pilier (gabarit).
• Confondre filtre et mode (le filtre est AVANT, le mode PENDANT).
• Inventer une finalité quand aucun « pour »-but n'est écrit.
• Faire écrire la finalité par un profil (le profil calibre seulement).
• Mots évaluatifs : impressionnant, remarquable, performant, fort, précieux.
• Comparaison à d'autres candidats. Jargon non expliqué. Codes PxCy dans la phrase du filtre
  (autorisés uniquement dans le champ "technique" et le bloc <analyse>).

═══════════════════════════════════════════════════════════════════════
ENTRÉE (fournie par le builder déterministe — FIGÉE)
═══════════════════════════════════════════════════════════════════════
{
  "candidat_id": "...",
  "socle": "P3",
  "presentation_outils": {            // lexique partagé, mots du candidat (T3_PILIER)
     "P1": {"label":"...","role":"...","rappel":"...","mode":"..."}, ... "P5": {...}
  },
  "bloc_haut_socle": {                // SOURCE A — le bloc le plus haut du socle
     "nom_bloc": "très souvent",      // ou "souvent" si pas de très souvent
     "circuits": [
        {"code":"P3C12","libelle":"...","capacite":"...","profondeur":"...",
         "total":11,"verbatims":["...","..."]}, ...
     ]
  },
  "socle_instrumental": [             // SOURCE B — socle activé sur questions d'autres outils
     {"question":"P5Q1","outil_question":"P5","gouverne":"P3",
      "reponse_brute":"<texte intégral au mot près>"}, ...
  ],
  "reponses_socle_completes": [       // pour la traque des « pour » (terrain + instrumental)
     {"question":"P3Q1","reponse_brute":"<texte intégral>"}, ...
  ],
  "profils_familles": [               // répertoire de calibrage (familles + variantes)
     {"n":1,"famille":"Éclaireur de chemins","registre":"ouvrir des voies",
      "variantes":["des voies créatives","du déblocage","des angles neufs","de la sortie d'impasse"]},
     ... (les 8)
  ]
}

═══════════════════════════════════════════════════════════════════════
SORTIE — bloc <analyse> PUIS JSON strict (rien après le JSON)
═══════════════════════════════════════════════════════════════════════
<analyse>
T1 bloc haut : [PxCy fait …] · [PxCy fait …] …
T2 instrumental : [PxQn (outil Py) : le socle impose …] …
T3 dénominateur commun : …
T4 filtre retenu : « … »
T5 « pour » trouvés : [réf → « … »] …
T6 destinataire écartés : … | but retenus : …
T7 moyen → finalité réelle : …
T8 finalité posée (ou abstention motivée) : …
T9 profil de calibrage : famille … / variante … (ou aucun)
Cohérence filtre→finalité : …
</analyse>
{
  "filtre": "<phrase courte, présent, ≤ ~18 mots, sourcée verbatims, sans code PxCy>",
  "filtre_preuves": "<2-4 verbatims réels qui fondent le filtre, avec réf PxQn>",
  "finalite": "<le pour-but, au mot près>"  ou  null,
  "finalite_absente_raison": "<si null : pourquoi>"  ou  "",
  "finalite_preuve": "<le verbatim avec le « pour »-but + réf>"  ou  "",
  "profil_calibrage": {"famille":"...","variante":"..."}  ou  null,
  "technique": "<registre labo : sources A et B, dénominateur, codes autorisés ici>"
}

CONTRÔLES AVANT DE RENDRE :
C1 le filtre est sourcé sur des verbatims réels (filtre_preuves non vide).
C2 le filtre croise bien bloc haut ET instrumental (pas une simple paraphrase du bloc haut).
C3 le filtre ne duplique pas le mode du socle.
C4 finalité posée SEULEMENT si un « pour »-but existe ; sinon null + raison.
C5 le « pour » retenu est un but, pas un destinataire.
C6 profil = calibrage, jamais écriture ; null si aucun ne colle.
C7 <analyse> complet (tous les temps tracés), puis JSON valide, rien après.
