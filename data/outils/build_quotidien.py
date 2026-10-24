import json, sys, random
OUT, NOTES, CANDS = sys.argv[1], sys.argv[2], sys.argv[3]
notes = json.load(open(NOTES))
ids = [r['id'] for r in json.load(open(CANDS))]
coll = {}
for b in ['qudsi', 'nawawi', 'malik', 'bukhari', 'muslim']:
    for r in json.load(open(f'{OUT}/hadiths/recueils/{b}.json'))['hadiths']:
        coll[r['id']] = r
gardes = [i for i in ids if i not in notes['rejets']]
# Ordre mélangé de façon reproductible, pour alterner les recueils d'un jour à l'autre
random.Random(1446).shuffle(gardes)
liste = []
for j, i in enumerate(gardes, 1):
    r = coll[i]
    liste.append({'jour': j, 'id': i, 'recueil': r['recueil'], 'numero': r['numero'], 'reference': r['reference'],
                  'type': notes.get('type_corrige', {}).get(i, r['type']), 'grade': r['grade'], 'ar': r['ar'], 'fr': r['fr'],
                  'accompagnement': i in notes['accompagnement'],
                  'relecture': "alignement arabe/français et sens relus par Claude le 2026-10-24 ; relecture par une personne qualifiée à faire"})
json.dump({'nb': len(liste), 'regle': "jour de l'année modulo nb ; les entrées marquées accompagnement sont à lire avec un adulte ou à réserver aux profils de 14 ans et plus",
           'hadiths': liste}, open(f'{OUT}/hadiths/quotidien.json', 'w'), ensure_ascii=False, indent=1)
rej = [{'id': k, 'raison': v} for k, v in notes['rejets'].items()]
json.dump({'nb': len(rej), 'ecartes': rej}, open(f'{OUT}/hadiths/ecartes_relecture.json', 'w'), ensure_ascii=False, indent=1)
from collections import Counter
print(len(liste), Counter(x['id'].split('-')[0] for x in liste), 'accompagnement', sum(x['accompagnement'] for x in liste))
