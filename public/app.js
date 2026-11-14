const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const token = localStorage.token || (localStorage.token = uuid());
const AVATARS = ['lion', 'eagle', 'dragon', 'stag', 'wolf', 'bear', 'boar', 'griffin', 'unicorn', 'raven', 'owl', 'fox', 'horse', 'falcon', 'serpent', 'swan', 'tower', 'rose', 'sun', 'moon'];
const CREST_EMO = {"lion": "🦁", "eagle": "🦅", "dragon": "🐉", "stag": "🦌", "wolf": "🐺", "bear": "🐻", "boar": "🐗", "griffin": "🦅", "unicorn": "🦄", "raven": "🐦\u200d⬛", "owl": "🦉", "fox": "🦊", "horse": "🐎", "falcon": "🦅", "serpent": "🐍", "swan": "🦢", "tower": "🏰", "rose": "🌹", "sun": "☀️", "moon": "🌙"};
let ws, S = null, sel = new Set(), reveal = false, online = false, clockSkew = 0, showGuide = false;
let myAvatar = AVATARS.includes(localStorage.avatar) ? localStorage.avatar : AVATARS[Math.floor(Math.random() * AVATARS.length)];

function toast(m, ok) { const t = $('#toast'); t.textContent = m; t.style.background = ok ? 'var(--ok)' : 'var(--evil)'; t.style.display = 'block'; t.classList.remove('out'); t.classList.remove('in'); void t.offsetWidth; t.classList.add('in'); clearTimeout(t._h); t._h = setTimeout(() => { t.classList.add('out'); setTimeout(() => (t.style.display = 'none'), 260); }, 2800); }
function send(o) {
  if (S && S.viewAs && !['g', 'god', 'join', 'create'].includes(o.t)) o = { t: 'g', a: 'as', msg: o };
  if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); else toast('正在重连，请稍等…');
}
const god = (a, extra) => send({ t: 'g', a, ...extra });
const vibrate = (ms) => navigator.vibrate && navigator.vibrate(ms);

// ---------- 连接 & 自动重连 ----------
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => {
    online = true;
    if (localStorage.room && localStorage.name) send({ t: 'join', code: localStorage.room, name: localStorage.name, avatar: myAvatar, token });
    if (localStorage.godRoom && sessionStorage.godPw) send({ t: 'god', code: localStorage.godRoom, password: sessionStorage.godPw });
    if (WATCH) send({ t: 'watch', code: WATCH });
    if (SPEC) send({ t: 'watch', code: SPEC.code, name: SPEC.name });
    render();
  };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'joined') { localStorage.room = m.code; history.replaceState(null, '', '?r=' + m.code); }
    if (m.t === 'godOk') { localStorage.godRoom = m.code; toast('已进入上帝模式', true); }
    if (m.t === 'kicked') { delete localStorage.room; S = null; toast(m.m); render(); }
    if (m.t === 'state') {
      const prev = S;
      S = m.s; clockSkew = S.now - Date.now();
      if (prev && (prev.phase !== S.phase || prev.quest !== S.quest || prev.viewAs !== S.viewAs)) { sel.clear(); excalPick = null; }
      if (S.phase === 'propose' && S.leader === S.me && (!prev || prev.leader !== S.me || prev.phase !== 'propose')) vibrate([80, 60, 80]);
      if (S.speech && S.speech.order[S.speech.idx] === S.me && (!prev || !prev.speech || prev.speech.idx !== S.speech.idx)) vibrate(200);
      if (prev && prev.gameId === S.gameId && (S.bellSeq || 0) > (prev.bellSeq || 0)) bell();
      if (S.myRole) preload(S.myRole.art);
      render(); maybeEvent();
    }
    if (m.t === 'throw' && typeof onThrow === 'function') onThrow(m);
    if (m.t === 'error') {
      toast(m.m);
      if (m.m.startsWith('房间不存在')) { delete localStorage.room; if (!S || !S.god) { S = null; render(); } }
      if (m.m === '密码错误') { delete sessionStorage.godPw; }
    }
  };
  ws.onclose = () => { online = false; render(); setTimeout(connect, 1200); };
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && ws && ws.readyState > 1) connect(); });

const P = (id) => S.players.find((p) => p.id === id) || { name: '?', avatar: '❔' };
const nm = (id) => `${avH(P(id).avatar, 'mini')}${esc(P(id).name)}`;
const seat = (id) => S.players.findIndex((p) => p.id === id) + 1;
const isGod = () => S && S.god;

// ---------- 角色立绘 ----------
const ART_FALLBACK = {};
const img = (role) => `img/roles/${ART_FALLBACK[role] || role}.webp`;
const IMG_OK = {}; // 已加载成功的立绘（没加载好就退回 emoji 卡面）
function preload(role) {
  if (!role || role in IMG_OK) return;
  IMG_OK[role] = false;
  const im = new Image(); im.onload = () => { IMG_OK[role] = true; if (reveal) render(); };
  im.onerror = () => { const base = role.replace(/_\d+$/, ''); if (base !== role) { const b = new Image(); b.onload = () => { ART_FALLBACK[role] = base; IMG_OK[role] = true; if (reveal) render(); }; b.src = img(base); } };
  im.src = img(role);
}
function showRole(k) {
  const R = ROLES[k];
  $('#modal').innerHTML = `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="box guide"><img class="portrait" src="${img(k)}" alt="" onerror="this.remove()" onclick="showDetail('${k}',this)" style="margin:0 auto 10px;max-height:38vh;width:auto;max-width:100%;cursor:zoom-in">
  <h3 style="margin:0">${R.emo} ${R.name}（${R.side === 'good' ? '好人' : '坏人'}）</h3><p><b>知道：</b>${R.know}</p><p><b>目标：</b>${R.goal}</p><ul>${R.tips.map((t) => `<li>${t}</li>`).join('')}</ul>
  <button class="sec" onclick="closeModal()">关闭</button></div></div>`;
}

// ---------- 渲染 ----------
// 模板字符串里写 \d 会变成 d，所以投屏校验放在函数里
function goTV() { const c = $('#wcd').value.trim(); if (!/^\d{4}$/.test(c)) return toast('房间号是 4 位数字'); location.href = '/?watch=' + c; }
// ---------- 准备阶段的圆桌排座 ----------
let seatPick = null, seatPressT = null, seatSwallow = false;
function lobbyTable() {
  const n = S.players.length; if (!n) return '';
  const size = n >= 9 ? 50 : n >= 7 ? 56 : 62;
  const seats = S.players.map((p, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n, x = 50 + 41 * Math.cos(a), y = 50 + 41 * Math.sin(a);
    return `<div data-pid="${p.id}" data-seat="${p.id}" class="seat ${p.online ? '' : 'off'} ${p.id === S.me ? 'me' : ''} ${seatPick === p.id ? 'picked swap' : ''} ${seatPick && seatPick !== p.id ? 'can' : ''}" style="left:${x}%;top:${y}%;--s:${size}px">
      <div class="seat-av">${avH(p.avatar)}<span class="sn">${i + 1}</span></div><div class="seat-nm">${esc(p.name)}${p.id === S.me ? '<small>（我）</small>' : ''}</div></div>`;
  }).join('');
  const c = seatPick ? `<div class="cs-t">换到哪？</div><div class="cs-s">点另一个人交换 · 点自己取消</div>` : `<div class="cs-t">圆桌排座</div><div class="cs-s">长按头像，再点另一个人交换</div>`;
  return `<div class="rtable lobbyt"><div class="rt-board"></div><div class="rt-cwrap"><div class="rt-center">${c}</div></div>${seats}</div>`;
}
function seatDown(e) {
  if (typeof throwOpen !== 'undefined' && throwOpen) return;
  const el = e.target.closest && e.target.closest('[data-seat]'); if (!el) return;
  clearTimeout(seatPressT); seatSwallow = false;
  seatPressT = setTimeout(() => { seatPressT = null; seatSwallow = true; vibrate(40); seatTap(el.dataset.seat); }, 450);
}
function seatTap(id) {
  if (!seatPick) { seatPick = id; return render(); }
  if (seatPick !== id) send({ t: 'seat', a: seatPick, b: id });
  seatPick = null; render();
}
const seatCancel = () => { clearTimeout(seatPressT); seatPressT = null; };
document.addEventListener('touchstart', seatDown, { passive: true }); document.addEventListener('mousedown', seatDown);
['touchmove', 'touchend', 'mouseup'].forEach((ev) => document.addEventListener(ev, seatCancel, { passive: true }));
document.addEventListener('click', (e) => {
  const el = e.target.closest && e.target.closest('[data-seat]'); if (!el || (typeof throwOpen !== 'undefined' && throwOpen)) return;
  if (seatSwallow) { seatSwallow = false; return; }
  if (seatPick) seatTap(el.dataset.seat); // 已选中一人时，普通点击即可完成交换
});
document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-seat]')) e.preventDefault(); });
function render() {
  syncRulebook();
  if (typeof throwUI === 'function') setTimeout(throwUI);
  const app = $('#app');
  if (HISTORY) { app.innerHTML = historyView(); return animateView(app, 'history:' + !!HIST); }
  if (WATCH) { app.innerHTML = tvView(); return animateView(app, 'tv:' + (S ? S.phase : '')); }
  if (!S && SPEC) { app.innerHTML = `<h1>阿瓦隆</h1><div class="banner">${online ? `正在进入观众席（房间 ${esc(SPEC.code)}）…` : '连接中…'}</div><button class="sec" onclick="location.href='/'">返回首页</button>`; return; }
  if (!S) { app.innerHTML = homeView(); return animateView(app, 'home'); }
  const meP = S.players.find((p) => p.id === S.me);
  let h = `<div class="top"><span class="dot ${online ? '' : 'off'}"></span>房间 <b>${S.code}</b>
    ${meP ? `· ${avH(meP.avatar, 'mini')} ${esc(meP.name)}${S.me === S.hostId ? '（房主）' : ''}` : SPEC ? `· 观众席 ${esc(SPEC.name)} <span class="tbtn" style="width:auto;font-size:12px" onclick="location.href='/'">离开</span>` : ''}${isGod() ? (S.viewAs ? ` · <b style="color:#c9a6ff">👁 代入 ${esc(P(S.viewAs).name)}</b>` : ' · <b style="color:#c9a6ff">👁 上帝</b>') : ''}
    <span class="sp"><span class="tbtn" onclick="toggleMute()">${ic(muted ? 'mute' : 'bell')}</span>${S.gameId ? '<button class="sm sec book-trigger" onclick="openRulebook()" aria-haspopup="dialog">📖 本局规则书</button>' : ''}</span></div>`;
  if (!online) h += `<div class="banner" style="background:#5e1d1d;color:#fff">连接断开，正在自动重连…</div>`;
  if (isGod()) h += viewAsBar();
  h += S.phase === 'lobby' ? lobbyView() : gameView();
  if (isGod() && !S.viewAs) h += godView();
  h += rulesView();
  if (meP) h += `<button class="sec" onclick="leave()">离开房间</button>`;
  app.innerHTML = h;
  animateView(app, [S.phase, S.quest, S.viewAs || '', S.god ? 'g' : ''].join(':'));
  popQuest();
  tick();
}

