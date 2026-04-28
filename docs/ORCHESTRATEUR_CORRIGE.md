# ORCHESTRATEUR — PIPELINE DE PRODUCTION DES BILANS
## Script opérationnel · Projet Profil-Cognitif · Version 1.1 · 24 avril 2026

**L'orchestrateur coordonne les 6 agents et assemble le bilan HTML final.**

Il est le **point d'entrée unique** pour produire un bilan candidat : reçoit un `candidat_id` en entrée, lance les 6 agents dans le bon ordre, récupère leurs productions, les assemble selon la structure globale (Template #15), et renseigne la ligne Airtable correspondante.

---

## ⛔ DOCTRINE DE PRODUCTION — INTERDICTION DE REFORMULATION LEXIQUE

**L'orchestrateur est le garant de la cohérence lexicale du pipeline.**

Il ne produit pas lui-même de contenu cognitif, mais il **garantit** que :

1. Les **15 termes du lexique** du protocole (`REFERENTIEL_LEXIQUE_BILAN.md`) s'appliquent **mot pour mot** dans toutes les sorties des agents
2. Aucun agent n'a le droit de reformuler, paraphraser, ou adapter une définition
3. Les **termes interdits** (cylindre 4/5, pilier nécessaire au moteur, ETAPE1_T4_MOTEUR) sont bannis
4. Les **règles grammaticales** du lexique sont respectées (filtre = verbe à l'infinitif, finalité = résultat observable, nom complet des piliers)

**Rôle de l'orchestrateur dans cette doctrine** :
- Il log les sorties de chaque agent dans les champs `audit_agentX` d'Airtable
- Le certificateur (post-production) peut détecter les violations de lexique et remonter l'erreur
- Si un agent viole le lexique, sa production est rejetée et relancée

**En cas de divergence entre un prompt agent et le `REFERENTIEL_LEXIQUE_BILAN.md`, c'est le référentiel qui prime.**

---

## 1. RÔLE ET MISSION

L'orchestrateur est un **script Python** (pas un prompt LLM) qui :

1. **Lit** les données du candidat depuis Airtable (T1, T2, T3 v4, T4)
2. **Prépare** les données d'entrée pour chaque agent (payloads JSON)
3. **Appelle** les 6 agents dans l'ordre de dépendance
4. **Récupère** leurs sorties JSON
5. **Écrit** les 66 colonnes de la table `ETAPE1_T4_BILAN`
6. **Assemble** le bilan HTML complet dans la colonne `bilan_html_complet`
7. **Déclenche** le certificateur en fin de production

---

## 2. ARCHITECTURE D'EXÉCUTION

### 2.1 Ordre d'exécution des 6 agents

```
                  ┌─────────────────┐
                  │ LECTURE AIRTABLE │
                  │ Candidat X       │
                  └────────┬─────────┘
                           │
              ┌────────────┼────────────┐
              │            │            │
              ▼            ▼            ▼
        ┌─────────┐  ┌─────────┐  ┌─────────┐
        │ AGENT 6 │  │ AGENT 1 │  │ AGENT 2 │
        │Transv.  │  │Architect│  │Circuits │
        └────┬────┘  └────┬────┘  └────┬────┘
             │            │            │
             └────────────┼────────────┘
                          ▼
                     ┌─────────┐
                     │ AGENT 3 │
                     │ Modes   │
                     └────┬────┘
                          │
                          ▼
                     ┌─────────┐
                     │ AGENT 4 │
                     │ Synth.  │
                     └────┬────┘
                          │
                          ▼
                     ┌─────────┐
                     │ AGENT 5 │
                     │Coûts+Cl.│
                     └────┬────┘
                          │
                          ▼
                  ┌─────────────────┐
                  │  ASSEMBLAGE HTML │
                  │  bilan_html_complet│
                  └────────┬─────────┘
                           │
                           ▼
                  ┌─────────────────┐
                  │  CERTIFICATEUR   │
                  └─────────────────┘
```

### 2.2 Agents parallélisables

Les agents **1, 2, 6** peuvent s'exécuter **en parallèle** (ils ne dépendent pas les uns des autres). Ils reçoivent chacun leurs données d'entrée et produisent leurs sorties indépendamment.

Les agents **3, 4, 5** doivent s'exécuter **séquentiellement** après les agents 1-2-6 :
- Agent 3 a besoin des données T3/T4 (mêmes que Agent 2) mais ses sorties sont indépendantes
- Agent 4 (synthèse cœur) peut lire les sorties des agents précédents pour cohérence narrative
- Agent 5 (coûts/clôture) s'exécute en dernier car il fait la conclusion qui intègre tout

**Proposition d'optimisation** : Agents 1, 2, 3, 6 en parallèle → puis Agent 4 → puis Agent 5.

### 2.3 Gestion des erreurs

Si un agent échoue :
- Logger l'erreur (agent, candidat, payload d'entrée, réponse partielle)
- Mettre `statut_bilan = "erreur_agent{N}"` dans Airtable
- Ne pas assembler le bilan HTML tant qu'un agent a échoué
- Permettre la relance d'un agent individuellement sans re-exécuter les autres

---

## 3. SCRIPT PYTHON DE L'ORCHESTRATEUR

