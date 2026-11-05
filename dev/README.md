# Développement d'Iloh Khurdan

L'appli publiée (`index.html` + `app.js` à la racine) est **générée** à partir de l'aperçu :

| Fichier | Rôle |
|---|---|
| `dev/apercu.html` | Source de l'interface et de toute la logique (version « aperçu » autonome, sans Firebase). C'est **ce fichier** qu'on modifie. |
| `dev/persist.js` | Ajouté à la fin d'`app.js` : sérialisation des données et API `window.RP_APP` utilisée par `sync.js`. |
| `dev/discord-part.js` | Ajouté à la fin d'`app.js` : envoi des journées validées sur Discord (embed + image du récap), lien direct `?fiche=…&jour=…`. |
| `dev/build.py` | Transforme l'aperçu en appli : retire ce qui est propre à l'aperçu, branche l'historique réel, Discord, la connexion. Chaque remplacement est vérifié. |
| `sync.js` | Écrit à la main : connexion Google, lecture/écriture Firestore, mises à jour en direct. |
| `firebase-config.js` | Configuration publique du projet Firebase `journal-rp`. |

## Modifier l'appli

1. Modifier `dev/apercu.html` (et au besoin `dev/persist.js`, `dev/discord-part.js`, `sync.js`).
2. `python3 dev/build.py` — régénère `index.html` et `app.js`.
3. `node --check app.js`, puis tests ci-dessous.
4. `git commit` puis `git push` : GitHub Pages publie en 1 à 2 minutes.

## Tests

`dev/tests/` contient un test de bout en bout (Playwright) avec un Firestore simulé (`dev/tests/mockfb/`,
stockage dans localStorage, partagé entre onglets) : admin, deux joueuses, un compte non invité.

```
python3 -m http.server 8765        # à la racine du dépôt, dans un autre terminal
node dev/tests/groupe.js           # largeur téléphone (420 px)
node dev/tests/groupe.js 1280      # largeur PC
```

## Données Firestore

- `access/{adresse}` : `player`, `role` (`admin` ou `joueur`) — créé par l'admin, décide qui entre
- `players/{id}` : nom, couleur, rôle (page d'admin, à venir)
- `characters/{id}` : `player`, `addedActs`, `removedActs`, `addedRegions`, `customPlaces`, catégories — créé par l'admin
- `days/{id}/months/{AAAA-MM}` : un champ par jour (`"30"`), journée encodée (Sets → `{$set:[…]}`)
- `couples/{couple}` : `chars`, `players` ; dessous, tout ce qui est intime (nuits chaudes, protection) — à brancher
- `shared/global` : alertes, événements, arcs, jalons, contrats, jours de travail
- `shared/day-AAAA-MM-JJ` : ce qui lie des personnages ce jour-là (nuits calmes, journées jouées en RP, météo)
- `shared/discord` : `webhook` du salon commun (lu par les joueurs, réglé par l'admin)
- `shared/wraps-AAAA` : verrou d'envoi des wraps
- `news/{clé}` : `from`, `to`, `text`, `charId`, `key`, `read`, `createdAt`, `pushedAt`
- `pushSubs/{joueur}/subs/{id}` : abonnements aux notifications
- `today/{id}` : encart public des fiches (`mood`, `activities`, `place`, `updatedAt`)

Les règles de sécurité ne sont pas dans le dépôt : elles sont dans la console Firebase, onglet Règles de Firestore.