function homeView() {
  const code = new URLSearchParams(location.search).get('r') || localStorage.room || '';
  return `<h1>阿瓦隆</h1><div class="sub" style="font-family:var(--serif);letter-spacing:3px">卡美洛的忠臣与莫德雷德的爪牙</div>
  <div class="card"><h3>选个头像</h3><div class="avpick">${AVATARS.map((a) => `<span class="${a === myAvatar ? 'on' : ''}" onclick="pickAv('${a}')">${avH(a)}</span>`).join('')}</div>
  <input id="nm" placeholder="你的昵称" maxlength="12" value="${esc(localStorage.name || '')}">
  <input id="cd" placeholder="房间号（4位）" inputmode="numeric" maxlength="4" value="${esc(code)}">
  <button onclick="doJoin()">加入房间</button><div class="mute center">掉线或换了手机？填同一个房间号和原来的昵称就能回到原位，身份不变。</div>
  <button class="sec" onclick="doCreate()">创建新房间</button></div>
  <button class="sec" onclick="location.href='/?history'">📊 历史战绩 · 复盘</button>
  <div class="card"><details><summary>👀 观众席 / 投屏大屏</summary>
  <input id="wcd" placeholder="房间号" inputmode="numeric" maxlength="4" value="${esc(code)}"><input id="wnm" placeholder="你的名字（观众席用）" maxlength="12" value="${esc(localStorage.name || '')}">
  <div class="row"><button onclick="goSpec()">进入观众席</button><button class="sec" onclick="goTV()">投屏大屏</button></div>
  <div class="mute">观众席：在手机上看完整的圆桌和公开信息，名字会显示在观众席里，看不到任何人的身份。投屏大屏：横屏大字版，适合电视。都不占玩家位置。</div></details></div>
  <div class="card god"><details><summary>👁 上帝模式（裁判 / 调试）</summary>
  <input id="gcd" placeholder="房间号" inputmode="numeric" maxlength="4" value="${esc(code)}"><input id="gpw" type="password" placeholder="上帝密码">
  <button class="sec" onclick="doGod()">以上帝身份进入</button><div class="mute">上帝能看到所有人的身份和实时投票，还可以调整局面。上帝不占玩家位置。</div></details></div>
  ${codexView()}
  ${rulesView()}`;
}
// 首页图鉴：所有角色立绘 + 道具卡，点一下翻面看能力
function codexView() {
  const card = (cls, imgSrc, name, back, key) => `<div class="flip ${cls}" onclick="cardClick(this,'${key}')"><div class="in">
    <div class="fc"><div class="fb">${name.split(' ')[0]}</div><img loading="lazy" src="${imgSrc}" alt="" onerror="this.remove()"><i class="frm"></i><div class="nm2">${name.replace(/^\S+ /, '')}</div><span class="zoom" onclick="event.stopPropagation();showDetail('${key}',this.parentNode.querySelector('img'))">🔍</span></div>
    <div class="bk parch"><div class="bki">${back}</div></div></div></div>`;
  const roleCard = ([k, R]) => card(R.side === 'good' ? 'g' : 'e', img(k), `${R.emo} ${R.name}`,
    `<b class="t">${R.emo} ${R.name}</b><span class="side">${R.side === 'good' ? '正义阵营' : '邪恶阵营'}</span><p><b>知道：</b>${R.know}</p><p><b>何时生效：</b>${R.when || ''}</p><p><b>目标：</b>${R.goal}</p>`, k);
  const roles = Object.entries(ROLES);
  return `<div class="codex"><h2>⚜ 正义阵营 ⚜<small>${WIDE() ? '点一张牌查看大图和能力' : '点一张牌翻面查看能力，点 🔍 看大图'}</small></h2><div class="fgrid">${roles.filter(([, R]) => R.side === 'good').map(roleCard).join('')}</div>
  <h2>⚜ 邪恶阵营 ⚜</h2><div class="fgrid">${roles.filter(([, R]) => R.side === 'evil').map(roleCard).join('')}</div>
  <h2>⚜ 道具与卡牌 ⚜</h2><div class="fgrid">${Object.entries(ITEMS).map(([k, I]) => card('', `img/items/${k}.webp`, `${I.emo} ${I.name}`, `<b class="t">${I.emo} ${I.name}</b><p>${I.desc}</p><p><b>何时使用：</b>${I.when || ''}</p>`, 'item:' + k)).join('')}</div></div>`;
}
function goSpec() {
  const c = $('#wcd').value.trim(), n = $('#wnm').value.trim();
  if (!/^\d{4}$/.test(c)) return toast('房间号是 4 位数字');
  if (!n) return toast('观众席需要填个名字');
  location.href = `/?spec=${c}&name=${encodeURIComponent(n)}`;
}
function pickAv(a) { myAvatar = a; localStorage.avatar = a; if (S) send({ t: 'profile', avatar: a }); render(); }
function getName() { const n = $('#nm').value.trim(); if (!n) { toast('先输入昵称'); return null; } localStorage.name = n; return n; }
function doCreate() { const n = getName(); if (n) send({ t: 'create', name: n, avatar: myAvatar, token }); }
function doJoin() {
  const n = getName(); const c = $('#cd').value.trim(); if (!n) return;
  if (!/^\d{4}$/.test(c)) return toast('房间号是 4 位数字');
  send({ t: 'join', code: c, name: n, avatar: myAvatar, token });
}
function doGod() {
  const c = $('#gcd').value.trim(), pw = $('#gpw').value;
  if (!/^\d{4}$/.test(c) || !pw) return toast('填写房间号和密码');
  sessionStorage.godPw = pw; send({ t: 'god', code: c, password: pw });
}
function leave() {
  if (!confirm('确定离开房间？（游戏中离开后，用房间号 + 原昵称可以回来）')) return;
  delete localStorage.room; delete localStorage.godRoom; S = null; history.replaceState(null, '', '/'); ws.close();
}

function lobbyView() {
  const host = S.me === S.hostId || isGod(), st = S.settings, n = S.players.length;
  const ck = (k, label) => `<label class="ck"><input type="checkbox" ${st[k] ? 'checked' : ''} ${host ? '' : 'disabled'} onchange="setS({${k}:this.checked})">${label}</label>`;
  return `<div class="card center"><div class="mute">把房间号告诉大家，或者分享链接</div><div class="code">${S.code}</div>
    <button class="sec" onclick="share()">复制邀请链接</button></div>
  ${S.me ? `<div class="card"><h3>我的头像</h3><div class="avpick">${AVATARS.map((a) => `<span class="${a === P(S.me).avatar ? 'on' : ''}" onclick="pickAv('${a}')">${avH(a)}</span>`).join('')}</div></div>` : ''}
  <div class="card"><h3>玩家 ${n}/10（5 人起）</h3><div class="mute">按现实里的座位排：<b>长按</b>一个人，再点另一个人，两人交换位置（顺时针 = 号码从小到大）。</div>${lobbyTable(host)}
  <div class="players lobbyctl">${S.players.map((p, i) => `<div class="p ${p.online ? '' : 'off'}"><span class="av">${avH(p.avatar)}</span>${i + 1}·${esc(p.name)}<span class="tags">${p.id === S.hostId ? '<span class="tag lead">房主</span>' : ''}${p.online ? '' : '<span class="tag">离线</span>'}${host && p.id !== S.me ? `<span class="tag" onclick="${isGod() ? `god('kick',{id:'${p.id}'})` : `send({t:'kick',id:'${p.id}'})`}">移出</span>` : ''}</span></div>`).join('')}</div></div>
  <div class="card"><h3>角色配置</h3><div class="mute">${host ? '点立绘选择/取消角色，点 🔍 放大看。' : '房主正在挑选角色。'}梅林一定在场；刺客可选，没选时由随机一名坏人刺杀。其余位置自动补忠臣和爪牙。</div>
    <div class="pgh">预设板子 <small>${host ? '点一下直接套用，下面还可以再微调' : ''}</small></div>${presetsView(host)}
    <div class="pgh" style="margin-top:14px">自定义</div>
    ${pickGrid(host)}
    ${roleCountHint()}
    ${teamSizeCtl(host)}
    <label class="ck">🗡️ 刺杀时限 <select style="width:auto" ${host ? '' : 'disabled'} onchange="setS({assassinSecs:+this.value})">${[0, 60, 120, 180, 300].map((s) => `<option value="${s}" ${(st.assassinSecs ?? 120) === s ? 'selected' : ''}>${s ? s / 60 + ' 分钟' : '不限时'}</option>`).join('')}</select></label>
    <label class="ck">⏱ 每人发言时长 <select style="width:auto" ${host ? '' : 'disabled'} onchange="setS({speechSecs:+this.value})">${[30, 60, 90, 120, 180, 300].map((s) => `<option value="${s}" ${st.speechSecs === s ? 'selected' : ''}>${s >= 60 ? s / 60 + ' 分钟' : s + ' 秒'}</option>`).join('')}</select></label>
    <label class="ck">${ic('crown')} 队长轮换 <select style="width:auto" ${host ? '' : 'disabled'} onchange="setS({leaderMode:this.value})"><option value="seq" ${st.leaderMode !== 'random' ? 'selected' : ''}>按座位顺序</option><option value="random" ${st.leaderMode === 'random' ? 'selected' : ''}>每轮随机</option></select></label>
    ${st.cleric ? `<label class="ck">${ic('eye')} 牧师查验 <select style="width:auto" ${host ? '' : 'disabled'} onchange="setS({clericTiming:this.value})"><option value="start" ${st.clericTiming !== 'propose' ? 'selected' : ''}>开局查首任队长</option><option value="propose" ${st.clericTiming === 'propose' ? 'selected' : ''}>首次发车后查发车的队长</option></select></label>` : ''}</div>
  ${host ? `<button onclick="${isGod() ? "god('start')" : "send({t:'start'})"}" ${n < 5 ? 'disabled' : ''}>开始游戏 · 发身份</button>` : '<div class="banner">等待房主开始</div>'}`;
}
// 立绘卡片选角色
const PICKS = {
  good: [['merlin', 'merlin', '梅林', 'lock'], ['percival', 'percival', '派西维尔'], ['cleric', 'cleric', '牧师'], ['troublemaker', 'troublemaker', '捣蛋鬼'], ['good_sorcerer', 'good_sorcerer', '正义巫师']],
  evil: [['assassin', 'assassin', '刺客'], ['morgana', 'morgana', '莫甘娜'], ['mordred', 'mordred', '莫德雷德'], ['oberon', 'oberon', '奥伯伦'], ['lunatic', 'lunatic', '疯子'], ['brute', 'brute', '莽夫'], ['revealer', 'revealer', '暴露者'], ['trickster', 'trickster', '诡术师'], ['evil_sorcerer', 'evil_sorcerer', '邪恶巫师']],
  pair: [['lancelot', 'good_lancelot', '兰斯洛特']],
  item: [['lady', 'items/lady', '湖中仙女'], ['excalibur', 'items/excalibur', '王者之剑']],
};
const LANCE = ['关闭', '规则1·第3轮起翻牌', '规则2·每轮翻牌', '规则3·不换互认'];
const picSrc = (p) => (p.startsWith('items/') ? `img/${p}.webp` : img(p));
function pickGrid(host) {
  const st = S.settings;
  const card = ([k, pic, name, lock], side) => {
    const on = lock || (k === 'lancelot' ? st.lancelot > 0 : !!st[k]);
    const cap = k === 'lancelot' ? `${name}</div><div class="rule">${LANCE[st.lancelot || 0]}` : name;
    const R = ROLES[pic] || {};
    return `<div class="pick ${side} ${on ? 'on' : ''} ${lock ? 'lock' : ''} ${host && !lock ? 'can' : ''}" ${host && !lock ? `onclick="togPick('${k}')"` : ''}>
      <div class="fb">${R.emo || (ITEMS[pic.replace('items/', '')] || {}).emo || ''}</div><img loading="lazy" src="${picSrc(pic)}" alt="" onerror="this.remove()"><i class="frm"></i>
      <div class="cap">${cap}</div>${lock ? '<span class="lk">必选</span>' : on ? '<span class="lk ok">✓</span>' : ''}
      <span class="zoom" onclick="event.stopPropagation();showDetail('${pic.startsWith('items/') ? 'item:' + pic.slice(6) : pic}',this.parentNode.querySelector('img'))">🔍</span></div>`;
  };
  return `<div class="pgh">正义阵营</div><div class="pgrid">${PICKS.good.map((c) => card(c, 'g')).join('')}</div>
  <div class="pgh">邪恶阵营</div><div class="pgrid">${PICKS.evil.map((c) => card(c, 'e')).join('')}</div>
  <div class="pgh">成对角色 <small>${host ? '（兰斯洛特点一下切换规则）' : ''}</small></div><div class="pgrid">${PICKS.pair.map((c) => card(c, 'x')).join('')}</div>
  <div class="pgh">道具</div><div class="pgrid">${PICKS.item.map((c) => card(c, 'x')).join('')}</div>`;
}
function togPick(k) {
  const st = S.settings;
  if (k === 'lancelot') return setS({ lancelot: ((st.lancelot || 0) + 1) % 4 });
  setS({ [k]: !st[k] });
}