```python
"""
Orchestrateur — Pipeline de production des bilans Profil-Cognitif
Coordonne les 6 agents, remplit la table ETAPE1_T4_BILAN, assemble le bilan HTML.
"""

import json
import asyncio
from datetime import datetime, timezone
from anthropic import AsyncAnthropic
from pyairtable import Api

# ============================================
# CONFIGURATION
# ============================================

ANTHROPIC_API_KEY = "..."  # Depuis variables d'environnement
AIRTABLE_API_KEY = "..."
AIRTABLE_BASE_ID = "..."

TABLE_T1 = "ETAPE1_T1"
TABLE_T2 = "ETAPE1_T2"
TABLE_T3 = "ETAPE1_T3_v4"
TABLE_T4 = "ETAPE1_T4"
TABLE_T4_BILAN = "ETAPE1_T4_BILAN"

# Prompts des agents (à charger depuis les fichiers .md en fin de ce document)
AGENTS = {
    1: {"nom": "Architecture", "prompt_file": "AGENT_1_ARCHITECTURE.md", "max_tokens": 24000, "thinking": True},
    2: {"nom": "Circuits",     "prompt_file": "AGENT_2_CIRCUITS.md",     "max_tokens": 64000, "thinking": True},
    3: {"nom": "Modes",        "prompt_file": "AGENT_3_MODES.md",        "max_tokens": 32000, "thinking": True},
    4: {"nom": "Synthèse",     "prompt_file": "AGENT_4_SYNTHESE_COEUR.md","max_tokens": 32000, "thinking": True},
    5: {"nom": "Coûts+Clôture","prompt_file": "AGENT_5_COUTS_CLOTURE.md","max_tokens": 20000, "thinking": True},
    6: {"nom": "Transverses",  "prompt_file": "AGENT_6_TRANSVERSES.md",  "max_tokens": 16000, "thinking": False},
}

MODEL = "claude-sonnet-4-6"
TEMPERATURE = 0

# ============================================
# CLASSE PRINCIPALE
# ============================================

class OrchestrateurBilan:
    def __init__(self, candidat_id):
        self.candidat_id = candidat_id
        self.claude = AsyncAnthropic(api_key=ANTHROPIC_API_KEY)
        self.airtable = Api(AIRTABLE_API_KEY)
        self.base = self.airtable.base(AIRTABLE_BASE_ID)
        self.sorties_agents = {}  # {agent_num: {clé: valeur}}
        self.donnees_candidat = {}  # données T1/T2/T3/T4 remplies par lire_donnees_candidat()
    
    async def executer_pipeline(self):
        """Exécute le pipeline complet pour un candidat."""
        print(f"🚀 Démarrage pipeline pour {self.candidat_id}")
        
        # Étape 1 : lecture des données
        donnees = await self.lire_donnees_candidat()
        self.donnees_candidat = donnees  # stocker pour assembler le HTML final
        print(f"  ✓ Données candidat lues")
        
        # Étape 2 : marquer statut en production
        await self.mettre_a_jour_statut("en_production")
        
        # Étape 3 : préparer les payloads pour chaque agent
        payloads = self.preparer_payloads(donnees)
        print(f"  ✓ Payloads préparés pour les 6 agents")
        
        # Étape 4 : exécuter Agents 1, 2, 3, 6 en parallèle
        print(f"  → Lancement parallèle Agents 1, 2, 3, 6...")
        resultats_parallele = await asyncio.gather(
            self.appeler_agent(1, payloads[1]),
            self.appeler_agent(2, payloads[2]),
            self.appeler_agent(3, payloads[3]),
            self.appeler_agent(6, payloads[6]),
        )
        self.sorties_agents[1] = resultats_parallele[0]
        self.sorties_agents[2] = resultats_parallele[1]
        self.sorties_agents[3] = resultats_parallele[2]
        self.sorties_agents[6] = resultats_parallele[3]
        print(f"  ✓ Agents 1, 2, 3, 6 terminés")
        
        # Étape 5 : Agent 4 (synthèse cœur) — après les précédents
        print(f"  → Lancement Agent 4 Synthèse cœur...")
        self.sorties_agents[4] = await self.appeler_agent(4, payloads[4])
        print(f"  ✓ Agent 4 terminé")
        
        # Étape 6 : Agent 5 (coûts + conclusion)
        print(f"  → Lancement Agent 5 Coûts et clôture...")
        self.sorties_agents[5] = await self.appeler_agent(5, payloads[5])
        print(f"  ✓ Agent 5 terminé")
        
        # Étape 7 : écrire toutes les colonnes dans Airtable
        await self.ecrire_colonnes_airtable()
        print(f"  ✓ 66 colonnes écrites dans ETAPE1_T4_BILAN")
        
        # Étape 8 : assembler le bilan HTML complet
        bilan_html = self.assembler_bilan_html()
        await self.ecrire_bilan_complet(bilan_html)
        print(f"  ✓ Bilan HTML complet assemblé")
        
        # Étape 9 : marquer statut terminé et déclencher certificateur
        await self.mettre_a_jour_statut("termine")
        print(f"✅ Pipeline terminé pour {self.candidat_id}")
        
        return bilan_html
    
    async def lire_donnees_candidat(self):
        """Lit toutes les données T1, T2, T3, T4 du candidat depuis Airtable."""
        donnees = {
            "candidat_id": self.candidat_id,
            "prenom": "",
            "t1": [],
            "t2": [],
            "t3": [],
            "t4": {}
        }
        
        # Lire T1
        table_t1 = self.base.table(TABLE_T1)
        donnees["t1"] = table_t1.all(formula=f"{{candidat_id}}='{self.candidat_id}'")
        
        # Prénom depuis T1
        if donnees["t1"]:
            donnees["prenom"] = donnees["t1"][0]["fields"].get("prenom", "")
        
        # Lire T2
        table_t2 = self.base.table(TABLE_T2)
        donnees["t2"] = table_t2.all(formula=f"{{candidat_id}}='{self.candidat_id}'")
        
        # Lire T3 v4 (75 lignes par candidat)
        table_t3 = self.base.table(TABLE_T3)
        donnees["t3"] = table_t3.all(formula=f"{{candidat_id}}='{self.candidat_id}'")
        
        # Lire T4 (attributions)
        table_t4 = self.base.table(TABLE_T4)
        t4_records = table_t4.all(formula=f"{{candidat_id}}='{self.candidat_id}'")
        if t4_records:
            donnees["t4"] = t4_records[0]["fields"]
        
        return donnees
    
    def preparer_payloads(self, donnees):
        """Prépare les données d'entrée JSON pour chaque agent."""
        # Agrégations communes
        nb_conformes = self.compter_conformes(donnees["t1"])
        nb_ecart = self.compter_ecart(donnees["t1"])
        ecart_details = self.extraire_ecart_details(donnees["t1"])
        
        # Données par pilier (T3 + T4)
        donnees_piliers = self.agreger_par_pilier(donnees["t3"], donnees["t4"])
        
        # Clusters du socle
        pilier_socle_id = self.identifier_pilier_socle(donnees["t4"])
        clusters_socle = self.extraire_clusters_pilier(donnees["t3"], pilier_socle_id)
        
        # Séquences de piliers (pour boucle)
        sequences = self.analyser_sequences_piliers(donnees["t1"])
        
        # Payload commun
        payload_base = {
            "candidat_id": donnees["candidat_id"],
            "prenom": donnees["prenom"],
        }
        
        # Payloads par agent
        payloads = {
            1: {
                **payload_base,
                "nb_conformes": nb_conformes,
                "nb_ecart": nb_ecart,
                "ecart_details": ecart_details,
                "piliers": donnees_piliers,
            },
            2: {
                **payload_base,
                "donnees_t3_par_pilier": self.organiser_t3_par_pilier(donnees["t3"]),
                "roles_piliers": self.extraire_roles_piliers(donnees["t4"]),
            },
            3: {
                **payload_base,
                "piliers": donnees_piliers,
                "filtre_formulation": donnees["t4"].get("filtre_formulation", ""),
            },
            4: {
                **payload_base,
                "nb_conformes": nb_conformes,
                "nb_ecart": nb_ecart,
                "ecart_details": ecart_details,
                "pilier_socle": donnees_piliers.get(pilier_socle_id),
                "clusters_socle": clusters_socle,
                "sequences": sequences,
                "filtre": {
                    "formulation": donnees["t4"].get("filtre_formulation"),
                    "precision_semantique": donnees["t4"].get("filtre_precision_semantique"),
                },
                "finalite_grandes_lignes": donnees["t4"].get("finalite_grandes_lignes", []),
            },
            5: {
                **payload_base,
                "piliers": donnees_piliers,
                "filtre": donnees["t4"].get("filtre_formulation", ""),
                "grande_ligne_finalite_principale": donnees["t4"].get("finalite_grandes_lignes", [{}])[0].get("formulation", ""),
            },
            6: {
                **payload_base,
                "nb_conformes": nb_conformes,
                "nb_ecart": nb_ecart,
                "nb_scenarios": 4,
                "pilier_socle": donnees_piliers.get(pilier_socle_id),
                "piliers_structurants": self.extraire_piliers_par_role(donnees_piliers, ["pilier_structurant_1", "pilier_structurant_2"]),
                "piliers_fonctionnels": self.extraire_piliers_par_role(donnees_piliers, ["pilier_fonctionnel_1", "pilier_fonctionnel_2", "pilier_resistant"]),
                "filtre_formulation": donnees["t4"].get("filtre_formulation", ""),
                "grandes_lignes_finalite": donnees["t4"].get("finalite_grandes_lignes", []),
            }
        }
        
        return payloads
    
    async def appeler_agent(self, num_agent, payload):
        """Appelle un agent Claude avec son prompt et son payload."""
        config = AGENTS[num_agent]
        
        # Charger le prompt système
        with open(f"prompts/{config['prompt_file']}", 'r', encoding='utf-8') as f:
            system_prompt = f.read()
        
        # Message utilisateur = payload JSON
        user_message = json.dumps(payload, ensure_ascii=False, indent=2)
        
        # Paramètres d'appel
        params = {
            "model": MODEL,
            "max_tokens": config["max_tokens"],
            "temperature": TEMPERATURE,
            "system": system_prompt,
            "messages": [{"role": "user", "content": user_message}]
        }
        
        if config["thinking"]:
            params["thinking"] = {"type": "enabled", "budget_tokens": 16000}
        
        # Appel API
        response = await self.claude.messages.create(**params)
        
        # Extraire le contenu (ignorer les blocs thinking)
        texte = ""
        for block in response.content:
            if block.type == "text":
                texte += block.text
        
        # Parser le JSON de sortie (en extrayant le JSON du texte)
        return self.parser_json_sortie(texte)
    
    def parser_json_sortie(self, texte):
        """Extrait le JSON de la réponse de l'agent (qui peut contenir du markdown avant/après)."""
        # Chercher le premier { et le dernier } pour isoler le JSON
        debut = texte.find('{')
        fin = texte.rfind('}')
        if debut == -1 or fin == -1:
            raise ValueError(f"Pas de JSON valide dans la sortie agent : {texte[:200]}")
        return json.loads(texte[debut:fin+1])
    
    async def ecrire_colonnes_airtable(self):
        """Écrit toutes les sorties des agents dans la ligne candidat de ETAPE1_T4_BILAN."""
        table = self.base.table(TABLE_T4_BILAN)
        
        # Agréger toutes les sorties
        fields_a_ecrire = {
            "candidat_id": self.candidat_id,
            "prenom": self.donnees_candidat.get("prenom", ""),
            "statut_bilan": "en_production",
        }
        
        # Fusionner les sorties de tous les agents
        for num_agent, sortie in self.sorties_agents.items():
            fields_a_ecrire.update(sortie)
        
        # Rechercher la ligne existante ou créer
        records_existants = table.all(formula=f"{{candidat_id}}='{self.candidat_id}'")
        if records_existants:
            table.update(records_existants[0]["id"], fields_a_ecrire)
        else:
            table.create(fields_a_ecrire)
    
    def assembler_bilan_html(self):
        """Assemble le bilan HTML complet selon la structure du Template #15."""
        # Récupérer les éléments de l'agent 6 (structure)
        s6 = self.sorties_agents[6]
        
        # Récupérer les éléments par pilier (agents 1, 2, 3)
        s1 = self.sorties_agents[1]
        s2 = self.sorties_agents[2]
        s3 = self.sorties_agents[3]
        
        # Récupérer la synthèse (agent 4)
        s4 = self.sorties_agents[4]
        
        # Récupérer la clôture (agent 5)
        s5 = self.sorties_agents[5]
        
        # Assemblage dans l'ordre du Template #15
        html = f"""<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Profil Cognitif · Bilan {self.donnees_candidat.get("prenom", "")}</title>
<style>
  /* CSS complet du bilan — voir fichier externe pc_bilan_styles.css */
  @import url('/static/pc_bilan_styles.css');
</style>
</head>
<body>
{s6['e_header']}

{s6['e_navigation']}

<main class="bilan-container">

  <!-- SECTION A · VOTRE MOTEUR COGNITIF -->
  <section id="moteur" class="section-a">
    <h2>Votre moteur cognitif</h2>
    {s6['a_definition_moteur']}
    {s6['a_legende_couleurs']}
    {s6['a_ordre_boucle']}
    
    <div class="schema-etat-wrap">
      <h3>Le schéma générique d'un moteur cognitif</h3>
      {s6['a_schema_generique']}
    </div>
    
    <div class="schema-etat-wrap">
      <h3>Le schéma de votre moteur cognitif</h3>
      {s6['a_schema_revelation']}
      {s6['a_cartouche_attribution']}
    </div>
  </section>

  <!-- SECTION B · LEXIQUE -->
  {s6['b_lexique_html']}

  <!-- SECTION C · ANALYSE DES 5 PILIERS -->
  <section class="section-c">
    <h2>Analyse de vos 5 piliers</h2>
    
    <!-- P1 -->
    <article class="bloc-pilier">
      {s1['p1_entete']}
      {s1['p1_pourquoi_role']}
      <div class="circuits-section">
        <h3>Circuits activés dans votre Collecte d'information</h3>
        <div class="double-vue">
          <div class="vue-labo">{s2['p1_circuits_lab']}</div>
          <div class="vue-cand">{s2['p1_circuits_cand']}</div>
        </div>
      </div>
      {s3['p1_mode_lab']}
      {s3['p1_mode_cand']}
    </article>
    
    <!-- P2 -->
    <article class="bloc-pilier">
      {s1['p2_entete']}
      {s1['p2_pourquoi_role']}
      <!-- circuits + mode P2 -->
      <div class="circuits-section">
        <h3>Circuits activés dans votre Tri</h3>
        <div class="double-vue">
          <div class="vue-labo">{s2['p2_circuits_lab']}</div>
          <div class="vue-cand">{s2['p2_circuits_cand']}</div>
        </div>
      </div>
      {s3['p2_mode_lab']}
      {s3['p2_mode_cand']}
    </article>
    
    <!-- P3 -->
    <article class="bloc-pilier">
      {s1['p3_entete']}
      {s1['p3_pourquoi_role']}
      <div class="circuits-section">
        <h3>Circuits activés dans votre Analyse</h3>
        <div class="double-vue">
          <div class="vue-labo">{s2['p3_circuits_lab']}</div>
          <div class="vue-cand">{s2['p3_circuits_cand']}</div>
        </div>
      </div>
      {s3['p3_mode_lab']}
      {s3['p3_mode_cand']}
    </article>
    
    <!-- P4 -->
    <article class="bloc-pilier">
      {s1['p4_entete']}
      {s1['p4_pourquoi_role']}
      <div class="circuits-section">
        <h3>Circuits activés dans votre Création de solutions</h3>
        <div class="double-vue">
          <div class="vue-labo">{s2['p4_circuits_lab']}</div>
          <div class="vue-cand">{s2['p4_circuits_cand']}</div>
        </div>
      </div>
      {s3['p4_mode_lab']}
      {s3['p4_mode_cand']}
    </article>
    
    <!-- P5 -->
    <article class="bloc-pilier">
      {s1['p5_entete']}
      {s1['p5_pourquoi_role']}
      <div class="circuits-section">
        <h3>Circuits activés dans votre Mise en œuvre et exécution</h3>
        <div class="double-vue">
          <div class="vue-labo">{s2['p5_circuits_lab']}</div>
          <div class="vue-cand">{s2['p5_circuits_cand']}</div>
        </div>
      </div>
      {s3['p5_mode_lab']}
      {s3['p5_mode_cand']}
    </article>
  </section>

  <!-- TRANSITION VERS SYNTHÈSE -->
  <div class="transition-synthese">
    <p>Maintenant que nous avons détaillé chacun de vos 5 piliers, voici ce que leur assemblage révèle de votre architecture cognitive.</p>
  </div>

  <!-- SECTION D · SYNTHÈSE FINALE -->
  <section id="synthese" class="section-d">
    <h2>Synthèse finale</h2>
    
    <!-- D.1 Filtre -->
    <div class="double-vue">
      <div class="vue-labo">{s4['d1_filtre_lab']}</div>
      <div class="vue-cand">{s4['d1_filtre_cand']}</div>
    </div>
    
    <!-- D.2 Boucle -->
    <div class="double-vue">
      <div class="vue-labo">{s4['d2_boucle_lab']}</div>
      <div class="vue-cand">{s4['d2_boucle_cand']}</div>
    </div>
    
    <!-- D.3 Finalité -->
    <div class="double-vue">
      <div class="vue-labo">{s4['d3_finalite_lab']}</div>
      <div class="vue-cand">{s4['d3_finalite_cand']}</div>
    </div>
    
    <!-- D.4 Signature (intégrée) -->
    {s4['d4_signature']}
    
    <!-- D.5 Zones de coût -->
    <div class="double-vue">
      <div class="vue-labo">{s5['d5_couts_lab']}</div>
      <div class="vue-cand">{s5['d5_couts_cand']}</div>
    </div>
    
    <!-- D.6 Conclusion -->
    {s5['d6_conclusion']}
  </section>

</main>

{s6['e_footer']}

</body>
</html>
"""
        return html
    
    async def ecrire_bilan_complet(self, bilan_html):
        """Écrit le bilan HTML assemblé dans la colonne bilan_html_complet."""
        table = self.base.table(TABLE_T4_BILAN)
        records = table.all(formula=f"{{candidat_id}}='{self.candidat_id}'")
        if records:
            table.update(records[0]["id"], {"bilan_html_complet": bilan_html})
    
    async def mettre_a_jour_statut(self, statut):
        """Met à jour la colonne statut_bilan."""
        table = self.base.table(TABLE_T4_BILAN)
        records = table.all(formula=f"{{candidat_id}}='{self.candidat_id}'")
        if records:
            table.update(records[0]["id"], {"statut_bilan": statut})
        else:
            table.create({"candidat_id": self.candidat_id, "statut_bilan": statut})
    
    # ============================================
    # FONCTIONS UTILITAIRES (à implémenter selon schéma Airtable)
    # ============================================
    
    def compter_conformes(self, t1_records):
        return sum(1 for r in t1_records if r["fields"].get("V1") == "OUI")
    
    def compter_ecart(self, t1_records):
        return sum(1 for r in t1_records if r["fields"].get("V1") == "NON")
    
    def extraire_ecart_details(self, t1_records):
        return [
            {
                "question_id": r["fields"].get("question_id"),
                "pilier_attendu": r["fields"].get("pilier_attendu"),
                "pilier_coeur_reponse": r["fields"].get("pilier_coeur_analyse")
            }
            for r in t1_records if r["fields"].get("V1") == "NON"
        ]
    
    def agreger_par_pilier(self, t3_records, t4_fields):
        """Agrège les données par pilier (rôle, mode, nb circuits actifs, total activations,
        circuits dominants top 5, clusters).
        
        Utilise extraire_roles_piliers et extraire_clusters_pilier pour enrichir.
        """
        roles = self.extraire_roles_piliers(t4_fields)
        piliers = {}
        for pid in ["P1", "P2", "P3", "P4", "P5"]:
            circuits_pilier = [r["fields"] for r in t3_records if r["fields"].get("pilier") == pid]
            # Filtre robuste : "actif" peut être "OUI", True, ou "1"
            actifs = [c for c in circuits_pilier if str(c.get("actif", "")).upper() in ("OUI", "TRUE", "1")]
            piliers[pid] = {
                "id": pid,
                "nom": self.get_nom_pilier(pid),
                "role": roles.get(pid, ""),
                "mode_retenu": t4_fields.get(f"{pid.lower()}_mode_retenu", ""),
                "nb_circuits_actifs": len(actifs),
                "total_activations": sum(c.get("frequence", 0) for c in actifs),
                "circuits_dominants_top5": sorted(
                    [{"id": c["circuit_id"], "nom": c["circuit_nom"], "frequence": c["frequence"]} for c in actifs],
                    key=lambda x: -x["frequence"]
                )[:5],
                "clusters": self.extraire_clusters_pilier(t3_records, pid)
            }
        return piliers
    
    def get_nom_pilier(self, pid):
        return {
            "P1": "Collecte d'information",
            "P2": "Tri",
            "P3": "Analyse",
            "P4": "Création de solutions",
            "P5": "Mise en œuvre et exécution"
        }[pid]
    
    def identifier_pilier_socle(self, t4_fields):
        """Identifie le pilier socle depuis T4 (champ pilier_socle).
        
        Format attendu : "P3" ou "P4" etc.
        Fallback : si vide, chercher dans les rôles des piliers le rôle "Pilier socle".
        """
        socle = t4_fields.get("pilier_socle", "").strip()
        if socle in ["P1", "P2", "P3", "P4", "P5"]:
            return socle
        
        # Fallback : chercher dans p1_role...p5_role
        for pid in ["P1", "P2", "P3", "P4", "P5"]:
            role = t4_fields.get(f"{pid.lower()}_role", "").lower()
            if "socle" in role:
                return pid
        
        # Pas de socle identifié → erreur remontée
        raise ValueError(f"Pilier socle non identifiable pour candidat {self.candidat_id} — T4 incomplet")
    
    def extraire_clusters_pilier(self, t3_records, pilier_id):
        """Extrait les clusters d'un pilier depuis T3 v4 (champ clusters_identifies).
        
        T3 v4 a un champ 'clusters_identifies' qui contient les co-occurrences de circuits
        du pilier, au format string structuré (ex: "C10×C15: 6 co-oc, C10×C12: 5 co-oc, ...").
        
        Ce champ est renseigné au niveau de chaque ligne T3 du pilier mais la valeur est
        identique pour toutes les lignes du même pilier (c'est une agrégation au niveau pilier).
        
        Retourne une liste ordonnée par fréquence décroissante de tuples (circuit1, circuit2, nb_co_oc).
        """
        # Prendre la première ligne T3 du pilier qui contient clusters_identifies
        clusters_str = ""
        for r in t3_records:
            fields = r["fields"]
            if fields.get("pilier") == pilier_id and fields.get("clusters_identifies"):
                clusters_str = fields["clusters_identifies"]
                break
        
        if not clusters_str:
            return []
        
        # Parsing format "C10×C15: 6 co-oc, C10×C12: 5 co-oc, ..."
        clusters = []
        for token in clusters_str.split(","):
            token = token.strip()
            if not token:
                continue
            # Format attendu : "C10×C15: 6 co-oc" ou "C10 × C15 : 6 co-oc"
            import re
            m = re.match(r"C(\d+)\s*[×x*]\s*C(\d+)\s*:\s*(\d+)", token)
            if m:
                c1, c2, nb = m.group(1), m.group(2), int(m.group(3))
                clusters.append({
                    "circuit_1": f"C{c1}",
                    "circuit_2": f"C{c2}",
                    "nb_co_occurrences": nb
                })
        
        # Tri par fréquence décroissante
        clusters.sort(key=lambda x: -x["nb_co_occurrences"])
        return clusters
    
    def analyser_sequences_piliers(self, t1_records):
        """Analyse les séquences de piliers à partir de T1 (champ verbes_angles_piliers).
        
        T1 contient pour chaque question un champ 'verbes_angles_piliers' qui liste
        les piliers activés dans l'ordre d'apparition dans le discours
        (format attendu : "P3 → P1 → P3 → P4 → P5").
        
        Retourne :
        - patterns_dominants : les séquences les plus fréquentes avec leur nombre
        - pilier_entree_systematique : le pilier qui ouvre le plus souvent
        - exemples_par_pattern : 2-3 questions exemples pour chaque pattern
        """
        from collections import Counter
        
        sequences_brutes = []
        premiers_piliers = []
        
        for r in t1_records:
            fields = r["fields"]
            seq_str = fields.get("verbes_angles_piliers", "")
            q_id = fields.get("id_question", "")
            if not seq_str:
                continue
            
            # Parser la séquence (format "P3 → P1 → P3 → P4 → P5")
            # Tolérant à différents séparateurs
            import re
            pids = re.findall(r"P\d", seq_str)
            if not pids:
                continue
            
            seq_tuple = tuple(pids)
            sequences_brutes.append({"question_id": q_id, "sequence": seq_tuple})
            premiers_piliers.append(pids[0])
        
        # Pilier d'entrée systématique
        if premiers_piliers:
            pilier_entree = Counter(premiers_piliers).most_common(1)[0][0]
            pct_entree = Counter(premiers_piliers)[pilier_entree] / len(premiers_piliers) * 100
        else:
            pilier_entree = None
            pct_entree = 0
        
        # Patterns dominants (séquences complètes les plus fréquentes)
        compteur_seq = Counter([s["sequence"] for s in sequences_brutes])
        patterns_dominants = []
        for seq_tuple, nb in compteur_seq.most_common(5):
            exemples = [s["question_id"] for s in sequences_brutes if s["sequence"] == seq_tuple][:3]
            patterns_dominants.append({
                "sequence": " → ".join(seq_tuple),
                "nb_occurrences": nb,
                "exemples_questions": exemples
            })
        
        # Toutes les boucles sortent-elles par P5 ?
        nb_sortie_p5 = sum(1 for s in sequences_brutes if s["sequence"] and s["sequence"][-1] == "P5")
        pct_sortie_p5 = nb_sortie_p5 / len(sequences_brutes) * 100 if sequences_brutes else 0
        
        return {
            "pilier_entree_systematique": pilier_entree,
            "pct_entree_systematique": round(pct_entree, 1),
            "patterns_dominants": patterns_dominants,
            "nb_total_sequences": len(sequences_brutes),
            "pct_sortie_p5": round(pct_sortie_p5, 1)
        }
    
    def organiser_t3_par_pilier(self, t3_records):
        """Group-by T3 par pilier, avec tous les champs d'analyse v4.
        
        Retourne {"P1": [circuits...], "P2": [...], ...} 
        où chaque circuit est un dict complet avec ses champs T3 v4 (activations_franches,
        activations_nuancees, clusters_identifies, commentaire_attribution, etc.).
        """
        result = {"P1": [], "P2": [], "P3": [], "P4": [], "P5": []}
        for r in t3_records:
            fields = r["fields"]
            pid = fields.get("pilier", "")
            if pid in result:
                result[pid].append({
                    "circuit_id": fields.get("circuit_id", ""),
                    "circuit_nom": fields.get("circuit_nom", ""),
                    "frequence": fields.get("frequence", 0),
                    "niveau_activation": fields.get("niveau_activation", ""),
                    "actif": fields.get("actif", ""),
                    "activations_franches": fields.get("activations_franches", ""),
                    "activations_nuancees": fields.get("activations_nuancees", ""),
                    "clusters_identifies": fields.get("clusters_identifies", ""),
                    "commentaire_attribution": fields.get("commentaire_attribution", ""),
                    "types_verbatim_detail": fields.get("types_verbatim_detail", "")
                })
        # Tri des circuits de chaque pilier par fréquence décroissante
        for pid in result:
            result[pid].sort(key=lambda c: -c.get("frequence", 0))
        return result
    
    def extraire_roles_piliers(self, t4_fields):
        """Extrait le rôle de chaque pilier depuis T4.
        
        Retourne {"P1": "Pilier fonctionnel 1", "P2": "Pilier structurant 2", ...}
        
        T4 peut stocker les rôles sous plusieurs formes :
        - Champs explicites pX_role (recommandé)
        - Champs pilier_socle, pilier_struct1, pilier_struct2 (fallback ancien format)
        """
        roles = {"P1": "", "P2": "", "P3": "", "P4": "", "P5": ""}
        
        # Tentative format explicite pX_role
        for pid in ["P1", "P2", "P3", "P4", "P5"]:
            champ = t4_fields.get(f"{pid.lower()}_role", "").strip()
            if champ:
                roles[pid] = champ
        
        # Si au moins un rôle est renseigné explicitement, on retourne
        if any(roles.values()):
            return roles
        
        # Fallback : reconstituer à partir de pilier_socle / pilier_struct1 / pilier_struct2
        socle = t4_fields.get("pilier_socle", "").strip()
        struct1 = t4_fields.get("pilier_struct1", "").strip()
        struct2 = t4_fields.get("pilier_struct2", "").strip()
        
        if socle in roles:
            roles[socle] = "Pilier socle"
        if struct1 in roles:
            roles[struct1] = "Pilier structurant 1"
        if struct2 in roles:
            roles[struct2] = "Pilier structurant 2"
        
        # Les piliers restants sont fonctionnels (fonctionnel 1 pour le plus en amont du cycle, 2 pour l'aval)
        ordre_cycle = ["P1", "P2", "P3", "P4", "P5"]
        fonctionnels_restants = [p for p in ordre_cycle if not roles[p]]
        for i, pid in enumerate(fonctionnels_restants, start=1):
            if i == 1:
                roles[pid] = "Pilier fonctionnel 1"
            elif i == 2:
                roles[pid] = "Pilier fonctionnel 2"
            else:
                roles[pid] = "Pilier fonctionnel"
        
        return roles
    
    def extraire_piliers_par_role(self, donnees_piliers, roles_cibles):
        """Extrait les piliers qui ont un des rôles cibles.
        
        donnees_piliers = {"P1": {...}, "P2": {...}, ...} (sortie d'agreger_par_pilier)
        roles_cibles = liste de rôles recherchés, ex: ["pilier_structurant_1", "pilier_structurant_2"]
        
        Normalise les variantes de libellés (ex: "Pilier structurant 1" vs "pilier_structurant_1").
        
        Retourne une liste de dicts piliers filtrés (préservant l'ordre P1→P5).
        """
        def normaliser(s):
            return s.lower().replace(" ", "_").replace("·", "").replace("_de_cycle", "").replace("_cycle", "").strip()
        
        roles_cibles_norm = [normaliser(r) for r in roles_cibles]
        
        result = []
        for pid in ["P1", "P2", "P3", "P4", "P5"]:
            bloc = donnees_piliers.get(pid, {})
            role = bloc.get("role", "")
            role_norm = normaliser(role)
            # Match exact ou partiel (ex: "pilier_fonctionnel_1" match "pilier_fonctionnel_1_entree")
            if any(rn == role_norm or rn in role_norm or role_norm in rn for rn in roles_cibles_norm):
                result.append(bloc)
        return result


# ============================================
# POINT D'ENTRÉE
# ============================================

async def main(candidat_id):
    orchestrateur = OrchestrateurBilan(candidat_id)
    bilan_html = await orchestrateur.executer_pipeline()
    print(f"Bilan produit pour {candidat_id}")
    return bilan_html


if __name__ == "__main__":
    import sys
    candidat_id = sys.argv[1] if len(sys.argv) > 1 else "cecile"
    asyncio.run(main(candidat_id))
```

