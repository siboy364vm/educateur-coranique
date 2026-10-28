# Éducateur coranique

Application gratuite de mémorisation du Coran (Hafs) et de culture islamique malikite.
Règles : malikisme uniquement, aucun contenu inventé, chaque texte porte sa source.

## Fonctionnement

- **Apprendre** : un chemin d'étapes dans l'ordre de mémorisation (al-Fatiha, puis an-Nas jusqu'à al-Baqara). Chaque sourate est découpée en leçons de 5 versets au plus : découverte du verset (audio, traduction), puis exercices courts avec correction immédiate (mot manquant, mots à remettre dans l'ordre, verset suivant). Un exercice raté revient en fin de leçon. Chaque étape se termine par le vérificateur (10 versets, seuil 80 %).
- **Réviser** : les sourates validées reviennent à 1, 3, 7, 14 puis 30 jours. Lecture libre des 114 sourates.
- **Hadith** : un hadith du jour avec sa source et son grade.
- **Profil** : série de jours, XP, objectif quotidien, réglages (traduction, texte uthmani, récitateur).
- **Espace parent** : suivi de chaque profil, protégé par un code.

Les données restent sur l'appareil (localStorage). Test : `node test/smoke.js` (Playwright).
