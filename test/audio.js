// Audio : bascule sur la source de secours quand everyayah échoue, écran de diagnostic
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const mp3 = fs.readFileSync(path.join(__dirname, 'silence.mp3'));
const types = { '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/html' }); r.end(d); } });
}).listen(0, async () => {
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  let fail = 0; const errs = [], asked = [];
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) fail++; };
  const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
  await pg.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  // everyayah en panne, source de secours disponible
  await pg.route(/everyayah\.com/, r => { asked.push(r.request().url()); r.abort(); });
  await pg.route(/cdn\.islamic\.network/, r => { asked.push(r.request().url()); r.fulfill({ status: 200, contentType: 'audio/mpeg', body: mp3 }); });
  pg.on('pageerror', e => errs.push(e.message)); pg.on('dialog', d => d.accept());
  await pg.goto(url); await pg.waitForSelector('#newname');
  await pg.fill('#newname', 'Son'); await pg.fill('#newage', '20'); await pg.click('text=Ajouter'); await pg.click('.who button');

  ok(await pg.evaluate(() => globalAyah(1, 1) === 1 && globalAyah(2, 1) === 8 && globalAyah(114, 6) === 6236), 'numéro global des versets (1, 8, 6236)');
  ok(await pg.evaluate(() => audioSources(2, 255)[1].url === 'https://cdn.islamic.network/quran/audio/128/ar.husary/262.mp3'), 'Ayat al-Kursi = verset global 262 (exemple de la documentation)');

  await pg.click('.node.cur'); await pg.waitForSelector('.audio');
  await pg.click('.audio');
  await pg.waitForFunction(() => audioEl && !audioEl.paused && audioEl.src.includes('islamic.network'), null, { timeout: 15000 }).catch(() => {});
  ok(await pg.evaluate(() => audioEl.src.includes('/ar.husary/1.mp3') && !audioEl.paused), 'everyayah en échec : lecture par la source de secours');
  ok(asked[0].includes('everyayah.com/data/Husary_128kbps/001001.mp3'), 'source principale essayée en premier');
  asked.length = 0;
  await pg.evaluate(() => playVerse(1, 2)); await pg.waitForTimeout(800);
  ok(asked.length && asked.every(u => u.includes('islamic.network')), 'ensuite la source en panne est évitée directement');
  await pg.click('.x'); await pg.waitForTimeout(100);

  await pg.click('.tab:has-text("Profil")'); await pg.click('text=Tester l\'audio');
  await pg.waitForFunction(() => [...document.querySelectorAll('.diag')].every(d => d.textContent !== '…'), null, { timeout: 15000 });
  const diag = await pg.$$eval('.item', els => els.map(e => e.textContent.replace(/\s+/g, ' ').trim()));
  ok(diag.filter(t => t.includes('principale') && t.startsWith('Échec')).length === 5 && diag.filter(t => t.includes('secours') && t.startsWith('OK')).length === 5, 'diagnostic : 5 échecs principale, 5 OK secours');
  if (process.env.SHOTS) await pg.screenshot({ path: path.join(process.env.SHOTS, 'diag-audio.png'), fullPage: true });

  console.log('errors:', errs);
  await b.close(); srv.close();
  if (errs.length || fail) process.exitCode = 1;
});
