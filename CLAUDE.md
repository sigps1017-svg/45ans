# Contexte du projet

## Objectif

Site d'invitation familial pour célébrer 45 ans de mariage (noces de saphir).
Le fichier `reference-apercu.html` est le prototype fonctionnel et la référence
visuelle et comportementale pour le portage.

## Stack et environnement

- Vite avec JavaScript vanilla (pas de framework UI).
- Three.js pour les scènes 3D et les particules.
- GSAP et ScrollTrigger pour les animations et les scènes pilotées par le
  défilement.
- `qrcode` pour générer les codes QR, et `html5-qrcode` pour la lecture.
- Supabase JS est prévu pour une étape ultérieure.
- Déploiement cible : Vercel.
- Utiliser les dépendances npm du projet, pas de CDN.

Les dépendances Three.js, GSAP, `qrcode`, `html5-qrcode` et
`@supabase/supabase-js` sont déjà déclarées dans `package.json`.

## Portage du prototype

Porter progressivement le contenu de `reference-apercu.html` dans la structure
modulaire suivante :

- `src/config.js` : données de l'événement, prénoms, boissons et souvenirs
  (année, légende et chemin de photo).
- `src/scenes/` : intro, histoire et souvenirs.
- `src/rsvp/` : formulaire, confirmation/code QR et ajout au calendrier.
- `src/lib/` : intégrations et utilitaires partagés, dont le futur client
  Supabase.

Importer les bibliothèques depuis npm. Avec la version récente de Three.js,
utiliser `renderer.outputColorSpace` au lieu de l'ancienne API
`renderer.outputEncoding`. Pour construire la grille de particules du QR,
utiliser `QRCode.create()` et ses données de modules plutôt que des propriétés
internes du DOM ou de l'objet QR.

Les photos des souvenirs sont servies depuis `public/photos/` avec un fichier
par année configurée (par exemple `1981.jpg`). Charger les textures avec
`THREE.TextureLoader` et conserver la texture illustrée générée en canvas comme
repli si une image est absente.

## Persistance et limites actuelles

Les réponses RSVP restent enregistrées localement dans le navigateur
(`localStorage`), comme dans le prototype. Le parcours comprend les réponses
oui/non, le code QR PNG et son animation en particules, Google Agenda et le
téléchargement `.ics` avec fuseau horaire pour les calendriers mobiles. Ne pas
connecter ni appeler Supabase avant l'étape suivante.

Le prototype contient des textes et coordonnées d'événement à personnaliser,
ainsi que des images de souvenirs de remplacement. Conserver leur caractère
provisoire pendant le portage et ne pas inventer les informations manquantes.
