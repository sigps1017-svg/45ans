# Contexte du projet

## Objectif

Site d'invitation familial pour célébrer 45 ans de mariage (noces de vermeil)
en Côte d'Ivoire. L'événement a lieu à Rivieira, Attoban près du 30ème, le
26 décembre 2026. Les données de date, horaires et lieu sont centralisées dans
`src/config.js` et les heures qui y figurent sont les heures locales d'Abidjan
(`Africa/Abidjan`, UTC+0, sans heure d'été). Le programme prévoit l'église à
11 h à l'église Saint-Bernard, puis la réception à 13 h.
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
  (année, légende et six photos facultatives par souvenir).
- `src/scenes/` : intro, histoire et souvenirs.
- `src/rsvp/` : formulaire, confirmation/code QR et ajout au calendrier.
- `src/lib/` : intégrations et utilitaires partagés, dont les clients et accès
  Supabase.
- `accueil.html` : scanner et suivi des arrivées de l'équipe.
- `gestion.html` : administration des invitations réservée au rôle `admin`.
- `livre-or.html` : lecture, modération et impression du livre d'or par l'équipe.

Importer les bibliothèques depuis npm. Avec la version récente de Three.js,
utiliser `renderer.outputColorSpace` au lieu de l'ancienne API
`renderer.outputEncoding`. Pour construire la grille de particules du QR,
utiliser `QRCode.create()` et ses données de modules plutôt que des propriétés
internes du DOM ou de l'objet QR.

Les six faces photo de chaque cube souvenir sont configurées dans `src/config.js`
et les images renseignées sont servies depuis `public/photos/`. Charger les
fichiers avec `THREE.TextureLoader`, réduire les textures utilisées sur les cubes
pour ménager la mémoire graphique mobile, et conserver la texture illustrée
générée en canvas comme repli si une image est absente.

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
téléphone. L’écran plein écran des listes invités est accessible depuis le
compteur et se rafraîchit avec les mêmes données.

La migration `supabase/migrations/20260928_admin_invitation_management.sql`
ajoute le rôle `admin` à `staff`, cloisonne la lecture des tokens et fournit des
RPC protégées pour la gestion des invitations. Après avoir créé un compte Auth
et l’avoir ajouté à `staff`, un administrateur doit promouvoir au moins un
compte en mettant son rôle à `admin` dans l’éditeur SQL. La page `gestion.html`
permet ensuite de gérer les invitations, créer/copier/partager les liens et
exporter la liste en CSV. L’équipe d’accueil recherche une invitation scannée
via une RPC qui ne révèle pas le token.

La gestion des comptes de l'équipe est fournie par `/api/team` (fonction Node
Vercel) et l'onglet « Équipe » de `gestion.html`. La liste présente tous les
comptes Auth, y compris ceux qui ne sont pas encore enregistrés dans `staff`;
ces derniers peuvent être ajoutés à l'équipe en leur attribuant un rôle.
Chaque appel serveur valide le jeton Auth et le rôle admin avant toute opération. La clé serveur
`SUPABASE_SECRET_KEY` ne doit jamais porter le préfixe `VITE_`; configurer aussi
`SUPABASE_URL` dans l'environnement Vercel (en local, l'URL client
`VITE_SUPABASE_URL` peut être réutilisée côté serveur). Exécuter
`supabase/migrations/20260929_admin_team_management.sql`, puis
`supabase/migrations/20260930_admin_auth_user_membership.sql` manuellement
avant d'utiliser la gestion des rôles : la fonction verrouille les écritures
sur `staff`, protège le dernier admin et inscrit les comptes Auth existants
dans `staff` lorsqu'un rôle leur est attribué. Pour servir les pages et
fonctions API en local, utiliser `npm run dev`; le serveur Vite branche la
même fonction sur `/api/team`. En production, Vercel détecte directement
`api/team.js`.

Le livre d'or est décrit par `supabase/migrations/20261002_livre_or.sql`, à
exécuter manuellement. Chaque invitation peut y déposer un message signé, modifiable
avec son lien `?i=` (section `#livre-or` de la page invités, `src/rsvp/livre-or.js`).
La table `livre_or` n'est accessible que par RPC : lecture pour tout le personnel
(`staff_list_guestbook`), suppression réservée au rôle `admin`. La page
`livre-or.html` affiche l'aperçu du livre et l'imprime en A4 avec une couverture.

Les souvenirs (année, légende et photo de chaque face des six cubes) sont
modifiables par les admins dans l'onglet « Photos » de `gestion.html`
(`src/souvenirs-admin.js`, accès dans `src/lib/souvenirs.js`). Exécuter
`supabase/migrations/20261003_souvenirs_admin.sql` manuellement : il crée les
tables `souvenirs` et `souvenir_photos` (lecture publique, écriture par RPC
admin) et le bucket Storage public `souvenirs` (écriture réservée aux admins).
Les valeurs de `src/config.js` restent les valeurs par défaut : une face sans
ligne en base garde sa photo du projet, une ligne au chemin vide affiche
l'illustration « Photo à venir ». La page invités charge ces données au démarrage
et revient à `src/config.js` si Supabase ne répond pas. L'année du mariage
(`event.weddingYear`) est indépendante des souvenirs.

Le parcours comprend les réponses oui/non, le code QR PNG et son animation en
particules, Google Agenda et le téléchargement `.ics` avec le fuseau fixe
`Africa/Abidjan`. Le fichier `.ics` déclare un seul bloc `STANDARD` à UTC+0;
Google Agenda reçoit les heures locales et `ctz=Africa/Abidjan`. Les pages
publiées doivent obtenir le lieu uniquement depuis `src/config.js`.

Le prototype contient des textes et coordonnées d'événement à personnaliser,
ainsi que des images de souvenirs de remplacement. Conserver leur caractère
provisoire pendant le portage et ne pas inventer les informations manquantes.