// ---------- 立绘放大浏览（点一下放大到原尺寸，可拖动；再点一下或点 ✕ 关闭） ----------
const WIDE = () => matchMedia('(hover: hover) and (pointer: fine)').matches && innerWidth >= 700; // 电脑
function cardClick(el, key) { if (WIDE()) showDetail(key, el.querySelector('img')); else el.classList.toggle('on'); }
function detailHtml(key) {
  if (key.startsWith('item:')) { const I = ITEMS[key.slice(5)]; return `<h3>${I.emo} ${I.name}</h3><p>${I.desc}</p>${I.when ? `<p class="when"><b>何时使用：</b>${I.when}</p>` : ''}`; }
  const R = ROLES[key]; if (!R) return '';
  return `<h3>${R.emo} ${R.name}</h3><div class="side ${R.side}">${R.side === 'good' ? '正义阵营' : '邪恶阵营'}</div>
    <p><b>你知道：</b>${R.know}</p>${R.when ? `<p class="when"><b>何时生效：</b>${R.when}</p>` : ''}<p><b>目标：</b>${R.goal}</p><p><b>玩法建议：</b></p><ul>${R.tips.map((t) => `<li>${t}</li>`).join('')}</ul>`;
}
function showDetail(key, from) {
  const src = key.startsWith('item:') ? `img/items/${key.slice(5)}.webp` : img(key);
  const name = key.startsWith('item:') ? ITEMS[key.slice(5)].name : ROLES[key].name;
  zoomImg(src, name, detailHtml(key), from);
}
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
// 把元素从 from 的位置/大小，动画过渡到它自己的位置（FLIP）
function flyFrom(elm, from, reverse, done) {
  const r1 = from && from.isConnected ? from.getBoundingClientRect() : null, r2 = elm.getBoundingClientRect();
  if (REDUCED || !r1 || !r1.width || !r2.width) { done && done(); return false; }
  const t = `translate(${r1.left - r2.left}px,${r1.top - r2.top}px) scale(${r1.width / r2.width},${r1.height / r2.height})`;
  elm.style.transformOrigin = '0 0';
  if (!reverse) {
    elm.style.transition = 'none'; elm.style.transform = t; elm.getBoundingClientRect();
    elm.style.transition = 'transform .5s cubic-bezier(.2,.85,.25,1)'; elm.style.transform = '';
  } else {
    elm.style.transition = 'transform .38s cubic-bezier(.5,0,.75,.4)'; elm.style.transform = t;
  }
  setTimeout(() => done && done(), reverse ? 380 : 500);
  return true;
}
function zoomImg(src, title, html, from) {
  const el = document.createElement('div');
  el.className = 'lightbox opening';
  if (html) el.classList.add('detail');
  el.innerHTML = `<div class="lbx">✕</div><div class="lbm"><div class="lbs"><div class="lbf"><img src="${src}" alt="" onerror="this.parentNode.classList.add('noimg')"></div></div>
    ${html ? `<div class="lbd parch" onclick="event.stopPropagation()"><div class="lbi">${html}<div class="mute" style="margin-top:10px">点图片放大细节 · 点空白处关闭</div></div></div>` : `<div class="lbt">${title || ''}<br><small>点图片放大 / 缩小，放大后可拖动</small></div>`}</div>`;
  const im = el.querySelector('img'), sc = el.querySelector('.lbs'), fr = el.querySelector('.lbf');
  const close = () => {
    if (el.classList.contains('closing')) return;
    el.classList.add('closing');
    if (el.classList.contains('big')) { el.classList.remove('big'); im.style.width = ''; }
    flyFrom(fr, from, true);
    setTimeout(() => el.remove(), 380);
  };
  el.querySelector('.lbx').onclick = (e) => { e.stopPropagation(); close(); };
  el.onclick = close;
  // 点图放大 / 缩小：宽度过渡动画，放大时以点击位置为中心
  im.onclick = (e) => {
    e.stopPropagation();
    const r = im.getBoundingClientRect(), fx = (e.clientX - r.left) / r.width, fy = (e.clientY - r.top) / r.height;
    const big = !el.classList.contains('big');
    const w0 = r.width, w1 = big ? Math.max(w0 * 2.2, innerWidth * 1.6) : null;
    im.style.transition = 'none'; im.style.width = w0 + 'px'; im.style.maxWidth = 'none'; im.style.maxHeight = 'none';
    el.classList.toggle('big', big); im.getBoundingClientRect();
    im.style.transition = REDUCED ? 'none' : 'width .42s cubic-bezier(.2,.85,.25,1)';
    if (big) {
      im.style.width = w1 + 'px';
      const t0 = performance.now();
      const follow = () => { sc.scrollLeft = im.offsetWidth * fx - sc.clientWidth / 2; sc.scrollTop = im.offsetHeight * fy - sc.clientHeight / 2; if (performance.now() - t0 < 460) requestAnimationFrame(follow); };
      requestAnimationFrame(follow);
    } else {
      // 缩回：先算出原本的显示宽度再过渡
      const box = sc.getBoundingClientRect(), ratio = im.naturalWidth / im.naturalHeight || 2 / 3;
      const maxH = el.classList.contains('detail') ? (innerWidth >= 760 ? innerHeight * 0.86 : innerHeight * 0.52 - 14) : box.height;
      const target = Math.min(box.width, maxH * ratio);
      im.style.width = target + 'px';
      setTimeout(() => { im.style.width = ''; im.style.maxWidth = ''; im.style.maxHeight = ''; im.style.transition = ''; }, 440);
    }
  };
  document.body.appendChild(el);
  const go = () => { flyFrom(fr, from, false); requestAnimationFrame(() => el.classList.remove('opening')); };
  if (im.complete) go(); else { im.onload = go; setTimeout(() => el.classList.contains('opening') && go(), 600); }
}

// ---------- 页面切换动画：换页面/阶段时内容依次淡入上浮 ----------
let lastViewKey = null;
function animateView(app, key) {
  if (key === lastViewKey || REDUCED) { lastViewKey = key; return; }
  lastViewKey = key;
  [...app.children].forEach((c, i) => { c.style.setProperty('--i', Math.min(i, 12)); });
  app.classList.remove('vt'); void app.offsetWidth; app.classList.add('vt');
  clearTimeout(animateView._t); animateView._t = setTimeout(() => app.classList.remove('vt'), 1200);
}
// 关闭弹窗（带淡出动画）
function closeModal() {
  const m = $('#modal .modal'); if (!m) return;
  m.classList.add('out'); setTimeout(() => { if (m.isConnected) m.remove(); }, 220);
}

