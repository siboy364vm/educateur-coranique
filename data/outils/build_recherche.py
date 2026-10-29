# Index de recherche : [sourate, verset, traduction, texte normalisé] pour les 6236 versets, tiré des fichiers de sourates
import json, sys
D = sys.argv[1] if len(sys.argv) > 1 else 'data'
out = []
for i in range(1, 115):
    for a in json.load(open(f'{D}/coran/sourates/{i:03d}.json'))['versets']:
        out.append([i, a['n'], a['fr'], a['normalise']])
json.dump({'source': 'copie des champs fr et normalise de coran/sourates/*.json', 'versets': out},
          open(f'{D}/coran/recherche.json', 'w'), ensure_ascii=False, separators=(',', ':'))
print(len(out))
