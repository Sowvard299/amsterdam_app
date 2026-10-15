# amsterdam_app

Carte perso du voyage à Amsterdam (27 → 30 octobre 2026), base Warmoesstraat 129.

- **Carte** : bars, manger, soirées, visites. Filtres par catégorie, par jour, « à faire ».
- **Coche GPS** : bouton 📍, le lieu se coche quand vous restez dans un rayon de 40 m pendant 1 min
  (réglable dans l'onglet Jours). On peut aussi cocher et décocher à la main.
- **Bars** triés par prix du petit verre, **Manger** du moins cher au plus cher, **Soirées** par jour,
  **Jours** : le plan quartier par quartier.
- Chaque prix et chaque soirée affiche sa source, sa date et un niveau de confiance
  (sûr / probable / à vérifier).

Les cases cochées restent dans le navigateur du téléphone (localStorage), une liste par téléphone.

## Mettre en ligne (obligatoire pour le GPS : https)

1. GitHub → Settings → Pages → Source : « Deploy from a branch », branche `main`, dossier `/ (root)`.
2. Ouvrir `https://sowvard299.github.io/amsterdam_app/` sur le téléphone, autoriser la localisation.
3. iPhone : Partager → « Sur l'écran d'accueil ». Android : menu ⋮ → « Installer l'application ».

Limite : un navigateur ne suit la position que si la page est ouverte. Rouvrez l'appli en arrivant
quelque part ; le suivi reprend tout seul.

## Modifier les lieux

Tout est dans `data.js` : un objet par lieu (`cat`, `lat`, `lon`, `priceTxt`, `days`, `src`, `conf`).
