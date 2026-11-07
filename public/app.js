const $ = (s) => document.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));
const token = localStorage.token || (localStorage.token = uuid());
const AVATARS = ['🦁', '🐺', '🦊', '🐻', '🐼', '🐯', '🦉', '🦅', '🐉', '🦄', '🐸', '🐙', '🦈', '🐢', '🦌', '🐗', '🐰', '🐱', '🐶', '🐧'];
let ws, S = null, sel = new Set(), reveal = false, online = false, clockSkew = 0, pinFor = null, showGuide = false;
let myAvatar = localStorage.avatar || AVATARS[Math.floor(Math.random() * AVATARS.length)];

function toast(m, ok) { const t = $('#toast'); t.textContent = m; t.style.background = ok ? 'var(--ok)' : 'var(--evil)'; t.style.display = 'block'; clearTimeout(t._h); t._h = setTimeout(() => (t.style.display = 'none'), 2800); }
function send(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); else toast('正在重连，请稍等…'); }
const god = (a, extra) => send({ t: 'g', a, ...extra });
const vibrate = (ms) => navigator.vibrate && navigator.vibrate(ms);

// ---------- 连接 & 自动重连 ----------
function connect() {
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host);
  ws.onopen = () => {
    online = true;
    if (localStorage.room && localStorage.name) send({ t: 'join', code: localStorage.room, name: localStorage.name, avatar: myAvatar, token });
    if (localStorage.godRoom && sessionStorage.godPw) send({ t: 'god', code: localStorage.godRoom, password: sessionStorage.godPw });
    render();
  };
  ws.onmessage = (e) => {
    const m = JSON.parse(e.data);
    if (m.t === 'joined') { localStorage.room = m.code; pinFor = null; history.replaceState(null, '', '?r=' + m.code); }
    if (m.t === 'godOk') { localStorage.godRoom = m.code; toast('已进入上帝模式', true); }
    if (m.t === 'needPin') { pinFor = m.name; S = null; render(); toast('这个昵称已在房间里。如果是你本人，请输入重连码'); }
    if (m.t === 'kicked') { delete localStorage.room; S = null; toast(m.m); render(); }
    if (m.t === 'state') {
      const prev = S;
      S = m.s; clockSkew = S.now - Date.now();
      if (prev && (prev.phase !== S.phase || prev.quest !== S.quest)) sel.clear();
      if (S.phase === 'propose' && S.leader === S.me && (!prev || prev.leader !== S.me || prev.phase !== 'propose')) vibrate([80, 60, 80]);
      if (S.speech && S.speech.order[S.speech.idx] === S.me && (!prev || !prev.speech || prev.speech.idx !== S.speech.idx)) vibrate(200);
      render(); maybeEvent();
    }
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
const nm = (id) => `${P(id).avatar}${esc(P(id).name)}`;
const seat = (id) => S.players.findIndex((p) => p.id === id) + 1;
const isGod = () => S && S.god;

// ---------- 渲染 ----------
function render() {
  const app = $('#app');
  if (!S) return (app.innerHTML = homeView());
  const meP = S.players.find((p) => p.id === S.me);
  let h = `<div class="top"><span class="dot ${online ? '' : 'off'}"></span>房间 <b>${S.code}</b>
    ${meP ? `· ${meP.avatar} ${esc(meP.name)}${S.me === S.hostId ? '（房主）' : ''}` : ''}${isGod() ? ' · <b style="color:#c9a6ff">👁 上帝</b>' : ''}
    <span class="sp">${S.myPin ? `重连码 <b>${S.myPin}</b>` : ''}</span></div>`;
  if (!online) h += `<div class="banner" style="background:#5e1d1d;color:#fff">连接断开，正在自动重连…</div>`;
  h += S.phase === 'lobby' ? lobbyView() : gameView();
  if (isGod()) h += godView();
  h += rulesView();
  if (meP) h += `<button class="sec" onclick="leave()">离开房间</button>`;
  app.innerHTML = h;
  tick();
}

function homeView() {
  const code = new URLSearchParams(location.search).get('r') || localStorage.room || '';
  return `<h1>阿瓦隆</h1><div class="sub">线下面杀 · 手机看身份 · 线上投票</div>
  <div class="card"><h3>选个头像</h3><div class="avpick">${AVATARS.map((a) => `<span class="${a === myAvatar ? 'on' : ''}" onclick="pickAv('${a}')">${a}</span>`).join('')}</div>
  <input id="nm" placeholder="你的昵称" maxlength="12" value="${esc(pinFor || localStorage.name || '')}">
  <input id="cd" placeholder="房间号（4位）" inputmode="numeric" maxlength="4" value="${esc(code)}">
  ${pinFor ? `<input id="pin" placeholder="重连码（游戏页右上角的4位数）" inputmode="numeric" maxlength="4"><div class="mute">掉线换了设备？填原来的昵称和重连码就能回到原来的位置，身份不会变。忘了重连码可以找上帝或者看原来的手机。</div>` : ''}
  <button onclick="doJoin()">${pinFor ? '恢复连接' : '加入房间'}</button>
  ${pinFor ? '' : '<button class="sec" onclick="doCreate()">创建新房间</button>'}</div>
  <div class="card god"><details><summary>👁 上帝模式（裁判 / 调试）</summary>
  <input id="gcd" placeholder="房间号" inputmode="numeric" maxlength="4" value="${esc(code)}"><input id="gpw" type="password" placeholder="上帝密码">
  <button class="sec" onclick="doGod()">以上帝身份进入</button><div class="mute">上帝能看到所有人的身份和实时投票，还可以调整局面。上帝不占玩家位置。</div></details></div>
  ${rulesView()}`;
}
function pickAv(a) { myAvatar = a; localStorage.avatar = a; if (S) send({ t: 'profile', avatar: a }); render(); }
function getName() { const n = $('#nm').value.trim(); if (!n) { toast('先输入昵称'); return null; } localStorage.name = n; return n; }
function doCreate() { const n = getName(); if (n) send({ t: 'create', name: n, avatar: myAvatar, token }); }
function doJoin() {
  const n = getName(); const c = $('#cd').value.trim(); if (!n) return;
  if (!/^\d{4}$/.test(c)) return toast('房间号是 4 位数字');
  const pin = $('#pin') && $('#pin').value.trim();
  send({ t: 'join', code: c, name: n, avatar: myAvatar, token, pin });
}
function doGod() {
  const c = $('#gcd').value.trim(), pw = $('#gpw').value;
  if (!/^\d{4}$/.test(c) || !pw) return toast('填写房间号和密码');
  sessionStorage.godPw = pw; send({ t: 'god', code: c, password: pw });
}
function leave() {
  if (!confirm('确定离开房间？（游戏中离开后，可以用昵称 + 重连码回来）')) return;
  delete localStorage.room; delete localStorage.godRoom; S = null; history.replaceState(null, '', '/'); ws.close();
}

function lobbyView() {
  const host = S.me === S.hostId || isGod(), st = S.settings, n = S.players.length;
  const ck = (k, label) => `<label class="ck"><input type="checkbox" ${st[k] ? 'checked' : ''} ${host ? '' : 'disabled'} onchange="setS({${k}:this.checked})">${label}</label>`;
  return `<div class="card center"><div class="mute">把房间号告诉大家，或者分享链接</div><div class="code">${S.code}</div>
    <button class="sec" onclick="share()">复制邀请链接</button></div>
  ${S.me ? `<div class="card"><h3>我的头像</h3><div class="avpick">${AVATARS.map((a) => `<span class="${a === P(S.me).avatar ? 'on' : ''}" onclick="pickAv('${a}')">${a}</span>`).join('')}</div></div>` : ''}
  <div class="card"><h3>玩家 ${n}/10（5 人起）</h3><div class="players">${S.players.map((p) => `<div class="p ${p.online ? '' : 'off'}"><span class="av">${p.avatar}</span>${esc(p.name)}<span class="tags">${p.id === S.hostId ? '<span class="tag lead">房主</span>' : ''}${p.online ? '' : '<span class="tag">离线</span>'}${host && p.id !== S.me ? `<span class="tag" onclick="${isGod() ? `god('kick',{id:'${p.id}'})` : `send({t:'kick',id:'${p.id}'})`}">移出</span>` : ''}</span></div>`).join('')}</div></div>
  <div class="card"><h3>角色配置</h3><div class="mute">梅林、刺客一定有，其余位置自动补忠臣和爪牙</div>
    ${ck('percival', '🛡️ 派西维尔（好人）')}${ck('morgana', '🔮 莫甘娜（坏人）')}${ck('mordred', '👑 莫德雷德（坏人）')}${ck('oberon', '🌑 奥伯伦（坏人）')}
    <label class="ck">⏱ 每人发言时长 <select style="width:auto" ${host ? '' : 'disabled'} onchange="setS({speechSecs:+this.value})">${[30, 60, 90, 120, 180, 300].map((s) => `<option value="${s}" ${st.speechSecs === s ? 'selected' : ''}>${s >= 60 ? s / 60 + ' 分钟' : s + ' 秒'}</option>`).join('')}</select></label></div>
  ${host ? `<button onclick="${isGod() ? "god('start')" : "send({t:'start'})"}" ${n < 5 ? 'disabled' : ''}>开始游戏 · 发身份</button>` : '<div class="banner">等待房主开始</div>'}`;
}
function setS(s) { isGod() && S.me !== S.hostId ? god('settings', { settings: s }) : send({ t: 'settings', settings: s }); }
function share() { const u = location.origin + '/?r=' + S.code; navigator.clipboard ? navigator.clipboard.writeText(u).then(() => toast('已复制：' + u, true)) : prompt('复制链接', u); }

function roleCard() {
  const r = S.myRole; if (!r) return '';
  const R = ROLES[r.role];
  const inner = reveal
    ? `<div class="emo">${R.emo}</div><div class="nm" style="color:${r.evil ? '#ff8a85' : '#9cc3ff'}">${r.name}</div><div>${r.evil ? '邪恶阵营' : '正义阵营'}</div>
       <div class="mute" style="margin-top:6px">${R.know}</div>
       ${r.sees.length ? `<div style="margin-top:8px;display:flex;gap:4px;flex-wrap:wrap;justify-content:center">${r.sees.map((x) => `<span class="tag ${r.evil ? 'evil' : 'good'}">${seat(x.id)}号 ${nm(x.id)} · ${x.tag}</span>`).join('')}</div>` : ''}`
    : `<div class="emo">🂠</div><div class="nm">按住查看身份</div><div class="mute">松手就隐藏，注意别让旁边的人看到</div>`;
  return `<div class="role ${reveal ? 'show ' + (r.evil ? 'e' : 'g') : ''}" id="rc">${inner}</div>
  <div class="card guide"><details ${showGuide ? 'open' : ''} ontoggle="showGuide=this.open"><summary>📖 我的角色怎么玩（展开前确认旁边没人偷看）</summary>
  <p><b>${R.emo} ${R.name}</b>（${R.side === 'good' ? '好人' : '坏人'}）</p><p><b>你知道：</b>${R.know}</p><p><b>目标：</b>${R.goal}</p><ul>${R.tips.map((t) => `<li>${t}</li>`).join('')}</ul></details></div>`;
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
  return `<div class="card" style="border-color:var(--ok)"><div class="speech"><span class="av" style="font-size:30px;width:46px;height:46px">${P(cur).avatar}</span>
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
    if (S.phase === 'quest' && S.team.includes(p.id)) tags.push(S.questDone.includes(p.id) ? (isGod() ? `<span class="tag ${S.liveCards[p.id] ? 'good' : 'evil'}">${S.liveCards[p.id] ? '成功' : '失败'}</span>` : '<span class="tag">已出牌</span>') : '<span class="tag">执行中</span>');
    if (S.evilSuggest) { const n = Object.values(S.evilSuggest).filter((x) => x === p.id).length; if (n) tags.push(`<span class="tag evil">🎯×${n}</span>`); }
    if (S.evilTeam && S.evilTeam.includes(p.id) && !S.allRoles) tags.push('<span class="tag evil">坏人</span>');
    if (S.allRoles) { const r = S.allRoles.find((x) => x.id === p.id); tags.push(`<span class="tag ${r.evil ? 'evil' : 'good'}">${ROLES[r.role].emo}${r.name}</span>`); }
    if (S.assassinTarget === p.id) tags.push('<span class="tag evil">🗡️被刺</span>');
    if (!p.online) tags.push('<span class="tag">离线</span>');
    return `<div class="p ${p.online ? '' : 'off'} ${sel.has(p.id) ? 'sel' : ''} ${cur === p.id ? 'speak' : ''}" ${clickable ? `onclick="tog('${p.id}')"` : ''}>
      <span class="av">${p.avatar}<span class="seat">${i + 1}</span></span>${esc(p.name)}${p.id === S.me ? '<span class="mute">（我）</span>' : ''}<span class="tags">${tags.join('')}</span></div>`;
  }).join('')}</div>`;
}

function gameView() {
  const n = S.players.length, iAmLeader = S.leader === S.me, need = S.teamSizes[S.quest];
  let h = roleCard() + questTrack() + speechPanel();
  if (S.phase === 'propose') {
    h += `<div class="banner">第 ${S.quest + 1} 轮 · 第 ${S.rejects + 1} 次组队 · 队长 ${nm(S.leader)} 选 ${need} 人</div>`;
    h += `<div class="card">${plist(iAmLeader)}${iAmLeader ? `<button onclick="send({t:'propose',team:[...sel]})" ${sel.size !== need ? 'disabled' : ''}>🚗 发车（${sel.size}/${need}）</button><div class="mute center">点玩家选择队员，可以选自己</div>` : '<div class="mute center" style="margin-top:8px">等队长选人，大家可以开始讨论</div>'}</div>`;
  } else if (S.phase === 'vote') {
    h += `<div class="banner">🚗 发车投票：是否同意这支队伍？（${S.voted.length}/${n} 已投）</div><div class="card">${plist(false)}`;
    h += S.myVote === undefined ? (S.me ? `<div class="row"><button class="okb" onclick="send({t:'vote',approve:true})">同意 👍</button><button class="evil" onclick="send({t:'vote',approve:false})">反对 👎</button></div>` : '')
      : `<div class="mute center" style="margin-top:8px">你投了「${S.myVote ? '同意' : '反对'}」，等其他人…全员投完后一起公布</div>`;
    if (iAmLeader && !S.voted.length) h += `<button class="sm sec" onclick="send({t:'unpropose'})">↩ 重新选人</button>`;
    h += '</div>';
  } else if (S.phase === 'quest') {
    const inTeam = S.team.includes(S.me);
    h += `<div class="banner">⚔️ 任务执行中（${S.questDone.length}/${S.team.length}）${S.quest === 3 && S.twoFailQuest4 ? ' · 本轮需要 2 张失败' : ''}</div><div class="card">${plist(false)}`;
    if (inTeam && !S.myCard) h += S.myRole.evil
      ? `<div class="row"><button class="good" onclick="qc(true)">成功 ✓</button><button class="evil" onclick="qc(false)">失败 ✗</button></div><div class="mute center">出牌是匿名的，只公布失败的张数</div>`
      : `<button class="good" onclick="qc(true)">成功 ✓</button><div class="mute center">好人只能出成功</div>`;
    else h += `<div class="mute center" style="margin-top:8px">${inTeam ? '已出牌，等待其他队员' : '等待队员出牌'}</div>`;
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
    h += `<div class="card"><h3>身份揭晓</h3>${plist(false)}</div>`;
    if (S.me === S.hostId || isGod()) h += `<button onclick="${isGod() && S.me !== S.hostId ? "god('start')" : "send({t:'start'})"}">再来一局（重新发身份）</button><button class="sec" onclick="${isGod() && S.me !== S.hostId ? "god('lobby')" : "send({t:'lobby'})"}">回到大厅改配置</button>`;
  }
  h += voteMatrix();
  return h;
}
function qc(ok) { if (!ok && !confirm('确定出「失败」？')) return; send({ t: 'quest', success: ok }); }
function tog(id) {
  const lim = S.phase === 'assassin' ? 1 : S.teamSizes[S.quest];
  if (sel.has(id)) sel.delete(id); else { if (lim === 1) sel.clear(); if (sel.size < lim) sel.add(id); else toast(`最多选 ${lim} 人`); }
  render();
}

// 票型表：每一次发车，谁是队长、谁在车上、谁投了什么
function voteMatrix() {
  const votes = S.history.filter((x) => x.type === 'vote');
  if (!votes.length) return '';
  const qres = {}; S.history.filter((x) => x.type === 'quest').forEach((x) => (qres[x.quest] = x));
  return `<div class="card"><h3>📊 票型表</h3><div class="mx"><table><tr><th>玩家</th>${votes.map((v) => `<th class="${v.ok ? 'ok' : 'no'}">${v.quest + 1}-${v.attempt}<br>${v.ok ? '通过' : '否决'}</th>`).join('')}</tr>
  ${S.players.map((p) => `<tr><td>${seat(p.id)} ${p.avatar}${esc(p.name)}</td>${votes.map((v) => `<td class="${v.team.includes(p.id) ? 'tm' : ''}">${v.leader === p.id ? '👑' : ''}<span class="${v.votes[p.id] ? 'y' : 'n'}">${v.votes[p.id] ? '✓' : '✗'}</span></td>`).join('')}</tr>`).join('')}
  <tr><td class="mute">任务</td>${votes.map((v) => { const q = v.ok && qres[v.quest]; return `<td>${q ? (q.success ? '🔵' : '🔴') + q.fails + '败' : ''}</td>`; }).join('')}</tr></table></div>
  <div class="mute">绿色底色 = 在车上的队员 · 👑 = 队长 · ✓同意 ✗反对 · 列名「2-3」= 第2轮第3次组队</div></div>`;
}

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
  } else {
    const cards = Array(e.team.length).fill('s'); for (let i = 0; i < e.fails; i++) cards[cards.length - 1 - i] = 'f';
    cards.sort(() => Math.random() - 0.5);
    h = `<h3 style="margin:0;color:${e.success ? 'var(--good)' : 'var(--evil)'}">第 ${e.quest + 1} 轮任务${e.success ? '成功 🔵' : '失败 🔴'}</h3>
    <div class="mute" style="margin:6px 0">队员：${e.team.map(nm).join('、')}</div>
    <div class="cards">${cards.map((c, i) => `<div class="qc ${c}" style="animation-delay:${i * 0.25}s">${c === 's' ? '✓' : '✗'}</div>`).join('')}</div>
    <div class="center">${e.fails} 张失败${e.need === 2 ? '（本轮需要 2 张失败才算失败）' : ''}</div>`;
  }
  vibrate(100);
  $('#modal').innerHTML = `<div class="modal" onclick="this.remove()"><div class="box">${h}<button class="sec" style="margin-top:12px">知道了</button></div></div>`;
}

