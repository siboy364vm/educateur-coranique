# Contenu vérifié — Éducateur coranique

Socle de données pour l'application : le Coran entier (riwaya Hafs 'an 'Asim, choisie par Siby le 2026-10-24) et une base de hadiths sourcés. Préparé le 2026-10-24. Aucun texte n'a été écrit par une IA : tout vient de corpus publiés, avec leur source.

## Ce que contient le dossier

| Fichier | Contenu |
|---|---|
| `coran/sourates.json` | Les 114 sourates : numéro, nom arabe, translittération, mecquoise ou médinoise, nombre de versets, juz et page de début |
| `coran/sourates/001.json` … `114.json` | Une sourate par fichier, verset par verset (détail plus bas) |
| `coran/decoupage.json` | Début et fin des 30 juz, 60 hizb, 240 quarts de hizb, 604 pages (mushaf de Médine), 7 manzil, ruku', et les 15 versets de prosternation de la source |
| `coran/ordre_memorisation.json` | Ordre d'apprentissage proposé : al-Fatiha, puis de an-Nas (114) en remontant jusqu'à al-Baqara (2) |
| `coran/audio.json` | Récitateurs Hafs et modèle d'adresse des fichiers audio verset par verset (**à tester sur le téléphone**, voir Limites) |
| `coran/empreintes_sha256.json` | Empreintes des textes, pour détecter toute modification future |
| `hadiths/quotidien.json` | **345 hadiths du jour**, tous Sahih, marfou' ou qoudsi, relus un par un |
| `hadiths/ecartes_relecture.json` | Les 190 hadiths écartés à la relecture, avec la raison de chacun |
| `hadiths/recueils/*.json` | Les 5 recueils complets (17 092 hadiths) : Sahih al-Bukhari, Sahih Muslim, Muwatta' de l'imam Malik, 40 qoudsi, 40 an-Nawawi |
| `outils/` | Les scripts qui fabriquent et contrôlent ces fichiers (`verifier.py` relance tous les contrôles) |

## Format d'un verset

```json
{"n": 2, "hafs": "ذَٰلِكَ ٱلۡكِتَٰبُ لَا رَيۡبَۛ فِيهِۛ هُدࣰى لِّلۡمُتَّقِينَ",
 "warsh": "…", "simple": "ذَٰلِكَ الْكِتَابُ لَا رَيْبَ ۛ فِيهِ ۛ هُدًى لِلْمُتَّقِينَ",
 "normalise": "ذلك الكتاب لا ريب فيه هدي للمتقين", "normalise_warsh": "…",
 "fr": "C'est le Livre au sujet duquel il n'y a aucun doute…",
 "juz": 1, "hizb": 1, "rub": 1, "page_medine_hafs": 2, "sajda_source": false}
```

- `hafs` : texte uthmani du Complexe du Roi Fahd (KFGQPC), à afficher. Il demande une police qui gère les tanwin ouverts U+08F0 à U+08F2 (police KFGQPC Uthmanic Hafs, ou Amiri Quran).
- `simple` : même texte Hafs en orthographe courante (Tanzil), plus facile à afficher.
- `normalise` : `simple` sans voyelles ni signes. C'est la base du **vérificateur** : on compare ce que la personne récite ou écrit à ce texte, mot par mot.
- `warsh` : gardé en réserve. Sa numérotation a été alignée sur celle de Hafs par la source, elle ne correspond donc pas à un mushaf Warsh imprimé.
- `fr` : traduction de Muhammad Hamidullah (via Tanzil). C'est une traduction du sens, pas le Coran.

## Format d'un hadith du jour

```json
{"jour": 47, "id": "bukhari-6013", "recueil": "Sahih al-Bukhari", "numero": 6013,
 "reference": {"livre": 78, "hadith": 44}, "type": "marfou_probable",
 "grade": {"valeur": "Sahih", "par": "consensus sur les hadiths musnad de Sahih al-Bukhari", "methode": "appartenance au recueil"},
 "ar": "…", "fr": "…", "accompagnement": false, "relecture": "…"}
```

L'appli affiche toujours le recueil, le numéro et le grade. Règle conseillée : hadith du jour = entrée n° (jour de l'année modulo 345). Les 14 entrées `accompagnement: true` parlent de sujets à expliquer (châtiment, femmes et Enfer, mariage…) : à réserver aux profils de 14 ans et plus, ou à lire avec un adulte.

