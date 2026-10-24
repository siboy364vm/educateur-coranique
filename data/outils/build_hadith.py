import json, sys, os, re
SRC, OUT = sys.argv[1], sys.argv[2]
L = lambda f: json.load(open(os.path.join(SRC, f)))
RECUEILS = {
    'bukhari': 'Sahih al-Bukhari', 'muslim': 'Sahih Muslim', 'malik': "Al-Muwatta' de l'imam Malik",
    'qudsi': '40 hadiths qoudsi', 'nawawi': '40 hadiths de an-Nawawi',
}
def strip(t): return re.sub(r'[ً-ْٰـ]', '', t)
PROPHETE = re.compile(r'(رسول الله|النبي|نبي الله) ?صلى الله عليه و ?سلم')
QAWL = re.compile(r'(قال|يقول|فقال|سمعت) (رسول الله|النبي)')
QUDSI = re.compile(r'(قال الله|يقول الله|إن الله .{0,20}قال|قال ربكم|يقول الله تعالى|قال الله تعالى|قال الله عز وجل|يقول الله عز وجل)')
def clean_fr(t):
    # Le français du Muwatta contient un glyphe parasite « r » issu d'une police (ﷺ mal converti)
    t = re.sub(r'\s+r\s+(?=\()', ' ', t); t = re.sub(r'\)\s+r\s+', ') ', t)
    t = re.sub(r"\(salallahou alayhi wa salam\)\s*(r\s*)?\(Sur lui la grâce et la paix d'Allah\)", '(ﷺ)', t)
    t = re.sub(r"\(Sur lui la grâce et la paix d'Allah\)\s*(r\s*)?\(salallahou alayhi wa salam\)", '(ﷺ)', t)
    t = re.sub(r'\(salallahou alayhi wa salam\)\s*(r(?=\s))?', '(ﷺ)', t)
    t = re.sub(r"\(ﷺ\)\s*,?\s*(r\s*)?\(?Sur lui la grâce et la paix d(e |')?\s*Allah\)?", '(ﷺ)', t)
    t = re.sub(r"\(Sur lui la grâce et la paix d'Allah\)", '(ﷺ)', t)
    t = re.sub(r' Y\b(?= )', '', t)  # glyphe « Y » isolé (formule d'éloge mal convertie)
    t = re.sub(r'\bII(?= [a-zà-ÿ])', 'Il', t)
    # Fins parasites : en-tête du chapitre ou du livre suivant collé au hadith
    t = re.sub(r'\s*(Chapitre [IVXLC]+|Chapitre Premier|MOUATTAA|Et le Mouwatt).*$', '', t.strip())
    t = re.sub(r'^•\s*', '', t)
    t = re.sub(r'\s+Voir le Coran\s*$', '', t.strip())
    return re.sub(r'\s+', ' ', t).strip()
def takhrij(ar):
    s = strip(ar)
    for k in ['رواه', 'رواهُ', 'رويناه']:
        i = s.rfind(k)
        if i >= 0: return s[i:]
    return ''
def grade_compil(tk):
    if not tk: return None, 'aucune référence trouvée dans le texte de la source'
    head = tk[:200]
    if 'البخاري' in head or 'مسلم' in head:
        return 'Sahih', 'référence à al-Bukhari et/ou Muslim donnée par le compilateur : « ' + tk[:120] + ' »'
    return None, 'référence hors Sahihayn donnée par le compilateur : « ' + tk[:160] + ' » (grade à faire vérifier)'
out_all = {}
for b, nom in RECUEILS.items():
    ar = {h['hadithnumber']: h for h in L(f'h-ara-{b}.json')['hadiths']}
    fr = {h['hadithnumber']: h for h in L(f'h-fra-{b}.json')['hadiths']}
    en = {h['hadithnumber']: h for h in L(f'h-eng-{b}.json')['hadiths']}
    sections = L(f'h-ara-{b}.json')['metadata'].get('sections', {})
    recs = []
    for n, h in sorted(ar.items()):
        a = h.get('text', '').strip(); f = clean_fr(fr.get(n, {}).get('text', '')); e = en.get(n, {}).get('text', '').strip()
        if f.startswith('Rapporté par [Non traduit]') or 'Voir la traduction du hadith' in f[:120]: f = ''
        book = h['reference']['book']
        r = {'id': f'{b}-{n}', 'recueil': nom, 'numero': n, 'numero_arabe': h.get('arabicnumber', n),
             'reference': {'livre': book, 'hadith': h['reference']['hadith']}, 'chapitre_en': sections.get(str(book), ''),
             'ar': a, 'fr': f, 'en': e}
        sa = strip(a)
        prophet = bool(PROPHETE.search(sa)) or bool(QAWL.search(sa))
        if b in ('bukhari', 'muslim'):
            if b == 'muslim' and book == 0:
                r['grade'] = {'valeur': None, 'par': None, 'methode': "introduction (muqaddima) de Muslim : hors du corpus Sahih proprement dit"}
            else:
                r['grade'] = {'valeur': 'Sahih', 'par': f'consensus sur les hadiths musnad de {nom}', 'methode': 'appartenance au recueil'}
            r['type'] = 'marfou_probable' if prophet else 'inconnu'
            r['type_methode'] = 'détection automatique de la mention du Prophète ﷺ dans le texte arabe : à confirmer en relecture'
        elif b == 'malik':
            g = h['grades'][0]['grade'] if h['grades'] else None
            r['grade'] = {'valeur': g, 'par': h['grades'][0]['name'] if h['grades'] else None, 'methode': 'grade fourni par la source'}
            if g is None: r['type'] = 'inconnu'
            elif g.startswith('Mauquf'): r['type'] = 'mawquf'
            elif g.startswith('Maqtu'): r['type'] = 'maqtu'
            elif g.startswith('Mursal'): r['type'] = 'mursal'
            else: r['type'] = 'marfou' if prophet else 'inconnu'
            r['type_methode'] = 'classement Mauquf/Maqtu de Salim al-Hilali, sinon mention du Prophète ﷺ dans le texte'
        else:
            tk = takhrij(a); v, m = grade_compil(tk)
            r['takhrij_ar'] = tk[:300]
            r['grade'] = {'valeur': v, 'par': 'compilateur du recueil (référence citée dans le texte)', 'methode': m}
            r['type'] = 'qoudsi' if b == 'qudsi' else ('marfou_probable' if prophet else 'inconnu')
            r['type_methode'] = 'recueil de hadiths qoudsi' if b == 'qudsi' else 'mention du Prophète ﷺ dans le texte'
        recs.append(r)
    out_all[b] = recs
os.makedirs(f'{OUT}/hadiths/recueils', exist_ok=True)
for b, recs in out_all.items():
    json.dump({'recueil': RECUEILS[b], 'nb': len(recs), 'hadiths': recs}, open(f'{OUT}/hadiths/recueils/{b}.json', 'w'), ensure_ascii=False, separators=(',', ':'))
    from collections import Counter
    print(b, len(recs), Counter(r['type'] for r in recs).most_common(), Counter(str(r['grade']['valeur']) for r in recs).most_common(4), 'sans fr', sum(1 for r in recs if not r['fr']))
