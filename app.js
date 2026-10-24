'use strict';
const INTERVALS = [1, 3, 7, 14, 30];
const PASS = 0.8;
const KEY = 'ec.v1';
const DAY = 86400000;
let data = null;
let state = load();
let cur = null;

function load() {
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s) return s; } catch (e) {}
  return { profiles: [], log: [], memo: {}, pin: null };
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);
const dayKey = t => new Date(t).toISOString().slice(0, 10);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

const cache = {};
async function getJSON(f) {
  if (!cache[f]) { const r = await fetch(f); if (!r.ok) throw new Error(f); cache[f] = await r.json(); }
  return cache[f];
}
const surahFile = n => `data/coran/sourates/${String(n).padStart(3, '0')}.json`;

async function boot() {
  try {
    const [list, ordre, hq] = await Promise.all([getJSON('data/coran/sourates.json'), getJSON('data/coran/ordre_memorisation.json'), getJSON('data/hadiths/quotidien.json')]);
    data = { surahs: list.map(x => ({ number: x.numero, name_ar: x.nom_arabe, name_fr: x.nom_translit, count: x.nb_versets })), ordre: ordre.ordre_sourates, hadiths: hq.hadiths, source: 'Complexe du Roi Fahd et Tanzil (Hafs), traduction Hamidullah. Détails dans data/CONTENU.md' };
  } catch (e) { $('app').innerHTML = '<p class="bad">Données introuvables.</p>'; return; }
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  cur = localStorage.getItem('ec.cur');
  if (!state.profiles.find(p => p.id === cur)) cur = null;
  route();
}

function nav() {
  const p = state.profiles.find(p => p.id === cur);
  $('nav').innerHTML = p
    ? `<span class="muted">${esc(p.name)}</span> <button class="ghost" onclick="home()">Accueil</button><button class="ghost" onclick="parent()">Espace parent</button><button class="ghost" onclick="switchProfile()">Changer</button>`
    : '';
}
function route() { nav(); cur ? home() : profiles(); }
function switchProfile() { cur = null; localStorage.removeItem('ec.cur'); route(); }

function profiles() {
  $('app').innerHTML = `<div class="card"><h2>Qui apprend ?</h2>
    ${state.profiles.map(p => `<button onclick="pick('${p.id}')">${esc(p.name)}</button>`).join('') || '<p class="muted">Aucun profil.</p>'}
    <h3>Nouveau profil</h3><input id="newname" placeholder="Prénom" maxlength="30"> <input id="newage" type="number" min="4" max="99" placeholder="Âge" style="width:80px"> <button onclick="addProfile()">Ajouter</button></div>
    <p class="muted">Texte : ${esc(data.source)}</p>`;
}
function addProfile() {
  const n = $('newname').value.trim(), age = parseInt($('newage').value, 10);
  if (!n || !(age > 0)) return;
  state.profiles.push({ id: uid(), name: n, age, createdAt: Date.now() });
  save(); profiles();
}
function pick(id) { cur = id; localStorage.setItem('ec.cur', id); route(); }

const memo = () => (state.memo[cur] = state.memo[cur] || {});
function status(s) {
  const m = memo()[s.number];
  if (!m) return { label: 'Pas commencée', pct: 0 };
  if (m.validated) return { label: m.due <= Date.now() ? 'À réviser' : 'Validée', pct: 100, due: m.due <= Date.now() };
  return { label: 'En cours', pct: 40 };
}

function dailyHadith() {
  const p = state.profiles.find(p => p.id === cur), list = data.hadiths, now = new Date();
  const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / DAY);
  for (let k = 0; k < list.length; k++) {
    const h = list[(doy + k) % list.length];
    if (!h.accompagnement || (p && p.age >= 14)) return h;
  }
  return list[doy % list.length];
}
function nextSurah() {
  const m = memo();
  const n = data.ordre.find(x => !m[x] || !m[x].validated);
  return n && data.surahs.find(s => s.number === n);
}