## Comment les hadiths ont été choisis

1. Seuls des recueils dont l'authenticité est établie : Bukhari et Muslim (hors introduction de Muslim), et pour le Muwatta' uniquement les hadiths que Salim al-Hilali classe « Sahih » sans la mention Mawquf ou Maqtu' (donc attribués au Prophète ﷺ).
2. Pour les 40 qoudsi et les 40 an-Nawawi, le grade Sahih n'est donné que si le compilateur cite al-Bukhari ou Muslim. Les autres (Tirmidhi, Ibn Majah…) gardent leur référence mais sont exclus du hadith du jour en attendant une vérification.
3. Filtre automatique : parole du Prophète ﷺ présente, texte assez court pour une lecture quotidienne, thèmes de foi, adoration, comportement, Coran, invocations.
4. Relecture par Claude des 535 candidats, arabe et français côte à côte. 190 écartés : une trentaine de contresens ou de décalages de traduction (surtout dans la traduction française du Muwatta'), des doublons, des fragments incompréhensibles seuls, des sujets inadaptés à un enfant, et un hadith (bukhari-1952) sur lequel l'imam Malik donne un avis différent dans le Muwatta'.

## Limites, à lire avant la mise en service

- **Relecture par une personne qualifiée.** La relecture a été faite par Claude, pas par un savant. Confiance élevée sur l'authenticité des textes arabes (recueils reconnus) ; confiance moyenne sur les traductions françaises, dont le traducteur n'est pas nommé et qui ajoutent parfois des explications entre parenthèses. Il faut faire relire `quotidien.json` par un imam ou un étudiant malékite.
- **Fiqh malékite.** Les hadiths du jour restent des textes, pas des avis juridiques. Un hadith qui touche une règle pratique ne remplace pas l'avis de l'école malékite. Les versets de prosternation (`sajda_source`) suivent le comptage de la source (15), qui n'est pas celui de l'école malékite : à faire valider avant d'afficher une consigne de prosternation.
- **Audio non testé.** Le serveur de préparation n'avait pas accès à everyayah.com. Les adresses suivent le modèle connu du site, mais il faut les tester depuis le téléphone avant de les utiliser.
- **Réparation du texte Hafs.** La conversion Unicode de la source avait inséré un espace parasite entre le tanwin ouvert et l'alif suivant dans 2 409 versets (ex. « هُدࣰ ى »), et des marques de direction invisibles en fin de verset. Ils ont été retirés ; aucune lettre ni voyelle n'a été changée. Les empreintes SHA-256 portent sur le texte réparé.
- **Licences.** Texte du Complexe du Roi Fahd et texte Tanzil : usage libre, avec obligation de citer la source et de ne pas modifier le texte. Traduction Hamidullah diffusée par Tanzil : usage non commercial. Données des recueils de hadiths : projet hadith-api (licence Unlicense). L'appli de la famille est gratuite et non commerciale, ce qui respecte ces conditions.

## Sources

- Coran Hafs et Warsh : Complexe du Roi Fahd pour l'impression du Saint Coran (qurancomplex.gov.sa), via le projet quran-api de fawazahmed0 (GitHub), éditions `ara-quranuthmanihaf` v13 et `ara-quranwarsh` v8.
- Coran en orthographe courante et traduction Hamidullah : Tanzil (tanzil.net), via quran-api.
- Découpage (juz, hizb, pages, ruku', sajda) : fichier `info.json` de quran-api.
- Hadiths : projet hadith-api de fawazahmed0 (GitHub), éditions arabe, française et anglaise ; grades du Muwatta' par Salim al-Hilali.

## Vérifier

```
python3 outils/verifier.py .
```

Le script contrôle : 114 sourates, 6 236 versets, aucun texte vide, aucun espace parasite, 30 juz / 60 hizb / 604 pages, hadiths du jour tous Sahih, marfou' ou qoudsi, sans hadith écarté. Il signale aussi, pour information, les 369 versets où Hafs uthmani et Tanzil n'ont pas le même nombre de mots : ce sont des différences d'écriture connues (par exemple يَٰٓأَيُّهَا écrit en un mot dans le mushaf et en deux dans l'orthographe courante).
