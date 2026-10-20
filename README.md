# Ams · 26→30

Appli de voyage en stop : Paris → Bruxelles (lundi 26 octobre 2026, nuit à Bruxelles), Bruxelles → Rotterdam
(mardi 27, nuit chez des amis), Rotterdam → Amsterdam (mercredi 28), Amsterdam jusqu'au vendredi 30, retour en stop
le samedi 31. Logement à Amsterdam : Warmoesstraat 129. En ligne : https://sowvard299.github.io/amsterdam_app/

## Ce qu'elle fait

- **Aujourd'hui** : change selon le moment. Avant le voyage : compte à rebours, réservations à faire,
  météo prévue. Pendant : la prochaine étape avec l'heure de départ et le temps de marche, la frise
  du jour, les soirées du soir, ce qui est ouvert à moins de 15 min, les toilettes, distributeurs,
  supermarchés et pharmacies les plus proches (à Amsterdam). Une journée va de 06:00 à 06:00. Le jour d'un stop,
  la carte du trajet tient lieu de prochaine étape (« Arrivés » ou « Passer ») ; elle s'efface seule 30 min après
  l'heure prévue ou dès que le GPS vous place à moins de 15 km du lit du soir. Avant le stop, distances, météo et
  essentiels restent ceux de la ville de la veille.
- **Carte** : épingles en goutte façon Google Maps (bleu = visite, rouge = soirée, jaune = bar,
  vert = manger, violet = insolite), parcours numéroté du jour avec les curiosités du trajet,
  calques des essentiels, coche automatique par GPS.
- **Lieux** : bars triés par prix du petit verre, manger, soirées par jour, visites, insolite ; filtres
  ouvert maintenant, moins de 15 min, pas cher, à faire.
- **Culture** : une histoire courte et sourcée pour chaque étape du plan (sauf 5 snacks et soirées sans
  histoire publiée), avec l'anecdote drôle quand elle existe (les légendes sont dites légendes).
  Curiosités gratuites « en chemin », placées sur le trajet qui mène à l'étape (Manneken Pis, Galeries
  royales Saint-Hubert, Jeanneke Pis, maisons cubes de Rotterdam, Condomerie, Oude Kerk, Lieverdje,
  Westerkerk, passage du Rijksmuseum...). Recherches du 17 et du 20/10/2026.
- **Programme** : lun. Bruxelles (Grand-Place, Mort Subite, Mont des Arts, Fritland, Delirium) ; mar. Atomium
  puis stop, Markthal et maisons cubes à Rotterdam ; mer. stop puis vieux centre d'Amsterdam ; jeu. Jordaan,
  Van Gogh et après-midi calme au Vondelpark ; ven. Noord. Mode de transport de chaque trajet, retour de nuit
  et Fait / Passer. Sur la carte, le parcours part du lit de la veille et se coupe au stop.
- **Règles du jeudi** : petite dose de truffes (légales en smartshop aux Pays-Bas) : réduction des risques
  (Trimbos, Drugs en Uitgaan), activités calmes de l'après-midi, et rappel que rien ne passe la frontière
  (stupéfiant en France). Dans Aujourd'hui le jeudi, sur la fiche du Vondelpark et dans Infos.
- **Stop** : Paris → Bruxelles (lun. 26), Bruxelles → Rotterdam (mar. 27), Rotterdam → Amsterdam (mer. 28)
  et retour Amsterdam → Paris (sam. 31). Pour chaque trajet : spots classés (attente médiane et note
  calculées sur le dump Hitchmap, ODbL), accès en transports vérifiés sur Transitous, pancartes,
  heure limite avant le plan B, lits à Bruxelles, règles de droit (FR, BE, NL) et sécurité à deux.
  La carte du trajet s'affiche dans Aujourd'hui à l'heure du stop, avec la météo
  prévue au départ et à l'arrivée (Open-Meteo, gardée hors ligne), un bouton « Envoyer notre position » (message
  prêt avec lien Google Maps et plaque à compléter) et des plans B chiffrés (horaires et prix FlixBus relevés les 17 et 20/10).
- **Infos** : liste « avant de partir », urgences, où dormir chaque nuit, règles du jeudi, règles pour se déplacer
  à Amsterdam (à pied, tram, ferry, bus de nuit, vélo, taxi), ferries en direct, réglages.

Chaque prix, horaire et soirée garde sa source, sa date et un niveau de confiance
(sûr / probable / à vérifier). Données vérifiées le 15/10/2026, plan par secteurs et transports
mesurés le 16/10/2026 (marche OSRM, itinéraires Transitous, tarifs GVB 2026). Audit du 17/10/2026 :
liens, horaires et prix des étapes du plan, billetteries des soirées, transports recalculés à l'heure d'hiver
(UTC+1 dès le 25/10), spots de stop recalculés sur le dump Hitchmap ; les fiches revérifiées affichent « vérifié le 17 oct. ».

Charte : DA Gemini (« Neural Expressive », relevée sur gemini.google.com le 16/10/2026) : fond neutre
#FAF9F9 / noir, surfaces blanches ou #1C1C1C, tout en pilule, icônes fines Material Symbols, titres
légers Google Sans Flex avec le dégradé bleu Gemini, action principale bleu pastel #9DD2FF avec halo
arc-en-ciel, lueur bleue en bas de l'écran Aujourd'hui. Les épingles gardent les 4 couleurs Google.

## Sources en direct

| Donnée | Source | Clé |
|--------|--------|-----|
| Météo heure par heure (Amsterdam, Bruxelles, Rotterdam) | [Open-Meteo](https://open-meteo.com/) (CC BY 4.0) | non |
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
