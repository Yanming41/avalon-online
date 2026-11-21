// 扔鸡蛋：所有人看到飞行动画，被砸的人和投屏大屏会播放音效
const THROW = [
  { k: 'egg', n: '鸡蛋', e: '🥚', splat: 'splat_egg', se: '🍳' },
  { k: 'tomato', n: '番茄', e: '🍅', splat: 'splat_tomato', se: '💥' },
  { k: 'cabbage', n: '烂菜叶', e: '🥬', splat: null, se: '🤢' },
  { k: 'shoe', n: '臭鞋', e: '🥿', splat: null, se: '💫' },
  { k: 'rose', n: '玫瑰', e: '🌹', splat: 'petals', se: '💖' },
  { k: 'goblet', n: '敬酒', e: '🍷', splat: null, se: '🥂' },
];
const TH = Object.fromEntries(THROW.map((t) => [t.k, t]));
// 图片加载失败时退回 emoji
function thImgFail(el) { const s = document.createElement('span'); s.className = el.className + ' emo'; s.textContent = el.dataset.e; el.replaceWith(s); }
const thImg = (name, emo, cls) => `<img class="${cls}" src="img/throw/${name}.webp" alt="" data-e="${emo}" onerror="thImgFail(this)">`;
// 投掷模式：点右下角按钮进入（按钮发光、上方出现投掷物条），这时点任意头像直接扔；再点按钮退出，恢复标记/选人
let throwOpen = false, throwItem = localStorage.throwItem || 'egg';

function canThrow() {
  if (!S || !S.players || !S.players.length) return false;
  if (typeof WATCH !== 'undefined' && WATCH) return false;
  return S.players.some((p) => p.id === S.me) || !!(typeof SPEC !== 'undefined' && SPEC);
}
function throwUI() {
  let fab = document.getElementById('throwFab');
  if (!fab) {
    fab = document.createElement('div'); fab.id = 'throwFab'; fab.title = '扔东西';
    fab.onclick = (e) => { e.stopPropagation(); throwOpen = !throwOpen; if (throwOpen) unlockAudio(); throwUI(); };
    document.body.appendChild(fab);
  }
  const ok = canThrow();
  fab.style.display = ok ? '' : 'none';
  if (!ok) throwOpen = false;
  const t = TH[throwItem] || THROW[0];
  if (fab.dataset.k !== t.k + throwOpen) { fab.dataset.k = t.k + throwOpen; fab.innerHTML = throwOpen ? '<span class="th-x">✕</span>' : thImg(t.k, t.e, 'th-ic'); }
  fab.classList.toggle('armed', throwOpen);
  document.body.classList.toggle('throwing', throwOpen);
  throwPanel();
}
function throwPanel() {
  let pn = document.getElementById('throwPanel');
  if (!throwOpen || !canThrow()) { if (pn) pn.remove(); return; }
  if (!pn) { pn = document.createElement('div'); pn.id = 'throwPanel'; pn.onclick = (e) => e.stopPropagation(); document.body.appendChild(pn); }
  pn.innerHTML = `<div class="th-who">点头像直接扔</div><div class="th-items">${THROW.map((t) => `<button class="th-it ${t.k === throwItem ? 'on' : ''}" onclick="pickThrow('${t.k}')">${thImg(t.k, t.e, 'th-ic')}<span>${t.n}</span></button>`).join('')}</div>`;
}
function pickThrow(k) { throwItem = k; localStorage.throwItem = k; throwUI(); }
// 投掷模式下拦截头像点击（捕获阶段，先于标记/选人）
function thTarget(e) { return throwOpen && e.target.closest && e.target.closest('[data-pid]'); }
document.addEventListener('click', (e) => { const el = thTarget(e); if (!el) return; e.stopPropagation(); e.preventDefault(); doThrow(el.dataset.pid); }, true);
['mousedown', 'touchstart'].forEach((ev) => document.addEventListener(ev, (e) => { if (thTarget(e)) e.stopPropagation(); }, { capture: true, passive: true }));
function doThrow(to) {
  const now = Date.now(); if (now - (window._lastThrow || 0) < 1500) return toast('手速太快了，歇一下');
  window._lastThrow = now; unlockAudio(); send({ t: 'throw', to, item: throwItem });
}