---

## 4. POINT D'ENTRÉE — USAGE

### 4.1 Production d'un bilan unique

```bash
python orchestrateur.py cecile
```

### 4.2 Production en batch (tous les candidats)

```python
import asyncio
from orchestrateur import OrchestrateurBilan

async def batch(candidats):
    for candidat_id in candidats:
        try:
            o = OrchestrateurBilan(candidat_id)
            await o.executer_pipeline()
        except Exception as e:
            print(f"❌ Erreur pour {candidat_id} : {e}")

asyncio.run(batch(["cecile", "remi", "veronique"]))
```

### 4.3 Production sélective (relancer un agent)

Si un agent a échoué ou produit une sortie insatisfaisante :

```python
o = OrchestrateurBilan("cecile")
# Relancer uniquement Agent 4
await o.relancer_agent(4)
# Puis ré-assembler le bilan
bilan = o.assembler_bilan_html()
await o.ecrire_bilan_complet(bilan)
```

---

## 5. MONITORING ET LOGS

### 5.1 Logs à implémenter

Pour chaque agent, logger :
- Timestamp de début et de fin
- Nombre de tokens en entrée (system + user)
- Nombre de tokens en sortie
- Coût estimé (avec tarifs Anthropic)
- Validité du JSON de sortie
- Échecs éventuels (avec réponse brute)

