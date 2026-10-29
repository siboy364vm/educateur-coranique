// Niveaux, migration de l'ancien format, rappel d'agenda et recherche
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/html' }); r.end(d); } });
}).listen(0, async () => {
  const url = 'http://localhost:' + srv.address().port + '/';
  const shots = process.env.SHOTS;
  const b = await chromium.launch();
  let fail = 0; const errs = [];
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) fail++; };
  const ctx = await b.newContext({ acceptDownloads: true, viewport: { width: 390, height: 844 } });
  // Données au format précédent : 2 leçons de 5 versets faites sur al-Baqara
  await ctx.addInitScript(() => { if (!localStorage.getItem('ec.v1')) localStorage.setItem('ec.v1', JSON.stringify({ profiles: [{ id: 'ancien1', name: 'Ancien', age: 30 }], log: [], memo: {}, pin: null, lessons: { ancien1: { 2: 2 } }, prefs: {} })); });
  const pg = await ctx.newPage();
  await pg.route(/fonts\.(googleapis|gstatic)\.com|everyayah|islamic\.network/, r => r.abort());
  pg.on('dialog', d => d.accept()); pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(url); await pg.waitForSelector('#newname');

  await pg.click('.who button:has-text("Ancien")');
  ok(await pg.evaluate(() => state.vdone.ancien1[2] === 10 && lessonsDone(2) === 2 && !('lessons' in state)), 'ancien format converti : 2 leçons = 10 versets');
  await pg.evaluate(() => setLevel('avance'));
  ok(await pg.evaluate(() => lessonsDone(2) === 1 && nLessons(2) === Math.ceil(286 / 7)), 'niveau avancé : 7 versets par leçon, 10 versets = 1 leçon');
  await pg.evaluate(() => setLevel('standard'));
  ok(await pg.evaluate(() => lessonsDone(2) === 2), 'retour au standard sans perte');

  // Profil de 7 ans : débutant par défaut
  await pg.evaluate(() => switchProfile());
  await pg.fill('#newname', 'Yusuf'); await pg.fill('#newage', '7'); await pg.click('text=Ajouter');
  await pg.click('.who button:has-text("Yusuf")');
  ok(await pg.evaluate(() => prefs().level === 'debutant' && nLessons(1) === 3), 'moins de 10 ans : niveau débutant, Fatiha en 3 leçons');
  await pg.click('.node.cur'); await pg.waitForSelector('#cta');
  const st = await pg.evaluate(() => ({ learn: L.steps.filter(s => s.t === 'learn').length, ex: L.steps.filter(s => s.t !== 'learn').length }));
  ok(st.learn === 3 && st.ex <= 6, 'leçon débutant : 3 versets, ' + st.ex + ' exercices');
  await pg.click('.x');
  await pg.evaluate(() => startQuiz(1)); await pg.waitForSelector('#cta');
  ok(await pg.evaluate(() => L.steps.length === 6), 'vérificateur débutant : 6 questions');
  await pg.click('.x');

  // Niveau personnalisé
  await pg.click('.tab:has-text("Profil")');
  await pg.click('.goal-opt:has-text("Personnalisé")');
  await pg.selectOption('.custom select >> nth=0', '2');
  await pg.selectOption('.custom select >> nth=3', '0.9');
  ok(await pg.evaluate(() => nLessons(1) === 4 && lv().pass === 0.9), 'personnalisé : 2 versets par leçon, seuil 90 %');
  ok((await pg.textContent('.card:has-text("Niveau")')).includes('2 verset(s) par leçon'), 'résumé du niveau affiché');
  if (shots) await pg.screenshot({ path: path.join(shots, 'niveau.png'), fullPage: true });

  // Rappel : fichier d'agenda et lien Google
  await pg.fill('input[type=time]', '07:30'); await pg.dispatchEvent('input[type=time]', 'change');
  const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('text=Ajouter à l\'agenda')]);
  const ics = fs.readFileSync(await dl.path(), 'utf8');
  ok(/RRULE:FREQ=DAILY/.test(ics) && /DTSTART:\d{8}T073000\r\n/.test(ics) && /BEGIN:VALARM/.test(ics), 'fichier .ics quotidien à 07:30 avec alarme');
  await pg.evaluate(() => { window.open = u => { window.__opened = u; }; });
  await pg.click('text=Ajouter à Google Agenda');
  const g = await pg.evaluate(() => window.__opened);
  ok(g && g.includes('recur=RRULE%3AFREQ%3DDAILY') && /T073000%2F\d{8}T074500/.test(g), 'lien Google Agenda quotidien');

  // Recherche
  await pg.click('.tab:has-text("Chercher")');
  const search = async q => { await pg.fill('#q', q); await pg.click('.search .btn'); await pg.waitForFunction(() => !$('res').textContent.includes('Recherche…')); return pg.textContent('#res'); };
  const r1 = await search('patience');
  ok(/^[1-9]\d* verset/.test(r1.trim()), 'recherche « patience » : ' + r1.trim().slice(0, 30));
  if (shots) await pg.screenshot({ path: path.join(shots, 'recherche.png') });
  const r2 = await search('الصبر');
  ok(/^[1-9]\d* verset/.test(r2.trim()), 'recherche arabe « الصبر » : ' + r2.trim().slice(0, 30));
  const r3 = await search('zzzqqq');
  ok(r3.trim().startsWith('0 verset(s), 0 hadith(s)'), 'mot absent : aucun résultat');
  const r4 = await search('Prière');
  ok(/hadith/.test(r4) && /[1-9]\d* verset/.test(r4), 'accents ignorés : ' + r4.trim().slice(0, 30));

  console.log('errors:', errs);
  await b.close(); srv.close();
  if (errs.length || fail) process.exitCode = 1;
});