// 找到某个玩家在屏幕上的位置（圆桌座位 / 列表），找不到返回 null
function pidRect(id) {
  const els = [...document.querySelectorAll(`[data-pid="${id}"] .seat-av, [data-pid="${id}"] .av, [data-pid="${id}"]`)];
  const el = els.find((x) => x.getBoundingClientRect().width > 0);
  if (!el) return null;
  const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
}
function fxLayer() { let l = document.getElementById('throwfx'); if (!l) { l = document.createElement('div'); l.id = 'throwfx'; document.body.appendChild(l); } return l; }
function onThrow(m) {
  const t = TH[m.item]; if (!t || !S) return;
  if (fxLayer().childElementCount > 40) return; // 疯狂扔时限制同时在屏的特效数量，防卡
  const W = innerWidth, H = innerHeight;
  const dst = pidRect(m.to) || { x: W / 2, y: H / 2, w: 60 };
  let src = m.from && m.from !== m.to && pidRect(m.from);
  if (!src) src = { x: Math.random() < 0.5 ? -40 : W + 40, y: H * (0.55 + Math.random() * 0.4) };
  const el = document.createElement('div');
  el.className = 'th-fly'; el.innerHTML = thImg(t.k, t.e, 'th-ic');
  fxLayer().appendChild(el);
  const dx = dst.x - src.x, dy = dst.y - src.y, dist = Math.hypot(dx, dy), arc = Math.min(160, dist * 0.35) + 40;
  const dur = 550 + Math.min(500, dist * 0.6), spin = (Math.random() < 0.5 ? -1 : 1) * (t.k === 'rose' ? 180 : 720);
  const frames = [];
  for (let i = 0; i <= 16; i++) {
    const f = i / 16;
    frames.push({ transform: `translate(${src.x + dx * f}px, ${src.y + dy * f - arc * 4 * f * (1 - f)}px) translate(-50%,-50%) rotate(${spin * f}deg) scale(${1.3 - 0.4 * f})` });
  }
  el.animate(frames, { duration: dur, easing: 'linear', fill: 'forwards' }).onfinish = () => { el.remove(); impact(t, pidRect(m.to) || dst, m); };
  const who = m.from ? P(m.from).name : '观众 ' + (m.fromName || '');
  if (m.to === S.me) setTimeout(() => toast(`${who} 朝你扔了${t.n}！`, t.k === 'rose' || t.k === 'goblet'), dur);
}
function impact(t, dst, m) {
  const s = document.createElement('div');
  s.className = 'th-stain'; s.style.left = dst.x + 'px'; s.style.top = dst.y + 'px';
  s.style.setProperty('--w', Math.min(150, Math.max(70, dst.w * 1.3)) + 'px');
  s.innerHTML = t.splat ? thImg(t.splat, t.se, 'th-sp') : `<span class="th-sp emo">${t.se}</span>`;
  fxLayer().appendChild(s);
  const seatEl = document.querySelector(`[data-pid="${m.to}"]`);
  if (seatEl) { seatEl.classList.remove('th-hit'); void seatEl.offsetWidth; seatEl.classList.add('th-hit'); }
  setTimeout(() => s.classList.add('out'), 3500); setTimeout(() => s.remove(), 4300);
  if (m.to === S.me || (typeof WATCH !== 'undefined' && WATCH)) {
    throwSound(t.k);
    if (m.to === S.me) vibrate(t.k === 'shoe' ? [120, 40, 120] : 120);
  }
}

