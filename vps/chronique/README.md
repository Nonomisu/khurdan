# Chronique de la semaine d'Iloh Khurdan (VPS)

Chaque **dimanche à 20 h** (heure de Paris), `chronique.js` poste sur le salon Discord commun un résumé de la semaine
de l'Iloh : journées racontées, activités communes (duos, activités à plusieurs), sorties de chasse, événements et
participants, anniversaires, commandes livrées par la logistique, invités de l'Iloh.

Il ne lit que la base Iloh Khurdan, jamais les espaces des couples (rien sur les nuits), et n'écrit que
`shared/chronique` (la semaine déjà envoyée, pour ne jamais l'envoyer deux fois). `noms.json` (noms, genres,
anniversaires) est généré par `dev/build.py`.

## Installation (une fois)

```
cd ~/khurdan-depot && git pull
mkdir -p ~/iloh-chronique && cp ~/khurdan-depot/vps/chronique/* ~/iloh-chronique/ && cd ~/iloh-chronique && npm install --omit=dev
node test-chronique.js
DST_KEY=~/secrets/khurdans-cle.json node chronique.js --apercu
pm2 start ecosystem.config.js && pm2 save
```

`--apercu` affiche la chronique de la semaine en cours sans rien envoyer. `--maintenant` l'envoie tout de suite.
Entre deux dimanches, `iloh-chronique` apparaît « stopped » dans `pm2 list` : c'est normal.

## Mise à jour

```
cd ~/khurdan-depot && git pull && cp ~/khurdan-depot/vps/chronique/* ~/iloh-chronique/ && cd ~/iloh-chronique && node test-chronique.js
```