// 每轮任务人数：默认按人数推荐，房主可改
function teamSizeCtl(host) {
  const n = S.players.length, d = S.defaultTeam; if (!d) return '';
  const c = S.settings.teamSizes, cur = c ? c.map((x) => Math.min(x, n)) : d;
  const sel = (i) => `<select style="width:auto" ${host ? '' : 'disabled'} onchange="setTeam(${i},+this.value)">${Array.from({ length: n }, (_, k) => k + 1).map((v) => `<option ${v === cur[i] ? 'selected' : ''}>${v}</option>`).join('')}</select>`;
  return `<div class="ck">👥 每轮任务人数 ${[0, 1, 2, 3, 4].map(sel).join(' ')} ${c ? `<span class="tag" ${host ? 'onclick="setS({teamSizes:null})"' : ''}>自定义 · 恢复推荐</span>` : '<span class="mute">推荐</span>'}</div>`;
}
function setTeam(i, v) { const t = (S.settings.teamSizes || S.defaultTeam).slice(); t[i] = v; setS({ teamSizes: t }); }
function roleCountHint() {
  const st = S.settings, n = S.players.length, E = S.evilTotal;
  if (n < 5) return '';
  const e = ['assassin', 'morgana', 'mordred', 'oberon', 'lunatic', 'brute', 'revealer', 'trickster', 'evil_sorcerer'].filter((k) => st[k]).length + (st.lancelot ? 1 : 0);
  const g = 1 + ['percival', 'cleric', 'troublemaker', 'good_sorcerer'].filter((k) => st[k]).length + (st.lancelot ? 1 : 0);
  const bad = e > E || g > n - E;
  return `<div class="mute" style="margin-top:6px;color:${bad ? 'var(--evil)' : ''}">${n} 人局：好人 ${n - E}（已选特殊 ${g}）· 坏人 ${E}（已选特殊 ${e}）${bad ? ' · 特殊角色太多了' : ''}${st.assassin ? '' : '<br>没选刺客：好人完成 3 次任务后，随机抽一名坏人来刺杀梅林'}</div>`;
}
function setS(s) { isGod() && S.me !== S.hostId ? god('settings', { settings: s }) : send({ t: 'settings', settings: s }); }
function share() { const u = location.origin + '/?r=' + S.code; navigator.clipboard ? navigator.clipboard.writeText(u).then(() => toast('已复制：' + u, true)) : prompt('复制链接', u); }

function roleCard() {
  const r = S.myRole; if (!r) return '';
  const R = ROLES[r.role];
  const inner = reveal
    ? `<div class="ov"><div class="emo" style="font-size:30px">${R.emo}</div><div class="nm" style="color:${r.evilNow ? '#ff8a85' : '#9cc3ff'}">${r.name}</div><div>${r.evilNow ? '邪恶阵营' : '正义阵营'}${r.evil !== r.evilNow ? '（已换阵营！）' : ''}</div>
       <div class="mute" style="margin-top:6px">${R.know}</div>
       ${r.sees.length ? `<div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;justify-content:center">${r.sees.map((x) => `<span class="tag ${r.evil ? 'evil' : 'good'}">${seat(x.id)}号 ${nm(x.id)} · ${x.tag}</span>`).join('')}</div>` : ''}</div>`
    : `<div class="emo">🂠</div><div class="nm">按住查看身份</div><div class="mute">松手就隐藏，注意别让旁边的人看到</div>`;
  const extra = [];
  if (r.role === 'trickster') extra.push(`<label class="ck">🃏 被查验时显示为 <select style="width:auto" onchange="send({t:'trickShow',evil:this.value==='1'})"><option value="0" ${r.trickShowEvil ? '' : 'selected'}>好人</option><option value="1" ${r.trickShowEvil ? 'selected' : ''}>坏人</option></select></label>`);
  if (S.myChecks && S.myChecks.length) extra.push(`<div><b>🧜‍♀️ 我的查验结果</b>${S.myChecks.map((c) => `<div>第${c.quest + 1}轮后：${seat(c.id)}号 ${nm(c.id)} 是 <b style="color:${c.evil ? 'var(--evil)' : 'var(--good)'}">${c.evil ? '坏人' : '好人'}</b></div>`).join('')}</div>`);
  if (S.myExcalSeen) extra.push(`<div><b>🔱 王者之剑</b>：第${S.myExcalSeen.quest + 1}轮你翻转了 ${nm(S.myExcalSeen.id)} 的牌，原来是「${CARD[S.myExcalSeen.card].t}」</div>`);
  const bg = reveal && IMG_OK[r.art] ? ` style="background:url(${img(r.art)})"` : '';
  return `<div class="role ${reveal ? 'show ' + (revealAnim ? 'anim ' : '') + (r.evilNow ? 'e' : 'g') + (IMG_OK[r.art] ? '' : ' noimg') : ''}" id="rc"${bg}>${inner}<i class="frm plain"></i></div>${extra.length ? `<div class="card" style="font-size:13px">${extra.join('')}<div class="mute">以上信息只有你能看到</div></div>` : ''}
  <div class="card guide"><details ${showGuide ? 'open' : ''} ontoggle="showGuide=this.open"><summary>📖 我的角色怎么玩（展开前确认旁边没人偷看）</summary>
  ${IMG_OK[r.art] ? `<img class="gp" src="${img(r.art)}" alt="" onclick="showDetail('${r.role}',this)">` : ''}<p><b>${R.emo} ${R.name}</b>（${R.side === 'good' ? '好人' : '坏人'}）</p><p><b>你知道：</b>${R.know}</p><p><b>目标：</b>${R.goal}</p><ul>${R.tips.map((t) => `<li>${t}</li>`).join('')}</ul></details></div>`;
}

let lastResults = null;
function popQuest() {
  const n = S && S.results ? S.results.length : 0;
  if (lastResults !== null && n > lastResults) { const q = document.querySelectorAll('.quests .q')[n - 1]; if (q) q.classList.add('pop'); }
  lastResults = n;
}
function questTrack() {
  return `<div class="card"><div class="quests">${S.teamSizes.map((sz, i) => {
    const r = S.results[i];
    return `<div class="q ${r ? (r.success ? 'ok' : 'fail') : i === S.quest && S.phase !== 'end' ? 'cur' : ''}">${r ? (r.success ? '✓' : '✗') : sz}<small>${r ? r.fails + '张失败' : i === 3 && S.twoFailQuest4 ? sz + '人·需2败' : '第' + (i + 1) + '轮'}</small></div>`;
  }).join('')}</div><div class="rej">否决 ${[0, 1, 2, 3, 4].map((i) => `<i class="${i < S.rejects ? 'on' : ''}"></i>`).join('')} ${S.rejects}/5</div></div>`;
}

function speechPanel() {
  const sp = S.speech, iLead = S.leader === S.me, host = S.me === S.hostId;
  if (!['propose', 'vote'].includes(S.phase)) return '';
  if (!sp) return (iLead || host) ? `<button class="okb" onclick="send({t:'speechStart'})">⏱ 开始轮流发言（从队长下家开始，队长最后）</button>` : '';
  const cur = sp.order[sp.idx], mine = cur === S.me, nxt = sp.order[sp.idx + 1];
  return `<div class="card" style="border-color:var(--ok)"><div class="speech"><span class="av" style="font-size:30px;width:46px;height:46px">${avH(P(cur).avatar)}</span>
    <div style="flex:1"><div><b>${mine ? '轮到你发言！' : `${seat(cur)}号 ${esc(P(cur).name)} 发言中`}</b></div><div class="mute">${sp.idx + 1}/${sp.order.length}${nxt ? ` · 下一位 ${nm(nxt)}` : ' · 最后一位'}</div></div>
    <div class="timer" data-end="${sp.endsAt}">--</div></div><div class="bar"><i data-end="${sp.endsAt}" data-secs="${sp.secs}"></i></div>
    <div class="row">${mine || iLead || host ? `<button class="sm sec" onclick="send({t:'speechNext'})">${mine ? '我说完了 ⏭' : '下一位 ⏭'}</button>` : ''}${iLead || host ? `<button class="sm sec" onclick="send({t:'speechStop'})">结束发言轮</button>` : ''}</div></div>`;
}

function plist(clickable) {
  const sp = S.speech, cur = sp && sp.order[sp.idx];
  return `<div class="players">${S.players.map((p, i) => {
    const tags = [];
    if (p.id === S.leader && S.phase !== 'end') tags.push('<span class="tag lead">👑队长</span>');
    if (S.team.includes(p.id) && S.phase !== 'propose') tags.push('<span class="tag team">队员</span>');
    if (S.phase === 'vote') tags.push(S.voted.includes(p.id) ? (isGod() ? `<span class="tag ${S.liveVotes[p.id] ? 'ok' : 'evil'}">${S.liveVotes[p.id] ? '同意' : '反对'}</span>` : '<span class="tag ok">已投</span>') : '<span class="tag">思考中</span>');
    if (S.phase === 'quest' && S.team.includes(p.id)) tags.push(S.questDone.includes(p.id) ? (isGod() ? `<span class="tag ${CARD[S.liveCards[p.id]].c}">${CARD[S.liveCards[p.id]].t}</span>` : '<span class="tag">已出牌</span>') : '<span class="tag">执行中</span>');
    if (S.evilSuggest) { const n = Object.values(S.evilSuggest).filter((x) => x === p.id).length; if (n) tags.push(`<span class="tag evil">🎯×${n}</span>`); }
    if (S.evilTeam && S.evilTeam.includes(p.id) && !S.allRoles) tags.push('<span class="tag evil">坏人</span>');
    if (S.allRoles) { const r = S.allRoles.find((x) => x.id === p.id); tags.push(`<span class="tag ${r.evil ? 'evil' : 'good'}">${ROLES[r.role].emo}${r.name}</span>`); }
    if (S.assassinTarget === p.id) tags.push('<span class="tag evil">🗡️被刺</span>');
    if (S.lady && S.lady.holder === p.id && S.phase !== 'end') tags.push('<span class="tag good">🧜‍♀️仙女</span>');
    if (S.excalibur === p.id) tags.push('<span class="tag lead">🔱圣剑</span>');
    if (S.revealed && S.revealed.includes(p.id) && !S.allRoles) tags.push('<span class="tag evil">📢已暴露·坏人</span>');
    if (!p.online) tags.push('<span class="tag">离线</span>');
    return `<div data-pid="${p.id}" class="p ${p.online ? '' : 'off'} ${sel.has(p.id) ? 'sel' : ''} ${cur === p.id ? 'speak' : ''}" ${clickable ? `onclick="tog('${p.id}')"` : ''}>
      ${avMark(p, i)}<span>${esc(p.name)}${p.id === S.me ? '<span class="mute">（我）</span>' : ''}<br>${relChips(p.id)}</span><span class="tags">${tags.join('')}</span></div>`;
  }).join('')}</div>`;
}

