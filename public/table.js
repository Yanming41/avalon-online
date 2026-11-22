// 对局界面 v3：圆桌座位 + 底部单一操作栏 + 沙漏计时 + 统一图标（覆盖 app.js 里的同名函数）

// ---------- 图标（金色线条 SVG，替代 emoji） ----------
const ICO = {
  crown: '<path d="M3 17h18l-1.5-9-4.5 4-3-6-3 6-4.5-4z"/><path d="M4 20h16"/>',
  sword: '<path d="M14.5 4H20v5.5L9 20.5 3.5 15z"/><path d="M5 13l6 6M3 21l3-3"/>',
  check: '<path d="M4 12.5l5 5L20 6"/>',
  cross: '<path d="M6 6l12 12M18 6L6 18"/>',
  eye: '<path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  scroll: '<path d="M6 4h11a2 2 0 012 2v12a2 2 0 01-2 2H7"/><path d="M6 4a2 2 0 00-2 2v1h4V6a2 2 0 00-2-2zM9 9h7M9 13h7M9 17h4"/>',
  bell: '<path d="M6 16V11a6 6 0 0112 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 004 0"/>',
  mute: '<path d="M6 16V11a6 6 0 019.5-4.9M18 11v5l1.5 2H8"/><path d="M3 3l18 18"/>',
  grail: '<path d="M7 3h10v4a5 5 0 01-10 0z"/><path d="M12 12v5M8 21h8M9.5 17h5"/>',
  dagger: '<path d="M12 2l2 4v9h-4V6z"/><path d="M7 15h10M12 15v7"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>',
  wave: '<path d="M3 12c3-4 5-4 9 0s6 4 9 0"/>',
  book: '<path d="M4 5a2 2 0 012-2h13v16H6a2 2 0 00-2 2z"/><path d="M4 19V5M8 7h7"/>',
  next: '<path d="M6 5l8 7-8 7M16 5v14"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  target: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>',
  lady: '<path d="M12 3c-2 3-2 5 0 7 2-2 2-4 0-7z"/><path d="M4 18c3-2 5-2 8 0s5 2 8 0M4 21c3-2 5-2 8 0s5 2 8 0"/>',
  offline: '<path d="M5 12.5a10 10 0 0114 0M8.5 16a5 5 0 017 0"/><circle cx="12" cy="19" r="1"/><path d="M3 3l18 18"/>',
  magic: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/>',
};
const ic = (k, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICO[k] || ''}</svg>`;

// ---------- 沙漏计时器 ----------
// 上半沙子随剩余时间减少、下半堆高、中间一道细沙；最后 10 秒变红抖动；时间到翻转一次
function hourglass(endsAt, secs, size = 64) {
  const f0 = endsAt ? Math.max(0, Math.min(1, (endsAt - Date.now() - clockSkew) / 1000 / secs)) : 1;
  return `<div class="hg ${endsAt ? '' : 'idle'}" ${endsAt ? `data-end="${endsAt}"` : ''} data-secs="${secs}" style="width:${size}px;height:${size * 1.5}px">
  <svg viewBox="0 0 40 60"><defs>
    <linearGradient id="hgSand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f6dc96"/><stop offset=".55" stop-color="#d9a94c"/><stop offset="1" stop-color="#a8752a"/></linearGradient>
    <linearGradient id="hgShine" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".25" stop-color="#fff" stop-opacity=".28"/><stop offset=".4" stop-color="#fff" stop-opacity="0"/></linearGradient>
    <clipPath id="hgTop"><path d="M9 6h22c0 9-6 14-10 20h-2C15 20 9 15 9 6z"/></clipPath>
    <clipPath id="hgBot"><path d="M19 34h2c4 6 10 11 10 20H9c0-9 6-14 10-20z"/></clipPath>
    <clipPath id="hgNeck"><rect x="18.6" y="24" width="2.8" height="31"/></clipPath></defs>
    <path d="M9 6h22c0 9-6 14-10 20v8c4 6 10 11 10 20H9c0-9 6-14 10-20v-8C15 20 9 15 9 6z" class="hg-glass"/>
    <g clip-path="url(#hgTop)"><path class="hg-top" d="${hgTopPath(f0)}" fill="url(#hgSand)"/></g>
    <g clip-path="url(#hgBot)"><path class="hg-bot" d="${hgBotPath(f0)}" fill="url(#hgSand)"/></g>
    <g class="hg-flow" clip-path="url(#hgNeck)"><line class="hg-stream" x1="20" y1="25" x2="20" y2="54" stroke="#ecc670" stroke-width="1"/>
      <circle class="hg-grain g1" cx="20" cy="27" r=".7"/><circle class="hg-grain g2" cx="20.3" cy="27" r=".55"/><circle class="hg-grain g3" cx="19.7" cy="27" r=".6"/></g>
    <path d="M9 6h22c0 9-6 14-10 20v8c4 6 10 11 10 20H9c0-9 6-14 10-20v-8C15 20 9 15 9 6z" fill="url(#hgShine)" stroke="none"/>
    <rect x="5" y="2" width="30" height="4" rx="1.5" class="hg-cap"/><rect x="5" y="54" width="30" height="4" rx="1.5" class="hg-cap"/>
    <path d="M7 6v48M33 6v48" class="hg-post"/></svg>
  <div class="hg-t">${endsAt ? '--' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</div></div>`;
}
// 上半沙子：玻璃越靠近瓶颈越窄，沙量 ∝ 高度²，所以高度 = √剩余比例；沙面中间凹下去（被瓶颈吸走）
function hgTopPath(f) {
  const h = 20 * Math.sqrt(f), y = 26 - h, dip = Math.min(3.2, 1 + 6 * f * (1 - f) + (f > 0.02 ? 0.8 : 0));
  if (h < 0.3) return '';
  return `M4 ${y} Q12 ${y} 20 ${Math.min(26, y + dip)} Q28 ${y} 36 ${y} L36 27 L4 27 Z`;
}
// 下半沙子：堆成越来越高的沙丘（中间尖、两边坡）
function hgBotPath(f) {
  const p = 1 - f; if (p < 0.005) return '';
  const top = 54 - 17 * Math.pow(p, 0.7), side = 54 - 9 * Math.pow(p, 0.85);
  return `M4 55 L4 ${side} Q12 ${side} 20 ${top} Q28 ${side} 36 ${side} L36 55 Z`;
}
// 逐帧更新（requestAnimationFrame），沙子连续流动，不是一跳一跳
function tickHourglass() {
  const now = Date.now() + clockSkew;
  document.querySelectorAll('.hg[data-end]').forEach((el) => {
    const end = +el.dataset.end, secs = +el.dataset.secs, left = Math.max(0, (end - now) / 1000);
    const f = Math.max(0, Math.min(1, left / secs));
    const top = el.querySelector('.hg-top'), bot = el.querySelector('.hg-bot');
    if (top) top.setAttribute('d', hgTopPath(f));
    if (bot) bot.setAttribute('d', hgBotPath(f));
    const st = el.querySelector('.hg-stream'); if (st) st.setAttribute('y2', 54 - 17 * Math.pow(1 - f, 0.7));
    el.classList.toggle('warn', left > 0 && left <= 10);
    el.classList.toggle('done', left <= 0);
    const t = el.querySelector('.hg-t'); if (t) { const s = Math.ceil(left); const txt = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; if (t.textContent !== txt) t.textContent = txt; }
  });
  requestAnimationFrame(tickHourglass);
}
requestAnimationFrame(tickHourglass);

// ---------- 头像：纹章图片（兼容旧的 emoji 头像） ----------
function avH(a, cls = '') {
  if (a && /^https?:\/\/[^\s"'<>()\\]+$/.test(a)) return `<img class="crest up ${cls}" src="${esc(a)}" alt="" draggable="false" loading="lazy" onerror="this.outerHTML='<span class=&quot;crest-emo ${cls}&quot;>⚜</span>'">`; // 上传的头像
  if (a && /^[a-z]+$/.test(a)) return `<img class="crest ${cls}" src="img/crests/${a}.webp" alt="" draggable="false" onerror="this.outerHTML='<span class=&quot;crest-emo ${cls}&quot;>${CREST_EMO[a] || '⚜'}</span>'">`;
  return `<span class="crest-emo ${cls}">${a || '❔'}</span>`;
}

// ---------- 选择模式：当前这个人在这一阶段能不能点座位、能点谁 ----------
let assMode = 'merlin'; // 'merlin' | 'messengers'
function selMode() {
  if (!S || !S.gameId || !S.me) return 0;
  if (S.phase === 'propose' && S.leader === S.me) return S.teamSizes[S.quest];
  if (S.phase === 'assassin' && S.evilTeam && S.evilTeam.includes(S.me)) return (S.canKillMessengers && S.assassin === S.me && assMode === 'messengers') ? 2 : 1;
  if (S.phase === 'recruit' && S.recruit && S.recruit.recruiter === S.me) return 1;
  if (S.phase === 'watch' && S.leader === S.me) return 1;
  if (S.phase === 'trapper' && S.leader === S.me) return 1;
  if (S.phase === 'lady' && S.lady && S.lady.holder === S.me) return 1;
  if (S.phase === 'excalibur' && S.excalibur === S.me) return 1;
  if (S.phase === 'plot_deal' && S.plot) {
    if (S.plot.action && S.plot.action.owner === S.me) return 1;
    if (!S.plot.action && S.plot.pending.length && S.leader === S.me) return 1;
  }
  if (S.phase === 'plot_prequest' && S.plot && S.plot.waitHolders.includes(S.me)) return 1;
  if (S.phase === 'plot_ambush' && S.plot && S.plot.waitHolders.includes(S.me)) return 1;
  return 0;
}
// 返回 null 表示可选，否则返回不可选的原因
function whyNot(id) {
  if (S.phase === 'assassin' && S.evilTeam.includes(id)) return '同伙不能刺杀';
  if (S.phase === 'recruit' && S.myRole && S.myRole.sees && S.myRole.sees.some((x) => x.id === id)) return '同伙不需要招募';
  if (S.phase === 'recruit' && id === S.me) return '不能招募自己';
  if (S.phase === 'watch' && !S.team.includes(id)) return '只能交给车上的队员';
  if (S.phase === 'trapper' && !S.team.includes(id)) return '只能选车上的队员';
  if (S.phase === 'lady' && (id === S.me || S.lady.used.includes(id))) return id === S.me ? '不能查自己' : '拿过湖中仙女的人不能再查';
  if (S.phase === 'excalibur' && (id === S.me || !S.team.includes(id))) return id === S.me ? '不能翻自己的牌' : '只能选车上的队员';
  if (S.phase === 'excalibur' && S.plot && S.plot.faceup && S.plot.faceup.id === id) return '明牌出牌的目标不能翻转';
  if (S.phase === 'plot_deal' && S.plot) {
    if (!S.plot.action) return id === S.me ? '阴谋卡不能留给自己' : null;
    const act = S.plot.action;
    if (act.type === 'are_you_the_one') {
      const idx = S.players.findIndex((p) => p.id === S.me), n = S.players.length;
      const L = S.players[(idx - 1 + n) % n].id, R = S.players[(idx + 1) % n].id;
      return (id !== L && id !== R) ? '只能查左右相邻的玩家' : null;
    }
    if (act.type === 'show_nature') return id === S.me ? '请选另一名玩家看你的阵营' : null;
    if (act.type === 'restore_honor') return (id === S.me || !(S.plot.hands[id] || []).length) ? '请选一位持有阴谋卡的其他玩家' : null;
  }
  if (S.phase === 'plot_prequest' && !S.team.includes(id)) return '只能选车上的队员';
  if (S.phase === 'plot_ambush' && (!S.team.includes(id) || (S.plot.ambushed || []).includes(id))) return S.team.includes(id) ? '该队员本轮已被伏击过' : '只能选车上的队员';
  return null;
}
function tog(id) {
  const lim = selMode(); if (!lim) return;
  const why = whyNot(id); if (why) return toast(why);
  if (sel.has(id)) sel.delete(id);
  else { if (lim === 1) sel.clear(); if (sel.size < lim) sel.add(id); else return toast(`已经选满 ${lim} 人，点已选的人可以取消`); }
  vibrate(15); render();
}

// ---------- 圆桌 ----------
function seatBadges(p) {
  const b = [];
  if (p.id === S.leader && S.phase !== 'end') b.push(`<i class="bd lead" title="队长">${ic('crown')}</i>`);
  if (S.lady && S.lady.holder === p.id && S.phase !== 'end') b.push(`<i class="bd lady" title="湖中仙女">${ic('lady')}</i>`);
  if (S.excalibur === p.id) b.push(`<i class="bd exc" title="王者之剑">${ic('sword')}</i>`);
  if (S.rogue && S.rogue.watchTarget === p.id && !['propose', 'end'].includes(S.phase)) b.push(`<i class="bd lady" title="监视标记">${ic('eye')}</i>`);
  return b.join('');
}
function seatStatus(p) {
  const onTeam = S.team.includes(p.id) && !['propose', 'plot_deal'].includes(S.phase);
  if (S.phase === 'vote') {
    if (S.plot && S.plot.chargeVotes && p.id in S.plot.chargeVotes) {
      return S.plot.chargeVotes[p.id] ? `<span class="st yes">⚡同意</span>` : `<span class="st no">⚡反对</span>`;
    }
    if (!S.voted.includes(p.id)) return '<span class="st wait">思考中</span>';
    if (isGod()) return S.liveVotes[p.id] ? `<span class="st yes">${ic('check')}同意</span>` : `<span class="st no">${ic('cross')}反对</span>`;
    return `<span class="st done">${ic('check')}已投</span>`;
  }
  if (S.phase === 'quest' && onTeam) {
    if (S.plot && S.plot.faceup && S.plot.faceup.id === p.id && S.plot.faceup.card) {
      const c = S.plot.faceup.card;
      return `<span class="st ${c === 'F' || c === 'EF' || c === 'RF' ? 'no' : 'yes'}">明牌·${CARD[c]?.t || c}</span>`;
    }
    if (!S.questDone.includes(p.id)) return '<span class="st wait">出牌中</span>';
    if (isGod()) { const c = S.liveCards[p.id]; return `<span class="st ${c === 'F' || c === 'EF' || c === 'RF' ? 'no' : 'yes'}">${CARD[c]?.t || c}</span>`; }
    return `<span class="st done">${ic('check')}已出牌</span>`;
  }
  if (S.revealed && S.revealed.includes(p.id) && !S.allRoles) return '<span class="st no">已暴露·坏人</span>';
  if (S.evilTeam && S.evilTeam.includes(p.id) && !S.allRoles) return '<span class="st no">坏人</span>';
  return '';
}
function roundTable(center) {
  const n = S.players.length, sp = S.speech, cur = sp && sp.order[sp.idx];
  const mode = selMode(), mine = marks();
  const size = Math.round((n >= 9 ? 52 : n >= 7 ? 58 : 64) * (WATCH ? 2 : 1));
  const seats = S.players.map((p, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n, x = 50 + 41 * Math.cos(a), y = 50 + 41 * Math.sin(a);
    const onTeam = (S.phase === 'propose' ? sel.has(p.id) && S.leader === S.me : S.team.includes(p.id) && !['lady', 'end'].includes(S.phase));
    const picked = sel.has(p.id) && S.phase !== 'propose';
    const dis = mode && whyNot(p.id);
    const sug = S.evilSuggest ? Object.values(S.evilSuggest).filter((x) => x === p.id).length : 0;
    const role = S.allRoles && S.allRoles.find((r) => r.id === p.id);
    const mk = mine.m[p.id];
    const face = role && S.phase === 'end'
      ? `<img class="crest portrait-face" src="${img(role.art)}" onerror="this.onerror=null;this.src='${img(role.role)}'" alt="">`
      : avH(p.avatar);
    return `<div data-pid="${p.id}" class="seat ${p.online ? '' : 'off'} ${onTeam ? 'team' : ''} ${picked ? 'picked' : ''} ${cur === p.id ? 'speak' : ''} ${p.id === S.me ? 'me' : ''} ${dis ? 'dis' : ''} ${mode && !dis ? 'can' : ''} ${role ? (role.evil ? 'evil' : 'good') : ''} ${S.assassinTarget === p.id || (S.assassinTargets && S.assassinTargets.includes(p.id)) ? 'stabbed' : ''}"
      style="left:${x}%;top:${y}%;--s:${size}px">
      <div class="seat-av ${mk ? 'mk-' + mk : ''} ${linkFrom === p.id ? 'linking' : ''}" ${S.gameId && !WATCH ? `data-av="${p.id}"` : ''}>${face}
        <span class="sn">${i + 1}</span>${seatBadges(p)}${mk ? `<span class="mkb">${MK[mk].e}</span>` : ''}${sug ? `<span class="sug">${ic('target')}${sug}</span>` : ''}
        ${!p.online ? `<span class="offl">${ic('offline')}</span>` : ''}</div>
      <div class="seat-nm">${esc(p.name)}${p.id === S.me ? '<small>（我）</small>' : ''}</div>
      ${role ? `<div class="seat-role">${role.name}</div>` : isGod() && S.allRoles ? '' : seatStatus(p)}
      </div>`;
  }).join('');
  return `<div class="rtable"><div class="rt-board"></div>${relLinks()}<div class="rt-cwrap"><div class="rt-center">${center}</div></div>${seats}</div>`;
}

// 推理关系连线：同边 = 绿色实线 + 链环，互踩 = 红色虚线 + 交叉剑（只在自己手机上）
function relLinks() {
  if (!S.gameId || WATCH || !S.me && !isGod()) return '';
  const n = S.players.length, R = 41, x = marks();
  if (!x.r.length) return '';
  const pos = (id) => { const i = S.players.findIndex((p) => p.id === id); const a = -Math.PI / 2 + (2 * Math.PI * i) / n; return [50 + R * Math.cos(a), 50 + R * Math.sin(a)]; };
  const cut = n >= 9 ? 6.5 : n >= 7 ? 7.2 : 8; // 线从头像边缘开始，不压在头像上
  const lines = x.r.map((r) => {
    if (!S.players.some((p) => p.id === r.a) || !S.players.some((p) => p.id === r.b)) return '';
    const [x1, y1] = pos(r.a), [x2, y2] = pos(r.b), dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
    const ax = x1 + (dx / L) * cut, ay = y1 + (dy / L) * cut, bx = x2 - (dx / L) * cut, by = y2 - (dy / L) * cut, mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
    const opp = r.k === 'opp';
    return `<g class="rl ${opp ? 'opp' : 'same'}"><line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}"/>
      <circle cx="${mx}" cy="${my}" r="3.1"/><text x="${mx}" y="${my + 1.25}">${opp ? '⚔' : '∞'}</text></g>`;
  }).join('');
  return `<svg class="rt-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">${lines}</svg>`;
}

// ---------- 桌面中央：只说「现在发生什么」 ----------
function centerStage() {
  const need = S.teamSizes[S.quest], n = S.players.length, sp = S.speech;
  const head = (t, sub) => `<div class="cs-t">${t}</div>${sub ? `<div class="cs-s">${sub}</div>` : ''}`;
  if (sp && ['propose', 'vote'].includes(S.phase)) {
    const cur = sp.order[sp.idx];
    if (sp.ready) return `<div class="wait-go">${ic('mic')}</div><div class="cs-t">${cur === S.me ? '轮到你发言' : `${seat(cur)}号 ${esc(P(cur).name)}`}</div>
      ${cur === S.me ? `<button class="okb cs-go" onclick="send({t:'speechGo'})">${ic('mic')}开始发言</button>` : `<div class="cs-s">等待 TA 按「开始发言」</div>`}<div class="cs-s">${sp.dir === -1 ? '逆时针' : '顺时针'} · ${sp.idx + 1}/${sp.order.length}</div>`;
    return `${hourglass(sp.endsAt, sp.secs, WATCH ? 150 : 38)}<div class="cs-t">${cur === S.me ? '轮到你发言' : `${seat(cur)}号 ${esc(P(cur).name)}`}</div><div class="cs-s">${sp.ready ? '准备中 · 按「开始发言」后计时' : `发言 ${sp.idx + 1}/${sp.order.length}`}</div>`;
  }
  switch (S.phase) {
    case 'plot_deal': return head('阴谋卡分配', S.plot.action ? `${seat(S.plot.action.owner)}号 使用「${PLOT_CARDS[S.plot.action.type]?.name || S.plot.action.type}」` : `队长 ${seat(S.leader)}号 分牌`);
    case 'propose': return head(`第 ${S.quest + 1} 轮 · 组队`, `队长 ${seat(S.leader)}号 选 ${need} 人${S.rejects ? ` · 已否决 ${S.rejects} 次` : ''}`);
    case 'vote': return head('发车投票', `${S.voted.length}/${n} 已投`);
    case 'plot_vote': return head('国王归来', '决定是否否决组队');
    case 'watch': return head('监视标记', `队长 ${seat(S.leader)}号 指定 1 名队员`);
    case 'plot_prequest': return head('找到你了！', '决定是否指定明牌出牌');
    case 'quest': return head('执行任务', `${S.questDone.length}/${S.team.length} 已出牌${S.quest === 3 && S.twoFailQuest4 ? ' · 需 2 张失败' : ''}`);
    case 'excalibur': return head('王者之剑', `${seat(S.excalibur)}号 决定是否翻牌`);
    case 'plot_ambush': return head('伏击', '决定是否偷看任务牌');
    case 'trapper': return head('陷阱师', `队长 ${seat(S.leader)}号 偷看并弃 1 张牌`);
    case 'lady': return head('湖中仙女', `${seat(S.lady.holder)}号 正在查验`);
    case 'recruit': return head('招募阶段', `${seat(S.recruit.recruiter)}号 尝试招募仆人`);
    case 'assassin': return (S.assassinEndsAt ? hourglass(S.assassinEndsAt, S.assassinSecs, WATCH ? 150 : 38) : '') + head(S.canKillMessengers ? '最终刺杀' : '刺杀梅林', S.assassinRandom ? `没有刺客 · 随机抽中 ${seat(S.assassin)}号 拍板` : `${seat(S.assassin)}号 拍板`);
    case 'end': return `<div class="cs-t ${S.winner}">${S.soloWinner ? '游侠独自获胜' : S.winner === 'good' ? '正义阵营获胜' : '邪恶阵营获胜'}</div><div class="cs-s">${esc(S.reason)}</div>`;
  }
  return '';
}

function centerHint() {
  const m = {
    plot_deal: `队长 ${seat(S.leader)}号 分发阴谋卡`,
    propose: `等待 ${seat(S.leader)}号 组队`,
    vote: `投票中 ${S.voted.length}/${S.players.length}`,
    plot_vote: '等待「国王归来」决策',
    watch: `队长 ${seat(S.leader)}号 放置监视标记`,
    plot_prequest: '等待「找到你了！」决策',
    quest: '队员出牌中',
    excalibur: '王者之剑',
    plot_ambush: '等待「伏击」决策',
    trapper: `陷阱师 · 队长选 1 张牌弃掉`,
    lady: '湖中仙女查验中',
    recruit: '招募不可信的仆人中',
    assassin: '刺杀环节',
    end: '本局结束',
  };
  return m[S.phase] || '';
}
function speechButtons(sp, allowAdmin, allowSelf) {
  if (!['propose', 'vote'].includes(S.phase)) return '';
  if (!sp) return allowAdmin ? `<button class="sm sec spb sp-start" onclick="speechSetup()">${ic('mic')}开始轮流发言</button>` : '';
  const cur = sp.order[sp.idx], mine = allowSelf && cur === S.me;
  let b = '';
  if (sp.ready && !mine && allowAdmin) b += `<button class="sm okb spb sp-go" onclick="send({t:'speechGo'})">${ic('mic')}替 ${seat(cur)}号 开始计时</button>`;
  if (!sp.ready && (mine || allowAdmin)) b += `<button class="sm spb sp-next" onclick="send({t:'speechNext'})">${ic('next')}${mine ? '我说完了' : '下一位'}</button>`;
  else if (sp.ready && allowAdmin) b += `<button class="sm sec spb sp-skip" onclick="send({t:'speechNext'})">${ic('next')}跳过 ${seat(cur)}号</button>`;
  if (allowAdmin) b += `<button class="sm sec spb sp-stop" onclick="send({t:'speechStop'})">${ic('stop')}结束发言</button>`;
  return b;
}
function tvSpeechBar() {
  const sp = S.speech;
  const b = speechButtons(sp, true, false);
  if (!b) return '';
  const keyHint = sp ? `<div class="tvspeech-hint">⌨ 空格 / 回车：${sp.ready ? `替 ${seat(sp.order[sp.idx])}号 开始计时` : '下一位'}</div>` : '';
  return `<div class="tvspeech">${b}${keyHint}</div>`;
}
// ---------- 底部操作栏：每个阶段只有一个主动作，按钮写明结果 ----------
function actionBar() {
  const iLead = S.leader === S.me, host = S.me === S.hostId, need = S.teamSizes[S.quest], n = S.players.length;
  const ids = [...sel].map(seat).sort((a, b) => a - b);
  const lst = (a) => a.join('、') + ' 号';
  let hint = '', main = '', side = '';
  const sp = S.speech;
  if (sp && ['propose', 'vote'].includes(S.phase)) {
    const cur = sp.order[sp.idx], mine = cur === S.me;
    if (sp.ready && mine) { hint = '轮到你发言了，准备好就点开始，沙漏开始计时'; main = `<button class="okb go" onclick="send({t:'speechGo'})">${ic('mic')}开始发言</button>`; }
  }
  side += speechButtons(sp, iLead || host, true);

  const speechHint = sp && sp.ready && ['propose', 'vote'].includes(S.phase) && sp.order[sp.idx] !== S.me ? `等待 ${seat(sp.order[sp.idx])}号 开始发言 · ` : '';
  if (!S.me) { hint = isGod() ? '上帝视角：在上方选择玩家可代入操作' : `观众席 · ${centerHint()}`; }
  else if (S.phase === 'plot_deal') {
    const act = S.plot.action;
    if (act) {
      const pn = PLOT_CARDS[act.type]?.name || act.type;
      if (act.owner === S.me) {
        const t = [...sel][0];
        hint = `${pn}：${PLOT_CARDS[act.type]?.desc || '点座位选目标'}`;
        main = `<button onclick="send({t:'plotResolve',id:[...sel][0]})" ${t ? '' : 'disabled'}>确认（${t ? seat(t) + '号' : '点座位选人'}）</button>`;
      } else hint = `等待 ${seat(act.owner)}号 使用「${pn}」`;
    } else if (iLead && S.plot.pending.length) {
      const c = S.plot.pending[0], cn = PLOT_CARDS[c.type]?.name || c.type, t = [...sel][0];
      hint = `摸到「${cn}」（${PLOT_CARDS[c.type]?.desc || ''}）· 点一位其他玩家发给他`;
      main = `<button onclick="send({t:'plotGive',to:[...sel][0]})" ${t ? '' : 'disabled'}>把「${cn}」发给 ${t ? seat(t) + '号' : '…'}</button>`;
    } else hint = `等待队长 ${seat(S.leader)}号 分配阴谋卡`;
  } else if (S.phase === 'propose') {
    const myHand = (S.plot && S.plot.hands[S.me]) || [];
    if (!iLead && S.plot && !S.plot.leadStolen && myHand.some((c) => c.type === 'lead_to_victory')) {
      side += `<button class="sm sec" onclick="confirm('打出「引领胜利」抢当本轮队长？')&&send({t:'plotUse',card:'lead_to_victory'})">🃏 引领胜利（抢队长）</button>`;
    }
    if (iLead) {
      const exOpts = [...sel].filter((id) => id !== S.me);
      if (excalPick && !exOpts.includes(excalPick)) excalPick = null;
      const needEx = S.settings.excalibur;
      const ok = sel.size === need && (!needEx || excalPick);
      hint = sel.size < need ? `点座位选队员（${sel.size}/${need}），可以选自己` : needEx && !excalPick ? '再选一名队员拿王者之剑（不能给自己）' : '确认后全员投票';
      if (needEx && sel.size === need) side += `<select class="exsel" onchange="excalPick=this.value;render()"><option value="">${'王者之剑交给…'}</option>${exOpts.map((id) => `<option value="${id}" ${excalPick === id ? 'selected' : ''}>${seat(id)}号 ${esc(P(id).name)}</option>`).join('')}</select>`;
      main = `<button onclick="send({t:'propose',team:[...sel],excalibur:excalPick})" ${ok ? '' : 'disabled'}>${ic('sword')}${sel.size ? `确认发车：${lst(ids)}` : `选 ${need} 名队员`}</button>`;
    } else hint = `等待队长 ${seat(S.leader)}号 选人，大家可以讨论`;
  } else if (S.phase === 'vote') {
    const team = lst(S.team.map(seat).sort((a, b) => a - b));
    const waitCharge = S.plot && S.plot.chargeWait && S.plot.chargeWait.length;
    const isCharge = S.plot && S.plot.chargeWait && S.plot.chargeWait.includes(S.me);
    if (S.myVote === undefined) {
      if (waitCharge && !isCharge) {
        hint = `等待持「冲锋！」的玩家（${S.plot.chargeWait.map(seat).join('、')}号）先亮出投票`;
      } else {
        hint = `${isCharge ? '⚡「冲锋！」你必须先公开亮票 · ' : ''}是否同意这支队伍：${team}？`;
        main = `<div class="row"><button class="okb" onclick="send({t:'vote',approve:true})">${ic('check')}同意</button><button class="evil" onclick="send({t:'vote',approve:false})">${ic('cross')}反对</button></div>`;
      }
    } else {
      hint = `你投了「${S.myVote ? '同意' : '反对'}」· 等待其他人 ${S.voted.length}/${n}`;
      if (iLead && S.voted.length === 0) side += `<button class="sm sec" onclick="send({t:'unpropose'})">重新选人</button>`;
    }
  } else if (S.phase === 'plot_vote') {
    if (S.plot.waitHolders.includes(S.me)) {
      hint = '发车已通过！是否打出「国王归来」强制否决这次组队？';
      main = `<div class="row"><button class="sec" onclick="send({t:'plotUse',card:'king_returns',pass:true})">不用（放行）</button><button class="evil" onclick="send({t:'plotUse',card:'king_returns'})">🃏 打出国王归来（否决）</button></div>`;
    } else hint = '等待持有「国王归来」的玩家决定是否否决组队…';
  } else if (S.phase === 'watch') {
    if (iLead) {
      const t = [...sel][0];
      hint = '选 1 名车上的队员给他贴「监视标记」（他本轮不能出游侠牌）';
      main = `<button onclick="send({t:'rogueWatch',id:[...sel][0]})" ${t ? '' : 'disabled'}>${ic('eye')}${t ? `监视 ${seat(t)} 号` : '点座位选队员'}</button>`;
    } else hint = `等待队长 ${seat(S.leader)}号 放置监视标记…`;
  } else if (S.phase === 'plot_prequest') {
    if (S.plot.waitHolders.includes(S.me)) {
      const t = [...sel][0];
      hint = '点一名车上队员强制他本轮明牌出牌，或者不用';
      main = `<div class="row"><button class="sec" onclick="send({t:'plotUse',card:'we_found_you',pass:true})">不用</button><button onclick="send({t:'plotUse',card:'we_found_you',id:[...sel][0]})" ${t ? '' : 'disabled'}>🃏 强制 ${t ? seat(t) + '号' : '队员'}明牌</button></div>`;
    } else hint = '等待持有「找到你了！」的玩家决定…';
  } else if (S.phase === 'quest') {
    const inTeam = S.team.includes(S.me);
    const faceTag = S.plot && S.plot.faceup && S.plot.faceup.id === S.me ? '⚠️ 你被「找到你了！」锁定，本轮必须明牌出牌！' : '';
    if (inTeam && !S.myCard) { hint = faceTag || cardHint(); main = `<div class="row">${S.myCards.map((c) => `<button class="${CARD[c].b}" onclick="qc('${c}')">${ic(c === 'S' || c === 'GS' || c === 'RS' ? 'grail' : c === 'M' ? 'magic' : 'dagger')}${CARD[c].t}</button>`).join('')}</div>`; }
    else hint = inTeam ? `你已出牌 · 等待其他队员 ${S.questDone.length}/${S.team.length}` : `等待队员出牌 ${S.questDone.length}/${S.team.length}`;
  } else if (S.phase === 'excalibur') {
    if (S.excalibur === S.me) {
      const t = [...sel][0];
      hint = '点一名其他队员，把他的牌翻转（成功↔失败），你会看到原牌';
      main = `<div class="row"><button class="sec" onclick="send({t:'excalibur',id:null})">不使用</button><button onclick="send({t:'excalibur',id:[...sel][0]})" ${t ? '' : 'disabled'}>${ic('sword')}${t ? `翻转 ${seat(t)} 号的牌` : '选择队员'}</button></div>`;
    } else hint = `等待 ${seat(S.excalibur)}号 决定是否使用王者之剑`;
  } else if (S.phase === 'plot_ambush') {
    if (S.plot.waitHolders.includes(S.me)) {
      const t = [...sel][0];
      hint = '打出「伏击」：点一名队员秘密偷看他出的任务牌（不影响结果），或不用';
      main = `<div class="row"><button class="sec" onclick="send({t:'plotUse',card:'ambush',pass:true})">不用</button><button onclick="send({t:'plotUse',card:'ambush',id:[...sel][0]})" ${t ? '' : 'disabled'}>🃏 伏击偷看 ${t ? seat(t) + '号' : '…'}</button></div>`;
    } else hint = '等待持有「伏击」的玩家决定…';
  } else if (S.phase === 'trapper') {
    if (iLead) {
      const t = [...sel][0];
      hint = '陷阱师：点一名队员偷看并弃掉他的任务牌（不计入本轮结果）';
      main = `<button onclick="send({t:'trapper',id:[...sel][0]})" ${t ? '' : 'disabled'}>🕸️ ${t ? `偷看并弃掉 ${seat(t)} 号的牌` : '点座位选队员'}</button>`;
    } else hint = `等待队长 ${seat(S.leader)}号 挑选 1 张牌弃掉…`;
  } else if (S.phase === 'lady') {
    if (S.lady.holder === S.me) {
      const t = [...sel][0];
      hint = '点一名玩家查验阵营，结果只有你能看到';
      main = `<button onclick="send({t:'lady',id:[...sel][0]})" ${t ? '' : 'disabled'}>${ic('eye')}${t ? `确认查验 ${seat(t)} 号` : '选择查验对象'}</button>`;
    } else hint = `等待 ${seat(S.lady.holder)}号 使用湖中仙女`;
  } else if (S.phase === 'recruit') {
    if (S.recruit && S.recruit.recruiter === S.me) {
      const t = [...sel][0];
      hint = '招募阶段：点 1 名玩家猜测谁是「不可信的仆人」（猜中则由他代替你刺杀）';
      main = `<button class="evil" onclick="send({t:'recruit',id:[...sel][0]})" ${t ? '' : 'disabled'}>⚖️ ${t ? `招募 ${seat(t)} 号` : '选择玩家'}</button>`;
    } else hint = '招募阶段：等待刺客猜测不可信的仆人…';
  } else if (S.phase === 'assassin') {
    const amA = S.assassin === S.me, amEvil = S.evilTeam && S.evilTeam.includes(S.me), picks = [...sel], t = picks[0];
    if (amA) {
      if (S.canKillMessengers) side += `<button class="sm ${assMode === 'merlin' ? '' : 'sec'}" onclick="assMode='merlin';sel.clear();render()">刺梅林（1人）</button><button class="sm ${assMode === 'messengers' ? '' : 'sec'}" onclick="assMode='messengers';sel.clear();render()">改刺双信使（2人）</button>`;
      if (assMode === 'messengers' && S.canKillMessengers) {
        hint = '改刺双信使：点选 2 名好人（两人皆为好信使则坏人翻盘）';
        main = `<button class="evil" onclick="if(confirm('确定刺杀 '+[...sel].map(x=>seat(x)+'号').join(' 与 ')+'？'))send({t:'assassinate',mode:'messengers',ids:[...sel]})" ${picks.length === 2 ? '' : 'disabled'}>${ic('dagger')}${picks.length === 2 ? `刺杀 ${picks.map((x) => seat(x) + '号').join('、')}` : `再选 ${2 - picks.length} 人`}</button>`;
      } else {
        hint = '坏人已亮明身份，商量后点一名好人刺杀';
        main = `<button class="evil" onclick="if(confirm('确定刺杀 '+seat([...sel][0])+' 号 '+P([...sel][0]).name+'？'))send({t:'assassinate',id:[...sel][0]})" ${t ? '' : 'disabled'}>${ic('dagger')}${t ? `刺杀 ${seat(t)} 号` : '选择刺杀目标'}</button>`;
      }
    }
    else if (amEvil) { hint = '点一名你怀疑是梅林的人，标记只有坏人能看到'; main = `<button class="sec" onclick="send({t:'suggest',id:[...sel][0]})" ${t ? '' : 'disabled'}>${ic('target')}${t ? `标记 ${seat(t)} 号为梅林` : '选择怀疑对象'}</button>`; }
    else hint = '好人请保持沉默，别暴露梅林';
  } else if (S.phase === 'end') {
    hint = S.soloWinner ? '游侠独自获胜' : S.winner === 'good' ? '正义阵营获胜' : '邪恶阵营获胜';
    side += `<button class="sm sec" onclick="showReplay(S.record)">${ic('scroll')}生成复盘图</button><button class="sm sec" onclick="location.href='/?history'">${ic('book')}历史战绩</button>`;
    if (host || isGod()) main = `<div class="row"><button class="sec" onclick="${isGod() && !host ? "god('lobby')" : "send({t:'lobby'})"}">回到大厅</button><button onclick="${isGod() && !host ? "god('start')" : "send({t:'start'})"}">再来一局</button></div>`;
  }
  if (main && /speechGo/.test(main)) { /* 发言按钮优先 */ } else if (sp && sp.ready && sp.order[sp.idx] === S.me && ['propose', 'vote'].includes(S.phase)) main = `<button class="okb go" onclick="send({t:'speechGo'})">${ic('mic')}开始发言</button>` + main;
  return `<div class="abar"><div class="ab-hint">${speechHint}${hint}</div>${side ? `<div class="ab-side">${side}</div>` : ''}${main}</div>`;
}

// ---------- 身份：顶部窄条，按住全屏翻开 ----------
function roleCard() {
  const r = S.myRole; if (!r) return '';
  const R = ROLES[r.role];
  const extra = [];
  if (r.role === 'trickster') extra.push(`<label class="ck">被查验时显示为 <select style="width:auto" onchange="send({t:'trickShow',evil:this.value==='1'})"><option value="0" ${r.trickShowEvil ? '' : 'selected'}>好人</option><option value="1" ${r.trickShowEvil ? 'selected' : ''}>坏人</option></select></label>`);
  if (S.myChecks && S.myChecks.length) extra.push(`<div><b>我的查验结果</b>${S.myChecks.map((c) => `<div>第${c.quest + 1}轮后：${seat(c.id)}号 ${esc(P(c.id).name)} 是 <b style="color:${c.evil ? 'var(--evil)' : 'var(--good)'}">${c.evil ? '坏人' : '好人'}</b></div>`).join('')}</div>`);
  if (S.myExcalSeen) extra.push(`<div><b>王者之剑</b>：第${S.myExcalSeen.quest + 1}轮你翻转了 ${seat(S.myExcalSeen.id)}号 的牌，原来是「${CARD[S.myExcalSeen.card].t}」</div>`);
  if (S.myTrapperSeen) extra.push(`<div><b>陷阱师</b>：第${S.myTrapperSeen.quest + 1}轮你偷看并弃掉了 ${seat(S.myTrapperSeen.id)}号 的牌（${CARD[S.myTrapperSeen.card]?.t || S.myTrapperSeen.card}）</div>`);
  if (S.myPlotChecks && S.myPlotChecks.length) extra.push(`<div><b>阴谋卡秘密信息</b>${S.myPlotChecks.map((c) => `<div>第${c.quest + 1}轮「${esc(c.card)}」：${seat(c.id)}号 ${esc(P(c.id).name)} → ${c.questCard ? `出了「${CARD[c.questCard]?.t || c.questCard}」` : `<b style="color:${c.evil ? 'var(--evil)' : 'var(--good)'}">${c.evil ? '坏人' : '好人'}</b>`}</div>`).join('')}</div>`);
  const bar = `<div class="idbar" id="rc">${ic('eye')}<span><b>按住查看身份</b><small>松手隐藏 · 注意别让旁边的人看到</small></span><span class="idbar-g" onclick="event.stopPropagation();showDetail('${r.role}')">${ic('book')}玩法</span></div>`;
  const overlay = reveal ? `<div class="role show idfull ${revealAnim ? 'anim' : ''} ${r.evilNow ? 'e' : 'g'}" ${IMG_OK[r.art] ? `style="background-image:url(${img(r.art)})"` : ''}>
    <div class="ov"><div class="nm" style="color:${r.evilNow ? '#ff8a85' : '#9cc3ff'}">${r.name}</div><div>${r.evilNow ? '邪恶阵营' : '正义阵营'}${r.evil !== r.evilNow ? '（已换阵营！）' : ''}</div>
    <div class="mute" style="margin-top:6px">${R.know}</div>
    ${r.sees.length ? `<div class="sees">${r.sees.map((x) => `<span class="tag ${r.evil ? 'evil' : 'good'}">${seat(x.id)}号 ${esc(P(x.id).name)} · ${x.tag}</span>`).join('')}</div>` : ''}</div></div>` : '';
  return bar + overlay + (extra.length ? `<div class="card private" style="font-size:13px">${extra.join('')}<div class="mute">以上信息只有你能看到</div></div>` : '');
}

// ---------- 任务进度：火漆印章 ----------
function questTrack() {
  return `<div class="card qcard"><div class="quests">${S.teamSizes.map((sz, i) => {
    const r = S.results[i], cur = i === S.quest && S.phase !== 'end';
    const has = r || S.history.some((h) => h.type === 'vote' && h.quest === i);
    return `<div class="q seal ${r ? (r.success ? 'ok' : 'fail') : cur ? 'cur' : ''} ${has ? 'clk' : ''}" ${has ? `onclick="questDetail(${i})"` : ''}>${r ? `<img src="img/crests/${r.success ? 'seal_success' : 'seal_fail'}.webp" alt="" onerror="this.remove()"><b>${r.success ? ic('grail') : ic('dagger')}</b>` : `<b>${sz}</b>`}
      <small>${r ? (r.fails ? r.fails + ' 败' : '成功') + (r.magics ? ' · 魔法' : '') : i === 3 && S.twoFailQuest4 ? '需2败' : '第' + (i + 1) + '轮'}</small></div>`;
  }).join('')}</div><div class="rej">否决 ${[0, 1, 2, 3, 4].map((i) => `<i class="${i < S.rejects ? 'on' : ''}"></i>`).join('')}</div></div>`;
}

// ---------- 复盘时间线（结算后） ----------
function timeline() {
  if (!S.history.length) return '';
  const row = (h) => {
    if (h.type === 'vote') return `<li class="${h.ok ? 'ok' : 'no'}"><b>第${h.quest + 1}轮 · 第${h.attempt}次组队</b>：队长 ${seat(h.leader)}号 提名 ${h.team.map(seat).sort((a, b) => a - b).join('、')} 号 → ${h.ok ? '通过' : '否决'}<small>同意：${Object.keys(h.votes).filter((k) => h.votes[k]).map(seat).sort((a, b) => a - b).join('、') || '无'}；反对：${Object.keys(h.votes).filter((k) => !h.votes[k]).map(seat).sort((a, b) => a - b).join('、') || '无'}</small></li>`;
    if (h.type === 'quest') return `<li class="${h.success ? 'qok' : 'qno'}"><b>第${h.quest + 1}轮任务${h.success ? '成功' : '失败'}</b>：${h.fails} 张失败${h.magics ? `，${h.magics} 张魔法` : ''}${h.msgGood ? `，${h.msgGood} 张好信` : ''}${h.msgEvil ? `，${h.msgEvil} 张坏信` : ''}${h.msgAdjust ? `（第5轮信使修正 ${h.msgAdjust > 0 ? '+' : ''}${h.msgAdjust}）` : ''}${h.rogueGood ? `，${h.rogueGood} 张好游侠` : ''}${h.rogueEvil ? `，${h.rogueEvil} 张坏游侠` : ''}${h.watchTarget ? `；监视 ${seat(h.watchTarget)}号` : ''}${h.trapperExcluded ? `；陷阱师弃掉 ${seat(h.trapperExcluded)}号 的牌` : ''}${h.faceup ? `；${seat(h.faceup.id)}号 明牌${CARD[h.faceup.card]?.t || h.faceup.card}` : ''}${h.excal && h.excal.target ? `；${seat(h.excal.holder)}号 用王者之剑翻了 ${seat(h.excal.target)}号` : ''}</li>`;
    if (h.type === 'watch') return `<li><b>监视标记（第${h.quest + 1}轮）</b>：队长 ${seat(h.leader)}号 监视 ${seat(h.target)}号</li>`;
    if (h.type === 'plot') return `<li><b>阴谋卡分发（第${h.quest + 1}轮）</b>：${seat(h.from)}号 分给 ${seat(h.to)}号「${PLOT_CARDS[h.card]?.name || h.card}」</li>`;
    if (h.type === 'plotUse') return `<li><b>打出阴谋卡（第${h.quest + 1}轮）</b>：${seat(h.by)}号 打出「${PLOT_CARDS[h.card]?.name || h.card}」${h.target ? `（目标 ${seat(h.target)}号）` : ''}</li>`;
    if (h.type === 'recruit') return `<li><b>招募阶段</b>：${h.hit ? `猜中 ${seat(h.target)}号 为不可信的仆人（倒戈接管刺杀）` : '未猜中不可信的仆人'}</li>`;
    if (h.type === 'lady') return `<li><b>湖中仙女</b>：${seat(h.holder)}号 查验了 ${seat(h.target)}号</li>`;
    if (h.type === 'lancelot') return `<li><b>忠诚牌</b>：${h.card === 'switch' ? '换阵营' : '不换'}</li>`;
    return '';
  };
  return `<div class="card"><h3>复盘时间线</h3><ol class="tl">${S.history.map(row).join('')}</ol></div>`;
}

// ---------- 对局主界面 ----------
function gameView() {
  let h = (linkFrom ? `<div class="linkbar" onclick="linkFrom=null;render()">已选 ${seat(linkFrom)}号 ${esc(P(linkFrom).name)}，点另一个人的头像建立关系（点这里取消）</div>` : '');
  h += roleCard() + questTrack();
  h += roundTable(centerStage());
  if (S.spectators && S.spectators.length) h += `<div class="specs">${ic('eye')}观众席：${S.spectators.map(esc).join('、')}</div>`;
  h += actionBar();
  if (S.phase === 'end') h += timeline();
  h += infoCard() + voteMatrix() + notesPanel();
  return h;
}

// ---------- 大厅：预设板子 ----------
const PRESETS = [
  { name: '新手标准局', sub: '5–10 人 · 梅林 刺客 派西维尔 莫甘娜', s: { percival: true, morgana: true, mordred: false, oberon: false, cleric: false, troublemaker: false, lunatic: false, brute: false, revealer: false, trickster: false, good_sorcerer: false, evil_sorcerer: false, assassin: true, lancelot: 0, lady: false, excalibur: false }, art: ['merlin', 'percival', 'morgana', 'assassin'] },
  { name: '进阶局', sub: '7 人起 · 加莫德雷德 · 湖中仙女', s: { percival: true, morgana: true, mordred: true, oberon: false, cleric: false, troublemaker: false, lunatic: false, brute: false, revealer: false, trickster: false, good_sorcerer: false, evil_sorcerer: false, assassin: true, lancelot: 0, lady: true, excalibur: false }, art: ['merlin', 'percival', 'mordred', 'morgana'] },
  { name: '兰斯洛特局', sub: '8 人起 · 双兰斯洛特规则 2 · 湖中仙女', s: { percival: true, morgana: true, mordred: false, oberon: false, cleric: false, troublemaker: false, lunatic: false, brute: false, revealer: false, trickster: false, good_sorcerer: false, evil_sorcerer: false, assassin: true, lancelot: 2, lady: true, excalibur: false }, art: ['good_lancelot', 'evil_lancelot', 'merlin', 'morgana'] },
  { name: '混沌局', sub: '10 人 · 牧师 捣蛋鬼 疯子 诡术师 · 王者之剑', s: { percival: true, morgana: false, mordred: false, oberon: false, cleric: true, troublemaker: true, lunatic: true, brute: false, revealer: false, trickster: true, good_sorcerer: false, evil_sorcerer: false, assassin: true, lancelot: 0, lady: false, excalibur: true }, art: ['cleric', 'troublemaker', 'lunatic', 'trickster'] },
];
function presetsView(host) {
  const st = S.settings;
  const same = (s) => Object.keys(s).every((k) => (st[k] || 0) == (s[k] || 0));
  return `<div class="presets">${PRESETS.map((p, i) => `<div class="preset ${same(p.s) ? 'on' : ''} ${host ? 'can' : ''}" ${host ? `onclick="setS(PRESETS[${i}].s)"` : ''}>
    <div class="pa">${p.art.map((a) => `<img src="${img(a)}" alt="" loading="lazy">`).join('')}</div><div class="pn"><b>${p.name}</b><small>${p.sub}</small></div>${same(p.s) ? `<span class="pon">${ic('check')}</span>` : ''}</div>`).join('')}</div>`;
}

// ---------- 点任务火漆：这一轮的完整记录 ----------
function questDetail(i) {
  const votes = S.history.filter((h) => h.type === 'vote' && h.quest === i);
  const q = S.history.find((h) => h.type === 'quest' && h.quest === i);
  const chip = (id) => `<span class="qd-p">${avH(P(id).avatar, 'mini')}${seat(id)}号 ${esc(P(id).name)}</span>`;
  const ids = (o, v) => Object.keys(o).filter((k) => !!o[k] === v).sort((a, b) => seat(a) - seat(b));
  const voteBlock = (v) => {
    const yes = ids(v.votes, true), no = ids(v.votes, false);
    const name = (id) => `<span class="qd-n">${avH(P(id).avatar, 'mini')}${seat(id)}号 ${esc(P(id).name)}</span>`;
    return `<div class="qd-v ${v.ok ? 'ok' : 'no'}">
    <div class="qd-title">${avH(P(v.leader).avatar, 'mini')}${seat(v.leader)}号 ${esc(P(v.leader).name)} 的发车<small>第 ${v.attempt} 次组队 · ${v.ok ? '通过' : '否决'}</small></div>
    <div class="qd-team">${v.team.slice().sort((a, b) => seat(a) - seat(b)).map((id) => `<span>${avH(P(id).avatar, 'mini')}${seat(id)}号 ${esc(P(id).name)}</span>`).join('')}</div>
    <div class="qd-boxes"><div class="qd-box yes"><div class="qd-bh">${ic('check')}同意 ${yes.length}</div>${yes.map(name).join('') || '<span class="qd-none">无</span>'}</div>
    <div class="qd-box no"><div class="qd-bh">${ic('cross')}反对 ${no.length}</div>${no.map(name).join('') || '<span class="qd-none">无</span>'}</div></div></div>`;
  };
  const res = q ? `<div class="qd-res ${q.success ? 'ok' : 'fail'}">${ic(q.success ? 'grail' : 'dagger')}<b>任务${q.success ? '成功' : '失败'}</b><span>${q.fails} 张失败${q.magics ? ` · ${q.magics} 张魔法` : ''}${q.msgGood ? ` · ${q.msgGood} 好信` : ''}${q.msgEvil ? ` · ${q.msgEvil} 坏信` : ''}${q.rogueGood ? ` · ${q.rogueGood} 好游侠` : ''}${q.rogueEvil ? ` · ${q.rogueEvil} 坏游侠` : ''}${q.need === 2 ? ' · 本轮需 2 张失败' : ''}</span>
    ${q.watchTarget ? `<small>监视标记：${seat(q.watchTarget)}号（本轮不可出游侠牌）</small>` : ''}${q.trapperExcluded ? `<small>陷阱师：队长弃掉了 ${seat(q.trapperExcluded)}号 的牌</small>` : ''}${q.faceup ? `<small>找到你了！：${seat(q.faceup.id)}号 明牌出了 ${CARD[q.faceup.card]?.t || q.faceup.card}</small>` : ''}${q.msgAdjust ? `<small>第 5 轮信使增援：失败数修正 ${q.msgAdjust > 0 ? '+' : ''}${q.msgAdjust}</small>` : ''}${q.excal ? `<small>${q.excal.target ? `王者之剑：${seat(q.excal.holder)}号 翻了 ${seat(q.excal.target)}号 的牌` : `王者之剑：${seat(q.excal.holder)}号 没有使用`}</small>` : ''}</div>` : '<div class="qd-res">这一轮还没出结果</div>';
  $('#modal').innerHTML = `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="box qd">
    <h3 style="margin:0 0 8px;font-family:var(--serif);color:var(--gold);letter-spacing:2px">第 ${i + 1} 轮任务 · ${S.teamSizes[i]} 人</h3>${res}
    ${votes.slice().reverse().map(voteBlock).join('')}
    <button class="sec" onclick="closeModal()">关闭</button></div></div>`;
}

// ---------- 发言顺序设置：队长指定从谁开始、顺时针 / 逆时针 ----------
let spStart = null, spDir = 1;
function speechSetup() {
  const n = S.players.length, li = S.players.findIndex((p) => p.id === S.leader);
  if (!spStart || !S.players.some((p) => p.id === spStart)) spStart = S.players[(li + spDir + n) % n].id;
  const order = () => { const s = S.players.findIndex((p) => p.id === spStart); return Array.from({ length: n }, (_, i) => S.players[(s + spDir * i + n * n) % n]); };
  const draw = () => {
    const inner = `<h3 style="margin:0 0 8px;font-family:var(--serif);color:var(--gold);letter-spacing:2px">发言顺序</h3>
      <div class="row"><button class="${spDir === 1 ? '' : 'sec'}" onclick="spDir=1;spStart=null;speechSetup()">顺时针 ↻</button><button class="${spDir === -1 ? '' : 'sec'}" onclick="spDir=-1;spStart=null;speechSetup()">逆时针 ↺</button></div>
      <div class="mute" style="margin:8px 0 4px">从谁开始（默认队长的${spDir === 1 ? '下一位' : '上一位'}，队长最后总结）：</div>
      <div class="sp-seats">${S.players.map((p, i) => `<span class="${p.id === spStart ? 'on' : ''}" onclick="spStart='${p.id}';speechSetup()">${avH(p.avatar, 'mini')}${i + 1}号 ${esc(p.name)}</span>`).join('')}</div>
      <div class="mute" style="margin:8px 0 4px">顺序预览：</div><div class="sp-prev">${order().map((p) => `${seat(p.id)}`).join(' → ')}</div>
      <button class="okb" onclick="send({t:'speechStart',start:spStart,dir:spDir});closeModal()">${ic('mic')}按这个顺序开始</button>
      <button class="sec" onclick="closeModal()">取消</button>`;
    const cur = $('#modal .box.spset');
    if (cur) { cur.innerHTML = inner; return; }
    $('#modal').innerHTML = `<div class="modal" onclick="if(event.target===this)closeModal()"><div class="box spset">${inner}</div></div>`;
  };
  draw();
}
