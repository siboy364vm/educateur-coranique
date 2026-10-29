'use strict';
const INTERVALS = [1, 3, 7, 14, 30];
const PASS = 0.8;
const KEY = 'ec.v1';
const DAY = 86400000;
const CHUNK = 5;      // versets par leçon
const MAX_EX = 10;    // exercices par leçon
const XP = { lesson: 10, perfect: 5, practice: 5, quizPass: 20, quizTry: 5, hadith: 5, recite: 10 };
const GOALS = [[10, 'Détendu'], [20, 'Normal'], [30, 'Sérieux'], [50, 'Intense']];
const COLORS = [['#58cc02', '#58a700'], ['#ce82ff', '#a568cc'], ['#1cb0f6', '#1899d6'], ['#ff9600', '#e08600'], ['#ff86d0', '#e070b5'], ['#2bc4a6', '#1fa088']];
const ZIG = [0, 44, 66, 44, 0, -44, -66, -44];
const SOURCE_CORAN = 'Texte Hafs : Complexe du Roi Fahd et Tanzil. Traduction (sens approché) : Hamidullah. Détails dans data/CONTENU.md';
let data = null;
let state = load();
let cur = null;
let tab = 'learn';
let shown = 0;   // étapes affichées en plus sur le chemin
let L = null;    // leçon ou vérificateur en cours

function load() {
  let s = null;
  try { s = JSON.parse(localStorage.getItem(KEY)); } catch (e) {}
  s = s || { profiles: [], log: [], memo: {}, pin: null };
  s.lessons = s.lessons || {}; s.prefs = s.prefs || {};
  return s;
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} }
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const $ = id => document.getElementById(id);
const uid = () => Math.random().toString(36).slice(2, 10);
const dayKey = t => { const d = new Date(t); return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); };
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick1 = a => a[Math.floor(Math.random() * a.length)];
const uniq = a => [...new Map(a.map(x => [x.n, x])).values()];

const cache = {};
async function getJSON(f) {
  if (!cache[f]) { const r = await fetch(f); if (!r.ok) throw new Error(f); cache[f] = await r.json(); }
  return cache[f];
}
const surahFile = n => `data/coran/sourates/${String(n).padStart(3, '0')}.json`;

/* Récitation vocale : la transcription du navigateur est comparée mot à mot au verset (le tajwid n'est pas jugé) */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const arNorm = s => String(s).replace(/[ٱأإآ]/g, 'ا').replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
  .replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/ؤ/g, 'و').replace(/ئ/g, 'ي').replace(/ء/g, '')
  .replace(/[^ء-ي\s]/g, ' ').split(/\s+/).filter(Boolean);