function gameView() {
  const n = S.players.length, iAmLeader = S.leader === S.me, need = S.teamSizes[S.quest];
  let h0 = infoCard();
  let h = (linkFrom ? `<div class="linkbar" onclick="linkFrom=null;render()">🔗 已选 ${nm(linkFrom)}，点另一个人的头像建立关系（点这里取消）</div>` : '') + roleCard() + questTrack() + h0 + speechPanel();
  if (S.phase === 'propose') {
    h += `<div class="banner">第 ${S.quest + 1} 轮 · 第 ${S.rejects + 1} 次组队 · 队长 ${nm(S.leader)} 选 ${need} 人</div>`;
    const exOpts = [...sel].filter((id) => id !== S.me);
    if (excalPick && !exOpts.includes(excalPick)) excalPick = null;
    const exSel = S.settings.excalibur && iAmLeader && sel.size === need ? `<label class="ck">🔱 王者之剑交给 <select style="width:auto" onchange="excalPick=this.value;render()"><option value="">请选择</option>${exOpts.map((id) => `<option value="${id}" ${excalPick === id ? 'selected' : ''}>${seat(id)}号 ${esc(P(id).name)}</option>`).join('')}</select></label>` : '';
    const canGo = sel.size === need && (!S.settings.excalibur || excalPick);
    h += `<div class="card">${plist(iAmLeader)}${iAmLeader ? `${exSel}<button onclick="send({t:'propose',team:[...sel],excalibur:excalPick})" ${canGo ? '' : 'disabled'}>🚗 发车（${sel.size}/${need}）</button><div class="mute center">点玩家那一行选队员，可以选自己${S.settings.excalibur ? '；王者之剑不能给自己' : ''}</div>` : '<div class="mute center" style="margin-top:8px">等队长选人，大家可以开始讨论</div>'}</div>`;
  } else if (S.phase === 'vote') {
    h += `<div class="banner">🚗 发车投票：是否同意这支队伍？（${S.voted.length}/${n} 已投）</div><div class="card">${plist(false)}`;
    h += S.myVote === undefined ? (S.me ? `<div class="row"><button class="okb" onclick="send({t:'vote',approve:true})">同意 👍</button><button class="evil" onclick="send({t:'vote',approve:false})">反对 👎</button></div>` : '')
      : `<div class="mute center" style="margin-top:8px">你投了「${S.myVote ? '同意' : '反对'}」，等其他人…全员投完后一起公布</div>`;
    if (iAmLeader && !S.voted.length) h += `<button class="sm sec" onclick="send({t:'unpropose'})">↩ 重新选人</button>`;
    h += '</div>';
  } else if (S.phase === 'quest') {
    const inTeam = S.team.includes(S.me);
    h += `<div class="banner">⚔️ 任务执行中（${S.questDone.length}/${S.team.length}）${S.quest === 3 && S.twoFailQuest4 ? ' · 本轮需要 2 张失败' : ''}</div><div class="card">${plist(false)}`;
    if (inTeam && !S.myCard) h += `<div class="row">${S.myCards.map((c) => `<button class="${CARD[c].b}" onclick="qc('${c}')">${CARD[c].t} ${CARD[c].e}</button>`).join('')}</div><div class="mute center">${cardHint()}</div>`;
    else h += `<div class="mute center" style="margin-top:8px">${inTeam ? '已出牌，等待其他队员' : '等待队员出牌'}</div>`;
    h += '</div>';
  } else if (S.phase === 'excalibur') {
    const me = S.excalibur === S.me;
    h += `<div class="banner">🔱 王者之剑：${nm(S.excalibur)} 决定是否翻转一名队员的任务牌</div><div class="card">${plist(false)}`;
    if (me) h += `<div class="mute">选一名其他队员，把他的牌翻转（成功↔失败，魔法牌不受影响），你会看到他原来出的牌。也可以不用。</div>
      ${S.team.filter((id) => id !== S.me).map((id) => `<button class="sec" onclick="confirm('翻转 '+P('${id}').name+' 的牌？')&&send({t:'excalibur',id:'${id}'})">翻转 ${seat(id)}号 ${nm(id)}</button>`).join('')}
      <button onclick="send({t:'excalibur',id:null})">不使用</button>`;
    else h += `<div class="mute center">等待持剑人决定…</div>`;
    h += '</div>';
  } else if (S.phase === 'lady') {
    const me = S.lady.holder === S.me;
    h += `<div class="banner">🧜‍♀️ 湖中仙女：${nm(S.lady.holder)} 查验一名玩家的阵营</div><div class="card">${plist(false)}`;
    if (me) h += `<div class="mute">结果只有你能看到，然后湖中仙女会交给被查的人。不能查拿过湖中仙女的人。</div>
      ${S.players.filter((p) => !S.lady.used.includes(p.id)).map((p) => `<button class="sec" onclick="confirm('查验 '+P('${p.id}').name+'？')&&send({t:'lady',id:'${p.id}'})">查验 ${seat(p.id)}号 ${nm(p.id)}</button>`).join('')}`;
    else h += `<div class="mute center">等待湖中仙女持有人查验…</div>`;
    h += '</div>';
  } else if (S.phase === 'assassin') {
    const amA = S.assassin === S.me, amEvil = !!S.evilTeam && S.me && S.evilTeam.includes(S.me);
    h += `<div class="banner" style="background:#5e1d1d;color:#fff">🗡️ 刺杀环节：好人完成了 3 次任务！<br><span style="font-weight:400;font-size:13px">坏人亮明身份，一起商量谁是梅林；刺客 ${nm(S.assassin)} 最后拍板</span></div>`;
    if (amEvil) h += `<div class="mute center">你是坏人：点一个人${amA ? '后按刺杀' : '标记你的怀疑对象（只有坏人能看到 🎯）'}</div>`;
    else if (!isGod()) h += `<div class="mute center">好人请保持沉默，别暴露梅林</div>`;
    h += `<div class="card">${plist(amEvil)}`;
    if (amEvil && !amA) h += `<button class="sec" onclick="sel.size===1&&send({t:'suggest',id:[...sel][0]})" ${sel.size !== 1 ? 'disabled' : ''}>🎯 标记为梅林</button>`;
    if (amA) h += `<button class="evil" onclick="if(sel.size===1&&confirm('确定刺杀 '+P([...sel][0]).name+'？'))send({t:'assassinate',id:[...sel][0]})" ${sel.size !== 1 ? 'disabled' : ''}>🗡️ 刺杀</button>`;
    h += '</div>';
  } else if (S.phase === 'end') {
    h += `<div class="banner" style="background:${S.winner === 'good' ? 'var(--good)' : 'var(--evil)'};color:#fff;font-size:20px">${S.winner === 'good' ? '🏆 正义阵营获胜' : '😈 邪恶阵营获胜'}<div style="font-size:14px;font-weight:400">${esc(S.reason)}</div></div>`;
    h += `<div class="card"><h3>身份揭晓</h3><div class="gallery">${S.allRoles.map((r) => `<div class="gi ${r.evil ? 'e' : 'g'} ${S.assassinTarget === r.id ? 'dead' : ''}" onclick="showDetail('${r.role}',this.querySelector('img'))"><img class="portrait" src="${img(r.art)}" alt="" onerror="this.onerror=null;this.src='${img(r.role)}'"><i class="frm"></i><div class="cap">${seat(r.id)}号 ${nm(r.id)}<br><b style="color:${r.evil ? '#ff8a85' : '#9cc3ff'}">${r.name}</b>${S.assassinTarget === r.id ? ' 🗡️' : ''}</div></div>`).join('')}</div></div>
    <div class="card">${plist(false)}</div>`;
    if (S.me === S.hostId || isGod()) h += `<button onclick="${isGod() && S.me !== S.hostId ? "god('start')" : "send({t:'start'})"}">再来一局（重新发身份）</button><button class="sec" onclick="${isGod() && S.me !== S.hostId ? "god('lobby')" : "send({t:'lobby'})"}">回到大厅改配置</button>`;
  }
  h += voteMatrix() + notesPanel();
  return h;
}
const CARD = { S: { t: '成功', e: '✓', b: 'good', c: 'good' }, F: { t: '失败', e: '✗', b: 'evil', c: 'evil' }, M: { t: '魔法', e: '✨', b: 'sec', c: 'lead' } };
function cardHint() {
  const r = S.myRole.role, c = S.myCards.join('');
  if (c === 'SM') return '魔法牌会把本次任务结果反转（两张魔法互相抵消）';
  if (r === 'lunatic') return '疯子必须出失败';
  if (r === 'brute' && c === 'S') return '莽夫第 4、5 轮只能出成功';
  if (c === 'S') return '好人只能出成功';
  return '出牌是匿名的，只公布各种牌的张数';
}
function qc(c) { if (c !== 'S' && !confirm(`确定出「${CARD[c].t}」？`)) return; send({ t: 'quest', card: c }); }
let excalPick = null;
function tog(id) {
  const lim = S.phase === 'assassin' ? 1 : S.teamSizes[S.quest];
  if (sel.has(id)) sel.delete(id); else { if (lim === 1) sel.clear(); if (sel.size < lim) sel.add(id); else toast(`最多选 ${lim} 人`); }
  render();
}

function infoCard() {
  const bits = [];
  if (S.rolesInGame) bits.push(`<div><b>本局角色：</b>${S.rolesInGame.map((r) => `${ROLES[r].emo}${ROLES[r].name}`).join('、')}</div>`);
  if (S.lancelot) bits.push(`<div><b>⚜️ 兰斯洛特（规则${S.lancelot.rule}）：</b>${S.lancelot.rule === 3 ? '不换阵营' : `目前${S.lancelot.swapped ? '<b style="color:var(--evil)">已互换阵营</b>' : '未换阵营'} · 已翻 ${S.lancelot.flips.map((f) => (f.card === 'switch' ? '🔄' : '⏸')).join('') || '无'} · 剩 ${S.lancelot.left} 张`}</div>`);
  if (S.lady) bits.push(`<div><b>🧜‍♀️ 湖中仙女：</b>在 ${nm(S.lady.holder)} 手里${S.lady.log.length ? ' · ' + S.lady.log.map((l) => `${seat(l.holder)}→${seat(l.target)}`).join('，') : ''}</div>`);
  if (S.revealed && S.revealed.length) bits.push(`<div style="color:var(--evil)"><b>📢 暴露者公开：</b>${S.revealed.map(nm).join('、')} 是坏人</div>`);
  return bits.length ? `<div class="card" style="font-size:13px;line-height:1.7"><details ${infoOpen ? 'open' : ''} ontoggle="infoOpen=this.open"><summary>ℹ️ 局面信息</summary>${bits.join('')}</details></div>` : '';
}
let infoOpen = true;

