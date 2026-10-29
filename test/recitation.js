// Récitation vocale : comparaison des mots et parcours complet avec un micro simulé
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/html' }); r.end(d); } });
}).listen(0, async () => {
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg.route(/fonts\.(googleapis|gstatic)\.com|everyayah|islamic\.network/, r => r.abort());
  pg.on('dialog', d => d.accept());
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  // Faux moteur : renvoie window.__say (ou le texte attendu du verset en cours)
  await pg.addInitScript(() => {
    window.SpeechRecognition = class {
      start() { setTimeout(() => {
        const t = window.__say != null ? window.__say : L.steps[L.k].v.simple;
        const alt = [{ transcript: t }]; const res = [alt]; res.isFinal = true;
        this.onresult && this.onresult({ results: [alt] });
        this.onend && this.onend();
      }, 30); }
      stop() {} abort() {}
    };
  });
  let fail = 0;
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) fail++; };
  await pg.goto(url, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#newname');

  const cmp = (e, s) => pg.evaluate(([e, s]) => compareRecitation(e, s), [e, s]);
  const fat2 = 'الحمد لله رب العالمين';
  ok((await cmp(fat2, 'الحمد لله رب العالمين')).score === 1, 'récitation exacte : 100 %');
  ok((await cmp(fat2, 'الْحَمْدُ لِلَّهِ رَبِّ الْعَالَمِينَ')).score === 1, 'voyelles ignorées');
  ok((await cmp('اياك نعبد واياك نستعين', 'إياك نعبد وإياك نستعين')).score === 1, 'hamza sur alif ignorée');
  const half = await cmp(fat2, 'الحمد لله');
  ok(half.score === 0.5 && half.marks.join() === 'true,true,false,false', 'mots manquants repérés : ' + half.marks.join());
  ok((await cmp(fat2, 'قل هو الله احد')).score < 0.5, 'autre verset : sous le seuil');
  ok((await cmp('اهدنا الصراط المستقيم', 'اهدنا السراط المستقيم')).score === 1, 'une lettre de différence tolérée sur un mot long');
  ok((await cmp(fat2, '')).score === 0, 'rien entendu : 0 %');

  await pg.fill('#newname', 'Voix'); await pg.fill('#newage', '12'); await pg.click('text=Ajouter');
  await pg.click('.who button:has-text("Voix")');
  await pg.click('.tab:has-text("Profil")');
  await pg.click('text=Réciter à voix haute');
  await pg.click('.tab:has-text("Apprendre")');
  ok(await pg.isVisible('.chip:has-text("Réciter")'), 'bouton Réciter visible sur l\'étape');

  // Leçon : les récitations sont ajoutées et réussies avec la bonne transcription
  await pg.click('.node.cur'); await pg.waitForSelector('#cta');
  const nRec = await pg.evaluate(() => L.steps.filter(s => s.t === 'recite').length);
  ok(nRec === 5, 'leçon 1 : 5 récitations ajoutées (' + nRec + ')');
  while (await pg.evaluate(() => L && L.steps[L.k].t !== 'recite')) {
    const st = await pg.evaluate(() => ({ t: L.steps[L.k].t, bank: L.steps[L.k].bank, frag: L.steps[L.k].frag && L.steps[L.k].frag.map(x => x.n), opts: L.steps[L.k].opts && L.steps[L.k].opts.map(o => o.key), answer: L.steps[L.k].answer }));
    if (st.t === 'learn') { await pg.click('#cta'); continue; }
    if (st.t === 'order') { const used = new Set(); for (const w of st.frag) { const bi = st.bank.findIndex((fi, i) => !used.has(i) && st.frag[fi] === w); used.add(bi); await pg.click(`#bank .tile >> nth=${bi}`); } }
    else await pg.click(`.opt >> nth=${st.opts.indexOf(st.answer)}`);
    await pg.click('#cta'); await pg.click('#cta');
  }
  ok(await pg.isDisabled('#cta'), 'Vérifier désactivé avant de parler');
  await pg.click('#mic'); await pg.waitForFunction(() => !$('cta').disabled);
  await pg.click('#cta');
  ok(await pg.isVisible('.lfoot.ok'), 'récitation correcte acceptée');
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'recite-ok.png') });
  await pg.click('#cta');
  await pg.evaluate(() => { window.__say = 'قل هو الله احد'; });
  await pg.click('#mic'); await pg.waitForFunction(() => !$('cta').disabled);
  await pg.click('#cta');
  const ko = await pg.textContent('.lfoot');
  ok(await pg.isVisible('.lfoot.ko') && ko.includes('% des mots reconnus'), 'mauvais verset refusé avec le détail des mots : ' + ko.replace(/\s+/g, ' ').slice(0, 90));
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'recite-ko.png') });
  await pg.click('#cta');
  await pg.evaluate(() => { window.__say = null; });
  await pg.click('text=Je ne peux pas parler maintenant');
  ok(await pg.evaluate(() => !L || L.steps.slice(L.k).every(s => s.t !== 'recite')), 'passer retire les récitations restantes');
  while (await pg.evaluate(() => !!L)) await pg.click('#cta');
  ok((await pg.textContent('.end h2')).includes('Leçon terminée'), 'leçon terminée');
  await pg.click('.lfoot .btn:has-text("Continuer")');

  // Récitation de toute la sourate
  await pg.click('.chip:has-text("Réciter") >> nth=0'); await pg.waitForSelector('#mic');
  while (await pg.evaluate(() => !!L)) { await pg.click('#mic'); await pg.waitForFunction(() => !$('cta').disabled); await pg.click('#cta'); await pg.click('#cta'); }
  ok((await pg.textContent('.end h2')).includes('Récitation terminée') && (await pg.textContent('.end')).includes('100 %'), 'récitation complète de la Fatiha : 100 %');
  ok(await pg.evaluate(() => state.log.some(l => l.type === 'recite' && l.score === 100)), 'récitation enregistrée dans l\'historique');

  // Sans moteur vocal : l'option n'est pas proposée
  const p2 = await (await b.newContext()).newPage(); await p2.route(/fonts|everyayah/, r => r.abort());
  await p2.addInitScript(() => { delete window.webkitSpeechRecognition; delete window.SpeechRecognition; });
  await p2.goto(url); await p2.waitForSelector('#newname');
  await p2.fill('#newname', 'Sans'); await p2.fill('#newage', '9'); await p2.click('text=Ajouter'); await p2.click('.who button'); await p2.click('.tab:has-text("Profil")');
  ok((await p2.textContent('#app')).includes('non disponible sur ce navigateur'), 'navigateur sans reconnaissance : message clair');

  console.log('errors:', errs);
  await b.close(); srv.close();
  if (errs.length || fail) process.exitCode = 1;
});