function lev(a, b) {
  let p = [...Array(b.length + 1).keys()];
  for (let i = 1; i <= a.length; i++) {
    const q = [i];
    for (let j = 1; j <= b.length; j++) q[j] = Math.min(p[j] + 1, q[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    p = q;
  }
  return p[b.length];
}
const sameWord = (a, b) => a === b || lev(a, b) <= (Math.max(a.length, b.length) >= 9 ? 2 : Math.max(a.length, b.length) >= 5 ? 1 : 0);
// Plus longue sous-suite commune : chaque mot attendu est marqué entendu ou manquant
function compareRecitation(expected, spoken) {
  const e = arNorm(expected), s = arNorm(spoken);
  const t = [...Array(e.length + 1)].map(() => new Array(s.length + 1).fill(0));
  for (let i = e.length - 1; i >= 0; i--) for (let j = s.length - 1; j >= 0; j--)
    t[i][j] = sameWord(e[i], s[j]) ? t[i + 1][j + 1] + 1 : Math.max(t[i + 1][j], t[i][j + 1]);
  const marks = new Array(e.length).fill(false);
  for (let i = 0, j = 0; i < e.length && j < s.length;) {
    if (sameWord(e[i], s[j]) && t[i][j] === t[i + 1][j + 1] + 1) { marks[i] = true; i++; j++; }
    else if (t[i + 1][j] >= t[i][j + 1]) i++; else j++;
  }
  return { score: e.length ? marks.filter(Boolean).length / e.length : 0, marks };
}

/* Icônes : formes simples et motifs géométriques uniquement */
const I = {
  star: (s = 24, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><g fill="${c}"><rect x="5" y="5" width="14" height="14" rx="2"/><rect x="5" y="5" width="14" height="14" rx="2" transform="rotate(45 12 12)"/></g></svg>`,
  fire: (s = 24, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${c}" d="M12 1.5c.9 3.6 6.5 6.4 6.5 12.3A6.5 6.5 0 0 1 12 22a6.5 6.5 0 0 1-6.5-6.6c0-2.9 1.5-5 3-6.4.3 1.9 1.1 3.1 2.3 3.6-.2-3.7-.1-7.6 1.2-11.1z"/></svg>`,
  check: (s = 24, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" stroke="${c}" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  lock: (s = 24, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 10V7a4 4 0 0 1 8 0v3" stroke="${c}" stroke-width="2.6" fill="none"/><rect x="5" y="10" width="14" height="11" rx="3" fill="${c}"/></svg>`,
  book: (s = 24, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${c}" d="M2.5 5.5C5.6 4.3 8.8 4.5 12 6.6c3.2-2.1 6.4-2.3 9.5-1.1v14c-3.1-1.2-6.3-1-9.5 1.1-3.2-2.1-6.4-2.3-9.5-1.1z"/><path d="M12 7v13" stroke="rgba(0,0,0,.18)" stroke-width="1.5"/></svg>`,
  trophy: (s = 24, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${c}" d="M7 3h10v2h3.5v1.5A4.5 4.5 0 0 1 16.6 11 5 5 0 0 1 13 13.8V17h3v4H8v-4h3v-3.2A5 5 0 0 1 7.4 11 4.5 4.5 0 0 1 3.5 6.5V5H7zm0 3.5H5.3A2.8 2.8 0 0 0 7 9zm10 0V9a2.8 2.8 0 0 0 1.7-2.5z"/></svg>`,
  refresh: (s = 24, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 3.5V9h-5.5" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  sound: (s = 22, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 9h4l5-4v14l-5-4h-4z" fill="${c}"/><path d="M16 8.5a5 5 0 0 1 0 7M18.6 6a8.5 8.5 0 0 1 0 12" stroke="${c}" stroke-width="2.2" fill="none" stroke-linecap="round"/></svg>`,
  mic: (s = 24, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><rect x="8.5" y="2" width="7" height="12.5" rx="3.5" fill="${c}"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" stroke="${c}" stroke-width="2.4" fill="none" stroke-linecap="round"/></svg>`,
  x: (s = 26, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" stroke="${c}" stroke-width="3" stroke-linecap="round"/></svg>`,
  home: (s = 26, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${c}" d="M12 2.5l9.5 8.2V21a1 1 0 0 1-1 1H15v-6.5H9V22H3.5a1 1 0 0 1-1-1V10.7z"/></svg>`,
  chart: (s = 26, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><g fill="${c}"><rect x="3" y="12" width="5" height="9" rx="1.5"/><rect x="9.5" y="6" width="5" height="15" rx="1.5"/><rect x="16" y="2.5" width="5" height="18.5" rx="1.5"/></g></svg>`,
  shield: (s = 22, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path fill="${c}" d="M12 2l8 3v6c0 5-3.4 9-8 11-4.6-2-8-6-8-11V5z"/></svg>`,
  back: (s = 24, c = 'currentColor') => `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" stroke="${c}" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  ring: (pct, s = 26) => { const r = 9, c = 2 * Math.PI * r; return `<svg width="${s}" height="${s}" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="${r}" stroke="var(--line)" stroke-width="4" fill="none"/><circle cx="12" cy="12" r="${r}" stroke="var(--blue)" stroke-width="4" fill="none" stroke-linecap="round" stroke-dasharray="${c * Math.min(1, pct)} ${c}" transform="rotate(-90 12 12)"/></svg>`; },
};
// Emblème de l'appli : étoile à huit branches, sans visage ni personnage
const emblem = (s = 72, cls = '') => `<svg class="mascot ${cls}" width="${s}" height="${s}" viewBox="0 0 64 64" aria-hidden="true"><g transform="translate(32 32)"><rect x="-21" y="-21" width="42" height="42" rx="6" fill="#58cc02"/><rect x="-21" y="-21" width="42" height="42" rx="6" fill="#58cc02" transform="rotate(45)"/><circle r="15" fill="#fff"/><rect x="-8" y="-8" width="16" height="16" rx="2" fill="#ffc800"/><rect x="-8" y="-8" width="16" height="16" rx="2" fill="#ffc800" transform="rotate(45)"/></g></svg>`;

async function boot() {
  try {
    const [list, ordre, hq] = await Promise.all([getJSON('data/coran/sourates.json'), getJSON('data/coran/ordre_memorisation.json'), getJSON('data/hadiths/quotidien.json')]);
    data = { surahs: list.map(x => ({ number: x.numero, name_ar: x.nom_arabe, name_fr: x.nom_translit, count: x.nb_versets, juz: x.juz_debut })), ordre: ordre.ordre_sourates, hadiths: hq.hadiths, audio: null };
  } catch (e) { $('app').innerHTML = '<div class="wrap"><p class="bad">Données introuvables.</p></div>'; return; }
  try { data.audio = await getJSON('data/coran/audio.json'); } catch (e) {}
  data.units = data.ordre.map((n, i) => { const s = data.surahs.find(x => x.number === n); return { rank: i + 1, s, lessons: Math.ceil(s.count / CHUNK) }; });
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
  cur = localStorage.getItem('ec.cur');
  if (!state.profiles.find(p => p.id === cur)) cur = null;
  document.addEventListener('keydown', e => { if (e.key === 'Enter' && L) { const b = $('cta'); if (b && !b.disabled) b.click(); } });
  route();
}

/* Profil courant et calculs de progression */
const me = () => state.profiles.find(p => p.id === cur);
const memo = () => (state.memo[cur] = state.memo[cur] || {});
const prefs = () => (state.prefs[cur] = Object.assign({ fr: true, uthmani: false, reciter: 'husary', goal: 20, voice: false }, state.prefs[cur]));
const lessonsDone = n => (state.lessons[cur] || {})[n] || 0;
const isValid = n => !!(memo()[n] && memo()[n].validated);
const voiceOn = () => !!(SR && prefs().voice);
const isDue = n => isValid(n) && memo()[n].due <= Date.now();
const colorOf = id => COLORS[[...String(id)].reduce((t, c) => t + c.charCodeAt(0), 0) % COLORS.length][0];
const mine = pid => state.log.filter(l => l.profile === pid);
const xpOn = (pid, k) => mine(pid).filter(l => dayKey(l.ts) === k).reduce((t, l) => t + (l.xp || 0), 0);
const xpTotal = pid => mine(pid).reduce((t, l) => t + (l.xp || 0), 0);
function streak(pid) {
  const days = new Set(mine(pid).map(l => dayKey(l.ts)));
  const d = new Date(); if (!days.has(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0; while (days.has(dayKey(d))) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
const activeToday = pid => mine(pid).some(l => dayKey(l.ts) === dayKey(Date.now()));
function avatar(p, cls = '') { return `<span class="avatar ${cls}" style="background:${colorOf(p.id)}">${esc(p.name.slice(0, 1).toUpperCase())}</span>`; }
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t); setTimeout(() => t.remove(), 2600);
}

function route() { L = null; cur ? render() : profiles(); }
function go(t) { tab = t; shown = 0; render(); window.scrollTo(0, 0); }
function render() {
  L = null;
  const views = { learn: viewLearn, review: viewReview, hadith: viewHadith, me: viewMe };
  shell((views[tab] || viewLearn)());
  if (tab === 'learn') { const c = document.querySelector('.node.cur'); if (c && !shown) c.scrollIntoView({ block: 'center' }); }
}
function shell(inner) {
  const p = me(), pr = prefs(), st = streak(cur), today = xpOn(cur, dayKey(Date.now()));
  const due = data.surahs.filter(s => isDue(s.number)).length;
  const t = (id, ico, label, badge) => `<button class="tab ${tab === id ? 'on' : ''}" onclick="go('${id}')">${ico}${label}${badge ? `<span class="badge">${badge}</span>` : ''}</button>`;
  $('app').innerHTML = `
    <div class="top"><div class="in">
      <button class="avatar" style="background:${colorOf(p.id)}" onclick="go('me')" aria-label="Profil">${esc(p.name.slice(0, 1).toUpperCase())}</button>
      <span class="stat fire ${activeToday(cur) ? '' : 'off'}" title="Série de jours">${I.fire(24)}${st}</span>
      <span class="stat xp" title="XP total">${I.star(22, 'var(--gold)')}${xpTotal(cur)}</span>
      <span class="stat goal" title="Objectif du jour">${I.ring(today / pr.goal)}${Math.min(today, pr.goal)}/${pr.goal}</span>
    </div></div>
    <div class="wrap">${inner}</div>
    <nav class="tabs"><div class="in">
      ${t('learn', I.home(), 'Apprendre')}${t('review', I.refresh(26), 'Réviser', due)}${t('hadith', I.book(26), 'Hadith')}${t('me', I.chart(), 'Profil')}
    </div></nav>`;
}

/* Écran de choix du profil */
function profiles() {
  $('app').innerHTML = `<div class="wrap" style="padding-bottom:40px">
    <div class="hero" style="margin-top:20px">${emblem(76)}<div class="speech">Assalamu alaykum ! Qui apprend aujourd'hui ?</div></div>
    <div class="who">${state.profiles.map(p => `<button onclick="pickProfile('${p.id}')">${avatar(p, 'lg')}${esc(p.name)}</button>`).join('')}</div>
    ${state.profiles.length ? '' : '<p class="muted center">Aucun profil pour l\'instant. Crée le premier.</p>'}
    <div class="card"><h3>Nouveau profil</h3><div class="form">
      <div class="two"><input id="newname" placeholder="Prénom" maxlength="30"><input id="newage" type="number" min="4" max="99" placeholder="Âge"></div>
      <button class="btn" onclick="addProfile()">Ajouter</button></div></div>
    <button class="btn ghost" onclick="parentSpace()">Espace parent</button>
    <p class="src">${esc(SOURCE_CORAN)}</p></div>`;
}
function addProfile() {
  const n = $('newname').value.trim(), age = parseInt($('newage').value, 10);
  if (!n || !(age > 0)) { toast('Indique un prénom et un âge.'); return; }
  state.profiles.push({ id: uid(), name: n, age, createdAt: Date.now() });
  save(); profiles();
}
function pickProfile(id) { cur = id; localStorage.setItem('ec.cur', id); tab = 'learn'; route(); }
function switchProfile() { cur = null; localStorage.removeItem('ec.cur'); route(); }

/* Onglet Apprendre : le chemin */
function pathState() {
  const ci = data.units.findIndex(u => !isValid(u.s.number));
  return { ci: ci < 0 ? data.units.length : ci };
}
function viewLearn() {
  const { ci } = pathState();
  const last = Math.min(data.units.length, Math.max(ci + 3, 3) + shown);
  const done = data.surahs.filter(s => isValid(s.number)).length;
  let html = `<div class="hero">${emblem(60)}<div class="speech">${ci < data.units.length ? `Étape ${ci + 1} : <b>${esc(data.units[ci].s.name_fr)}</b>. ${done} sourate(s) validée(s) sur 114.` : 'Toutes les étapes sont validées. Continue les révisions.'}</div></div>`;
  for (let ui = 0; ui < last; ui++) html += unitHtml(data.units[ui], ui, ci);
  if (last < data.units.length) html += `<div class="more"><button class="btn ghost" onclick="shown+=5;render()">Voir les étapes suivantes</button></div>`;
  return html;
}
function unitHtml(u, ui, ci) {
  const [c, cd] = COLORS[ui % COLORS.length], n = u.s.number, valid = isValid(n), lockedUnit = ui > ci;
  const ld = valid ? u.lessons : lessonsDone(n);
  let z = 0, nodes = '';
  for (let i = 0; i < u.lessons; i++) {
    const a = i * CHUNK + 1, b = Math.min(u.s.count, a + CHUNK - 1);
    const st = i < ld ? 'done' : (ui === ci && i === ld ? 'cur' : 'lock');
    nodes += `<button class="node ${st}" style="--x:${ZIG[z++ % ZIG.length]}px;--c:${c};--cd:${cd}" onclick="openLesson(${ui},${i})" aria-label="Leçon ${i + 1}, versets ${a} à ${b}">
      ${st === 'cur' ? '<span class="bubble">Commencer</span>' : ''}${st === 'done' ? I.check(34, '#fff') : I.star(34, st === 'lock' ? '#afafaf' : '#fff')}</button>`;
  }
  const chk = valid ? (isDue(n) ? 'due' : 'done') : (ui === ci && ld >= u.lessons ? 'cur' : 'lock');
  nodes += `<button class="node chk ${chk}" style="--x:${ZIG[z % ZIG.length]}px;--c:${c};--cd:${cd}" onclick="openCheck(${ui})" aria-label="Vérificateur de la sourate">
    ${chk === 'cur' ? '<span class="bubble">Vérificateur</span>' : ''}${chk === 'due' ? I.refresh(36, '#fff') : I.trophy(36, chk === 'lock' ? '#afafaf' : '#fff')}</button>`;
  return `<div class="unit" style="background:${lockedUnit ? 'var(--lock-d)' : c}">
      <div class="row"><div><div class="k">Étape ${u.rank} · Juz ${u.s.juz}</div><div class="t">${esc(u.s.name_fr)}</div></div><div class="ar">${esc(u.s.name_ar)}</div></div>
      <div class="k" style="text-transform:none;letter-spacing:0">${u.s.count} versets · ${u.lessons} leçon(s) · ${valid ? 'validée' : ld + ' leçon(s) faite(s)'}</div>
      <div class="acts"><button class="chip" onclick="readSurah(${n})">${I.book(16, '#fff')}Lire</button>${valid ? '' : `<button class="chip" onclick="startQuiz(${n})">${I.trophy(16, '#fff')}Passer le test</button>`}${voiceOn() ? `<button class="chip" onclick="startRecite(${n})">${I.mic(16, '#fff')}Réciter</button>` : ''}</div>
    </div><div class="path">${nodes}</div>`;
}
function openLesson(ui, i) {
  const u = data.units[ui], { ci } = pathState(), n = u.s.number;
  const ld = isValid(n) ? u.lessons : lessonsDone(n);
  if (i < ld || (ui === ci && i === ld)) startLesson(n, i);
  else toast('Leçon verrouillée. Termine d\'abord les précédentes ou passe le test de l\'étape.');
}
function openCheck(ui) {
  const u = data.units[ui], { ci } = pathState(), n = u.s.number;
  if (isValid(n) || (ui === ci && lessonsDone(n) >= u.lessons)) startQuiz(n);
  else toast('Termine les leçons de cette étape, ou utilise « Passer le test » pour avancer.');
}

/* Exercices */
const words = a => {
  const s = a.simple.split(/\s+/).filter(w => /[ء-ي]/.test(w)), n = a.normalise.split(/\s+/).filter(Boolean);
  return s.length === n.length ? s.map((w, i) => ({ s: w, n: n[i] })) : n.map(w => ({ s: w, n: w }));
};
const vtext = a => prefs().uthmani ? a.hafs : a.simple;
function blankEx(a, pool) {
  const w = words(a), i = Math.floor(Math.random() * w.length), ans = w[i];
  const opts = shuffle([ans, ...shuffle(pool.filter(x => x.n !== ans.n)).slice(0, 3)]);
  return { t: 'blank', v: a, w, i, answer: ans.n, opts: opts.map(o => ({ key: o.n, label: o.s })) };
}
function orderEx(a) {
  const w = words(a); if (w.length < 2) return null;
  const len = Math.min(6, w.length), st = Math.floor(Math.random() * (w.length - len + 1));
  const frag = w.slice(st, st + len), target = frag.map(x => x.n).join(' ');
  let bank = shuffle(frag.map((_, i) => i));
  for (let k = 0; k < 6 && bank.map(i => frag[i].n).join(' ') === target; k++) bank = shuffle(bank);
  return { t: 'order', v: a, w, st, frag, bank, answer: target };
}
const head = (a, k = 9) => { const w = vtext(a).split(/\s+/); return w.length > k ? w.slice(0, k).join(' ') + ' …' : w.join(' '); };
function nextEx(prev, a, all) {
  const key = head(a);
  const others = shuffle(all.filter(x => x.normalise !== a.normalise && x.n !== prev.n));
  const opts = [{ key: a.normalise, label: key }], seen = new Set([key]);
  for (const o of others) { const h = head(o); if (!seen.has(h)) { seen.add(h); opts.push({ key: o.normalise, label: h }); } if (opts.length === 3) break; }
  if (opts.length < 2) return null;
  return { t: 'next', v: a, prev, answer: a.normalise, opts: shuffle(opts) };
}
async function loadPool(n) {
  const v = (await getJSON(surahFile(n))).versets;
  const other = (await getJSON(surahFile(n < 114 ? n + 1 : n - 1))).versets;
  return { v, pool: uniq([...v, ...other].flatMap(words)) };
}
async function startLesson(n, idx) {
  let v, pool;
  try { ({ v, pool } = await loadPool(n)); } catch (e) { toast('Sourate introuvable.'); return; }
  const chunk = v.slice(idx * CHUNK, idx * CHUNK + CHUNK), steps = [], rest = [];
  chunk.forEach((a, j) => {
    steps.push({ t: 'learn', v: a }, blankEx(a, pool));
    const o = orderEx(a); if (o) rest.push(o);
    const prev = j ? chunk[j - 1] : v[idx * CHUNK - 1];
    if (prev) { const e = nextEx(prev, a, v); if (e) rest.push(e); }
  });
  const room = Math.max(0, MAX_EX - chunk.length);
  steps.push(...shuffle(rest).slice(0, room));
  if (voiceOn()) chunk.forEach((a, j) => steps.push(reciteEx(a, j ? chunk[j - 1] : v[idx * CHUNK - 1])));
  const total = steps.filter(s => s.t !== 'learn').length;
  L = { kind: 'lesson', n, idx, steps, k: 0, ok: 0, total, retried: new Set(), start: Date.now(), practice: isValid(n) || idx < lessonsDone(n) };
  renderStep();
}
const reciteEx = (a, prev) => ({ t: 'recite', v: a, prev, answer: a.normalise });
// Récitation de mémoire de toute la sourate, verset par verset
async function startRecite(n) {
  if (!SR) { toast('Reconnaissance vocale indisponible sur ce navigateur.'); return; }
  let v;
  try { v = (await getJSON(surahFile(n))).versets; } catch (e) { toast('Sourate introuvable.'); return; }
  const steps = v.map((a, j) => reciteEx(a, v[j - 1]));
  L = { kind: 'recite', n, steps, k: 0, ok: 0, total: steps.length, retried: new Set(), start: Date.now() };
  renderStep();
}
// Vérificateur : 10 versets tirés au hasard, mot manquant à retrouver, seuil 80 %
async function startQuiz(n) {
  let v, pool;
  try { ({ v, pool } = await loadPool(n)); } catch (e) { toast('Sourate introuvable.'); return; }
  const steps = shuffle(v).slice(0, 10).map(a => blankEx(a, pool));
  L = { kind: 'quiz', n, steps, k: 0, ok: 0, total: steps.length, retried: new Set(), start: Date.now() };
  renderStep();
}

function stepBody(st) {
  const s = data.surahs.find(x => x.number === L.n);
  if (st.t === 'learn') {
    return `<div class="prompt">Nouveau verset</div><div class="learn">
      <div class="row"><span class="muted">${esc(s.name_fr)} · verset ${st.v.n}</span><button class="audio" onclick="playVerse(${L.n},${st.v.n})">${I.sound(20, '#fff')}Écouter</button></div>
      <div class="ar big">${esc(vtext(st.v))}</div>
      ${prefs().fr ? `<div class="fr">${esc(st.v.fr)}</div>` : ''}
      <div class="src">${esc(SOURCE_CORAN)}</div></div>`;
  }
  if (st.t === 'blank') {
    const from = Math.max(0, st.i - 7), to = Math.min(st.w.length, st.i + 8);
    const sentence = (from ? '… ' : '') + st.w.slice(from, to).map((x, j) => from + j === st.i ? '<span class="blank">&nbsp;</span>' : esc(x.s)).join(' ') + (to < st.w.length ? ' …' : '');
    return `<div class="prompt">${L.kind === 'quiz' ? 'Vérificateur : ' : ''}Complète le verset</div>
      <div class="muted">${esc(s.name_fr)} · verset ${st.v.n}</div><div class="ar">${sentence}</div>
      <div class="opts two">${st.opts.map((o, i) => `<button class="opt" data-v="${esc(o.key)}" onclick="choose(${i})">${esc(o.label)}</button>`).join('')}</div>`;
  }
  if (st.t === 'order') {
    const before = st.w.slice(Math.max(0, st.st - 4), st.st).map(x => x.s).join(' ');
    return `<div class="prompt">Remets les mots dans l'ordre</div>
      <div class="muted">${esc(s.name_fr)} · verset ${st.v.n}${st.frag.length < st.w.length ? ' (extrait)' : ''}</div>
      ${before ? `<div class="ar muted" style="font-size:20px">${st.st > 4 ? '… ' : ''}${esc(before)}</div>` : ''}
      ${prefs().fr && st.frag.length === st.w.length ? `<p class="muted">${esc(st.v.fr)}</p>` : ''}
      <div class="answer-line" id="line"></div><div class="bank" id="bank"></div>`;
  }
  if (st.t === 'recite') {
    return `<div class="prompt">Récite le verset ${st.v.n}</div>
      <div class="muted">${esc(s.name_fr)} · ${st.prev ? 'après :' : 'début de la sourate'}</div>${st.prev ? `<div class="ar muted" style="font-size:22px">${esc(head(st.prev, 10))}</div>` : ''}
      <div id="peek">${L.peek ? peekHtml() : `<button class="link" onclick="L.peek=true;$('peek').innerHTML=peekHtml()">Voir le verset</button>`}</div>
      <div class="mic-wrap"><button class="mic" id="mic" onclick="micToggle()" aria-label="Parler">${I.mic(44, '#fff')}</button><div class="muted" id="micmsg">Touche le micro, récite, puis touche à nouveau.</div></div>
      <div class="ar heard" id="heard" dir="rtl"></div>`;
  }
  return `<div class="prompt">Quel verset vient ensuite ?</div>
    <div class="muted">${esc(s.name_fr)} · après le verset ${st.prev.n}</div><div class="ar">${esc(head(st.prev, 14))}</div>
    <div class="opts">${st.opts.map((o, i) => `<button class="opt long" data-v="${esc(o.key)}" onclick="choose(${i})">${esc(o.label)}</button>`).join('')}</div>`;
}
const peekHtml = () => `<div class="ar">${esc(vtext(L.steps[L.k].v))}</div>`;
function renderStep() {
  micStop(); const st = L.steps[L.k]; L.sel = null; L.checked = false; L.order = []; L.heard = null; L.peek = false;
  const pct = Math.round(100 * L.k / L.steps.length);
  $('app').innerHTML = `<div class="lesson">
    <div class="lhead"><button class="x" onclick="quitLesson()" aria-label="Quitter">${I.x()}</button><div class="prog"><i style="width:${pct}%"></i></div></div>
    <div class="lbody">${stepBody(st)}</div><div class="lfoot" id="foot"></div></div>`;
  if (st.t === 'order') renderOrder();
  foot(st.t === 'learn' ? `<button class="btn" id="cta" onclick="nextStep()">Continuer</button>` : `<button class="btn" id="cta" onclick="checkStep()" disabled>Vérifier</button>`
    + (st.t === 'recite' ? `<button class="link" style="width:100%;margin-top:8px" onclick="skipVoice()">Je ne peux pas parler maintenant</button>` : ''));
  window.scrollTo(0, 0);
}
function foot(html, cls = '') { const f = $('foot'); f.className = 'lfoot ' + cls; f.innerHTML = `<div class="in">${html}</div>`; }
function choose(i) {
  if (L.checked) return;
  L.sel = i;
  document.querySelectorAll('.opt').forEach((b, j) => b.classList.toggle('sel', j === i));
  $('cta').disabled = false;
}
function renderOrder() {
  const st = L.steps[L.k];
  $('line').innerHTML = L.order.map((bi, j) => `<button class="tile" onclick="unplace(${j})">${esc(st.frag[st.bank[bi]].s)}</button>`).join('');
  $('bank').innerHTML = st.bank.map((fi, bi) => `<button class="tile ${L.order.includes(bi) ? 'used' : ''}" onclick="place(${bi})" ${L.order.includes(bi) ? 'disabled' : ''}>${esc(st.frag[fi].s)}</button>`).join('');
  const c = $('cta'); if (c) c.disabled = L.order.length !== st.frag.length;
}
function place(bi) { if (L.checked || L.order.includes(bi)) return; L.order.push(bi); renderOrder(); }
function unplace(j) { if (L.checked) return; L.order.splice(j, 1); renderOrder(); }
const PRAISE = ['Excellent !', 'Bravo !', 'Très bien !', 'Parfait !', 'Bien joué !'];
function checkStep() {
  const st = L.steps[L.k]; if (L.checked) return;
  let given, rec;
  if (st.t === 'recite') { if (!L.heard) return; micStop(); rec = L.heard.map(h => compareRecitation(st.answer, h)).sort((a, b) => b.score - a.score)[0]; given = rec.score >= PASS ? st.answer : ''; }
  else if (st.t === 'order') given = L.order.map(bi => st.frag[st.bank[bi]].n).join(' ');
  else { if (L.sel === null) return; given = st.opts[L.sel].key; }
  const good = given === st.answer;
  L.checked = true;
  if (st.t !== 'order') document.querySelectorAll('.opt').forEach((b, j) => { b.disabled = true; if (st.opts[j].key === st.answer) b.classList.add('good'); else if (j === L.sel) b.classList.add('wrong'); });
  if (!L.retried.has(st)) { if (good) L.ok++; }
  if (!good && L.kind === 'lesson' && !L.retried.has(st)) {
    // L'exercice raté revient en fin de leçon, une fois
    const again = Object.assign({}, st, st.opts ? { opts: shuffle(st.opts) } : st.bank ? { bank: shuffle(st.bank) } : {});
    L.retried.add(again); L.steps.push(again);
  }
  let sol = '';
  if (!good) {
    const txt = st.t === 'recite' ? '' : st.t === 'order' ? esc(st.frag.map(x => x.s).join(' ')) : st.t === 'next' ? esc(head(st.v, 14)) : st.w.map((x, j) => j === st.i ? `<u>${esc(x.s)}</u>` : esc(x.s)).slice(Math.max(0, st.i - 7), st.i + 8).join(' ');
    sol = `<div class="sol">Bonne réponse :<div class="ar">${txt}</div></div>`;
  }
  if (rec) {
    // Mots entendus en vert, mots manquants en rouge
    const ws = words(st.v), lab = ws.length === rec.marks.length ? ws.map(x => x.s) : arNorm(st.answer);
    sol = `<div class="sol">${Math.round(rec.score * 100)} % des mots reconnus. Le tajwid n'est pas évalué.<div class="ar">${lab.map((w, i) => `<span class="${rec.marks[i] ? 'w-ok' : 'w-ko'}">${esc(w)}</span>`).join(' ')}</div></div>`;
  }
  foot(`<div class="fb"><span class="ico">${good ? I.check(30, 'var(--green)') : I.x(26, 'var(--red)')}</span><div>${good ? pick1(PRAISE) : 'Pas tout à fait.'}${sol}</div></div>
    <button class="btn ${good ? '' : 'red'}" id="cta" onclick="nextStep()">Continuer</button>`, good ? 'ok' : 'ko');
}
function skipVoice() {
  // Retire les récitations restantes de la séance
  micStop();
  const rest = L.steps.slice(L.k).filter(s => s.t === 'recite');
  L.total -= rest.filter(s => !L.retried.has(s)).length;
  L.steps = L.steps.slice(0, L.k).concat(L.steps.slice(L.k).filter(s => s.t !== 'recite'));
  L.k < L.steps.length ? renderStep() : finish();
}
function nextStep() { L.k++; L.k < L.steps.length ? renderStep() : finish(); }
function quitLesson() { micStop(); if (confirm('Quitter ? La progression de cette séance sera perdue.')) { L = null; render(); } }

let rec = null;
function micStop() { if (rec) { rec.onend = rec.onresult = rec.onerror = null; try { rec.abort(); } catch (e) {} rec = null; const m = $('mic'); if (m) m.classList.remove('on'); } }
function micToggle() {
  if (!L || L.checked) return;
  if (rec) { rec.stop(); return; }
  if (!SR) { toast('Reconnaissance vocale indisponible sur ce navigateur.'); return; }
  const r = rec = new SR();
  r.lang = 'ar-SA'; r.continuous = true; r.interimResults = true; r.maxAlternatives = 3;
  let segs = [], err = null;
  r.onresult = e => {
    segs = [...e.results].map(x => [...x].map(a => a.transcript));
    $('heard').textContent = segs.map(x => x[0]).join(' ');
  };
  r.onerror = e => { err = e.error; };
  r.onend = () => {
    rec = null; $('mic').classList.remove('on');
    const msgs = { 'not-allowed': 'Micro refusé. Autorise le micro pour ce site dans le navigateur.', 'service-not-allowed': 'Micro refusé. Autorise le micro pour ce site dans le navigateur.', network: 'La reconnaissance vocale demande une connexion internet.', 'language-not-supported': 'Ce navigateur ne reconnaît pas l\'arabe.', 'audio-capture': 'Aucun micro détecté.' };
    if (!segs.length) { $('micmsg').textContent = msgs[err] || 'Rien entendu. Touche le micro et réessaie.'; return; }
    // Une transcription par rang d'alternative ; la meilleure est retenue à la vérification
    const n = Math.max(...segs.map(x => x.length));
    L.heard = [...Array(n)].map((_, i) => segs.map(x => x[i] || x[0]).join(' '));
    $('micmsg').textContent = 'Touche « Vérifier », ou le micro pour recommencer.';
    $('cta').disabled = false;
  };
  try { r.start(); } catch (e) { rec = null; toast('Impossible de démarrer le micro.'); return; }
  L.heard = null; $('cta').disabled = true; $('heard').textContent = '';
  $('mic').classList.add('on'); $('micmsg').textContent = 'J\'écoute… touche à nouveau quand tu as fini.';
}

let audioEl = null;
function playVerse(n, v) {
  const a = data.audio, r = a && (a.recitateurs.find(x => x.id === prefs().reciter) || a.recitateurs[0]);
  if (!r) { toast('Audio indisponible.'); return; }
  const url = a.modele_url.replace('{dossier}', r.dossier).replace('{sourate:3}', String(n).padStart(3, '0')).replace('{verset:3}', String(v).padStart(3, '0'));
  if (audioEl) audioEl.pause();
  audioEl = new Audio(url);
  audioEl.play().catch(() => toast('Audio indisponible (connexion ou serveur audio).'));
}

/* Fin de séance */
function finish() {
  const n = L.n, mins = Math.max(1, Math.round((Date.now() - L.start) / 60000)), acc = L.total ? L.ok / L.total : 1;
  const firstToday = !activeToday(cur), goal = prefs().goal, before = xpOn(cur, dayKey(Date.now()));
  let xp, title, msg = '', pass = true;
  if (L.kind === 'lesson') {
    xp = L.practice ? XP.practice : XP.lesson + (acc === 1 ? XP.perfect : 0);
    if (!L.practice) { (state.lessons[cur] = state.lessons[cur] || {})[n] = Math.max(lessonsDone(n), L.idx + 1); }
    state.log.push({ id: uid(), profile: cur, ts: Date.now(), type: 'lesson', surah: n, lesson: L.idx + 1, score: Math.round(acc * 100), xp, minutes: mins });
    title = L.practice ? 'Entraînement terminé !' : 'Leçon terminée !';
  } else if (L.kind === 'recite') {
    xp = acc >= PASS ? XP.recite : XP.practice;
    state.log.push({ id: uid(), profile: cur, ts: Date.now(), type: 'recite', surah: n, score: Math.round(acc * 100), xp, minutes: mins });
    title = 'Récitation terminée !';
    msg = 'Seuls les mots sont vérifiés, pas le tajwid. Fais aussi écouter ta récitation à un enseignant.';
  } else {
    const score = acc; pass = score >= PASS;
    const m = memo(); const e = m[n] = m[n] || { validated: false, box: 0, due: 0 };
    if (pass) { e.validated = true; e.box = Math.min(e.box + 1, INTERVALS.length); e.validatedAt = e.validatedAt || Date.now(); }
    else e.box = 1;
    e.due = Date.now() + INTERVALS[Math.max(0, e.box - 1)] * DAY;
    xp = pass ? XP.quizPass : XP.quizTry;
    state.log.push({ id: uid(), profile: cur, ts: Date.now(), type: 'quiz', surah: n, score: Math.round(score * 100), pass, xp, minutes: mins });
    title = pass ? 'Sourate validée !' : 'Pas encore validée';
    msg = pass ? `Prochaine révision dans ${INTERVALS[e.box - 1]} jour(s).` : `Seuil de ${PASS * 100} % non atteint. Relis la sourate et recommence demain.`;
  }
  save();
  const s = data.surahs.find(x => x.number === n), st = streak(cur), reached = before < goal && before + xp >= goal;
  const box = (b, h, v) => `<div class="box" style="--b:${b}"><div class="h">${h}</div><div class="v">${v}</div></div>`;
  L = null;
  $('app').innerHTML = `<div class="end">${emblem(110, pass ? 'joy' : '')}
    <h2 style="${pass ? '' : 'color:var(--orange)'}">${title}</h2><p class="muted">${esc(s.name_fr)}</p>${msg ? `<p>${esc(msg)}</p>` : ''}
    <div class="boxes">${box('var(--gold)', 'XP gagnés', I.star(20, 'var(--gold)') + '+' + xp)}${box('var(--green)', 'Précision', Math.round(acc * 100) + ' %')}${box('var(--blue)', 'Temps', mins + ' min')}</div>
    ${firstToday ? `<div class="card" style="width:100%"><div class="row"><span style="color:var(--orange)">${I.fire(48)}</span><div style="flex:1;text-align:left"><b style="font-size:20px">Série : ${st} jour${st > 1 ? 's' : ''}</b><div class="muted">Reviens demain pour la prolonger.</div></div></div></div>` : ''}
    ${reached ? `<div class="card" style="width:100%"><b>Objectif du jour atteint (${goal} XP).</b></div>` : ''}
    </div><div class="lfoot"><div class="in">${pass ? '' : `<button class="btn ghost" onclick="readSurah(${n})">Relire la sourate</button>`}<button class="btn" onclick="tab='learn';render()">Continuer</button></div></div>`;
}

/* Lecture d'une sourate complète */
let readStart = 0;
async function readSurah(n) {
  const s = data.surahs.find(x => x.number === n), pr = prefs();
  let v;
  try { v = (await getJSON(surahFile(n))).versets; } catch (e) { toast('Sourate introuvable.'); return; }
  readStart = readStart || Date.now();
  L = null;
  $('app').innerHTML = `<div class="lesson"><div class="lhead"><button class="x" onclick="endRead(${n})" aria-label="Retour">${I.back(28)}</button><div style="flex:1"><b>${esc(s.name_fr)}</b> <span class="muted">${s.count} versets</span></div><span class="ar" style="font-size:22px">${esc(s.name_ar)}</span></div>
    <div class="lbody" style="padding-bottom:120px">
      <label class="switch"><input type="checkbox" ${pr.fr ? 'checked' : ''} onchange="prefs().fr=this.checked;save();readSurah(${n})"> Traduction</label>
      <label class="switch"><input type="checkbox" ${pr.uthmani ? 'checked' : ''} onchange="prefs().uthmani=this.checked;save();readSurah(${n})"> Texte uthmani (police Coran conseillée)</label>
      ${v.map(a => `<div class="item" style="display:block"><div class="row"><span class="vnum">${a.n}</span><button class="link" onclick="playVerse(${n},${a.n})" aria-label="Écouter le verset ${a.n}">${I.sound(22)}</button></div>
        <div class="ar">${esc(vtext(a))}</div>${pr.fr ? `<div class="muted">${esc(a.fr)}</div>` : ''}</div>`).join('')}
      <p class="src">${esc(SOURCE_CORAN)}</p></div>
    <div class="lfoot"><div class="in"><button class="btn" onclick="endRead(${n})">Terminer la lecture</button></div></div></div>`;
}
function endRead(n) {
  const mins = Math.max(1, Math.round((Date.now() - readStart) / 60000));
  state.log.push({ id: uid(), profile: cur, ts: Date.now(), type: 'study', surah: n, minutes: mins, xp: 0 });
  readStart = 0; save(); render();
}

/* Onglet Réviser */
function viewReview() {
  const due = data.surahs.filter(s => isDue(s.number));
  const later = data.surahs.filter(s => isValid(s.number) && !isDue(s.number)).sort((a, b) => memo()[a.number].due - memo()[b.number].due);
  const fmt = t => new Date(t).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });
  return `<h2>Révisions</h2>
    ${due.length ? `<div class="card"><h3>À réviser aujourd'hui</h3>${due.map(s => `<div class="item"><span style="color:var(--orange)">${I.refresh(26)}</span><div class="grow"><b>${esc(s.name_fr)}</b><div class="muted">${s.count} versets</div></div><button class="btn orange" onclick="startQuiz(${s.number})">Réviser</button></div>`).join('')}</div>`
      : `<div class="hero">${emblem(60)}<div class="speech">Rien à réviser aujourd'hui. Les sourates validées reviennent ici au bon moment (1, 3, 7, 14 puis 30 jours).</div></div>`}
    ${later.length ? `<div class="card"><h3>Prochaines révisions</h3>${later.map(s => `<div class="item"><span style="color:var(--gold)">${I.check(24)}</span><div class="grow"><b>${esc(s.name_fr)}</b></div><span class="muted">${fmt(memo()[s.number].due)}</span></div>`).join('')}</div>` : ''}
    <div class="card"><h3>Les 114 sourates</h3><p class="muted">Lecture libre, avec audio et traduction.</p>
      ${data.surahs.map(s => `<div class="item"><span class="vnum">${s.number}</span><div class="grow"><b>${esc(s.name_fr)}</b> <span class="muted">${isValid(s.number) ? 'validée' : lessonsDone(s.number) ? 'en cours' : ''}</span></div><button class="btn ghost" onclick="readSurah(${s.number})">Lire</button></div>`).join('')}</div>`;
}

/* Onglet Hadith */
function dailyHadith() {
  const p = me(), list = data.hadiths, now = new Date();
  const doy = Math.floor((now - new Date(now.getFullYear(), 0, 0)) / DAY);
  for (let k = 0; k < list.length; k++) {
    const h = list[(doy + k) % list.length];
    if (!h.accompagnement || (p && p.age >= 14)) return h;
  }
  return list[doy % list.length];
}
const hadithReadToday = () => mine(cur).some(l => l.type === 'hadith' && dayKey(l.ts) === dayKey(Date.now()));
function viewHadith() {
  const h = dailyHadith();
  return `<h2>Hadith du jour</h2><div class="card">
      <div class="ar">${esc(h.ar)}</div><p>${esc(h.fr)}</p>
      <p class="src">Source : ${esc(h.recueil)}, n° ${esc(h.numero)} · ${/^q/.test(h.type) ? 'hadith qoudsi' : 'hadith marfou\''} · grade : ${esc(h.grade.valeur)}${h.grade.par ? ' (' + esc(h.grade.par) + ')' : ''}</p></div>
    ${hadithReadToday() ? `<div class="card row"><span style="color:var(--green)">${I.check(28)}</span><b style="flex:1">Lu aujourd'hui. Un nouveau hadith arrive demain.</b></div>` : `<button class="btn" onclick="readHadith()">J'ai lu le hadith (+${XP.hadith} XP)</button>`}
    <p class="src">Hadiths sahih, marfou' ou qoudsi, relus pour l'alignement arabe et français. Pour toute question de pratique, se référer à un savant malékite.</p>`;
}
function readHadith() {
  if (hadithReadToday()) return;
  state.log.push({ id: uid(), profile: cur, ts: Date.now(), type: 'hadith', hadith: dailyHadith().id, xp: XP.hadith, minutes: 1 });
  save(); render(); toast(`+${XP.hadith} XP`);
}

/* Onglet Profil */
function viewMe() {
  const p = me(), pr = prefs(), done = data.surahs.filter(s => isValid(s.number)).length;
  const lessons = Object.values(state.lessons[cur] || {}).reduce((t, x) => t + x, 0);
  const days = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); return d; });
  const xs = days.map(d => xpOn(cur, dayKey(d))), max = Math.max(pr.goal, ...xs);
  const stat = (ico, v, l) => `<div class="tile-stat">${ico}<div><b>${v}</b><span class="muted">${l}</span></div></div>`;
  const reciters = (data.audio && data.audio.recitateurs) || [];
  return `<div class="row" style="justify-content:flex-start;gap:16px;margin:8px 0 18px">${avatar(p, 'lg')}<div><h2 style="margin:0">${esc(p.name)}</h2><span class="muted">${p.age} ans</span></div></div>
    <div class="grid2">${stat(`<span style="color:var(--orange)">${I.fire(28)}</span>`, streak(cur), 'jours de série')}${stat(I.star(28, 'var(--gold)'), xpTotal(cur), 'XP au total')}
      ${stat(`<span style="color:var(--green)">${I.trophy(28)}</span>`, done + '/114', 'sourates validées')}${stat(`<span style="color:var(--blue)">${I.book(28)}</span>`, lessons, 'leçons faites')}</div>
    <div class="card"><h3>7 derniers jours</h3><div class="week">${xs.map((x, i) => `<div class="d"><span>${x}</span><div class="b ${x >= pr.goal ? 'hit' : ''}" style="height:${Math.round(70 * x / max)}%"></div><span>${days[i].toLocaleDateString('fr-FR', { weekday: 'narrow' })}</span></div>`).join('')}</div></div>
    <div class="card"><h3>Objectif quotidien</h3><div class="goals">${GOALS.map(([g, l]) => `<button class="goal-opt ${pr.goal === g ? 'on' : ''}" onclick="prefs().goal=${g};save();render()"><span>${l}</span><span>${g} XP par jour</span></button>`).join('')}</div>
      <p class="muted" style="margin-top:10px">Une leçon rapporte ${XP.lesson} XP (+${XP.perfect} sans faute), un vérificateur réussi ${XP.quizPass} XP, le hadith du jour ${XP.hadith} XP.</p></div>
    <div class="card"><h3>Réglages</h3>
      <label class="switch"><input type="checkbox" ${pr.fr ? 'checked' : ''} onchange="prefs().fr=this.checked;save()"> Afficher la traduction</label>
      <label class="switch"><input type="checkbox" ${pr.uthmani ? 'checked' : ''} onchange="prefs().uthmani=this.checked;save()"> Texte uthmani</label>
      ${SR ? `<label class="switch"><input type="checkbox" ${pr.voice ? 'checked' : ''} onchange="prefs().voice=this.checked;save();render()"> Réciter à voix haute (micro)</label>
        <p class="muted small">Ta voix est envoyée au service de reconnaissance du navigateur (Google sur Chrome, Apple sur Safari) pour être transcrite. Seuls les mots sont vérifiés, pas le tajwid.</p>`
        : '<p class="muted small">Récitation à voix haute : non disponible sur ce navigateur. Essaie Chrome sur Android ou Safari sur iPhone.</p>'}
      ${reciters.length ? `<p class="muted" style="margin:10px 0 6px">Récitateur</p><select onchange="prefs().reciter=this.value;save()">${reciters.map(r => `<option value="${esc(r.id)}" ${pr.reciter === r.id ? 'selected' : ''}>${esc(r.nom)}</option>`).join('')}</select>` : ''}</div>
    <button class="btn ghost" onclick="parentSpace()">Espace parent</button>
    <button class="btn ghost" onclick="switchProfile()">Changer de profil</button>
    <p class="src">${esc(SOURCE_CORAN)}</p>`;
}

/* Espace parent */
async function sha(s) {
  const b = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, '0')).join('');
}
function parentBack() { cur ? render() : profiles(); }
function parentSpace() {
  L = null;
  $('app').innerHTML = `<div class="wrap" style="padding-bottom:40px"><div class="row" style="justify-content:flex-start"><button class="x" onclick="parentBack()" aria-label="Retour">${I.back(28)}</button><h2 style="margin:0">Espace parent</h2></div>
    <div class="card center" style="margin-top:16px"><div style="color:var(--blue);display:flex;justify-content:center;margin-bottom:8px">${I.shield(48)}</div>
    <p class="muted">${state.pin ? 'Entre le code.' : 'Choisis un code à 4 chiffres au minimum.'}</p>
    <div class="form"><input id="pin" type="password" inputmode="numeric" maxlength="12"><button class="btn blue" onclick="unlock()">Valider</button></div><p id="msg" class="bad"></p></div></div>`;
}
async function unlock() {
  const v = $('pin').value;
  if (v.length < 4) { $('msg').textContent = 'Code trop court.'; return; }
  const h = await sha(v);
  if (!state.pin) { state.pin = h; save(); }
  else if (state.pin !== h) { $('msg').textContent = 'Code incorrect.'; return; }
  feed();
}
function logLine(l) {
  const s = data.surahs.find(x => x.number === l.surah), name = esc(s ? s.name_fr : l.surah || '');
  const what = l.type === 'quiz' ? `Vérificateur ${l.score} %${l.pass ? ' (validé)' : ' (échec)'} · ${name}`
    : l.type === 'lesson' ? `Leçon ${l.lesson} · ${name} · ${l.score} %`
    : l.type === 'recite' ? `Récitation · ${name} · ${l.score} % des mots`
    : l.type === 'hadith' ? 'Hadith du jour lu' : `Lecture · ${name}`;
  return `<div class="muted small">${new Date(l.ts).toLocaleDateString('fr-FR')} · ${what} · ${l.minutes || 0} min${l.xp ? ' · +' + l.xp + ' XP' : ''}</div>`;
}
function feed() {
  const now = Date.now();
  const cards = state.profiles.map(p => {
    const all = mine(p.id).sort((a, b) => b.ts - a.ts);
    const week = all.filter(l => now - l.ts < 7 * DAY);
    const days = new Set(week.map(l => dayKey(l.ts))).size;
    const mins = week.reduce((t, l) => t + (l.minutes || 0), 0);
    const quizzes = all.filter(l => l.type === 'quiz');
    const val = Object.values(state.memo[p.id] || {}).filter(m => m.validated).length;
    return `<div class="card"><div class="row" style="justify-content:flex-start">${avatar(p)}<b style="flex:1">${esc(p.name)}</b><span class="muted">${val} sourate(s) validée(s)</span></div>
      <div class="grid2" style="margin:12px 0"><div class="tile-stat"><span style="color:var(--orange)">${I.fire(24)}</span><div><b>${streak(p.id)}</b><span class="muted">jours de série</span></div></div>
      <div class="tile-stat">${I.star(24, 'var(--gold)')}<div><b>${week.reduce((t, l) => t + (l.xp || 0), 0)}</b><span class="muted">XP sur 7 jours</span></div></div></div>
      <p>7 derniers jours : <b>${days}</b> jour(s) actif(s) sur 7, <b>${mins}</b> min.</p>
      ${all.slice(0, 8).map(logLine).join('') || '<div class="muted">Aucune activité.</div>'}
      ${quizzes.length ? `<p class="muted" style="margin-top:8px">Moyenne des vérifications : ${Math.round(quizzes.reduce((t, l) => t + l.score, 0) / quizzes.length)} %</p>` : ''}</div>`;
  }).join('') || '<p>Aucun profil.</p>';
  $('app').innerHTML = `<div class="wrap" style="padding-bottom:40px"><div class="row" style="justify-content:flex-start"><button class="x" onclick="parentBack()" aria-label="Retour">${I.back(28)}</button><h2 style="margin:0">Suivi des profils</h2></div><div style="margin-top:16px">${cards}</div>
    <p class="muted">Les données sont stockées sur cet appareil. Le suivi à distance arrive avec la synchronisation en ligne.</p></div>`;
}
boot();