// 票型表：每一次发车，谁是队长、谁在车上、谁投了什么
function voteMatrix() {
  const votes = S.history.filter((x) => x.type === 'vote');
  if (!votes.length) return '';
  const qres = {}; S.history.filter((x) => x.type === 'quest').forEach((x) => (qres[x.quest] = x));
  return `<div class="card"><h3>📊 票型表</h3><div class="mx"><table><tr><th>玩家</th>${votes.map((v) => `<th class="${v.ok ? 'ok' : 'no'}">${v.quest + 1}-${v.attempt}<br>${v.ok ? '通过' : '否决'}</th>`).join('')}</tr>
  ${S.players.map((p) => `<tr><td class="m${marks().m[p.id] || ''}">${MK[marks().m[p.id]] ? MK[marks().m[p.id]].e : ''}${seat(p.id)} ${avH(p.avatar, 'mini')}${esc(p.name)}</td>${votes.map((v) => `<td class="${v.team.includes(p.id) ? 'tm' : ''}">${v.leader === p.id ? '👑' : ''}<span class="${v.votes[p.id] ? 'y' : 'n'}">${v.votes[p.id] ? '✓' : '✗'}</span></td>`).join('')}</tr>`).join('')}
  <tr><td class="mute">任务</td>${votes.map((v) => { const q = v.ok && qres[v.quest]; return `<td>${q ? (q.success ? '🔵' : '🔴') + q.fails + '败' + (q.magics ? q.magics + '✨' : '') : ''}</td>`; }).join('')}</tr></table></div>
  <div class="mute">绿色底色 = 在车上的队员 · 👑 = 队长 · ✓同意 ✗反对 · 列名「2-3」= 第2轮第3次组队</div></div>`;
}

// ---------- 推理标记（只存在自己手机上） ----------
// 点头像：循环标记 好人 → 坏人 → 像梅林 → 存疑 → 清除；长按头像再点另一个人：标记同边 / 互踩
const MK = { good: { e: '🔵', t: '好人' }, evil: { e: '🔴', t: '坏人' }, merlin: { e: '🧙', t: '像梅林' }, unsure: { e: '❓', t: '存疑' } };
const MK_ORDER = [undefined, 'good', 'evil', 'merlin', 'unsure'];
let linkFrom = null, pressT = null, swallowClick = false;
const mkKey = () => `marks_${S.code}_${S.gameId}${S.viewAs ? '_' + S.viewAs : ''}`;
function marks() {
  if (!S || !S.gameId) return { m: {}, r: [] };
  try { return JSON.parse(localStorage[mkKey()] || 'null') || { m: {}, r: [] }; } catch { return { m: {}, r: [] }; }
}
function saveMarks(x) { localStorage[mkKey()] = JSON.stringify(x); render(); }
function avMark(p, i) {
  const m = S.gameId && !WATCH ? marks().m[p.id] : null;
  return `<span class="av ${m ? 'mk-' + m : ''} ${linkFrom === p.id ? 'linking' : ''}" ${S.gameId && !WATCH ? `data-av="${p.id}"` : ''}>${avH(p.avatar)}<span class="seat">${i + 1}</span>${m ? `<span class="mkb">${MK[m].e}</span>` : ''}</span>`;
}
function relChips(id) {
  if (!S.gameId || WATCH) return '';
  return marks().r.filter((r) => r.a === id || r.b === id).map((r) => {
    const o = r.a === id ? r.b : r.a;
    return `<span class="rel ${r.k}">${r.k === 'same' ? '🔗同边' : '⚔️互踩'} ${seat(o)}号</span>`;
  }).join('');
}
function cycleMark(id) {
  const x = marks(); const n = MK_ORDER[(MK_ORDER.indexOf(x.m[id]) + 1) % MK_ORDER.length];
  if (n) x.m[id] = n; else delete x.m[id];
  saveMarks(x);
}
function setRel(a, b, k) {
  const x = marks(); x.r = x.r.filter((r) => !((r.a === a && r.b === b) || (r.a === b && r.b === a)));
  if (k) x.r.push({ a, b, k });
  $('#modal').innerHTML = ''; linkFrom = null; saveMarks(x);
}
function askRel(a, b) {
  linkFrom = null; render();
  $('#modal').innerHTML = `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="box"><h3 style="margin:0 0 10px">${nm(a)} 和 ${nm(b)} 的关系</h3>
  <button class="okb" onclick="setRel('${a}','${b}','same')">🔗 同边（一伙的 / 互保）</button>
  <button class="evil" onclick="setRel('${a}','${b}','opp')">⚔️ 互踩（对立 / 至少一个坏人）</button>
  <button class="sec" onclick="setRel('${a}','${b}',null)">清除关系</button></div></div>`;
}
// 根据关系推一步：同边的人应该同阵营，互踩的人应该不同阵营；发现矛盾就提示
function deductions() {
  const x = marks(), out = [];
  const side = (m) => (m === 'good' || m === 'merlin' ? 'g' : m === 'evil' ? 'e' : null);
  const word = (s) => (s === 'g' ? '好人' : '坏人'), flip = (s) => (s === 'g' ? 'e' : 'g');
  for (const r of x.r) {
    const sa = side(x.m[r.a]), sb = side(x.m[r.b]), A = `${seat(r.a)}号`, B = `${seat(r.b)}号`;
    if (sa && sb) {
      if (r.k === 'same' && sa !== sb) out.push(`⚠️ ${A}和${B}标了同边，但一个好一个坏`);
      if (r.k === 'opp' && sa === sb) out.push(`⚠️ ${A}和${B}标了互踩，但都标成了${word(sa)}`);
    } else if (sa || sb) {
      const known = sa || sb, other = sa ? B : A, by = sa ? A : B;
      out.push(`💡 ${other}和${by}${r.k === 'same' ? '同边' : '互踩'} → ${other}可能是${word(r.k === 'same' ? known : flip(known))}`);
    }
  }
  const evilN = Object.values(x.m).filter((m) => m === 'evil').length;
  const total = S.evilTotal;
  if (evilN > total) out.push(`⚠️ 你标了 ${evilN} 个坏人，但本局只有 ${total} 个`);
  return out;
}
function notesPanel() {
  if (!S.gameId) return '';
  const x = marks(), n = Object.keys(x.m).length + x.r.length, d = deductions();
  return `<div class="card"><h3>🕵️ 我的推理</h3><div class="mute">只保存在你的手机上，别人看不到。<b>点头像</b>循环标记：🔵好人 → 🔴坏人 → 🧙像梅林 → ❓存疑 → 清除；<b>长按头像</b>再点另一个人，可以标记 🔗同边 或 ⚔️互踩。</div>
  ${d.length ? `<div style="margin-top:8px;font-size:13px;line-height:1.7">${d.map(esc).join('<br>')}</div>` : ''}
  ${n ? `<button class="sm sec" onclick="if(confirm('清空本局所有标记？')){localStorage.removeItem(mkKey());render()}">清空标记</button>` : ''}</div>`;
}
// 头像上的点击 / 长按（捕获阶段拦截，避免同时触发选队员）
function avDown(e) {
  if (typeof throwOpen !== 'undefined' && throwOpen) return;
  const el = e.target.closest && e.target.closest('[data-av]'); if (!el) return;
  const id = el.dataset.av; clearTimeout(pressT); swallowClick = false;
  pressT = setTimeout(() => {
    pressT = null; swallowClick = true; vibrate(40);
    if (linkFrom && linkFrom !== id) askRel(linkFrom, id); else { linkFrom = id; render(); }
  }, 450);
}
function avCancel() { clearTimeout(pressT); pressT = null; }
document.addEventListener('touchstart', avDown, { passive: true });
document.addEventListener('mousedown', avDown);
document.addEventListener('touchmove', avCancel, { passive: true });
document.addEventListener('touchend', avCancel);
document.addEventListener('mouseup', avCancel);
document.addEventListener('click', (e) => {
  if (typeof throwOpen !== 'undefined' && throwOpen) return;
  const el = e.target.closest && e.target.closest('[data-av]'); if (!el) return;
  e.stopPropagation(); e.preventDefault();
  if (swallowClick) { swallowClick = false; return; }
  const id = el.dataset.av;
  if (linkFrom) { if (linkFrom === id) { linkFrom = null; render(); } else askRel(linkFrom, id); return; }
  if (selMode()) tog(id); else cycleMark(id);
}, true);
document.addEventListener('contextmenu', (e) => { if (e.target.closest && e.target.closest('[data-av]')) e.preventDefault(); });

