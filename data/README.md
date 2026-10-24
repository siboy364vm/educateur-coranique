# Données du Coran

L'application lit `data/quran-hafs.json` (riwaya Hafs 'an 'Asim). Ce fichier ne contient que du texte issu d'une source ouverte vérifiable, jamais du texte écrit de mémoire.

Format attendu :

```json
{
  "source": "nom et URL de la source, version, licence",
  "riwaya": "hafs",
  "surahs": [
    { "number": 1, "name_ar": "...", "name_fr": "...",
      "ayahs": [ { "n": 1, "text": "..." } ] }
  ]
}
```

Le fichier est produit dans le fil « contenu ». Tant qu'il est absent, l'application charge `data/fixture.json`, un jeu de test sans texte coranique.