// ---------- 合成音效（Web Audio，不用音频文件）----------
function noise(start, dur, vol, f0, f1, type) {
  const a = actx, len = Math.ceil(a.sampleRate * dur), b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
  const src = a.createBufferSource(), flt = a.createBiquadFilter(), g = a.createGain();
  src.buffer = b; flt.type = type || 'lowpass';
  flt.frequency.setValueAtTime(f0, a.currentTime + start); flt.frequency.exponentialRampToValueAtTime(f1, a.currentTime + start + dur);
  g.gain.value = vol; src.connect(flt).connect(g).connect(a.destination); src.start(a.currentTime + start);
}
function sweep(f0, f1, start, dur, vol, type) {
  const a = actx, o = a.createOscillator(), g = a.createGain(); o.type = type || 'sine';
  o.frequency.setValueAtTime(f0, a.currentTime + start); o.frequency.exponentialRampToValueAtTime(f1, a.currentTime + start + dur);
  g.gain.setValueAtTime(vol, a.currentTime + start); g.gain.exponentialRampToValueAtTime(0.001, a.currentTime + start + dur);
  o.connect(g).connect(a.destination); o.start(a.currentTime + start); o.stop(a.currentTime + start + dur);
}
function harpNote(freq, start, dur, vol) {
  const a = actx, t0 = a.currentTime + start;
  const flt = a.createBiquadFilter(), g = a.createGain();
  flt.type = 'lowpass'; flt.frequency.setValueAtTime(Math.min(4800, freq * 4.5), t0);
  flt.frequency.exponentialRampToValueAtTime(Math.max(900, freq * 1.6), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.014);
  g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
  flt.connect(g).connect(a.destination);
  [['triangle', freq, 0.7], ['sine', freq * 1.003, 0.45], ['sine', freq * 2, 0.18]].forEach(([type, f, w]) => {
    const o = a.createOscillator(), og = a.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t0); og.gain.value = w;
    o.connect(og).connect(flt); o.start(t0); o.stop(t0 + dur + 0.02);
  });
}
function glassClink(baseFreq, start, dur, vol) {
  const a = actx, t0 = a.currentTime + start;
  const len = Math.ceil(a.sampleRate * 0.018), buf = a.createBuffer(1, len, a.sampleRate), ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const src = a.createBufferSource(), bp = a.createBiquadFilter(), ng = a.createGain();
  src.buffer = buf; bp.type = 'bandpass'; bp.frequency.value = Math.min(7000, baseFreq * 3.1); bp.Q.value = 3.2;
  ng.gain.value = vol * 0.9; src.connect(bp).connect(ng).connect(a.destination); src.start(t0);
  [[baseFreq, dur, 1.0], [baseFreq * 1.0025, dur * 0.95, 0.55], [baseFreq * 2.02, dur * 0.55, 0.28], [baseFreq * 3.18, dur * 0.22, 0.12]].forEach(([f, d, w]) => {
    const o = a.createOscillator(), g = a.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(f, t0);
    g.gain.setValueAtTime(0.0001, t0); g.gain.linearRampToValueAtTime(vol * w, t0 + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0006, t0 + d);
    o.connect(g).connect(a.destination); o.start(t0); o.stop(t0 + d + 0.02);
  });
}
function throwSound(k) {
  if (muted || !actx) return;
  if (k === 'egg') { sweep(2400, 1200, 0, 0.04, 0.25, 'square'); noise(0.02, 0.35, 0.8, 3000, 300); }
  else if (k === 'tomato') { sweep(180, 60, 0, 0.15, 0.6); noise(0, 0.45, 1, 1800, 150); }
  else if (k === 'cabbage') { noise(0, 0.25, 0.7, 900, 200); sweep(300, 120, 0.05, 0.2, 0.3, 'triangle'); sweep(200, 90, 0.3, 0.5, 0.15, 'sawtooth'); }
  else if (k === 'shoe') { sweep(140, 45, 0, 0.25, 0.9); noise(0, 0.12, 0.6, 1200, 200); [0.25, 0.4, 0.55].forEach((s, i) => tone(1400 + i * 300, s, 0.15, 0.1)); }
  else if (k === 'rose') {
    noise(0, 0.22, 0.07, 1600, 3200, 'bandpass');
    [349.23, 440, 523.25, 659.25, 783.99, 1046.5].forEach((f, i) => harpNote(f, i * 0.068, 0.85 + i * 0.09, 0.14));
  }
  else if (k === 'goblet') {
    glassClink(1396.9, 0, 1.5, 0.22);
    glassClink(1760, 0.085, 1.45, 0.18);
    noise(0.14, 0.45, 0.04, 6500, 3800, 'highpass');
    [0.24, 0.34, 0.45, 0.58].forEach((t, i) => tone(3800 + i * 420, t, 0.06, 0.025));
  }
}