### 5.2 Coût estimé par bilan

| Agent | Max tokens input | Max tokens output | Coût estimé (USD) |
|---|---|---|---|
| Agent 6 Transverses | ~3 000 | ~16 000 | 0,30 |
| Agent 1 Architecture | ~4 000 | ~24 000 | 0,40 |
| Agent 2 Circuits | ~20 000 | ~64 000 | 1,50 |
| Agent 3 Modes | ~6 000 | ~32 000 | 0,60 |
| Agent 4 Synthèse | ~8 000 | ~32 000 | 0,70 |
| Agent 5 Coûts+Cl. | ~6 000 | ~20 000 | 0,40 |
| **Total par bilan** | | | **~3,90 USD** |

**Coût pour 1000 bilans** : ~3 900 USD (hors coût de certification).

### 5.3 Temps estimé par bilan

- Agents en parallèle (1, 2, 3, 6) : ~60 secondes
- Agent 4 : ~40 secondes
- Agent 5 : ~25 secondes
- Assemblage HTML + écriture Airtable : ~5 secondes

**Total** : **~2 minutes par bilan**.

---

## 6. CHECKLIST DE DÉPLOIEMENT

Avant de mettre l'orchestrateur en production :

### 6.1 Données Airtable
- [ ] Table `ETAPE1_T1` peuplée pour le candidat
- [ ] Table `ETAPE1_T2` peuplée
- [ ] Table `ETAPE1_T3_v4` peuplée (75 lignes)
- [ ] Table `ETAPE1_T4` peuplée (attributions + filtre + grandes lignes finalité)
- [ ] Table `ETAPE1_T4_BILAN` créée avec les 66 colonnes

