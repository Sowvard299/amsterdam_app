# Ams · 27→30

Appli de voyage pour Amsterdam, du mardi 27 au vendredi 30 octobre 2026 (départ tôt le samedi 31),
logement Warmoesstraat 129. En ligne : https://sowvard299.github.io/amsterdam_app/

## Ce qu'elle fait

- **Aujourd'hui** : change selon le moment. Avant le voyage : compte à rebours, réservations à faire,
  météo prévue. Pendant : la prochaine étape avec l'heure de départ et le temps de marche, la frise
  du jour, les soirées du soir, ce qui est ouvert à moins de 15 min, les toilettes, distributeurs,
  supermarchés et pharmacies les plus proches. Une journée va de 06:00 à 06:00.
- **Carte** : épingles par forme et couleur (pignon = visite, rond = manger, carré = bar, losange =
  soirée), parcours numéroté du jour, calques des essentiels, coche automatique par GPS.
- **Lieux** : bars triés par prix du petit verre, manger, soirées par jour, visites ; filtres
  ouvert maintenant, moins de 15 min, pas cher, à faire.
- **Programme** : le plan de chaque jour, avec Fait / Passer.
- **Infos** : liste « avant de partir », urgences, auberge, ferries en direct, réglages.

Chaque prix, horaire et soirée garde sa source, sa date et un niveau de confiance
(sûr / probable / à vérifier). Données vérifiées le 15/10/2026.

## Sources en direct

| Donnée | Source | Clé |
|--------|--------|-----|
| Météo heure par heure | [Open-Meteo](https://open-meteo.com/) (CC BY 4.0) | non |
| Ferries GVB (horaires prévus) | [Transitous](https://transitous.org/sources) | non |
| Fond de carte | © OpenStreetMap contributors | non |

Figées dans `ess.js` (instantané du 15/10/2026) : toilettes publiques (Gemeente Amsterdam, open data),
distributeurs, supermarchés et pharmacies (OpenStreetMap via Overpass).

## Hors ligne

Le service worker garde l'appli et les données ; la carte ne garde que les zones déjà affichées
(pas de préchargement, règle d'OpenStreetMap). Les coches restent dans le téléphone (une liste par
téléphone, export/import dans Infos).

## Modifier les données

`data.js` est généré par un script de recherche, mais reste lisible : un objet par lieu
(`id`, `cat`, `lat`, `lon`, `price`, `priceTxt`, `h` = horaires par jour, `src`, `conf`),
`PLAN` = étapes horodatées par jour, `CHECKLIST` = à faire avant le départ.

Pour tester une date : ajouter `?now=2026-10-28T18:05:00%2B01:00` à l'adresse.

Guide pratique séparé (papiers, transports, règles, valise) :
https://claude.ai/code/artifact/440fa491-015f-4a47-9da8-4c06e2dc3a3d