// ---------- 上帝面板 ----------
function godView() {
  const opts = (cur) => Object.keys(ROLES).map((r) => `<option value="${r}" ${r === cur ? 'selected' : ''}>${ROLES[r].emo}${ROLES[r].name}</option>`).join('');
  let h = `<div class="card god"><h3>👁 上帝控制台</h3>`;
  if (S.phase === 'lobby') return h + `<details><summary>重连码</summary>${S.players.map((p) => `<div>${nm(p.id)}：<b>${S.pins[p.id]}</b></div>`).join('')}</details><div class="mute">游戏开始后这里会出现调整局面的控件。大厅里可以直接改配置、移出玩家、开始游戏。</div></div>`;
  h += `<details open><summary>身份</summary>${S.players.map((p) => { const r = S.allRoles.find((x) => x.id === p.id); return `<div class="row" style="align-items:center"><span style="flex:1.2">${seat(p.id)} ${nm(p.id)}</span><select style="flex:1" onchange="god('role',{id:'${p.id}',role:this.value})">${opts(r.role)}</select><button class="sm sec" style="flex:none" onclick="god('leader',{id:'${p.id}'})">设队长</button></div>`; }).join('')}
  <div class="mute">改身份后，对应玩家手机上的身份会立刻更新</div></details>`;
  h += `<details open><summary>局面</summary>
  <div class="row" style="align-items:center"><span>否决次数</span><select onchange="god('rejects',{n:this.value})">${[0, 1, 2, 3, 4].map((i) => `<option ${i === S.rejects ? 'selected' : ''}>${i}</option>`).join('')}</select></div>
  ${S.results.map((r, i) => `<div class="row" style="align-items:center"><span>第${i + 1}轮结果</span><select onchange="god('setResult',{i:${i},success:this.value==='1'})"><option value="1" ${r.success ? 'selected' : ''}>成功</option><option value="0" ${r.success ? '' : 'selected'}>失败</option></select></div>`).join('')}
  <div><button class="sm sec" onclick="god('resetRound')">重开本轮组队</button><button class="sm sec" onclick="confirm('撤销上一轮任务结果？')&&god('undoQuest')">撤销上轮任务</button>
  ${S.phase === 'vote' ? `<button class="sm sec" onclick="god('forceVote',{approve:true})">未投的人补同意</button><button class="sm sec" onclick="god('forceVote',{approve:false})">未投的人补反对</button>` : ''}
  ${S.phase === 'quest' ? `<button class="sm sec" onclick="god('forceQuest')">未出牌的补成功</button>` : ''}
  ${S.speech ? `<button class="sm sec" onclick="god('speechSkip')">跳过发言人</button><button class="sm sec" onclick="god('speechAdd')">发言 +30 秒</button>` : ''}
  <button class="sm sec" onclick="god('toAssassin')">直接进入刺杀</button>
  <button class="sm good" onclick="confirm('判好人胜？')&&god('end',{winner:'good'})">判好人胜</button><button class="sm evil" onclick="confirm('判坏人胜？')&&god('end',{winner:'evil'})">判坏人胜</button>
  <button class="sm sec" onclick="confirm('回到大厅？本局作废')&&god('lobby')">回大厅</button></div></details>
  <details><summary>重连码（玩家换设备时用）</summary>${S.players.map((p) => `<div>${seat(p.id)} ${nm(p.id)}：<b>${S.pins[p.id]}</b></div>`).join('')}</details></div>`;
  return h;
}

