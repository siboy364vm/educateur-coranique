// Synchronisation : deux appareils d'une même famille, hors ligne, écritures concurrentes, autre compte, jeton expiré.
// Supabase est imité ici (mêmes adresses et réponses que l'API réelle, règles de serveur/supabase.sql appliquées à la main).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const root = path.join(__dirname, '..');
const types = { '.json': 'application/json', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml' };
const SB = 'https://faux.supabase.co', KEY = 'sb_publishable_test';

// Faux Supabase : comptes par e-mail, code fixe, une ligne par compte, écriture conditionnée à la version
const S = { codes: {}, users: {}, access: {}, refresh: {}, rows: {}, down: false, patches: 0, beforePatch: null, n: 0 };
function issue(uid, email) {
  const a = 'acc' + (++S.n), r = 'ref' + S.n;
  S.access[a] = { uid, exp: Date.now() + 3600e3 }; S.refresh[r] = uid;
  return { access_token: a, refresh_token: r, expires_in: 3600, user: { id: uid, email } };
}
async function supabase(route) {
  const q = route.request(), u = new URL(q.url()), h = q.headers();
  const send = (status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: body === undefined ? '' : JSON.stringify(body) });
  if (S.down) return route.abort('internetdisconnected');
  if (q.method() === 'OPTIONS') return route.fulfill({ status: 200, headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' } });
  if (h.apikey !== KEY) return send(401, { message: 'clé absente' });
  const b = q.postData() ? JSON.parse(q.postData()) : {};
  if (u.pathname === '/auth/v1/otp') { S.codes[b.email] = '123456'; return send(200, {}); }
  if (u.pathname === '/auth/v1/verify') {
    if (S.codes[b.email] !== b.token) return send(403, { msg: 'Token has expired or is invalid' });
    delete S.codes[b.email]; S.users[b.email] = S.users[b.email] || 'uid-' + b.email;
    return send(200, issue(S.users[b.email], b.email));
  }
  if (u.pathname === '/auth/v1/token') {
    const uid = S.refresh[b.refresh_token];
    if (!uid) return send(400, { msg: 'Invalid Refresh Token' });
    delete S.refresh[b.refresh_token];
    return send(200, issue(uid, Object.keys(S.users).find(e => S.users[e] === uid)));
  }
  if (u.pathname === '/auth/v1/logout') return send(204);
  const tok = S.access[(h.authorization || '').replace('Bearer ', '')];
  if (!tok || tok.exp < Date.now()) return send(401, { message: 'JWT expired' });
  const mine = S.rows[tok.uid];
  if (u.pathname === '/rest/v1/espaces') {
    if (q.method() === 'GET') return send(200, mine ? [mine] : []);
    if (q.method() === 'POST') { if (mine) return send(409, { message: 'duplicate key' }); S.rows[tok.uid] = { id: 'e-' + tok.uid, rev: b.rev, data: b.data }; return send(201); }
    if (q.method() === 'PATCH') {
      if (S.beforePatch) { const f = S.beforePatch; S.beforePatch = null; f(); }
      S.patches++;
      const id = u.searchParams.get('id').slice(3), rev = +u.searchParams.get('rev').slice(3), row = S.rows[tok.uid];
      if (!row || row.id !== id || row.rev !== rev) return send(200, []);
      Object.assign(row, b); return send(200, [row]);
    }
  }
  return send(404, {});
}

const srv = http.createServer((q, r) => {
  const f = path.join(root, q.url === '/' ? 'index.html' : q.url.split('?')[0]);
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); r.end(); } else { r.writeHead(200, { 'content-type': types[path.extname(f)] || 'text/html' }); r.end(d); } });
}).listen(0, async () => {
  const url = 'http://localhost:' + srv.address().port + '/';
  const b = await chromium.launch();
  let fail = 0; const errs = [];
  const ok = (c, m) => { console.log((c ? 'ok   ' : 'ÉCHEC ') + m); if (!c) fail++; };
  async function device() {
    const pg = await (await b.newContext()).newPage();
    await pg.route(/fonts\.(googleapis|gstatic)\.com|everyayah|islamic\.network/, r => r.abort());
    await pg.route('**/config.js', r => r.fulfill({ contentType: 'text/javascript', body: `window.EC_CONFIG = { supabaseUrl: '${SB}', supabaseKey: '${KEY}' };` }));
    await pg.route(SB + '/**', supabase);
    pg.on('dialog', d => d.accept()); pg.on('pageerror', e => errs.push(e.message));
    await pg.goto(url); await pg.waitForSelector('#newname');
    return pg;
  }
  async function login(pg, email) {
    await pg.fill('#semail', email); await pg.click('text=Recevoir un code');
    await pg.waitForSelector('#scode'); await pg.fill('#scode', '123456'); await pg.click('#synccard >> text=Valider');
    await pg.waitForFunction(() => sess && sess.at && !syncing);
  }
  const sync = pg => pg.evaluate(() => syncNow());
  const ids = pg => pg.evaluate(() => state.log.map(l => l.id).sort().join());
  const server = email => S.rows[S.users[email]] && S.rows[S.users[email]].data;

  // A : un profil, une activité, puis connexion depuis l'onglet Profil
  const A = await device();
  await A.fill('#newname', 'Amina'); await A.fill('#newage', '10'); await A.click('text=Ajouter');
  await A.click('.who button:has-text("Amina")');
  await A.click('.tab:has-text("Hadith")'); await A.click('text=J\'ai lu le hadith');
  await A.click('.tab:has-text("Profil")');
  ok(await A.isVisible('#synccard'), 'carte de synchronisation affichée');
  await login(A, 'famille@exemple.fr');
  ok(server('famille@exemple.fr') && server('famille@exemple.fr').profiles[0].name === 'Amina', 'A a créé l\'espace en ligne avec Amina');
  ok((await A.textContent('#synccard')).includes('Synchronisé le'), 'état « Synchronisé » affiché');

  // B, appareil neuf : connexion depuis l'écran d'accueil, retrouve Amina
  const B = await device();
  await login(B, 'famille@exemple.fr');
  await B.waitForSelector('.who button:has-text("Amina")');
  ok(await B.evaluate(() => state.profiles.length === 1 && xpTotal(state.profiles[0].id) === 5), 'B retrouve Amina et ses XP');

  // B progresse et crée un profil : envoyé tout seul quelques secondes après l'enregistrement
  await B.click('.who button:has-text("Amina")');
  await B.evaluate(() => { state.log.push({ id: uid(), profile: cur, ts: Date.now(), type: 'lesson', surah: 1, lesson: 1, score: 100, xp: 15, minutes: 2 }); state.vdone[cur] = { 1: 5 }; save(); });
  await B.evaluate(() => { const id = uid(); state.profiles.push({ id, name: 'Yusuf', age: 8, createdAt: Date.now() }); save(); });
  await new Promise(r => setTimeout(r, 4500));
  ok(server('famille@exemple.fr').profiles.length === 2 && server('famille@exemple.fr').log.length === 2, 'B a envoyé automatiquement sa progression');

  // A est hors ligne : il progresse quand même, rien n'est perdu
  S.down = true;
  await A.evaluate(() => { state.log.push({ id: uid(), profile: cur, ts: Date.now(), type: 'recite', surah: 1, score: 90, xp: 10, minutes: 1 }); save(); });
  await sync(A);
  ok((await A.textContent('#synccard')).includes('Hors ligne'), 'A affiche « Hors ligne »');
  ok(await A.evaluate(() => state.log.length === 2 && xpTotal(cur) === 15), 'A garde sa progression hors ligne');
  // Retour du réseau : fusion dans les deux sens
  S.down = false;
  await A.evaluate(() => window.dispatchEvent(new Event('online')));
  await A.waitForFunction(() => !syncing && sess.err === null && state.log.length === 3);
  await sync(B);
  ok(await ids(A) === await ids(B) && (await ids(A)).split(',').length === 3, 'au retour du réseau, A et B ont les 3 activités');
  ok(await A.evaluate(() => state.profiles.map(p => p.name).join() === 'Amina,Yusuf' && lessonsDone(1) >= 1), 'A voit Yusuf et la leçon faite sur B');
  const p0 = S.patches; await sync(A); await sync(B);
  ok(S.patches === p0, 'appareils à jour : aucune écriture inutile');

  // Écritures concurrentes : B écrit pendant que A envoie ; A relit, refusionne, rien n'est perdu
  await A.evaluate(() => { state.log.push({ id: 'concura', profile: cur, ts: Date.now(), type: 'hadith', xp: 5, minutes: 1 }); persist(); });
  S.beforePatch = () => { const r = S.rows[S.users['famille@exemple.fr']]; r.data = JSON.parse(JSON.stringify(r.data)); r.data.log.push({ id: 'concurb', profile: r.data.profiles[0].id, ts: Date.now(), type: 'hadith', xp: 5, minutes: 1 }); r.rev++; };
  await sync(A);
  const logS = server('famille@exemple.fr').log.map(l => l.id);
  ok(logS.includes('concura') && logS.includes('concurb') && logS.length === 5, 'écriture concurrente : les deux activités sont gardées (' + logS.length + ')');

  // Réglage changé sur B (niveau) : arrive sur A
  await sync(B);
  await B.evaluate(() => { cur = state.profiles.find(p => p.name === 'Amina').id; prefs().level = 'avance'; save(); });
  await sync(B); await sync(A);
  ok(await A.evaluate(() => prefs().level === 'avance'), 'le niveau choisi sur B arrive sur A');

  // Code parent : choisi sur A, valable sur B
  await A.evaluate(() => { state.pin = 'a'.repeat(64); state.pinAt = Date.now(); save(); });
  await sync(A); await sync(B);
  ok(await B.evaluate(() => state.pin === 'a'.repeat(64)), 'le code parent est le même sur B');

  // Jeton expiré : renouvelé sans redemander de code
  await A.evaluate(() => { sess.exp = Date.now() - 1; saveSess(); });
  await sync(A);
  ok(await A.evaluate(() => sess.err === null && sess.exp > Date.now()), 'jeton expiré renouvelé automatiquement');
  // Session révoquée : invitation à se reconnecter, données intactes
  await A.evaluate(() => { sess.exp = 0; sess.refresh = 'revoque'; saveSess(); });
  await sync(A);
  await A.evaluate(() => render());
  ok((await A.textContent('#synccard')).includes('connexion a expiré') && await A.evaluate(() => state.log.length === 5), 'session révoquée : reconnexion demandée, rien perdu');

  // Autre famille : ne voit rien
  const C = await device();
  await login(C, 'autre@exemple.fr');
  ok(await C.evaluate(() => state.profiles.length === 0) && server('autre@exemple.fr').profiles.length === 0, 'un autre compte ne voit pas la famille');

  // Mauvais code
  const D = await device();
  await D.fill('#semail', 'famille@exemple.fr'); await D.click('text=Recevoir un code');
  await D.waitForSelector('#scode'); await D.fill('#scode', '000000'); await D.click('#synccard >> text=Valider');
  ok(!!(await D.waitForSelector('.toast:has-text("Code incorrect")', { timeout: 3000 }).catch(() => null)) && await D.evaluate(() => !sess), 'mauvais code refusé');

  // Données piégées sur le serveur : nettoyées avant d'entrer dans l'appli
  S.rows[S.users['famille@exemple.fr']].data.profiles.push({ id: "x');alert(1)//", name: 'Pirate', age: 1, createdAt: 1 });
  S.rows[S.users['famille@exemple.fr']].rev++;
  await sync(B);
  ok(await B.evaluate(() => !state.profiles.some(p => p.name === 'Pirate')), 'données piégées écartées');

  // Déconnexion : les données restent sur l'appareil
  await B.evaluate(() => { cur = null; profiles(); });
  await B.click('text=Se déconnecter de cet appareil');
  ok(await B.evaluate(() => !sess && state.profiles.length === 2) && await B.isVisible('#semail'), 'déconnexion : profils gardés, formulaire de connexion réaffiché');

  // Sans configuration : aucune trace de la synchronisation
  const E = await (await b.newContext()).newPage();
  await E.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await E.goto(url); await E.waitForSelector('#newname');
  ok(!(await E.isVisible('#synccard')), 'site sans configuration : pas de carte de synchronisation');

  console.log('errors:', errs);
  await b.close(); srv.close();
  if (errs.length || fail) process.exitCode = 1;
});
