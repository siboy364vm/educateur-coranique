const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const srv = http.createServer((q, r) => {
  const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': f.endsWith('.json') ? 'application/json' : f.endsWith('.js') ? 'text/javascript' : f.endsWith('.css') ? 'text/css' : 'text/html' }); r.end(d); } });
}).listen(0, async () => {
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch(); const pg = await b.newPage();
  const errs = []; pg.on('pageerror', e => errs.push(e.message));
  await pg.goto(url);
  await pg.fill('#newname', 'Test'); await pg.click('text=Ajouter'); await pg.click('button:has-text("Test")');
  await pg.click('text=Ouvrir >> nth=0'); await pg.click('text=passer le vérificateur');
  const total = await pg.evaluate(() => Q.items.length);
  for (let i = 0; i < total; i++) { const ans = await pg.evaluate(() => Q.items[Q.k].answer); await pg.click(`button[data-v="${ans}"]`); }
  console.log('result:', (await pg.textContent('h2')));
  await pg.click('text=Accueil'); console.log('home:', (await pg.textContent('.card')).replace(/\s+/g, ' ').trim());
  await pg.click('text=Espace parent'); await pg.fill('#pin', '1234'); await pg.click('text=Valider');
  console.log('parent:', (await pg.textContent('#app')).replace(/\s+/g, ' ').slice(0, 250));
  console.log('errors:', errs);
  await b.close(); srv.close();
});
