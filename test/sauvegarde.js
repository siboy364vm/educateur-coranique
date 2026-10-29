// Sauvegarde : export sur un appareil, import et fusion sur un autre, fichiers invalides refusés
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), os = require('os');
const root = path.join(__dirname, '..');
const types = { '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/html' }); r.end(d); } });
}).listen(0, async () => {
  const url = 'http://localhost:' + srv.address().port + '/';
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'ec-'));
  const b = await chromium.launch();
  let fail = 0; const errs = [];
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) fail++; };
  async function device() {
    const pg = await (await b.newContext({ acceptDownloads: true })).newPage();
    await pg.route(/fonts\.(googleapis|gstatic)\.com|everyayah|islamic\.network/, r => r.abort());
    pg.on('dialog', d => d.accept()); pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(url); await pg.waitForSelector('#newname');
    return pg;
  }
  async function exportFrom(pg, name) {
    await pg.click('.tab:has-text("Profil")');
    const [dl] = await Promise.all([pg.waitForEvent('download'), pg.click('text=Télécharger le fichier')]);
    const f = path.join(tmp, name); await dl.saveAs(f); return f;
  }
  const logOf = pg => pg.evaluate(() => state.log.map(l => l.id).sort().join());

  // Appareil A : un profil, une activité
  const A = await device();
  await A.fill('#newname', 'Amina'); await A.fill('#newage', '10'); await A.click('text=Ajouter');
  await A.click('.who button:has-text("Amina")');
  await A.click('.tab:has-text("Hadith")'); await A.click('text=J\'ai lu le hadith');
  await A.evaluate(() => { state.memo[cur] = { 1: { validated: true, box: 1, due: Date.now() + 86400000, validatedAt: 1000 } }; state.vdone[cur] = { 1: 7 }; save(); });
  const fa = await exportFrom(A, 'a.json');
  ok(JSON.parse(fs.readFileSync(fa)).format === 'educateur-coranique', 'fichier exporté au bon format');
  ok((await A.textContent('#app')).includes('Dernière sauvegarde'), 'date de dernière sauvegarde affichée');

  // Appareil B, vierge : reprise depuis l'écran d'accueil
  const B = await device();
  await B.setInputFiles('.file-btn input', fa);
  await B.waitForSelector('.who button:has-text("Amina")');
  await B.click('.who button:has-text("Amina")');
  ok(await B.evaluate(() => isValid(1) && lessonsDone(1) === 2 && xpTotal(cur) === 5), 'B a retrouvé validation, leçons et XP de A');
  // B progresse, puis A importe la sauvegarde de B
  await B.evaluate(() => { state.log.push({ id: uid(), profile: cur, ts: Date.now(), type: 'lesson', surah: 114, lesson: 1, score: 100, xp: 15, minutes: 2 }); state.vdone[cur][114] = 5; save(); });
  const fb = await exportFrom(B, 'b.json');
  await A.setInputFiles('.file-btn input', fb);
  await A.waitForTimeout(300);
  ok(await A.evaluate(() => state.log.length === 2 && lessonsDone(114) === 1 && lessonsDone(1) === 2 && state.profiles.length === 1), 'A fusionne sans doublon (2 activités, 1 profil)');
  ok(await logOf(A) === await logOf(B), 'A et B ont le même historique');
  // Réimporter le même fichier ne change rien
  await A.setInputFiles('.file-btn input', fb); await A.waitForTimeout(300);
  ok(await A.evaluate(() => state.log.length === 2), 'réimport sans effet');

  // Fichier piégé : identifiants non conformes et champs injectés écartés
  const evil = { format: 'educateur-coranique', version: 1, data: { profiles: [{ id: "x');alert(1)//", name: 'Pirate', age: 9 }, { id: 'ok1', name: '<img src=x onerror=alert(1)>', age: '<b>9</b>' }], log: [{ id: 'l1', profile: 'ok1', ts: 1, type: 'quiz', score: '<img src=x onerror=alert(2)>', xp: 5 }], memo: {}, lessons: {}, prefs: { ok1: { goal: '<script>' } } } };
  const fe = path.join(tmp, 'evil.json'); fs.writeFileSync(fe, JSON.stringify(evil));
  await A.setInputFiles('.file-btn input', fe); await A.waitForTimeout(300);
  const ev = await A.evaluate(() => ({ ids: state.profiles.map(p => p.id), p: state.profiles.find(p => p.id === 'ok1'), l: state.log.find(l => l.id === 'l1'), g: state.prefs.ok1 && state.prefs.ok1.goal }));
  ok(!ev.ids.includes("x');alert(1)//") && ev.p && Number.isFinite(ev.p.age) && Number.isFinite(ev.l.score) && ev.g === 20, 'fichier piégé nettoyé : ' + JSON.stringify(ev));
  // Fichier qui n'est pas une sauvegarde
  const fx = path.join(tmp, 'x.json'); fs.writeFileSync(fx, '{"a":1}');
  await A.setInputFiles('.file-btn input', fx);
  ok(!!(await A.waitForSelector('.toast:has-text("pas une sauvegarde")', { timeout: 3000 }).catch(() => null)), 'fichier étranger refusé');

  console.log('errors:', errs);
  await b.close(); srv.close();
  if (errs.length || fail) process.exitCode = 1;
});
