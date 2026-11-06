# Sauvegarde hebdomadaire d'Iloh Khurdan (VPS)

`sauvegarde.js` lit toute la base Firestore `khurdans-afc03` (sous-collections comprises : journées, espaces des couples,
nouvelles, accès…) et l'écrit dans `~/sauvegardes/iloh/iloh-AAAA-MM-JJ.json.gz` (dossier lisible par toi seul).
Il tourne sous pm2 chaque dimanche à 4 h (heure du serveur) et garde les 12 dernières sauvegardes (3 mois).
Il ne fait que lire la base, et ne touche ni à Journée RP ni aux autres services.

## Installation (une fois)

```
cd ~/khurdan-depot && git pull
mkdir -p ~/iloh-sauvegarde && cp ~/khurdan-depot/vps/sauvegarde/* ~/iloh-sauvegarde/ && cd ~/iloh-sauvegarde && npm install --omit=dev
node test-sauvegarde.js
pm2 start ecosystem.config.js && pm2 save
```

Entre deux sauvegardes, `iloh-sauvegarde` apparaît « stopped » dans `pm2 list` : c'est normal.

## Vérifier

```
ls -lh ~/sauvegardes/iloh
cd ~/iloh-sauvegarde && node verifier.js
pm2 logs iloh-sauvegarde --lines 5 --nostream
```

## Restaurer

Pas de restauration automatique : en cas de besoin, on repart d'un fichier de sauvegarde, ensemble et avec précaution.