### 6.2 Code
- [ ] `ANTHROPIC_API_KEY` configurée en variable d'environnement
- [ ] `AIRTABLE_API_KEY` et `AIRTABLE_BASE_ID` configurés
- [ ] Les 6 prompts agents placés dans `prompts/`
- [ ] Fichier CSS `pc_bilan_styles.css` accessible au frontend

### 6.3 Tests
- [ ] Test sur Cécile : bilan produit cohérent avec le bilan manuel V2
- [ ] Test sur Rémi : bilan produit sans erreur
- [ ] Test sur Véronique : bilan produit sans erreur
- [ ] Test de relance d'un agent après erreur

### 6.4 Monitoring
- [ ] Logs configurés et centralisés
- [ ] Alertes en cas d'échec d'agent
- [ ] Tableau de bord des coûts et temps par bilan

---

## 7. AMÉLIORATIONS FUTURES

Une fois la v1 stable, pistes d'amélioration :

- **Cache intelligent** : si un candidat a déjà été traité, ne relancer que les agents dont les données d'entrée ont changé
- **Production incrémentale** : permettre au certificateur de signaler des corrections ciblées à un agent sans relancer tout le pipeline
- **Versioning des bilans** : conserver l'historique des versions successives
- **Agent certificateur** : prompt dédié qui vérifie les 15 check-lists de chaque template sur le bilan produit
- **Agent 7 Correcteur** : si le certificateur détecte des non-conformités, un agent dédié peut corriger localement sans relancer tout

---

## FIN DU SCRIPT ORCHESTRATEUR
