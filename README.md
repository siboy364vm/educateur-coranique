# Éducateur coranique

Application gratuite de mémorisation du Coran (Hafs) et de culture islamique malikite.
Règles : malikisme uniquement, aucun contenu inventé, chaque texte porte sa source.

## Fonctionnement

- **Apprendre** : un chemin d'étapes dans l'ordre de mémorisation (al-Fatiha, puis an-Nas jusqu'à al-Baqara). Chaque sourate est découpée en leçons de 5 versets au plus : découverte du verset (audio, traduction), puis exercices courts avec correction immédiate (mot manquant, mots à remettre dans l'ordre, verset suivant). Un exercice raté revient en fin de leçon. Chaque étape se termine par le vérificateur (10 versets, seuil 80 %).
- **Réviser** : les sourates validées reviennent à 1, 3, 7, 14 puis 30 jours. Lecture libre des 114 sourates.
- **Réciter** (option, micro) : le navigateur transcrit la récitation et chaque mot est comparé au verset (vert entendu, rouge manquant), seuil 80 %. Dans les leçons, une récitation par verset ; sur chaque étape, « Réciter » fait réciter toute la sourate de mémoire. Le tajwid n'est pas évalué. Disponible sur Chrome (Android, ordinateur) et Safari (iPhone) ; la voix passe par le service de reconnaissance du navigateur (Google ou Apple). Firefox : non disponible, l'option n'apparaît pas.
- **Hadith** : un hadith du jour avec sa source et son grade.
- **Chercher** : recherche d'un mot (français ou arabe, accents ignorés) dans le Coran et les hadiths de l'appli. Les résultats sont les textes avec leur source ; aucune réponse n'est rédigée. Index : `data/coran/recherche.json` (`data/outils/build_recherche.py`).
- **Profil** : série de jours, XP, objectif quotidien, réglages (traduction, texte uthmani, récitateur).
- **Audio** : verset par verset depuis everyayah ; en cas d'échec, bascule automatique sur la source de secours cdn.islamic.network (même récitateur, sauf la version mu'allim, remplacée par le murattal d'al-Husary). Profil > « Tester l'audio » vérifie chaque récitateur sur les deux sources. Le service worker ne touche plus aux requêtes externes (lecture audio plus fiable sur iPhone).
- **Niveau** (par profil) : Débutant (3 versets par leçon, 6 exercices, vérificateur de 6 questions, verset visible pendant la récitation), Standard (5, 10, 10), Avancé (7, 14, 15, seuil 90 %) ou Personnalisé. Débutant par défaut sous 10 ans. La progression est comptée en versets, donc changer de niveau ne fait rien perdre.
- **Rappel quotidien** : ajouté à l'agenda du téléphone (fichier .ics pour iPhone, Samsung, Outlook ; lien Google Agenda), qui se charge de la notification. Une appli web sans serveur ne peut pas notifier quand elle est fermée.
- **Espace parent** : suivi de chaque profil, protégé par un code.

Les données restent sur l'appareil (localStorage). **Sauvegarde** (Profil) : un fichier à envoyer ou télécharger, puis à importer sur un autre appareil ; l'import fusionne (aucune donnée effacée, chaque activité comptée une fois, la progression la plus avancée l'emporte). L'espace parent peut importer la sauvegarde d'un enfant pour le suivre. Pas de synchronisation automatique : elle demanderait un service en ligne et un compte. Tests : `node test/smoke.js` et `node test/recitation.js`, `node test/sauvegarde.js`, `node test/niveaux.js`, `node test/audio.js` (Playwright, micro simulé).
