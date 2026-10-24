import json, re, sys
OUT = sys.argv[1]
def strip(t): return re.sub(r'[ً-ْٰـ]', '', t)
QAWL = re.compile(r'((قال|يقول|فقال|سمعت|قالت) ?:? ?(رسول الله|النبي))|((رسول الله|النبي) صلى الله عليه و ?سلم:? (قال|يقول))')
BAN = re.compile(r'\b(sexu\w*|menstru\w*|règles|janaba|lapid\w*|adult\w*|fornic\w*|tuer|tué\w*|sang|esclaves?|captives?|seins?|nue?s?|circonci\w*|vin|alcool|chiens?|porc|urine|selles|excr\w*|cadavres?|divorc\w*|rapports? (sexuels?|intimes?|conjuga\w*))\b', re.I)
BOOKS = {'bukhari': {2,3,10,24,30,46,51,53,66,70,75,78,79,80,81,97}, 'muslim': {1,4,5,12,13,38,39,40,43,45,47,48,49,50,55}}
CAP = {'bukhari': 12, 'muslim': 10, 'malik': 999}
LIM = {'bukhari': (60, 330), 'muslim': (60, 330), 'malik': (60, 520)}
cands = []
for b in ['qudsi', 'nawawi']:
    for r in json.load(open(f'{OUT}/hadiths/recueils/{b}.json'))['hadiths']:
        if r['grade']['valeur'] == 'Sahih' and r['fr']: cands.append(r)
for b in ['malik', 'bukhari', 'muslim']:
    seen = set(); perbook = {}
    for r in json.load(open(f'{OUT}/hadiths/recueils/{b}.json'))['hadiths']:
        if b == 'malik' and not (r['grade']['valeur'] == 'Sahih' and r['type'] == 'marfou'): continue
        if b != 'malik' and (r['grade']['valeur'] != 'Sahih' or r['reference']['livre'] not in BOOKS[b]): continue
        lo, hi = LIM[b]
        if not (lo <= len(r['fr']) <= hi) or not QAWL.search(strip(r['ar'])) or BAN.search(r['fr']): continue
        k = r['fr'][-60:]
        if k in seen: continue
        bk = r['reference']['livre']
        if perbook.get(bk, 0) >= CAP[b]: continue
        perbook[bk] = perbook.get(bk, 0) + 1; seen.add(k); cands.append(r)
json.dump(cands, open(f'{OUT}/../candidats.json', 'w'), ensure_ascii=False)
from collections import Counter
print(len(cands), Counter(r['id'].split('-')[0] for r in cands))
# fichiers de relecture par lots de 50
for i in range(0, len(cands), 50):
    with open(f'{OUT}/../relecture_{i//50:02d}.txt', 'w') as f:
        for r in cands[i:i+50]:
            a = strip(r['ar']); j = max(a.find('صلى الله عليه وسلم'), 0)
            f.write(f"## {r['id']}\nAR: {a[max(j-60,0):j+420]}\nFR: {r['fr'][:420]}\n\n")