function rulesView() {
  return `<div class="card rules"><details><summary>📜 规则速查</summary>
  <p><b>胜负：</b>好人完成 3 次任务，并且最后梅林没被刺中，好人赢。任务失败 3 次、连续 5 次组队被否决、或者刺客刺中梅林，坏人赢。</p>
  <ol><li><b>组队（发车）：</b>队长按本轮人数选队员（可以选自己）。发车前可以开启「轮流发言」，每人限时发言。</li>
  <li><b>发车投票：</b>所有人投同意或反对，全员投完后一起公布，记入票型表。超过半数同意才算通过；否则下一位当队长，否决计数 +1。</li>
  <li><b>任务：</b>队员匿名出牌，好人只能出成功，坏人可以出成功或失败。出现 1 张失败任务就失败（7 人以上的第 4 轮需要 2 张）。</li>
  <li><b>刺杀：</b>好人完成 3 次任务后，所有坏人亮明身份商量，由刺客选一个人刺杀，刺中梅林则坏人翻盘。</li></ol>
  <p><b>人数配置：</b>5人 3好2坏｜6人 4好2坏｜7人 4好3坏｜8人 5好3坏｜9人 6好3坏｜10人 6好4坏</p>
  <p><b>每轮车上人数：</b>5人 2-3-2-3-3｜6人 2-3-4-3-4｜7人 2-3-3-4-4｜8-10人 3-4-4-5-5</p>
  <p><b>角色：</b></p><ul>${Object.values(ROLES).map((R) => `<li>${R.emo} <b>${R.name}</b>（${R.side === 'good' ? '好' : '坏'}）：${R.know}</li>`).join('')}</ul>
  <p><b>掉线了？</b>重新打开链接会自动回到房间。换了手机就填原来的昵称 + 重连码（游戏页右上角）。</p>
  </details></div>`;
}

// 计时器只刷新数字，不整页重绘
function tick() {
  const now = Date.now() + clockSkew;
  document.querySelectorAll('.timer[data-end]').forEach((el) => {
    const left = Math.max(0, Math.ceil((+el.dataset.end - now) / 1000));
    el.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    el.classList.toggle('warn', left <= 10);
  });
  document.querySelectorAll('.bar i[data-end]').forEach((el) => { el.style.width = Math.max(0, Math.min(100, ((+el.dataset.end - now) / 1000 / +el.dataset.secs) * 100)) + '%'; });
}
setInterval(tick, 500);

// 按住看身份
const isRc = (e) => e.target.closest && e.target.closest('#rc');
const on = (e) => { if (isRc(e)) { e.preventDefault(); reveal = true; render(); } };
const off = () => { if (reveal) { reveal = false; render(); } };
document.addEventListener('touchstart', on, { passive: false }); document.addEventListener('mousedown', on);
document.addEventListener('touchend', off); document.addEventListener('mouseup', off); document.addEventListener('touchcancel', off);
document.addEventListener('contextmenu', (e) => isRc(e) && e.preventDefault());

render(); connect();