// 投票/任务结果弹窗
function maybeEvent() {
  const e = S.lastEvent; if (!e) return;
  const key = 'seen_' + S.code; if (+sessionStorage[key] >= e.seq) return;
  sessionStorage[key] = e.seq;
  let h;
  if (e.type === 'vote') {
    const yes = Object.keys(e.votes).filter((k) => e.votes[k]), no = Object.keys(e.votes).filter((k) => !e.votes[k]);
    h = `<h3 style="margin:0;color:${e.ok ? 'var(--ok)' : 'var(--evil)'}">发车${e.ok ? '通过 ✅' : '被否决 ❌'}</h3>
    <div class="mute">第 ${e.quest + 1} 轮第 ${e.attempt} 次 · 队长 ${nm(e.leader)}</div><div class="mute" style="margin:6px 0">车上：${e.team.map(nm).join('、')}</div>
    <div class="vcol"><div><h4 style="color:var(--ok)">同意 ${yes.length}</h4>${yes.map((i) => `<div>${nm(i)}</div>`).join('')}</div><div><h4 style="color:var(--evil)">反对 ${no.length}</h4>${no.map((i) => `<div>${nm(i)}</div>`).join('')}</div></div>`;
  } else if (e.type === 'lancelot') {
    h = `<h3 style="margin:0">⚜️ 兰斯洛特忠诚牌</h3><div class="cards"><div class="qc ${e.card === 'switch' ? 'f' : 's'}" style="width:110px;font-size:18px">${e.card === 'switch' ? '换阵营' : '不换'}</div></div>
    <div class="center">${e.card === 'switch' ? '两个兰斯洛特交换阵营！' : '阵营不变'}<br><span class="mute">现在：正义兰斯洛特是${e.swapped ? '坏人' : '好人'}，邪恶兰斯洛特是${e.swapped ? '好人' : '坏人'}</span></div>`;
  } else if (e.type === 'lady') {
    h = `<h3 style="margin:0">🧜‍♀️ 湖中仙女</h3><p>${nm(e.holder)} 查验了 ${nm(e.target)}。</p><div class="mute">结果只有查验的人知道，湖中仙女现在交给 ${nm(e.target)}。</div>`;
  } else {
    const cards = Array(e.team.length).fill('s'); for (let i = 0; i < e.fails; i++) cards[cards.length - 1 - i] = 'f';
    for (let i = 0; i < (e.magics || 0); i++) cards[i] = 'm';
    cards.sort(() => Math.random() - 0.5);
    const ex = e.excal ? `<div class="mute center">🔱 ${nm(e.excal.holder)} ${e.excal.target ? `用王者之剑翻转了 ${nm(e.excal.target)} 的牌` : '没有使用王者之剑'}</div>` : '';
    h = ex + `<h3 style="margin:0;color:${e.success ? 'var(--good)' : 'var(--evil)'}">第 ${e.quest + 1} 轮任务${e.success ? '成功 🔵' : '失败 🔴'}</h3>
    <div class="mute" style="margin:6px 0">队员：${e.team.map(nm).join('、')}</div>
    <div class="cards">${cards.map((c, i) => `<div class="qc ${c === 'm' ? 's' : c}" style="animation-delay:${i * 0.25}s;${c === 'm' ? 'background:#7b4fd6' : ''}">${c === 's' ? '✓' : c === 'f' ? '✗' : '✨'}</div>`).join('')}</div>
    <div class="center">${e.fails} 张失败${e.magics ? ` · ${e.magics} 张魔法（${e.magics % 2 ? '结果被反转' : '互相抵消'}）` : ''}${e.need === 2 ? '<br>本轮需要 2 张失败才算失败' : ''}</div>`;
  }
  vibrate(100);
  $('#modal').innerHTML = `<div class="modal" onclick="closeModal()"><div class="box">${h}<button class="sec" style="margin-top:12px">知道了</button></div></div>`;
  if (WATCH) { clearTimeout(maybeEvent._t); maybeEvent._t = setTimeout(closeModal, 10000); }
}

// ---------- 观战 / 投屏大屏 ----------
const WATCH = new URLSearchParams(location.search).get('watch');
const SPEC = (() => { const q = new URLSearchParams(location.search); return q.get('spec') && q.get('name') ? { code: q.get('spec'), name: q.get('name') } : null; })();
if (WATCH) document.body.classList.add('tv');
function tvView() {
  if (!S) return `<h1>阿瓦隆 · 观战</h1><div class="banner">${online ? `正在进入房间 ${esc(WATCH)}…` : '连接中…'}</div>`;
  const joinUrl = location.origin + '/?r=' + S.code;
  const head = `<div class="tvtitle"><h1>阿瓦隆</h1><span class="code">${S.code}</span><span class="tvjoin">手机打开 <b>${esc(location.host)}</b> 输入房间号加入</span><span class="sp" style="margin-left:auto"><span class="dot ${online ? '' : 'off'}" style="display:inline-block"></span> <span onclick="toggleMute()" style="cursor:pointer;font-size:28px">${muted ? '🔇' : '🔔'}</span></span></div>`;
  if (S.phase === 'lobby') {
    return head + `<div class="tvgrid"><div class="card"><h3>玩家 ${S.players.length}/10</h3><div class="players">${S.players.map((p) => `<div data-pid="${p.id}" class="p ${p.online ? '' : 'off'}"><span class="av">${avH(p.avatar)}</span>${esc(p.name)}${p.id === S.hostId ? ' <span class="tag lead">房主</span>' : ''}</div>`).join('')}</div></div>
    <div><div class="card center"><div class="mute" style="font-size:22px">手机打开下面的网址加入</div><div class="code" style="font-size:90px">${S.code}</div><div style="font-size:22px">${esc(joinUrl)}</div></div>
    <div class="card"><h3>本局配置</h3><div style="font-size:20px;line-height:1.8">${lobbyRoleList()}</div></div></div></div>`;
  }
  const n = S.players.length, need = S.teamSizes[S.quest];
  let banner = '';
  if (S.phase === 'propose') banner = `第 ${S.quest + 1} 轮 · 第 ${S.rejects + 1} 次组队 · 👑 ${nm(S.leader)} 选 ${need} 人`;
  else if (S.phase === 'vote') banner = `🚗 发车投票中（${S.voted.length}/${n} 已投）`;
  else if (S.phase === 'quest') banner = `⚔️ 任务执行中（${S.questDone.length}/${S.team.length}）${S.quest === 3 && S.twoFailQuest4 ? ' · 需要 2 张失败' : ''}`;
  else if (S.phase === 'excalibur') banner = `🔱 ${nm(S.excalibur)} 正在决定是否使用王者之剑`;
  else if (S.phase === 'lady') banner = `🧜‍♀️ ${nm(S.lady.holder)} 正在使用湖中仙女`;
  else if (S.phase === 'assassin') banner = `🗡️ 刺杀环节：好人完成 3 次任务，刺客 ${nm(S.assassin)} 正在寻找梅林`;
  else if (S.phase === 'end') banner = `${S.winner === 'good' ? '🏆 正义阵营获胜' : '😈 邪恶阵营获胜'} · ${esc(S.reason)}`;
  const bstyle = S.phase === 'end' ? `background:${S.winner === 'good' ? 'var(--good)' : 'var(--evil)'};color:#fff` : S.phase === 'assassin' ? 'background:#5e1d1d;color:#fff' : '';
  // 大屏：左边是放大的圆桌（中间大沙漏/大字），右边是任务进度和票型
  let left = `<div class="tvtable">${roundTable(centerStage())}</div>`;
  let right = `<div class="banner" style="${bstyle}">${banner}</div>` + questTrack();
  if (S.phase === 'end') right += `<div class="card"><h3>身份揭晓</h3><div class="gallery" style="grid-template-columns:repeat(5,1fr)">${S.allRoles.map((r) => `<div class="gi ${r.evil ? 'e' : 'g'} ${S.assassinTarget === r.id ? 'dead' : ''}"><img class="portrait" src="${img(r.art)}" alt="" onerror="this.onerror=null;this.src='${img(r.role)}'"><div class="cap" style="font-size:15px">${seat(r.id)}号 ${nm(r.id)}<br><b style="color:${r.evil ? '#ff8a85' : '#9cc3ff'}">${r.name}</b></div></div>`).join('')}</div></div>`;
  const side2 = infoCard() + voteMatrix();
  return head + `<div class="tvgrid tvgame"><div class="tvside">${right}</div>${left}<div class="tvside">${side2}</div></div>`;
}
function lobbyRoleList() {
  const st = S.settings, on = Object.keys(ROLES).filter((k) => st[k]);
  const names = ['梅林', ...on.map((k) => ROLES[k].name)];
  if (st.lancelot) names.push(`⚜️兰斯洛特（规则${st.lancelot}）`);
  if (st.lady) names.push('🧜‍♀️湖中仙女'); if (st.excalibur) names.push('🔱王者之剑');
  return names.join('　') + `<div class="mute">每人发言 ${st.speechSecs} 秒</div>`;
}

// ---------- 上帝：多视角测试 ----------
function viewAsBar() {
  const list = S.roster || S.players.map((p) => ({ id: p.id, role: S.allRoles ? (S.allRoles.find((r) => r.id === p.id) || {}).name : '' }));
  return `<div class="card god" style="position:sticky;top:0;z-index:9"><div class="row" style="align-items:center">
    <select onchange="god('viewAs',{id:this.value||null});reveal=false;sel.clear()"><option value="">👁 上帝视角</option>${list.map((r) => `<option value="${r.id}" ${S.viewAs === r.id ? 'selected' : ''}>${seat(r.id)}号 ${esc(P(r.id).name)}${r.role ? ' · ' + r.role : ''}</option>`).join('')}</select>
    ${S.viewAs ? `<button class="sm sec" style="flex:none" onclick="stepView(1)">下一个 ▶</button>` : ''}</div>
    <div class="mute">${S.viewAs ? '你现在看到的就是这个玩家手机上的画面，点按钮等于替他操作。' : '选一个玩家，就能用他的视角看、替他操作，方便一个人测完整局。'}</div>
    ${S.phase === 'lobby' || S.phase === 'end' ? `<div><button class="sm sec" onclick="god('addBots',{n:+prompt('补满到几人？', '7')})">🤖 加机器人凑人数</button><button class="sm sec" onclick="god('removeBots')">移除机器人</button></div>` : ''}</div>`;
}
function stepView(d) {
  const ids = S.players.map((p) => p.id), i = ids.indexOf(S.viewAs);
  god('viewAs', { id: ids[(i + d + ids.length) % ids.length] }); reveal = false; sel.clear();
}

