# Iloh Khurdan

Journal RP de groupe : chaque joueur tient au quotidien la journée de ses personnages khurdans
(Final Fantasy XIV), lit celles des autres, et reçoit récaps, nouvelles et wraps annuels.

Appli web publiée sur GitHub Pages (`https://nonomisu.github.io/khurdan/`), données dans Firebase
(projet `khurdans-afc03` : connexion Google, Firestore). Projet séparé de Journée RP : rien ici ne touche
l'appli du couple ni ses données.

## Joueurs, personnages, accès

- Joueurs, groupes et personnages : en tête du script de `dev/apercu.html` (`PLAYERS`, `GROUP_DEFS`, `C`, puis `PAIRS`,
  `FRIENDS`, `BIRTHDAYS` plus bas). Aucune adresse e-mail dans le dépôt.
- Accès : un document `access/{adresse Google en minuscules}` = `{ player, role }` par joueur, créé par l'admin.
  Sans ce document, la connexion est refusée.
- Les règles Firestore sont dans la console Firebase, pas dans ce dépôt.

## Avancement

1. Décisions de départ — fait
2. Projet Firebase (connexion Google, Firestore, règles, clé API restreinte) — fait
3. Dépôt : copie de Journée RP, thème Khurdan pour tous, code propre au couple retiré, joueurs et genres généralisés — fait
4. Administration (page des joueurs et des personnages) — à faire
5. Fiche du jour, récap, historique, Discord — à finir ; **avant d'inviter les joueurs** : ranger les nuits chaudes,
   la protection et les coquillages dans `couples/{couple}/…` (lisibles par les deux joueurs du couple seulement),
   et plus dans `shared/day-…` ni dans `days/…`
6. Nouvelles, puis notifications push (clés VAPID propres à ce projet) — à faire
7. Sauvegarde hebdomadaire sur le VPS — à faire
8. Wrap du 26 décembre — à vérifier
