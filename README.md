# HIBIKI Music App

HIBIKI est une application musicale locale-first : les morceaux importés restent dans le navigateur et la lecture continue sans compte. Le projet est hébergé comme site statique compatible Netlify.

## Développement

Servir le dossier via un serveur HTTP local (requis pour les modules ES, le service worker et IndexedDB). Ouvrir ensuite la page sur ordinateur ou téléphone. HIBIKI tente de conserver le verrouillage portrait sur mobile.

## Configuration Supabase facultative

Consulter [SUPABASE_SETUP.md](SUPABASE_SETUP.md). Le compte permet une authentification réelle, la synchronisation des métadonnées, du profil, des favoris et des playlists. Aucun fichier audio local n'est téléversé. Sans `supabase-config.js`, l'application reste en mode local.

## Architecture

- `index.html` : structure et vues.
- `styles.css` : design responsive, états, animations et thèmes.
- `src/app.js` : navigation, lecture, bibliothèque et fonctionnalités existantes.
- `src/storage.js` : accès IndexedDB et erreurs de stockage.
- `src/auth.js` : Supabase Auth et synchronisation facultative.
- `supabase/schema.sql` : schéma utilisateur avec Row Level Security.
- `manifest.webmanifest`, `sw.js`, `assets/icon.svg` : installation et cache PWA same-origin.

Aucun runner de tests automatisés n'est fourni par le dépôt.