// ---------- 上帝面板 ----------
function godView() {
  const opts = (cur) => Object.keys(ROLES).map((r) => `<option value="${r}" ${r === cur ? 'selected' : ''}>${ROLES[r].emo}${ROLES[r].name}</option>`).join('');
  let h = `<div class="card god"><h3>👁 上帝控制台</h3>`;
  if (S.phase === 'lobby') return h + `<div class="mute">游戏开始后这里会出现调整局面的控件。大厅里可以直接改配置、移出玩家、开始游戏。</div></div>`;
  h += `<details open><summary>身份</summary>${S.players.map((p) => { const r = S.allRoles.find((x) => x.id === p.id); return `<div class="row" style="align-items:center"><span style="flex:1.2">${seat(p.id)} ${nm(p.id)}</span><select style="flex:1" onchange="god('role',{id:'${p.id}',role:this.value})">${opts(r.role)}</select><button class="sm sec" style="flex:none" onclick="god('leader',{id:'${p.id}'})">设队长</button></div>`; }).join('')}
  <div class="mute">改身份后，对应玩家手机上的身份会立刻更新</div></details>`;
  h += `<details open><summary>局面</summary>
  <div class="row" style="align-items:center"><span>否决次数</span><select onchange="god('rejects',{n:this.value})">${[0, 1, 2, 3, 4].map((i) => `<option ${i === S.rejects ? 'selected' : ''}>${i}</option>`).join('')}</select></div>
  ${S.results.map((r, i) => `<div class="row" style="align-items:center"><span>第${i + 1}轮结果</span><select onchange="god('setResult',{i:${i},success:this.value==='1'})"><option value="1" ${r.success ? 'selected' : ''}>成功</option><option value="0" ${r.success ? '' : 'selected'}>失败</option></select></div>`).join('')}
  <div><button class="sm sec" onclick="god('resetRound')">重开本轮组队</button><button class="sm sec" onclick="confirm('撤销上一轮任务结果？')&&god('undoQuest')">撤销上轮任务</button>
  ${S.phase === 'vote' ? `<button class="sm sec" onclick="god('forceVote',{approve:true})">未投的人补同意</button><button class="sm sec" onclick="god('forceVote',{approve:false})">未投的人补反对</button>` : ''}
  ${S.phase === 'quest' ? `<button class="sm sec" onclick="god('forceQuest')">未出牌的补成功</button>` : ''}
  ${S.speech ? `<button class="sm sec" onclick="god('speechSkip')">跳过发言人</button><button class="sm sec" onclick="god('speechAdd')">发言 +30 秒</button>` : ''}
  ${['lady', 'excalibur'].includes(S.phase) ? `<button class="sm sec" onclick="god('skipPhase')">跳过${S.phase === 'lady' ? '湖中仙女' : '王者之剑'}</button>` : ''}
  ${S.lancelot ? `<button class="sm sec" onclick="god('swapLancelot')">兰斯洛特换阵营</button><span class="mute">剩余忠诚牌：${(S.lancelotDeck || []).map((c) => (c === 'switch' ? '🔄' : '⏸')).join('') || '无'}</span>` : ''}
  <button class="sm sec" onclick="god('toAssassin')">直接进入刺杀</button>
  <button class="sm good" onclick="confirm('判好人胜？')&&god('end',{winner:'good'})">判好人胜</button><button class="sm evil" onclick="confirm('判坏人胜？')&&god('end',{winner:'evil'})">判坏人胜</button>
  <button class="sm sec" onclick="confirm('回到大厅？本局作废')&&god('lobby')">回大厅</button></div></details>
</div>`;
  return h;
}

function rulesView() {
  return `${S ? `<div class="card"><details><summary>🖼️ 角色图鉴</summary><div class="gallery" style="margin-top:8px">${Object.entries(ROLES).map(([k, R]) => `<div class="gi ${R.side === 'good' ? 'g' : 'e'}" onclick="showDetail('${k}',this.querySelector('img'))"><img class="portrait" loading="lazy" src="${img(k)}" alt="" onerror="this.style.visibility='hidden'"><i class="frm"></i><div class="cap">${R.emo} ${R.name}</div></div>`).join('')}</div></details></div>` : ''}
  <div class="card rules"><details><summary>📜 规则速查</summary>
  <p><b>胜负：</b>好人完成 3 次任务，并且最后梅林没被刺中，好人赢。任务失败 3 次、连续 5 次组队被否决、或者刺客刺中梅林，坏人赢。</p>
  <ol><li><b>组队（发车）：</b>队长按本轮人数选队员（可以选自己）。发车前可以开启「轮流发言」，每人限时发言。</li>
  <li><b>发车投票：</b>所有人投同意或反对，全员投完后一起公布，记入票型表。超过半数同意才算通过；否则下一位当队长，否决计数 +1。</li>
  <li><b>出牌只在车上：</b>只有被选上车的队员才出任务牌，车下的人不出牌，所以所有「出牌类」能力（魔法、疯子、莽夫等）都只在车上有效；被动能力（看人、被查验时的显示等）不用操作，系统自动生效。</li>
  <li><b>任务：</b>队员匿名出牌，好人只能出成功，坏人可以出成功或失败。出现 1 张失败任务就失败（7 人以上的第 4 轮需要 2 张）。</li>
  <li><b>刺杀：</b>好人完成 3 次任务后，所有坏人亮明身份商量，由刺客选一个人刺杀，刺中梅林则坏人翻盘。</li></ol>
  <p><b>人数配置：</b>5人 3好2坏｜6人 4好2坏｜7人 4好3坏｜8人 5好3坏｜9人 6好3坏｜10人 6好4坏</p>
  <p><b>每轮车上人数：</b>5人 2-3-2-3-3｜6人 2-3-4-3-4｜7人 2-3-3-4-4｜8-10人 3-4-4-5-5</p>
  <p><b>角色：</b></p><ul>${Object.values(ROLES).map((R) => `<li>${R.emo} <b>${R.name}</b>（${R.side === 'good' ? '好' : '坏'}）：${R.know}</li>`).join('')}</ul>
  <p><b>道具：</b>🧜‍♀️湖中仙女：第 2、3、4 轮任务后，持有人秘密查验一名没拿过的人的阵营，然后交给他。🔱王者之剑：队长发车时交给一名队员（不能给自己），出完牌后他可以翻转另一名队员的牌。⚜️兰斯洛特：一好一坏，翻出「换阵营」忠诚牌时两人互换阵营（规则 1：5 张牌里 2 张换，从第 3 轮起每次组队翻 1 张；规则 2：7 张里 2 张换，抽 5 张，每轮开始翻 1 张；规则 3：不换，但两人互相认识）。✨魔法牌：巫师专用，反转任务结果。</p>
  <p><b>推理标记：</b>点头像标记好坏，长按头像再点另一个人标记同边或互踩。标记只保存在你的手机上。</p>
  <p><b>掉线了？</b>重新打开链接会自动回到房间。换了手机就填同一个房间号和原来的昵称。</p>
  </details></div>`;
}

// ---------- 铃声（Web Audio 合成，无需音频文件） ----------
let actx = null, lastWarnKey = null, muted = localStorage.muted === '1';
function unlockAudio() { if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch {} } if (actx && actx.state === 'suspended') actx.resume(); }
document.addEventListener('touchend', unlockAudio, { passive: true }); document.addEventListener('click', unlockAudio);
function tone(freq, start, dur, vol) {
  const o = actx.createOscillator(), g = actx.createGain(); o.type = 'sine'; o.frequency.value = freq;
  g.gain.setValueAtTime(0, actx.currentTime + start); g.gain.linearRampToValueAtTime(vol, actx.currentTime + start + 0.01);
  g.gain.exponentialRampToValueAtTime(0.001, actx.currentTime + start + dur);
  o.connect(g).connect(actx.destination); o.start(actx.currentTime + start); o.stop(actx.currentTime + start + dur);
}
function bell() { if (muted || !actx) return; [0, 0.35, 0.7].forEach((t) => { tone(880, t, 0.9, 0.35); tone(1320, t, 0.6, 0.12); }); vibrate([200, 100, 200]); }
function tickSound() { if (muted || !actx) return; tone(660, 0, 0.12, 0.15); }
function toggleMute() { muted = !muted; localStorage.muted = muted ? '1' : '0'; unlockAudio(); if (!muted) tickSound(); render(); }

// 计时器只刷新数字，不整页重绘
function tick() {
  const now = Date.now() + clockSkew;
  document.querySelectorAll('.timer[data-end]').forEach((el) => {
    const left = Math.max(0, Math.ceil((+el.dataset.end - now) / 1000));
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    el.classList.toggle('warn', left <= 10);
    const key = el.dataset.end + ':' + left; // 最后 5 秒每秒滴一声
    if (left > 0 && left <= 5 && key !== lastWarnKey) { lastWarnKey = key; tickSound(); }
  });
  document.querySelectorAll('.bar i[data-end]').forEach((el) => { el.style.width = Math.max(0, Math.min(100, ((+el.dataset.end - now) / 1000 / +el.dataset.secs) * 100)) + '%'; });
}
setInterval(tick, 500);
// 刺杀超时：疯狂提醒——刺客/坏人手机每 3 秒震动+警报，投屏全屏红闪+警报，直到刺下去
let lastNag = 0;
setInterval(() => {
  const over = S && S.phase === 'assassin' && S.assassinEndsAt && Date.now() + clockSkew > S.assassinEndsAt;
  document.body.classList.toggle('nag', !!over);
  if (!over || Date.now() - lastNag < 3000) return;
  lastNag = Date.now();
  const amA = S.assassin === S.me, amEvil = S.evilTeam && S.evilTeam.includes(S.me);
  if (amA || amEvil || WATCH) {
    if (!muted && actx) [0, 0.18, 0.36].forEach((t) => tone(amA ? 1200 : 900, t, 0.12, 0.25));
    if (amA) { vibrate([300, 100, 300, 100, 300]); toast('⏰ 超时了！快刺！'); } else if (amEvil) vibrate(200);
  }
}, 500);

// 按住看身份
const isRc = (e) => e.target.closest && e.target.closest('#rc');
let revealAnim = false;
// 修复：按下后页面重绘会把手指下的元素换掉，旧元素收到的 touchend 不会冒泡到 document，
// 所以直接在按下的那个元素上监听松手；再加几道保险（离开页面 / 失焦 / 指针取消）
const on = (e) => {
  if (!isRc(e)) return;
  e.preventDefault();
  const t = e.target;
  ['touchend', 'touchcancel'].forEach((k) => t.addEventListener(k, off, { once: true }));
  reveal = true; revealAnim = true; render(); revealAnim = false;
};
const off = () => { if (reveal) { reveal = false; render(); } };
document.addEventListener('touchstart', on, { passive: false }); document.addEventListener('mousedown', on);
document.addEventListener('touchend', off); document.addEventListener('mouseup', off); document.addEventListener('touchcancel', off);
window.addEventListener('blur', off); document.addEventListener('visibilitychange', off); window.addEventListener('pointercancel', off);
document.addEventListener('contextmenu', (e) => isRc(e) && e.preventDefault());

// table.js 在 app.js 之后加载并覆盖部分函数，等所有脚本执行完再首次渲染
document.addEventListener('DOMContentLoaded', () => { render(); connect(); });
document.addEventListener('click', (e) => { const sm = e.target.closest && e.target.closest('summary'); if (!sm) return; const d = sm.parentNode; requestAnimationFrame(() => { if (d.open) { d.classList.add('just'); setTimeout(() => d.classList.remove('just'), 400); } }); });
