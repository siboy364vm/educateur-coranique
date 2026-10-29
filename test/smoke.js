const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const shots = process.env.SHOTS; // dossier optionnel pour les captures
const types = { '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/html' }); r.end(d); } });
}).listen(0, async () => {
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg.route(/fonts\.(googleapis|gstatic)\.com|everyayah/, r => r.abort());
  pg.on('dialog', d => d.accept());
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  const shot = async n => { if (shots) await pg.screenshot({ path: path.join(shots, n + '.png') }); };
  const text = async () => (await pg.textContent('#app')).replace(/\s+/g, ' ');
  await pg.goto(url, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#newname');
  await pg.fill('#newname', 'Test'); await pg.fill('#newage', '18'); await pg.click('text=Ajouter');
  await shot('01-profils');
  await pg.click('.who button:has-text("Test")');
  await pg.waitForSelector('.node.cur'); await shot('02-chemin');

  // Joue la leçon ouverte en donnant toujours la bonne réponse
  async function play(first) {
    await pg.waitForSelector('#cta');
    let n = 0;
    while (await pg.evaluate(() => !!L)) {
      const st = await pg.evaluate(() => ({ t: L.steps[L.k].t, bank: L.steps[L.k].bank, frag: L.steps[L.k].frag && L.steps[L.k].frag.map(x => x.n), opts: L.steps[L.k].opts && L.steps[L.k].opts.map(o => o.key), answer: L.steps[L.k].answer }));
      if (st.t === 'learn') { if (first && !n) await shot('03-nouveau-verset'); await pg.click('#cta'); n++; continue; }
      if (st.t === 'order') {
        const used = new Set();
        for (const w of st.frag) { const bi = st.bank.findIndex((fi, i) => !used.has(i) && st.frag[fi] === w); used.add(bi); await pg.click(`#bank .tile >> nth=${bi}`); }
      } else await pg.click(`.opt >> nth=${st.opts.indexOf(st.answer)}`);
      if (first && n < 8) await shot('04-exercice-' + st.t);
      await pg.click('#cta');
      if (first && n < 8) await shot('05-retour-' + st.t);
      await pg.click('#cta'); n++;
    }
  }
  const lessons = await pg.evaluate(() => nLessons(data.units[0].s.number));
  for (let i = 0; i < lessons; i++) {
    await pg.click('.node.cur'); await play(i === 0);
    console.log('fin leçon', i + 1, ':', (await pg.textContent('.end h2')));
    if (i === 0) await shot('06-fin-lecon');
    await pg.click('.lfoot .btn:has-text("Continuer")');
  }
  await pg.click('.node.chk.cur'); await play(false);
  console.log('vérificateur :', (await pg.textContent('.end h2')), '|', (await pg.textContent('.end p:nth-of-type(2)')));
  await shot('07-validee');
  await pg.click('.lfoot .btn:has-text("Continuer")');
  console.log('chemin :', (await text()).slice(0, 160));
  await shot('08-chemin-apres');

  // Une leçon fausse : l'exercice raté revient à la fin
  await pg.click('.node.cur'); await pg.waitForSelector('#cta');
  while (await pg.evaluate(() => L.steps[L.k].t === 'learn')) await pg.click('#cta');
  const before = await pg.evaluate(() => L.steps.length);
  const wrong = await pg.evaluate(() => { const s = L.steps[L.k]; return s.opts ? s.opts.findIndex(o => o.key !== s.answer) : -1; });
  if (wrong >= 0) { await pg.click(`.opt >> nth=${wrong}`); await pg.click('#cta'); await shot('09-erreur'); console.log('erreur requeue :', before, '->', await pg.evaluate(() => L.steps.length)); }
  await pg.click('#cta'); await pg.click('.x');

  await pg.click('.tab:has-text("Réviser")'); console.log('réviser :', (await text()).slice(0, 200)); await shot('10-reviser');
  await pg.click('.tab:has-text("Hadith")'); await pg.click('text=J\'ai lu le hadith'); console.log('hadith :', (await text()).slice(-260)); await shot('11-hadith');
  await pg.click('.tab:has-text("Profil")'); console.log('profil :', (await text()).slice(0, 260)); await shot('12-profil');
  await pg.click('.goal-opt:has-text("Sérieux")');
  console.log('objectif :', await pg.textContent('.stat.goal'));
  await pg.click('text=Lire >> nth=0').catch(() => {});
  await pg.click('.tab:has-text("Apprendre")'); await pg.click('.chip:has-text("Lire") >> nth=0'); await shot('13-lecture'); await pg.click('text=Terminer la lecture');
  await pg.click('.tab:has-text("Profil")'); await pg.click('text=Espace parent'); await pg.fill('#pin', '1234'); await pg.click('text=Valider');
  console.log('parent :', (await text()).slice(0, 400)); await shot('14-parent');
  console.log('errors:', errs);
  await b.close(); srv.close();
  if (errs.length) process.exitCode = 1;
});
