# Service de recopie Journée RP → Iloh Khurdan

Service Node.js lancé par pm2 sur le VPS, à côté de `quiz-bot` et `journee-rp` (sans y toucher).
Il **lit** Journée RP (projet `journal-rp`) et **écrit** dans Iloh Khurdan (projet `khurdans-afc03`), jamais l'inverse.

## Ce qui est recopié

Pour les 10 personnages tenus dans Journée RP (Tamachag, Khokkutsai, Ankhbayar, Tengis, Taiga, Inkaraa,
Khubunjin, Ogloo, Javkhaanhun, Davaajav) :

- journées (`days/…`), sans la Vie intime, sans les activités « Sexe avec … », sans la précision de nuit chaude ;
- nuits chaudes, protection, coquillages, amants (PNJ) : **dans l'espace privé du couple** (`couples/…`),
  lisible par les deux joueurs du couple seulement ; rien pour les personnages hors couple ;
- journée jouée en RP et nuit calme du jour, alertes, contrats de chasse, moments marquants ;
- listes d'activités et lieux ajoutés (`characters/…`), encart public « Aujourd'hui » (`today/…`).

Dans Iloh Khurdan, ces fiches sont en lecture seule : on continue à les remplir dans Journée RP.

## Installation (une fois)

```
git clone https://github.com/Nonomisu/khurdan.git ~/khurdan-depot
cp -r ~/khurdan-depot/vps/miroir ~/iloh-miroir
cd ~/iloh-miroir && npm install --omit=dev
node test-transform.js && node test-miroir.js      # tests sans réseau
```

Clés de service dans `~/secrets` (droits 600) : celle de `journal-rp` (déjà là pour le service `journee-rp`)
et celle de `khurdans-afc03` (console Firebase → Paramètres du projet → Comptes de service → Générer une nouvelle clé privée).
Vérifier les chemins dans `ecosystem.config.js`.

```
SRC_KEY=~/secrets/journee-rp-cle.json DST_KEY=~/secrets/khurdans-cle.json node miroir.js --tout   # recopie l'historique une fois
pm2 start ecosystem.config.js && pm2 save                        # puis écoute en direct
pm2 logs iloh-miroir --lines 30
```

Garde-fou : le service s'arrête si les clés ne sont pas celles de `journal-rp` (source) et `khurdans-afc03` (destination).
