# Activer la synchronisation (15 minutes, gratuit)

Sans ces étapes, l'appli fonctionne comme avant : tout reste sur l'appareil, avec la sauvegarde par fichier.

## Ce que fait Siby (une seule fois)

1. Aller sur https://supabase.com, cliquer **Start your project**, se connecter **avec son compte GitHub**.
2. **New project** : nom `educateur-coranique`, choisir un mot de passe de base de données (le noter, il ne sert pas dans l'appli), région **Europe (Paris ou Frankfurt)**, plan **Free**. Attendre ~2 minutes.
3. Menu de gauche **SQL Editor** > **New query**. Copier tout le contenu du fichier `serveur/supabase.sql` du dépôt, coller, cliquer **Run**. Le message doit être « Success. No rows returned ».
4. Menu **Authentication** > **Emails** (ou **Email Templates**) : dans le modèle **Magic Link**, puis dans **Confirm signup**, remplacer le texte par :
   `Ton code de connexion à Éducateur coranique : {{ .Token }}`
   et enregistrer (**Save**). Sans cette étape, l'e-mail contient un lien au lieu d'un code.
5. Menu **Project Settings** > **API** (ou **API Keys**) : copier l'**URL du projet** (`https://xxxx.supabase.co`) et la **clé publique** (`sb_publishable_...`, ou à défaut la clé `anon`). **Ne jamais copier la clé `service_role` / `secret`.**
6. Envoyer ces deux valeurs à Claude dans le fil. Elles sont publiques par nature (elles finissent dans le site) ; la protection vient des règles de l'étape 3. Claude les met dans `config.js`.
7. Sur le premier appareil : Profil > **Synchroniser les appareils**, entrer **l'adresse e-mail du compte Supabase de Siby**, recevoir le code, le saisir.
8. (Conseillé, après l'étape 7) **Authentication** > **Sign In / Providers** (ou **Settings**) : désactiver **Allow new users to sign up**. Plus personne ne peut créer de compte ; les appareils de la famille continuent de se connecter.

## Utilisation dans la famille

- Sur chaque appareil (enfant, parent) : même adresse e-mail, un code arrive sur la boîte de Siby, on le saisit. Siby autorise ainsi chaque nouvel appareil.
- La connexion reste active sur l'appareil ; pas de code à chaque ouverture.
- L'espace parent montre tous les profils de tous les appareils connectés. Le code parent est commun (le dernier choisi l'emporte).

## Limites à connaître

- **E-mails** : sans serveur d'e-mail personnel, Supabase n'envoie les codes qu'aux adresses membres du projet (donc celle de Siby), et seulement quelques-uns par heure. C'est suffisant ici puisque toute la famille utilise l'adresse de Siby.
- **Mise en pause** : un projet gratuit inutilisé pendant 7 jours est mis en pause. Les données sont conservées ; il faut cliquer **Restore project** dans le tableau de bord Supabase. Pendant la pause l'appli continue hors ligne et rattrape ensuite.
- **Quota** : 500 Mo de base de données gratuits ; une famille en utilise quelques Mo par an.
- **Confidentialité** : prénoms, âges, historique d'apprentissage et l'adresse e-mail sont stockés chez Supabase (société américaine, serveurs dans la région choisie). Seul le compte de la famille peut les lire via l'appli ; Supabase, comme tout hébergeur, y a techniquement accès.
- **Dépendance** : si Supabase change son offre gratuite, l'appli continue en local et la sauvegarde par fichier reste disponible.
