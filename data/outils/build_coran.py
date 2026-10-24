import json, sys, os, re, hashlib
SRC, OUT = sys.argv[1], sys.argv[2]
L = lambda f: json.load(open(os.path.join(SRC, f)))
info = L('qinfo.json')
eds = {'hafs': 'ara-quranuthmanihaf.json', 'warsh': 'ara-quranwarsh.json', 'simple': 'ara-quransimple.json', 'fr': 'fra-muhammadhamidul.json'}
txt = {k: {(v['chapter'], v['verse']): v['text'] for v in L(f)['quran']} for k, f in eds.items()}
for k, d in txt.items():
    assert len(d) == 6236, (k, len(d))
# Réparation d'espaces : la conversion Unicode de la source a inséré un espace entre le tanwin ouvert
# (U+08F0/U+08F1) et l'alif ou l'alif maqsoura qui le suit (ex. « هُدࣰ ى » au lieu de « هُدࣰى »).
# On recolle, et on retire les marques de direction U+200F. Aucune lettre ni voyelle n'est modifiée.
REPARES = {}
for k in ('hafs', 'warsh'):
    n = 0
    for key, t in txt[k].items():
        t2 = re.sub(r'([\u08F0-\u08F2]) (?=[اى])', r'\1', t).replace('\u200f', '').strip()
        if t2 != t: n += 1
        txt[k][key] = t2
    REPARES[k] = n
print('versets réparés (espaces)', REPARES)
# L'édition « simple » colle la basmala au verset 1 des sourates 2 à 114 (sauf 9) : on la retire
BASMALA = txt['simple'][(1, 1)] + ' '
for c in range(2, 115):
    t = txt['simple'][(c, 1)]
    if c != 9:
        assert t.startswith(BASMALA), c
        txt['simple'][(c, 1)] = t[len(BASMALA):]
def sans_tashkil(t):
    t = re.sub(r'[\u0610-\u061A\u064B-\u065F\u0670\u06D6-\u06ED\u08D3-\u08FF\u0640]', '', t)
    t = re.sub('[إأآٱ]', 'ا', t).replace('ى', 'ي').replace('ے', 'ي').replace('ة', 'ه')
    return re.sub(r'\s+', ' ', t).strip()
maqra_of = {}
for r in info['maqras']['references']:
    s, e = r['start'], r['end']
    maqra_of[r['maqra']] = ((s['chapter'], s['verse']), (e['chapter'], e['verse']))
def find_maqra(c, v):
    for m, (s, e) in maqra_of.items():
        if s <= (c, v) <= e: return m
os.makedirs(f'{OUT}/coran/sourates', exist_ok=True)
sourates = []
MAKKI = {'Mecca': 'mecquoise', 'Madina': 'médinoise', 'Medina': 'médinoise'}
for ch in info['chapters']:
    c = ch['chapter']
    versets = []
    for v in ch['verses']:
        n = v['verse']; m = find_maqra(c, n)
        versets.append({'n': n, 'hafs': txt['hafs'][(c, n)], 'warsh': txt['warsh'][(c, n)],
                        'simple': txt['simple'][(c, n)], 'normalise': sans_tashkil(txt['simple'][(c, n)]), 'normalise_warsh': sans_tashkil(txt['warsh'][(c, n)]), 'fr': txt['fr'][(c, n)],
                        'juz': v['juz'], 'hizb': (m - 1) // 4 + 1, 'rub': m, 'page_medine_hafs': v['page'],
                        'sajda_source': v['sajda'] if isinstance(v['sajda'], bool) else True})
    meta = {'numero': c, 'nom_arabe': ch['arabicname'], 'nom_translit': ch['name'],
            'revelation': MAKKI.get(ch['revelation'], ch['revelation']), 'nb_versets': len(versets),
            'juz_debut': versets[0]['juz'], 'page_debut_medine_hafs': versets[0]['page_medine_hafs']}
    sourates.append(meta)
    json.dump({**meta, 'versets': versets}, open(f'{OUT}/coran/sourates/{c:03d}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
json.dump(sourates, open(f'{OUT}/coran/sourates.json', 'w'), ensure_ascii=False, indent=1)
div = {k: info[k]['references'] for k in ['juzs', 'maqras', 'pages', 'manzils', 'rukus']}
div['hizbs'] = [{'hizb': h, 'start': div['maqras'][(h - 1) * 4]['start'], 'end': div['maqras'][h * 4 - 1]['end']} for h in range(1, 61)]
div['sajdas_source'] = info['sajdas']['references']
json.dump(div, open(f'{OUT}/coran/decoupage.json', 'w'), ensure_ascii=False, indent=1)
# Empreintes pour détecter toute altération future du texte
h = {k: hashlib.sha256(json.dumps([txt[k][key] for key in sorted(txt[k])], ensure_ascii=False).encode()).hexdigest() for k in txt}
json.dump(h, open(f'{OUT}/coran/empreintes_sha256.json', 'w'), indent=1)
print('sourates', len(sourates), 'versets', sum(s['nb_versets'] for s in sourates))
