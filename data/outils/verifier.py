"""Contrôles automatiques du dossier contenu/. Usage : python3 verifier.py <dossier contenu>"""
import json, sys, os, re
D = sys.argv[1]; ok = True
def check(cond, msg):
    global ok
    print(('OK   ' if cond else 'ECHEC'), msg); ok &= bool(cond)
S = json.load(open(f'{D}/coran/sourates.json'))
check(len(S) == 114, '114 sourates')
tot = 0; vides = 0; mots_diff = 0
for s in S:
    f = json.load(open(f"{D}/coran/sourates/{s['numero']:03d}.json"))
    check(len(f['versets']) == s['nb_versets'], f"sourate {s['numero']} : {s['nb_versets']} versets") if len(f['versets']) != s['nb_versets'] else None
    tot += len(f['versets'])
    for v in f['versets']:
        check(not re.search(r'[\u08F0-\u08F2] [اى]', v['hafs']), f"espace parasite après tanwin {s['numero']}:{v['n']}") if re.search(r'[\u08F0-\u08F2] [اى]', v['hafs']) else None
        vides += sum(1 for k in ('hafs', 'warsh', 'simple', 'fr', 'normalise') if not v[k].strip())
        mot = lambda t: [w for w in t.split() if re.search(r'[\u0621-\u064A\u0671]', w)]
        a = len(mot(v['hafs'])); b = len(mot(v['simple']))
        mots_diff += a != b
check(tot == 6236, f'6236 versets au total ({tot})')
check(vides == 0, f'aucun texte vide ({vides})')
print(f'INFO  versets dont le nombre de mots diffère entre Hafs (Complexe Roi Fahd) et Tanzil simple : {mots_diff} (attendu : petites différences d\'orthographe uthmanie)')
div = json.load(open(f'{D}/coran/decoupage.json'))
check(len(div['juzs']) == 30 and len(div['hizbs']) == 60 and len(div['maqras']) == 240 and len(div['pages']) == 604, '30 juz, 60 hizb, 240 quarts, 604 pages')
Q = json.load(open(f'{D}/hadiths/quotidien.json'))['hadiths']
check(len({h['id'] for h in Q}) == len(Q), f'{len(Q)} hadiths du jour, identifiants uniques')
check(all(h['grade']['valeur'] == 'Sahih' for h in Q), 'tous les hadiths du jour ont le grade Sahih')
check(all(h['type'] in ('marfou', 'marfou_probable', 'qoudsi') for h in Q), "tous sont marfou' ou qoudsi")
check(all(h['fr'].strip() and h['ar'].strip() for h in Q), 'arabe et français présents')
check(not any(re.search(r'salallahou|Chapitre [IVXL]+|MOUATTAA', h['fr']) for h in Q), 'pas de reste de mise en page dans le français')
rej = {e['id'] for e in json.load(open(f'{D}/hadiths/ecartes_relecture.json'))['ecartes']}
check(not rej & {h['id'] for h in Q}, 'aucun hadith écarté ne figure dans la liste du jour')
print('\nRÉSULTAT :', 'tout est conforme' if ok else 'des contrôles ont échoué')
sys.exit(0 if ok else 1)
