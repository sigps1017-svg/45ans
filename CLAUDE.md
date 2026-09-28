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
- Supabase JS sert à valider les liens d’invitation et à enregistrer les RSVP.
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
- `src/lib/` : intégrations et utilitaires partagés, dont les clients et accès
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

Les réponses RSVP sont enregistrées dans Supabase via des fonctions RPC
sécurisées; `localStorage` conserve seulement une copie de reprise par invitation.
Le token de l’invitation vient du paramètre `?i=` et sert aussi de contenu au QR.
Le schéma à exécuter manuellement se trouve dans `supabase/schema.sql`.
Les secrets client sont fournis par `.env.local` avec
`VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY`; ne jamais les afficher ni les
committer. Le schéma active RLS, ne donne aucun accès direct à `anon`, et réserve
la lecture des listes ainsi que le marquage des arrivées aux utilisateurs Auth
enregistrés dans `public.staff`. La page d’accueil de l’équipe est `accueil.html`;
elle permet la connexion Supabase Auth, le scan/recherche des invitations, le
pointage des arrivées et leur annulation. Le serveur de développement utilise
HTTPS local via `@vitejs/plugin-basic-ssl` pour permettre les tests caméra sur
téléphone.

Le parcours comprend les réponses oui/non, le code QR PNG et son animation en
particules, Google Agenda et le téléchargement `.ics` avec fuseau horaire pour
les calendriers mobiles.

Le prototype contient des textes et coordonnées d'événement à personnaliser,
ainsi que des images de souvenirs de remplacement. Conserver leur caractère
provisoire pendant le portage et ne pas inventer les informations manquantes.
