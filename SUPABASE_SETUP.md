# Configuration Supabase de HIBIKI

HIBIKI continue de fonctionner en mode local sans serveur. Les fichiers audio importés restent dans IndexedDB et ne sont jamais envoyés à Supabase. Le compte synchronise le profil et les métadonnées de bibliothèque (titre, artiste, durée, type, dates et nombre d'écoutes), ainsi que les favoris et playlists.

## Mise en place

1. Crée un projet Supabase et active **Authentication → Providers → Email**.
2. Configure la confirmation e-mail et ajoute l'URL de ton hébergement (et l'URL locale de développement) aux URL autorisées.
3. Dans SQL Editor, exécute `supabase/schema.sql`. Les tables activent RLS et chaque politique limite l'accès à `auth.uid()`.
4. Copie `supabase-config.example.js` en `supabase-config.js`, puis renseigne l'URL du projet et sa clé **publishable/anon**.
5. Déploie `supabase-config.js` uniquement via un mécanisme de configuration privé adapté à ton hébergement. Ce fichier est ignoré par Git. Pour Netlify, injecte les valeurs dans le processus de build selon ta politique de secrets et ne commite pas le résultat.

La clé anon/publishable est faite pour le client et reste protégée par RLS. Ne mets jamais une clé `service_role` ou une clé secrète dans le navigateur, dans le dépôt, ni dans un bundle distribué.

## Compte et synchronisation

La création de compte demande une adresse e-mail et un mot de passe d'au moins 8 caractères. Selon les réglages d'authentification, l'adresse doit être confirmée avant la connexion. Le SDK Supabase conserve et renouvelle une session; HIBIKI ne stocke aucun mot de passe. Le lien « Mot de passe oublié » envoie le flux de récupération par e-mail.

Après connexion, les métadonnées locales sont envoyées vers les tables du compte. Les enregistrements sont privés à l'utilisateur. Une erreur réseau ou RLS ne bloque pas la bibliothèque locale. Les fichiers audio, les images locales du profil et les bannières ne sont pas uploadés; les champs d'image ne doivent pas être utilisés pour de grosses images avec Supabase. Une future synchronisation d'images nécessite un bucket Storage avec des politiques dédiées.

Avant d'utiliser un projet réel, configure aussi les modèles d'e-mail, le SMTP de production, les URL de redirection, les limites anti-abus et les sauvegardes Supabase.