function home() {
  nav();
  const h = dailyHadith(), nx = nextSurah();
  const dueList = data.surahs.filter(s => status(s).due);
  const done = data.surahs.filter(s => memo()[s.number] && memo()[s.number].validated).length;
  $('app').innerHTML = `
    <div class="card"><div class="row"><b>Progression</b><span>${done} / ${data.surahs.length} sourates validées</span></div>
    <div class="bar"><i style="width:${Math.round(100 * done / data.surahs.length)}%"></i></div></div>
    ${nx ? `<div class="card"><b>À apprendre</b><br>${nx.number}. ${esc(nx.name_fr)} <button onclick="study(${nx.number})">Commencer</button></div>` : ''}
    <div class="card"><b>Hadith du jour</b><div class="ar">${esc(h.ar)}</div><p>${esc(h.fr)}</p><p class="muted">${esc(h.recueil)} n° ${esc(h.numero)} · ${esc(h.grade.valeur)}</p></div>
    ${dueList.length ? `<div class="card"><b>À réviser aujourd'hui</b><br>${dueList.map(s => `<button onclick="study(${s.number})">${esc(s.name_fr)}</button>`).join('')}</div>` : ''}
    <div class="card"><b>Sourates</b>${data.surahs.map(s => { const st = status(s); return `<div class="row" style="padding:6px 0"><span>${s.number}. ${esc(s.name_fr)} <span class="muted">${esc(st.label)}</span></span><button class="ghost" onclick="study(${s.number})">Ouvrir</button></div>`; }).join('')}</div>`;
}

let startT = 0, showFr = false, uthmani = false;
async function study(n) {
  const s = data.surahs.find(x => x.number === n);
  if (!startT || cur !== studyOwner) startT = Date.now();
  studyOwner = cur;
  let v;
  try { v = (await getJSON(surahFile(n))).versets; } catch (e) { $('app').innerHTML = '<p class="bad">Sourate introuvable.</p>'; return; }
  $('app').innerHTML = `<div class="card"><div class="row"><b>${esc(s.name_fr)}</b><span class="ar">${esc(s.name_ar)}</span></div>
    <label class="muted"><input type="checkbox" ${showFr ? 'checked' : ''} onchange="showFr=this.checked;study(${n})"> Traduction</label>
    <label class="muted"><input type="checkbox" ${uthmani ? 'checked' : ''} onchange="uthmani=this.checked;study(${n})"> Texte uthmani (demande une police Coran)</label>
    ${v.map(a => `<div class="ar">${esc(uthmani ? a.hafs : a.simple)} <span class="muted">${a.n}</span></div>${showFr ? `<div class="muted">${esc(a.fr)}</div>` : ''}`).join('')}</div>
    <button onclick="quiz(${n})">Je suis prêt, passer le vérificateur</button>
    <button class="ghost" onclick="finishStudy(${n})">Terminer la séance</button>`;
}
let studyOwner = null;
function minutes() { return Math.max(1, Math.round((Date.now() - startT) / 60000)); }
function finishStudy(n) {
  state.log.push({ id: uid(), profile: cur, ts: Date.now(), type: 'study', surah: n, minutes: minutes() });
  const m = memo(); m[n] = m[n] || { validated: false, box: 0, due: 0 };
  startT = 0; save(); home();
}

let Q = null;
async function quiz(n) {
  const s = data.surahs.find(x => x.number === n);
  const v = (await getJSON(surahFile(n))).versets;
  const nb = n < 114 ? n + 1 : n - 1;
  const other = (await getJSON(surahFile(nb))).versets;
  const words = a => a.normalise.split(/\s+/).filter(Boolean);
  const pool = [...new Set([...v, ...other].flatMap(words))];
  const items = shuffle(v).slice(0, 10).map(a => {
    const w = words(a); const i = Math.floor(Math.random() * w.length);
    const answer = w[i];
    const opts = shuffle([answer, ...shuffle(pool.filter(x => x !== answer)).slice(0, 3)]);
    return { n: a.n, words: w, i, answer, opts };
  });
  Q = { s, items, k: 0, ok: 0 };
  renderQ();
}
function renderQ() {
  const q = Q.items[Q.k];
  const sentence = q.words.map((w, i) => i === q.i ? '<b>_____</b>' : esc(w)).join(' ');
  $('app').innerHTML = `<div class="card"><div class="muted">Question ${Q.k + 1} / ${Q.items.length} · verset ${q.n}</div>
    <div class="ar">${sentence}</div>
    ${q.opts.map(o => `<button class="ghost" onclick="answer(this.dataset.v)" data-v="${esc(o)}">${esc(o)}</button>`).join('')}</div>`;
}
function answer(v) {
  if (v === Q.items[Q.k].answer) Q.ok++;
  Q.k++;
  Q.k < Q.items.length ? renderQ() : endQuiz();
}
function endQuiz() {
  const score = Q.ok / Q.items.length, n = Q.s.number, pass = score >= PASS;
  const m = memo(); const e = m[n] = m[n] || { validated: false, box: 0, due: 0 };
  if (pass) { e.validated = true; e.box = Math.min(e.box + 1, INTERVALS.length); e.validatedAt = e.validatedAt || Date.now(); }
  else e.box = 1;
  e.due = Date.now() + INTERVALS[Math.max(0, e.box - 1)] * DAY;
  state.log.push({ id: uid(), profile: cur, ts: Date.now(), type: 'quiz', surah: n, score: Math.round(score * 100), pass, minutes: minutes() });
  save();
  $('app').innerHTML = `<div class="card"><h2>${Math.round(score * 100)} %</h2>
    <p>${pass ? 'Sourate validée. Prochaine révision dans ' + INTERVALS[e.box - 1] + ' jour(s).' : 'Seuil de ' + PASS * 100 + ' % non atteint. Relis la sourate et recommence demain.'}</p>
    <button onclick="home()">Accueil</button></div>`;
}

async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function parent() {
  nav();
  $('app').innerHTML = `<div class="card"><b>Espace parent</b><p class="muted">${state.pin ? 'Entre le code.' : 'Choisis un code à 4 chiffres au minimum.'}</p>
    <input id="pin" type="password" inputmode="numeric" maxlength="12"> <button onclick="unlock()">Valider</button><p id="msg" class="bad"></p></div>`;
}
async function unlock() {
  const v = $('pin').value;
  if (v.length < 4) { $('msg').textContent = 'Code trop court.'; return; }
  const h = await sha(v);
  if (!state.pin) { state.pin = h; save(); }
  else if (state.pin !== h) { $('msg').textContent = 'Code incorrect.'; return; }
  feed();
}
function feed() {
  const now = Date.now();
  $('app').innerHTML = state.profiles.map(p => {
    const mine = state.log.filter(l => l.profile === p.id).sort((a, b) => b.ts - a.ts);
    const week = mine.filter(l => now - l.ts < 7 * DAY);
    const days = new Set(week.map(l => dayKey(l.ts))).size;
    const mins = week.reduce((t, l) => t + (l.minutes || 0), 0);
    const quizzes = mine.filter(l => l.type === 'quiz');
    const val = Object.values(state.memo[p.id] || {}).filter(m => m.validated).length;
    return `<div class="card"><div class="row"><b>${esc(p.name)}</b><span class="muted">${val} sourate(s) validée(s)</span></div>
      <p>7 derniers jours : <b>${days}</b> jour(s) actif(s) sur 7, <b>${mins}</b> min.</p>
      ${mine.slice(0, 8).map(l => { const s = data.surahs.find(x => x.number === l.surah); return `<div class="muted">${new Date(l.ts).toLocaleDateString('fr-FR')} · ${l.type === 'quiz' ? 'Vérificateur ' + l.score + ' %' + (l.pass ? ' (validé)' : ' (échec)') : 'Étude'} · ${esc(s ? s.name_fr : l.surah)} · ${l.minutes} min</div>`; }).join('') || '<div class="muted">Aucune activité.</div>'}
      ${quizzes.length ? `<p class="muted">Moyenne des vérifications : ${Math.round(quizzes.reduce((t, l) => t + l.score, 0) / quizzes.length)} %</p>` : ''}</div>`;
  }).join('') || '<p>Aucun profil.</p>';
  $('app').insertAdjacentHTML('beforeend', '<p class="muted">Les données sont stockées sur cet appareil. Le suivi à distance arrive avec la synchronisation en ligne.</p>');
}
boot();
