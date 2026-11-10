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

## Retour vers Journée RP (activités communes)

Le service recopie aussi, dans l'autre sens, **les activités communes acceptées dans Iloh** pour les 10 personnages recopiés
(compléments `extras/{id}/months/{AAAA-MM}` → Journée RP `iloh/{id}/months/{AAAA-MM}`) : activités ajoutées dans Iloh
et personnages présents sur une activité, jamais rien d'intime. Journée RP les affiche avec la fiche, en lecture seule.
Il y dépose aussi la liste des personnages propres à Iloh (`iloh/_noms/months/liste` : noms et genres, tirés de `noms.json`),
pour que les Khurdans puissent les noter sur une activité commune dans Journée RP.
Ce sont les seules écritures du service dans Journée RP : journées, fiches et réglages n'y sont jamais modifiés.

## Nouvelles pour les personnages propres à Iloh

Quand un Khurdan note dans Journée RP une activité commune avec un personnage propre à Iloh (Shiruun, Buyan…),
et que sa journée est validée, le service crée dans Iloh la nouvelle verte pour le joueur de ce personnage
(« Tamachag a noté « Chasse » avec Shiruun. »), envoyée ensuite en notification par `iloh-notifs`.
Seulement pour la journée en cours et la veille ; si l'activité est retirée, la nouvelle l'est aussi.
`noms.json` (noms, genres, joueurs) est recréé par `dev/build.py` à chaque construction de l'appli.
