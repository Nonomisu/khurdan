# Notifications push d'Iloh Khurdan (service du VPS)

`notifs.js` surveille la base Iloh Khurdan et envoie :
- chaque nouvelle destinée à un joueur, sur tous ses appareils abonnés, 30 secondes après sa création
  (l'auteur peut encore la corriger ou l'annuler) ; la notification ouvre la fiche du personnage ;
- une notification de bienvenue à chaque appareil qui active les notifications.

Il ne lit et n'écrit que dans `khurdans-afc03` (jamais Journée RP). Les abonnements expirés sont supprimés.

## Installation (une fois)

```
cd ~/khurdan-depot && git pull
mkdir -p ~/iloh-notifs && cp ~/khurdan-depot/vps/notifs/* ~/iloh-notifs/ && cd ~/iloh-notifs && npm install --omit=dev
npx web-push generate-vapid-keys --json > ~/secrets/iloh-vapid.json && chmod 600 ~/secrets/iloh-vapid.json
node test-notifs.js
pm2 start ecosystem.config.js && pm2 save
```

La clé publique (`publicKey` de `~/secrets/iloh-vapid.json`) va dans `VAPID_PUBLIC` de `sync.js`.
La clé privée ne quitte jamais le VPS. Ne jamais régénérer les clés : tous les appareils devraient se réabonner.

## Mise à jour

```
cd ~/khurdan-depot && git pull && cp ~/khurdan-depot/vps/notifs/*.js ~/iloh-notifs/ && cd ~/iloh-notifs && node test-notifs.js && pm2 restart iloh-notifs
```
